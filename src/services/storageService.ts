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
  const lowerMsg = (serverMessage || '').toLowerCase();
  if (status === 401) {
    if (
      code === 'HTTP_401' ||
      lowerMsg.includes('invalid jwt') ||
      lowerMsg.includes('missing authorization')
    ) {
      return 'رفضت بوابة Supabase رمز الدخول (401 Invalid JWT). عطّل خيار "Verify JWT" في إعدادات دوال Edge Functions بلوحة Supabase ثم أعد المحاولة.';
    }
    return 'انتهت جلسة التحقق. أعد تسجيل الدخول بحساب Google ثم حاول مجددًا.';
  }
  if (status === 403) {
    return 'ليس لديك صلاحية تنفيذ هذه العملية على التخزين السحابي (403 — يتطلب حساب المسؤول المعتمد).';
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
  if (code === 'R2_AUTH_FAILED') {
    return 'فشلت مصادقة Cloudflare R2. تحقق من R2_ACCESS_KEY_ID و R2_SECRET_ACCESS_KEY وصلاحيات التوكن في أسرار Supabase.';
  }
  if (code === 'R2_BUCKET_NOT_FOUND') {
    return 'لم يتم العثور على حاوية Cloudflare R2. تحقق من R2_BUCKET_NAME في أسرار Supabase.';
  }
  if (code === 'R2_ENDPOINT_UNREACHABLE') {
    return 'تعذر الوصول إلى خادم Cloudflare R2. تحقق من R2_ENDPOINT و CLOUDFLARE_ACCOUNT_ID.';
  }
  if (
    code === 'MISSING_MULTIPART_PARTS' ||
    code === 'INCOMPLETE_MULTIPART_PARTS' ||
    code === 'NO_UPLOADED_PARTS_IN_R2' ||
    code === 'DUPLICATE_MULTIPART_PART' ||
    code === 'INVALID_MULTIPART_PARTS' ||
    code === 'MULTIPART_PART_TOO_SMALL' ||
    code === 'EMPTY_MULTIPART_PART'
  ) {
    return `لم تكتمل أجزاء الملف متعدد الأجزاء بشكل سليم في Cloudflare R2 (${serverMessage || code}). أعد المحاولة.`;
  }
  if (
    code === 'PART_ETAG_MISMATCH' ||
    code === 'MULTIPART_SIZE_MISMATCH' ||
    code === 'FILE_INTEGRITY_MISMATCH' ||
    code === 'OBJECT_KEY_MISMATCH'
  ) {
    return `فشل التحقق من سلامة الملف المرفوع في Cloudflare R2 (${serverMessage || code}). تم إلغاء الملف التالف؛ أعد الرفع.`;
  }
  if (code === 'MULTIPART_UPLOAD_NOT_FOUND') {
    return 'انتهت جلسة الرفع متعدد الأجزاء أو لم تُعثر عليها في R2. أعد محاولة رفع الملف.';
  }
  if (code === 'MULTIPART_INIT_INCOMPLETE') {
    return 'لم تُرجع دالة generate-upload-url روابط الأجزاء الكاملة للرفع متعدد الأجزاء.';
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

  if (parsed.ok === false) {
    const code = parsed?.error?.code || 'EDGE_FUNCTION_ERROR';
    const rawMsg = parsed?.error?.message || parsed?.message || '';
    throw new StorageOperationError(
      res.status || 400,
      code,
      mapEdgeErrorToUserMessage(res.status || 400, code, rawMsg)
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
            ? 'انتهت صلاحية رابط الرفع المؤقت أو رفض R2 التوقيع (403). أعد المحاولة.'
            : `تعذّر رفع البيانات إلى Cloudflare R2 (HTTP ${xhr.status}).`
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
          'انقطع الاتصال أثناء رفع الملف إلى Cloudflare R2 (تحقق من إعدادات CORS للحاوية: السماح بـ PUT و AllowedHeaders: *).'
        )
      );
    };

    xhr.onabort = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    try {
      xhr.open('PUT', url, true);
      for (const [k, v] of Object.entries(headers || {})) {
        if (v) xhr.setRequestHeader(k, v);
      }
      xhr.send(body);
    } catch (syncErr) {
      signal?.removeEventListener('abort', onAbort);
      reject(
        new StorageOperationError(
          0,
          'R2_PUT_INIT_ERROR',
          syncErr instanceof Error && syncErr.message
            ? `تعذّر بدء الرفع إلى Cloudflare R2 (${syncErr.message}).`
            : 'تعذّر بدء طلب الرفع إلى Cloudflare R2.'
        )
      );
    }
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

  const rawInitResponse = await callR2EdgeFunction<
    GenerateUploadSingleResponse | GenerateUploadMultipartResponse | Record<string, unknown>
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

  // Unwrap nested { data: ... } payload if returned by custom/legacy Edge Function deployments
  const rawInit: Record<string, unknown> =
    rawInitResponse &&
    typeof rawInitResponse === 'object' &&
    'data' in rawInitResponse &&
    rawInitResponse.data &&
    typeof rawInitResponse.data === 'object' &&
    !('mode' in rawInitResponse) &&
    !('uploadUrl' in rawInitResponse) &&
    !('uploadId' in rawInitResponse)
      ? (rawInitResponse.data as Record<string, unknown>)
      : (rawInitResponse as Record<string, unknown>);

  const uploadUrlCandidate = [
    rawInit.uploadUrl,
    rawInit.signedUrl,
    rawInit.url,
    rawInit.presignedUrl,
  ].find((v): v is string => typeof v === 'string' && v.trim().length > 0);

  const hasMultipartPayload =
    rawInit.mode === 'multipart' ||
    Boolean(rawInit.uploadId && Array.isArray(rawInit.parts));

  const isSingleMode =
    rawInit.mode === 'single' ||
    (!hasMultipartPayload && typeof uploadUrlCandidate === 'string');

  const resolvedObjectKey =
    typeof rawInit.objectKey === 'string' ? rawInit.objectKey.trim() : '';
  const resolvedOriginalName =
    typeof rawInit.originalName === 'string' && rawInit.originalName.trim()
      ? rawInit.originalName
      : fileName;
  const resolvedMimeType =
    typeof rawInit.mimeType === 'string' && rawInit.mimeType.trim()
      ? rawInit.mimeType
      : mimeType;
  const resolvedRecordId =
    typeof rawInit.recordId === 'string' && rawInit.recordId.trim()
      ? rawInit.recordId
      : recordId;
  const resolvedRecordType =
    rawInit.recordType === 'image' ||
    rawInit.recordType === 'file' ||
    rawInit.recordType === 'none'
      ? rawInit.recordType
      : recordType;

  if (isSingleMode) {
    if (!uploadUrlCandidate || !uploadUrlCandidate.startsWith('http')) {
      throw new StorageOperationError(
        502,
        'INVALID_UPLOAD_URL',
        'استجابة رابط الرفع من دالة generate-upload-url غير صالحة.'
      );
    }

    const requiredHeaders =
      rawInit.requiredHeaders && typeof rawInit.requiredHeaders === 'object'
        ? (rawInit.requiredHeaders as Record<string, string>)
        : { 'Content-Type': resolvedMimeType };

    await retryOperation(
      () =>
        putBlobWithXhr(
          uploadUrlCandidate,
          file,
          requiredHeaders,
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
        objectKey: resolvedObjectKey,
        module,
        fileName: resolvedOriginalName,
        mimeType: resolvedMimeType,
        fileSize: file.size,
        recordId: resolvedRecordId,
        recordType: resolvedRecordType,
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

  if (!hasMultipartPayload) {
    const keysPreview = Object.keys(rawInit || {}).slice(0, 8).join(', ') || 'empty';
    const rawMessageValue =
      typeof rawInit.message === 'string' && rawInit.message.trim()
        ? ` — النص المُرجع: "${rawInit.message.trim().slice(0, 120)}"`
        : '';
    throw new StorageOperationError(
      502,
      'UNEXPECTED_UPLOAD_INIT_RESPONSE',
      `استجابة غير مكتملة من دالة generate-upload-url (keys: ${keysPreview}${rawMessageValue}). الدالة المنشورة في Supabase لا تُرجع روابط R2 المطلوبة بعد؛ انشر أحدث كود لدالة generate-upload-url (مع ملفات _shared أو بنسخة ملف واحد).`
    );
  }

  // Multipart upload for larger files (> threshold)
  const uploadId =
    typeof rawInit.uploadId === 'string' ? rawInit.uploadId.trim() : '';
  const rawParts = Array.isArray(rawInit.parts) ? rawInit.parts : [];
  const normalizedParts = rawParts
    .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
    .map((p) => ({
      partNumber: Number(p.partNumber ?? p.PartNumber ?? 0),
      url: String(p.url ?? p.signedUrl ?? '').trim(),
    }))
    .filter(
      (p) =>
        Number.isInteger(p.partNumber) &&
        p.partNumber >= 1 &&
        p.url.startsWith('http')
    )
    .sort((a, b) => a.partNumber - b.partNumber);

  const rawChunkSize = Number(rawInit.chunkSize ?? 0);
  const chunkSize =
    Number.isFinite(rawChunkSize) && rawChunkSize > 0
      ? rawChunkSize
      : normalizedParts.length === 1
      ? Math.max(1, file.size)
      : 0;

  const missingFields: string[] = [];
  if (!uploadId) missingFields.push('uploadId');
  if (!resolvedObjectKey) missingFields.push('objectKey');
  if (normalizedParts.length === 0 || normalizedParts.length !== rawParts.length) {
    missingFields.push('parts');
  }
  if (chunkSize <= 0) missingFields.push('chunkSize');

  if (missingFields.length > 0) {
    throw new StorageOperationError(
      502,
      'INVALID_MULTIPART_RESPONSE',
      `استجابة الرفع متعدد الأجزاء من دالة generate-upload-url غير مكتملة (${missingFields.join(', ')}).`
    );
  }

  const expectedPartsCount = Math.max(1, Math.ceil(file.size / chunkSize));
  if (normalizedParts.length !== expectedPartsCount) {
    throw new StorageOperationError(
      502,
      'INVALID_MULTIPART_RESPONSE',
      `عدد أجزاء الرفع متعدد الأجزاء (${normalizedParts.length}) لا يطابق حجم الملف المتوقع (${expectedPartsCount}).`
    );
  }

  const completedParts: Array<{ PartNumber: number; ETag: string }> = [];
  const totalBytes = Math.max(1, file.size);
  let uploadedBytes = 0;

  try {
    for (let i = 0; i < normalizedParts.length; i += 1) {
      const part = normalizedParts[i];
      if (part.partNumber !== i + 1) {
        throw new StorageOperationError(
          502,
          'INVALID_MULTIPART_RESPONSE',
          `تسلسل أجزاء الرفع متعدد الأجزاء غير مكتمل عند الجزء رقم ${i + 1}.`
        );
      }
      const start = (part.partNumber - 1) * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
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
        objectKey: resolvedObjectKey,
        module,
        fileName: resolvedOriginalName,
        mimeType: resolvedMimeType,
        fileSize: file.size,
        chunkSize,
        totalParts: completedParts.length,
        recordId: resolvedRecordId,
        recordType: resolvedRecordType,
        uploadId,
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
        objectKey: resolvedObjectKey,
        uploadId,
        recordId: resolvedRecordId,
        recordType: resolvedRecordType,
      },
      { requireAuth: true }
    ).catch(() => {});
    throw err;
  }
}

export interface CloudflareR2HealthResult {
  ok: boolean | null;
  status: 'connected' | 'warning' | 'failed' | 'unconfigured';
  latencyMs: number;
  bucketName?: string;
  endpointHost?: string;
  detail: string;
  errorCode?: string;
  errorMessage?: string;
  probableCause?: string;
}

export async function testCloudflareR2Connection(): Promise<CloudflareR2HealthResult> {
  const startedAt =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const elapsed = () =>
    Math.max(
      1,
      Math.round(
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
          startedAt
      )
    );

  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      status: 'unconfigured',
      latencyMs: 0,
      detail: 'متغيرات Supabase غير مهيأة، لذلك يتعذر استدعاء دوال Cloudflare R2.',
      errorCode: 'SUPABASE_NOT_CONFIGURED',
      errorMessage: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.',
    };
  }

  let token = await getFirebaseIdToken(false);
  if (!token && auth?.currentUser) {
    token = await getFirebaseIdToken(true);
  }
  if (!token) {
    return {
      ok: null,
      status: 'warning',
      latencyMs: elapsed(),
      detail: 'سجّل الدخول بحساب المسؤول لاختبار الاتصال المباشر مع Cloudflare R2.',
    };
  }

  const endpoint = `${supabaseUrl}/functions/v1/generate-upload-url`;
  const doProbe = (bearer: string) =>
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ action: 'health' }),
    });

  let res: Response;
  try {
    res = await doProbe(token);
    if (res.status === 401 && auth?.currentUser) {
      const fresh = await getFirebaseIdToken(true);
      if (fresh) {
        res = await doProbe(fresh);
      }
    }
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 'failed',
      latencyMs: elapsed(),
      detail: 'تعذر الوصول إلى دالة generate-upload-url في Supabase.',
      errorCode: 'EDGE_NETWORK_ERROR',
      errorMessage: rawMsg,
      probableCause:
        'تحقق من اتصال الإنترنت، أو من نشر دالة generate-upload-url وإعدادات CORS الخاصة بها.',
    };
  }

  type R2HealthProbePayload = {
    ok?: boolean;
    r2Connected?: boolean;
    bucketName?: string;
    endpointHost?: string;
    latencyMs?: number;
    error?: { code?: string; message?: string };
    message?: string;
  };
  let parsed: R2HealthProbePayload | null = null;
  try {
    parsed = (await res.json()) as R2HealthProbePayload;
  } catch {
    parsed = null;
  }

  const latencyMs = elapsed();

  if (res.ok && parsed?.ok && parsed?.r2Connected) {
    return {
      ok: true,
      status: 'connected',
      latencyMs,
      bucketName: parsed.bucketName,
      endpointHost: parsed.endpointHost,
      detail: `متصل بنجاح بحاوية "${parsed.bucketName || 'R2'}" (${parsed.endpointHost || 'Cloudflare R2'}) خلال ${parsed.latencyMs ?? latencyMs}ms.`,
    };
  }

  const code = parsed?.error?.code || `HTTP_${res.status}`;
  const rawMsg =
    parsed?.error?.message || parsed?.message || res.statusText || '';

  if (res.ok) {
    const keysPreview =
      parsed && typeof parsed === 'object'
        ? Object.keys(parsed).slice(0, 8).join(', ') || 'empty'
        : 'non-json';
    return {
      ok: false,
      status: 'failed',
      latencyMs,
      detail: `استجابت دالة generate-upload-url برمز ${res.status} لكن برد غير متوقع (keys: ${keysPreview}) — أي أن الدالة المنشورة في Supabase ليست كود Cloudflare R2 الفعلي بعد.`,
      errorCode: 'UNEXPECTED_EDGE_PAYLOAD',
      errorMessage: rawMsg || `Keys: ${keysPreview}`,
      probableCause:
        'الدالة المنشورة حاليًا قد تكون القالب الافتراضي (Hello/message) أو إصدارًا غير مكتمل. أعد نشر الدالة generate-upload-url من supabase/functions/generate-upload-url/index.ts (وتأكد من وجود _shared أو الكود الكامل).',
    };
  }

  if (res.status === 400 && code === 'INVALID_MODULE') {
    return {
      ok: false,
      status: 'warning',
      latencyMs,
      detail:
        'الدالة مستجيبة وتقبل التوثيق، لكن النسخة المنشورة في Supabase قديمة ولا تدعم فحص R2 المباشر أو تعديلات الرفع الأحدث.',
      errorCode: code,
      errorMessage: rawMsg || 'Deployed generate-upload-url rejected action=health.',
      probableCause:
        'أعد نشر أحدث كود لدوال generate-upload-url و confirm-upload في Supabase Edge Functions.',
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      status: 'failed',
      latencyMs,
      detail: mapEdgeErrorToUserMessage(401, code, rawMsg),
      errorCode: code,
      errorMessage: rawMsg || '401 Unauthorized / Invalid JWT',
      probableCause:
        'عطّل خيار "Verify JWT" في إعدادات دوال Edge Functions الأربع داخل Supabase Dashboard.',
    };
  }

  if (res.status === 404) {
    return {
      ok: false,
      status: 'failed',
      latencyMs,
      detail: 'دالة generate-upload-url غير منشورة على Supabase (404).',
      errorCode: 'EDGE_FUNCTION_NOT_FOUND',
      errorMessage: rawMsg || 'HTTP 404 from /functions/v1/generate-upload-url',
      probableCause:
        'انشر الدوال الأربع (generate-upload-url و confirm-upload و generate-download-url و delete-file) عبر Supabase Dashboard أو CLI.',
    };
  }

  return {
    ok: false,
    status: 'failed',
    latencyMs,
    detail: mapEdgeErrorToUserMessage(res.status, code, rawMsg),
    errorCode: code,
    errorMessage: rawMsg || `HTTP ${res.status}`,
    probableCause:
      code === 'R2_NOT_CONFIGURED'
        ? 'أضف أسرار R2 في Supabase Edge Function Secrets: CLOUDFLARE_ACCOUNT_ID و R2_BUCKET_NAME و R2_ACCESS_KEY_ID و R2_SECRET_ACCESS_KEY.'
        : code === 'R2_AUTH_FAILED'
        ? 'تحقق من صحة R2_ACCESS_KEY_ID و R2_SECRET_ACCESS_KEY وصلاحية Object Read & Write للتوكن.'
        : code === 'R2_BUCKET_NOT_FOUND'
        ? 'تحقق من مطابقة R2_BUCKET_NAME لاسم الحاوية الفعلي في Cloudflare R2.'
        : code === 'R2_ENDPOINT_UNREACHABLE'
        ? 'تحقق من R2_ENDPOINT (https://<ACCOUNT_ID>.r2.cloudflarestorage.com).'
        : undefined,
  };
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
