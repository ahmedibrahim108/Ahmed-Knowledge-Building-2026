import {
  QUICK_DROP_LIFETIME_MS,
  QuickDropItem,
  QuickDropItemType,
  QuickDropStatus,
  classifyQuickDropContent,
  isQuickDropItemExpired,
} from '../utils/quickDropUtils';
import {
  ensureSupabaseRealtimeAuth,
  formatSupabaseErrorMessage,
  isSupabaseConfigured,
  supabase,
  withFirebaseTokenRetry,
} from './supabaseClient';

const CACHE_PREFIX = 'kb_quick_drop_cache_v1_';
const QUEUE_PREFIX = 'kb_quick_drop_queue_v1_';

export type QuickDropSyncState =
  | 'idle'
  | 'loading'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'needs_migration'
  | 'error';

type PendingMutation =
  | {
      kind: 'create';
      item: QuickDropItem;
      queuedAt: number;
    }
  | {
      kind: 'trash';
      id: string;
      trashedAt: string;
      queuedAt: number;
    }
  | {
      kind: 'restore';
      id: string;
      expiresAt: string;
      queuedAt: number;
    }
  | {
      kind: 'delete';
      id: string;
      queuedAt: number;
    }
  | {
      kind: 'empty_trash';
      queuedAt: number;
    };

let hasPending016Migration = false;
export function isPending016Migration(): boolean {
  return hasPending016Migration;
}

function isMissing016TableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; status?: number };
  const code = (e.code || '').toUpperCase();
  const msg = (e.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    e.status === 404 ||
    (msg.includes('quick_drop_items') &&
      (msg.includes('does not exist') || msg.includes('schema cache')))
  );
}

function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  if (!err || typeof err !== 'object') return false;
  const msg = ((err as { message?: string }).message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('load failed')
  );
}

function safeStorageGet(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or private mode restrictions
  }
}

export function readCachedQuickDropItems(uid: string): QuickDropItem[] {
  if (!uid) return [];
  const raw = safeStorageGet(`${CACHE_PREFIX}${uid}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QuickDropItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.content === 'string' &&
        item.userId === uid
    );
  } catch {
    return [];
  }
}

function writeCachedQuickDropItems(uid: string, items: QuickDropItem[]): void {
  if (!uid) return;
  safeStorageSet(`${CACHE_PREFIX}${uid}`, JSON.stringify(items.slice(0, 200)));
}

function readQueue(uid: string): PendingMutation[] {
  if (!uid) return [];
  const raw = safeStorageGet(`${QUEUE_PREFIX}${uid}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingMutation[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(uid: string, queue: PendingMutation[]): void {
  if (!uid) return;
  safeStorageSet(`${QUEUE_PREFIX}${uid}`, JSON.stringify(queue.slice(-100)));
}

function enqueueMutation(uid: string, op: PendingMutation): void {
  const prev = readQueue(uid);
  // Deduplicate identical create IDs or repeated state ops for the same ID
  const filtered = prev.filter((existing) => {
    if (op.kind === 'empty_trash') {
      return existing.kind !== 'empty_trash';
    }
    if ('id' in existing && 'id' in op && existing.id === op.id) {
      if (op.kind === 'delete') return false;
      if (existing.kind === op.kind) return false;
    }
    if (
      op.kind === 'create' &&
      existing.kind === 'create' &&
      existing.item.id === op.item.id
    ) {
      return false;
    }
    return true;
  });
  filtered.push(op);
  writeQueue(uid, filtered);
}

function applyMutationsToList(
  base: QuickDropItem[],
  queue: PendingMutation[]
): QuickDropItem[] {
  let list = [...base];
  for (const op of queue) {
    if (op.kind === 'create') {
      if (!list.some((x) => x.id === op.item.id)) {
        list.unshift({ ...op.item, pendingSync: true });
      }
    } else if (op.kind === 'trash') {
      list = list.map((x) =>
        x.id === op.id
          ? {
              ...x,
              status: 'trashed',
              trashedAt: op.trashedAt,
              updatedAt: op.trashedAt,
              pendingSync: true,
            }
          : x
      );
    } else if (op.kind === 'restore') {
      list = list.map((x) =>
        x.id === op.id
          ? {
              ...x,
              status: 'active',
              trashedAt: null,
              expiresAt: op.expiresAt,
              updatedAt: new Date(op.queuedAt).toISOString(),
              pendingSync: true,
            }
          : x
      );
    } else if (op.kind === 'delete') {
      list = list.filter((x) => x.id !== op.id);
    } else if (op.kind === 'empty_trash') {
      list = list.filter((x) => x.status !== 'trashed');
    }
  }
  return list;
}

interface RawQuickDropRow {
  id: string;
  user_id: string;
  title?: string | null;
  content?: string | null;
  item_type?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  status?: string | null;
  trashed_at?: string | null;
  updated_at?: string | null;
}

function mapQuickDropRow(row: RawQuickDropRow): QuickDropItem {
  const itemType: QuickDropItemType =
    row.item_type === 'url' || row.item_type === 'mixed'
      ? row.item_type
      : 'text';
  const status: QuickDropStatus =
    row.status === 'trashed' ? 'trashed' : 'active';
  const createdAt = row.created_at || new Date().toISOString();
  const createdMs = Date.parse(createdAt) || Date.now();
  const expiresAt =
    row.expires_at ||
    new Date(createdMs + QUICK_DROP_LIFETIME_MS).toISOString();

  return {
    id: row.id,
    userId: row.user_id,
    title: (row.title || '').slice(0, 140),
    content: row.content || '',
    itemType,
    createdAt,
    expiresAt,
    status,
    trashedAt: row.trashed_at ?? null,
    updatedAt: row.updated_at || createdAt,
    pendingSync: false,
  };
}

export function generateQuickDropId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `qd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function executeCloudMutation(
  uid: string,
  op: PendingMutation
): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !uid) return;

  await withFirebaseTokenRetry(async (client) => {
    if (op.kind === 'create') {
      const { error } = await client.from('quick_drop_items').upsert(
        {
          id: op.item.id,
          user_id: uid,
          title: op.item.title.slice(0, 140),
          content: op.item.content.slice(0, 12000),
          item_type: op.item.itemType,
          created_at: op.item.createdAt,
          expires_at: op.item.expiresAt,
          status: op.item.status,
          trashed_at: op.item.trashedAt,
        },
        { onConflict: 'user_id,id' }
      );
      if (error) throw error;
      return;
    }

    if (op.kind === 'trash') {
      const { error } = await client
        .from('quick_drop_items')
        .update({
          status: 'trashed',
          trashed_at: op.trashedAt,
        })
        .eq('user_id', uid)
        .eq('id', op.id);
      if (error) throw error;
      return;
    }

    if (op.kind === 'restore') {
      const { error } = await client
        .from('quick_drop_items')
        .update({
          status: 'active',
          trashed_at: null,
          expires_at: op.expiresAt,
        })
        .eq('user_id', uid)
        .eq('id', op.id);
      if (error) throw error;
      return;
    }

    if (op.kind === 'delete') {
      const { error } = await client
        .from('quick_drop_items')
        .delete()
        .eq('user_id', uid)
        .eq('id', op.id);
      if (error) throw error;
      return;
    }

    if (op.kind === 'empty_trash') {
      const { error } = await client
        .from('quick_drop_items')
        .delete()
        .eq('user_id', uid)
        .eq('status', 'trashed');
      if (error) throw error;
    }
  });
}

export async function flushQuickDropQueue(uid: string): Promise<number> {
  if (!uid || !isSupabaseConfigured || !supabase) return 0;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;

  const queue = readQueue(uid);
  if (queue.length === 0) return 0;

  const remaining: PendingMutation[] = [];
  let flushed = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const op = queue[i];
    try {
      await executeCloudMutation(uid, op);
      flushed += 1;
      hasPending016Migration = false;
    } catch (err) {
      if (isMissing016TableError(err)) {
        hasPending016Migration = true;
        remaining.push(...queue.slice(i));
        break;
      }
      if (isNetworkFailure(err)) {
        remaining.push(...queue.slice(i));
        break;
      }
      // Re-throw auth/validation errors after keeping remaining queue safe
      remaining.push(...queue.slice(i));
      writeQueue(uid, remaining);
      throw err;
    }
  }

  writeQueue(uid, remaining);
  return flushed;
}

export async function archiveMyExpiredQuickDropItems(
  uid: string
): Promise<void> {
  if (!uid || !isSupabaseConfigured || !supabase) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  try {
    const { error } = await withFirebaseTokenRetry(async (client) =>
      client.rpc('archive_my_expired_quick_drop_items')
    );
    if (error) {
      const msg = (error.message || '').toLowerCase();
      // Fallback direct update if RPC wasn't created yet
      if (
        error.code === '42883' ||
        error.code === 'PGRST202' ||
        msg.includes('archive_my_expired_quick_drop_items')
      ) {
        const nowIso = new Date().toISOString();
        await withFirebaseTokenRetry(async (client) =>
          client
            .from('quick_drop_items')
            .update({ status: 'trashed', trashed_at: nowIso })
            .eq('user_id', uid)
            .eq('status', 'active')
            .lte('expires_at', nowIso)
        );
      }
    }
  } catch {
    // Non-blocking best-effort archive trigger
  }
}

export async function fetchQuickDropItemsFromCloud(
  uid: string
): Promise<QuickDropItem[]> {
  if (!uid) return [];

  if (!isSupabaseConfigured || !supabase) {
    return readCachedQuickDropItems(uid);
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const cached = readCachedQuickDropItems(uid);
    return applyMutationsToList(cached, readQueue(uid));
  }

  await flushQuickDropQueue(uid);
  await archiveMyExpiredQuickDropItems(uid);

  const { data, error } = await withFirebaseTokenRetry(async (client) =>
    client
      .from('quick_drop_items')
      .select(
        'id, user_id, title, content, item_type, created_at, expires_at, status, trashed_at, updated_at'
      )
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(150)
  );

  if (error) {
    if (isMissing016TableError(error)) {
      hasPending016Migration = true;
    }
    throw error;
  }

  hasPending016Migration = false;
  const mapped = ((data as RawQuickDropRow[] | null) ?? []).map(mapQuickDropRow);
  const withPending = applyMutationsToList(mapped, readQueue(uid));

  // Client safety check if an item crossed expiresAt milliseconds before fetch
  const nowMs = Date.now();
  const normalized = withPending.map((item) =>
    isQuickDropItemExpired(item, nowMs)
      ? {
          ...item,
          status: 'trashed' as const,
          trashedAt: item.trashedAt || item.expiresAt,
        }
      : item
  );

  writeCachedQuickDropItems(uid, normalized);
  return normalized;
}

export async function createQuickDropItem(
  uid: string,
  payload: { id?: string; title?: string; content: string }
): Promise<{ item: QuickDropItem; synced: boolean; offlineQueued: boolean }> {
  const cleanContent = payload.content.trim().slice(0, 12000);
  const cleanTitle = (payload.title || '').trim().slice(0, 140);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAtIso = new Date(now + QUICK_DROP_LIFETIME_MS).toISOString();

  const item: QuickDropItem = {
    id: payload.id || generateQuickDropId(),
    userId: uid,
    title: cleanTitle,
    content: cleanContent,
    itemType: classifyQuickDropContent(cleanContent),
    createdAt: nowIso,
    expiresAt: expiresAtIso,
    status: 'active',
    trashedAt: null,
    updatedAt: nowIso,
    pendingSync: false,
  };

  // Update per-user cache optimistically right away
  const prevCache = readCachedQuickDropItems(uid);
  const nextCache = [item, ...prevCache.filter((x) => x.id !== item.id)];
  writeCachedQuickDropItems(uid, nextCache);

  const op: PendingMutation = { kind: 'create', item, queuedAt: now };

  if (
    !isSupabaseConfigured ||
    !supabase ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    enqueueMutation(uid, op);
    const queuedItem = { ...item, pendingSync: true };
    writeCachedQuickDropItems(
      uid,
      [queuedItem, ...prevCache.filter((x) => x.id !== item.id)]
    );
    return { item: queuedItem, synced: false, offlineQueued: true };
  }

  try {
    await executeCloudMutation(uid, op);
    hasPending016Migration = false;
    return { item, synced: true, offlineQueued: false };
  } catch (err) {
    if (isMissing016TableError(err)) {
      hasPending016Migration = true;
    }
    if (isNetworkFailure(err) || isMissing016TableError(err)) {
      enqueueMutation(uid, op);
      const queuedItem = { ...item, pendingSync: true };
      writeCachedQuickDropItems(
        uid,
        [queuedItem, ...prevCache.filter((x) => x.id !== item.id)]
      );
      return { item: queuedItem, synced: false, offlineQueued: true };
    }
    // Rollback cache on real permission/validation error
    writeCachedQuickDropItems(uid, prevCache);
    throw new Error(
      formatSupabaseErrorMessage(err, 'تعذر حفظ العنصر في النقل السريع.')
    );
  }
}

export async function moveQuickDropItemToTrash(
  uid: string,
  id: string
): Promise<{ synced: boolean; offlineQueued: boolean }> {
  const now = Date.now();
  const trashedAt = new Date(now).toISOString();
  const prevCache = readCachedQuickDropItems(uid);
  writeCachedQuickDropItems(
    uid,
    prevCache.map((x) =>
      x.id === id
        ? { ...x, status: 'trashed', trashedAt, updatedAt: trashedAt }
        : x
    )
  );

  const op: PendingMutation = { kind: 'trash', id, trashedAt, queuedAt: now };

  if (
    !isSupabaseConfigured ||
    !supabase ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    enqueueMutation(uid, op);
    return { synced: false, offlineQueued: true };
  }

  try {
    await executeCloudMutation(uid, op);
    return { synced: true, offlineQueued: false };
  } catch (err) {
    if (isNetworkFailure(err) || isMissing016TableError(err)) {
      if (isMissing016TableError(err)) hasPending016Migration = true;
      enqueueMutation(uid, op);
      return { synced: false, offlineQueued: true };
    }
    writeCachedQuickDropItems(uid, prevCache);
    throw new Error(
      formatSupabaseErrorMessage(err, 'تعذر نقل العنصر إلى سلة المهملات.')
    );
  }
}

export async function restoreQuickDropItem(
  uid: string,
  id: string
): Promise<{ expiresAt: string; synced: boolean; offlineQueued: boolean }> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + QUICK_DROP_LIFETIME_MS).toISOString();
  const prevCache = readCachedQuickDropItems(uid);

  writeCachedQuickDropItems(
    uid,
    prevCache.map((x) =>
      x.id === id
        ? {
            ...x,
            status: 'active',
            trashedAt: null,
            expiresAt,
            updatedAt: nowIso,
          }
        : x
    )
  );

  const op: PendingMutation = { kind: 'restore', id, expiresAt, queuedAt: now };

  if (
    !isSupabaseConfigured ||
    !supabase ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    enqueueMutation(uid, op);
    return { expiresAt, synced: false, offlineQueued: true };
  }

  try {
    await executeCloudMutation(uid, op);
    return { expiresAt, synced: true, offlineQueued: false };
  } catch (err) {
    if (isNetworkFailure(err) || isMissing016TableError(err)) {
      if (isMissing016TableError(err)) hasPending016Migration = true;
      enqueueMutation(uid, op);
      return { expiresAt, synced: false, offlineQueued: true };
    }
    writeCachedQuickDropItems(uid, prevCache);
    throw new Error(
      formatSupabaseErrorMessage(err, 'تعذر استعادة العنصر من سلة المهملات.')
    );
  }
}

export async function deleteQuickDropItemPermanently(
  uid: string,
  id: string
): Promise<{ synced: boolean; offlineQueued: boolean }> {
  const now = Date.now();
  const prevCache = readCachedQuickDropItems(uid);
  writeCachedQuickDropItems(
    uid,
    prevCache.filter((x) => x.id !== id)
  );

  const op: PendingMutation = { kind: 'delete', id, queuedAt: now };

  if (
    !isSupabaseConfigured ||
    !supabase ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    enqueueMutation(uid, op);
    return { synced: false, offlineQueued: true };
  }

  try {
    await executeCloudMutation(uid, op);
    return { synced: true, offlineQueued: false };
  } catch (err) {
    if (isNetworkFailure(err) || isMissing016TableError(err)) {
      if (isMissing016TableError(err)) hasPending016Migration = true;
      enqueueMutation(uid, op);
      return { synced: false, offlineQueued: true };
    }
    writeCachedQuickDropItems(uid, prevCache);
    throw new Error(
      formatSupabaseErrorMessage(err, 'تعذر الحذف النهائي للعنصر.')
    );
  }
}

export async function emptyQuickDropTrash(
  uid: string
): Promise<{ synced: boolean; offlineQueued: boolean }> {
  const now = Date.now();
  const prevCache = readCachedQuickDropItems(uid);
  writeCachedQuickDropItems(
    uid,
    prevCache.filter((x) => x.status !== 'trashed')
  );

  const op: PendingMutation = { kind: 'empty_trash', queuedAt: now };

  if (
    !isSupabaseConfigured ||
    !supabase ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    enqueueMutation(uid, op);
    return { synced: false, offlineQueued: true };
  }

  try {
    await executeCloudMutation(uid, op);
    return { synced: true, offlineQueued: false };
  } catch (err) {
    if (isNetworkFailure(err) || isMissing016TableError(err)) {
      if (isMissing016TableError(err)) hasPending016Migration = true;
      enqueueMutation(uid, op);
      return { synced: false, offlineQueued: true };
    }
    writeCachedQuickDropItems(uid, prevCache);
    throw new Error(
      formatSupabaseErrorMessage(err, 'تعذر إفراغ سلة المهملات.')
    );
  }
}

export function subscribeQuickDropInbox(
  uid: string,
  callbacks: {
    onItems: (items: QuickDropItem[]) => void;
    onSyncState: (state: QuickDropSyncState, errorMsg?: string | null) => void;
  }
): {
  refreshNow: () => Promise<void>;
  unsubscribe: () => void;
} {
  let disposed = false;
  let realtimeSubscribed = false;
  let activeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null =
    null;
  let reconnectTimer: number | null = null;
  let inFlightRefresh: Promise<void> | null = null;

  // Immediate cache hydration for crisp startup
  const cached = applyMutationsToList(
    readCachedQuickDropItems(uid),
    readQueue(uid)
  );
  if (cached.length > 0) {
    callbacks.onItems(cached);
  }

  const refreshNow = async () => {
    if (disposed || !uid) return;
    if (inFlightRefresh) return inFlightRefresh;

    inFlightRefresh = (async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const offlineList = applyMutationsToList(
          readCachedQuickDropItems(uid),
          readQueue(uid)
        );
        if (!disposed) {
          callbacks.onItems(offlineList);
          callbacks.onSyncState('offline', null);
        }
        return;
      }

      if (!disposed) {
        callbacks.onSyncState('syncing', null);
      }

      try {
        const items = await fetchQuickDropItemsFromCloud(uid);
        if (!disposed) {
          callbacks.onItems(items);
          callbacks.onSyncState('synced', null);
        }
      } catch (err) {
        if (disposed) return;
        if (isMissing016TableError(err)) {
          hasPending016Migration = true;
          callbacks.onSyncState('needs_migration', null);
          return;
        }
        if (isNetworkFailure(err)) {
          callbacks.onSyncState('offline', null);
          return;
        }
        callbacks.onSyncState(
          'error',
          formatSupabaseErrorMessage(
            err,
            'تعذر تحديث عناصر النقل السريع من السحابة.'
          )
        );
      }
    })();

    try {
      await inFlightRefresh;
    } finally {
      inFlightRefresh = null;
    }
  };

  const setupRealtime = async (forceRefreshToken = false) => {
    if (disposed || !supabase || !isSupabaseConfigured || !uid) return;
    await ensureSupabaseRealtimeAuth(forceRefreshToken);
    if (disposed || !supabase) return;

    if (activeChannel) {
      void supabase.removeChannel(activeChannel);
      activeChannel = null;
    }

    const ch = supabase
      .channel(`quick_drop_${uid}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quick_drop_items',
          filter: `user_id=eq.${uid}`,
        },
        () => {
          if (!disposed) {
            void refreshNow();
          }
        }
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          realtimeSubscribed = true;
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          realtimeSubscribed = false;
          if (!reconnectTimer && typeof window !== 'undefined') {
            reconnectTimer = window.setTimeout(() => {
              reconnectTimer = null;
              void setupRealtime(true);
            }, 4000);
          }
        }
      });

    activeChannel = ch;
  };

  void refreshNow();
  void setupRealtime(false);

  const onResume = () => {
    if (disposed) return;
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      return;
    }
    void refreshNow();
    if (!realtimeSubscribed) {
      void setupRealtime(false);
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onResume);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onResume);
    window.addEventListener('pageshow', onResume);
    window.addEventListener('online', onResume);
  }

  const periodicTimer =
    typeof window !== 'undefined'
      ? window.setInterval(() => {
          if (
            disposed ||
            (typeof document !== 'undefined' &&
              document.visibilityState !== 'visible') ||
            (typeof navigator !== 'undefined' && navigator.onLine === false)
          ) {
            return;
          }
          void refreshNow();
        }, 20000)
      : null;

  return {
    refreshNow,
    unsubscribe: () => {
      disposed = true;
      if (reconnectTimer && typeof window !== 'undefined') {
        window.clearTimeout(reconnectTimer);
      }
      if (periodicTimer && typeof window !== 'undefined') {
        window.clearInterval(periodicTimer);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onResume);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onResume);
        window.removeEventListener('pageshow', onResume);
        window.removeEventListener('online', onResume);
      }
      if (supabase && activeChannel) {
        void supabase.removeChannel(activeChannel);
      }
    },
  };
}
