-- ============================================================================
-- Migration 005: Workspace Tables & Storage RLS for Firebase JWT (role = anon)
-- ============================================================================
-- Root Cause Fixed:
--   Migration 004 fixed public.user_profiles for Firebase ID tokens without a
--   custom "role": "authenticated" claim (PostgREST executes those requests
--   under the `anon` Postgres role while `auth.jwt()` carries verified Firebase
--   claims: `sub`, `iss`, `aud`, `email_verified`).
--   All 19 workspace/media tables and `storage.objects` remained scoped strictly
--   `TO authenticated`, causing:
--     1) `months` SELECT check to return 0 rows under `anon`, triggering initial
--        workspace seeding on every login.
--     2) `quarters` (and all workspace tables) INSERT/UPSERT to fail with:
--        42501: new row violates row-level security policy for table "quarters".
--     3) `storage.objects` checks (`study-files`, `user-images`, `audio-cache`)
--        to fail under `anon`.
--
-- Security Guarantees:
--   - RLS remains ENABLED on every table and `storage.objects`.
--   - NO unrestricted `anon` access: every policy explicitly enforces
--     `public.is_verified_firebase_user()` (verified Firebase `sub`, `iss`, `aud`)
--     AND `owner_id = public.firebase_uid()` (or folder prefix = `firebase_uid()`).
--   - Unauthenticated `anon` requests (`sub IS NULL`) strictly fail all checks.
--   - Non-destructive: preserves all existing tables, triggers, indexes, and rows.
-- ============================================================================

-- 1. Ensure schema & table privileges exist for PostgREST `anon` and `authenticated`
--    (access remains strictly gated by RLS policies below).
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Update RLS policies & privileges on all 19 owner-scoped workspace/media tables
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    -- 8 tables written/queried during initial workspace seed:
    'quarters',
    'domains',
    'months',
    'courses',
    'book_notes',
    'custom_categories',
    'study_history',
    'user_preferences',
    -- 11 additional workspace & attachment metadata tables:
    'reflections',
    'calendar_events',
    'learning_paths',
    'reading_items',
    'practical_projects',
    'unified_tasks',
    'weekly_meetings',
    'dental_cases',
    'file_attachments',
    'image_attachments',
    'audio_cache'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon, authenticated', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I_select_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_own ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY %I_select_own ON public.%I FOR SELECT TO anon, authenticated USING (public.is_verified_firebase_user() AND owner_id = public.firebase_uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_insert_own ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (public.is_verified_firebase_user() AND owner_id = public.firebase_uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_update_own ON public.%I FOR UPDATE TO anon, authenticated USING (public.is_verified_firebase_user() AND owner_id = public.firebase_uid()) WITH CHECK (public.is_verified_firebase_user() AND owner_id = public.firebase_uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_delete_own ON public.%I FOR DELETE TO anon, authenticated USING (public.is_verified_firebase_user() AND owner_id = public.firebase_uid())',
      tbl, tbl
    );
  END LOOP;
END $$;

-- 3. Update Storage RLS policies on storage.objects for private buckets
DROP POLICY IF EXISTS mizan_storage_select_own ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_insert_own ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_update_own ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_delete_own ON storage.objects;

CREATE POLICY mizan_storage_select_own ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  );

CREATE POLICY mizan_storage_insert_own ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_verified_firebase_user()
    AND bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  );

CREATE POLICY mizan_storage_update_own ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  )
  WITH CHECK (
    public.is_verified_firebase_user()
    AND bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  );

CREATE POLICY mizan_storage_delete_own ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  );
