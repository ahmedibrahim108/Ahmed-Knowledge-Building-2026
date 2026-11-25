-- Migration 017: Quick Drop Image & PDF Attachments (Lock-safe)
SET lock_timeout = '8s';

ALTER TABLE public.quick_drop_items
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
