-- Existing order settlement and coin holds intentionally remain unchanged.
ALTER TABLE public.store_user_coupons ALTER COLUMN batch_id DROP NOT NULL;
ALTER TABLE public.store_user_coupons ADD COLUMN source text NOT NULL DEFAULT 'admin_grant' CHECK(source IN ('admin_grant','coin_exchange')), ADD COLUMN usage_policy text NOT NULL DEFAULT 'founder' CHECK(usage_policy IN ('founder','all')), ADD COLUMN exchange_id uuid;
CREATE TABLE public.store_coupon_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_id uuid NOT NULL REFERENCES store_coupon_templates(id),
 coin_price integer NOT NULL CHECK(coin_price>0), total_limit integer NOT NULL CHECK(total_limit>0), per_user_limit integer NOT NULL CHECK(per_user_limit>0),
 redeemed_count integer NOT NULL DEFAULT 0 CHECK(redeemed_count>=0 AND redeemed_count<=total_limit),
 active boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.store_coupon_exchanges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_id uuid NOT NULL REFERENCES store_coupon_offers(id), user_id uuid NOT NULL REFERENCES auth.users(id),
 intent_key text NOT NULL CHECK(length(intent_key) BETWEEN 1 AND 180), coupon_id uuid NOT NULL UNIQUE, coins_spent integer NOT NULL CHECK(coins_spent>0), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,intent_key)
);
CREATE INDEX store_coupon_exchange_user_offer ON store_coupon_exchanges(user_id,offer_id);
ALTER TABLE store_user_coupons ADD CONSTRAINT coupon_exchange_fk FOREIGN KEY(exchange_id) REFERENCES store_coupon_exchanges(id);
ALTER TABLE store_coupon_exchanges ADD CONSTRAINT exchange_coupon_fk FOREIGN KEY(coupon_id) REFERENCES store_user_coupons(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE store_user_coupons ADD CONSTRAINT coupon_source_valid CHECK((source='admin_grant' AND batch_id IS NOT NULL AND exchange_id IS NULL AND usage_policy='founder') OR (source='coin_exchange' AND batch_id IS NULL AND exchange_id IS NOT NULL AND usage_policy='all'));
CREATE FUNCTION public.store_coupon_offer_version(o store_coupon_offers,t store_coupon_templates) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT md5(o.id::text || ':' || o.version::text || ':' || to_jsonb(t)::text) $$;
CREATE FUNCTION public.store_coupon_offer_purchasable(t store_coupon_templates,p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM store_products p JOIN store_product_variants v ON v.product_id=p.id
 WHERE p.id=ANY(t.eligible_product_ids) AND p.status='active' AND p.checkout_mode='internal' AND p.shipping_cents IS NOT NULL AND v.status='active'
 AND v.stock_quantity IS NOT NULL AND v.stock_reserved IS NOT NULL AND least(100,v.stock_quantity-v.stock_reserved)>=greatest(1,v.min_quantity)
 AND round(coalesce(v.price_cents,p.price_cents)::numeric*least(100,v.stock_quantity-v.stock_reserved)*CASE store_effective_member_tier(p_user_id) WHEN 'founder' THEN .8 WHEN 'pro' THEN .88 ELSE 1 END)>=t.threshold_cents)
$$;
CREATE FUNCTION public.exchange_store_coupon(p_user_id uuid,p_offer_id uuid,p_expected_version text,p_intent_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o store_coupon_offers; t store_coupon_templates; e store_coupon_exchanges; tid uuid; cid uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid();
BEGIN
 IF p_user_id IS NULL OR length(coalesce(p_intent_key,'')) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'invalid_exchange'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('coupon-exchange:'||p_user_id::text||':'||p_intent_key,0));
 SELECT * INTO e FROM store_coupon_exchanges WHERE user_id=p_user_id AND intent_key=p_intent_key;
 IF FOUND THEN IF e.offer_id<>p_offer_id THEN RAISE EXCEPTION 'intent_conflict'; END IF; RETURN to_jsonb(e); END IF;
 SELECT template_id INTO tid FROM store_coupon_offers WHERE id=p_offer_id;
 SELECT * INTO t FROM store_coupon_templates WHERE id=tid FOR SHARE;
 SELECT * INTO o FROM store_coupon_offers WHERE id=p_offer_id FOR UPDATE;
 IF o.id IS NULL OR NOT o.active OR NOT coalesce(t.active,false) OR NOT store_coupon_offer_purchasable(t,p_user_id) THEN RAISE EXCEPTION 'offer_unavailable'; END IF;
 IF store_coupon_offer_version(o,t) IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'offer_changed'; END IF;
 IF o.redeemed_count>=o.total_limit OR (SELECT count(*) FROM store_coupon_exchanges WHERE user_id=p_user_id AND offer_id=o.id)>=o.per_user_limit THEN RAISE EXCEPTION 'exchange_limit'; END IF;
 UPDATE profiles SET coins=coins-o.coin_price WHERE id=p_user_id AND coins>=o.coin_price;
 IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_coins'; END IF;
 INSERT INTO store_coupon_exchanges(id,offer_id,user_id,intent_key,coupon_id,coins_spent) VALUES(eid,o.id,p_user_id,p_intent_key,cid,o.coin_price) RETURNING * INTO e;
 INSERT INTO store_user_coupons(id,user_id,title,threshold_cents,discount_cents,terms,eligible_product_ids,expires_at,source,usage_policy,exchange_id)
 VALUES(cid,p_user_id,t.title,t.threshold_cents,t.discount_cents,t.terms,t.eligible_product_ids,clock_timestamp()+make_interval(days=>t.valid_days),'coin_exchange','all',eid);
 INSERT INTO coin_logs(user_id,amount,action_type,resource_id) VALUES(p_user_id,-o.coin_price,'coupon_exchange',eid::text);
 UPDATE store_coupon_offers SET redeemed_count=redeemed_count+1 WHERE id=o.id;
 RETURN to_jsonb(e);
END $$;
ALTER TABLE store_coupon_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_coupon_exchanges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON store_coupon_offers,store_coupon_exchanges FROM PUBLIC,anon,authenticated;
GRANT ALL ON store_coupon_offers,store_coupon_exchanges TO service_role;
REVOKE ALL ON FUNCTION exchange_store_coupon(uuid,uuid,text,text),store_coupon_offer_purchasable(store_coupon_templates,uuid),store_coupon_offer_version(store_coupon_offers,store_coupon_templates) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION exchange_store_coupon(uuid,uuid,text,text),store_coupon_offer_purchasable(store_coupon_templates,uuid),store_coupon_offer_version(store_coupon_offers,store_coupon_templates) TO service_role;
CREATE OR REPLACE FUNCTION public.quote_store_native_order(p_user_id uuid,p_province text,p_items jsonb,p_coupon_id uuid DEFAULT NULL,p_use_coins boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v record; c store_user_coupons; qty integer; original integer; member_total integer; tier text; discount integer:=0; coins integer:=0; evaluated_at timestamptz:=clock_timestamp();
BEGIN
 IF p_use_coins THEN RAISE EXCEPTION 'direct_coins_disabled'; END IF;
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
  IF NOT FOUND OR (c.usage_policy='founder' AND tier<>'founder') OR c.status<>'available' OR c.expires_at<=evaluated_at OR member_total<c.threshold_cents OR c.discount_cents>=member_total OR NOT(v.product_id=ANY(c.eligible_product_ids)) THEN RAISE EXCEPTION 'coupon_unavailable'; END IF;
  discount:=c.discount_cents;
 END IF;

 RETURN jsonb_build_object('originalSubtotalCents',original,'memberSubtotalCents',member_total,'memberDiscountCents',original-member_total,
 'membershipTier',tier,'shippingCents',v.shipping_cents,'couponDiscountCents',discount,'coinDiscountCents',coins,'coinsUsed',coins,'totalCents',member_total+v.shipping_cents-discount-coins,'couponId',p_coupon_id);
END $$;
CREATE FUNCTION public.list_store_coupon_offers(p_user_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('version',store_coupon_offer_version(o,t),'title',t.title,'threshold_cents',t.threshold_cents,'discount_cents',t.discount_cents,'valid_days',t.valid_days,'terms',t.terms,'eligible_product_ids',t.eligible_product_ids,'eligible_products',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)),'[]'::jsonb) FROM store_products p WHERE p.id=ANY(t.eligible_product_ids)),'user_redeemed',(SELECT count(*) FROM store_coupon_exchanges e WHERE e.user_id=p_user_id AND e.offer_id=o.id),'available',o.active AND t.active AND o.redeemed_count<o.total_limit AND (SELECT count(*) FROM store_coupon_exchanges e WHERE e.user_id=p_user_id AND e.offer_id=o.id)<o.per_user_limit AND store_coupon_offer_purchasable(t,p_user_id)) ORDER BY o.created_at),'[]'::jsonb)
 FROM store_coupon_offers o JOIN store_coupon_templates t ON t.id=o.template_id WHERE o.active AND t.active
$$;
CREATE FUNCTION public.save_store_coupon_offer(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o store_coupon_offers; tid uuid:=(p_input->>'templateId')::uuid;
BEGIN
 PERFORM 1 FROM store_coupon_templates WHERE id=tid FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'coupon_template_missing'; END IF;
 IF p_input->>'id' IS NULL THEN
 INSERT INTO store_coupon_offers(template_id,coin_price,total_limit,per_user_limit,active) VALUES(tid,(p_input->>'coinPrice')::integer,(p_input->>'totalLimit')::integer,(p_input->>'perUserLimit')::integer,(p_input->>'active')::boolean) RETURNING * INTO o;
 ELSE
 SELECT * INTO o FROM store_coupon_offers WHERE id=(p_input->>'id')::uuid FOR UPDATE;
 IF o.id IS NULL OR o.version IS DISTINCT FROM (p_input->>'expectedVersion')::integer OR o.template_id<>tid THEN RAISE EXCEPTION 'offer_changed'; END IF;
 UPDATE store_coupon_offers SET coin_price=(p_input->>'coinPrice')::integer,total_limit=(p_input->>'totalLimit')::integer,per_user_limit=(p_input->>'perUserLimit')::integer,active=(p_input->>'active')::boolean,version=version+1 WHERE id=o.id RETURNING * INTO o;
 END IF;
 RETURN to_jsonb(o);
END $$;
REVOKE ALL ON FUNCTION list_store_coupon_offers(uuid),save_store_coupon_offer(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION list_store_coupon_offers(uuid),save_store_coupon_offer(jsonb) TO service_role;
