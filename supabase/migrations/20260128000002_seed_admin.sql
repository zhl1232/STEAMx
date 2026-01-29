-- ============================================
-- 管理员角色提权脚本
-- ============================================
-- 说明: 此脚本用于将指定邮箱的用户提升为管理员
-- 前提: 用户必须已通过正常渠道（Dashboard / 前端）完成注册
-- ============================================

DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := '66020423@qq.com';
BEGIN
    -- 1. 动态查找用户 ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
        RAISE NOTICE '⚠️ 用户 % 不存在，请先通过正常渠道注册', v_email;
        RETURN;
    END IF;

    -- 2. 确保邮箱已确认（解决 Dashboard 创建时未勾选 Auto Confirm 的问题）
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;

    -- 3. 确保 Profile 存在并设置为 Admin
    INSERT INTO public.profiles (id, username, display_name, role, avatar_url)
    VALUES (v_user_id, 'admin', 'Admin', 'admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin', display_name = COALESCE(public.profiles.display_name, 'Admin');

    RAISE NOTICE '✅ 用户 % (ID: %) 已提权为 Admin', v_email, v_user_id;
END $$;
