-- ============================================================================
-- Migration 009: Photo Gallery Frame/Resize Metadata & Reflection Cover Images
-- Safe & Idempotent (no destructive deletes, safe to re-run)
-- ============================================================================

-- 1. Personal Reflections: Framed Cover Image Support
ALTER TABLE public.reflections
  ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_storage_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_frame jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Image Attachments / Photo Gallery: Frame, Resize, Category & Sort Support
ALTER TABLE public.image_attachments
  ADD COLUMN IF NOT EXISTS frame_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS category_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_image_attachments_scope_sort
  ON public.image_attachments (owner_id, scope_key, sort_order ASC, created_at_ms DESC);

-- 3. Update Storage SELECT Policy to also permit reading public/granted reflection images in `user-images`
DROP POLICY IF EXISTS mizan_storage_select_public_or_admin ON storage.objects;
CREATE POLICY mizan_storage_select_public_or_admin ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    (
      public.is_verified_admin()
      AND bucket_id IN ('study-files', 'user-images', 'audio-cache')
      AND (storage.foldername(name))[1] = public.firebase_uid()
    )
    OR (
      bucket_id = 'user-images'
      AND EXISTS (
        SELECT 1
        FROM public.reflections AS refl
        WHERE refl.image_storage_path = name
          AND (
            refl.is_public = true
            OR EXISTS (
              SELECT 1 FROM public.public_site_config psc
              WHERE psc.id = 'main'
                AND psc.owner_id = refl.owner_id
                AND refl.category_tag <> ''
                AND psc.public_reflection_categories @> to_jsonb(refl.category_tag)
            )
            OR EXISTS (
              SELECT 1 FROM public.content_access_grants g
              WHERE g.owner_id = refl.owner_id
                AND public.is_grant_for_current_user(g)
                AND (
                  g.reflection_ids @> to_jsonb(refl.id)
                  OR (
                    refl.category_tag <> ''
                    AND g.reflection_categories @> to_jsonb(refl.category_tag)
                  )
                )
            )
          )
      )
    )
    OR (
      bucket_id = 'study-files'
      AND (
        EXISTS (
          SELECT 1
          FROM public.reading_items AS r
          WHERE r.storage_path = name
            AND (
              r.is_public = true
              OR EXISTS (
                SELECT 1 FROM public.content_access_grants g
                WHERE g.owner_id = r.owner_id
                  AND public.is_grant_for_current_user(g)
                  AND g.book_ids @> to_jsonb(r.id)
              )
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.courses AS c
          WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(c.resources) AS elem
              WHERE elem->>'storagePath' = name
            )
            AND (
              c.is_public = true
              OR EXISTS (
                SELECT 1 FROM public.content_access_grants g
                WHERE g.owner_id = c.owner_id
                  AND public.is_grant_for_current_user(g)
                  AND g.course_doc_ids @> to_jsonb(c.doc_id)
              )
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.book_notes AS bn
          WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(bn.resources) AS elem
              WHERE elem->>'storagePath' = name
            )
            AND EXISTS (
              SELECT 1 FROM public.content_access_grants g
              WHERE g.owner_id = bn.owner_id
                AND public.is_grant_for_current_user(g)
                AND (
                  g.note_ids @> to_jsonb(bn.id)
                  OR (
                    g.include_course_notes = true
                    AND bn.course_id > 0
                    AND EXISTS (
                      SELECT 1 FROM public.courses c
                      WHERE c.owner_id = g.owner_id
                        AND c.course_number = bn.course_id
                        AND g.course_doc_ids @> to_jsonb(c.doc_id)
                    )
                  )
                )
            )
        )
      )
    )
  );
