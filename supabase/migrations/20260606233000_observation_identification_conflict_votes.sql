-- Keep identifications open after community confirmation. Conflicting active
-- votes no longer erase consensus unless another species becomes the stronger
-- confirmed candidate.

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

  SELECT vote_groups.species_id
    INTO v_confirmed_species_id
  FROM (
    SELECT
      oi.species_id,
      count(*) AS total_votes,
      count(DISTINCT oi.identifier_user_id) FILTER (WHERE oi.source = 'human') AS human_votes,
      bool_or(oi.source = 'human' AND oi.identifier_user_id <> v_owner_id) AS has_non_owner_human,
      bool_or(oi.source = 'ai') AS has_ai,
      max(oi.created_at) AS latest_vote_at
    FROM public.observation_identifications oi
    WHERE oi.observation_event_id = p_observation_id
      AND oi.is_active = TRUE
    GROUP BY oi.species_id
  ) vote_groups
  WHERE (
      vote_groups.human_votes >= 2
      OR (vote_groups.has_ai = TRUE AND vote_groups.has_non_owner_human = TRUE)
    )
  ORDER BY
    vote_groups.total_votes DESC,
    vote_groups.human_votes DESC,
    vote_groups.has_ai DESC,
    vote_groups.latest_vote_at DESC,
    vote_groups.species_id ASC
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

REVOKE ALL ON FUNCTION public.recalculate_observation_identification(BIGINT) FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
