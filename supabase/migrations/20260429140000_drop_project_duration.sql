-- Remove misleading estimated project duration from projects and dependent RPCs.

DROP FUNCTION IF EXISTS public.admin_update_project(
  bigint,
  text,
  text,
  text,
  bigint,
  int,
  text,
  int,
  jsonb,
  jsonb,
  jsonb
);

DROP FUNCTION IF EXISTS public.get_recommended_projects(jsonb, text, integer, integer);

ALTER TABLE public.projects
  DROP COLUMN IF EXISTS duration;

CREATE OR REPLACE FUNCTION public.admin_update_project(
  p_project_id bigint,
  p_title text,
  p_description text,
  p_category text,
  p_sub_category_id bigint DEFAULT NULL,
  p_difficulty_stars int DEFAULT 1,
  p_image_url text DEFAULT NULL,
  p_steam_weights jsonb DEFAULT NULL,
  p_steps jsonb DEFAULT '[]'::jsonb,
  p_materials jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  id bigint,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: moderator or admin role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
  SET
    title = p_title,
    description = p_description,
    category = p_category,
    sub_category_id = p_sub_category_id,
    difficulty_stars = p_difficulty_stars,
    image_url = p_image_url,
    steam_weights = p_steam_weights,
    updated_at = NOW()
  WHERE projects.id = p_project_id
  RETURNING * INTO v_project;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.project_steps
  WHERE project_steps.project_id = p_project_id;

  INSERT INTO public.project_steps (project_id, title, description, image_url, sort_order)
  SELECT
    p_project_id,
    step.value->>'title',
    NULLIF(step.value->>'description', ''),
    NULLIF(step.value->>'image_url', ''),
    step.ordinality::int
  FROM jsonb_array_elements(COALESCE(p_steps, '[]'::jsonb)) WITH ORDINALITY AS step(value, ordinality);

  DELETE FROM public.project_materials
  WHERE project_materials.project_id = p_project_id;

  INSERT INTO public.project_materials (project_id, material, sort_order)
  SELECT
    p_project_id,
    material.value->>'material',
    material.ordinality::int
  FROM jsonb_array_elements(COALESCE(p_materials, '[]'::jsonb)) WITH ORDINALITY AS material(value, ordinality);

  RETURN QUERY
  SELECT v_project.id, v_project.status;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_project(
  bigint,
  text,
  text,
  text,
  bigint,
  int,
  text,
  jsonb,
  jsonb,
  jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_update_project(
  bigint,
  text,
  text,
  text,
  bigint,
  int,
  text,
  jsonb,
  jsonb,
  jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_update_project(
  bigint,
  text,
  text,
  text,
  bigint,
  int,
  text,
  jsonb,
  jsonb,
  jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.get_recommended_projects(
  p_user_steam jsonb DEFAULT NULL,
  p_age_group text DEFAULT NULL,
  p_limit int DEFAULT 6,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id              bigint,
  title           text,
  description     text,
  author_id       uuid,
  image_url       text,
  category        text,
  sub_category_id int,
  difficulty       text,
  difficulty_stars int,
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
  v_fresh_limit  := GREATEST(0, p_limit - v_scored_limit);

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
      p.likes_count,
      p.views_count,
      p.status,
      p.created_at,
      p.updated_at,
      pr.display_name AS author_display_name,
      (
        p.likes_count::float
          / power(1.0 + EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600.0 / 24.0, 1.2)
        + CASE
            WHEN COALESCE(pr.level, 1) >= 50 THEN 5.0
            WHEN COALESCE(pr.level, 1) >= 30 THEN 3.0
            WHEN COALESCE(pr.level, 1) >= 20 THEN 1.5
            ELSE 0
          END
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
  SELECT * FROM fresh
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_recommended_projects IS '多因子推荐：时间衰减热度 + Lv.20+曝光加权 + STEAM偏好亲和 + 年龄适配 + 60/40防霸榜混合。p_age_group 由调用方从 profiles.birth_date 计算后传入';

GRANT EXECUTE ON FUNCTION public.get_recommended_projects(jsonb, text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_recommended_projects(jsonb, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recommended_projects(jsonb, text, integer, integer) TO service_role;
