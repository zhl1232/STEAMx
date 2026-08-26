-- Content classification recommendation v2.
--
-- The versioned function returns ranked public ids only. It intentionally does
-- not expose difficulty_stars; the application hydrates those ids through the
-- normal public mapper when it needs the public difficulty band. Phase 1 keeps
-- the legacy approved-project pool; phase 2 switches the pool to reviewed rows.

CREATE INDEX IF NOT EXISTS projects_reviewed_recommendation_idx
  ON public.projects (created_at DESC, id DESC)
  WHERE status = 'approved'
    AND moderation_state = 'approved'
    AND classification_status = 'reviewed';

CREATE OR REPLACE FUNCTION public.get_recommended_projects_v2(
  p_user_id uuid DEFAULT NULL,
  p_age smallint DEFAULT NULL,
  p_steam jsonb DEFAULT NULL,
  p_limit integer DEFAULT 6,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH normalized AS (
    SELECT
      GREATEST(1, LEAST(COALESCE(p_limit, 6), 50))::integer AS limit_value,
      GREATEST(COALESCE(p_offset, 0), 0)::integer AS offset_value,
      CASE
        WHEN p_age BETWEEN 3 AND 16 THEN p_age
        ELSE NULL::smallint
      END AS age_value
  ),
  scored AS (
    SELECT
      p.id,
      p.created_at,
      (
        COALESCE(p.likes_count, 0)::double precision
          / power(
              1.0 + EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600.0 / 24.0,
              1.2
            )
        + COALESCE(p.views_count, 0)::double precision * 0.01
        + CASE
            WHEN COALESCE(pr.level, 1) >= 50 THEN 5.0
            WHEN COALESCE(pr.level, 1) >= 30 THEN 3.0
            WHEN COALESCE(pr.level, 1) >= 20 THEN 1.5
            ELSE 0
          END
        + CASE
            WHEN p_steam IS NOT NULL AND p.category IS NOT NULL THEN
              COALESCE(
                (
                  p_steam ->> CASE p.category
                    WHEN '科学' THEN 'S'
                    WHEN '技术' THEN 'T'
                    WHEN '工程' THEN 'E'
                    WHEN '艺术' THEN 'A'
                    WHEN '数学' THEN 'M'
                    ELSE NULL
                  END
                )::double precision * 0.05,
                0
              )
            ELSE 0
          END
        + CASE
            WHEN normalized.age_value IS NULL OR p.classification_status <> 'reviewed' THEN 0
            WHEN p.recommended_min_age <= normalized.age_value
              AND (
                p.recommended_max_age IS NULL
                OR normalized.age_value <= p.recommended_max_age
              ) THEN 3.0
            WHEN normalized.age_value < p.recommended_min_age
              AND p.recommended_min_age - normalized.age_value <= 2 THEN 1.0
            WHEN p.recommended_max_age IS NOT NULL
              AND normalized.age_value > p.recommended_max_age
              AND normalized.age_value - p.recommended_max_age <= 2 THEN 1.0
            ELSE 0
          END
      )::double precision AS score
    FROM public.projects AS p
    JOIN public.profiles AS pr ON pr.id = p.author_id
    CROSS JOIN normalized
    WHERE p.status = 'approved'
      AND p.moderation_state = 'approved'
      AND (
        NOT public.content_classification_enforcement_is_enabled()
        OR p.classification_status = 'reviewed'
      )
  ),
  totals AS (
    SELECT COUNT(*)::integer AS total
    FROM scored
  ),
  ranked AS (
    SELECT scored.*
    FROM scored
    CROSS JOIN normalized
    ORDER BY scored.score DESC, scored.created_at DESC, scored.id DESC
    OFFSET (SELECT offset_value FROM normalized)
    LIMIT (SELECT limit_value FROM normalized)
  ),
  payload AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ranked.id,
          '_score', ranked.score,
          '_pool', 'scored'
        )
        ORDER BY ranked.score DESC, ranked.created_at DESC, ranked.id DESC
      ),
      '[]'::jsonb
    ) AS projects
    FROM ranked
  )
  SELECT jsonb_build_object(
    'projects', payload.projects,
    'total', totals.total,
    'hasMore', totals.total > (
      SELECT offset_value + limit_value
      FROM normalized
    )
  )
  FROM payload
  CROSS JOIN totals;
$$;

COMMENT ON FUNCTION public.get_recommended_projects_v2(uuid, smallint, jsonb, integer, integer)
  IS 'Phase-aware project recommendations. Matches precise age when classification is available, switches to reviewed-only when enforcement is enabled, and never returns difficulty_stars.';

-- Keep the old return shape for short-lived clients, but remove its previous
-- age-group-to-star matching. Invalid groups are treated as no age preference.
-- PostgreSQL cannot replace a function when its OUT/RETURNS TABLE row type
-- changes. This wrapper intentionally changes the implementation contract,
-- so drop the old same-signature function first and restore its grants below.
DROP FUNCTION IF EXISTS public.get_recommended_projects(jsonb, text, integer, integer);

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
SET search_path = ''
AS $$
DECLARE
  normalized_age_group text := NULLIF(trim(p_age_group), '');
  precise_age smallint;
  payload jsonb;
BEGIN
  precise_age := CASE normalized_age_group
    WHEN '3-5' THEN 3
    WHEN '6-9' THEN 6
    WHEN '10-12' THEN 10
    WHEN '13-15' THEN 13
    WHEN '16+' THEN 16
    WHEN '16-18' THEN 16
    ELSE NULL
  END;

  IF normalized_age_group IS NOT NULL AND precise_age IS NULL THEN
    RAISE WARNING 'Unknown recommendation age group %, ignoring age preference', normalized_age_group;
  END IF;

  -- auth.uid() is used here instead of accepting a user id from the legacy
  -- caller. The v2 function only uses public rows, so p_age never controls
  -- authorization.
  payload := public.get_recommended_projects_v2(
    auth.uid(),
    precise_age,
    p_user_steam,
    p_limit,
    p_offset
  );

  RETURN QUERY
  WITH ranked AS (
    SELECT
      (item.value ->> 'id')::bigint AS project_id,
      COALESCE((item.value ->> '_score')::double precision, 0)::float AS score,
      COALESCE(item.value ->> '_pool', 'scored')::text AS pool,
      item.ordinality
    FROM jsonb_array_elements(COALESCE(payload -> 'projects', '[]'::jsonb))
      WITH ORDINALITY AS item(value, ordinality)
  )
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
    ranked.score,
    ranked.pool
  FROM ranked
  JOIN public.projects AS p ON p.id = ranked.project_id
  JOIN public.profiles AS pr ON pr.id = p.author_id
  ORDER BY ranked.ordinality;
END;
$$;

COMMENT ON FUNCTION public.get_recommended_projects IS 'Compatibility wrapper for get_recommended_projects_v2; maps legacy age groups to representative ages without star matching.';

GRANT EXECUTE ON FUNCTION public.get_recommended_projects(jsonb, text, integer, integer) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_recommended_projects_v2(uuid, smallint, jsonb, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recommended_projects_v2(uuid, smallint, jsonb, integer, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
