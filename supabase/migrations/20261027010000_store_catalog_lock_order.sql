-- Existing save_store_native_catalog locks its product before variants.
-- Repair both purchase entry points to use that same order. Replacing functions
-- in place preserves their owners, SECURITY DEFINER settings and execution ACLs.
-- Do not rename/wrap catalog functions: preserve all current media/version rules.

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
    -- Catalog writers lock the parent product before touching any variants.
    -- Use separate statements: FOR UPDATE on a join does not promise row-mark order.
    PERFORM 1 FROM store_products p
      WHERE p.id=(SELECT product_id FROM store_product_variants WHERE id=(v_item->>'variant_id')::uuid)
      FOR UPDATE OF p;
    SELECT v.*, p.name product_name, p.shipping_cents, p.blocked_provinces, p.status product_status, p.source product_source
      INTO v_variant FROM store_product_variants v JOIN store_products p ON p.id=v.product_id
      WHERE v.id=(v_item->>'variant_id')::uuid FOR UPDATE OF v;
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
    SELECT v.*, p.name product_name, p.shipping_cents INTO v_variant FROM store_product_variants v JOIN store_products p ON p.id=v.product_id WHERE v.id=(v_item->>'variant_id')::uuid FOR UPDATE OF v;
    INSERT INTO store_order_items(order_id,product_id,variant_id,supplier_id,title_snapshot,sku_snapshot,quantity,unit_price_cents,offer_id,spec_id,metadata)
      SELECT v_order,v_variant.product_id,v_variant.id,s.supplier_id,v_variant.product_name,v_variant.sku,v_qty,COALESCE(v_variant.price_cents,p.price_cents),s.offer_id,s.spec_id,jsonb_build_object('variantName',v_variant.name,'contextKeys',p.context_keys,'fulfillmentDescription',p.fulfillment_description)
      FROM store_products p LEFT JOIN LATERAL (SELECT * FROM store_product_sources WHERE variant_id=v_variant.id AND is_primary LIMIT 1) s ON true WHERE p.id=v_variant.product_id;
    INSERT INTO store_inventory_reservations(order_id,variant_id,quantity) VALUES(v_order,v_variant.id,v_qty);
    UPDATE store_product_variants SET stock_reserved=stock_reserved+v_qty WHERE id=v_variant.id;
  END LOOP;
  INSERT INTO store_order_events(order_id,event_type,message) VALUES(v_order,'created','Native order created; inventory reserved for 30 minutes');
  RETURN v_order;
END $$;

CREATE OR REPLACE FUNCTION public.create_store_native_order_v1(p_user_id uuid,p_external_order_id text,p_address_id uuid,p_address_snapshot_encrypted text,p_province text,p_items jsonb,p_expected_quote jsonb,p_coupon_id uuid DEFAULT NULL,p_use_coins boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oid uuid; q jsonb; used integer;
BEGIN
 IF p_user_id IS NULL OR length(btrim(coalesce(p_external_order_id,''))) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'idempotency_key_required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_external_order_id,0));
 SELECT id INTO oid FROM store_orders WHERE user_id=p_user_id AND external_order_id=p_external_order_id;
 IF FOUND THEN RETURN oid; END IF;
 -- Match save_store_native_catalog: product -> variant -> profile -> coupon.
 -- Keep parent and child locking in separate statements to make order explicit.
 PERFORM 1 FROM store_products p
   WHERE p.id=(SELECT product_id FROM store_product_variants WHERE id=(p_items->0->>'variant_id')::uuid)
   FOR UPDATE OF p;
 PERFORM 1 FROM store_product_variants WHERE id=(p_items->0->>'variant_id')::uuid FOR UPDATE;
 PERFORM 1 FROM profiles WHERE id=p_user_id FOR UPDATE;
 IF p_coupon_id IS NOT NULL THEN PERFORM 1 FROM store_user_coupons WHERE id=p_coupon_id FOR UPDATE; END IF;
 q:=quote_store_native_order(p_user_id,p_province,p_items,p_coupon_id,p_use_coins);
 IF p_expected_quote IS NULL OR p_expected_quote IS DISTINCT FROM q THEN RAISE EXCEPTION 'quote_changed'; END IF;
 oid:=create_store_native_order(p_user_id,p_external_order_id,p_address_id,p_address_snapshot_encrypted,p_province,p_items);
 used:=(q->>'coinsUsed')::integer;
 UPDATE store_orders SET original_subtotal_cents=(q->>'originalSubtotalCents')::integer,member_subtotal_cents=(q->>'memberSubtotalCents')::integer,
 member_discount_cents=(q->>'memberDiscountCents')::integer,coupon_discount_cents=(q->>'couponDiscountCents')::integer,coin_discount_cents=used,coins_used=used,
 membership_tier_snapshot=q->>'membershipTier',coupon_id=p_coupon_id,total_cents=(q->>'totalCents')::integer WHERE id=oid;
 INSERT INTO store_order_procurement_snapshots(order_id,snapshot)
 SELECT oid,jsonb_build_object('productId',p.id,'variantId',v.id,'variantName',v.name,'sku',v.sku,'source',p.source,'supplierId',s.supplier_id,'supplierUrl',s.source_url,'costCents',s.source_price_cents,'offerId',s.offer_id,'specId',s.spec_id,'sourceMetadata',s.payload)
 FROM store_product_variants v JOIN store_products p ON p.id=v.product_id LEFT JOIN store_product_sources s ON s.variant_id=v.id AND s.is_primary WHERE v.id=(p_items->0->>'variant_id')::uuid;
 IF used>0 THEN
  UPDATE profiles SET coins=coins-used WHERE id=p_user_id AND coins>=used;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_coins'; END IF;
  INSERT INTO store_coin_holds(order_id,user_id,coins) VALUES(oid,p_user_id,used);
  INSERT INTO coin_logs(user_id,amount,action_type,resource_id) VALUES(p_user_id,-used,'store_redeem',oid::text);
  INSERT INTO store_benefit_ledger(order_id,user_id,event,coins) VALUES(oid,p_user_id,'coin_reserved',-used);
 END IF;
 IF p_coupon_id IS NOT NULL THEN
  UPDATE store_user_coupons SET status='reserved',order_id=oid WHERE id=p_coupon_id AND status='available';
  IF NOT FOUND THEN RAISE EXCEPTION 'coupon_unavailable'; END IF;
  INSERT INTO store_benefit_ledger(order_id,user_id,event,coupon_id) VALUES(oid,p_user_id,'coupon_reserved',p_coupon_id);
 END IF;
 RETURN oid;
END $$;
