-- Recheck the inventory deadline against wall-clock time after acquiring the order lock.
-- CREATE OR REPLACE preserves the existing service-only execution grants.
CREATE OR REPLACE FUNCTION public.start_store_payment_attempt(p_order_id uuid,p_provider text,p_client_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o store_orders; a store_payment_attempts; BEGIN
  SELECT * INTO o FROM store_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR o.status <> 'pending_payment' OR o.payment_status NOT IN ('unpaid','pending') OR p_provider NOT IN ('alipay','wechat') THEN RAISE EXCEPTION 'order_not_payable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM store_inventory_reservations WHERE order_id=o.id AND status='active' AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'order_expired'; END IF;
  SELECT * INTO a FROM store_payment_attempts WHERE order_id=o.id AND status='pending';
  IF FOUND THEN
    IF a.provider=p_provider THEN RETURN a.id; END IF;
    RAISE EXCEPTION 'close_previous_attempt_first';
  END IF;
  IF length(coalesce(p_client_token,'')) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'invalid_client_token'; END IF;
  INSERT INTO store_payment_attempts(order_id,provider,attempt_reference,amount_cents,client_token)
    VALUES(o.id,p_provider,encode(extensions.gen_random_bytes(16),'hex'),o.total_cents,p_client_token) RETURNING * INTO a;
  UPDATE store_orders SET payment_status='pending',updated_at=now() WHERE id=o.id;
  RETURN a.id;
END $$;
