-- 将 gomoku_matches 加入 supabase_realtime publication，
-- 供前端通过 Realtime (postgres_changes) 订阅棋盘 / 轮次 / 胜负变化。
-- RLS 已在 20260625180000 中定义：仅 host/guest 可读自己的对局，
-- 订阅方按 id=eq.<match_id> 过滤，只能收到自己参与的对局行变更。

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'publication supabase_realtime not found, skip';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'gomoku_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gomoku_matches;
  END IF;
END $$;
