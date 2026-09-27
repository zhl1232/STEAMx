-- Native physical commerce: inventory reservations, payment attempts and fulfilment.
-- Existing store rows remain readable; native RPCs are the only write path for new orders.
BEGIN;

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS shipping_cents integer CHECK (shipping_cents >= 0),
  ADD COLUMN IF NOT EXISTS blocked_provinces text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fulfillment_description text;
ALTER TABLE public.store_products ALTER COLUMN shipping_cents DROP NOT NULL;
ALTER TABLE public.store_product_variants
  ADD COLUMN IF NOT EXISTS stock_reserved integer NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  ADD COLUMN IF NOT EXISTS stock_sold integer NOT NULL DEFAULT 0 CHECK (stock_sold >= 0);
ALTER TABLE public.store_products ALTER COLUMN shipping_cents DROP DEFAULT;
ALTER TABLE public.store_product_sources ALTER COLUMN offer_id DROP NOT NULL;
ALTER TABLE public.store_product_variants DROP CONSTRAINT IF EXISTS store_variant_reserved_stock_check;
ALTER TABLE public.store_product_variants ADD CONSTRAINT store_variant_reserved_stock_check CHECK (stock_reserved <= COALESCE(stock_quantity, stock_reserved));

CREATE TABLE IF NOT EXISTS public.store_inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.store_product_variants(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','consumed','released')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  released_at timestamptz, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_store_inventory_reservations_expiry ON public.store_inventory_reservations(status, expires_at);

CREATE TABLE IF NOT EXISTS public.store_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (char_length(btrim(provider)) BETWEEN 1 AND 40),
  attempt_reference text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','closed')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0), client_token text NOT NULL,
  provider_reference text, failure_code text, closed_at timestamptz, succeeded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, attempt_reference), UNIQUE (order_id, client_token)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_payment_attempts_one_active
  ON public.store_payment_attempts(order_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.store_procurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('1688','manual')), status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','ordered','received','cancelled','failed')),
  supplier_id uuid REFERENCES public.store_suppliers(id) ON DELETE SET NULL, external_reference text,
  metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

CREATE TABLE IF NOT EXISTS public.store_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','shipped','delivered','cancelled')),
  carrier text, tracking_number text, shipped_at timestamptz, delivered_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id)
);

CREATE TABLE IF NOT EXISTS public.store_aftersales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, kind text NOT NULL CHECK (kind IN ('refund','return_refund')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','return_required','returned','received','refund_pending','refunded','rejected','cancelled')),
  reason text NOT NULL, amount_cents integer NOT NULL CHECK (amount_cents > 0), provider text, provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz, returned_at timestamptz, received_at timestamptz, refunded_at timestamptz,
  UNIQUE(order_id)
);

CREATE OR REPLACE FUNCTION public.create_store_native_order(
  p_user_id uuid, p_external_order_id text, p_address_id uuid, p_address_snapshot_encrypted text,
  p_province text, p_items jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order uuid := gen_random_uuid(); v_item jsonb; v_variant record; v_product record; v_qty integer; v_subtotal integer := 0; v_shipping integer := 0; v_supplier uuid;
BEGIN
  IF p_user_id IS NULL OR btrim(coalesce(p_external_order_id,'')) = '' OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) <> 1 THEN RAISE EXCEPTION 'native_order_requires_one_sku'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(ARRAY['北京市','天津市','河北省','山西省','内蒙古自治区','辽宁省','吉林省','黑龙江省','上海市','江苏省','浙江省','安徽省','福建省','江西省','山东省','河南省','湖北省','湖南省','广东省','广西壮族自治区','海南省','重庆市','四川省','贵州省','云南省','西藏自治区','陕西省','甘肃省','青海省','宁夏回族自治区','新疆维吾尔自治区']) x WHERE x=p_province) THEN RAISE EXCEPTION 'mainland_province_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_external_order_id, 0));
  IF EXISTS (SELECT 1 FROM store_orders WHERE user_id=p_user_id AND external_order_id=p_external_order_id) THEN SELECT id INTO v_order FROM store_orders WHERE user_id=p_user_id AND external_order_id=p_external_order_id; RETURN v_order; END IF;
  IF NOT EXISTS (SELECT 1 FROM store_addresses WHERE id=p_address_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'address_not_owned'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 100 THEN RAISE EXCEPTION 'invalid_native_quantity'; END IF;
    SELECT v.*, p.name product_name, p.shipping_cents, p.blocked_provinces, p.status product_status, p.source product_source
      INTO v_variant FROM store_product_variants v JOIN store_products p ON p.id=v.product_id
      WHERE v.id=(v_item->>'variant_id')::uuid FOR UPDATE;
    IF NOT FOUND OR v_variant.status <> 'active' OR v_variant.product_status <> 'active' OR v_variant.shipping_cents IS NULL OR (SELECT checkout_mode FROM store_products WHERE id=v_variant.product_id) <> 'internal' OR v_qty < v_variant.min_quantity OR v_variant.product_source <> 'manual' AND NOT EXISTS (SELECT 1 FROM store_product_sources s WHERE s.variant_id=v_variant.id AND s.is_primary) THEN RAISE EXCEPTION 'native_variant_unavailable'; END IF;
    IF p_province = ANY(v_variant.blocked_provinces) THEN RAISE EXCEPTION 'province_blocked'; END IF;
    IF v_variant.stock_quantity IS NULL OR v_variant.stock_quantity - v_variant.stock_reserved < v_qty THEN RAISE EXCEPTION 'insufficient_stock'; END IF;
    v_subtotal := v_subtotal + COALESCE(v_variant.price_cents, (SELECT price_cents FROM store_products WHERE id=v_variant.product_id)) * v_qty;
    v_shipping := greatest(v_shipping, v_variant.shipping_cents);
    IF v_supplier IS NULL THEN SELECT supplier_id INTO v_supplier FROM store_product_sources WHERE variant_id=v_variant.id AND is_primary LIMIT 1; END IF;
  END LOOP;
  IF v_subtotal + v_shipping <= 0 THEN RAISE EXCEPTION 'positive_order_total_required'; END IF;
  INSERT INTO store_orders(id,user_id,status,payment_status,subtotal_cents,shipping_cents,total_cents,address_id,address_snapshot_encrypted,external_order_id)
    VALUES(v_order,p_user_id,'pending_payment','unpaid',v_subtotal,v_shipping,v_subtotal+v_shipping,p_address_id,p_address_snapshot_encrypted,p_external_order_id);
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::integer;
    SELECT v.*, p.name product_name, p.shipping_cents INTO v_variant FROM store_product_variants v JOIN store_products p ON p.id=v.product_id WHERE v.id=(v_item->>'variant_id')::uuid FOR UPDATE;
    INSERT INTO store_order_items(order_id,product_id,variant_id,supplier_id,title_snapshot,sku_snapshot,quantity,unit_price_cents,offer_id,spec_id,metadata)
      SELECT v_order,v_variant.product_id,v_variant.id,s.supplier_id,v_variant.product_name,v_variant.sku,v_qty,COALESCE(v_variant.price_cents,p.price_cents),s.offer_id,s.spec_id,jsonb_build_object('variantName',v_variant.name,'contextKeys',p.context_keys,'fulfillmentDescription',p.fulfillment_description)
      FROM store_products p LEFT JOIN LATERAL (SELECT * FROM store_product_sources WHERE variant_id=v_variant.id AND is_primary LIMIT 1) s ON true WHERE p.id=v_variant.product_id;
    INSERT INTO store_inventory_reservations(order_id,variant_id,quantity) VALUES(v_order,v_variant.id,v_qty);
    UPDATE store_product_variants SET stock_reserved=stock_reserved+v_qty WHERE id=v_variant.id;
  END LOOP;
  INSERT INTO store_order_events(order_id,event_type,message) VALUES(v_order,'created','Native order created; inventory reserved for 30 minutes');
  RETURN v_order;
END $$;

CREATE OR REPLACE FUNCTION public.start_store_payment_attempt(p_order_id uuid,p_provider text,p_client_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_order store_orders; v_id uuid; BEGIN
  SELECT * INTO v_order FROM store_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status <> 'pending_payment' THEN RAISE EXCEPTION 'order_not_payable'; END IF;
  SELECT id INTO v_id FROM store_payment_attempts WHERE order_id=p_order_id AND client_token=p_client_token;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF EXISTS (SELECT 1 FROM store_payment_attempts WHERE order_id=p_order_id AND status='pending') THEN RAISE EXCEPTION 'active_payment_attempt'; END IF;
  INSERT INTO store_payment_attempts(order_id,provider,attempt_reference,amount_cents,client_token) VALUES(p_order_id,btrim(p_provider),encode(gen_random_bytes(16),'hex'),v_order.total_cents,p_client_token) RETURNING id INTO v_id;
  UPDATE store_orders SET payment_status='pending' WHERE id=p_order_id; RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_store_payment(p_attempt_id uuid,p_amount_cents integer,p_currency text,p_provider_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_attempt store_payment_attempts; v_order store_orders; v_order_id uuid; BEGIN
  SELECT order_id INTO v_order_id FROM store_payment_attempts WHERE id=p_attempt_id; IF NOT FOUND THEN RAISE EXCEPTION 'payment_attempt_not_found'; END IF;
  SELECT * INTO v_order FROM store_orders WHERE id=v_order_id FOR UPDATE;
  SELECT * INTO v_attempt FROM store_payment_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF p_amount_cents <> v_attempt.amount_cents OR p_currency <> v_order.currency THEN RAISE EXCEPTION 'payment_amount_mismatch'; END IF;
  IF v_attempt.status='succeeded' THEN RETURN true; END IF; IF v_attempt.status <> 'pending' THEN RETURN false; END IF;
  UPDATE store_payment_attempts SET status='succeeded',provider_reference=NULLIF(btrim(p_provider_reference),''),succeeded_at=now(),updated_at=now() WHERE id=p_attempt_id;
  UPDATE store_orders SET status='paid',payment_status='paid',payment_provider=v_attempt.provider,payment_reference=v_attempt.attempt_reference,paid_at=COALESCE(paid_at,now()),ordered_at=COALESCE(ordered_at,now()) WHERE id=v_order.id;
  UPDATE store_product_variants v SET stock_reserved=v.stock_reserved-r.quantity,stock_quantity=v.stock_quantity-r.quantity,stock_sold=v.stock_sold+r.quantity FROM store_inventory_reservations r WHERE r.order_id=v_order.id AND r.variant_id=v.id AND r.status='active';
  UPDATE store_inventory_reservations SET status='consumed',consumed_at=now() WHERE order_id=v_order.id AND status='active';
  INSERT INTO store_procurements(order_id,source,supplier_id)
    SELECT v_order.id,CASE WHEN bool_and(COALESCE(s.source,'manual')='1688') THEN '1688' ELSE 'manual' END,(array_agg(i.supplier_id))[1]
    FROM store_order_items i LEFT JOIN store_suppliers s ON s.id=i.supplier_id WHERE i.order_id=v_order.id ON CONFLICT DO NOTHING;
  INSERT INTO store_order_events(order_id,event_type,message) VALUES(v_order.id,'paid','Payment confirmed and inventory consumed'); RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.close_store_payment_attempt(p_attempt_id uuid,p_confirmed_closed boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_order uuid; BEGIN
  SELECT order_id INTO v_order FROM store_payment_attempts WHERE id=p_attempt_id; IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM store_orders WHERE id=v_order FOR UPDATE;
  PERFORM 1 FROM store_payment_attempts WHERE id=p_attempt_id FOR UPDATE;
  UPDATE store_payment_attempts SET status='closed',closed_at=now(),updated_at=now() WHERE id=p_attempt_id AND status='pending';
  -- Closing a provider attempt never releases inventory. Cancellation is the
  -- only release path, so switching providers preserves the reservation.
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.request_store_refund(p_order_id uuid,p_user_id uuid,p_reason text,p_return_first boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_order store_orders; v_id uuid; BEGIN
  SELECT * INTO v_order FROM store_orders WHERE id=p_order_id AND user_id=p_user_id FOR UPDATE; IF NOT FOUND OR v_order.status NOT IN ('paid','sourcing','ordered','partially_shipped','shipped','delivered') THEN RAISE EXCEPTION 'order_not_refundable'; END IF;
  INSERT INTO store_aftersales(order_id,user_id,kind,status,reason,amount_cents) VALUES(p_order_id,p_user_id,CASE WHEN p_return_first THEN 'return_refund' ELSE 'refund' END,CASE WHEN p_return_first THEN 'return_required' ELSE 'requested' END,p_reason,v_order.total_cents) RETURNING id INTO v_id;
  UPDATE store_orders SET status='refund_pending' WHERE id=p_order_id; RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_store_native_order(p_order_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order store_orders; BEGIN
  SELECT * INTO v_order FROM store_orders WHERE id=p_order_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_order.status <> 'pending_payment' THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM store_payment_attempts WHERE order_id=p_order_id AND status IN ('pending','succeeded')) THEN RAISE EXCEPTION 'payment_attempted'; END IF;
  WITH released AS (UPDATE store_inventory_reservations SET status='released',released_at=now() WHERE order_id=p_order_id AND status='active' RETURNING variant_id,quantity)
  UPDATE store_product_variants v SET stock_reserved=v.stock_reserved-r.quantity FROM released r WHERE v.id=r.variant_id;
  UPDATE store_orders SET status='cancelled',payment_status='failed' WHERE id=p_order_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.approve_store_aftersale(p_aftersale_id uuid,p_return_first boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  UPDATE store_aftersales SET status=CASE WHEN p_return_first THEN 'return_required' ELSE 'refund_pending' END,approved_at=now() WHERE id=p_aftersale_id AND status='requested';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.mark_store_return_received(p_aftersale_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  UPDATE store_aftersales SET status='received',received_at=now() WHERE id=p_aftersale_id AND status IN ('return_required','returned');
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.update_store_procurement(p_order_id uuid,p_status text,p_external_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  UPDATE store_procurements SET status=p_status,external_reference=p_external_reference,updated_at=now() WHERE order_id=p_order_id;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.update_store_shipment(p_order_id uuid,p_status text,p_carrier text,p_tracking_number text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  INSERT INTO store_shipments(order_id,status,carrier,tracking_number,shipped_at,delivered_at)
  VALUES(p_order_id,p_status,p_carrier,p_tracking_number,CASE WHEN p_status IN ('shipped','delivered') THEN now() END,CASE WHEN p_status='delivered' THEN now() END)
  ON CONFLICT(order_id) DO UPDATE SET status=excluded.status,carrier=excluded.carrier,tracking_number=excluded.tracking_number,shipped_at=COALESCE(store_shipments.shipped_at,excluded.shipped_at),delivered_at=COALESCE(store_shipments.delivered_at,excluded.delivered_at),updated_at=now();
  UPDATE store_orders SET status=CASE WHEN p_status='delivered' THEN 'delivered' WHEN p_status='shipped' THEN 'shipped' ELSE status END,shipped_at=CASE WHEN p_status IN ('shipped','delivered') THEN COALESCE(shipped_at,now()) ELSE shipped_at END,delivered_at=CASE WHEN p_status='delivered' THEN now() ELSE delivered_at END WHERE id=p_order_id;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.save_store_native_catalog(p_product_id uuid,p_product jsonb,p_variants jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=coalesce(p_product_id,gen_random_uuid()); v jsonb; vid uuid; existing store_product_variants; sid uuid; source_id uuid; kept uuid[]:='{}';
BEGIN
  IF jsonb_typeof(p_variants) IS DISTINCT FROM 'array' OR jsonb_array_length(p_variants) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'catalog_variants_required'; END IF;
  IF p_product_id IS NOT NULL THEN
    PERFORM 1 FROM store_products WHERE id=pid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;
  END IF;
  IF (p_product->>'priceCents')::integer<=0 OR (p_product->>'shippingCents') IS NULL OR (p_product->>'shippingCents')::integer<0 THEN RAISE EXCEPTION 'catalog_price_shipping_required'; END IF;
  INSERT INTO store_products(id,slug,name,description,cover_url,source,status,currency,price_cents,shipping_cents,blocked_provinces,fulfillment_description,context_keys,created_by,checkout_mode)
  VALUES(pid,p_product->>'slug',p_product->>'name',p_product->>'description',nullif(p_product->>'coverUrl',''),'manual',coalesce(p_product->>'status','draft'),'CNY',(p_product->>'priceCents')::integer,(p_product->>'shippingCents')::integer,
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_product->'blockedProvinces','[]'))),p_product->>'fulfillmentDescription',ARRAY(SELECT jsonb_array_elements_text(coalesce(p_product->'contextKeys','[]'))),nullif(p_product->>'createdBy','')::uuid,'internal')
  ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,description=excluded.description,cover_url=excluded.cover_url,source='manual',status=excluded.status,price_cents=excluded.price_cents,compare_at_price_cents=NULL,shipping_cents=excluded.shipping_cents,blocked_provinces=excluded.blocked_provinces,fulfillment_description=excluded.fulfillment_description,context_keys=excluded.context_keys,checkout_mode='internal',external_channel=NULL,external_url=NULL,updated_at=now();
  INSERT INTO store_suppliers(name,source,alibaba_member_id,supports_drop_ship,status)
    VALUES('人工采购','manual','native-manual',true,'active') ON CONFLICT(source,alibaba_member_id) DO UPDATE SET supports_drop_ship=true RETURNING id INTO sid;
  FOR v IN SELECT value FROM jsonb_array_elements(p_variants) ORDER BY value->>'id' LOOP
    vid:=coalesce(nullif(v->>'id','')::uuid,gen_random_uuid());
    IF vid=ANY(kept) THEN RAISE EXCEPTION 'duplicate_variant'; END IF;
    SELECT * INTO existing FROM store_product_variants WHERE id=vid FOR UPDATE;
    IF FOUND AND existing.product_id<>pid THEN RAISE EXCEPTION 'variant_wrong_product'; END IF;
    IF (v->>'stockQuantity') IS NULL OR (v->>'stockQuantity')::integer<coalesce(existing.stock_reserved,0) THEN RAISE EXCEPTION 'stock_below_reserved'; END IF;
    INSERT INTO store_product_variants(id,product_id,name,sku,price_cents,stock_quantity,min_quantity,status)
      VALUES(vid,pid,v->>'name',v->>'sku',(v->>'priceCents')::integer,(v->>'stockQuantity')::integer,coalesce((v->>'minQuantity')::integer,1),coalesce(v->>'status','active'))
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,sku=excluded.sku,price_cents=excluded.price_cents,stock_quantity=excluded.stock_quantity,min_quantity=excluded.min_quantity,status=excluded.status,updated_at=now();
    kept:=array_append(kept,vid);
    UPDATE store_product_sources SET is_primary=false WHERE variant_id=vid;
    SELECT id INTO source_id FROM store_product_sources WHERE variant_id=vid AND supplier_id=sid ORDER BY created_at LIMIT 1 FOR UPDATE;
    IF source_id IS NULL THEN
      INSERT INTO store_product_sources(variant_id,supplier_id,offer_id,source_url,source_price_cents,is_primary)
        VALUES(vid,sid,NULL,nullif(v->>'supplierUrl',''),(v->>'costCents')::integer,true);
    ELSE
      UPDATE store_product_sources SET source_url=nullif(v->>'supplierUrl',''),source_price_cents=(v->>'costCents')::integer,is_primary=true WHERE id=source_id;
    END IF;
  END LOOP;
  UPDATE store_product_variants SET status='paused' WHERE product_id=pid AND NOT(id=ANY(kept));
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_store_refund(p_aftersale_id uuid,p_amount_cents integer,p_provider text,p_provider_ref text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  UPDATE store_aftersales SET status='refunded',provider=p_provider,provider_ref=p_provider_ref,refunded_at=now() WHERE id=p_aftersale_id AND amount_cents=p_amount_cents AND status IN ('refund_pending','received');
  IF NOT FOUND THEN RETURN false; END IF; UPDATE store_orders o SET status='refunded',payment_status='refunded' FROM store_aftersales a WHERE a.id=p_aftersale_id AND o.id=a.order_id; RETURN true;
END $$;

-- Prevent old callers from paying native orders; old external checkout rows retain compatibility.
CREATE OR REPLACE FUNCTION public.mark_store_order_paid(p_order_id uuid,p_provider text,p_reference text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF EXISTS (SELECT 1 FROM store_inventory_reservations WHERE order_id=p_order_id) THEN RAISE EXCEPTION 'native_order_requires_payment_attempt'; END IF;
  RETURN false;
END $$;

REVOKE ALL ON FUNCTION public.create_store_native_order(uuid,text,uuid,text,text,jsonb), public.start_store_payment_attempt(uuid,text,text), public.confirm_store_payment(uuid,integer,text,text), public.close_store_payment_attempt(uuid,boolean), public.request_store_refund(uuid,uuid,text,boolean), public.confirm_store_refund(uuid,integer,text,text), public.cancel_store_native_order(uuid,uuid), public.approve_store_aftersale(uuid,boolean), public.mark_store_return_received(uuid), public.update_store_procurement(uuid,text,text), public.update_store_shipment(uuid,text,text,text), public.save_store_native_catalog(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_store_native_order(uuid,text,uuid,text,text,jsonb), public.start_store_payment_attempt(uuid,text,text), public.confirm_store_payment(uuid,integer,text,text), public.close_store_payment_attempt(uuid,boolean), public.request_store_refund(uuid,uuid,text,boolean), public.confirm_store_refund(uuid,integer,text,text), public.cancel_store_native_order(uuid,uuid), public.approve_store_aftersale(uuid,boolean), public.mark_store_return_received(uuid), public.update_store_procurement(uuid,text,text), public.update_store_shipment(uuid,text,text,text), public.save_store_native_catalog(uuid,jsonb,jsonb) TO service_role;
ALTER TABLE public.store_inventory_reservations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.store_payment_attempts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.store_procurements ENABLE ROW LEVEL SECURITY; ALTER TABLE public.store_shipments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.store_aftersales ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_inventory_service_only ON public.store_inventory_reservations FOR ALL USING(false) WITH CHECK(false);
CREATE POLICY store_payment_service_only ON public.store_payment_attempts FOR ALL USING(false) WITH CHECK(false);
CREATE POLICY store_procurement_service_only ON public.store_procurements FOR ALL USING(false) WITH CHECK(false);
CREATE POLICY store_shipment_service_only ON public.store_shipments FOR ALL USING(false) WITH CHECK(false);
CREATE POLICY store_aftersale_owner_read ON public.store_aftersales FOR SELECT USING((select auth.uid())=user_id);
REVOKE ALL ON public.store_inventory_reservations,public.store_payment_attempts,public.store_procurements,public.store_shipments FROM anon,authenticated;
GRANT SELECT ON public.store_aftersales TO authenticated;
COMMIT;
