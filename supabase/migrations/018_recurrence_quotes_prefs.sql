-- Migration 018: Unified Task Recurrence, Completed Occurrence Dates & Extra User Preferences (Lock-safe)
SET lock_timeout = '8s';

ALTER TABLE public.unified_tasks
  ADD COLUMN IF NOT EXISTS recurrence jsonb;

ALTER TABLE public.unified_tasks
  ADD COLUMN IF NOT EXISTS completed_occurrence_dates jsonb NOT NULL DEFAULT '[]'::jsonb;

SET lock_timeout = '8s';

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS extra_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
