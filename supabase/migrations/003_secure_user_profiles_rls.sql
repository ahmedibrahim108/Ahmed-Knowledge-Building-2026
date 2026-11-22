-- ============================================================================
-- Migration 003: Secure Idempotent User Profiles, Approval Separation & RLS
-- Target Project: Mizan Knowledge (ميزان المعرفة)
-- Safe & Non-Destructive: Preserves all existing data and user accounts.
-- ============================================================================

-- 1. Firebase JWT Claim Helper Functions
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

-- 2. Add approval_status column non-destructively (keeps registration approval separate)
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

-- 3. Verified Owner / Approved Admin check (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_verified_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    public.firebase_email() = 'farrag34567@gmail.com'
    AND public.firebase_email_verified()
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles AS p
    WHERE p.uid = public.firebase_uid()
      AND p.role = 'admin'
      AND p.approval_status = 'approved'
  );
$$;

-- Lock down function execution permissions explicitly
REVOKE ALL ON FUNCTION public.firebase_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firebase_uid() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.firebase_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firebase_email() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.firebase_email_verified() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firebase_email_verified() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_verified_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_verified_admin() TO authenticated, service_role;

-- 4. Column protection trigger: non-admin users cannot alter uid, role, or approval_status
CREATE OR REPLACE FUNCTION public.protect_user_profiles_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Always keep uid and created_at immutable once created
  IF NEW.uid IS DISTINCT FROM OLD.uid THEN
    RAISE EXCEPTION 'Cannot modify user_profiles.uid'
      USING ERRCODE = '42501';
  END IF;

  NEW.created_at := OLD.created_at;

  -- Allow trusted Postgres / Supabase admin roles (e.g. SQL Editor, service_role)
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block non-admin authenticated users from changing administrative fields
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

-- Ensure updated_at trigger remains active
DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Schema & Table Grants (RLS enforces row-level & role-based access)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.user_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO authenticated;

-- 6. Strict RLS Policies on public.user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_delete_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_select_own_or_admin ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_own_or_admin ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_delete_own_or_admin ON public.user_profiles;

-- SELECT: users read only their own profile; verified Owner/Admin can inspect profiles
CREATE POLICY user_profiles_select_own_or_admin ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    uid = public.firebase_uid()
    OR public.is_verified_admin()
  );

-- INSERT: users create only their own profile matching verified JWT sub, strictly as role='user' and approval_status='pending'
CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.firebase_uid() IS NOT NULL
    AND uid = public.firebase_uid()
    AND role = 'user'
    AND approval_status = 'pending'
  );

-- UPDATE: users update only their own permitted profile fields (trigger blocks role/approval_status changes);
-- verified Owner/Admin can manage administrative fields
CREATE POLICY user_profiles_update_own_or_admin ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    uid = public.firebase_uid()
    OR public.is_verified_admin()
  )
  WITH CHECK (
    uid = public.firebase_uid()
    OR public.is_verified_admin()
  );

-- DELETE: restricted to own profile or verified Owner/Admin
CREATE POLICY user_profiles_delete_own_or_admin ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (
    uid = public.firebase_uid()
    OR public.is_verified_admin()
  );
