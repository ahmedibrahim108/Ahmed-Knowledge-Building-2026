-- ============================================================================
-- Migration 014: Daily Growth Quote Metadata Column on daily_journals
-- ============================================================================
-- Safe & lock-aware: alters ONLY public.daily_journals using SET lock_timeout = '8s'
-- with nullable jsonb column (instant metadata-only operation in PostgreSQL).

SET lock_timeout = '8s';

ALTER TABLE public.daily_journals
  ADD COLUMN IF NOT EXISTS daily_quote jsonb;
