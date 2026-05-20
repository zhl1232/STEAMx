-- 探索页「全站热门」：全时段互动加权 + 时间衰减 + 25% 近 7 天热度混合
-- 权重与本周热门一致：点赞×1、评论×2、探索记录×2、投币枚数×3；浏览量不参与

CREATE OR REPLACE FUNCTION public.get_popular_project_rankings(
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
  popular_score double precision,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH weekly_since AS (
    SELECT (now() - interval '7 days') AS since_at
  ),
  completion_stats AS (
    SELECT
      cp.project_id,
      COUNT(*) FILTER (WHERE cp.status <> 'rejected')::bigint AS completion_count,
      COALESCE(SUM(cp.coins_count) FILTER (WHERE cp.status <> 'rejected'), 0)::bigint AS completion_coins,
      MAX(cp.completed_at) FILTER (WHERE cp.status <> 'rejected') AS last_completion_at
    FROM public.completed_projects cp
    GROUP BY cp.project_id
  ),
  completion_comment_stats AS (
    SELECT
      cp.project_id,
      COUNT(*)::bigint AS completion_comment_count,
      MAX(cc.created_at) AS last_completion_comment_at
    FROM public.completion_comments cc
    INNER JOIN public.completed_projects cp ON cp.id = cc.completed_project_id
    GROUP BY cp.project_id
  ),
  project_comment_stats AS (
    SELECT
      c.project_id,
      MAX(c.created_at) AS last_comment_at
    FROM public.comments c
    GROUP BY c.project_id
  ),
  like_stats AS (
    SELECT
      l.project_id,
      MAX(l.created_at) AS last_like_at
    FROM public.likes l
    GROUP BY l.project_id
  ),
  coin_stats AS (
    SELECT
      tips.project_id,
      MAX(tips.tipped_at) AS last_tip_at
    FROM (
      SELECT
        (substring(cl.resource_id FROM '^project:(\d+)$'))::bigint AS project_id,
        cl.created_at AS tipped_at
      FROM public.coin_logs cl
      WHERE cl.action_type = 'tip'
        AND cl.amount > 0
        AND cl.resource_id ~ '^project:[0-9]+$'

      UNION ALL

      SELECT
        cp.project_id,
        cl.created_at AS tipped_at
      FROM public.coin_logs cl
      INNER JOIN public.completed_projects cp
        ON cl.resource_id = ('completion:' || cp.id::text)
      WHERE cl.action_type = 'tip'
        AND cl.amount > 0
    ) tips
    WHERE tips.project_id IS NOT NULL
    GROUP BY tips.project_id
  ),
  weekly_events AS (
    SELECT l.project_id::bigint AS project_id, 1::bigint AS points
    FROM public.likes l
    CROSS JOIN weekly_since ws
    WHERE l.created_at >= ws.since_at

    UNION ALL

    SELECT c.project_id::bigint, 2::bigint
    FROM public.comments c
    CROSS JOIN weekly_since ws
    WHERE c.created_at >= ws.since_at

    UNION ALL

    SELECT cp.project_id::bigint, 2::bigint
    FROM public.completed_projects cp
    CROSS JOIN weekly_since ws
    WHERE cp.completed_at >= ws.since_at
      AND cp.status <> 'rejected'

    UNION ALL

    SELECT (substring(cl.resource_id FROM '^project:(\d+)$'))::bigint AS project_id,
           (cl.amount * 3)::bigint AS points
    FROM public.coin_logs cl
    CROSS JOIN weekly_since ws
    WHERE cl.created_at >= ws.since_at
      AND cl.action_type = 'tip'
      AND cl.amount > 0
      AND cl.resource_id ~ '^project:[0-9]+$'

    UNION ALL

    SELECT cp.project_id::bigint, (cl.amount * 3)::bigint
    FROM public.coin_logs cl
    INNER JOIN public.completed_projects cp
      ON cl.resource_id = ('completion:' || cp.id::text)
    CROSS JOIN weekly_since ws
    WHERE cl.created_at >= ws.since_at
      AND cl.action_type = 'tip'
      AND cl.amount > 0

    UNION ALL

    SELECT cp.project_id::bigint, 2::bigint
    FROM public.completion_comments cc
    INNER JOIN public.completed_projects cp ON cp.id = cc.completed_project_id
    CROSS JOIN weekly_since ws
    WHERE cc.created_at >= ws.since_at
  ),
  weekly_scores AS (
    SELECT we.project_id, SUM(we.points)::bigint AS weekly_score
    FROM weekly_events we
    WHERE we.project_id IS NOT NULL
    GROUP BY we.project_id
  ),
  engagement AS (
    SELECT
      p.id AS project_id,
      (
        COALESCE(p.likes_count, 0) * 1
        + COALESCE(p.comments_count, 0) * 2
        + COALESCE(ccs.completion_comment_count, 0) * 2
        + COALESCE(cs.completion_count, 0) * 2
        + (COALESCE(p.coins_count, 0) + COALESCE(cs.completion_coins, 0)) * 3
      )::double precision AS raw_score,
      GREATEST(
        p.created_at,
        COALESCE(ls.last_like_at, p.created_at),
        COALESCE(pcs.last_comment_at, p.created_at),
        COALESCE(cs.last_completion_at, p.created_at),
        COALESCE(ccs.last_completion_comment_at, p.created_at),
        COALESCE(coins.last_tip_at, p.created_at)
      ) AS last_engagement_at,
      COALESCE(ws.weekly_score, 0)::double precision AS weekly_score
    FROM public.projects p
    LEFT JOIN completion_stats cs ON cs.project_id = p.id
    LEFT JOIN completion_comment_stats ccs ON ccs.project_id = p.id
    LEFT JOIN project_comment_stats pcs ON pcs.project_id = p.id
    LEFT JOIN like_stats ls ON ls.project_id = p.id
    LEFT JOIN coin_stats coins ON coins.project_id = p.id
    LEFT JOIN weekly_scores ws ON ws.project_id = p.id
    LEFT JOIN public.sub_categories sc ON sc.id = p.sub_category_id
    WHERE p.status = 'approved'
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
  ),
  scored AS (
    SELECT
      e.project_id,
      (
        0.75 * (
          e.raw_score / power(
            greatest(
              extract(epoch FROM (now() - e.last_engagement_at)) / 86400.0,
              0
            ) + 14,
            1.2
          )
        )
        + 0.25 * e.weekly_score
      ) AS popular_score
    FROM engagement e
  )
  SELECT
    s.project_id,
    s.popular_score,
    COUNT(*) OVER() AS total_count
  FROM scored s
  ORDER BY s.popular_score DESC, s.project_id DESC
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;

COMMENT ON FUNCTION public.get_popular_project_rankings IS
  '全站热门：互动加权(赞×1/评×2/记录×2/币×3) + 末次互动时间衰减 + 25%近7天热度';

GRANT EXECUTE ON FUNCTION public.get_popular_project_rankings(
  integer, integer, text, text, integer, integer, text[], text, text[]
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_popular_project_rankings(
  integer, integer, text, text, integer, integer, text[], text, text[]
) TO anon;
GRANT EXECUTE ON FUNCTION public.get_popular_project_rankings(
  integer, integer, text, text, integer, integer, text[], text, text[]
) TO service_role;
