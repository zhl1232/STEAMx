-- ============================================
-- 整合旧版打赏与投币统计 (coins_count) 的数据结构与存储过程
-- ============================================

-- 1. 确保旧版迁移中新建的多余表格/函数被清理
DROP FUNCTION IF EXISTS public.tip_project(bigint, integer);
DROP TABLE IF EXISTS public.project_coins CASCADE;

-- 2. 确保目标表有 coins_count 字段用于缓存
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS coins_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.completed_projects ADD COLUMN IF NOT EXISTS coins_count integer DEFAULT 0 NOT NULL;

-- 3. 重写或替换 tip_resource 的逻辑：同步写入对应业务表的 coins_count 字段
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

  -- 记录流水
  INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id)
  VALUES
    (v_user_id, -p_amount, 'tip', v_resource_key),
    (v_target_owner_id, p_amount, 'tip', v_resource_key);

  RETURN jsonb_build_object('ok', true, 'amount', p_amount, 'new_my_tipped', v_my_tipped + p_amount);
END;
$$;

-- 4. 数据回填模块：从 coin_logs 中查找历史打赏给项目的记录，回写 coins_count
-- 由于 action_type='tip' 并且打款流水是 > 0 (被赞赏者流水增加)，对应 resource_id 形如 'project:1'
WITH aggregated_tips AS (
  SELECT 
    split_part(resource_id, ':', 2)::bigint as proj_id,
    SUM(amount) as total_tips
  FROM public.coin_logs
  WHERE action_type = 'tip' 
    AND resource_id LIKE 'project:%'
    AND amount > 0
  GROUP BY resource_id
)
UPDATE public.projects p
SET coins_count = COALESCE(a.total_tips, 0)
FROM aggregated_tips a
WHERE p.id = a.proj_id;

WITH aggregated_completion_tips AS (
  SELECT 
    split_part(resource_id, ':', 2)::bigint as comp_id,
    SUM(amount) as total_tips
  FROM public.coin_logs
  WHERE action_type = 'tip' 
    AND resource_id LIKE 'completion:%'
    AND amount > 0
  GROUP BY resource_id
)
UPDATE public.completed_projects cp
SET coins_count = COALESCE(a.total_tips, 0)
FROM aggregated_completion_tips a
WHERE cp.id = a.comp_id;
