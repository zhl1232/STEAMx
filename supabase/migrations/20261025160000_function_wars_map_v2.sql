-- Keep existing room maps replayable while allowing the bounded-flight layout.
-- Apply before deploying the application that creates symmetric-canyon-v2 rooms.
ALTER TABLE public.function_wars_matches
  DROP CONSTRAINT IF EXISTS function_wars_matches_map_id_check;

ALTER TABLE public.function_wars_matches
  ADD CONSTRAINT function_wars_matches_map_id_check
  CHECK (map_id IN ('symmetric-canyon', 'symmetric-canyon-v2'));

ALTER TABLE public.function_wars_matches
  ALTER COLUMN map_id SET DEFAULT 'symmetric-canyon-v2';
