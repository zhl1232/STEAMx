INSERT INTO public.badges (id, name, description, icon, condition) VALUES
-- 科学系列
('science_explorer', '科学探索者', '完成 10 个科学类项目', '🔭', '{"type": "science_completed", "count": 10}'),
('science_researcher', '科学研究员', '完成 15 个科学类项目', '📡', '{"type": "science_completed", "count": 15}'),
('science_expert', '科学专家', '完成 20 个科学类项目', '🧬', '{"type": "science_completed", "count": 20}'),
('science_master', '科学大师', '完成 30 个科学类项目', '⚛️', '{"type": "science_completed", "count": 30}'),
('science_professor', '科学教授', '完成 50 个科学类项目', '🎓', '{"type": "science_completed", "count": 50}'),
('science_genius', '科学天才', '完成 75 个科学类项目', '💡', '{"type": "science_completed", "count": 75}'),
('science_legend', '科学传奇', '完成 100 个科学类项目', '🌌', '{"type": "science_completed", "count": 100}'),

-- 技术系列
('junior_coder', '小小程序员', '完成 5 个技术类项目', '🖥️', '{"type": "tech_completed", "count": 5}'),
('tech_explorer', '技术探索者', '完成 10 个技术类项目', '🔧', '{"type": "tech_completed", "count": 10}'),
('tech_developer', '技术开发者', '完成 15 个技术类项目', '🛠️', '{"type": "tech_completed", "count": 15}'),
('tech_expert', '技术专家', '完成 20 个技术类项目', '📱', '{"type": "tech_completed", "count": 20}'),
('tech_master', '技术大师', '完成 30 个技术类项目', '🤖', '{"type": "tech_completed", "count": 30}'),
('tech_architect', '技术架构师', '完成 50 个技术类项目', '🏗️', '{"type": "tech_completed", "count": 50}'),
('tech_genius', '技术天才', '完成 75 个技术类项目', '🚀', '{"type": "tech_completed", "count": 75}'),
('tech_legend', '技术传奇', '完成 100 个技术类项目', '🌐', '{"type": "tech_completed", "count": 100}'),

-- 工程系列
('junior_engineer', '小小工程师', '完成 5 个工程类项目', '🔨', '{"type": "engineering_completed", "count": 5}'),
('engineering_explorer', '工程探索者', '完成 10 个工程类项目', '📐', '{"type": "engineering_completed", "count": 10}'),
('engineering_builder', '工程建造者', '完成 15 个工程类项目', '🏛️', '{"type": "engineering_completed", "count": 15}'),
('engineering_expert', '工程专家', '完成 20 个工程类项目', '🌉', '{"type": "engineering_completed", "count": 20}'),
('engineering_master', '工程大师', '完成 30 个工程类项目', '🏭', '{"type": "engineering_completed", "count": 30}'),
('engineering_chief', '首席工程师', '完成 50 个工程类项目', '🚂', '{"type": "engineering_completed", "count": 50}'),
('engineering_genius', '工程天才', '完成 75 个工程类项目', '✈️', '{"type": "engineering_completed", "count": 75}'),
('engineering_legend', '工程传奇', '完成 100 个工程类项目', '🚀', '{"type": "engineering_completed", "count": 100}'),

-- 艺术系列
('junior_artist', '小小艺术家', '完成 5 个艺术类项目', '🖼️', '{"type": "art_completed", "count": 5}'),
('art_explorer', '艺术探索者', '完成 10 个艺术类项目', '🎭', '{"type": "art_completed", "count": 10}'),
('art_creator', '艺术创作者', '完成 15 个艺术类项目', '🎪', '{"type": "art_completed", "count": 15}'),
('art_expert', '艺术专家', '完成 20 个艺术类项目', '🎬', '{"type": "art_completed", "count": 20}'),
('art_master', '艺术大师', '完成 30 个艺术类项目', '🎼', '{"type": "art_completed", "count": 30}'),
('art_virtuoso', '艺术大家', '完成 50 个艺术类项目', '🎹', '{"type": "art_completed", "count": 50}'),
('art_genius', '艺术天才', '完成 75 个艺术类项目', '🌈', '{"type": "art_completed", "count": 75}'),
('art_legend', '艺术传奇', '完成 100 个艺术类项目', '✨', '{"type": "art_completed", "count": 100}'),

-- 数学系列
('junior_mathematician', '小小数学家', '完成 5 个数学类项目', '📊', '{"type": "math_completed", "count": 5}'),
('math_explorer', '数学探索者', '完成 10 个数学类项目', '📈', '{"type": "math_completed", "count": 10}'),
('math_solver', '问题解决者', '完成 15 个数学类项目', '🧮', '{"type": "math_completed", "count": 15}'),
('math_expert', '数学专家', '完成 20 个数学类项目', '📐', '{"type": "math_completed", "count": 20}'),
('math_master', '数学大师', '完成 30 个数学类项目', '🎯', '{"type": "math_completed", "count": 30}'),
('math_professor', '数学教授', '完成 50 个数学类项目', '🏆', '{"type": "math_completed", "count": 50}'),
('math_genius', '数学天才', '完成 75 个数学类项目', '🧠', '{"type": "math_completed", "count": 75}'),
('math_legend', '数学传奇', '完成 100 个数学类项目', '♾️', '{"type": "math_completed", "count": 100}'),

-- 创作者系列
('active_creator', '活跃创作者', '发布 5 个项目', '📖', '{"type": "projects_published", "count": 5}'),
('prolific_creator', '高产创作者', '发布 10 个项目', '📚', '{"type": "projects_published", "count": 10}'),
('master_creator', '创作大师', '发布 20 个项目', '🖊️', '{"type": "projects_published", "count": 20}'),
('content_king', '内容之王', '发布 30 个项目', '👑', '{"type": "projects_published", "count": 30}'),
('creative_genius', '创意天才', '发布 50 个项目', '💫', '{"type": "projects_published", "count": 50}'),
('publishing_legend', '发布传奇', '发布 75 个项目', '🌟', '{"type": "projects_published", "count": 75}'),
('content_emperor', '内容帝王', '发布 100 个项目', '🏰', '{"type": "projects_published", "count": 100}'),
('legendary_author', '传奇作者', '发布 150 个项目', '🎖️', '{"type": "projects_published", "count": 150}'),

-- 社交评论系列
('active_commenter', '活跃评论者', '发表 25 条评论', '📢', '{"type": "comments_count", "count": 25}'),
('super_commenter', '超级评论员', '发表 50 条评论', '🎤', '{"type": "comments_count", "count": 50}'),
('comment_king', '评论之王', '发表 100 条评论', '👄', '{"type": "comments_count", "count": 100}'),

-- 讨论系列
('discussion_starter', '话题发起者', '发起 5 个讨论', '💡', '{"type": "discussions_created", "count": 5}'),
('discussion_leader', '讨论领袖', '发起 20 个讨论', '🎙️', '{"type": "discussions_created", "count": 20}'),
('reply_master', '回复达人', '回复 50 条消息', '↩️', '{"type": "replies_count", "count": 50}'),
('community_pillar', '社区支柱', '评论和回复总数达到 200', '🏛️', '{"type": "comments_and_replies", "count": 200}'),
('social_legend', '社交传奇', '评论和回复总数达到 500', '🌍', '{"type": "comments_and_replies", "count": 500}'),

-- 点赞系列
('super_liker', '超级点赞官', '给出 50 个赞', '💖', '{"type": "likes_given", "count": 50}'),
('like_machine', '点赞机器', '给出 100 个赞', '💗', '{"type": "likes_given", "count": 100}'),
('like_legend', '点赞传奇', '给出 500 个赞', '💝', '{"type": "likes_given", "count": 500}'),

-- 人气系列
('rising_star', '冉冉新星', '收到 50 个赞', '🌟', '{"type": "likes_received", "count": 50}'),
('super_star', '超级明星', '收到 100 个赞', '💫', '{"type": "likes_received", "count": 100}'),
('mega_star', '巨星', '收到 500 个赞', '🌠', '{"type": "likes_received", "count": 500}'),

-- 收藏系列
('super_collector', '超级收藏家', '收藏 100 个项目', '🗄️', '{"type": "collections_count", "count": 100}'),

-- 里程碑系列
('milestone_25', '成就斐然', '完成 25 个项目', '🥇', '{"type": "projects_completed", "count": 25}'),
('milestone_50', '半百达成', '完成 50 个项目', '🏅', '{"type": "projects_completed", "count": 50}'),
('milestone_100', '百项俱乐部', '完成 100 个项目', '💯', '{"type": "projects_completed", "count": 100}'),
('ultimate_achiever', '终极成就者', '完成 200 个项目', '🏰', '{"type": "projects_completed", "count": 200}'),
('legendary_achiever', '传奇成就者', '完成 500 个项目', '👑', '{"type": "projects_completed", "count": 500}'),

-- 综合能力系列
('versatile_master', '多面手', '完成每个类别至少 5 个项目', '🌈', '{"type": "all_categories", "count": 5}'),
('steam_polymath', 'STEAM 博学家', '完成每个类别至少 10 个项目', '🎓', '{"type": "all_categories", "count": 10}'),

-- 等级系列
('level_15', '小有名气', '达到等级 15', '📈', '{"type": "level", "count": 15}'),
('level_20', '声名鹊起', '达到等级 20', '🎖️', '{"type": "level", "count": 20}'),
('level_30', '资深玩家', '达到等级 30', '🏵️', '{"type": "level", "count": 30}'),
('level_40', '高级达人', '达到等级 40', '💎', '{"type": "level", "count": 40}'),
('level_50', '半百元老', '达到等级 50', '🌟', '{"type": "level", "count": 50}'),
('level_75', '殿堂级玩家', '达到等级 75', '🔮', '{"type": "level", "count": 75}'),
('level_100', '满级大佬', '达到等级 100', '👑', '{"type": "level", "count": 100}'),
('level_max', '传说玩家', '达到等级 150', '🌌', '{"type": "level", "count": 150}'),

-- 挑战赛系列
('challenge_enthusiast', '挑战爱好者', '参加 5 次挑战赛', '🎯', '{"type": "challenges_joined", "count": 5}'),
('challenge_veteran', '挑战老将', '参加 10 次挑战赛', '⚔️', '{"type": "challenges_joined", "count": 10}'),
('challenge_master', '挑战大师', '参加 20 次挑战赛', '🏹', '{"type": "challenges_joined", "count": 20}'),
('challenge_champion', '挑战冠军', '参加 50 次挑战赛', '🏆', '{"type": "challenges_joined", "count": 50}'),
('challenge_legend', '挑战传奇', '参加 100 次挑战赛', '🎪', '{"type": "challenges_joined", "count": 100}'),

-- 连续打卡系列
('month_streak', '月活跃用户', '连续登录 30 天', '🔥', '{"type": "consecutive_days", "count": 30}'),
('quarter_streak', '季度坚持者', '连续登录 90 天', '🔥', '{"type": "consecutive_days", "count": 90}'),
('half_year_streak', '半年坚持者', '连续登录 180 天', '🔥', '{"type": "consecutive_days", "count": 180}'),
('year_streak', '年度坚持者', '连续登录 365 天', '🔥', '{"type": "consecutive_days", "count": 365}'),

-- 稀有限定系列
('early_bird', '平台先驱', '前 100 名注册用户', '鹰', '{"type": "manual"}'),
('bug_hunter', '漏洞猎人', '发现并报告平台 Bug', '🐛', '{"type": "manual"}'),
('contributor', '贡献者', '为平台做出特殊贡献', '💝', '{"type": "manual"}'),
('beta_tester', '测试先锋', '参与平台内测', '🧪', '{"type": "manual"}'),
('anniversary', '周年纪念', '平台一周年纪念徽章', '🎂', '{"type": "manual"}')

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    condition = EXCLUDED.condition;
