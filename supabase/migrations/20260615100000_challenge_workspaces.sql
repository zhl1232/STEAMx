-- User-level PBL workspace state for a challenge.
-- Stores the student's one-sentence project direction and a deterministic,
-- UI-rendered personal plan derived from the challenge stages.

CREATE TABLE IF NOT EXISTS public.challenge_workspaces (
  id bigserial PRIMARY KEY,
  challenge_id bigint NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_goal text NOT NULL CHECK (
    char_length(btrim(project_goal)) BETWEEN 1 AND 160
  ),
  personal_plan jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_workspaces_user
ON public.challenge_workspaces(user_id);

ALTER TABLE public.challenge_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_workspaces_select"
ON public.challenge_workspaces FOR SELECT
USING (
  (select auth.uid()) = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY "challenge_workspaces_insert"
ON public.challenge_workspaces FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "challenge_workspaces_update"
ON public.challenge_workspaces FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "challenge_workspaces_delete"
ON public.challenge_workspaces FOR DELETE
USING ((select auth.uid()) = user_id);
