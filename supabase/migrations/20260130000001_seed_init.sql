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
('curious_mind', '好奇宝宝', '浏览超过 10 个项目', '🔍', '{"type": "projects_viewed", "count": 10}'),
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
-- 4. 插入示例项目 (Projects)
-- ============================================

DO $$
DECLARE
    v_phys_id INT;
    v_bio_id INT;
    v_eng_id INT;
    v_art_id INT;
    v_project_id BIGINT;
    v_author_id UUID := '66020423-0000-0000-0000-000000000000'; -- 使用 Admin 用户作为作者
BEGIN
    -- 获取分类 ID (需要在 schema 初始化后运行)
    SELECT id INTO v_phys_id FROM public.sub_categories WHERE name = '物理实验' LIMIT 1;
    SELECT id INTO v_bio_id FROM public.sub_categories WHERE name = '生物观察' LIMIT 1;
    SELECT id INTO v_eng_id FROM public.sub_categories WHERE name = '机械结构' LIMIT 1;
    SELECT id INTO v_art_id FROM public.sub_categories WHERE name = '手工' LIMIT 1;

    -- ============================================
    -- 项目 1: 磁铁钓鱼游戏 (物理实验)
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category, views_count, likes_count)
    VALUES (
        '磁铁钓鱼游戏',
        '选自第一单元《“钓鱼”游戏》。通过制作简单的钓鱼玩具，探索磁铁的性质。观察磁铁能吸起什么，不能吸起什么，理解磁性原理。',
        v_author_id,
        v_phys_id,
        1,
        20,
        'approved',
        '/projects/magnet_fishing.png',
        ARRAY['一年级', '人教版', '科学', '物理'],
        '科学',
        128,
        12
    ) RETURNING id INTO v_project_id;

    -- 插入材料
    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小纸片或卡纸（画成鱼）', 1),
        (v_project_id, '曲别针（回形针）', 2),
        (v_project_id, '磁铁', 3),
        (v_project_id, '小木棍或筷子', 4),
        (v_project_id, '细线', 5);

    -- 插入步骤
    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作小鱼', '在卡纸上画出小鱼的形状并剪下来。', 1),
        (v_project_id, '安装鱼钩', '在每条纸小鱼的嘴巴位置夹上一个曲别针。', 2),
        (v_project_id, '制作鱼竿', '用细线将磁铁系在小木棍的一端。', 3),
        (v_project_id, '开始钓鱼', '尝试用磁铁去“钓”起小鱼，观察哪些部分吸引在一起。', 4),
        (v_project_id, '思考', '为什么磁铁能把带有曲别针的小鱼钓起来？试着去吸一吸其他物品。', 5);

    -- ============================================
    -- 项目 2: 制作不倒翁 (手工/工程)
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category, views_count, likes_count)
    VALUES (
        '制作不倒翁',
        '选自第一单元《不倒翁》。利用橡皮泥和蛋壳（或乒乓球）制作一个怎样推都不倒的玩具，初步感知重心与稳定性的关系。',
        v_author_id,
        v_eng_id,
        2,
        30,
        'approved',
        '/projects/tumbler_toy.png',
        ARRAY['一年级', '人教版', '工程', '手工'],
        '工程',
        256,
        45
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '乒乓球或半个蛋壳', 1),
        (v_project_id, '橡皮泥', 2),
        (v_project_id, '彩笔', 3),
        (v_project_id, '胶水', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备底部', '将乒乓球剪开，只留半圆球体。', 1),
        (v_project_id, '增加配重', '在半球体的内部底部中心位置，粘上一块橡皮泥。', 2),
        (v_project_id, '装饰', '用彩笔在球面上画出喜欢的表情或图案，或者用卡纸做一个帽子粘上去。', 3),
        (v_project_id, '测试', '轻轻推一下不倒翁，看它是否能自己站起来。如果不行，调整底部橡皮泥的位置或重量。', 4);

    -- ============================================
    -- 项目 3: 感官盲盒挑战 (生物观察)
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category, views_count, likes_count)
    VALUES (
        '感官盲盒挑战',
        '选自第二单元《我们怎样知道》。如果不使用眼睛，我们还能辨认出物体吗？利用触觉、嗅觉和听觉来猜测盒子里的物品。',
        v_author_id,
        v_bio_id,
        1,
        15,
        'approved',
        '/projects/sensory_box.png',
        ARRAY['一年级', '人教版', '科学', '生物'],
        '科学',
        89,
        8
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '不透明的盒子或布袋', 1),
        (v_project_id, '各种常见物品（橘子、铃铛、毛绒玩具等）', 2),
        (v_project_id, '眼罩（可选）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备盲盒', '找一个搭档，让他将一件物品放入盒子或布袋中，不让你看见。', 1),
        (v_project_id, '触摸', '把手伸进去摸一摸，感受它的形状、软硬、冷热和粗糙程度。', 2),
        (v_project_id, '听声', '摇晃一下盒子，听听发出的声音。', 3),
        (v_project_id, '闻味', '凑近闻一闻（如果是水果等有气味的物品）。注意不要随意品尝未知物品！', 4),
        (v_project_id, '猜测', '综合你的感觉，猜猜这个物品是什么。', 5);

    -- ============================================
    -- 项目 4: 金鱼观察日记 (生物观察)
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category, views_count, likes_count)
    VALUES (
        '金鱼观察日记',
        '选自第三单元《金鱼》。通过观察金鱼的外形、运动和进食，认识水生动物的特征。',
        v_author_id,
        v_bio_id,
        3,
        45,
        'approved',
        '/projects/goldfish_observation.png',
        ARRAY['一年级', '人教版', '科学', '生物'],
        '科学',
        302,
        60
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小金鱼', 1),
        (v_project_id, '鱼缸或透明容器', 2),
        (v_project_id, '鱼食', 3),
        (v_project_id, '纸和笔', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '观察外形', '仔细看金鱼的身体形状，它有几只鳍？身上的鳞片是什么样的？', 1),
        (v_project_id, '观察运动', '金鱼在水里是怎么游泳的？观察它的尾巴和鳍是怎么动的。', 2),
        (v_project_id, '观察呼吸', '看金鱼的嘴巴和鳃盖一张一合，这是它在呼吸。', 3),
        (v_project_id, '喂食', '轻轻放入一点鱼食，观察金鱼是怎么吃东西的。', 4),
        (v_project_id, '画一画', '把你观察到的金鱼画下来，并标注它的身体部位。', 5);

    -- ============================================
    -- 项目 5: 手工杯垫制作 (手工)
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category, views_count, likes_count)
    VALUES (
        '手工杯垫制作',
        '选自第四单元《制作杯垫》。体验工具的作用，利用剪刀和尺子，制作一个实用又美观的杯垫。',
        v_author_id,
        v_art_id,
        2,
        40,
        'approved',
        '/projects/handmade_coaster.png',
        ARRAY['一年级', '人教版', '艺术', '手工'],
        '艺术',
        500,
        120
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板或不织布', 1),
        (v_project_id, '毛线或彩绳', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '直尺', 4),
        (v_project_id, '铅笔', 5),
        (v_project_id, '胶水', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计形状', '用铅笔和直尺在纸板上画出一个正方形或圆形。', 1),
        (v_project_id, '裁剪底板', '小心使用剪刀，沿着画好的线剪下底板。', 2),
        (v_project_id, '缠绕装饰', '涂上胶水，将毛线或彩绳一圈圈盘绕或粘贴在底板上，可以拼出不同的花纹。', 3),
        (v_project_id, '整理修剪', '剪掉多余的线头，等胶水干后，可以在杯垫边缘做一些流苏装饰。', 4),
        (v_project_id, '试用', '放上你的水杯试一试吧！', 5);

END $$;

-- ============================================
-- 5. 插入交互数据 (Interactions)
-- ============================================

-- 5.1 学生给项目点赞 (给前3个项目点赞)
INSERT INTO public.likes (user_id, project_id)
SELECT '11111111-0000-0000-0000-000000000000', id 
FROM public.projects 
ORDER BY id ASC
LIMIT 3
ON CONFLICT DO NOTHING;

-- 5.2 老师给项目点赞 (给后3个项目点赞)
INSERT INTO public.likes (user_id, project_id)
SELECT '22222222-0000-0000-0000-000000000000', id 
FROM public.projects 
ORDER BY id DESC
LIMIT 3
ON CONFLICT DO NOTHING;

-- 5.3 学生收藏项目 (收藏第 2 个项目)
INSERT INTO public.collections (user_id, project_id)
SELECT '11111111-0000-0000-0000-000000000000', id 
FROM public.projects 
ORDER BY id ASC
OFFSET 1 LIMIT 1
ON CONFLICT DO NOTHING;

-- 5.4 学生评论项目
INSERT INTO public.comments (project_id, author_id, content)
SELECT id, '11111111-0000-0000-0000-000000000000', '这个项目太棒了！我和爸爸一起做了一个，非常好玩。'
FROM public.projects 
ORDER BY id ASC
LIMIT 1;

-- 5.5 老师回复评论
INSERT INTO public.comments (project_id, author_id, parent_id, content)
SELECT project_id, '22222222-0000-0000-0000-000000000000', id, '真棒！继续加油！'
FROM public.comments
WHERE author_id = '11111111-0000-0000-0000-000000000000'
LIMIT 1;

-- 5.6 学生完成项目 (完成第 1 个项目)
INSERT INTO public.completed_projects (user_id, project_id, proof_images, notes, is_public, likes_count)
SELECT 
    '11111111-0000-0000-0000-000000000000', 
    id, 
    ARRAY['https://storage.googleapis.com/codeskulptor-assets/lathrop/nebula_blue.png'], 
    '这是我第一次做这个实验，非常成功！磁铁真的把回形针吸起来了。', 
    true,
    0
FROM public.projects 
ORDER BY id ASC
LIMIT 1
ON CONFLICT DO NOTHING;

-- 5.7 给管理员添加一些初始徽章 (用于展示)
INSERT INTO public.user_badges (user_id, badge_id, unlocked_at)
VALUES 
    ('66020423-0000-0000-0000-000000000000', 'first_step', now() - interval '1 day'),
    ('66020423-0000-0000-0000-000000000000', 'creator', now()),
    ('66020423-0000-0000-0000-000000000000', 'master', now())
ON CONFLICT DO NOTHING;


-- ============================================
-- ============================================
-- 6. 插入讨论和回复 (Discussions & Replies)
-- ============================================
-- 回复均按话题写死内容，且「回复某人」时设置 parent_id / reply_to_user_id / reply_to_username
--
-- 若已跑过本 migration 且想「只替换」讨论/回复数据，可执行单独迁移：
--   supabase/migrations/20260312130000_reseed_discussions_and_replies.sql

DELETE FROM public.discussion_replies;
DELETE FROM public.discussions;

DO $$
DECLARE
    v_user_admin UUID := '66020423-0000-0000-0000-000000000000';
    v_user_student UUID := '11111111-0000-0000-0000-000000000000';
    v_user_teacher UUID := '22222222-0000-0000-0000-000000000000';
    v_user_alice UUID := 'a1111111-0000-0000-0000-000000000000';
    v_user_bob UUID := 'b2222222-0000-0000-0000-000000000000';
    v_user_charlie UUID := 'c3333333-0000-0000-0000-000000000000';
    v_user_david UUID := 'd4444444-0000-0000-0000-000000000000';
    v_user_eve UUID := 'e5555555-0000-0000-0000-000000000000';
    v_discuss_id1 BIGINT;
    v_discuss_id2 BIGINT;
    v_discuss_id3 BIGINT;
    v_discuss_id4 BIGINT;
    -- 用于「回复某人」的回复 ID
    v_r1_1 BIGINT;  -- 话题1 第1条 (Alice)
    v_r2_1 BIGINT;  -- 话题2 第1条 (Bob)
    v_r3_1 BIGINT;  -- 话题3 第1条 (Teacher)
BEGIN
    -- 6.1 创建初始话题
    INSERT INTO public.discussions (title, content, author_id, tags, likes_count, created_at)
    VALUES
    ('如何培养孩子的科学兴趣？', '大家有什么好方法吗？我发现现在的孩子更喜欢玩手机。', v_user_teacher, ARRAY['教育心得', '科学'], 15, now() - interval '5 days')
    RETURNING id INTO v_discuss_id1;

    INSERT INTO public.discussions (title, content, author_id, tags, likes_count, created_at)
    VALUES
    ('分享一下最新的乐高搭建作品', '刚完成了一个大型城堡，花了一周时间！图在评论里补。', v_user_alice, ARRAY['乐高', '分享'], 32, now() - interval '3 days')
    RETURNING id INTO v_discuss_id2;

    INSERT INTO public.discussions (title, content, author_id, tags, likes_count, created_at)
    VALUES
    ('求助：水火箭发射总是歪', '做了一个水火箭，气密性没问题，但是每次起飞都往左偏，是尾翼的问题吗？', v_user_student, ARRAY['求助', '物理'], 8, now() - interval '2 days')
    RETURNING id INTO v_discuss_id3;

    INSERT INTO public.discussions (title, content, author_id, tags, likes_count, created_at)
    VALUES
    ('周末去科技馆打卡了', '体验了那个静电球，头发真的竖起来了，太好玩了！推荐大家都去。', v_user_eve, ARRAY['探店', '日常'], 20, now() - interval '1 day')
    RETURNING id INTO v_discuss_id4;

    -- 6.2 话题1：如何培养孩子的科学兴趣？（楼主 Teacher）
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id1, v_user_alice, '我觉得可以多带他们做做实验，比如这个网站上的项目，从简单的磁铁、感官盲盒开始，孩子会很有兴趣。', now() - interval '4 days')
    RETURNING id INTO v_r1_1;

    INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
    VALUES (v_discuss_id1, v_user_bob, v_r1_1, v_user_alice, 'alice', '同意 Alice，动手是最好的老师，做完一个小实验比看十集科普视频印象深。', now() - interval '4 days');

    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id1, v_user_david, '可以约定「屏幕时间」换「实验时间」，做完一个项目才能玩一会儿，我家这样执行效果不错。', now() - interval '3 days');

    -- 6.3 话题2：乐高城堡（楼主 Alice）
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id2, v_user_bob, '城堡好酷！有内部结构图吗？想参考一下楼梯和房间怎么搭。', now() - interval '3 days')
    RETURNING id INTO v_r2_1;

    INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
    VALUES (v_discuss_id2, v_user_alice, v_r2_1, v_user_bob, 'bob', '晚点我拍几张内部图发上来，楼梯是用小颗粒叠的，房间分了卧室和武器库哈哈。', now() - interval '2 days');

    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id2, v_user_teacher, '一周搭完大型城堡动手能力很强，可以试试加灯组和可动门，会更有成就感。', now() - interval '2 days');

    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id2, v_user_charlie, '想看图+1，坐等楼主补图。', now() - interval '1 day');

    -- 6.4 话题3：水火箭求助（楼主 Student）
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id3, v_user_teacher, '检查一下尾翼是否对称安装，四片尾翼要互相垂直且大小一致；再看看重心是否在箭体中线，压舱物别偏一侧。', now() - interval '1 day')
    RETURNING id INTO v_r3_1;

    INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
    VALUES (v_discuss_id3, v_user_student, v_r3_1, v_user_teacher, 'teacher', '谢谢老师！我回去检查尾翼和重心，有结果再来反馈。', now() - interval '1 day');

    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id3, v_user_david, '我之前也是往一边偏，后来发现是瓶口和尾翼的轴线没对齐，用直尺比着重新粘了一遍就好了。', now() - interval '1 day');

    -- 6.5 话题4：科技馆打卡（楼主 Eve）
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id4, v_user_alice, '那个静电球我们上次也玩了，孩子特别开心，还有二楼的传声筒和光学迷宫也值得体验。', now() - interval '1 day');

    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id4, v_user_bob, '科技馆还有别的推荐项目吗？打算下周末带娃去，想提前做下攻略。', now() - interval '1 day');
END $$;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 初始种子数据加载完成！';
  RAISE NOTICE '👤 管理员账号: 66020423@qq.com / 123456';
  RAISE NOTICE '👤 学生账号: student@example.com / 123456';
  RAISE NOTICE '👤 老师账号: teacher@example.com / 123456';
  RAISE NOTICE '📚 全部示例项目和徽章已导入';
END $$;
