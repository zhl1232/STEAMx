DO $$
DECLARE
    v_sub_id INT;
    v_project_id BIGINT;
    v_author_id UUID;
BEGIN
    SELECT id INTO v_author_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
    IF v_author_id IS NULL THEN
        SELECT id INTO v_author_id FROM public.profiles LIMIT 1;
    END IF;
    IF v_author_id IS NULL THEN
        RAISE EXCEPTION 'No users found in profiles table';
    END IF;
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '化学实验' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 化学实验'; END IF;

    -- Project 1: 火山爆发模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '火山爆发模型',
        '用小苏打和醋模拟真实的火山喷发效果！孩子将亲手搭建火山模型，观察酸碱混合后产生大量气泡的壮观场景。通过这个实验，理解酸碱反应产生二氧化碳气体的基本化学原理。',
        v_author_id, v_sub_id, 1, 20, 'approved', '/projects/science_chemistry.webp',
        ARRAY['酸碱反应','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小苏打 2勺', 1),
        (v_project_id, '白醋 半杯', 2),
        (v_project_id, '红色食用色素 几滴', 3),
        (v_project_id, '洗洁精 少量', 4),
        (v_project_id, '塑料瓶（小号）', 5),
        (v_project_id, '黏土或橡皮泥', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建火山外形', '用黏土或橡皮泥包裹塑料瓶，捏出火山的形状，顶部留出瓶口作为火山口。', 1),
        (v_project_id, '准备"岩浆"', '在塑料瓶中加入两勺小苏打、几滴红色食用色素和少量洗洁精。', 2),
        (v_project_id, '触发喷发', '将白醋缓缓倒入瓶中，观察"岩浆"从火山口涌出。', 3),
        (v_project_id, '观察与记录', '观察气泡的产生过程，记录喷发的高度和持续时间，讨论酸和碱混合后为什么会产生气体。', 4);

    -- Project 2: 牛奶星空画
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '牛奶星空画',
        '在牛奶表面滴入不同颜色的色素，再用棉签蘸洗洁精轻触，看颜色奇妙地旋转扩散！孩子将观察表面张力被破坏后液体的运动规律。这个实验色彩绚烂，既是科学探索也是艺术创作。',
        v_author_id, v_sub_id, 1, 15, 'approved', '/projects/science_chemistry.webp',
        ARRAY['表面张力','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '全脂牛奶 一碗', 1),
        (v_project_id, '食用色素（多种颜色）', 2),
        (v_project_id, '洗洁精 少量', 3),
        (v_project_id, '棉签 若干', 4),
        (v_project_id, '浅盘或盘子', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '倒入牛奶', '将全脂牛奶倒入浅盘中，液面约1厘米深，等待表面平静。', 1),
        (v_project_id, '滴入色素', '在牛奶表面不同位置分别滴入红、黄、蓝等颜色的食用色素，每种2-3滴。', 2),
        (v_project_id, '魔法触碰', '棉签一端蘸少量洗洁精，轻轻触碰牛奶表面有色素的地方，观察颜色的变化。', 3),
        (v_project_id, '探索更多', '尝试在不同位置触碰，观察颜色旋转和混合的效果，讨论洗洁精如何破坏牛奶的表面张力。', 4);

    -- Project 3: 彩色泡泡实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '彩色泡泡实验',
        '自制彩色泡泡液，吹出五颜六色的泡泡并观察它们在阳光下的色彩变化！孩子将了解泡泡薄膜的表面张力原理，以及色素如何在液膜中分布。这是一个充满欢乐又能学到知识的户外实验。',
        v_author_id, v_sub_id, 1, 20, 'approved', '/projects/science_chemistry.webp',
        ARRAY['表面张力','色素','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '水 500毫升', 1),
        (v_project_id, '洗洁精 3勺', 2),
        (v_project_id, '甘油或白糖 1勺', 3),
        (v_project_id, '食用色素（多种颜色）', 4),
        (v_project_id, '吸管或铁丝环', 5),
        (v_project_id, '小杯子 若干', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '配制泡泡液', '将水、洗洁精和甘油（或白糖）混合搅拌均匀，静置几分钟让泡泡液稳定。', 1),
        (v_project_id, '分装染色', '将泡泡液分装到几个小杯中，每杯加入不同颜色的食用色素搅拌均匀。', 2),
        (v_project_id, '吹出彩色泡泡', '用吸管或铁丝环蘸取不同颜色的泡泡液，轻轻吹出彩色泡泡。', 3),
        (v_project_id, '观察泡泡', '观察泡泡表面的颜色和光泽变化，讨论为什么泡泡是圆形的，表面张力如何让液膜保持形状。', 4),
        (v_project_id, '泡泡画创作', '在白纸上方吹泡泡，让彩色泡泡落在纸上留下美丽的痕迹，制作一幅泡泡画。', 5);

    -- Project 4: 面团发酵观察
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '面团发酵观察',
        '用面粉和酵母制作面团，观察发酵过程中面团如何膨胀变大！孩子将了解酵母菌这种微生物如何将糖分解并产生二氧化碳气体。实验结束还可以把面团做成小面包品尝。',
        v_author_id, v_sub_id, 1, 60, 'approved', '/projects/science_chemistry.webp',
        ARRAY['酵母菌','产气','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '面粉 200克', 1),
        (v_project_id, '干酵母 3克', 2),
        (v_project_id, '温水 100毫升', 3),
        (v_project_id, '白糖 1勺', 4),
        (v_project_id, '透明玻璃碗', 5),
        (v_project_id, '保鲜膜', 6),
        (v_project_id, '直尺或卷尺', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '激活酵母', '将干酵母和白糖加入温水（约35°C）中，轻轻搅拌后静置5分钟，观察水面是否出现小气泡。', 1),
        (v_project_id, '揉制面团', '将酵母水倒入面粉中，揉成光滑的面团，放入透明玻璃碗中。', 2),
        (v_project_id, '标记与等待', '用记号笔在碗外侧标记面团的初始高度，盖上保鲜膜，放在温暖处等待30-40分钟。', 3),
        (v_project_id, '观察膨胀', '每10分钟观察并记录面团高度的变化，看它如何慢慢变大。', 4),
        (v_project_id, '揭秘气体', '用手指按压发酵好的面团，感受里面的气孔，讨论酵母菌产生二氧化碳使面团膨胀的原理。', 5);

    -- Project 5: 盐画艺术
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '盐画艺术',
        '用胶水在纸上画出图案，撒上食盐，再滴上彩色颜料水，创作出独特的盐画！孩子将观察盐的溶解与结晶过程，了解水分蒸发后盐如何重新形成晶体。艺术与科学的完美结合。',
        v_author_id, v_sub_id, 1, 30, 'approved', '/projects/science_chemistry.webp',
        ARRAY['溶解','结晶','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白色卡纸', 1),
        (v_project_id, '白胶（手工胶水）', 2),
        (v_project_id, '食盐 适量', 3),
        (v_project_id, '水彩颜料或食用色素', 4),
        (v_project_id, '滴管或小毛笔', 5),
        (v_project_id, '托盘（接盐用）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绘制胶水图案', '用白胶在卡纸上画出喜欢的图案或文字，线条要饱满连续。', 1),
        (v_project_id, '撒盐覆盖', '趁胶水未干，大量撒上食盐覆盖所有胶水线条，然后轻轻抖落多余的盐。', 2),
        (v_project_id, '滴入颜色', '用滴管吸取稀释的水彩颜料或色素水，沿着盐线轻轻滴下，观察颜色如何沿盐粒扩散。', 3),
        (v_project_id, '干燥与观察', '将作品平放晾干，观察水分蒸发后盐结晶的样子，讨论溶解和结晶的过程。', 4);

    -- Project 6: 自制酸碱指示剂
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '自制酸碱指示剂',
        '用紫甘蓝汁制作天然的酸碱指示剂，测试家中各种液体的酸碱性！孩子将看到紫甘蓝汁遇到酸性物质变红、遇到碱性物质变绿的神奇变化。这是认识化学检测方法的入门实验。',
        v_author_id, v_sub_id, 2, 30, 'approved', '/projects/science_chemistry.webp',
        ARRAY['酸碱性','化学检测','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '紫甘蓝 半颗', 1),
        (v_project_id, '热水 适量', 2),
        (v_project_id, '透明杯子 6-8个', 3),
        (v_project_id, '白醋', 4),
        (v_project_id, '小苏打水', 5),
        (v_project_id, '柠檬汁', 6),
        (v_project_id, '肥皂水', 7),
        (v_project_id, '滤网或纱布', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作指示剂', '将紫甘蓝切碎，倒入热水浸泡15分钟，用滤网过滤得到紫色的指示剂液体。', 1),
        (v_project_id, '准备测试样品', '在每个透明杯中分别倒入白醋、柠檬汁、小苏打水、肥皂水、清水等不同液体。', 2),
        (v_project_id, '滴入指示剂', '向每个杯子中加入等量的紫甘蓝指示剂，观察颜色变化。', 3),
        (v_project_id, '记录结果', '记录每种液体对应的颜色变化，红色/粉色代表酸性，紫色代表中性，绿色/黄色代表碱性。', 4),
        (v_project_id, '归纳总结', '将测试结果按酸碱性排列，制作一张简单的酸碱对照表，讨论生活中常见物质的酸碱性。', 5);

    -- Project 7: 水果电池
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '水果电池',
        '用柠檬、铜币和锌片制作一个能点亮小灯泡的水果电池！孩子将了解电化学的基本原理，知道化学能如何转化为电能。多个水果串联还能让效果更明显。',
        v_author_id, v_sub_id, 2, 25, 'approved', '/projects/science_chemistry.webp',
        ARRAY['电化学','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '柠檬 3-4个', 1),
        (v_project_id, '铜片或铜币 4片', 2),
        (v_project_id, '镀锌铁钉 4根', 3),
        (v_project_id, '导线（带鳄鱼夹）4根', 4),
        (v_project_id, 'LED小灯泡 1个', 5),
        (v_project_id, '小刀（需家长帮助）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '插入电极', '在每个柠檬上相隔2厘米各插入一片铜片和一根锌钉，插入深度约2厘米。', 1),
        (v_project_id, '串联连接', '用导线将第一个柠檬的铜片连接到第二个柠檬的锌钉，依此类推，将所有柠檬串联起来。', 2),
        (v_project_id, '连接灯泡', '将第一个柠檬的锌钉和最后一个柠檬的铜片分别连接到LED灯泡的两个引脚。', 3),
        (v_project_id, '观察发光', '观察LED灯泡是否亮起，如果太暗可以再增加柠檬的数量。', 4),
        (v_project_id, '探究原理', '讨论为什么柠檬能发电：柠檬汁是电解质，铜和锌是不同活性的金属，产生了电位差。', 5);

    -- Project 8: 隐形墨水
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '隐形墨水',
        '用柠檬汁作为隐形墨水写下秘密信息，再用加热的方式让字迹显现！孩子将了解柠檬汁中的有机物在加热后发生氧化反应而变色的原理。像间谍一样传递秘密信息充满了趣味。',
        v_author_id, v_sub_id, 2, 20, 'approved', '/projects/science_chemistry.webp',
        ARRAY['化学反应','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '柠檬 1个', 1),
        (v_project_id, '小碗', 2),
        (v_project_id, '棉签或细毛笔', 3),
        (v_project_id, '白纸', 4),
        (v_project_id, '台灯或吹风机（需家长辅助）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作墨水', '将柠檬切开，挤出柠檬汁到小碗中，可以加入少量清水稀释。', 1),
        (v_project_id, '书写秘密信息', '用棉签蘸取柠檬汁，在白纸上写字或画图，等待纸张完全干透。', 2),
        (v_project_id, '晾干检查', '纸张干透后，字迹几乎不可见，可以让家人猜猜纸上写了什么。', 3),
        (v_project_id, '加热显字', '在家长帮助下，用台灯或吹风机对纸张加热，观察字迹慢慢变为棕色显现出来。', 4),
        (v_project_id, '讨论原理', '讨论为什么加热后字迹会显现：柠檬酸是有机物，受热后发生氧化反应变成棕色。', 5);

    -- Project 9: 碘液检测淀粉
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '碘液检测淀粉',
        '用碘酒测试各种食物中是否含有淀粉，看看哪些食物会变成蓝紫色！孩子将学习碘遇淀粉变色这一经典化学检测方法。通过动手实验，了解不同食物的成分差异。',
        v_author_id, v_sub_id, 2, 20, 'approved', '/projects/science_chemistry.webp',
        ARRAY['化学检测','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '碘酒（药店可买）', 1),
        (v_project_id, '滴管', 2),
        (v_project_id, '白色小盘子 若干', 3),
        (v_project_id, '面包片', 4),
        (v_project_id, '米饭少量', 5),
        (v_project_id, '苹果片', 6),
        (v_project_id, '土豆片', 7),
        (v_project_id, '白纸（记录用）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备食物样品', '将面包、米饭、苹果、土豆等食物分别放在白色小盘子中，每份取少量即可。', 1),
        (v_project_id, '预测结果', '在记录纸上列出所有食物名称，先猜测哪些含淀粉、哪些不含。', 2),
        (v_project_id, '滴加碘酒', '用滴管在每种食物上滴1-2滴碘酒，仔细观察颜色变化。', 3),
        (v_project_id, '记录与对比', '记录每种食物滴碘酒后的颜色，变蓝紫色的说明含有淀粉，与预测结果对比。', 4),
        (v_project_id, '总结规律', '总结哪些食物含淀粉较多，讨论淀粉在我们饮食中的作用。', 5);

    -- Project 10: 色彩分层饮料
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '色彩分层饮料',
        '利用不同浓度糖水的密度差异，制作一杯彩虹分层饮料！孩子将理解溶液密度的概念，学会如何通过控制糖的浓度来实现液体分层。这是一个视觉效果极佳的实验。',
        v_author_id, v_sub_id, 2, 25, 'approved', '/projects/science_chemistry.webp',
        ARRAY['密度','溶液','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白糖 适量', 1),
        (v_project_id, '温水', 2),
        (v_project_id, '食用色素（4种颜色）', 3),
        (v_project_id, '小杯子 4个', 4),
        (v_project_id, '透明高杯 1个', 5),
        (v_project_id, '勺子', 6),
        (v_project_id, '注射器或滴管', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '配制不同浓度糖水', '在4个小杯中各加等量温水，分别加入4勺、3勺、2勺、1勺白糖，搅拌至完全溶解。', 1),
        (v_project_id, '添加颜色', '给每杯糖水加入不同颜色的食用色素，浓度最高的用最深的颜色。', 2),
        (v_project_id, '分层倒入', '先将浓度最高（最重）的糖水倒入高杯底部，然后用勺子背面或滴管沿杯壁缓缓加入次浓度的糖水。', 3),
        (v_project_id, '逐层叠加', '依次加入浓度越来越低的糖水，每层操作要非常缓慢，避免扰动下层液体。', 4),
        (v_project_id, '观察彩虹', '观察最终的分层效果，讨论为什么糖水浓度越高密度越大，重的液体沉在下面。', 5);

    -- Project 11: 自制彩色晶体
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '自制彩色晶体',
        '用明矾或食盐培养属于自己的彩色晶体，见证小小的晶种慢慢长大的过程！孩子将学习溶解度随温度变化的规律以及结晶的原理。这需要耐心等待几天，但成果会非常惊艳。',
        v_author_id, v_sub_id, 3, 45, 'approved', '/projects/science_chemistry.webp',
        ARRAY['结晶','溶解度','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '明矾（药店可买）200克', 1),
        (v_project_id, '热水 500毫升', 2),
        (v_project_id, '食用色素', 3),
        (v_project_id, '透明玻璃杯', 4),
        (v_project_id, '棉线', 5),
        (v_project_id, '铅笔或筷子（横搁杯口用）', 6),
        (v_project_id, '滤纸或纱布', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作饱和溶液', '在热水中不断加入明矾并搅拌，直到无法再溶解为止，制成过饱和溶液。', 1),
        (v_project_id, '添色过滤', '加入喜欢的食用色素搅匀，用滤纸过滤掉未溶解的杂质，倒入干净的玻璃杯。', 2),
        (v_project_id, '悬挂晶种', '将棉线系在铅笔上，末端可绑一小颗明矾晶体作为晶种，横搁在杯口让线悬入溶液。', 3),
        (v_project_id, '耐心等待', '将玻璃杯放在阴凉不被打扰的地方，每天观察晶体的生长情况，持续3-7天。', 4),
        (v_project_id, '收获晶体', '取出长好的晶体，观察它的形状和颜色，讨论温度降低时溶质从溶液中析出结晶的过程。', 5);

    -- Project 12: 铁锈实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '铁锈实验',
        '对比观察铁钉在不同环境下的生锈速度，探究铁生锈需要哪些条件！孩子将通过设置对照实验，理解氧化反应的概念以及水和氧气在生锈过程中的作用。培养科学实验的对照思维。',
        v_author_id, v_sub_id, 3, 30, 'approved', '/projects/science_chemistry.webp',
        ARRAY['氧化反应','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '铁钉 6根（相同大小）', 1),
        (v_project_id, '玻璃杯 3个', 2),
        (v_project_id, '清水', 3),
        (v_project_id, '食用油 少量', 4),
        (v_project_id, '食盐 少量', 5),
        (v_project_id, '记录本和笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计对照组', '杯1：铁钉放在干燥空气中；杯2：铁钉浸没在清水中；杯3：铁钉浸没在盐水中。', 1),
        (v_project_id, '设置实验', '分别将铁钉放入对应的玻璃杯中，杯1保持干燥，杯2加满清水，杯3加盐水，贴好标签。', 2),
        (v_project_id, '每日观察', '连续5-7天，每天同一时间观察并记录每根铁钉的变化，拍照对比。', 3),
        (v_project_id, '对比分析', '对比三组铁钉的生锈程度，盐水中的最快，干燥环境最慢，验证生锈需要水和氧气。', 4),
        (v_project_id, '防锈讨论', '讨论生活中常见的防锈方法（涂漆、镀锌、涂油），理解隔绝水和氧气能防止氧化。', 5);

    -- Project 13: 自制灭火器
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '自制灭火器',
        '用小苏打和醋产生二氧化碳气体，制作一个简易灭火器扑灭小蜡烛火焰！孩子将理解二氧化碳比空气重且不支持燃烧的特性。这个实验需要在家长监督下进行，兼顾安全教育。',
        v_author_id, v_sub_id, 3, 25, 'approved', '/projects/science_chemistry.webp',
        ARRAY['化学反应','气体','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小苏打 3勺', 1),
        (v_project_id, '白醋 半杯', 2),
        (v_project_id, '塑料瓶（带盖，瓶盖钻孔）', 3),
        (v_project_id, '小蜡烛 1根', 4),
        (v_project_id, '打火机（家长操作）', 5),
        (v_project_id, '托盘（防水）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备灭火器', '在塑料瓶中放入小苏打，瓶盖上钻一个小孔作为喷嘴。', 1),
        (v_project_id, '点燃蜡烛', '请家长在托盘上点燃小蜡烛，确保周围没有易燃物。', 2),
        (v_project_id, '启动灭火器', '快速将白醋从瓶盖小孔倒入瓶中并立刻盖紧，瓶内会产生大量二氧化碳气体。', 3),
        (v_project_id, '喷射灭火', '将瓶口的小孔对准蜡烛火焰，轻轻挤压瓶身让气体喷出，观察火焰熄灭。', 4),
        (v_project_id, '原理讲解', '讨论二氧化碳为什么能灭火：它比空气重，覆盖在火焰上隔绝了氧气，火就熄灭了。', 5);

    -- Project 14: CO₂ 气球实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        'CO₂ 气球实验',
        '不用嘴吹，利用小苏打和醋产生的二氧化碳气体自动把气球吹大！孩子将直观看到化学反应产生气体的过程。这个实验安全有趣，是理解化学反应中气体生成的绝佳方式。',
        v_author_id, v_sub_id, 3, 15, 'approved', '/projects/science_chemistry.webp',
        ARRAY['化学反应','气体','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小苏打 2勺', 1),
        (v_project_id, '白醋 100毫升', 2),
        (v_project_id, '气球 2-3个', 3),
        (v_project_id, '塑料瓶（500毫升）', 4),
        (v_project_id, '小漏斗', 5),
        (v_project_id, '勺子', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '装入小苏打', '用小漏斗将两勺小苏打装入气球内部。', 1),
        (v_project_id, '准备醋瓶', '将白醋倒入塑料瓶中，约瓶身三分之一的高度。', 2),
        (v_project_id, '套上气球', '小心地将气球口套在瓶口上，注意先不要让气球里的小苏打掉进瓶中。', 3),
        (v_project_id, '触发反应', '将气球提起使小苏打落入醋中，观察瓶内冒泡并且气球慢慢鼓起来。', 4),
        (v_project_id, '观察讨论', '观察气球膨胀的大小，讨论是什么气体吹大了气球，为什么二氧化碳能被收集在气球中。', 5);

    -- Project 15: 自制肥皂
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '自制肥皂',
        '用皂基和天然精油制作属于自己的手工肥皂！孩子将了解皂化反应的基本概念，知道油脂与碱反应后如何变成清洁用品。还可以发挥创意制作不同形状和香味的肥皂。',
        v_author_id, v_sub_id, 3, 40, 'approved', '/projects/science_chemistry.webp',
        ARRAY['皂化反应','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '透明皂基 200克', 1),
        (v_project_id, '精油（薰衣草或柠檬）几滴', 2),
        (v_project_id, '食用色素', 3),
        (v_project_id, '硅胶模具', 4),
        (v_project_id, '微波炉或热水锅', 5),
        (v_project_id, '搅拌棒', 6),
        (v_project_id, '耐热量杯', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '融化皂基', '将皂基切成小块放入耐热量杯，用微波炉加热30秒（或隔水加热），直到完全融化。', 1),
        (v_project_id, '添加色素和香味', '在液态皂基中加入几滴食用色素和精油，用搅拌棒轻轻搅匀，避免产生过多气泡。', 2),
        (v_project_id, '倒入模具', '将调配好的皂液倒入硅胶模具中，表面有气泡可用牙签戳破。', 3),
        (v_project_id, '冷却脱模', '室温放置1-2小时或冰箱冷藏30分钟后脱模，取出手工肥皂。', 4),
        (v_project_id, '测试与讨论', '用自制肥皂洗手体验效果，讨论肥皂如何通过亲水基和亲油基去除油污。', 5);

    -- Project 16: 电解水实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '电解水实验',
        '用电池将水分解成氢气和氧气两种气体，亲眼看到水的化学组成！孩子将通过观察两个电极上气泡数量的不同，理解水由氢和氧组成，体积比为2:1。这是经典的化学分解实验。',
        v_author_id, v_sub_id, 4, 30, 'approved', '/projects/science_chemistry.webp',
        ARRAY['电解','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '9V电池 1个', 1),
        (v_project_id, '导线 2根', 2),
        (v_project_id, '铅笔芯（石墨棒）2根', 3),
        (v_project_id, '小苏打 少量（增强导电性）', 4),
        (v_project_id, '透明玻璃杯', 5),
        (v_project_id, '水', 6),
        (v_project_id, '纸板（固定电极用）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作电解装置', '在纸板上戳两个小孔，将两根石墨棒插入作为电极，间隔约3厘米。', 1),
        (v_project_id, '配制电解液', '在玻璃杯中倒入水并加入少量小苏打搅拌溶解，提高水的导电性。', 2),
        (v_project_id, '连接电路', '将纸板架在杯口，石墨棒浸入水中，用导线分别连接两根石墨棒和电池的正负极。', 3),
        (v_project_id, '观察气泡', '通电后观察两根石墨棒上产生的气泡，注意哪一根产生的气泡更多。', 4),
        (v_project_id, '分析结果', '负极产生氢气（气泡多），正极产生氧气（气泡少），体积比约为2:1，证明水是H₂O。', 5);

    -- Project 17: 铜币变色实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '铜币变色实验',
        '用醋和盐清洁氧化变暗的铜币，让它们重新变得闪亮！孩子将观察金属氧化和还原的过程，理解铜表面的氧化铜如何被酸溶解。还可以用铜液让铁钉表面镀上一层铜色。',
        v_author_id, v_sub_id, 4, 25, 'approved', '/projects/science_chemistry.webp',
        ARRAY['金属氧化还原','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '旧铜币 5-10枚', 1),
        (v_project_id, '白醋 半杯', 2),
        (v_project_id, '食盐 1勺', 3),
        (v_project_id, '铁钉 2根', 4),
        (v_project_id, '玻璃碗 2个', 5),
        (v_project_id, '纸巾', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '配制清洁液', '在玻璃碗中混合白醋和食盐，搅拌直到盐完全溶解。', 1),
        (v_project_id, '浸泡铜币', '将暗淡的旧铜币放入醋盐溶液中，等待5分钟，观察铜币逐渐变亮。', 2),
        (v_project_id, '取出对比', '取出铜币用清水冲洗，与未浸泡的铜币对比亮度差异。', 3),
        (v_project_id, '铁钉镀铜', '将干净的铁钉放入浸泡过铜币的溶液中，等待15-20分钟，观察铁钉表面出现铜色。', 4),
        (v_project_id, '解释原理', '醋酸溶解了铜币表面的氧化铜，溶液中的铜离子又在铁钉上析出，因为铁比铜更活泼。', 5);

    -- Project 18: 蛋壳溶解实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '蛋壳溶解实验',
        '将鸡蛋浸泡在醋中，观察蛋壳如何被慢慢溶解，最终得到一个有弹性的"裸蛋"！孩子将了解醋酸与碳酸钙反应产生二氧化碳的过程。这个实验需要耐心等待1-2天，但结果非常神奇。',
        v_author_id, v_sub_id, 4, 20, 'approved', '/projects/science_chemistry.webp',
        ARRAY['酸与碳酸盐','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '生鸡蛋 2个', 1),
        (v_project_id, '白醋 足量（能没过鸡蛋）', 2),
        (v_project_id, '透明玻璃杯 2个', 3),
        (v_project_id, '保鲜膜', 4),
        (v_project_id, '记录本和笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '浸泡鸡蛋', '将一个生鸡蛋轻轻放入装满白醋的玻璃杯中，另一个放入清水作为对照组。', 1),
        (v_project_id, '观察初始反应', '立刻观察醋中鸡蛋表面冒出的小气泡，这是二氧化碳气体。', 2),
        (v_project_id, '每日记录', '每隔12小时观察并记录鸡蛋表面的变化，如果醋变浑浊可以换一次新醋。', 3),
        (v_project_id, '取出裸蛋', '约24-48小时后蛋壳完全溶解，小心取出变得半透明有弹性的"裸蛋"。', 4),
        (v_project_id, '对比总结', '与清水中的鸡蛋对比，讨论醋酸如何与蛋壳中的碳酸钙反应：CaCO₃ + 2CH₃COOH → Ca²⁺ + 2CH₃COO⁻ + H₂O + CO₂↑。', 5);

    -- Project 19: 简易水质检测
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '简易水质检测',
        '用简易方法检测不同来源水的酸碱度、硬度和杂质含量！孩子将学习基本的化学分析方法，了解水质好坏对健康和环境的影响。培养环保意识和科学检测能力。',
        v_author_id, v_sub_id, 5, 40, 'approved', '/projects/science_chemistry.webp',
        ARRAY['化学分析','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'pH试纸（广范围）', 1),
        (v_project_id, '肥皂水 少量', 2),
        (v_project_id, '透明杯子 5-6个', 3),
        (v_project_id, '不同水样（自来水、矿泉水、雨水等）', 4),
        (v_project_id, '白色滤纸', 5),
        (v_project_id, '放大镜', 6),
        (v_project_id, '记录表格', 7),
        (v_project_id, '滴管', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '采集水样', '收集不同来源的水样：自来水、矿泉水、凉白开、雨水等，分别倒入标记好的透明杯中。', 1),
        (v_project_id, '酸碱度检测', '将pH试纸分别浸入各水样中，取出后与标准色卡对比，记录每种水的pH值。', 2),
        (v_project_id, '硬度检测', '在每种水样中加入等量肥皂水并搅拌，泡沫越少说明水的硬度越高（矿物质含量多）。', 3),
        (v_project_id, '杂质观察', '用白色滤纸分别过滤各水样，晾干后用放大镜观察滤纸上残留物的多少和颜色。', 4),
        (v_project_id, '综合评估', '汇总所有检测数据，制作水质对比表，讨论哪种水最干净、各指标的意义。', 5),
        (v_project_id, '环保倡议', '讨论水污染的来源和危害，思考在日常生活中如何节约和保护水资源。', 6);

    -- Project 20: 牛奶塑料制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '牛奶塑料制作',
        '用牛奶和醋制作天然的"酪素塑料"，可以塑造成各种小物件！孩子将了解蛋白质在酸性环境中变性凝固的原理，认识高分子材料的基本概念。这是一个跨越化学与材料科学的趣味实验。',
        v_author_id, v_sub_id, 5, 45, 'approved', '/projects/science_chemistry.webp',
        ARRAY['蛋白质变性','高分子','科学','化学'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '全脂牛奶 250毫升', 1),
        (v_project_id, '白醋 2勺', 2),
        (v_project_id, '小锅', 3),
        (v_project_id, '滤网或纱布', 4),
        (v_project_id, '纸巾', 5),
        (v_project_id, '模具或手工工具', 6),
        (v_project_id, '食用色素（可选）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '加热牛奶', '将牛奶倒入小锅中，小火加热至微微冒泡（约70°C），不要煮沸。', 1),
        (v_project_id, '加醋凝固', '关火后缓缓加入白醋，轻轻搅拌，观察牛奶中出现白色凝固块（酪蛋白）。', 2),
        (v_project_id, '过滤收集', '用滤网或纱布过滤，收集白色固体凝块，用纸巾轻压吸去多余水分。', 3),
        (v_project_id, '塑形创作', '趁凝块柔软时揉捏塑形，可以加入食用色素调色，用模具或手工捏成想要的形状。', 4),
        (v_project_id, '干燥硬化', '将作品放在通风处晾干2-3天，干燥后会变得坚硬如同真正的塑料。', 5),
        (v_project_id, '原理总结', '讨论酪蛋白的变性过程：酸使牛奶蛋白质结构改变并凝固，形成天然高分子材料，这就是最早期塑料的制作原理。', 6);

END $$;
