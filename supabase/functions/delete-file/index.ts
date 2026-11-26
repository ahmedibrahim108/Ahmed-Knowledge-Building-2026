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
  R2ConfigError,
  R2ValidationError,
  assertOwnerKeyConfined,
  createR2Client,
  deleteR2Object,
  getR2Config,
  sanitizeRecordId,
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
        'Too many delete requests. Please try again shortly.',
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

    const recordId =
      typeof body.recordId === 'string' && body.recordId.trim()
        ? sanitizeRecordId(body.recordId)
        : undefined;
    const recordType =
      body.recordType === 'image'
        ? 'image'
        : body.recordType === 'file'
        ? 'file'
        : undefined;

    let objectKey = typeof body.objectKey === 'string' ? body.objectKey.trim() : '';
    let bucketName = r2Cfg.bucketName;

    if (!objectKey && recordId) {
      const table =
        recordType === 'image' ? 'image_attachments' : 'file_attachments';
      const { data: row } = await adminClient
        .from(table)
        .select('object_key, storage_path, bucket_name, storage_provider')
        .eq('owner_id', caller.uid)
        .eq('id', recordId)
        .maybeSingle();
      if (row?.storage_provider === 'r2') {
        objectKey = String(row.object_key || row.storage_path || '');
        if (row.bucket_name) bucketName = String(row.bucket_name);
      }
    }

    if (objectKey) {
      assertOwnerKeyConfined(objectKey, caller.uid);
      // 1. Delete object in Cloudflare R2 FIRST to keep DB & object store consistent
      await deleteR2Object(r2Client, bucketName, objectKey);
    }

    // 2. Delete metadata row in Supabase Postgres ONLY after R2 object deletion succeeds
    if (recordId) {
      if (recordType === 'image' || !recordType) {
        await adminClient
          .from('image_attachments')
          .delete()
          .eq('owner_id', caller.uid)
          .eq('id', recordId);
      }
      if (recordType === 'file' || !recordType) {
        await adminClient
          .from('file_attachments')
          .delete()
          .eq('owner_id', caller.uid)
          .eq('id', recordId);
      }
    } else if (objectKey) {
      await adminClient
        .from('file_attachments')
        .delete()
        .eq('owner_id', caller.uid)
        .eq('object_key', objectKey);
      await adminClient
        .from('image_attachments')
        .delete()
        .eq('owner_id', caller.uid)
        .eq('object_key', objectKey);
    }

    return jsonResponse(req, {
      ok: true,
      deleted: true,
      objectKey: objectKey || null,
      recordId: recordId || null,
    });
  } catch (err) {
    if (err instanceof R2ConfigError) {
      return errorResponse(req, 503, err.code, err.message);
    }
    if (err instanceof R2ValidationError || err instanceof AuthError) {
      return errorResponse(req, err.status, err.code, err.message);
    }
    console.error('[delete-file] Unexpected error:', err);
    return errorResponse(
      req,
      500,
      'DELETE_FILE_FAILED',
      'Unable to delete file from storage.'
    );
  }
});
