-- 实物商城基础域：与金币虚拟商店分离。
-- 1688 凭证、支付渠道和实际供应商授权均由服务端适配器提供；本迁移只建立
-- 可审计、可幂等、最小暴露的本地商品/订单/履约模型。

BEGIN;

CREATE TABLE IF NOT EXISTS public.store_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  source text NOT NULL DEFAULT '1688' CHECK (source IN ('1688', 'manual')),
  alibaba_member_id text,
  supports_drop_ship boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, alibaba_member_id)
);

CREATE TABLE IF NOT EXISTS public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (char_length(btrim(slug)) BETWEEN 1 AND 160),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  description text,
  cover_url text,
  source text NOT NULL DEFAULT '1688' CHECK (source IN ('1688', 'manual')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  currency text NOT NULL DEFAULT 'CNY' CHECK (currency = 'CNY'),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  compare_at_price_cents integer CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents >= price_cents),
  stock_quantity integer CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  last_synced_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  sku text NOT NULL CHECK (char_length(btrim(sku)) BETWEEN 1 AND 120),
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  stock_quantity integer CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  min_quantity integer NOT NULL DEFAULT 1 CHECK (min_quantity > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, sku)
);

CREATE TABLE IF NOT EXISTS public.store_product_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.store_product_variants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.store_suppliers(id) ON DELETE RESTRICT,
  offer_id text NOT NULL,
  spec_id text,
  source_url text,
  source_price_cents integer CHECK (source_price_cents IS NULL OR source_price_cents >= 0),
  source_stock_quantity integer CHECK (source_stock_quantity IS NULL OR source_stock_quantity >= 0),
  source_min_quantity integer CHECK (source_min_quantity IS NULL OR source_min_quantity > 0),
  is_primary boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, supplier_id, offer_id, spec_id)
);

CREATE TABLE IF NOT EXISTS public.store_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '收货地址' CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
  recipient_name_masked text NOT NULL,
  phone_last4 text NOT NULL CHECK (phone_last4 ~ '^[0-9]{4}$'),
  payload_encrypted text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_addresses_user_default
  ON public.store_addresses (user_id, is_default DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'paid', 'sourcing', 'ordered', 'partially_shipped',
    'shipped', 'delivered', 'cancelled', 'refund_pending', 'refunded', 'failed'
  )),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded', 'failed')),
  payment_provider text,
  payment_reference text,
  currency text NOT NULL DEFAULT 'CNY' CHECK (currency = 'CNY'),
  subtotal_cents integer NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents integer NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents = subtotal_cents + shipping_cents),
  address_id uuid REFERENCES public.store_addresses(id) ON DELETE SET NULL,
  address_snapshot_encrypted text NOT NULL,
  external_order_id text,
  alibaba_order_id text,
  alibaba_status text,
  failure_code text,
  failure_message text,
  paid_at timestamptz,
  ordered_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_order_id)
);

CREATE INDEX IF NOT EXISTS idx_store_orders_user_time
  ON public.store_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_orders_status_time
  ON public.store_orders (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_orders_alibaba
  ON public.store_orders (alibaba_order_id)
  WHERE alibaba_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.store_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.store_products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.store_product_variants(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.store_suppliers(id) ON DELETE SET NULL,
  title_snapshot text NOT NULL,
  sku_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  offer_id text,
  spec_id text,
  alibaba_order_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_order_items_order
  ON public.store_order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_store_order_items_source
  ON public.store_order_items (supplier_id, offer_id, spec_id);

CREATE TABLE IF NOT EXISTS public.store_order_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (char_length(btrim(event_type)) BETWEEN 1 AND 80),
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_order_events_order_time
  ON public.store_order_events (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.store_sync_jobs (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  order_id uuid REFERENCES public.store_orders(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('create_alibaba_order', 'sync_order', 'sync_logistics', 'sync_refund')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_alibaba_connections (
  connection_key text PRIMARY KEY CHECK (connection_key = 'default'),
  member_id text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_sync_jobs_due
  ON public.store_sync_jobs (status, next_run_at)
  WHERE status IN ('queued', 'failed');

CREATE OR REPLACE FUNCTION public.create_store_order(
  p_user_id uuid,
  p_external_order_id text,
  p_address_id uuid,
  p_address_snapshot_encrypted text,
  p_subtotal_cents integer,
  p_shipping_cents integer,
  p_total_cents integer,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_external_order_id IS NULL OR btrim(p_external_order_id) = '' THEN
    RAISE EXCEPTION 'invalid_store_order_identity';
  END IF;
  IF p_total_cents <> p_subtotal_cents + p_shipping_cents OR p_total_cents < 0 THEN
    RAISE EXCEPTION 'invalid_store_order_total';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'store_order_items_required';
  END IF;

  INSERT INTO public.store_orders (
    user_id, status, payment_status, subtotal_cents, shipping_cents, total_cents,
    address_id, address_snapshot_encrypted, external_order_id
  ) VALUES (
    p_user_id, 'pending_payment', 'unpaid', p_subtotal_cents, p_shipping_cents, p_total_cents,
    p_address_id, p_address_snapshot_encrypted, p_external_order_id
  )
  ON CONFLICT (user_id, external_order_id) DO NOTHING
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    SELECT id INTO v_order_id
    FROM public.store_orders
    WHERE user_id = p_user_id AND external_order_id = p_external_order_id;
    RETURN v_order_id;
  END IF;

  INSERT INTO public.store_order_items (
    order_id, product_id, variant_id, supplier_id, title_snapshot, sku_snapshot,
    quantity, unit_price_cents, offer_id, spec_id, metadata
  )
  SELECT
    v_order_id, x.product_id, x.variant_id, x.supplier_id, x.title_snapshot, x.sku_snapshot,
    x.quantity, x.unit_price_cents, x.offer_id, x.spec_id, COALESCE(x.metadata, '{}'::jsonb)
  FROM jsonb_to_recordset(p_items) AS x(
    product_id uuid,
    variant_id uuid,
    supplier_id uuid,
    title_snapshot text,
    sku_snapshot text,
    quantity integer,
    unit_price_cents integer,
    offer_id text,
    spec_id text,
    metadata jsonb
  );

  INSERT INTO public.store_order_events (order_id, event_type, message)
  VALUES (v_order_id, 'created', '本站实物订单已创建，等待支付');
  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_store_order_paid(
  p_order_id uuid,
  p_provider text,
  p_reference text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.store_orders
  SET status = 'paid',
      payment_status = 'paid',
      payment_provider = NULLIF(btrim(p_provider), ''),
      payment_reference = NULLIF(btrim(p_reference), ''),
      paid_at = COALESCE(paid_at, now())
  WHERE id = p_order_id
    AND status = 'pending_payment'
    AND payment_status IN ('unpaid', 'pending');
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN EXISTS (
      SELECT 1 FROM public.store_orders
      WHERE id = p_order_id AND payment_status = 'paid'
    );
  END IF;

  INSERT INTO public.store_order_events (order_id, event_type, message, payload)
  VALUES (
    p_order_id,
    'paid',
    '本站支付已确认，等待创建 1688 采购单',
    jsonb_build_object('provider', p_provider, 'reference', p_reference)
  );
  INSERT INTO public.store_sync_jobs (order_id, job_type, status)
  VALUES (p_order_id, 'create_alibaba_order', 'queued');
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_order(uuid, text, uuid, text, integer, integer, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_store_order_paid(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_store_order(uuid, text, uuid, text, integer, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_store_order_paid(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_store_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'store_suppliers', 'store_products', 'store_product_variants',
    'store_product_sources', 'store_addresses', 'store_orders', 'store_sync_jobs',
    'store_alibaba_connections'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_store_updated_at()',
      table_name, table_name
    );
  END LOOP;
END;
$$;

ALTER TABLE public.store_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_product_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_alibaba_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_products_public_active" ON public.store_products;
CREATE POLICY "store_products_public_active"
  ON public.store_products FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "store_product_variants_public_active" ON public.store_product_variants;
CREATE POLICY "store_product_variants_public_active"
  ON public.store_product_variants FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.store_products p
      WHERE p.id = product_id AND p.status = 'active'
    )
  );

-- offer_id/spec_id 和供应商映射属于服务端采购实现细节，不向浏览器开放。
DROP POLICY IF EXISTS "store_product_sources_public_active" ON public.store_product_sources;
DROP POLICY IF EXISTS "store_product_sources_service_only" ON public.store_product_sources;
CREATE POLICY "store_product_sources_service_only"
  ON public.store_product_sources FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "store_suppliers_public_active" ON public.store_suppliers;
DROP POLICY IF EXISTS "store_suppliers_service_only" ON public.store_suppliers;
CREATE POLICY "store_suppliers_service_only"
  ON public.store_suppliers FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "store_orders_owner_read" ON public.store_orders;
CREATE POLICY "store_orders_owner_read"
  ON public.store_orders FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "store_order_items_owner_read" ON public.store_order_items;
CREATE POLICY "store_order_items_owner_read"
  ON public.store_order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.store_orders o
    WHERE o.id = order_id AND o.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "store_order_events_owner_read" ON public.store_order_events;
CREATE POLICY "store_order_events_owner_read"
  ON public.store_order_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.store_orders o
    WHERE o.id = order_id AND o.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "store_addresses_owner_read" ON public.store_addresses;
CREATE POLICY "store_addresses_owner_read"
  ON public.store_addresses FOR SELECT
  USING (false);

-- 即使用户能读取自己的订单行，也不能从 PostgREST 直接拿到加密地址或供货映射列。
-- 先撤销表级 SELECT，再只授予目录/订单展示所需的安全列（service_role 仍可读全部列）。
REVOKE SELECT ON public.store_addresses, public.store_orders, public.store_order_items, public.store_order_events FROM anon, authenticated;
GRANT SELECT (id, user_id, label, recipient_name_masked, phone_last4, is_default, created_at, updated_at)
  ON public.store_addresses TO anon, authenticated;
GRANT SELECT (
  id, user_id, status, payment_status, payment_provider, payment_reference, currency,
  subtotal_cents, shipping_cents, total_cents, external_order_id, alibaba_order_id,
  alibaba_status, failure_code, failure_message, paid_at, ordered_at, shipped_at,
  delivered_at, created_at, updated_at
) ON public.store_orders TO anon, authenticated;
GRANT SELECT (id, order_id, title_snapshot, sku_snapshot, quantity, unit_price_cents, created_at)
  ON public.store_order_items TO anon, authenticated;
GRANT SELECT (id, order_id, event_type, message, created_at)
  ON public.store_order_events TO anon, authenticated;

DROP POLICY IF EXISTS "store_addresses_owner_delete" ON public.store_addresses;
CREATE POLICY "store_addresses_owner_delete"
  ON public.store_addresses FOR DELETE
  USING ((select auth.uid()) = user_id);

-- 1688 token 只允许 service_role 使用；普通用户永远不能直接读写。
DROP POLICY IF EXISTS "store_alibaba_connections_service_only" ON public.store_alibaba_connections;
CREATE POLICY "store_alibaba_connections_service_only"
  ON public.store_alibaba_connections FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.store_products IS '实物商城商品；与金币虚拟商店分离。';
COMMENT ON TABLE public.store_product_sources IS '商品 SKU 与 1688 offer/spec 的映射和同步快照。';
COMMENT ON TABLE public.store_orders IS '本站实物订单；敏感地址只存加密快照。';
COMMENT ON TABLE public.store_sync_jobs IS '1688 下单、订单、物流和退款同步任务。';
COMMENT ON TABLE public.store_alibaba_connections IS '服务端 1688 OAuth token 密文；普通用户不可读。';

COMMIT;
