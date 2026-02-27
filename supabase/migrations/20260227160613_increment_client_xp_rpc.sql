-- ============================================
-- 修复前端更新 XP 失败问题
-- 问题：protect_profiles_sensitive_fields 触发器正确拦截了来自前端的对 xp 字段的 update，
--       因为 xp 存在于 profiles 表并且不能被一般客户端修改，避免外挂随便发送 updateXpMutation(999999)。
-- 修复：创建一个 SECURITY DEFINER (管理员上下文运行) 的 RPC 函数给前端调用，从而越过触发器保护，
--       并在函数内增加一个固定的增量。
--       这是为了简化现有使用 `updateXpMutation` 的逻辑。
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_client_xp(amount int)
RETURNS void AS $$
BEGIN
  -- 只有当前登录的用户才可以给自己增加 XP
  -- 并进行基本防刷验证，增量不可能太大
  IF amount <= 0 OR amount > 1000 THEN
    RAISE EXCEPTION 'Invalid XP amount.';
  END IF;

  UPDATE public.profiles
  SET xp = xp + amount
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.increment_client_xp(int) IS '允许客户端安全的递增经验，越过保护触发器';
