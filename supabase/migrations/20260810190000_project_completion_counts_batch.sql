-- 项目卡批量统计公开终稿作品数，避免列表按项目逐条查询。

CREATE INDEX IF NOT EXISTS idx_completed_projects_public_final_project
  ON public.completed_projects (project_id)
  WHERE project_id IS NOT NULL
    AND is_public = true
    AND status = 'approved'
    AND moderation_state = 'approved'
    AND record_kind = 'final';

CREATE OR REPLACE FUNCTION public.get_project_completion_counts_batch(p_project_ids bigint[])
RETURNS TABLE(project_id bigint, completion_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT cp.project_id, count(*)::bigint AS completion_count
  FROM public.completed_projects AS cp
  WHERE cp.project_id = ANY (p_project_ids)
    AND cp.is_public = true
    AND cp.status = 'approved'
    AND cp.moderation_state = 'approved'
    AND cp.record_kind = 'final'
  GROUP BY cp.project_id;
$$;

COMMENT ON FUNCTION public.get_project_completion_counts_batch(bigint[]) IS
  '批量返回项目下公开、审核通过的最终作品数';

REVOKE ALL ON FUNCTION public.get_project_completion_counts_batch(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_completion_counts_batch(bigint[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_project_completion_counts_batch(bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_completion_counts_batch(bigint[]) TO service_role;
