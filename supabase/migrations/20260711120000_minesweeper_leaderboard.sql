-- Public minesweeper leaderboard derived from cloud playground stats.
-- Keep the JSON blob private and expose only fields needed by the ranking UI.

CREATE OR REPLACE FUNCTION public.get_minesweeper_leaderboard(
  difficulty_key text,
  limit_count integer DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  best_time integer,
  rank bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH valid_scores AS (
    SELECT
      ps.user_id,
      (ps.stats -> 'minesweeper_stats' -> 'bestTimes' ->> difficulty_key)::integer AS best_time
    FROM public.playground_stats ps
    WHERE difficulty_key IN ('beginner', 'intermediate', 'expert')
      AND ps.stats -> 'minesweeper_stats' -> 'bestTimes' ->> difficulty_key ~ '^[0-9]{1,9}$'
      AND (ps.stats -> 'minesweeper_stats' -> 'bestTimes' ->> difficulty_key)::integer > 0
  ),
  ranked_scores AS (
    SELECT
      scores.user_id,
      scores.best_time,
      rank() OVER (ORDER BY scores.best_time ASC) AS rank
    FROM valid_scores scores
  )
  SELECT
    ranked.user_id,
    profile.display_name,
    profile.avatar_url,
    ranked.best_time,
    ranked.rank
  FROM ranked_scores ranked
  JOIN public.profiles profile ON profile.id = ranked.user_id
  ORDER BY ranked.rank ASC, ranked.user_id ASC
  LIMIT LEAST(GREATEST(limit_count, 1), 50);
$$;

COMMENT ON FUNCTION public.get_minesweeper_leaderboard(text, integer)
  IS 'Top cloud-synced minesweeper times for one difficulty; hides raw playground stats';

REVOKE ALL ON FUNCTION public.get_minesweeper_leaderboard(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_minesweeper_leaderboard(text, integer) TO authenticated;
