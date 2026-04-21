-- Dynamic Badges: insert new badge definitions (77 badges: 64 tiered + 8 first_steps + 5 rare)
-- Run this migration first, then run the backfill script, then run 20260211100002_dynamic_badges_remove_old.sql

INSERT INTO public.badges (id, name, description, icon, condition) VALUES
-- intro_likes (4)
('intro_likes_bronze', '点赞 · 铜', '累计点赞 1 次', '👍', '{"seriesKey":"intro_likes","tier":"bronze"}'::jsonb),
('intro_likes_silver', '点赞 · 银', '累计点赞 10 次', '👍', '{"seriesKey":"intro_likes","tier":"silver"}'::jsonb),
('intro_likes_gold', '点赞 · 金', '累计点赞 50 次', '👍', '{"seriesKey":"intro_likes","tier":"gold"}'::jsonb),
('intro_likes_platinum', '点赞 · 白金', '累计点赞 200 次', '👍', '{"seriesKey":"intro_likes","tier":"platinum"}'::jsonb),
-- intro_comments (4)
('intro_comments_bronze', '评论 · 铜', '累计评论 1 条', '💭', '{"seriesKey":"intro_comments","tier":"bronze"}'::jsonb),
('intro_comments_silver', '评论 · 银', '累计评论 10 条', '💭', '{"seriesKey":"intro_comments","tier":"silver"}'::jsonb),
('intro_comments_gold', '评论 · 金', '累计评论 50 条', '💭', '{"seriesKey":"intro_comments","tier":"gold"}'::jsonb),
('intro_comments_platinum', '评论 · 白金', '累计评论 200 条', '💭', '{"seriesKey":"intro_comments","tier":"platinum"}'::jsonb),
-- intro_publish (4)
('intro_publish_bronze', '发布 · 铜', '累计发布 1 个项目', '📤', '{"seriesKey":"intro_publish","tier":"bronze"}'::jsonb),
('intro_publish_silver', '发布 · 银', '累计发布 5 个项目', '📤', '{"seriesKey":"intro_publish","tier":"silver"}'::jsonb),
('intro_publish_gold', '发布 · 金', '累计发布 10 个项目', '📤', '{"seriesKey":"intro_publish","tier":"gold"}'::jsonb),
('intro_publish_platinum', '发布 · 白金', '累计发布 30 个项目', '📤', '{"seriesKey":"intro_publish","tier":"platinum"}'::jsonb),
-- intro_collections (4)
('intro_collections_bronze', '收藏 · 铜', '累计收藏 1 个项目', '📌', '{"seriesKey":"intro_collections","tier":"bronze"}'::jsonb),
('intro_collections_silver', '收藏 · 银', '累计收藏 10 个项目', '📌', '{"seriesKey":"intro_collections","tier":"silver"}'::jsonb),
('intro_collections_gold', '收藏 · 金', '累计收藏 50 个项目', '📌', '{"seriesKey":"intro_collections","tier":"gold"}'::jsonb),
('intro_collections_platinum', '收藏 · 白金', '累计收藏 200 个项目', '📌', '{"seriesKey":"intro_collections","tier":"platinum"}'::jsonb),
-- science_expert (4)
('science_expert_bronze', '科学专家 · 铜', '完成科学类项目 5 个', '🔬', '{"seriesKey":"science_expert","tier":"bronze"}'::jsonb),
('science_expert_silver', '科学专家 · 银', '完成科学类项目 20 个', '🔬', '{"seriesKey":"science_expert","tier":"silver"}'::jsonb),
('science_expert_gold', '科学专家 · 金', '完成科学类项目 50 个', '🔬', '{"seriesKey":"science_expert","tier":"gold"}'::jsonb),
('science_expert_platinum', '科学专家 · 白金', '完成科学类项目 100 个', '🔬', '{"seriesKey":"science_expert","tier":"platinum"}'::jsonb),
-- tech_expert (4)
('tech_expert_bronze', '技术达人 · 铜', '完成技术类项目 5 个', '💻', '{"seriesKey":"tech_expert","tier":"bronze"}'::jsonb),
('tech_expert_silver', '技术达人 · 银', '完成技术类项目 20 个', '💻', '{"seriesKey":"tech_expert","tier":"silver"}'::jsonb),
('tech_expert_gold', '技术达人 · 金', '完成技术类项目 50 个', '💻', '{"seriesKey":"tech_expert","tier":"gold"}'::jsonb),
('tech_expert_platinum', '技术达人 · 白金', '完成技术类项目 100 个', '💻', '{"seriesKey":"tech_expert","tier":"platinum"}'::jsonb),
-- engineering_expert (4)
('engineering_expert_bronze', '工程师 · 铜', '完成工程类项目 5 个', '⚙️', '{"seriesKey":"engineering_expert","tier":"bronze"}'::jsonb),
('engineering_expert_silver', '工程师 · 银', '完成工程类项目 20 个', '⚙️', '{"seriesKey":"engineering_expert","tier":"silver"}'::jsonb),
('engineering_expert_gold', '工程师 · 金', '完成工程类项目 50 个', '⚙️', '{"seriesKey":"engineering_expert","tier":"gold"}'::jsonb),
('engineering_expert_platinum', '工程师 · 白金', '完成工程类项目 100 个', '⚙️', '{"seriesKey":"engineering_expert","tier":"platinum"}'::jsonb),
-- art_expert (4)
('art_expert_bronze', '艺术家 · 铜', '完成艺术类项目 5 个', '🎨', '{"seriesKey":"art_expert","tier":"bronze"}'::jsonb),
('art_expert_silver', '艺术家 · 银', '完成艺术类项目 20 个', '🎨', '{"seriesKey":"art_expert","tier":"silver"}'::jsonb),
('art_expert_gold', '艺术家 · 金', '完成艺术类项目 50 个', '🎨', '{"seriesKey":"art_expert","tier":"gold"}'::jsonb),
('art_expert_platinum', '艺术家 · 白金', '完成艺术类项目 100 个', '🎨', '{"seriesKey":"art_expert","tier":"platinum"}'::jsonb),
-- math_expert (4)
('math_expert_bronze', '数学家 · 铜', '完成数学类项目 5 个', '🔢', '{"seriesKey":"math_expert","tier":"bronze"}'::jsonb),
('math_expert_silver', '数学家 · 银', '完成数学类项目 20 个', '🔢', '{"seriesKey":"math_expert","tier":"silver"}'::jsonb),
('math_expert_gold', '数学家 · 金', '完成数学类项目 50 个', '🔢', '{"seriesKey":"math_expert","tier":"gold"}'::jsonb),
('math_expert_platinum', '数学家 · 白金', '完成数学类项目 100 个', '🔢', '{"seriesKey":"math_expert","tier":"platinum"}'::jsonb),
-- creator (4)
('creator_bronze', '创作者 · 铜', '发布项目 1 个', '📝', '{"seriesKey":"creator","tier":"bronze"}'::jsonb),
('creator_silver', '创作者 · 银', '发布项目 5 个', '📝', '{"seriesKey":"creator","tier":"silver"}'::jsonb),
('creator_gold', '创作者 · 金', '发布项目 10 个', '📝', '{"seriesKey":"creator","tier":"gold"}'::jsonb),
('creator_platinum', '创作者 · 白金', '发布项目 50 个', '📝', '{"seriesKey":"creator","tier":"platinum"}'::jsonb),
-- social (4)
('social_bronze', '社交达人 · 铜', '评论与回复合计 10 条', '💬', '{"seriesKey":"social","tier":"bronze"}'::jsonb),
('social_silver', '社交达人 · 银', '评论与回复合计 50 条', '💬', '{"seriesKey":"social","tier":"silver"}'::jsonb),
('social_gold', '社交达人 · 金', '评论与回复合计 200 条', '💬', '{"seriesKey":"social","tier":"gold"}'::jsonb),
('social_platinum', '社交达人 · 白金', '评论与回复合计 500 条', '💬', '{"seriesKey":"social","tier":"platinum"}'::jsonb),
-- popularity (4)
('popularity_bronze', '人气之星 · 铜', '收到赞 10 个', '❤️', '{"seriesKey":"popularity","tier":"bronze"}'::jsonb),
('popularity_silver', '人气之星 · 银', '收到赞 100 个', '❤️', '{"seriesKey":"popularity","tier":"silver"}'::jsonb),
('popularity_gold', '人气之星 · 金', '收到赞 500 个', '❤️', '{"seriesKey":"popularity","tier":"gold"}'::jsonb),
('popularity_platinum', '人气之星 · 白金', '收到赞 2000 个', '❤️', '{"seriesKey":"popularity","tier":"platinum"}'::jsonb),
-- milestone (4)
('milestone_bronze', '成就里程碑 · 铜', '完成项目 5 个', '🏆', '{"seriesKey":"milestone","tier":"bronze"}'::jsonb),
('milestone_silver', '成就里程碑 · 银', '完成项目 25 个', '🏆', '{"seriesKey":"milestone","tier":"silver"}'::jsonb),
('milestone_gold', '成就里程碑 · 金', '完成项目 100 个', '🏆', '{"seriesKey":"milestone","tier":"gold"}'::jsonb),
('milestone_platinum', '成就里程碑 · 白金', '完成项目 500 个', '🏆', '{"seriesKey":"milestone","tier":"platinum"}'::jsonb),
-- level (4)
('level_bronze', '等级晋升 · 铜', '达到等级 5', '🌟', '{"seriesKey":"level","tier":"bronze"}'::jsonb),
('level_silver', '等级晋升 · 银', '达到等级 25', '🌟', '{"seriesKey":"level","tier":"silver"}'::jsonb),
('level_gold', '等级晋升 · 金', '达到等级 50', '🌟', '{"seriesKey":"level","tier":"gold"}'::jsonb),
('level_platinum', '等级晋升 · 白金', '达到等级 100', '🌟', '{"seriesKey":"level","tier":"platinum"}'::jsonb),
-- challenge (4)
('challenge_bronze', '挑战 · 铜', '参加挑战 3 次', '🎮', '{"seriesKey":"challenge","tier":"bronze"}'::jsonb),
('challenge_silver', '挑战 · 银', '参加挑战 10 次', '🎮', '{"seriesKey":"challenge","tier":"silver"}'::jsonb),
('challenge_gold', '挑战 · 金', '参加挑战 50 次', '🎮', '{"seriesKey":"challenge","tier":"gold"}'::jsonb),
('challenge_platinum', '挑战 · 白金', '参加挑战 100 次', '🎮', '{"seriesKey":"challenge","tier":"platinum"}'::jsonb),
-- streak (4)
('streak_bronze', '连续打卡 · 铜', '连续登录 3 天', '🔥', '{"seriesKey":"streak","tier":"bronze"}'::jsonb),
('streak_silver', '连续打卡 · 银', '连续登录 7 天', '🔥', '{"seriesKey":"streak","tier":"silver"}'::jsonb),
('streak_gold', '连续打卡 · 金', '连续登录 30 天', '🔥', '{"seriesKey":"streak","tier":"gold"}'::jsonb),
('streak_platinum', '连续打卡 · 白金', '连续登录 90 天', '🔥', '{"seriesKey":"streak","tier":"platinum"}'::jsonb),
-- first_steps (8)
('first_step', '第一步', '完成注册账号', '👣', '{"kind":"single","seriesKey":"first_steps"}'::jsonb),
('explorer', '初级探索者', '完成 1 个项目', '🌟', '{"kind":"single","seriesKey":"first_steps"}'::jsonb),
('first_like', '点赞新手', '首次给项目点赞', '👍', '{"kind":"single","seriesKey":"first_steps"}'::jsonb),
('first_comment', '发言新秀', '发表首条评论', '💭', '{"kind":"single","seriesKey":"first_steps"}'::jsonb),
('first_publish', '首次发布', '发布第一个项目', '📤', '{"kind":"single","seriesKey":"first_steps"}'::jsonb),
('first_collection', '收藏入门', '首次收藏项目', '📌', '{"kind":"single","seriesKey":"first_steps"}'::jsonb),
('social_butterfly', '社交蝴蝶', '首次参与讨论', '🦋', '{"kind":"single","seriesKey":"first_steps"}'::jsonb),
('challenge_rookie', '挑战新人', '首次参加挑战', '🎪', '{"kind":"single","seriesKey":"first_steps"}'::jsonb),
-- rare (5)
('early_bird', '平台先驱', '前 100 名注册用户', '🦅', '{"kind":"single","seriesKey":"rare"}'::jsonb),
('bug_hunter', '漏洞猎人', '发现并报告平台 Bug', '🐛', '{"kind":"single","seriesKey":"rare"}'::jsonb),
('contributor', '贡献者', '为平台做出特殊贡献', '💝', '{"kind":"single","seriesKey":"rare"}'::jsonb),
('beta_tester', '测试先锋', '参与平台内测', '🧪', '{"kind":"single","seriesKey":"rare"}'::jsonb),
('anniversary', '周年纪念', '平台一周年纪念徽章', '🎂', '{"kind":"single","seriesKey":"rare"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  condition = EXCLUDED.condition;
