-- ============================================================================
-- Migration 017: Quick Drop Archive Section, Attachments & Per-User Storage RLS
-- ============================================================================
-- Refinements:
--   1. Separates Archive (`status = 'archived'`) from Trash (`status = 'trashed'`).
--   2. Updates 24-hour auto-expiration functions (`archive_expired_quick_drop_items`
--      and `archive_my_expired_quick_drop_items`) to move expired Inbox items
--      to Archive (`status = 'archived'`, `archived_at = COALESCE(archived_at, expires_at, now())`).
--   3. Adds attachment metadata columns (`pdf`, `image`, `file`) and relaxes RLS
--      content check so attachment-only drops succeed safely.
--   4. Grants strictly per-user private Storage access inside
--      `{firebase_uid}/quick-drop/...` on `study-files` and `user-images` for ALL
--      authenticated Firebase users (non-admin and admin), while keeping buckets private.
-- ============================================================================

SET lock_timeout = '8s';

ALTER TABLE public.quick_drop_items
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS attachment_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachment_mime text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachment_size bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attachment_bucket text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachment_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachment_preview text NOT NULL DEFAULT '';

-- Drop old CHECK constraints cleanly without relying on auto-generated names
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.quick_drop_items'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.quick_drop_items DROP CONSTRAINT IF EXISTS %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.quick_drop_items
  ADD CONSTRAINT quick_drop_items_status_check
    CHECK (status IN ('active', 'archived', 'trashed')),
  ADD CONSTRAINT quick_drop_items_item_type_check
    CHECK (item_type IN ('url', 'text', 'mixed', 'pdf', 'image', 'file'));

CREATE INDEX IF NOT EXISTS idx_quick_drop_user_archived_at
  ON public.quick_drop_items (user_id, archived_at DESC)
  WHERE status = 'archived';

-- Update INSERT / UPDATE RLS policies so attachment-only drops (empty text, valid attachment) pass
DROP POLICY IF EXISTS quick_drop_insert_own ON public.quick_drop_items;
DROP POLICY IF EXISTS quick_drop_update_own ON public.quick_drop_items;

CREATE POLICY quick_drop_insert_own ON public.quick_drop_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_verified_firebase_user()
    AND user_id = public.firebase_uid()
    AND length(trim(id)) >= 4
    AND (
      length(trim(content)) > 0
      OR length(trim(attachment_path)) > 0
      OR length(trim(attachment_name)) > 0
    )
  );

CREATE POLICY quick_drop_update_own ON public.quick_drop_items
  FOR UPDATE TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND user_id = public.firebase_uid()
  )
  WITH CHECK (
    public.is_verified_firebase_user()
    AND user_id = public.firebase_uid()
    AND (
      length(trim(content)) > 0
      OR length(trim(attachment_path)) > 0
      OR length(trim(attachment_name)) > 0
    )
  );

-- Update server-side 24-hour expiration archival to move items to Archive ('archived'), NOT Trash
CREATE OR REPLACE FUNCTION public.archive_expired_quick_drop_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  moved_count integer := 0;
BEGIN
  UPDATE public.quick_drop_items
  SET
    status = 'archived',
    archived_at = COALESCE(archived_at, expires_at, now()),
    updated_at = now()
  WHERE status = 'active'
    AND expires_at <= now();

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_expired_quick_drop_items() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.archive_my_expired_quick_drop_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid text := public.firebase_uid();
  moved_count integer := 0;
BEGIN
  IF NOT public.is_verified_firebase_user() OR uid IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.quick_drop_items
  SET
    status = 'archived',
    archived_at = COALESCE(archived_at, expires_at, now()),
    updated_at = now()
  WHERE user_id = uid
    AND status = 'active'
    AND expires_at <= now();

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_my_expired_quick_drop_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_my_expired_quick_drop_items() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Private Per-User Storage RLS for Quick Drop Attachments (All Authenticated Users)
-- Strictly scoped to `{firebase_uid}/quick-drop/...` inside `study-files` and `user-images`
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS quick_drop_storage_select_own ON storage.objects;
DROP POLICY IF EXISTS quick_drop_storage_insert_own ON storage.objects;
DROP POLICY IF EXISTS quick_drop_storage_update_own ON storage.objects;
DROP POLICY IF EXISTS quick_drop_storage_delete_own ON storage.objects;

CREATE POLICY quick_drop_storage_select_own ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND bucket_id IN ('study-files', 'user-images')
    AND (storage.foldername(name))[1] = public.firebase_uid()
    AND (storage.foldername(name))[2] = 'quick-drop'
  );

CREATE POLICY quick_drop_storage_insert_own ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_verified_firebase_user()
    AND bucket_id IN ('study-files', 'user-images')
    AND (storage.foldername(name))[1] = public.firebase_uid()
    AND (storage.foldername(name))[2] = 'quick-drop'
  );

CREATE POLICY quick_drop_storage_update_own ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND bucket_id IN ('study-files', 'user-images')
    AND (storage.foldername(name))[1] = public.firebase_uid()
    AND (storage.foldername(name))[2] = 'quick-drop'
  )
  WITH CHECK (
    public.is_verified_firebase_user()
    AND bucket_id IN ('study-files', 'user-images')
    AND (storage.foldername(name))[1] = public.firebase_uid()
    AND (storage.foldername(name))[2] = 'quick-drop'
  );

CREATE POLICY quick_drop_storage_delete_own ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND bucket_id IN ('study-files', 'user-images')
    AND (storage.foldername(name))[1] = public.firebase_uid()
    AND (storage.foldername(name))[2] = 'quick-drop'
  );
