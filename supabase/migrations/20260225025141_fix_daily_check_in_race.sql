-- ==========================================
-- 修复 daily_check_in 中的并发 Race Condition 
-- 增加 EXCEPTION 安全捕获，把底层崩溃转化为 200 OK 友好返回
-- ==========================================

CREATE OR REPLACE FUNCTION public.daily_check_in()
RETURNS jsonb AS $$
DECLARE
  v_current_date date := CURRENT_DATE;
  v_user_id uuid := auth.uid();
  user_last_check_in date;
  user_streak int;
  user_total_days int;
  xp_amount int;
  coins_amount int := 2;
  result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT last_check_in, login_streak, total_login_days
  INTO user_last_check_in, user_streak, user_total_days
  FROM public.profiles
  WHERE id = v_user_id;

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

  IF user_last_check_in = v_current_date - 1 THEN
    user_streak := COALESCE(user_streak, 0) + 1;
  ELSE
    user_streak := 1;
  END IF;

  user_total_days := COALESCE(user_total_days, 0) + 1;
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
    -- 【核心修复区】：发生唯一键约束冲突（即防刷机制生效）时拦截底层崩溃
    -- 将其转化为正常的 JSON 响应，前端网络层收到 200 OK
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
