-- Shared current-user species progress for the atlas, homepage and profile.
-- The function deliberately accepts no user id so callers cannot ask for
-- another user's private observation progress.

CREATE OR REPLACE FUNCTION public.get_my_observed_species_ids()
RETURNS TABLE (species_id bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH approved_user_events AS MATERIALIZED (
    SELECT oe.id
    FROM public.observation_events AS oe
    WHERE oe.user_id = (SELECT auth.uid())
      AND oe.status = 'approved'
  ),
  consensus_species AS (
    SELECT oes.observation_event_id, oes.species_id
    FROM public.observation_event_species AS oes
    JOIN approved_user_events AS aue
      ON aue.id = oes.observation_event_id
  ),
  ai_fallback_species AS (
    SELECT oi.observation_event_id, oi.species_id
    FROM public.observation_identifications AS oi
    JOIN approved_user_events AS aue
      ON aue.id = oi.observation_event_id
    WHERE oi.is_active = TRUE
      AND oi.source = 'ai'
      AND oi.confidence >= 0.8
      AND NOT EXISTS (
        SELECT 1
        FROM public.observation_event_species AS oes
        WHERE oes.observation_event_id = oi.observation_event_id
      )
  )
  SELECT species_id FROM consensus_species
  UNION
  SELECT species_id FROM ai_fallback_species;
$$;

REVOKE ALL ON FUNCTION public.get_my_observed_species_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_observed_species_ids() TO authenticated;

COMMENT ON FUNCTION public.get_my_observed_species_ids() IS
  'Returns the current user species ids from approved observations, preferring consensus and falling back to active AI confidence >= 0.8.';

NOTIFY pgrst, 'reload schema';
