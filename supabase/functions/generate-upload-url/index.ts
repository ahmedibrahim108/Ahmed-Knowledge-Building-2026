import {
  AuthError,
  checkRateLimit,
  createSupabaseAdminClient,
  getClientRateKey,
  requireVerifiedAdmin,
} from '../_shared/auth.ts';
import {
  errorResponse,
  handleCorsPreflight,
  jsonResponse,
} from '../_shared/cors.ts';
import {
  MULTIPART_CHUNK_BYTES,
  R2ConfigError,
  R2ValidationError,
  SINGLE_UPLOAD_MAX_BYTES,
  abortMultipartSession,
  assertOwnerKeyConfined,
  assertValidModule,
  buildScopedObjectKey,
  createMultipartSession,
  createR2Client,
  getR2Config,
  normalizeAndValidateMime,
  sanitizeOriginalFileName,
  sanitizeRecordId,
  signSinglePutUrl,
  validateFileSize,
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
    const caller = await requireVerifiedAdmin(req, adminClient);

    const rl = checkRateLimit(getClientRateKey(req, caller.uid), 60, 60_000);
    if (!rl.allowed) {
      return errorResponse(
        req,
        429,
        'RATE_LIMITED',
        'Too many upload requests. Please try again shortly.',
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

    const action = typeof body.action === 'string' ? body.action : 'init';

    // Allow clean cancellation/cleanup of an aborted multipart upload session
    if (action === 'abort') {
      const objectKey = assertOwnerKeyConfined(body.objectKey, caller.uid);
      const uploadId =
        typeof body.uploadId === 'string' ? body.uploadId.trim() : '';
      if (!uploadId) {
        return errorResponse(req, 400, 'MISSING_UPLOAD_ID', 'uploadId is required.');
      }
      await abortMultipartSession(r2Client, r2Cfg.bucketName, objectKey, uploadId);
      const recordId =
        typeof body.recordId === 'string' ? sanitizeRecordId(body.recordId) : '';
      const recordType = body.recordType === 'image' ? 'image' : body.recordType === 'file' ? 'file' : 'none';
      if (recordId && recordType !== 'none') {
        const tbl = recordType === 'image' ? 'image_attachments' : 'file_attachments';
        await adminClient
          .from(tbl)
          .update({ upload_status: 'failed' })
          .eq('owner_id', caller.uid)
          .eq('id', recordId);
      }
      return jsonResponse(req, { ok: true, aborted: true });
    }

    const module = assertValidModule(body.module);
    const { originalName, safeAsciiName } = sanitizeOriginalFileName(body.fileName);
    const mimeType = normalizeAndValidateMime(module, body.mimeType, originalName);
    const fileSize = validateFileSize(module, body.fileSize);

    const recordId = sanitizeRecordId(body.recordId);
    const recordType =
      body.recordType === 'image'
        ? 'image'
        : body.recordType === 'none'
        ? 'none'
        : 'file';

    const objectKey = buildScopedObjectKey(module, caller.uid, safeAsciiName);
    const useMultipart =
      body.mode === 'multipart' ||
      (body.mode !== 'single' && fileSize > SINGLE_UPLOAD_MAX_BYTES);

    // Record pending metadata row BEFORE handing out a presigned upload URL
    if (recordType === 'file') {
      const extractedPreview =
        typeof body.extractedPreview === 'string'
          ? body.extractedPreview.slice(0, 8000)
          : '';
      const { error: metaErr } = await adminClient.from('file_attachments').upsert(
        {
          owner_id: caller.uid,
          id: recordId,
          file_name: originalName,
          original_name: originalName,
          mime_type: mimeType,
          size_bytes: fileSize,
          file_size: fileSize,
          storage_bucket: r2Cfg.bucketName,
          bucket_name: r2Cfg.bucketName,
          storage_path: objectKey,
          object_key: objectKey,
          download_url: '',
          extracted_preview: extractedPreview,
          storage_provider: 'r2',
          module,
          upload_status: 'pending',
          r2_etag: '',
        },
        { onConflict: 'owner_id,id' }
      );
      if (metaErr) {
        return errorResponse(
          req,
          500,
          'METADATA_INIT_FAILED',
          'Failed initializing file metadata record.'
        );
      }
    } else if (recordType === 'image') {
      const scopeKey =
        typeof body.scopeKey === 'string' ? body.scopeKey.slice(0, 128) : '';
      const caption =
        typeof body.caption === 'string' ? body.caption.slice(0, 500) : '';
      const width = Number.isFinite(Number(body.width))
        ? Math.max(0, Math.round(Number(body.width)))
        : 0;
      const height = Number.isFinite(Number(body.height))
        ? Math.max(0, Math.round(Number(body.height)))
        : 0;
      const sortOrder = Number.isFinite(Number(body.sortOrder))
        ? Math.max(0, Math.round(Number(body.sortOrder)))
        : 0;
      const categoryLabel =
        typeof body.categoryLabel === 'string'
          ? body.categoryLabel.slice(0, 80)
          : '';
      const createdAtMs = Number.isFinite(Number(body.createdAtMs))
        ? Math.max(0, Math.round(Number(body.createdAtMs)))
        : Date.now();

      const { error: metaErr } = await adminClient.from('image_attachments').upsert(
        {
          owner_id: caller.uid,
          id: recordId,
          scope_key: scopeKey,
          file_name: originalName,
          original_name: originalName,
          mime_type: mimeType,
          size_bytes: fileSize,
          file_size: fileSize,
          width,
          height,
          caption,
          category_label: categoryLabel,
          sort_order: sortOrder,
          ...(body.frameConfig && typeof body.frameConfig === 'object'
            ? { frame_config: body.frameConfig }
            : {}),
          storage_bucket: r2Cfg.bucketName,
          bucket_name: r2Cfg.bucketName,
          storage_path: objectKey,
          object_key: objectKey,
          download_url: '',
          created_at_ms: createdAtMs,
          storage_provider: 'r2',
          module,
          upload_status: 'pending',
          r2_etag: '',
        },
        { onConflict: 'owner_id,id' }
      );
      if (metaErr) {
        return errorResponse(
          req,
          500,
          'METADATA_INIT_FAILED',
          'Failed initializing image metadata record.'
        );
      }
    }

    if (useMultipart) {
      const mp = await createMultipartSession(
        r2Client,
        r2Cfg.bucketName,
        objectKey,
        mimeType,
        fileSize,
        1800
      );
      return jsonResponse(req, {
        ok: true,
        mode: 'multipart',
        storageProvider: 'r2',
        bucketName: r2Cfg.bucketName,
        objectKey,
        recordId,
        recordType,
        module,
        originalName,
        mimeType,
        fileSize,
        uploadId: mp.uploadId,
        chunkSize: mp.chunkSize || MULTIPART_CHUNK_BYTES,
        parts: mp.parts,
        expiresIn: 1800,
      });
    }

    const uploadUrl = await signSinglePutUrl(
      r2Client,
      r2Cfg.bucketName,
      objectKey,
      mimeType,
      300
    );

    return jsonResponse(req, {
      ok: true,
      mode: 'single',
      storageProvider: 'r2',
      bucketName: r2Cfg.bucketName,
      objectKey,
      recordId,
      recordType,
      module,
      originalName,
      mimeType,
      fileSize,
      uploadUrl,
      requiredHeaders: {
        'Content-Type': mimeType,
      },
      expiresIn: 300,
    });
  } catch (err) {
    if (err instanceof R2ConfigError) {
      return errorResponse(req, 503, err.code, err.message);
    }
    if (err instanceof R2ValidationError || err instanceof AuthError) {
      return errorResponse(req, err.status, err.code, err.message);
    }
    console.error('[generate-upload-url] Unexpected error:', err);
    return errorResponse(
      req,
      500,
      'UPLOAD_URL_FAILED',
      'Unable to generate upload URL.'
    );
  }
});
