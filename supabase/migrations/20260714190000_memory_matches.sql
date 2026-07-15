-- 记忆翻牌在线对战：对局表 + 服务端权威翻牌 RPC（经典规则：配对续手，翻错换人）
-- 设计要点（对齐 gomoku_matches 的房间层约定）：
--   1. 牌堆状态以 JSONB 快照存于 memory_matches.deck，postgres_changes 推送一次即同步全量，断线重连读一行恢复。
--   2. 翻牌走 RPC memory_flip_card，单条 UPDATE 内完成「校验轮次 + 首翻/次翻判定 + 配对/换人 + 结束判定」，避免双端广播竞态。
--   3. 经典记忆翻牌双人规则：配对成功保留翻开的牌并继续（当前轮次不变），翻错则两张翻回、换对手。
--   4. result_seq 单调递增，前端据此对「刚完成的一对」只播一次揭示动画（翻错约 800ms 后翻回）。
-- deck JSONB 结构：[{"id":"animals-0-a","symbol":"🦊","matched":"host"|"guest"|null}, ...]
-- first_flip JSONB 结构：{"id":"...","symbol":"..."} 或 null（本回合已翻开、等待第二张）
-- last_result JSONB 结构：{"a":{"id","symbol"},"b":{"id","symbol"},"matched":bool,"by":"host"|"guest"} 或 null
-- scores JSONB 结构：{"host":n,"guest":n}
-- 已知取舍：deck 含全部符号会随 Realtime 全行推送，懂 devtools 的玩家理论上可偷看。
--   对 6-16 岁分设备对战属低风险（MVP 先接受）；后续要防作弊可上视图/边缘函数遮罩未翻开牌的 symbol。

CREATE TABLE IF NOT EXISTS public.memory_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE CHECK (char_length(code) = 6),
  host_user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_user_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished','cancelled')),
  theme           text NOT NULL DEFAULT 'animals',
  difficulty      text NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy','normal','hard')),
  deck            jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_turn    text NOT NULL DEFAULT 'host' CHECK (current_turn IN ('host','guest')),
  first_flip      jsonb,
  last_result     jsonb,
  result_seq      int NOT NULL DEFAULT 0,
  scores          jsonb NOT NULL DEFAULT '{"host":0,"guest":0}'::jsonb,
  winner          text CHECK (winner IS NULL OR winner IN ('host','guest','draw')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_matches_host ON public.memory_matches(host_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_matches_guest ON public.memory_matches(guest_user_id) WHERE guest_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memory_matches_status_activity ON public.memory_matches(status, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_memory_matches_guest_active ON public.memory_matches(guest_user_id, status) WHERE status IN ('waiting','playing');

ALTER TABLE public.memory_matches ENABLE ROW LEVEL SECURITY;

-- 房主与对手均可读取自己参与的对局
DROP POLICY IF EXISTS "memory_matches_select" ON public.memory_matches;
CREATE POLICY "memory_matches_select"
ON public.memory_matches FOR SELECT
USING (
  (SELECT auth.uid()) = host_user_id
  OR (SELECT auth.uid()) = guest_user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role IN ('admin','moderator')
  )
);

-- 房主可建房
DROP POLICY IF EXISTS "memory_matches_insert" ON public.memory_matches;
CREATE POLICY "memory_matches_insert"
ON public.memory_matches FOR INSERT
WITH CHECK ((SELECT auth.uid()) = host_user_id);

-- 禁止浏览器客户端直接改对局快照。翻牌走 SECURITY DEFINER RPC；
-- 加入/离开/取消等状态流转走已鉴权的 API Route + service role。
DROP POLICY IF EXISTS "memory_matches_update" ON public.memory_matches;
CREATE POLICY "memory_matches_update"
ON public.memory_matches FOR UPDATE
USING (false)
WITH CHECK (false);

-- 同样禁止浏览器客户端直接删除对局，取消房间走 API Route。
DROP POLICY IF EXISTS "memory_matches_delete" ON public.memory_matches;
CREATE POLICY "memory_matches_delete"
ON public.memory_matches FOR DELETE
USING (false);

-- last_activity_at 自动维护触发器
CREATE OR REPLACE FUNCTION public.touch_memory_match_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.last_activity_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memory_matches_touch_activity ON public.memory_matches;
CREATE TRIGGER trg_memory_matches_touch_activity
BEFORE UPDATE ON public.memory_matches
FOR EACH ROW EXECUTE FUNCTION public.touch_memory_match_last_activity();

-- ── 服务端权威翻牌 RPC ────────────────────────────────────────────────
-- 入参：match_uuid、p_card_id（deck 中某张牌的 id）
-- 返回：table(ok boolean, reason text)；棋盘全量由 Realtime/轮询回推，故只回执行结果。
-- 逻辑：校验 playing + 调用者是当前轮次方 → 定位目标牌（未翻开、非本回合首翻牌）
--       → 首翻记 first_flip；次翻比符号：配对则双方 matched + 计分 + 保留轮次（经典续手），
--          翻错则清 first_flip + 换对手；每完成一对 result_seq++ 并写 last_result 供前端揭示动画。
--       → 全部配对则结束，高分胜、平分判平。
-- SECURITY DEFINER 以绕过 RLS 在单条 UPDATE 内完成权威写入。

CREATE OR REPLACE FUNCTION public.memory_flip_card(match_uuid uuid, p_card_id text)
RETURNS TABLE(ok boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m record;
  caller_id uuid := auth.uid();
  caller_role text;            -- 'host' | 'guest'
  deck_arr jsonb;
  idx int;
  card jsonb;
  target_idx int := -1;
  target_symbol text;
  first_id text;
  first_symbol text;
  next_turn text;
  matched_count int;
  total_cards int;
  new_scores jsonb;
  host_score int;
  guest_score int;
  win text;
BEGIN
  SELECT * INTO m FROM public.memory_matches WHERE id = match_uuid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'match_not_found'::text;
    RETURN;
  END IF;

  IF m.status <> 'playing' THEN
    RETURN QUERY SELECT false, 'match_not_playing'::text;
    RETURN;
  END IF;

  IF caller_id IS NULL THEN
    RETURN QUERY SELECT false, 'not_authenticated'::text;
    RETURN;
  END IF;

  IF caller_id = m.host_user_id THEN
    caller_role := 'host';
  ELSIF caller_id = m.guest_user_id THEN
    caller_role := 'guest';
  ELSE
    RETURN QUERY SELECT false, 'not_participant'::text;
    RETURN;
  END IF;

  IF m.current_turn <> caller_role THEN
    RETURN QUERY SELECT false, 'not_your_turn'::text;
    RETURN;
  END IF;

  deck_arr := m.deck;

  -- 定位目标牌：遍历 deck 找 id 匹配，读符号与已配对状态。
  FOR idx IN 0 .. jsonb_array_length(deck_arr) - 1 LOOP
    card := deck_arr -> idx;
    IF (card ->> 'id') = p_card_id THEN
      target_idx := idx;
      target_symbol := card ->> 'symbol';
      -- 已配对的牌不可再翻
      IF (card ->> 'matched') IS NOT NULL AND (card ->> 'matched') <> 'null' THEN
        RETURN QUERY SELECT false, 'card_already_matched'::text;
        RETURN;
      END IF;
      EXIT;
    END IF;
  END LOOP;

  IF target_idx < 0 THEN
    RETURN QUERY SELECT false, 'card_not_found'::text;
    RETURN;
  END IF;

  -- 本回合已翻开的第一张（等待第二张）
  first_id := m.first_flip ->> 'id';
  first_symbol := m.first_flip ->> 'symbol';

  -- 首翻：记录 first_flip，清 last_result，轮次不变。
  IF first_id IS NULL THEN
    UPDATE public.memory_matches
      SET first_flip = jsonb_build_object('id', p_card_id, 'symbol', target_symbol),
          last_result = NULL
      WHERE id = match_uuid;
    RETURN QUERY SELECT true, 'first_flip'::text;
    RETURN;
  END IF;

  -- 次翻不能是同一张
  IF first_id = p_card_id THEN
    RETURN QUERY SELECT false, 'same_card'::text;
    RETURN;
  END IF;

  next_turn := CASE WHEN caller_role = 'host' THEN 'guest' ELSE 'host' END;

  IF first_symbol = target_symbol THEN
    -- 配对成功：两张 matched = 调用者角色；计分；清 first_flip；保留轮次（经典续手）。
    deck_arr := jsonb_set(deck_arr, ARRAY[target_idx::text, 'matched'], to_jsonb(caller_role), true);
    FOR idx IN 0 .. jsonb_array_length(deck_arr) - 1 LOOP
      IF (deck_arr -> idx ->> 'id') = first_id THEN
        deck_arr := jsonb_set(deck_arr, ARRAY[idx::text, 'matched'], to_jsonb(caller_role), true);
        EXIT;
      END IF;
    END LOOP;

    host_score := COALESCE((m.scores ->> 'host')::int, 0);
    guest_score := COALESCE((m.scores ->> 'guest')::int, 0);
    IF caller_role = 'host' THEN host_score := host_score + 1; ELSE guest_score := guest_score + 1; END IF;
    new_scores := jsonb_build_object('host', host_score, 'guest', guest_score);

    -- 统计已配对张数，判断是否终局
    SELECT count(*) INTO matched_count
    FROM jsonb_array_elements(deck_arr) AS c
    WHERE (c ->> 'matched') IS NOT NULL AND (c ->> 'matched') <> 'null';
    total_cards := jsonb_array_length(deck_arr);

    IF matched_count >= total_cards THEN
      win := CASE
        WHEN host_score > guest_score THEN 'host'
        WHEN guest_score > host_score THEN 'guest'
        ELSE 'draw'
      END;
      UPDATE public.memory_matches
        SET deck = deck_arr,
            scores = new_scores,
            first_flip = NULL,
            last_result = jsonb_build_object(
              'a', jsonb_build_object('id', first_id, 'symbol', first_symbol),
              'b', jsonb_build_object('id', p_card_id, 'symbol', target_symbol),
              'matched', true, 'by', caller_role),
            result_seq = m.result_seq + 1,
            winner = win,
            status = 'finished',
            finished_at = now()
        WHERE id = match_uuid;
      RETURN QUERY SELECT true, 'win'::text;
      RETURN;
    END IF;

    UPDATE public.memory_matches
      SET deck = deck_arr,
          scores = new_scores,
          first_flip = NULL,
          last_result = jsonb_build_object(
            'a', jsonb_build_object('id', first_id, 'symbol', first_symbol),
            'b', jsonb_build_object('id', p_card_id, 'symbol', target_symbol),
            'matched', true, 'by', caller_role),
          result_seq = m.result_seq + 1
      WHERE id = match_uuid;
    RETURN QUERY SELECT true, 'matched'::text;
    RETURN;
  END IF;

  -- 配对失败：清 first_flip，换对手；两张牌保持未 matched，前端据 result_seq 播翻回动画。
  UPDATE public.memory_matches
    SET first_flip = NULL,
        current_turn = next_turn,
        last_result = jsonb_build_object(
          'a', jsonb_build_object('id', first_id, 'symbol', first_symbol),
          'b', jsonb_build_object('id', p_card_id, 'symbol', target_symbol),
          'matched', false, 'by', caller_role),
        result_seq = m.result_seq + 1
    WHERE id = match_uuid;
  RETURN QUERY SELECT true, 'mismatch'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.memory_flip_card(uuid, text) TO authenticated;

COMMENT ON TABLE public.memory_matches IS '记忆翻牌在线对局，服务端权威牌堆存 JSONB，翻牌走 memory_flip_card RPC（经典配对续手规则）。';
COMMENT ON FUNCTION public.memory_flip_card(uuid, text) IS '记忆翻牌服务端权威翻牌，单条 UPDATE 内完成校验+首翻/次翻+配对计分/换人+终局判定。';
