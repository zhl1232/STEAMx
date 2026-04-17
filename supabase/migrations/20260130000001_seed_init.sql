-- ============================================
-- 初始种子数据 (Init Seed Data)
-- ============================================
-- 包含:
-- 1. 初始用户 (管理员 + 普通用户)
-- 2. 徽章数据
-- 3. 示例项目
-- 4. 交互数据 (点赞、评论、完成记录)
-- ============================================

-- 启用加密扩展 (用于生成密码 hash)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. 创建用户 (auth.users)
-- ============================================
-- Admin: 66020423@qq.com / 123456
-- Student: student@example.com / 123456
-- Teacher: teacher@example.com / 123456

-- 先清理已存在的用户，防止 email 冲突
-- 必须先删除依赖表的数据，否则会有外键约束报错
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    DELETE FROM public.messages WHERE sender_id IN ('66020423-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000') OR receiver_id IN ('66020423-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000');
  END IF;
END $$;
DELETE FROM public.comments WHERE author_id IN ('66020423-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000');
DELETE FROM public.likes WHERE user_id IN ('66020423-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000');
DELETE FROM public.collections WHERE user_id IN ('66020423-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000');
DELETE FROM public.completed_projects WHERE user_id IN ('66020423-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000');
DELETE FROM public.user_badges WHERE user_id IN ('66020423-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000');
DELETE FROM public.projects WHERE author_id IN ('66020423-0000-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000');
-- 讨论回复引用 profiles 和 discussions，先删回复再删讨论再删 profiles
DELETE FROM public.discussion_replies WHERE discussion_id IN (SELECT id FROM public.discussions WHERE author_id IN ('66020423-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000'));
DELETE FROM public.discussion_replies WHERE author_id IN ('66020423-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000');
DELETE FROM public.discussions WHERE author_id IN ('66020423-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000');
DELETE FROM public.profiles WHERE id IN ('66020423-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000000');
DELETE FROM auth.users WHERE email IN ('66020423@qq.com', 'student@example.com', 'teacher@example.com', 'alice@example.com', 'bob@example.com', 'charlie@example.com', 'david@example.com', 'eve@example.com');

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES
(
    '66020423-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '66020423@qq.com',
    crypt('123456', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin User","avatar_url":"/avatars/default-1.svg"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
),
(
    '11111111-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'student@example.com',
    crypt('123456', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Student S","avatar_url":"/avatars/default-2.svg"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
),
(
    '22222222-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'teacher@example.com',
    crypt('123456', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Teacher T","avatar_url":"/avatars/default-3.svg"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
),
(
    'a1111111-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alice@example.com',
    crypt('123456', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Alice W","avatar_url":"/avatars/default-4.svg"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
),
(
    'b2222222-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'bob@example.com',
    crypt('123456', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Bob B","avatar_url":"/avatars/default-5.svg"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
),
(
    'c3333333-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'charlie@example.com',
    crypt('123456', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Charlie C","avatar_url":"/avatars/default-6.svg"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
),
(
    'd4444444-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'david@example.com',
    crypt('123456', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"David D","avatar_url":"/avatars/default-7.svg"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
),
(
    'e5555555-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'eve@example.com',
    crypt('123456', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Eve E","avatar_url":"/avatars/default-8.svg"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. 创建/更新 Profiles (public.profiles)
-- ============================================

INSERT INTO public.profiles (id, username, display_name, role, avatar_url, xp, level)
VALUES
('66020423-0000-0000-0000-000000000000', 'admin', 'Admin User', 'admin', '/avatars/default-1.svg', 9999, 100),
('11111111-0000-0000-0000-000000000000', 'student', 'Student S', 'user', '/avatars/default-2.svg', 150, 3),
('22222222-0000-0000-0000-000000000000', 'teacher', 'Teacher T', 'moderator', '/avatars/default-3.svg', 500, 10),
('a1111111-0000-0000-0000-000000000000', 'alice', 'Alice W', 'user', '/avatars/default-4.svg', 200, 4),
('b2222222-0000-0000-0000-000000000000', 'bob', 'Bob B', 'user', '/avatars/default-5.svg', 350, 6),
('c3333333-0000-0000-0000-000000000000', 'charlie', 'Charlie C', 'user', '/avatars/default-6.svg', 120, 2),
('d4444444-0000-0000-0000-000000000000', 'david', 'David D', 'user', '/avatars/default-7.svg', 800, 15),
('e5555555-0000-0000-0000-000000000000', 'eve', 'Eve E', 'user', '/avatars/default-8.svg', 450, 8)
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    xp = EXCLUDED.xp,
    level = EXCLUDED.level;

-- ============================================
-- 3. 插入徽章 (Badges)
-- ============================================
INSERT INTO public.badges (id, name, description, icon, condition) VALUES
-- 入门系列
('first_step', '第一步', '完成注册账号', '👣', '{"type": "register"}'),
('explorer', '初级探索者', '完成 1 个项目', '🌟', '{"type": "projects_completed", "count": 1}'),
('first_like', '点赞新手', '首次给项目点赞', '👍', '{"type": "likes_given", "count": 1}'),
('first_comment', '发言新秀', '发表首条评论', '💭', '{"type": "comments_count", "count": 1}'),
('first_publish', '首次发布', '发布第一个项目', '📤', '{"type": "projects_published", "count": 1}'),
('first_collection', '收藏入门', '首次收藏项目', '📌', '{"type": "collections_count", "count": 1}'),
('curious_mind', '好奇探索者', '浏览超过 10 个项目', '🔍', '{"type": "projects_viewed", "count": 10}'),
('quick_learner', '快速学习者', '一周内完成 3 个项目', '⚡', '{"type": "projects_completed_weekly", "count": 3}'),
('social_butterfly', '社交蝴蝶', '首次参与讨论', '🦋', '{"type": "discussions_participated", "count": 1}'),
('challenge_rookie', '挑战新人', '首次参加挑战赛', '🎪', '{"type": "challenges_joined", "count": 1}'),
-- 科学系列
('science_beginner', '科学萌新', '完成 1 个科学类项目', '🔬', '{"type": "science_completed", "count": 1}'),
('science_enthusiast', '科学爱好者', '完成 3 个科学类项目', '🧪', '{"type": "science_completed", "count": 3}'),
('junior_scientist', '小小科学家', '完成 5 个科学类项目', '⚗️', '{"type": "science_completed", "count": 5}'),
-- 技术系列
('tech_beginner', '技术萌新', '完成 1 个技术类项目', '💻', '{"type": "tech_completed", "count": 1}'),
('tech_enthusiast', '技术爱好者', '完成 3 个技术类项目', '⌨️', '{"type": "tech_completed", "count": 3}'),
-- 工程系列
('engineering_beginner', '工程萌新', '完成 1 个工程类项目', '⚙️', '{"type": "engineering_completed", "count": 1}'),
('engineering_enthusiast', '工程爱好者', '完成 3 个工程类项目', '🔩', '{"type": "engineering_completed", "count": 3}'),
-- 艺术系列
('art_beginner', '艺术萌新', '完成 1 个艺术类项目', '🎨', '{"type": "art_completed", "count": 1}'),
('art_enthusiast', '艺术爱好者', '完成 3 个艺术类项目', '🖌️', '{"type": "art_completed", "count": 3}'),
-- 数学系列
('math_beginner', '数学萌新', '完成 1 个数学类项目', '🔢', '{"type": "math_completed", "count": 1}'),
('math_enthusiast', '数学爱好者', '完成 3 个数学类项目', '➕', '{"type": "math_completed", "count": 3}'),
-- 创作者系列
('creator_starter', '创作起步', '发布 1 个项目', '📝', '{"type": "projects_published", "count": 1}'),
('creator', '创意达人', '发布 3 个项目', '✏️', '{"type": "projects_published", "count": 3}'),
-- 社交达人系列
('commenter', '评论员', '发表 5 条评论', '💬', '{"type": "comments_count", "count": 5}'),
('helpful', '热心助人', '发表 10 条评论', '🤝', '{"type": "comments_count", "count": 10}'),
-- 点赞收藏系列
('like_giver', '点赞小能手', '给出 10 个赞', '❤️', '{"type": "likes_given", "count": 10}'),
('popular_one', '人气新星', '收到 10 个赞', '⭐', '{"type": "likes_received", "count": 10}'),
('collector', '收藏家', '收藏 20 个项目', '📦', '{"type": "collections_count", "count": 20}'),
-- 里程碑
('milestone_5', '小有成就', '完成 5 个项目', '🎯', '{"type": "projects_completed", "count": 5}'),
('master', 'STEAM 大师', '完成 10 个项目', '🏆', '{"type": "projects_completed", "count": 10}'),
('all_rounder', '全能选手', '完成每个类别至少 1 个项目', '🎪', '{"type": "all_categories", "count": 1}'),
-- 等级
('level_5', '初出茅庐', '达到等级 5', '🔰', '{"type": "level", "count": 5}'),
('level_10', '崭露头角', '达到等级 10', '⬆️', '{"type": "level", "count": 10}'),
-- 挑战赛
('challenger', '挑战者', '参加 3 次挑战赛', '🎮', '{"type": "challenges_joined", "count": 3}'),
-- 连续打卡
('week_streak', '周活跃用户', '连续登录 7 天', '🔥', '{"type": "consecutive_days", "count": 7}')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    condition = EXCLUDED.condition;

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 初始种子数据加载完成！';
  RAISE NOTICE '👤 管理员账号: 66020423@qq.com / 123456';
  RAISE NOTICE '👤 学生账号: student@example.com / 123456';
  RAISE NOTICE '👤 老师账号: teacher@example.com / 123456';
  RAISE NOTICE '🏅 徽章定义已导入';
END $$;

-- [已移除] 原第4节(示例项目)和第5节(交互/讨论数据)已被后续迁移覆盖和清理
-- 参见 archive/ 目录
