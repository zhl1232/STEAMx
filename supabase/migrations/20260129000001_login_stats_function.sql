-- ============================================
-- 登录统计 RPC 函数
-- ============================================
-- 用于查询用户登录天数和连续登录天数
-- 数据来源: auth.audit_log_entries 表
-- ============================================

-- 获取用户登录统计
CREATE OR REPLACE FUNCTION public.get_user_login_stats(target_user_id uuid)
RETURNS TABLE(
    login_days bigint,
    consecutive_days bigint
) AS $$
DECLARE
    v_login_days bigint;
    v_consecutive_days bigint;
    v_current_date date;
    v_check_date date;
BEGIN
    -- 统计登录天数（不重复日期数）
    SELECT COUNT(DISTINCT DATE(aal.created_at))
    INTO v_login_days
    FROM auth.audit_log_entries aal
    WHERE aal.actor_id = target_user_id::text
      AND aal.action LIKE '%login%';

    -- 计算连续登录天数（从今天往前数）
    v_consecutive_days := 0;
    v_current_date := CURRENT_DATE;
    v_check_date := v_current_date;

    LOOP
        -- 检查这一天是否有登录记录
        IF EXISTS (
            SELECT 1 FROM auth.audit_log_entries aal
            WHERE aal.actor_id = target_user_id::text
              AND aal.action LIKE '%login%'
              AND DATE(aal.created_at) = v_check_date
        ) THEN
            v_consecutive_days := v_consecutive_days + 1;
            v_check_date := v_check_date - INTERVAL '1 day';
        ELSE
            -- 如果是今天且没有登录记录，检查昨天开始
            IF v_check_date = v_current_date THEN
                v_check_date := v_current_date - INTERVAL '1 day';
                -- 再次检查昨天
                IF EXISTS (
                    SELECT 1 FROM auth.audit_log_entries aal
                    WHERE aal.actor_id = target_user_id::text
                      AND aal.action LIKE '%login%'
                      AND DATE(aal.created_at) = v_check_date
                ) THEN
                    v_consecutive_days := v_consecutive_days + 1;
                    v_check_date := v_check_date - INTERVAL '1 day';
                ELSE
                    EXIT; -- 连续中断
                END IF;
            ELSE
                EXIT; -- 连续中断
            END IF;
        END IF;

        -- 防止无限循环，最多检查 400 天
        IF (v_current_date - v_check_date) > 400 THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_login_days, v_consecutive_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION public.get_user_login_stats(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_user_login_stats(uuid) IS '获取用户登录统计：总登录天数和连续登录天数';

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 登录统计 RPC 函数创建完成！';
  RAISE NOTICE '📊 可调用 get_user_login_stats(user_id) 获取登录统计';
END $$;
