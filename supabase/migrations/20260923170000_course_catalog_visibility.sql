-- A course can remain available to learners with historical links while it is
-- removed from discovery after a replacement course has passed review.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_listed boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS courses_public_catalog_idx
  ON public.courses (sort_order, created_at DESC)
  WHERE status = 'approved' AND is_listed = true;

-- Publish the replacement and retire the historical listing in one transaction.
CREATE OR REPLACE FUNCTION public.publish_original_scratch_course(
  p_new_course_id bigint,
  p_legacy_course_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  replacement public.courses%ROWTYPE;
  historical public.courses%ROWTYPE;
  lesson_count integer;
  unique_lesson_keys integer;
BEGIN
  IF p_new_course_id IS NULL OR p_legacy_course_id IS NULL OR p_new_course_id = p_legacy_course_id THEN
    RAISE EXCEPTION 'Distinct course IDs are required';
  END IF;

  SELECT * INTO replacement FROM public.courses WHERE id = p_new_course_id FOR UPDATE;
  SELECT * INTO historical FROM public.courses WHERE id = p_legacy_course_id FOR UPDATE;
  IF NOT FOUND OR replacement.id IS NULL THEN
    RAISE EXCEPTION 'Both courses must exist';
  END IF;
  IF NOT coalesce(replacement.tags @> ARRAY['scratch-original-v1']::text[], false)
     OR replacement.status IS NULL OR replacement.status NOT IN ('draft', 'approved')
     OR replacement.classification_status IS DISTINCT FROM 'reviewed'
     OR replacement.recommended_min_age IS DISTINCT FROM 7
     OR replacement.recommended_max_age IS DISTINCT FROM 10
     OR replacement.support_level IS DISTINCT FROM 'guided' THEN
    RAISE EXCEPTION 'Replacement course has not passed curriculum review';
  END IF;
  IF historical.title IS DISTINCT FROM 'Scratch 少儿编程入门' OR historical.status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Historical course identity or status mismatch';
  END IF;
  SELECT count(*), count(DISTINCT content #>> '{scratch,lessonKey}')
    INTO lesson_count, unique_lesson_keys
    FROM public.course_lessons WHERE course_id = p_new_course_id;
  IF lesson_count <> 48 OR unique_lesson_keys <> 48 THEN
    RAISE EXCEPTION 'Replacement course must contain 48 uniquely keyed lessons';
  END IF;

  UPDATE public.courses SET status = 'approved', is_listed = true WHERE id = p_new_course_id;
  UPDATE public.courses SET is_listed = false WHERE id = p_legacy_course_id;
  RETURN pg_catalog.jsonb_build_object('newCourseId', p_new_course_id, 'legacyCourseId', p_legacy_course_id, 'lessonCount', lesson_count);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_original_scratch_course(bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_original_scratch_course(bigint, bigint) TO service_role;
