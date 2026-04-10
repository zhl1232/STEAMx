-- Dedicated challenge submissions decouple challenge作品 from projects.

CREATE TABLE IF NOT EXISTS public.challenge_submissions (
  id bigserial PRIMARY KEY,
  challenge_id bigint NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  proof_images text[] NOT NULL DEFAULT '{}'::text[],
  proof_captions text[],
  proof_video_url text,
  is_public boolean NOT NULL DEFAULT true,
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.challenge_submission_projects (
  submission_id bigint NOT NULL REFERENCES public.challenge_submissions(id) ON DELETE CASCADE,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, project_id)
);

CREATE TABLE IF NOT EXISTS public.challenge_submission_ratings (
  id bigserial PRIMARY KEY,
  submission_id bigint NOT NULL REFERENCES public.challenge_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creative_expression smallint NOT NULL CHECK (creative_expression BETWEEN 1 AND 5),
  completion_quality smallint NOT NULL CHECK (completion_quality BETWEEN 1 AND 5),
  evidence_completeness smallint NOT NULL CHECK (evidence_completeness BETWEEN 1 AND 5),
  reflection_depth smallint NOT NULL CHECK (reflection_depth BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_challenge_status
ON public.challenge_submissions(challenge_id, status);

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_user
ON public.challenge_submissions(user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_submission_projects_project
ON public.challenge_submission_projects(project_id);

CREATE INDEX IF NOT EXISTS idx_challenge_submission_ratings_submission
ON public.challenge_submission_ratings(submission_id);

ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_submission_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_submission_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_submissions_select"
ON public.challenge_submissions FOR SELECT
USING (
  (status = 'approved' AND is_public = true)
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY "challenge_submissions_insert"
ON public.challenge_submissions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY "challenge_submissions_update"
ON public.challenge_submissions FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY "challenge_submission_projects_select"
ON public.challenge_submission_projects FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.challenge_submissions cs
    WHERE cs.id = submission_id
      AND (
        (cs.status = 'approved' AND cs.is_public = true)
        OR cs.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
      )
  )
);

CREATE POLICY "challenge_submission_projects_mutate"
ON public.challenge_submission_projects FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.challenge_submissions cs
    WHERE cs.id = submission_id
      AND (
        cs.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.challenge_submissions cs
    WHERE cs.id = submission_id
      AND (
        cs.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
      )
  )
);

CREATE POLICY "challenge_submission_ratings_select"
ON public.challenge_submission_ratings FOR SELECT
USING (true);

CREATE POLICY "challenge_submission_ratings_insert"
ON public.challenge_submission_ratings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "challenge_submission_ratings_update"
ON public.challenge_submission_ratings FOR UPDATE
USING (auth.uid() = user_id);
