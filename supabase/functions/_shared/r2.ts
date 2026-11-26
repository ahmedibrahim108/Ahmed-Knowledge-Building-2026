import {
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  S3Client,
  type CompletedPart,
} from 'npm:@aws-sdk/client-s3@3.734.0';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.734.0';

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

export interface ModulePolicy {
  prefix: string;
  kind: 'document' | 'image' | 'mixed';
  maxBytes: number;
  allowedMimes: readonly string[];
}

const MB = 1024 * 1024;
// R2 supports single PUT objects up to 5 GB natively; keep up to 250 MB in one single PUT
// without splitting into S3 multipart chunks (avoids unnecessary ETag CORS & part overhead).
export const SINGLE_UPLOAD_MAX_BYTES = 250 * MB;
export const MULTIPART_CHUNK_BYTES = 25 * MB;
export const MAX_DOCUMENT_BYTES = 250 * MB;
export const MAX_IMAGE_BYTES = 25 * MB;

const DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/html',
] as const;

const IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/avif',
] as const;

const MIXED_MIMES = [...DOCUMENT_MIMES, ...IMAGE_MIMES] as const;

export const MODULE_POLICIES: Record<StorageModule, ModulePolicy> = {
  library_book: {
    prefix: 'library/books/',
    kind: 'document',
    maxBytes: MAX_DOCUMENT_BYTES,
    allowedMimes: DOCUMENT_MIMES,
  },
  library_cover: {
    prefix: 'library/covers/',
    kind: 'image',
    maxBytes: MAX_IMAGE_BYTES,
    allowedMimes: IMAGE_MIMES,
  },
  note_attachment: {
    prefix: 'notes/attachments/',
    kind: 'mixed',
    maxBytes: MAX_DOCUMENT_BYTES,
    allowedMimes: MIXED_MIMES,
  },
  journal_attachment: {
    prefix: 'journal/attachments/',
    kind: 'mixed',
    maxBytes: MAX_DOCUMENT_BYTES,
    allowedMimes: MIXED_MIMES,
  },
  recovery_resource: {
    prefix: 'recovery/resources/',
    kind: 'mixed',
    maxBytes: MAX_DOCUMENT_BYTES,
    allowedMimes: MIXED_MIMES,
  },
  course_attachment: {
    prefix: 'courses/attachments/',
    kind: 'mixed',
    maxBytes: MAX_DOCUMENT_BYTES,
    allowedMimes: MIXED_MIMES,
  },
  month_attachment: {
    prefix: 'months/attachments/',
    kind: 'mixed',
    maxBytes: MAX_DOCUMENT_BYTES,
    allowedMimes: MIXED_MIMES,
  },
  reflection_image: {
    prefix: 'reflections/images/',
    kind: 'image',
    maxBytes: MAX_IMAGE_BYTES,
    allowedMimes: IMAGE_MIMES,
  },
  blog_cover: {
    prefix: 'blogs/covers/',
    kind: 'image',
    maxBytes: MAX_IMAGE_BYTES,
    allowedMimes: IMAGE_MIMES,
  },
  dental_cover: {
    prefix: 'dental/covers/',
    kind: 'image',
    maxBytes: MAX_IMAGE_BYTES,
    allowedMimes: IMAGE_MIMES,
  },
  quick_drop: {
    prefix: 'quick_drop/attachments/',
    kind: 'mixed',
    maxBytes: MAX_DOCUMENT_BYTES,
    allowedMimes: MIXED_MIMES,
  },
};

export const ALL_R2_PREFIXES = Object.values(MODULE_POLICIES).map(
  (p) => p.prefix
);

export class R2ConfigError extends Error {
  readonly code = 'R2_NOT_CONFIGURED';
  constructor(message: string) {
    super(message);
    this.name = 'R2ConfigError';
  }
}

export class R2ValidationError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'R2ValidationError';
    this.status = status;
    this.code = code;
  }
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  publicUrl?: string;
}

export function getR2Config(): R2Config {
  const accountId = (Deno.env.get('CLOUDFLARE_ACCOUNT_ID') || '').trim();
  const accessKeyId = (Deno.env.get('R2_ACCESS_KEY_ID') || '').trim();
  const secretAccessKey = (Deno.env.get('R2_SECRET_ACCESS_KEY') || '').trim();
  const bucketName = (Deno.env.get('R2_BUCKET_NAME') || '').trim();
  const rawEndpoint = (Deno.env.get('R2_ENDPOINT') || '').trim();
  const rawPublicUrl = (Deno.env.get('R2_PUBLIC_URL') || '').trim();

  const endpoint =
    rawEndpoint ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  const missing: string[] = [];
  if (!accountId && !rawEndpoint) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!bucketName) missing.push('R2_BUCKET_NAME');
  if (!endpoint) missing.push('R2_ENDPOINT');

  if (missing.length > 0) {
    throw new R2ConfigError(
      `Cloudflare R2 storage is not configured on the server (missing: ${missing.join(', ')}).`
    );
  }

  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    throw new R2ConfigError('Invalid R2_ENDPOINT URL configuration.');
  }
  if (parsedEndpoint.protocol !== 'https:') {
    throw new R2ConfigError('R2_ENDPOINT must use HTTPS.');
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint: parsedEndpoint.origin,
    publicUrl: rawPublicUrl ? rawPublicUrl.replace(/\/+$/, '') : undefined,
  };
}

export function createR2Client(cfg: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    // Required for @aws-sdk/client-s3 >= 3.729 with Cloudflare R2 presigned PUT URLs
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export function assertValidModule(raw: unknown): StorageModule {
  if (typeof raw !== 'string' || !(raw in MODULE_POLICIES)) {
    throw new R2ValidationError(
      400,
      'INVALID_MODULE',
      'Invalid or unsupported storage module.'
    );
  }
  return raw as StorageModule;
}

const DISALLOWED_EXTENSION_RE =
  /\.(svg|svgz|exe|bat|cmd|sh|bash|zsh|ps1|msi|dll|so|dylib|js|mjs|cjs|ts|php|py|rb|jar|apk|ipa|html|htm|xhtml)$/i;

export function sanitizeOriginalFileName(rawName: unknown): {
  originalName: string;
  safeAsciiName: string;
  ext: string;
} {
  if (typeof rawName !== 'string' || !rawName.trim()) {
    throw new R2ValidationError(
      400,
      'INVALID_FILE_NAME',
      'File name is required.'
    );
  }

  const trimmed = rawName.trim().slice(0, 240);
  if (
    trimmed.includes('..') ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    throw new R2ValidationError(
      400,
      'INVALID_FILE_NAME',
      'File name contains invalid path characters.'
    );
  }

  if (DISALLOWED_EXTENSION_RE.test(trimmed)) {
    throw new R2ValidationError(
      415,
      'UNSUPPORTED_FILE_TYPE',
      'This file extension is blocked for security reasons.'
    );
  }

  const extMatch = trimmed.match(/(\.[a-zA-Z0-9]{1,10})$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  const stemRaw = ext ? trimmed.slice(0, -ext.length) : trimmed;
  const asciiStem = stemRaw
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

  return {
    originalName: trimmed,
    safeAsciiName: `${asciiStem || 'file'}${ext}`,
    ext,
  };
}

export function normalizeAndValidateMime(
  module: StorageModule,
  rawMime: unknown,
  fileName: string
): string {
  const policy = MODULE_POLICIES[module];
  const raw = typeof rawMime === 'string' ? rawMime.trim().toLowerCase().split(';')[0] : '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  let normalized = raw;
  if (normalized === 'application/x-pdf' || (!normalized && ext === 'pdf')) {
    normalized = 'application/pdf';
  } else if (normalized === 'image/jpg' || (!normalized && (ext === 'jpg' || ext === 'jpeg'))) {
    normalized = 'image/jpeg';
  } else if (!normalized && ext === 'png') {
    normalized = 'image/png';
  } else if (!normalized && ext === 'webp') {
    normalized = 'image/webp';
  } else if (!normalized && ext === 'gif') {
    normalized = 'image/gif';
  } else if (!normalized && ext === 'docx') {
    normalized =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (!normalized && ext === 'doc') {
    normalized = 'application/msword';
  } else if (!normalized && (ext === 'md' || ext === 'markdown')) {
    normalized = 'text/markdown';
  } else if (!normalized && ext === 'txt') {
    normalized = 'text/plain';
  }

  if (normalized === 'image/svg+xml' || normalized === 'application/x-msdownload') {
    throw new R2ValidationError(
      415,
      'UNSUPPORTED_MIME_TYPE',
      'MIME type is blocked for security reasons.'
    );
  }

  if (!normalized || !policy.allowedMimes.includes(normalized)) {
    throw new R2ValidationError(
      415,
      'UNSUPPORTED_MIME_TYPE',
      `File type "${normalized || 'unknown'}" is not allowed for ${module}.`
    );
  }

  return normalized;
}

export function validateFileSize(module: StorageModule, rawSize: unknown): number {
  const policy = MODULE_POLICIES[module];
  const size = typeof rawSize === 'number' ? rawSize : Number(rawSize);
  if (!Number.isFinite(size) || size <= 0) {
    throw new R2ValidationError(
      400,
      'INVALID_FILE_SIZE',
      'File size must be a positive number of bytes.'
    );
  }
  const rounded = Math.round(size);
  if (rounded > policy.maxBytes) {
    const maxMb = Math.round(policy.maxBytes / MB);
    throw new R2ValidationError(
      413,
      'FILE_TOO_LARGE',
      `File size exceeds the ${maxMb} MB limit for ${module}.`
    );
  }
  return rounded;
}

export function buildScopedObjectKey(
  module: StorageModule,
  uid: string,
  safeAsciiName: string
): string {
  const policy = MODULE_POLICIES[module];
  const cleanUid = uid.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanUid || cleanUid !== uid) {
    throw new R2ValidationError(
      400,
      'INVALID_UID',
      'Invalid authenticated user identifier.'
    );
  }
  return `${policy.prefix}${cleanUid}/${crypto.randomUUID()}-${safeAsciiName}`;
}

export function isValidR2ObjectKey(objectKey: unknown): objectKey is string {
  if (typeof objectKey !== 'string') return false;
  const key = objectKey.trim();
  if (!key || key.length > 512) return false;
  if (
    key.startsWith('/') ||
    key.includes('..') ||
    key.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(key)
  ) {
    return false;
  }
  return ALL_R2_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function extractOwnerUidFromObjectKey(objectKey: string): string | null {
  for (const prefix of ALL_R2_PREFIXES) {
    if (objectKey.startsWith(prefix)) {
      const rest = objectKey.slice(prefix.length);
      const slashIdx = rest.indexOf('/');
      if (slashIdx <= 0) return null;
      const uidPart = rest.slice(0, slashIdx);
      return /^[a-zA-Z0-9_-]+$/.test(uidPart) ? uidPart : null;
    }
  }
  return null;
}

export function assertOwnerKeyConfined(objectKey: unknown, uid: string): string {
  if (!isValidR2ObjectKey(objectKey)) {
    throw new R2ValidationError(
      400,
      'INVALID_OBJECT_KEY',
      'Object key is missing or outside allowed storage prefixes.'
    );
  }
  const keyOwner = extractOwnerUidFromObjectKey(objectKey);
  if (!keyOwner || keyOwner !== uid) {
    throw new R2ValidationError(
      403,
      'FORBIDDEN_OBJECT_KEY',
      'You do not have ownership permission for this storage key.'
    );
  }
  return objectKey;
}

export function sanitizeRecordId(rawId: unknown): string {
  if (typeof rawId !== 'string' || !rawId.trim()) {
    return `r2-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export function buildContentDisposition(
  mode: 'inline' | 'attachment',
  fileName: string
): string {
  const safeFallback =
    fileName
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\;\r\n]/g, '_')
      .slice(0, 120) || 'file';
  const encoded = encodeURIComponent(fileName).replace(
    /['()*!]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${mode}; filename="${safeFallback}"; filename*=UTF-8''${encoded}`;
}

export async function signSinglePutUrl(
  client: S3Client,
  bucket: string,
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function createMultipartSession(
  client: S3Client,
  bucket: string,
  key: string,
  contentType: string,
  totalBytes: number,
  expiresIn = 1800
): Promise<{
  uploadId: string;
  chunkSize: number;
  parts: Array<{ partNumber: number; url: string }>;
}> {
  const created = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })
  );
  if (!created.UploadId) {
    throw new Error('R2 did not return an UploadId for multipart upload.');
  }

  const totalParts = Math.max(1, Math.ceil(totalBytes / MULTIPART_CHUNK_BYTES));
  const parts: Array<{ partNumber: number; url: string }> = [];
  for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
    const url = await getSignedUrl(
      client,
      new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: created.UploadId,
        PartNumber: partNumber,
      }),
      { expiresIn }
    );
    parts.push({ partNumber, url });
  }

  return {
    uploadId: created.UploadId,
    chunkSize: MULTIPART_CHUNK_BYTES,
    parts,
  };
}

export async function completeMultipartSession(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  parts: CompletedPart[]
): Promise<{ etag?: string }> {
  const sorted = [...parts]
    .filter(
      (p) =>
        typeof p.PartNumber === 'number' &&
        p.PartNumber >= 1 &&
        typeof p.ETag === 'string' &&
        p.ETag.trim().length > 0
    )
    .sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0));

  if (sorted.length === 0) {
    throw new R2ValidationError(
      400,
      'INVALID_MULTIPART_PARTS',
      'Valid ETag part records are required to complete multipart upload.'
    );
  }

  const res = await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: sorted },
    })
  );
  return { etag: res.ETag };
}

export async function abortMultipartSession(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string
): Promise<void> {
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    })
  );
}

export async function headR2Object(
  client: S3Client,
  bucket: string,
  key: string
): Promise<{ exists: boolean; contentLength: number; contentType?: string; etag?: string }> {
  try {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return {
      exists: true,
      contentLength: Number(head.ContentLength ?? 0),
      contentType: head.ContentType,
      etag: head.ETag,
    };
  } catch (err) {
    const metaStatus = (err as { $metadata?: { httpStatusCode?: number }; name?: string })
      ?.$metadata?.httpStatusCode;
    const errName = (err as { name?: string })?.name;
    if (metaStatus === 404 || errName === 'NotFound' || errName === 'NoSuchKey') {
      return { exists: false, contentLength: 0 };
    }
    throw err;
  }
}

export async function deleteR2Object(
  client: S3Client,
  bucket: string,
  key: string
): Promise<void> {
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  } catch (err) {
    const metaStatus = (err as { $metadata?: { httpStatusCode?: number }; name?: string })
      ?.$metadata?.httpStatusCode;
    const errName = (err as { name?: string })?.name;
    if (metaStatus === 404 || errName === 'NotFound' || errName === 'NoSuchKey') {
      return;
    }
    throw err;
  }
}

export async function signGetUrl(
  client: S3Client,
  bucket: string,
  key: string,
  options?: {
    expiresIn?: number;
    disposition?: 'inline' | 'attachment';
    downloadFileName?: string;
    contentType?: string;
    publicUrlBase?: string;
    isPublicAsset?: boolean;
  }
): Promise<{ url: string; expiresIn: number; isPublicUrl: boolean }> {
  const expiresIn = Math.min(3600, Math.max(60, options?.expiresIn ?? 1800));

  if (options?.publicUrlBase && options?.isPublicAsset) {
    const encodedPath = key
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    return {
      url: `${options.publicUrlBase}/${encodedPath}`,
      expiresIn: 0,
      isPublicUrl: true,
    };
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(options?.downloadFileName
      ? {
          ResponseContentDisposition: buildContentDisposition(
            options.disposition === 'attachment' ? 'attachment' : 'inline',
            options.downloadFileName
          ),
        }
      : {}),
    ...(options?.contentType
      ? { ResponseContentType: options.contentType }
      : {}),
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return { url, expiresIn, isPublicUrl: false };
}
