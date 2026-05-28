-- =============================================================================
-- Scratch 少儿编程训练营：courses / course_lessons / user_lesson_progress
-- =============================================================================

-- 1. courses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id bigserial PRIMARY KEY,
  title varchar(200) NOT NULL,
  description text,
  image_url text,
  tags text[] DEFAULT '{}',
  difficulty_stars smallint DEFAULT 1 CHECK (difficulty_stars BETWEEN 1 AND 6),
  status varchar(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'archived')),
  sort_order int DEFAULT 0,
  steam_weights jsonb DEFAULT '{"S":5,"T":35,"E":5,"A":15,"M":15}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courses_status_sort_idx
  ON public.courses (status, sort_order, created_at DESC);

-- 2. course_lessons
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_lessons (
  id bigserial PRIMARY KEY,
  course_id bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  lesson_type varchar(20) DEFAULT 'scratch'
    CHECK (lesson_type IN ('scratch', 'reading', 'video', 'quiz')),
  content jsonb DEFAULT '{}',
  steps jsonb DEFAULT '[]',
  resources jsonb DEFAULT '[]',
  starter_project_path text,
  sort_order int DEFAULT 0,
  duration_minutes int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_lessons_course_sort_idx
  ON public.course_lessons (course_id, sort_order);

-- 3. user_lesson_progress
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id bigint NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  scratch_project_path text,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS user_lesson_progress_lesson_idx
  ON public.user_lesson_progress (lesson_id);

-- 4. updated_at triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_courses_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS courses_updated_at ON public.courses;
CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_courses_updated_at();

DROP TRIGGER IF EXISTS course_lessons_updated_at ON public.course_lessons;
CREATE TRIGGER course_lessons_updated_at
  BEFORE UPDATE ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_courses_updated_at();

DROP TRIGGER IF EXISTS user_lesson_progress_updated_at ON public.user_lesson_progress;
CREATE TRIGGER user_lesson_progress_updated_at
  BEFORE UPDATE ON public.user_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_courses_updated_at();

-- 5. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

-- courses: public read approved; admin/moderator CRUD
DROP POLICY IF EXISTS "courses_select_approved" ON public.courses;
CREATE POLICY "courses_select_approved" ON public.courses
  FOR SELECT USING (
    status = 'approved'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "courses_admin_insert" ON public.courses;
CREATE POLICY "courses_admin_insert" ON public.courses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "courses_admin_update" ON public.courses;
CREATE POLICY "courses_admin_update" ON public.courses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "courses_admin_delete" ON public.courses;
CREATE POLICY "courses_admin_delete" ON public.courses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- course_lessons: visible when parent course is approved or staff
DROP POLICY IF EXISTS "course_lessons_select" ON public.course_lessons;
CREATE POLICY "course_lessons_select" ON public.course_lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.status = 'approved'
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
          )
        )
    )
  );

DROP POLICY IF EXISTS "course_lessons_admin_insert" ON public.course_lessons;
CREATE POLICY "course_lessons_admin_insert" ON public.course_lessons
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "course_lessons_admin_update" ON public.course_lessons;
CREATE POLICY "course_lessons_admin_update" ON public.course_lessons
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "course_lessons_admin_delete" ON public.course_lessons;
CREATE POLICY "course_lessons_admin_delete" ON public.course_lessons
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- user_lesson_progress: own rows + staff read
DROP POLICY IF EXISTS "user_lesson_progress_select" ON public.user_lesson_progress;
CREATE POLICY "user_lesson_progress_select" ON public.user_lesson_progress
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "user_lesson_progress_insert" ON public.user_lesson_progress;
CREATE POLICY "user_lesson_progress_insert" ON public.user_lesson_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_lesson_progress_update" ON public.user_lesson_progress;
CREATE POLICY "user_lesson_progress_update" ON public.user_lesson_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- 6. Storage bucket scratch-projects (private; signed URLs for load)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('scratch-projects', 'scratch-projects', false, 10485760)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760;

DROP POLICY IF EXISTS "scratch_projects_select_own" ON storage.objects;
CREATE POLICY "scratch_projects_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'scratch-projects'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'moderator')
      )
    )
  );

DROP POLICY IF EXISTS "scratch_projects_insert_own" ON storage.objects;
CREATE POLICY "scratch_projects_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'scratch-projects'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "scratch_projects_update_own" ON storage.objects;
CREATE POLICY "scratch_projects_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'scratch-projects'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "scratch_projects_delete_own" ON storage.objects;
CREATE POLICY "scratch_projects_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'scratch-projects'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Staff can read starter templates under starters/
DROP POLICY IF EXISTS "scratch_projects_select_starters" ON storage.objects;
CREATE POLICY "scratch_projects_select_starters" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'scratch-projects'
    AND (storage.foldername(name))[1] = 'starters'
  );

DROP POLICY IF EXISTS "scratch_projects_admin_starters" ON storage.objects;
CREATE POLICY "scratch_projects_admin_starters" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'scratch-projects'
    AND (storage.foldername(name))[1] = 'starters'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );
