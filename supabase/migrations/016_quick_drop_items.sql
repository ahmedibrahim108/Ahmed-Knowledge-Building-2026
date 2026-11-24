-- ============================================================================
-- Migration 016: Quick Drop — Cross-Device Temporary Sharing Inbox
-- ============================================================================
-- Features:
--   1. Dedicated `public.quick_drop_items` table storing per-user temporary
--      links/notes with automatic 24-hour expiration (`expires_at`).
--   2. Strict Row Level Security (RLS): every authenticated Firebase user
--      (`public.is_verified_firebase_user()`) can read/write ONLY their own
--      rows (`user_id = public.firebase_uid()`). Zero cross-user access.
--   3. Server-side automatic 24-hour archiving:
--      - `public.archive_expired_quick_drop_items()` moves expired active
--        items (`expires_at <= now()`) to `status = 'trashed'` with
--        `trashed_at = COALESCE(trashed_at, expires_at, now())`.
--      - Scheduled every 5 minutes via `pg_cron` (when available) so expired
--        items are archived even when no client opens the app.
--      - `public.archive_my_expired_quick_drop_items()` lets authenticated
--        clients trigger expiration archival for their own rows on load/focus.
--   4. Realtime replication enabled for instant cross-device updates.
--   5. Deadlock-safe (`SET lock_timeout = '8s'`, no cross-table FK locks).
-- ============================================================================

SET lock_timeout = '8s';

CREATE TABLE IF NOT EXISTS public.quick_drop_items (
  id text NOT NULL,
  user_id text NOT NULL DEFAULT public.firebase_uid(),
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  item_type text NOT NULL DEFAULT 'text' CHECK (item_type IN ('url', 'text', 'mixed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trashed')),
  trashed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_quick_drop_user_status_created
  ON public.quick_drop_items (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quick_drop_active_expires
  ON public.quick_drop_items (expires_at ASC)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_quick_drop_items_updated_at ON public.quick_drop_items;
CREATE TRIGGER trg_quick_drop_items_updated_at
  BEFORE UPDATE ON public.quick_drop_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.quick_drop_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quick_drop_items TO anon, authenticated;

DROP POLICY IF EXISTS quick_drop_select_own ON public.quick_drop_items;
DROP POLICY IF EXISTS quick_drop_insert_own ON public.quick_drop_items;
DROP POLICY IF EXISTS quick_drop_update_own ON public.quick_drop_items;
DROP POLICY IF EXISTS quick_drop_delete_own ON public.quick_drop_items;

CREATE POLICY quick_drop_select_own ON public.quick_drop_items
  FOR SELECT TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND user_id = public.firebase_uid()
  );

CREATE POLICY quick_drop_insert_own ON public.quick_drop_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_verified_firebase_user()
    AND user_id = public.firebase_uid()
    AND length(trim(id)) >= 4
    AND length(trim(content)) > 0
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
    AND length(trim(content)) > 0
  );

CREATE POLICY quick_drop_delete_own ON public.quick_drop_items
  FOR DELETE TO anon, authenticated
  USING (
    public.is_verified_firebase_user()
    AND user_id = public.firebase_uid()
  );

ALTER TABLE public.quick_drop_items REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_drop_items;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ----------------------------------------------------------------------------
-- Server-side automatic 24-hour archiving functions
-- ----------------------------------------------------------------------------

-- System-wide cron worker function (never exposed to browser anon/authenticated roles)
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
    status = 'trashed',
    trashed_at = COALESCE(trashed_at, expires_at, now()),
    updated_at = now()
  WHERE status = 'active'
    AND expires_at <= now();

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_expired_quick_drop_items() FROM PUBLIC, anon, authenticated;

-- User-scoped RPC callable on app load/focus as an immediate complement to cron
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
    status = 'trashed',
    trashed_at = COALESCE(trashed_at, expires_at, now()),
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
-- Background pg_cron schedule (runs every 5 minutes autonomously on server)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if pg_cron extension requires dashboard toggle or isn't preloaded
    NULL;
  END;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    SELECT jobid INTO existing_job_id
    FROM cron.job
    WHERE jobname = 'quick_drop_archive_expired_items'
    LIMIT 1;

    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;

    PERFORM cron.schedule(
      'quick_drop_archive_expired_items',
      '*/5 * * * *',
      $cron$SELECT public.archive_expired_quick_drop_items();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Non-fatal so table, RLS, and RPC still apply cleanly if pg_cron is disabled
  NULL;
END $$;
