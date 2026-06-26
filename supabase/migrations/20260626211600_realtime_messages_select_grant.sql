-- Realtime logical decoding needs table SELECT privileges for publication tables.
-- Business visibility is still controlled by public.messages RLS policies.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    GRANT USAGE ON SCHEMA public TO supabase_realtime_admin;
    GRANT SELECT ON TABLE public.messages TO supabase_realtime_admin;
  END IF;
END $$;
