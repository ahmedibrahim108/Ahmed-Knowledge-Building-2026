import {
  AuthError,
  authorizeReadAccess,
  checkRateLimit,
  createSupabaseAdminClient,
  getClientRateKey,
  verifyOptionalCaller,
} from '../_shared/auth.ts';
import {
  errorResponse,
  handleCorsPreflight,
  jsonResponse,
} from '../_shared/cors.ts';
import {
  R2ConfigError,
  R2ValidationError,
  createR2Client,
  getR2Config,
  isValidR2ObjectKey,
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
    const caller = await verifyOptionalCaller(req, adminClient);

    const rl = checkRateLimit(getClientRateKey(req, caller?.uid), 180, 60_000);
    if (!rl.allowed) {
      return errorResponse(
        req,
        429,
        'RATE_LIMITED',
        'Too many download URL requests. Please wait a moment.',
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

    const disposition =
      body.disposition === 'attachment' ? 'attachment' : 'inline';
    const expiresIn =
      typeof body.expiresIn === 'number'
        ? Math.min(900, Math.max(60, Math.round(body.expiresIn)))
        : 300;

    // Batch signing support for image galleries & lists
    if (Array.isArray(body.objectKeys)) {
      const requestedKeys = body.objectKeys
        .slice(0, 60)
        .filter((k): k is string => isValidR2ObjectKey(k));
      const results: Record<
        string,
        { downloadUrl: string; expiresIn: number; isPublicUrl: boolean }
      > = {};

      for (const objectKey of requestedKeys) {
        const authRes = await authorizeReadAccess(adminClient, caller, {
          objectKey,
          recordType: body.recordType === 'file' ? 'file' : body.recordType === 'image' ? 'image' : undefined,
        });
        if (!authRes.allowed) continue;

        const signed = await signGetUrl(r2Client, r2Cfg.bucketName, objectKey, {
          expiresIn,
          disposition,
          downloadFileName: authRes.fileName,
          contentType: authRes.mimeType,
          publicUrlBase: r2Cfg.publicUrl,
          isPublicAsset: authRes.isPublicAsset,
        });
        results[objectKey] = {
          downloadUrl: signed.url,
          expiresIn: signed.expiresIn,
          isPublicUrl: signed.isPublicUrl,
        };
      }

      return jsonResponse(req, {
        ok: true,
        urls: results,
      });
    }

    let objectKey = typeof body.objectKey === 'string' ? body.objectKey.trim() : '';
    const recordId =
      typeof body.recordId === 'string' ? body.recordId.trim() : undefined;
    const recordType =
      body.recordType === 'image'
        ? 'image'
        : body.recordType === 'file'
        ? 'file'
        : undefined;

    if (!objectKey && recordId) {
      const table =
        recordType === 'image' ? 'image_attachments' : 'file_attachments';
      const { data } = await adminClient
        .from(table)
        .select('object_key, storage_path, storage_provider')
        .eq('id', recordId)
        .maybeSingle();
      if (data?.storage_provider === 'r2') {
        objectKey = String(data.object_key || data.storage_path || '');
      }
    }

    if (!isValidR2ObjectKey(objectKey)) {
      return errorResponse(
        req,
        400,
        'INVALID_OBJECT_KEY',
        'Valid R2 objectKey is required.'
      );
    }

    const authRes = await authorizeReadAccess(adminClient, caller, {
      objectKey,
      recordId,
      recordType,
    });

    if (!authRes.allowed) {
      return errorResponse(
        req,
        403,
        'ACCESS_DENIED',
        'You do not have permission to access this file.'
      );
    }

    const downloadFileName =
      typeof body.downloadFileName === 'string' && body.downloadFileName.trim()
        ? body.downloadFileName.trim().slice(0, 240)
        : authRes.fileName;

    const signed = await signGetUrl(r2Client, r2Cfg.bucketName, objectKey, {
      expiresIn,
      disposition,
      downloadFileName,
      contentType: authRes.mimeType,
      publicUrlBase: r2Cfg.publicUrl,
      isPublicAsset: authRes.isPublicAsset,
    });

    return jsonResponse(req, {
      ok: true,
      objectKey,
      downloadUrl: signed.url,
      expiresIn: signed.expiresIn,
      isPublicUrl: signed.isPublicUrl,
      fileName: downloadFileName,
      mimeType: authRes.mimeType,
    });
  } catch (err) {
    if (err instanceof R2ConfigError) {
      return errorResponse(req, 503, err.code, err.message);
    }
    if (err instanceof R2ValidationError || err instanceof AuthError) {
      return errorResponse(req, err.status, err.code, err.message);
    }
    console.error('[generate-download-url] Unexpected error:', err);
    return errorResponse(
      req,
      500,
      'DOWNLOAD_URL_FAILED',
      'Unable to generate download URL.'
    );
  }
});
