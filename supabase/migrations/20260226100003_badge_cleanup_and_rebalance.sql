-- Badge Cleanup & Rebalance (合并自 100003 + 100004)
-- 1. 删除 intro_comments 系列（合并入 social）
-- 2. 更新所有受影响系列的描述文字与新阈值对应

-- ============================================================
-- Part 1: 删除 intro_comments 系列（4枚）
-- ============================================================
DO $$
DECLARE
  removed_ids text[] := ARRAY[
    'intro_comments_bronze',
    'intro_comments_silver',
    'intro_comments_gold',
    'intro_comments_platinum'
  ];
BEGIN
  DELETE FROM public.user_badges WHERE badge_id = ANY(removed_ids);
  DELETE FROM public.badges WHERE id = ANY(removed_ids);
  RAISE NOTICE 'Removed intro_comments series: % badge definitions', array_length(removed_ids, 1);
END $$;

-- ============================================================
-- Part 2: 更新描述文字（所有阈值变更的系列）
-- ============================================================

-- intro_likes: [1, 10, 50, 200] → [1, 50, 200, 1000]
UPDATE public.badges SET description = '累计点赞 1 次'    WHERE id = 'intro_likes_bronze';
UPDATE public.badges SET description = '累计点赞 50 次'   WHERE id = 'intro_likes_silver';
UPDATE public.badges SET description = '累计点赞 200 次'  WHERE id = 'intro_likes_gold';
UPDATE public.badges SET description = '累计点赞 1000 次' WHERE id = 'intro_likes_platinum';

-- intro_collections: [1, 10, 50, 200] → [1, 50, 200, 1000]
UPDATE public.badges SET description = '累计收藏 1 个项目'    WHERE id = 'intro_collections_bronze';
UPDATE public.badges SET description = '累计收藏 50 个项目'   WHERE id = 'intro_collections_silver';
UPDATE public.badges SET description = '累计收藏 200 个项目'  WHERE id = 'intro_collections_gold';
UPDATE public.badges SET description = '累计收藏 1000 个项目' WHERE id = 'intro_collections_platinum';

-- social: [10, 50, 200, 500] → [1, 30, 150, 500]
UPDATE public.badges SET description = '评论与回复合计 1 条'   WHERE id = 'social_bronze';
UPDATE public.badges SET description = '评论与回复合计 30 条'  WHERE id = 'social_silver';
UPDATE public.badges SET description = '评论与回复合计 150 条' WHERE id = 'social_gold';
-- social_platinum (500) 不变

-- science_expert: [5, 20, 50, 100] → [3, 10, 20, 50]
UPDATE public.badges SET description = '完成科学类项目 3 个'  WHERE id = 'science_expert_bronze';
UPDATE public.badges SET description = '完成科学类项目 10 个' WHERE id = 'science_expert_silver';
UPDATE public.badges SET description = '完成科学类项目 20 个' WHERE id = 'science_expert_gold';
UPDATE public.badges SET description = '完成科学类项目 50 个' WHERE id = 'science_expert_platinum';

-- tech_expert: [5, 20, 50, 100] → [3, 10, 20, 50]
UPDATE public.badges SET description = '完成技术类项目 3 个'  WHERE id = 'tech_expert_bronze';
UPDATE public.badges SET description = '完成技术类项目 10 个' WHERE id = 'tech_expert_silver';
UPDATE public.badges SET description = '完成技术类项目 20 个' WHERE id = 'tech_expert_gold';
UPDATE public.badges SET description = '完成技术类项目 50 个' WHERE id = 'tech_expert_platinum';

-- engineering_expert: [5, 20, 50, 100] → [3, 10, 20, 50]
UPDATE public.badges SET description = '完成工程类项目 3 个'  WHERE id = 'engineering_expert_bronze';
UPDATE public.badges SET description = '完成工程类项目 10 个' WHERE id = 'engineering_expert_silver';
UPDATE public.badges SET description = '完成工程类项目 20 个' WHERE id = 'engineering_expert_gold';
UPDATE public.badges SET description = '完成工程类项目 50 个' WHERE id = 'engineering_expert_platinum';

-- art_expert: [5, 20, 50, 100] → [3, 10, 20, 50]
UPDATE public.badges SET description = '完成艺术类项目 3 个'  WHERE id = 'art_expert_bronze';
UPDATE public.badges SET description = '完成艺术类项目 10 个' WHERE id = 'art_expert_silver';
UPDATE public.badges SET description = '完成艺术类项目 20 个' WHERE id = 'art_expert_gold';
UPDATE public.badges SET description = '完成艺术类项目 50 个' WHERE id = 'art_expert_platinum';

-- math_expert: [5, 20, 50, 100] → [3, 10, 20, 50]
UPDATE public.badges SET description = '完成数学类项目 3 个'  WHERE id = 'math_expert_bronze';
UPDATE public.badges SET description = '完成数学类项目 10 个' WHERE id = 'math_expert_silver';
UPDATE public.badges SET description = '完成数学类项目 20 个' WHERE id = 'math_expert_gold';
UPDATE public.badges SET description = '完成数学类项目 50 个' WHERE id = 'math_expert_platinum';

-- milestone: [5, 25, 100, 500] → [5, 20, 50, 100]
UPDATE public.badges SET description = '完成项目 5 个'   WHERE id = 'milestone_bronze';
UPDATE public.badges SET description = '完成项目 20 个'  WHERE id = 'milestone_silver';
UPDATE public.badges SET description = '完成项目 50 个'  WHERE id = 'milestone_gold';
UPDATE public.badges SET description = '完成项目 100 个' WHERE id = 'milestone_platinum';

-- challenge: [3, 10, 50, 100] → [2, 6, 15, 30]
UPDATE public.badges SET description = '参加挑战赛 2 次'  WHERE id = 'challenge_bronze';
UPDATE public.badges SET description = '参加挑战赛 6 次'  WHERE id = 'challenge_silver';
UPDATE public.badges SET description = '参加挑战赛 15 次' WHERE id = 'challenge_gold';
UPDATE public.badges SET description = '参加挑战赛 30 次' WHERE id = 'challenge_platinum';
