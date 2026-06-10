-- ============================================
-- 蚂蚁观察挑战数据
-- 1 个长期挑战 + 3 个 starter 项目
-- ============================================

DO $$
DECLARE
    v_author_id UUID;
    v_sub_id INT;
    v_challenge_id BIGINT;
    v_project_id BIGINT;
BEGIN
    -- 已由 20260610120000_remove_seed_pbl_challenges.sql 下架，不再写入。
    RETURN;

    SELECT id INTO v_author_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
    IF v_author_id IS NULL THEN
        SELECT id INTO v_author_id FROM public.profiles LIMIT 1;
    END IF;

    IF v_author_id IS NULL THEN
        RAISE EXCEPTION 'No users found in profiles table';
    END IF;

    SELECT id INTO v_sub_id
      FROM public.sub_categories
     WHERE name = '动物观察'
     LIMIT 1;

    IF v_sub_id IS NULL THEN
        RAISE EXCEPTION '找不到子分类: 动物观察';
    END IF;

    INSERT INTO public.challenges (
        title,
        description,
        image_url,
        tags,
        participants_count,
        challenge_type,
        status,
        scenario,
        driving_question,
        expected_outcome,
        constraints,
        resources,
        stages,
        steam_weights,
        difficulty_stars,
        completions_count
    ) VALUES (
        '14天蚂蚁观察挑战',
        '面向初学者的多日自然观察活动。选择一个家里、小区或校园附近的蚂蚁活动点，连续 14 天记录它们的路线、搬运、挖掘和同伴互动，把零散观察变成一份真实的行为日志。',
        '/projects/science_animals.webp',
        ARRAY['蚂蚁', '自然观察', '昆虫', '动物观察', '多日观察'],
        0,
        'evergreen',
        'active',
        '你可能每天都见过蚂蚁，却很少真的停下来观察它们。只要连续看上几天，就会发现同一个蚁巢在不同天气、时间和食物条件下会出现完全不同的节奏：有时在搬食物，有时在清理巢口，有时在挖新洞，还有时会出现像是在拖拽同伴的复杂互动。',
        '如果我们连续 14 天在同一个地点观察蚂蚁，能否识别出它们稳定出现的行为模式，并区分“看到的事实”和“自己的猜想”？',
        '形成一份包含连续日志、行为分类、照片或视频证据和个人反思的蚂蚁观察作品；重点不是证明一个结论，而是把多日观察记录清楚。',
        ARRAY[
            '不挖开蚁巢，不灌水，不堵洞',
            '不捕捉和长期圈养蚂蚁',
            '只使用少量安全食物，不投放有害物质',
            '观察时保持距离，不用手反复拨弄路线',
            '对“救同伴”等高解释性行为必须标注为疑似或待确认'
        ],
        '[]'::jsonb,
        '[
          {"title":"找到固定观察点","description":"在家里、小区或校园附近找到一个可连续到达的蚂蚁活动点。","hint":"优先选同一个洞口、墙角路线或树下蚁道，便于多天比较。"},
          {"title":"连续观察 14 天","description":"每天在相近时间观察 10 到 20 分钟，记录天气、数量变化和行为。","hint":"不要只记录“看到了蚂蚁”，而要写出它们在做什么。"},
          {"title":"区分行为与猜想","description":"把打洞、搬运、触角接触、拖拽、停留警戒等现象分开记录。","hint":"看到复杂行为时，先写事实，再补一句自己的猜想。"},
          {"title":"整理证据并提交","description":"从 14 天记录里整理出最有代表性的 3 到 5 条证据，完成作品提交。","hint":"优先提交能说明变化过程的日志和证据，而不只是单张照片。"}
        ]'::jsonb,
        '{"S":40,"T":0,"E":5,"A":5,"M":10}'::jsonb,
        2,
        0
    )
    RETURNING id INTO v_challenge_id;

    UPDATE public.challenges
       SET resources = jsonb_build_array(
           jsonb_build_object('title', '开始提交连续观察', 'url', format('/share?challenge=%s', v_challenge_id), 'type', 'template'),
           jsonb_build_object('title', '查看最近观察记录', 'url', '/explore/observations', 'type', 'guide'),
           jsonb_build_object('title', '浏览动物观察项目', 'url', '/explore', 'type', 'guide')
       )
     WHERE id = v_challenge_id;

    -- ============================================
    -- 项目 1: 固定蚁巢口 7 天观察
    -- ============================================
    INSERT INTO public.projects (
        title,
        description,
        author_id,
        image_url,
        category,
        sub_category_id,
        difficulty,
        difficulty_stars,
        duration,
        status,
        challenge_id,
        reflection,
        problem_statement,
        tags
    ) VALUES (
        '固定蚁巢口 7 天观察',
        '从最小可执行的观察开始。连续 7 天回到同一个蚁巢口或固定路线，记录蚂蚁什么时候最活跃、是在进出巢穴还是在搬运东西，建立你的第一份定点日志。',
        v_author_id,
        '/projects/science_animals.webp',
        '科学',
        v_sub_id,
        'easy',
        1,
        20,
        'approved',
        v_challenge_id,
        '同一个地点在不同天是否总是一样热闹？哪些变化可能和时间、天气或路人干扰有关？',
        '如果连续 7 天回到同一个蚂蚁活动点，我们能看到稳定的日常规律，还是每天都不一样？',
        ARRAY['蚂蚁', '自然观察', '定点观察', '多日记录']
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '观察日志或笔记本', 1),
        (v_project_id, '手机或相机', 2),
        (v_project_id, '计时器', 3),
        (v_project_id, '可选放大镜', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选一个固定点', '选择一个能连续到达的蚂蚁洞口、墙角路线或树下活动点。', 1),
        (v_project_id, '固定时间观察', '连续 7 天在相近时间观察 10 到 20 分钟，尽量保持同样的观看位置。', 2),
        (v_project_id, '记录基础信息', '每次都记下日期、时间、天气、地点和蚂蚁活跃程度。', 3),
        (v_project_id, '描述当天行为', '用短句记录当天看到的行为，如排队进出、停留、搬运、小范围挖掘。', 4),
        (v_project_id, '补 1 条证据', '每天至少补 1 张照片或 1 段短视频，优先记录能对比前后变化的画面。', 5),
        (v_project_id, '整理一周变化', '第 7 天回看全部记录，写出你认为最稳定和最反常的现象。', 6);

    -- ============================================
    -- 项目 2: 蚂蚁搬运路线与食物选择
    -- ============================================
    INSERT INTO public.projects (
        title,
        description,
        author_id,
        image_url,
        category,
        sub_category_id,
        difficulty,
        difficulty_stars,
        duration,
        status,
        challenge_id,
        reflection,
        problem_statement,
        tags
    ) VALUES (
        '蚂蚁搬运路线与食物选择',
        '观察蚂蚁如何发现、传递和搬运食物。你可以先记录天然觅食路线，也可以在远离巢口的位置放少量安全食物，比较不同食物被发现和搬运的速度。',
        v_author_id,
        '/projects/science_animals.webp',
        '科学',
        v_sub_id,
        'easy',
        2,
        30,
        'approved',
        v_challenge_id,
        '蚂蚁最先找到的是哪种食物？它们的路线是逐渐变稳定，还是一直在变化？',
        '蚂蚁是怎样找到食物并让更多同伴参与搬运的？不同食物或不同位置会不会改变路线选择？',
        ARRAY['蚂蚁', '自然观察', '搬运', '路线追踪']
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '少量安全食物，如面包屑或糖水棉签', 1),
        (v_project_id, '白纸或记录板', 2),
        (v_project_id, '铅笔', 3),
        (v_project_id, '手机', 4),
        (v_project_id, '计时器', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '先看天然路线', '先观察现场已有的蚂蚁路线，不要一开始就投放食物。', 1),
        (v_project_id, '少量设置食物', '如需比较搬运行为，在远离巢口的位置放少量安全食物，不要堵住洞口。', 2),
        (v_project_id, '记录发现时间', '记下第一只蚂蚁接触食物、大量同伴到来和开始搬运的大致时间。', 3),
        (v_project_id, '画出路线草图', '把蚂蚁从食物点到巢口或转折点的大致路线画下来，标注障碍和拐弯。', 4),
        (v_project_id, '比较两次观察', '至少在两天内重复观察，比较相同路线是否被重复使用。', 5),
        (v_project_id, '写下你的解释', '把看到的事实和你对信息传递、协作分工的猜想分开写。', 6);

    -- ============================================
    -- 项目 3: 连续行为观察：打洞、搬运与同伴互动
    -- ============================================
    INSERT INTO public.projects (
        title,
        description,
        author_id,
        image_url,
        category,
        sub_category_id,
        difficulty,
        difficulty_stars,
        duration,
        status,
        challenge_id,
        reflection,
        problem_statement,
        tags
    ) VALUES (
        '连续行为观察：打洞、搬运与同伴互动',
        '把观察重点从“有没有蚂蚁”推进到“蚂蚁在做什么”。连续多天记录蚂蚁是否在扩洞、搬运食物、清理碎屑、拖拽同伴或进行触角交流，并学会对高解释性行为保持谨慎。',
        v_author_id,
        '/projects/science_animals.webp',
        '科学',
        v_sub_id,
        'medium',
        3,
        40,
        'approved',
        v_challenge_id,
        '哪些行为你能用证据支持，哪些只是暂时的猜想？如果你怀疑看到“救同伴”，你有什么事实依据，又缺什么证据？',
        '在同一个蚂蚁群体里，哪些行为会稳定重复出现？我们怎样避免把复杂互动过早解释成“合作”或“救援”？',
        ARRAY['蚂蚁', '自然观察', '行为观察', '多日记录']
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '观察日志模板', 1),
        (v_project_id, '手机或相机', 2),
        (v_project_id, '计时器', 3),
        (v_project_id, '可选放大镜或小夹板', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '建立行为清单', '先准备一张行为清单，至少包含打洞、搬运、触角接触、停留警戒、拖拽或清理。', 1),
        (v_project_id, '连续 14 天记录', '在两周内尽量保持相近时间段观察，同一地点至少完成 6 次以上正式记录。', 2),
        (v_project_id, '先写事实再写猜想', '例如先写“1 只蚂蚁拖动另 1 只蚂蚁 20 厘米”，再写“疑似转移同伴”。', 3),
        (v_project_id, '给复杂行为留证据', '一旦看到罕见行为，优先拍短视频，并记下前后发生了什么。', 4),
        (v_project_id, '比较不同时段', '看看清晨、午后、阴天或雨后，哪些行为更容易出现。', 5),
        (v_project_id, '整理成行为报告', '选 3 到 5 条最有代表性的记录，说明你最有把握的结论和仍待确认的问题。', 6);
END $$;
