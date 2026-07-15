-- 游乐场通用联网竞速房间：适用于单人规则清晰、可按成绩/步数/时间比较的小游戏。
-- 规则权威性：
--   1. 房间生命周期沿用 gomoku/memory 的 waiting -> playing -> finished/cancelled。
--   2. 浏览器客户端只能创建并读取自己参与的房间；成绩提交、离开、取消均走 API Route + service role。
--   3. settings 固定每场对局的公平比较条件，例如汉诺塔盘数、固定关卡 id、N 皇后棋盘规模。
--   4. host_result/guest_result 保存客户端可校验成绩；服务端 API 会按 game_key 校验范围并计算 winner。

CREATE TABLE IF NOT EXISTS public.playground_race_matches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE CHECK (char_length(code) = 6),
  game_key          text NOT NULL CHECK (game_key IN (
    'quickmath',
    'hanoi',
    'nqueens',
    'nonogram',
    'ballsort',
    'balance',
    'symmetry',
    'tangram'
  )),
  host_user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished','cancelled')),
  settings          jsonb NOT NULL DEFAULT '{}'::jsonb,
  host_result       jsonb,
  guest_result      jsonb,
  winner            text CHECK (winner IS NULL OR winner IN ('host','guest','draw')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  last_activity_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playground_race_matches_host
  ON public.playground_race_matches(host_user_id, status, game_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playground_race_matches_guest
  ON public.playground_race_matches(guest_user_id, status, game_key, created_at DESC)
  WHERE guest_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_playground_race_matches_status_activity
  ON public.playground_race_matches(status, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_playground_race_matches_game_status
  ON public.playground_race_matches(game_key, status, last_activity_at);

ALTER TABLE public.playground_race_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playground_race_matches_select" ON public.playground_race_matches;
CREATE POLICY "playground_race_matches_select"
ON public.playground_race_matches FOR SELECT
USING (
  (SELECT auth.uid()) = host_user_id
  OR (SELECT auth.uid()) = guest_user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role IN ('admin','moderator')
  )
);

DROP POLICY IF EXISTS "playground_race_matches_insert" ON public.playground_race_matches;
CREATE POLICY "playground_race_matches_insert"
ON public.playground_race_matches FOR INSERT
WITH CHECK ((SELECT auth.uid()) = host_user_id);

DROP POLICY IF EXISTS "playground_race_matches_update" ON public.playground_race_matches;
CREATE POLICY "playground_race_matches_update"
ON public.playground_race_matches FOR UPDATE
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "playground_race_matches_delete" ON public.playground_race_matches;
CREATE POLICY "playground_race_matches_delete"
ON public.playground_race_matches FOR DELETE
USING (false);

CREATE OR REPLACE FUNCTION public.touch_playground_race_match_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.last_activity_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_playground_race_matches_touch_activity ON public.playground_race_matches;
CREATE TRIGGER trg_playground_race_matches_touch_activity
BEFORE UPDATE ON public.playground_race_matches
FOR EACH ROW EXECUTE FUNCTION public.touch_playground_race_match_last_activity();

COMMENT ON TABLE public.playground_race_matches IS '游乐场通用联网竞速房间，按固定设置比较单人小游戏成绩。';
