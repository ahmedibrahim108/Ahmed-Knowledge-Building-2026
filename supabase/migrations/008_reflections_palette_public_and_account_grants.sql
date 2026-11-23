-- ============================================================================
-- Migration 008: Reflection Color Palette & Public Visibility,
-- Customizable Reading Modes, and Per-Account Granular Content Grants
-- Safe & Idempotent (no destructive deletes, safe to re-run)
-- ============================================================================

-- 1. Reflections: Color Palette & Public Toggle
ALTER TABLE public.reflections
  ADD COLUMN IF NOT EXISTS color_key text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_reflections_public ON public.reflections (is_public, category_tag);

-- 2. Public Site Config: Reflection Categories Selected for Public Showcase
ALTER TABLE public.public_site_config
  ADD COLUMN IF NOT EXISTS public_reflection_categories jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. User Preferences: Customizable Reading Modes
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS custom_reading_modes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 4. Per-Account Granular Content Grants Table
CREATE TABLE IF NOT EXISTS public.content_access_grants (
  id text PRIMARY KEY,
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  grantee_uid text NOT NULL,
  grantee_email text NOT NULL DEFAULT '',
  course_doc_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  include_course_notes boolean NOT NULL DEFAULT true,
  note_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  path_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  book_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  reflection_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  reflection_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes_for_user text NOT NULL DEFAULT '',
  updated_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_access_grants_owner_grantee
  ON public.content_access_grants (owner_id, grantee_uid);
CREATE INDEX IF NOT EXISTS idx_content_access_grants_grantee_email
  ON public.content_access_grants (lower(grantee_email));

DROP TRIGGER IF EXISTS trg_content_access_grants_updated_at ON public.content_access_grants;
CREATE TRIGGER trg_content_access_grants_updated_at
  BEFORE UPDATE ON public.content_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.content_access_grants ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_access_grants TO anon, authenticated;

DROP POLICY IF EXISTS content_access_grants_select_policy ON public.content_access_grants;
DROP POLICY IF EXISTS content_access_grants_insert_admin ON public.content_access_grants;
DROP POLICY IF EXISTS content_access_grants_update_admin ON public.content_access_grants;
DROP POLICY IF EXISTS content_access_grants_delete_admin ON public.content_access_grants;

CREATE POLICY content_access_grants_select_policy ON public.content_access_grants
  FOR SELECT TO anon, authenticated
  USING (
    (public.is_verified_admin() AND owner_id = public.firebase_uid())
    OR (
      public.is_verified_firebase_user()
      AND (
        grantee_uid = public.firebase_uid()
        OR (
          grantee_email <> ''
          AND public.firebase_email_verified()
          AND lower(grantee_email) = public.firebase_email()
        )
      )
    )
  );

CREATE POLICY content_access_grants_insert_admin ON public.content_access_grants
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_verified_admin()
    AND owner_id = public.firebase_uid()
  );

CREATE POLICY content_access_grants_update_admin ON public.content_access_grants
  FOR UPDATE TO anon, authenticated
  USING (
    public.is_verified_admin()
    AND owner_id = public.firebase_uid()
  )
  WITH CHECK (
    public.is_verified_admin()
    AND owner_id = public.firebase_uid()
  );

CREATE POLICY content_access_grants_delete_admin ON public.content_access_grants
  FOR DELETE TO anon, authenticated
  USING (
    public.is_verified_admin()
    AND owner_id = public.firebase_uid()
  );

-- 5. Helper to match current signed-in Firebase user against a grant row
CREATE OR REPLACE FUNCTION public.is_grant_for_current_user(g public.content_access_grants)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.is_verified_firebase_user()
    AND (
      g.grantee_uid = public.firebase_uid()
      OR (
        g.grantee_email <> ''
        AND public.firebase_email_verified()
        AND lower(g.grantee_email) = public.firebase_email()
      )
    );
$$;

-- 6. Update SELECT RLS on courses, learning_paths, reading_items, book_notes, reflections
--    preserving strict public isolation while allowing explicitly granted accounts to read granted rows.

DROP POLICY IF EXISTS courses_select_public_or_admin ON public.courses;
CREATE POLICY courses_select_public_or_admin ON public.courses
  FOR SELECT TO anon, authenticated
  USING (
    is_public = true
    OR (public.is_verified_admin() AND owner_id = public.firebase_uid())
    OR EXISTS (
      SELECT 1 FROM public.content_access_grants g
      WHERE g.owner_id = courses.owner_id
        AND public.is_grant_for_current_user(g)
        AND g.course_doc_ids @> to_jsonb(courses.doc_id)
    )
  );

DROP POLICY IF EXISTS learning_paths_select_public_or_admin ON public.learning_paths;
CREATE POLICY learning_paths_select_public_or_admin ON public.learning_paths
  FOR SELECT TO anon, authenticated
  USING (
    is_public = true
    OR (public.is_verified_admin() AND owner_id = public.firebase_uid())
    OR EXISTS (
      SELECT 1 FROM public.content_access_grants g
      WHERE g.owner_id = learning_paths.owner_id
        AND public.is_grant_for_current_user(g)
        AND g.path_ids @> to_jsonb(learning_paths.id)
    )
  );

DROP POLICY IF EXISTS reading_items_select_public_or_admin ON public.reading_items;
CREATE POLICY reading_items_select_public_or_admin ON public.reading_items
  FOR SELECT TO anon, authenticated
  USING (
    is_public = true
    OR (public.is_verified_admin() AND owner_id = public.firebase_uid())
    OR EXISTS (
      SELECT 1 FROM public.content_access_grants g
      WHERE g.owner_id = reading_items.owner_id
        AND public.is_grant_for_current_user(g)
        AND g.book_ids @> to_jsonb(reading_items.id)
    )
  );

DROP POLICY IF EXISTS book_notes_select_admin ON public.book_notes;
DROP POLICY IF EXISTS book_notes_select_admin_or_granted ON public.book_notes;
CREATE POLICY book_notes_select_admin_or_granted ON public.book_notes
  FOR SELECT TO anon, authenticated
  USING (
    (public.is_verified_admin() AND owner_id = public.firebase_uid())
    OR EXISTS (
      SELECT 1 FROM public.content_access_grants g
      WHERE g.owner_id = book_notes.owner_id
        AND public.is_grant_for_current_user(g)
        AND (
          g.note_ids @> to_jsonb(book_notes.id)
          OR (
            g.include_course_notes = true
            AND book_notes.course_id > 0
            AND EXISTS (
              SELECT 1 FROM public.courses c
              WHERE c.owner_id = g.owner_id
                AND c.course_number = book_notes.course_id
                AND g.course_doc_ids @> to_jsonb(c.doc_id)
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS reflections_select_admin ON public.reflections;
DROP POLICY IF EXISTS reflections_select_public_admin_or_granted ON public.reflections;
CREATE POLICY reflections_select_public_admin_or_granted ON public.reflections
  FOR SELECT TO anon, authenticated
  USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM public.public_site_config psc
      WHERE psc.id = 'main'
        AND psc.owner_id = reflections.owner_id
        AND reflections.category_tag <> ''
        AND psc.public_reflection_categories @> to_jsonb(reflections.category_tag)
    )
    OR (public.is_verified_admin() AND owner_id = public.firebase_uid())
    OR EXISTS (
      SELECT 1 FROM public.content_access_grants g
      WHERE g.owner_id = reflections.owner_id
        AND public.is_grant_for_current_user(g)
        AND (
          g.reflection_ids @> to_jsonb(reflections.id)
          OR (
            reflections.category_tag <> ''
            AND g.reflection_categories @> to_jsonb(reflections.category_tag)
          )
        )
    )
  );

-- 7. Update Storage SELECT Policy to include granted books, courses, and note attachments
DROP POLICY IF EXISTS mizan_storage_select_public_or_admin ON storage.objects;
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
          WHERE r.storage_path = name
            AND (
              r.is_public = true
              OR EXISTS (
                SELECT 1 FROM public.content_access_grants g
                WHERE g.owner_id = r.owner_id
                  AND public.is_grant_for_current_user(g)
                  AND g.book_ids @> to_jsonb(r.id)
              )
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.courses AS c
          WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(c.resources) AS elem
              WHERE elem->>'storagePath' = name
            )
            AND (
              c.is_public = true
              OR EXISTS (
                SELECT 1 FROM public.content_access_grants g
                WHERE g.owner_id = c.owner_id
                  AND public.is_grant_for_current_user(g)
                  AND g.course_doc_ids @> to_jsonb(c.doc_id)
              )
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.book_notes AS bn
          WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(bn.resources) AS elem
              WHERE elem->>'storagePath' = name
            )
            AND EXISTS (
              SELECT 1 FROM public.content_access_grants g
              WHERE g.owner_id = bn.owner_id
                AND public.is_grant_for_current_user(g)
                AND (
                  g.note_ids @> to_jsonb(bn.id)
                  OR (
                    g.include_course_notes = true
                    AND bn.course_id > 0
                    AND EXISTS (
                      SELECT 1 FROM public.courses c
                      WHERE c.owner_id = g.owner_id
                        AND c.course_number = bn.course_id
                        AND g.course_doc_ids @> to_jsonb(c.doc_id)
                    )
                  )
                )
            )
        )
      )
    )
  );

-- 8. Realtime Enablement for content_access_grants
ALTER TABLE public.content_access_grants REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content_access_grants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
