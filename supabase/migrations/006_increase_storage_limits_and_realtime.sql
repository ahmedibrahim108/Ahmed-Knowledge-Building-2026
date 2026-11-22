-- ============================================================================
-- Migration 006: Increase Supabase Storage Bucket Limits (up to 100 MB)
-- and Ensure Realtime Replication Across All Workspace & Media Tables
-- ============================================================================

-- 1) Update private bucket limits & mobile-compatible MIME types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'study-files',
    'study-files',
    false,
    104857600, -- 100 MB (100 * 1024 * 1024)
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'application/octet-stream'
    ]
  ),
  (
    'user-images',
    'user-images',
    false,
    26214400, -- 25 MB (25 * 1024 * 1024)
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif'
    ]
  ),
  (
    'audio-cache',
    'audio-cache',
    false,
    104857600, -- 100 MB (100 * 1024 * 1024)
    ARRAY[
      'audio/wav',
      'audio/x-wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/aac',
      'audio/x-m4a',
      'audio/webm',
      'audio/ogg',
      'audio/3gpp',
      'application/octet-stream'
    ]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Guarantee full row replication & Realtime publication on all 19 tables
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
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
