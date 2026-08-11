-- Let an author reuse an already-approved exploration step as the project's
-- final work. The designation, XP reward, and exploration completion must be
-- committed atomically so a network/server failure cannot leave partial state.

CREATE OR REPLACE FUNCTION public.promote_progress_completion_to_final(
  p_completion_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_completion record;
  v_reward jsonb;
  v_existing_final_id bigint;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT
    completion.id,
    completion.user_id,
    completion.project_id,
    completion.course_lesson_id,
    completion.exploration_id,
    completion.record_kind,
    completion.status,
    completion.moderation_state
  INTO v_completion
  FROM public.completed_projects completion
  WHERE completion.id = p_completion_id
  FOR UPDATE;

  IF NOT FOUND OR v_completion.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'COMPLETION_NOT_FOUND';
  END IF;

  IF v_completion.record_kind = 'final' THEN
    RETURN jsonb_build_object(
      'completion_id', v_completion.id,
      'status', v_completion.status,
      'record_kind', 'final',
      'xp_awarded', false,
      'already_final', true
    );
  END IF;

  IF v_completion.record_kind <> 'progress'
     OR v_completion.project_id IS NULL
     OR v_completion.course_lesson_id IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_PROGRESS_REQUIRED';
  END IF;

  IF v_completion.status <> 'approved'
     OR v_completion.moderation_state <> 'approved' THEN
    RAISE EXCEPTION 'COMPLETION_NOT_APPROVED';
  END IF;

  SELECT completion.id
  INTO v_existing_final_id
  FROM public.completed_projects completion
  WHERE completion.user_id = v_completion.user_id
    AND completion.project_id = v_completion.project_id
    AND completion.record_kind = 'final'
    AND completion.status IN ('pending', 'approved')
    AND completion.id <> v_completion.id
  ORDER BY completion.id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_existing_final_id IS NOT NULL THEN
    RAISE EXCEPTION 'FINAL_ALREADY_EXISTS';
  END IF;

  BEGIN
    UPDATE public.completed_projects
    SET record_kind = 'final'
    WHERE id = v_completion.id;
  EXCEPTION
    WHEN unique_violation THEN
      -- The partial unique index is the final concurrency guard. Convert its
      -- race outcome into the same domain error as the pre-check above.
      RAISE EXCEPTION 'FINAL_ALREADY_EXISTS';
  END;

  v_reward := public._approve_completion_with_reward(v_completion.id, NULL);

  UPDATE public.project_explorations
  SET status = 'completed',
      completed_at = v_now,
      last_activity_at = v_now,
      updated_at = v_now
  WHERE id = v_completion.exploration_id
    AND user_id = v_completion.user_id
    AND project_id = v_completion.project_id;

  RETURN jsonb_build_object(
    'completion_id', v_completion.id,
    'status', 'approved',
    'record_kind', 'final',
    'xp_awarded', COALESCE((v_reward ->> 'xp_awarded')::boolean, false),
    'already_final', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.promote_progress_completion_to_final(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_progress_completion_to_final(bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.promote_progress_completion_to_final(bigint) TO authenticated;

COMMENT ON FUNCTION public.promote_progress_completion_to_final(bigint) IS
  'Author-only atomic conversion of an approved project progress record into the final work.';
