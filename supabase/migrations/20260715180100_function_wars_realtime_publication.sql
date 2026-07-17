-- Publish Function Wars match snapshots for participant-only postgres_changes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE NOTICE 'publication supabase_realtime not found, skip';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'function_wars_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.function_wars_matches;
  END IF;
END $$;
