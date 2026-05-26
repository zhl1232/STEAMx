-- Add lifecycle stage and sex annotation fields to species observation links.

ALTER TABLE public.observation_event_species
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT,
  ADD COLUMN IF NOT EXISTS sex TEXT;

ALTER TABLE public.observation_event_species
  DROP CONSTRAINT IF EXISTS observation_event_species_lifecycle_stage_check,
  ADD CONSTRAINT observation_event_species_lifecycle_stage_check
    CHECK (lifecycle_stage IS NULL OR lifecycle_stage IN
      ('egg', 'larva', 'pupa', 'juvenile', 'adult', 'unknown')),
  DROP CONSTRAINT IF EXISTS observation_event_species_sex_check,
  ADD CONSTRAINT observation_event_species_sex_check
    CHECK (sex IS NULL OR sex IN ('male', 'female', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_observation_event_species_species_lifecycle
  ON public.observation_event_species (species_id, lifecycle_stage)
  WHERE lifecycle_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_observation_event_species_species_sex
  ON public.observation_event_species (species_id, sex)
  WHERE sex IS NOT NULL;

NOTIFY pgrst, 'reload schema';
