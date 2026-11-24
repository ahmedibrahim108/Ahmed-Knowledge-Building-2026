-- ============================================================================
-- Migration 015: Per-User Theme Persistence RLS on user_preferences
-- ============================================================================
-- Purpose:
--   Allows ALL authenticated Firebase users (both admin and non-admin regular
--   accounts) to securely SELECT, INSERT, and UPDATE strictly their OWN
--   `user_preferences` row (`owner_id = public.firebase_uid()`) so cross-device
--   theme preferences persist in Supabase without exposing any admin data or
--   weakening RLS on any private workspace table.
--
-- Security Guarantees:
--   - RLS remains ENABLED on `public.user_preferences`.
--   - Unauthenticated `anon` requests (`sub IS NULL`) strictly fail
--     `public.is_verified_firebase_user()`.
--   - Every authenticated user can access ONLY rows matching their verified
--     Firebase UID (`owner_id = public.firebase_uid()`).
--   - DELETE remains restricted strictly to verified administrators.
--   - Locks ONLY `public.user_preferences` with a short lock_timeout (8s) to
--     avoid cross-table 40P01 deadlocks.
-- ============================================================================

SET lock_timeout = '8s';

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_preferences TO anon, authenticated;

DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_delete_own ON public.user_preferences;

DROP POLICY IF EXISTS user_preferences_select_admin ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_insert_admin ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_update_admin ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_delete_admin ON public.user_preferences;

CREATE POLICY user_preferences_select_own ON public.user_preferences
  FOR SELECT TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND owner_id = public.firebase_uid()
  );

CREATE POLICY user_preferences_insert_own ON public.user_preferences
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_verified_firebase_user()
    AND owner_id = public.firebase_uid()
  );

CREATE POLICY user_preferences_update_own ON public.user_preferences
  FOR UPDATE TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND owner_id = public.firebase_uid()
  )
  WITH CHECK (
    public.is_verified_firebase_user()
    AND owner_id = public.firebase_uid()
  );

CREATE POLICY user_preferences_delete_admin ON public.user_preferences
  FOR DELETE TO anon, authenticated
  USING (
    public.is_verified_admin()
    AND owner_id = public.firebase_uid()
  );
