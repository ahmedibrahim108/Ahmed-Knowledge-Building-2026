import mammoth from 'mammoth';
import { BookNote } from '../data/curriculumData';
import { auth } from '../firebase';
import {
  formatSupabaseErrorMessage,
  getFirebaseIdToken,
  isSupabaseConfigured,
  supabase,
  supabaseAnonKey,
  supabaseUrl,
  withFirebaseTokenRetry,
} from '../services/supabaseClient';
import { ensureRichHtml, richHtmlToPlainText } from './richText';

export interface ParsedImportedDocument {
  title: string;
  html: string;
  plainText: string;
  fileName: string;
}

export type DocumentAttachmentKind = 'pdf' | 'docx' | 'doc' | 'text' | 'other';

export interface BundledAppDocument {
  id: string;
  title: string;
  subtitle: string;
  fileName: string;
  downloadUrl: string;
  mimeType: string;
}

export const BUNDLED_APP_DOCUMENTS: BundledAppDocument[] = [];

const STUDY_FILES_BUCKET = 'study-files';
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const TUS_RESUMABLE_THRESHOLD = 6 * 1024 * 1024; // 6 MB
const TUS_CHUNK_SIZE = 6 * 1024 * 1024; // 6 MB chunks (Supabase recommended)
const MAX_LOCAL_IDB_BYTES = 100 * 1024 * 1024; // Match 100 MB Supabase limit so fetched PDFs stay cached locally without re-downloading

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripExtension(name: string): string {
  return name.replace(/\.(docx|doc|txt|md|markdown|pdf|html|htm)$/i, '').trim();
}

export function isPdfAttachment(fileName?: string, mimeType?: string): boolean {
  if (mimeType && mimeType.toLowerCase().includes('pdf')) return true;
  if (!fileName) return false;
  return /\.pdf($|\?)/i.test(fileName.trim());
}

export function isWordAttachment(fileName?: string, mimeType?: string): boolean {
  const mime = (mimeType || '').toLowerCase();
  if (
    mime.includes('wordprocessingml') ||
    mime.includes('msword') ||
    mime.includes('vnd.ms-word')
  ) {
    return true;
  }
  if (!fileName) return false;
  return /\.(docx|doc)($|\?)/i.test(fileName.trim());
}

export function isTextAttachment(fileName?: string, mimeType?: string): boolean {
  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('text/plain') || mime.includes('markdown')) return true;
  if (!fileName) return false;
  return /\.(txt|md|markdown|html|htm)($|\?)/i.test(fileName.trim());
}

export function isViewableDocumentAttachment(
  fileName?: string,
  mimeType?: string
): boolean {
  return (
    isPdfAttachment(fileName, mimeType) ||
    isWordAttachment(fileName, mimeType) ||
    isTextAttachment(fileName, mimeType)
  );
}

export function getAttachmentKind(
  fileName?: string,
  mimeType?: string
): DocumentAttachmentKind {
  if (isPdfAttachment(fileName, mimeType)) return 'pdf';
  const cleanName = (fileName || '').split('?')[0].trim().toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  if (cleanName.endsWith('.docx') || mime.includes('wordprocessingml')) {
    return 'docx';
  }
  if (cleanName.endsWith('.doc') || mime.includes('msword')) {
    return 'doc';
  }
  if (isTextAttachment(fileName, mimeType)) return 'text';
  return 'other';
}

export function inferMimeTypeFromFileName(
  fileName?: string,
  provided?: string
): string {
  const clean = (fileName || '').split('?')[0].trim().toLowerCase();
  if (clean.endsWith('.pdf')) return 'application/pdf';
  if (clean.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (clean.endsWith('.doc')) return 'application/msword';
  if (clean.endsWith('.md') || clean.endsWith('.markdown')) {
    return 'text/markdown';
  }
  if (clean.endsWith('.txt')) return 'text/plain';
  if (clean.endsWith('.html') || clean.endsWith('.htm')) return 'text/html';
  if (provided && provided !== 'application/octet-stream') {
    const lower = provided.toLowerCase();
    if (lower === 'application/x-pdf') return 'application/pdf';
    return provided;
  }
  return 'application/octet-stream';
}

function parseLegacyDocOrTextRaw(raw: string, fileName: string): string {
  if (
    raw.includes('<html') ||
    raw.includes('<body') ||
    raw.includes('<p') ||
    raw.includes('<div') ||
    raw.includes('<table')
  ) {
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const htmlContent = bodyMatch ? bodyMatch[1] : raw;
    const html = ensureRichHtml(htmlContent);
    if (html) return html;
  }
  const cleaned = raw
    .replace(/[^\u0600-\u06FF\u0020-\u007E\n\r\t]/g, ' ')
    .replace(/ {3,}/g, ' ')
    .trim();
  return ensureRichHtml(cleaned || `تم إرفاق الملف: ${fileName}`);
}

export async function renderDocumentBlobToHtml(
  blob: Blob,
  fileName: string,
  mimeType?: string
): Promise<string> {
  const kind = getAttachmentKind(fileName, mimeType || blob.type);
  if (kind === 'docx') {
    const buffer = await blob.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const html = ensureRichHtml(result.value || '');
    return (
      html ||
      '<p>المستند فارغ أو لا يحتوي على نص قابل للعرض. يمكنك تنزيله مباشرة.</p>'
    );
  }
  if (kind === 'doc') {
    const raw = await blob.text();
    return parseLegacyDocOrTextRaw(raw, fileName);
  }
  if (kind === 'text') {
    const raw = await blob.text();
    const html = ensureRichHtml(raw);
    return html || '<p>الملف النصي فارغ.</p>';
  }
  return `<p><strong>مستند مرفق:</strong> ${escapeHtml(fileName)}</p>`;
}

export async function parseDocumentFile(
  file: File
): Promise<ParsedImportedDocument> {
  const lower = file.name.toLowerCase();
  const baseTitle = stripExtension(file.name) || 'مستند مستورد';

  if (lower.endsWith('.docx')) {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const html = ensureRichHtml(result.value || '');
    const plainText = richHtmlToPlainText(html);
    return {
      title: baseTitle,
      html: html || `<p>${escapeHtml(plainText)}</p>`,
      plainText,
      fileName: file.name,
    };
  }

  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.markdown')) {
    const raw = await file.text();
    const html = ensureRichHtml(raw);
    const plainText = richHtmlToPlainText(html);
    return {
      title: baseTitle,
      html,
      plainText,
      fileName: file.name,
    };
  }

  if (lower.endsWith('.doc') || lower.endsWith('.html') || lower.endsWith('.htm')) {
    const raw = await file.text();
    const html = parseLegacyDocOrTextRaw(raw, file.name);
    return {
      title: baseTitle,
      html,
      plainText: richHtmlToPlainText(html),
      fileName: file.name,
    };
  }

  return {
    title: baseTitle,
    html: `<p><strong>مستند مرفق:</strong> ${escapeHtml(file.name)} (${Math.max(1, Math.round(file.size / 1024))} كيلوبايت)</p>`,
    plainText: `مستند مرفق: ${file.name}`,
    fileName: file.name,
  };
}

// --- Lightweight IndexedDB local offline cache ---
const IDB_NAME = 'mizan_attachments_db';
const IDB_STORE = 'files';

function openAttachmentsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalAttachment(
  resourceId: string,
  file: Blob,
  fileName?: string
): Promise<void> {
  if (file.size > MAX_LOCAL_IDB_BYTES) {
    return;
  }
  try {
    const idb = await openAttachmentsDb();
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const resolvedName =
      file instanceof File ? file.name : fileName || 'document.pdf';
    const resolvedType = inferMimeTypeFromFileName(resolvedName, file.type);
    tx.objectStore(IDB_STORE).put(
      { blob: file, name: resolvedName, type: resolvedType },
      resourceId
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal if IndexedDB unavailable or mobile quota reached
  }
}

export function resolveAttachmentCacheKey(
  resourceId?: string,
  storagePath?: string,
  fileName?: string
): string | null {
  if (resourceId && resourceId.trim()) return resourceId.trim();
  if (storagePath && storagePath.trim()) return `path:${storagePath.trim()}`;
  if (fileName && fileName.trim()) return `file:${fileName.trim()}`;
  return null;
}

export async function getLocalAttachmentBlob(
  resourceId: string
): Promise<{ blob: Blob; name?: string; type?: string } | null> {
  try {
    const idb = await openAttachmentsDb();
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(resourceId);
    const record = await new Promise<
      { blob: Blob; name?: string; type?: string } | undefined
    >((resolve, reject) => {
      req.onsuccess = () =>
        resolve(
          req.result as { blob: Blob; name?: string; type?: string } | undefined
        );
      req.onerror = () => reject(req.error);
    });
    if (!record?.blob) return null;
    return record;
  } catch {
    return null;
  }
}

export async function findCachedAttachmentBlob(options: {
  resourceId?: string;
  storagePath?: string;
  fileName?: string;
}): Promise<{ blob: Blob; name?: string; type?: string; key: string } | null> {
  const candidates = [
    options.resourceId?.trim(),
    options.storagePath?.trim() ? `path:${options.storagePath.trim()}` : undefined,
    options.fileName?.trim() ? `file:${options.fileName.trim()}` : undefined,
  ].filter((k): k is string => Boolean(k));

  for (const key of candidates) {
    const hit = await getLocalAttachmentBlob(key);
    if (hit?.blob) {
      return { ...hit, key };
    }
  }
  return null;
}

export async function downloadLocalAttachment(
  resourceId: string,
  fallbackName: string
): Promise<boolean> {
  try {
    const record = await getLocalAttachmentBlob(resourceId);
    if (!record?.blob) return false;
    const url = URL.createObjectURL(record.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = record.name || fallbackName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

export interface UploadedAttachmentResult {
  storagePath?: string;
  downloadUrl?: string;
  mimeType: string;
  sizeBytes: number;
  uploadedToCloud: boolean;
  errorMessage?: string;
}

export function buildSafeStorageFileName(fileName: string): string {
  const clean = fileName
    .replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, '_')
    .replace(/^_+/, '')
    .slice(0, 120);
  // Supabase Storage keys work cleanest with ASCII-safe characters + preserved extension
  const extMatch = clean.match(/(\.[a-zA-Z0-9]{1,10})$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  const asciiStem = clean
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return `${asciiStem || 'attachment'}${ext}`;
}

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function uploadViaSupabaseTus(
  bucket: string,
  storagePath: string,
  file: Blob,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('إعدادات Supabase غير مكتملة.');
  }

  let token = await getFirebaseIdToken(false);
  if (!token) {
    token = await getFirebaseIdToken(true);
  }
  if (!token) {
    throw new Error('انتهت جلسة التحقق. أعد تسجيل الدخول ثم حاول مجددًا.');
  }

  const endpoint = `${supabaseUrl}/storage/v1/upload/resumable`;
  const metadata = [
    `bucketName ${toBase64Utf8(bucket)}`,
    `objectName ${toBase64Utf8(storagePath)}`,
    `contentType ${toBase64Utf8(contentType)}`,
    `cacheControl ${toBase64Utf8('3600')}`,
  ].join(',');

  const createUpload = async (authToken: string) =>
    fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        apikey: supabaseAnonKey,
        'x-upsert': 'true',
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(file.size),
        'Upload-Metadata': metadata,
      },
    });

  let createRes = await createUpload(token);
  if (createRes.status === 401 || createRes.status === 403) {
    const fresh = await getFirebaseIdToken(true);
    if (fresh) {
      token = fresh;
      createRes = await createUpload(token);
    }
  }

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    console.warn('TUS create upload error:', createRes.status, errText);
    const tusErr = new Error(
      createRes.status === 413
        ? 'حجم الملف يتجاوز الحد الأقصى المسموح به (100 ميجابايت).'
        : 'تعذّر بدء رفع الملف الكبير عبر الاتصال المتقطع.'
    ) as Error & { status?: number };
    tusErr.status = createRes.status;
    throw tusErr;
  }

  const locationHeader = createRes.headers.get('location');
  if (!locationHeader) {
    throw new Error('لم يُعد خادم التخزين رابط متابعة الرفع.');
  }
  const uploadUrl = new URL(locationHeader, supabaseUrl).toString();

  let offset = 0;
  onProgress?.(1);

  while (offset < file.size) {
    const end = Math.min(offset + TUS_CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, end);

    let chunkSuccess = false;
    let lastChunkErr: unknown = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        let patchRes = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': String(offset),
            'Content-Type': 'application/offset+octet-stream',
          },
          body: chunk,
        });

        if (patchRes.status === 401 || patchRes.status === 403) {
          const fresh = await getFirebaseIdToken(true);
          if (fresh) {
            token = fresh;
            patchRes = await fetch(uploadUrl, {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
                apikey: supabaseAnonKey,
                'Tus-Resumable': '1.0.0',
                'Upload-Offset': String(offset),
                'Content-Type': 'application/offset+octet-stream',
              },
              body: chunk,
            });
          }
        }

        if (!patchRes.ok) {
          const errText = await patchRes.text().catch(() => '');
          console.warn('TUS patch error:', patchRes.status, errText);
          const patchErr = new Error(
            patchRes.status === 413
              ? 'حجم الملف يتجاوز الحد الأقصى المسموح به (100 ميجابايت).'
              : 'انقطع رفع جزء من الملف.'
          ) as Error & { status?: number };
          patchErr.status = patchRes.status;
          throw patchErr;
        }

        const nextOffsetHeader = patchRes.headers.get('upload-offset');
        const parsedOffset = nextOffsetHeader ? Number(nextOffsetHeader) : NaN;
        offset = Number.isFinite(parsedOffset) ? parsedOffset : end;
        chunkSuccess = true;
        break;
      } catch (err) {
        lastChunkErr = err;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }

    if (!chunkSuccess) {
      throw lastChunkErr instanceof Error
        ? lastChunkErr
        : new Error('انقطع رفع الجزء أثناء نقل الملف.');
    }

    const pct = Math.min(98, Math.max(1, Math.round((offset / file.size) * 98)));
    onProgress?.(pct);
  }
}

export async function uploadResourceAttachment(
  uid: string | undefined,
  resourceId: string,
  file: File,
  extractedPreview?: string,
  onProgress?: (percent: number) => void
): Promise<UploadedAttachmentResult> {
  const mimeType = inferMimeTypeFromFileName(file.name, file.type);

  // Persist smaller files locally in IndexedDB for instant offline viewing on this device
  await saveLocalAttachment(resourceId, file, file.name);

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      mimeType,
      sizeBytes: file.size,
      uploadedToCloud: false,
      errorMessage: 'الحد الأقصى لحجم الملف في التخزين السحابي هو 100 ميجابايت.',
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      mimeType,
      sizeBytes: file.size,
      uploadedToCloud: false,
      errorMessage:
        'لا يوجد اتصال بالإنترنت حاليًا. تم حفظ نسخة محلية مؤقتة ويمكنك إعادة الرفع للسحابة عند عودة الاتصال.',
    };
  }

  const effectiveUid = uid || auth?.currentUser?.uid;
  if (!effectiveUid) {
    return {
      mimeType,
      sizeBytes: file.size,
      uploadedToCloud: false,
      errorMessage:
        'سجّل الدخول بحساب المسؤول أولاً ليتم رفع الملف إلى التخزين السحابي ومزامنته.',
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      mimeType,
      sizeBytes: file.size,
      uploadedToCloud: false,
      errorMessage:
        'تم حفظ الملف محليًا على هذا الجهاز. لم تُضبط إعدادات التخزين السحابي بعد.',
    };
  }

  const safeId = resourceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const safeFileName = buildSafeStorageFileName(file.name);
  const storagePath = `${effectiveUid}/resources/${safeId}/${safeFileName}`;

  try {
    let signedUrl = '';
    onProgress?.(2);

    const standardUpload = async () => {
      await withFirebaseTokenRetry(async (client) => {
        const { error: uploadErr } = await client.storage
          .from(STUDY_FILES_BUCKET)
          .upload(storagePath, file, {
            contentType: mimeType,
            upsert: true,
          });
        if (uploadErr) throw uploadErr;
      });
      onProgress?.(90);
    };

    if (file.size > TUS_RESUMABLE_THRESHOLD) {
      try {
        await uploadViaSupabaseTus(
          STUDY_FILES_BUCKET,
          storagePath,
          file,
          mimeType,
          onProgress
        );
      } catch (tusErr) {
        const status = (tusErr as { status?: number })?.status;
        if (status !== 413 && file.size <= 50 * 1024 * 1024) {
          console.warn('TUS upload failed, falling back to standard upload:', tusErr);
          await standardUpload();
        } else {
          throw tusErr;
        }
      }
    } else {
      await standardUpload();
    }

    await withFirebaseTokenRetry(async (client) => {
      try {
        const { data: signedData } = await client.storage
          .from(STUDY_FILES_BUCKET)
          .createSignedUrl(storagePath, 3600);
        if (signedData?.signedUrl) {
          signedUrl = signedData.signedUrl;
        }
      } catch {
        // Optional convenience URL; direct download() always works with Firebase JWT
      }

      const { error: metaErr } = await client.from('file_attachments').upsert(
        {
          owner_id: effectiveUid,
          id: safeId,
          file_name: file.name.slice(0, 240),
          mime_type: mimeType.slice(0, 120),
          size_bytes: Math.max(0, Math.round(file.size)),
          storage_bucket: STUDY_FILES_BUCKET,
          storage_path: storagePath,
          download_url: signedUrl,
          extracted_preview: (extractedPreview || '').slice(0, 8000),
        },
        { onConflict: 'owner_id,id' }
      );
      if (metaErr) throw metaErr;
    });

    onProgress?.(100);

    return {
      storagePath,
      downloadUrl: signedUrl || undefined,
      mimeType,
      sizeBytes: file.size,
      uploadedToCloud: true,
    };
  } catch (err) {
    console.warn('Supabase study file upload failed:', err);
    const rawMsg =
      err instanceof Error
        ? err.message
        : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: string }).message)
        : '';
    const lower = rawMsg.toLowerCase();
    if (
      lower.includes('maximum allowed size') ||
      lower.includes('payload too large') ||
      lower.includes('413') ||
      lower.includes('entity too large')
    ) {
      return {
        mimeType,
        sizeBytes: file.size,
        uploadedToCloud: false,
        errorMessage:
          'تجاوز الملف حد الحجم المفعّل حاليًا في لوحة Supabase Storage (الافتراضي 50 ميجابايت في الباقة المجانية، ويصل إلى 100 ميجابايت بعد رفعه من Storage Settings في باقة Pro).',
      };
    }
    return {
      mimeType,
      sizeBytes: file.size,
      uploadedToCloud: false,
      errorMessage: formatSupabaseErrorMessage(
        err,
        'تعذر رفع الملف إلى التخزين السحابي. تم الاحتفاظ به محليًا على هذا الجهاز.'
      ),
    };
  }
}

export async function getFreshStudyFileSignedUrl(options: {
  uid?: string;
  resourceId?: string;
  storagePath?: string;
  fileName?: string;
}): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const effectiveUid = options.uid || auth?.currentUser?.uid;
  let resolvedStoragePath = options.storagePath;
  let resolvedBucket = STUDY_FILES_BUCKET;

  if (
    effectiveUid &&
    (!resolvedStoragePath || resolvedStoragePath.startsWith('users/'))
  ) {
    if (options.resourceId) {
      const safeId = options.resourceId
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 128);
      try {
        const { data } = await withFirebaseTokenRetry(async (client) =>
          client
            .from('file_attachments')
            .select('storage_bucket,storage_path')
            .eq('owner_id', effectiveUid)
            .eq('id', safeId)
            .maybeSingle()
        );
        if (data) {
          const row = data as { storage_bucket?: string; storage_path?: string };
          if (row.storage_bucket) resolvedBucket = row.storage_bucket;
          if (row.storage_path) resolvedStoragePath = row.storage_path;
        }
      } catch {
        // Ignore lookup fallback
      }
    }

    if (
      (!resolvedStoragePath || resolvedStoragePath.startsWith('users/')) &&
      options.fileName
    ) {
      try {
        const { data: byName } = await withFirebaseTokenRetry(async (client) =>
          client
            .from('file_attachments')
            .select('storage_bucket,storage_path')
            .eq('owner_id', effectiveUid)
            .eq('file_name', options.fileName!)
            .order('updated_at', { ascending: false })
            .limit(1)
        );
        const first = (
          byName as Array<{ storage_bucket?: string; storage_path?: string }> | null
        )?.[0];
        if (first?.storage_path) {
          if (first.storage_bucket) resolvedBucket = first.storage_bucket;
          resolvedStoragePath = first.storage_path;
        }
      } catch {
        // Ignore filename fallback
      }
    }
  }

  if (!resolvedStoragePath || resolvedStoragePath.startsWith('users/')) {
    return null;
  }

  try {
    const { data } = await withFirebaseTokenRetry(async (client) =>
      client.storage
        .from(resolvedBucket)
        .createSignedUrl(resolvedStoragePath!, 3600)
    );
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

export interface PdfBlobResult {
  blob: Blob;
  source: 'cache' | 'cloud';
  storagePath?: string;
}

export async function getPdfBlobWithCacheInfo(options: {
  uid?: string;
  resourceId?: string;
  fileName?: string;
  mimeType?: string;
  storagePath?: string;
  downloadUrl?: string;
}): Promise<PdfBlobResult | null> {
  const inferredMime = inferMimeTypeFromFileName(
    options.fileName,
    options.mimeType
  );
  const cacheKey = resolveAttachmentCacheKey(
    options.resourceId,
    options.storagePath,
    options.fileName
  );

  // 1) Local IndexedDB cache (instant open offline/online with ZERO mobile data usage)
  const local = await findCachedAttachmentBlob({
    resourceId: options.resourceId,
    storagePath: options.storagePath,
    fileName: options.fileName,
  });
  if (local?.blob) {
    const normalizedBlob =
      inferredMime !== 'application/octet-stream' &&
      local.blob.type !== inferredMime
        ? new Blob([local.blob], { type: inferredMime })
        : local.blob;
    return {
      blob: normalizedBlob,
      source: 'cache',
      storagePath: options.storagePath,
    };
  }

  const effectiveUid = options.uid || auth?.currentUser?.uid;
  let resolvedStoragePath = options.storagePath;
  let resolvedBucket = STUDY_FILES_BUCKET;
  let resolvedFallbackUrl = options.downloadUrl;
  let resolvedMime = inferredMime;

  // 2) Lookup metadata row in Postgres `file_attachments` by resourceId or fileName fallback
  if (isSupabaseConfigured && supabase && effectiveUid) {
    if (
      options.resourceId &&
      (!resolvedStoragePath || resolvedStoragePath.startsWith('users/'))
    ) {
      const safeId = options.resourceId
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 128);
      try {
        const { data } = await withFirebaseTokenRetry(async (client) =>
          client
            .from('file_attachments')
            .select('storage_bucket,storage_path,download_url,mime_type,file_name')
            .eq('owner_id', effectiveUid)
            .eq('id', safeId)
            .maybeSingle()
        );
        if (data) {
          const row = data as {
            storage_bucket?: string;
            storage_path?: string;
            download_url?: string;
            mime_type?: string;
            file_name?: string;
          };
          if (row.storage_bucket) resolvedBucket = row.storage_bucket;
          if (row.storage_path) resolvedStoragePath = row.storage_path;
          if (row.download_url) resolvedFallbackUrl = row.download_url;
          resolvedMime = inferMimeTypeFromFileName(
            row.file_name || options.fileName,
            row.mime_type || inferredMime
          );
        }
      } catch (err) {
        console.warn('Supabase file_attachments lookup failed:', err);
      }
    }

    if (
      (!resolvedStoragePath || resolvedStoragePath.startsWith('users/')) &&
      options.fileName
    ) {
      try {
        const { data: rowsByName } = await withFirebaseTokenRetry(async (client) =>
          client
            .from('file_attachments')
            .select('storage_bucket,storage_path,download_url,mime_type,file_name')
            .eq('owner_id', effectiveUid)
            .eq('file_name', options.fileName!)
            .order('updated_at', { ascending: false })
            .limit(1)
        );
        const match = (
          rowsByName as Array<{
            storage_bucket?: string;
            storage_path?: string;
            download_url?: string;
            mime_type?: string;
            file_name?: string;
          }> | null
        )?.[0];
        if (match) {
          if (match.storage_bucket) resolvedBucket = match.storage_bucket;
          if (match.storage_path) resolvedStoragePath = match.storage_path;
          if (match.download_url) resolvedFallbackUrl = match.download_url;
          resolvedMime = inferMimeTypeFromFileName(
            match.file_name || options.fileName,
            match.mime_type || inferredMime
          );
        }
      } catch {
        // Ignore filename fallback error
      }
    }
  }

  // 3) Download directly from private Supabase Storage bucket using authenticated Firebase JWT,
  //    or mint a fresh signed URL if direct SDK download hits a mobile network edge case
  if (
    isSupabaseConfigured &&
    supabase &&
    resolvedStoragePath &&
    !resolvedStoragePath.startsWith('users/')
  ) {
    try {
      const rawBlob = await withFirebaseTokenRetry(async (client) => {
        const { data, error } = await client.storage
          .from(resolvedBucket)
          .download(resolvedStoragePath!);
        if (error || !data) throw error || new Error('Empty blob');
        return data;
      });
      const blob =
        resolvedMime !== 'application/octet-stream' &&
        rawBlob.type !== resolvedMime
          ? new Blob([rawBlob], { type: resolvedMime })
          : rawBlob;
      if (cacheKey && blob) {
        await saveLocalAttachment(cacheKey, blob, options.fileName);
      }
      return { blob, source: 'cloud', storagePath: resolvedStoragePath };
    } catch (err) {
      console.warn('Supabase Storage download failed, trying fresh signed URL:', err);
      try {
        const { data: signedData } = await withFirebaseTokenRetry(async (client) =>
          client.storage
            .from(resolvedBucket)
            .createSignedUrl(resolvedStoragePath!, 3600)
        );
        if (signedData?.signedUrl) {
          const signedRes = await fetch(signedData.signedUrl);
          if (signedRes.ok) {
            const rawBlob = await signedRes.blob();
            const blob =
              resolvedMime !== 'application/octet-stream' &&
              rawBlob.type !== resolvedMime
                ? new Blob([rawBlob], { type: resolvedMime })
                : rawBlob;
            if (cacheKey && blob) {
              await saveLocalAttachment(cacheKey, blob, options.fileName);
            }
            return { blob, source: 'cloud', storagePath: resolvedStoragePath };
          }
        }
      } catch (signedErr) {
        console.warn('Signed URL blob fetch fallback failed:', signedErr);
      }
    }
  }

  // 4) Direct HTTPS downloadUrl fallback (legacy or signed URL)
  if (resolvedFallbackUrl) {
    try {
      const res = await fetch(resolvedFallbackUrl);
      if (res.ok) {
        const rawBlob = await res.blob();
        const blob =
          resolvedMime !== 'application/octet-stream' &&
          rawBlob.type !== resolvedMime
            ? new Blob([rawBlob], { type: resolvedMime })
            : rawBlob;
        if (cacheKey && blob) {
          await saveLocalAttachment(cacheKey, blob, options.fileName);
        }
        return { blob, source: 'cloud', storagePath: resolvedStoragePath };
      }
    } catch (err) {
      console.warn('Fallback downloadUrl fetch failed:', err);
    }
  }

  return null;
}

export async function getPdfBlobForViewing(options: {
  uid?: string;
  resourceId?: string;
  fileName?: string;
  mimeType?: string;
  storagePath?: string;
  downloadUrl?: string;
}): Promise<Blob | null> {
  const res = await getPdfBlobWithCacheInfo(options);
  return res?.blob ?? null;
}

/**
 * Re-uploads any attachment currently residing ONLY in local IndexedDB on this device
 * (e.g. uploaded earlier while offline or before Supabase Storage migration) up to Supabase Cloud.
 */
export async function rescueLocalAttachmentToCloud(
  uid: string,
  resourceId: string,
  fallbackFileName?: string,
  extractedPreview?: string
): Promise<UploadedAttachmentResult | null> {
  const local = await getLocalAttachmentBlob(resourceId);
  if (!local?.blob) return null;
  const fileName =
    local.name || fallbackFileName || `${resourceId}.pdf`;
  const mime = inferMimeTypeFromFileName(fileName, local.type || local.blob.type);
  const file = new File([local.blob], fileName, { type: mime });
  return uploadResourceAttachment(uid, resourceId, file, extractedPreview);
}

export interface DownloadAttachmentResult {
  ok: boolean;
  openedExternal?: boolean;
  errorMessage?: string;
}

export async function downloadResourceAttachmentResult(options: {
  uid?: string;
  resourceId?: string;
  fileName: string;
  mimeType?: string;
  storagePath?: string;
  downloadUrl?: string;
}): Promise<DownloadAttachmentResult> {
  const triggerBlobDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = options.fileName || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const blob = await getPdfBlobForViewing({
    uid: options.uid,
    resourceId: options.resourceId,
    fileName: options.fileName,
    mimeType: options.mimeType,
    storagePath: options.storagePath,
    downloadUrl: options.downloadUrl,
  });

  if (blob) {
    triggerBlobDownload(blob);
    return { ok: true };
  }

  if (options.downloadUrl) {
    const a = document.createElement('a');
    a.href = options.downloadUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { ok: true, openedExternal: true };
  }

  return {
    ok: false,
    errorMessage:
      'لم يُعثر على محتوى هذا الملف في التخزين السحابي أو على هذا الجهاز. أعد رفع الملف ليظهر على جميع أجهزتك.',
  };
}

export async function downloadResourceAttachment(options: {
  uid?: string;
  resourceId?: string;
  fileName: string;
  mimeType?: string;
  storagePath?: string;
  downloadUrl?: string;
}): Promise<boolean> {
  const res = await downloadResourceAttachmentResult(options);
  return res.ok;
}

export async function deleteCloudAttachment(
  uid: string | undefined,
  resourceId?: string,
  storagePath?: string
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const effectiveUid = uid || auth?.currentUser?.uid;
  if (!effectiveUid) return;

  let pathToRemove = storagePath;
  const safeId = resourceId
    ? resourceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128)
    : undefined;

  if (safeId) {
    try {
      const { data } = await withFirebaseTokenRetry(async (client) =>
        client
          .from('file_attachments')
          .select('storage_path')
          .eq('owner_id', effectiveUid)
          .eq('id', safeId)
          .maybeSingle()
      );
      if (data && typeof (data as { storage_path?: string }).storage_path === 'string') {
        pathToRemove = pathToRemove || (data as { storage_path: string }).storage_path;
      }
      await withFirebaseTokenRetry(async (client) =>
        client
          .from('file_attachments')
          .delete()
          .eq('owner_id', effectiveUid)
          .eq('id', safeId)
      );
    } catch {
      // Non-fatal cleanup
    }
  }

  if (pathToRemove && !pathToRemove.startsWith('users/')) {
    try {
      await withFirebaseTokenRetry(async (client) =>
        client.storage.from(STUDY_FILES_BUCKET).remove([pathToRemove!])
      );
    } catch {
      // Non-fatal cleanup
    }
  }
}

// --- Export Notes to Word (.doc) ---
function buildWordHtmlWrapper(title: string, bodyHtml: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; color: #1e293b; line-height: 1.8; margin: 32px; }
  h1 { color: #1E3A5F; font-size: 22pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; }
  h2 { color: #1E3A5F; font-size: 15pt; margin-top: 20px; }
  h3 { color: #334155; font-size: 12pt; margin-top: 14px; }
  .meta { color: #64748b; font-size: 10pt; margin-bottom: 16px; }
  blockquote { border-right: 3px solid #1E3A5F; padding: 6px 12px; background: #f8fafc; margin: 10px 0; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 24px 0; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function triggerWordDownload(fileName: string, htmlDocument: string) {
  const blob = new Blob(['\ufeff', htmlDocument], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSingleBookNoteAsWord(note: BookNote): void {
  const meta = [
    note.author ? `المؤلف/المحاضر: ${escapeHtml(note.author)}` : '',
    note.courseTitle ? `الكورس: ${escapeHtml(note.courseTitle)}` : '',
    note.lectureTitle ? `المحاضرة: ${escapeHtml(note.lectureTitle)}` : '',
    note.progressMarker ? `الموضع: ${escapeHtml(note.progressMarker)}` : '',
    note.updatedAt ? `آخر تحديث: ${escapeHtml(note.updatedAt)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const contentHtml = ensureRichHtml(
    note.content || '<p>لا توجد ملاحظات مسجلة بعد.</p>'
  );
  const quotesHtml = note.quotes?.trim()
    ? `<h2>اقتباسات وأسئلة للنقاش</h2>${ensureRichHtml(note.quotes)}`
    : '';

  const body = `
    <h1>${escapeHtml(note.bookTitle)}</h1>
    <div class="meta">${meta}</div>
    <h2>الملاحظات والأفكار المستخلصة</h2>
    ${contentHtml}
    ${quotesHtml}
  `;

  const safeFile =
    note.bookTitle.replace(/[^\u0600-\u06FFa-zA-Z0-9_\-\s]/g, '').trim() ||
    'ملاحظات';
  triggerWordDownload(`${safeFile}.doc`, buildWordHtmlWrapper(note.bookTitle, body));
}

export function exportNotebookBundleAsWord(
  notebookTitle: string,
  notes: BookNote[]
): void {
  const sections = notes
    .map((bn, idx) => {
      const meta = [
        bn.lectureTitle ? `المحاضرة: ${escapeHtml(bn.lectureTitle)}` : '',
        bn.author ? `المؤلف/المحاضر: ${escapeHtml(bn.author)}` : '',
        bn.progressMarker ? `الموضع: ${escapeHtml(bn.progressMarker)}` : '',
        bn.updatedAt ? `التحديث: ${escapeHtml(bn.updatedAt)}` : '',
      ]
        .filter(Boolean)
        .join(' · ');

      return `
        <h2>${idx + 1}. ${escapeHtml(bn.bookTitle)}</h2>
        <div class="meta">${meta}</div>
        ${ensureRichHtml(bn.content || '<p>لا توجد ملاحظات مسجلة.</p>')}
        ${
          bn.quotes?.trim()
            ? `<h3>اقتباسات ونقاشات</h3>${ensureRichHtml(bn.quotes)}`
            : ''
        }
        <hr />
      `;
    })
    .join('\n');

  const body = `
    <h1>دفتر تلخيص: ${escapeHtml(notebookTitle)}</h1>
    <div class="meta">عدد الملاحظات المصدّرة: ${notes.length}</div>
    ${sections}
  `;

  const safeName =
    notebookTitle.replace(/[^\u0600-\u06FFa-zA-Z0-9_\-\s]/g, '').trim() ||
    'دفتر_التلخيص';
  triggerWordDownload(
    `دفتر_${safeName}.doc`,
    buildWordHtmlWrapper(notebookTitle, body)
  );
}
