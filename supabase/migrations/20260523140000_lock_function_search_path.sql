-- Lock search_path on all public schema functions / procedures.
-- Addresses Supabase Performance Advisor (SECURITY category):
-- function_search_path_mutable (lint 0011).
--
-- A function whose search_path is not pinned can be hijacked by an
-- attacker who creates objects in a schema searched earlier than
-- public — especially dangerous for SECURITY DEFINER functions.
--
-- We use `SET search_path = public` rather than `''`:
--   - empty would require every reference inside the function body to
--     be fully qualified (e.g. public.profiles); we don't have source
--     for most functions, so changing to empty risks runtime breakage.
--   - locking to `public` still satisfies the linter (it accepts any
--     fixed value) and prevents schema-injection attacks.
--   - pg_catalog and pg_temp are always implicitly searched, so
--     built-ins (now(), coalesce(), etc.) and temp tables keep working.
--
-- Idempotent: only ALTERs functions that don't already have a
-- search_path set in their proconfig.

DO $do$
DECLARE
  fn record;
  altered int := 0;
BEGIN
  FOR fn IN
    SELECT p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')   -- regular function or procedure
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER ROUTINE public.%I(%s) SET search_path = public',
      fn.func_name, fn.args
    );
    altered := altered + 1;
  END LOOP;

  RAISE NOTICE 'lock_function_search_path: % routine(s) altered', altered;
END
$do$;
