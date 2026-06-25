-- 五子棋在线对战：对局表 + 服务端权威落子 RPC
-- 设计要点：
--   1. 棋盘状态以 JSONB 快照存于 gomoku_matches.board，postgres_changes 推送一次即同步全盘，断线重连读一行恢复。
--   2. 落子走 RPC gomoku_place_stone，单条 UPDATE 内完成「校验轮次 + 校验空格 + 落子 + 胜负判定 + 切换轮次」，避免双端广播竞态。
--   3. 胜负判定在 RPC 内用 plpgsql 复刻 hooks/playground/use-gomoku.ts 的四方向连续 5 子扫描。
-- board JSONB 结构：[[{"row":0,"col":0,"value":null},...],...]（15x15，与前端 GomokuCell 一致）
-- moves JSONB 结构：[{"row":0,"col":0,"player":"black","at":"2026-..."},...]

CREATE TABLE IF NOT EXISTS public.gomoku_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE CHECK (char_length(code) = 6),
  host_user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_user_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished','cancelled')),
  board           jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_turn    text NOT NULL DEFAULT 'black' CHECK (current_turn IN ('black','white')),
  host_color      text NOT NULL DEFAULT 'black' CHECK (host_color IN ('black','white')),
  moves           jsonb NOT NULL DEFAULT '[]'::jsonb,
  winner          text CHECK (winner IS NULL OR winner IN ('black','white','draw')),
  win_line        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gomoku_matches_host ON public.gomoku_matches(host_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gomoku_matches_guest ON public.gomoku_matches(guest_user_id) WHERE guest_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gomoku_matches_status_activity ON public.gomoku_matches(status, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_gomoku_matches_guest_active ON public.gomoku_matches(guest_user_id, status) WHERE status IN ('waiting','playing');

ALTER TABLE public.gomoku_matches ENABLE ROW LEVEL SECURITY;

-- 房主与对手均可读取自己参与的对局
DROP POLICY IF EXISTS "gomoku_matches_select" ON public.gomoku_matches;
CREATE POLICY "gomoku_matches_select"
ON public.gomoku_matches FOR SELECT
USING (
  auth.uid() = host_user_id
  OR auth.uid() = guest_user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','moderator')
  )
);

-- 房主可建房
DROP POLICY IF EXISTS "gomoku_matches_insert" ON public.gomoku_matches;
CREATE POLICY "gomoku_matches_insert"
ON public.gomoku_matches FOR INSERT
WITH CHECK (auth.uid() = host_user_id);

-- 仅允许房主/对手更新（落子与状态流转都走 RPC，此 policy 兜底直接 UPDATE）
DROP POLICY IF EXISTS "gomoku_matches_update" ON public.gomoku_matches;
CREATE POLICY "gomoku_matches_update"
ON public.gomoku_matches FOR UPDATE
USING (auth.uid() = host_user_id OR auth.uid() = guest_user_id)
WITH CHECK (auth.uid() = host_user_id OR auth.uid() = guest_user_id);

-- 房主可删除自己创建的待开始对局（取消建房）
DROP POLICY IF EXISTS "gomoku_matches_delete" ON public.gomoku_matches;
CREATE POLICY "gomoku_matches_delete"
ON public.gomoku_matches FOR DELETE
USING (auth.uid() = host_user_id);

-- last_activity_at 自动维护触发器
CREATE OR REPLACE FUNCTION public.touch_gomoku_match_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.last_activity_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gomoku_matches_touch_activity ON public.gomoku_matches;
CREATE TRIGGER trg_gomoku_matches_touch_activity
BEFORE UPDATE ON public.gomoku_matches
FOR EACH ROW EXECUTE FUNCTION public.touch_gomoku_match_last_activity();

-- ── 服务端权威落子 RPC ────────────────────────────────────────────────
-- 入参：match_uuid、p_row、p_col（0-based，0..14）
--   注：参数名避开 Postgres 保留字 row/col，用 p_ 前缀。
-- 返回：table(ok boolean, reason text, board jsonb, current_turn text, winner text, win_line jsonb)
-- 逻辑：校验对局存在且为 playing、调用者是当前轮次方、目标格为空 → 落子 → 四方向连续 5 子判定
--       → 命中则写 winner/win_line/finished；满盘无胜则 draw；否则切换 current_turn。
-- SECURITY DEFINER 以绕过 RLS 在单条 UPDATE 内完成权威写入。

CREATE OR REPLACE FUNCTION public.gomoku_place_stone(match_uuid uuid, p_row int, p_col int)
RETURNS TABLE(ok boolean, reason text, board jsonb, current_turn text, winner text, win_line jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  caller_id uuid := auth.uid();
  caller_color text;
  board_arr jsonb;
  cell_value text;
  next_turn text;
  mv jsonb;
  line jsonb;
  found_win jsonb;
  i int;
  dr int;
  dc int;
  r int;
  c int;
  cnt int;
  line_arr jsonb;
  total_cells int;
  dirs_dr int[] := ARRAY[0,1,1,1];
  dirs_dc int[] := ARRAY[1,0,1,-1];
BEGIN
  SELECT * INTO m FROM public.gomoku_matches WHERE id = match_uuid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'match_not_found'::text, NULL::jsonb, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  IF m.status <> 'playing' THEN
    RETURN QUERY SELECT false, 'match_not_playing'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  IF caller_id IS NULL THEN
    RETURN QUERY SELECT false, 'not_authenticated'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  -- 确定调用者执子颜色
  IF caller_id = m.host_user_id THEN
    caller_color := m.host_color;
  ELSIF caller_id = m.guest_user_id THEN
    caller_color := CASE WHEN m.host_color = 'black' THEN 'white' ELSE 'black' END;
  ELSE
    RETURN QUERY SELECT false, 'not_participant'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  IF m.current_turn <> caller_color THEN
    RETURN QUERY SELECT false, 'not_your_turn'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  IF p_row < 0 OR p_row > 14 OR p_col < 0 OR p_col > 14 THEN
    RETURN QUERY SELECT false, 'out_of_bounds'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  -- board 为 [[{row,col,value},...],...]；JSONB 数组路径 0-based，故直接用 p_row/p_col。
  cell_value := m.board::jsonb#>(array[p_row])#>(array[p_col])#>>'{value}';
  IF cell_value IS NOT NULL AND cell_value <> 'null' THEN
    RETURN QUERY SELECT false, 'cell_occupied'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  -- 落子：覆盖该格 value
  board_arr := m.board;
  board_arr := jsonb_set(
    board_arr,
    ARRAY[p_row, p_col, 'value'],
    to_jsonb(caller_color),
    true
  );

  next_turn := CASE WHEN m.current_turn = 'black' THEN 'white' ELSE 'black' END;

  -- 四方向连续 5 子判定（横、竖、两斜），与 use-gomoku.ts DIRS 一致
  -- 用配对的方向数组，避免 FOREACH 嵌套产生的笛卡尔积。
  -- 每个方向双向计数：从落子点向正反方向延伸，合并同色连子，>=5 即胜。
  found_win := NULL;
  line := NULL;
  FOR i IN 1..4 LOOP
    dr := dirs_dr[i];
    dc := dirs_dc[i];
    -- 正方向计数
    line_arr := jsonb_build_array(jsonb_build_object('row', p_row, 'col', p_col));
    r := p_row + dr; c := p_col + dc; cnt := 1;
    WHILE r >= 0 AND r <= 14 AND c >= 0 AND c <= 14
      AND (board_arr#>(array[r])#>(array[c])#>>'{value}') = caller_color
    LOOP
      line_arr := line_arr || jsonb_build_array(jsonb_build_object('row', r, 'col', c));
      cnt := cnt + 1;
      r := r + dr; c := c + dc;
    END LOOP;
    -- 反方向计数
    r := p_row - dr; c := p_col - dc;
    WHILE r >= 0 AND r <= 14 AND c >= 0 AND c <= 14
      AND (board_arr#>(array[r])#>(array[c])#>>'{value}') = caller_color
    LOOP
      line_arr := jsonb_build_array(jsonb_build_object('row', r, 'col', c)) || line_arr;
      cnt := cnt + 1;
      r := r - dr; c := c - dc;
    END LOOP;
    IF cnt >= 5 THEN
      found_win := to_jsonb(caller_color);
      line := line_arr;
      EXIT;
    END IF;
  END LOOP;

  mv := jsonb_build_object(
    'row', p_row, 'col', p_col,
    'player', caller_color,
    'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  IF found_win IS NOT NULL THEN
    UPDATE public.gomoku_matches
      SET board = board_arr,
          current_turn = next_turn,
          moves = m.moves || jsonb_build_array(mv),
          winner = caller_color,
          win_line = line,
          status = 'finished',
          finished_at = now()
      WHERE id = match_uuid;
    RETURN QUERY SELECT true, 'win'::text, board_arr, next_turn, caller_color, line;
    RETURN;
  END IF;

  -- 满盘判定（225 格全占）
  SELECT count(*) INTO total_cells
  FROM jsonb_array_elements(board_arr) AS br,
       jsonb_array_elements(br.value) AS cell_obj
  WHERE (cell_obj#>>'{value}') IS NOT NULL AND (cell_obj#>>'{value}') <> 'null';

  IF total_cells >= 225 THEN
    UPDATE public.gomoku_matches
      SET board = board_arr,
          current_turn = next_turn,
          moves = m.moves || jsonb_build_array(mv),
          winner = 'draw',
          status = 'finished',
          finished_at = now()
      WHERE id = match_uuid;
    RETURN QUERY SELECT true, 'draw'::text, board_arr, next_turn, 'draw'::text, NULL::jsonb;
    RETURN;
  END IF;

  UPDATE public.gomoku_matches
    SET board = board_arr,
        current_turn = next_turn,
        moves = m.moves || jsonb_build_array(mv)
    WHERE id = match_uuid;

  RETURN QUERY SELECT true, 'ok'::text, board_arr, next_turn, NULL::text, NULL::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gomoku_place_stone(uuid, int, int) TO authenticated;

COMMENT ON TABLE public.gomoku_matches IS '五子棋在线对局，服务端权威棋盘存 JSONB，落子走 gomoku_place_stone RPC。';
COMMENT ON FUNCTION public.gomoku_place_stone(uuid, int, int) IS '五子棋服务端权威落子，单条 UPDATE 内完成校验+落子+胜负判定+轮次切换。';
