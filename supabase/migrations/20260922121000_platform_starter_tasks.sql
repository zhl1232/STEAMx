-- Platform starter tasks use the three durable main milestones. The unique
-- action index makes claims idempotent under concurrent requests; the legacy
-- graduation sentinel remains valid and is intentionally not removed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_logs_profile_growth_task_unique
  ON public.xp_logs (user_id, action_type, resource_id)
  WHERE action_type = 'profile_growth_task';

COMMENT ON INDEX public.idx_xp_logs_profile_growth_task_unique IS
  'One reward per platform starter task and user, safe for concurrent claims';

ALTER TABLE public.observation_events
  ADD COLUMN IF NOT EXISTS moderation_state text NOT NULL DEFAULT 'approved';

CREATE OR REPLACE FUNCTION public.get_platform_growth_progress(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN (
  SELECT jsonb_build_object(
    'lessonsStarted', (SELECT count(*) FROM public.user_lesson_progress WHERE user_id = p_user_id)
      + CASE WHEN EXISTS (SELECT 1 FROM public.project_journeys WHERE user_id = p_user_id)
          OR EXISTS (SELECT 1 FROM public.observation_events WHERE user_id = p_user_id)
          OR EXISTS (SELECT 1 FROM public.function_wars_match_results WHERE user_id = p_user_id)
        THEN 1 ELSE 0 END,
    'lessonsCompleted', (SELECT count(*) FROM public.user_lesson_progress WHERE user_id = p_user_id AND completed_at IS NOT NULL)
      + CASE WHEN EXISTS (SELECT 1 FROM public.project_journeys j JOIN public.project_journey_records r ON r.journey_id = j.id WHERE j.user_id = p_user_id AND j.status = 'completed' AND r.record_kind = 'final' AND r.visibility = 'public' AND r.status = 'approved' AND r.moderation_state = 'approved')
          OR EXISTS (SELECT 1 FROM public.observation_events WHERE user_id = p_user_id AND status = 'approved' AND moderation_state = 'approved')
          OR EXISTS (SELECT 1 FROM public.function_wars_match_results WHERE user_id = p_user_id AND result = 'win')
        THEN 1 ELSE 0 END,
    'worksPublished', (SELECT count(*) FROM public.completed_projects WHERE user_id = p_user_id AND status = 'approved' AND moderation_state = 'approved' AND COALESCE(record_kind, 'final') = 'final')
      + (SELECT count(*) FROM public.project_journey_records r JOIN public.project_journeys j ON j.id = r.journey_id WHERE j.user_id = p_user_id AND r.record_kind = 'final' AND r.visibility = 'public' AND r.status = 'approved' AND r.moderation_state = 'approved')
      + (SELECT count(*) FROM public.observation_events WHERE user_id = p_user_id AND status = 'approved' AND moderation_state = 'approved')
      + CASE WHEN EXISTS (SELECT 1 FROM public.function_wars_match_results WHERE user_id = p_user_id AND result = 'win') THEN 1 ELSE 0 END,
    'observationsSubmitted', (SELECT count(*) FROM public.observation_events WHERE user_id = p_user_id),
    'consecutiveDays', 0,
    'playgroundGamesPlayed', (SELECT count(*) FROM public.function_wars_match_results WHERE user_id = p_user_id),
    'playgroundWinsTotal', (SELECT count(*) FROM public.function_wars_match_results WHERE user_id = p_user_id AND result = 'win')
  ));
END;
$$;
REVOKE ALL ON FUNCTION public.get_platform_growth_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_growth_progress(uuid) TO authenticated, service_role;

-- Eligibility, reward insertion, XP increment, and graduation are one locked
-- transaction. The API can therefore only ask the service role to claim a
-- task; it cannot submit client supplied progress or XP amounts.
CREATE OR REPLACE FUNCTION public.claim_platform_growth_task(
  p_user_id uuid,
  p_task_id text
)
RETURNS TABLE(xp_granted integer, already_claimed boolean, graduated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_xp integer;
  v_eligible boolean := false;
  v_inserted integer;
  v_main_claims integer;
BEGIN
  IF p_task_id NOT IN ('start_first_lesson', 'complete_first_lesson', 'publish_first_work', 'write_bio', 'submit_first_observation') THEN
    RAISE EXCEPTION 'unknown growth task';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.xp_logs WHERE user_id = p_user_id AND action_type = 'profile_growth_task' AND resource_id = p_task_id) THEN
    RETURN QUERY SELECT 0, true, EXISTS (
      SELECT 1 FROM public.xp_logs WHERE user_id = p_user_id AND action_type = 'profile_growth_task_graduation' AND resource_id = 'v1'
    );
    RETURN;
  END IF;

  v_xp := CASE p_task_id
    WHEN 'start_first_lesson' THEN 10
    WHEN 'complete_first_lesson' THEN 20
    WHEN 'publish_first_work' THEN 30
    ELSE 10
  END;

  IF p_task_id = 'start_first_lesson' THEN
    v_eligible := EXISTS (SELECT 1 FROM public.user_lesson_progress WHERE user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.project_journeys WHERE user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.observation_events WHERE user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.function_wars_match_results WHERE user_id = p_user_id);
  ELSIF p_task_id = 'complete_first_lesson' THEN
    v_eligible := EXISTS (SELECT 1 FROM public.user_lesson_progress WHERE user_id = p_user_id AND completed_at IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.project_journeys j JOIN public.project_journey_records r ON r.journey_id = j.id WHERE j.user_id = p_user_id AND j.status = 'completed' AND r.record_kind = 'final' AND r.visibility = 'public' AND r.status = 'approved' AND r.moderation_state = 'approved')
      OR EXISTS (SELECT 1 FROM public.observation_events WHERE user_id = p_user_id AND status = 'approved' AND moderation_state = 'approved')
      OR EXISTS (SELECT 1 FROM public.function_wars_match_results WHERE user_id = p_user_id AND result = 'win');
  ELSIF p_task_id = 'publish_first_work' THEN
    v_eligible := EXISTS (SELECT 1 FROM public.completed_projects WHERE user_id = p_user_id AND status = 'approved' AND moderation_state = 'approved' AND COALESCE(record_kind, 'final') = 'final')
      OR EXISTS (SELECT 1 FROM public.project_journeys j JOIN public.project_journey_records r ON r.journey_id = j.id WHERE j.user_id = p_user_id AND r.record_kind = 'final' AND r.visibility = 'public' AND r.status = 'approved' AND r.moderation_state = 'approved')
      OR EXISTS (SELECT 1 FROM public.observation_events WHERE user_id = p_user_id AND status = 'approved' AND moderation_state = 'approved')
      OR EXISTS (SELECT 1 FROM public.function_wars_match_results WHERE user_id = p_user_id AND result = 'win');
  ELSIF p_task_id = 'write_bio' THEN
    SELECT char_length(trim(bio)) > 0 INTO v_eligible FROM public.profiles WHERE id = p_user_id;
  ELSE
    v_eligible := EXISTS (SELECT 1 FROM public.observation_events WHERE user_id = p_user_id);
  END IF;

  IF v_eligible IS NOT TRUE THEN RAISE EXCEPTION 'growth task is not complete'; END IF;

  INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
  VALUES (p_user_id, 'profile_growth_task', p_task_id, v_xp)
  ON CONFLICT (user_id, action_type, resource_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN QUERY SELECT 0, true, EXISTS (
      SELECT 1 FROM public.xp_logs WHERE user_id = p_user_id AND action_type = 'profile_growth_task_graduation' AND resource_id = 'v1'
    );
    RETURN;
  END IF;

  UPDATE public.profiles SET xp = COALESCE(xp, 0) + v_xp WHERE id = p_user_id;
  SELECT count(DISTINCT resource_id) INTO v_main_claims
  FROM public.xp_logs
  WHERE user_id = p_user_id AND action_type = 'profile_growth_task'
    AND resource_id IN ('start_first_lesson', 'complete_first_lesson', 'publish_first_work');
  IF v_main_claims >= 3 THEN
    INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
    VALUES (p_user_id, 'profile_growth_task_graduation', 'v1', 0)
    ON CONFLICT (user_id, action_type, resource_id) DO NOTHING;
  END IF;
  RETURN QUERY SELECT v_xp, false, v_main_claims >= 3;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_platform_growth_task(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_platform_growth_task(uuid, text) TO service_role;
