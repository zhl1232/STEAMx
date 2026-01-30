-- Badge Leaderboard
CREATE OR REPLACE FUNCTION get_badge_leaderboard(limit_count int)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  xp bigint,
  badge_count bigint
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    p.avatar_url,
    COALESCE(p.xp, 0)::bigint as xp,
    count(ub.badge_id) as badge_count
  FROM profiles p
  JOIN user_badges ub ON p.id = ub.user_id
  GROUP BY p.id, p.display_name, p.avatar_url, p.xp
  ORDER BY badge_count DESC
  LIMIT limit_count;
END;
$$;

-- Project Leaderboard
CREATE OR REPLACE FUNCTION get_project_leaderboard(limit_count int)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  xp bigint,
  project_count bigint
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    p.avatar_url,
    COALESCE(p.xp, 0)::bigint as xp,
    count(cp.id) as project_count
  FROM profiles p
  JOIN completed_projects cp ON p.id = cp.user_id
  WHERE cp.is_public = true
  GROUP BY p.id, p.display_name, p.avatar_url, p.xp
  ORDER BY project_count DESC
  LIMIT limit_count;
END;
$$;
