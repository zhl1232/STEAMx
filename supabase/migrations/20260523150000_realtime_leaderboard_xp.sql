-- ============================================
-- 经验榜本周/本月改为实时聚合 xp_logs
-- ============================================
-- 背景：20260212000001 引入了 mv_leaderboard_weekly_xp / mv_leaderboard_monthly_xp
-- 两个物化视图，依赖 refresh_leaderboard_mvs() 定时刷新。但仓库内未实际接入
-- pg_cron 或外部调度，导致两份视图自创建当天起再未更新，本周/本月榜数据冻结。
--
-- 方案：移除物化视图依赖，RPC 直接实时聚合 xp_logs；在 created_at 上补索引
-- 保证聚合性能。后续若量级激增可再回退到 MV + 调度方案。
-- ============================================

-- 1. xp_logs(created_at) 索引，支撑实时聚合
CREATE INDEX IF NOT EXISTS idx_xp_logs_created_at
    ON public.xp_logs (created_at DESC);

-- 2. 本周经验榜 RPC：实时聚合（UTC 周一起算，对齐 lib/date-utils.ts）
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
        COALESCE(SUM(l.xp_amount), 0)::bigint AS xp
    FROM public.xp_logs l
    JOIN public.profiles p ON p.id = l.user_id
    WHERE l.created_at >= date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    GROUP BY p.id, p.display_name, p.avatar_url
    ORDER BY xp DESC
    LIMIT limit_count;
$$;

COMMENT ON FUNCTION public.get_leaderboard_xp_weekly(int) IS '积分榜 - 本周（实时聚合 xp_logs）';

-- 3. 本月经验榜 RPC：实时聚合（UTC 月首起算）
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
        COALESCE(SUM(l.xp_amount), 0)::bigint AS xp
    FROM public.xp_logs l
    JOIN public.profiles p ON p.id = l.user_id
    WHERE l.created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    GROUP BY p.id, p.display_name, p.avatar_url
    ORDER BY xp DESC
    LIMIT limit_count;
$$;

COMMENT ON FUNCTION public.get_leaderboard_xp_monthly(int) IS '积分榜 - 本月（实时聚合 xp_logs）';

-- 4. 清理不再使用的物化视图与刷新函数
DROP MATERIALIZED VIEW IF EXISTS public.mv_leaderboard_weekly_xp;
DROP MATERIALIZED VIEW IF EXISTS public.mv_leaderboard_monthly_xp;
DROP FUNCTION IF EXISTS public.refresh_leaderboard_mvs();

NOTIFY pgrst, 'reload schema';
