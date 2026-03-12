-- ============================================
-- 仅重置并重新插入「种子用户」的讨论与回复
-- ============================================
-- 用途：已有库里讨论/回复是旧 seed（内容不合理、没回复对人）时，用本迁移替换。
-- 执行后：只删除并重建 seed 用户的 discussions + discussion_replies，不动其他数据。
-- 若表无 parent_id / reply_to_user_id / reply_to_username，请先有对应 schema 迁移再跑本文件。

DELETE FROM public.discussion_replies
WHERE discussion_id IN (
  SELECT id FROM public.discussions
  WHERE author_id IN (
    '66020423-0000-0000-0000-000000000000',
    '11111111-0000-0000-0000-000000000000',
    '22222222-0000-0000-0000-000000000000',
    'a1111111-0000-0000-0000-000000000000',
    'b2222222-0000-0000-0000-000000000000',
    'c3333333-0000-0000-0000-000000000000',
    'd4444444-0000-0000-0000-000000000000',
    'e5555555-0000-0000-0000-000000000000'
  )
);
DELETE FROM public.discussions
WHERE author_id IN (
  '66020423-0000-0000-0000-000000000000',
  '11111111-0000-0000-0000-000000000000',
  '22222222-0000-0000-0000-000000000000',
  'a1111111-0000-0000-0000-000000000000',
  'b2222222-0000-0000-0000-000000000000',
  'c3333333-0000-0000-0000-000000000000',
  'd4444444-0000-0000-0000-000000000000',
  'e5555555-0000-0000-0000-000000000000'
);

DO $$
DECLARE
    v_user_teacher UUID := '22222222-0000-0000-0000-000000000000';
    v_user_student UUID := '11111111-0000-0000-0000-000000000000';
    v_user_alice UUID := 'a1111111-0000-0000-0000-000000000000';
    v_user_bob UUID := 'b2222222-0000-0000-0000-000000000000';
    v_user_charlie UUID := 'c3333333-0000-0000-0000-000000000000';
    v_user_david UUID := 'd4444444-0000-0000-0000-000000000000';
    v_user_eve UUID := 'e5555555-0000-0000-0000-000000000000';
    v_discuss_id1 BIGINT;
    v_discuss_id2 BIGINT;
    v_discuss_id3 BIGINT;
    v_discuss_id4 BIGINT;
    v_r1_1 BIGINT;
    v_r2_1 BIGINT;
    v_r3_1 BIGINT;
BEGIN
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

    -- 话题1
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id1, v_user_alice, '我觉得可以多带他们做做实验，比如这个网站上的项目，从简单的磁铁、感官盲盒开始，孩子会很有兴趣。', now() - interval '4 days')
    RETURNING id INTO v_r1_1;
    INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
    VALUES (v_discuss_id1, v_user_bob, v_r1_1, v_user_alice, 'alice', '同意 Alice，动手是最好的老师，做完一个小实验比看十集科普视频印象深。', now() - interval '4 days');
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id1, v_user_david, '可以约定「屏幕时间」换「实验时间」，做完一个项目才能玩一会儿，我家这样执行效果不错。', now() - interval '3 days');

    -- 话题2
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id2, v_user_bob, '城堡好酷！有内部结构图吗？想参考一下楼梯和房间怎么搭。', now() - interval '3 days')
    RETURNING id INTO v_r2_1;
    INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
    VALUES (v_discuss_id2, v_user_alice, v_r2_1, v_user_bob, 'bob', '晚点我拍几张内部图发上来，楼梯是用小颗粒叠的，房间分了卧室和武器库哈哈。', now() - interval '2 days');
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id2, v_user_teacher, '一周搭完大型城堡动手能力很强，可以试试加灯组和可动门，会更有成就感。', now() - interval '2 days');
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id2, v_user_charlie, '想看图+1，坐等楼主补图。', now() - interval '1 day');

    -- 话题3
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id3, v_user_teacher, '检查一下尾翼是否对称安装，四片尾翼要互相垂直且大小一致；再看看重心是否在箭体中线，压舱物别偏一侧。', now() - interval '1 day')
    RETURNING id INTO v_r3_1;
    INSERT INTO public.discussion_replies (discussion_id, author_id, parent_id, reply_to_user_id, reply_to_username, content, created_at)
    VALUES (v_discuss_id3, v_user_student, v_r3_1, v_user_teacher, 'teacher', '谢谢老师！我回去检查尾翼和重心，有结果再来反馈。', now() - interval '1 day');
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id3, v_user_david, '我之前也是往一边偏，后来发现是瓶口和尾翼的轴线没对齐，用直尺比着重新粘了一遍就好了。', now() - interval '1 day');

    -- 话题4
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id4, v_user_alice, '那个静电球我们上次也玩了，孩子特别开心，还有二楼的传声筒和光学迷宫也值得体验。', now() - interval '1 day');
    INSERT INTO public.discussion_replies (discussion_id, author_id, content, created_at)
    VALUES (v_discuss_id4, v_user_bob, '科技馆还有别的推荐项目吗？打算下周末带娃去，想提前做下攻略。', now() - interval '1 day');
END $$;
