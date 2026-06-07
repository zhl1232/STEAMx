-- Support observation feeds ordered by publish/submission time.

CREATE INDEX IF NOT EXISTS idx_observation_events_public_approved_created_at
  ON public.observation_events (created_at DESC, id DESC)
  WHERE status = 'approved' AND is_public = TRUE;

CREATE INDEX IF NOT EXISTS idx_observation_events_user_created_at
  ON public.observation_events (user_id, created_at DESC, id DESC);
