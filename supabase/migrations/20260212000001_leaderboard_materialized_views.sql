-- ============================================
-- 排行榜多维度：本周 / 本月 / 总榜（物化视图 + RPC）
-- ============================================
-- 使用物化视图缓存本周/本月的 XP 聚合，避免实时扫描 xp_logs。
-- 建议通过 pg_cron 或定时任务每小时刷新：SELECT refresh_leaderboard_mvs();
-- ============================================

-- 1. 本周 XP 物化视图（UTC 周一起算）
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_leaderboard_weekly_xp AS
SELECT
    user_id,
    COALESCE(SUM(xp_amount), 0)::bigint AS xp_sum
FROM public.xp_logs
WHERE created_at >= date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
GROUP BY user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leaderboard_weekly_xp_user_id
    ON public.mv_leaderboard_weekly_xp (user_id);

COMMENT ON MATERIALIZED VIEW public.mv_leaderboard_weekly_xp IS '本周（UTC 周一至今）用户 XP 汇总，供排行榜使用；需定期 REFRESH';

-- 2. 本月 XP 物化视图（UTC 月首起算）
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_leaderboard_monthly_xp AS
SELECT
    user_id,
    COALESCE(SUM(xp_amount), 0)::bigint AS xp_sum
FROM public.xp_logs
WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
GROUP BY user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leaderboard_monthly_xp_user_id
    ON public.mv_leaderboard_monthly_xp (user_id);

COMMENT ON MATERIALIZED VIEW public.mv_leaderboard_monthly_xp IS '本月（UTC 1 号至今）用户 XP 汇总，供排行榜使用；需定期 REFRESH';

-- 3. 刷新函数（供 cron 或手动调用，建议每小时一次）
CREATE OR REPLACE FUNCTION public.refresh_leaderboard_mvs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leaderboard_weekly_xp;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leaderboard_monthly_xp;
END;
$$;

COMMENT ON FUNCTION public.refresh_leaderboard_mvs() IS '刷新排行榜物化视图（本周/本月），建议每小时执行';

-- 4. 本周积分榜 RPC
CREATE OR REPLACE FUNCTION public.get_leaderboard_xp_weekly(limit_count int)
RETURNS TABLE (
    id uuid,
    display_name text,
    avatar_url text,
    xp bigint
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
        m.xp_sum AS xp
    FROM public.mv_leaderboard_weekly_xp m
    JOIN public.profiles p ON p.id = m.user_id
    ORDER BY m.xp_sum DESC
    LIMIT limit_count;
$$;

COMMENT ON FUNCTION public.get_leaderboard_xp_weekly(int) IS '积分榜 - 本周（来自物化视图）';

-- 5. 本月积分榜 RPC
CREATE OR REPLACE FUNCTION public.get_leaderboard_xp_monthly(limit_count int)
RETURNS TABLE (
    id uuid,
    display_name text,
    avatar_url text,
    xp bigint
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
        m.xp_sum AS xp
    FROM public.mv_leaderboard_monthly_xp m
    JOIN public.profiles p ON p.id = m.user_id
    ORDER BY m.xp_sum DESC
    LIMIT limit_count;
$$;

COMMENT ON FUNCTION public.get_leaderboard_xp_monthly(int) IS '积分榜 - 本月（来自物化视图）';

-- 6. 权限：物化视图与函数对已登录用户可读/可执行
GRANT SELECT ON public.mv_leaderboard_weekly_xp TO authenticated;
GRANT SELECT ON public.mv_leaderboard_monthly_xp TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard_mvs() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_xp_weekly(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_xp_monthly(int) TO authenticated;

-- 7. 首次填充物化视图（后续用 refresh_leaderboard_mvs() 做 CONCURRENTLY 刷新）
REFRESH MATERIALIZED VIEW public.mv_leaderboard_weekly_xp;
REFRESH MATERIALIZED VIEW public.mv_leaderboard_monthly_xp;

NOTIFY pgrst, 'reload schema';
