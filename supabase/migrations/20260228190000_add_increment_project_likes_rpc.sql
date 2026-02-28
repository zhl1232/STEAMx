-- ============================================
-- 项目点赞数 RPC：increment_project_likes / decrement_project_likes
-- ============================================
-- 原因：点赞后刷新页面点赞数回退，因为：
-- 1. 这两个函数只在 archive 的 consolidated_schema 中定义，当前库可能未创建；
-- 2. 若存在且为默认 SECURITY INVOKER，则 UPDATE 以 authenticated 执行，
--    会触发 protect_projects_sensitive_fields，把 NEW.likes_count 改回 OLD，导致不生效。
-- 解决：在正式迁移中创建，并设为 SECURITY DEFINER，以 postgres 执行 UPDATE，触发器不再覆盖。
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_project_likes(project_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET likes_count = COALESCE(likes_count, 0) + 1
  WHERE id = project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_project_likes(project_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
  WHERE id = project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_project_likes(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_project_likes(bigint) TO authenticated;

COMMENT ON FUNCTION public.increment_project_likes(bigint) IS '增加项目点赞数，由点赞插入 likes 表后调用，SECURITY DEFINER 以绕过 protect 触发器';
COMMENT ON FUNCTION public.decrement_project_likes(bigint) IS '减少项目点赞数，由取消点赞删除 likes 表后调用，SECURITY DEFINER 以绕过 protect 触发器';
