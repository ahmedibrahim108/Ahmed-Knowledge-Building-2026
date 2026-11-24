-- ============================================================================
-- Migration 013: Visual Journal & Personal Diary Gallery Columns on daily_journals
-- ============================================================================
-- Safe & lock-aware: alters ONLY public.daily_journals using SET lock_timeout = '8s'
-- and constant defaults (instant metadata update in PostgreSQL 11+, no full-table rewrite).
-- Photos reuse existing public.image_attachments (`scope_key = 'journal:' || date_key`)
-- and private Supabase Storage bucket `user-images`.
-- Voice recordings reuse existing public.audio_cache (`entity_id = 'journal:' || date_key`)
-- and private Supabase Storage bucket `audio-cache`.

SET lock_timeout = '8s';

ALTER TABLE public.daily_journals
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body_html text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quick_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS card_color text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS cover_image_storage_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cover_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cover_frame jsonb;
