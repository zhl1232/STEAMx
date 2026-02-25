-- ============================================
-- 深入安全审视：保护核心表敏感数据不被客户端覆盖修改
-- ============================================

-- ============================================
-- 1. 防御触发器：防止篡改 Profiles (用户个人信息) 中的重要资产与统计
-- ============================================
CREATE OR REPLACE FUNCTION public.protect_profiles_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- 限制通过客户端 (authenticated / anon 状态) 直接修改资产与角色字段
  -- 仅允许特权账户服务或是 SECURITY DEFINER (如 daily_check_in 等 RPC) 更改
  IF current_setting('role', true) IN ('anon', 'authenticated') THEN
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

DROP TRIGGER IF EXISTS trg_protect_profiles ON public.profiles;
CREATE TRIGGER trg_protect_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_sensitive_fields();


-- ============================================
-- 2. 防御触发器：防止篡改 Projects (项目表) 中的重要指标及审核体系
-- ============================================
CREATE OR REPLACE FUNCTION public.protect_projects_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- 防止项目的发布者通过更新他们自己的项目时连带篡改点赞、浏览量及审核状态
  IF current_setting('role', true) IN ('anon', 'authenticated') THEN
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

DROP TRIGGER IF EXISTS trg_protect_projects ON public.projects;
CREATE TRIGGER trg_protect_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_projects_sensitive_fields();
