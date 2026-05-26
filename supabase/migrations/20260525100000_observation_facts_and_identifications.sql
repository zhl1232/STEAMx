-- Natural observation facts, AI/human identifications, and community consensus.

ALTER TABLE public.observation_events
  ADD COLUMN IF NOT EXISTS nature_topic TEXT,
  ADD COLUMN IF NOT EXISTS identification_status TEXT NOT NULL DEFAULT 'needs_id',
  ADD COLUMN IF NOT EXISTS observed_at_source TEXT,
  ADD COLUMN IF NOT EXISTS location_source TEXT,
  ADD COLUMN IF NOT EXISTS coordinate_system TEXT;

ALTER TABLE public.observation_events
  DROP CONSTRAINT IF EXISTS observation_events_nature_topic_check,
  ADD CONSTRAINT observation_events_nature_topic_check
    CHECK (nature_topic IS NULL OR nature_topic IN ('birds', 'plants')),
  DROP CONSTRAINT IF EXISTS observation_events_identification_status_check,
  ADD CONSTRAINT observation_events_identification_status_check
    CHECK (identification_status IN ('needs_id', 'community_confirmed')),
  DROP CONSTRAINT IF EXISTS observation_events_observed_at_source_check,
  ADD CONSTRAINT observation_events_observed_at_source_check
    CHECK (observed_at_source IS NULL OR observed_at_source IN ('photo_exif', 'manual')),
  DROP CONSTRAINT IF EXISTS observation_events_location_source_check,
  ADD CONSTRAINT observation_events_location_source_check
    CHECK (location_source IS NULL OR location_source IN ('photo_exif', 'place_search', 'map_pin', 'device_location')),
  DROP CONSTRAINT IF EXISTS observation_events_coordinate_system_check,
  ADD CONSTRAINT observation_events_coordinate_system_check
    CHECK (coordinate_system IS NULL OR coordinate_system IN ('gcj02', 'legacy_unknown'));

CREATE INDEX IF NOT EXISTS idx_observation_events_topic_public_recent
  ON public.observation_events (nature_topic, observed_at DESC)
  WHERE status = 'approved' AND is_public = TRUE;

CREATE INDEX IF NOT EXISTS idx_observation_events_identification_status
  ON public.observation_events (identification_status, observed_at DESC);

-- Backfill a topic while the previous confirmed-species links still exist.
WITH event_topics AS (
  SELECT oes.observation_event_id, min(s.nature_topic) AS nature_topic
  FROM public.observation_event_species oes
  JOIN public.species s ON s.id = oes.species_id
  WHERE s.nature_topic IN ('birds', 'plants')
  GROUP BY oes.observation_event_id
  HAVING count(DISTINCT s.nature_topic) = 1
)
UPDATE public.observation_events oe
SET nature_topic = event_topics.nature_topic,
    coordinate_system = COALESCE(oe.coordinate_system, 'legacy_unknown')
FROM event_topics
WHERE oe.id = event_topics.observation_event_id
  AND oe.nature_topic IS NULL;

UPDATE public.observation_events
SET coordinate_system = 'legacy_unknown'
WHERE coordinate_system IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.observation_identifications (
  id BIGSERIAL PRIMARY KEY,
  observation_event_id BIGINT NOT NULL REFERENCES public.observation_events(id) ON DELETE CASCADE,
  species_id BIGINT NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  identifier_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confidence NUMERIC(3, 2),
  model_name TEXT,
  media_analysis_id BIGINT REFERENCES public.observation_media_analyses(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT observation_identifications_source_check CHECK (source IN ('human', 'ai')),
  CONSTRAINT observation_identifications_actor_check CHECK (
    (source = 'human' AND identifier_user_id IS NOT NULL AND model_name IS NULL)
    OR (source = 'ai' AND identifier_user_id IS NULL AND model_name IS NOT NULL)
  ),
  CONSTRAINT observation_identifications_confidence_check CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_identifications_active_human
  ON public.observation_identifications (observation_event_id, identifier_user_id)
  WHERE source = 'human' AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_identifications_active_ai
  ON public.observation_identifications (observation_event_id)
  WHERE source = 'ai' AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_observation_identifications_event_active
  ON public.observation_identifications (observation_event_id, species_id)
  WHERE is_active = TRUE;

ALTER TABLE public.observation_identifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS observation_identifications_select ON public.observation_identifications;
CREATE POLICY observation_identifications_select
  ON public.observation_identifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.observation_events oe
      WHERE oe.id = observation_event_id
        AND (
          (oe.is_public = TRUE AND oe.status = 'approved')
          OR oe.user_id = (select auth.uid())
        )
    )
  );

ALTER TABLE public.observation_media_analyses
  ADD COLUMN IF NOT EXISTS nature_topic TEXT NOT NULL DEFAULT 'birds';

ALTER TABLE public.observation_media_analyses
  DROP CONSTRAINT IF EXISTS observation_media_analyses_nature_topic_check,
  ADD CONSTRAINT observation_media_analyses_nature_topic_check
    CHECK (nature_topic IN ('birds', 'plants')),
  DROP CONSTRAINT IF EXISTS observation_media_analyses_status_check,
  ADD CONSTRAINT observation_media_analyses_status_check
    CHECK (status IN ('pending', 'passed', 'passed_no_identification', 'failed_unsafe', 'failed_low_quality', 'failed_unrecognized', 'error')),
  DROP CONSTRAINT IF EXISTS observation_media_analyses_unique_user_image,
  ADD CONSTRAINT observation_media_analyses_unique_user_image_topic
    UNIQUE (user_id, image_url, nature_topic);

-- Existing single-species values become the observer's initial human opinion.
INSERT INTO public.observation_identifications (
  observation_event_id,
  species_id,
  source,
  identifier_user_id
)
SELECT oe.id, min(oes.species_id), 'human', oe.user_id
FROM public.observation_events oe
JOIN public.observation_event_species oes ON oes.observation_event_id = oe.id
GROUP BY oe.id, oe.user_id
HAVING count(DISTINCT oes.species_id) = 1
ON CONFLICT DO NOTHING;

-- Previous image analyses can supply one clearly marked AI vote without a new model call.
WITH media_candidates AS (
  SELECT
    oe.id AS observation_event_id,
    candidate.species_id,
    candidate.confidence,
    oma.model_name
  FROM public.observation_events oe
  CROSS JOIN LATERAL unnest(oe.media_urls) AS event_image(url)
  JOIN public.observation_media_analyses oma
    ON oma.user_id = oe.user_id
   AND oma.image_url = event_image.url
  CROSS JOIN LATERAL (
    SELECT
      (item ->> 'speciesId')::BIGINT AS species_id,
      (item ->> 'confidence')::NUMERIC AS confidence
    FROM jsonb_array_elements(oma.species_candidates) AS candidates(item)
    ORDER BY (item ->> 'confidence')::NUMERIC DESC
    LIMIT 1
  ) candidate
  WHERE oma.status = 'passed'
    AND jsonb_array_length(oma.species_candidates) > 0
    AND candidate.confidence >= 0.80
),
eligible_ai AS (
  SELECT
    observation_event_id,
    min(species_id) AS species_id,
    max(confidence) AS confidence,
    max(model_name) AS model_name
  FROM media_candidates
  GROUP BY observation_event_id
  HAVING count(DISTINCT species_id) = 1
)
INSERT INTO public.observation_identifications (
  observation_event_id,
  species_id,
  source,
  confidence,
  model_name
)
SELECT observation_event_id, species_id, 'ai', confidence, COALESCE(model_name, 'legacy-ai')
FROM eligible_ai
ON CONFLICT DO NOTHING;

-- Final species links now mean community-confirmed links only.
DELETE FROM public.observation_event_species;

UPDATE public.observation_events
SET identification_status = 'needs_id';

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
BEGIN
  SELECT oe.user_id INTO v_owner_id
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
      confidence
    ) VALUES (
      p_observation_id,
      v_confirmed_species_id,
      '{}',
      v_confidence
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

CREATE OR REPLACE FUNCTION public.upsert_observation_identification(
  p_observation_id BIGINT,
  p_species_id BIGINT,
  p_source TEXT DEFAULT 'human',
  p_confidence NUMERIC DEFAULT NULL,
  p_model_name TEXT DEFAULT NULL,
  p_media_analysis_id BIGINT DEFAULT NULL
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
      observation_event_id, species_id, source, identifier_user_id
    ) VALUES (
      p_observation_id, p_species_id, 'human', v_user_id
    );
  ELSE
    RAISE EXCEPTION 'Only human identifications may be submitted by a user';
  END IF;

  RETURN QUERY SELECT * FROM public.recalculate_observation_identification(p_observation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_observation_ai_identification(
  p_observation_id BIGINT,
  p_species_id BIGINT,
  p_confidence NUMERIC,
  p_model_name TEXT,
  p_media_analysis_id BIGINT DEFAULT NULL
)
RETURNS TABLE (identification_status TEXT, confirmed_species_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_observation public.observation_events%ROWTYPE;
  v_species_topic TEXT;
BEGIN
  SELECT * INTO v_observation FROM public.observation_events WHERE id = p_observation_id;
  SELECT nature_topic INTO v_species_topic FROM public.species WHERE id = p_species_id AND is_active = TRUE;

  IF NOT FOUND OR v_observation.id IS NULL OR p_model_name IS NULL OR p_confidence IS NULL OR p_confidence < 0.80
    OR (v_observation.nature_topic IS NOT NULL AND v_species_topic <> v_observation.nature_topic) THEN
    RAISE EXCEPTION 'Invalid AI identification';
  END IF;

  UPDATE public.observation_identifications
  SET is_active = FALSE, withdrawn_at = now(), updated_at = now()
  WHERE observation_event_id = p_observation_id
    AND source = 'ai'
    AND is_active = TRUE;

  INSERT INTO public.observation_identifications (
    observation_event_id, species_id, source, confidence, model_name, media_analysis_id
  ) VALUES (
    p_observation_id, p_species_id, 'ai', p_confidence, p_model_name, p_media_analysis_id
  );

  RETURN QUERY SELECT * FROM public.recalculate_observation_identification(p_observation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_my_observation_identification(
  p_observation_id BIGINT
)
RETURNS TABLE (identification_status TEXT, confirmed_species_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.observation_identifications
  SET is_active = FALSE, withdrawn_at = now(), updated_at = now()
  WHERE observation_event_id = p_observation_id
    AND source = 'human'
    AND identifier_user_id = auth.uid()
    AND is_active = TRUE;

  RETURN QUERY SELECT * FROM public.recalculate_observation_identification(p_observation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_observation_identification(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_observation_identification(BIGINT, BIGINT, TEXT, NUMERIC, TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_observation_ai_identification(BIGINT, BIGINT, NUMERIC, TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_my_observation_identification(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_observation_identification(BIGINT, BIGINT, TEXT, NUMERIC, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_observation_ai_identification(BIGINT, BIGINT, NUMERIC, TEXT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_my_observation_identification(BIGINT) TO authenticated;

NOTIFY pgrst, 'reload schema';
