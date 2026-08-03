-- Harden the interaction boundary after the initial access migration.
-- API checks are useful for UX, but direct PostgREST writes must obey the
-- same account state rules at the database boundary.

-- The old increment RPCs are retired. Keep the service-role grant because
-- growth-task claims still use increment_user_xp until that route is migrated.
REVOKE ALL ON FUNCTION public.increment_user_xp(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_xp(uuid, int) TO service_role;

REVOKE ALL ON FUNCTION public.increment_client_xp(int) FROM PUBLIC, anon, authenticated;

-- XP logs are an audit trail, not a client-owned table. Trusted server paths
-- use service_role, which bypasses RLS and retains the table grant.
REVOKE INSERT, UPDATE, DELETE ON public.xp_logs FROM PUBLIC, anon, authenticated;

-- This helper is intentionally not a public RPC. It is called by the trigger
-- below, so the same rules apply to API handlers and direct PostgREST writes.
CREATE OR REPLACE FUNCTION public.current_user_can_interact(p_capability text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF current_user_id IS NULL OR p_capability NOT IN ('post', 'comment', 'submit', 'message', 'engage', 'save_progress') THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = current_user_id
      AND p.interaction_restricted IS NOT TRUE
      AND (
        p_capability IN ('engage', 'save_progress')
        OR p.age_confirmed_at IS NOT NULL
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_interaction_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.current_user_can_interact(TG_ARGV[0]) THEN
    RAISE EXCEPTION 'Interaction access denied for %', TG_ARGV[0]
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_interact(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_interaction_access() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_interact(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_interaction_access() TO service_role;

-- Content submission and edits. Counter-only updates are excluded from the
-- UPDATE OF lists so like/comment count SECURITY DEFINER helpers keep working
-- for registered users without turning those helpers into content writes.
DROP TRIGGER IF EXISTS trg_interaction_access_projects ON public.projects;
CREATE TRIGGER trg_interaction_access_projects
  BEFORE INSERT OR DELETE OR UPDATE OF title, description, category, sub_category_id,
    difficulty, difficulty_stars, image_url, reflection, problem_statement,
    iterations, steam_weights, updated_at
  ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('post');

DROP TRIGGER IF EXISTS trg_interaction_access_project_materials ON public.project_materials;
CREATE TRIGGER trg_interaction_access_project_materials
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('post');

DROP TRIGGER IF EXISTS trg_interaction_access_project_steps ON public.project_steps;
CREATE TRIGGER trg_interaction_access_project_steps
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('post');

DROP TRIGGER IF EXISTS trg_interaction_access_project_tags ON public.project_tags;
CREATE TRIGGER trg_interaction_access_project_tags
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('post');

DROP TRIGGER IF EXISTS trg_interaction_access_discussions ON public.discussions;
CREATE TRIGGER trg_interaction_access_discussions
  BEFORE INSERT OR UPDATE OR DELETE ON public.discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('post');

DROP TRIGGER IF EXISTS trg_interaction_access_comments ON public.comments;
CREATE TRIGGER trg_interaction_access_comments
  BEFORE INSERT OR DELETE OR UPDATE OF project_id, author_id, content, parent_id,
    reply_to_user_id, reply_to_username, image_url, updated_at
  ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('comment');

DROP TRIGGER IF EXISTS trg_interaction_access_completion_comments ON public.completion_comments;
CREATE TRIGGER trg_interaction_access_completion_comments
  BEFORE INSERT OR UPDATE OR DELETE ON public.completion_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('comment');

DROP TRIGGER IF EXISTS trg_interaction_access_observation_comments ON public.observation_comments;
CREATE TRIGGER trg_interaction_access_observation_comments
  BEFORE INSERT OR UPDATE OR DELETE ON public.observation_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('comment');

DROP TRIGGER IF EXISTS trg_interaction_access_discussion_replies ON public.discussion_replies;
CREATE TRIGGER trg_interaction_access_discussion_replies
  BEFORE INSERT OR DELETE OR UPDATE OF discussion_id, author_id, content, parent_id,
    reply_to_user_id, reply_to_username, image_url, updated_at
  ON public.discussion_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('comment');

DROP TRIGGER IF EXISTS trg_interaction_access_observation_identifications ON public.observation_identifications;
CREATE TRIGGER trg_interaction_access_observation_identifications
  BEFORE INSERT OR UPDATE OR DELETE ON public.observation_identifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('comment');

-- Ratings and submissions are age-confirmed contributions.
DROP TRIGGER IF EXISTS trg_interaction_access_challenge_ratings ON public.challenge_ratings;
CREATE TRIGGER trg_interaction_access_challenge_ratings
  BEFORE INSERT OR UPDATE OR DELETE ON public.challenge_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('comment');

DROP TRIGGER IF EXISTS trg_interaction_access_challenge_submission_ratings ON public.challenge_submission_ratings;
CREATE TRIGGER trg_interaction_access_challenge_submission_ratings
  BEFORE INSERT OR UPDATE OR DELETE ON public.challenge_submission_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('comment');

DROP TRIGGER IF EXISTS trg_interaction_access_completed_projects ON public.completed_projects;
CREATE TRIGGER trg_interaction_access_completed_projects
  BEFORE INSERT OR DELETE OR UPDATE OF user_id, project_id, course_lesson_id, proof_images,
    proof_captions, proof_video_url, notes, is_public, status, completed_at,
    reviewed_by, reviewed_at, rejection_reason, record_kind, record_type,
    stage_label, exploration_id, moderation_source
  ON public.completed_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('submit');

DROP TRIGGER IF EXISTS trg_interaction_access_challenge_submissions ON public.challenge_submissions;
CREATE TRIGGER trg_interaction_access_challenge_submissions
  BEFORE INSERT OR UPDATE OR DELETE ON public.challenge_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('submit');

DROP TRIGGER IF EXISTS trg_interaction_access_challenge_submission_projects ON public.challenge_submission_projects;
CREATE TRIGGER trg_interaction_access_challenge_submission_projects
  BEFORE INSERT OR UPDATE OR DELETE ON public.challenge_submission_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('submit');

DROP TRIGGER IF EXISTS trg_interaction_access_observation_events ON public.observation_events;
CREATE TRIGGER trg_interaction_access_observation_events
  BEFORE INSERT OR DELETE OR UPDATE OF user_id, observed_at, location_name, latitude,
    longitude, location_precision, habitat, weather, notes, media_urls, is_public,
    status, updated_at, nature_topic, identification_status, observed_at_source,
    location_source, coordinate_system, lifecycle_stage, sex
  ON public.observation_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('submit');

DROP TRIGGER IF EXISTS trg_interaction_access_observation_event_species ON public.observation_event_species;
CREATE TRIGGER trg_interaction_access_observation_event_species
  BEFORE INSERT OR UPDATE OR DELETE ON public.observation_event_species
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('submit');

DROP TRIGGER IF EXISTS trg_interaction_access_messages ON public.messages;
CREATE TRIGGER trg_interaction_access_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('message');

-- Registered users may engage, but restricted accounts may not mutate any of
-- these interaction tables directly.
DROP TRIGGER IF EXISTS trg_interaction_access_likes ON public.likes;
CREATE TRIGGER trg_interaction_access_likes
  BEFORE INSERT OR UPDATE OR DELETE ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('engage');

DROP TRIGGER IF EXISTS trg_interaction_access_collections ON public.collections;
CREATE TRIGGER trg_interaction_access_collections
  BEFORE INSERT OR UPDATE OR DELETE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('engage');

DROP TRIGGER IF EXISTS trg_interaction_access_follows ON public.follows;
CREATE TRIGGER trg_interaction_access_follows
  BEFORE INSERT OR UPDATE OR DELETE ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('engage');

DROP TRIGGER IF EXISTS trg_interaction_access_comment_likes ON public.comment_likes;
CREATE TRIGGER trg_interaction_access_comment_likes
  BEFORE INSERT OR UPDATE OR DELETE ON public.comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('engage');

DROP TRIGGER IF EXISTS trg_interaction_access_completion_likes ON public.completion_likes;
CREATE TRIGGER trg_interaction_access_completion_likes
  BEFORE INSERT OR UPDATE OR DELETE ON public.completion_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('engage');

DROP TRIGGER IF EXISTS trg_interaction_access_observation_likes ON public.observation_likes;
CREATE TRIGGER trg_interaction_access_observation_likes
  BEFORE INSERT OR UPDATE OR DELETE ON public.observation_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('engage');

DROP TRIGGER IF EXISTS trg_interaction_access_discussion_likes ON public.discussion_likes;
CREATE TRIGGER trg_interaction_access_discussion_likes
  BEFORE INSERT OR UPDATE OR DELETE ON public.discussion_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('engage');

DROP TRIGGER IF EXISTS trg_interaction_access_discussion_reply_likes ON public.discussion_reply_likes;
CREATE TRIGGER trg_interaction_access_discussion_reply_likes
  BEFORE INSERT OR UPDATE OR DELETE ON public.discussion_reply_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('engage');

-- Progress writes require an account but do not require the age confirmation.
DROP TRIGGER IF EXISTS trg_interaction_access_project_explorations ON public.project_explorations;
CREATE TRIGGER trg_interaction_access_project_explorations
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_explorations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('save_progress');

DROP TRIGGER IF EXISTS trg_interaction_access_challenge_participants ON public.challenge_participants;
CREATE TRIGGER trg_interaction_access_challenge_participants
  BEFORE INSERT OR UPDATE OR DELETE ON public.challenge_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('save_progress');

DROP TRIGGER IF EXISTS trg_interaction_access_challenge_stage_progress ON public.challenge_stage_progress;
CREATE TRIGGER trg_interaction_access_challenge_stage_progress
  BEFORE INSERT OR UPDATE OR DELETE ON public.challenge_stage_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('save_progress');

DROP TRIGGER IF EXISTS trg_interaction_access_challenge_workspaces ON public.challenge_workspaces;
CREATE TRIGGER trg_interaction_access_challenge_workspaces
  BEFORE INSERT OR UPDATE OR DELETE ON public.challenge_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('save_progress');

DROP TRIGGER IF EXISTS trg_interaction_access_observation_media_analyses ON public.observation_media_analyses;
CREATE TRIGGER trg_interaction_access_observation_media_analyses
  BEFORE INSERT OR UPDATE OR DELETE ON public.observation_media_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('save_progress');

DROP TRIGGER IF EXISTS trg_interaction_access_user_lesson_progress ON public.user_lesson_progress;
CREATE TRIGGER trg_interaction_access_user_lesson_progress
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interaction_access('save_progress');

-- Rebuild the fixed award function so comment XP retains the documented
-- 50-point daily cap. The profile row lock serializes concurrent awards for
-- the same user before the cap check and unique insert.
CREATE OR REPLACE FUNCTION public.award_xp_once(
  p_user_id uuid,
  p_action_type text,
  p_resource_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  award_amount integer;
  inserted_amount integer;
  daily_comment_xp integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'award_xp_once is service-role only';
  END IF;

  IF p_user_id IS NULL OR NULLIF(btrim(p_resource_id), '') IS NULL THEN
    RAISE EXCEPTION 'Award user and resource are required';
  END IF;

  award_amount := CASE p_action_type
    WHEN 'publish_project' THEN 50
    WHEN 'comment_project' THEN 1
    WHEN 'like_project' THEN 1
    WHEN 'join_challenge' THEN 10
    WHEN 'submit_observation' THEN 10
    WHEN 'complete_challenge' THEN 20
    WHEN 'challenge_participation' THEN 20
    WHEN 'complete_project' THEN 20
    WHEN 'publish_course_work' THEN 20
    WHEN 'weekly_goal_comments_5' THEN 5
    ELSE NULL
  END;

  IF award_amount IS NULL THEN
    RAISE EXCEPTION 'Unsupported XP action: %', p_action_type;
  END IF;

  PERFORM 1
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile for user % not found', p_user_id;
  END IF;

  IF p_action_type = 'comment_project' THEN
    SELECT COALESCE(SUM(xp_amount), 0)
    INTO daily_comment_xp
    FROM public.xp_logs
    WHERE user_id = p_user_id
      AND action_type = 'comment_project'
      AND (created_at AT TIME ZONE 'Asia/Shanghai')::date =
          (now() AT TIME ZONE 'Asia/Shanghai')::date;

    IF daily_comment_xp >= 50 THEN
      RETURN 0;
    END IF;
  END IF;

  INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
  VALUES (p_user_id, p_action_type, btrim(p_resource_id), award_amount)
  ON CONFLICT (user_id, action_type, resource_id) DO NOTHING
  RETURNING xp_amount INTO inserted_amount;

  IF inserted_amount IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + inserted_amount
  WHERE id = p_user_id;

  RETURN inserted_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.award_xp_once(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp_once(uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.award_xp_once(uuid, text, text)
IS 'Atomic, idempotent service-role XP award; project comments are capped at 50 XP per Asia/Shanghai day';

-- The preceding migration may already have been applied before the new RPC
-- and trigger definitions existed. Force PostgREST to discard its old cache.
NOTIFY pgrst, 'reload schema';
