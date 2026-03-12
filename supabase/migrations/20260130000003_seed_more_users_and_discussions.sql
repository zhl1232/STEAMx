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
    v_discuss_id3 BIGINT;
    v_discuss_id4 BIGINT;
    v_comment_id BIGINT;
    v_rid BIGINT;

    v_user_student UUID := '11111111-0000-0000-0000-000000000000';
    v_user_teacher UUID := '22222222-0000-0000-0000-000000000000';
    v_user_alice UUID := 'a1111111-0000-0000-0000-000000000000';
    v_user_bob UUID := 'b2222222-0000-0000-0000-000000000000';
    v_user_charlie UUID := 'c3333333-0000-0000-0000-000000000000';
    v_user_david UUID := 'd4444444-0000-0000-0000-000000000000';
    v_user_eve UUID := 'e5555555-0000-0000-0000-000000000000';

    v_users UUID[];
    v_random_user UUID;
    v_parent_ids BIGINT[] := '{}';
    v_random_parent BIGINT;
    v_content TEXT;

    -- 讨论回复：每个话题的回复 ID 池，用于「回复某人」
    v_reply_ids1 BIGINT[] := '{}';
    v_reply_ids2 BIGINT[] := '{}';
    v_reply_ids3 BIGINT[] := '{}';
    v_reply_ids4 BIGINT[] := '{}';
    v_discussions BIGINT[];
    v_which INT;
    v_arr BIGINT[];
    v_parent_reply BIGINT;
    v_reply_to_uid UUID;
    v_reply_to_name TEXT;
    v_topic_contents TEXT[];
    v_content_idx INT;
    i INT;
BEGIN
    v_users := ARRAY[v_user_student, v_user_teacher, v_user_alice, v_user_bob, v_user_charlie, v_user_david, v_user_eve];

    SELECT id INTO v_proj_id1 FROM public.projects WHERE title LIKE '%磁铁%' LIMIT 1;
    SELECT id INTO v_proj_id2 FROM public.projects WHERE title LIKE '%金鱼%' LIMIT 1;

    -- 获取 4 个讨论 ID（与 seed_init 顺序一致：科学兴趣、乐高、水火箭、科技馆）
    SELECT id INTO v_discuss_id1 FROM public.discussions ORDER BY id ASC LIMIT 1 OFFSET 0;
    SELECT id INTO v_discuss_id2 FROM public.discussions ORDER BY id ASC LIMIT 1 OFFSET 1;
    SELECT id INTO v_discuss_id3 FROM public.discussions ORDER BY id ASC LIMIT 1 OFFSET 2;
    SELECT id INTO v_discuss_id4 FROM public.discussions ORDER BY id ASC LIMIT 1 OFFSET 3;
    v_discussions := ARRAY[v_discuss_id1, v_discuss_id2, v_discuss_id3, v_discuss_id4];

    -- =================================================
    -- A. 生成项目评论 (Comments) - 目标: 200+ 条
    -- =================================================
    IF v_proj_id1 IS NOT NULL THEN
        INSERT INTO public.comments (project_id, author_id, content) VALUES (v_proj_id1, v_user_alice, '请问老师，磁铁需要多大的吸力才够？家里只有很小的磁扣。') RETURNING id INTO v_comment_id;
        v_parent_ids := array_append(COALESCE(v_parent_ids, '{}'), v_comment_id);

        INSERT INTO public.comments (project_id, author_id, parent_id, content) VALUES (v_proj_id1, v_user_bob, v_comment_id, '我觉得小磁扣也可以，只要曲别针别太重就行。');
        INSERT INTO public.comments (project_id, author_id, parent_id, content) VALUES (v_proj_id1, v_user_teacher, v_comment_id, '是的，正如 Bob 所说，小磁扣没问题。如果在水里玩，注意擦干防止生锈。');

        INSERT INTO public.comments (project_id, author_id, content) VALUES (v_proj_id1, v_user_charlie, '我用乐高积木做了一个自动收线的鱼竿，效果超级酷！可以看我的主页。') RETURNING id INTO v_comment_id;
        v_parent_ids := array_append(v_parent_ids, v_comment_id);
        INSERT INTO public.comments (project_id, author_id, parent_id, content) VALUES (v_proj_id1, v_user_david, v_comment_id, '哇，乐高还能这么玩，学到了！');

        FOR i IN 1..200 LOOP
            v_random_user := v_users[1 + floor(random() * array_length(v_users, 1))::int];
            IF (random() < 0.3 AND array_length(v_parent_ids, 1) > 0) THEN
                v_random_parent := v_parent_ids[1 + floor(random() * array_length(v_parent_ids, 1))::int];
                v_content := '确实很有趣，我也试了一下，孩子很喜欢。';
                INSERT INTO public.comments (project_id, author_id, parent_id, content) VALUES (v_proj_id1, v_random_user, v_random_parent, v_content);
            ELSE
                v_content := '这个项目很实用，我们跟着做了一遍，步骤清晰。推荐！';
                INSERT INTO public.comments (project_id, author_id, content) VALUES (v_proj_id1, v_random_user, v_content) RETURNING id INTO v_comment_id;
                v_parent_ids := array_append(v_parent_ids, v_comment_id);
            END IF;
        END LOOP;
    END IF;

    -- =================================================
    -- B. 讨论区回复：按话题合理内容 + 回复到对应的人，数据量 200+ 条
    -- =================================================

    -- B1. 话题1 - 科学兴趣（已有基础回复，追加更多并建链）
    IF v_discuss_id1 IS NOT NULL THEN
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id1, v_user_charlie, '我们家用的是「周末实验日」，每周末做一个网站上的小项目，孩子会提前催。', now() - interval '3 days')
        RETURNING id INTO v_rid; v_reply_ids1 := array_append(v_reply_ids1, v_rid);
        INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
        VALUES (v_discuss_id1, v_user_eve, v_rid, v_user_charlie, 'charlie', 'Charlie 这个方法好，我们也试试固定一个日子。', now() - interval '3 days');
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id1, v_user_teacher, '补充一点：可以从孩子已经喜欢的动画或游戏切入，找相关的科学小实验，兴趣会高很多。', now() - interval '2 days')
        RETURNING id INTO v_rid; v_reply_ids1 := array_append(v_reply_ids1, v_rid);
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id1, v_user_alice, '还有博物馆和科技馆的亲子活动，报名参加几次，回来再自己做类似的小制作。', now() - interval '2 days')
        RETURNING id INTO v_rid; v_reply_ids1 := array_append(v_reply_ids1, v_rid);
        INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
        VALUES (v_discuss_id1, v_user_bob, v_rid, v_user_alice, 'alice', 'Alice 说得对，我们上次去了科技馆回来就做了静电球小实验。', now() - interval '1 day');
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id1, v_user_david, '减少批评、多夸具体行为很有用，比如「这个连接你装得很稳」比「你真棒」有效。', now() - interval '1 day')
        RETURNING id INTO v_rid; v_reply_ids1 := array_append(v_reply_ids1, v_rid);
    END IF;

    -- B2. 话题2 - 乐高
    IF v_discuss_id2 IS NOT NULL THEN
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id2, v_user_david, '大型城堡一周完成很强！用的哪个系列？我搭中型的一栋楼都要三四天。', now() - interval '2 days')
        RETURNING id INTO v_rid; v_reply_ids2 := array_append(v_reply_ids2, v_rid);
        INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
        VALUES (v_discuss_id2, v_user_alice, v_rid, v_user_david, 'david', '主要是经典大颗粒+部分小颗粒混搭，没按套装来，自己设计的。', now() - interval '2 days');
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id2, v_user_eve, '坐等内部图！想学楼梯和塔楼的结构。', now() - interval '1 day')
        RETURNING id INTO v_rid; v_reply_ids2 := array_append(v_reply_ids2, v_rid);
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id2, v_user_teacher, '可以发到「作品展示」区，让更多小朋友参考。', now() - interval '1 day')
        RETURNING id INTO v_rid; v_reply_ids2 := array_append(v_reply_ids2, v_rid);
        INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
        VALUES (v_discuss_id2, v_user_charlie, v_rid, v_user_teacher, 'teacher', '好的老师，我整理一下照片就发。', now() - interval '1 day');
    END IF;

    -- B3. 话题3 - 水火箭
    IF v_discuss_id3 IS NOT NULL THEN
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id3, v_user_alice, '我儿子上次也是偏，后来发现是打气嘴和瓶口没对正，重新粘了一次就好了。', now() - interval '1 day')
        RETURNING id INTO v_rid; v_reply_ids3 := array_append(v_reply_ids3, v_rid);
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id3, v_user_eve, '尾翼用硬卡纸的话要两面贴胶带防水，不然飞几次就软了也会偏。', now() - interval '1 day')
        RETURNING id INTO v_rid; v_reply_ids3 := array_append(v_reply_ids3, v_rid);
        INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
        VALUES (v_discuss_id3, v_user_student, v_rid, v_user_eve, 'eve', '谢谢 Eve，我检查下尾翼材质。', now() - interval '1 day');
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id3, v_user_bob, '打气时瓶身别歪，尽量竖直，我们第一次就是斜着打气导致偏。', now() - interval '1 day')
        RETURNING id INTO v_rid; v_reply_ids3 := array_append(v_reply_ids3, v_rid);
    END IF;

    -- B4. 话题4 - 科技馆
    IF v_discuss_id4 IS NOT NULL THEN
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id4, v_user_charlie, '传声筒和光学迷宫我们上次也玩了，排队人不多的话体验很好。', now() - interval '1 day')
        RETURNING id INTO v_rid; v_reply_ids4 := array_append(v_reply_ids4, v_rid);
        INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
        VALUES (v_discuss_id4, v_user_eve, v_rid, v_user_charlie, 'charlie', '对，工作日去人少很多。', now() - interval '1 day');
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id4, v_user_david, '一楼还有简单机械和齿轮区，可以动手转，孩子能玩很久。', now() - interval '1 day')
        RETURNING id INTO v_rid; v_reply_ids4 := array_append(v_reply_ids4, v_rid);
        INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
        VALUES (v_discuss_id4, v_user_teacher, '建议上午去，下午有些项目会排长队。', now() - interval '1 day')
        RETURNING id INTO v_rid; v_reply_ids4 := array_append(v_reply_ids4, v_rid);
    END IF;

    -- B5. 批量追加：按话题随机选讨论，25% 为「回复某人」，内容与话题匹配
    v_topic_contents := ARRAY[
        '动手实践确实比光看书有效多了。',
        '我们也是从简单实验开始入门的。',
        '科学兴趣要慢慢培养，不能急。',
        '多鼓励、少批评很有用。',
        '可以跟孩子一起选下一个做什么项目。',
        '这个网站上的项目很适合入门。',
        '城堡内部图什么时候发呀，等了好久。',
        '乐高搭完可以拍个延时视频分享。',
        '楼梯和塔楼怎么固定比较稳？',
        '想参考你的城堡结构。',
        '尾翼要一样大、对称贴。',
        '重心尽量在中间，压舱物别偏。',
        '打气嘴和瓶口对齐很重要。',
        '多试几次就能找到感觉。',
        '科技馆周末人比较多，建议早点去。',
        '静电球和传声筒都很好玩。',
        '还有别的展区推荐吗？',
        '我们上次去了二楼的机器人区。'
    ];
    FOR i IN 1..180 LOOP
        v_which := 1 + floor(random() * 4)::int;
        v_random_user := v_users[1 + floor(random() * array_length(v_users, 1))::int];
        v_content_idx := 1 + floor(random() * array_length(v_topic_contents, 1))::int;
        v_content := v_topic_contents[v_content_idx];

        IF v_which = 1 THEN v_arr := v_reply_ids1; ELSIF v_which = 2 THEN v_arr := v_reply_ids2; ELSIF v_which = 3 THEN v_arr := v_reply_ids3; ELSE v_arr := v_reply_ids4; END IF;

        IF (random() < 0.25 AND array_length(v_arr, 1) > 0) THEN
            v_parent_reply := v_arr[1 + floor(random() * array_length(v_arr, 1))::int];
            SELECT r.author_id, p.username INTO v_reply_to_uid, v_reply_to_name
            FROM public.discussion_replies r
            JOIN public.profiles p ON p.id = r.author_id
            WHERE r.id = v_parent_reply
            LIMIT 1;
            INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
            VALUES (v_discussions[v_which], v_random_user, v_parent_reply, v_reply_to_uid, v_reply_to_name, v_content, now() - (random() * interval '3 days'))
            RETURNING id INTO v_rid;
            IF v_which = 1 THEN v_reply_ids1 := array_append(v_reply_ids1, v_rid); ELSIF v_which = 2 THEN v_reply_ids2 := array_append(v_reply_ids2, v_rid); ELSIF v_which = 3 THEN v_reply_ids3 := array_append(v_reply_ids3, v_rid); ELSE v_reply_ids4 := array_append(v_reply_ids4, v_rid); END IF;
        ELSE
            INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
            VALUES (v_discussions[v_which], v_random_user, v_content, now() - (random() * interval '3 days'))
            RETURNING id INTO v_rid;
            IF v_which = 1 THEN v_reply_ids1 := array_append(v_reply_ids1, v_rid); ELSIF v_which = 2 THEN v_reply_ids2 := array_append(v_reply_ids2, v_rid); ELSIF v_which = 3 THEN v_reply_ids3 := array_append(v_reply_ids3, v_rid); ELSE v_reply_ids4 := array_append(v_reply_ids4, v_rid); END IF;
        END IF;
    END LOOP;
END $$;
