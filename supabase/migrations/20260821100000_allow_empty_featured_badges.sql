-- Distinguish an untouched profile from a profile that intentionally wears no badges.
-- Historical empty arrays represented the old automatic-selection default.
UPDATE public.profiles
SET featured_badge_ids = NULL
WHERE featured_badge_ids IS NOT NULL
  AND cardinality(featured_badge_ids) = 0;

ALTER TABLE public.profiles
  ALTER COLUMN featured_badge_ids DROP DEFAULT;

COMMENT ON COLUMN public.profiles.featured_badge_ids IS
  '主页佩戴徽章 ID 顺序：NULL 表示未手动配置并使用默认精选，空数组表示明确不佩戴，非空数组表示手动佩戴列表（最多 5 枚）';
