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
  R2ConfigError,
  R2ValidationError,
  assertOwnerKeyConfined,
  createR2Client,
  deleteR2Object,
  getR2Config,
  isValidR2ObjectKey,
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
    const caller = await requireVerifiedUser(req, adminClient);

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

    if (!caller.isAdmin) {
      if (
        !objectKey ||
        !objectKey.startsWith(`quick_drop/attachments/${caller.uid}/`)
      ) {
        throw new AuthError(
          403,
          'ADMIN_REQUIRED',
          'Only the approved platform administrator can perform this action.'
        );
      }
    }

    if (!objectKey && recordId) {
      const candidateTables =
        recordType === 'image'
          ? (['image_attachments'] as const)
          : recordType === 'file'
          ? (['file_attachments'] as const)
          : (['file_attachments', 'image_attachments'] as const);
      for (const table of candidateTables) {
        const { data: row } = await adminClient
          .from(table)
          .select('object_key, storage_path, bucket_name, storage_provider')
          .eq('owner_id', caller.uid)
          .eq('id', recordId)
          .maybeSingle();
        const candidateKey = String(row?.object_key || row?.storage_path || '');
        if (
          row &&
          (row.storage_provider === 'r2' || isValidR2ObjectKey(candidateKey))
        ) {
          objectKey = candidateKey;
          if (row.bucket_name) bucketName = String(row.bucket_name);
          break;
        }
      }
    }

    if (objectKey) {
      assertOwnerKeyConfined(objectKey, caller.uid);
      // 1. Delete object in Cloudflare R2 FIRST to keep DB & object store consistent
      await deleteR2Object(r2Client, bucketName, objectKey);
    }

    // 2. Delete metadata row in Supabase Postgres ONLY after R2 object deletion succeeds
    if (caller.isAdmin) {
      if (recordId) {
        if (recordType === 'image' || !recordType) {
          const { error: delImgErr } = await adminClient
            .from('image_attachments')
            .delete()
            .eq('owner_id', caller.uid)
            .eq('id', recordId);
          if (delImgErr) {
            return errorResponse(
              req,
              500,
              'METADATA_DELETE_FAILED',
              'R2 object deleted but failed removing image metadata row.'
            );
          }
        }
        if (recordType === 'file' || !recordType) {
          const { error: delFileErr } = await adminClient
            .from('file_attachments')
            .delete()
            .eq('owner_id', caller.uid)
            .eq('id', recordId);
          if (delFileErr) {
            return errorResponse(
              req,
              500,
              'METADATA_DELETE_FAILED',
              'R2 object deleted but failed removing file metadata row.'
            );
          }
        }
      } else if (objectKey) {
        const quotedKey = `"${objectKey.replace(/"/g, '')}"`;
        const { error: delFileErr } = await adminClient
          .from('file_attachments')
          .delete()
          .eq('owner_id', caller.uid)
          .or(`object_key.eq.${quotedKey},storage_path.eq.${quotedKey}`);
        if (delFileErr) {
          return errorResponse(
            req,
            500,
            'METADATA_DELETE_FAILED',
            'R2 object deleted but failed removing file metadata row.'
          );
        }
        const { error: delImgErr } = await adminClient
          .from('image_attachments')
          .delete()
          .eq('owner_id', caller.uid)
          .or(`object_key.eq.${quotedKey},storage_path.eq.${quotedKey}`);
        if (delImgErr) {
          return errorResponse(
            req,
            500,
            'METADATA_DELETE_FAILED',
            'R2 object deleted but failed removing image metadata row.'
          );
        }
      }
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
