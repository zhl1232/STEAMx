-- Course progress hardening, immutable course milestones, atomic work rewards,
-- and the stable STEAM activity model.

-- -----------------------------------------------------------------------------
-- 1. Course configuration validation
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_valid_course_steam_config(
  p_weights jsonb,
  p_difficulty smallint
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_dimension text;
  v_weight numeric;
  v_has_positive boolean := false;
BEGIN
  IF p_difficulty IS NULL OR p_difficulty < 1 OR p_difficulty > 6 THEN
    RETURN false;
  END IF;

  IF p_weights IS NULL OR jsonb_typeof(p_weights) <> 'object' THEN
    RETURN false;
  END IF;

  FOREACH v_dimension IN ARRAY ARRAY['S', 'T', 'E', 'A', 'M']
  LOOP
    IF NOT (p_weights ? v_dimension)
       OR jsonb_typeof(p_weights -> v_dimension) <> 'number' THEN
      RETURN false;
    END IF;

    v_weight := (p_weights ->> v_dimension)::numeric;
    IF v_weight < 0 OR v_weight::text IN ('Infinity', '-Infinity', 'NaN') THEN
      RETURN false;
    END IF;
    v_has_positive := v_has_positive OR v_weight > 0;
  END LOOP;

  RETURN v_has_positive;
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$;

COMMENT ON FUNCTION public.is_valid_course_steam_config(jsonb, smallint) IS
  'Validates the five required non-negative finite STEAM weights and a 1-6 difficulty.';

UPDATE public.courses
SET difficulty_stars = 1
WHERE difficulty_stars IS NULL;

UPDATE public.courses
SET steam_weights = '{"S":5,"T":35,"E":5,"A":15,"M":15}'::jsonb
WHERE steam_weights IS NULL;

ALTER TABLE public.courses
  ALTER COLUMN difficulty_stars SET DEFAULT 1,
  ALTER COLUMN steam_weights SET DEFAULT '{"S":5,"T":35,"E":5,"A":15,"M":15}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'courses_steam_weights_valid'
      AND conrelid = 'public.courses'::regclass
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_steam_weights_valid
      CHECK (public.is_valid_course_steam_config(steam_weights, difficulty_stars))
      NOT VALID;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Trust source for completion facts
-- -----------------------------------------------------------------------------

ALTER TABLE public.user_lesson_progress
  ADD COLUMN IF NOT EXISTS completion_source text;

UPDATE public.user_lesson_progress
SET completion_source = 'legacy_client'
WHERE completed_at IS NOT NULL
  AND completion_source IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_lesson_progress_completion_source_check'
      AND conrelid = 'public.user_lesson_progress'::regclass
  ) THEN
    ALTER TABLE public.user_lesson_progress
      ADD CONSTRAINT user_lesson_progress_completion_source_check
      CHECK (completion_source IS NULL OR completion_source IN ('legacy_client', 'server_v1', 'staff_verified'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_lesson_progress_trusted_completion_idx
  ON public.user_lesson_progress (user_id, lesson_id, completed_at)
  WHERE completed_at IS NOT NULL
    AND completion_source IN ('server_v1', 'staff_verified');

DROP POLICY IF EXISTS "user_lesson_progress_insert" ON public.user_lesson_progress;
DROP POLICY IF EXISTS "user_lesson_progress_update" ON public.user_lesson_progress;
DROP POLICY IF EXISTS "user_lesson_progress_delete" ON public.user_lesson_progress;
REVOKE INSERT, UPDATE, DELETE ON public.user_lesson_progress FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_lesson_progress TO authenticated;

COMMENT ON COLUMN public.user_lesson_progress.completion_source IS
  'Trust boundary for completed_at: legacy_client is historical and cannot create a course milestone.';

-- -----------------------------------------------------------------------------
-- 3. Immutable course completion milestones
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_course_completions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id bigint NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  completed_at timestamptz NOT NULL DEFAULT now(),
  trigger_lesson_id bigint REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  lesson_count_snapshot integer NOT NULL CHECK (lesson_count_snapshot > 0),
  steam_weights_snapshot jsonb NOT NULL,
  difficulty_stars_snapshot smallint NOT NULL
    CHECK (difficulty_stars_snapshot BETWEEN 1 AND 6),
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS user_course_completions_user_idx
  ON public.user_course_completions (user_id, completed_at, course_id);

CREATE INDEX IF NOT EXISTS user_course_completions_course_idx
  ON public.user_course_completions (course_id, completed_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_course_completions_steam_config_valid'
      AND conrelid = 'public.user_course_completions'::regclass
  ) THEN
    ALTER TABLE public.user_course_completions
      ADD CONSTRAINT user_course_completions_steam_config_valid
      CHECK (public.is_valid_course_steam_config(steam_weights_snapshot, difficulty_stars_snapshot))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.user_course_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_course_completions_select" ON public.user_course_completions;
CREATE POLICY "user_course_completions_select"
  ON public.user_course_completions
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_moderator_or_admin()
  );

REVOKE INSERT, UPDATE, DELETE ON public.user_course_completions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_course_completions TO authenticated;
GRANT ALL ON public.user_course_completions TO service_role;

COMMENT ON TABLE public.user_course_completions IS
  'One immutable, trusted STEAM contribution per user and course version (v1).';

-- -----------------------------------------------------------------------------
-- 4. Atomic lesson completion and milestone creation
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_course_lesson_completion(
  p_user_id uuid,
  p_course_id bigint,
  p_lesson_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course record;
  v_lesson record;
  v_progress record;
  v_total integer := 0;
  v_completed integer := 0;
  v_trusted_completed integer := 0;
  v_next_lesson_id bigint;
  v_milestone_completed_at timestamptz;
  v_status text := 'not_started';
  v_state text := 'not_complete';
  v_created boolean := false;
  v_already_completed boolean := false;
  v_inserted integer := 0;
  v_now timestamptz := now();
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'record_course_lesson_completion is service-role only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  -- Serialize the whole course for this user. The final two lessons must not
  -- observe an incomplete view of the other transaction.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(format('%s:%s', p_user_id, p_course_id), 0)
  );

  SELECT id, status, difficulty_stars, steam_weights
  INTO v_course
  FROM public.courses
  WHERE id = p_course_id
    AND status = 'approved'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved course % not found', p_course_id;
  END IF;

  SELECT id, course_id
  INTO v_lesson
  FROM public.course_lessons
  WHERE id = p_lesson_id
    AND course_id = p_course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson % does not belong to course %', p_lesson_id, p_course_id;
  END IF;

  SELECT completed_at, updated_at, completion_source
  INTO v_progress
  FROM public.user_lesson_progress
  WHERE user_id = p_user_id
    AND lesson_id = p_lesson_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_lesson_progress (
      user_id,
      lesson_id,
      completed_at,
      updated_at,
      completion_source
    )
    VALUES (p_user_id, p_lesson_id, v_now, v_now, 'server_v1')
    RETURNING completed_at, updated_at, completion_source INTO v_progress;
  ELSE
    v_already_completed := v_progress.completed_at IS NOT NULL;
    IF v_progress.completed_at IS NULL THEN
      UPDATE public.user_lesson_progress
      SET completed_at = v_now,
          updated_at = v_now,
          completion_source = 'server_v1'
      WHERE user_id = p_user_id
        AND lesson_id = p_lesson_id
      RETURNING completed_at, updated_at, completion_source INTO v_progress;
    ELSIF v_progress.completion_source IS DISTINCT FROM 'server_v1'
      AND v_progress.completion_source IS DISTINCT FROM 'staff_verified' THEN
      -- The route has revalidated legacy rows before calling this RPC.
      UPDATE public.user_lesson_progress
      SET updated_at = v_now,
          completion_source = 'server_v1'
      WHERE user_id = p_user_id
        AND lesson_id = p_lesson_id
      RETURNING completed_at, updated_at, completion_source INTO v_progress;
    END IF;
  END IF;

  SELECT count(*)::integer
  INTO v_total
  FROM public.course_lessons
  WHERE course_id = p_course_id;

  SELECT count(*)::integer
  INTO v_completed
  FROM public.user_lesson_progress progress
  JOIN public.course_lessons lesson ON lesson.id = progress.lesson_id
  WHERE progress.user_id = p_user_id
    AND lesson.course_id = p_course_id
    AND progress.completed_at IS NOT NULL;

  SELECT count(*)::integer
  INTO v_trusted_completed
  FROM public.user_lesson_progress progress
  JOIN public.course_lessons lesson ON lesson.id = progress.lesson_id
  WHERE progress.user_id = p_user_id
    AND lesson.course_id = p_course_id
    AND progress.completed_at IS NOT NULL
    AND progress.completion_source IN ('server_v1', 'staff_verified');

  IF v_total > 0 AND v_completed = v_total THEN
    v_status := 'completed';
  ELSIF v_completed > 0 THEN
    v_status := 'in_progress';
  END IF;

  SELECT lesson.id
  INTO v_next_lesson_id
  FROM public.course_lessons lesson
  LEFT JOIN public.user_lesson_progress progress
    ON progress.lesson_id = lesson.id
   AND progress.user_id = p_user_id
   AND progress.completed_at IS NOT NULL
  WHERE lesson.course_id = p_course_id
    AND progress.lesson_id IS NULL
  ORDER BY lesson.sort_order ASC, lesson.id ASC
  LIMIT 1;

  IF v_total > 0 AND v_completed = v_total AND v_trusted_completed = v_total THEN
    SELECT completed_at
    INTO v_milestone_completed_at
    FROM public.user_course_completions
    WHERE user_id = p_user_id
      AND course_id = p_course_id;

    IF v_milestone_completed_at IS NOT NULL THEN
      v_state := 'already_recorded';
    ELSIF public.is_valid_course_steam_config(v_course.steam_weights, v_course.difficulty_stars) THEN
      INSERT INTO public.user_course_completions (
        user_id,
        course_id,
        completed_at,
        trigger_lesson_id,
        lesson_count_snapshot,
        steam_weights_snapshot,
        difficulty_stars_snapshot
      )
      VALUES (
        p_user_id,
        p_course_id,
        v_now,
        p_lesson_id,
        v_total,
        v_course.steam_weights,
        v_course.difficulty_stars
      )
      ON CONFLICT (user_id, course_id) DO NOTHING;

      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      v_created := v_inserted = 1;
      v_state := CASE WHEN v_created THEN 'created' ELSE 'already_recorded' END;
    ELSE
      v_state := 'configuration_error';
      RAISE WARNING 'Course % has invalid STEAM configuration; user milestone deferred', p_course_id;
    END IF;
  END IF;

  IF v_milestone_completed_at IS NULL THEN
    SELECT completed_at
    INTO v_milestone_completed_at
    FROM public.user_course_completions
    WHERE user_id = p_user_id
      AND course_id = p_course_id;
  END IF;

  RETURN jsonb_build_object(
    'progress', jsonb_build_object(
      'user_id', p_user_id,
      'lesson_id', p_lesson_id,
      'completed_at', v_progress.completed_at,
      'updated_at', v_progress.updated_at
    ),
    'already_completed', v_already_completed,
    'completed_lesson_count', v_completed,
    'total_lesson_count', v_total,
    'status', v_status,
    'next_lesson_id', v_next_lesson_id,
    'milestone_completed_at', v_milestone_completed_at,
    'course_completion_created', v_created,
    'course_completion_state', v_state
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_course_lesson_completion(uuid, bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_course_lesson_completion(uuid, bigint, bigint) TO service_role;

COMMENT ON FUNCTION public.record_course_lesson_completion(uuid, bigint, bigint) IS
  'Service-role-only atomic lesson completion and trusted course milestone reconciliation.';

-- -----------------------------------------------------------------------------
-- 5. Trusted completion reconcile
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reconcile_course_completions(
  p_course_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course record;
  v_user record;
  v_total integer;
  v_inserted integer;
  v_courses integer := 0;
  v_created integer := 0;
  v_invalid integer := 0;
  v_legacy_excluded integer := 0;
  v_trigger_lesson_id bigint;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'reconcile_course_completions is service-role only';
  END IF;

  FOR v_course IN
    SELECT id, difficulty_stars, steam_weights
    FROM public.courses
    WHERE status = 'approved'
      AND (p_course_id IS NULL OR id = p_course_id)
    ORDER BY id
  LOOP
    v_courses := v_courses + 1;

    SELECT count(*)::integer
    INTO v_total
    FROM public.course_lessons
    WHERE course_id = v_course.id;

    IF v_total = 0 THEN
      CONTINUE;
    END IF;

    SELECT count(DISTINCT progress.user_id)::integer
    INTO v_inserted
    FROM public.user_lesson_progress progress
    JOIN public.course_lessons lesson ON lesson.id = progress.lesson_id
    WHERE lesson.course_id = v_course.id
      AND progress.completed_at IS NOT NULL
      AND progress.completion_source = 'legacy_client';
    v_legacy_excluded := v_legacy_excluded + COALESCE(v_inserted, 0);

    IF NOT public.is_valid_course_steam_config(v_course.steam_weights, v_course.difficulty_stars) THEN
      v_invalid := v_invalid + 1;
      CONTINUE;
    END IF;

    FOR v_user IN
      SELECT progress.user_id, max(progress.completed_at) AS completed_at
      FROM public.user_lesson_progress progress
      JOIN public.course_lessons lesson ON lesson.id = progress.lesson_id
      WHERE lesson.course_id = v_course.id
        AND progress.completed_at IS NOT NULL
        AND progress.completion_source IN ('server_v1', 'staff_verified')
      GROUP BY progress.user_id
      HAVING count(DISTINCT progress.lesson_id) = v_total
      ORDER BY progress.user_id
    LOOP
      SELECT progress.lesson_id
      INTO v_trigger_lesson_id
      FROM public.user_lesson_progress progress
      JOIN public.course_lessons lesson ON lesson.id = progress.lesson_id
      WHERE progress.user_id = v_user.user_id
        AND lesson.course_id = v_course.id
        AND progress.completed_at IS NOT NULL
        AND progress.completion_source IN ('server_v1', 'staff_verified')
      ORDER BY progress.completed_at DESC, progress.lesson_id DESC
      LIMIT 1;

      INSERT INTO public.user_course_completions (
        user_id,
        course_id,
        completed_at,
        trigger_lesson_id,
        lesson_count_snapshot,
        steam_weights_snapshot,
        difficulty_stars_snapshot
      )
      VALUES (
        v_user.user_id,
        v_course.id,
        v_user.completed_at,
        v_trigger_lesson_id,
        v_total,
        v_course.steam_weights,
        v_course.difficulty_stars
      )
      ON CONFLICT (user_id, course_id) DO NOTHING;

      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      IF v_inserted = 1 THEN
        v_created := v_created + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'courses_scanned', v_courses,
    'milestones_created', v_created,
    'invalid_config_courses', v_invalid,
    'legacy_excluded_users', v_legacy_excluded
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_course_completions(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_course_completions(bigint) TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Atomic approval and +20 XP for final works
-- -----------------------------------------------------------------------------

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
  v_xp_log_id bigint;
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

CREATE OR REPLACE FUNCTION public.approve_completion_with_reward(p_completion_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: only moderators and admins can approve completions';
  END IF;
  RETURN public._approve_completion_with_reward(p_completion_id, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.system_approve_completion_with_reward(p_completion_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'system_approve_completion_with_reward is service-role only';
  END IF;
  RETURN public._approve_completion_with_reward(p_completion_id, NULL);
END;
$$;

-- Repair only approved final works that are missing their source-keyed XP log.
-- The default is an audit; callers must explicitly pass true to apply changes.
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
  v_xp_log_id bigint;
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

-- Keep old callers atomic while they are migrated.
CREATE OR REPLACE FUNCTION public.approve_completion(completion_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.approve_completion_with_reward(completion_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.system_approve_completion(p_completion_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.system_approve_completion_with_reward(p_completion_id);
END;
$$;

REVOKE ALL ON FUNCTION public._approve_completion_with_reward(bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_completion_with_reward(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.system_approve_completion_with_reward(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_completion_rewards(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_completion(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.system_approve_completion(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_completion_with_reward(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_completion(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.system_approve_completion_with_reward(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.repair_completion_rewards(boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.system_approve_completion(bigint) TO service_role;

COMMENT ON FUNCTION public.approve_completion_with_reward(bigint) IS
  'Moderator/admin approval with idempotent final-work XP in one transaction.';
COMMENT ON FUNCTION public.system_approve_completion_with_reward(bigint) IS
  'Service-role AI/worker approval with idempotent final-work XP in one transaction.';
COMMENT ON FUNCTION public.repair_completion_rewards(boolean) IS
  'Service-role-only dry-run/apply repair for approved final works missing source-keyed XP.';

-- -----------------------------------------------------------------------------
-- 7. Stable STEAM radar activity sources
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS completed_projects_radar_source_idx
  ON public.completed_projects (user_id, completed_at, project_id)
  WHERE status = 'approved' AND record_kind = 'final' AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS challenge_completions_radar_source_idx
  ON public.challenge_completions (user_id, completed_at, challenge_id);

CREATE OR REPLACE FUNCTION public.calculate_steam_radar(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_rec record;
  v_n_easy int := 0;
  v_n_medium int := 0;
  v_n_hard int := 0;
  v_n int;
  v_mult numeric;
  v_decay numeric;
  v_weights jsonb;
  v_dim text;
  v_raw numeric;
  v_display numeric;
  v_tier text;
  v_raws jsonb := '{"S":0,"T":0,"E":0,"A":0,"M":0}'::jsonb;
  v_result jsonb := '{}'::jsonb;
  v_k numeric := 200.0;
  v_stars int;
BEGIN
  FOR v_rec IN
    WITH activity AS (
      SELECT
        cp.completed_at,
        'project'::text AS source_type,
        p.id AS source_id,
        COALESCE(
          p.steam_weights,
          (
            SELECT weights
            FROM public.steam_weight_defaults
            WHERE key = COALESCE(
              (SELECT name FROM public.sub_categories WHERE id = p.sub_category_id),
              p.category
            )
            LIMIT 1
          ),
          (
            SELECT weights
            FROM public.steam_weight_defaults
            WHERE key = COALESCE(p.category, '其他')
              AND level = 'category'
            LIMIT 1
          ),
          '{"S":5,"T":5,"E":5,"A":5,"M":5}'::jsonb
        ) AS weights,
        COALESCE(p.difficulty_stars, 3) AS stars
      FROM public.completed_projects cp
      JOIN public.projects p ON p.id = cp.project_id
      WHERE cp.user_id = target_user_id
        AND cp.status = 'approved'
        AND cp.record_kind = 'final'
        AND cp.project_id IS NOT NULL

      UNION ALL

      SELECT
        cc.completed_at,
        'challenge'::text AS source_type,
        c.id AS source_id,
        COALESCE(c.steam_weights, '{"S":5,"T":5,"E":5,"A":5,"M":5}'::jsonb) AS weights,
        COALESCE(c.difficulty_stars, 3) AS stars
      FROM public.challenge_completions cc
      JOIN public.challenges c ON c.id = cc.challenge_id
      WHERE cc.user_id = target_user_id

      UNION ALL

      SELECT
        completion.completed_at,
        'course'::text AS source_type,
        completion.course_id AS source_id,
        completion.steam_weights_snapshot AS weights,
        completion.difficulty_stars_snapshot AS stars
      FROM public.user_course_completions completion
      WHERE completion.user_id = target_user_id
    )
    SELECT *
    FROM activity
    ORDER BY completed_at ASC NULLS LAST, source_type ASC, source_id ASC
  LOOP
    v_stars := v_rec.stars;
    v_weights := v_rec.weights;

    IF v_stars <= 2 THEN
      v_mult := 0.5;
      v_n_easy := v_n_easy + 1;
      v_n := v_n_easy;
    ELSIF v_stars <= 4 THEN
      v_mult := 1.0;
      v_n_medium := v_n_medium + 1;
      v_n := v_n_medium;
    ELSE
      v_mult := 2.0;
      v_n_hard := v_n_hard + 1;
      v_n := v_n_hard;
    END IF;

    v_decay := 1.0 / sqrt(v_n::numeric);

    FOREACH v_dim IN ARRAY ARRAY['S', 'T', 'E', 'A', 'M']
    LOOP
      v_raw := COALESCE((v_weights ->> v_dim)::numeric, 0) * v_mult * v_decay;
      v_raws := jsonb_set(
        v_raws,
        ARRAY[v_dim],
        to_jsonb(COALESCE((v_raws ->> v_dim)::numeric, 0) + v_raw)
      );
    END LOOP;
  END LOOP;

  FOREACH v_dim IN ARRAY ARRAY['S', 'T', 'E', 'A', 'M']
  LOOP
    v_raw := COALESCE((v_raws ->> v_dim)::numeric, 0);
    v_display := round(100.0 * (1.0 - exp(-v_raw / v_k)), 1);

    IF v_display < 1 THEN
      v_tier := 'none';
    ELSIF v_display < 40 THEN
      v_tier := 'foundation';
    ELSIF v_display < 75 THEN
      v_tier := 'intermediate';
    ELSE
      v_tier := 'advanced';
    END IF;

    v_result := jsonb_set(v_result, ARRAY[v_dim], jsonb_build_object(
      'raw', round(v_raw, 1),
      'display', v_display,
      'tier', v_tier
    ));
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_steam_radar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_steam_radar(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
