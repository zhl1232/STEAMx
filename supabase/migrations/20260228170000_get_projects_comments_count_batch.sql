-- 批量获取多个项目的评论数（含顶层评论与回复），供列表/卡片展示
CREATE OR REPLACE FUNCTION public.get_projects_comments_count_batch(p_project_ids bigint[])
RETURNS TABLE(project_id bigint, comment_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.pid AS project_id,
    COALESCE(c.cnt, 0)::int AS comment_count
  FROM unnest(p_project_ids) AS t(pid)
  LEFT JOIN (
    SELECT project_id, COUNT(*)::int AS cnt
    FROM public.comments
    WHERE project_id = ANY(p_project_ids)
    GROUP BY project_id
  ) c ON c.project_id = t.pid;
$$;

COMMENT ON FUNCTION public.get_projects_comments_count_batch(bigint[]) IS '批量返回项目评论数（comments 表按 project_id 计数）';
GRANT EXECUTE ON FUNCTION public.get_projects_comments_count_batch(bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_projects_comments_count_batch(bigint[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_projects_comments_count_batch(bigint[]) TO service_role;
