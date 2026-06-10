-- Seed one realistic PBL challenge and its starter project for manual testing.

DO $$
DECLARE
    v_author_id UUID;
    v_category_id INT;
    v_sub_id INT;
    v_challenge_id BIGINT;
    v_project_id BIGINT;
BEGIN
    -- 已由 20260610120000_remove_seed_pbl_challenges.sql 下架，不再写入。
    RETURN;

    SELECT id INTO v_author_id
      FROM public.profiles
     WHERE role = 'admin'
     ORDER BY created_at ASC
     LIMIT 1;

    IF v_author_id IS NULL THEN
        SELECT id INTO v_author_id
          FROM public.profiles
         ORDER BY created_at ASC
         LIMIT 1;
    END IF;

    IF v_author_id IS NULL THEN
        RAISE EXCEPTION 'No users found in profiles table';
    END IF;

    SELECT id INTO v_category_id
      FROM public.categories
     WHERE name = '工程'
     LIMIT 1;

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION '找不到分类: 工程';
    END IF;

    SELECT id INTO v_sub_id
      FROM public.sub_categories
     WHERE category_id = v_category_id
       AND name = '模型制作'
     LIMIT 1;

    IF v_sub_id IS NULL THEN
        RAISE EXCEPTION '找不到子分类: 模型制作';
    END IF;

    SELECT id INTO v_challenge_id
      FROM public.challenges
     WHERE title = '校园遮阳休息站挑战'
     LIMIT 1;

    IF v_challenge_id IS NULL THEN
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
            '校园遮阳休息站挑战',
            '为校园操场、走廊转角或社区空地设计一个小型遮阳休息站。你需要观察真实使用场景，制作可测试的结构模型，并用数据说明它是否更稳、更凉、更方便使用。',
            '/projects/eng_models.webp',
            ARRAY['PBL', '校园改造', '结构设计', '遮阳', '模型制作'],
            0,
            'evergreen',
            'active',
            '夏天的课间和放学后，操场边常常缺少可以短暂停留的阴凉空间。一个好的遮阳休息站不能只好看，还要能站稳、挡住太阳、留出通行空间，并且使用安全、材料可获得。',
            '怎样用有限材料设计一个稳定、实用、可解释的校园遮阳休息站原型？',
            '提交一个遮阳休息站模型，包含场地观察、结构草图、承重或稳定性测试、遮阳效果对比和一次以上迭代反思。',
            ARRAY[
                '模型跨度至少 20 厘米，并保留可通行空间',
                '主体材料优先使用纸板、吸管、竹签、冰棍棒等低成本材料',
                '必须进行至少 1 次稳定性测试和 1 次遮阳范围测试',
                '提交时说明一次失败或改进，而不只展示最终成品',
                '不使用尖锐裸露结构，模型边角需要做安全处理'
            ],
            '[]'::jsonb,
            '[
              {"title":"观察真实需求","description":"选择一个校园或社区角落，记录谁会在那里停留、什么时候最晒、需要遮住多大范围。","hint":"先画一张简单场地平面图，不急着开始做模型。"},
              {"title":"提出结构方案","description":"画出至少两种遮阳结构草图，比较立柱、屋顶形状和支撑方式。","hint":"注意屋顶越大，支撑和抗倾倒要求越高。"},
              {"title":"制作并测试原型","description":"用低成本材料制作一个可站立模型，测试承重、抗倾倒和遮阳范围。","hint":"每次测试只改一个变量，方便判断原因。"},
              {"title":"迭代并说明取舍","description":"根据测试结果改进模型，写清楚你保留、放弃或调整了哪些设计。","hint":"优秀作品应该能解释为什么这样设计。"}
            ]'::jsonb,
            '{"S":10,"T":5,"E":35,"A":15,"M":15}'::jsonb,
            3,
            0
        )
        RETURNING id INTO v_challenge_id;
    ELSE
        UPDATE public.challenges
           SET description = '为校园操场、走廊转角或社区空地设计一个小型遮阳休息站。你需要观察真实使用场景，制作可测试的结构模型，并用数据说明它是否更稳、更凉、更方便使用。',
               image_url = '/projects/eng_models.webp',
               tags = ARRAY['PBL', '校园改造', '结构设计', '遮阳', '模型制作'],
               challenge_type = 'evergreen',
               status = 'active',
               scenario = '夏天的课间和放学后，操场边常常缺少可以短暂停留的阴凉空间。一个好的遮阳休息站不能只好看，还要能站稳、挡住太阳、留出通行空间，并且使用安全、材料可获得。',
               driving_question = '怎样用有限材料设计一个稳定、实用、可解释的校园遮阳休息站原型？',
               expected_outcome = '提交一个遮阳休息站模型，包含场地观察、结构草图、承重或稳定性测试、遮阳效果对比和一次以上迭代反思。',
               constraints = ARRAY[
                   '模型跨度至少 20 厘米，并保留可通行空间',
                   '主体材料优先使用纸板、吸管、竹签、冰棍棒等低成本材料',
                   '必须进行至少 1 次稳定性测试和 1 次遮阳范围测试',
                   '提交时说明一次失败或改进，而不只展示最终成品',
                   '不使用尖锐裸露结构，模型边角需要做安全处理'
               ],
               stages = '[
                 {"title":"观察真实需求","description":"选择一个校园或社区角落，记录谁会在那里停留、什么时候最晒、需要遮住多大范围。","hint":"先画一张简单场地平面图，不急着开始做模型。"},
                 {"title":"提出结构方案","description":"画出至少两种遮阳结构草图，比较立柱、屋顶形状和支撑方式。","hint":"注意屋顶越大，支撑和抗倾倒要求越高。"},
                 {"title":"制作并测试原型","description":"用低成本材料制作一个可站立模型，测试承重、抗倾倒和遮阳范围。","hint":"每次测试只改一个变量，方便判断原因。"},
                 {"title":"迭代并说明取舍","description":"根据测试结果改进模型，写清楚你保留、放弃或调整了哪些设计。","hint":"优秀作品应该能解释为什么这样设计。"}
               ]'::jsonb,
               steam_weights = '{"S":10,"T":5,"E":35,"A":15,"M":15}'::jsonb,
               difficulty_stars = 3
         WHERE id = v_challenge_id;
    END IF;

    SELECT id INTO v_project_id
      FROM public.projects
     WHERE title = '校园遮阳休息站原型'
     LIMIT 1;

    IF v_project_id IS NULL THEN
        INSERT INTO public.projects (
            title,
            description,
            author_id,
            image_url,
            category,
            sub_category_id,
            difficulty,
            difficulty_stars,
            status,
            challenge_id,
            reflection,
            problem_statement,
            iterations,
            steam_weights,
            tags
        ) VALUES (
            '校园遮阳休息站原型',
            '从真实校园痛点出发，设计并制作一个小型遮阳休息站模型。你将先观察阳光方向和人流，再用纸板、吸管或冰棍棒搭建结构，最后通过承重、抗倾倒和遮阳范围测试来改进方案。',
            v_author_id,
            '/projects/eng_models.webp',
            '工程',
            v_sub_id,
            'medium',
            3,
            'approved',
            v_challenge_id,
            '第一次模型只追求屋顶面积，结果很容易向一侧倾倒。第二版把四根立柱改成外扩支撑，并增加三角斜撑后，稳定性明显提升。遮阳范围和结构安全之间需要取舍，不能只把屋顶做大。',
            '校园操场边在午后缺少阴凉休息点。我们能否用低成本材料设计一个既能遮阳、又能保持稳定和通行安全的小型休息站？',
            '[
              {"description":"第一版使用四根竖直吸管做立柱，屋顶用整张卡纸。遮阳范围大，但轻轻推动就会侧翻。","result":"判断问题来自屋顶面积过大和支撑底面太窄，记录为需要优先解决的稳定性问题。","created_at":"2026-06-09T10:00:00.000Z"},
              {"description":"第二版将立柱向外倾斜，底部加宽，并用短吸管做三角斜撑。屋顶改成两片拼接，降低单侧受力。","result":"模型能承受 200 克砝码并通过 3 次轻推测试，遮阳面积略小但整体更可靠。","created_at":"2026-06-09T10:30:00.000Z"}
            ]'::jsonb,
            '{"S":10,"T":5,"E":35,"A":15,"M":15}'::jsonb,
            ARRAY['PBL', '校园改造', '工程设计', '模型制作', '结构测试', '遮阳']
        )
        RETURNING id INTO v_project_id;
    ELSE
        UPDATE public.projects
           SET description = '从真实校园痛点出发，设计并制作一个小型遮阳休息站模型。你将先观察阳光方向和人流，再用纸板、吸管或冰棍棒搭建结构，最后通过承重、抗倾倒和遮阳范围测试来改进方案。',
               author_id = v_author_id,
               image_url = '/projects/eng_models.webp',
               category = '工程',
               sub_category_id = v_sub_id,
               difficulty = 'medium',
               difficulty_stars = 3,
               status = 'approved',
               challenge_id = v_challenge_id,
               reflection = '第一次模型只追求屋顶面积，结果很容易向一侧倾倒。第二版把四根立柱改成外扩支撑，并增加三角斜撑后，稳定性明显提升。遮阳范围和结构安全之间需要取舍，不能只把屋顶做大。',
               problem_statement = '校园操场边在午后缺少阴凉休息点。我们能否用低成本材料设计一个既能遮阳、又能保持稳定和通行安全的小型休息站？',
               iterations = '[
                 {"description":"第一版使用四根竖直吸管做立柱，屋顶用整张卡纸。遮阳范围大，但轻轻推动就会侧翻。","result":"判断问题来自屋顶面积过大和支撑底面太窄，记录为需要优先解决的稳定性问题。","created_at":"2026-06-09T10:00:00.000Z"},
                 {"description":"第二版将立柱向外倾斜，底部加宽，并用短吸管做三角斜撑。屋顶改成两片拼接，降低单侧受力。","result":"模型能承受 200 克砝码并通过 3 次轻推测试，遮阳面积略小但整体更可靠。","created_at":"2026-06-09T10:30:00.000Z"}
               ]'::jsonb,
               steam_weights = '{"S":10,"T":5,"E":35,"A":15,"M":15}'::jsonb,
               tags = ARRAY['PBL', '校园改造', '工程设计', '模型制作', '结构测试', '遮阳'],
               updated_at = NOW()
         WHERE id = v_project_id;
    END IF;

    DELETE FROM public.project_materials
     WHERE project_id = v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板或卡纸 3 张', 1),
        (v_project_id, '吸管或竹签 20 根', 2),
        (v_project_id, '冰棍棒 12 根', 3),
        (v_project_id, '透明胶带或热熔胶', 4),
        (v_project_id, '剪刀和美工刀（需成人协助）', 5),
        (v_project_id, '直尺、铅笔和量角器', 6),
        (v_project_id, '手电筒或台灯（模拟太阳）', 7),
        (v_project_id, '硬币或砝码若干（测试承重）', 8),
        (v_project_id, '记录表或实验笔记本', 9);

    DELETE FROM public.project_steps
     WHERE project_id = v_project_id;

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '观察场地与使用者', '选择一个想改造的位置，记录午后阳光方向、人流动线、可能停留的人群，以及不能阻挡通行的区域。画出一张简易平面图。', 1),
        (v_project_id, '明确设计指标', '把需求转成可测试指标：模型跨度至少 20 厘米、能遮住一张 10×10 厘米纸片、轻推 3 次不倒、能承受 200 克重量。', 2),
        (v_project_id, '画出两个方案', '分别画出平顶、斜顶或拱形屋顶等方案，标注立柱位置、斜撑方向、屋顶尺寸和材料连接方式。', 3),
        (v_project_id, '制作第一版模型', '按其中一个方案制作模型。先固定底座和立柱，再安装屋顶，连接点要贴紧压牢。完成后拍照并记录实际尺寸。', 4),
        (v_project_id, '做稳定性测试', '在屋顶中心逐步增加硬币或砝码，记录最大承重；从前后左右轻推模型各 3 次，记录是否倾倒或变形。', 5),
        (v_project_id, '做遮阳范围测试', '用台灯或手电筒从固定角度照射模型，在纸上描出阴影范围。改变屋顶角度后重复测试，比较阴影面积变化。', 6),
        (v_project_id, '迭代结构', '根据测试结果只改一个关键变量，例如加宽底座、增加三角斜撑、缩小屋顶或调整屋顶角度，再做同样测试。', 7),
        (v_project_id, '整理 PBL 说明', '提交模型照片、测试表格、前后两版对比，以及一段反思：你的方案解决了什么问题，牺牲了什么，又还需要继续验证什么。', 8);

    UPDATE public.challenges
       SET resources = jsonb_build_array(
           jsonb_build_object('title', '查看示例项目', 'url', format('/project/%s', v_project_id), 'type', 'project'),
           jsonb_build_object('title', '提交你的遮阳站方案', 'url', format('/share?challenge=%s', v_challenge_id), 'type', 'template'),
           jsonb_build_object('title', '回到创造营', 'url', '/create', 'type', 'guide')
       )
     WHERE id = v_challenge_id;
END $$;
