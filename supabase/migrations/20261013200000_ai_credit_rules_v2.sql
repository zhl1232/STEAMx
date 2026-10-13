-- AI credit rules v2 (2026-10-13):
-- 1) Daily grant for non-members 300 -> 150 (Shanghai day, not accumulated).
-- 2) Members (monthly grant > 0) no longer receive the daily grant.
-- 3) Speech daily limits by tier: free TTS 2000 chars / ASR 300 s;
--    members keep TTS 20000 chars / ASR 1800 s.
-- Re-runnable: CREATE OR REPLACE, ADD COLUMN IF NOT EXISTS, idempotent UPDATEs.
-- Existing wallet rows for the current day are not rewritten (no balance
-- changes); the new amounts apply from the next row created.

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

  -- Members receive no daily grant. A zero-amount row keeps downstream
  -- settlement/fallback paths (which expect a row) working unchanged.
  IF v_target>0 THEN
    INSERT INTO public.ai_daily_credit_wallets(user_id,grant_day,balance,grant_amount)
      VALUES(p_user_id,v_day,0,0) ON CONFLICT(user_id,grant_day) DO NOTHING;
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

-- Speech: user_daily_units now means the free-user limit; members use member_daily_units.
ALTER TABLE public.tutor_speech_usage_policy ADD COLUMN IF NOT EXISTS member_daily_units bigint;
UPDATE public.tutor_speech_usage_policy SET user_daily_units = 2000, member_daily_units = 20000 WHERE kind = 'tts';
UPDATE public.tutor_speech_usage_policy SET user_daily_units = 300, member_daily_units = 1800 WHERE kind = 'asr';
ALTER TABLE public.tutor_speech_usage_policy ALTER COLUMN member_daily_units SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tutor_speech_policy_member_units_check') THEN
    ALTER TABLE public.tutor_speech_usage_policy ADD CONSTRAINT tutor_speech_policy_member_units_check
      CHECK (member_daily_units >= user_daily_units AND global_daily_units >= member_daily_units);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_tutor_speech_usage(p_user_id uuid, p_kind text, p_units integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_policy public.tutor_speech_usage_policy%ROWTYPE;
  v_now timestamptz;
  v_day date;
  v_scope text;
  v_user_used bigint;
  v_global_used bigint;
  v_lease uuid;
  v_reset bigint;
  v_limit bigint;
  prof public.profiles%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('tts', 'asr')
      OR p_units IS NULL OR p_units < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_user');
  END IF;
  -- All kinds/scopes share a single acquisition order, including cross-kind concurrency.
  PERFORM pg_advisory_xact_lock(2147481313::bigint);
  v_now := clock_timestamp();
  v_day := (v_now AT TIME ZONE 'Asia/Shanghai')::date;
  v_reset := EXTRACT(EPOCH FROM ((v_day + 1)::timestamp AT TIME ZONE 'Asia/Shanghai'))::bigint;
  v_scope := 'user:' || p_user_id::text;
  SELECT * INTO v_policy FROM public.tutor_speech_usage_policy WHERE kind = p_kind;
  IF NOT FOUND OR p_units > v_policy.max_request_units THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_units');
  END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = p_user_id;
  IF FOUND AND ((prof.membership_tier = 'founder' AND prof.membership_period = 'founder')
      OR (prof.membership_tier = 'pro' AND (prof.membership_period = 'lifetime'
        OR (prof.membership_period IN ('monthly', 'yearly') AND prof.membership_expires_at > v_now)))) THEN
    v_limit := v_policy.member_daily_units;
  ELSE
    v_limit := v_policy.user_daily_units;
  END IF;
  DELETE FROM public.tutor_speech_usage_leases WHERE expires_at <= v_now;
  DELETE FROM public.tutor_speech_daily_usage WHERE usage_day < v_day - 31;
  IF (SELECT count(*) FROM public.tutor_speech_usage_leases WHERE user_id = p_user_id) >= 2
      OR (SELECT count(*) FROM public.tutor_speech_usage_leases) >= 32 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'concurrency_limit');
  END IF;
  INSERT INTO public.tutor_speech_daily_usage(usage_day, scope, kind)
    VALUES(v_day, v_scope, p_kind), (v_day, 'global', p_kind) ON CONFLICT DO NOTHING;
  SELECT units INTO v_user_used FROM public.tutor_speech_daily_usage
    WHERE usage_day = v_day AND scope = v_scope AND kind = p_kind FOR UPDATE;
  SELECT units INTO v_global_used FROM public.tutor_speech_daily_usage
    WHERE usage_day = v_day AND scope = 'global' AND kind = p_kind FOR UPDATE;
  IF v_user_used + p_units > v_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_daily_limit', 'resetAt', v_reset);
  END IF;
  IF v_global_used + p_units > v_policy.global_daily_units THEN
    RETURN jsonb_build_object('ok', false, 'error', 'global_daily_limit', 'resetAt', v_reset);
  END IF;
  UPDATE public.tutor_speech_daily_usage SET units = units + p_units
    WHERE usage_day = v_day AND scope IN (v_scope, 'global') AND kind = p_kind;
  INSERT INTO public.tutor_speech_usage_leases(user_id, kind, expires_at)
    VALUES(p_user_id, p_kind, v_now + interval '5 minutes') RETURNING id INTO v_lease;
  RETURN jsonb_build_object('ok', true, 'leaseId', v_lease, 'resetAt', v_reset);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_tutor_speech_usage(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tutor_speech_usage(uuid, text, integer) TO service_role;
NOTIFY pgrst, 'reload schema';
