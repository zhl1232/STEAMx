-- ============================================
-- 扩展种子数据：增加用户与可观的评论量 (Extra Seed Data)
-- ============================================
-- 此脚本用于在现有数据基础上，追加:
-- 1. 5个新用户 (Alice, Bob, Charlie, David, Eve)
-- 2. 为项目 "磁铁钓鱼游戏" 和 "金鱼观察日记" 添加大量评论
-- 3. 确保所有项目都有徽章定义
-- ============================================

-- 1. 插入新用户 (如果不存在)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data) VALUES
('a1111111-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Alice W","avatar_url":"/avatars/default-4.svg"}'),
('b2222222-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Bob B","avatar_url":"/avatars/default-5.svg"}'),
('c3333333-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charlie@example.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Charlie C","avatar_url":"/avatars/default-6.svg"}'),
('d4444444-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'david@example.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"David D","avatar_url":"/avatars/default-7.svg"}'),
('e5555555-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve@example.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Eve E","avatar_url":"/avatars/default-8.svg"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, username, display_name, role, avatar_url, xp, level) VALUES
('a1111111-0000-0000-0000-000000000000', 'alice', 'Alice W', 'user', '/avatars/default-4.svg', 200, 4),
('b2222222-0000-0000-0000-000000000000', 'bob', 'Bob B', 'user', '/avatars/default-5.svg', 350, 6),
('c3333333-0000-0000-0000-000000000000', 'charlie', 'Charlie C', 'user', '/avatars/default-6.svg', 120, 2),
('d4444444-0000-0000-0000-000000000000', 'david', 'David D', 'user', '/avatars/default-7.svg', 800, 15),
('e5555555-0000-0000-0000-000000000000', 'eve', 'Eve E', 'user', '/avatars/default-8.svg', 450, 8)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name, xp = EXCLUDED.xp, level = EXCLUDED.level;

-- 2. 插入大量评论数据 (及讨论回复)
DO $$
DECLARE
    v_proj_id1 BIGINT;
    v_proj_id2 BIGINT;
    v_discuss_id1 BIGINT; 
    v_discuss_id2 BIGINT;
    v_comment_id BIGINT;
    v_reply_id BIGINT;
    
    v_user_student UUID := '11111111-0000-0000-0000-000000000000';
    v_user_teacher UUID := '22222222-0000-0000-0000-000000000000';
    v_user_alice UUID := 'a1111111-0000-0000-0000-000000000000';
    v_user_bob UUID := 'b2222222-0000-0000-0000-000000000000';
    v_user_charlie UUID := 'c3333333-0000-0000-0000-000000000000';
    v_user_david UUID := 'd4444444-0000-0000-0000-000000000000';
    v_user_eve UUID := 'e5555555-0000-0000-0000-000000000000';
    
    v_users UUID[];
    v_random_user UUID;
    v_parent_ids BIGINT[];
    v_random_parent BIGINT;
    v_content TEXT;
BEGIN
    v_users := ARRAY[v_user_student, v_user_teacher, v_user_alice, v_user_bob, v_user_charlie, v_user_david, v_user_eve];

    -- 获取项目 ID
    SELECT id INTO v_proj_id1 FROM public.projects WHERE title LIKE '%磁铁%' LIMIT 1;
    SELECT id INTO v_proj_id2 FROM public.projects WHERE title LIKE '%金鱼%' LIMIT 1;
    
    -- 获取讨论 ID (用于生成 discussion_replies)
    SELECT id INTO v_discuss_id1 FROM public.discussions LIMIT 1;

    -- =================================================
    -- A. 生成项目评论 (Comments) - 目标: 200+ 条
    -- =================================================
    IF v_proj_id1 IS NOT NULL THEN
        -- 1. 基础对话 (手动)
        INSERT INTO public.comments (project_id, author_id, content) VALUES (v_proj_id1, v_user_alice, '请问老师，磁铁需要多大的吸力才够？家里只有很小的磁扣。') RETURNING id INTO v_comment_id;
        v_parent_ids := array_append(v_parent_ids, v_comment_id); -- 记录为潜在父节点
        
        INSERT INTO public.comments (project_id, author_id, parent_id, content) VALUES (v_proj_id1, v_user_bob, v_comment_id, '我觉得小磁扣也可以，只要曲别针别太重就行。');
        INSERT INTO public.comments (project_id, author_id, parent_id, content) VALUES (v_proj_id1, v_user_teacher, v_comment_id, '是的，正如 Bob 所说，小磁扣没问题。如果在水里玩，注意擦干防止生锈。');

        INSERT INTO public.comments (project_id, author_id, content) VALUES (v_proj_id1, v_user_charlie, '我用乐高积木做了一个自动收线的鱼竿，效果超级酷！可以看我的主页。') RETURNING id INTO v_comment_id;
         v_parent_ids := array_append(v_parent_ids, v_comment_id);
         
        INSERT INTO public.comments (project_id, author_id, parent_id, content) VALUES (v_proj_id1, v_user_david, v_comment_id, '哇，乐高还能这么玩，学到了！');

        -- 2. 批量生成 (自动)
        FOR i IN 1..200 LOOP
            v_random_user := v_users[1 + floor(random() * array_length(v_users, 1))::int];
            
            -- 30% 概率是回复已有的评论 (如果有父节点可用)，70% 是新的一级评论
            IF (random() < 0.3 AND array_length(v_parent_ids, 1) > 0) THEN
                v_random_parent := v_parent_ids[1 + floor(random() * array_length(v_parent_ids, 1))::int];
                v_content := '回复 #' || v_random_parent || ': 确实很有趣，我也试了一下。';
                
                INSERT INTO public.comments (project_id, author_id, parent_id, content) 
                VALUES (v_proj_id1, v_random_user, v_random_parent, v_content);
            ELSE
                v_content := '这是一个非常棒的项目！这是第 ' || i || ' 条自动生成的评论。';
                INSERT INTO public.comments (project_id, author_id, content) 
                VALUES (v_proj_id1, v_random_user, v_content)
                RETURNING id INTO v_comment_id;
                
                -- 将新生成的评论 ID 加入父节点池，以便后续被回复
                v_parent_ids := array_append(v_parent_ids, v_comment_id);
            END IF;
        END LOOP;
    END IF;

    -- =================================================
    -- B. 生成讨论区回复 (Discussion Replies) - 目标: 100+ 条
    -- =================================================
    IF v_discuss_id1 IS NOT NULL THEN
         FOR i IN 1..100 LOOP
            v_random_user := v_users[1 + floor(random() * array_length(v_users, 1))::int];
            v_content := '这是关于话题的讨论回复 #' || i || '。我觉得大家说的都有道理。';
            
            INSERT INTO public.discussion_replies (discussion_id, author_id, content)
            VALUES (v_discuss_id1, v_random_user, v_content);
         END LOOP;
    END IF;

END $$;
