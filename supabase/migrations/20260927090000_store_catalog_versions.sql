-- Reject stale admin drafts, including inventory changed by payment/reservation RPCs.
BEGIN;
ALTER TABLE public.store_products ADD COLUMN catalog_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.store_product_variants ADD COLUMN catalog_version integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.bump_store_catalog_version()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.catalog_version := OLD.catalog_version + 1;
  RETURN NEW;
END $$;
CREATE TRIGGER store_products_catalog_version BEFORE UPDATE ON public.store_products
FOR EACH ROW EXECUTE FUNCTION public.bump_store_catalog_version();
CREATE TRIGGER store_variants_catalog_version BEFORE UPDATE ON public.store_product_variants
FOR EACH ROW EXECUTE FUNCTION public.bump_store_catalog_version();

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
    IF FOUND AND (v->>'version')::integer IS DISTINCT FROM existing.catalog_version THEN RAISE EXCEPTION 'catalog_version_conflict'; END IF;
    IF existing.id IS NOT NULL AND existing.product_id<>pid THEN RAISE EXCEPTION 'variant_wrong_product'; END IF;
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

COMMIT;
