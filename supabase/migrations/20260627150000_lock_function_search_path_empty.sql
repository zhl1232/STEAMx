-- 把所有 public schema routine 的 search_path 锁定为空字符串 ''，
-- 真正消除 Supabase Database Linter `function_search_path_mutable`（lint 0011）告警。
--
-- 背景：
--   linter 只接受 search_path = ''（强制函数体内对象引用全部 schema-qualified）。
--   之前的两次修复用 `public` 不被 linter 接受：
--     - 20260305100000_fix_function_search_path.sql（仅 SECURITY DEFINER，用 public）
--     - 20260523140000_lock_function_search_path.sql（全部 routine，用 public）
--   其注释中"linter accepts any fixed value"的假设是错误的，导致告警一直在。
--
-- 审计（scripts/audit-function-search-path.mjs）确认 84 个 routine：
--   - 79 个函数体已全部 public.xxx 全限定，可安全 ALTER SET search_path = ''；
--   - 5 个含未全限定引用（FROM/UPDATE/JOIN 后直接写表名），需先 CREATE OR REPLACE
--     补 public. 前缀后再锁定。
--
-- 幂等：DO 块只 ALTER 当前 proconfig 中 search_path 不为 '' 的 routine。
-- 注意：空 search_path 会阻止 LANGUAGE sql 函数 inlining，本项目相关函数均为
--       plpgsql，不受影响；pg_catalog 始终被隐式搜索，now()/coalesce() 等内置可用。

-- ── 1. 重写 5 个含未全限定引用的函数（补 public. 前缀 + 锁定 search_path = ''） ──

CREATE OR REPLACE FUNCTION public.increment_discussion_replies_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    UPDATE public.discussions
    SET replies_count = replies_count + 1,
        last_reply_at = NEW.created_at
    WHERE id = NEW.discussion_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_discussion_replies_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    UPDATE public.discussions
    SET replies_count = replies_count - 1,
        last_reply_at = (
            SELECT MAX(created_at) FROM public.discussion_replies
            WHERE discussion_id = OLD.discussion_id
        )
    WHERE id = OLD.discussion_id;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_badge_leaderboard(limit_count integer)
RETURNS TABLE(id uuid, display_name text, avatar_url text, xp bigint, badge_count bigint)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    p.avatar_url,
    COALESCE(p.xp, 0)::bigint as xp,
    count(ub.badge_id) as badge_count
  FROM public.profiles p
  JOIN public.user_badges ub ON p.id = ub.user_id
  GROUP BY p.id, p.display_name, p.avatar_url, p.xp
  ORDER BY badge_count DESC
  LIMIT limit_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_project_leaderboard(limit_count integer)
RETURNS TABLE(id uuid, display_name text, avatar_url text, xp bigint, project_count bigint)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    p.avatar_url,
    COALESCE(p.xp, 0)::bigint as xp,
    count(cp.id) as project_count
  FROM public.profiles p
  JOIN public.completed_projects cp ON p.id = cp.user_id
  WHERE cp.is_public = true
  GROUP BY p.id, p.display_name, p.avatar_url, p.xp
  ORDER BY project_count DESC
  LIMIT limit_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recommended_projects(
  p_user_steam jsonb DEFAULT NULL::jsonb,
  p_age_group text DEFAULT NULL::text,
  p_limit integer DEFAULT 6,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id bigint, title text, description text, author_id uuid, image_url text,
  category text, sub_category_id integer, difficulty text, difficulty_stars integer,
  likes_count integer, views_count integer, status text,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  author_display_name text, _score double precision, _pool text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
    FROM public.projects p
    JOIN public.profiles pr ON pr.id = p.author_id
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
    FROM public.projects p
    JOIN public.profiles pr ON pr.id = p.author_id
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

-- ── 2. 把其余 public schema routine 的 search_path 批量改为 '' ──────────
-- 上面 5 个函数用 CREATE OR REPLACE 已自带 SET search_path = ''，会被下面的
-- NOT EXISTS 过滤跳过；3 个当前未设置 search_path 的 routine 也会被一并锁定。
DO $do$
DECLARE
  fn record;
  altered int := 0;
BEGIN
  FOR fn IN
    SELECT p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg = 'search_path='
      )
  LOOP
    EXECUTE format(
      $fmt$ALTER ROUTINE public.%I(%s) SET search_path = ''$fmt$,
      fn.func_name, fn.args
    );
    altered := altered + 1;
  END LOOP;

  RAISE NOTICE 'lock_function_search_path_empty: % routine(s) altered', altered;
END
$do$;
