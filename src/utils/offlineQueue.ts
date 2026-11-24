import type {
  ActivityLogEntry,
  BlogPost,
  BookNote,
  CalendarEvent,
  CustomCategory,
  DailyJournalRecord,
  DentalCase,
  DomainInfo,
  LearningPath,
  MonthPlan,
  PeriodReviewRecord,
  PersonalCourse,
  PersonalReflection,
  PinCollection,
  PracticalProject,
  QuarterInfo,
  ReadingLibraryItem,
  StudyHistoryEntry,
  UnifiedTask,
  UserPreferences,
  WeeklyMeeting,
  WeeklyPlanRecord,
} from '../data/curriculumData';

export type OfflineMutationOp = 'upsert' | 'delete';

export interface QueuedSupabaseMutation {
  id: string;
  uid: string;
  table: string;
  op: OfflineMutationOp;
  keyCol: string;
  keyVal: string;
  onConflict?: string;
  row?: Record<string, unknown>;
  queuedAtMs: number;
}

export interface OfflineCachedUserProfile {
  uid: string;
  email: string;
  display_name: string;
  photo_url: string;
  role: 'admin' | 'member';
  is_active: boolean;
  created_at_ms: number;
  last_login_ms: number;
}

export interface WorkspaceOfflineSnapshot {
  uid: string;
  savedAtMs: number;
  quarters?: QuarterInfo[];
  months?: MonthPlan[];
  domains?: DomainInfo[];
  courses?: PersonalCourse[];
  bookNotes?: BookNote[];
  customCategories?: CustomCategory[];
  history?: StudyHistoryEntry[];
  preferences?: UserPreferences;
  reflections?: PersonalReflection[];
  blogPosts?: BlogPost[];
  calendarEvents?: CalendarEvent[];
  learningPaths?: LearningPath[];
  readingItems?: ReadingLibraryItem[];
  projects?: PracticalProject[];
  unifiedTasks?: UnifiedTask[];
  dentalCases?: DentalCase[];
  weeklyMeetings?: WeeklyMeeting[];
  activityLogs?: ActivityLogEntry[];
  dailyJournals?: DailyJournalRecord[];
  periodReviews?: PeriodReviewRecord[];
  weeklyPlans?: WeeklyPlanRecord[];
  pinCollections?: PinCollection[];
}

export interface OfflineSyncState {
  isOnline: boolean;
  activeUid: string | null;
  pendingMutationsCount: number;
  pendingImagesCount: number;
  pendingAudioCount: number;
  totalPendingCount: number;
  isSyncing: boolean;
  lastSyncedAtMs: number | null;
  lastSyncMessage: string | null;
  lastSyncError: string | null;
}

const OUTBOX_STORAGE_PREFIX = 'mizan_offline_outbox_v1_';
const PROFILE_STORAGE_PREFIX = 'mizan_user_profile_v1_';
const LAST_ACTIVE_UID_KEY = 'mizan_last_active_uid_v1';
const SNAPSHOT_DB_NAME = 'mizan_offline_workspace_db';
const SNAPSHOT_DB_VERSION = 1;
const SNAPSHOT_STORE_NAME = 'snapshots';

export const OFFLINE_SYNC_EVENT = 'mizan-offline-sync-changed';

export function isAppOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function isNetworkOrOfflineError(err: unknown): boolean {
  if (!isAppOnline()) return true;
  if (!err) return false;
  const msg = (
    err instanceof Error
      ? err.message
      : typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message)
      : String(err)
  ).toLowerCase();

  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('internet disconnected') ||
    msg.includes('offline') ||
    msg.includes('fetch error') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('auth/network-request-failed')
  );
}

// ============================================================================
// Persistent Outbox Queue (Coalesced per table + keyVal)
// ============================================================================

function outboxKey(uid: string): string {
  return `${OUTBOX_STORAGE_PREFIX}${uid}`;
}

export function getOfflineOutbox(uid: string): QueuedSupabaseMutation[] {
  if (typeof window === 'undefined' || !uid) return [];
  try {
    const raw = window.localStorage.getItem(outboxKey(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedSupabaseMutation[]) : [];
  } catch {
    return [];
  }
}

function writeOfflineOutbox(uid: string, list: QueuedSupabaseMutation[]): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(outboxKey(uid), JSON.stringify(list));
  } catch {
    // Storage quota guard
  }
  updateQueueStateCounts(uid);
}

export function enqueueSupabaseUpsert(
  uid: string,
  params: {
    table: string;
    keyCol: string;
    keyVal: string;
    onConflict: string;
    row: Record<string, unknown>;
  }
): void {
  if (!uid || !params.keyVal) return;
  const id = `${params.table}:${params.keyVal}`;
  const current = getOfflineOutbox(uid).filter((m) => m.id !== id);
  current.push({
    id,
    uid,
    table: params.table,
    op: 'upsert',
    keyCol: params.keyCol,
    keyVal: params.keyVal,
    onConflict: params.onConflict,
    row: params.row,
    queuedAtMs: Date.now(),
  });
  writeOfflineOutbox(uid, current);
}

export function enqueueSupabaseDelete(
  uid: string,
  params: {
    table: string;
    keyCol: string;
    keyVal: string;
  }
): void {
  if (!uid || !params.keyVal) return;
  const id = `${params.table}:${params.keyVal}`;
  const current = getOfflineOutbox(uid).filter((m) => m.id !== id);
  current.push({
    id,
    uid,
    table: params.table,
    op: 'delete',
    keyCol: params.keyCol,
    keyVal: params.keyVal,
    queuedAtMs: Date.now(),
  });
  writeOfflineOutbox(uid, current);
}

export function removeOfflineMutation(uid: string, id: string): void {
  if (!uid) return;
  const current = getOfflineOutbox(uid);
  const next = current.filter((m) => m.id !== id);
  if (next.length !== current.length) {
    writeOfflineOutbox(uid, next);
  }
}

export function patchQueuedDailyJournalCover(
  uid: string,
  dateKey: string,
  storagePath: string,
  downloadUrl: string
): void {
  if (!uid || !dateKey) return;
  const current = getOfflineOutbox(uid);
  let changed = false;
  const next = current.map((m) => {
    if (m.table === 'daily_journals' && m.op === 'upsert' && m.keyVal === dateKey && m.row) {
      changed = true;
      return {
        ...m,
        row: {
          ...m.row,
          cover_image_storage_path: storagePath,
          cover_image_url: downloadUrl,
        },
      };
    }
    return m;
  });
  if (changed) {
    writeOfflineOutbox(uid, next);
  }
}

export function getOfflineOutboxMapForTable(
  uid: string,
  table: string
): Map<string, QueuedSupabaseMutation> {
  const map = new Map<string, QueuedSupabaseMutation>();
  for (const m of getOfflineOutbox(uid)) {
    if (m.table === table) {
      map.set(m.keyVal, m);
    }
  }
  return map;
}

// ============================================================================
// Cached User Profile (for instant offline auth unlock)
// ============================================================================

export function saveCachedUserProfile(profile: OfflineCachedUserProfile): void {
  if (typeof window === 'undefined' || !profile?.uid) return;
  try {
    window.localStorage.setItem(
      `${PROFILE_STORAGE_PREFIX}${profile.uid}`,
      JSON.stringify(profile)
    );
    window.localStorage.setItem(LAST_ACTIVE_UID_KEY, profile.uid);
  } catch {
    // Non-fatal
  }
}

export function loadCachedUserProfile(uid: string): OfflineCachedUserProfile | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = window.localStorage.getItem(`${PROFILE_STORAGE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineCachedUserProfile;
    return parsed && parsed.uid === uid ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCachedUserProfile(uid: string): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.removeItem(`${PROFILE_STORAGE_PREFIX}${uid}`);
  } catch {
    // Non-fatal
  }
}

// ============================================================================
// Workspace Offline Snapshot (IndexedDB primary — handles large books/notes)
// ============================================================================

function openSnapshotDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(SNAPSHOT_DB_NAME, SNAPSHOT_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) {
        db.createObjectStore(SNAPSHOT_STORE_NAME, { keyPath: 'uid' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Snapshot DB open error'));
  });
}

export async function saveWorkspaceOfflineSnapshot(
  snapshot: WorkspaceOfflineSnapshot
): Promise<void> {
  if (!snapshot?.uid) return;
  try {
    const db = await openSnapshotDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite');
      tx.objectStore(SNAPSHOT_STORE_NAME).put(snapshot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal fallback
  }
}

export async function loadWorkspaceOfflineSnapshot(
  uid: string
): Promise<WorkspaceOfflineSnapshot | null> {
  if (!uid) return null;
  try {
    const db = await openSnapshotDb();
    return await new Promise<WorkspaceOfflineSnapshot | null>((resolve) => {
      const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readonly');
      const req = tx.objectStore(SNAPSHOT_STORE_NAME).get(uid);
      req.onsuccess = () => {
        const res = req.result as WorkspaceOfflineSnapshot | undefined;
        resolve(res && res.uid === uid ? res : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ============================================================================
// Live Reactive Offline & Sync State Store
// ============================================================================

let currentState: OfflineSyncState = {
  isOnline: isAppOnline(),
  activeUid: null,
  pendingMutationsCount: 0,
  pendingImagesCount: 0,
  pendingAudioCount: 0,
  totalPendingCount: 0,
  isSyncing: false,
  lastSyncedAtMs: null,
  lastSyncMessage: null,
  lastSyncError: null,
};

const listeners = new Set<(state: OfflineSyncState) => void>();

function emitState(): void {
  const totalPendingCount =
    currentState.pendingMutationsCount +
    currentState.pendingImagesCount +
    currentState.pendingAudioCount;
  currentState = {
    ...currentState,
    isOnline: isAppOnline(),
    totalPendingCount,
  };
  for (const fn of listeners) {
    try {
      fn(currentState);
    } catch {
      // ignore subscriber errors
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_EVENT, { detail: currentState }));
  }
}

export function getOfflineSyncState(): OfflineSyncState {
  return currentState;
}

export function subscribeOfflineSyncState(
  cb: (state: OfflineSyncState) => void
): () => void {
  listeners.add(cb);
  cb(currentState);
  return () => {
    listeners.delete(cb);
  };
}

export function updateOfflineSyncState(
  patch: Partial<OfflineSyncState>
): void {
  currentState = {
    ...currentState,
    ...patch,
  };
  emitState();
}

export function setActiveOfflineQueueUid(uid: string | null): void {
  const mutations = uid ? getOfflineOutbox(uid).length : 0;
  currentState = {
    ...currentState,
    activeUid: uid,
    pendingMutationsCount: mutations,
  };
  emitState();
}

export function updateQueueStateCounts(uid?: string): void {
  const targetUid = uid || currentState.activeUid;
  const mutations = targetUid ? getOfflineOutbox(targetUid).length : 0;
  currentState = {
    ...currentState,
    pendingMutationsCount: mutations,
  };
  emitState();
}

export function reportPendingMediaCounts(counts: {
  images?: number;
  audio?: number;
}): void {
  currentState = {
    ...currentState,
    ...(typeof counts.images === 'number'
      ? { pendingImagesCount: Math.max(0, counts.images) }
      : {}),
    ...(typeof counts.audio === 'number'
      ? { pendingAudioCount: Math.max(0, counts.audio) }
      : {}),
  };
  emitState();
}

export function notifyOfflineMediaChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mizan-offline-media-changed'));
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    updateOfflineSyncState({ isOnline: true, lastSyncError: null });
  });
  window.addEventListener('offline', () => {
    updateOfflineSyncState({ isOnline: false });
  });
}
