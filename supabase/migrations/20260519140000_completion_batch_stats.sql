-- 批量统计探索记录评论数（避免拉回全部明细行）

CREATE OR REPLACE FUNCTION public.get_completion_comments_count_batch(p_completion_ids bigint[])
RETURNS TABLE(completed_project_id bigint, comment_count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT cc.completed_project_id, count(*)::bigint
  FROM public.completion_comments cc
  WHERE cc.completed_project_id = ANY (p_completion_ids)
  GROUP BY cc.completed_project_id;
$$;

COMMENT ON FUNCTION public.get_completion_comments_count_batch(bigint[]) IS
  '批量返回探索记录评论数';

GRANT EXECUTE ON FUNCTION public.get_completion_comments_count_batch(bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_completion_comments_count_batch(bigint[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_completion_comments_count_batch(bigint[]) TO service_role;

-- 作者作品获赞总和（个人 summary 用）

CREATE OR REPLACE FUNCTION public.sum_author_project_likes(p_author_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(sum(likes_count), 0)::bigint
  FROM public.projects
  WHERE author_id = p_author_id;
$$;

COMMENT ON FUNCTION public.sum_author_project_likes(uuid) IS '作者全部作品 likes_count 之和';

GRANT EXECUTE ON FUNCTION public.sum_author_project_likes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sum_author_project_likes(uuid) TO service_role;
