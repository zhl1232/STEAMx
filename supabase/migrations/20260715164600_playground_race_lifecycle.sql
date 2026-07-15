-- 通用竞速房间异常生命周期：等待 15 分钟过期，开局 30 分钟未完成则按提交状态结算。
-- 没有 heartbeat，超时只代表未在截止前提交，不能据此判断具体玩家是否断线。

ALTER TABLE public.playground_race_matches
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS finish_reason text;

UPDATE public.playground_race_matches
SET deadline_at = CASE
  WHEN status = 'waiting' THEN created_at + interval '15 minutes'
  WHEN status = 'playing' THEN COALESCE(started_at, created_at) + interval '30 minutes'
  ELSE COALESCE(finished_at, last_activity_at, created_at)
END
WHERE deadline_at IS NULL;

UPDATE public.playground_race_matches
SET finish_reason = CASE
  WHEN status = 'finished' THEN 'completed'
  WHEN status = 'cancelled' THEN 'cancelled_by_host'
  ELSE NULL
END
WHERE finish_reason IS NULL;

ALTER TABLE public.playground_race_matches
  ALTER COLUMN deadline_at SET DEFAULT (now() + interval '15 minutes'),
  ALTER COLUMN deadline_at SET NOT NULL;

ALTER TABLE public.playground_race_matches
  DROP CONSTRAINT IF EXISTS playground_race_matches_finish_reason_check;

ALTER TABLE public.playground_race_matches
  ADD CONSTRAINT playground_race_matches_finish_reason_check
  CHECK (
    finish_reason IS NULL OR finish_reason IN (
      'completed',
      'forfeit',
      'cancelled_by_host',
      'waiting_timeout',
      'result_timeout',
      'no_result_timeout'
    )
  );

CREATE INDEX IF NOT EXISTS idx_playground_race_matches_active_deadline
  ON public.playground_race_matches(deadline_at)
  WHERE status IN ('waiting', 'playing');

-- waiting -> playing 时由数据库设置统一截止时间，避免依赖 API 服务器时钟。
CREATE OR REPLACE FUNCTION public.touch_playground_race_match_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.last_activity_at := now();

  IF OLD.status = 'waiting' AND NEW.status = 'playing' THEN
    NEW.deadline_at := now() + interval '30 minutes';
  END IF;

  RETURN NEW;
END;
$$;

-- 原子结算已到截止时间的房间。双方都已提交时由现有游戏规则层计算胜负，
-- 此函数只处理无需比较具体成绩的三种确定情况。
CREATE OR REPLACE FUNCTION public.expire_playground_race_matches(
  p_match_id uuid DEFAULT NULL
)
RETURNS TABLE (
  waiting_cancelled bigint,
  result_timeout_finished bigint,
  no_result_timeout_cancelled bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH expired AS (
    UPDATE public.playground_race_matches
    SET
      status = CASE
        WHEN status = 'playing'
          AND (host_result IS NOT NULL OR guest_result IS NOT NULL)
          THEN 'finished'
        ELSE 'cancelled'
      END,
      winner = CASE
        WHEN status = 'playing' AND host_result IS NOT NULL AND guest_result IS NULL
          THEN 'host'
        WHEN status = 'playing' AND guest_result IS NOT NULL AND host_result IS NULL
          THEN 'guest'
        ELSE NULL
      END,
      finish_reason = CASE
        WHEN status = 'waiting' THEN 'waiting_timeout'
        WHEN host_result IS NOT NULL OR guest_result IS NOT NULL THEN 'result_timeout'
        ELSE 'no_result_timeout'
      END,
      finished_at = now()
    WHERE (p_match_id IS NULL OR id = p_match_id)
      AND deadline_at <= now()
      AND (
        status = 'waiting'
        OR (
          status = 'playing'
          AND NOT (host_result IS NOT NULL AND guest_result IS NOT NULL)
        )
      )
    RETURNING finish_reason
  )
  SELECT
    count(*) FILTER (WHERE finish_reason = 'waiting_timeout'),
    count(*) FILTER (WHERE finish_reason = 'result_timeout'),
    count(*) FILTER (WHERE finish_reason = 'no_result_timeout')
  FROM expired;
$$;

-- 成绩校验仍在 API 规则层完成；写入在数据库内检查截止时间和幂等条件。
CREATE OR REPLACE FUNCTION public.submit_playground_race_result(
  p_match_id uuid,
  p_role text,
  p_result jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF p_role NOT IN ('host', 'guest') THEN
    RAISE EXCEPTION 'invalid race role';
  END IF;

  IF p_result IS NULL THEN
    RAISE EXCEPTION 'race result is required';
  END IF;

  UPDATE public.playground_race_matches
  SET
    host_result = CASE WHEN p_role = 'host' THEN p_result ELSE host_result END,
    guest_result = CASE WHEN p_role = 'guest' THEN p_result ELSE guest_result END
  WHERE id = p_match_id
    AND status = 'playing'
    AND deadline_at > now()
    AND (
      (p_role = 'host' AND host_result IS NULL)
      OR (p_role = 'guest' AND guest_result IS NULL)
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_playground_race_matches(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_playground_race_matches(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_playground_race_matches(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.submit_playground_race_result(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_playground_race_result(uuid, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_playground_race_result(uuid, text, jsonb) TO service_role;

COMMENT ON COLUMN public.playground_race_matches.deadline_at IS
  '当前 waiting/playing 阶段的服务端截止时间；状态切换为 playing 时由触发器重置。';
COMMENT ON COLUMN public.playground_race_matches.finish_reason IS
  '完成、认输、主动取消或超时等终态原因。';
