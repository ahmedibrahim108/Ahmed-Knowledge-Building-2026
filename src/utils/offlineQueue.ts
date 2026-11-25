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

export type OfflineSyncItemStatus =
  | 'local_only'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'conflict';

export type OfflineEntityCategory =
  | 'book_note'
  | 'reflection'
  | 'daily_journal'
  | 'course'
  | 'learning_path'
  | 'reading_item'
  | 'project'
  | 'task'
  | 'calendar_event'
  | 'blog_post'
  | 'domain'
  | 'month'
  | 'quarter'
  | 'category'
  | 'preferences'
  | 'quick_drop'
  | 'image'
  | 'audio'
  | 'other';

export interface QueuedSupabaseMutation {
  id: string;
  uid: string;
  table: string;
  op: OfflineMutationOp;
  keyCol: string;
  keyVal: string;
  onConflict?: string;
  row?: Record<string, unknown>;
  /** Server row snapshot captured before offline mutations began */
  baseServerRow?: Record<string, unknown> | null;
  baseUpdatedAtMs?: number | null;
  createdOffline?: boolean;
  /** Human-readable metadata for Review & Sync UI */
  entityCategory?: OfflineEntityCategory;
  entityTitle?: string;
  entitySummary?: string;
  status?: Exclude<OfflineSyncItemStatus, 'synced'>;
  retryCount?: number;
  lastError?: string | null;
  /** Server row snapshot retrieved when conflict was detected */
  conflictServerRow?: Record<string, unknown> | null;
  conflictDetectedAtMs?: number | null;
  queuedAtMs: number;
  updatedAtMs?: number;
}

export interface RecentlySyncedReceipt {
  id: string;
  uid: string;
  table: string;
  keyVal: string;
  op: OfflineMutationOp;
  entityCategory: OfflineEntityCategory;
  entityTitle: string;
  syncedAtMs: number;
}

export interface OfflineCachedUserProfile {
  uid: string;
  email: string;
  display_name: string;
  photo_url: string;
  role: 'user' | 'admin';
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  created_at?: string;
  updated_at?: string;
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
  pendingQuickDropCount: number;
  pendingThemeCount: number;
  failedCount: number;
  conflictCount: number;
  localOnlyCount: number;
  totalPendingCount: number;
  isSyncing: boolean;
  pendingReviewPrompt: boolean;
  lastSyncedAtMs: number | null;
  lastSyncMessage: string | null;
  lastSyncError: string | null;
}

export interface ItemSyncStatusInfo {
  status: OfflineSyncItemStatus;
  lastError?: string | null;
  queuedAtMs?: number;
  syncedAtMs?: number;
}

const OUTBOX_STORAGE_PREFIX = 'mizan_offline_outbox_v1_';
const BASELINE_STORAGE_PREFIX = 'mizan_offline_baselines_v1_';
const RECEIPTS_STORAGE_PREFIX = 'mizan_offline_synced_receipts_v1_';
const PROFILE_STORAGE_PREFIX = 'mizan_user_profile_v1_';
const LAST_ACTIVE_UID_KEY = 'mizan_last_active_uid_v1';

const SNAPSHOT_DB_NAME = 'mizan_offline_workspace_db';
const SNAPSHOT_DB_VERSION = 2;
const SNAPSHOT_STORE_NAME = 'snapshots';
const OUTBOX_IDB_STORE = 'outbox';
const BASELINES_IDB_STORE = 'baselines';

export const OFFLINE_SYNC_EVENT = 'mizan-offline-sync-changed';

export function isAppOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function isNetworkOrOfflineError(err: unknown): boolean {
  if (!isAppOnline()) return true;
  if (!err) return false;
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return true;
  }
  const obj = typeof err === 'object' ? (err as Record<string, unknown>) : null;
  if (obj && typeof obj.status === 'number' && obj.status === 0) {
    return true;
  }
  const name = obj && typeof obj.name === 'string' ? obj.name.toLowerCase() : '';
  if (name === 'aborterror') return true;

  const msg = (
    err instanceof Error
      ? err.message
      : obj && 'message' in obj
      ? String(obj.message ?? '')
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
    msg.includes('auth/network-request-failed') ||
    msg.includes('تعذّر الاتصال بالسحابة') ||
    msg.includes('تعذر الاتصال بالسحابة') ||
    msg.includes('لا يوجد اتصال بالإنترنت') ||
    msg.includes('استقرار الإنترنت')
  );
}

// ============================================================================
// Entity Labels & Deterministic Fingerprints (for Review UI + Conflict Check)
// ============================================================================

const TABLE_TO_CATEGORY: Record<string, OfflineEntityCategory> = {
  book_notes: 'book_note',
  reflections: 'reflection',
  daily_journals: 'daily_journal',
  courses: 'course',
  learning_paths: 'learning_path',
  reading_items: 'reading_item',
  practical_projects: 'project',
  unified_tasks: 'task',
  calendar_events: 'calendar_event',
  blog_posts: 'blog_post',
  domains: 'domain',
  months: 'month',
  quarters: 'quarter',
  custom_categories: 'category',
  user_preferences: 'preferences',
  quick_drop_items: 'quick_drop',
};

export const CATEGORY_LABELS_AR: Record<OfflineEntityCategory, string> = {
  book_note: 'تلخيص / ملاحظة',
  reflection: 'خاطرة / تأمل',
  daily_journal: 'يومية',
  course: 'كورس',
  learning_path: 'مسار تعلّم',
  reading_item: 'كتاب / قراءة',
  project: 'مشروع عملي',
  task: 'مهمة',
  calendar_event: 'موعد تقويم',
  blog_post: 'مقال مدونة',
  domain: 'محور معرفي',
  month: 'وحدة دراسية',
  quarter: 'مرحلة',
  category: 'تصنيف',
  preferences: 'التفضيلات والمظهر',
  quick_drop: 'النقل السريع',
  image: 'صورة مرفقة',
  audio: 'تسجيل صوتي',
  other: 'سجل آخر',
};

function stripHtmlSimple(val: unknown): string {
  return String(val || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function describeSupabaseMutation(
  table: string,
  op: OfflineMutationOp,
  keyVal: string,
  row?: Record<string, unknown> | null
): {
  entityCategory: OfflineEntityCategory;
  entityTitle: string;
  entitySummary: string;
} {
  const entityCategory = TABLE_TO_CATEGORY[table] || 'other';
  const r = row || {};
  let rawTitle = '';
  let rawSummary = '';

  switch (table) {
    case 'book_notes':
      rawTitle = String(r.book_title || r.lecture_title || keyVal);
      rawSummary = stripHtmlSimple(r.content || r.quotes || '').slice(0, 140);
      break;
    case 'reflections':
      rawTitle = String(r.title || r.mood_tag || keyVal);
      rawSummary = String(r.content || '').trim().slice(0, 140);
      break;
    case 'daily_journals':
      rawTitle = String(r.title || `يومية ${r.date_key || keyVal}`);
      rawSummary = String(r.reflection_text || r.highlights_text || '').trim().slice(0, 140);
      break;
    case 'courses':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.notes || r.category || '').trim().slice(0, 140);
      break;
    case 'learning_paths':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.description || '').trim().slice(0, 140);
      break;
    case 'reading_items':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.takeaways || r.author || '').trim().slice(0, 140);
      break;
    case 'practical_projects':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.description || r.notes || '').trim().slice(0, 140);
      break;
    case 'unified_tasks':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.description || r.due_date || '').trim().slice(0, 140);
      break;
    case 'calendar_events':
      rawTitle = String(r.title || keyVal);
      rawSummary = `${String(r.date_key || '')} ${String(r.time_slot || '')}`.trim();
      break;
    case 'blog_posts':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.excerpt || stripHtmlSimple(r.content)).trim().slice(0, 140);
      break;
    case 'months':
      rawTitle = String(r.theme || `الوحدة ${r.month_number || keyVal}`);
      rawSummary = String(r.notes || '').trim().slice(0, 140);
      break;
    case 'quarters':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.subtitle || '').trim().slice(0, 140);
      break;
    case 'domains':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.subtitle || '').trim().slice(0, 140);
      break;
    case 'custom_categories':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.description || '').trim().slice(0, 140);
      break;
    case 'user_preferences':
      rawTitle = 'إعدادات الحساب والمظهر والتفضيلات';
      rawSummary = 'تحديث تفضيلات مساحة العمل';
      break;
    case 'period_reviews':
      rawTitle = `مراجعة (${String(r.period_key || keyVal)})`;
      rawSummary = String(r.reflection_text || '').trim().slice(0, 140);
      break;
    case 'weekly_plans':
      rawTitle = `تخطيط الأسبوع (${String(r.week_start_key || keyVal)})`;
      rawSummary = String(r.notes || '').trim().slice(0, 140);
      break;
    case 'weekly_meetings':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.description || '').trim().slice(0, 140);
      break;
    case 'dental_cases':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.specialty || r.patient_summary || '').trim().slice(0, 140);
      break;
    case 'pin_collections':
      rawTitle = String(r.title || keyVal);
      rawSummary = String(r.description || '').trim().slice(0, 140);
      break;
    case 'activity_logs':
      rawTitle = String(r.title || 'سجل نشاط');
      rawSummary = String(r.subtitle || '').trim().slice(0, 140);
      break;
    case 'study_history':
      rawTitle = String(r.title || 'سجل متابعة');
      rawSummary = String(r.detail || '').trim().slice(0, 140);
      break;
    default:
      rawTitle = String(r.title || keyVal);
      break;
  }

  const prefix = op === 'delete' ? 'حذف: ' : '';
  return {
    entityCategory,
    entityTitle: `${prefix}${rawTitle || keyVal}`,
    entitySummary: rawSummary,
  };
}

function stableNormalizeValue(val: unknown): unknown {
  if (val === null || val === undefined || val === '') return null;
  if (Array.isArray(val)) return val.map(stableNormalizeValue);
  if (typeof val === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(val as Record<string, unknown>).sort()) {
      sorted[k] = stableNormalizeValue((val as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return val;
}

const VOLATILE_SERVER_FIELDS = new Set([
  'updated_at',
  'created_at',
  'updated_at_label',
  'updated_at_ms',
  'created_at_label',
]);

export function computeRowContentFingerprint(row?: Record<string, unknown> | null): string {
  if (!row) return '';
  const cleaned: Record<string, unknown> = {};
  for (const k of Object.keys(row).sort()) {
    if (VOLATILE_SERVER_FIELDS.has(k)) continue;
    cleaned[k] = stableNormalizeValue(row[k]);
  }
  return JSON.stringify(cleaned);
}

// ============================================================================
// Persistent IndexedDB + In-Memory + localStorage Outbox & Baselines
// ============================================================================

const outboxMemoryByUid = new Map<string, QueuedSupabaseMutation[]>();
const hydratedUids = new Set<string>();
const baselineMemoryByUid = new Map<string, Record<string, Record<string, unknown>>>();

function outboxKey(uid: string): string {
  return `${OUTBOX_STORAGE_PREFIX}${uid}`;
}

function baselineKey(uid: string): string {
  return `${BASELINE_STORAGE_PREFIX}${uid}`;
}

function receiptsKey(uid: string): string {
  return `${RECEIPTS_STORAGE_PREFIX}${uid}`;
}

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
      if (!db.objectStoreNames.contains(OUTBOX_IDB_STORE)) {
        const outboxStore = db.createObjectStore(OUTBOX_IDB_STORE, { keyPath: 'uid' });
        void outboxStore;
      }
      if (!db.objectStoreNames.contains(BASELINES_IDB_STORE)) {
        db.createObjectStore(BASELINES_IDB_STORE, { keyPath: 'uid' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Snapshot DB open error'));
  });
}

function readOutboxLocalStorage(uid: string): QueuedSupabaseMutation[] {
  if (typeof window === 'undefined' || !uid) return [];
  try {
    const raw = window.localStorage.getItem(outboxKey(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedSupabaseMutation[]) : [];
  } catch {
    return [];
  }
}

function compactOutboxForLocalStorage(
  list: QueuedSupabaseMutation[]
): QueuedSupabaseMutation[] {
  return list.map((m) => {
    if (!m.row) return m;
    const copyRow = { ...m.row };
    // Avoid exceeding 5MB localStorage quota if a reflection/blog embeds a large dataUrl;
    // IndexedDB keeps the full untruncated payload safely!
    for (const field of ['image_url', 'cover_image_url', 'cover_data_url']) {
      const v = copyRow[field];
      if (typeof v === 'string' && v.startsWith('data:') && v.length > 60000) {
        copyRow[field] = v.slice(0, 60000);
      }
    }
    return {
      ...m,
      row: copyRow,
      baseServerRow: undefined,
      conflictServerRow: undefined,
    };
  });
}

async function persistOutboxToIdb(
  uid: string,
  list: QueuedSupabaseMutation[]
): Promise<void> {
  if (!uid) return;
  try {
    const db = await openSnapshotDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_IDB_STORE, 'readwrite');
      tx.objectStore(OUTBOX_IDB_STORE).put({ uid, list, updatedAtMs: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal; localStorage mirror still persisted
  }
}

export async function hydrateOfflineOutboxFromDb(
  uid: string
): Promise<QueuedSupabaseMutation[]> {
  if (!uid) return [];
  const lsList = readOutboxLocalStorage(uid);
  try {
    const db = await openSnapshotDb();
    const idbList = await new Promise<QueuedSupabaseMutation[]>((resolve) => {
      const tx = db.transaction(OUTBOX_IDB_STORE, 'readonly');
      const req = tx.objectStore(OUTBOX_IDB_STORE).get(uid);
      req.onsuccess = () => {
        const res = req.result as { uid: string; list?: QueuedSupabaseMutation[] } | undefined;
        resolve(Array.isArray(res?.list) ? res.list : []);
      };
      req.onerror = () => resolve([]);
    });

    // Also hydrate baselines
    const idbBaselines = await new Promise<Record<string, Record<string, unknown>>>(
      (resolve) => {
        const tx = db.transaction(BASELINES_IDB_STORE, 'readonly');
        const req = tx.objectStore(BASELINES_IDB_STORE).get(uid);
        req.onsuccess = () => {
          const res = req.result as
            | { uid: string; map?: Record<string, Record<string, unknown>> }
            | undefined;
          resolve(res?.map && typeof res.map === 'object' ? res.map : {});
        };
        req.onerror = () => resolve({});
      }
    );
    if (Object.keys(idbBaselines).length > 0) {
      baselineMemoryByUid.set(uid, {
        ...readBaselinesLocalStorage(uid),
        ...idbBaselines,
      });
    }

    // Merge IDB + LS preferring newest updatedAtMs/queuedAtMs per id (IDB wins on ties because it has full untruncated data)
    const merged = new Map<string, QueuedSupabaseMutation>();
    for (const m of lsList) merged.set(m.id, normalizeMutationRecord(m));
    for (const m of idbList) {
      const norm = normalizeMutationRecord(m);
      const prev = merged.get(norm.id);
      if (
        !prev ||
        (norm.updatedAtMs || norm.queuedAtMs) >= (prev.updatedAtMs || prev.queuedAtMs)
      ) {
        merged.set(norm.id, norm);
      }
    }
    const finalList = Array.from(merged.values());
    outboxMemoryByUid.set(uid, finalList);
    hydratedUids.add(uid);
    updateQueueStateCounts(uid);
    return finalList;
  } catch {
    const normalized = lsList.map(normalizeMutationRecord);
    outboxMemoryByUid.set(uid, normalized);
    hydratedUids.add(uid);
    return normalized;
  }
}

function normalizeMutationRecord(m: QueuedSupabaseMutation): QueuedSupabaseMutation {
  const meta =
    m.entityCategory && m.entityTitle
      ? {
          entityCategory: m.entityCategory,
          entityTitle: m.entityTitle,
          entitySummary: m.entitySummary || '',
        }
      : describeSupabaseMutation(m.table, m.op, m.keyVal, m.row);
  return {
    ...m,
    ...meta,
    status: m.status || 'pending',
    retryCount: typeof m.retryCount === 'number' ? m.retryCount : 0,
    updatedAtMs: m.updatedAtMs || m.queuedAtMs,
  };
}

export function getOfflineOutbox(uid: string): QueuedSupabaseMutation[] {
  if (!uid) return [];
  if (outboxMemoryByUid.has(uid)) {
    return outboxMemoryByUid.get(uid) || [];
  }
  const ls = readOutboxLocalStorage(uid).map(normalizeMutationRecord);
  outboxMemoryByUid.set(uid, ls);
  return ls;
}

function writeOfflineOutbox(uid: string, list: QueuedSupabaseMutation[]): void {
  if (!uid) return;
  const normalized = list.map(normalizeMutationRecord);
  outboxMemoryByUid.set(uid, normalized);
  hydratedUids.add(uid);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(outboxKey(uid), JSON.stringify(normalized));
    } catch {
      try {
        window.localStorage.setItem(
          outboxKey(uid),
          JSON.stringify(compactOutboxForLocalStorage(normalized))
        );
      } catch {
        // Storage quota guard; IndexedDB below holds complete queue
      }
    }
  }
  void persistOutboxToIdb(uid, normalized);
  updateQueueStateCounts(uid);
}

// ============================================================================
// Server Baseline Snapshots (for Conflict Detection)
// ============================================================================

function readBaselinesLocalStorage(
  uid: string
): Record<string, Record<string, unknown>> {
  if (typeof window === 'undefined' || !uid) return {};
  try {
    const raw = window.localStorage.getItem(baselineKey(uid));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, Record<string, unknown>>)
      : {};
  } catch {
    return {};
  }
}

export function recordServerBaselines(
  uid: string,
  table: string,
  keyCol: string,
  rows: Record<string, unknown>[]
): void {
  if (!uid || !table) return;
  const outboxIds = new Set(getOfflineOutbox(uid).map((m) => m.id));
  const current = baselineMemoryByUid.get(uid) || readBaselinesLocalStorage(uid);
  const next = { ...current };
  let changed = false;

  for (const r of rows) {
    const keyVal = String(r[keyCol] ?? '');
    if (!keyVal) continue;
    const id = `${table}:${keyVal}`;
    // CRITICAL: Never overwrite the server baseline while a local outbox edit is still pending!
    if (outboxIds.has(id)) continue;
    next[id] = r;
    changed = true;
  }

  if (!changed) return;
  baselineMemoryByUid.set(uid, next);
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(baselineKey(uid), JSON.stringify(next));
    }
  } catch {
    // Non-fatal; IndexedDB persists full baselines
  }
  void (async () => {
    try {
      const db = await openSnapshotDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(BASELINES_IDB_STORE, 'readwrite');
        tx.objectStore(BASELINES_IDB_STORE).put({ uid, map: next, updatedAtMs: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Non-fatal
    }
  })();
}

export function getServerBaselineRow(
  uid: string,
  table: string,
  keyVal: string
): Record<string, unknown> | null {
  if (!uid || !table || !keyVal) return null;
  const map = baselineMemoryByUid.get(uid) || readBaselinesLocalStorage(uid);
  return map[`${table}:${keyVal}`] || null;
}

// ============================================================================
// Recently Synced Receipts (Per-Item "Synced" Status Visibility)
// ============================================================================

export function getRecentlySyncedReceipts(uid: string): RecentlySyncedReceipt[] {
  if (typeof window === 'undefined' || !uid) return [];
  try {
    const raw = window.localStorage.getItem(receiptsKey(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RecentlySyncedReceipt[]) : [];
  } catch {
    return [];
  }
}

export function recordRecentlySyncedReceipt(
  uid: string,
  receipt: Omit<RecentlySyncedReceipt, 'uid' | 'syncedAtMs'>
): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    const list = getRecentlySyncedReceipts(uid).filter((r) => r.id !== receipt.id);
    list.unshift({
      ...receipt,
      uid,
      syncedAtMs: Date.now(),
    });
    window.localStorage.setItem(receiptsKey(uid), JSON.stringify(list.slice(0, 50)));
  } catch {
    // Non-fatal
  }
}

export function clearRecentlySyncedReceipts(uid: string): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.removeItem(receiptsKey(uid));
    emitState();
  } catch {
    // Non-fatal
  }
}

// ============================================================================
// Queue Mutations API
// ============================================================================

export function enqueueSupabaseUpsert(
  uid: string,
  params: {
    table: string;
    keyCol: string;
    keyVal: string;
    onConflict: string;
    row: Record<string, unknown>;
    forceLocalOnly?: boolean;
  }
): void {
  if (!uid || !params.keyVal) return;
  const id = `${params.table}:${params.keyVal}`;
  const currentList = getOfflineOutbox(uid);
  const existing = currentList.find((m) => m.id === id);
  const baseline = existing?.baseServerRow ?? getServerBaselineRow(uid, params.table, params.keyVal);
  const createdOffline =
    existing?.createdOffline ?? (!baseline && (params.forceLocalOnly || !isAppOnline()));
  const meta = describeSupabaseMutation(params.table, 'upsert', params.keyVal, params.row);
  const now = Date.now();

  const nextEntry: QueuedSupabaseMutation = {
    id,
    uid,
    table: params.table,
    op: 'upsert',
    keyCol: params.keyCol,
    keyVal: params.keyVal,
    onConflict: params.onConflict,
    row: params.row,
    baseServerRow: baseline ?? null,
    baseUpdatedAtMs: existing?.baseUpdatedAtMs ?? (baseline ? now : null),
    createdOffline,
    entityCategory: meta.entityCategory,
    entityTitle: meta.entityTitle,
    entitySummary: meta.entitySummary,
    status: params.forceLocalOnly || !isAppOnline() ? 'local_only' : 'pending',
    retryCount: existing?.retryCount ?? 0,
    lastError: null,
    conflictServerRow: null,
    conflictDetectedAtMs: null,
    queuedAtMs: existing?.queuedAtMs ?? now,
    updatedAtMs: now,
  };

  const next = currentList.filter((m) => m.id !== id);
  next.push(nextEntry);
  writeOfflineOutbox(uid, next);
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
  const currentList = getOfflineOutbox(uid);
  const existing = currentList.find((m) => m.id === id);

  // If the item was created offline and never synced to the server, deleting it offline
  // just cancels the un-uploaded creation cleanly!
  if (existing?.createdOffline) {
    writeOfflineOutbox(
      uid,
      currentList.filter((m) => m.id !== id)
    );
    return;
  }

  const baseline = existing?.baseServerRow ?? getServerBaselineRow(uid, params.table, params.keyVal);
  const meta = describeSupabaseMutation(
    params.table,
    'delete',
    params.keyVal,
    baseline || existing?.row || null
  );
  const now = Date.now();

  const nextEntry: QueuedSupabaseMutation = {
    id,
    uid,
    table: params.table,
    op: 'delete',
    keyCol: params.keyCol,
    keyVal: params.keyVal,
    baseServerRow: baseline ?? null,
    createdOffline: false,
    entityCategory: meta.entityCategory,
    entityTitle: meta.entityTitle,
    entitySummary: meta.entitySummary,
    status: !isAppOnline() ? 'local_only' : 'pending',
    retryCount: 0,
    lastError: null,
    queuedAtMs: existing?.queuedAtMs ?? now,
    updatedAtMs: now,
  };

  const next = currentList.filter((m) => m.id !== id);
  next.push(nextEntry);
  writeOfflineOutbox(uid, next);
}

export function updateOfflineMutationState(
  uid: string,
  id: string,
  patch: Partial<QueuedSupabaseMutation>
): void {
  if (!uid || !id) return;
  const current = getOfflineOutbox(uid);
  let changed = false;
  const next = current.map((m) => {
    if (m.id !== id) return m;
    changed = true;
    return {
      ...m,
      ...patch,
      updatedAtMs: Date.now(),
    };
  });
  if (changed) {
    writeOfflineOutbox(uid, next);
  }
}

export function removeOfflineMutation(uid: string, id: string): void {
  if (!uid) return;
  const current = getOfflineOutbox(uid);
  const next = current.filter((m) => m.id !== id);
  if (next.length !== current.length) {
    writeOfflineOutbox(uid, next);
  }
}

export function markOfflineMutationSynced(
  uid: string,
  mut: QueuedSupabaseMutation,
  syncedServerRow?: Record<string, unknown> | null
): void {
  if (!uid || !mut) return;
  removeOfflineMutation(uid, mut.id);
  if (mut.op === 'upsert' && (syncedServerRow || mut.row)) {
    recordServerBaselines(uid, mut.table, mut.keyCol, [
      syncedServerRow || (mut.row as Record<string, unknown>),
    ]);
  } else if (mut.op === 'delete') {
    const map = baselineMemoryByUid.get(uid) || readBaselinesLocalStorage(uid);
    if (map[mut.id]) {
      const copy = { ...map };
      delete copy[mut.id];
      baselineMemoryByUid.set(uid, copy);
    }
  }
  const meta =
    mut.entityCategory && mut.entityTitle
      ? { entityCategory: mut.entityCategory, entityTitle: mut.entityTitle }
      : describeSupabaseMutation(mut.table, mut.op, mut.keyVal, mut.row);
  recordRecentlySyncedReceipt(uid, {
    id: mut.id,
    table: mut.table,
    keyVal: mut.keyVal,
    op: mut.op,
    entityCategory: meta.entityCategory,
    entityTitle: meta.entityTitle,
  });
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
        updatedAtMs: Date.now(),
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

export function getEntitySyncStatus(
  uid: string | undefined | null,
  table: string,
  keyVal: string
): ItemSyncStatusInfo | null {
  if (!uid || !keyVal) return null;
  const id = `${table}:${keyVal}`;
  const outboxItem = getOfflineOutbox(uid).find((m) => m.id === id);
  if (outboxItem) {
    const rawStatus = outboxItem.status || 'pending';
    const effectiveStatus: OfflineSyncItemStatus =
      rawStatus === 'pending' && !isAppOnline() && outboxItem.createdOffline
        ? 'local_only'
        : rawStatus;
    return {
      status: effectiveStatus,
      lastError: outboxItem.lastError,
      queuedAtMs: outboxItem.queuedAtMs,
    };
  }
  const receipt = getRecentlySyncedReceipts(uid).find((r) => r.id === id);
  if (receipt) {
    return {
      status: 'synced',
      syncedAtMs: receipt.syncedAtMs,
    };
  }
  return null;
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
  pendingQuickDropCount: 0,
  pendingThemeCount: 0,
  failedCount: 0,
  conflictCount: 0,
  localOnlyCount: 0,
  totalPendingCount: 0,
  isSyncing: false,
  pendingReviewPrompt: false,
  lastSyncedAtMs: null,
  lastSyncMessage: null,
  lastSyncError: null,
};

const listeners = new Set<(state: OfflineSyncState) => void>();

function computeQueueStats(uid: string | null): {
  total: number;
  failed: number;
  conflict: number;
  localOnly: number;
} {
  if (!uid) return { total: 0, failed: 0, conflict: 0, localOnly: 0 };
  const list = getOfflineOutbox(uid);
  let failed = 0;
  let conflict = 0;
  let localOnly = 0;
  for (const m of list) {
    if (m.status === 'failed') failed += 1;
    else if (m.status === 'conflict') conflict += 1;
    else if (m.status === 'local_only' || (!isAppOnline() && m.createdOffline)) {
      localOnly += 1;
    }
  }
  return { total: list.length, failed, conflict, localOnly };
}

function emitState(): void {
  const stats = computeQueueStats(currentState.activeUid);
  const totalPendingCount =
    stats.total +
    currentState.pendingImagesCount +
    currentState.pendingAudioCount +
    currentState.pendingQuickDropCount +
    currentState.pendingThemeCount;
  currentState = {
    ...currentState,
    isOnline: isAppOnline(),
    pendingMutationsCount: stats.total,
    failedCount: stats.failed,
    conflictCount: stats.conflict,
    localOnlyCount: stats.localOnly,
    totalPendingCount,
    pendingReviewPrompt:
      currentState.pendingReviewPrompt && totalPendingCount > 0,
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
  currentState = {
    ...currentState,
    activeUid: uid,
  };
  emitState();
  if (uid && !hydratedUids.has(uid)) {
    void hydrateOfflineOutboxFromDb(uid);
  }
}

export function updateQueueStateCounts(uid?: string): void {
  const targetUid = uid || currentState.activeUid;
  const stats = computeQueueStats(targetUid);
  currentState = {
    ...currentState,
    pendingMutationsCount: stats.total,
    failedCount: stats.failed,
    conflictCount: stats.conflict,
    localOnlyCount: stats.localOnly,
  };
  emitState();
}

export function reportPendingMediaCounts(counts: {
  images?: number;
  audio?: number;
  quickDrop?: number;
  theme?: number;
}): void {
  currentState = {
    ...currentState,
    ...(typeof counts.images === 'number'
      ? { pendingImagesCount: Math.max(0, counts.images) }
      : {}),
    ...(typeof counts.audio === 'number'
      ? { pendingAudioCount: Math.max(0, counts.audio) }
      : {}),
    ...(typeof counts.quickDrop === 'number'
      ? { pendingQuickDropCount: Math.max(0, counts.quickDrop) }
      : {}),
    ...(typeof counts.theme === 'number'
      ? { pendingThemeCount: Math.max(0, counts.theme) }
      : {}),
  };
  emitState();
}

export function notifyOfflineMediaChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mizan-offline-media-changed'));
  }
}

// Reconnect handler ONLY updates connectivity & prompts the user to review & manually sync.
// NEVER auto-deletes, overwrites, or triggers destructive background syncs.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const stats = computeQueueStats(currentState.activeUid);
    const totalPending =
      stats.total +
      currentState.pendingImagesCount +
      currentState.pendingAudioCount +
      currentState.pendingQuickDropCount +
      currentState.pendingThemeCount;
    updateOfflineSyncState({
      isOnline: true,
      lastSyncError: null,
      pendingReviewPrompt: totalPending > 0,
      lastSyncMessage:
        totalPending > 0
          ? `عاد الاتصال بالإنترنت — لديك ${totalPending} تعديلات محفوظة محليًا بانتظار موافقتك للمزامنة.`
          : currentState.lastSyncMessage,
    });
  });
  window.addEventListener('offline', () => {
    updateOfflineSyncState({
      isOnline: false,
      pendingReviewPrompt: false,
    });
  });
}
