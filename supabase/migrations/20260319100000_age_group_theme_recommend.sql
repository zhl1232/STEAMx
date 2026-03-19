-- ============================================================
-- 1. profiles: add birth_date + equipped_theme_id columns
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS equipped_theme_id text;

COMMENT ON COLUMN public.profiles.birth_date IS '用户出生年月（day 固定为 1），用于推算年龄段';
COMMENT ON COLUMN public.profiles.equipped_theme_id IS '当前装备的界面主题 id（如 black-gold）';

-- ============================================================
-- 1.1. index for recommendation query
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_status_created
  ON public.projects (status, created_at DESC);

-- ============================================================
-- 2. get_recommended_projects RPC
--    多因子加权 + 60/40 防霸榜混合
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_recommended_projects(
  p_user_steam jsonb DEFAULT NULL,
  p_age_group text DEFAULT NULL,
  p_limit int DEFAULT 6,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id              int,
  title           text,
  description     text,
  author_id       uuid,
  image_url       text,
  category        text,
  sub_category_id int,
  difficulty       text,
  difficulty_stars int,
  duration        int,
  likes_count     int,
  views_count     int,
  status          text,
  created_at      timestamptz,
  updated_at      timestamptz,
  author_display_name text,
  _score          float,
  _pool           text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scored_limit int;
  v_fresh_limit  int;
BEGIN
  v_scored_limit := GREATEST(1, ceil(p_limit * 0.6)::int);
  v_fresh_limit  := GREATEST(1, floor(p_limit * 0.4)::int);

  RETURN QUERY
  WITH scored AS (
    SELECT
      p.id,
      p.title,
      p.description,
      p.author_id,
      p.image_url,
      p.category,
      p.sub_category_id,
      p.difficulty,
      p.difficulty_stars,
      p.duration,
      p.likes_count,
      p.views_count,
      p.status,
      p.created_at,
      p.updated_at,
      pr.display_name AS author_display_name,
      (
        -- base_score: time-decayed popularity (HackerNews-style)
        p.likes_count::float
          / power(1.0 + EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600.0 / 24.0, 1.2)
        -- level_boost: Lv.20+ exposure privilege
        + CASE
            WHEN COALESCE(pr.level, 1) >= 50 THEN 5.0
            WHEN COALESCE(pr.level, 1) >= 30 THEN 3.0
            WHEN COALESCE(pr.level, 1) >= 20 THEN 1.5
            ELSE 0
          END
        -- steam_affinity: match user STEAM preference to project category
        + CASE
            WHEN p_user_steam IS NOT NULL AND p.category IS NOT NULL THEN
              COALESCE(
                (p_user_steam ->> (
                  CASE p.category
                    WHEN '科学' THEN 'S'
                    WHEN '技术' THEN 'T'
                    WHEN '工程' THEN 'E'
                    WHEN '艺术' THEN 'A'
                    WHEN '数学' THEN 'M'
                    ELSE NULL
                  END
                ))::float * 0.05,
                0
              )
            ELSE 0
          END
        -- age_match: difficulty-to-age-group affinity
        + CASE
            WHEN p_age_group = '6-9'   AND p.difficulty_stars BETWEEN 1 AND 2 THEN 3.0
            WHEN p_age_group = '10-12' AND p.difficulty_stars BETWEEN 1 AND 3 THEN 2.0
            WHEN p_age_group = '13-15' AND p.difficulty_stars BETWEEN 2 AND 4 THEN 1.0
            ELSE 0
          END
      ) AS _score,
      'scored'::text AS _pool
    FROM projects p
    JOIN profiles pr ON pr.id = p.author_id
    WHERE p.status = 'approved'
    ORDER BY _score DESC
    LIMIT v_scored_limit
    OFFSET p_offset
  ),
  fresh AS (
    SELECT
      p.id,
      p.title,
      p.description,
      p.author_id,
      p.image_url,
      p.category,
      p.sub_category_id,
      p.difficulty,
      p.difficulty_stars,
      p.duration,
      p.likes_count,
      p.views_count,
      p.status,
      p.created_at,
      p.updated_at,
      pr.display_name AS author_display_name,
      0::float AS _score,
      'fresh'::text AS _pool
    FROM projects p
    JOIN profiles pr ON pr.id = p.author_id
    WHERE p.status = 'approved'
      AND p.created_at >= now() - interval '14 days'
      AND p.id NOT IN (SELECT s.id FROM scored s)
    ORDER BY random()
    LIMIT v_fresh_limit
  )
  SELECT * FROM scored
  UNION ALL
  SELECT * FROM fresh;
END;
$$;

COMMENT ON FUNCTION public.get_recommended_projects IS '多因子推荐：时间衰减热度 + Lv.20+曝光加权 + STEAM偏好亲和 + 年龄适配 + 60/40防霸榜混合。p_age_group 由调用方从 profiles.birth_date 计算后传入';
