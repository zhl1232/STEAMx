-- 修复免费配额退款无效：count_ai_free_chats_today 原先只统计当日 free_chat 条数，
-- refund_ai_credit 对 free 来源仅写入 refund 流水，免费次数没有真正返还。
-- 改为「当日 free_chat 条数 − 当日 free 来源 refund 条数」，下限 0。

CREATE OR REPLACE FUNCTION public.count_ai_free_chats_today(p_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    (
      SELECT COUNT(*)::int
      FROM public.ai_credit_logs
      WHERE user_id = p_user_id
        AND reason = 'free_chat'
        AND created_at >= public.ai_credit_day_start()
    )
    -
    (
      SELECT COUNT(*)::int
      FROM public.ai_credit_logs
      WHERE user_id = p_user_id
        AND reason = 'refund'
        AND meta->>'source' = 'free'
        AND created_at >= public.ai_credit_day_start()
    ),
    0
  );
$$;
