-- ============================================================================
-- Migration 007: Strict Admin RBAC, Public Site Config, Learning Objectives,
-- Interactive Weekly Rhythm, Note Attachments, Task Linking, and Sorting
-- Safe & Idempotent (no destructive deletes, safe to re-run)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Ensure Verified Owner Admin Auto-Promotion & Backfill in user_profiles
UPDATE public.user_profiles
SET
  role = 'admin',
  approval_status = 'approved',
  updated_at = now()
WHERE lower(email) = 'farrag34567@gmail.com'
  AND (role <> 'admin' OR approval_status <> 'approved');

CREATE OR REPLACE FUNCTION public.ensure_owner_admin_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.firebase_email() = 'farrag34567@gmail.com'
     AND public.firebase_email_verified() THEN
    NEW.role := 'admin';
    NEW.approval_status := 'approved';
  ELSE
    IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
       AND coalesce(auth.role(), '') <> 'service_role' THEN
      NEW.role := 'user';
      NEW.approval_status := 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_owner_admin_insert ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_owner_admin_insert
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_owner_admin_on_profile_insert();

DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_verified_firebase_user()
    AND uid = public.firebase_uid()
    AND (
      (role = 'user' AND approval_status = 'pending')
      OR (
        public.firebase_email() = 'farrag34567@gmail.com'
        AND public.firebase_email_verified()
        AND role = 'admin'
        AND approval_status = 'approved'
      )
    )
  );

-- 2. Add New Feature Columns Safely (Idempotent)

-- Courses: Learning Objectives, Sort Order, Public Visibility
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS learning_objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_courses_public_order ON public.courses (is_public, sort_order);

-- Learning Paths: Learning Objectives, Sort Order, Public Visibility
ALTER TABLE public.learning_paths
  ADD COLUMN IF NOT EXISTS learning_objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_learning_paths_public_order ON public.learning_paths (is_public, sort_order);

-- Reading Library Items: Learning Objectives, Sort Order, Public Visibility
ALTER TABLE public.reading_items
  ADD COLUMN IF NOT EXISTS learning_objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_reading_items_public_order ON public.reading_items (is_public, sort_order);

-- Book Notes & Summaries: Isolated Attachments (resources), Sort Order, Created Timestamp
-- Explicitly NO learning_objectives column on book_notes
ALTER TABLE public.book_notes
  ADD COLUMN IF NOT EXISTS resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at_ms bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_book_notes_owner_order ON public.book_notes (owner_id, sort_order);

-- Unified Tasks: Explicit Entity Links (Course, Learning Path, Book)
ALTER TABLE public.unified_tasks
  ADD COLUMN IF NOT EXISTS linked_course_id integer,
  ADD COLUMN IF NOT EXISTS linked_path_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS linked_book_id text NOT NULL DEFAULT '';

-- User Preferences: Interactive Weekly Rhythm & Custom Reflection Categories
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS weekly_rhythm jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reflection_categories jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Reflections: Custom Category Tag
ALTER TABLE public.reflections
  ADD COLUMN IF NOT EXISTS category_tag text NOT NULL DEFAULT '';

-- 3. Public Site Config Table (Customizable Public Homepage)
CREATE TABLE IF NOT EXISTS public.public_site_config (
  id text PRIMARY KEY DEFAULT 'main',
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  hero_title text NOT NULL DEFAULT '',
  hero_subtitle text NOT NULL DEFAULT '',
  intro_bio text NOT NULL DEFAULT '',
  background_text text NOT NULL DEFAULT '',
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  philosophy_text text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_public_site_config_updated_at ON public.public_site_config;
CREATE TRIGGER trg_public_site_config_updated_at
  BEFORE UPDATE ON public.public_site_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.public_site_config ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_site_config TO anon, authenticated;

DROP POLICY IF EXISTS public_site_config_select_all ON public.public_site_config;
DROP POLICY IF EXISTS public_site_config_insert_admin ON public.public_site_config;
DROP POLICY IF EXISTS public_site_config_update_admin ON public.public_site_config;
DROP POLICY IF EXISTS public_site_config_delete_admin ON public.public_site_config;

CREATE POLICY public_site_config_select_all ON public.public_site_config
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY public_site_config_insert_admin ON public.public_site_config
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_verified_admin()
    AND owner_id = public.firebase_uid()
  );

CREATE POLICY public_site_config_update_admin ON public.public_site_config
  FOR UPDATE TO anon, authenticated
  USING (
    public.is_verified_admin()
    AND owner_id = public.firebase_uid()
  )
  WITH CHECK (
    public.is_verified_admin()
    AND owner_id = public.firebase_uid()
  );

CREATE POLICY public_site_config_delete_admin ON public.public_site_config
  FOR DELETE TO anon, authenticated
  USING (
    public.is_verified_admin()
    AND owner_id = public.firebase_uid()
  );

-- 4. Enforce Strict Admin-Only RLS on Private Workspace Tables
DO $$
DECLARE
  tbl text;
  private_tables text[] := ARRAY[
    'quarters',
    'domains',
    'months',
    'book_notes',
    'custom_categories',
    'study_history',
    'user_preferences',
    'reflections',
    'calendar_events',
    'practical_projects',
    'unified_tasks',
    'weekly_meetings',
    'dental_cases',
    'file_attachments',
    'image_attachments',
    'audio_cache'
  ];
BEGIN
  FOREACH tbl IN ARRAY private_tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon, authenticated', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I_select_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_own ON public.%I', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I_select_admin ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_admin ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_admin ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_admin ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY %I_select_admin ON public.%I FOR SELECT TO anon, authenticated USING (public.is_verified_admin() AND owner_id = public.firebase_uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_insert_admin ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (public.is_verified_admin() AND owner_id = public.firebase_uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_update_admin ON public.%I FOR UPDATE TO anon, authenticated USING (public.is_verified_admin() AND owner_id = public.firebase_uid()) WITH CHECK (public.is_verified_admin() AND owner_id = public.firebase_uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_delete_admin ON public.%I FOR DELETE TO anon, authenticated USING (public.is_verified_admin() AND owner_id = public.firebase_uid())',
      tbl, tbl
    );
  END LOOP;
END $$;

-- 5. Publishable Catalog Tables (courses, learning_paths, reading_items):
--    Public/Regular Users can READ ONLY explicitly published rows (is_public = true).
--    Admin has full READ/WRITE over own rows.
DO $$
DECLARE
  tbl text;
  catalog_tables text[] := ARRAY[
    'courses',
    'learning_paths',
    'reading_items'
  ];
BEGIN
  FOREACH tbl IN ARRAY catalog_tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon, authenticated', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I_select_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_own ON public.%I', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I_select_public_or_admin ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_admin ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_admin ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_admin ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY %I_select_public_or_admin ON public.%I FOR SELECT TO anon, authenticated USING (is_public = true OR (public.is_verified_admin() AND owner_id = public.firebase_uid()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_insert_admin ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (public.is_verified_admin() AND owner_id = public.firebase_uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_update_admin ON public.%I FOR UPDATE TO anon, authenticated USING (public.is_verified_admin() AND owner_id = public.firebase_uid()) WITH CHECK (public.is_verified_admin() AND owner_id = public.firebase_uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_delete_admin ON public.%I FOR DELETE TO anon, authenticated USING (public.is_verified_admin() AND owner_id = public.firebase_uid())',
      tbl, tbl
    );
  END LOOP;
END $$;

-- 6. Storage Objects RLS:
--    - Admin has full read/write/delete inside their UID prefix across study-files, user-images, audio-cache.
--    - Public/Regular users can READ from study-files ONLY if the file belongs to a published book or published course.
DROP POLICY IF EXISTS mizan_storage_select_own ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_insert_own ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_update_own ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_delete_own ON storage.objects;

DROP POLICY IF EXISTS mizan_storage_select_public_or_admin ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_insert_admin ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_update_admin ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_delete_admin ON storage.objects;

CREATE POLICY mizan_storage_select_public_or_admin ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    (
      public.is_verified_admin()
      AND bucket_id IN ('study-files', 'user-images', 'audio-cache')
      AND (storage.foldername(name))[1] = public.firebase_uid()
    )
    OR (
      bucket_id = 'study-files'
      AND (
        EXISTS (
          SELECT 1
          FROM public.reading_items AS r
          WHERE r.is_public = true
            AND r.storage_path = name
        )
        OR EXISTS (
          SELECT 1
          FROM public.courses AS c
          WHERE c.is_public = true
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(c.resources) AS elem
              WHERE elem->>'storagePath' = name
            )
        )
      )
    )
  );

CREATE POLICY mizan_storage_insert_admin ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_verified_admin()
    AND bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  );

CREATE POLICY mizan_storage_update_admin ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (
    public.is_verified_admin()
    AND bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  )
  WITH CHECK (
    public.is_verified_admin()
    AND bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  );

CREATE POLICY mizan_storage_delete_admin ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (
    public.is_verified_admin()
    AND bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  );

-- 7. Realtime Enablement for public_site_config and user_profiles
ALTER TABLE public.public_site_config REPLICA IDENTITY FULL;
ALTER TABLE public.user_profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.public_site_config;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
