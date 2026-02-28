-- 项目展示的硬币只计项目本身，不含其下完成作品；作品各自显示自己的硬币
CREATE OR REPLACE FUNCTION public.get_project_total_coins_received(p_project_id bigint)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT coins_count FROM public.projects WHERE id = p_project_id), 0)::int;
$$;

COMMENT ON FUNCTION public.get_project_total_coins_received(bigint) IS '项目收到的投币数（仅项目本身，不含其下完成作品）';

-- 批量：与单条口径一致，仅项目本身
CREATE OR REPLACE FUNCTION public.get_projects_total_coins_received_batch(p_project_ids bigint[])
RETURNS TABLE(project_id bigint, total_coins int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.pid AS project_id,
    COALESCE(p.coins_count, 0)::int AS total_coins
  FROM unnest(p_project_ids) AS t(pid)
  LEFT JOIN public.projects p ON p.id = t.pid;
$$;

COMMENT ON FUNCTION public.get_projects_total_coins_received_batch(bigint[]) IS '批量返回项目投币数（仅项目本身，不含完成作品）';
