-- 将材料包与课程/课时/项目建立轻量关联，供上下文推荐卡片使用。
-- 关联键只保存公开资源 ID，不保存用户信息或外部平台凭证。

BEGIN;

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS context_keys text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.store_products
  DROP CONSTRAINT IF EXISTS store_products_context_keys_check;

ALTER TABLE public.store_products
  ADD CONSTRAINT store_products_context_keys_check
  CHECK (cardinality(context_keys) <= 24);

CREATE INDEX IF NOT EXISTS idx_store_products_context_keys
  ON public.store_products USING gin (context_keys);

COMMENT ON COLUMN public.store_products.context_keys IS
  '上下文推荐键，如 course:12、lesson:34 或 project:56；由管理员配置。';

COMMIT;
