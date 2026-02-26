-- Badge Cleanup: 移除与 tiered 系列重叠的冗余徽章
-- 背景：
--   first_like / first_comment / first_publish / first_collection 与对应 tiered 铜牌触发条件完全相同
--   creator 系列 (creator_bronze/silver/gold/platinum) 与 intro_publish 系列完全重叠
--   intro_publish_platinum 阈值从 30 调整为 50（与原 creator_platinum 最高档对齐）
-- 操作顺序：先删 user_badges 记录，再删 badges 定义

DO $$
DECLARE
  removed_ids text[] := ARRAY[
    -- 重叠的 first_steps single 徽章（被 tiered 铜牌覆盖）
    'first_like',
    'first_comment',
    'first_publish',
    'first_collection',
    -- creator 系列（与 intro_publish 系列完全重叠）
    'creator_bronze',
    'creator_silver',
    'creator_gold',
    'creator_platinum'
  ];
BEGIN
  -- 先删除用户持有记录，避免外键约束报错
  DELETE FROM public.user_badges WHERE badge_id = ANY(removed_ids);
  -- 再删除徽章定义
  DELETE FROM public.badges WHERE id = ANY(removed_ids);
  RAISE NOTICE 'Removed % duplicate badge definitions and their user_badges records', array_length(removed_ids, 1);
END $$;

-- 更新 intro_publish_platinum 描述与新阈值（50）保持一致
UPDATE public.badges
SET description = '累计发布 50 个项目'
WHERE id = 'intro_publish_platinum';
