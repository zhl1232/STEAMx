-- Cash-store v1. No flags or membership records are changed by this migration.
ALTER TABLE public.store_products ADD COLUMN gallery_urls text[] NOT NULL DEFAULT '{}', ADD COLUMN detail_content text, ADD COLUMN video_url text, ADD COLUMN category text;
ALTER TABLE public.store_orders
 ADD COLUMN original_subtotal_cents integer NOT NULL DEFAULT 0 CHECK(original_subtotal_cents>=0),
 ADD COLUMN member_subtotal_cents integer NOT NULL DEFAULT 0 CHECK(member_subtotal_cents>=0),
 ADD COLUMN member_discount_cents integer NOT NULL DEFAULT 0 CHECK(member_discount_cents>=0),
 ADD COLUMN coupon_discount_cents integer NOT NULL DEFAULT 0 CHECK(coupon_discount_cents>=0),
 ADD COLUMN coin_discount_cents integer NOT NULL DEFAULT 0 CHECK(coin_discount_cents>=0),
 ADD COLUMN coins_used integer NOT NULL DEFAULT 0 CHECK(coins_used>=0),
 ADD COLUMN membership_tier_snapshot text NOT NULL DEFAULT 'free' CHECK(membership_tier_snapshot IN ('free','pro','founder')),
 ADD COLUMN coupon_id uuid;
UPDATE public.store_orders SET original_subtotal_cents=subtotal_cents,member_subtotal_cents=subtotal_cents;
-- Keep orders created by the previous server RPC readable during the application rollout.
-- The v1 creator calls that RPC before replacing these base amounts with its frozen quote.
CREATE FUNCTION public.fill_store_order_legacy_amounts() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.original_subtotal_cents=0 AND NEW.member_subtotal_cents=0 AND NEW.subtotal_cents>0
  AND NEW.member_discount_cents=0 AND NEW.coupon_discount_cents=0 AND NEW.coin_discount_cents=0
  AND NEW.coins_used=0 AND NEW.coupon_id IS NULL AND NEW.membership_tier_snapshot='free' THEN
  NEW.original_subtotal_cents:=NEW.subtotal_cents;
  NEW.member_subtotal_cents:=NEW.subtotal_cents;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fill_store_order_legacy_amounts() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fill_store_order_legacy_amounts() TO service_role;
CREATE TRIGGER store_order_legacy_amounts BEFORE INSERT ON public.store_orders
 FOR EACH ROW EXECUTE FUNCTION public.fill_store_order_legacy_amounts();
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.store_orders'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%total_cents%subtotal_cents%shipping_cents%' LOOP
  EXECUTE format('ALTER TABLE public.store_orders DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE public.store_orders ADD CONSTRAINT store_orders_total_cents_check CHECK(total_cents=subtotal_cents+shipping_cents-member_discount_cents-coupon_discount_cents-coin_discount_cents);
ALTER TABLE public.store_orders ADD CONSTRAINT store_orders_benefits_check CHECK(
 (coupon_discount_cents=0 OR coin_discount_cents=0) AND coins_used=coin_discount_cents AND
 member_discount_cents+coupon_discount_cents+coin_discount_cents<=subtotal_cents);
CREATE TABLE public.store_coupon_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 180),
 threshold_cents integer NOT NULL CHECK(threshold_cents>0), discount_cents integer NOT NULL CHECK(discount_cents>0 AND discount_cents<threshold_cents),
 eligible_product_ids uuid[] NOT NULL DEFAULT '{}',
 valid_days integer CHECK(valid_days BETWEEN 1 AND 366), terms text, active boolean NOT NULL DEFAULT false,
 created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT active OR (valid_days IS NOT NULL AND terms IS NOT NULL AND length(btrim(terms))>0 AND cardinality(eligible_product_ids)>0))
);
INSERT INTO public.store_coupon_templates(title,threshold_cents,discount_cents) VALUES('满50减5（待配置）',5000,500);
CREATE TABLE public.store_coupon_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_id uuid NOT NULL REFERENCES public.store_coupon_templates(id),
 batch_key text NOT NULL UNIQUE CHECK(length(batch_key) BETWEEN 1 AND 180), created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.store_user_coupons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES public.store_coupon_batches(id),
 user_id uuid NOT NULL REFERENCES auth.users(id), title text NOT NULL, threshold_cents integer NOT NULL CHECK(threshold_cents>0),
 discount_cents integer NOT NULL CHECK(discount_cents>0 AND discount_cents<threshold_cents), terms text NOT NULL, eligible_product_ids uuid[] NOT NULL,
 expires_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','used')),
 order_id uuid REFERENCES public.store_orders(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(batch_id,user_id),
 CHECK((status='available' AND order_id IS NULL) OR (status IN ('reserved','used') AND order_id IS NOT NULL))
);
ALTER TABLE public.store_orders ADD CONSTRAINT store_order_coupon_fkey FOREIGN KEY(coupon_id) REFERENCES public.store_user_coupons(id);
CREATE INDEX store_user_coupons_user ON public.store_user_coupons(user_id,status,expires_at);
CREATE TABLE public.store_coin_holds (
 order_id uuid PRIMARY KEY REFERENCES public.store_orders(id), user_id uuid NOT NULL REFERENCES auth.users(id),
 coins integer NOT NULL CHECK(coins>0), status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','consumed','returned')),
 created_at timestamptz NOT NULL DEFAULT now(), returned_at timestamptz
);
CREATE INDEX store_coin_holds_user ON public.store_coin_holds(user_id);
CREATE TABLE public.store_benefit_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.store_orders(id),
 user_id uuid NOT NULL REFERENCES auth.users(id), event text NOT NULL CHECK(event IN ('coin_reserved','coin_returned','coupon_reserved','coupon_used','coupon_returned')),
 coins integer NOT NULL DEFAULT 0, coupon_id uuid REFERENCES public.store_user_coupons(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,event)
);
CREATE TABLE public.store_order_procurement_snapshots (
 order_id uuid PRIMARY KEY REFERENCES public.store_orders(id), snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.store_effective_member_tier(p_user_id uuid,p_at timestamptz DEFAULT clock_timestamp()) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN membership_tier='founder' AND membership_period='founder' THEN 'founder'
 WHEN membership_tier='pro' AND (membership_period='lifetime' OR (membership_period IN ('monthly','yearly') AND membership_expires_at>p_at)) THEN 'pro'
 ELSE 'free' END FROM profiles WHERE id=p_user_id
$$;
CREATE FUNCTION public.quote_store_native_order(p_user_id uuid,p_province text,p_items jsonb,p_coupon_id uuid DEFAULT NULL,p_use_coins boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v record; c store_user_coupons; qty integer; original integer; member_total integer; tier text; discount integer:=0; coins integer:=0; balance integer; evaluated_at timestamptz:=clock_timestamp();
BEGIN
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)<>1 THEN RAISE EXCEPTION 'native_order_requires_one_sku'; END IF;
 qty:=(p_items->0->>'quantity')::integer;
 SELECT a.*,p.shipping_cents,p.blocked_provinces,p.price_cents product_price,p.status product_status,p.checkout_mode
 INTO v FROM store_product_variants a JOIN store_products p ON p.id=a.product_id WHERE a.id=(p_items->0->>'variant_id')::uuid;
 IF NOT FOUND OR qty IS NULL OR qty NOT BETWEEN 1 AND 100 OR qty<v.min_quantity OR v.status<>'active' OR v.product_status<>'active' OR v.checkout_mode<>'internal' OR v.shipping_cents IS NULL OR v.stock_quantity IS NULL OR v.stock_quantity-v.stock_reserved<qty THEN RAISE EXCEPTION 'native_variant_unavailable'; END IF;
 IF p_province=ANY(v.blocked_provinces) THEN RAISE EXCEPTION 'province_blocked'; END IF;
 tier:=coalesce(store_effective_member_tier(p_user_id,evaluated_at),'free');
 original:=coalesce(v.price_cents,v.product_price)*qty;
 member_total:=round(original::numeric * CASE tier WHEN 'founder' THEN 0.80 WHEN 'pro' THEN 0.88 ELSE 1 END)::integer;
 IF p_coupon_id IS NOT NULL AND p_use_coins THEN RAISE EXCEPTION 'coupon_and_coins_exclusive'; END IF;
 IF p_coupon_id IS NOT NULL THEN
  SELECT * INTO c FROM store_user_coupons WHERE id=p_coupon_id AND user_id=p_user_id;
  IF NOT FOUND OR tier<>'founder' OR c.status<>'available' OR c.expires_at<=evaluated_at OR member_total<c.threshold_cents OR c.discount_cents>=member_total OR NOT(v.product_id=ANY(c.eligible_product_ids)) THEN RAISE EXCEPTION 'coupon_unavailable'; END IF;
  discount:=c.discount_cents;
 END IF;
 IF p_use_coins THEN
  IF tier='free' THEN RAISE EXCEPTION 'active_membership_required'; END IF;
  SELECT greatest(coalesce(profiles.coins,0),0) INTO balance FROM profiles WHERE id=p_user_id;
  coins:=least(balance,floor(member_total::numeric/10)::integer,greatest(member_total-1,0));
 END IF;
 RETURN jsonb_build_object('originalSubtotalCents',original,'memberSubtotalCents',member_total,'memberDiscountCents',original-member_total,
 'membershipTier',tier,'shippingCents',v.shipping_cents,'couponDiscountCents',discount,'coinDiscountCents',coins,'coinsUsed',coins,'totalCents',member_total+v.shipping_cents-discount-coins,'couponId',p_coupon_id);
END $$;
CREATE FUNCTION public.create_store_native_order_v1(p_user_id uuid,p_external_order_id text,p_address_id uuid,p_address_snapshot_encrypted text,p_province text,p_items jsonb,p_expected_quote jsonb,p_coupon_id uuid DEFAULT NULL,p_use_coins boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oid uuid; q jsonb; used integer;
BEGIN
 IF p_user_id IS NULL OR length(btrim(coalesce(p_external_order_id,''))) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'idempotency_key_required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_external_order_id,0));
 SELECT id INTO oid FROM store_orders WHERE user_id=p_user_id AND external_order_id=p_external_order_id;
 IF FOUND THEN RETURN oid; END IF;
 -- Lock catalog first, then profile, matching cancellation's inventory -> profile order.
 PERFORM 1 FROM store_product_variants v JOIN store_products p ON p.id=v.product_id WHERE v.id=(p_items->0->>'variant_id')::uuid FOR UPDATE OF v,p;
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
CREATE FUNCTION public.settle_store_order_benefits() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE amount integer;
BEGIN
 IF NEW.status=OLD.status THEN RETURN NEW; END IF;
 IF NEW.status='paid' THEN
  UPDATE store_coin_holds SET status='consumed' WHERE order_id=NEW.id AND status='reserved';
  UPDATE store_user_coupons SET status='used' WHERE order_id=NEW.id AND status='reserved';
  IF FOUND THEN INSERT INTO store_benefit_ledger(order_id,user_id,event,coupon_id) VALUES(NEW.id,NEW.user_id,'coupon_used',NEW.coupon_id) ON CONFLICT DO NOTHING; END IF;
 ELSIF NEW.status IN ('cancelled','refunded') THEN
  -- Only existing verified state-machine RPCs can reach these states.
  UPDATE store_coin_holds SET status='returned',returned_at=now() WHERE order_id=NEW.id AND status IN ('reserved','consumed') RETURNING coins INTO amount;
  IF FOUND THEN
   UPDATE profiles SET coins=coalesce(coins,0)+amount WHERE id=NEW.user_id;
   INSERT INTO coin_logs(user_id,amount,action_type,resource_id) VALUES(NEW.user_id,amount,'store_release',NEW.id::text);
   INSERT INTO store_benefit_ledger(order_id,user_id,event,coins) VALUES(NEW.id,NEW.user_id,'coin_returned',amount) ON CONFLICT DO NOTHING;
  END IF;
  UPDATE store_user_coupons SET status='available',order_id=NULL WHERE order_id=NEW.id AND status IN ('reserved','used');
  IF FOUND THEN INSERT INTO store_benefit_ledger(order_id,user_id,event,coupon_id) VALUES(NEW.id,NEW.user_id,'coupon_returned',NEW.coupon_id) ON CONFLICT DO NOTHING; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER store_order_benefits AFTER UPDATE OF status ON public.store_orders FOR EACH ROW EXECUTE FUNCTION public.settle_store_order_benefits();
CREATE FUNCTION public.grant_store_coupon_batch(p_admin_id uuid,p_template_id uuid,p_batch_key text,p_user_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t store_coupon_templates; bid uuid; uid uuid; inserted integer:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_admin_id AND role='admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
 IF cardinality(p_user_ids) NOT BETWEEN 1 AND 500 OR length(btrim(p_batch_key)) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'invalid_batch'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('coupon-batch:'||p_batch_key,0));
 SELECT id INTO bid FROM store_coupon_batches WHERE batch_key=p_batch_key;
 IF FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM store_coupon_batches WHERE id=bid AND template_id=p_template_id) THEN RAISE EXCEPTION 'batch_key_conflict'; END IF;
  RETURN jsonb_build_object('batchId',bid,'grantedCount',(SELECT count(*) FROM store_user_coupons WHERE batch_id=bid));
 END IF;
 SELECT * INTO t FROM store_coupon_templates WHERE id=p_template_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'coupon_template_inactive'; END IF;
 -- Lock all recipients before creating any grants; invalid recipients abort the batch.
 FOR uid IN SELECT DISTINCT unnest(p_user_ids) ORDER BY 1 LOOP
  PERFORM 1 FROM profiles WHERE id=uid FOR UPDATE;
  IF store_effective_member_tier(uid) IS DISTINCT FROM 'founder' THEN RAISE EXCEPTION 'founder_required'; END IF;
 END LOOP;
 INSERT INTO store_coupon_batches(template_id,batch_key,created_by) VALUES(p_template_id,p_batch_key,p_admin_id) RETURNING id INTO bid;
 INSERT INTO store_user_coupons(batch_id,user_id,title,threshold_cents,discount_cents,terms,eligible_product_ids,expires_at)
 SELECT bid,x,t.title,t.threshold_cents,t.discount_cents,t.terms,t.eligible_product_ids,clock_timestamp()+make_interval(days=>t.valid_days) FROM (SELECT DISTINCT unnest(p_user_ids) x) a;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 RETURN jsonb_build_object('batchId',bid,'grantedCount',inserted);
END $$;
-- Granted terms and the procurement evidence are append-only; lifecycle fields alone may change.
CREATE FUNCTION public.protect_store_coupon_terms() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'coupon_terms_immutable'; END IF;
 IF (to_jsonb(NEW)-'status'-'order_id') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'order_id') THEN RAISE EXCEPTION 'coupon_terms_immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER store_coupon_terms BEFORE UPDATE OR DELETE ON public.store_user_coupons FOR EACH ROW EXECUTE FUNCTION public.protect_store_coupon_terms();
CREATE FUNCTION public.protect_store_procurement_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'procurement_snapshot_immutable'; END $$;
CREATE TRIGGER store_procurement_snapshot_immutable BEFORE UPDATE OR DELETE ON public.store_order_procurement_snapshots FOR EACH ROW EXECUTE FUNCTION public.protect_store_procurement_snapshot();
CREATE OR REPLACE FUNCTION public.save_store_native_catalog(p_product_id uuid,p_product jsonb,p_variants jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=coalesce(p_product_id,gen_random_uuid()); v jsonb; vid uuid; existing store_product_variants; sid uuid; source_id uuid; current_version integer; kept uuid[]:='{}';
BEGIN
  IF jsonb_typeof(p_variants) IS DISTINCT FROM 'array' OR jsonb_array_length(p_variants) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'catalog_variants_required'; END IF;
  IF p_product_id IS NOT NULL THEN
    SELECT catalog_version INTO current_version FROM store_products WHERE id=pid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;
    IF (p_product->>'version')::integer IS DISTINCT FROM current_version THEN RAISE EXCEPTION 'catalog_version_conflict'; END IF;
  END IF;
  IF (p_product->>'priceCents')::integer<=0 OR ((p_product->>'status')='active' AND ((p_product->>'shippingCents') IS NULL OR nullif(btrim(p_product->>'fulfillmentDescription'),'') IS NULL)) OR (p_product->>'shippingCents')::integer<0 THEN RAISE EXCEPTION 'catalog_price_shipping_required'; END IF;
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
    IF FOUND AND (v->>'version')::integer IS DISTINCT FROM existing.catalog_version THEN RAISE EXCEPTION 'catalog_version_conflict'; END IF;
    IF existing.id IS NOT NULL AND existing.product_id<>pid THEN RAISE EXCEPTION 'variant_wrong_product'; END IF;
    IF ((v->>'stockQuantity') IS NULL AND (p_product->>'status')='active') OR (v->>'stockQuantity')::integer<coalesce(existing.stock_reserved,0) OR ((v->>'stockQuantity') IS NULL AND coalesce(existing.stock_reserved,0)>0) THEN RAISE EXCEPTION 'stock_below_reserved'; END IF;
    IF (p_product->>'status')='active' AND coalesce(v->>'status','active')='active' AND (nullif(btrim(v->>'supplierUrl'),'') IS NULL OR (v->>'costCents') IS NULL) THEN RAISE EXCEPTION 'active_source_required'; END IF;
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
  UPDATE store_products SET
    gallery_urls=CASE WHEN p_product ? 'galleryUrls' THEN ARRAY(SELECT jsonb_array_elements_text(coalesce(nullif(p_product->'galleryUrls','null'::jsonb),'[]'::jsonb))) ELSE gallery_urls END,
    detail_content=CASE WHEN p_product ? 'detailContent' THEN p_product->>'detailContent' ELSE detail_content END,
    video_url=CASE WHEN p_product ? 'videoUrl' THEN nullif(p_product->>'videoUrl','') ELSE video_url END,
    category=CASE WHEN p_product ? 'category' THEN nullif(p_product->>'category','') ELSE category END
   WHERE id=pid;
  RETURN pid;
END $$;


DO $$ DECLARE tab text; fun record; BEGIN
 FOREACH tab IN ARRAY ARRAY['store_coupon_templates','store_coupon_batches','store_user_coupons','store_coin_holds','store_benefit_ledger','store_order_procurement_snapshots'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',tab);
 END LOOP;
 FOR fun IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('store_effective_member_tier','quote_store_native_order','create_store_native_order_v1','settle_store_order_benefits','grant_store_coupon_batch','protect_store_coupon_terms','protect_store_procurement_snapshot') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fun.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fun.signature);
 END LOOP;
END $$;
-- Owner RLS remains in force; procurement evidence and encrypted addresses stay private.
GRANT SELECT (original_subtotal_cents,member_subtotal_cents,member_discount_cents,
 coupon_discount_cents,coin_discount_cents,coins_used,membership_tier_snapshot,coupon_id)
 ON public.store_orders TO authenticated;
NOTIFY pgrst, 'reload schema';
