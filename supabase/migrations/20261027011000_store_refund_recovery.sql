
-- Channel identities are immutable audit records. Aftersale business status stays
-- refund_pending while closed/abnormal refunds need further merchant handling.
CREATE TABLE IF NOT EXISTS public.store_refund_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.store_orders(id),
  aftersale_id uuid NOT NULL REFERENCES public.store_aftersales(id),
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  refund_reference text NOT NULL UNIQUE CHECK (length(refund_reference) BETWEEN 1 AND 64),
  provider text NOT NULL CHECK (provider IN ('alipay','wechat')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','closed','abnormal','refunded')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(aftersale_id, attempt_no)
);
ALTER TABLE public.store_refund_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_refund_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.store_refund_attempts TO service_role;
ALTER TABLE public.store_aftersales ADD COLUMN IF NOT EXISTS refund_reference text;
ALTER TABLE public.store_aftersales ADD COLUMN IF NOT EXISTS refund_channel_status text
  CHECK (refund_channel_status IN ('pending','closed','abnormal','refunded'));

INSERT INTO public.store_refund_attempts(order_id,aftersale_id,attempt_no,refund_reference,provider,amount_cents,status)
SELECT a.order_id,a.id,1,replace(a.id::text,'-',''),o.payment_provider,a.amount_cents,
  CASE WHEN a.status='refunded' THEN 'refunded' ELSE 'pending' END
FROM public.store_aftersales a JOIN public.store_orders o ON o.id=a.order_id
WHERE a.status IN ('refund_pending','refunded') AND o.payment_provider IN ('alipay','wechat')
ON CONFLICT DO NOTHING;
UPDATE public.store_aftersales a SET refund_reference=r.refund_reference,refund_channel_status=r.status
FROM public.store_refund_attempts r WHERE r.aftersale_id=a.id AND a.refund_reference IS NULL AND r.attempt_no=1;

CREATE OR REPLACE FUNCTION public.get_store_refund_attempt(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o store_orders; a store_aftersales; r store_refund_attempts;
BEGIN
  SELECT * INTO o FROM store_orders WHERE id=p_order_id FOR UPDATE;
  SELECT * INTO a FROM store_aftersales WHERE order_id=o.id FOR UPDATE;
  IF a.id IS NULL OR a.status NOT IN ('refund_pending','refunded') OR o.payment_provider NOT IN ('alipay','wechat') OR o.payment_reference IS NULL THEN RAISE EXCEPTION 'refund_not_approved'; END IF;
  IF a.refund_reference IS NULL THEN
    IF o.payment_status<>'paid' THEN RAISE EXCEPTION 'refund_not_payable'; END IF;
    INSERT INTO store_refund_attempts(order_id,aftersale_id,attempt_no,refund_reference,provider,amount_cents)
      VALUES(o.id,a.id,1,replace(a.id::text,'-',''),o.payment_provider,a.amount_cents) RETURNING * INTO r;
    UPDATE store_aftersales SET refund_reference=r.refund_reference,refund_channel_status=r.status WHERE id=a.id;
  ELSE
    SELECT * INTO r FROM store_refund_attempts WHERE aftersale_id=a.id AND refund_reference=a.refund_reference FOR UPDATE;
    IF r.id IS NULL THEN RAISE EXCEPTION 'refund_attempt_missing'; END IF;
  END IF;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.record_store_refund_result(p_order_id uuid,p_refund_reference text,p_provider text,p_payment_reference text,p_amount_cents integer,p_currency text,p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o store_orders; a store_aftersales; r store_refund_attempts;
BEGIN
  SELECT * INTO o FROM store_orders WHERE id=p_order_id FOR UPDATE;
  SELECT * INTO a FROM store_aftersales WHERE order_id=o.id FOR UPDATE;
  SELECT * INTO r FROM store_refund_attempts WHERE aftersale_id=a.id AND refund_reference=p_refund_reference FOR UPDATE;
  IF r.id IS NULL OR p_provider IS DISTINCT FROM r.provider OR p_provider IS DISTINCT FROM o.payment_provider OR p_payment_reference IS DISTINCT FROM o.payment_reference OR p_amount_cents IS DISTINCT FROM r.amount_cents OR p_amount_cents IS DISTINCT FROM a.amount_cents OR p_amount_cents IS DISTINCT FROM o.total_cents OR p_currency IS DISTINCT FROM 'CNY' OR o.currency IS DISTINCT FROM 'CNY' OR p_status NOT IN ('pending','closed','abnormal') THEN RAISE EXCEPTION 'refund_confirmation_mismatch'; END IF;
  IF a.refund_reference IS DISTINCT FROM p_refund_reference THEN RAISE EXCEPTION 'stale_refund_attempt'; END IF;
  IF r.status='refunded' THEN RETURN true; END IF;
  IF a.status<>'refund_pending' OR o.payment_status<>'paid' THEN RAISE EXCEPTION 'refund_not_approved'; END IF;
  IF r.status IN ('closed','abnormal') AND p_status='pending' THEN RETURN true; END IF;
  IF r.status='closed' AND p_status<>'closed' THEN RAISE EXCEPTION 'refund_requires_manual_reconciliation'; END IF;
  IF r.status IS DISTINCT FROM p_status THEN
    UPDATE store_refund_attempts SET status=p_status,updated_at=now() WHERE id=r.id;
    UPDATE store_aftersales SET refund_channel_status=p_status,
      last_reconcile_error=CASE p_status WHEN 'closed' THEN 'REFUND_CLOSED' WHEN 'abnormal' THEN 'REFUND_ABNORMAL' ELSE NULL END WHERE id=a.id;
    IF p_status IN ('closed','abnormal') THEN
      INSERT INTO store_order_events(order_id,event_type,message,payload) VALUES(o.id,'refund_'||p_status,
        CASE p_status WHEN 'closed' THEN '退款已关闭，等待商家重新处理' ELSE '退款异常，等待商家核查' END,
        jsonb_build_object('refund_reference',r.refund_reference));
    END IF;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.restart_store_refund_attempt(p_order_id uuid,p_expected_refund_reference text,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o store_orders; a store_aftersales; r store_refund_attempts; previous store_refund_attempts; next_no integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor_id AND role='admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  SELECT * INTO o FROM store_orders WHERE id=p_order_id FOR UPDATE;
  SELECT * INTO a FROM store_aftersales WHERE order_id=o.id FOR UPDATE;
  SELECT * INTO r FROM store_refund_attempts WHERE aftersale_id=a.id AND refund_reference=a.refund_reference FOR UPDATE;
  IF r.id IS NULL OR a.status<>'refund_pending' OR o.payment_status<>'paid' OR r.provider<>'wechat' THEN RAISE EXCEPTION 'refund_not_restartable'; END IF;
  IF a.refund_reference IS DISTINCT FROM p_expected_refund_reference THEN
    SELECT * INTO previous FROM store_refund_attempts WHERE aftersale_id=a.id AND refund_reference=p_expected_refund_reference;
    IF previous.status='closed' AND r.attempt_no=previous.attempt_no+1 AND r.status='pending' THEN RETURN to_jsonb(r); END IF;
    RAISE EXCEPTION 'stale_refund_attempt';
  END IF;
  IF r.status<>'closed' THEN RAISE EXCEPTION 'refund_closure_not_confirmed'; END IF;
  next_no:=r.attempt_no+1;
  INSERT INTO store_refund_attempts(order_id,aftersale_id,attempt_no,refund_reference,provider,amount_cents,created_by)
    VALUES(o.id,a.id,next_no,replace(a.id::text,'-','')||'-'||next_no::text,r.provider,r.amount_cents,p_actor_id) RETURNING * INTO r;
  UPDATE store_aftersales SET refund_reference=r.refund_reference,refund_channel_status='pending',last_reconcile_error=NULL,reconcile_after=now() WHERE id=a.id;
  INSERT INTO store_order_events(order_id,event_type,message,payload) VALUES(o.id,'refund_restarted','商家已重新发起退款',jsonb_build_object('actor_id',p_actor_id,'refund_reference',r.refund_reference));
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.confirm_store_refund(p_aftersale_id uuid,p_amount_cents integer,p_provider text,p_provider_ref text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oid uuid; o store_orders; a store_aftersales; r store_refund_attempts;
BEGIN
  SELECT order_id INTO oid FROM store_aftersales WHERE id=p_aftersale_id;
  PERFORM get_store_refund_attempt(oid);
  SELECT * INTO o FROM store_orders WHERE id=oid FOR UPDATE;
  SELECT * INTO a FROM store_aftersales WHERE id=p_aftersale_id FOR UPDATE;
  SELECT * INTO r FROM store_refund_attempts WHERE aftersale_id=a.id AND refund_reference=p_provider_ref FOR UPDATE;
  IF r.id IS NULL OR a.refund_reference IS DISTINCT FROM p_provider_ref OR p_amount_cents IS DISTINCT FROM a.amount_cents OR p_amount_cents IS DISTINCT FROM o.total_cents OR p_amount_cents IS DISTINCT FROM r.amount_cents OR p_provider IS DISTINCT FROM o.payment_provider OR p_provider IS DISTINCT FROM r.provider THEN RAISE EXCEPTION 'refund_confirmation_mismatch'; END IF;
  IF a.status='refunded' AND r.status='refunded' THEN RETURN true; END IF;
  IF r.status='closed' THEN RAISE EXCEPTION 'refund_requires_manual_reconciliation'; END IF;
  IF a.status<>'refund_pending' OR o.payment_status<>'paid' THEN RAISE EXCEPTION 'refund_not_approved'; END IF;
  UPDATE store_refund_attempts SET status='refunded',updated_at=now() WHERE id=r.id;
  UPDATE store_aftersales SET status='refunded',provider=p_provider,provider_ref=p_provider_ref,refunded_at=now(),refund_channel_status='refunded',last_reconcile_error=NULL WHERE id=a.id;
  UPDATE store_orders SET status='refunded',payment_status='refunded',updated_at=now() WHERE id=o.id;
  UPDATE store_procurements SET status='cancelled',updated_at=now() WHERE order_id=o.id AND status='queued';
  INSERT INTO store_order_events(order_id,event_type,message) VALUES(o.id,'refunded','整单退款成功');
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.get_store_refund_attempt(uuid),public.record_store_refund_result(uuid,text,text,text,integer,text,text),public.restart_store_refund_attempt(uuid,text,uuid),public.confirm_store_refund(uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_refund_attempt(uuid),public.record_store_refund_result(uuid,text,text,text,integer,text,text),public.restart_store_refund_attempt(uuid,text,uuid),public.confirm_store_refund(uuid,integer,text,text) TO service_role;
