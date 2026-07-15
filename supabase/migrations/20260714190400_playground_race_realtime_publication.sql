-- 将通用竞速房间加入 Supabase Realtime publication。
-- RLS 限定仅 host/guest 可读，前端订阅时再按 id=eq.<match_id> 过滤。

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'publication supabase_realtime not found, skip';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'playground_race_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playground_race_matches;
  END IF;
END $$;
