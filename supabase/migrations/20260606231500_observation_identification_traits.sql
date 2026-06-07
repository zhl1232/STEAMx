-- Optional lifecycle stage and sex on each community identification.

ALTER TABLE public.observation_identifications
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT,
  ADD COLUMN IF NOT EXISTS sex TEXT;

ALTER TABLE public.observation_identifications
  DROP CONSTRAINT IF EXISTS observation_identifications_lifecycle_stage_check,
  ADD CONSTRAINT observation_identifications_lifecycle_stage_check
    CHECK (lifecycle_stage IS NULL OR lifecycle_stage IN
      ('egg', 'larva', 'pupa', 'juvenile', 'adult', 'unknown')),
  DROP CONSTRAINT IF EXISTS observation_identifications_sex_check,
  ADD CONSTRAINT observation_identifications_sex_check
    CHECK (sex IS NULL OR sex IN ('male', 'female', 'unknown'));

UPDATE public.observation_identifications oi
SET lifecycle_stage = COALESCE(oi.lifecycle_stage, oe.lifecycle_stage),
    sex = COALESCE(oi.sex, oe.sex),
    updated_at = now()
FROM public.observation_events oe
WHERE oi.observation_event_id = oe.id
  AND oi.source = 'human'
  AND oi.identifier_user_id = oe.user_id
  AND (oe.lifecycle_stage IS NOT NULL OR oe.sex IS NOT NULL);

CREATE OR REPLACE FUNCTION public.recalculate_observation_identification(
  p_observation_id BIGINT
)
RETURNS TABLE (identification_status TEXT, confirmed_species_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_confirmed_species_id BIGINT;
  v_status TEXT := 'needs_id';
  v_confidence NUMERIC(3, 2);
  v_event_lifecycle_stage TEXT;
  v_event_sex TEXT;
  v_identification_lifecycle_stage TEXT;
  v_identification_sex TEXT;
BEGIN
  SELECT oe.user_id, oe.lifecycle_stage, oe.sex
    INTO v_owner_id, v_event_lifecycle_stage, v_event_sex
  FROM public.observation_events oe
  WHERE oe.id = p_observation_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Observation not found';
  END IF;

  SELECT votes.species_id
    INTO v_confirmed_species_id
  FROM (
    SELECT
      oi.species_id,
      count(DISTINCT oi.identifier_user_id) FILTER (WHERE oi.source = 'human') AS human_votes,
      bool_or(oi.source = 'human' AND oi.identifier_user_id <> v_owner_id) AS has_non_owner_human,
      bool_or(oi.source = 'ai') AS has_ai
    FROM public.observation_identifications oi
    WHERE oi.observation_event_id = p_observation_id
      AND oi.is_active = TRUE
    GROUP BY oi.species_id
  ) votes
  WHERE (
      votes.human_votes >= 2
      OR (votes.has_ai = TRUE AND votes.has_non_owner_human = TRUE)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.observation_identifications conflict
      WHERE conflict.observation_event_id = p_observation_id
        AND conflict.is_active = TRUE
        AND conflict.species_id <> votes.species_id
    )
  LIMIT 1;

  DELETE FROM public.observation_event_species
  WHERE observation_event_id = p_observation_id;

  IF v_confirmed_species_id IS NOT NULL THEN
    SELECT max(oi.confidence) INTO v_confidence
    FROM public.observation_identifications oi
    WHERE oi.observation_event_id = p_observation_id
      AND oi.species_id = v_confirmed_species_id
      AND oi.source = 'ai'
      AND oi.is_active = TRUE;

    SELECT oi.lifecycle_stage INTO v_identification_lifecycle_stage
    FROM public.observation_identifications oi
    WHERE oi.observation_event_id = p_observation_id
      AND oi.species_id = v_confirmed_species_id
      AND oi.lifecycle_stage IS NOT NULL
      AND oi.is_active = TRUE
    GROUP BY oi.lifecycle_stage
    ORDER BY count(*) DESC, max(oi.created_at) DESC, oi.lifecycle_stage ASC
    LIMIT 1;

    SELECT oi.sex INTO v_identification_sex
    FROM public.observation_identifications oi
    WHERE oi.observation_event_id = p_observation_id
      AND oi.species_id = v_confirmed_species_id
      AND oi.sex IS NOT NULL
      AND oi.is_active = TRUE
    GROUP BY oi.sex
    ORDER BY count(*) DESC, max(oi.created_at) DESC, oi.sex ASC
    LIMIT 1;

    INSERT INTO public.observation_event_species (
      observation_event_id,
      species_id,
      behavior_tags,
      confidence,
      lifecycle_stage,
      sex
    ) VALUES (
      p_observation_id,
      v_confirmed_species_id,
      '{}',
      v_confidence,
      COALESCE(v_event_lifecycle_stage, v_identification_lifecycle_stage),
      COALESCE(v_event_sex, v_identification_sex)
    );
    v_status := 'community_confirmed';
  END IF;

  UPDATE public.observation_events oe
  SET identification_status = v_status,
      updated_at = now()
  WHERE oe.id = p_observation_id;

  RETURN QUERY SELECT v_status, v_confirmed_species_id;
END;
$$;

DROP FUNCTION IF EXISTS public.upsert_observation_identification(BIGINT, BIGINT, TEXT, NUMERIC, TEXT, BIGINT);

CREATE OR REPLACE FUNCTION public.upsert_observation_identification(
  p_observation_id BIGINT,
  p_species_id BIGINT,
  p_source TEXT DEFAULT 'human',
  p_confidence NUMERIC DEFAULT NULL,
  p_model_name TEXT DEFAULT NULL,
  p_media_analysis_id BIGINT DEFAULT NULL,
  p_lifecycle_stage TEXT DEFAULT NULL,
  p_sex TEXT DEFAULT NULL
)
RETURNS TABLE (identification_status TEXT, confirmed_species_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_observation public.observation_events%ROWTYPE;
  v_species_topic TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_lifecycle_stage IS NOT NULL
    AND p_lifecycle_stage NOT IN ('egg', 'larva', 'pupa', 'juvenile', 'adult', 'unknown') THEN
    RAISE EXCEPTION 'Invalid lifecycle stage';
  END IF;

  IF p_sex IS NOT NULL AND p_sex NOT IN ('male', 'female', 'unknown') THEN
    RAISE EXCEPTION 'Invalid sex';
  END IF;

  SELECT * INTO v_observation
  FROM public.observation_events
  WHERE id = p_observation_id;

  IF NOT FOUND OR NOT (
    v_observation.user_id = v_user_id
    OR (v_observation.is_public = TRUE AND v_observation.status = 'approved')
  ) THEN
    RAISE EXCEPTION 'Observation not available for identification';
  END IF;

  SELECT nature_topic INTO v_species_topic
  FROM public.species
  WHERE id = p_species_id AND is_active = TRUE;

  IF NOT FOUND OR (
    v_observation.nature_topic IS NOT NULL
    AND v_species_topic <> v_observation.nature_topic
  ) THEN
    RAISE EXCEPTION 'Species does not belong to this observation topic';
  END IF;

  IF p_source = 'human' THEN
    UPDATE public.observation_identifications
    SET is_active = FALSE, withdrawn_at = now(), updated_at = now()
    WHERE observation_event_id = p_observation_id
      AND source = 'human'
      AND identifier_user_id = v_user_id
      AND is_active = TRUE;

    INSERT INTO public.observation_identifications (
      observation_event_id,
      species_id,
      source,
      identifier_user_id,
      lifecycle_stage,
      sex
    ) VALUES (
      p_observation_id,
      p_species_id,
      'human',
      v_user_id,
      p_lifecycle_stage,
      p_sex
    );
  ELSE
    RAISE EXCEPTION 'Only human identifications may be submitted by a user';
  END IF;

  RETURN QUERY SELECT * FROM public.recalculate_observation_identification(p_observation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_observation_identification(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_observation_identification(BIGINT, BIGINT, TEXT, NUMERIC, TEXT, BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_observation_identification(BIGINT, BIGINT, TEXT, NUMERIC, TEXT, BIGINT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
