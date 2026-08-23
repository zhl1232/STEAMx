-- 本地商城样式验证用的测试商品不能进入公开目录。
-- 只按明确的 test_fixture 标记和固定 slug 收窄目标，避免影响真实商品。

BEGIN;

UPDATE public.store_products
SET status = 'draft',
    updated_at = now()
WHERE slug = 'test-project-114-kit'
  AND status = 'active'
  AND metadata ->> 'test_fixture' = 'true';

COMMIT;
