-- Fractional output-token billing for the tutor.  A tutor reservation is an
-- ordinary credit_chat/free_chat log whose metadata carries its state.

ALTER TABLE public.ai_credit_wallets
  ALTER COLUMN balance TYPE numeric(18,3) USING balance::numeric(18,3);
ALTER TABLE public.ai_credit_logs
  ALTER COLUMN amount TYPE numeric(18,3) USING amount::numeric(18,3);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_credit_tutor_request
ON public.ai_credit_logs (user_id, (meta->>'requestId'))
WHERE meta->>'billing' = 'tutor_output_tokens';

CREATE INDEX IF NOT EXISTS idx_ai_credit_tutor_reserved
ON public.ai_credit_logs (user_id, created_at)
WHERE meta->>'billing' = 'tutor_output_tokens' AND meta->>'state' = 'reserved';

CREATE OR REPLACE FUNCTION public.count_ai_free_chats_today(p_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int
  FROM public.ai_credit_logs debit
  WHERE debit.user_id = p_user_id
    AND debit.reason = 'free_chat'
    AND debit.created_at >= public.ai_credit_day_start()
    AND COALESCE((SELECT SUM((refund.meta->>'refundCost')::numeric)
      FROM public.ai_credit_logs refund
      WHERE refund.user_id = debit.user_id
        AND refund.reason = 'refund'
        AND refund.meta->>'receiptId' = debit.id::text), 0) < abs(debit.amount);
$$;

-- Called only while the caller owns the per-user advisory lock.
CREATE OR REPLACE FUNCTION public._release_expired_tutor_holds(p_user_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.get_ai_credit_status(
  p_is_member boolean, p_monthly_grant int, p_free_daily int
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
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
    'canChat',(v_balance >= .001 OR GREATEST(5-v_used,0) >= 1));
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_ai_credit_service(p_user_id uuid, p_cost int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.ai_credit_wallets%ROWTYPE; prof public.profiles%ROWTYPE;
DECLARE member boolean; period text := public.ai_credit_month_period(); new_balance numeric;
DECLARE receipt bigint; used int;
BEGIN
  IF p_user_id IS NULL OR p_cost IS NULL OR p_cost < 1 THEN RETURN jsonb_build_object('ok',false,'error','invalid_params'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  PERFORM public._release_expired_tutor_holds(p_user_id);
  SELECT * INTO prof FROM public.profiles WHERE id=p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','user_not_found'); END IF;
  member := COALESCE((prof.membership_tier='founder' AND prof.membership_period='founder')
    OR (prof.membership_tier='pro' AND prof.membership_period='lifetime')
    OR (prof.membership_tier='pro' AND prof.membership_period IN ('monthly','yearly') AND prof.membership_expires_at > now()),false);
  IF member THEN
    SELECT * INTO w FROM public.ai_credit_wallets WHERE user_id=p_user_id FOR UPDATE;
    IF NOT FOUND OR w.grant_period IS DISTINCT FROM period THEN
      INSERT INTO public.ai_credit_wallets(user_id,balance,grant_period) VALUES(p_user_id,1500,period)
      ON CONFLICT(user_id) DO UPDATE SET balance=1500,grant_period=period,updated_at=now() RETURNING * INTO w;
      INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,1500,'monthly_grant',jsonb_build_object('period',period));
    END IF;
    IF w.balance >= p_cost THEN
      new_balance := w.balance - p_cost;
      UPDATE public.ai_credit_wallets SET balance=new_balance,updated_at=now() WHERE user_id=p_user_id;
      INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,-p_cost,'credit_chat',jsonb_build_object('cost',p_cost)) RETURNING id INTO receipt;
      UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('receiptId',receipt) WHERE id=receipt;
      RETURN jsonb_build_object('ok',true,'source','wallet','remaining',new_balance,'cost',p_cost,'receiptId',receipt);
    END IF;
  END IF;
  used := public.count_ai_free_chats_today(p_user_id);
  IF used >= 5 THEN RETURN jsonb_build_object('ok',false,'error','quota_exceeded','source','free','remaining',0,'freeUsedToday',used,'freeDaily',5,'resetAt',EXTRACT(EPOCH FROM (public.ai_credit_day_start()+interval '1 day'))::bigint); END IF;
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,-p_cost,'free_chat',jsonb_build_object('cost',p_cost)) RETURNING id INTO receipt;
  UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('receiptId',receipt) WHERE id=receipt;
  RETURN jsonb_build_object('ok',true,'source','free','remaining',GREATEST(5-used-1,0),'cost',p_cost,'freeUsedToday',used+1,'freeDaily',5,'receiptId',receipt,'resetAt',EXTRACT(EPOCH FROM (public.ai_credit_day_start()+interval '1 day'))::bigint);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_ai_credit_service(p_user_id uuid,p_refund_cost int,p_source text,p_receipt_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ai_credit_logs%ROWTYPE; refunded numeric; target numeric; delta numeric;
BEGIN
  IF p_user_id IS NULL OR p_receipt_id IS NULL OR p_refund_cost IS NULL OR p_refund_cost<1 OR p_source IS NULL OR p_source NOT IN ('wallet','free') THEN RETURN jsonb_build_object('ok',false,'error','invalid_params'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO r FROM public.ai_credit_logs WHERE id=p_receipt_id AND user_id=p_user_id AND reason IN('credit_chat','free_chat') AND amount<0 AND meta->>'billing' IS NULL FOR UPDATE;
  IF NOT FOUND OR r.reason <> (CASE WHEN p_source='wallet' THEN 'credit_chat' ELSE 'free_chat' END) THEN RETURN jsonb_build_object('ok',false,'error','invalid_receipt'); END IF;
  refunded := COALESCE((SELECT SUM((meta->>'refundCost')::numeric) FROM public.ai_credit_logs WHERE user_id=p_user_id AND reason='refund' AND meta->>'receiptId'=p_receipt_id::text AND meta->>'billing' IS NULL),0);
  target := LEAST(p_refund_cost,abs(r.amount)); delta := GREATEST(target-refunded,0);
  IF delta<=0 THEN RETURN jsonb_build_object('ok',true,'refunded',0,'receiptId',p_receipt_id); END IF;
  IF p_source='wallet' THEN UPDATE public.ai_credit_wallets SET balance=balance+delta,updated_at=now() WHERE user_id=p_user_id; END IF;
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,delta,'refund',jsonb_build_object('source',p_source,'refundCost',delta,'receiptId',p_receipt_id));
  RETURN jsonb_build_object('ok',true,'refunded',delta,'receiptId',p_receipt_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_ai_credit(p_target_user_id uuid,p_amount int,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_id uuid:=auth.uid(); role_name text; new_balance numeric;
BEGIN
  SELECT role INTO role_name FROM public.profiles WHERE id=admin_id;
  IF admin_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','unauthorized'); END IF;
  IF role_name IS DISTINCT FROM 'admin' THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  IF p_target_user_id IS NULL OR p_amount IS NULL OR p_amount=0 THEN RETURN jsonb_build_object('ok',false,'error','invalid_params'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_target_user_id::text,0));
  INSERT INTO public.ai_credit_wallets(user_id,balance) VALUES(p_target_user_id,GREATEST(p_amount,0))
  ON CONFLICT(user_id) DO UPDATE SET balance=GREATEST(public.ai_credit_wallets.balance+p_amount,0),updated_at=now() RETURNING balance INTO new_balance;
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_target_user_id,p_amount,'admin_adjust',jsonb_build_object('note',p_note,'adminId',admin_id));
  RETURN jsonb_build_object('ok',true,'balance',new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_tutor_credit_service(p_user_id uuid,p_request_id uuid,p_max_output_tokens int DEFAULT 8192)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ai_credit_logs%ROWTYPE; w public.ai_credit_wallets%ROWTYPE; prof public.profiles%ROWTYPE;
DECLARE period text:=public.ai_credit_month_period(); member boolean; max_tokens int; reserved numeric(18,3); used int; receipt bigint;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_max_output_tokens IS NULL OR p_max_output_tokens<1 THEN RETURN jsonb_build_object('ok',false,'error','invalid_params'); END IF;
  max_tokens:=LEAST(p_max_output_tokens,8192); PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  PERFORM public._release_expired_tutor_holds(p_user_id);
  SELECT * INTO r FROM public.ai_credit_logs WHERE user_id=p_user_id AND meta->>'billing'='tutor_output_tokens' AND meta->>'requestId'=p_request_id::text LIMIT 1;
  IF FOUND THEN
    IF r.meta->>'state' IS DISTINCT FROM 'reserved' THEN
      RETURN jsonb_build_object('ok',false,'error','reservation_finalized','receiptId',r.id,'state',r.meta->>'state');
    END IF;
    RETURN jsonb_build_object('ok',true,'source',CASE WHEN r.reason='credit_chat' THEN 'wallet' ELSE 'free' END,'receiptId',r.id,'maxOutputTokens',COALESCE((r.meta->>'maxOutputTokens')::int,0),'reservedCredits',abs(r.amount),'state',r.meta->>'state');
  END IF;
  SELECT * INTO prof FROM public.profiles WHERE id=p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','user_not_found'); END IF;
  member:=COALESCE((prof.membership_tier='founder' AND prof.membership_period='founder') OR (prof.membership_tier='pro' AND prof.membership_period='lifetime') OR (prof.membership_tier='pro' AND prof.membership_period IN('monthly','yearly') AND prof.membership_expires_at>now()),false);
  IF member THEN
    SELECT * INTO w FROM public.ai_credit_wallets WHERE user_id=p_user_id FOR UPDATE;
    IF NOT FOUND OR w.grant_period IS DISTINCT FROM period THEN
      INSERT INTO public.ai_credit_wallets(user_id,balance,grant_period) VALUES(p_user_id,1500,period) ON CONFLICT(user_id) DO UPDATE SET balance=1500,grant_period=period,updated_at=now() RETURNING * INTO w;
      INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,1500,'monthly_grant',jsonb_build_object('period',period));
    END IF;
    IF w.balance > 0 THEN
      reserved:=LEAST(w.balance,max_tokens::numeric/1000);
      max_tokens:=FLOOR(reserved*1000)::int;
      UPDATE public.ai_credit_wallets SET balance=balance-reserved,updated_at=now() WHERE user_id=p_user_id;
      INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,-reserved,'credit_chat',jsonb_build_object('billing','tutor_output_tokens','state','reserved','requestId',p_request_id,'maxOutputTokens',max_tokens,'reservedCredits',reserved,'grantPeriod',period,'expiresAt',now()+interval '20 minutes')) RETURNING id INTO receipt;
      RETURN jsonb_build_object('ok',true,'source','wallet','receiptId',receipt,'maxOutputTokens',max_tokens,'reservedCredits',reserved,'grantPeriod',period,'expiresAt',now()+interval '20 minutes');
    END IF;
  END IF;
  used:=public.count_ai_free_chats_today(p_user_id);
  IF used>=5 THEN RETURN jsonb_build_object('ok',false,'error','quota_exceeded','source','free','freeRemainingToday',0,'resetAt',EXTRACT(EPOCH FROM (public.ai_credit_day_start()+interval '1 day'))::bigint); END IF;
  INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(p_user_id,-1,'free_chat',jsonb_build_object('billing','tutor_output_tokens','state','reserved','requestId',p_request_id,'maxOutputTokens',max_tokens,'reservedCredits',1,'grantPeriod',period,'expiresAt',now()+interval '20 minutes')) RETURNING id INTO receipt;
  RETURN jsonb_build_object('ok',true,'source','free','receiptId',receipt,'maxOutputTokens',max_tokens,'reservedCredits',1,'grantPeriod',period,'expiresAt',now()+interval '20 minutes');
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_tutor_credit_service(p_user_id uuid,p_receipt_id bigint,p_output_tokens int DEFAULT NULL,p_cancel boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

REVOKE ALL ON FUNCTION public._release_expired_tutor_holds(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reserve_tutor_credit_service(uuid,uuid,int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_tutor_credit_service(uuid,bigint,int,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tutor_credit_service(uuid,uuid,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_tutor_credit_service(uuid,bigint,int,boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.consume_ai_credit_service(uuid,int) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_ai_credit_service(uuid,int,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit_service(uuid,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_ai_credit_service(uuid,int,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_credit_status(boolean,int,int) TO authenticated;
