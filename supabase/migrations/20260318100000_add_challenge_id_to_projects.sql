-- Add challenge_id to projects table for linking submissions to challenges
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS challenge_id integer REFERENCES public.challenges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_challenge_id ON public.projects(challenge_id) WHERE challenge_id IS NOT NULL;
