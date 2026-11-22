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

// ============================================================================
// Firestore REST Value Decoder (Read-Only, Zero Firestore SDK Dependency)
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

function decodeFirestoreDoc(docObj: FirestoreDocument): {
  docId: string;
  data: Record<string, unknown>;
} {
  const parts = docObj.name.split('/');
  const docId = parts[parts.length - 1] || '';
  const data: Record<string, unknown> = {};
  if (docObj.fields) {
    for (const [k, v] of Object.entries(docObj.fields)) {
      data[k] = decodeFirestoreValue(v);
    }
  }
  return { docId, data };
}

async function fetchFirestoreCollectionRest(
  uid: string,
  subPath: string,
  idToken: string
): Promise<Array<{ docId: string; data: Record<string, unknown> }>> {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIREBASE_PROJECT_INFO.projectId
  )}/databases/${encodeURIComponent(
    FIREBASE_PROJECT_INFO.firestoreDatabaseId
  )}/documents/users/${encodeURIComponent(uid)}/${subPath}`;

  const allDocs: Array<{ docId: string; data: Record<string, unknown> }> = [];
  let pageToken = '';

  for (let page = 0; page < 25; page++) {
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
        `تعذرت قراءة مجموعة ${subPath} من Firebase (${res.status}): ${errText.slice(0, 120)}`
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

export interface MigrationReport {
  collections: Record<string, number>;
  filesMigrated: number;
  imagesMigrated: number;
  audioMigrated: number;
  warnings: string[];
}

/**
 * Safely migrates all existing Firebase Firestore collections & Firebase Storage files
 * for the signed-in user into Supabase PostgreSQL & Supabase Storage.
 * Strictly NON-DESTRUCTIVE: does not delete or alter any Firebase data.
 */
export async function migrateLegacyFirebaseToSupabase(
  user: User,
  onProgress?: (stepMessage: string) => void
): Promise<MigrationReport> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'لم يتم ضبط متغيرات Supabase (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY) بعد.'
    );
  }

  const uid = user.uid;
  const idToken = await user.getIdToken(true);
  const warnings: string[] = [];
  const counts: Record<string, number> = {};

  onProgress?.('تهيئة ملف المستخدم في Supabase...');
  await ensureUserProfileExists(user);

  // 1) Migrate File Attachments (PDFs / Word / Docs) -> study-files bucket + file_attachments
  onProgress?.('قراءة وترحيل المرفقات والملفات (PDF و Word)...');
  const migratedAttachmentPaths = new Map<string, string>();
  let filesMigrated = 0;
  try {
    const attDocs = await fetchFirestoreCollectionRest(uid, 'attachments', idToken);
    for (const item of attDocs) {
      const raw = item.data;
      const attId = sanitizeId(String(raw.id || item.docId));
      const fileName = String(raw.fileName || 'document.pdf');
      const mimeType = String(raw.mimeType || 'application/pdf');
      const oldPath = raw.storagePath ? String(raw.storagePath) : '';
      const oldUrl = raw.downloadUrl ? String(raw.downloadUrl) : '';
      let blob: Blob | null = null;

      if (typeof raw.dataUrl === 'string' && raw.dataUrl.startsWith('data:')) {
        blob = base64ToBlob(raw.dataUrl, mimeType);
      } else if (Number(raw.chunkCount ?? 0) >= 1) {
        const chunkDocs = await fetchFirestoreCollectionRest(
          uid,
          `attachments/${attId}/chunks`,
          idToken
        );
        const sorted = chunkDocs
          .filter((c) => typeof c.data.data === 'string')
          .sort(
            (a, b) => Number(a.data.chunkIndex ?? 0) - Number(b.data.chunkIndex ?? 0)
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

      if (blob) {
        const newPath = `${uid}/resources/${attId}/${safeAsciiFileName(fileName, 'attachment')}`;
        await withFirebaseTokenRetry(async (client) => {
          const { error: upErr } = await client.storage
            .from('study-files')
            .upload(newPath, blob!, { contentType: mimeType, upsert: true });
          if (upErr) throw upErr;

          const { data: signed } = await client.storage
            .from('study-files')
            .createSignedUrl(newPath, 3600);

          const { error: rowErr } = await client.from('file_attachments').upsert(
            {
              owner_id: uid,
              id: attId,
              file_name: fileName.slice(0, 240),
              mime_type: mimeType.slice(0, 120),
              size_bytes: Math.max(0, Math.round(blob!.size)),
              storage_bucket: 'study-files',
              storage_path: newPath,
              download_url: signed?.signedUrl || '',
            },
            { onConflict: 'owner_id,id' }
          );
          if (rowErr) throw rowErr;
        });
        migratedAttachmentPaths.set(attId, newPath);
        filesMigrated += 1;
      } else {
        warnings.push(`تعذر استخراج محتوى الملف: ${fileName}`);
      }
    }
  } catch (err) {
    warnings.push(
      `ملاحظة أثناء ترحيل المرفقات: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 2) Migrate Images -> user-images bucket + image_attachments
  onProgress?.('ترحيل الصور والمخططات...');
  let imagesMigrated = 0;
  try {
    const imgDocs = await fetchFirestoreCollectionRest(uid, 'images', idToken);
    for (const item of imgDocs) {
      const raw = item.data;
      const imgId = sanitizeId(String(raw.id || item.docId));
      const scopeKey = String(raw.scopeKey || '');
      const name = String(raw.name || 'image.jpg');
      const mimeType = String(raw.mimeType || 'image/jpeg');
      const oldPath = raw.storagePath ? String(raw.storagePath) : '';
      const oldUrl = raw.downloadUrl ? String(raw.downloadUrl) : '';
      let blob: Blob | null = null;

      if (oldPath || oldUrl) {
        blob = await fetchFirebaseStorageBlobRest(oldPath, idToken, oldUrl);
      }
      if (!blob && typeof raw.dataUrl === 'string' && raw.dataUrl.startsWith('data:')) {
        blob = base64ToBlob(raw.dataUrl, mimeType);
      }

      if (blob) {
        const safeScope = scopeKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
        const newPath = `${uid}/images/${safeScope}_${imgId}/${safeAsciiFileName(name, 'image.jpg')}`;
        await withFirebaseTokenRetry(async (client) => {
          const { error: upErr } = await client.storage
            .from('user-images')
            .upload(newPath, blob!, { contentType: mimeType, upsert: true });
          if (upErr) throw upErr;

          const { data: signed } = await client.storage
            .from('user-images')
            .createSignedUrl(newPath, 3600);

          const { error: rowErr } = await client.from('image_attachments').upsert(
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
              created_at_ms: Number(raw.createdAtMs ?? Date.now()),
            },
            { onConflict: 'owner_id,id' }
          );
          if (rowErr) throw rowErr;
        });
        imagesMigrated += 1;
      }
    }
  } catch (err) {
    warnings.push(
      `ملاحظة أثناء ترحيل الصور: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 3) Migrate Audio Cache -> audio-cache bucket + audio_cache
  onProgress?.('ترحيل التسجيلات الصوتية المحفوظة...');
  let audioMigrated = 0;
  try {
    const audioDocs = await fetchFirestoreCollectionRest(uid, 'audioCache', idToken);
    for (const item of audioDocs) {
      const raw = item.data;
      const cacheId = sanitizeId(String(raw.id || item.docId));
      const mimeType = String(raw.mimeType || 'audio/wav');
      const oldPath = raw.storagePath ? String(raw.storagePath) : '';
      const oldUrl = raw.downloadUrl ? String(raw.downloadUrl) : '';
      let blob: Blob | null = null;

      if (typeof raw.inlineDataUrl === 'string' && raw.inlineDataUrl.startsWith('data:')) {
        blob = base64ToBlob(raw.inlineDataUrl, mimeType);
      } else if (Number(raw.chunkCount ?? 0) >= 1) {
        const chunks = await fetchFirestoreCollectionRest(
          uid,
          `audioCache/${cacheId}/chunks`,
          idToken
        );
        const sorted = chunks
          .filter((c) => typeof c.data.data === 'string')
          .sort(
            (a, b) => Number(a.data.chunkIndex ?? 0) - Number(b.data.chunkIndex ?? 0)
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

      if (blob) {
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

          const { error: rowErr } = await client.from('audio_cache').upsert(
            {
              owner_id: uid,
              id: cacheId,
              entity_type: String(raw.entityType || 'other'),
              entity_id: String(raw.entityId || '').slice(0, 128),
              title: String(raw.title || raw.previewText || 'مقطع صوتي').slice(0, 200),
              content_hash: String(raw.contentHash || ''),
              voice_name: String(raw.voiceName || 'Kore'),
              speed: raw.speed === 'calm' ? 'calm' : 'normal',
              mime_type: mimeType.slice(0, 80),
              size_bytes: Math.max(0, Math.round(blob!.size)),
              duration_seconds: Number(raw.durationSeconds ?? 0),
              last_position_seconds: Number(raw.lastPositionSeconds ?? 0),
              playback_rate: Number(raw.playbackRate ?? 1),
              storage_bucket: 'audio-cache',
              storage_path: newPath,
              download_url: signed?.signedUrl || '',
              created_at_ms: Number(raw.createdAtMs ?? Date.now()),
            },
            { onConflict: 'owner_id,id' }
          );
          if (rowErr) throw rowErr;
        });
        audioMigrated += 1;
      }
    }
  } catch (err) {
    warnings.push(
      `ملاحظة أثناء ترحيل التسجيلات الصوتية: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 4) Migrate structured collections to PostgreSQL
  const patchResources = (resources: unknown) => {
    if (!Array.isArray(resources)) return [];
    return resources.map((r) => {
      const obj = r as Record<string, unknown>;
      const id = String(obj.id || '');
      const migratedPath = migratedAttachmentPaths.get(sanitizeId(id));
      return migratedPath ? { ...obj, storagePath: migratedPath, downloadUrl: '' } : obj;
    });
  };

  const upsertTable = async (
    table: string,
    rows: Record<string, unknown>[],
    onConflict: string
  ) => {
    if (rows.length === 0) {
      counts[table] = 0;
      return;
    }
    await withFirebaseTokenRetry(async (client) => {
      const { error } = await client.from(table).upsert(rows, { onConflict });
      if (error) throw error;
    });
    counts[table] = rows.length;
  };

  onProgress?.('ترحيل الخطة، المحاور، الكورسات، والملاحظات...');

  const [
    quartersDocs,
    domainsDocs,
    monthsDocs,
    coursesDocs,
    bookNotesDocs,
    catsDocs,
    histDocs,
    prefsDocs,
    reflDocs,
    calDocs,
    pathsDocs,
    readDocs,
    projDocs,
    tasksDocs,
    mtgDocs,
    casesDocs,
  ] = await Promise.all([
    fetchFirestoreCollectionRest(uid, 'quarters', idToken),
    fetchFirestoreCollectionRest(uid, 'domains', idToken),
    fetchFirestoreCollectionRest(uid, 'months', idToken),
    fetchFirestoreCollectionRest(uid, 'courses', idToken),
    fetchFirestoreCollectionRest(uid, 'bookNotes', idToken),
    fetchFirestoreCollectionRest(uid, 'customCategories', idToken),
    fetchFirestoreCollectionRest(uid, 'history', idToken),
    fetchFirestoreCollectionRest(uid, 'preferences', idToken),
    fetchFirestoreCollectionRest(uid, 'reflections', idToken),
    fetchFirestoreCollectionRest(uid, 'calendarEvents', idToken),
    fetchFirestoreCollectionRest(uid, 'learningPaths', idToken),
    fetchFirestoreCollectionRest(uid, 'readingItems', idToken),
    fetchFirestoreCollectionRest(uid, 'projects', idToken),
    fetchFirestoreCollectionRest(uid, 'unifiedTasks', idToken),
    fetchFirestoreCollectionRest(uid, 'weeklyMeetings', idToken),
    fetchFirestoreCollectionRest(uid, 'dentalCases', idToken),
  ]);

  await upsertTable(
    'quarters',
    quartersDocs.map((d) =>
      buildQuarterRow(uid, {
        ...(d.data as unknown as QuarterInfo),
        id: String(d.data.id ?? d.docId),
      })
    ),
    'owner_id,id'
  );

  await upsertTable(
    'domains',
    domainsDocs.map((d, idx) =>
      buildDomainRow(
        uid,
        {
          ...(d.data as unknown as DomainInfo),
          id: String(d.data.id ?? d.docId),
        },
        Number(d.data.order ?? idx)
      )
    ),
    'owner_id,id'
  );

  await upsertTable(
    'months',
    monthsDocs.map((d) =>
      buildMonthRow(uid, {
        ...(d.data as unknown as MonthPlan),
        docId: String(d.data.docId ?? d.docId),
        resources: patchResources(d.data.resources) as unknown as MonthPlan['resources'],
      })
    ),
    'owner_id,doc_id'
  );

  await upsertTable(
    'courses',
    coursesDocs.map((d) =>
      buildCourseRow(uid, {
        ...(d.data as unknown as PersonalCourse),
        docId: String(d.data.docId ?? d.docId),
        resources: patchResources(d.data.resources) as unknown as PersonalCourse['resources'],
      })
    ),
    'owner_id,doc_id'
  );

  await upsertTable(
    'book_notes',
    bookNotesDocs.map((d) =>
      buildBookNoteRow(uid, {
        ...(d.data as unknown as BookNote),
        id: String(d.data.id ?? d.docId),
      })
    ),
    'owner_id,id'
  );

  await upsertTable(
    'custom_categories',
    catsDocs.map((d) =>
      buildCustomCategoryRow(uid, {
        ...(d.data as unknown as CustomCategory),
        id: String(d.data.id ?? d.docId),
      })
    ),
    'owner_id,id'
  );

  await upsertTable(
    'study_history',
    histDocs.map((d) =>
      buildHistoryRow(uid, {
        ...(d.data as unknown as StudyHistoryEntry),
        id: String(d.data.id ?? d.docId),
      })
    ),
    'owner_id,id'
  );

  const settingsDoc = prefsDocs.find((p) => p.docId === 'settings') || prefsDocs[0];
  if (settingsDoc) {
    await upsertTable(
      'user_preferences',
      [buildUserPreferencesRow(uid, settingsDoc.data as unknown as UserPreferences)],
      'owner_id,id'
    );
  }

  onProgress?.('ترحيل الخواطر، التقويم، المسارات، المكتبة، والمهام...');

  await upsertTable(
    'reflections',
    reflDocs.map((d) =>
      buildReflectionRow(uid, {
        ...(d.data as unknown as PersonalReflection),
        id: String(d.data.id ?? d.docId),
      })
    ),
    'owner_id,id'
  );

  await upsertTable(
    'calendar_events',
    calDocs.map((d) =>
      buildCalendarEventRow(uid, {
        ...(d.data as unknown as CalendarEvent),
        id: String(d.data.id ?? d.docId),
      })
    ),
    'owner_id,id'
  );

  await upsertTable(
    'learning_paths',
    pathsDocs.map((d) =>
      buildLearningPathRow(uid, {
        ...(d.data as unknown as LearningPath),
        id: String(d.data.id ?? d.docId),
      })
    ),
    'owner_id,id'
  );

  await upsertTable(
    'reading_items',
    readDocs.map((d) => {
      const item = d.data as unknown as ReadingLibraryItem;
      const migratedAttPath = item.attachmentResourceId
        ? migratedAttachmentPaths.get(sanitizeId(item.attachmentResourceId))
        : undefined;
      return buildReadingItemRow(uid, {
        ...item,
        id: String(d.data.id ?? d.docId),
        storagePath: migratedAttPath || item.storagePath,
        downloadUrl: migratedAttPath ? '' : item.downloadUrl,
      });
    }),
    'owner_id,id'
  );

  await upsertTable(
    'practical_projects',
    projDocs.map((d) =>
      buildPracticalProjectRow(uid, {
        ...(d.data as unknown as PracticalProject),
        id: String(d.data.id ?? d.docId),
      })
    ),
    'owner_id,id'
  );

  await upsertTable(
    'unified_tasks',
    tasksDocs.map((d) =>
      buildUnifiedTaskRow(uid, {
        ...(d.data as unknown as UnifiedTask),
        id: String(d.data.id ?? d.docId),
      })
    ),
    'owner_id,id'
  );

  await upsertTable(
    'weekly_meetings',
    mtgDocs.map((d) =>
      buildWeeklyMeetingRow(uid, {
        ...(d.data as unknown as WeeklyMeeting),
        id: String(d.data.id ?? d.docId),
      })
    ),
    'owner_id,id'
  );

  // Migrate dentalCases + their cover photos to user-images bucket
  onProgress?.('ترحيل ملفات الحالات الإكلينيكية...');
  const dentalRows: Record<string, unknown>[] = [];
  for (const d of casesDocs) {
    const dc = {
      ...(d.data as unknown as DentalCase),
      id: String(d.data.id ?? d.docId),
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
    dentalRows.push(
      buildDentalCaseRow(uid, {
        ...dc,
        coverStoragePath: nextCoverStoragePath,
        coverImageUrl: nextCoverImageUrl,
        coverDataUrl: nextCoverStoragePath ? '' : dc.coverDataUrl,
      })
    );
  }
  await upsertTable('dental_cases', dentalRows, 'owner_id,id');

  return {
    collections: counts,
    filesMigrated,
    imagesMigrated,
    audioMigrated,
    warnings,
  };
}
