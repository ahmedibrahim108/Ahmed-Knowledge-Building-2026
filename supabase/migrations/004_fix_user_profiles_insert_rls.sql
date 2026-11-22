-- ============================================================================
-- Migration 004: Minimal Fix for Firebase JWT -> user_profiles INSERT RLS (42501)
-- Root Cause:
--   Standard Firebase ID tokens do not carry a custom `"role": "authenticated"`
--   claim unless a Firebase Blocking Function injects one. Without a `role`
--   claim, Supabase PostgREST executes verified Firebase JWT requests under the
--   Postgres `anon` role while `auth.jwt()` still holds the verified Firebase
--   claims (`iss`, `aud`, `sub`, `email`, `email_verified`).
--   Policies scoped strictly `TO authenticated` therefore exclude the request,
--   causing SELECT to return 0 rows and INSERT to fail with 42501.
--
-- Security Guarantee:
--   Unauthenticated `anon` requests have `sub IS NULL` and `iss != Firebase`,
--   so `public.is_verified_firebase_user()` strictly returns FALSE.
--   RLS remains ENABLED and enforces strict UID matching, pending approval,
--   and immutable role/approval_status for non-admins.
-- ============================================================================

-- 1. Firebase JWT claim & verification helpers
CREATE OR REPLACE FUNCTION public.firebase_uid()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(auth.jwt()->>'sub', '');
$$;

CREATE OR REPLACE FUNCTION public.firebase_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(nullif(auth.jwt()->>'email', ''), ''));
$$;

CREATE OR REPLACE FUNCTION public.firebase_email_verified()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(nullif(auth.jwt()->>'email_verified', ''), 'false')) = 'true';
$$;

CREATE OR REPLACE FUNCTION public.is_verified_firebase_user()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    nullif(auth.jwt()->>'sub', '') IS NOT NULL
    AND (
      auth.role() = 'authenticated'
      OR (
        auth.jwt()->>'iss' = 'https://securetoken.google.com/knowledge-balance'
        AND auth.jwt()->>'aud' = 'knowledge-balance'
      )
    )
  );
$$;

-- 2. Ensure approval_status column exists non-destructively (default 'pending')
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_approval_status_check'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));
  END IF;
END $$;

-- 3. Verified Owner / Approved Admin helper (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_verified_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    public.is_verified_firebase_user()
    AND (
      (
        public.firebase_email() = 'farrag34567@gmail.com'
        AND public.firebase_email_verified()
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles AS p
        WHERE p.uid = public.firebase_uid()
          AND p.role = 'admin'
          AND p.approval_status = 'approved'
      )
    )
  );
$$;

-- 4. Protect administrative fields (uid, role, approval_status, created_at) on UPDATE
CREATE OR REPLACE FUNCTION public.protect_user_profiles_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.uid IS DISTINCT FROM OLD.uid THEN
    RAISE EXCEPTION 'Cannot modify user_profiles.uid'
      USING ERRCODE = '42501';
  END IF;

  NEW.created_at := OLD.created_at;

  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_verified_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Insufficient privileges to modify role'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      RAISE EXCEPTION 'Insufficient privileges to modify approval_status'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_user_profiles_admin_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_user_profiles_protect_admin_fields ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_protect_admin_fields
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_profiles_admin_fields();

-- 5. Function & Table Grants (strictly gated by RLS below)
REVOKE ALL ON FUNCTION public.firebase_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firebase_uid() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.firebase_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firebase_email() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.firebase_email_verified() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firebase_email_verified() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_verified_firebase_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_verified_firebase_user() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_verified_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_verified_admin() TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO anon, authenticated;

-- 6. Targeted RLS policies on public.user_profiles (keeps RLS enabled)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_delete_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_select_own_or_admin ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_own_or_admin ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_delete_own_or_admin ON public.user_profiles;

-- SELECT: verified Firebase user reads only their own profile; verified Owner/Admin can inspect all
CREATE POLICY user_profiles_select_own_or_admin ON public.user_profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND (
      uid = public.firebase_uid()
      OR public.is_verified_admin()
    )
  );

-- INSERT: verified Firebase user can insert ONLY their own UID with role='user' and approval_status='pending'
CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public.is_verified_firebase_user()
    AND uid = public.firebase_uid()
    AND role = 'user'
    AND approval_status = 'pending'
  );

-- UPDATE: verified Firebase user updates own permitted fields (trigger blocks role/approval_status changes);
-- verified Owner/Admin can manage administrative fields
CREATE POLICY user_profiles_update_own_or_admin ON public.user_profiles
  FOR UPDATE
  TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND (
      uid = public.firebase_uid()
      OR public.is_verified_admin()
    )
  )
  WITH CHECK (
    public.is_verified_firebase_user()
    AND (
      uid = public.firebase_uid()
      OR public.is_verified_admin()
    )
  );

-- DELETE: restricted to own profile or verified Owner/Admin
CREATE POLICY user_profiles_delete_own_or_admin ON public.user_profiles
  FOR DELETE
  TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND (
      uid = public.firebase_uid()
      OR public.is_verified_admin()
    )
  );
