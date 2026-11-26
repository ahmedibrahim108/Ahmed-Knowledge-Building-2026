import {
  AuthError,
  checkRateLimit,
  createSupabaseAdminClient,
  getClientRateKey,
  requireVerifiedUser,
} from '../_shared/auth.ts';
import {
  errorResponse,
  handleCorsPreflight,
  jsonResponse,
} from '../_shared/cors.ts';
import {
  MODULE_POLICIES,
  R2ConfigError,
  R2ValidationError,
  assertOwnerKeyConfined,
  assertValidModule,
  completeMultipartSession,
  createR2Client,
  deleteR2Object,
  getR2Config,
  headR2Object,
  normalizeAndValidateMime,
  sanitizeOriginalFileName,
  sanitizeRecordId,
  signGetUrl,
} from '../_shared/r2.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req);
  }
  if (req.method !== 'POST') {
    return errorResponse(req, 405, 'METHOD_NOT_ALLOWED', 'Only POST is supported.');
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const caller = await requireVerifiedUser(req, adminClient);

    const rl = checkRateLimit(getClientRateKey(req, caller.uid), 60, 60_000);
    if (!rl.allowed) {
      return errorResponse(
        req,
        429,
        'RATE_LIMITED',
        'Too many confirmation requests. Please try again shortly.',
        { retryAfterSec: rl.retryAfterSec }
      );
    }

    const r2Cfg = getR2Config();
    const r2Client = createR2Client(r2Cfg);

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return errorResponse(req, 400, 'INVALID_JSON', 'Invalid JSON request body.');
    }

    const objectKey = assertOwnerKeyConfined(body.objectKey, caller.uid);
    const module = assertValidModule(body.module);
    if (
      !caller.isAdmin &&
      (module !== 'quick_drop' ||
        !objectKey.startsWith(`quick_drop/attachments/${caller.uid}/`))
    ) {
      throw new AuthError(
        403,
        'ADMIN_REQUIRED',
        'Only the approved platform administrator can perform this action.'
      );
    }

    const policy = MODULE_POLICIES[module];
    const { originalName } = sanitizeOriginalFileName(body.fileName);
    const recordId = sanitizeRecordId(body.recordId);
    const recordType =
      !caller.isAdmin
        ? 'none'
        : body.recordType === 'image'
        ? 'image'
        : body.recordType === 'none'
        ? 'none'
        : 'file';

    let completedEtag = '';
    if (typeof body.uploadId === 'string' && body.uploadId.trim()) {
      const rawParts = Array.isArray(body.parts) ? body.parts : [];
      const parts = rawParts
        .filter((p): p is { partNumber?: unknown; PartNumber?: unknown; etag?: unknown; ETag?: unknown } =>
          Boolean(p && typeof p === 'object')
        )
        .map((p) => ({
          PartNumber: Number(p.PartNumber ?? p.partNumber),
          ETag: String(p.ETag ?? p.etag ?? ''),
        }));
      const completed = await completeMultipartSession(
        r2Client,
        r2Cfg.bucketName,
        objectKey,
        body.uploadId.trim(),
        parts
      );
      completedEtag = completed.etag || '';
    }

    const head = await headR2Object(r2Client, r2Cfg.bucketName, objectKey);
    if (!head.exists) {
      return errorResponse(
        req,
        404,
        'OBJECT_NOT_FOUND',
        'Uploaded object was not found in Cloudflare R2.'
      );
    }

    if (head.contentLength <= 0 || head.contentLength > policy.maxBytes) {
      await deleteR2Object(r2Client, r2Cfg.bucketName, objectKey);
      return errorResponse(
        req,
        413,
        'OBJECT_SIZE_INVALID',
        'Uploaded object size exceeds the allowed server policy.'
      );
    }

    const rawHeadMime = (head.contentType || '').trim().toLowerCase().split(';')[0];
    if (
      rawHeadMime === 'image/svg+xml' ||
      rawHeadMime === 'application/x-msdownload' ||
      rawHeadMime === 'application/javascript' ||
      rawHeadMime === 'text/javascript' ||
      (rawHeadMime === 'text/html' && module !== 'library_book' && module !== 'note_attachment')
    ) {
      await deleteR2Object(r2Client, r2Cfg.bucketName, objectKey);
      return errorResponse(
        req,
        415,
        'UNSUPPORTED_MIME_TYPE',
        'Uploaded object content type is blocked for security reasons.'
      );
    }

    const preferredMime =
      rawHeadMime &&
      rawHeadMime !== 'application/octet-stream' &&
      rawHeadMime !== 'binary/octet-stream'
        ? rawHeadMime
        : body.mimeType;

    let normalizedMime: string;
    try {
      normalizedMime = normalizeAndValidateMime(module, preferredMime, originalName);
    } catch (mimeErr) {
      await deleteR2Object(r2Client, r2Cfg.bucketName, objectKey);
      throw mimeErr;
    }

    const finalEtag = (head.etag || completedEtag || '').replace(/^"+|"+$/g, '');
    const signed = await signGetUrl(r2Client, r2Cfg.bucketName, objectKey, {
      expiresIn: 3600,
      disposition: 'inline',
      downloadFileName: originalName,
      contentType: normalizedMime,
    });

    if (recordType === 'file') {
      const { error: updateErr } = await adminClient
        .from('file_attachments')
        .upsert(
          {
            owner_id: caller.uid,
            id: recordId,
            file_name: originalName,
            original_name: originalName,
            mime_type: normalizedMime,
            size_bytes: head.contentLength,
            file_size: head.contentLength,
            storage_bucket: r2Cfg.bucketName,
            bucket_name: r2Cfg.bucketName,
            storage_path: objectKey,
            object_key: objectKey,
            download_url: signed.url,
            storage_provider: 'r2',
            module,
            upload_status: 'completed',
            r2_etag: finalEtag,
          },
          { onConflict: 'owner_id,id' }
        );
      if (updateErr) {
        return errorResponse(
          req,
          500,
          'METADATA_CONFIRM_FAILED',
          'File uploaded to R2 but failed updating database metadata.'
        );
      }
    } else if (recordType === 'image') {
      const { error: updateErr } = await adminClient
        .from('image_attachments')
        .upsert(
          {
            owner_id: caller.uid,
            id: recordId,
            file_name: originalName,
            original_name: originalName,
            mime_type: normalizedMime,
            size_bytes: head.contentLength,
            file_size: head.contentLength,
            storage_bucket: r2Cfg.bucketName,
            bucket_name: r2Cfg.bucketName,
            storage_path: objectKey,
            object_key: objectKey,
            download_url: signed.url,
            storage_provider: 'r2',
            module,
            upload_status: 'completed',
            r2_etag: finalEtag,
          },
          { onConflict: 'owner_id,id' }
        );
      if (updateErr) {
        return errorResponse(
          req,
          500,
          'METADATA_CONFIRM_FAILED',
          'Image uploaded to R2 but failed updating database metadata.'
        );
      }
    }

    return jsonResponse(req, {
      ok: true,
      storageProvider: 'r2',
      recordId,
      recordType,
      objectKey,
      bucketName: r2Cfg.bucketName,
      originalName,
      mimeType: normalizedMime,
      fileSize: head.contentLength,
      etag: finalEtag,
      downloadUrl: signed.url,
      expiresIn: signed.expiresIn,
      uploadStatus: 'completed',
    });
  } catch (err) {
    if (err instanceof R2ConfigError) {
      return errorResponse(req, 503, err.code, err.message);
    }
    if (err instanceof R2ValidationError || err instanceof AuthError) {
      return errorResponse(req, err.status, err.code, err.message);
    }
    console.error('[confirm-upload] Unexpected error:', err);
    return errorResponse(
      req,
      500,
      'CONFIRM_UPLOAD_FAILED',
      'Unable to confirm uploaded object.'
    );
  }
});
