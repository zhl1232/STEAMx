-- Keep the vision model's unmatched 「其他」 suggestion on an observation that
-- was published as 待鉴定. Values are written only by the server (service role)
-- after checking they came from that photo's own analysis; owners cannot set
-- or change them directly through the owner insert/update RLS policies.

ALTER TABLE public.observation_events
  ADD COLUMN IF NOT EXISTS suggested_species_name text NULL,
  ADD COLUMN IF NOT EXISTS suggested_scientific_name text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'observation_events_suggested_species_name_len'
       AND conrelid = 'public.observation_events'::regclass
  ) THEN
    ALTER TABLE public.observation_events
      ADD CONSTRAINT observation_events_suggested_species_name_len
      CHECK (suggested_species_name IS NULL OR char_length(suggested_species_name) BETWEEN 1 AND 60);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'observation_events_suggested_scientific_name_len'
       AND conrelid = 'public.observation_events'::regclass
  ) THEN
    ALTER TABLE public.observation_events
      ADD CONSTRAINT observation_events_suggested_scientific_name_len
      CHECK (suggested_scientific_name IS NULL OR char_length(suggested_scientific_name) BETWEEN 1 AND 120);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_observation_suggested_species()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_is_service boolean :=
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '') = 'service_role'
    OR current_user IN ('service_role', 'postgres', 'supabase_admin');
BEGIN
  IF v_is_service THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.suggested_species_name IS NOT NULL OR NEW.suggested_scientific_name IS NOT NULL THEN
      RAISE EXCEPTION 'suggested species can only be set by the server' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.suggested_species_name IS DISTINCT FROM OLD.suggested_species_name
     OR NEW.suggested_scientific_name IS DISTINCT FROM OLD.suggested_scientific_name THEN
    RAISE EXCEPTION 'suggested species can only be set by the server' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_observation_suggested_species ON public.observation_events;
CREATE TRIGGER trg_guard_observation_suggested_species
  BEFORE INSERT OR UPDATE OF suggested_species_name, suggested_scientific_name
  ON public.observation_events
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_observation_suggested_species();
