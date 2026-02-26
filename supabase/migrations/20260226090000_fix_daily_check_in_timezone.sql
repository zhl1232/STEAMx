-- ==========================================
-- 修复 daily_check_in 时区问题
-- CURRENT_DATE 使用 UTC，对 UTC+8 用户会导致 0:00~8:00 无法正确打卡
-- 改为使用 Asia/Shanghai 时区的当前日期
-- ==========================================

CREATE OR REPLACE FUNCTION public.daily_check_in()
RETURNS jsonb AS $$
DECLARE
  v_current_date date := (NOW() AT TIME ZONE 'Asia/Shanghai')::date;
  v_user_id uuid := auth.uid();
  user_last_check_in date;
  user_streak int;
  user_total_days int;
  xp_amount int;
  coins_amount int := 2;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT last_check_in, login_streak, total_login_days
  INTO user_last_check_in, user_streak, user_total_days
  FROM public.profiles
  WHERE id = v_user_id;

  -- 今天已打卡，直接返回（幂等）
  IF user_last_check_in = v_current_date THEN
    RETURN jsonb_build_object(
      'streak', user_streak,
      'total_days', user_total_days,
      'checked_in_today', true,
      'is_new_day', false,
      'xp_granted', 0,
      'coins_granted', 0
    );
  END IF;

  -- 计算连续登录天数
  IF user_last_check_in = v_current_date - 1 THEN
    user_streak := COALESCE(user_streak, 0) + 1;
  ELSE
    user_streak := 1;
  END IF;

  user_total_days := COALESCE(user_total_days, 0) + 1;
  -- 基础 5 XP + 连续天数奖励（上限 20），即 6~25 XP
  xp_amount := 5 + LEAST(user_streak, 20);

  BEGIN
    INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
    VALUES (v_user_id, 'daily_login', v_current_date::text, xp_amount);

    INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id)
    VALUES (v_user_id, coins_amount, 'daily_login', v_current_date::text);

    UPDATE public.profiles
    SET
      last_check_in = v_current_date,
      login_streak = user_streak,
      total_login_days = user_total_days,
      xp = xp + xp_amount,
      coins = coins + coins_amount
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
      'streak', user_streak,
      'total_days', user_total_days,
      'checked_in_today', true,
      'is_new_day', true,
      'xp_granted', xp_amount,
      'coins_granted', coins_amount
    );
  EXCEPTION WHEN unique_violation THEN
    -- 并发调用时（StrictMode / 多标签页）拦截唯一键冲突，返回友好响应
    RETURN jsonb_build_object(
      'error', 'already_checked_in_conflict',
      'streak', user_streak,
      'total_days', user_total_days,
      'checked_in_today', true,
      'is_new_day', false,
      'xp_granted', 0,
      'coins_granted', 0
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
