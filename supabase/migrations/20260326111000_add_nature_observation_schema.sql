-- ============================================
-- 自然观察核心数据层
-- species / observation_events / observation_event_species
-- ============================================

CREATE TABLE IF NOT EXISTS public.species (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    common_name TEXT NOT NULL,
    scientific_name TEXT,
    aliases TEXT[] NOT NULL DEFAULT '{}',
    taxon_group TEXT,
    identification_notes TEXT,
    habitat_notes TEXT,
    seasonality_notes TEXT,
    cover_image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_species_common_name ON public.species (common_name);
CREATE INDEX IF NOT EXISTS idx_species_is_active ON public.species (is_active);

CREATE TABLE IF NOT EXISTS public.observation_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id BIGINT REFERENCES public.projects(id) ON DELETE SET NULL,
    challenge_id BIGINT REFERENCES public.challenges(id) ON DELETE SET NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    location_name TEXT NOT NULL,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    location_precision TEXT DEFAULT 'approximate',
    habitat TEXT,
    weather TEXT,
    notes TEXT,
    media_urls TEXT[] NOT NULL DEFAULT '{}',
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'approved',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT observation_events_location_precision_check
        CHECK (location_precision IN ('exact', 'approximate', 'hidden')),
    CONSTRAINT observation_events_status_check
        CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_observation_events_observed_at ON public.observation_events (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observation_events_project_id ON public.observation_events (project_id);
CREATE INDEX IF NOT EXISTS idx_observation_events_challenge_id ON public.observation_events (challenge_id);
CREATE INDEX IF NOT EXISTS idx_observation_events_status_public ON public.observation_events (status, is_public);

CREATE TABLE IF NOT EXISTS public.observation_event_species (
    id BIGSERIAL PRIMARY KEY,
    observation_event_id BIGINT NOT NULL REFERENCES public.observation_events(id) ON DELETE CASCADE,
    species_id BIGINT NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
    count INTEGER,
    behavior_tags TEXT[] NOT NULL DEFAULT '{}',
    confidence NUMERIC(3, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT observation_event_species_unique UNIQUE (observation_event_id, species_id),
    CONSTRAINT observation_event_species_count_check CHECK (count IS NULL OR count > 0),
    CONSTRAINT observation_event_species_confidence_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    )
);

CREATE INDEX IF NOT EXISTS idx_observation_event_species_event_id
    ON public.observation_event_species (observation_event_id);
CREATE INDEX IF NOT EXISTS idx_observation_event_species_species_id
    ON public.observation_event_species (species_id);

ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observation_event_species ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'species'
           AND policyname = 'species_public_read'
    ) THEN
        CREATE POLICY species_public_read
            ON public.species
            FOR SELECT
            USING (is_active = TRUE);
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_events'
           AND policyname = 'observation_events_public_read'
    ) THEN
        CREATE POLICY observation_events_public_read
            ON public.observation_events
            FOR SELECT
            USING (is_public = TRUE AND status = 'approved');
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_event_species'
           AND policyname = 'observation_event_species_public_read'
    ) THEN
        CREATE POLICY observation_event_species_public_read
            ON public.observation_event_species
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1
                      FROM public.observation_events oe
                     WHERE oe.id = observation_event_id
                       AND oe.is_public = TRUE
                       AND oe.status = 'approved'
                )
            );
    END IF;
END $$;
