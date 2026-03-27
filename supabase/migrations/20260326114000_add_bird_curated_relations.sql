-- ============================================
-- 自然观察策展式关联
-- Project <-> Species
-- Challenge <-> Species
-- ============================================

CREATE TABLE IF NOT EXISTS public.project_species (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    species_id BIGINT NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    relation_role TEXT NOT NULL DEFAULT 'featured',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, species_id)
);

CREATE INDEX IF NOT EXISTS idx_project_species_project_id
    ON public.project_species (project_id, sort_order, species_id);
CREATE INDEX IF NOT EXISTS idx_project_species_species_id
    ON public.project_species (species_id, sort_order, project_id);

CREATE TABLE IF NOT EXISTS public.challenge_species (
    id BIGSERIAL PRIMARY KEY,
    challenge_id BIGINT NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    species_id BIGINT NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    relation_role TEXT NOT NULL DEFAULT 'featured',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (challenge_id, species_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_species_challenge_id
    ON public.challenge_species (challenge_id, sort_order, species_id);
CREATE INDEX IF NOT EXISTS idx_challenge_species_species_id
    ON public.challenge_species (species_id, sort_order, challenge_id);
