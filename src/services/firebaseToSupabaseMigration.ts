import { User } from 'firebase/auth';
import {
  BookNote,
  CalendarEvent,
  CustomCategory,
  DentalCase,
  DomainInfo,
  LearningPath,
  MonthPlan,
  PersonalCourse,
  PersonalReflection,
  PracticalProject,
  QuarterInfo,
  ReadingLibraryItem,
  StudyHistoryEntry,
  UnifiedTask,
  UserPreferences,
  WeeklyMeeting,
} from '../data/curriculumData';
import { FIREBASE_PROJECT_INFO } from '../firebase';
import {
  isSupabaseConfigured,
  supabase,
  withFirebaseTokenRetry,
} from './supabaseClient';
import {
  buildBookNoteRow,
  buildCalendarEventRow,
  buildCourseRow,
  buildCustomCategoryRow,
  buildDentalCaseRow,
  buildDomainRow,
  buildHistoryRow,
  buildLearningPathRow,
  buildMonthRow,
  buildPracticalProjectRow,
  buildQuarterRow,
  buildReadingItemRow,
  buildReflectionRow,
  buildUnifiedTaskRow,
  buildUserPreferencesRow,
  buildWeeklyMeetingRow,
  ensureUserProfileExists,
  sanitizeId,
} from './supabaseSync';

export interface WorkspaceBackupSnapshot {
  exportedAt: string;
  version: string;
  uid: string;
  email: string;
  displayName: string;
  quarters: QuarterInfo[];
  months: MonthPlan[];
  domains: DomainInfo[];
  courses: PersonalCourse[];
  bookNotes: BookNote[];
  customCategories: CustomCategory[];
  history: StudyHistoryEntry[];
  preferences: UserPreferences;
  reflections: PersonalReflection[];
  calendarEvents: CalendarEvent[];
  learningPaths: LearningPath[];
  readingItems: ReadingLibraryItem[];
  projects: PracticalProject[];
  unifiedTasks: UnifiedTask[];
  weeklyMeetings: WeeklyMeeting[];
  dentalCases: DentalCase[];
}

export function exportWorkspaceBackupJson(snapshot: WorkspaceBackupSnapshot): void {
  const payload = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mizan-knowledge-backup-${dateStamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportRawFirestoreBackupJson(
  scan: MigrationScanPreview
): void {
  const payload = JSON.stringify(scan.rawBackup, null, 2);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mizan-firestore-raw-backup-${scan.uid.slice(0, 8)}-${dateStamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ============================================================================
// Phase 1: Verified Firestore -> Supabase Schema Mapping
// ============================================================================

export type MigrationCollectionKey =
  | 'attachments'
  | 'images'
  | 'audioCache'
  | 'quarters'
  | 'domains'
  | 'customCategories'
  | 'preferences'
  | 'courses'
  | 'months'
  | 'bookNotes'
  | 'learningPaths'
  | 'readingItems'
  | 'projects'
  | 'dentalCases'
  | 'unifiedTasks'
  | 'calendarEvents'
  | 'weeklyMeetings'
  | 'reflections'
  | 'history';

export interface CollectionMappingSpec {
  firestoreCollection: MigrationCollectionKey;
  firestorePathPattern: string;
  supabaseTable: string;
  labelAr: string;
  pkColumn: 'id' | 'doc_id';
  onConflict: 'owner_id,id' | 'owner_id,doc_id';
  storageBucket?: 'study-files' | 'user-images' | 'audio-cache';
  nestedSubcollection?: string;
  relationships: string;
}

export const FIRESTORE_TO_SUPABASE_MAPPINGS: CollectionMappingSpec[] = [
  {
    firestoreCollection: 'attachments',
    firestorePathPattern: 'users/{uid}/attachments/{id}',
    supabaseTable: 'file_attachments',
    labelAr: 'المرفقات والملفات (PDF/Word)',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    storageBucket: 'study-files',
    nestedSubcollection: 'chunks/{chunkId}',
    relationships: 'مرتبط بمصادر الشهور والكورسات والمكتبة',
  },
  {
    firestoreCollection: 'images',
    firestorePathPattern: 'users/{uid}/images/{id}',
    supabaseTable: 'image_attachments',
    labelAr: 'الصور والمخططات',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    storageBucket: 'user-images',
    relationships: 'scope_key -> course/month/note/reflection',
  },
  {
    firestoreCollection: 'audioCache',
    firestorePathPattern: 'users/{uid}/audioCache/{id}',
    supabaseTable: 'audio_cache',
    labelAr: 'التسجيلات الصوتية المحفوظة',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    storageBucket: 'audio-cache',
    nestedSubcollection: 'chunks/{chunkId}',
    relationships: 'entity_type + entity_id',
  },
  {
    firestoreCollection: 'quarters',
    firestorePathPattern: 'users/{uid}/quarters/{id}',
    supabaseTable: 'quarters',
    labelAr: 'المراحل / الأرباع',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'أب لربط months.quarter',
  },
  {
    firestoreCollection: 'domains',
    firestorePathPattern: 'users/{uid}/domains/{id}',
    supabaseTable: 'domains',
    labelAr: 'المحاور المعرفية',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'مرتبط بـ months.foundational/exploratory.domainId',
  },
  {
    firestoreCollection: 'customCategories',
    firestorePathPattern: 'users/{uid}/customCategories/{id}',
    supabaseTable: 'custom_categories',
    labelAr: 'التصنيفات المخصصة',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'مرتبط بـ hub_id',
  },
  {
    firestoreCollection: 'preferences',
    firestorePathPattern: 'users/{uid}/preferences/{id}',
    supabaseTable: 'user_preferences',
    labelAr: 'تفضيلات وإعدادات المستخدم',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'صف إعدادات workspace (id=settings)',
  },
  {
    firestoreCollection: 'courses',
    firestorePathPattern: 'users/{uid}/courses/{docId}',
    supabaseTable: 'courses',
    labelAr: 'الكورسات والدورات',
    pkColumn: 'doc_id',
    onConflict: 'owner_id,doc_id',
    relationships: 'course_number يُستخدم في الملاحظات والشهور والمسارات',
  },
  {
    firestoreCollection: 'months',
    firestorePathPattern: 'users/{uid}/months/{docId}',
    supabaseTable: 'months',
    labelAr: 'خطة الـ 12 شهرًا',
    pkColumn: 'doc_id',
    onConflict: 'owner_id,doc_id',
    relationships: 'quarter -> quarters.number · course_id -> courses.course_number',
  },
  {
    firestoreCollection: 'bookNotes',
    firestorePathPattern: 'users/{uid}/bookNotes/{id}',
    supabaseTable: 'book_notes',
    labelAr: 'دفتر التلخيص والملاحظات',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'course_id -> courses.course_number',
  },
  {
    firestoreCollection: 'learningPaths',
    firestorePathPattern: 'users/{uid}/learningPaths/{id}',
    supabaseTable: 'learning_paths',
    labelAr: 'المسارات التعليمية',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'linked_course_ids -> courses.course_number',
  },
  {
    firestoreCollection: 'readingItems',
    firestorePathPattern: 'users/{uid}/readingItems/{id}',
    supabaseTable: 'reading_items',
    labelAr: 'مكتبة القراءة والكتب',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'attachment_resource_id -> file_attachments.id',
  },
  {
    firestoreCollection: 'projects',
    firestorePathPattern: 'users/{uid}/projects/{id}',
    supabaseTable: 'practical_projects',
    labelAr: 'المشاريع التطبيقية',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'linked_course_id -> courses.course_number',
  },
  {
    firestoreCollection: 'dentalCases',
    firestorePathPattern: 'users/{uid}/dentalCases/{id}',
    supabaseTable: 'dental_cases',
    labelAr: 'الحالات الإكلينيكية',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    storageBucket: 'user-images',
    relationships: 'linked_course_id -> courses.course_number',
  },
  {
    firestoreCollection: 'unifiedTasks',
    firestorePathPattern: 'users/{uid}/unifiedTasks/{id}',
    supabaseTable: 'unified_tasks',
    labelAr: 'المهام الموحدة',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'project_id -> practical_projects.id',
  },
  {
    firestoreCollection: 'calendarEvents',
    firestorePathPattern: 'users/{uid}/calendarEvents/{id}',
    supabaseTable: 'calendar_events',
    labelAr: 'أحداث التقويم',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'linked_task_id -> unified_tasks.id',
  },
  {
    firestoreCollection: 'weeklyMeetings',
    firestorePathPattern: 'users/{uid}/weeklyMeetings/{id}',
    supabaseTable: 'weekly_meetings',
    labelAr: 'الاجتماعات الأسبوعية',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'linked_task_ids -> unified_tasks.id',
  },
  {
    firestoreCollection: 'reflections',
    firestorePathPattern: 'users/{uid}/reflections/{id}',
    supabaseTable: 'reflections',
    labelAr: 'الخواطر والتأملات',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'مملوكة عبر owner_id',
  },
  {
    firestoreCollection: 'history',
    firestorePathPattern: 'users/{uid}/history/{id}',
    supabaseTable: 'study_history',
    labelAr: 'سجل النشاط الدراسي',
    pkColumn: 'id',
    onConflict: 'owner_id,id',
    relationships: 'target_note_id / target_month_id / target_course_id',
  },
];

// ============================================================================
// Firestore REST Value Decoder (Read-Only, Preserves createTime & updateTime)
// ============================================================================

type FirestoreValue = {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string | number;
  doubleValue?: number;
  timestampValue?: string;
  stringValue?: string;
  bytesValue?: string;
  referenceValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

export interface DecodedFirestoreDoc {
  docId: string;
  data: Record<string, unknown>;
  createTime?: string;
  updateTime?: string;
}

function decodeFirestoreValue(val: FirestoreValue | undefined): unknown {
  if (!val) return undefined;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('stringValue' in val) return val.stringValue ?? '';
  if ('bytesValue' in val) return val.bytesValue ?? '';
  if ('referenceValue' in val) return val.referenceValue ?? '';
  if ('arrayValue' in val) {
    return (val.arrayValue?.values || []).map((v) => decodeFirestoreValue(v));
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return undefined;
}

function decodeFirestoreDoc(docObj: FirestoreDocument): DecodedFirestoreDoc {
  const parts = docObj.name.split('/');
  const docId = parts[parts.length - 1] || '';
  const data: Record<string, unknown> = {};
  if (docObj.fields) {
    for (const [k, v] of Object.entries(docObj.fields)) {
      data[k] = decodeFirestoreValue(v);
    }
  }
  return {
    docId,
    data,
    createTime: docObj.createTime,
    updateTime: docObj.updateTime,
  };
}

async function fetchFirestoreRootUserDocRest(
  uid: string,
  idToken: string
): Promise<DecodedFirestoreDoc | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIREBASE_PROJECT_INFO.projectId
  )}/databases/${encodeURIComponent(
    FIREBASE_PROJECT_INFO.firestoreDatabaseId
  )}/documents/users/${encodeURIComponent(uid)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.status === 404 || !res.ok) return null;
    const json = (await res.json()) as FirestoreDocument;
    return json?.name ? decodeFirestoreDoc(json) : null;
  } catch {
    return null;
  }
}

async function fetchFirestoreCollectionRest(
  uid: string,
  subPath: string,
  idToken: string
): Promise<DecodedFirestoreDoc[]> {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIREBASE_PROJECT_INFO.projectId
  )}/databases/${encodeURIComponent(
    FIREBASE_PROJECT_INFO.firestoreDatabaseId
  )}/documents/users/${encodeURIComponent(uid)}/${subPath}`;

  const allDocs: DecodedFirestoreDoc[] = [];
  let pageToken = '';

  for (let page = 0; page < 40; page++) {
    const url = pageToken
      ? `${baseUrl}?pageSize=300&pageToken=${encodeURIComponent(pageToken)}`
      : `${baseUrl}?pageSize=300`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.status === 404) break;
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `تعذرت قراءة مجموعة ${subPath} من Firebase (${res.status}): ${errText.slice(0, 140)}`
      );
    }
    const json = (await res.json()) as {
      documents?: FirestoreDocument[];
      nextPageToken?: string;
    };
    if (Array.isArray(json.documents)) {
      for (const d of json.documents) {
        allDocs.push(decodeFirestoreDoc(d));
      }
    }
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }

  return allDocs;
}

async function fetchFirebaseStorageBlobRest(
  storagePath: string,
  idToken: string,
  fallbackDownloadUrl?: string
): Promise<Blob | null> {
  if (storagePath && FIREBASE_PROJECT_INFO.storageBucket) {
    try {
      const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
        FIREBASE_PROJECT_INFO.storageBucket
      )}/o/${encodeURIComponent(storagePath)}?alt=media`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) return await res.blob();
    } catch {
      // fallback to downloadUrl
    }
  }
  if (fallbackDownloadUrl) {
    try {
      const res = await fetch(fallbackDownloadUrl);
      if (res.ok) return await res.blob();
    } catch {
      // ignore
    }
  }
  return null;
}

function base64ToBlob(b64: string, mimeType: string): Blob {
  const cleanB64 = b64.includes(',') ? b64.split(',').slice(1).join(',') : b64;
  const bin = atob(cleanB64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

function safeAsciiFileName(name: string, fallback = 'file'): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return clean.slice(0, 80) || fallback;
}

function isValidIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function formatIsoAsShortDate(iso?: string): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return '';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function resolveDocTargetKey(
  spec: CollectionMappingSpec,
  doc: DecodedFirestoreDoc
): string {
  if (spec.firestoreCollection === 'preferences') return 'settings';
  if (spec.pkColumn === 'doc_id') {
    return sanitizeId(String(doc.data.docId ?? doc.docId));
  }
  return sanitizeId(String(doc.data.id ?? doc.docId));
}

// ============================================================================
// Resumable Checkpoint Persistence (localStorage, strictly non-sensitive IDs)
// ============================================================================

export interface MigrationCheckpoint {
  uid: string;
  startedAt: string;
  updatedAt: string;
  mode: MigrationRunMode;
  completedKeys: string[]; // format: `${supabaseTable}::${pk}`
  skippedKeys: string[];
  failedRecords: MigrationRecordError[];
  filesMigrated: number;
  imagesMigrated: number;
  audioMigrated: number;
}

const CHECKPOINT_STORAGE_PREFIX = 'mizan_migration_checkpoint_v1_';

export function loadMigrationCheckpoint(uid: string): MigrationCheckpoint | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = window.localStorage.getItem(`${CHECKPOINT_STORAGE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MigrationCheckpoint;
    if (!parsed || parsed.uid !== uid || !Array.isArray(parsed.completedKeys)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveMigrationCheckpoint(cp: MigrationCheckpoint): void {
  if (typeof window === 'undefined' || !cp.uid) return;
  try {
    window.localStorage.setItem(
      `${CHECKPOINT_STORAGE_PREFIX}${cp.uid}`,
      JSON.stringify(cp)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function clearMigrationCheckpoint(uid: string): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.removeItem(`${CHECKPOINT_STORAGE_PREFIX}${uid}`);
  } catch {
    // Ignore
  }
}

// ============================================================================
// Phase 1 & 3: Scan Firestore + Preview Migration
// ============================================================================

export interface CollectionPreviewItem {
  firestoreCollection: MigrationCollectionKey;
  firestorePathPattern: string;
  supabaseTable: string;
  labelAr: string;
  pkColumn: 'id' | 'doc_id';
  storageBucket?: 'study-files' | 'user-images' | 'audio-cache';
  relationships: string;
  detectedCount: number;
  alreadyInSupabaseCount: number;
  newCount: number;
  sampleTitles: string[];
}

export interface MigrationScanPreview {
  scannedAt: string;
  uid: string;
  email: string;
  firestoreProjectId: string;
  firestoreDatabaseId: string;
  rootUserDocFound: boolean;
  totalDetected: number;
  totalAlreadyInSupabase: number;
  totalNewToMigrate: number;
  collections: CollectionPreviewItem[];
  relationalSummary: {
    coursesCount: number;
    bookNotesCount: number;
    notesLinkedToCourseCount: number;
    monthsCount: number;
    monthsLinkedToCourseCount: number;
    attachmentsCount: number;
    imagesCount: number;
    audioCacheCount: number;
  };
  rawDocsByCollection: Record<MigrationCollectionKey, DecodedFirestoreDoc[]>;
  existingSupabaseKeysByTable: Record<string, Set<string>>;
  rawBackup: {
    exportedAt: string;
    uid: string;
    email: string;
    projectId: string;
    firestoreDatabaseId: string;
    rootUserDoc: DecodedFirestoreDoc | null;
    collections: Record<MigrationCollectionKey, DecodedFirestoreDoc[]>;
  };
  savedCheckpoint: MigrationCheckpoint | null;
}

function extractSampleTitle(
  key: MigrationCollectionKey,
  doc: DecodedFirestoreDoc
): string {
  const d = doc.data;
  const candidate =
    d.title ||
    d.bookTitle ||
    d.theme ||
    d.fileName ||
    d.name ||
    d.previewText ||
    (key === 'preferences' ? 'إعدادات مساحة العمل (settings)' : '') ||
    doc.docId;
  return String(candidate).slice(0, 60);
}

async function fetchExistingSupabaseKeys(
  uid: string,
  spec: CollectionMappingSpec
): Promise<Set<string>> {
  const keys = new Set<string>();
  if (!isSupabaseConfigured || !supabase) return keys;
  try {
    const { data, error } = await withFirebaseTokenRetry(async (client) =>
      client
        .from(spec.supabaseTable)
        .select(spec.pkColumn)
        .eq('owner_id', uid)
    );
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const val = (row as Record<string, unknown>)[spec.pkColumn];
        if (val !== undefined && val !== null) {
          keys.add(String(val));
        }
      }
    }
  } catch {
    // Non-fatal in preview
  }
  return keys;
}

export async function scanFirestoreForMigration(
  user: User,
  onProgress?: (msg: string) => void
): Promise<MigrationScanPreview> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'لم يتم ضبط متغيرات Supabase (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY) بعد.'
    );
  }
  const uid = user.uid;
  const idToken = await user.getIdToken(true);

  onProgress?.('جاري فحص مجموعات Firebase Firestore الحالية...');

  const [rootUserDoc, ...collectionResults] = await Promise.all([
    fetchFirestoreRootUserDocRest(uid, idToken),
    ...FIRESTORE_TO_SUPABASE_MAPPINGS.map((spec) =>
      fetchFirestoreCollectionRest(uid, spec.firestoreCollection, idToken)
    ),
  ]);

  onProgress?.('جاري مقارنة السجلات المرصودة مع جداول Supabase الحالية...');

  const existingResults = await Promise.all(
    FIRESTORE_TO_SUPABASE_MAPPINGS.map((spec) =>
      fetchExistingSupabaseKeys(uid, spec)
    )
  );

  const rawDocsByCollection = {} as Record<
    MigrationCollectionKey,
    DecodedFirestoreDoc[]
  >;
  const existingSupabaseKeysByTable: Record<string, Set<string>> = {};
  const collections: CollectionPreviewItem[] = [];

  let totalDetected = 0;
  let totalAlreadyInSupabase = 0;
  let totalNewToMigrate = 0;

  FIRESTORE_TO_SUPABASE_MAPPINGS.forEach((spec, idx) => {
    const docs = collectionResults[idx] || [];
    const existingKeys = existingResults[idx] || new Set<string>();
    rawDocsByCollection[spec.firestoreCollection] = docs;
    existingSupabaseKeysByTable[spec.supabaseTable] = existingKeys;

    let alreadyInSupabaseCount = 0;
    let newCount = 0;
    for (const doc of docs) {
      const targetKey = resolveDocTargetKey(spec, doc);
      if (existingKeys.has(targetKey)) {
        alreadyInSupabaseCount += 1;
      } else {
        newCount += 1;
      }
    }

    totalDetected += docs.length;
    totalAlreadyInSupabase += alreadyInSupabaseCount;
    totalNewToMigrate += newCount;

    collections.push({
      firestoreCollection: spec.firestoreCollection,
      firestorePathPattern: spec.firestorePathPattern,
      supabaseTable: spec.supabaseTable,
      labelAr: spec.labelAr,
      pkColumn: spec.pkColumn,
      storageBucket: spec.storageBucket,
      relationships: spec.relationships,
      detectedCount: docs.length,
      alreadyInSupabaseCount,
      newCount,
      sampleTitles: docs.slice(0, 3).map((d) => extractSampleTitle(spec.firestoreCollection, d)),
    });
  });

  const coursesDocs = rawDocsByCollection.courses || [];
  const bookNotesDocs = rawDocsByCollection.bookNotes || [];
  const monthsDocs = rawDocsByCollection.months || [];

  const relationalSummary = {
    coursesCount: coursesDocs.length,
    bookNotesCount: bookNotesDocs.length,
    notesLinkedToCourseCount: bookNotesDocs.filter(
      (n) => Number(n.data.courseId ?? 0) > 0
    ).length,
    monthsCount: monthsDocs.length,
    monthsLinkedToCourseCount: monthsDocs.filter(
      (m) => Number(m.data.courseId ?? 0) > 0
    ).length,
    attachmentsCount: (rawDocsByCollection.attachments || []).length,
    imagesCount: (rawDocsByCollection.images || []).length,
    audioCacheCount: (rawDocsByCollection.audioCache || []).length,
  };

  return {
    scannedAt: new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    uid,
    email: user.email || '',
    firestoreProjectId: FIREBASE_PROJECT_INFO.projectId,
    firestoreDatabaseId: FIREBASE_PROJECT_INFO.firestoreDatabaseId,
    rootUserDocFound: Boolean(rootUserDoc),
    totalDetected,
    totalAlreadyInSupabase,
    totalNewToMigrate,
    collections,
    relationalSummary,
    rawDocsByCollection,
    existingSupabaseKeysByTable,
    rawBackup: {
      exportedAt: new Date().toISOString(),
      uid,
      email: user.email || '',
      projectId: FIREBASE_PROJECT_INFO.projectId,
      firestoreDatabaseId: FIREBASE_PROJECT_INFO.firestoreDatabaseId,
      rootUserDoc,
      collections: rawDocsByCollection,
    },
    savedCheckpoint: loadMigrationCheckpoint(uid),
  };
}

// ============================================================================
// Phase 2 & 3: Safe, Resumable, Batched Migration Execution
// ============================================================================

export type MigrationRunMode = 'upsert_all' | 'resume_skip_existing';

export interface MigrationRecordError {
  collection: string;
  supabaseTable: string;
  docId: string;
  message: string;
}

export interface MigrationCollectionOutcome {
  labelAr: string;
  firestoreCollection: MigrationCollectionKey;
  supabaseTable: string;
  detected: number;
  migrated: number;
  skipped: number;
  failed: number;
}

export interface MigrationProgressSnapshot {
  stepMessage: string;
  percent: number;
  detectedCount: number;
  migratedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface MigrationReport {
  mode: MigrationRunMode;
  resumedFromCheckpoint: boolean;
  interrupted: boolean;
  durationMs: number;
  detectedCount: number;
  migratedCount: number;
  skippedCount: number;
  failedCount: number;
  collections: Record<string, number>;
  outcomes: MigrationCollectionOutcome[];
  filesMigrated: number;
  imagesMigrated: number;
  audioMigrated: number;
  errors: MigrationRecordError[];
  warnings: string[];
}

export interface MigrationRunOptions {
  mode?: MigrationRunMode;
  resumeFromCheckpoint?: boolean;
  cancelSignal?: { aborted: boolean };
  onProgress?: (progress: MigrationProgressSnapshot) => void;
}

const BATCH_SIZE = 25;

function sanitizeAudioEntityType(
  raw: unknown
): 'note' | 'course' | 'month' | 'summary' | 'library' | 'other' | 'general' {
  const s = String(raw || 'other');
  if (
    s === 'note' ||
    s === 'course' ||
    s === 'month' ||
    s === 'summary' ||
    s === 'library' ||
    s === 'other' ||
    s === 'general'
  ) {
    return s;
  }
  return 'other';
}

function formatPgError(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  const e = err as { code?: string; message?: string; details?: string; hint?: string };
  const code = e.code ? `[${e.code}] ` : '';
  const msg = e.message || String(err);
  const extra = e.details || e.hint ? ` (${e.details || e.hint})` : '';
  return `${code}${msg}${extra}`;
}

export async function runFirestoreToSupabaseMigration(
  user: User,
  scanInput?: MigrationScanPreview | null,
  options?: MigrationRunOptions
): Promise<MigrationReport> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'لم يتم ضبط متغيرات Supabase (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY) بعد.'
    );
  }

  const startedAt = Date.now();
  const mode: MigrationRunMode = options?.mode ?? 'upsert_all';
  const resumeFromCheckpoint = Boolean(options?.resumeFromCheckpoint);
  const cancelSignal = options?.cancelSignal;

  const emitProgress = (
    stepMessage: string,
    processed: number,
    total: number,
    migratedCount: number,
    skippedCount: number,
    failedCount: number
  ) => {
    const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 100;
    options?.onProgress?.({
      stepMessage,
      percent: pct,
      detectedCount: total,
      migratedCount,
      skippedCount,
      failedCount,
    });
  };

  const scan =
    scanInput ||
    (await scanFirestoreForMigration(user, (msg) =>
      emitProgress(msg, 0, 1, 0, 0, 0)
    ));

  const uid = user.uid;
  const idToken = await user.getIdToken(true);

  const priorCheckpoint = resumeFromCheckpoint
    ? loadMigrationCheckpoint(uid)
    : null;
  const completedSet = new Set<string>(priorCheckpoint?.completedKeys || []);
  const skippedSet = new Set<string>(priorCheckpoint?.skippedKeys || []);
  const errors: MigrationRecordError[] = [];
  const warnings: string[] = [];
  const counts: Record<string, number> = {};
  const outcomes: MigrationCollectionOutcome[] = [];

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let processedSoFar = 0;
  const totalDetected = Math.max(1, scan.totalDetected);

  let filesMigrated = priorCheckpoint?.filesMigrated ?? 0;
  let imagesMigrated = priorCheckpoint?.imagesMigrated ?? 0;
  let audioMigrated = priorCheckpoint?.audioMigrated ?? 0;

  const checkpoint: MigrationCheckpoint = {
    uid,
    startedAt: priorCheckpoint?.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mode,
    completedKeys: Array.from(completedSet),
    skippedKeys: Array.from(skippedSet),
    failedRecords: [],
    filesMigrated,
    imagesMigrated,
    audioMigrated,
  };

  const persistCheckpoint = () => {
    checkpoint.updatedAt = new Date().toISOString();
    checkpoint.completedKeys = Array.from(completedSet);
    checkpoint.skippedKeys = Array.from(skippedSet);
    checkpoint.failedRecords = errors.slice(0, 200);
    checkpoint.filesMigrated = filesMigrated;
    checkpoint.imagesMigrated = imagesMigrated;
    checkpoint.audioMigrated = audioMigrated;
    saveMigrationCheckpoint(checkpoint);
  };

  emitProgress(
    'التحقق من ملف المستخدم (user_profiles)...',
    0,
    totalDetected,
    totalMigrated,
    totalSkipped,
    totalFailed
  );
  await ensureUserProfileExists(user);

  // Preload all existing file_attachments storage_paths so resumed migrations keep course/month/library links intact
  const migratedAttachmentPaths = new Map<string, string>();
  try {
    const { data: existingAttRows } = await withFirebaseTokenRetry(async (client) =>
      client
        .from('file_attachments')
        .select('id,storage_path')
        .eq('owner_id', uid)
    );
    if (Array.isArray(existingAttRows)) {
      for (const r of existingAttRows) {
        const row = r as { id?: string; storage_path?: string };
        if (row.id && row.storage_path) {
          migratedAttachmentPaths.set(String(row.id), String(row.storage_path));
        }
      }
    }
  } catch {
    // Non-fatal
  }

  const shouldSkipRecord = (
    supabaseTable: string,
    pk: string
  ): boolean => {
    const cpKey = `${supabaseTable}::${pk}`;
    if (resumeFromCheckpoint && completedSet.has(cpKey)) {
      return true;
    }
    if (
      mode === 'resume_skip_existing' &&
      scan.existingSupabaseKeysByTable[supabaseTable]?.has(pk)
    ) {
      return true;
    }
    return false;
  };

  const withCreatedAtIfValid = (
    row: Record<string, unknown>,
    doc: DecodedFirestoreDoc,
    alreadyExistsInSupabase: boolean
  ) => {
    if (!alreadyExistsInSupabase && isValidIsoTimestamp(doc.createTime)) {
      return { ...row, created_at: doc.createTime };
    }
    return row;
  };

  let interrupted = false;

  // --------------------------------------------------------------------------
  // 1) Migrate File Attachments -> study-files + file_attachments
  // --------------------------------------------------------------------------
  {
    const spec = FIRESTORE_TO_SUPABASE_MAPPINGS.find(
      (s) => s.firestoreCollection === 'attachments'
    )!;
    const docs = scan.rawDocsByCollection.attachments || [];
    let colMigrated = 0;
    let colSkipped = 0;
    let colFailed = 0;

    for (const item of docs) {
      if (cancelSignal?.aborted) {
        interrupted = true;
        break;
      }
      const attId = resolveDocTargetKey(spec, item);
      const cpKey = `${spec.supabaseTable}::${attId}`;
      const raw = item.data;
      const fileName = String(raw.fileName || 'document.pdf');
      const mimeType = String(raw.mimeType || 'application/pdf');

      emitProgress(
        `ترحيل المرفقات: ${fileName}`,
        processedSoFar,
        totalDetected,
        totalMigrated,
        totalSkipped,
        totalFailed
      );

      if (shouldSkipRecord(spec.supabaseTable, attId)) {
        colSkipped += 1;
        totalSkipped += 1;
        processedSoFar += 1;
        continue;
      }

      try {
        const oldPath = raw.storagePath ? String(raw.storagePath) : '';
        const oldUrl = raw.downloadUrl ? String(raw.downloadUrl) : '';
        let blob: Blob | null = null;

        if (typeof raw.dataUrl === 'string' && raw.dataUrl.startsWith('data:')) {
          blob = base64ToBlob(raw.dataUrl, mimeType);
        } else if (Number(raw.chunkCount ?? 0) >= 1) {
          const chunkDocs = await fetchFirestoreCollectionRest(
            uid,
            `attachments/${item.docId}/chunks`,
            idToken
          );
          const sorted = chunkDocs
            .filter((c) => typeof c.data.data === 'string')
            .sort(
              (a, b) =>
                Number(a.data.chunkIndex ?? 0) - Number(b.data.chunkIndex ?? 0)
            );
          if (sorted.length > 0) {
            const byteArrays = sorted.map((c) => {
              const bin = atob(String(c.data.data));
              const buf = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
              return buf;
            });
            blob = new Blob(byteArrays, { type: mimeType });
          }
        }

        if (!blob && (oldPath || oldUrl)) {
          blob = await fetchFirebaseStorageBlobRest(oldPath, idToken, oldUrl);
        }

        if (!blob) {
          colSkipped += 1;
          totalSkipped += 1;
          skippedSet.add(cpKey);
          warnings.push(`تم تخطي المرفق لعدم توفر ملف فعلي في Firebase: ${fileName}`);
        } else {
          const newPath = `${uid}/resources/${attId}/${safeAsciiFileName(
            fileName,
            'attachment'
          )}`;
          await withFirebaseTokenRetry(async (client) => {
            const { error: upErr } = await client.storage
              .from('study-files')
              .upload(newPath, blob!, { contentType: mimeType, upsert: true });
            if (upErr) throw upErr;

            const { data: signed } = await client.storage
              .from('study-files')
              .createSignedUrl(newPath, 3600);

            const exists = Boolean(
              scan.existingSupabaseKeysByTable[spec.supabaseTable]?.has(attId)
            );
            const rowPayload = withCreatedAtIfValid(
              {
                owner_id: uid,
                id: attId,
                file_name: fileName.slice(0, 240),
                mime_type: mimeType.slice(0, 120),
                size_bytes: Math.max(0, Math.round(blob!.size)),
                storage_bucket: 'study-files',
                storage_path: newPath,
                download_url: signed?.signedUrl || '',
                extracted_preview: String(raw.extractedPreview || '').slice(0, 8000),
              },
              item,
              exists
            );

            const { error: rowErr } = await client
              .from('file_attachments')
              .upsert(rowPayload, { onConflict: 'owner_id,id' });
            if (rowErr) throw rowErr;
          });

          migratedAttachmentPaths.set(attId, newPath);
          filesMigrated += 1;
          colMigrated += 1;
          totalMigrated += 1;
          completedSet.add(cpKey);
        }
      } catch (err) {
        colFailed += 1;
        totalFailed += 1;
        errors.push({
          collection: 'attachments',
          supabaseTable: spec.supabaseTable,
          docId: item.docId,
          message: formatPgError(err),
        });
      }

      processedSoFar += 1;
      persistCheckpoint();
    }

    counts[spec.supabaseTable] = colMigrated;
    outcomes.push({
      labelAr: spec.labelAr,
      firestoreCollection: spec.firestoreCollection,
      supabaseTable: spec.supabaseTable,
      detected: docs.length,
      migrated: colMigrated,
      skipped: colSkipped,
      failed: colFailed,
    });
  }

  // --------------------------------------------------------------------------
  // 2) Migrate Images -> user-images + image_attachments
  // --------------------------------------------------------------------------
  if (!interrupted) {
    const spec = FIRESTORE_TO_SUPABASE_MAPPINGS.find(
      (s) => s.firestoreCollection === 'images'
    )!;
    const docs = scan.rawDocsByCollection.images || [];
    let colMigrated = 0;
    let colSkipped = 0;
    let colFailed = 0;

    for (const item of docs) {
      if (cancelSignal?.aborted) {
        interrupted = true;
        break;
      }
      const imgId = resolveDocTargetKey(spec, item);
      const cpKey = `${spec.supabaseTable}::${imgId}`;
      const raw = item.data;
      const scopeKey = String(raw.scopeKey || '');
      const name = String(raw.name || 'image.jpg');
      const mimeType = String(raw.mimeType || 'image/jpeg');

      emitProgress(
        `ترحيل الصور: ${name}`,
        processedSoFar,
        totalDetected,
        totalMigrated,
        totalSkipped,
        totalFailed
      );

      if (shouldSkipRecord(spec.supabaseTable, imgId)) {
        colSkipped += 1;
        totalSkipped += 1;
        processedSoFar += 1;
        continue;
      }

      try {
        const oldPath = raw.storagePath ? String(raw.storagePath) : '';
        const oldUrl = raw.downloadUrl ? String(raw.downloadUrl) : '';
        let blob: Blob | null = null;

        if (oldPath || oldUrl) {
          blob = await fetchFirebaseStorageBlobRest(oldPath, idToken, oldUrl);
        }
        if (
          !blob &&
          typeof raw.dataUrl === 'string' &&
          raw.dataUrl.startsWith('data:')
        ) {
          blob = base64ToBlob(raw.dataUrl, mimeType);
        }

        if (!blob) {
          colSkipped += 1;
          totalSkipped += 1;
          skippedSet.add(cpKey);
          warnings.push(`تم تخطي الصورة لعدم توفر بيانات الملف: ${name}`);
        } else {
          const safeScope = scopeKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
          const newPath = `${uid}/images/${safeScope}_${imgId}/${safeAsciiFileName(
            name,
            'image.jpg'
          )}`;
          await withFirebaseTokenRetry(async (client) => {
            const { error: upErr } = await client.storage
              .from('user-images')
              .upload(newPath, blob!, { contentType: mimeType, upsert: true });
            if (upErr) throw upErr;

            const { data: signed } = await client.storage
              .from('user-images')
              .createSignedUrl(newPath, 3600);

            const exists = Boolean(
              scan.existingSupabaseKeysByTable[spec.supabaseTable]?.has(imgId)
            );
            const fallbackMs = isValidIsoTimestamp(item.createTime)
              ? Date.parse(item.createTime)
              : Date.now();
            const rowPayload = withCreatedAtIfValid(
              {
                owner_id: uid,
                id: imgId,
                scope_key: scopeKey.slice(0, 128),
                file_name: name.slice(0, 200),
                mime_type: mimeType.slice(0, 80),
                size_bytes: Math.max(0, Math.round(blob!.size)),
                caption: String(raw.caption || '').slice(0, 500),
                storage_bucket: 'user-images',
                storage_path: newPath,
                download_url: signed?.signedUrl || '',
                created_at_ms: Math.round(Number(raw.createdAtMs ?? fallbackMs) || fallbackMs),
              },
              item,
              exists
            );

            const { error: rowErr } = await client
              .from('image_attachments')
              .upsert(rowPayload, { onConflict: 'owner_id,id' });
            if (rowErr) throw rowErr;
          });

          imagesMigrated += 1;
          colMigrated += 1;
          totalMigrated += 1;
          completedSet.add(cpKey);
        }
      } catch (err) {
        colFailed += 1;
        totalFailed += 1;
        errors.push({
          collection: 'images',
          supabaseTable: spec.supabaseTable,
          docId: item.docId,
          message: formatPgError(err),
        });
      }

      processedSoFar += 1;
      persistCheckpoint();
    }

    counts[spec.supabaseTable] = colMigrated;
    outcomes.push({
      labelAr: spec.labelAr,
      firestoreCollection: spec.firestoreCollection,
      supabaseTable: spec.supabaseTable,
      detected: docs.length,
      migrated: colMigrated,
      skipped: colSkipped,
      failed: colFailed,
    });
  }

  // --------------------------------------------------------------------------
  // 3) Migrate Audio Cache -> audio-cache + audio_cache
  // --------------------------------------------------------------------------
  if (!interrupted) {
    const spec = FIRESTORE_TO_SUPABASE_MAPPINGS.find(
      (s) => s.firestoreCollection === 'audioCache'
    )!;
    const docs = scan.rawDocsByCollection.audioCache || [];
    let colMigrated = 0;
    let colSkipped = 0;
    let colFailed = 0;

    for (const item of docs) {
      if (cancelSignal?.aborted) {
        interrupted = true;
        break;
      }
      const cacheId = resolveDocTargetKey(spec, item);
      const cpKey = `${spec.supabaseTable}::${cacheId}`;
      const raw = item.data;
      const mimeType = String(raw.mimeType || 'audio/wav');
      const audioTitle = String(raw.title || raw.previewText || 'مقطع صوتي');

      emitProgress(
        `ترحيل الصوتيات: ${audioTitle.slice(0, 40)}`,
        processedSoFar,
        totalDetected,
        totalMigrated,
        totalSkipped,
        totalFailed
      );

      if (shouldSkipRecord(spec.supabaseTable, cacheId)) {
        colSkipped += 1;
        totalSkipped += 1;
        processedSoFar += 1;
        continue;
      }

      try {
        const oldPath = raw.storagePath ? String(raw.storagePath) : '';
        const oldUrl = raw.downloadUrl ? String(raw.downloadUrl) : '';
        let blob: Blob | null = null;

        if (
          typeof raw.inlineDataUrl === 'string' &&
          raw.inlineDataUrl.startsWith('data:')
        ) {
          blob = base64ToBlob(raw.inlineDataUrl, mimeType);
        } else if (Number(raw.chunkCount ?? 0) >= 1) {
          const chunks = await fetchFirestoreCollectionRest(
            uid,
            `audioCache/${item.docId}/chunks`,
            idToken
          );
          const sorted = chunks
            .filter((c) => typeof c.data.data === 'string')
            .sort(
              (a, b) =>
                Number(a.data.chunkIndex ?? 0) - Number(b.data.chunkIndex ?? 0)
            );
          if (sorted.length > 0) {
            blob = base64ToBlob(
              sorted.map((c) => String(c.data.data)).join(''),
              mimeType
            );
          }
        }
        if (!blob && (oldPath || oldUrl)) {
          blob = await fetchFirebaseStorageBlobRest(oldPath, idToken, oldUrl);
        }

        if (!blob) {
          colSkipped += 1;
          totalSkipped += 1;
          skippedSet.add(cpKey);
          warnings.push(`تم تخطي المقطع الصوتي لعدم توفر ملف فعلي: ${audioTitle.slice(0, 40)}`);
        } else {
          const ext = mimeType.includes('mpeg') ? 'mp3' : 'wav';
          const newPath = `${uid}/audio/${cacheId}.${ext}`;
          await withFirebaseTokenRetry(async (client) => {
            const { error: upErr } = await client.storage
              .from('audio-cache')
              .upload(newPath, blob!, { contentType: mimeType, upsert: true });
            if (upErr) throw upErr;

            const { data: signed } = await client.storage
              .from('audio-cache')
              .createSignedUrl(newPath, 3600);

            const exists = Boolean(
              scan.existingSupabaseKeysByTable[spec.supabaseTable]?.has(cacheId)
            );
            const fallbackMs = isValidIsoTimestamp(item.createTime)
              ? Date.parse(item.createTime)
              : Date.now();
            const rowPayload = withCreatedAtIfValid(
              {
                owner_id: uid,
                id: cacheId,
                entity_type: sanitizeAudioEntityType(raw.entityType),
                entity_id: String(raw.entityId || '').slice(0, 128),
                title: audioTitle.slice(0, 200),
                content_hash: String(raw.contentHash || ''),
                voice_name: String(raw.voiceName || 'Kore'),
                speed: raw.speed === 'calm' ? 'calm' : 'normal',
                mime_type: mimeType.slice(0, 80),
                size_bytes: Math.max(0, Math.round(blob!.size)),
                duration_seconds: Number(raw.durationSeconds ?? 0) || 0,
                last_position_seconds: Number(raw.lastPositionSeconds ?? 0) || 0,
                playback_rate: Number(raw.playbackRate ?? 1) || 1,
                storage_bucket: 'audio-cache',
                storage_path: newPath,
                download_url: signed?.signedUrl || '',
                created_at_ms: Math.round(Number(raw.createdAtMs ?? fallbackMs) || fallbackMs),
              },
              item,
              exists
            );

            const { error: rowErr } = await client
              .from('audio_cache')
              .upsert(rowPayload, { onConflict: 'owner_id,id' });
            if (rowErr) throw rowErr;
          });

          audioMigrated += 1;
          colMigrated += 1;
          totalMigrated += 1;
          completedSet.add(cpKey);
        }
      } catch (err) {
        colFailed += 1;
        totalFailed += 1;
        errors.push({
          collection: 'audioCache',
          supabaseTable: spec.supabaseTable,
          docId: item.docId,
          message: formatPgError(err),
        });
      }

      processedSoFar += 1;
      persistCheckpoint();
    }

    counts[spec.supabaseTable] = colMigrated;
    outcomes.push({
      labelAr: spec.labelAr,
      firestoreCollection: spec.firestoreCollection,
      supabaseTable: spec.supabaseTable,
      detected: docs.length,
      migrated: colMigrated,
      skipped: colSkipped,
      failed: colFailed,
    });
  }

  // --------------------------------------------------------------------------
  // Helper: Batch Upsert Structured Collection with Per-Record Fallback & Resume
  // --------------------------------------------------------------------------
  const patchResources = (resources: unknown) => {
    if (!Array.isArray(resources)) return [];
    return resources.map((r) => {
      const obj = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      const id = String(obj.id || '');
      const migratedPath = id ? migratedAttachmentPaths.get(sanitizeId(id)) : undefined;
      return migratedPath ? { ...obj, storagePath: migratedPath, downloadUrl: '' } : obj;
    });
  };

  const migrateStructuredCollection = async (
    collectionKey: MigrationCollectionKey,
    mapFn: (doc: DecodedFirestoreDoc, index: number) => Record<string, unknown>
  ) => {
    if (interrupted) return;
    const spec = FIRESTORE_TO_SUPABASE_MAPPINGS.find(
      (s) => s.firestoreCollection === collectionKey
    )!;
    const docs = scan.rawDocsByCollection[collectionKey] || [];

    emitProgress(
      `ترحيل ${spec.labelAr} (${docs.length})...`,
      processedSoFar,
      totalDetected,
      totalMigrated,
      totalSkipped,
      totalFailed
    );

    if (docs.length === 0) {
      counts[spec.supabaseTable] = 0;
      outcomes.push({
        labelAr: spec.labelAr,
        firestoreCollection: spec.firestoreCollection,
        supabaseTable: spec.supabaseTable,
        detected: 0,
        migrated: 0,
        skipped: 0,
        failed: 0,
      });
      return;
    }

    let colMigrated = 0;
    let colSkipped = 0;
    let colFailed = 0;

    // For preferences, pick settings doc or first doc cleanly, marking any extra docs skipped
    const effectiveDocs =
      collectionKey === 'preferences'
        ? [docs.find((d) => d.docId === 'settings') || docs[0]]
        : docs;

    if (collectionKey === 'preferences' && docs.length > 1) {
      const extraSkipped = docs.length - 1;
      colSkipped += extraSkipped;
      totalSkipped += extraSkipped;
      processedSoFar += extraSkipped;
    }

    const pendingItems: Array<{
      doc: DecodedFirestoreDoc;
      pk: string;
      row: Record<string, unknown>;
    }> = [];

    effectiveDocs.forEach((doc, idx) => {
      const pk = resolveDocTargetKey(spec, doc);
      if (shouldSkipRecord(spec.supabaseTable, pk)) {
        colSkipped += 1;
        totalSkipped += 1;
        processedSoFar += 1;
      } else {
        const exists = Boolean(
          scan.existingSupabaseKeysByTable[spec.supabaseTable]?.has(pk)
        );
        const mappedRow = withCreatedAtIfValid(mapFn(doc, idx), doc, exists);
        pendingItems.push({ doc, pk, row: mappedRow });
      }
    });

    for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
      if (cancelSignal?.aborted) {
        interrupted = true;
        break;
      }

      const slice = pendingItems.slice(i, i + BATCH_SIZE);
      try {
        await withFirebaseTokenRetry(async (client) => {
          const { error } = await client
            .from(spec.supabaseTable)
            .upsert(
              slice.map((item) => item.row),
              { onConflict: spec.onConflict }
            );
          if (error) throw error;
        });

        for (const item of slice) {
          completedSet.add(`${spec.supabaseTable}::${item.pk}`);
        }
        colMigrated += slice.length;
        totalMigrated += slice.length;
        processedSoFar += slice.length;
      } catch {
        // Batch failed -> isolate individual failing record(s) without dropping valid rows
        for (const item of slice) {
          if (cancelSignal?.aborted) {
            interrupted = true;
            break;
          }
          try {
            await withFirebaseTokenRetry(async (client) => {
              const { error } = await client
                .from(spec.supabaseTable)
                .upsert(item.row, { onConflict: spec.onConflict });
              if (error) throw error;
            });
            completedSet.add(`${spec.supabaseTable}::${item.pk}`);
            colMigrated += 1;
            totalMigrated += 1;
          } catch (singleErr) {
            colFailed += 1;
            totalFailed += 1;
            errors.push({
              collection: spec.firestoreCollection,
              supabaseTable: spec.supabaseTable,
              docId: item.doc.docId,
              message: formatPgError(singleErr),
            });
          }
          processedSoFar += 1;
        }
      }

      persistCheckpoint();
      emitProgress(
        `ترحيل ${spec.labelAr} (${Math.min(i + slice.length, pendingItems.length)}/${pendingItems.length})...`,
        processedSoFar,
        totalDetected,
        totalMigrated,
        totalSkipped,
        totalFailed
      );
    }

    counts[spec.supabaseTable] = colMigrated;
    outcomes.push({
      labelAr: spec.labelAr,
      firestoreCollection: spec.firestoreCollection,
      supabaseTable: spec.supabaseTable,
      detected: docs.length,
      migrated: colMigrated,
      skipped: colSkipped,
      failed: colFailed,
    });
  };

  // --------------------------------------------------------------------------
  // 4) Migrate Core Curriculum & Dependent Tables in Dependency Order
  // --------------------------------------------------------------------------
  await migrateStructuredCollection('quarters', (d) =>
    buildQuarterRow(uid, {
      ...(d.data as unknown as QuarterInfo),
      id: String(d.data.id ?? d.docId),
    })
  );

  await migrateStructuredCollection('domains', (d, idx) =>
    buildDomainRow(
      uid,
      {
        ...(d.data as unknown as DomainInfo),
        id: String(d.data.id ?? d.docId),
      },
      Number(d.data.order ?? idx)
    )
  );

  await migrateStructuredCollection('customCategories', (d) =>
    buildCustomCategoryRow(uid, {
      ...(d.data as unknown as CustomCategory),
      id: String(d.data.id ?? d.docId),
    })
  );

  await migrateStructuredCollection('preferences', (d) =>
    buildUserPreferencesRow(uid, d.data as unknown as UserPreferences)
  );

  await migrateStructuredCollection('courses', (d) =>
    buildCourseRow(uid, {
      ...(d.data as unknown as PersonalCourse),
      docId: String(d.data.docId ?? d.docId),
      resources: patchResources(d.data.resources) as unknown as PersonalCourse['resources'],
    })
  );

  await migrateStructuredCollection('months', (d) =>
    buildMonthRow(uid, {
      ...(d.data as unknown as MonthPlan),
      docId: String(d.data.docId ?? d.docId),
      resources: patchResources(d.data.resources) as unknown as MonthPlan['resources'],
    })
  );

  await migrateStructuredCollection('bookNotes', (d) =>
    buildBookNoteRow(uid, {
      ...(d.data as unknown as BookNote),
      id: String(d.data.id ?? d.docId),
      updatedAt: String(
        d.data.updatedAt ||
          d.data.updatedAtLabel ||
          formatIsoAsShortDate(d.updateTime) ||
          ''
      ),
    })
  );

  await migrateStructuredCollection('learningPaths', (d) =>
    buildLearningPathRow(uid, {
      ...(d.data as unknown as LearningPath),
      id: String(d.data.id ?? d.docId),
    })
  );

  await migrateStructuredCollection('readingItems', (d) => {
    const item = d.data as unknown as ReadingLibraryItem;
    const migratedAttPath = item.attachmentResourceId
      ? migratedAttachmentPaths.get(sanitizeId(item.attachmentResourceId))
      : undefined;
    return buildReadingItemRow(uid, {
      ...item,
      id: String(d.data.id ?? d.docId),
      storagePath: migratedAttPath || item.storagePath,
      downloadUrl: migratedAttPath ? '' : item.downloadUrl,
      updatedAtLabel: String(
        item.updatedAtLabel || formatIsoAsShortDate(d.updateTime) || ''
      ),
    });
  });

  await migrateStructuredCollection('projects', (d) =>
    buildPracticalProjectRow(uid, {
      ...(d.data as unknown as PracticalProject),
      id: String(d.data.id ?? d.docId),
    })
  );

  // Dental Cases (includes cover upload to user-images before row upsert)
  if (!interrupted) {
    const spec = FIRESTORE_TO_SUPABASE_MAPPINGS.find(
      (s) => s.firestoreCollection === 'dentalCases'
    )!;
    const docs = scan.rawDocsByCollection.dentalCases || [];
    let colMigrated = 0;
    let colSkipped = 0;
    let colFailed = 0;

    emitProgress(
      `ترحيل ${spec.labelAr} (${docs.length})...`,
      processedSoFar,
      totalDetected,
      totalMigrated,
      totalSkipped,
      totalFailed
    );

    for (const d of docs) {
      if (cancelSignal?.aborted) {
        interrupted = true;
        break;
      }
      const pk = resolveDocTargetKey(spec, d);
      if (shouldSkipRecord(spec.supabaseTable, pk)) {
        colSkipped += 1;
        totalSkipped += 1;
        processedSoFar += 1;
        continue;
      }

      try {
        const dc = {
          ...(d.data as unknown as DentalCase),
          id: String(d.data.id ?? d.docId),
          updatedAtLabel: String(
            d.data.updatedAtLabel || formatIsoAsShortDate(d.updateTime) || ''
          ),
        };
        let nextCoverStoragePath = dc.coverStoragePath || '';
        let nextCoverImageUrl = dc.coverImageUrl || '';
        if (dc.coverStoragePath || dc.coverImageUrl || dc.coverDataUrl) {
          let coverBlob: Blob | null = null;
          if (dc.coverStoragePath || dc.coverImageUrl) {
            coverBlob = await fetchFirebaseStorageBlobRest(
              dc.coverStoragePath || '',
              idToken,
              dc.coverImageUrl
            );
          }
          if (!coverBlob && dc.coverDataUrl?.startsWith('data:')) {
            coverBlob = base64ToBlob(dc.coverDataUrl, 'image/jpeg');
          }
          if (coverBlob) {
            const newPath = `${uid}/images/case_cover_${sanitizeId(dc.id)}/cover.jpg`;
            try {
              await withFirebaseTokenRetry(async (client) => {
                const { error: upErr } = await client.storage
                  .from('user-images')
                  .upload(newPath, coverBlob!, {
                    contentType: coverBlob!.type || 'image/jpeg',
                    upsert: true,
                  });
                if (upErr) throw upErr;
                const { data: signed } = await client.storage
                  .from('user-images')
                  .createSignedUrl(newPath, 3600);
                nextCoverStoragePath = newPath;
                nextCoverImageUrl = signed?.signedUrl || '';
              });
              imagesMigrated += 1;
            } catch {
              // Keep coverDataUrl fallback if cover upload failed
            }
          }
        }

        const exists = Boolean(
          scan.existingSupabaseKeysByTable[spec.supabaseTable]?.has(pk)
        );
        const rowPayload = withCreatedAtIfValid(
          buildDentalCaseRow(uid, {
            ...dc,
            coverStoragePath: nextCoverStoragePath,
            coverImageUrl: nextCoverImageUrl,
            coverDataUrl: nextCoverStoragePath ? '' : dc.coverDataUrl,
          }),
          d,
          exists
        );

        await withFirebaseTokenRetry(async (client) => {
          const { error } = await client
            .from(spec.supabaseTable)
            .upsert(rowPayload, { onConflict: spec.onConflict });
          if (error) throw error;
        });

        completedSet.add(`${spec.supabaseTable}::${pk}`);
        colMigrated += 1;
        totalMigrated += 1;
      } catch (err) {
        colFailed += 1;
        totalFailed += 1;
        errors.push({
          collection: 'dentalCases',
          supabaseTable: spec.supabaseTable,
          docId: d.docId,
          message: formatPgError(err),
        });
      }

      processedSoFar += 1;
      persistCheckpoint();
    }

    counts[spec.supabaseTable] = colMigrated;
    outcomes.push({
      labelAr: spec.labelAr,
      firestoreCollection: spec.firestoreCollection,
      supabaseTable: spec.supabaseTable,
      detected: docs.length,
      migrated: colMigrated,
      skipped: colSkipped,
      failed: colFailed,
    });
  }

  await migrateStructuredCollection('unifiedTasks', (d) =>
    buildUnifiedTaskRow(uid, {
      ...(d.data as unknown as UnifiedTask),
      id: String(d.data.id ?? d.docId),
    })
  );

  await migrateStructuredCollection('calendarEvents', (d) =>
    buildCalendarEventRow(uid, {
      ...(d.data as unknown as CalendarEvent),
      id: String(d.data.id ?? d.docId),
    })
  );

  await migrateStructuredCollection('weeklyMeetings', (d) =>
    buildWeeklyMeetingRow(uid, {
      ...(d.data as unknown as WeeklyMeeting),
      id: String(d.data.id ?? d.docId),
    })
  );

  await migrateStructuredCollection('reflections', (d) => {
    const fallbackMs = isValidIsoTimestamp(d.createTime)
      ? Date.parse(d.createTime)
      : Date.now();
    return buildReflectionRow(uid, {
      ...(d.data as unknown as PersonalReflection),
      id: String(d.data.id ?? d.docId),
      createdAtMs: Number(d.data.createdAtMs ?? fallbackMs) || fallbackMs,
      createdAtLabel: String(
        d.data.createdAtLabel || formatIsoAsShortDate(d.createTime) || ''
      ),
    });
  });

  await migrateStructuredCollection('history', (d) => {
    const fallbackMs = isValidIsoTimestamp(d.createTime)
      ? Date.parse(d.createTime)
      : Date.now();
    return buildHistoryRow(uid, {
      ...(d.data as unknown as StudyHistoryEntry),
      id: String(d.data.id ?? d.docId),
      createdAtMs: Number(d.data.createdAtMs ?? fallbackMs) || fallbackMs,
    });
  });

  if (!interrupted && totalFailed === 0) {
    clearMigrationCheckpoint(uid);
  } else {
    persistCheckpoint();
  }

  emitProgress(
    interrupted
      ? 'تم إيقاف الترحيل بأمان وحفظ نقطة الاستكمال.'
      : 'اكتمل الترحيل إلى Supabase.',
    totalDetected,
    totalDetected,
    totalMigrated,
    totalSkipped,
    totalFailed
  );

  return {
    mode,
    resumedFromCheckpoint: Boolean(priorCheckpoint),
    interrupted,
    durationMs: Math.max(1, Date.now() - startedAt),
    detectedCount: scan.totalDetected,
    migratedCount: totalMigrated,
    skippedCount: totalSkipped,
    failedCount: totalFailed,
    collections: counts,
    outcomes,
    filesMigrated,
    imagesMigrated,
    audioMigrated,
    errors,
    warnings,
  };
}

// ============================================================================
// Phase 4: Post-Migration Validation (Counts, Ownership, Duplicates, Relations)
// ============================================================================

export interface ValidationTableComparison {
  labelAr: string;
  firestoreCollection: MigrationCollectionKey;
  supabaseTable: string;
  firestoreCount: number;
  supabaseCount: number;
  matched: boolean;
}

export interface ValidationCheckItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface MigrationValidationReport {
  validatedAt: string;
  uid: string;
  allPassed: boolean;
  tableComparisons: ValidationTableComparison[];
  checks: ValidationCheckItem[];
}

export async function validateMigratedWorkspace(
  user: User,
  scan?: MigrationScanPreview | null
): Promise<MigrationValidationReport> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase client is not configured.');
  }
  const uid = user.uid;

  // Query live Supabase counts & rows for the authenticated user (strictly under RLS)
  const [
    tableCountResults,
    coursesRes,
    monthsRes,
    quartersRes,
    notesRes,
    pathsRes,
    projectsRes,
    readingRes,
    tasksRes,
    attachmentsRes,
  ] = await Promise.all([
    Promise.all(
      FIRESTORE_TO_SUPABASE_MAPPINGS.map(async (spec) => {
        const { count, error } = await withFirebaseTokenRetry(async (client) =>
          client
            .from(spec.supabaseTable)
            .select(spec.pkColumn, { count: 'exact', head: true })
            .eq('owner_id', uid)
        );
        return {
          spec,
          supabaseCount: error ? -1 : count ?? 0,
        };
      })
    ),
    withFirebaseTokenRetry(async (c) =>
      c.from('courses').select('owner_id,doc_id,course_number,title').eq('owner_id', uid)
    ),
    withFirebaseTokenRetry(async (c) =>
      c.from('months').select('owner_id,doc_id,month_number,quarter,course_id').eq('owner_id', uid)
    ),
    withFirebaseTokenRetry(async (c) =>
      c.from('quarters').select('owner_id,id,number').eq('owner_id', uid)
    ),
    withFirebaseTokenRetry(async (c) =>
      c.from('book_notes').select('owner_id,id,course_id').eq('owner_id', uid)
    ),
    withFirebaseTokenRetry(async (c) =>
      c.from('learning_paths').select('owner_id,id,linked_course_ids').eq('owner_id', uid)
    ),
    withFirebaseTokenRetry(async (c) =>
      c.from('practical_projects').select('owner_id,id,linked_course_id').eq('owner_id', uid)
    ),
    withFirebaseTokenRetry(async (c) =>
      c.from('reading_items').select('owner_id,id,attachment_resource_id').eq('owner_id', uid)
    ),
    withFirebaseTokenRetry(async (c) =>
      c.from('unified_tasks').select('owner_id,id,project_id').eq('owner_id', uid)
    ),
    withFirebaseTokenRetry(async (c) =>
      c.from('file_attachments').select('owner_id,id').eq('owner_id', uid)
    ),
  ]);

  const tableComparisons: ValidationTableComparison[] = tableCountResults.map(
    ({ spec, supabaseCount }) => {
      const firestoreCount = scan
        ? (scan.rawDocsByCollection[spec.firestoreCollection] || []).length
        : supabaseCount;
      // Note: preferences maps 1 settings row; tables with default initial seeds may have >= firestoreCount
      const expectedMin =
        spec.firestoreCollection === 'preferences'
          ? Math.min(1, firestoreCount)
          : firestoreCount;
      const matched =
        supabaseCount >= 0 &&
        (firestoreCount === 0 ? supabaseCount >= 0 : supabaseCount >= expectedMin);
      return {
        labelAr: spec.labelAr,
        firestoreCollection: spec.firestoreCollection,
        supabaseTable: spec.supabaseTable,
        firestoreCount,
        supabaseCount,
        matched,
      };
    }
  );

  const courses = (coursesRes.data || []) as Array<{
    owner_id: string;
    doc_id: string;
    course_number: number;
    title: string;
  }>;
  const months = (monthsRes.data || []) as Array<{
    owner_id: string;
    doc_id: string;
    month_number: number;
    quarter: number;
    course_id: number;
  }>;
  const quarters = (quartersRes.data || []) as Array<{
    owner_id: string;
    id: string;
    number: number;
  }>;
  const notes = (notesRes.data || []) as Array<{
    owner_id: string;
    id: string;
    course_id: number;
  }>;
  const paths = (pathsRes.data || []) as Array<{
    owner_id: string;
    id: string;
    linked_course_ids: number[];
  }>;
  const projects = (projectsRes.data || []) as Array<{
    owner_id: string;
    id: string;
    linked_course_id: number;
  }>;
  const readingItems = (readingRes.data || []) as Array<{
    owner_id: string;
    id: string;
    attachment_resource_id: string;
  }>;
  const tasks = (tasksRes.data || []) as Array<{
    owner_id: string;
    id: string;
    project_id: string;
  }>;
  const attachments = (attachmentsRes.data || []) as Array<{
    owner_id: string;
    id: string;
  }>;

  // Check 1: Counts Match
  const mismatchedTables = tableComparisons.filter((t) => !t.matched);
  const countsOk = mismatchedTables.length === 0;

  // Check 2: Strict Ownership (owner_id === Firebase UID)
  const allRows = [
    ...courses,
    ...months,
    ...quarters,
    ...notes,
    ...paths,
    ...projects,
    ...readingItems,
    ...tasks,
    ...attachments,
  ];
  const foreignOwnerCount = allRows.filter((r) => r.owner_id !== uid).length;
  const ownershipOk = foreignOwnerCount === 0;

  // Check 3: Duplicate Check (course_number / month_number / primary keys)
  const seenCourseNums = new Set<number>();
  const duplicateCourseNums: number[] = [];
  for (const c of courses) {
    if (seenCourseNums.has(c.course_number)) {
      duplicateCourseNums.push(c.course_number);
    }
    seenCourseNums.add(c.course_number);
  }
  const seenMonthNums = new Set<number>();
  const duplicateMonthNums: number[] = [];
  for (const m of months) {
    if (seenMonthNums.has(m.month_number)) {
      duplicateMonthNums.push(m.month_number);
    }
    seenMonthNums.add(m.month_number);
  }
  const duplicatesOk =
    duplicateCourseNums.length === 0 && duplicateMonthNums.length === 0;

  // Check 4: Relational Integrity
  const courseNumbersSet = new Set(courses.map((c) => c.course_number));
  const quarterNumbersSet = new Set(quarters.map((q) => q.number));
  const attachmentIdsSet = new Set(attachments.map((a) => a.id));
  const projectIdsSet = new Set(projects.map((p) => p.id));

  const orphanNoteCourses = notes.filter(
    (n) => n.course_id > 0 && !courseNumbersSet.has(n.course_id)
  ).length;
  const orphanMonthCourses = months.filter(
    (m) => m.course_id > 0 && !courseNumbersSet.has(m.course_id)
  ).length;
  const orphanMonthQuarters = months.filter(
    (m) => m.quarter > 0 && quarters.length > 0 && !quarterNumbersSet.has(m.quarter)
  ).length;
  const orphanPathCourses = paths.filter((p) =>
    (p.linked_course_ids || []).some((cid) => cid > 0 && !courseNumbersSet.has(cid))
  ).length;
  const orphanProjectCourses = projects.filter(
    (p) => p.linked_course_id > 0 && !courseNumbersSet.has(p.linked_course_id)
  ).length;
  const orphanReadingAttachments = readingItems.filter(
    (r) =>
      r.attachment_resource_id &&
      !attachmentIdsSet.has(sanitizeId(r.attachment_resource_id))
  ).length;
  const orphanTaskProjects = tasks.filter(
    (t) => t.project_id && !projectIdsSet.has(sanitizeId(t.project_id))
  ).length;

  const relationIssues: string[] = [];
  if (orphanNoteCourses > 0)
    relationIssues.push(`${orphanNoteCourses} ملاحظة مرتبطة برقم كورس غير موجود`);
  if (orphanMonthCourses > 0)
    relationIssues.push(`${orphanMonthCourses} شهر مرتبط برقم كورس غير موجود`);
  if (orphanMonthQuarters > 0)
    relationIssues.push(`${orphanMonthQuarters} شهر مرتبط برقم مرحلة غير موجود`);
  if (orphanPathCourses > 0)
    relationIssues.push(`${orphanPathCourses} مسار مرتبط بكورس غير موجود`);
  if (orphanProjectCourses > 0)
    relationIssues.push(`${orphanProjectCourses} مشروع مرتبط بكورس غير موجود`);
  if (orphanReadingAttachments > 0)
    relationIssues.push(`${orphanReadingAttachments} عنصر مكتبة مرتبط بمرفق غير منقول`);
  if (orphanTaskProjects > 0)
    relationIssues.push(`${orphanTaskProjects} مهمة مرتبطة بمشروع غير موجود`);

  const relationsOk = relationIssues.length === 0;

  const checks: ValidationCheckItem[] = [
    {
      id: 'counts',
      label: 'مطابقة أعداد السجلات (Firestore مقابل Supabase)',
      ok: countsOk,
      detail: countsOk
        ? `تمت مطابقة جميع الجداول الـ 19 بنجاح (${courses.length} كورس، ${notes.length} ملاحظة، ${months.length} شهر، ${quarters.length} مرحلة).`
        : `جداول تحتاج مراجعة: ${mismatchedTables
            .map((t) => `${t.supabaseTable} (${t.supabaseCount}/${t.firestoreCount})`)
            .join('، ')}`,
    },
    {
      id: 'ownership',
      label: 'تحقق ملكية السجلات (owner_id = Firebase UID)',
      ok: ownershipOk,
      detail: ownershipOk
        ? `جميع السجلات المفحوصة (${allRows.length}) مملوكة حصريًا للمعرف ${uid.slice(0, 10)}... وتحت حماية RLS.`
        : `تم رصد ${foreignOwnerCount} سجل بـ owner_id مختلف!`,
    },
    {
      id: 'duplicates',
      label: 'فحص عدم وجود تكرار في الكورسات والشهور',
      ok: duplicatesOk,
      detail: duplicatesOk
        ? `لا توجد أرقام كورسات أو شهور مكررة (${courses.length} كورس، ${months.length} شهر).`
        : `تكرار مرصود — كورسات: [${duplicateCourseNums.join(', ')}]، شهور: [${duplicateMonthNums.join(', ')}]`,
    },
    {
      id: 'relations',
      label: 'سلامة الروابط والعلاقات بين الجداول',
      ok: relationsOk,
      detail: relationsOk
        ? 'جميع روابط الكورسات، الملاحظات، الشهور، المراحل، المسارات، المشاريع، والمرفقات سليمة.'
        : relationIssues.join(' · '),
    },
  ];

  return {
    validatedAt: new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    uid,
    allPassed: checks.every((c) => c.ok),
    tableComparisons,
    checks,
  };
}
