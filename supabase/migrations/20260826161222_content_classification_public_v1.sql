-- Content classification phase 1 public display.
--
-- Reviewed content can expose the three public axes without enabling the
-- phase-2 publish gate. Unreviewed content remains visible under the existing
-- phase-1 policy, but its public classification stays null.

ALTER TABLE public.content_classification_rollout_events
  DROP CONSTRAINT IF EXISTS content_classification_rollout_events_event_type_check;

ALTER TABLE public.content_classification_rollout_events
  ADD CONSTRAINT content_classification_rollout_events_event_type_check
  CHECK (event_type IN (
    'rollout_enabled',
    'public_enabled',
    'public_disabled',
    'emergency_disabled',
    'auto_restored'
  ));

CREATE OR REPLACE FUNCTION public.set_content_classification_public_v1(
  p_enabled boolean,
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
  v_reviewed_incomplete bigint := 0;
  v_published_unreviewed bigint := 0;
  v_settings public.content_classification_settings%ROWTYPE;
BEGIN
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'public_v1 enabled state is required' USING ERRCODE = '22023';
  END IF;

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
    RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('content-classification-rollout'));

  SELECT * INTO v_settings
    FROM public.content_classification_settings AS settings
   WHERE settings.id IS TRUE
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'content_classification_settings row is missing' USING ERRCODE = 'P0001';
  END IF;

  IF v_settings.public_v1_enabled IS NOT DISTINCT FROM p_enabled THEN
    RETURN jsonb_build_object(
      'changed', false,
      'publicV1Enabled', v_settings.public_v1_enabled,
      'enforcementEnabled', v_settings.enforcement_enabled,
      'actorId', v_actor_id,
      'reason', v_reason
    );
  END IF;

  IF p_enabled THEN
    SELECT COUNT(*) INTO v_reviewed_incomplete
      FROM public.courses AS course
     WHERE course.status = 'approved'
       AND course.classification_status = 'reviewed'
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

    SELECT v_reviewed_incomplete + COUNT(*) INTO v_reviewed_incomplete
      FROM public.projects AS project
     WHERE project.status = 'approved'
       AND project.moderation_state = 'approved'
       AND project.classification_status = 'reviewed'
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

    SELECT v_reviewed_incomplete + COUNT(*) INTO v_reviewed_incomplete
      FROM public.challenges AS challenge
     WHERE challenge.status IN ('active', 'ended')
       AND challenge.classification_status = 'reviewed'
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

    IF v_reviewed_incomplete > 0 THEN
      RAISE EXCEPTION 'PUBLIC_CLASSIFICATION_BLOCKED'
        USING ERRCODE = 'P0001',
              DETAIL = format('reviewed_incomplete_count=%s', v_reviewed_incomplete);
    END IF;
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

  UPDATE public.content_classification_settings
     SET public_v1_enabled = p_enabled,
         updated_at = now(),
         updated_by = v_actor_id
   WHERE id IS TRUE;

  INSERT INTO public.content_classification_rollout_events (
    event_type,
    actor_type,
    actor_id,
    reason
  ) VALUES (
    CASE WHEN p_enabled THEN 'public_enabled' ELSE 'public_disabled' END,
    'user',
    v_actor_id,
    v_reason
  );

  RETURN jsonb_build_object(
    'changed', true,
    'publicV1Enabled', p_enabled,
    'enforcementEnabled', v_settings.enforcement_enabled,
    'publishedUnreviewedCount', v_published_unreviewed,
    'reviewedIncompleteCount', v_reviewed_incomplete,
    'actorId', v_actor_id,
    'reason', v_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_content_classification_public_v1(boolean, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_content_classification_public_v1(boolean, uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
