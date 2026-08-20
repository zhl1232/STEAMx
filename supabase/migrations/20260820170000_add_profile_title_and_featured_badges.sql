-- Add equipped_title and featured_badge_ids to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_title text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS featured_badge_ids text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.profiles.equipped_title IS '用户主动佩戴的成就称号，为 NULL 时由前端/服务端自动推导最高荣誉称号，为 none 时不展示称号';
COMMENT ON COLUMN public.profiles.featured_badge_ids IS '用户主动精选展出在主页首屏的徽章 ID 列表（最多 3 枚），为空数组时自动精选最高阶徽章';
