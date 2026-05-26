-- Carry user-submitted lifecycle stage and sex from the observation event onto
-- the confirmed species link so per-species aggregates can include them.

ALTER TABLE public.observation_events
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT,
  ADD COLUMN IF NOT EXISTS sex TEXT;

ALTER TABLE public.observation_events
  DROP CONSTRAINT IF EXISTS observation_events_lifecycle_stage_check,
  ADD CONSTRAINT observation_events_lifecycle_stage_check
    CHECK (lifecycle_stage IS NULL OR lifecycle_stage IN
      ('egg', 'larva', 'pupa', 'juvenile', 'adult', 'unknown')),
  DROP CONSTRAINT IF EXISTS observation_events_sex_check,
  ADD CONSTRAINT observation_events_sex_check
    CHECK (sex IS NULL OR sex IN ('male', 'female', 'unknown'));

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
  v_lifecycle_stage TEXT;
  v_sex TEXT;
BEGIN
  SELECT oe.user_id, oe.lifecycle_stage, oe.sex
    INTO v_owner_id, v_lifecycle_stage, v_sex
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
      v_lifecycle_stage,
      v_sex
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
