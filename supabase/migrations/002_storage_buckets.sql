-- ============================================================================
-- Mizan Knowledge (ميزان المعرفة) — Supabase Storage Buckets & RLS Policies
-- Buckets:
--   1) study-files  (PDF, Word .doc/.docx, Markdown, Text)
--   2) user-images  (Course/Note diagrams, Dental case cover photos)
--   3) audio-cache  (Generated TTS WAV/MP3/WebM study audio)
-- Security: Every bucket is PRIVATE. Path convention: {firebase_uid}/...
-- Users can ONLY read/write/update/delete objects inside their own {firebase_uid}/ folder.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'study-files',
    'study-files',
    false,
    52428800, -- 50 MB
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
    20971520, -- 20 MB
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
    31457280, -- 30 MB
    ARRAY[
      'audio/wav',
      'audio/x-wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/webm',
      'audio/ogg'
    ]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies on storage.objects
DROP POLICY IF EXISTS mizan_storage_select_own ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_insert_own ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_update_own ON storage.objects;
DROP POLICY IF EXISTS mizan_storage_delete_own ON storage.objects;

CREATE POLICY mizan_storage_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  );

CREATE POLICY mizan_storage_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  );

CREATE POLICY mizan_storage_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  )
  WITH CHECK (
    bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  );

CREATE POLICY mizan_storage_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('study-files', 'user-images', 'audio-cache')
    AND (storage.foldername(name))[1] = public.firebase_uid()
  );
