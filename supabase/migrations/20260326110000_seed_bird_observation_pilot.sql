-- ============================================
-- 鸟类观察试点数据
-- 1 个挑战 + 3 个项目 + materials/steps
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
        start_date,
        end_date,
        completions_count
    ) VALUES (
        '北京春季常见鸟类观察',
        '面向初学者的春季鸟类观察活动，鼓励用户从身边环境开始，学习识别常见鸟、记录观察过程，并上传自己的观察成果。',
        '/projects/science_animals.webp',
        ARRAY['鸟类', '自然观察', '北京', '动物观察', '春季'],
        0,
        'timed',
        'active',
        '春天到了，北京的校园、公园和社区绿地变得比冬天更热闹。很多鸟开始繁殖、求偶、筑巢、觅食，也更容易被人注意到。你能不能像自然观察者一样，从身边开始认识这些鸟？',
        '在北京的春季环境里，我们最容易观察到哪些鸟？它们出现在什么地方，又表现出哪些行为？',
        '形成一批真实的鸟类观察项目成果，包括观察记录、照片、地点信息和初步物种认知。',
        ARRAY[
            '只观察，不追赶',
            '不靠近巢区',
            '以安全、安静、不打扰为前提',
            '优先观察身边环境'
        ],
        '[
          {"title":"鸟类观察入门","url":"/bird-observation/resources/birding-basics","type":"guide"},
          {"title":"北京观察地点提示","url":"/bird-observation/resources/beijing-locations","type":"guide"},
          {"title":"常见水鸟参考清单","url":"/bird-observation/resources/common-waterbirds","type":"guide"},
          {"title":"常见观察记录模板","url":"/bird-observation/resources/record-template","type":"template"}
        ]'::jsonb,
        '[
          {"title":"认识观察方法","description":"学会准备基础装备，了解记录什么、怎么记录。","hint":"先从时间、地点、天气、物种、数量、行为这几项开始。"},
          {"title":"选择观察场景","description":"在校园、公园或社区选择一个合适的观察点。","hint":"不必追求远行，先从最容易重复到达的地点开始。"},
          {"title":"完成一次定点观察","description":"至少完成一次 20 到 40 分钟的观察。","hint":"少走动、多等待，先观察鸟在做什么。"},
          {"title":"上传项目成果","description":"用项目提交你的观察结果、照片和发现。","hint":"除了看到什么，也写下你没看明白的问题。"}
        ]'::jsonb,
        '{"S":45,"T":5,"E":0,"A":10,"M":5}'::jsonb,
        2,
        now() - interval '7 days',
        now() + interval '60 days',
        0
    )
    RETURNING id INTO v_challenge_id;

    -- ============================================
    -- 项目 1: 北京公园常见水鸟观察
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
        '北京公园常见水鸟观察',
        '面向第一次做鸟类观察的用户，用公园湖面、湿地边和景观水域作为观察场景，帮助用户快速看见、记录并区分常见水鸟。',
        v_author_id,
        '/projects/science_animals.webp',
        '科学',
        v_sub_id,
        'easy',
        2,
        40,
        'approved',
        v_challenge_id,
        '哪一种鸟最容易识别？哪一种最难？你是否因为停下来观察更久而看到了新的行为？',
        '在北京的公园和城市水域里，最容易看到哪些水鸟？我们能不能通过一次观察，初步认识它们的外形、活动环境和行为？',
        ARRAY['鸟类', '自然观察', '北京', '水鸟', '公园']
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '双筒望远镜', 1),
        (v_project_id, '笔记本或手机记录工具', 2),
        (v_project_id, '手机或相机', 3),
        (v_project_id, '鸟类参考图鉴或项目内参考卡片', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择观察点', '选择一个有稳定水面的观察点，如公园湖区、城市湿地边或景观河道。', 1),
        (v_project_id, '先静看 5 分钟', '不急着拍照，先记录有哪些体型和活动方式不同的鸟。', 2),
        (v_project_id, '做粗分类', '用“在水上游、在岸边走、在浅水涉行、在树边停歇”这类方式先做粗分类。', 3),
        (v_project_id, '重点记录', '重点记录 2 到 4 种鸟的外形特征、数量和行为。', 4),
        (v_project_id, '补充辨认证据', '如果条件允许，补拍能辅助辨认的影像，而不是只拍“好看照片”。', 5),
        (v_project_id, '整理提交', '整理为一次完整提交，包含地点、时间、看到的鸟和自己的判断依据。', 6);

    -- ============================================
    -- 项目 2: 校园与社区常见鸟类晨间观察
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
        '校园与社区常见鸟类晨间观察',
        '把鸟类观察从“要去专门地点”变成“从身边开始”，适合学生、老师和家庭用户在校园或社区绿地进行低门槛观察。',
        v_author_id,
        '/projects/science_animals.webp',
        '科学',
        v_sub_id,
        'easy',
        1,
        25,
        'approved',
        v_challenge_id,
        '你原本以为身边“没有什么鸟”，实际观察后是否改变了这个看法？',
        '如果不去远郊和热门观鸟点，只在身边环境里观察，我们能看到哪些鸟？',
        ARRAY['鸟类', '自然观察', '校园', '社区', '晨间观察']
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '笔记本', 1),
        (v_project_id, '手机', 2),
        (v_project_id, '可选双筒望远镜', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择固定地点', '选择一个容易重复到达的地点，如教学楼外树林、操场边绿地、小区树阵或街心公园。', 1),
        (v_project_id, '选择晨间时段', '选择早晨相对安静、鸟活动较多的时间段进行观察。', 2),
        (v_project_id, '先听再看', '先听声音，再看鸟的位置和停栖高度。', 3),
        (v_project_id, '记录位置', '记录不同鸟出现的位置，如地面、灌丛、中层树枝、高处屋顶。', 4),
        (v_project_id, '连续对比', '连续观察 3 天或 3 次，对比是否总能看见同样的鸟。', 5),
        (v_project_id, '整理清单', '整理出一份“我身边常见鸟清单”。', 6);

    -- ============================================
    -- 项目 3: 定点行为观察：水鸟在做什么
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
        '定点行为观察：水鸟在做什么',
        '从“看到了什么鸟”进一步进入“它在做什么”，把观察重点从打卡式识别转向行为观察。',
        v_author_id,
        '/projects/science_animals.webp',
        '科学',
        v_sub_id,
        'medium',
        3,
        60,
        'approved',
        v_challenge_id,
        '你记录到的行为是偶然现象，还是反复出现的规律？有哪些内容还需要下次继续确认？',
        '同一种鸟在同一地点停留更久时，会出现哪些行为？这些行为和时间、环境、人流有什么关系？',
        ARRAY['鸟类', '自然观察', '行为观察', '水鸟']
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '双筒望远镜', 1),
        (v_project_id, '笔记本', 2),
        (v_project_id, '手机或相机', 3),
        (v_project_id, '可选三脚架或坐垫', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择久停点位', '选择一个适合久停的观察点，如湖边平台、湿地步道旁或岸边长椅区域。', 1),
        (v_project_id, '锁定观察对象', '锁定 1 种主要观察对象，如小䴙䴘、白鹭、夜鹭或鸭类。', 2),
        (v_project_id, '分时段记录', '用 20 分钟为单位记录它的行为变化，如觅食、梳羽、警戒、争斗、求偶或育雏相关行为。', 3),
        (v_project_id, '保持距离', '尽量保持安静和距离，不主动改变它的活动节奏。', 4),
        (v_project_id, '优先记录行为证据', '如果拍摄，优先补充行为证据，而不是为了追求特写持续逼近。', 5),
        (v_project_id, '整理行为报告', '整理为一份“行为观察小报告”，写下你仍然不确定的问题。', 6);
END $$;
