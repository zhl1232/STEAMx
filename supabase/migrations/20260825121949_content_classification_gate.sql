-- Content classification phase 2: publish gates and an atomic rollout switch.
--
-- This migration installs the database-enforced gate but deliberately leaves
-- enforcement_enabled/public_v1_enabled at their phase-1 defaults. The
-- rollout function can enable both only after the published rows are complete.

CREATE OR REPLACE FUNCTION public.content_classification_is_complete(
  p_min_age integer,
  p_max_age integer,
  p_support_level text,
  p_classification_status text,
  p_classification_source text,
  p_reviewed_at timestamptz,
  p_reviewed_by uuid,
  p_difficulty_stars integer
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    p_classification_status = 'reviewed'
    AND p_min_age BETWEEN 3 AND 16
    AND (p_max_age IS NULL OR (p_max_age >= p_min_age AND p_max_age <= 16))
    AND p_support_level IN ('independent', 'guided', 'adult_required')
    AND p_difficulty_stars BETWEEN 1 AND 6
    AND p_classification_source = 'manual'
    AND p_reviewed_at IS NOT NULL
    AND p_reviewed_by IS NOT NULL,
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.content_classification_enforcement_is_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT settings.enforcement_enabled
        FROM public.content_classification_settings AS settings
       WHERE settings.id IS TRUE
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_content_classification_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_public_state boolean := false;
  v_was_public_state boolean := false;
  v_content_type text := CASE TG_TABLE_NAME
    WHEN 'courses' THEN 'course'
    WHEN 'projects' THEN 'project'
    WHEN 'challenges' THEN 'challenge'
  END;
BEGIN
  IF NOT public.content_classification_enforcement_is_enabled() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'courses' THEN
    v_public_state := NEW.status = 'approved';
  ELSIF TG_TABLE_NAME = 'projects' THEN
    v_public_state := NEW.status = 'approved' AND NEW.moderation_state = 'approved';
  ELSIF TG_TABLE_NAME = 'challenges' THEN
    v_public_state := NEW.status IN ('active', 'ended');
  END IF;

  -- A semantic edit to an already-public row invalidates its classification
  -- in the phase-1 trigger. That edit must be allowed to commit so the phase-2
  -- reviewed-only public queries can hide the row while it returns to review.
  -- The gate itself is for entering a public state, not for preventing that
  -- invalidation path from clearing an old reviewed label.
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'courses' THEN
      v_was_public_state := OLD.status = 'approved';
    ELSIF TG_TABLE_NAME = 'projects' THEN
      v_was_public_state := OLD.status = 'approved' AND OLD.moderation_state = 'approved';
    ELSIF TG_TABLE_NAME = 'challenges' THEN
      v_was_public_state := OLD.status IN ('active', 'ended');
    END IF;
  END IF;

  IF v_public_state
     AND (TG_OP = 'INSERT' OR NOT v_was_public_state)
     AND NOT public.content_classification_is_complete(
    NEW.recommended_min_age,
    NEW.recommended_max_age,
    NEW.support_level,
    NEW.classification_status,
    NEW.classification_source,
    NEW.classification_reviewed_at,
    NEW.classification_reviewed_by,
    NEW.difficulty_stars
  ) THEN
    RAISE EXCEPTION 'CLASSIFICATION_REQUIRED'
      USING ERRCODE = 'P0001',
            DETAIL = format('%s:%s must have a complete reviewed classification before publication', v_content_type, NEW.id),
            HINT = 'Review recommended age, difficulty, support level and reviewer metadata before changing the public status.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS courses_content_classification_publish_gate ON public.courses;
CREATE TRIGGER courses_content_classification_publish_gate
  BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_classification_publish_gate();

DROP TRIGGER IF EXISTS projects_content_classification_publish_gate ON public.projects;
CREATE TRIGGER projects_content_classification_publish_gate
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_classification_publish_gate();

DROP TRIGGER IF EXISTS challenges_content_classification_publish_gate ON public.challenges;
CREATE TRIGGER challenges_content_classification_publish_gate
  BEFORE INSERT OR UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_classification_publish_gate();

-- Atomic stage-2 cutover. It takes the same rollout advisory lock used by the
-- watchdog, checks every currently public row, and only then flips both flags.
CREATE OR REPLACE FUNCTION public.enable_content_classification_rollout(
  p_actor_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := COALESCE(auth.uid(), p_actor_id);
  v_reason text := NULLIF(trim(p_reason), '');
  v_published_unreviewed bigint := 0;
  v_published_incomplete bigint := 0;
  v_settings public.content_classification_settings%ROWTYPE;
BEGIN
  IF NOT public.is_moderator_or_admin()
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NOT NULL AND p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor must come from the authenticated session' USING ERRCODE = '42501';
  END IF;
  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
      FROM public.profiles AS actor
     WHERE actor.id = v_actor_id
       AND actor.role IN ('moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'Actor must be a moderator or admin' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A rollout reason is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('content-classification-rollout'));

  SELECT * INTO v_settings
    FROM public.content_classification_settings AS settings
   WHERE settings.id IS TRUE
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'content_classification_settings row is missing' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_published_unreviewed
    FROM public.courses AS course
   WHERE course.status = 'approved'
     AND course.classification_status IS DISTINCT FROM 'reviewed';

  SELECT v_published_unreviewed + COUNT(*) INTO v_published_unreviewed
    FROM public.projects AS project
   WHERE project.status = 'approved'
     AND project.moderation_state = 'approved'
     AND project.classification_status IS DISTINCT FROM 'reviewed';

  SELECT v_published_unreviewed + COUNT(*) INTO v_published_unreviewed
    FROM public.challenges AS challenge
   WHERE challenge.status IN ('active', 'ended')
     AND challenge.classification_status IS DISTINCT FROM 'reviewed';

  SELECT COUNT(*) INTO v_published_incomplete
    FROM public.courses AS course
   WHERE course.status = 'approved'
     AND NOT public.content_classification_is_complete(
       course.recommended_min_age,
       course.recommended_max_age,
       course.support_level,
       course.classification_status,
       course.classification_source,
       course.classification_reviewed_at,
       course.classification_reviewed_by,
       course.difficulty_stars
     );

  SELECT v_published_incomplete + COUNT(*) INTO v_published_incomplete
    FROM public.projects AS project
   WHERE project.status = 'approved'
     AND project.moderation_state = 'approved'
     AND NOT public.content_classification_is_complete(
       project.recommended_min_age,
       project.recommended_max_age,
       project.support_level,
       project.classification_status,
       project.classification_source,
       project.classification_reviewed_at,
       project.classification_reviewed_by,
       project.difficulty_stars
     );

  SELECT v_published_incomplete + COUNT(*) INTO v_published_incomplete
    FROM public.challenges AS challenge
   WHERE challenge.status IN ('active', 'ended')
     AND NOT public.content_classification_is_complete(
       challenge.recommended_min_age,
       challenge.recommended_max_age,
       challenge.support_level,
       challenge.classification_status,
       challenge.classification_source,
       challenge.classification_reviewed_at,
       challenge.classification_reviewed_by,
       challenge.difficulty_stars
     );

  IF v_published_unreviewed > 0 OR v_published_incomplete > 0 THEN
    RAISE EXCEPTION 'CLASSIFICATION_ROLLOUT_BLOCKED'
      USING ERRCODE = 'P0001',
            DETAIL = format(
              'published_unreviewed_count=%s published_incomplete_count=%s',
              v_published_unreviewed,
              v_published_incomplete
            );
  END IF;

  UPDATE public.content_classification_settings
     SET public_v1_enabled = true,
         enforcement_enabled = true,
         emergency_reason = NULL,
         emergency_actor_id = NULL,
         enforcement_expires_at = NULL,
         updated_at = now(),
         updated_by = v_actor_id
   WHERE id IS TRUE;

  INSERT INTO public.content_classification_rollout_events (
    event_type,
    actor_type,
    actor_id,
    reason
  ) VALUES (
    'rollout_enabled',
    'user',
    v_actor_id,
    v_reason
  );

  RETURN jsonb_build_object(
    'publicV1Enabled', true,
    'enforcementEnabled', true,
    'publishedUnreviewedCount', v_published_unreviewed,
    'publishedIncompleteCount', v_published_incomplete,
    'actorId', v_actor_id,
    'reason', v_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.content_classification_is_complete(integer, integer, text, text, text, timestamptz, uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.content_classification_enforcement_is_enabled() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.enforce_content_classification_publish_gate() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.enable_content_classification_rollout(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enable_content_classification_rollout(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
