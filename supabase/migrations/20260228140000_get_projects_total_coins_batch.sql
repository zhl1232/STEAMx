-- 批量获取多个项目的总投币数（项目本身 + 完成作品），供列表/相关项目等使用，与详情页 get_project_total_coins_received 口径一致
CREATE OR REPLACE FUNCTION public.get_projects_total_coins_received_batch(p_project_ids bigint[])
RETURNS TABLE(project_id bigint, total_coins int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id AS project_id,
    (
      COALESCE((SELECT coins_count FROM public.projects WHERE projects.id = id), 0)
      +
      COALESCE((SELECT SUM(coins_count) FROM public.completed_projects WHERE project_id = id), 0)
    )::int AS total_coins
  FROM unnest(p_project_ids) AS id;
$$;

COMMENT ON FUNCTION public.get_projects_total_coins_received_batch(bigint[]) IS '批量返回项目总投币数 = 项目本身 + 该项目下所有完成作品，与 get_project_total_coins_received 单条口径一致';
GRANT EXECUTE ON FUNCTION public.get_projects_total_coins_received_batch(bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_projects_total_coins_received_batch(bigint[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_projects_total_coins_received_batch(bigint[]) TO service_role;
