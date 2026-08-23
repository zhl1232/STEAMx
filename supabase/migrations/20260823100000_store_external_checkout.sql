-- 实物商城第一阶段：商品卡片可跳转淘宝完成外部结算。
-- 默认值保持既有商品的站内模式；链接白名单由服务端配置接口再次校验。

BEGIN;

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS checkout_mode text NOT NULL DEFAULT 'internal';

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS external_channel text;

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS external_url text;

ALTER TABLE public.store_products
  DROP CONSTRAINT IF EXISTS store_products_external_checkout_check;

ALTER TABLE public.store_products
  ADD CONSTRAINT store_products_external_checkout_check
  CHECK (
    (
      checkout_mode = 'internal'
      AND external_channel IS NULL
      AND external_url IS NULL
    )
    OR (
      checkout_mode = 'external'
      AND external_channel IS NOT NULL
      AND char_length(btrim(external_channel)) BETWEEN 1 AND 40
      AND external_url IS NOT NULL
      AND char_length(btrim(external_url)) BETWEEN 1 AND 2048
    )
  );

ALTER TABLE public.store_products
  DROP CONSTRAINT IF EXISTS store_products_checkout_mode_check;

ALTER TABLE public.store_products
  ADD CONSTRAINT store_products_checkout_mode_check
  CHECK (checkout_mode IN ('internal', 'external'));

CREATE INDEX IF NOT EXISTS idx_store_products_checkout_mode
  ON public.store_products (checkout_mode, status, updated_at DESC);

COMMENT ON COLUMN public.store_products.checkout_mode IS
  '商品购买入口：internal 为本站订单，external 为外部平台结算。';
COMMENT ON COLUMN public.store_products.external_channel IS
  '外部结算渠道标识；当前支持 taobao，后续平台接入前需单独评审。';
COMMENT ON COLUMN public.store_products.external_url IS
  '外部商品或店铺 HTTPS 链接；公开前由应用层限制为淘宝/天猫域名。';

COMMIT;
