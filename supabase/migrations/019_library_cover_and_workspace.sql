-- ============================================================================
-- Migration 019: Reading Library Book Covers & Structured Workspace Data
-- ============================================================================
-- Safe & lock-aware: uses SET lock_timeout = '8s' and constant defaults.

SET lock_timeout = '8s';

ALTER TABLE public.reading_items
  ADD COLUMN IF NOT EXISTS cover_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cover_storage_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cover_frame jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS workspace_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Additive Storage SELECT Policy for public/granted reading_items cover images
DROP POLICY IF EXISTS mizan_storage_select_public_book_covers ON storage.objects;
CREATE POLICY mizan_storage_select_public_book_covers ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'user-images'
    AND EXISTS (
      SELECT 1
      FROM public.reading_items AS r
      WHERE r.cover_storage_path = name
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
  );
