-- Observation leaderboard: approved public observation count by user.

CREATE INDEX IF NOT EXISTS idx_observation_events_public_approved_user_id
    ON public.observation_events (user_id)
    WHERE status = 'approved' AND is_public = TRUE;

CREATE OR REPLACE FUNCTION public.get_observation_leaderboard(limit_count int)
RETURNS TABLE (
    id uuid,
    display_name text,
    avatar_url text,
    xp integer,
    observation_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p.id,
        p.display_name,
        p.avatar_url,
        COALESCE(p.xp, 0) AS xp,
        COUNT(oe.id)::bigint AS observation_count
    FROM public.observation_events oe
    JOIN public.profiles p ON p.id = oe.user_id
    WHERE oe.status = 'approved'
      AND oe.is_public = TRUE
    GROUP BY p.id, p.display_name, p.avatar_url, p.xp
    ORDER BY observation_count DESC, COALESCE(p.xp, 0) DESC, p.id ASC
    LIMIT GREATEST(1, LEAST(limit_count, 50));
$$;

COMMENT ON FUNCTION public.get_observation_leaderboard(int) IS 'Observation leaderboard by approved public observation count';

GRANT EXECUTE ON FUNCTION public.get_observation_leaderboard(int) TO authenticated;

NOTIFY pgrst, 'reload schema';
