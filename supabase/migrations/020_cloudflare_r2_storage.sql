-- ============================================================================
-- Migration 020: Cloudflare R2 External Storage Provider Metadata Support
-- ============================================================================
-- Preserves all existing Supabase Storage records (defaulting to 'supabase')
-- while adapting existing tables for Cloudflare R2 object keys, bucket names,
-- original filenames, exact file sizes, upload status, and dual-provider support.
-- Safe & lock-aware: uses SET lock_timeout = '8s' and idempotent guards.
-- ============================================================================

SET lock_timeout = '8s';

-- 1. Adapt public.file_attachments with R2 + normalized metadata columns
ALTER TABLE public.file_attachments
  ADD COLUMN IF NOT EXISTS original_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS object_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bucket_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_size bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS module text NOT NULL DEFAULT 'library',
  ADD COLUMN IF NOT EXISTS upload_status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS r2_etag text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'file_attachments_storage_provider_check'
  ) THEN
    ALTER TABLE public.file_attachments
      ADD CONSTRAINT file_attachments_storage_provider_check
      CHECK (storage_provider IN ('supabase', 'r2'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'file_attachments_upload_status_check'
  ) THEN
    ALTER TABLE public.file_attachments
      ADD CONSTRAINT file_attachments_upload_status_check
      CHECK (upload_status IN ('pending', 'completed', 'failed'));
  END IF;
END $$;

-- Backfill normalized columns for existing Supabase rows (non-destructive)
UPDATE public.file_attachments
SET
  original_name = CASE WHEN original_name = '' THEN file_name ELSE original_name END,
  object_key = CASE WHEN object_key = '' THEN storage_path ELSE object_key END,
  bucket_name = CASE WHEN bucket_name = '' THEN storage_bucket ELSE bucket_name END,
  file_size = CASE WHEN file_size = 0 THEN size_bytes ELSE file_size END
WHERE original_name = ''
   OR object_key = ''
   OR bucket_name = ''
   OR (file_size = 0 AND size_bytes > 0);

CREATE INDEX IF NOT EXISTS idx_file_attachments_provider_key
  ON public.file_attachments (owner_id, storage_provider, object_key);

CREATE INDEX IF NOT EXISTS idx_file_attachments_upload_status
  ON public.file_attachments (owner_id, upload_status, updated_at DESC);

-- 2. Adapt public.image_attachments with R2 + normalized metadata columns
ALTER TABLE public.image_attachments
  ADD COLUMN IF NOT EXISTS original_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS object_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bucket_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_size bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS module text NOT NULL DEFAULT 'journal',
  ADD COLUMN IF NOT EXISTS upload_status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS r2_etag text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'image_attachments_storage_provider_check'
  ) THEN
    ALTER TABLE public.image_attachments
      ADD CONSTRAINT image_attachments_storage_provider_check
      CHECK (storage_provider IN ('supabase', 'r2'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'image_attachments_upload_status_check'
  ) THEN
    ALTER TABLE public.image_attachments
      ADD CONSTRAINT image_attachments_upload_status_check
      CHECK (upload_status IN ('pending', 'completed', 'failed'));
  END IF;
END $$;

UPDATE public.image_attachments
SET
  original_name = CASE WHEN original_name = '' THEN file_name ELSE original_name END,
  object_key = CASE WHEN object_key = '' THEN storage_path ELSE object_key END,
  bucket_name = CASE WHEN bucket_name = '' THEN storage_bucket ELSE bucket_name END,
  file_size = CASE WHEN file_size = 0 THEN size_bytes ELSE file_size END
WHERE original_name = ''
   OR object_key = ''
   OR bucket_name = ''
   OR (file_size = 0 AND size_bytes > 0);

CREATE INDEX IF NOT EXISTS idx_image_attachments_provider_key
  ON public.image_attachments (owner_id, storage_provider, object_key);

-- 3. Track storage_provider on catalog/cover entities for seamless dual-provider resolution
ALTER TABLE public.reading_items
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS cover_storage_provider text NOT NULL DEFAULT 'supabase';

ALTER TABLE public.daily_journals
  ADD COLUMN IF NOT EXISTS cover_storage_provider text NOT NULL DEFAULT 'supabase';

ALTER TABLE public.reflections
  ADD COLUMN IF NOT EXISTS image_storage_provider text NOT NULL DEFAULT 'supabase';

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS cover_storage_provider text NOT NULL DEFAULT 'supabase';

ALTER TABLE public.dental_cases
  ADD COLUMN IF NOT EXISTS cover_storage_provider text NOT NULL DEFAULT 'supabase';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reading_items_storage_provider_check'
  ) THEN
    ALTER TABLE public.reading_items
      ADD CONSTRAINT reading_items_storage_provider_check
      CHECK (storage_provider IN ('supabase', 'r2'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reading_items_cover_storage_provider_check'
  ) THEN
    ALTER TABLE public.reading_items
      ADD CONSTRAINT reading_items_cover_storage_provider_check
      CHECK (cover_storage_provider IN ('supabase', 'r2'));
  END IF;
END $$;
