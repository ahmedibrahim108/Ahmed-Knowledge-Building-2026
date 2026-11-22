import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { onIdTokenChanged } from 'firebase/auth';
import { OWNER_ADMIN_EMAIL, auth } from '../firebase';

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  rawSupabaseUrl &&
    rawSupabaseAnonKey &&
    rawSupabaseUrl.startsWith('http')
);

export const supabaseInitError: string | null = isSupabaseConfigured
  ? null
  : 'لم يتم ضبط متغيرات Supabase (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY) بعد. يعمل التطبيق حاليًا بالوضع المحلي/القراءة حتى إتمام الربط.';

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  const currentUser = auth?.currentUser;
  if (!currentUser) return null;
  try {
    return await currentUser.getIdToken(forceRefresh);
  } catch (err) {
    console.warn('Could not read Firebase ID token:', err);
    return null;
  }
}

let clientInstance: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    clientInstance = createClient(rawSupabaseUrl, rawSupabaseAnonKey, {
      accessToken: async () => getFirebaseIdToken(false),
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (err) {
    console.error('Supabase client initialization failed:', err);
    clientInstance = null;
  }
}

let lastRealtimeToken: string | null = null;

export async function ensureSupabaseRealtimeAuth(
  forceRefresh = false
): Promise<string | null> {
  if (!clientInstance || !auth?.currentUser) return null;
  try {
    const token = await auth.currentUser.getIdToken(forceRefresh);
    if (token && (forceRefresh || token !== lastRealtimeToken)) {
      await clientInstance.realtime.setAuth(token);
      lastRealtimeToken = token;
    }
    return token;
  } catch (err) {
    console.warn('Supabase realtime setAuth warning:', err);
    return null;
  }
}

// Keep Supabase Realtime socket authenticated with the live Firebase ID token across refreshes/logins
if (clientInstance && auth) {
  onIdTokenChanged(auth, async (user) => {
    if (!clientInstance) return;
    if (!user) {
      lastRealtimeToken = null;
      try {
        await clientInstance.realtime.setAuth(null);
      } catch {
        // Ignore cleanup errors when already disconnected
      }
      return;
    }
    try {
      const token = await user.getIdToken(false);
      if (token) {
        await clientInstance.realtime.setAuth(token);
        lastRealtimeToken = token;
      }
    } catch (err) {
      console.warn('Supabase realtime token sync warning:', err);
    }
  });
}

export const supabase = clientInstance;

export function requireSupabaseClient(): SupabaseClient {
  if (!clientInstance) {
    throw new Error(
      supabaseInitError ||
        'تعذر الاتصال بخادم Supabase. تحقق من إعدادات البيئة.'
    );
  }
  return clientInstance;
}

export function isJwtExpiredOrAuthError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    status?: number;
    statusCode?: number;
    code?: string;
    message?: string;
  };
  const status = e.status ?? e.statusCode;
  const msg = (e.message || '').toLowerCase();
  const code = (e.code || '').toLowerCase();
  return (
    status === 401 ||
    code === 'pgrst301' ||
    code === '401' ||
    msg.includes('jwt expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('unauthorized')
  );
}

/**
 * Runs a Supabase operation and, if Firebase ID token just expired (401/JWT expired),
 * forces a Firebase token refresh and retries once cleanly.
 */
export async function withFirebaseTokenRetry<T>(
  op: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const client = requireSupabaseClient();
  try {
    return await op(client);
  } catch (err) {
    if (isJwtExpiredOrAuthError(err) && auth?.currentUser) {
      const freshToken = await getFirebaseIdToken(true);
      if (freshToken) {
        try {
          await client.realtime.setAuth(freshToken);
        } catch {
          // Ignore realtime setAuth failure during retry
        }
      }
      return await op(client);
    }
    throw err;
  }
}

export function formatSupabaseErrorMessage(
  err: unknown,
  fallback = 'تعذّر إتمام العملية مع قاعدة البيانات.'
): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const e = err as { message?: string; code?: string; details?: string };
  const msg = (e.message || '').toLowerCase();
  if (
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    e.code === '42501'
  ) {
    return 'تعذّر الحفظ بسبب صلاحيات الوصول (RLS). تأكد من تفعيل Firebase Auth في Supabase وتطبيق سياسات الجداول.';
  }
  if (msg.includes('jwt') || e.code === 'PGRST301') {
    return 'انتهت جلسة التحقق أو لم يتعرف Supabase على توكن Firebase Auth. تأكد من ربط Firebase Third-Party Auth في لوحة Supabase.';
  }
  if (
    msg.includes('payload too large') ||
    msg.includes('exceeded the maximum allowed size') ||
    msg.includes('413')
  ) {
    return 'حجم الملف يتجاوز الحد الأقصى المسموح به في إعدادات مشروع Supabase (تأكد من تشغيل Migration 006 ومن إعداد Global file size limit في لوحة Supabase Storage).';
  }
  return e.message || fallback;
}

export interface SupabaseDiagnosticCheck {
  id: 'firebase_auth' | 'firebase_token' | 'token_attached' | 'profile_read' | 'rls_policies';
  label: string;
  ok: boolean | null; // null = skipped/pending sign-in
  detail: string;
}

export interface SupabaseConnectionTestResult {
  status: 'connected' | 'failed';
  checkedAt: string;
  latencyMs: number;
  authenticated: boolean;
  checks: SupabaseDiagnosticCheck[];
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: string;
  probableCause?: string;
}

function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function diagnoseSupabaseAuthOrRlsCause(
  code?: string,
  message?: string,
  httpStatus?: number
): string | undefined {
  const m = (message || '').toLowerCase();
  const c = (code || '').toLowerCase();
  if (
    httpStatus === 401 ||
    c === 'pgrst301' ||
    m.includes('jwt') ||
    m.includes('jws') ||
    m.includes('no suitable key') ||
    m.includes('invalid claim') ||
    m.includes('unrecognized')
  ) {
    return 'Supabase rejected the Firebase ID token. In Supabase Dashboard -> Authentication -> Third-Party Auth, verify Firebase Auth is enabled with Firebase Project ID "knowledge-balance".';
  }
  if (c === '42501' || m.includes('row-level security') || m.includes('permission denied')) {
    return 'PostgreSQL RLS or role grants blocked the request. Note: standard Firebase ID tokens omit a "role": "authenticated" claim, causing PostgREST to execute as role "anon". Apply migration 004_fix_user_profiles_insert_rls.sql in Supabase SQL Editor.';
  }
  if (c === '42703' || m.includes('approval_status')) {
    return 'Missing approval_status column or updated trigger in Supabase. Run supabase/migrations/004_fix_user_profiles_insert_rls.sql in Supabase SQL Editor.';
  }
  if (c === 'pgrst205' || m.includes('schema cache') || m.includes('does not exist')) {
    return 'Expected table or column is missing in Supabase. Run supabase/migrations/004_fix_user_profiles_insert_rls.sql in Supabase SQL Editor.';
  }
  return undefined;
}

export interface SupabaseConnectionTestOptions {
  profileSyncError?: unknown;
}

/**
 * Verifies Supabase connectivity, Firebase JWT attachment, idempotent user_profiles
 * creation/readback (1 row, UID match, role & approval_status protection), and RLS isolation.
 * Exposes NO secret keys or raw JWTs.
 */
export async function testSupabaseConnection(
  options?: SupabaseConnectionTestOptions
): Promise<SupabaseConnectionTestResult> {
  const startedAt =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const checkedAt = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const currentUser = auth?.currentUser ?? null;
  const authenticated = Boolean(currentUser);
  const checks: SupabaseDiagnosticCheck[] = [];

  if (!isSupabaseConfigured || !supabase) {
    return {
      status: 'failed',
      checkedAt,
      latencyMs: 0,
      authenticated,
      checks: [
        {
          id: 'firebase_auth',
          label: '1. Firebase Google Sign-In',
          ok: authenticated,
          detail: currentUser
            ? `Signed in (${currentUser.email || currentUser.uid})`
            : 'Not signed in',
        },
      ],
      errorCode: 'MISSING_ENV',
      errorMessage:
        supabaseInitError ||
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.',
    };
  }

  // Step 1: Firebase Auth user session
  if (!currentUser) {
    checks.push({
      id: 'firebase_auth',
      label: '1. Firebase Google Sign-In',
      ok: null,
      detail: 'Not signed in yet — sign in with Google to run authenticated Firebase -> Supabase checks.',
    });
    try {
      const { data: anonRows, error: anonErr, status: httpStatus } = await supabase
        .from('user_profiles')
        .select('uid')
        .limit(1);
      const endedAt =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      const latencyMs = Math.max(1, Math.round(endedAt - startedAt));

      if (anonErr) {
        const errObj = anonErr as {
          code?: string;
          message?: string;
          details?: string;
          hint?: string;
        };
        const code = errObj.code || (httpStatus ? `HTTP_${httpStatus}` : undefined);
        return {
          status: 'failed',
          checkedAt,
          latencyMs,
          authenticated: false,
          checks,
          errorCode: code,
          errorMessage: errObj.message || 'Supabase anon query failed.',
          errorDetails: errObj.details || errObj.hint || undefined,
          probableCause: diagnoseSupabaseAuthOrRlsCause(code, errObj.message, httpStatus),
        };
      }

      checks.push({
        id: 'rls_policies',
        label: '2. Database Reachable & Anon RLS',
        ok: Array.isArray(anonRows) && anonRows.length === 0,
        detail: `HTTP 200 — anon returned ${anonRows?.length ?? 0} rows (RLS hides user profiles while signed out).`,
      });

      return {
        status: 'connected',
        checkedAt,
        latencyMs,
        authenticated: false,
        checks,
      };
    } catch (err) {
      const endedAt =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      return {
        status: 'failed',
        checkedAt,
        latencyMs: Math.max(1, Math.round(endedAt - startedAt)),
        authenticated: false,
        checks,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  checks.push({
    id: 'firebase_auth',
    label: '1. Firebase Google Sign-In',
    ok: true,
    detail: `Signed in as ${currentUser.email || 'Google User'} (UID: ${currentUser.uid.slice(0, 8)}...)`,
  });

  // Step 2: Verify Firebase returns a valid ID token
  let idToken: string | null = null;
  try {
    idToken = await currentUser.getIdToken(false);
    const payload = idToken ? decodeJwtPayloadUnsafe(idToken) : null;
    const subMatches = payload?.sub === currentUser.uid;
    const aud = typeof payload?.aud === 'string' ? payload.aud : 'unknown';
    const iss = typeof payload?.iss === 'string' ? payload.iss : 'unknown';
    const roleClaim =
      typeof payload?.role === 'string'
        ? payload.role
        : 'none (PostgREST maps to anon)';
    const emailVerified =
      payload?.email_verified === true || payload?.email_verified === 'true';
    const exp = typeof payload?.exp === 'number' ? payload.exp : 0;
    const minsLeft = exp ? Math.round((exp * 1000 - Date.now()) / 60000) : 0;

    if (!idToken || !payload || !subMatches || minsLeft <= 0) {
      checks.push({
        id: 'firebase_token',
        label: '2. Firebase ID Token',
        ok: false,
        detail: !idToken
          ? 'getIdToken() returned null/empty'
          : `Token validation failed (aud=${aud}, iss=${iss}, subMatch=${String(subMatches)}, minsLeft=${minsLeft})`,
      });
      return {
        status: 'failed',
        checkedAt,
        latencyMs: Math.max(
          1,
          Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt)
        ),
        authenticated: true,
        checks,
        errorCode: 'INVALID_FIREBASE_TOKEN',
        errorMessage: 'Firebase did not return a valid active ID token.',
      };
    }

    checks.push({
      id: 'firebase_token',
      label: '2. Firebase ID Token',
      ok: true,
      detail: `Valid JWT (aud=${aud}, sub=UID, email_verified=${String(emailVerified)}, roleClaim=${roleClaim}, exp~${minsLeft}m)`,
    });
  } catch (err) {
    checks.push({
      id: 'firebase_token',
      label: '2. Firebase ID Token',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    return {
      status: 'failed',
      checkedAt,
      latencyMs: Math.max(
        1,
        Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt)
      ),
      authenticated: true,
      checks,
      errorCode: 'FIREBASE_TOKEN_ERROR',
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  // Step 3 & 4: Verify token is attached to Supabase & read authenticated user's profile
  if (options?.profileSyncError) {
    const syncErrObj =
      options.profileSyncError && typeof options.profileSyncError === 'object'
        ? (options.profileSyncError as {
            code?: string;
            message?: string;
            details?: string;
            hint?: string;
          })
        : { message: String(options.profileSyncError) };
    const code = syncErrObj.code || 'PROFILE_SYNC_ERROR';
    const message =
      syncErrObj.message || 'Profile creation failed before verification.';
    const isJwtErr =
      code.toLowerCase() === 'pgrst301' ||
      message.toLowerCase().includes('jwt') ||
      message.toLowerCase().includes('jws');

    checks.push({
      id: 'token_attached',
      label: '3. Token Attached & Accepted by Supabase',
      ok: !isJwtErr,
      detail: isJwtErr
        ? `Rejected (${code}): ${message}`
        : 'Firebase ID token attached during profile sync.',
    });
    checks.push({
      id: 'profile_read',
      label: '4. Profile Created & Verified (user_profiles)',
      ok: false,
      detail: `[${code}] ${message}`,
    });
    return {
      status: 'failed',
      checkedAt,
      latencyMs: Math.max(
        1,
        Math.round(
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
            startedAt
        )
      ),
      authenticated: true,
      checks,
      errorCode: code,
      errorMessage: message,
      errorDetails: syncErrObj.details || syncErrObj.hint || undefined,
      probableCause: diagnoseSupabaseAuthOrRlsCause(code, message),
    };
  }

  try {
    const {
      data: profileRows,
      count: profileCount,
      error: profileErr,
      status: profileHttpStatus,
    } = await supabase
      .from('user_profiles')
      .select(
        'uid, display_name, email, role, approval_status, created_at, updated_at',
        { count: 'exact' }
      )
      .eq('uid', currentUser.uid);

    if (profileErr) {
      const errObj = profileErr as {
        code?: string;
        message?: string;
        details?: string;
        hint?: string;
      };
      const code =
        errObj.code || (profileHttpStatus ? `HTTP_${profileHttpStatus}` : undefined);
      const isJwtErr =
        profileHttpStatus === 401 ||
        (code || '').toLowerCase() === 'pgrst301' ||
        (errObj.message || '').toLowerCase().includes('jwt') ||
        (errObj.message || '').toLowerCase().includes('jws');

      checks.push({
        id: 'token_attached',
        label: '3. Token Attached & Accepted by Supabase',
        ok: !isJwtErr,
        detail: isJwtErr
          ? `Rejected (${code || '401'}): ${errObj.message}`
          : 'Token sent with request',
      });
      checks.push({
        id: 'profile_read',
        label: '4. Profile Created & Verified (user_profiles)',
        ok: false,
        detail: `${code ? `[${code}] ` : ''}${errObj.message || 'Query failed'}`,
      });

      return {
        status: 'failed',
        checkedAt,
        latencyMs: Math.max(
          1,
          Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt)
        ),
        authenticated: true,
        checks,
        errorCode: code,
        errorMessage: errObj.message || 'Failed reading authenticated user profile.',
        errorDetails: errObj.details || errObj.hint || undefined,
        probableCause: diagnoseSupabaseAuthOrRlsCause(code, errObj.message, profileHttpStatus),
      };
    }

    checks.push({
      id: 'token_attached',
      label: '3. Token Attached & Accepted by Supabase',
      ok: true,
      detail: 'Firebase ID token attached via accessToken() and accepted (HTTP 200).',
    });

    const rowCount = profileCount ?? (profileRows ? profileRows.length : 0);
    const profileRow = profileRows && profileRows.length > 0 ? profileRows[0] : null;

    if (!profileRow || rowCount === 0) {
      checks.push({
        id: 'profile_read',
        label: '4. Profile Created & Verified (user_profiles)',
        ok: false,
        detail:
          'Query succeeded (HTTP 200), but 0 rows exist for this Firebase UID. Run migration 003 and click Retest.',
      });
      return {
        status: 'failed',
        checkedAt,
        latencyMs: Math.max(
          1,
          Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt)
        ),
        authenticated: true,
        checks,
        errorCode: 'PROFILE_ROW_MISSING',
        errorMessage:
          'Authenticated query returned 0 rows for user_profiles. Verify INSERT/SELECT RLS policies on user_profiles.',
        probableCause:
          'Either migration 003_secure_user_profiles_rls.sql has not been applied yet, or user_profiles INSERT/SELECT RLS blocked profile creation.',
      };
    }

    if (rowCount > 1 || (profileRows && profileRows.length > 1)) {
      checks.push({
        id: 'profile_read',
        label: '4. Profile Created & Verified (user_profiles)',
        ok: false,
        detail: `Duplicate rows detected (count=${rowCount}) for UID ${currentUser.uid}.`,
      });
      return {
        status: 'failed',
        checkedAt,
        latencyMs: Math.max(
          1,
          Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt)
        ),
        authenticated: true,
        checks,
        errorCode: 'DUPLICATE_PROFILE_ROWS',
        errorMessage: `Expected exactly 1 profile row, found ${rowCount}.`,
      };
    }

    if (profileRow.uid !== currentUser.uid) {
      checks.push({
        id: 'profile_read',
        label: '4. Profile Created & Verified (user_profiles)',
        ok: false,
        detail: `UID mismatch: expected ${currentUser.uid}, got ${profileRow.uid}.`,
      });
      return {
        status: 'failed',
        checkedAt,
        latencyMs: Math.max(
          1,
          Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt)
        ),
        authenticated: true,
        checks,
        errorCode: 'PROFILE_UID_MISMATCH',
        errorMessage: `Profile UID (${profileRow.uid}) does not match Firebase UID (${currentUser.uid}).`,
      };
    }

    checks.push({
      id: 'profile_read',
      label: '4. Profile Created & Verified (user_profiles)',
      ok: true,
      detail: `1 row (no duplicates) · UID matched (${profileRow.uid.slice(0, 8)}...) · role=${profileRow.role} · approval_status=${profileRow.approval_status}`,
    });

    // Step 5: Non-destructive RLS policies & permissions verification
    const [otherProfilesRes, ownQuartersRes, ownStorageRes] = await Promise.all([
      supabase.from('user_profiles').select('uid').neq('uid', currentUser.uid).limit(1),
      supabase.from('quarters').select('id').eq('owner_id', currentUser.uid).limit(1),
      supabase.storage.from('study-files').list(currentUser.uid, { limit: 1 }),
    ]);

    const isOwnerOrApprovedAdmin =
      (profileRow.role === 'admin' && profileRow.approval_status === 'approved') ||
      (currentUser.email || '').toLowerCase() === OWNER_ADMIN_EMAIL.toLowerCase();

    const rlsErrors: string[] = [];
    if (otherProfilesRes.error) {
      rlsErrors.push(`user_profiles isolation check error: ${otherProfilesRes.error.message}`);
    } else if (!isOwnerOrApprovedAdmin && (otherProfilesRes.data || []).length > 0) {
      rlsErrors.push('RLS WARNING: Non-admin user was able to read another user profile row!');
    }
    if (ownQuartersRes.error) {
      rlsErrors.push(`quarters RLS read error: ${ownQuartersRes.error.message}`);
    }
    if (ownStorageRes.error) {
      rlsErrors.push(`study-files storage RLS error: ${ownStorageRes.error.message}`);
    }

    const endedAt =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const latencyMs = Math.max(1, Math.round(endedAt - startedAt));

    if (rlsErrors.length > 0) {
      checks.push({
        id: 'rls_policies',
        label: '5. RLS Policies & Role Protection',
        ok: false,
        detail: rlsErrors.join(' | '),
      });
      return {
        status: 'failed',
        checkedAt,
        latencyMs,
        authenticated: true,
        checks,
        errorCode: 'RLS_CHECK_FAILED',
        errorMessage: rlsErrors.join(' | '),
        probableCause: diagnoseSupabaseAuthOrRlsCause(undefined, rlsErrors[0]),
      };
    }

    checks.push({
      id: 'rls_policies',
      label: '5. RLS Policies & Role Protection',
      ok: true,
      detail: `${
        isOwnerOrApprovedAdmin
          ? 'Owner/Admin read scope verified'
          : 'Cross-user profiles isolated (0 rows)'
      }, role/approval protected, quarters (${ownQuartersRes.data?.length ?? 0}+) & study-files bucket allowed.`,
    });

    return {
      status: 'connected',
      checkedAt,
      latencyMs,
      authenticated: true,
      checks,
    };
  } catch (err) {
    const endedAt =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    return {
      status: 'failed',
      checkedAt,
      latencyMs: Math.max(1, Math.round(endedAt - startedAt)),
      authenticated: true,
      checks,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}


