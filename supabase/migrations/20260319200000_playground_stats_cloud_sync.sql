-- Playground 游戏数据云同步表
-- 每用户一行，所有游戏统计存为单个 JSONB blob

CREATE TABLE IF NOT EXISTS public.playground_stats (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stats      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.playground_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own playground stats"
  ON public.playground_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own playground stats"
  ON public.playground_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playground stats"
  ON public.playground_stats FOR UPDATE
  USING (auth.uid() = user_id);
