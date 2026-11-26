import { auth } from '../firebase';
import {
  formatSupabaseErrorMessage,
  getFirebaseIdToken,
  isSupabaseConfigured,
  supabase,
  supabaseAnonKey,
  supabaseUrl,
  withFirebaseTokenRetry,
} from './supabaseClient';

export type StorageProvider = 'r2' | 'supabase';

export type StorageModule =
  | 'library_book'
  | 'library_cover'
  | 'note_attachment'
  | 'journal_attachment'
  | 'recovery_resource'
  | 'course_attachment'
  | 'month_attachment'
  | 'reflection_image'
  | 'blog_cover'
  | 'dental_cover'
  | 'quick_drop';

export const R2_OBJECT_PREFIXES = [
  'library/books/',
  'library/covers/',
  'notes/attachments/',
  'journal/attachments/',
  'recovery/resources/',
  'courses/attachments/',
  'months/attachments/',
  'reflections/images/',
  'blogs/covers/',
  'dental/covers/',
  'quick_drop/attachments/',
] as const;

export function isR2ObjectKey(pathOrKey?: string | null): boolean {
  if (!pathOrKey || typeof pathOrKey !== 'string') return false;
  const trimmed = pathOrKey.trim();
  return R2_OBJECT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function resolveEffectiveStorageProvider(
  explicitProvider?: string | null,
  pathOrKey?: string | null
): StorageProvider {
  if (isR2ObjectKey(pathOrKey)) return 'r2';
  if (explicitProvider === 'r2') return 'r2';
  return 'supabase';
}

export function isSignedUrlExpiredOrExpiring(
  url?: string | null,
  bufferSeconds = 90
): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return false;

  try {
    const parsed = new URL(trimmed, 'https://example.invalid');
    const amzDate = parsed.searchParams.get('X-Amz-Date');
    const amzExpires = parsed.searchParams.get('X-Amz-Expires');
    if (amzDate && amzExpires) {
      const m = amzDate.match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/
      );
      const expSec = Number(amzExpires);
      if (m && Number.isFinite(expSec)) {
        const issuedMs = Date.UTC(
          Number(m[1]),
          Number(m[2]) - 1,
          Number(m[3]),
          Number(m[4]),
          Number(m[5]),
          Number(m[6])
        );
        return issuedMs + expSec * 1000 - bufferSeconds * 1000 <= Date.now();
      }
    }

    const token = parsed.searchParams.get('token');
    if (token && token.split('.').length === 3) {
      const payloadB64 = token
        .split('.')[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const padded = payloadB64.padEnd(
        payloadB64.length + ((4 - (payloadB64.length % 4)) % 4),
        '='
      );
      const data = JSON.parse(atob(padded)) as { exp?: unknown };
      if (typeof data.exp === 'number' && Number.isFinite(data.exp)) {
        return data.exp * 1000 - bufferSeconds * 1000 <= Date.now();
      }
    }
  } catch {
    // Non-standard URL; let caller attempt normal fetch/render
  }

  return false;
}

export function isR2PrimaryUploadEnabled(): boolean {
  const configured = (import.meta.env.VITE_STORAGE_PROVIDER || 'r2')
    .trim()
    .toLowerCase();
  return configured !== 'supabase';
}

export function inferStorageModuleFromResourceId(
  resourceId?: string
): StorageModule {
  const id = (resourceId || '').trim().toLowerCase();
  if (id.startsWith('lib-')) return 'library_book';
  if (id.startsWith('note-')) return 'note_attachment';
  if (id.startsWith('journal')) return 'journal_attachment';
  if (id.startsWith('recovery') || id.startsWith('rec-')) {
    return 'recovery_resource';
  }
  if (/^c\d+-res-/.test(id)) return 'course_attachment';
  if (/^m\d+-res-/.test(id)) return 'month_attachment';
  return 'library_book';
}

export function inferStorageModuleFromImageScope(scopeKey?: string): StorageModule {
  const scope = (scopeKey || '').trim().toLowerCase();
  if (scope.startsWith('journal')) return 'journal_attachment';
  if (scope.startsWith('book_cover') || scope.startsWith('library')) {
    return 'library_cover';
  }
  if (scope.startsWith('reflection')) return 'reflection_image';
  if (scope.startsWith('blog')) return 'blog_cover';
  if (scope.startsWith('case_cover') || scope.startsWith('dental')) {
    return 'dental_cover';
  }
  if (scope.startsWith('recovery')) return 'recovery_resource';
  if (scope.startsWith('course')) return 'course_attachment';
  if (scope.startsWith('month')) return 'month_attachment';
  if (scope.startsWith('note')) return 'note_attachment';
  return 'journal_attachment';
}

export class R2UnavailableError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'R2UnavailableError';
    this.code = code;
  }
}

export class StorageOperationError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'StorageOperationError';
    this.status = status;
    this.code = code;
  }
}

interface EdgeErrorPayload {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

function mapEdgeErrorToUserMessage(
  status: number,
  code: string,
  serverMessage: string
): string {
  if (status === 401) {
    return 'انتهت جلسة التحقق. أعد تسجيل الدخول بحساب Google ثم حاول مجددًا.';
  }
  if (status === 403) {
    return 'ليس لديك صلاحية تنفيذ هذه العملية على التخزين السحابي.';
  }
  if (status === 413 || code === 'FILE_TOO_LARGE' || code === 'OBJECT_SIZE_INVALID') {
    return 'حجم الملف يتجاوز الحد الأقصى المسموح به.';
  }
  if (status === 415 || code === 'UNSUPPORTED_MIME_TYPE' || code === 'UNSUPPORTED_FILE_TYPE') {
    return 'صيغة هذا الملف غير مدعومة أو محظورة لأسباب أمنية.';
  }
  if (status === 429 || code === 'RATE_LIMITED') {
    return 'تم إرسال طلبات كثيرة خلال وقت قصير. انتظر قليلاً ثم أعد المحاولة.';
  }
  return serverMessage || 'تعذر إتمام العملية مع خادم التخزين.';
}

async function callR2EdgeFunction<T>(
  functionName:
    | 'generate-upload-url'
    | 'confirm-upload'
    | 'generate-download-url'
    | 'delete-file',
  payload: Record<string, unknown>,
  options?: { requireAuth?: boolean; signal?: AbortSignal }
): Promise<T> {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    throw new R2UnavailableError(
      'SUPABASE_NOT_CONFIGURED',
      'إعدادات Supabase غير مكتملة.'
    );
  }

  let token = await getFirebaseIdToken(false);
  if (!token && options?.requireAuth) {
    token = await getFirebaseIdToken(true);
  }
  if (options?.requireAuth && !token) {
    throw new StorageOperationError(
      401,
      'AUTH_REQUIRED',
      'سجّل الدخول بحساب المسؤول أولاً لإتمام هذه العملية.'
    );
  }

  const endpoint = `${supabaseUrl}/functions/v1/${functionName}`;

  const doFetch = async (bearerToken: string | null) =>
    fetch(endpoint, {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

  let res: Response;
  try {
    res = await doFetch(token);
    if (res.status === 401 && auth?.currentUser) {
      const fresh = await getFirebaseIdToken(true);
      if (fresh) {
        res = await doFetch(fresh);
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new StorageOperationError(
      0,
      'NETWORK_ERROR',
      formatSupabaseErrorMessage(
        err,
        'تعذّر الاتصال بخادم التخزين السحابي. تحقق من اتصال الإنترنت.'
      )
    );
  }

  let parsed: (EdgeErrorPayload & T) | null = null;
  try {
    parsed = (await res.json()) as EdgeErrorPayload & T;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const code = parsed?.error?.code || `HTTP_${res.status}`;
    const rawMsg =
      parsed?.error?.message || parsed?.message || res.statusText || '';

    // Allow clean transition fallback ONLY when Edge Function is not deployed yet
    // or R2 secrets have not been configured in Supabase Edge Function Secrets.
    if (
      res.status === 404 ||
      (res.status === 503 && code === 'R2_NOT_CONFIGURED')
    ) {
      throw new R2UnavailableError(code, rawMsg);
    }

    throw new StorageOperationError(
      res.status,
      code,
      mapEdgeErrorToUserMessage(res.status, code, rawMsg)
    );
  }

  if (!parsed) {
    throw new StorageOperationError(
      500,
      'EMPTY_RESPONSE',
      'استجابة غير متوقعة من خادم التخزين.'
    );
  }

  return parsed;
}

function putBlobWithXhr(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onLoadedBytes: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<{ etag?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onLoadedBytes(ev.loaded, ev.total);
      }
    };

    xhr.onload = () => {
      signal?.removeEventListener('abort', onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag') || undefined;
        onLoadedBytes(body.size, body.size);
        resolve({ etag });
      } else {
        const err = new StorageOperationError(
          xhr.status,
          `R2_PUT_${xhr.status}`,
          xhr.status === 403
            ? 'انتهت صلاحية رابط الرفع المؤقت. أعد المحاولة.'
            : 'تعذّر رفع البيانات إلى Cloudflare R2.'
        );
        reject(err);
      }
    };

    xhr.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(
        new StorageOperationError(
          0,
          'R2_PUT_NETWORK_ERROR',
          'انقطع الاتصال أثناء رفع الملف إلى Cloudflare R2 (تحقق من إعدادات CORS للحاوية إذا تكرر الخطأ).'
        )
      );
    };

    xhr.onabort = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    xhr.send(body);
  });
}

async function retryOperation<T>(
  fn: () => Promise<T>,
  attempts = 3,
  signal?: AbortSignal
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      if (
        err instanceof StorageOperationError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408 &&
        err.status !== 429
      ) {
        throw err;
      }
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 600 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

interface GenerateUploadSingleResponse {
  ok: true;
  mode: 'single';
  storageProvider: 'r2';
  bucketName: string;
  objectKey: string;
  recordId: string;
  recordType: 'file' | 'image' | 'none';
  module: StorageModule;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadUrl: string;
  requiredHeaders?: Record<string, string>;
}

interface GenerateUploadMultipartResponse {
  ok: true;
  mode: 'multipart';
  storageProvider: 'r2';
  bucketName: string;
  objectKey: string;
  recordId: string;
  recordType: 'file' | 'image' | 'none';
  module: StorageModule;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadId: string;
  chunkSize: number;
  parts: Array<{ partNumber: number; url: string }>;
}

interface ConfirmUploadResponse {
  ok: true;
  storageProvider: 'r2';
  recordId: string;
  recordType: 'file' | 'image' | 'none';
  objectKey: string;
  bucketName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  etag?: string;
  downloadUrl: string;
  expiresIn: number;
}

export interface UploadFileOptions {
  file: Blob;
  fileName: string;
  mimeType: string;
  module: StorageModule;
  recordId?: string;
  recordType?: 'file' | 'image' | 'none';
  extractedPreview?: string;
  scopeKey?: string;
  caption?: string;
  width?: number;
  height?: number;
  categoryLabel?: string;
  sortOrder?: number;
  frameConfig?: unknown;
  createdAtMs?: number;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface UploadFileResult {
  storageProvider: StorageProvider;
  objectKey: string;
  bucketName: string;
  recordId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
  etag?: string;
}

export async function uploadFileToR2(
  options: UploadFileOptions
): Promise<UploadFileResult> {
  const {
    file,
    fileName,
    mimeType,
    module,
    recordId,
    recordType = 'file',
    extractedPreview,
    scopeKey,
    caption,
    width,
    height,
    categoryLabel,
    sortOrder,
    frameConfig,
    createdAtMs,
    onProgress,
    signal,
  } = options;

  onProgress?.(2);

  const initRes = await callR2EdgeFunction<
    GenerateUploadSingleResponse | GenerateUploadMultipartResponse
  >(
    'generate-upload-url',
    {
      action: 'init',
      module,
      fileName,
      mimeType,
      fileSize: file.size,
      recordId,
      recordType,
      ...(extractedPreview !== undefined ? { extractedPreview } : {}),
      ...(scopeKey !== undefined ? { scopeKey } : {}),
      ...(caption !== undefined ? { caption } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(categoryLabel !== undefined ? { categoryLabel } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(frameConfig !== undefined ? { frameConfig } : {}),
      ...(createdAtMs !== undefined ? { createdAtMs } : {}),
    },
    { requireAuth: true, signal }
  );

  onProgress?.(5);

  if (initRes.mode === 'single') {
    await retryOperation(
      () =>
        putBlobWithXhr(
          initRes.uploadUrl,
          file,
          initRes.requiredHeaders || { 'Content-Type': initRes.mimeType },
          (loaded, total) => {
            const pct = 5 + Math.round((loaded / Math.max(1, total)) * 88);
            onProgress?.(Math.min(93, Math.max(5, pct)));
          },
          signal
        ),
      3,
      signal
    );

    const confirmed = await callR2EdgeFunction<ConfirmUploadResponse>(
      'confirm-upload',
      {
        objectKey: initRes.objectKey,
        module,
        fileName: initRes.originalName,
        mimeType: initRes.mimeType,
        recordId: initRes.recordId,
        recordType: initRes.recordType,
      },
      { requireAuth: true, signal }
    );

    onProgress?.(100);
    return {
      storageProvider: 'r2',
      objectKey: confirmed.objectKey,
      bucketName: confirmed.bucketName,
      recordId: confirmed.recordId,
      originalName: confirmed.originalName,
      mimeType: confirmed.mimeType,
      fileSize: confirmed.fileSize,
      downloadUrl: confirmed.downloadUrl,
      etag: confirmed.etag,
    };
  }

  // Multipart upload fallback only for objects exceeding single-PUT threshold (> 250 MB)
  const completedParts: Array<{ PartNumber: number; ETag: string }> = [];
  const totalBytes = Math.max(1, file.size);
  let uploadedBytes = 0;

  try {
    for (const part of initRes.parts) {
      const start = (part.partNumber - 1) * initRes.chunkSize;
      const end = Math.min(start + initRes.chunkSize, file.size);
      const chunk = file.slice(start, end);

      const partRes = await retryOperation(
        () =>
          putBlobWithXhr(
            part.url,
            chunk,
            {},
            (loaded) => {
              const overall = uploadedBytes + loaded;
              const pct = 5 + Math.round((overall / totalBytes) * 88);
              onProgress?.(Math.min(93, Math.max(5, pct)));
            },
            signal
          ),
        3,
        signal
      );

      if (!partRes.etag) {
        throw new StorageOperationError(
          500,
          'MISSING_PART_ETAG',
          'لم يُرجع R2 ترويسة ETag للجزء المرفوع. تأكد من تفعيل ExposeHeaders: ["ETag"] في إعدادات CORS للحاوية.'
        );
      }

      uploadedBytes += chunk.size;
      completedParts.push({
        PartNumber: part.partNumber,
        ETag: partRes.etag,
      });
    }

    const confirmed = await callR2EdgeFunction<ConfirmUploadResponse>(
      'confirm-upload',
      {
        objectKey: initRes.objectKey,
        module,
        fileName: initRes.originalName,
        mimeType: initRes.mimeType,
        recordId: initRes.recordId,
        recordType: initRes.recordType,
        uploadId: initRes.uploadId,
        parts: completedParts,
      },
      { requireAuth: true, signal }
    );

    onProgress?.(100);
    return {
      storageProvider: 'r2',
      objectKey: confirmed.objectKey,
      bucketName: confirmed.bucketName,
      recordId: confirmed.recordId,
      originalName: confirmed.originalName,
      mimeType: confirmed.mimeType,
      fileSize: confirmed.fileSize,
      downloadUrl: confirmed.downloadUrl,
      etag: confirmed.etag,
    };
  } catch (err) {
    // Best-effort abort so incomplete multipart parts don't linger in R2
    void callR2EdgeFunction(
      'generate-upload-url',
      {
        action: 'abort',
        objectKey: initRes.objectKey,
        uploadId: initRes.uploadId,
        recordId: initRes.recordId,
        recordType: initRes.recordType,
      },
      { requireAuth: true }
    ).catch(() => {});
    throw err;
  }
}

export async function getFileUrl(options: {
  storageProvider?: StorageProvider | string | null;
  objectKey?: string;
  storageBucket?: string;
  recordId?: string;
  recordType?: 'file' | 'image';
  disposition?: 'inline' | 'attachment';
  downloadFileName?: string;
  expiresIn?: number;
}): Promise<string | null> {
  const provider = resolveEffectiveStorageProvider(
    options.storageProvider,
    options.objectKey
  );

  if (provider === 'r2') {
    if (!options.objectKey && !options.recordId) return null;
    try {
      const res = await callR2EdgeFunction<{
        ok: true;
        downloadUrl: string;
      }>(
        'generate-download-url',
        {
          ...(options.objectKey ? { objectKey: options.objectKey } : {}),
          ...(options.recordId ? { recordId: options.recordId } : {}),
          ...(options.recordType ? { recordType: options.recordType } : {}),
          disposition: options.disposition || 'inline',
          ...(options.downloadFileName
            ? { downloadFileName: options.downloadFileName }
            : {}),
          expiresIn: options.expiresIn ?? 1800,
        },
        { requireAuth: false }
      );
      return res.downloadUrl || null;
    } catch {
      return null;
    }
  }

  // Legacy Supabase Storage path
  if (
    !isSupabaseConfigured ||
    !supabase ||
    !options.objectKey ||
    options.objectKey.startsWith('users/')
  ) {
    return null;
  }

  const bucket = options.storageBucket || 'study-files';
  try {
    const { data } = await withFirebaseTokenRetry(async (client) =>
      client.storage
        .from(bucket)
        .createSignedUrl(options.objectKey!, options.expiresIn ?? 3600)
    );
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

export async function getBatchR2DownloadUrls(
  objectKeys: string[],
  recordType?: 'file' | 'image'
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const r2Keys = objectKeys.filter((k) => isR2ObjectKey(k));
  if (r2Keys.length === 0) return map;

  try {
    const res = await callR2EdgeFunction<{
      ok: true;
      urls: Record<string, { downloadUrl: string }>;
    }>(
      'generate-download-url',
      {
        objectKeys: r2Keys.slice(0, 60),
        ...(recordType ? { recordType } : {}),
        disposition: 'inline',
        expiresIn: 3600,
      },
      { requireAuth: false }
    );
    if (res.urls) {
      for (const [key, val] of Object.entries(res.urls)) {
        if (val?.downloadUrl) {
          map.set(key, val.downloadUrl);
        }
      }
    }
  } catch {
    // Non-fatal; individual fallback will resolve on demand
  }
  return map;
}

export async function downloadR2Blob(options: {
  objectKey?: string;
  recordId?: string;
  recordType?: 'file' | 'image';
  downloadFileName?: string;
  mimeType?: string;
}): Promise<Blob | null> {
  const url = await getFileUrl({
    storageProvider: 'r2',
    objectKey: options.objectKey,
    recordId: options.recordId,
    recordType: options.recordType,
    disposition: 'inline',
    downloadFileName: options.downloadFileName,
  });
  if (!url) return null;

  const res = await fetch(url);
  if (!res.ok) return null;
  const rawBlob = await res.blob();
  if (
    options.mimeType &&
    options.mimeType !== 'application/octet-stream' &&
    rawBlob.type !== options.mimeType
  ) {
    return new Blob([rawBlob], { type: options.mimeType });
  }
  return rawBlob;
}

export async function deleteFileFromStorage(options: {
  storageProvider?: StorageProvider | string | null;
  objectKey?: string;
  storageBucket?: string;
  recordId?: string;
  recordType?: 'file' | 'image';
}): Promise<void> {
  const provider = resolveEffectiveStorageProvider(
    options.storageProvider,
    options.objectKey
  );

  if (provider === 'r2') {
    await callR2EdgeFunction(
      'delete-file',
      {
        ...(options.objectKey ? { objectKey: options.objectKey } : {}),
        ...(options.recordId ? { recordId: options.recordId } : {}),
        ...(options.recordType ? { recordType: options.recordType } : {}),
      },
      { requireAuth: true }
    );
    return;
  }

  // Legacy Supabase deletion
  if (!isSupabaseConfigured || !supabase) return;
  const uid = auth?.currentUser?.uid;
  if (!uid) return;

  if (options.recordId) {
    const tbl =
      options.recordType === 'image' ? 'image_attachments' : 'file_attachments';
    try {
      await withFirebaseTokenRetry(async (client) =>
        client
          .from(tbl)
          .delete()
          .eq('owner_id', uid)
          .eq('id', options.recordId!)
      );
    } catch {
      // Non-fatal metadata cleanup
    }
  }

  if (options.objectKey && !options.objectKey.startsWith('users/')) {
    const bucket = options.storageBucket || 'study-files';
    try {
      await withFirebaseTokenRetry(async (client) =>
        client.storage.from(bucket).remove([options.objectKey!])
      );
    } catch {
      // Non-fatal cleanup
    }
  }
}

export interface NormalizedFileMetadata {
  id: string;
  ownerId: string;
  originalName: string;
  objectKey: string;
  bucketName: string;
  mimeType: string;
  fileSize: number;
  storageProvider: StorageProvider;
  module: string;
  uploadStatus: string;
  downloadUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function getFileMetadata(options: {
  recordId?: string;
  objectKey?: string;
  recordType?: 'file' | 'image';
}): Promise<NormalizedFileMetadata | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const table =
    options.recordType === 'image' ? 'image_attachments' : 'file_attachments';
  try {
    const { data, error } = await withFirebaseTokenRetry(async (client) => {
      let query = client.from(table).select('*');
      if (options.recordId) {
        query = query.eq('id', options.recordId);
      } else if (options.objectKey) {
        query = query.eq('object_key', options.objectKey);
      }
      return query.limit(1).maybeSingle();
    });
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    const objectKey = String(row.object_key || row.storage_path || '');
    return {
      id: String(row.id || ''),
      ownerId: String(row.owner_id || ''),
      originalName: String(row.original_name || row.file_name || ''),
      objectKey,
      bucketName: String(row.bucket_name || row.storage_bucket || ''),
      mimeType: String(row.mime_type || 'application/octet-stream'),
      fileSize: Number(row.file_size ?? row.size_bytes ?? 0),
      storageProvider: resolveEffectiveStorageProvider(
        row.storage_provider ? String(row.storage_provider) : undefined,
        objectKey
      ),
      module: String(row.module || 'library'),
      uploadStatus: String(row.upload_status || 'completed'),
      downloadUrl: row.download_url ? String(row.download_url) : undefined,
      createdAt: row.created_at ? String(row.created_at) : undefined,
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    };
  } catch {
    return null;
  }
}
