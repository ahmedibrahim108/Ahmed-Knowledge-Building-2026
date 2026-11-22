-- ============================================================================
-- Mizan Knowledge (ميزان المعرفة) — Supabase PostgreSQL Schema & RLS
-- Authentication Provider: Firebase Authentication (Third-Party Auth JWT)
-- Firebase UID is read via auth.jwt()->>'sub'
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper: returns authenticated Firebase UID from JWT sub claim (NULL if anonymous/unauthenticated)
CREATE OR REPLACE FUNCTION public.firebase_uid()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(auth.jwt()->>'sub', '');
$$;

-- Helper: updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. User Profiles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  uid text PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  photo_url text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Quarters (الأرباع السنوية)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quarters (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  number integer NOT NULL,
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_quarters_owner_number ON public.quarters (owner_id, number);

DROP TRIGGER IF EXISTS trg_quarters_updated_at ON public.quarters;
CREATE TRIGGER trg_quarters_updated_at
  BEFORE UPDATE ON public.quarters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Domains (المحاور المعرفية)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.domains (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  hub_id text NOT NULL DEFAULT 'knowledge' CHECK (hub_id IN ('marketing', 'dental_career', 'knowledge')),
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  purpose text NOT NULL DEFAULT '',
  thinkers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_domains_owner_order ON public.domains (owner_id, sort_order);

DROP TRIGGER IF EXISTS trg_domains_updated_at ON public.domains;
CREATE TRIGGER trg_domains_updated_at
  BEFORE UPDATE ON public.domains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Months / Plan Units (الخطط الشهرية / الوحدات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.months (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  doc_id text NOT NULL,
  month_number integer NOT NULL,
  hub_id text NOT NULL DEFAULT 'knowledge' CHECK (hub_id IN ('marketing', 'dental_career', 'knowledge')),
  quarter integer NOT NULL DEFAULT 1,
  quarter_title text NOT NULL DEFAULT '',
  theme text NOT NULL DEFAULT '',
  foundational jsonb NOT NULL DEFAULT '{}'::jsonb,
  exploratory jsonb NOT NULL DEFAULT '{}'::jsonb,
  course_id integer NOT NULL DEFAULT 0,
  discussion_prompt text NOT NULL DEFAULT '',
  application_task text NOT NULL DEFAULT '',
  activities jsonb NOT NULL DEFAULT '{"reading":false,"listening":false,"summarizing":false,"discussing":false}'::jsonb,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  notes text NOT NULL DEFAULT '',
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  reading_modes text[] NOT NULL DEFAULT '{}',
  learning_methods text[] NOT NULL DEFAULT '{}',
  review_count integer NOT NULL DEFAULT 0,
  listen_count integer NOT NULL DEFAULT 0,
  repetition_stage integer NOT NULL DEFAULT 0,
  next_review_date_key text NOT NULL DEFAULT '',
  last_reviewed_date_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_months_owner_num ON public.months (owner_id, month_number);

DROP TRIGGER IF EXISTS trg_months_updated_at ON public.months;
CREATE TRIGGER trg_months_updated_at
  BEFORE UPDATE ON public.months
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Courses (الكورسات والمساقات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  doc_id text NOT NULL,
  course_number integer NOT NULL,
  hub_id text NOT NULL DEFAULT 'knowledge' CHECK (hub_id IN ('marketing', 'dental_career', 'knowledge')),
  title text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  study_stage text NOT NULL DEFAULT 'in_progress' CHECK (study_stage IN ('focus_now', 'in_progress', 'scheduled_later', 'deferred', 'heard_before', 'completed')),
  scheduled_period text NOT NULL DEFAULT '',
  instructor text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT '',
  duration_label text NOT NULL DEFAULT '',
  start_date text NOT NULL DEFAULT '',
  target_date text NOT NULL DEFAULT '',
  progress_pct integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  linked_months integer[] NOT NULL DEFAULT '{}',
  complementary_book text NOT NULL DEFAULT '',
  book_author text NOT NULL DEFAULT '',
  application_milestone text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  reading_modes text[] NOT NULL DEFAULT '{}',
  learning_methods text[] NOT NULL DEFAULT '{}',
  review_count integer NOT NULL DEFAULT 0,
  listen_count integer NOT NULL DEFAULT 0,
  repetition_stage integer NOT NULL DEFAULT 0,
  next_review_date_key text NOT NULL DEFAULT '',
  last_reviewed_date_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_courses_owner_num ON public.courses (owner_id, course_number);
CREATE INDEX IF NOT EXISTS idx_courses_owner_stage ON public.courses (owner_id, study_stage);

DROP TRIGGER IF EXISTS trg_courses_updated_at ON public.courses;
CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Book / Lecture / General Notes (الملاحظات والتلخيصات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.book_notes (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  hub_id text NOT NULL DEFAULT 'knowledge' CHECK (hub_id IN ('marketing', 'dental_career', 'knowledge')),
  note_type text NOT NULL DEFAULT 'book' CHECK (note_type IN ('book', 'course_lecture', 'general')),
  note_color text NOT NULL DEFAULT 'default' CHECK (note_color IN ('default', 'navy', 'emerald', 'amber', 'rose', 'violet')),
  book_title text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  course_id integer NOT NULL DEFAULT 0,
  course_title text NOT NULL DEFAULT '',
  lecture_title text NOT NULL DEFAULT '',
  category_label text NOT NULL DEFAULT '',
  progress_marker text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  quotes text NOT NULL DEFAULT '',
  updated_at_label text NOT NULL DEFAULT '',
  reading_modes text[] NOT NULL DEFAULT '{}',
  learning_methods text[] NOT NULL DEFAULT '{}',
  review_count integer NOT NULL DEFAULT 0,
  listen_count integer NOT NULL DEFAULT 0,
  repetition_stage integer NOT NULL DEFAULT 0,
  next_review_date_key text NOT NULL DEFAULT '',
  last_reviewed_date_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_book_notes_owner_course ON public.book_notes (owner_id, course_id);
CREATE INDEX IF NOT EXISTS idx_book_notes_owner_hub ON public.book_notes (owner_id, hub_id);

DROP TRIGGER IF EXISTS trg_book_notes_updated_at ON public.book_notes;
CREATE TRIGGER trg_book_notes_updated_at
  BEFORE UPDATE ON public.book_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. Custom Categories (التصنيفات المخصصة)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_categories (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  hub_id text NOT NULL DEFAULT 'all' CHECK (hub_id IN ('all', 'marketing', 'dental_career', 'knowledge')),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'navy' CHECK (color IN ('navy', 'emerald', 'amber', 'slate')),
  created_at_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

DROP TRIGGER IF EXISTS trg_custom_categories_updated_at ON public.custom_categories;
CREATE TRIGGER trg_custom_categories_updated_at
  BEFORE UPDATE ON public.custom_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. Study History (سجل النشاط)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_history (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  action_type text NOT NULL DEFAULT 'note' CHECK (action_type IN ('note', 'voice', 'task', 'course', 'domain', 'month')),
  title text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  target_tab text NOT NULL DEFAULT 'overview',
  target_note_id text NOT NULL DEFAULT '',
  target_month_id integer NOT NULL DEFAULT 0,
  target_course_id integer NOT NULL DEFAULT 0,
  timestamp_label text NOT NULL DEFAULT '',
  created_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_study_history_owner_ms ON public.study_history (owner_id, created_at_ms DESC);

DROP TRIGGER IF EXISTS trg_study_history_updated_at ON public.study_history;
CREATE TRIGGER trg_study_history_updated_at
  BEFORE UPDATE ON public.study_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 9. User Preferences (التفضيلات والإعدادات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL DEFAULT 'settings',
  note_font_size text NOT NULL DEFAULT 'base' CHECK (note_font_size IN ('sm', 'base', 'lg')),
  note_highlight_color text NOT NULL DEFAULT 'amber' CHECK (note_highlight_color IN ('amber', 'emerald', 'sky', 'rose')),
  note_paper_tone text NOT NULL DEFAULT 'clean' CHECK (note_paper_tone IN ('clean', 'warm', 'slate')),
  note_margin text NOT NULL DEFAULT 'normal' CHECK (note_margin IN ('compact', 'normal', 'wide', 'spacious')),
  note_width text NOT NULL DEFAULT 'focused' CHECK (note_width IN ('focused', 'balanced', 'full')),
  note_border text NOT NULL DEFAULT 'subtle' CHECK (note_border IN ('none', 'subtle', 'medium', 'framed')),
  auto_add_timestamp_on_voice boolean NOT NULL DEFAULT false,
  voice_dialect text NOT NULL DEFAULT 'standard_arabic' CHECK (voice_dialect IN ('standard_arabic', 'egyptian_arabic', 'bilingual')),
  voice_insert_mode text NOT NULL DEFAULT 'append_paragraph' CHECK (voice_insert_mode IN ('append_paragraph', 'append_bullet', 'append_quote')),
  read_aloud_voice text NOT NULL DEFAULT 'Kore' CHECK (read_aloud_voice IN ('Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr')),
  read_aloud_speed text NOT NULL DEFAULT 'normal' CHECK (read_aloud_speed IN ('normal', 'calm')),
  show_excel_export boolean NOT NULL DEFAULT true,
  hub_categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  calendar_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 10. Personal Reflections (الخواطر والتأملات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reflections (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  mood_tag text NOT NULL DEFAULT 'تأمل' CHECK (mood_tag IN ('تأمل', 'فكرة', 'امتنان', 'هدف')),
  pinned boolean NOT NULL DEFAULT false,
  created_at_label text NOT NULL DEFAULT '',
  created_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_reflections_owner_pinned_ms ON public.reflections (owner_id, pinned DESC, created_at_ms DESC);

DROP TRIGGER IF EXISTS trg_reflections_updated_at ON public.reflections;
CREATE TRIGGER trg_reflections_updated_at
  BEFORE UPDATE ON public.reflections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 11. Calendar Events (أحداث التقويم)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_events (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  date_key text NOT NULL DEFAULT '',
  time_slot text NOT NULL DEFAULT '',
  end_time text NOT NULL DEFAULT '',
  duration_minutes integer,
  title text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'شخصي' CHECK (category IN ('شخصي', 'دراسة', 'موعد', 'مراجعة', 'قراءة')),
  color text NOT NULL DEFAULT 'navy' CHECK (color IN ('navy', 'emerald', 'amber', 'rose')),
  done boolean NOT NULL DEFAULT false,
  linked_task_text text NOT NULL DEFAULT '',
  linked_task_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_date ON public.calendar_events (owner_id, date_key, time_slot);

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 12. Learning Paths (مسارات التعلم)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_paths (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  hub_id text NOT NULL DEFAULT 'knowledge' CHECK (hub_id IN ('marketing', 'dental_career', 'knowledge')),
  category_label text NOT NULL DEFAULT '',
  objectives text NOT NULL DEFAULT '',
  current_level text NOT NULL DEFAULT '',
  target_level text NOT NULL DEFAULT '',
  start_date text NOT NULL DEFAULT '',
  expected_completion_date text NOT NULL DEFAULT '',
  progress_pct integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_course_ids integer[] NOT NULL DEFAULT '{}',
  reading_modes text[] NOT NULL DEFAULT '{}',
  learning_methods text[] NOT NULL DEFAULT '{}',
  review_count integer NOT NULL DEFAULT 0,
  listen_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

DROP TRIGGER IF EXISTS trg_learning_paths_updated_at ON public.learning_paths;
CREATE TRIGGER trg_learning_paths_updated_at
  BEFORE UPDATE ON public.learning_paths
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 13. Reading Library Items (مكتبة القراءة والملفات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reading_items (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  title text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  hub_id text NOT NULL DEFAULT 'knowledge' CHECK (hub_id IN ('marketing', 'dental_career', 'knowledge')),
  category_label text NOT NULL DEFAULT '',
  item_type text NOT NULL DEFAULT 'كتاب',
  status text NOT NULL DEFAULT 'to_read' CHECK (status IN ('to_read', 'reading', 'completed')),
  current_page integer NOT NULL DEFAULT 0,
  total_pages integer NOT NULL DEFAULT 0,
  takeaways text NOT NULL DEFAULT '',
  attachment_name text NOT NULL DEFAULT '',
  attachment_resource_id text NOT NULL DEFAULT '',
  storage_bucket text NOT NULL DEFAULT 'study-files',
  storage_path text NOT NULL DEFAULT '',
  download_url text NOT NULL DEFAULT '',
  external_url text NOT NULL DEFAULT '',
  reading_modes text[] NOT NULL DEFAULT '{}',
  learning_methods text[] NOT NULL DEFAULT '{}',
  review_count integer NOT NULL DEFAULT 0,
  listen_count integer NOT NULL DEFAULT 0,
  repetition_stage integer NOT NULL DEFAULT 0,
  next_review_date_key text NOT NULL DEFAULT '',
  last_reviewed_date_key text NOT NULL DEFAULT '',
  updated_at_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_reading_items_owner_hub ON public.reading_items (owner_id, hub_id);

DROP TRIGGER IF EXISTS trg_reading_items_updated_at ON public.reading_items;
CREATE TRIGGER trg_reading_items_updated_at
  BEFORE UPDATE ON public.reading_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 14. Practical Projects (المشاريع التطبيقية)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practical_projects (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  hub_id text NOT NULL DEFAULT 'knowledge' CHECK (hub_id IN ('marketing', 'dental_career', 'knowledge')),
  category_label text NOT NULL DEFAULT '',
  objectives text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  progress_pct integer NOT NULL DEFAULT 0,
  deliverables text NOT NULL DEFAULT '',
  start_date text NOT NULL DEFAULT '',
  target_date text NOT NULL DEFAULT '',
  linked_course_id integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_practical_projects_owner_course ON public.practical_projects (owner_id, linked_course_id);

DROP TRIGGER IF EXISTS trg_practical_projects_updated_at ON public.practical_projects;
CREATE TRIGGER trg_practical_projects_updated_at
  BEFORE UPDATE ON public.practical_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 15. Unified Tasks (المهام الموحدة)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unified_tasks (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  hub_id text NOT NULL DEFAULT 'knowledge' CHECK (hub_id IN ('marketing', 'dental_career', 'knowledge')),
  category_label text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date text NOT NULL DEFAULT '',
  scheduled_date text NOT NULL DEFAULT '',
  start_time text NOT NULL DEFAULT '',
  end_time text NOT NULL DEFAULT '',
  duration_minutes integer,
  deadline text NOT NULL DEFAULT '',
  project_id text NOT NULL DEFAULT '',
  linked_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_unified_tasks_owner_status ON public.unified_tasks (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_unified_tasks_owner_sched ON public.unified_tasks (owner_id, scheduled_date);

DROP TRIGGER IF EXISTS trg_unified_tasks_updated_at ON public.unified_tasks;
CREATE TRIGGER trg_unified_tasks_updated_at
  BEFORE UPDATE ON public.unified_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 16. Weekly Meetings (اللقاءات الأسبوعية)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_meetings (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  hub_id text NOT NULL DEFAULT 'knowledge' CHECK (hub_id IN ('marketing', 'dental_career', 'knowledge')),
  start_date text NOT NULL DEFAULT '',
  day_of_week integer NOT NULL DEFAULT 6,
  start_time text NOT NULL DEFAULT '18:00',
  end_time text NOT NULL DEFAULT '19:00',
  duration_minutes integer NOT NULL DEFAULT 60,
  is_recurring_weekly boolean NOT NULL DEFAULT true,
  recurrence_end_date text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'navy' CHECK (color IN ('navy', 'emerald', 'amber', 'rose')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  completed_dates text[] NOT NULL DEFAULT '{}',
  attendance_by_date jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes_by_date jsonb NOT NULL DEFAULT '{}'::jsonb,
  follow_ups jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_task_ids text[] NOT NULL DEFAULT '{}',
  exceptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_meetings_owner_start ON public.weekly_meetings (owner_id, start_date);

DROP TRIGGER IF EXISTS trg_weekly_meetings_updated_at ON public.weekly_meetings;
CREATE TRIGGER trg_weekly_meetings_updated_at
  BEFORE UPDATE ON public.weekly_meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 17. Dental Cases (حالات طب الأسنان الإكلينيكية)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dental_cases (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  title text NOT NULL DEFAULT '',
  specialty text NOT NULL DEFAULT '',
  patient_summary text NOT NULL DEFAULT '',
  procedure_details text NOT NULL DEFAULT '',
  case_date text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'follow_up', 'completed')),
  cover_image_url text NOT NULL DEFAULT '',
  cover_storage_bucket text NOT NULL DEFAULT 'user-images',
  cover_storage_path text NOT NULL DEFAULT '',
  cover_data_url text NOT NULL DEFAULT '',
  linked_course_id integer NOT NULL DEFAULT 0,
  updated_at_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_dental_cases_owner_date ON public.dental_cases (owner_id, case_date DESC);

DROP TRIGGER IF EXISTS trg_dental_cases_updated_at ON public.dental_cases;
CREATE TRIGGER trg_dental_cases_updated_at
  BEFORE UPDATE ON public.dental_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 18. File Attachments Metadata (ملفات PDF و Word والمستندات — Binary stored in Supabase Storage `study-files`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.file_attachments (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  file_name text NOT NULL DEFAULT 'document.pdf',
  mime_type text NOT NULL DEFAULT 'application/pdf',
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_bucket text NOT NULL DEFAULT 'study-files',
  storage_path text NOT NULL DEFAULT '',
  download_url text NOT NULL DEFAULT '',
  extracted_preview text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_file_attachments_owner_updated ON public.file_attachments (owner_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_file_attachments_updated_at ON public.file_attachments;
CREATE TRIGGER trg_file_attachments_updated_at
  BEFORE UPDATE ON public.file_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 19. Image Attachments Metadata (الصور والمخططات — Binary stored in Supabase Storage `user-images`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.image_attachments (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  scope_key text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT 'image.jpg',
  mime_type text NOT NULL DEFAULT 'image/jpeg',
  size_bytes bigint NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 0,
  height integer NOT NULL DEFAULT 0,
  caption text NOT NULL DEFAULT '',
  storage_bucket text NOT NULL DEFAULT 'user-images',
  storage_path text NOT NULL DEFAULT '',
  download_url text NOT NULL DEFAULT '',
  created_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_image_attachments_owner_scope ON public.image_attachments (owner_id, scope_key, created_at_ms DESC);

DROP TRIGGER IF EXISTS trg_image_attachments_updated_at ON public.image_attachments;
CREATE TRIGGER trg_image_attachments_updated_at
  BEFORE UPDATE ON public.image_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 20. Audio Cache Metadata (الاستماع السحابي والتلخيصات الصوتية — Binary stored in Supabase Storage `audio-cache`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audio_cache (
  owner_id text NOT NULL DEFAULT public.firebase_uid() REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  id text NOT NULL,
  entity_type text NOT NULL DEFAULT 'general' CHECK (entity_type IN ('note', 'course', 'month', 'summary', 'library', 'other', 'general')),
  entity_id text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  content_hash text NOT NULL DEFAULT '',
  voice_name text NOT NULL DEFAULT 'Kore',
  speed text NOT NULL DEFAULT 'normal',
  mime_type text NOT NULL DEFAULT 'audio/wav',
  size_bytes bigint NOT NULL DEFAULT 0,
  duration_seconds double precision NOT NULL DEFAULT 0,
  last_position_seconds double precision NOT NULL DEFAULT 0,
  playback_rate double precision NOT NULL DEFAULT 1,
  storage_bucket text NOT NULL DEFAULT 'audio-cache',
  storage_path text NOT NULL DEFAULT '',
  download_url text NOT NULL DEFAULT '',
  created_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_audio_cache_owner_entity ON public.audio_cache (owner_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_audio_cache_owner_updated ON public.audio_cache (owner_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_audio_cache_updated_at ON public.audio_cache;
CREATE TRIGGER trg_audio_cache_updated_at
  BEFORE UPDATE ON public.audio_cache
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Enable Row Level Security (RLS) on ALL tables — strict per-Firebase-UID isolation
-- ============================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practical_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_cache ENABLE ROW LEVEL SECURITY;

-- User Profiles policies
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_delete_own ON public.user_profiles;

CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT TO authenticated USING (uid = public.firebase_uid());
CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (uid = public.firebase_uid());
CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE TO authenticated USING (uid = public.firebase_uid()) WITH CHECK (uid = public.firebase_uid());
CREATE POLICY user_profiles_delete_own ON public.user_profiles
  FOR DELETE TO authenticated USING (uid = public.firebase_uid());

-- Helper loop to create standard owner_id = public.firebase_uid() CRUD policies on all workspace tables
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'quarters',
    'domains',
    'months',
    'courses',
    'book_notes',
    'custom_categories',
    'study_history',
    'user_preferences',
    'reflections',
    'calendar_events',
    'learning_paths',
    'reading_items',
    'practical_projects',
    'unified_tasks',
    'weekly_meetings',
    'dental_cases',
    'file_attachments',
    'image_attachments',
    'audio_cache'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_own ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_own ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY %I_select_own ON public.%I FOR SELECT TO authenticated USING (owner_id = public.firebase_uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_insert_own ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_id = public.firebase_uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_update_own ON public.%I FOR UPDATE TO authenticated USING (owner_id = public.firebase_uid()) WITH CHECK (owner_id = public.firebase_uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_delete_own ON public.%I FOR DELETE TO authenticated USING (owner_id = public.firebase_uid())',
      tbl, tbl
    );

    -- Ensure DELETE/UPDATE events carry complete keys over Supabase Realtime
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
  END LOOP;
END $$;

-- ============================================================================
-- Enable Supabase Realtime publication for live multi-device synchronization
-- ============================================================================
DO $$
DECLARE
  tbl text;
  rt_tables text[] := ARRAY[
    'quarters',
    'domains',
    'months',
    'courses',
    'book_notes',
    'custom_categories',
    'study_history',
    'user_preferences',
    'reflections',
    'calendar_events',
    'learning_paths',
    'reading_items',
    'practical_projects',
    'unified_tasks',
    'weekly_meetings',
    'dental_cases',
    'file_attachments',
    'image_attachments',
    'audio_cache'
  ];
BEGIN
  FOREACH tbl IN ARRAY rt_tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
