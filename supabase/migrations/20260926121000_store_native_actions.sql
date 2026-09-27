-- Fulfillment and aftersales transitions. All state transitions lock the order first.
BEGIN;
ALTER TABLE public.store_aftersales
  ADD COLUMN return_address_encrypted text,
  ADD COLUMN carrier text,
  ADD COLUMN tracking_number text,
  ADD COLUMN previous_order_status text,
  ADD COLUMN rejection_reason text;
ALTER TABLE public.store_payment_attempts ADD COLUMN reconcile_after timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.store_aftersales ADD COLUMN reconcile_after timestamptz NOT NULL DEFAULT now(), ADD COLUMN last_reconcile_error text;
ALTER TABLE public.store_inventory_reservations ADD COLUMN reconcile_after timestamptz NOT NULL DEFAULT now(), ADD COLUMN last_reconcile_error text;
CREATE INDEX store_attempt_reconcile ON public.store_payment_attempts(reconcile_after) WHERE status='pending';
CREATE INDEX store_aftersale_reconcile ON public.store_aftersales(reconcile_after) WHERE status='refund_pending';
CREATE INDEX store_reservation_reconcile ON public.store_inventory_reservations(reconcile_after) WHERE status='active';
-- Addresses and internal review information are exposed through filtered APIs only.
DROP POLICY IF EXISTS store_aftersale_owner_read ON public.store_aftersales;
REVOKE ALL ON public.store_aftersales FROM anon, authenticated;
GRANT ALL ON public.store_inventory_reservations, public.store_payment_attempts,
  public.store_procurements, public.store_shipments, public.store_aftersales TO service_role;
CREATE UNIQUE INDEX store_payment_attempt_reference_unique ON public.store_payment_attempts(attempt_reference);
CREATE UNIQUE INDEX store_provider_transaction_unique ON public.store_payment_attempts(provider,provider_reference) WHERE provider_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.start_store_payment_attempt(p_order_id uuid,p_provider text,p_client_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o store_orders; a store_payment_attempts; BEGIN
  SELECT * INTO o FROM store_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR o.status <> 'pending_payment' OR o.payment_status NOT IN ('unpaid','pending') OR p_provider NOT IN ('alipay','wechat') THEN RAISE EXCEPTION 'order_not_payable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM store_inventory_reservations WHERE order_id=o.id AND status='active' AND expires_at>now()) THEN RAISE EXCEPTION 'order_expired'; END IF;
  SELECT * INTO a FROM store_payment_attempts WHERE order_id=o.id AND status='pending';
  IF FOUND THEN
    IF a.provider=p_provider THEN RETURN a.id; END IF;
    RAISE EXCEPTION 'close_previous_attempt_first';
  END IF;
  IF length(coalesce(p_client_token,'')) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'invalid_client_token'; END IF;
  INSERT INTO store_payment_attempts(order_id,provider,attempt_reference,amount_cents,client_token)
    VALUES(o.id,p_provider,encode(gen_random_bytes(16),'hex'),o.total_cents,p_client_token) RETURNING * INTO a;
  UPDATE store_orders SET payment_status='pending',updated_at=now() WHERE id=o.id;
  RETURN a.id;
END $$;

CREATE OR REPLACE FUNCTION public.close_store_payment_attempt(p_attempt_id uuid,p_confirmed_closed boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oid uuid; a store_payment_attempts; BEGIN
  IF p_confirmed_closed IS DISTINCT FROM true THEN RAISE EXCEPTION 'channel_close_confirmation_required'; END IF;
  SELECT order_id INTO oid FROM store_payment_attempts WHERE id=p_attempt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found'; END IF;
  PERFORM 1 FROM store_orders WHERE id=oid FOR UPDATE;
  SELECT * INTO a FROM store_payment_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF a.status='succeeded' THEN RETURN false; END IF;
  IF a.status='closed' THEN RETURN true; END IF;
  UPDATE store_payment_attempts SET status='closed',closed_at=now(),updated_at=now() WHERE id=a.id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_store_payment(p_attempt_id uuid,p_amount_cents integer,p_currency text,p_provider_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oid uuid; o store_orders; a store_payment_attempts; r store_inventory_reservations; BEGIN
  SELECT order_id INTO oid FROM store_payment_attempts WHERE id=p_attempt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found'; END IF;
  SELECT * INTO o FROM store_orders WHERE id=oid FOR UPDATE;
  SELECT * INTO a FROM store_payment_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF p_amount_cents IS DISTINCT FROM a.amount_cents OR p_amount_cents IS DISTINCT FROM o.total_cents
    OR p_currency IS DISTINCT FROM 'CNY' OR length(btrim(coalesce(p_provider_reference,''))) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'invalid_payment_confirmation'; END IF;
  IF a.status='succeeded' THEN
    IF a.provider_reference IS DISTINCT FROM p_provider_reference THEN RAISE EXCEPTION 'transaction_mismatch'; END IF;
    RETURN true;
  END IF;
  IF a.status<>'pending' OR o.status<>'pending_payment' THEN RAISE EXCEPTION 'payment_requires_manual_reconciliation'; END IF;
  SELECT * INTO r FROM store_inventory_reservations WHERE order_id=o.id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation_missing'; END IF;
  UPDATE store_product_variants SET stock_quantity=stock_quantity-r.quantity,stock_reserved=stock_reserved-r.quantity,stock_sold=stock_sold+r.quantity WHERE id=r.variant_id;
  UPDATE store_inventory_reservations SET status='consumed',consumed_at=now() WHERE id=r.id;
  UPDATE store_payment_attempts SET status='succeeded',provider_reference=p_provider_reference,succeeded_at=now(),updated_at=now() WHERE id=a.id;
  UPDATE store_orders SET status='paid',payment_status='paid',payment_provider=a.provider,payment_reference=a.attempt_reference,paid_at=now(),updated_at=now() WHERE id=o.id;
  INSERT INTO store_procurements(order_id,source,supplier_id)
    SELECT o.id,'manual',supplier_id FROM store_order_items WHERE order_id=o.id LIMIT 1 ON CONFLICT(order_id) DO NOTHING;
  INSERT INTO store_order_events(order_id,event_type,message) VALUES(o.id,'paid','支付成功，等待采购');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.request_store_refund(p_order_id uuid,p_user_id uuid,p_reason text,p_return_first boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o store_orders; a store_aftersales; BEGIN
  SELECT * INTO o FROM store_orders WHERE id=p_order_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR o.payment_status<>'paid' THEN RAISE EXCEPTION 'order_not_refundable'; END IF;
  SELECT * INTO a FROM store_aftersales WHERE order_id=o.id FOR UPDATE;
  IF FOUND AND a.status NOT IN ('rejected','cancelled') THEN RETURN a.id; END IF;
  IF o.status NOT IN ('paid','sourcing','ordered','partially_shipped','shipped','delivered') OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid_refund_request'; END IF;
  INSERT INTO store_aftersales(order_id,user_id,kind,status,reason,amount_cents,previous_order_status)
    VALUES(o.id,o.user_id,'refund','requested',p_reason,o.total_cents,o.status)
    ON CONFLICT(order_id) DO UPDATE SET status='requested',reason=excluded.reason,previous_order_status=excluded.previous_order_status,rejection_reason=NULL
    RETURNING * INTO a;
  UPDATE store_orders SET status='refund_pending',updated_at=now() WHERE id=o.id;
  INSERT INTO store_order_events(order_id,event_type,message) VALUES(o.id,'refund_requested','已申请售后，等待审核');
  RETURN a.id;
END $$;

CREATE OR REPLACE FUNCTION public.store_native_admin_action(p_order_id uuid,p_action text,p_payload jsonb,p_actor_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o store_orders; a store_aftersales; BEGIN
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor_id AND role='admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  SELECT * INTO o FROM store_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_missing'; END IF;
  SELECT * INTO a FROM store_aftersales WHERE order_id=o.id FOR UPDATE;
  CASE p_action
  WHEN 'record_procurement' THEN
    IF o.status NOT IN ('paid','sourcing','ordered') OR o.payment_status<>'paid' OR length(btrim(coalesce(p_payload->>'reference',''))) NOT BETWEEN 1 AND 180 OR coalesce((p_payload->>'costCents')::integer,-1)<0 THEN RAISE EXCEPTION 'invalid_procurement'; END IF;
    UPDATE store_procurements SET status='ordered',external_reference=p_payload->>'reference',metadata=jsonb_build_object('cost_cents',(p_payload->>'costCents')::integer,'notes',left(coalesce(p_payload->>'notes',''),1000)),updated_at=now() WHERE order_id=o.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'procurement_missing'; END IF;
    UPDATE store_orders SET status='ordered',ordered_at=coalesce(ordered_at,now()),updated_at=now() WHERE id=o.id;
  WHEN 'ship' THEN
    IF o.status<>'ordered' OR o.payment_status<>'paid' OR length(btrim(coalesce(p_payload->>'carrier',''))) NOT BETWEEN 1 AND 80 OR length(btrim(coalesce(p_payload->>'trackingNumber',''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'invalid_shipment'; END IF;
    INSERT INTO store_shipments(order_id,status,carrier,tracking_number,shipped_at) VALUES(o.id,'shipped',p_payload->>'carrier',p_payload->>'trackingNumber',now());
    UPDATE store_orders SET status='shipped',shipped_at=now(),updated_at=now() WHERE id=o.id;
  WHEN 'approve_refund' THEN
    IF a.id IS NULL OR a.status<>'requested' THEN RAISE EXCEPTION 'aftersale_not_pending'; END IF;
    UPDATE store_aftersales SET status='refund_pending',approved_at=now(),provider=o.payment_provider WHERE id=a.id;
  WHEN 'require_return' THEN
    IF a.id IS NULL OR a.status<>'requested' OR length(coalesce(p_payload->>'returnAddressEncrypted',''))<20 THEN RAISE EXCEPTION 'invalid_return_review'; END IF;
    UPDATE store_aftersales SET status='return_required',kind='return_refund',approved_at=now(),return_address_encrypted=p_payload->>'returnAddressEncrypted' WHERE id=a.id;
  WHEN 'reject_refund' THEN
    IF a.id IS NULL OR a.status<>'requested' OR length(btrim(coalesce(p_payload->>'reason',''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid_rejection'; END IF;
    UPDATE store_aftersales SET status='rejected',rejection_reason=p_payload->>'reason' WHERE id=a.id;
    UPDATE store_orders SET status=coalesce(a.previous_order_status,'paid'),updated_at=now() WHERE id=o.id;
  WHEN 'receive_return' THEN
    IF a.id IS NULL OR a.status<>'returned' THEN RAISE EXCEPTION 'return_not_shipped'; END IF;
    UPDATE store_aftersales SET status='refund_pending',received_at=now(),provider=o.payment_provider WHERE id=a.id;
  ELSE RAISE EXCEPTION 'unknown_action';
  END CASE;
  INSERT INTO store_order_events(order_id,event_type,message,payload) VALUES(o.id,p_action,
    CASE p_action WHEN 'record_procurement' THEN '已采购，等待发货' WHEN 'ship' THEN '商品已发货' WHEN 'approve_refund' THEN '售后已通过，退款处理中' WHEN 'require_return' THEN '请按退货说明寄回商品' WHEN 'reject_refund' THEN '售后申请未通过，请联系客服' ELSE '已收到退货，退款处理中' END,
    jsonb_build_object('actor_id',p_actor_id));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.store_native_user_action(p_order_id uuid,p_user_id uuid,p_action text,p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o store_orders; a store_aftersales; BEGIN
  SELECT * INTO o FROM store_orders WHERE id=p_order_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_missing'; END IF;
  IF p_action='return_shipped' THEN
    SELECT * INTO a FROM store_aftersales WHERE order_id=o.id FOR UPDATE;
    IF a.status<>'return_required' OR a.id IS NULL OR length(btrim(coalesce(p_payload->>'carrier',''))) NOT BETWEEN 1 AND 80 OR length(btrim(coalesce(p_payload->>'trackingNumber',''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'invalid_return_tracking'; END IF;
    UPDATE store_aftersales SET status='returned',carrier=p_payload->>'carrier',tracking_number=p_payload->>'trackingNumber',returned_at=now() WHERE id=a.id;
  ELSIF p_action='confirm_delivery' THEN
    IF o.status='delivered' THEN RETURN true; END IF;
    IF o.status<>'shipped' THEN RAISE EXCEPTION 'order_not_shipped'; END IF;
    UPDATE store_shipments SET status='delivered',delivered_at=now(),updated_at=now() WHERE order_id=o.id;
    UPDATE store_orders SET status='delivered',delivered_at=now(),updated_at=now() WHERE id=o.id;
  ELSE RAISE EXCEPTION 'unknown_action'; END IF;
  INSERT INTO store_order_events(order_id,event_type,message) VALUES(o.id,p_action,CASE WHEN p_action='return_shipped' THEN '退货已寄出，等待商家收货' ELSE '已确认收货' END);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_store_refund(p_aftersale_id uuid,p_amount_cents integer,p_provider text,p_provider_ref text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oid uuid; o store_orders; a store_aftersales; BEGIN
  SELECT order_id INTO oid FROM store_aftersales WHERE id=p_aftersale_id;
  SELECT * INTO o FROM store_orders WHERE id=oid FOR UPDATE;
  SELECT * INTO a FROM store_aftersales WHERE id=p_aftersale_id FOR UPDATE;
  IF a.id IS NULL OR p_amount_cents IS DISTINCT FROM a.amount_cents OR p_amount_cents IS DISTINCT FROM o.total_cents OR p_provider IS DISTINCT FROM o.payment_provider OR p_provider_ref IS DISTINCT FROM replace(a.id::text,'-','') THEN RAISE EXCEPTION 'refund_confirmation_mismatch'; END IF;
  IF a.status='refunded' THEN RETURN true; END IF;
  IF a.status<>'refund_pending' OR o.payment_status<>'paid' THEN RAISE EXCEPTION 'refund_not_approved'; END IF;
  UPDATE store_aftersales SET status='refunded',provider=p_provider,provider_ref=p_provider_ref,refunded_at=now() WHERE id=a.id;
  UPDATE store_orders SET status='refunded',payment_status='refunded',updated_at=now() WHERE id=o.id;
  UPDATE store_procurements SET status='cancelled',updated_at=now() WHERE order_id=o.id AND status='queued';
  INSERT INTO store_order_events(order_id,event_type,message) VALUES(o.id,'refunded','整单退款成功');
  RETURN true;
END $$;

-- Superseded broad helpers must not bypass the reviewed state machines.
REVOKE ALL ON FUNCTION public.approve_store_aftersale(uuid,boolean),public.mark_store_return_received(uuid),public.update_store_procurement(uuid,text,text),public.update_store_shipment(uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.store_native_admin_action(uuid,text,jsonb,uuid),public.store_native_user_action(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.store_native_admin_action(uuid,text,jsonb,uuid),public.store_native_user_action(uuid,uuid,text,jsonb) TO service_role;
COMMIT;
