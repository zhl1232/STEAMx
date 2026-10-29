-- Fixed per-order province overrides; existing orders retain their shipping snapshot.
CREATE FUNCTION public.valid_store_shipping_overrides(value jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE item record;
BEGIN
 IF jsonb_typeof(value) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 FOR item IN SELECT * FROM jsonb_each(value) LOOP
  IF NOT(item.key=ANY(ARRAY['北京市','天津市','河北省','山西省','内蒙古自治区','辽宁省','吉林省','黑龙江省','上海市','江苏省','浙江省','安徽省','福建省','江西省','山东省','河南省','湖北省','湖南省','广东省','广西壮族自治区','海南省','重庆市','四川省','贵州省','云南省','西藏自治区','陕西省','甘肃省','青海省','宁夏回族自治区','新疆维吾尔自治区'])) OR jsonb_typeof(item.value)<>'number' THEN RETURN false; END IF;
  IF item.value::text !~ '^[0-9]+$' THEN RETURN false; END IF;
  IF (item.value::text)::numeric>100000000 THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
ALTER TABLE public.store_products ADD COLUMN shipping_province_overrides jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(public.valid_store_shipping_overrides(shipping_province_overrides));
CREATE FUNCTION public.calculate_store_shipping(p_default integer,p_overrides jsonb,p_province text) RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
 IF p_province IS NULL OR NOT(p_province=ANY(ARRAY['北京市','天津市','河北省','山西省','内蒙古自治区','辽宁省','吉林省','黑龙江省','上海市','江苏省','浙江省','安徽省','福建省','江西省','山东省','河南省','湖北省','湖南省','广东省','广西壮族自治区','海南省','重庆市','四川省','贵州省','云南省','西藏自治区','陕西省','甘肃省','青海省','宁夏回族自治区','新疆维吾尔自治区'])) THEN RAISE EXCEPTION 'mainland_province_required'; END IF;
 IF NOT valid_store_shipping_overrides(p_overrides) OR p_default IS NULL OR p_default<0 THEN RAISE EXCEPTION 'shipping_configuration_invalid'; END IF;
 RETURN coalesce((p_overrides->>p_province)::integer,p_default);
END $$;
REVOKE ALL ON FUNCTION public.calculate_store_shipping(integer,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_store_shipping(integer,jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.quote_store_native_order(p_user_id uuid,p_province text,p_items jsonb,p_coupon_id uuid DEFAULT NULL,p_use_coins boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v record; c store_user_coupons; qty integer; original integer; member_total integer; tier text; discount integer:=0; coins integer:=0; evaluated_at timestamptz:=clock_timestamp();
BEGIN
 IF p_use_coins THEN RAISE EXCEPTION 'direct_coins_disabled'; END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)<>1 THEN RAISE EXCEPTION 'native_order_requires_one_sku'; END IF;
 qty:=(p_items->0->>'quantity')::integer;
 SELECT a.*,calculate_store_shipping(p.shipping_cents,p.shipping_province_overrides,p_province) shipping_cents,p.blocked_provinces,p.price_cents product_price,p.status product_status,p.checkout_mode
 INTO v FROM store_product_variants a JOIN store_products p ON p.id=a.product_id WHERE a.id=(p_items->0->>'variant_id')::uuid;
 IF NOT FOUND OR qty IS NULL OR qty NOT BETWEEN 1 AND 100 OR qty<v.min_quantity OR v.status<>'active' OR v.product_status<>'active' OR v.checkout_mode<>'internal' OR v.shipping_cents IS NULL OR v.stock_quantity IS NULL OR v.stock_quantity-v.stock_reserved<qty THEN RAISE EXCEPTION 'native_variant_unavailable'; END IF;
 IF p_province=ANY(v.blocked_provinces) THEN RAISE EXCEPTION 'province_blocked'; END IF;
 tier:=coalesce(store_effective_member_tier(p_user_id,evaluated_at),'free');
 original:=coalesce(v.price_cents,v.product_price)*qty;
 member_total:=round(original::numeric * CASE tier WHEN 'founder' THEN 0.80 WHEN 'pro' THEN 0.88 ELSE 1 END)::integer;
 IF p_coupon_id IS NOT NULL AND p_use_coins THEN RAISE EXCEPTION 'coupon_and_coins_exclusive'; END IF;
 IF p_coupon_id IS NOT NULL THEN
  SELECT * INTO c FROM store_user_coupons WHERE id=p_coupon_id AND user_id=p_user_id;
  IF NOT FOUND OR (c.usage_policy='founder' AND tier<>'founder') OR c.status<>'available' OR c.expires_at<=evaluated_at OR member_total<c.threshold_cents OR c.discount_cents>=member_total OR NOT(v.product_id=ANY(c.eligible_product_ids)) THEN RAISE EXCEPTION 'coupon_unavailable'; END IF;
  discount:=c.discount_cents;
 END IF;

 RETURN jsonb_build_object('originalSubtotalCents',original,'memberSubtotalCents',member_total,'memberDiscountCents',original-member_total,
 'membershipTier',tier,'shippingCents',v.shipping_cents,'couponDiscountCents',discount,'coinDiscountCents',coins,'coinsUsed',coins,'totalCents',member_total+v.shipping_cents-discount-coins,'couponId',p_coupon_id);
END $$;
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
    SELECT v.*, p.name product_name, calculate_store_shipping(p.shipping_cents,p.shipping_province_overrides,p_province) shipping_cents, p.blocked_provinces, p.status product_status, p.source product_source
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

-- Patch the current saver in place so media, locking and version checks remain intact.
DO $migration$
DECLARE definition text; changed text;
BEGIN
 SELECT pg_get_functiondef('public.save_store_native_catalog(uuid,jsonb,jsonb)'::regprocedure) INTO definition;
 changed:=replace(definition,'  RETURN pid;', $patch$
  IF p_product ? 'shippingProvinceOverrides' THEN
   UPDATE store_products SET shipping_province_overrides=p_product->'shippingProvinceOverrides' WHERE id=pid;
  END IF;
  RETURN pid;$patch$);
 IF changed=definition THEN RAISE EXCEPTION 'catalog_shipping_patch_target_missing'; END IF;
 EXECUTE changed;
END $migration$;
