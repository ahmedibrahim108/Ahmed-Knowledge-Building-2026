-- ============================================================================
-- Migration 011: Granular Per-Account Access Modes & Annotations,
-- Granted Blog Posts, and Dashboard Hero Image Preferences
-- ============================================================================
-- Deadlock-Free & Idempotent (individual non-blocking DDL statements).

SET lock_timeout = '8s';

-- 1. Dashboard Hero Image Customization in user_preferences
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS dashboard_hero jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Extended Per-Account Permissions on content_access_grants
ALTER TABLE public.content_access_grants
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'read_only',
  ADD COLUMN IF NOT EXISTS allow_user_notes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_addition_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS custom_addition_body text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS blog_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Allow explicitly granted blog_posts to be read by granted accounts
DROP POLICY IF EXISTS blog_posts_select_public_or_admin ON public.blog_posts;
CREATE POLICY blog_posts_select_public_or_admin ON public.blog_posts
  FOR SELECT TO anon, authenticated
  USING (
    is_public = true
    OR (public.is_verified_admin() AND owner_id = public.firebase_uid())
    OR EXISTS (
      SELECT 1 FROM public.content_access_grants g
      WHERE g.owner_id = blog_posts.owner_id
        AND public.is_grant_for_current_user(g)
        AND g.blog_ids @> to_jsonb(blog_posts.id)
    )
  );

-- 4. Granted Item Notes & Annotations Table (for accounts permitted to add notes/questions)
CREATE TABLE IF NOT EXISTS public.granted_item_notes (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  author_uid text NOT NULL DEFAULT public.firebase_uid(),
  author_email text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT '',
  target_type text NOT NULL CHECK (target_type IN ('course', 'note', 'path', 'book', 'reflection')),
  target_id text NOT NULL,
  content text NOT NULL DEFAULT '',
  is_admin_reply boolean NOT NULL DEFAULT false,
  created_at_label text NOT NULL DEFAULT '',
  created_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_granted_item_notes_owner_target
  ON public.granted_item_notes (owner_id, target_type, target_id, created_at_ms DESC);

CREATE INDEX IF NOT EXISTS idx_granted_item_notes_author
  ON public.granted_item_notes (author_uid, created_at_ms DESC);

DROP TRIGGER IF EXISTS trg_granted_item_notes_updated_at ON public.granted_item_notes;
CREATE TRIGGER trg_granted_item_notes_updated_at
  BEFORE UPDATE ON public.granted_item_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.granted_item_notes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.granted_item_notes TO anon, authenticated;

DROP POLICY IF EXISTS granted_item_notes_select_policy ON public.granted_item_notes;
DROP POLICY IF EXISTS granted_item_notes_insert_policy ON public.granted_item_notes;
DROP POLICY IF EXISTS granted_item_notes_update_policy ON public.granted_item_notes;
DROP POLICY IF EXISTS granted_item_notes_delete_policy ON public.granted_item_notes;

CREATE POLICY granted_item_notes_select_policy ON public.granted_item_notes
  FOR SELECT TO anon, authenticated
  USING (
    (public.is_verified_admin() AND owner_id = public.firebase_uid())
    OR (
      public.is_verified_firebase_user()
      AND (
        author_uid = public.firebase_uid()
        OR EXISTS (
          SELECT 1 FROM public.content_access_grants g
          WHERE g.owner_id = granted_item_notes.owner_id
            AND public.is_grant_for_current_user(g)
        )
      )
    )
  );

CREATE POLICY granted_item_notes_insert_policy ON public.granted_item_notes
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_verified_firebase_user()
    AND author_uid = public.firebase_uid()
    AND (
      (public.is_verified_admin() AND owner_id = public.firebase_uid())
      OR EXISTS (
        SELECT 1 FROM public.content_access_grants g
        WHERE g.owner_id = granted_item_notes.owner_id
          AND public.is_grant_for_current_user(g)
          AND (g.allow_user_notes = true OR g.access_mode = 'can_annotate')
      )
    )
  );

CREATE POLICY granted_item_notes_update_policy ON public.granted_item_notes
  FOR UPDATE TO anon, authenticated
  USING (
    (public.is_verified_admin() AND owner_id = public.firebase_uid())
    OR (public.is_verified_firebase_user() AND author_uid = public.firebase_uid())
  )
  WITH CHECK (
    (public.is_verified_admin() AND owner_id = public.firebase_uid())
    OR (public.is_verified_firebase_user() AND author_uid = public.firebase_uid())
  );

CREATE POLICY granted_item_notes_delete_policy ON public.granted_item_notes
  FOR DELETE TO anon, authenticated
  USING (
    (public.is_verified_admin() AND owner_id = public.firebase_uid())
    OR (public.is_verified_firebase_user() AND author_uid = public.firebase_uid())
  );

ALTER TABLE public.granted_item_notes REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.granted_item_notes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
