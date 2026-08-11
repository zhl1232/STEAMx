-- Completion XP logs use UUID primary keys. The reward functions previously
-- stored RETURNING id in a bigint variable, so final-work approval failed after
-- the XP row was inserted (the whole transaction then rolled back). Anchor the
-- local variable to the table column type to prevent the two from drifting.

CREATE OR REPLACE FUNCTION public._approve_completion_with_reward(
  p_completion_id bigint,
  p_reviewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_completion record;
  v_action_type text;
  v_resource_id text;
  v_xp_log_id public.xp_logs.id%TYPE;
  v_xp_awarded boolean := false;
BEGIN
  SELECT id, user_id, project_id, course_lesson_id, record_kind, status
  INTO v_completion
  FROM public.completed_projects
  WHERE id = p_completion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Completion % not found', p_completion_id;
  END IF;

  IF v_completion.status = 'rejected' THEN
    RAISE EXCEPTION 'Rejected completion % cannot be approved', p_completion_id;
  END IF;

  IF COALESCE(v_completion.record_kind, 'final') = 'final' THEN
    IF v_completion.course_lesson_id IS NOT NULL THEN
      v_action_type := 'publish_course_work';
      v_resource_id := v_completion.course_lesson_id::text;
    ELSIF v_completion.project_id IS NOT NULL THEN
      v_action_type := 'complete_project';
      v_resource_id := v_completion.project_id::text;
    ELSE
      RAISE EXCEPTION 'Final completion % has no source', p_completion_id;
    END IF;

    INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
    VALUES (v_completion.user_id, v_action_type, v_resource_id, 20)
    ON CONFLICT (user_id, action_type, resource_id) DO NOTHING
    RETURNING id INTO v_xp_log_id;

    IF v_xp_log_id IS NOT NULL THEN
      UPDATE public.profiles
      SET xp = COALESCE(xp, 0) + 20
      WHERE id = v_completion.user_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile for user % not found', v_completion.user_id;
      END IF;
      v_xp_awarded := true;
    END IF;
  END IF;

  UPDATE public.completed_projects
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = now(),
      rejection_reason = NULL,
      moderation_source = CASE
        WHEN p_reviewer_id IS NULL THEN COALESCE(moderation_source, 'ai')
        ELSE moderation_source
      END
  WHERE id = p_completion_id;

  RETURN jsonb_build_object(
    'completion_id', p_completion_id,
    'status', 'approved',
    'xp_awarded', v_xp_awarded,
    'record_kind', COALESCE(v_completion.record_kind, 'final')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_completion_rewards(
  p_apply boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_completion record;
  v_locked record;
  v_action_type text;
  v_resource_id text;
  v_xp_log_id public.xp_logs.id%TYPE;
  v_candidates integer := 0;
  v_applied integer := 0;
  v_dry_run boolean := NOT COALESCE(p_apply, false);
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'repair_completion_rewards is service-role only';
  END IF;

  FOR v_completion IN
    SELECT completion.id
    FROM public.completed_projects completion
    WHERE completion.status = 'approved'
      AND COALESCE(completion.record_kind, 'final') = 'final'
      AND (
        (
          completion.course_lesson_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.xp_logs log
            WHERE log.user_id = completion.user_id
              AND log.action_type = 'publish_course_work'
              AND log.resource_id = completion.course_lesson_id::text
          )
        )
        OR (
          completion.course_lesson_id IS NULL
          AND completion.project_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.xp_logs log
            WHERE log.user_id = completion.user_id
              AND log.action_type = 'complete_project'
              AND log.resource_id = completion.project_id::text
          )
        )
      )
    ORDER BY completion.id
  LOOP
    v_candidates := v_candidates + 1;
    IF v_dry_run THEN
      CONTINUE;
    END IF;

    SELECT id, user_id, project_id, course_lesson_id, record_kind, status
    INTO v_locked
    FROM public.completed_projects
    WHERE id = v_completion.id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_locked.status <> 'approved'
       OR COALESCE(v_locked.record_kind, 'final') <> 'final' THEN
      CONTINUE;
    END IF;

    IF v_locked.course_lesson_id IS NOT NULL THEN
      v_action_type := 'publish_course_work';
      v_resource_id := v_locked.course_lesson_id::text;
    ELSIF v_locked.project_id IS NOT NULL THEN
      v_action_type := 'complete_project';
      v_resource_id := v_locked.project_id::text;
    ELSE
      CONTINUE;
    END IF;

    v_xp_log_id := NULL;
    INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
    VALUES (v_locked.user_id, v_action_type, v_resource_id, 20)
    ON CONFLICT (user_id, action_type, resource_id) DO NOTHING
    RETURNING id INTO v_xp_log_id;

    IF v_xp_log_id IS NOT NULL THEN
      UPDATE public.profiles
      SET xp = COALESCE(xp, 0) + 20
      WHERE id = v_locked.user_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile for user % not found', v_locked.user_id;
      END IF;
      v_applied := v_applied + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', v_dry_run,
    'candidates', v_candidates,
    'applied', v_applied
  );
END;
$$;

-- CREATE OR REPLACE preserves historical ACL entries. Restore the intended
-- boundary explicitly: browser admins use the checked wrapper, while system
-- and repair entry points remain service-role only.
REVOKE ALL ON FUNCTION public._approve_completion_with_reward(bigint, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_completion_with_reward(bigint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_completion_with_reward(bigint)
  TO authenticated;

REVOKE ALL ON FUNCTION public.system_approve_completion_with_reward(bigint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.system_approve_completion_with_reward(bigint)
  TO service_role;

REVOKE ALL ON FUNCTION public.repair_completion_rewards(boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.repair_completion_rewards(boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.approve_completion(bigint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_completion(bigint)
  TO authenticated;

REVOKE ALL ON FUNCTION public.system_approve_completion(bigint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.system_approve_completion(bigint)
  TO service_role;

COMMENT ON FUNCTION public._approve_completion_with_reward(bigint, uuid) IS
  'Internal atomic completion approval; XP log identity follows xp_logs.id type.';
COMMENT ON FUNCTION public.repair_completion_rewards(boolean) IS
  'Service-role-only dry-run/apply repair for approved final works missing source-keyed XP.';

NOTIFY pgrst, 'reload schema';
