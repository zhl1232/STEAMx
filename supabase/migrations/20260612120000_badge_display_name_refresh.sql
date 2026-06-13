-- 徽章展示名全面刷新：语义对齐、教育社区语气、门槛与分组文案修正

-- 阶梯系列
UPDATE public.badges SET name = '热心鼓励官' WHERE id = 'intro_likes_gold';
UPDATE public.badges SET name = '慧眼识珠' WHERE id = 'intro_likes_platinum';
UPDATE public.badges SET name = '稳定创作' WHERE id = 'intro_publish_silver';
UPDATE public.badges SET name = '高产创作者' WHERE id = 'intro_publish_gold';
UPDATE public.badges SET name = '灵感主理人' WHERE id = 'intro_publish_platinum';
UPDATE public.badges SET name = '典藏策展人' WHERE id = 'intro_collections_platinum';
UPDATE public.badges SET name = '逻辑启程' WHERE id = 'tech_expert_bronze';
UPDATE public.badges SET name = '模块搭建师' WHERE id = 'tech_expert_silver';
UPDATE public.badges SET name = '算法能手' WHERE id = 'tech_expert_gold';
UPDATE public.badges SET name = '数字建筑师' WHERE id = 'tech_expert_platinum';
UPDATE public.badges SET name = '结构驾驭者' WHERE id = 'engineering_expert_gold';
UPDATE public.badges SET name = '匠心工程师' WHERE id = 'engineering_expert_platinum';
UPDATE public.badges SET name = '色感觉醒' WHERE id = 'art_expert_silver';
UPDATE public.badges SET name = '构图掌舵人' WHERE id = 'art_expert_gold';
UPDATE public.badges SET name = '意境塑造者' WHERE id = 'art_expert_platinum';
UPDATE public.badges SET name = '模型破译者' WHERE id = 'math_expert_gold';
UPDATE public.badges SET name = '讨论引路人' WHERE id = 'social_platinum';
UPDATE public.badges SET name = '探索进阶者' WHERE id = 'milestone_silver';
UPDATE public.badges SET name = '创造巨匠' WHERE id = 'milestone_gold';
UPDATE public.badges SET name = '传奇英雄' WHERE id = 'milestone_platinum';
UPDATE public.badges SET name = '高阶探索者' WHERE id = 'level_gold';
UPDATE public.badges SET name = '百日恒心', description = '连续登录 100 天' WHERE id = 'streak_platinum';
UPDATE public.badges SET name = '物种博学家' WHERE id = 'species_collector_platinum';

-- 首步成就
UPDATE public.badges SET name = '新手毕业' WHERE id = 'growth_graduate';

-- 单档 / 游乐场 / 自然观察
UPDATE public.badges SET name = '方块合一' WHERE id = 'game2048_first_win';
UPDATE public.badges SET name = '高分收割者' WHERE id = 'game2048_high_scorer';
UPDATE public.badges SET name = '二十四点能手' WHERE id = 'game24_50';
UPDATE public.badges SET name = '长时演化者' WHERE id = 'life_observer';
UPDATE public.badges SET name = '巴别塔最优解' WHERE id = 'hanoi_perfect';
UPDATE public.badges SET name = '八层通塔', description = '通关 8 层汉诺塔' WHERE id = 'hanoi_master';
UPDATE public.badges SET name = '落子定局' WHERE id = 'nqueens_first_solve';
UPDATE public.badges SET name = '回路能手' WHERE id = 'circuit_10';
UPDATE public.badges SET name = '记忆达人' WHERE id = 'memory_master';
UPDATE public.badges SET name = '自然初观察', description = '提交第一条自然观察记录' WHERE id = 'first_observation';
UPDATE public.badges SET name = '七日田野行' WHERE id = 'observation_streak_7';
