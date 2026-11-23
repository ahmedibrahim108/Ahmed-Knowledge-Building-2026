-- ============================================================================
-- Migration 010: Blogs & Articles (`blog_posts`), Navbar Pinning (`pinned_nav_tabs`),
-- & Deadlock-Free Schema Reconciliation (Replaces risky monolithic locks)
-- ============================================================================
-- Safe & Idempotent. Executed as individual auto-commit statements (no giant
-- DO loop holding locks across 20 tables) so concurrent app tabs never deadlock.

SET lock_timeout = '8s';

-- 1. User Preferences: Navbar Pinning (`pinned_nav_tabs`), Editable Hubs (`custom_hubs`) & 007 columns check
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS weekly_rhythm jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reflection_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_reading_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pinned_nav_tabs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_hubs jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Reconcile columns from 008 / 009 safely (in case 009 deadlocked earlier)
ALTER TABLE public.public_site_config
  ADD COLUMN IF NOT EXISTS public_reflection_categories jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.reflections
  ADD COLUMN IF NOT EXISTS category_tag text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS color_key text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_storage_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_frame jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.image_attachments
  ADD COLUMN IF NOT EXISTS frame_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS category_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_image_attachments_scope_sort
  ON public.image_attachments (owner_id, scope_key, sort_order ASC, created_at_ms DESC);

-- 3. Blogs & Articles Table (`public.blog_posts`)
CREATE TABLE IF NOT EXISTS public.blog_posts (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  category_label text NOT NULL DEFAULT '',
  cover_image_url text NOT NULL DEFAULT '',
  cover_storage_path text NOT NULL DEFAULT '',
  cover_frame jsonb NOT NULL DEFAULT '{}'::jsonb,
  reading_time_minutes integer NOT NULL DEFAULT 2,
  is_public boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at_label text NOT NULL DEFAULT '',
  created_at_ms bigint NOT NULL DEFAULT 0,
  updated_at_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_owner_created
  ON public.blog_posts (owner_id, pinned DESC, created_at_ms DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_public
  ON public.blog_posts (is_public, pinned DESC, created_at_ms DESC)
  WHERE is_public = true;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_posts TO anon, authenticated;

DROP POLICY IF EXISTS blog_posts_select_public_or_admin ON public.blog_posts;
DROP POLICY IF EXISTS blog_posts_insert_admin ON public.blog_posts;
DROP POLICY IF EXISTS blog_posts_update_admin ON public.blog_posts;
DROP POLICY IF EXISTS blog_posts_delete_admin ON public.blog_posts;

CREATE POLICY blog_posts_select_public_or_admin ON public.blog_posts
  FOR SELECT TO anon, authenticated
  USING (
    is_public = true
    OR (public.is_verified_admin() AND owner_id = public.firebase_uid())
  );

CREATE POLICY blog_posts_insert_admin ON public.blog_posts
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_verified_admin() AND owner_id = public.firebase_uid());

CREATE POLICY blog_posts_update_admin ON public.blog_posts
  FOR UPDATE TO anon, authenticated
  USING (public.is_verified_admin() AND owner_id = public.firebase_uid())
  WITH CHECK (public.is_verified_admin() AND owner_id = public.firebase_uid());

CREATE POLICY blog_posts_delete_admin ON public.blog_posts
  FOR DELETE TO anon, authenticated
  USING (public.is_verified_admin() AND owner_id = public.firebase_uid());

ALTER TABLE public.blog_posts REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.blog_posts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Update Storage SELECT Policy cleanly for public/granted files, reflection images & blog cover images
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
      bucket_id = 'user-images'
      AND (
        EXISTS (
          SELECT 1
          FROM public.blog_posts AS bp
          WHERE bp.cover_storage_path = name
            AND bp.is_public = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.reflections AS refl
          WHERE refl.image_storage_path = name
            AND (
              refl.is_public = true
              OR EXISTS (
                SELECT 1 FROM public.public_site_config psc
                WHERE psc.id = 'main'
                  AND psc.owner_id = refl.owner_id
                  AND refl.category_tag <> ''
                  AND psc.public_reflection_categories @> to_jsonb(refl.category_tag)
              )
              OR EXISTS (
                SELECT 1 FROM public.content_access_grants g
                WHERE g.owner_id = refl.owner_id
                  AND public.is_grant_for_current_user(g)
                  AND (
                    g.reflection_ids @> to_jsonb(refl.id)
                    OR (
                      refl.category_tag <> ''
                      AND g.reflection_categories @> to_jsonb(refl.category_tag)
                    )
                  )
              )
            )
        )
      )
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

-- 5. Relax hardcoded 3-hub CHECK constraints so 4th+ & custom learning hubs persist cleanly
ALTER TABLE public.domains DROP CONSTRAINT IF EXISTS domains_hub_id_check;
ALTER TABLE public.domains ADD CONSTRAINT domains_hub_id_check CHECK (char_length(trim(hub_id)) > 0);

ALTER TABLE public.months DROP CONSTRAINT IF EXISTS months_hub_id_check;
ALTER TABLE public.months ADD CONSTRAINT months_hub_id_check CHECK (char_length(trim(hub_id)) > 0);

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_hub_id_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_hub_id_check CHECK (char_length(trim(hub_id)) > 0);

ALTER TABLE public.book_notes DROP CONSTRAINT IF EXISTS book_notes_hub_id_check;
ALTER TABLE public.book_notes ADD CONSTRAINT book_notes_hub_id_check CHECK (char_length(trim(hub_id)) > 0);

ALTER TABLE public.custom_categories DROP CONSTRAINT IF EXISTS custom_categories_hub_id_check;
ALTER TABLE public.custom_categories ADD CONSTRAINT custom_categories_hub_id_check CHECK (char_length(trim(hub_id)) > 0);

ALTER TABLE public.learning_paths DROP CONSTRAINT IF EXISTS learning_paths_hub_id_check;
ALTER TABLE public.learning_paths ADD CONSTRAINT learning_paths_hub_id_check CHECK (char_length(trim(hub_id)) > 0);

ALTER TABLE public.reading_items DROP CONSTRAINT IF EXISTS reading_items_hub_id_check;
ALTER TABLE public.reading_items ADD CONSTRAINT reading_items_hub_id_check CHECK (char_length(trim(hub_id)) > 0);

ALTER TABLE public.practical_projects DROP CONSTRAINT IF EXISTS practical_projects_hub_id_check;
ALTER TABLE public.practical_projects ADD CONSTRAINT practical_projects_hub_id_check CHECK (char_length(trim(hub_id)) > 0);

ALTER TABLE public.unified_tasks DROP CONSTRAINT IF EXISTS unified_tasks_hub_id_check;
ALTER TABLE public.unified_tasks ADD CONSTRAINT unified_tasks_hub_id_check CHECK (char_length(trim(hub_id)) > 0);

ALTER TABLE public.weekly_meetings DROP CONSTRAINT IF EXISTS weekly_meetings_hub_id_check;
ALTER TABLE public.weekly_meetings ADD CONSTRAINT weekly_meetings_hub_id_check CHECK (char_length(trim(hub_id)) > 0);
