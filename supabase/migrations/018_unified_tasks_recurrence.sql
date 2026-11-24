-- ============================================================================
-- Migration 018: Unified Tasks Recurrence Rule & Series Tracking
-- ============================================================================
-- Adds additive recurrence metadata to `public.unified_tasks`:
--   - `recurrence` (jsonb): frequency, interval, weekdays, endType, endAfterCount, endDate
--   - `recurrence_series_id` (text): groups all generated occurrences of a recurring task
--   - `recurrence_occurrence_date` (text): YYYY-MM-DD key for deterministic deduplication
-- ============================================================================

SET lock_timeout = '8s';

ALTER TABLE public.unified_tasks
  ADD COLUMN IF NOT EXISTS recurrence jsonb,
  ADD COLUMN IF NOT EXISTS recurrence_series_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recurrence_occurrence_date text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_unified_tasks_recurrence_series
  ON public.unified_tasks (owner_id, recurrence_series_id, recurrence_occurrence_date)
  WHERE recurrence_series_id <> '';
