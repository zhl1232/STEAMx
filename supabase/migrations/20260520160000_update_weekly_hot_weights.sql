-- 调整「本周热门」互动权重：点赞×1、评论×2、探索记录×2、投币枚数×3

CREATE OR REPLACE FUNCTION public.get_weekly_hot_project_rankings(
  p_since timestamptz,
  p_limit integer,
  p_offset integer,
  p_category text DEFAULT NULL,
  p_sub_category text DEFAULT NULL,
  p_difficulty_stars_min integer DEFAULT NULL,
  p_difficulty_stars_max integer DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_materials text[] DEFAULT NULL
)
RETURNS TABLE (
  project_id bigint,
  weekly_score bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH weekly_events AS (
    SELECT l.project_id::bigint AS project_id, 1::bigint AS points
    FROM public.likes l
    WHERE l.created_at >= p_since

    UNION ALL

    SELECT c.project_id::bigint, 2::bigint
    FROM public.comments c
    WHERE c.created_at >= p_since

    UNION ALL

    SELECT cp.project_id::bigint, 2::bigint
    FROM public.completed_projects cp
    WHERE cp.completed_at >= p_since
      AND cp.status <> 'rejected'

    UNION ALL

    SELECT (substring(cl.resource_id FROM '^project:(\d+)$'))::bigint AS project_id,
           (cl.amount * 3)::bigint AS points
    FROM public.coin_logs cl
    WHERE cl.created_at >= p_since
      AND cl.action_type = 'tip'
      AND cl.amount > 0
      AND cl.resource_id ~ '^project:[0-9]+$'

    UNION ALL

    SELECT cp.project_id::bigint, (cl.amount * 3)::bigint
    FROM public.coin_logs cl
    INNER JOIN public.completed_projects cp
      ON cl.resource_id = ('completion:' || cp.id::text)
    WHERE cl.created_at >= p_since
      AND cl.action_type = 'tip'
      AND cl.amount > 0

    UNION ALL

    SELECT cp.project_id::bigint, 2::bigint
    FROM public.completion_comments cc
    INNER JOIN public.completed_projects cp ON cp.id = cc.completed_project_id
    WHERE cc.created_at >= p_since
  ),
  weekly_scores AS (
    SELECT we.project_id, SUM(we.points)::bigint AS weekly_score
    FROM weekly_events we
    WHERE we.project_id IS NOT NULL
    GROUP BY we.project_id
  ),
  filtered AS (
    SELECT
      p.id AS project_id,
      ws.weekly_score
    FROM public.projects p
    INNER JOIN weekly_scores ws ON ws.project_id = p.id
    LEFT JOIN public.sub_categories sc ON sc.id = p.sub_category_id
    WHERE p.status = 'approved'
      AND ws.weekly_score > 0
      AND (p_category IS NULL OR p_category = '全部' OR p.category = p_category)
      AND (p_sub_category IS NULL OR p_sub_category = '' OR sc.name = p_sub_category)
      AND (
        p_difficulty_stars_min IS NULL
        OR p.difficulty_stars BETWEEN p_difficulty_stars_min AND COALESCE(p_difficulty_stars_max, p_difficulty_stars_min)
      )
      AND (p_tags IS NULL OR cardinality(p_tags) = 0 OR p.tags @> p_tags)
      AND (
        p_materials IS NULL OR cardinality(p_materials) = 0
        OR EXISTS (
          SELECT 1 FROM public.project_materials pm
          WHERE pm.project_id = p.id AND pm.material = ANY(p_materials)
        )
      )
      AND (
        p_search IS NULL OR p_search = ''
        OR p.title ILIKE ('%' || p_search || '%')
        OR p.description ILIKE ('%' || p_search || '%')
      )
  )
  SELECT
    f.project_id,
    f.weekly_score,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.weekly_score DESC, f.project_id DESC
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;

COMMENT ON FUNCTION public.get_weekly_hot_project_rankings IS
  '近 7 天互动热度：点赞×1、评论/回复×2、探索记录×2、投币枚数×3';
