-- ============================================
-- 1. 项目统计硬币：包含项目本身 + 该项目下所有完成作品的投币总和
-- 2. 流水展示「打赏给了谁」：coin_logs 增加 counterparty_display_text，tip 时写入对方昵称
-- ============================================

-- ---------- 1. 项目总投币数 RPC（项目页/列表用） ----------
CREATE OR REPLACE FUNCTION public.get_project_total_coins_received(p_project_id bigint)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    COALESCE((SELECT coins_count FROM public.projects WHERE id = p_project_id), 0)
    +
    COALESCE((SELECT SUM(coins_count) FROM public.completed_projects WHERE project_id = p_project_id), 0)
  )::int;
$$;

COMMENT ON FUNCTION public.get_project_total_coins_received(bigint) IS '项目收到的总投币数 = 项目本身 + 该项目下所有完成作品';
GRANT EXECUTE ON FUNCTION public.get_project_total_coins_received(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_total_coins_received(bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.get_project_total_coins_received(bigint) TO service_role;

-- ---------- 2. coin_logs 增加「对方」展示文案（打赏给谁/谁打赏的） ----------
ALTER TABLE public.coin_logs
  ADD COLUMN IF NOT EXISTS counterparty_display_text text;

COMMENT ON COLUMN public.coin_logs.counterparty_display_text IS '打赏流水：支出时为收款方昵称，收入时为打赏方昵称；其他类型可为空';

-- ---------- 3. tip_resource 写入流水时填充 counterparty_display_text ----------
CREATE OR REPLACE FUNCTION public.tip_resource(
  p_resource_type text,
  p_resource_id bigint,
  p_amount int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_target_owner_id uuid;
  v_resource_key text;
  v_my_tipped int;
  v_giver_display text;
  v_recipient_display text;
  v_resource_label text;  -- 用于流水：如 "项目：xxx" 或 "某某的作品"
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  IF p_resource_type NOT IN ('project', 'completion') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_resource_type');
  END IF;

  v_resource_key := p_resource_type || ':' || p_resource_id::text;

  -- 查找资源作者并获取行锁防止并发问题
  IF p_resource_type = 'project' THEN
    SELECT author_id INTO v_target_owner_id
    FROM public.projects
    WHERE id = p_resource_id FOR UPDATE;
  ELSIF p_resource_type = 'completion' THEN
    SELECT user_id INTO v_target_owner_id
    FROM public.completed_projects
    WHERE id = p_resource_id FOR UPDATE;
  END IF;

  IF v_target_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'resource_not_found');
  END IF;

  IF v_target_owner_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_tip_self');
  END IF;

  -- 查询我已给该对象投过多少币 (通过流水汇总，防刷)
  SELECT COALESCE(ABS(SUM(amount)), 0)::int INTO v_my_tipped
  FROM public.coin_logs
  WHERE user_id = v_user_id
    AND action_type = 'tip'
    AND resource_id = v_resource_key
    AND amount < 0;

  IF v_my_tipped + p_amount > 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tip_limit_reached', 'my_tipped', v_my_tipped, 'limit', 2);
  END IF;

  -- 扣减投币者余额
  UPDATE public.profiles
  SET coins = coins - p_amount
  WHERE id = v_user_id
    AND coins >= p_amount;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coins');
  END IF;

  -- 增加目标用户的余额
  UPDATE public.profiles
  SET coins = coins + p_amount
  WHERE id = v_target_owner_id;

  -- 同步增加被投币资源的 coins_count（为前端做冗余提速）
  IF p_resource_type = 'project' THEN
    UPDATE public.projects
    SET coins_count = coins_count + p_amount
    WHERE id = p_resource_id;
  ELSIF p_resource_type = 'completion' THEN
    UPDATE public.completed_projects
    SET coins_count = coins_count + p_amount
    WHERE id = p_resource_id;
  END IF;

  -- 查打赏方、收款方昵称及资源展示文案（用于流水）
  SELECT display_name INTO v_giver_display FROM public.profiles WHERE id = v_user_id;
  SELECT display_name INTO v_recipient_display FROM public.profiles WHERE id = v_target_owner_id;
  v_giver_display := COALESCE(NULLIF(trim(v_giver_display), ''), '某用户');
  v_recipient_display := COALESCE(NULLIF(trim(v_recipient_display), ''), '某用户');

  IF p_resource_type = 'project' THEN
    SELECT title INTO v_resource_label FROM public.projects WHERE id = p_resource_id;
    v_resource_label := COALESCE('项目：' || v_resource_label, v_resource_key);
  ELSE
    v_resource_label := v_recipient_display || ' 的作品';
  END IF;

  -- 记录流水（支出方：打赏给 counterparty = 收款方昵称 + 资源说明；收入方：收到 counterparty = 打赏方昵称）
  INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id, counterparty_display_text)
  VALUES
    (v_user_id, -p_amount, 'tip', v_resource_key, v_recipient_display || '（' || v_resource_label || '）'),
    (v_target_owner_id, p_amount, 'tip', v_resource_key, v_giver_display);

  RETURN jsonb_build_object('ok', true, 'amount', p_amount, 'new_my_tipped', v_my_tipped + p_amount);
END;
$$;
