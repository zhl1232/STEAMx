-- 移除未使用的浏览数 RPC（前端从未调用）
DROP FUNCTION IF EXISTS public.increment_project_views(bigint);
