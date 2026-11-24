-- ============================================================================
-- Migration 012: Daily Journals, Activity Logs, Period Reviews (Sat-Fri),
-- Weekly Planner, Saved Pin Collections, Postponed Task Status & Contact Us
-- ============================================================================
-- NOTE FOR SUPABASE SQL EDITOR:
-- Run each STEP block separately (or one by one) to avoid 40P01 lock contention
-- while the live app reads concurrently. Each STEP uses lock_timeout = '8s'
-- and avoids cross-table foreign keys to user_profiles.

-- ----------------------------------------------------------------------------
-- STEP 1: Allow 'postponed' status on unified_tasks (locks ONLY unified_tasks)
-- ----------------------------------------------------------------------------
SET lock_timeout = '8s';
DO $$
DECLARE
  c_name text;
BEGIN
  FOR c_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.unified_tasks'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%in_progress%'
  LOOP
    EXECUTE format('ALTER TABLE public.unified_tasks DROP CONSTRAINT IF EXISTS %I', c_name);
  END LOOP;
  ALTER TABLE public.unified_tasks
    ADD CONSTRAINT unified_tasks_status_check
    CHECK (status IN ('todo', 'in_progress', 'postponed', 'done'));
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2: Activity Logs Table (dated references for Daily Journal & Reviews)
-- ----------------------------------------------------------------------------
SET lock_timeout = '8s';
CREATE TABLE IF NOT EXISTS public.activity_logs (
  owner_id text NOT NULL,
  id text NOT NULL,
  date_key text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  hub_id text NOT NULL DEFAULT 'knowledge',
  status_snapshot text NOT NULL DEFAULT '',
  occurred_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_owner_date
  ON public.activity_logs (owner_id, date_key DESC, occurred_at_ms DESC);

DROP TRIGGER IF EXISTS trg_activity_logs_updated_at ON public.activity_logs;
CREATE TRIGGER trg_activity_logs_updated_at
  BEFORE UPDATE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activity_logs TO anon, authenticated;

DROP POLICY IF EXISTS activity_logs_admin_policy ON public.activity_logs;
CREATE POLICY activity_logs_admin_policy ON public.activity_logs
  FOR ALL TO anon, authenticated
  USING (public.is_verified_admin() AND owner_id = public.firebase_uid())
  WITH CHECK (public.is_verified_admin() AND owner_id = public.firebase_uid());

ALTER TABLE public.activity_logs REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 3: Daily Journals Table (One unique row per user + local date_key)
-- ----------------------------------------------------------------------------
SET lock_timeout = '8s';
CREATE TABLE IF NOT EXISTS public.daily_journals (
  owner_id text NOT NULL,
  date_key text NOT NULL,
  reflection_text text NOT NULL DEFAULT '',
  highlights_text text NOT NULL DEFAULT '',
  mood_label text NOT NULL DEFAULT '',
  energy_score integer,
  updated_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, date_key)
);

DROP TRIGGER IF EXISTS trg_daily_journals_updated_at ON public.daily_journals;
CREATE TRIGGER trg_daily_journals_updated_at
  BEFORE UPDATE ON public.daily_journals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.daily_journals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_journals TO anon, authenticated;

DROP POLICY IF EXISTS daily_journals_admin_policy ON public.daily_journals;
CREATE POLICY daily_journals_admin_policy ON public.daily_journals
  FOR ALL TO anon, authenticated
  USING (public.is_verified_admin() AND owner_id = public.firebase_uid())
  WITH CHECK (public.is_verified_admin() AND owner_id = public.firebase_uid());

ALTER TABLE public.daily_journals REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_journals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 4: Period Reviews Table (Weekly Sat-Fri, Monthly, Quarterly, Yearly)
-- ----------------------------------------------------------------------------
SET lock_timeout = '8s';
CREATE TABLE IF NOT EXISTS public.period_reviews (
  owner_id text NOT NULL,
  id text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  period_key text NOT NULL,
  period_start_key text NOT NULL,
  period_end_key text NOT NULL,
  reflection_text text NOT NULL DEFAULT '',
  adjustments_text text NOT NULL DEFAULT '',
  next_period_focus_text text NOT NULL DEFAULT '',
  rating integer,
  updated_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, period_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_period_reviews_owner_type
  ON public.period_reviews (owner_id, period_type, period_start_key DESC);

DROP TRIGGER IF EXISTS trg_period_reviews_updated_at ON public.period_reviews;
CREATE TRIGGER trg_period_reviews_updated_at
  BEFORE UPDATE ON public.period_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.period_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.period_reviews TO anon, authenticated;

DROP POLICY IF EXISTS period_reviews_admin_policy ON public.period_reviews;
CREATE POLICY period_reviews_admin_policy ON public.period_reviews
  FOR ALL TO anon, authenticated
  USING (public.is_verified_admin() AND owner_id = public.firebase_uid())
  WITH CHECK (public.is_verified_admin() AND owner_id = public.firebase_uid());

ALTER TABLE public.period_reviews REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.period_reviews;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 5: Weekly Plans Table (Sat-Fri Weekly Planning linking UnifiedTasks)
-- ----------------------------------------------------------------------------
SET lock_timeout = '8s';
CREATE TABLE IF NOT EXISTS public.weekly_plans (
  owner_id text NOT NULL,
  week_key text NOT NULL,
  week_start_key text NOT NULL,
  week_end_key text NOT NULL,
  focus_hub_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  focus_course_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_task_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  planned_at_ms bigint NOT NULL DEFAULT 0,
  updated_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, week_key)
);

DROP TRIGGER IF EXISTS trg_weekly_plans_updated_at ON public.weekly_plans;
CREATE TRIGGER trg_weekly_plans_updated_at
  BEFORE UPDATE ON public.weekly_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.weekly_plans TO anon, authenticated;

DROP POLICY IF EXISTS weekly_plans_admin_policy ON public.weekly_plans;
CREATE POLICY weekly_plans_admin_policy ON public.weekly_plans
  FOR ALL TO anon, authenticated
  USING (public.is_verified_admin() AND owner_id = public.firebase_uid())
  WITH CHECK (public.is_verified_admin() AND owner_id = public.firebase_uid());

ALTER TABLE public.weekly_plans REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_plans;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 6: Saved Pin Collections Table (Customizable Pin Focus Lists)
-- ----------------------------------------------------------------------------
SET lock_timeout = '8s';
CREATE TABLE IF NOT EXISTS public.pin_collections (
  owner_id text NOT NULL,
  id text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  color_key text NOT NULL DEFAULT 'navy',
  sort_order integer NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at_ms bigint NOT NULL DEFAULT 0,
  updated_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

DROP TRIGGER IF EXISTS trg_pin_collections_updated_at ON public.pin_collections;
CREATE TRIGGER trg_pin_collections_updated_at
  BEFORE UPDATE ON public.pin_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pin_collections ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pin_collections TO anon, authenticated;

DROP POLICY IF EXISTS pin_collections_admin_policy ON public.pin_collections;
CREATE POLICY pin_collections_admin_policy ON public.pin_collections
  FOR ALL TO anon, authenticated
  USING (public.is_verified_admin() AND owner_id = public.firebase_uid())
  WITH CHECK (public.is_verified_admin() AND owner_id = public.firebase_uid());

ALTER TABLE public.pin_collections REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pin_collections;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 7: Contact Us Messages Table (Public insert, Admin-only read/manage)
-- ----------------------------------------------------------------------------
SET lock_timeout = '8s';
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id text PRIMARY KEY,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  created_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created
  ON public.contact_messages (created_at_ms DESC);

DROP TRIGGER IF EXISTS trg_contact_messages_updated_at ON public.contact_messages;
CREATE TRIGGER trg_contact_messages_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contact_messages TO anon, authenticated;

DROP POLICY IF EXISTS contact_messages_insert_policy ON public.contact_messages;
CREATE POLICY contact_messages_insert_policy ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(trim(sender_name)) BETWEEN 2 AND 120
    AND char_length(trim(sender_email)) BETWEEN 5 AND 160
    AND char_length(trim(message)) BETWEEN 5 AND 3500
    AND status = 'unread'
  );

DROP POLICY IF EXISTS contact_messages_admin_select ON public.contact_messages;
CREATE POLICY contact_messages_admin_select ON public.contact_messages
  FOR SELECT TO anon, authenticated
  USING (public.is_verified_admin());

DROP POLICY IF EXISTS contact_messages_admin_update ON public.contact_messages;
CREATE POLICY contact_messages_admin_update ON public.contact_messages
  FOR UPDATE TO anon, authenticated
  USING (public.is_verified_admin())
  WITH CHECK (public.is_verified_admin());

DROP POLICY IF EXISTS contact_messages_admin_delete ON public.contact_messages;
CREATE POLICY contact_messages_admin_delete ON public.contact_messages
  FOR DELETE TO anon, authenticated
  USING (public.is_verified_admin());
