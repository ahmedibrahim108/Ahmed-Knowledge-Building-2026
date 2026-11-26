import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.1';
import { decodeProtectedHeader, importX509, jwtVerify } from 'npm:jose@5.9.6';
import { extractOwnerUidFromObjectKey } from './r2.ts';

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const OWNER_ADMIN_EMAIL = 'farrag34567@gmail.com';

interface CertCache {
  certs: Record<string, string>;
  expiresAtMs: number;
}

let cachedGoogleCerts: CertCache | null = null;

// Best-effort sliding-window rate limiter per Edge Function isolate
const rateBuckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests = 90,
  windowMs = 60_000
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (rateBuckets.get(key) || []).filter((ts) => ts > cutoff);
  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateBuckets.set(key, timestamps);
    return { allowed: false, retryAfterSec };
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  if (rateBuckets.size > 2000) {
    // Periodic eviction to prevent unbounded memory growth
    for (const [k, list] of rateBuckets.entries()) {
      if (list.length === 0 || (list[list.length - 1] ?? 0) < cutoff) {
        rateBuckets.delete(k);
      }
    }
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function getClientRateKey(req: Request, uid?: string): string {
  if (uid) return `uid:${uid}`;
  const fwd = req.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0]?.trim() || 'anon';
  return `ip:${ip}`;
}

export class AuthError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

export interface VerifiedCaller {
  uid: string;
  email: string;
  emailVerified: boolean;
  role: 'admin' | 'user';
  approvalStatus: string;
  isAdmin: boolean;
}

export function createSupabaseAdminClient(): SupabaseClient {
  const url = (Deno.env.get('SUPABASE_URL') || '').trim();
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!url || !serviceKey) {
    throw new AuthError(
      500,
      'SUPABASE_ADMIN_UNCONFIGURED',
      'Supabase server credentials are not configured.'
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedGoogleCerts && cachedGoogleCerts.expiresAtMs > now) {
    return cachedGoogleCerts.certs;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    if (cachedGoogleCerts) return cachedGoogleCerts.certs;
    throw new AuthError(
      503,
      'AUTH_CERTS_UNAVAILABLE',
      'Unable to fetch Firebase verification certificates.'
    );
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) : 3600;
  const certs = (await res.json()) as Record<string, string>;

  cachedGoogleCerts = {
    certs,
    expiresAtMs: now + maxAgeSec * 1000,
  };
  return certs;
}

function getFirebaseProjectId(): string {
  return (
    (Deno.env.get('FIREBASE_PROJECT_ID') || '').trim() || 'knowledge-balance'
  );
}

export async function verifyOptionalCaller(
  req: Request,
  adminClient: SupabaseClient
): Promise<VerifiedCaller | null> {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.split('.').length !== 3) {
    throw new AuthError(401, 'INVALID_TOKEN', 'Malformed bearer token.');
  }

  const projectId = getFirebaseProjectId();
  let kid: string | undefined;
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
      throw new Error('Invalid JWT header');
    }
    kid = header.kid;
  } catch {
    throw new AuthError(401, 'INVALID_TOKEN', 'Invalid JWT protected header.');
  }

  let certs = await fetchGooglePublicCerts(false);
  if (!certs[kid]) {
    certs = await fetchGooglePublicCerts(true);
  }
  const pem = certs[kid];
  if (!pem) {
    throw new AuthError(401, 'UNKNOWN_KEY_ID', 'Unknown Firebase signing key.');
  }

  let payload: Record<string, unknown>;
  try {
    const publicKey = await importX509(pem, 'RS256');
    const verified = await jwtVerify(token, publicKey, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    payload = verified.payload as Record<string, unknown>;
  } catch {
    throw new AuthError(
      401,
      'TOKEN_VERIFICATION_FAILED',
      'Firebase ID token is invalid or expired.'
    );
  }

  const uid = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!uid) {
    throw new AuthError(401, 'MISSING_SUBJECT', 'Firebase token missing subject.');
  }

  const email =
    typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const emailVerified =
    payload.email_verified === true || payload.email_verified === 'true';

  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('role, approval_status, email')
    .eq('uid', uid)
    .maybeSingle();

  const profileRole = profile?.role === 'admin' ? 'admin' : 'user';
  const approvalStatus = String(profile?.approval_status || 'pending');
  const isOwnerEmail =
    emailVerified && email === OWNER_ADMIN_EMAIL.toLowerCase();
  const isAdmin =
    (profileRole === 'admin' && approvalStatus === 'approved') || isOwnerEmail;

  return {
    uid,
    email,
    emailVerified,
    role: isAdmin ? 'admin' : profileRole,
    approvalStatus: isAdmin ? 'approved' : approvalStatus,
    isAdmin,
  };
}

export async function requireVerifiedUser(
  req: Request,
  adminClient: SupabaseClient
): Promise<VerifiedCaller> {
  const caller = await verifyOptionalCaller(req, adminClient);
  if (!caller) {
    throw new AuthError(
      401,
      'AUTH_REQUIRED',
      'Authentication is required for this operation.'
    );
  }
  return caller;
}

export async function requireVerifiedAdmin(
  req: Request,
  adminClient: SupabaseClient
): Promise<VerifiedCaller> {
  const caller = await requireVerifiedUser(req, adminClient);
  if (!caller.isAdmin) {
    throw new AuthError(
      403,
      'ADMIN_REQUIRED',
      'Only the approved platform administrator can perform this action.'
    );
  }
  return caller;
}

function jsonArrayIncludesString(arr: unknown, target: string): boolean {
  if (!Array.isArray(arr) || !target) return false;
  return arr.some((item) => String(item) === target);
}

interface GrantRow {
  owner_id: string;
  grantee_uid: string;
  grantee_email: string;
  course_doc_ids?: unknown;
  include_course_notes?: boolean;
  note_ids?: unknown;
  book_ids?: unknown;
  reflection_ids?: unknown;
  reflection_categories?: unknown;
}

async function fetchCallerGrants(
  adminClient: SupabaseClient,
  caller: VerifiedCaller | null,
  ownerId: string
): Promise<GrantRow[]> {
  if (!caller || !ownerId) return [];
  const { data } = await adminClient
    .from('content_access_grants')
    .select(
      'owner_id, grantee_uid, grantee_email, course_doc_ids, include_course_notes, note_ids, book_ids, reflection_ids, reflection_categories'
    )
    .eq('owner_id', ownerId);

  const rows = (data || []) as GrantRow[];
  return rows.filter((g) => {
    if (g.grantee_uid && g.grantee_uid === caller.uid) return true;
    if (
      caller.emailVerified &&
      caller.email &&
      g.grantee_email &&
      g.grantee_email.trim().toLowerCase() === caller.email
    ) {
      return true;
    }
    return false;
  });
}

function resourcesContainKey(resources: unknown, objectKey: string): boolean {
  if (!Array.isArray(resources)) return false;
  return resources.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const rec = entry as Record<string, unknown>;
    return rec.storagePath === objectKey || rec.objectKey === objectKey;
  });
}

export interface ReadAuthorizationResult {
  allowed: boolean;
  isPublicAsset: boolean;
  ownerId: string;
  fileName?: string;
  mimeType?: string;
}

export async function authorizeReadAccess(
  adminClient: SupabaseClient,
  caller: VerifiedCaller | null,
  target: {
    objectKey: string;
    recordId?: string;
    recordType?: 'file' | 'image';
  }
): Promise<ReadAuthorizationResult> {
  const { objectKey, recordId, recordType } = target;
  const keyOwner = extractOwnerUidFromObjectKey(objectKey);

  // Lookup normalized metadata record (if present) for filename, mime, and verified owner_id
  let metaOwner = '';
  let fileName: string | undefined;
  let mimeType: string | undefined;
  let uploadStatus: string | undefined;

  if (recordType !== 'image') {
    let q = adminClient
      .from('file_attachments')
      .select('owner_id, file_name, original_name, mime_type, upload_status, object_key')
      .eq('object_key', objectKey);
    if (recordId) {
      q = adminClient
        .from('file_attachments')
        .select('owner_id, file_name, original_name, mime_type, upload_status, object_key')
        .eq('id', recordId)
        .eq('object_key', objectKey);
    }
    const { data: fileRow } = await q.maybeSingle();
    if (fileRow) {
      metaOwner = String(fileRow.owner_id || '');
      fileName = String(fileRow.original_name || fileRow.file_name || '');
      mimeType = String(fileRow.mime_type || '');
      uploadStatus = String(fileRow.upload_status || 'completed');
    }
  }

  if (!metaOwner && recordType !== 'file') {
    let q = adminClient
      .from('image_attachments')
      .select('owner_id, file_name, original_name, mime_type, upload_status, object_key')
      .eq('object_key', objectKey);
    if (recordId) {
      q = adminClient
        .from('image_attachments')
        .select('owner_id, file_name, original_name, mime_type, upload_status, object_key')
        .eq('id', recordId)
        .eq('object_key', objectKey);
    }
    const { data: imgRow } = await q.maybeSingle();
    if (imgRow) {
      metaOwner = String(imgRow.owner_id || '');
      fileName = String(imgRow.original_name || imgRow.file_name || '');
      mimeType = String(imgRow.mime_type || '');
      uploadStatus = String(imgRow.upload_status || 'completed');
    }
  }

  const ownerId = metaOwner || keyOwner || '';
  if (!ownerId || (keyOwner && metaOwner && keyOwner !== metaOwner)) {
    return { allowed: false, isPublicAsset: false, ownerId: '' };
  }

  if (uploadStatus === 'pending' || uploadStatus === 'failed') {
    // Only owner admin may inspect an unconfirmed object
    if (!caller?.isAdmin || caller.uid !== ownerId) {
      return { allowed: false, isPublicAsset: false, ownerId };
    }
  }

  // 1) Owner Admin always has full read access to their own objects
  if (caller?.isAdmin && caller.uid === ownerId) {
    return {
      allowed: true,
      isPublicAsset: false,
      ownerId,
      fileName,
      mimeType,
    };
  }

  // 1b) Verified non-admin users have read access to their own Quick Drop attachments
  if (
    caller &&
    caller.uid === ownerId &&
    objectKey.startsWith('quick_drop/attachments/')
  ) {
    return {
      allowed: true,
      isPublicAsset: false,
      ownerId,
      fileName,
      mimeType,
    };
  }

  // 2) Check public or grant-authorized entities referencing this objectKey
  const grants = await fetchCallerGrants(adminClient, caller, ownerId);

  // 2a. Reading library books & covers
  const quotedKey = `"${objectKey.replace(/"/g, '')}"`;
  const { data: readingRows } = await adminClient
    .from('reading_items')
    .select('id, is_public, storage_path, cover_storage_path')
    .eq('owner_id', ownerId)
    .or(`storage_path.eq.${quotedKey},cover_storage_path.eq.${quotedKey}`);

  for (const book of readingRows || []) {
    if (book.is_public === true) {
      return { allowed: true, isPublicAsset: true, ownerId, fileName, mimeType };
    }
    if (grants.some((g) => jsonArrayIncludesString(g.book_ids, String(book.id)))) {
      return { allowed: true, isPublicAsset: false, ownerId, fileName, mimeType };
    }
  }

  // 2b. Reflections & reflection cover images
  const { data: reflectionRows } = await adminClient
    .from('reflections')
    .select('id, is_public, category_tag, image_storage_path')
    .eq('owner_id', ownerId)
    .eq('image_storage_path', objectKey);

  for (const refl of reflectionRows || []) {
    if (refl.is_public === true) {
      return { allowed: true, isPublicAsset: true, ownerId, fileName, mimeType };
    }
    const allowedByGrant = grants.some(
      (g) =>
        jsonArrayIncludesString(g.reflection_ids, String(refl.id)) ||
        (refl.category_tag &&
          jsonArrayIncludesString(g.reflection_categories, String(refl.category_tag)))
    );
    if (allowedByGrant) {
      return { allowed: true, isPublicAsset: false, ownerId, fileName, mimeType };
    }
  }

  // 2c. Public blog cover images
  const { data: blogRows } = await adminClient
    .from('blog_posts')
    .select('id, is_public, cover_storage_path')
    .eq('owner_id', ownerId)
    .eq('cover_storage_path', objectKey);

  if ((blogRows || []).some((b) => b.is_public === true)) {
    return { allowed: true, isPublicAsset: true, ownerId, fileName, mimeType };
  }

  // 2d. Courses & course attachments (public or granted course_doc_ids)
  const { data: courseRows } = await adminClient
    .from('courses')
    .select('doc_id, course_number, is_public, resources')
    .eq('owner_id', ownerId);

  const matchedCourse = (courseRows || []).find((c) =>
    resourcesContainKey(c.resources, objectKey)
  );
  if (matchedCourse) {
    if (matchedCourse.is_public === true) {
      return { allowed: true, isPublicAsset: true, ownerId, fileName, mimeType };
    }
    if (
      grants.some((g) =>
        jsonArrayIncludesString(g.course_doc_ids, String(matchedCourse.doc_id))
      )
    ) {
      return { allowed: true, isPublicAsset: false, ownerId, fileName, mimeType };
    }
  }

  // 2e. Book / Lecture note attachments (granted note_ids or granted parent course notes)
  if (grants.length > 0) {
    const { data: noteRows } = await adminClient
      .from('book_notes')
      .select('id, course_id, resources')
      .eq('owner_id', ownerId);

    const matchedNote = (noteRows || []).find((n) =>
      resourcesContainKey(n.resources, objectKey)
    );
    if (matchedNote) {
      const grantedCourseNumbers = new Set<number>();
      for (const g of grants) {
        if (g.include_course_notes !== false && Array.isArray(g.course_doc_ids)) {
          for (const c of courseRows || []) {
            if (jsonArrayIncludesString(g.course_doc_ids, String(c.doc_id))) {
              grantedCourseNumbers.add(Number(c.course_number));
            }
          }
        }
      }
      const allowedByNoteGrant =
        grants.some((g) =>
          jsonArrayIncludesString(g.note_ids, String(matchedNote.id))
        ) || grantedCourseNumbers.has(Number(matchedNote.course_id));
      if (allowedByNoteGrant) {
        return { allowed: true, isPublicAsset: false, ownerId, fileName, mimeType };
      }
    }
  }

  return { allowed: false, isPublicAsset: false, ownerId };
}
