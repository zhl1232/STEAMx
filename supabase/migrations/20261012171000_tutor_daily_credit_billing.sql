-- New tutor admissions use daily credits at the unchanged 100:1 tariff.
-- DRAFT: a daily-funded turn charges at most 100 credits. The platform sponsors
-- any remaining verified work within a separate, hard 30,000-token allowance.
-- The monthly wallet is used first; a turn uses one funding source, never both.
-- Already-issued total-usage receipts retain the previous five-turn policy.

CREATE OR REPLACE FUNCTION public.settle_tutor_usage_service(
  p_user_id uuid, p_receipt_id bigint, p_usage jsonb DEFAULT NULL, p_cancel boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.ai_credit_logs%ROWTYPE; funding public.ai_credit_logs%ROWTYPE;
  u public.tutor_usage_records%ROWTYPE;
  v_source text; v_state text; v_period text := public.ai_credit_month_period();
  v_reserved numeric(18,3); v_charge numeric(18,3); v_release numeric(18,3);
  v_expired boolean; v_input numeric; v_output numeric; v_total numeric;
  v_count numeric; v_key text; v_usage jsonb; v_public jsonb; v_day date;
  v_sponsored numeric(18,3):=0;
BEGIN
  IF p_user_id IS NULL OR p_receipt_id IS NULL OR p_cancel IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_params');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO r FROM public.ai_credit_logs
    WHERE id=p_receipt_id AND user_id=p_user_id
      AND meta->>'billing'='tutor_total_tokens' AND reason IN ('credit_chat','free_chat') AND amount<0
    FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
  IF r.meta->>'creditPolicy' IS DISTINCT FROM 'daily_credits_v1' THEN
    RETURN public._settle_tutor_total_usage_legacy(p_user_id,p_receipt_id,p_usage,p_cancel);
  END IF;
  SELECT * INTO u FROM public.tutor_usage_records
    WHERE receipt_id=r.id AND user_id=p_user_id AND request_id::text=r.meta->>'requestId' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
  funding := r;
  IF u.free_quota_receipt_id IS NOT NULL THEN
    SELECT * INTO funding FROM public.ai_credit_logs
      WHERE id=u.free_quota_receipt_id AND user_id=p_user_id AND reason='free_chat' AND amount<0
        AND meta->>'creditPolicy'='daily_credits_v1' AND meta->>'parentReceiptId'=r.id::text FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
  END IF;
  v_source := CASE WHEN funding.reason='free_chat' THEN 'free' ELSE 'wallet' END;
  v_state := r.meta->>'state';
  IF v_state IS DISTINCT FROM 'reserved' THEN
    RETURN jsonb_build_object('ok',true,'source',v_source,
      'chargedCredits',COALESCE((r.meta->>'chargedCredits')::numeric,0),'receiptId',r.id,'state',v_state);
  END IF;
  IF v_source='free' THEN
    v_day := (funding.meta->>'dailyPeriod')::date;
    IF v_day IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
    PERFORM 1 FROM public.ai_daily_credit_wallets
      WHERE user_id=p_user_id AND grant_day=v_day FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'daily_wallet_missing'; END IF;
  END IF;
  -- Crossing midnight keeps the original daily hold. The existing month and
  -- twenty-minute request boundaries remain in force for every funding source.
  v_expired := (r.meta->>'expiresAt')::timestamptz<=now()
    OR r.meta->>'grantPeriod' IS DISTINCT FROM v_period;
  v_usage := COALESCE(p_usage, jsonb_build_object('inputTokens',0,'outputTokens',0,'totalTokens',0,
    'calls','[]'::jsonb,'usageMissing',true,'budgetExceeded',false,'budgetDeniedCalls',0,'pendingCalls',0));
  IF jsonb_typeof(v_usage) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_usage->'calls') IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_usage->'usageMissing') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(v_usage->'budgetExceeded') IS DISTINCT FROM 'boolean' THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_usage');
  END IF;
  FOREACH v_key IN ARRAY ARRAY['inputTokens','outputTokens','totalTokens','budgetDeniedCalls','pendingCalls'] LOOP
    IF v_key IN ('inputTokens','outputTokens') AND jsonb_typeof(v_usage->v_key)='null' THEN CONTINUE; END IF;
    IF jsonb_typeof(v_usage->v_key) IS DISTINCT FROM 'number' THEN
      RETURN jsonb_build_object('ok',false,'error','invalid_usage');
    END IF;
    v_count := (v_usage->>v_key)::numeric;
    IF v_count<0 OR v_count>9007199254740991 OR v_count<>trunc(v_count) THEN
      RETURN jsonb_build_object('ok',false,'error','invalid_usage');
    END IF;
  END LOOP;
  v_input := (v_usage->>'inputTokens')::numeric;
  v_output := (v_usage->>'outputTokens')::numeric;
  v_total := (v_usage->>'totalTokens')::numeric;
  IF (v_input IS NOT NULL AND v_input>v_total) OR (v_output IS NOT NULL AND v_output>v_total)
    OR (v_input IS NOT NULL AND v_output IS NOT NULL AND v_input+v_output<>v_total)
    OR (NOT p_cancel AND NOT v_expired AND (v_usage->>'pendingCalls')::numeric<>0) THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_usage');
  END IF;
  v_reserved := abs(funding.amount);
  IF p_cancel OR v_expired THEN v_charge:=0;
  ELSE
    v_charge:=LEAST(v_reserved,LEAST(v_total,u.max_total_tokens)::numeric/100,
      CASE WHEN v_source='free' THEN 100 ELSE v_reserved END);
    IF v_source='free' THEN
      v_sponsored:=GREATEST(LEAST(v_total,u.max_total_tokens)::numeric/100-v_charge,0);
    END IF;
  END IF;
  v_release := GREATEST(v_reserved-v_charge,0);
  IF v_source='wallet' AND v_release>0 AND r.meta->>'grantPeriod'=v_period THEN
    UPDATE public.ai_credit_wallets SET balance=balance+v_release,updated_at=now()
      WHERE user_id=p_user_id AND grant_period=r.meta->>'grantPeriod';
    IF FOUND THEN
      INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
        VALUES(p_user_id,v_release,'refund',jsonb_build_object('source','wallet','refundCost',v_release,
          'receiptId',funding.id,'billing','tutor_total_tokens','creditPolicy','daily_credits_v1',
          'grantPeriod',r.meta->>'grantPeriod',
          'release',CASE WHEN v_expired THEN 'expired' WHEN p_cancel THEN 'cancel' ELSE 'settle' END));
    END IF;
  ELSIF v_source='free' AND v_release>0 THEN
    -- Never credit today's row when this request was funded on an earlier day.
    UPDATE public.ai_daily_credit_wallets SET balance=balance+v_release,updated_at=now()
      WHERE user_id=p_user_id AND grant_day=v_day;
    INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
      VALUES(p_user_id,v_release,'refund',jsonb_build_object('source','free','refundCost',v_release,
        'receiptId',funding.id,'billing','tutor_total_tokens','creditPolicy','daily_credits_v1',
        'dailyPeriod',v_day::text,
        'release',CASE WHEN v_expired THEN 'expired' WHEN p_cancel THEN 'cancel' ELSE 'settle' END));
  END IF;
  v_state := CASE WHEN v_expired THEN 'expired' WHEN p_cancel THEN 'canceled' ELSE 'settled' END;
  -- Sponsorship is private accounting, separate from a provider exceeding the
  -- hard execution allowance. Public receipts still show only charged credits.
  UPDATE public.tutor_usage_records SET usage=v_usage||jsonb_build_object('sponsoredCredits',v_sponsored),actual_total_tokens=v_total::bigint,
    budget_overrun_tokens=GREATEST(v_total-u.max_total_tokens,0)::bigint,settled_at=clock_timestamp()
    WHERE receipt_id=r.id;
  UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('state',v_state,'chargedCredits',v_charge)
    WHERE id=r.id;
  IF u.free_quota_receipt_id IS NOT NULL THEN
    UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('state',
      CASE WHEN v_state='settled' THEN 'quota_consumed' ELSE 'quota_canceled' END)
      WHERE id=u.free_quota_receipt_id AND user_id=p_user_id;
  END IF;
  v_public := jsonb_build_object('source',v_source,'chargedCredits',v_charge,'receiptId',r.id);
  UPDATE public.tutor_messages SET meta=jsonb_set(meta,'{billing}',v_public,true)
    WHERE user_id=p_user_id AND role='assistant' AND meta->'ai'->>'creditReceiptId'=r.id::text;
  RETURN v_public||jsonb_build_object('ok',true,'state',v_state);
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_tutor_usage_service(
  p_user_id uuid,p_request_id uuid,p_max_output_tokens int DEFAULT 8192,p_max_total_tokens int DEFAULT 131072
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.ai_credit_logs%ROWTYPE; funding public.ai_credit_logs%ROWTYPE;
  u public.tutor_usage_records%ROWTYPE; d public.ai_daily_credit_wallets%ROWTYPE;
  v_period text:=public.ai_credit_month_period(); v_status jsonb; v_output int; v_total int;
  v_reserved numeric(18,3); v_balance numeric(18,3); v_receipt bigint; v_source text;
  v_expires timestamptz; v_day date; v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_max_output_tokens IS NULL OR p_max_output_tokens<1
    OR p_max_total_tokens IS NULL OR p_max_total_tokens<1 THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_params');
  END IF;
  v_output:=LEAST(p_max_output_tokens,8192); v_total:=LEAST(p_max_total_tokens,131072);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  PERFORM public._release_expired_tutor_holds(p_user_id);
  SELECT * INTO r FROM public.ai_credit_logs WHERE user_id=p_user_id
    AND meta->>'billing' IN ('tutor_output_tokens','tutor_total_tokens')
    AND meta->>'requestId'=p_request_id::text LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF r.meta->>'billing'<>'tutor_total_tokens' THEN
      RETURN jsonb_build_object('ok',false,'error','billing_version_mismatch');
    END IF;
    IF r.meta->>'state' IS DISTINCT FROM 'reserved' THEN
      RETURN jsonb_build_object('ok',false,'error','reservation_finalized','receiptId',r.id,'state',r.meta->>'state');
    END IF;
    SELECT * INTO u FROM public.tutor_usage_records WHERE receipt_id=r.id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
    funding:=r;
    IF u.free_quota_receipt_id IS NOT NULL THEN
      SELECT * INTO funding FROM public.ai_credit_logs WHERE id=u.free_quota_receipt_id AND user_id=p_user_id FOR UPDATE;
      IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
    END IF;
    v_result:=jsonb_build_object('ok',true,'source',CASE WHEN funding.reason='free_chat' THEN 'free' ELSE 'wallet' END,
      'receiptId',r.id,'maxOutputTokens',u.max_output_tokens,'maxTotalTokens',u.max_total_tokens,
      'reservedCredits',abs(funding.amount),'state','reserved','grantPeriod',r.meta->>'grantPeriod',
      'dailyPeriod',funding.meta->>'dailyPeriod','expiresAt',r.meta->>'expiresAt');
    IF r.meta->>'creditPolicy'='daily_credits_v1' THEN
      v_result:=v_result||jsonb_build_object('creditUnit','credits','creditPolicy','daily_credits_v1');
      IF funding.reason='free_chat' AND funding.meta->>'dailyChargeCap'='100' THEN
        v_result:=v_result||jsonb_build_object('dailyChargeCap',100);
      END IF;
    END IF;
    RETURN v_result;
  END IF;
  v_status:=public._ensure_ai_credit_balances(p_user_id);
  IF v_status ? 'error' THEN RETURN v_status||jsonb_build_object('ok',false); END IF;
  v_day:=(v_status->>'dailyPeriod')::date;
  v_balance:=(v_status->>'walletBalance')::numeric;
  IF (v_status->>'isMember')::boolean AND v_balance>=0.01 THEN
    v_reserved:=LEAST(v_balance,v_total::numeric/100);
    v_total:=FLOOR(v_reserved*100)::int;
    UPDATE public.ai_credit_wallets SET balance=balance-v_reserved,updated_at=now()
      WHERE user_id=p_user_id AND grant_period=v_period;
    IF NOT FOUND THEN RAISE EXCEPTION 'wallet_unavailable'; END IF;
    v_source:='wallet';
  ELSE
    SELECT * INTO d FROM public.ai_daily_credit_wallets
      WHERE user_id=p_user_id AND grant_day=v_day FOR UPDATE;
    IF NOT FOUND OR d.balance<0.01 THEN
      RETURN jsonb_build_object('ok',false,'error','quota_exceeded','source','free','creditUnit','credits',
        'freeRemainingToday',COALESCE(d.balance,0),'resetAt',(v_status->>'dayResetAt')::bigint);
    END IF;
    v_total:=LEAST(v_total,30000);
    v_reserved:=LEAST(d.balance,100);
    UPDATE public.ai_daily_credit_wallets SET balance=balance-v_reserved,updated_at=now()
      WHERE user_id=p_user_id AND grant_day=v_day;
    v_source:='free';
  END IF;
  v_expires:=now()+interval '20 minutes';
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
    VALUES(p_user_id,-v_reserved,CASE WHEN v_source='wallet' THEN 'credit_chat' ELSE 'free_chat' END,
      jsonb_build_object('billing','tutor_total_tokens','creditPolicy','daily_credits_v1','state','reserved',
        'source',v_source,'requestId',p_request_id,'reservedCredits',v_reserved,
        'grantPeriod',v_period,'dailyPeriod',v_day::text,'expiresAt',v_expires)
        ||CASE WHEN v_source='free' THEN jsonb_build_object('dailyChargeCap',100) ELSE '{}'::jsonb END) RETURNING id INTO v_receipt;
  INSERT INTO public.tutor_usage_records(receipt_id,user_id,request_id,max_output_tokens,max_total_tokens)
    VALUES(v_receipt,p_user_id,p_request_id,v_output,v_total);
  RETURN jsonb_build_object('ok',true,'source',v_source,'receiptId',v_receipt,'creditUnit','credits','creditPolicy','daily_credits_v1',
    'maxOutputTokens',v_output,'maxTotalTokens',v_total,'reservedCredits',v_reserved,
    'grantPeriod',v_period,'dailyPeriod',v_day::text,'expiresAt',v_expires)
    ||CASE WHEN v_source='free' THEN jsonb_build_object('dailyChargeCap',100) ELSE '{}'::jsonb END;
END;
$$;

CREATE OR REPLACE FUNCTION public.fallback_tutor_usage_to_free_service(
  p_user_id uuid,p_request_id uuid,p_receipt_id bigint,p_executor_id uuid,p_min_total_tokens int
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  q public.tutor_chat_requests%ROWTYPE; r public.ai_credit_logs%ROWTYPE;
  u public.tutor_usage_records%ROWTYPE; d public.ai_daily_credit_wallets%ROWTYPE;
  funding public.ai_credit_logs%ROWTYPE;
  v_child bigint; v_period text:=public.ai_credit_month_period(); v_status jsonb;
  v_day date; v_reserved numeric(18,3); v_total int; v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_receipt_id IS NULL OR p_executor_id IS NULL
    OR p_min_total_tokens IS NULL OR p_min_total_tokens<1 OR p_min_total_tokens>131072 THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_params');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO q FROM public.tutor_chat_requests WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND OR q.state<>'processing' OR q.executor_id<>p_executor_id OR q.receipt_id<>p_receipt_id
    OR q.max_total_tokens IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_request'); END IF;
  PERFORM public._release_expired_tutor_holds(p_user_id);
  SELECT * INTO r FROM public.ai_credit_logs WHERE id=p_receipt_id AND user_id=p_user_id
    AND reason='credit_chat' AND meta->>'billing'='tutor_total_tokens' FOR UPDATE;
  IF NOT FOUND OR r.meta->>'state'<>'reserved' OR q.created_at<=clock_timestamp()-interval '20 minutes'
    OR r.meta->>'grantPeriod' IS DISTINCT FROM v_period THEN
    RETURN jsonb_build_object('ok',false,'error','reservation_unavailable');
  END IF;
  IF r.meta->>'creditPolicy' IS DISTINCT FROM 'daily_credits_v1' THEN
    -- This compatibility path is reachable only for an existing pre-policy
    -- hold. No newly admitted request can create an unmarked receipt.
    v_result:=public._fallback_tutor_total_usage_legacy(p_user_id,p_request_id,p_receipt_id,p_executor_id,p_min_total_tokens);
    IF (v_result->>'ok')::boolean IS TRUE THEN
      SELECT * INTO u FROM public.tutor_usage_records WHERE receipt_id=r.id;
      v_result:=v_result||jsonb_build_object('reservedCredits',1,'maxOutputTokens',u.max_output_tokens);
    END IF;
    RETURN v_result;
  END IF;
  SELECT * INTO u FROM public.tutor_usage_records WHERE receipt_id=r.id AND user_id=p_user_id
    AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
  IF p_min_total_tokens>30000 THEN
    RETURN jsonb_build_object('ok',false,'error','quota_exceeded');
  END IF;
  IF u.free_quota_receipt_id IS NOT NULL THEN
    SELECT * INTO funding FROM public.ai_credit_logs WHERE id=u.free_quota_receipt_id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND OR funding.meta->>'creditPolicy' IS DISTINCT FROM 'daily_credits_v1'
      OR funding.meta->>'parentReceiptId' IS DISTINCT FROM r.id::text THEN
      RETURN jsonb_build_object('ok',false,'error','invalid_receipt');
    END IF;
    IF u.max_total_tokens<p_min_total_tokens THEN
      RETURN jsonb_build_object('ok',false,'error','quota_exceeded');
    END IF;
    RETURN jsonb_build_object('ok',true,'source','free','receiptId',r.id,'creditUnit','credits',
      'creditPolicy','daily_credits_v1','dailyChargeCap',100,
      'maxTotalTokens',u.max_total_tokens,'maxOutputTokens',u.max_output_tokens,'reservedCredits',abs(funding.amount));
  END IF;
  IF u.max_total_tokens>=131072 OR p_min_total_tokens<=u.max_total_tokens THEN
    RETURN jsonb_build_object('ok',false,'error','budget_not_increased');
  END IF;
  v_status:=public._ensure_ai_credit_balances(p_user_id);
  IF v_status ? 'error' THEN RETURN v_status||jsonb_build_object('ok',false); END IF;
  v_day:=(v_status->>'dailyPeriod')::date;
  SELECT * INTO d FROM public.ai_daily_credit_wallets
    WHERE user_id=p_user_id AND grant_day=v_day FOR UPDATE;
  v_reserved:=LEAST(COALESCE(d.balance,0),100);
  v_total:=30000;
  IF NOT FOUND OR v_reserved<0.01 THEN
    RETURN jsonb_build_object('ok',false,'error','quota_exceeded','creditUnit','credits',
      'freeRemainingToday',COALESCE(d.balance,0),'resetAt',(v_status->>'dayResetAt')::bigint);
  END IF;
  -- The daily wallet contributes at most 100 credits. The platform sponsors
  -- the remaining work within 30,000 tokens; wallet and daily debits never add.
  -- Already-used and in-flight collector usage remains under the same receipt.
  UPDATE public.ai_credit_wallets SET balance=balance+abs(r.amount),updated_at=now()
    WHERE user_id=p_user_id AND grant_period=v_period;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','wallet_unavailable'); END IF;
  UPDATE public.ai_daily_credit_wallets SET balance=balance-v_reserved,updated_at=now()
    WHERE user_id=p_user_id AND grant_day=v_day;
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
    VALUES(p_user_id,abs(r.amount),'refund',jsonb_build_object('source','wallet','refundCost',abs(r.amount),
      'receiptId',r.id,'billing','tutor_total_tokens','creditPolicy','daily_credits_v1',
      'grantPeriod',v_period,'release','free_fallback'));
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
    VALUES(p_user_id,-v_reserved,'free_chat',jsonb_build_object('billing','tutor_total_tokens',
      'creditPolicy','daily_credits_v1','dailyChargeCap',100,'state','quota_reserved','source','free','parentReceiptId',r.id,
      'reservedCredits',v_reserved,'grantPeriod',v_period,'dailyPeriod',v_day::text,
      'expiresAt',r.meta->>'expiresAt')) RETURNING id INTO v_child;
  UPDATE public.tutor_usage_records SET free_quota_receipt_id=v_child,max_total_tokens=v_total WHERE receipt_id=r.id;
  UPDATE public.tutor_chat_requests SET max_total_tokens=v_total WHERE user_id=p_user_id AND request_id=p_request_id;
  UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('source','free','dailyChargeCap',100,'dailyPeriod',v_day::text) WHERE id=r.id;
  RETURN jsonb_build_object('ok',true,'source','free','receiptId',r.id,'creditUnit','credits',
    'creditPolicy','daily_credits_v1','dailyChargeCap',100,
    'maxTotalTokens',v_total,'maxOutputTokens',u.max_output_tokens,'reservedCredits',v_reserved);
END;
$$;

-- The copied compatibility implementations and begin replay below retain all
-- original public RPC OIDs. Private helpers are not directly executable.

CREATE FUNCTION public._settle_tutor_total_usage_legacy(
  p_user_id uuid, p_receipt_id bigint, p_usage jsonb DEFAULT NULL, p_cancel boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.ai_credit_logs%ROWTYPE;
  u public.tutor_usage_records%ROWTYPE;
  v_source text; v_state text; v_period text := public.ai_credit_month_period(); v_free_receipt bigint;
  v_reserved numeric(18,3); v_charge numeric(18,3); v_release numeric(18,3);
  v_expired boolean; v_input numeric; v_output numeric; v_total numeric;
  v_count numeric; v_key text; v_usage jsonb; v_public jsonb;
BEGIN
  IF p_user_id IS NULL OR p_receipt_id IS NULL OR p_cancel IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_params');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO r FROM public.ai_credit_logs
    WHERE id=p_receipt_id AND user_id=p_user_id
      AND meta->>'billing'='tutor_total_tokens' AND reason IN ('credit_chat','free_chat') AND amount<0
    FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
  SELECT * INTO u FROM public.tutor_usage_records
    WHERE receipt_id=r.id AND user_id=p_user_id AND request_id::text=r.meta->>'requestId' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
  v_source := CASE WHEN r.reason='free_chat' OR u.free_quota_receipt_id IS NOT NULL THEN 'free' ELSE 'wallet' END;
  v_free_receipt := COALESCE(u.free_quota_receipt_id,r.id);
  v_state := r.meta->>'state';
  IF v_state IS DISTINCT FROM 'reserved' THEN
    RETURN jsonb_build_object('ok',true,'source',v_source,
      'chargedCredits',COALESCE((r.meta->>'chargedCredits')::numeric,0),'receiptId',r.id,'state',v_state);
  END IF;

  v_expired := (r.meta->>'expiresAt')::timestamptz<=now()
    OR r.meta->>'grantPeriod' IS DISTINCT FROM v_period;
  -- NULL is an explicitly unknown snapshot. Known calls remain chargeable even
  -- when other calls were missing usage. Estimates never enter this snapshot.
  v_usage := COALESCE(p_usage, jsonb_build_object('inputTokens',0,'outputTokens',0,'totalTokens',0,
    'calls','[]'::jsonb,'usageMissing',true,'budgetExceeded',false,'budgetDeniedCalls',0,'pendingCalls',0));
  IF jsonb_typeof(v_usage) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_usage->'calls') IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_usage->'usageMissing') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(v_usage->'budgetExceeded') IS DISTINCT FROM 'boolean' THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_usage');
  END IF;
  FOREACH v_key IN ARRAY ARRAY['inputTokens','outputTokens','totalTokens','budgetDeniedCalls','pendingCalls'] LOOP
    IF v_key IN ('inputTokens','outputTokens') AND jsonb_typeof(v_usage->v_key)='null' THEN CONTINUE; END IF;
    IF jsonb_typeof(v_usage->v_key) IS DISTINCT FROM 'number' THEN
      RETURN jsonb_build_object('ok',false,'error','invalid_usage');
    END IF;
    v_count := (v_usage->>v_key)::numeric;
    IF v_count<0 OR v_count>9007199254740991 OR v_count<>trunc(v_count) THEN
      RETURN jsonb_build_object('ok',false,'error','invalid_usage');
    END IF;
  END LOOP;
  v_input := (v_usage->>'inputTokens')::numeric;
  v_output := (v_usage->>'outputTokens')::numeric;
  v_total := (v_usage->>'totalTokens')::numeric;
  IF (v_input IS NOT NULL AND v_input>v_total) OR (v_output IS NOT NULL AND v_output>v_total)
    OR (v_input IS NOT NULL AND v_output IS NOT NULL AND v_input+v_output<>v_total)
    OR (NOT p_cancel AND NOT v_expired AND (v_usage->>'pendingCalls')::numeric<>0) THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_usage');
  END IF;

  v_reserved := abs(r.amount);
  IF p_cancel OR v_expired OR v_source='free' THEN v_charge:=0;
  ELSE v_charge:=LEAST(v_reserved,LEAST(v_total,u.max_total_tokens)::numeric/100); END IF;
  v_release := GREATEST(v_reserved-v_charge,0);
  IF v_source='wallet' AND v_release>0 AND r.meta->>'grantPeriod'=v_period THEN
    -- A wallet already renewed into another grant period must never receive
    -- refunds from a previous period, even if settlement runs late.
    UPDATE public.ai_credit_wallets SET balance=balance+v_release,updated_at=now()
      WHERE user_id=p_user_id AND grant_period=r.meta->>'grantPeriod';
    IF FOUND THEN
      INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
        VALUES(p_user_id,v_release,'refund',jsonb_build_object('source','wallet','refundCost',v_release,
          'receiptId',r.id,'billing','tutor_total_tokens','release',CASE WHEN v_expired THEN 'expired' ELSE 'settle' END));
    END IF;
  ELSIF v_source='free' AND (p_cancel OR v_expired) THEN
    INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
      VALUES(p_user_id,1,'refund',jsonb_build_object('source','free','refundCost',1,
        'receiptId',v_free_receipt,'billing','tutor_total_tokens','release',CASE WHEN v_expired THEN 'expired' ELSE 'cancel' END));
  END IF;
  v_state := CASE WHEN v_expired THEN 'expired' WHEN p_cancel THEN 'canceled' ELSE 'settled' END;
  UPDATE public.tutor_usage_records SET usage=v_usage,actual_total_tokens=v_total::bigint,
    budget_overrun_tokens=GREATEST(v_total-u.max_total_tokens,0)::bigint,settled_at=clock_timestamp()
    WHERE receipt_id=r.id;
  UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('state',v_state,'chargedCredits',v_charge)
    WHERE id=r.id;
  IF u.free_quota_receipt_id IS NOT NULL THEN
    UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('state',
      CASE WHEN v_state='settled' THEN 'quota_consumed' ELSE 'quota_canceled' END)
      WHERE id=u.free_quota_receipt_id AND user_id=p_user_id;
  END IF;
  v_public := jsonb_build_object('source',v_source,'chargedCredits',v_charge,'receiptId',r.id);
  UPDATE public.tutor_messages SET meta=jsonb_set(meta,'{billing}',v_public,true)
    WHERE user_id=p_user_id AND role='assistant' AND meta->'ai'->>'creditReceiptId'=r.id::text;
  RETURN v_public||jsonb_build_object('ok',true,'state',v_state);
END;
$$;

CREATE FUNCTION public._fallback_tutor_total_usage_legacy(
  p_user_id uuid,p_request_id uuid,p_receipt_id bigint,p_executor_id uuid,p_min_total_tokens int
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  q public.tutor_chat_requests%ROWTYPE; r public.ai_credit_logs%ROWTYPE;
  u public.tutor_usage_records%ROWTYPE; v_used int; v_child bigint;
  v_period text:=public.ai_credit_month_period();
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_receipt_id IS NULL OR p_executor_id IS NULL
    OR p_min_total_tokens IS NULL OR p_min_total_tokens<1 OR p_min_total_tokens>131072 THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_params');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO q FROM public.tutor_chat_requests WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND OR q.state<>'processing' OR q.executor_id<>p_executor_id OR q.receipt_id<>p_receipt_id
    OR q.max_total_tokens IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_request'); END IF;
  PERFORM public._release_expired_tutor_holds(p_user_id);
  SELECT * INTO r FROM public.ai_credit_logs WHERE id=p_receipt_id AND user_id=p_user_id
    AND reason='credit_chat' AND meta->>'billing'='tutor_total_tokens' FOR UPDATE;
  IF NOT FOUND OR r.meta->>'state'<>'reserved' OR q.created_at<=clock_timestamp()-interval '20 minutes'
    OR r.meta->>'grantPeriod' IS DISTINCT FROM v_period THEN
    RETURN jsonb_build_object('ok',false,'error','reservation_unavailable');
  END IF;
  SELECT * INTO u FROM public.tutor_usage_records WHERE receipt_id=r.id AND user_id=p_user_id
    AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
  IF u.free_quota_receipt_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'source','free','receiptId',r.id,'maxTotalTokens',u.max_total_tokens);
  END IF;
  IF u.max_total_tokens>=131072 OR p_min_total_tokens<=u.max_total_tokens THEN
    RETURN jsonb_build_object('ok',false,'error','budget_not_increased');
  END IF;
  v_used:=public.count_ai_free_chats_today(p_user_id);
  IF v_used>=5 THEN RETURN jsonb_build_object('ok',false,'error','quota_exceeded'); END IF;
  PERFORM 1 FROM public.ai_credit_wallets WHERE user_id=p_user_id AND grant_period=v_period FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','wallet_unavailable'); END IF;
  UPDATE public.ai_credit_wallets SET balance=balance+abs(r.amount),updated_at=now() WHERE user_id=p_user_id;
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
    VALUES(p_user_id,abs(r.amount),'refund',jsonb_build_object('source','wallet','refundCost',abs(r.amount),
      'receiptId',r.id,'billing','tutor_total_tokens','release','free_fallback'));
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
    VALUES(p_user_id,-1,'free_chat',jsonb_build_object('billing','tutor_total_tokens','state','quota_reserved',
      'source','free','parentReceiptId',r.id,'grantPeriod',v_period,'expiresAt',r.meta->>'expiresAt'))
    RETURNING id INTO v_child;
  UPDATE public.tutor_usage_records SET free_quota_receipt_id=v_child,max_total_tokens=131072 WHERE receipt_id=r.id;
  UPDATE public.tutor_chat_requests SET max_total_tokens=131072 WHERE user_id=p_user_id AND request_id=p_request_id;
  UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('source','free') WHERE id=r.id;
  RETURN jsonb_build_object('ok',true,'source','free','receiptId',r.id,'maxTotalTokens',131072);
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_tutor_usage_request_service(
  p_user_id uuid,p_request_id uuid,p_request_hash text,p_context_type text,p_context_id text,
  p_epoch bigint,p_max_output_tokens int,p_executor_id uuid,p_max_total_tokens int
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.tutor_chat_requests%ROWTYPE; c public.tutor_conversations%ROWTYPE;
DECLARE v_epoch bigint; credit jsonb; expired record;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_executor_id IS NULL OR p_epoch IS NULL OR p_epoch<0
    OR p_request_hash IS NULL OR p_request_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_params'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  PERFORM public._release_expired_tutor_holds(p_user_id);
  FOR expired IN SELECT q.* FROM public.tutor_chat_requests q JOIN public.ai_credit_logs l ON l.id=q.receipt_id
    WHERE q.user_id=p_user_id AND q.state='processing'
      AND (q.created_at<=clock_timestamp()-interval '20 minutes' OR l.meta->>'state'<>'reserved') FOR UPDATE OF q LOOP
    credit:=public.settle_tutor_credit_service(p_user_id,expired.receipt_id,NULL,true);
    IF (credit->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'release_failed'; END IF;
    UPDATE public.tutor_chat_requests SET state='failed',finished_at=clock_timestamp()
      WHERE user_id=p_user_id AND request_id=expired.request_id;
  END LOOP;
  SELECT * INTO r FROM public.tutor_chat_requests WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF r.request_hash<>p_request_hash THEN RETURN jsonb_build_object('status','conflict'); END IF;
    IF r.state='processing' AND r.executor_id=p_executor_id AND r.max_total_tokens IS NOT NULL THEN
      SELECT * INTO c FROM public.tutor_conversations WHERE id=r.conversation_id AND user_id=p_user_id;
      IF FOUND THEN
        credit:=public.reserve_tutor_usage_service(p_user_id,p_request_id,r.max_output_tokens,r.max_total_tokens);
        IF (credit->>'ok')::boolean IS DISTINCT FROM true THEN
          RETURN credit||jsonb_build_object('status','rejected');
        END IF;
        RETURN credit||jsonb_build_object('status','started','conversation',to_jsonb(c));
      END IF;
    END IF;
    RETURN public._tutor_request_result(r);
  END IF;
  INSERT INTO public.tutor_chat_scopes(user_id,context_type,context_id)
    VALUES(p_user_id,p_context_type,p_context_id) ON CONFLICT DO NOTHING;
  SELECT epoch INTO v_epoch FROM public.tutor_chat_scopes
    WHERE user_id=p_user_id AND context_type=p_context_type AND context_id=p_context_id;
  IF v_epoch<>p_epoch THEN RETURN jsonb_build_object('status','stale_topic','epoch',v_epoch); END IF;
  IF EXISTS (SELECT 1 FROM public.tutor_chat_requests WHERE user_id=p_user_id AND context_type=p_context_type
    AND context_id=p_context_id AND epoch=p_epoch AND state='processing') THEN
    RETURN jsonb_build_object('status','busy');
  END IF;
  credit:=public.reserve_tutor_usage_service(p_user_id,p_request_id,p_max_output_tokens,p_max_total_tokens);
  IF (credit->>'ok')::boolean IS DISTINCT FROM true THEN RETURN credit||jsonb_build_object('status','rejected'); END IF;
  SELECT * INTO c FROM public.tutor_conversations WHERE user_id=p_user_id
    AND context_type=p_context_type AND context_id=p_context_id AND status='active';
  IF NOT FOUND THEN INSERT INTO public.tutor_conversations(user_id,context_type,context_id)
    VALUES(p_user_id,p_context_type,p_context_id) RETURNING * INTO c; END IF;
  INSERT INTO public.tutor_chat_requests(user_id,request_id,request_hash,executor_id,context_type,context_id,epoch,
    conversation_id,receipt_id,max_output_tokens,max_total_tokens)
    VALUES(p_user_id,p_request_id,p_request_hash,p_executor_id,p_context_type,p_context_id,p_epoch,c.id,
      (credit->>'receiptId')::bigint,(credit->>'maxOutputTokens')::int,(credit->>'maxTotalTokens')::int);
  RETURN credit||jsonb_build_object('status','started','conversation',to_jsonb(c));
END;
$$;

REVOKE ALL ON FUNCTION public._settle_tutor_total_usage_legacy(uuid,bigint,jsonb,boolean),
  public._fallback_tutor_total_usage_legacy(uuid,uuid,bigint,uuid,int)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.reserve_tutor_usage_service(uuid,uuid,int,int),
  public.settle_tutor_usage_service(uuid,bigint,jsonb,boolean),
  public.fallback_tutor_usage_to_free_service(uuid,uuid,bigint,uuid,int),
  public.begin_tutor_usage_request_service(uuid,uuid,text,text,text,bigint,int,uuid,int)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tutor_usage_service(uuid,uuid,int,int),
  public.settle_tutor_usage_service(uuid,bigint,jsonb,boolean),
  public.fallback_tutor_usage_to_free_service(uuid,uuid,bigint,uuid,int),
  public.begin_tutor_usage_request_service(uuid,uuid,text,text,text,bigint,int,uuid,int)
  TO service_role;
