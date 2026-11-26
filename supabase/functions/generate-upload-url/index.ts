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

interface R2ClientErrorDetails {
  code: string;
  message: string;
  r2ErrorName: string;
  r2StatusCode?: number;
}

class R2ClientOperationError extends Error {
  readonly code: string;
  readonly r2ErrorName: string;
  readonly r2StatusCode?: number;
  readonly operation: string;

  constructor(operation: string, details: R2ClientErrorDetails) {
    super(details.message);
    this.name = 'R2ClientOperationError';
    this.operation = operation;
    this.code = details.code;
    this.r2ErrorName = details.r2ErrorName;
    this.r2StatusCode = details.r2StatusCode;
  }
}

function describeR2ClientFailure(
  operation: string,
  err: unknown
): R2ClientErrorDetails {
  const errObj =
    err && typeof err === 'object'
      ? (err as {
          name?: unknown;
          Code?: unknown;
          code?: unknown;
          message?: unknown;
          $metadata?: { httpStatusCode?: unknown };
        })
      : null;

  const r2ErrorName =
    typeof errObj?.name === 'string' && errObj.name.trim()
      ? errObj.name.trim()
      : 'R2ClientError';
  const rawCode =
    typeof errObj?.Code === 'string' && errObj.Code.trim()
      ? errObj.Code.trim()
      : typeof errObj?.code === 'string' && errObj.code.trim()
      ? errObj.code.trim()
      : '';
  const r2StatusCode =
    typeof errObj?.$metadata?.httpStatusCode === 'number'
      ? errObj.$metadata.httpStatusCode
      : undefined;
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof errObj?.message === 'string'
      ? errObj.message
      : String(err || 'Unknown R2 client failure');
  const safeReason = rawMessage.replace(/\s+/g, ' ').trim().slice(0, 220);
  const lower = `${r2ErrorName} ${rawCode} ${safeReason}`.toLowerCase();

  if (lower.includes('nosuchbucket') || r2StatusCode === 404) {
    return {
      code: 'R2_BUCKET_NOT_FOUND',
      message: `Cloudflare R2 bucket was not found during ${operation}. Verify R2_BUCKET_NAME.`,
      r2ErrorName,
      r2StatusCode,
    };
  }

  if (
    lower.includes('invalidaccesskeyid') ||
    lower.includes('signaturedoesnotmatch') ||
    lower.includes('accessdenied') ||
    r2StatusCode === 401 ||
    r2StatusCode === 403
  ) {
    return {
      code: 'R2_AUTH_FAILED',
      message: `Cloudflare R2 authentication or permissions failed during ${operation}. Verify R2 API credentials and bucket permissions.`,
      r2ErrorName,
      r2StatusCode,
    };
  }

  if (
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('dns') ||
    lower.includes('network')
  ) {
    return {
      code: 'R2_ENDPOINT_UNREACHABLE',
      message: `Unable to reach Cloudflare R2 endpoint during ${operation}. Verify R2_ENDPOINT and CLOUDFLARE_ACCOUNT_ID.`,
      r2ErrorName,
      r2StatusCode,
    };
  }

  return {
    code: 'R2_CLIENT_ERROR',
    message: `Cloudflare R2 client failed during ${operation}: ${safeReason || r2ErrorName}`,
    r2ErrorName,
    r2StatusCode,
  };
}

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
        'Too many upload requests. Please try again shortly.',
        { retryAfterSec: rl.retryAfterSec }
      );
    }

    const r2Cfg = getR2Config();
    let r2Client: ReturnType<typeof createR2Client>;
    try {
      r2Client = createR2Client(r2Cfg);
    } catch (clientErr) {
      throw new R2ClientOperationError(
        'createR2Client',
        describeR2ClientFailure('client initialization', clientErr)
      );
    }

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
      if (
        !caller.isAdmin &&
        !objectKey.startsWith(`quick_drop/attachments/${caller.uid}/`)
      ) {
        throw new AuthError(
          403,
          'ADMIN_REQUIRED',
          'Only the approved platform administrator can perform this action.'
        );
      }
      const uploadId =
        typeof body.uploadId === 'string' ? body.uploadId.trim() : '';
      if (!uploadId) {
        return errorResponse(req, 400, 'MISSING_UPLOAD_ID', 'uploadId is required.');
      }
      try {
        await abortMultipartSession(r2Client, r2Cfg.bucketName, objectKey, uploadId);
      } catch (r2Err) {
        if (r2Err instanceof R2ValidationError || r2Err instanceof R2ConfigError) {
          throw r2Err;
        }
        throw new R2ClientOperationError(
          'abortMultipartSession',
          describeR2ClientFailure('multipart abort', r2Err)
        );
      }
      const recordId =
        typeof body.recordId === 'string' ? sanitizeRecordId(body.recordId) : '';
      const recordType = !caller.isAdmin
        ? 'none'
        : body.recordType === 'image'
        ? 'image'
        : body.recordType === 'file'
        ? 'file'
        : 'none';
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
    if (!caller.isAdmin && module !== 'quick_drop') {
      throw new AuthError(
        403,
        'ADMIN_REQUIRED',
        'Only the approved platform administrator can perform this action.'
      );
    }

    const { originalName, safeAsciiName } = sanitizeOriginalFileName(body.fileName);
    const mimeType = normalizeAndValidateMime(module, body.mimeType, originalName);
    const fileSize = validateFileSize(module, body.fileSize);

    const recordId = sanitizeRecordId(body.recordId);
    const recordType =
      !caller.isAdmin
        ? 'none'
        : body.recordType === 'image'
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

    const markMetadataFailed = async () => {
      if (recordType === 'none') return;
      const tbl = recordType === 'image' ? 'image_attachments' : 'file_attachments';
      await adminClient
        .from(tbl)
        .update({ upload_status: 'failed' })
        .eq('owner_id', caller.uid)
        .eq('id', recordId);
    };

    if (useMultipart) {
      const multipartCommandParams = {
        Bucket: r2Cfg.bucketName,
        Key: objectKey,
        ContentType: mimeType,
      };
      const contentTypeAssigned =
        typeof multipartCommandParams.ContentType === 'string' &&
        multipartCommandParams.ContentType.trim().length > 0;

      console.log(
        '[generate-upload-url] S3 CreateMultipartUploadCommand presign params:',
        {
          mode: 'multipart',
          module,
          Bucket: multipartCommandParams.Bucket,
          Key: multipartCommandParams.Key,
          ContentType: multipartCommandParams.ContentType,
          contentTypeAssigned,
          fileSize,
          expiresIn: 3600,
        }
      );

      if (!contentTypeAssigned) {
        await markMetadataFailed();
        return errorResponse(
          req,
          400,
          'MISSING_CONTENT_TYPE',
          'A valid Content-Type header must be assigned before generating multipart upload URLs.'
        );
      }

      let mp: Awaited<ReturnType<typeof createMultipartSession>>;
      try {
        mp = await createMultipartSession(
          r2Client,
          r2Cfg.bucketName,
          objectKey,
          mimeType,
          fileSize,
          3600
        );
      } catch (r2Err) {
        await markMetadataFailed();
        if (r2Err instanceof R2ValidationError || r2Err instanceof R2ConfigError) {
          throw r2Err;
        }
        throw new R2ClientOperationError(
          'createMultipartSession',
          describeR2ClientFailure('multipart upload URL generation', r2Err)
        );
      }

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
        expiresIn: 3600,
      });
    }

    const putCommandParams = {
      Bucket: r2Cfg.bucketName,
      Key: objectKey,
      ContentType: mimeType,
    };
    const contentTypeAssigned =
      typeof putCommandParams.ContentType === 'string' &&
      putCommandParams.ContentType.trim().length > 0;

    console.log('[generate-upload-url] S3 PutObjectCommand presign params:', {
      mode: 'single',
      module,
      Bucket: putCommandParams.Bucket,
      Key: putCommandParams.Key,
      ContentType: putCommandParams.ContentType,
      contentTypeAssigned,
      requiredContentTypeHeader: mimeType,
      fileSize,
      expiresIn: 1800,
    });

    if (!contentTypeAssigned) {
      await markMetadataFailed();
      return errorResponse(
        req,
        400,
        'MISSING_CONTENT_TYPE',
        'A valid Content-Type header must be assigned for PutObjectCommand presigning.'
      );
    }

    let uploadUrl: string;
    try {
      uploadUrl = await signSinglePutUrl(
        r2Client,
        r2Cfg.bucketName,
        objectKey,
        mimeType,
        1800
      );
    } catch (r2Err) {
      await markMetadataFailed();
      if (r2Err instanceof R2ValidationError || r2Err instanceof R2ConfigError) {
        throw r2Err;
      }
      throw new R2ClientOperationError(
        'signSinglePutUrl',
        describeR2ClientFailure('presigned PUT URL generation', r2Err)
      );
    }

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
      expiresIn: 1800,
    });
  } catch (err) {
    if (err instanceof R2ConfigError) {
      return errorResponse(req, 503, err.code, err.message);
    }
    if (err instanceof R2ClientOperationError) {
      console.error('[generate-upload-url] R2 client failure:', {
        operation: err.operation,
        code: err.code,
        r2ErrorName: err.r2ErrorName,
        r2StatusCode: err.r2StatusCode,
        message: err.message,
      });
      return errorResponse(req, 502, err.code, err.message, {
        operation: err.operation,
        r2ErrorName: err.r2ErrorName,
        ...(err.r2StatusCode !== undefined
          ? { r2StatusCode: err.r2StatusCode }
          : {}),
      });
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
