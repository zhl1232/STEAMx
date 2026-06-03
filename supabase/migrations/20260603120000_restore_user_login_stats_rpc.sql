-- Restore login streak stats used by get_user_stats_summary.
DROP FUNCTION IF EXISTS public.get_user_login_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_user_login_stats(target_user_id UUID)
RETURNS TABLE(login_days INT, consecutive_days INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(p.total_login_days, 0)::int AS login_days,
    CASE
      WHEN p.last_check_in >= ((now() AT TIME ZONE 'Asia/Shanghai')::date - 1)
        THEN COALESCE(p.login_streak, 0)::int
      ELSE 0
    END AS consecutive_days
  FROM public.profiles p
  WHERE p.id = target_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_login_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_login_stats(UUID) TO service_role;
