-- Members must not keep a leftover daily-grant row from before rules v2.
-- 1) Rewrite _ensure so member rows are forced to grant_amount/balance 0
--    (ON CONFLICT DO UPDATE), not left at the pre-v2 300.
-- 2) One-shot: zero today's daily wallets for currently active members.
-- Existing free-user rows for today are left unchanged (still 300 until
-- the next Shanghai day). Re-runnable.

CREATE OR REPLACE FUNCTION public._ensure_ai_credit_balances(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  prof public.profiles%ROWTYPE; w public.ai_credit_wallets%ROWTYPE;
  d public.ai_daily_credit_wallets%ROWTYPE;
  v_period text := public.ai_credit_month_period();
  v_day date := (public.ai_credit_day_start() AT TIME ZONE 'Asia/Shanghai')::date;
  v_target numeric(18,3) := 0;
  v_balance numeric(18,3) := 0; v_daily_grant numeric(18,3) := 150;
BEGIN
  IF p_user_id IS NULL THEN RETURN jsonb_build_object('error','invalid_params'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO prof FROM public.profiles WHERE id=p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','user_not_found'); END IF;
  PERFORM public._release_expired_tutor_holds(p_user_id);

  IF prof.membership_tier='founder' AND prof.membership_period='founder' THEN
    v_target:=20000;
  ELSIF prof.membership_tier='pro' AND (prof.membership_period='lifetime'
      OR (prof.membership_period IN ('monthly','yearly') AND prof.membership_expires_at>now())) THEN
    v_target:=15000;
  END IF;
  IF v_target>0 THEN
    SELECT * INTO w FROM public.ai_credit_wallets WHERE user_id=p_user_id FOR UPDATE;
    IF NOT FOUND OR w.grant_period IS DISTINCT FROM v_period THEN
      INSERT INTO public.ai_credit_wallets(user_id,balance,grant_period)
        VALUES(p_user_id,v_target,v_period)
        ON CONFLICT(user_id) DO UPDATE SET balance=v_target,grant_period=v_period,updated_at=now()
        RETURNING * INTO w;
      INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
        VALUES(p_user_id,v_target,'monthly_grant',jsonb_build_object('period',v_period,
          'creditPolicy','daily_credits_v1','targetGrant',v_target));
    END IF;
    v_balance:=w.balance;
  END IF;

  -- Members receive no daily grant. Force any leftover pre-v2 row to zero so
  -- reserve/fallback cannot spend the old 300, and the UI status reports 0.
  IF v_target>0 THEN
    INSERT INTO public.ai_daily_credit_wallets(user_id,grant_day,balance,grant_amount)
      VALUES(p_user_id,v_day,0,0)
      ON CONFLICT(user_id,grant_day) DO UPDATE
        SET balance=0, grant_amount=0, updated_at=now()
        WHERE public.ai_daily_credit_wallets.balance <> 0
           OR public.ai_daily_credit_wallets.grant_amount <> 0;
  ELSE
    INSERT INTO public.ai_daily_credit_wallets(user_id,grant_day,balance,grant_amount)
      VALUES(p_user_id,v_day,v_daily_grant,v_daily_grant) ON CONFLICT(user_id,grant_day) DO NOTHING;
    IF NOT FOUND THEN
      -- Membership lapsed earlier today: top up the zero row once.
      UPDATE public.ai_daily_credit_wallets
        SET balance=balance+v_daily_grant,grant_amount=v_daily_grant,updated_at=now()
        WHERE user_id=p_user_id AND grant_day=v_day AND grant_amount=0;
    END IF;
    IF FOUND THEN
      INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
        VALUES(p_user_id,v_daily_grant,'daily_grant',jsonb_build_object(
          'creditPolicy','daily_credits_v1','dailyPeriod',v_day::text));
    END IF;
  END IF;
  SELECT * INTO d FROM public.ai_daily_credit_wallets
    WHERE user_id=p_user_id AND grant_day=v_day FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'daily_wallet_missing'; END IF;
  RETURN jsonb_build_object('isMember',v_target>0,'walletBalance',v_balance,
    'monthlyGrant',v_target,'freeDaily',d.grant_amount,'dailyChargeCap',100,
    'freeUsedToday',GREATEST(d.grant_amount-d.balance,0),'freeRemainingToday',d.balance,
    'grantPeriod',v_period,'dailyPeriod',v_day::text,
    'dayResetAt',EXTRACT(EPOCH FROM (public.ai_credit_day_start()+interval '1 day'))::bigint,
    'canChat',(v_balance>=.01 OR d.balance>=.01),'creditUnit','credits');
END;
$$;

UPDATE public.ai_daily_credit_wallets AS d
SET balance = 0, grant_amount = 0, updated_at = now()
FROM public.profiles AS p
WHERE d.user_id = p.id
  AND d.grant_day = (public.ai_credit_day_start() AT TIME ZONE 'Asia/Shanghai')::date
  AND (d.grant_amount > 0 OR d.balance > 0)
  AND (
    (p.membership_tier = 'founder' AND p.membership_period = 'founder')
    OR (
      p.membership_tier = 'pro'
      AND (
        p.membership_period = 'lifetime'
        OR (
          p.membership_period IN ('monthly', 'yearly')
          AND p.membership_expires_at > now()
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
