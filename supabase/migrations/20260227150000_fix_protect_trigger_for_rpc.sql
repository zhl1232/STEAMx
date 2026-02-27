-- ============================================
-- 修复 protect_profiles_sensitive_fields 触发器
-- 问题：使用 current_setting('role') 判断角色，但 SECURITY DEFINER 函数
--       （如 daily_check_in）在 Supabase 中 session role 仍为 'authenticated'，
--       导致触发器错误地拦截了合法的 RPC 更新（XP、硬币、签到字段全部被回滚）。
-- 修复：改用 session_user / current_user 判断。SECURITY DEFINER 函数运行时
--       current_user 为函数所有者（postgres），不会被触发器拦截。
-- ============================================

CREATE OR REPLACE FUNCTION public.protect_profiles_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- 当请求来自普通客户端（非 SECURITY DEFINER RPC）时保护敏感字段
  -- current_user 在 SECURITY DEFINER 函数中为 postgres，不会进入此分支
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    NEW.role := OLD.role;
    NEW.xp := COALESCE(OLD.xp, 0);
    NEW.coins := COALESCE(OLD.coins, 0);
    NEW.last_check_in := OLD.last_check_in;
    NEW.login_streak := COALESCE(OLD.login_streak, 0);
    NEW.total_login_days := COALESCE(OLD.total_login_days, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 同样修复 projects 表的保护触发器
CREATE OR REPLACE FUNCTION public.protect_projects_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    NEW.likes_count := COALESCE(OLD.likes_count, 0);
    NEW.views_count := COALESCE(OLD.views_count, 0);
    NEW.status := OLD.status;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
