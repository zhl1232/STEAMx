-- Unify project completions and course lesson works without duplicating the
-- moderation/social stack. The physical table keeps its historical name for
-- compatibility; application code exposes these rows as works.

ALTER TABLE public.completed_projects
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.completed_projects
  ADD COLUMN IF NOT EXISTS course_lesson_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'completed_projects_course_lesson_id_fkey'
      AND conrelid = 'public.completed_projects'::regclass
  ) THEN
    ALTER TABLE public.completed_projects
      ADD CONSTRAINT completed_projects_course_lesson_id_fkey
      FOREIGN KEY (course_lesson_id)
      REFERENCES public.course_lessons(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.legacy_course_work_projects (
  project_id bigint PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  lesson_id bigint NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legacy_course_work_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Legacy course work redirects are public" ON public.legacy_course_work_projects;
CREATE POLICY "Legacy course work redirects are public"
  ON public.legacy_course_work_projects FOR SELECT
  USING (true);

GRANT SELECT ON public.legacy_course_work_projects TO anon, authenticated;

-- Preserve old project links before removing the JSON bridge.
INSERT INTO public.legacy_course_work_projects (project_id, lesson_id)
SELECT
  (lesson.content #>> '{building3d,worksProjectId}')::bigint,
  lesson.id
FROM public.course_lessons lesson
WHERE lesson.content #>> '{building3d,worksProjectId}' ~ '^[0-9]+$'
ON CONFLICT (project_id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id;

-- Move existing course work rows onto the lesson source. Social interactions
-- remain attached because their foreign keys point at the work row itself.
UPDATE public.completed_projects work
SET
  course_lesson_id = legacy.lesson_id,
  project_id = NULL,
  exploration_id = NULL
FROM public.legacy_course_work_projects legacy
WHERE work.project_id = legacy.project_id;

-- Keep the already-awarded XP while changing its idempotency key to the new
-- course work source.
UPDATE public.xp_logs log
SET
  action_type = 'publish_course_work',
  resource_id = legacy.lesson_id::text
FROM public.legacy_course_work_projects legacy
WHERE log.action_type = 'complete_project'
  AND log.resource_id = legacy.project_id::text;

-- Course work is now an explicit lesson capability. Old synthetic projects
-- are retained only as archived redirect records, so no historical URL or
-- project-level interaction data is destroyed.
UPDATE public.course_lessons lesson
SET content = jsonb_set(
  COALESCE(lesson.content, '{}'::jsonb) #- '{building3d,worksProjectId}',
  '{workSubmission}',
  '{"enabled":true}'::jsonb,
  true
)
WHERE EXISTS (
  SELECT 1
  FROM public.legacy_course_work_projects legacy
  WHERE legacy.lesson_id = lesson.id
);

UPDATE public.projects project
SET status = 'archived', updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM public.legacy_course_work_projects legacy
  WHERE legacy.project_id = project.id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'completed_projects_exactly_one_source_check'
      AND conrelid = 'public.completed_projects'::regclass
  ) THEN
    ALTER TABLE public.completed_projects
      ADD CONSTRAINT completed_projects_exactly_one_source_check
      CHECK (num_nonnulls(project_id, course_lesson_id) = 1);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS completed_projects_one_final_per_user_lesson
  ON public.completed_projects (user_id, course_lesson_id)
  WHERE course_lesson_id IS NOT NULL
    AND record_kind = 'final'
    AND status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_completed_projects_course_lesson_gallery
  ON public.completed_projects (course_lesson_id, status, is_public, completed_at DESC)
  WHERE course_lesson_id IS NOT NULL AND record_kind = 'final';

CREATE INDEX IF NOT EXISTS idx_completed_projects_public_work_feed
  ON public.completed_projects (completed_at DESC)
  WHERE status = 'approved' AND is_public = true AND record_kind = 'final';

CREATE OR REPLACE FUNCTION public.get_trending_works(
  p_limit integer DEFAULT 8,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(work_id bigint, score double precision)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH comment_totals AS (
    SELECT completed_project_id, count(*)::double precision AS comment_count
    FROM public.completion_comments
    GROUP BY completed_project_id
  )
  SELECT
    work.id AS work_id,
    (
      1
      + COALESCE(work.likes_count, 0)
      + 2 * COALESCE(comments.comment_count, 0)
      + 3 * LEAST(COALESCE(work.coins_count, 0), 20)
    )::double precision
    / power(
        GREATEST(EXTRACT(EPOCH FROM (now() - work.completed_at)) / 3600.0, 0) + 2,
        0.8
      ) AS score
  FROM public.completed_projects work
  LEFT JOIN comment_totals comments ON comments.completed_project_id = work.id
  WHERE work.status = 'approved'
    AND work.is_public = true
    AND work.record_kind = 'final'
  ORDER BY score DESC, work.completed_at DESC, work.id DESC
  OFFSET GREATEST(p_offset, 0)
  LIMIT LEAST(GREATEST(p_limit, 1), 24);
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_works(integer, integer) TO anon, authenticated;

COMMENT ON COLUMN public.completed_projects.course_lesson_id IS
  'Course lesson source for a unified work; exactly one of project_id/course_lesson_id is set.';
COMMENT ON FUNCTION public.get_trending_works(integer, integer) IS
  'Public approved final works ranked by recent engagement with time decay.';
