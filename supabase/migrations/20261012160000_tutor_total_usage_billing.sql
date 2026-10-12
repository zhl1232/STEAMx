-- Tutor v2: verified usage from every call in one successful request is billed
-- at 100 tokens per credit. Existing output-only receipts keep their tariff.
-- Apply this migration before deploying callers of the new service RPCs.

CREATE TABLE public.tutor_usage_records (
  receipt_id bigint PRIMARY KEY REFERENCES public.ai_credit_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  max_output_tokens int NOT NULL CHECK (max_output_tokens BETWEEN 1 AND 8192),
  max_total_tokens int NOT NULL CHECK (max_total_tokens BETWEEN 1 AND 131072),
  free_quota_receipt_id bigint UNIQUE REFERENCES public.ai_credit_logs(id),
  usage jsonb,
  actual_total_tokens bigint CHECK (actual_total_tokens BETWEEN 0 AND 9007199254740991),
  budget_overrun_tokens bigint NOT NULL DEFAULT 0 CHECK (budget_overrun_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  settled_at timestamptz,
  UNIQUE (user_id, request_id)
);
ALTER TABLE public.tutor_usage_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tutor_usage_records FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tutor_usage_records TO service_role;
CREATE POLICY tutor_usage_records_service_role ON public.tutor_usage_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);
COMMENT ON TABLE public.tutor_usage_records IS
  'Service-only tutor call usage and execution budgets; never returned as customer billing metadata.';

ALTER TABLE public.tutor_chat_requests ADD COLUMN max_total_tokens int
  CHECK (max_total_tokens BETWEEN 1 AND 131072);
COMMENT ON COLUMN public.tutor_chat_requests.max_total_tokens IS
  'NULL denotes a legacy output-only request; v2 stores its reserved total-usage budget.';

-- A request cannot acquire both a legacy receipt and a total-usage receipt.
CREATE UNIQUE INDEX idx_ai_credit_tutor_request_all ON public.ai_credit_logs
  (user_id, (meta->>'requestId'))
  WHERE meta->>'billing' IN ('tutor_output_tokens', 'tutor_total_tokens');
CREATE INDEX idx_ai_credit_tutor_total_reserved ON public.ai_credit_logs(user_id, created_at)
  WHERE meta->>'billing'='tutor_total_tokens' AND meta->>'state'='reserved';

CREATE FUNCTION public.settle_tutor_usage_service(
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

-- Legacy helper bodies are copied below. CREATE OR REPLACE preserves the public
-- RPC OIDs, so already-cached legacy callers also reach the compatibility guards.
CREATE FUNCTION public._settle_tutor_output_credit_legacy(p_user_id uuid,p_receipt_id bigint,p_output_tokens int DEFAULT NULL,p_cancel boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.ai_credit_logs%ROWTYPE; state text; source text; reserved numeric; max_tokens int; charge numeric; release numeric; missing boolean;
BEGIN
  IF p_user_id IS NULL OR p_receipt_id IS NULL OR p_cancel IS NULL OR (p_output_tokens IS NOT NULL AND p_output_tokens<0) THEN RETURN jsonb_build_object('ok',false,'error','invalid_params'); END IF;
  IF p_output_tokens IS NOT NULL AND p_output_tokens<>floor(p_output_tokens) THEN RETURN jsonb_build_object('ok',false,'error','invalid_params'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO r FROM public.ai_credit_logs WHERE id=p_receipt_id AND user_id=p_user_id AND meta->>'billing'='tutor_output_tokens' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
  state:=r.meta->>'state'; source:=CASE WHEN r.reason='credit_chat' THEN 'wallet' ELSE 'free' END; reserved:=abs(r.amount); max_tokens:=COALESCE((r.meta->>'maxOutputTokens')::int,0);
  IF state IS DISTINCT FROM 'reserved' THEN
    UPDATE public.tutor_messages SET meta=jsonb_set(meta,'{billing}',jsonb_build_object(
      'source',source,'chargedCredits',COALESCE((r.meta->>'chargedCredits')::numeric,0),
      'outputTokens',CASE WHEN r.meta->>'outputTokens' IS NULL THEN NULL ELSE (r.meta->>'outputTokens')::int END,
      'usageMissing',COALESCE((r.meta->>'usageMissing')::boolean,false),'receiptId',r.id),true)
    WHERE user_id=p_user_id AND role='assistant' AND meta->'ai'->>'creditReceiptId'=p_receipt_id::text;
    RETURN jsonb_build_object('ok',true,'source',source,'chargedCredits',COALESCE((r.meta->>'chargedCredits')::numeric,0),'outputTokens',CASE WHEN r.meta->>'outputTokens' IS NULL THEN NULL ELSE (r.meta->>'outputTokens')::int END,'usageMissing',COALESCE((r.meta->>'usageMissing')::boolean,false),'receiptId',r.id,'state',state);
  END IF;
  IF (r.meta->>'expiresAt')::timestamptz<=now() OR r.meta->>'grantPeriod' IS DISTINCT FROM public.ai_credit_month_period() THEN
    IF source='wallet' AND r.meta->>'grantPeriod'=public.ai_credit_month_period() THEN
      UPDATE public.ai_credit_wallets SET balance=balance+reserved,updated_at=now() WHERE user_id=p_user_id;
      INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,reserved,'refund',jsonb_build_object(
        'source','wallet','refundCost',reserved,'receiptId',r.id,'billing','tutor_output_tokens','release','expired'));
    END IF;
    IF source='free' THEN INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,1,'refund',jsonb_build_object('source','free','refundCost',1,'receiptId',r.id,'billing','tutor_output_tokens')); END IF;
    UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('state','expired','chargedCredits',0,'outputTokens',NULL,'usageMissing',true) WHERE id=r.id;
    UPDATE public.tutor_messages SET meta=jsonb_set(meta,'{billing}',jsonb_build_object('source',source,'chargedCredits',0,'outputTokens',NULL,'usageMissing',true,'receiptId',r.id),true)
    WHERE user_id=p_user_id AND role='assistant' AND meta->'ai'->>'creditReceiptId'=p_receipt_id::text;
    RETURN jsonb_build_object('ok',true,'source',source,'chargedCredits',0,'outputTokens',NULL,'usageMissing',true,'receiptId',r.id,'state','expired');
  END IF;
  IF p_cancel OR p_output_tokens IS NULL THEN charge:=0; missing:=NOT p_cancel; ELSE charge:=LEAST(p_output_tokens,max_tokens)::numeric/1000; missing:=false; END IF;
  IF source='free' THEN charge:=0; END IF;
  release:=GREATEST(reserved-charge,0);
  IF source='wallet' AND release>0 THEN
    UPDATE public.ai_credit_wallets SET balance=balance+release,updated_at=now() WHERE user_id=p_user_id;
    INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,release,'refund',jsonb_build_object(
      'source','wallet','refundCost',release,'receiptId',r.id,'billing','tutor_output_tokens','release','settle'));
  END IF;
  IF source='free' AND p_cancel THEN INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,1,'refund',jsonb_build_object('source','free','refundCost',1,'receiptId',r.id,'billing','tutor_output_tokens')); END IF;
  state:=CASE WHEN p_cancel THEN 'canceled' ELSE 'settled' END;
  UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('state',state,'chargedCredits',charge,'outputTokens',CASE WHEN p_output_tokens IS NULL THEN NULL ELSE LEAST(p_output_tokens,max_tokens) END,'usageMissing',missing) WHERE id=r.id;
  UPDATE public.tutor_messages SET meta=jsonb_set(meta,'{billing}',jsonb_build_object(
    'source',source,'chargedCredits',charge,
    'outputTokens',CASE WHEN p_output_tokens IS NULL THEN NULL ELSE LEAST(p_output_tokens,max_tokens) END,
    'usageMissing',missing,'receiptId',r.id),true)
  WHERE user_id=p_user_id AND role='assistant' AND meta->'ai'->>'creditReceiptId'=p_receipt_id::text;
  RETURN jsonb_build_object('ok',true,'source',source,'chargedCredits',charge,'outputTokens',CASE WHEN p_output_tokens IS NULL THEN NULL ELSE LEAST(p_output_tokens,max_tokens) END,'usageMissing',missing,'receiptId',r.id,'state',state);
END;
$$;

CREATE FUNCTION public._release_expired_tutor_output_holds_legacy(p_user_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.ai_credit_logs%ROWTYPE;
DECLARE v_refund numeric(18,3);
BEGIN
  FOR r IN SELECT * FROM public.ai_credit_logs
    WHERE user_id = p_user_id
      AND meta->>'billing' = 'tutor_output_tokens'
      AND meta->>'state' = 'reserved'
    FOR UPDATE
  LOOP
    IF (r.meta->>'expiresAt')::timestamptz <= now()
       OR r.meta->>'grantPeriod' IS DISTINCT FROM public.ai_credit_month_period() THEN
      v_refund := abs(r.amount);
      IF r.reason = 'credit_chat'
         AND r.meta->>'grantPeriod' = public.ai_credit_month_period() THEN
        UPDATE public.ai_credit_wallets
        SET balance = balance + v_refund, updated_at = now()
        WHERE user_id = p_user_id;
        INSERT INTO public.ai_credit_logs(user_id, amount, reason, meta)
        VALUES (p_user_id, v_refund, 'refund', jsonb_build_object(
          'source','wallet','refundCost',v_refund,'receiptId',r.id,
          'billing','tutor_output_tokens','release','expired'));
      ELSIF r.reason = 'free_chat' THEN
        INSERT INTO public.ai_credit_logs(user_id, amount, reason, meta)
        VALUES (p_user_id, 1, 'refund', jsonb_build_object(
          'source','free','refundCost',1,'receiptId',r.id,
          'billing','tutor_output_tokens','release','expired'));
      END IF;
      UPDATE public.ai_credit_logs
      SET meta = meta || jsonb_build_object('state','expired','chargedCredits',0,
        'outputTokens',NULL,'usageMissing',true)
      WHERE id = r.id;
      UPDATE public.tutor_messages SET meta=jsonb_set(meta,'{billing}',jsonb_build_object(
        'source',CASE WHEN r.reason='credit_chat' THEN 'wallet' ELSE 'free' END,
        'chargedCredits',0,'outputTokens',NULL,'usageMissing',true,'receiptId',r.id),true)
      WHERE user_id=p_user_id AND role='assistant'
        AND meta->'ai'->>'creditReceiptId'=r.id::text;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_tutor_credit_service(
  p_user_id uuid,p_receipt_id bigint,p_output_tokens int DEFAULT NULL,p_cancel boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ai_credit_logs WHERE id=p_receipt_id AND user_id=p_user_id
    AND meta->>'billing'='tutor_total_tokens') THEN
    IF p_cancel IS TRUE THEN
      RETURN public.settle_tutor_usage_service(p_user_id,p_receipt_id,NULL,true);
    END IF;
    RETURN jsonb_build_object('ok',false,'error','billing_version_mismatch');
  END IF;
  RETURN public._settle_tutor_output_credit_legacy(p_user_id,p_receipt_id,p_output_tokens,p_cancel);
END;
$$;

CREATE OR REPLACE FUNCTION public._release_expired_tutor_holds(p_user_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; v_result jsonb;
BEGIN
  -- Callers already own the same per-user transaction lock.
  PERFORM public._release_expired_tutor_output_holds_legacy(p_user_id);
  FOR r IN SELECT id FROM public.ai_credit_logs WHERE user_id=p_user_id
    AND meta->>'billing'='tutor_total_tokens' AND meta->>'state'='reserved'
    AND ((meta->>'expiresAt')::timestamptz<=now()
      OR meta->>'grantPeriod' IS DISTINCT FROM public.ai_credit_month_period()) FOR UPDATE LOOP
    v_result := public.settle_tutor_usage_service(p_user_id,r.id,NULL,true);
    IF (v_result->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'release_failed'; END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION public.reserve_tutor_usage_service(
  p_user_id uuid,p_request_id uuid,p_max_output_tokens int DEFAULT 8192,p_max_total_tokens int DEFAULT 131072
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.ai_credit_logs%ROWTYPE; w public.ai_credit_wallets%ROWTYPE;
  prof public.profiles%ROWTYPE; u public.tutor_usage_records%ROWTYPE;
  v_period text:=public.ai_credit_month_period(); v_member boolean; v_output int; v_total int;
  v_reserved numeric(18,3); v_used int; v_receipt bigint; v_source text; v_expires timestamptz;
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
    AND meta->>'requestId'=p_request_id::text LIMIT 1;
  IF FOUND THEN
    IF r.meta->>'billing'<>'tutor_total_tokens' THEN
      RETURN jsonb_build_object('ok',false,'error','billing_version_mismatch');
    END IF;
    IF r.meta->>'state' IS DISTINCT FROM 'reserved' THEN
      RETURN jsonb_build_object('ok',false,'error','reservation_finalized','receiptId',r.id,'state',r.meta->>'state');
    END IF;
    SELECT * INTO u FROM public.tutor_usage_records WHERE receipt_id=r.id AND user_id=p_user_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
    RETURN jsonb_build_object('ok',true,'source',CASE WHEN r.reason='free_chat' OR u.free_quota_receipt_id IS NOT NULL THEN 'free' ELSE 'wallet' END,
      'receiptId',r.id,'maxOutputTokens',u.max_output_tokens,'maxTotalTokens',u.max_total_tokens,
      'reservedCredits',CASE WHEN u.free_quota_receipt_id IS NOT NULL THEN 1 ELSE abs(r.amount) END,
      'state','reserved','grantPeriod',r.meta->>'grantPeriod','expiresAt',r.meta->>'expiresAt');
  END IF;
  SELECT * INTO prof FROM public.profiles WHERE id=p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','user_not_found'); END IF;
  v_member:=COALESCE((prof.membership_tier='founder' AND prof.membership_period='founder')
    OR (prof.membership_tier='pro' AND prof.membership_period='lifetime')
    OR (prof.membership_tier='pro' AND prof.membership_period IN ('monthly','yearly') AND prof.membership_expires_at>now()),false);
  IF v_member THEN
    SELECT * INTO w FROM public.ai_credit_wallets WHERE user_id=p_user_id FOR UPDATE;
    IF NOT FOUND OR w.grant_period IS DISTINCT FROM v_period THEN
      INSERT INTO public.ai_credit_wallets(user_id,balance,grant_period) VALUES(p_user_id,1500,v_period)
        ON CONFLICT(user_id) DO UPDATE SET balance=1500,grant_period=v_period,updated_at=now() RETURNING * INTO w;
      INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
        VALUES(p_user_id,1500,'monthly_grant',jsonb_build_object('period',v_period));
    END IF;
    IF w.balance>=0.01 THEN
      v_reserved:=LEAST(w.balance,v_total::numeric/100);
      v_total:=FLOOR(v_reserved*100)::int;
      UPDATE public.ai_credit_wallets SET balance=balance-v_reserved,updated_at=now() WHERE user_id=p_user_id;
      v_source:='wallet';
    END IF;
  END IF;
  IF v_source IS NULL THEN
    v_used:=public.count_ai_free_chats_today(p_user_id);
    IF v_used>=5 THEN RETURN jsonb_build_object('ok',false,'error','quota_exceeded','source','free',
      'freeRemainingToday',0,'resetAt',EXTRACT(EPOCH FROM (public.ai_credit_day_start()+interval '1 day'))::bigint); END IF;
    v_source:='free'; v_reserved:=1;
  END IF;
  v_expires:=now()+interval '20 minutes';
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta)
    VALUES(p_user_id,-v_reserved,CASE WHEN v_source='wallet' THEN 'credit_chat' ELSE 'free_chat' END,
      jsonb_build_object('billing','tutor_total_tokens','state','reserved','requestId',p_request_id,
        'reservedCredits',v_reserved,'grantPeriod',v_period,'expiresAt',v_expires)) RETURNING id INTO v_receipt;
  INSERT INTO public.tutor_usage_records(receipt_id,user_id,request_id,max_output_tokens,max_total_tokens)
    VALUES(v_receipt,p_user_id,p_request_id,v_output,v_total);
  RETURN jsonb_build_object('ok',true,'source',v_source,'receiptId',v_receipt,'maxOutputTokens',v_output,
    'maxTotalTokens',v_total,'reservedCredits',v_reserved,'grantPeriod',v_period,'expiresAt',v_expires);
END;
$$;

-- A low wallet can reserve a few tokens yet be unable to fit the main prompt.
-- Upgrade that same in-flight turn to one free turn without rerunning model
-- calls. Preserve its wallet debit/refund pair and account for free quota in a
-- linked child log, which never has the main receipt's reserved/settled states.
CREATE FUNCTION public.fallback_tutor_usage_to_free_service(
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

CREATE FUNCTION public.begin_tutor_usage_request_service(
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
      IF FOUND THEN RETURN jsonb_build_object('status','started','conversation',to_jsonb(c),
        'receiptId',r.receipt_id,'maxOutputTokens',r.max_output_tokens,'maxTotalTokens',r.max_total_tokens); END IF;
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

CREATE FUNCTION public.complete_tutor_usage_request_service(
  p_user_id uuid,p_request_id uuid,p_user_content text,p_images text[],p_user_meta jsonb,
  p_reply text,p_assistant_meta jsonb,p_usage jsonb,p_clarification boolean,p_title text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.tutor_chat_requests%ROWTYPE; credit jsonb; v_message_id bigint; v_billing jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO r FROM public.tutor_chat_requests WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  IF r.state<>'processing' THEN RETURN public._tutor_request_result(r); END IF;
  IF r.max_total_tokens IS NULL THEN RETURN jsonb_build_object('status','billing_version_mismatch'); END IF;
  IF r.conversation_id IS NULL OR r.created_at<=clock_timestamp()-interval '20 minutes' THEN
    credit:=public.settle_tutor_usage_service(p_user_id,r.receipt_id,NULL,true);
    IF (credit->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'release_failed'; END IF;
    UPDATE public.tutor_chat_requests SET state='failed',finished_at=clock_timestamp()
      WHERE user_id=p_user_id AND request_id=p_request_id RETURNING * INTO r;
    RETURN public._tutor_request_result(r);
  END IF;
  IF p_reply IS NULL OR btrim(p_reply)='' OR p_user_content IS NULL OR p_clarification IS NULL THEN
    RAISE EXCEPTION 'invalid_reply';
  END IF;
  PERFORM 1 FROM public.tutor_conversations WHERE id=r.conversation_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'conversation_missing'; END IF;
  -- Successful clarification uses the verified planner usage too. Failed work
  -- still reaches the existing fail RPC and cancels its reservation instead.
  credit:=public.settle_tutor_usage_service(p_user_id,r.receipt_id,p_usage,false);
  IF (credit->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'settlement_failed'; END IF;
  IF credit->>'state'<>'settled' THEN
    UPDATE public.tutor_chat_requests SET state='failed',finished_at=clock_timestamp()
      WHERE user_id=p_user_id AND request_id=p_request_id RETURNING * INTO r;
    RETURN public._tutor_request_result(r);
  END IF;
  v_billing:=jsonb_build_object('source',credit->>'source','chargedCredits',(credit->>'chargedCredits')::numeric,
    'receiptId',r.receipt_id);
  INSERT INTO public.tutor_messages(conversation_id,user_id,context_type,context_id,role,content,images,meta)
    VALUES(r.conversation_id,p_user_id,r.context_type,r.context_id,'user',p_user_content,p_images,
      (COALESCE(p_user_meta,'{}'::jsonb)-'usage'-'billing')||jsonb_build_object('requestId',p_request_id));
  INSERT INTO public.tutor_messages(conversation_id,user_id,context_type,context_id,role,content,meta)
    VALUES(r.conversation_id,p_user_id,r.context_type,r.context_id,'assistant',p_reply,
      (COALESCE(p_assistant_meta,'{}'::jsonb)-'usage')||jsonb_build_object('requestId',p_request_id,'billing',v_billing,
        'ai',(COALESCE(p_assistant_meta->'ai','{}'::jsonb)-'usage')||jsonb_build_object('creditReceiptId',r.receipt_id)))
    RETURNING id INTO v_message_id;
  UPDATE public.tutor_conversations SET updated_at=clock_timestamp(),title=COALESCE(NULLIF(left(p_title,120),''),title)
    WHERE id=r.conversation_id AND user_id=p_user_id;
  UPDATE public.tutor_chat_requests SET state='completed',message_id=v_message_id,finished_at=clock_timestamp()
    WHERE user_id=p_user_id AND request_id=p_request_id RETURNING * INTO r;
  RETURN public._tutor_request_result(r);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_credit_status(
  p_is_member boolean, p_monthly_grant int, p_free_daily int
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_profile public.profiles%ROWTYPE;
  v_wallet public.ai_credit_wallets%ROWTYPE; v_period text := public.ai_credit_month_period();
  v_member boolean; v_used int; v_balance numeric(18,3);
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','unauthorized'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  PERFORM public._release_expired_tutor_holds(v_user_id);
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  v_member := COALESCE((v_profile.membership_tier='founder' AND v_profile.membership_period='founder')
    OR (v_profile.membership_tier='pro' AND v_profile.membership_period='lifetime')
    OR (v_profile.membership_tier='pro' AND v_profile.membership_period IN ('monthly','yearly')
      AND v_profile.membership_expires_at > now()), false);
  SELECT * INTO v_wallet FROM public.ai_credit_wallets WHERE user_id = v_user_id;
  v_used := public.count_ai_free_chats_today(v_user_id);
  IF v_member THEN
    v_balance := CASE WHEN v_wallet.user_id IS NULL OR v_wallet.grant_period IS DISTINCT FROM v_period
      THEN 1500 ELSE v_wallet.balance END;
  ELSE v_balance := 0; END IF;
  RETURN jsonb_build_object('isMember',v_member,'walletBalance',v_balance,
    'monthlyGrant',1500,'freeDaily',5,'freeUsedToday',v_used,
    'freeRemainingToday',GREATEST(5-v_used,0),'grantPeriod',v_period,
    'dayResetAt',EXTRACT(EPOCH FROM (public.ai_credit_day_start()+interval '1 day'))::bigint,
    'canChat',(v_balance >= .01 OR GREATEST(5-v_used,0) >= 1));
END;
$$;

REVOKE ALL ON FUNCTION public._settle_tutor_output_credit_legacy(uuid,bigint,int,boolean),
  public._release_expired_tutor_output_holds_legacy(uuid),public._release_expired_tutor_holds(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.reserve_tutor_usage_service(uuid,uuid,int,int),
  public.settle_tutor_usage_service(uuid,bigint,jsonb,boolean),
  public.fallback_tutor_usage_to_free_service(uuid,uuid,bigint,uuid,int),
  public.begin_tutor_usage_request_service(uuid,uuid,text,text,text,bigint,int,uuid,int),
  public.complete_tutor_usage_request_service(uuid,uuid,text,text[],jsonb,text,jsonb,jsonb,boolean,text),
  public.settle_tutor_credit_service(uuid,bigint,int,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tutor_usage_service(uuid,uuid,int,int),
  public.settle_tutor_usage_service(uuid,bigint,jsonb,boolean),
  public.fallback_tutor_usage_to_free_service(uuid,uuid,bigint,uuid,int),
  public.begin_tutor_usage_request_service(uuid,uuid,text,text,text,bigint,int,uuid,int),
  public.complete_tutor_usage_request_service(uuid,uuid,text,text[],jsonb,text,jsonb,jsonb,boolean,text),
  public.settle_tutor_credit_service(uuid,bigint,int,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_credit_status(boolean,int,int) TO authenticated;
