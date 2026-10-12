-- Credit grants draft: pro 15,000 / founder 20,000 per Shanghai calendar month.
-- The daily 300-credit amount is a reviewable recommendation, not a production
-- setting until this migration and its companion tutor migration are approved.
-- Consumption keeps the member wallet first, then the daily wallet. Daily
-- balances are isolated by date and are never accumulated into another date.
-- Existing test wallets keep their current-month balance. No historical
-- top-up/repricing is performed; tier changes affect the next monthly grant.

CREATE TABLE public.ai_daily_credit_wallets (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_day date NOT NULL,
  balance numeric(18,3) NOT NULL CHECK (balance >= 0),
  grant_amount numeric(18,3) NOT NULL CHECK (grant_amount >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, grant_day),
  CHECK (balance <= grant_amount)
);
ALTER TABLE public.ai_daily_credit_wallets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_daily_credit_wallets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_daily_credit_wallets TO authenticated;
GRANT ALL ON public.ai_daily_credit_wallets TO service_role;
CREATE POLICY ai_daily_credit_wallets_select_own ON public.ai_daily_credit_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ai_daily_credit_wallets_service_role ON public.ai_daily_credit_wallets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
COMMENT ON TABLE public.ai_daily_credit_wallets IS
  'Daily AI credits by Shanghai date. A refund returns only to its original date. The draft initial daily grant is 300 credits.';

-- Only pre-policy receipts participate in the legacy five-turn quota. A new
-- monetary debit must not consume one of an old in-flight request's free turns.
CREATE OR REPLACE FUNCTION public.count_ai_free_chats_today(p_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COUNT(*)::int
  FROM public.ai_credit_logs debit
  WHERE debit.user_id = p_user_id
    AND debit.reason = 'free_chat'
    AND debit.meta->>'creditPolicy' IS DISTINCT FROM 'daily_credits_v1'
    AND debit.created_at >= public.ai_credit_day_start()
    AND COALESCE((SELECT SUM((refund.meta->>'refundCost')::numeric)
      FROM public.ai_credit_logs refund
      WHERE refund.user_id = debit.user_id
        AND refund.reason = 'refund'
        AND refund.meta->>'receiptId' = debit.id::text), 0) < abs(debit.amount);
$$;

-- All callers use this shared authoritative grant path. The lock is reentrant
-- within the same transaction. Do not call this helper from hold settlement:
-- expired-hold cleanup calls settlement and would otherwise recurse.
CREATE FUNCTION public._ensure_ai_credit_balances(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  prof public.profiles%ROWTYPE; w public.ai_credit_wallets%ROWTYPE;
  d public.ai_daily_credit_wallets%ROWTYPE;
  v_period text := public.ai_credit_month_period();
  v_day date := (public.ai_credit_day_start() AT TIME ZONE 'Asia/Shanghai')::date;
  v_target numeric(18,3) := 0;
  v_balance numeric(18,3) := 0; v_daily_grant numeric(18,3) := 300;
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

  INSERT INTO public.ai_daily_credit_wallets(user_id,grant_day,balance,grant_amount)
    VALUES(p_user_id,v_day,v_daily_grant,v_daily_grant) ON CONFLICT(user_id,grant_day) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
      VALUES(p_user_id,v_daily_grant,'daily_grant',jsonb_build_object(
        'creditPolicy','daily_credits_v1','dailyPeriod',v_day::text));
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

CREATE OR REPLACE FUNCTION public.get_ai_credit_status(
  p_is_member boolean,p_monthly_grant int,p_free_daily int
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid:=auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','unauthorized'); END IF;
  -- Legacy arguments are retained for caller compatibility, never trusted.
  RETURN public._ensure_ai_credit_balances(v_user_id);
END;
$$;

-- PBL keeps its existing fixed credit price, but its daily fallback now debits
-- that many credits instead of one free opportunity. No new legacy admissions.
CREATE OR REPLACE FUNCTION public.consume_ai_credit_service(p_user_id uuid,p_cost int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s jsonb; v_source text; v_remaining numeric(18,3); v_receipt bigint;
BEGIN
  IF p_user_id IS NULL OR p_cost IS NULL OR p_cost<1 THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_params');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  s:=public._ensure_ai_credit_balances(p_user_id);
  IF s ? 'error' THEN RETURN s||jsonb_build_object('ok',false); END IF;
  IF (s->>'isMember')::boolean AND (s->>'walletBalance')::numeric>=p_cost THEN
    UPDATE public.ai_credit_wallets SET balance=balance-p_cost,updated_at=now()
      WHERE user_id=p_user_id AND grant_period=s->>'grantPeriod' AND balance>=p_cost
      RETURNING balance INTO v_remaining;
    IF NOT FOUND THEN RAISE EXCEPTION 'wallet_changed'; END IF;
    v_source:='wallet';
  ELSIF (s->>'freeRemainingToday')::numeric>=p_cost THEN
    UPDATE public.ai_daily_credit_wallets SET balance=balance-p_cost,updated_at=now()
      WHERE user_id=p_user_id AND grant_day=(s->>'dailyPeriod')::date AND balance>=p_cost
      RETURNING balance INTO v_remaining;
    IF NOT FOUND THEN RAISE EXCEPTION 'daily_wallet_changed'; END IF;
    v_source:='free';
  ELSE
    RETURN jsonb_build_object('ok',false,'error','quota_exceeded','source','free',
      'remaining',s->'freeRemainingToday','freeUsedToday',s->'freeUsedToday',
      'freeDaily',s->'freeDaily','resetAt',s->'dayResetAt','creditUnit','credits');
  END IF;
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
    VALUES(p_user_id,-p_cost,CASE WHEN v_source='wallet' THEN 'credit_chat' ELSE 'free_chat' END,
      jsonb_build_object('cost',p_cost,'source',v_source,'creditPolicy','daily_credits_v1','refundedCredits',0,
        'grantPeriod',s->>'grantPeriod','dailyPeriod',s->>'dailyPeriod')) RETURNING id INTO v_receipt;
  UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('receiptId',v_receipt) WHERE id=v_receipt;
  RETURN jsonb_build_object('ok',true,'source',v_source,'remaining',v_remaining,
    'cost',p_cost,'receiptId',v_receipt,'freeDaily',s->'freeDaily',
    'freeUsedToday',(s->>'freeUsedToday')::numeric+CASE WHEN v_source='free' THEN p_cost ELSE 0 END,
    'resetAt',s->'dayResetAt','creditUnit','credits');
END;
$$;

-- Legacy fixed-price/free-turn refund semantics remain private for receipts
-- that predate daily credits. Old monthly refunds cannot refill a new period.
-- Public RPC OIDs remain intact through CREATE OR REPLACE wrappers below.
CREATE FUNCTION public._refund_ai_credit_legacy(
  p_user_id uuid,p_refund_cost int,p_source text,p_receipt_id bigint
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.ai_credit_logs%ROWTYPE; refunded numeric; target numeric; delta numeric;
BEGIN
  IF p_user_id IS NULL OR p_receipt_id IS NULL OR p_refund_cost IS NULL OR p_refund_cost<1 OR p_source IS NULL OR p_source NOT IN ('wallet','free') THEN RETURN jsonb_build_object('ok',false,'error','invalid_params'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO r FROM public.ai_credit_logs WHERE id=p_receipt_id AND user_id=p_user_id AND reason IN('credit_chat','free_chat') AND amount<0 AND meta->>'billing' IS NULL AND meta->>'creditPolicy' IS DISTINCT FROM 'daily_credits_v1' FOR UPDATE;
  IF NOT FOUND OR r.reason <> (CASE WHEN p_source='wallet' THEN 'credit_chat' ELSE 'free_chat' END) THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
  refunded := COALESCE((SELECT SUM((meta->>'refundCost')::numeric) FROM public.ai_credit_logs WHERE user_id=p_user_id AND reason='refund' AND meta->>'receiptId'=p_receipt_id::text AND meta->>'billing' IS NULL),0);
  target := LEAST(p_refund_cost,abs(r.amount)); delta := GREATEST(target-refunded,0);
  IF delta<=0 THEN RETURN jsonb_build_object('ok',true,'refunded',0,'receiptId',p_receipt_id); END IF;
  IF p_source='wallet' THEN
    UPDATE public.ai_credit_wallets SET balance=balance+delta,updated_at=now()
      WHERE user_id=p_user_id AND grant_period=COALESCE(r.meta->>'grantPeriod',
        to_char(r.created_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM'));
  END IF;
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,delta,'refund',jsonb_build_object('source',p_source,'refundCost',delta,'receiptId',p_receipt_id));
  RETURN jsonb_build_object('ok',true,'refunded',delta,'receiptId',p_receipt_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_ai_credit_service(
  p_user_id uuid,p_refund_cost int,p_source text,p_receipt_id bigint
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.ai_credit_logs%ROWTYPE; v_refunded numeric(18,3); v_delta numeric(18,3);
  v_applied numeric(18,3):=0;
BEGIN
  IF p_user_id IS NULL OR p_receipt_id IS NULL OR p_refund_cost IS NULL OR p_refund_cost<1
    OR p_source IS NULL OR p_source NOT IN ('wallet','free') THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_params');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO r FROM public.ai_credit_logs WHERE id=p_receipt_id AND user_id=p_user_id
    AND reason IN ('credit_chat','free_chat') AND amount<0 AND meta->>'billing' IS NULL FOR UPDATE;
  IF NOT FOUND OR r.reason<>(CASE WHEN p_source='wallet' THEN 'credit_chat' ELSE 'free_chat' END) THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_receipt');
  END IF;
  IF r.meta->>'creditPolicy' IS DISTINCT FROM 'daily_credits_v1' THEN
    RETURN public._refund_ai_credit_legacy(p_user_id,p_refund_cost,p_source,p_receipt_id);
  END IF;
  v_refunded:=COALESCE((SELECT SUM((meta->>'refundCost')::numeric) FROM public.ai_credit_logs
    WHERE user_id=p_user_id AND reason='refund' AND meta->>'receiptId'=p_receipt_id::text
      AND meta->>'creditPolicy'='daily_credits_v1'),0);
  v_delta:=GREATEST(LEAST(p_refund_cost,abs(r.amount))-v_refunded,0);
  IF v_delta<=0 THEN RETURN jsonb_build_object('ok',true,'refunded',0,'receiptId',p_receipt_id); END IF;
  IF p_source='wallet' THEN
    UPDATE public.ai_credit_wallets SET balance=balance+v_delta,updated_at=now()
      WHERE user_id=p_user_id AND grant_period=r.meta->>'grantPeriod';
    IF FOUND THEN v_applied:=v_delta; END IF;
    -- A renewed wallet cannot receive a refund belonging to the old month.
  ELSE
    UPDATE public.ai_daily_credit_wallets SET balance=balance+v_delta,updated_at=now()
      WHERE user_id=p_user_id AND grant_day=(r.meta->>'dailyPeriod')::date;
    IF NOT FOUND THEN RAISE EXCEPTION 'daily_refund_wallet_missing'; END IF;
    v_applied:=v_delta;
  END IF;
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
    VALUES(p_user_id,v_delta,'refund',jsonb_build_object('source',p_source,'refundCost',v_delta,
      'receiptId',p_receipt_id,'creditPolicy','daily_credits_v1','grantPeriod',r.meta->>'grantPeriod',
      'dailyPeriod',r.meta->>'dailyPeriod','appliedCredits',v_applied));
  UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('refundedCredits',v_refunded+v_delta)
    WHERE id=p_receipt_id;
  RETURN jsonb_build_object('ok',true,'refunded',v_delta,'appliedCredits',v_applied,'receiptId',p_receipt_id);
END;
$$;

-- Old clients may recover an existing output-only hold, but cannot create a
-- new request at the old tariff or reset the shared wallet to its old grant.
CREATE OR REPLACE FUNCTION public.reserve_tutor_credit_service(
  p_user_id uuid,p_request_id uuid,p_max_output_tokens int DEFAULT 8192
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.ai_credit_logs%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_max_output_tokens IS NULL OR p_max_output_tokens<1 THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_params');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  PERFORM public._release_expired_tutor_holds(p_user_id);
  SELECT * INTO r FROM public.ai_credit_logs WHERE user_id=p_user_id
    AND meta->>'billing' IN ('tutor_output_tokens','tutor_total_tokens')
    AND meta->>'requestId'=p_request_id::text LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','billing_version_unsupported'); END IF;
  IF r.meta->>'billing'<>'tutor_output_tokens' THEN
    RETURN jsonb_build_object('ok',false,'error','billing_version_mismatch');
  END IF;
  IF r.meta->>'state' IS DISTINCT FROM 'reserved' THEN
    RETURN jsonb_build_object('ok',false,'error','reservation_finalized','receiptId',r.id,'state',r.meta->>'state');
  END IF;
  RETURN jsonb_build_object('ok',true,'source',CASE WHEN r.reason='credit_chat' THEN 'wallet' ELSE 'free' END,
    'receiptId',r.id,'maxOutputTokens',COALESCE((r.meta->>'maxOutputTokens')::int,0),
    'reservedCredits',abs(r.amount),'state','reserved');
END;
$$;

REVOKE ALL ON FUNCTION public._ensure_ai_credit_balances(uuid),
  public._refund_ai_credit_legacy(uuid,int,text,bigint),public.count_ai_free_chats_today(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.consume_ai_credit_service(uuid,int),
  public.refund_ai_credit_service(uuid,int,text,bigint),public.reserve_tutor_credit_service(uuid,uuid,int)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit_service(uuid,int),
  public.refund_ai_credit_service(uuid,int,text,bigint),public.reserve_tutor_credit_service(uuid,uuid,int)
  TO service_role;
REVOKE ALL ON FUNCTION public.get_ai_credit_status(boolean,int,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_ai_credit_status(boolean,int,int) TO authenticated;
NOTIFY pgrst, 'reload schema';
