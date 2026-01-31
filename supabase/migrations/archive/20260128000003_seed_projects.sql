-- ============================================
-- 批量导入项目：一年级科学（人教鄂教版）
-- 生成时间：2026-01-28
-- ============================================

DO $$
DECLARE
    v_phys_id INT;
    v_bio_id INT;
    v_eng_id INT;
    v_art_id INT;
    v_project_id BIGINT;
    v_author_id UUID := 'fc9f4384-2bb5-418e-a2e2-8c29bff6e7c5';
BEGIN
    -- 获取分类 ID
    SELECT id INTO v_phys_id FROM public.sub_categories WHERE name = '物理实验' LIMIT 1;
    SELECT id INTO v_bio_id FROM public.sub_categories WHERE name = '生物观察' LIMIT 1;
    SELECT id INTO v_eng_id FROM public.sub_categories WHERE name = '机械结构' LIMIT 1; -- 对应工程
    SELECT id INTO v_art_id FROM public.sub_categories WHERE name = '手工' LIMIT 1;

    -- ============================================
    -- 项目 1: 磁铁钓鱼游戏 (物理实验)
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
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
        '科学'
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
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '制作不倒翁',
        '选自第一单元《不倒翁》。利用橡皮泥和蛋壳（或乒乓球）制作一个怎样推都不倒的玩具，初步感知重心与稳定性的关系。',
        v_author_id,
        v_eng_id, -- 借用机械结构或手工分类
        2,
        30,
        'approved',
        '/projects/tumbler_toy.png',
        ARRAY['一年级', '人教版', '工程', '手工'],
        '工程'
    ) RETURNING id INTO v_project_id;

    -- 插入材料
    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '乒乓球或半个蛋壳', 1),
        (v_project_id, '橡皮泥', 2),
        (v_project_id, '彩笔', 3),
        (v_project_id, '胶水', 4);

    -- 插入步骤
    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备底部', '将乒乓球剪开，只留半圆球体。', 1),
        (v_project_id, '增加配重', '在半球体的内部底部中心位置，粘上一块橡皮泥。', 2),
        (v_project_id, '装饰', '用彩笔在球面上画出喜欢的表情或图案，或者用卡纸做一个帽子粘上去。', 3),
        (v_project_id, '测试', '轻轻推一下不倒翁，看它是否能自己站起来。如果不行，调整底部橡皮泥的位置或重量。', 4);

    -- ============================================
    -- 项目 3: 感官盲盒挑战 (生物观察)
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
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
        '科学'
    ) RETURNING id INTO v_project_id;

    -- 插入材料
    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '不透明的盒子或布袋', 1),
        (v_project_id, '各种常见物品（橘子、铃铛、毛绒玩具等）', 2),
        (v_project_id, '眼罩（可选）', 3);

    -- 插入步骤
    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备盲盒', '找一个搭档，让他将一件物品放入盒子或布袋中，不让你看见。', 1),
        (v_project_id, '触摸', '把手伸进去摸一摸，感受它的形状、软硬、冷热和粗糙程度。', 2),
        (v_project_id, '听声', '摇晃一下盒子，听听发出的声音。', 3),
        (v_project_id, '闻味', '凑近闻一闻（如果是水果等有气味的物品）。注意不要随意品尝未知物品！', 4),
        (v_project_id, '猜测', '综合你的感觉，猜猜这个物品是什么。', 5);

    -- ============================================
    -- 项目 4: 金鱼观察日记 (生物观察)
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
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
        '科学'
    ) RETURNING id INTO v_project_id;

    -- 插入材料
    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小金鱼', 1),
        (v_project_id, '鱼缸或透明容器', 2),
        (v_project_id, '鱼食', 3),
        (v_project_id, '纸和笔', 4);

    -- 插入步骤
    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '观察外形', '仔细看金鱼的身体形状，它有几只鳍？身上的鳞片是什么样的？', 1),
        (v_project_id, '观察运动', '金鱼在水里是怎么游泳的？观察它的尾巴和鳍是怎么动的。', 2),
        (v_project_id, '观察呼吸', '看金鱼的嘴巴和鳃盖一张一合，这是它在呼吸。', 3),
        (v_project_id, '喂食', '轻轻放入一点鱼食，观察金鱼是怎么吃东西的。', 4),
        (v_project_id, '画一画', '把你观察到的金鱼画下来，并标注它的身体部位。', 5);

    -- ============================================
    -- 项目 5: 手工杯垫制作 (手工)
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
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
        '艺术'
    ) RETURNING id INTO v_project_id;

    -- 插入材料
    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板或不织布', 1),
        (v_project_id, '毛线或彩绳', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '直尺', 4),
        (v_project_id, '铅笔', 5),
        (v_project_id, '胶水', 6);

    -- 插入步骤
    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计形状', '用铅笔和直尺在纸板上画出一个正方形或圆形。', 1),
        (v_project_id, '裁剪底板', '小心使用剪刀，沿着画好的线剪下底板。', 2),
        (v_project_id, '缠绕装饰', '涂上胶水，将毛线或彩绳一圈圈盘绕或粘贴在底板上，可以拼出不同的花纹。', 3),
        (v_project_id, '整理修剪', '剪掉多余的线头，等胶水干后，可以在杯垫边缘做一些流苏装饰。', 4),
        (v_project_id, '试用', '放上你的水杯试一试吧！', 5);

END $$;
