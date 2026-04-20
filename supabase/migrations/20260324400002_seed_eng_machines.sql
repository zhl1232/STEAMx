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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '简易机器' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 简易机器'; END IF;

    -- Project 1: 纸风车
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸风车', '用彩色卡纸制作一个能随风旋转的小风车，探索风能如何驱动物体运动。通过调整叶片角度和大小，观察风车转速的变化，感受空气动力学的奇妙。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/eng_machines.webp', ARRAY['风能','旋转','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '彩色卡纸（15cm×15cm）', 1),
        (v_project_id, '剪刀', 2),
        (v_project_id, '大头针或图钉', 3),
        (v_project_id, '吸管或竹签', 4),
        (v_project_id, '小珠子（垫片用）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '裁剪纸片', '将彩色卡纸剪成正方形，沿对角线从四个角向中心剪开，每条线剪到离中心约2厘米处停下。', 1),
        (v_project_id, '折叠叶片', '将每个角的一侧依次折向中心点，形成四片风车叶片，注意不要把纸压出折痕。', 2),
        (v_project_id, '固定风车', '用大头针穿过所有叶片的角和中心点，加上小珠子作垫片，再插入吸管或竹签上固定。', 3),
        (v_project_id, '测试旋转', '对着风车吹气或在有风的地方测试，观察它是否顺畅旋转。调整叶片角度让风车转得更快。', 4),
        (v_project_id, '探索与记录', '尝试改变叶片大小、数量和角度，记录哪种设计转得最快，讨论风能是如何转化为旋转运动的。', 5);

    -- Project 2: 简易滑轮装置
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('简易滑轮装置', '用线轴和绳子搭建一个简单的定滑轮装置，体验滑轮改变力的方向的神奇效果。通过提升不同重量的物体，直观感受滑轮的省力原理。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/eng_machines.webp', ARRAY['滑轮','省力','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '空线轴或小滑轮', 1),
        (v_project_id, '细绳（约1米）', 2),
        (v_project_id, '衣架或木棍（支架用）', 3),
        (v_project_id, '小桶或塑料杯', 4),
        (v_project_id, '小玩具或硬币（重物）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建支架', '将衣架或木棍固定在桌边或门框上方，作为悬挂滑轮的支撑点，确保牢固稳定。', 1),
        (v_project_id, '安装滑轮', '把线轴或小滑轮挂在支架上，让它能自由旋转，然后将细绳绕过滑轮。', 2),
        (v_project_id, '连接负载', '在绳子一端绑上小桶，放入小玩具或硬币作为要提升的重物。', 3),
        (v_project_id, '体验省力', '拉动绳子另一端，感受用滑轮向下拉绳子就能把重物向上提升，对比直接用手提的感觉。', 4),
        (v_project_id, '讨论原理', '讨论定滑轮虽然不省力但改变了力的方向，想一想生活中哪里用到了滑轮（如旗杆、电梯）。', 5);

    -- Project 3: 斜面滚球实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('斜面滚球实验', '用纸板搭建不同角度的斜面，观察小球在斜面上的滚动规律。通过测量小球的滚动距离和速度，理解斜面如何将重力转化为运动，是最基础的简单机械之一。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/eng_machines.webp', ARRAY['斜面','重力','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板或木板（约50cm长）', 1),
        (v_project_id, '弹珠或小球', 2),
        (v_project_id, '书本若干（垫高斜面用）', 3),
        (v_project_id, '直尺或卷尺', 4),
        (v_project_id, '记录纸和铅笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建斜面', '将硬纸板一端架在一本书上，另一端放在桌面上，形成一个倾斜面。', 1),
        (v_project_id, '滚球测试', '从斜面顶端释放小球，观察它沿斜面滚下后在桌面上继续滚动的距离，用尺子测量并记录。', 2),
        (v_project_id, '改变角度', '用不同数量的书本改变斜面高度和角度，每次释放小球并测量滚动距离，记录数据。', 3),
        (v_project_id, '对比分析', '比较不同角度下小球的滚动距离和速度，讨论为什么角度越大小球速度越快。', 4),
        (v_project_id, '生活联想', '想一想生活中的斜面应用：滑梯、公路坡道、轮椅坡道，讨论斜面如何让搬运重物变得更省力。', 5);

    -- Project 4: 弹弓制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('弹弓制作', '用树枝和橡皮筋制作一个小弹弓，了解弹性势能如何转化为动能来发射物体。通过调整橡皮筋的拉伸程度，探索弹性与发射距离的关系。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/eng_machines.webp', ARRAY['弹性','发射','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Y形树枝或冰棒棍', 1),
        (v_project_id, '宽橡皮筋', 2),
        (v_project_id, '小布块或皮革（弹兜用）', 3),
        (v_project_id, '棉花球或纸团（弹丸）', 4),
        (v_project_id, '细线或胶带', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作弹弓架', '选择一根坚固的Y形树枝，或用冰棒棍拼成Y形，用细线绑紧连接处。', 1),
        (v_project_id, '安装橡皮筋', '将橡皮筋两端分别绑在Y形叉的两个顶端，确保两边长度一致，绑牢不会脱落。', 2),
        (v_project_id, '制作弹兜', '在橡皮筋中间绑上一小块布或皮革作为弹兜，用来放置棉花球弹丸。', 3),
        (v_project_id, '安全测试', '在空旷的安全区域，将棉花球放入弹兜，拉伸橡皮筋后释放，观察弹丸的飞行距离。', 4),
        (v_project_id, '探索弹性', '试验不同拉伸程度对发射距离的影响，讨论弹性势能如何存储和释放为动能。', 5);

    -- Project 5: 杠杆投石机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('杠杆投石机', '用冰棒棍和橡皮筋搭建一台小型投石机，了解杠杆原理在古代战争中的应用。通过调整支点位置和投臂长度，探索如何让投石机把物体抛得更远。', v_author_id, v_sub_id, 2, 35, 'approved', '/projects/eng_machines.webp', ARRAY['杠杆原理','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '冰棒棍8-10根', 1),
        (v_project_id, '橡皮筋5-6根', 2),
        (v_project_id, '塑料瓶盖（投篮用）', 3),
        (v_project_id, '小棉球或纸团（弹丸）', 4),
        (v_project_id, '热熔胶枪（可选）', 5),
        (v_project_id, '直尺', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建底座', '将5-6根冰棒棍叠在一起用橡皮筋绑紧两端，做成一个厚实的支撑底座。', 1),
        (v_project_id, '安装投臂', '取一根冰棒棍作为投臂，用橡皮筋将其一端绑在底座顶部一端，形成可翘起的杠杆结构。', 2),
        (v_project_id, '安装弹篮', '用热熔胶或橡皮筋将塑料瓶盖固定在投臂的长端作为弹药篮。', 3),
        (v_project_id, '发射测试', '在弹篮中放入棉球，按下投臂短端后松手，观察棉球被抛出的距离和角度。', 4),
        (v_project_id, '优化调整', '移动支点位置、改变投臂两端的比例，测量不同设置下的发射距离，记录最优方案。', 5),
        (v_project_id, '原理总结', '讨论杠杆三要素（支点、力臂、阻力臂）和投石机的工作原理，了解古人如何利用杠杆打仗。', 6);

    -- Project 6: 简易滑轮组
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('简易滑轮组', '组合定滑轮和动滑轮搭建一个滑轮组，亲身体验滑轮组的省力效果。通过测量拉力大小，验证滑轮组"省力不省距离"的物理规律。', v_author_id, v_sub_id, 2, 35, 'approved', '/projects/eng_machines.webp', ARRAY['滑轮组','省力','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小滑轮2-3个', 1),
        (v_project_id, '细绳（约2米）', 2),
        (v_project_id, '支架或衣架', 3),
        (v_project_id, '弹簧秤', 4),
        (v_project_id, '重物（如水瓶）', 5),
        (v_project_id, '记录本和铅笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建定滑轮', '将一个滑轮固定在支架顶部作为定滑轮，绕上绳子挂上重物，用弹簧秤测量拉力并记录。', 1),
        (v_project_id, '添加动滑轮', '在重物上方加一个动滑轮，将绳子穿过动滑轮再绕过定滑轮，重新测量拉力。', 2),
        (v_project_id, '组合滑轮组', '再增加一个滑轮，组成更复杂的滑轮组，记录每种组合下提升相同重物所需的拉力。', 3),
        (v_project_id, '测量绳子拉动距离', '提升重物相同高度时，分别测量不同滑轮组中绳子需要拉动的长度，记录数据。', 4),
        (v_project_id, '数据分析', '比较各组数据，发现滑轮越多越省力但绳子拉动距离越长的规律，讨论"省力不省功"的道理。', 5);

    -- Project 7: 水车模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('水车模型', '用塑料杯和竹签制作一个能被水流驱动旋转的小水车模型，了解古人如何利用水力做功。通过观察水流对叶片的冲击，理解水力能量转化的过程。', v_author_id, v_sub_id, 2, 35, 'approved', '/projects/eng_machines.webp', ARRAY['水力','旋转','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '塑料杯或酸奶盒4-6个', 1),
        (v_project_id, '竹签或木棍', 2),
        (v_project_id, '圆形硬纸板', 3),
        (v_project_id, '热熔胶枪', 4),
        (v_project_id, '剪刀', 5),
        (v_project_id, '水盆和水壶', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作叶片', '将塑料杯剪成半杯状或用勺形纸片作为水车叶片，均匀粘贴在圆形硬纸板边缘，所有开口朝同一方向。', 1),
        (v_project_id, '安装转轴', '在圆形纸板中心穿一根竹签作为转轴，确保纸板能在竹签上自由旋转。', 2),
        (v_project_id, '搭建支架', '用纸板或木块做两个支撑架，将竹签两端架起，让水车悬空能自由转动。', 3),
        (v_project_id, '水流测试', '用水壶缓缓将水倒在水车叶片上，观察水车被水流驱动旋转的效果。', 4),
        (v_project_id, '优化与探索', '调整叶片数量、角度和水流大小，找出让水车转得最快的方案，讨论古代水车的用途。', 5);

    -- Project 8: 简易天平
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('简易天平', '利用杠杆平衡原理制作一个简易天平，用来称量和比较物体的重量。通过寻找平衡点和使用砝码，理解等臂杠杆的精妙之处。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/eng_machines.webp', ARRAY['杠杆','测量','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '直尺或木条（30cm以上）', 1),
        (v_project_id, '三角形积木或橡皮（支点）', 2),
        (v_project_id, '两个相同的小杯子或纸盘', 3),
        (v_project_id, '细线', 4),
        (v_project_id, '硬币若干（砝码用）', 5),
        (v_project_id, '胶带', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '找平衡点', '将直尺放在三角积木上，左右移动找到能让直尺水平平衡的位置，这就是支点。', 1),
        (v_project_id, '安装托盘', '在直尺两端分别用细线挂上小杯子或纸盘作为称量托盘，确保两侧一样重。', 2),
        (v_project_id, '校准天平', '空盘时调整位置使天平水平，如果不平衡可以在轻的一侧贴一小块胶带微调。', 3),
        (v_project_id, '称量物体', '在一侧放入要称量的物体，另一侧逐个添加硬币，直到天平平衡，数硬币个数确定重量。', 4),
        (v_project_id, '趣味挑战', '尝试比较不同物品的重量（如橡皮和回形针），讨论杠杆原理和为什么两臂等长时才能准确测量。', 5);

    -- Project 9: 风力发电小模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('风力发电小模型', '制作一个小型风力发电装置，让风吹动扇叶带动小马达产生电流点亮LED灯。通过这个项目理解风能转化为电能的完整过程，感受可再生能源的魅力。', v_author_id, v_sub_id, 3, 45, 'approved', '/projects/eng_machines.webp', ARRAY['风能','发电','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小型直流马达', 1),
        (v_project_id, 'LED灯', 2),
        (v_project_id, '塑料瓶或纸杯（做扇叶）', 3),
        (v_project_id, '导线2根', 4),
        (v_project_id, '木板或纸板（底座）', 5),
        (v_project_id, '热熔胶枪', 6),
        (v_project_id, '电风扇或吹风机（提供风力）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作扇叶', '将塑料瓶切成四片均匀的叶片并弯折一定角度，或用硬纸板剪出螺旋桨形状的扇叶。', 1),
        (v_project_id, '安装扇叶到马达', '将扇叶固定在小马达的转轴上，确保牢固且转动平衡，不会因晃动而脱落。', 2),
        (v_project_id, '搭建支架', '将马达用热熔胶固定在支架上，使扇叶正对风向并能自由旋转。', 3),
        (v_project_id, '连接电路', '用导线将马达的两个接线端连接到LED灯，注意正负极方向。', 4),
        (v_project_id, '风力测试', '用电风扇或吹风机对准扇叶吹风，观察LED灯是否亮起。调整叶片角度和风力距离找到最佳发电状态。', 5),
        (v_project_id, '记录与讨论', '记录不同风速下LED的亮度变化，讨论真实风力发电站的工作原理和风能作为清洁能源的意义。', 6);

    -- Project 10: 水力涡轮机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('水力涡轮机', '制作一个水力驱动的涡轮机模型，让水流冲击叶片带动转轴旋转做功。探索叶片形状和水流量对涡轮转速的影响，理解水力发电的基本原理。', v_author_id, v_sub_id, 3, 45, 'approved', '/projects/eng_machines.webp', ARRAY['水力','能量转换','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '塑料勺子6-8个', 1),
        (v_project_id, '圆形瓶盖或硬纸板圆盘', 2),
        (v_project_id, '竹签（转轴）', 3),
        (v_project_id, '热熔胶枪', 4),
        (v_project_id, '纸板（支架用）', 5),
        (v_project_id, '水盆和水管或水壶', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作涡轮叶片', '将塑料勺子均匀粘贴在圆盘边缘，勺口朝同一旋转方向，形成涡轮叶片组。', 1),
        (v_project_id, '安装转轴', '在圆盘中心打孔穿入竹签作为转轴，用热熔胶固定确保同轴旋转。', 2),
        (v_project_id, '搭建支架', '用纸板制作门形支架，将转轴两端架在支架上，让涡轮能自由旋转。', 3),
        (v_project_id, '水流驱动测试', '将涡轮放在水盆上方，用水壶将水倒在叶片上，观察涡轮的旋转速度。', 4),
        (v_project_id, '变量实验', '分别改变水流大小、叶片数量和叶片角度，记录每次涡轮的转速变化，寻找最优设计方案。', 5),
        (v_project_id, '能量转换讨论', '讨论水力涡轮如何将水的动能转化为旋转机械能，了解水力发电站的工作流程。', 6);

    -- Project 11: 简易抽水机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('简易抽水机', '利用气压差和虹吸原理制作一个简易抽水机，能把低处的水抽到高处。通过动手操作，直观理解大气压力和虹吸效应在日常生活中的广泛应用。', v_author_id, v_sub_id, 3, 40, 'approved', '/projects/eng_machines.webp', ARRAY['气压','虹吸','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大号注射器（去针头）或气筒', 1),
        (v_project_id, '软管（约50cm）', 2),
        (v_project_id, '两个水杯或水盆', 3),
        (v_project_id, '热熔胶或防水胶带', 4),
        (v_project_id, '食用色素（便于观察水流）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '虹吸实验', '先做一个虹吸实验：将软管灌满水，一端放入高处水杯，另一端放在低处空杯，观察水自动流向低处。', 1),
        (v_project_id, '组装抽水机', '将注射器出口连接软管，用胶带密封接口确保不漏气。将软管另一端放入装水的容器中。', 2),
        (v_project_id, '抽水测试', '反复拉动和推动注射器活塞，观察水通过软管被吸入和排出的过程。', 3),
        (v_project_id, '探索气压', '讨论拉动活塞时管内气压降低、外部大气压把水压入管内的原理，理解气压差的作用。', 4),
        (v_project_id, '应用拓展', '想一想生活中哪些地方用到了类似原理（如吸管喝水、抽水马桶），讨论古代抽水灌溉的方法。', 5);

    -- Project 12: 弹射器优化挑战
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('弹射器优化挑战', '在基础投石机的基础上进行系统优化，通过调整发射角度、臂长比例和弹性强度，挑战将弹丸发射到最远距离。运用科学实验方法记录数据，找到最优发射方案。', v_author_id, v_sub_id, 3, 45, 'draft', '/projects/eng_machines.webp', ARRAY['弹射','角度','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '冰棒棍10-15根', 1),
        (v_project_id, '橡皮筋若干（不同粗细）', 2),
        (v_project_id, '塑料勺子', 3),
        (v_project_id, '棉花球（弹丸）', 4),
        (v_project_id, '量角器', 5),
        (v_project_id, '卷尺', 6),
        (v_project_id, '记录表和铅笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建基础弹射器', '用冰棒棍和橡皮筋组装基础弹射器结构，在投臂端安装塑料勺子作为弹丸托盘。', 1),
        (v_project_id, '角度实验', '用量角器测量并记录不同发射角度（30°、45°、60°等），每个角度发射三次取平均距离。', 2),
        (v_project_id, '臂长比例实验', '改变支点位置调整投臂两端的比例，保持角度不变，记录不同比例下的发射距离。', 3),
        (v_project_id, '弹性实验', '更换不同粗细的橡皮筋或改变橡皮筋数量，观察弹性强度对发射效果的影响。', 4),
        (v_project_id, '数据分析', '整理所有实验数据制成表格，分析角度、臂长和弹性三个变量各自的最优值。', 5),
        (v_project_id, '最终挑战', '综合所有最优参数组装终极弹射器，向全家展示最远发射距离，讨论工程优化的方法论。', 6);

    -- Project 13: 液压升降台
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('液压升降台', '用注射器和软管制作一个液压升降台，推动一个注射器就能让远处的平台升起。通过这个项目理解帕斯卡定律和液压传动的原理，感受液压系统在工程中的强大力量。', v_author_id, v_sub_id, 4, 50, 'approved', '/projects/eng_machines.webp', ARRAY['液压','升降','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '注射器2个（大小不同更佳）', 1),
        (v_project_id, '透明软管（约30cm）', 2),
        (v_project_id, '水和食用色素', 3),
        (v_project_id, '硬纸板和冰棒棍（做升降台）', 4),
        (v_project_id, '热熔胶枪', 5),
        (v_project_id, '防水胶带', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作液压系统', '将两个注射器用软管连接，灌满带颜色的水并排除气泡，确保推一个注射器时另一个会被推出。', 1),
        (v_project_id, '搭建升降台结构', '用硬纸板和冰棒棍制作一个可折叠的X形剪刀结构作为升降台支架，底部固定一个注射器。', 2),
        (v_project_id, '连接液压驱动', '将升降台底部的注射器与控制端注射器通过软管连接，用防水胶带密封所有接口。', 3),
        (v_project_id, '升降测试', '推动控制端注射器，观察升降台平稳升起。释放后升降台在重力作用下下降。', 4),
        (v_project_id, '载重实验', '在升降台上放置不同重量的物品，测试液压系统的承载能力，观察大小不同注射器的力量放大效果。', 5),
        (v_project_id, '原理探索', '讨论帕斯卡定律：液体传递压强不变，截面积大的注射器产生更大的力。联想挖掘机和电梯的液压系统。', 6);

    -- Project 14: 复合滑轮系统
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('复合滑轮系统', '设计并搭建包含多个定滑轮和动滑轮的复合滑轮系统，精确测量不同配置下的省力效果。通过定量实验验证理论计算，深入理解机械效率和能量守恒的关系。', v_author_id, v_sub_id, 4, 55, 'approved', '/projects/eng_machines.webp', ARRAY['定滑轮','动滑轮','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小滑轮4-5个', 1),
        (v_project_id, '细尼龙绳（约3米）', 2),
        (v_project_id, '弹簧秤', 3),
        (v_project_id, '钩码或标准重物', 4),
        (v_project_id, '支架（带横梁）', 5),
        (v_project_id, '直尺和记录本', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '单滑轮基准测试', '分别测试单个定滑轮和单个动滑轮提升重物时所需的拉力，记录数据作为对比基准。', 1),
        (v_project_id, '设计滑轮组方案', '在纸上画出2种以上不同的复合滑轮组绕绳方案，标注定滑轮和动滑轮的位置。', 2),
        (v_project_id, '搭建并测量', '按设计方案逐一搭建滑轮系统，每种方案都用弹簧秤测量拉力，同时测量绳子拉动的距离。', 3),
        (v_project_id, '计算机械效率', '用公式"机械效率 = 有用功 ÷ 总功 × 100%"计算每种方案的效率，分析摩擦力的影响。', 4),
        (v_project_id, '理论对比验证', '用"承重绳段数"理论值与实测值对比，讨论为什么实际拉力总是比理论值大。', 5),
        (v_project_id, '工程应用讨论', '了解吊车、起重机中的复合滑轮系统，讨论如何在省力和效率之间取得最佳平衡。', 6);

    -- Project 15: 自动浇水装置
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自动浇水装置', '利用虹吸原理和简单的定时机构制作一个自动浇水装置，让花盆在你外出时也能按时得到灌溉。结合物理原理和工程设计，解决实际生活问题。', v_author_id, v_sub_id, 4, 50, 'approved', '/projects/eng_machines.webp', ARRAY['虹吸','定时','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大号塑料瓶（储水用）', 1),
        (v_project_id, '细软管或棉线（导水用）', 2),
        (v_project_id, '花盆和植物', 3),
        (v_project_id, '小夹子（控制流量）', 4),
        (v_project_id, '支架或书本（调节高度）', 5),
        (v_project_id, '计时器（观察滴水速度）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '虹吸原理复习', '先做虹吸实验确保理解原理：将灌满水的软管一端放入高处水瓶，另一端放在低处容器中观察水流。', 1),
        (v_project_id, '组装浇水系统', '将储水瓶放在高于花盆的位置，用软管或棉线连接水瓶和花盆土壤，利用虹吸效应导水。', 2),
        (v_project_id, '控制流量', '用小夹子夹住软管调节水流速度，或在瓶盖上扎不同大小的孔控制出水量，实现缓慢滴灌。', 3),
        (v_project_id, '测试校准', '用计时器记录每小时的出水量，调整到适合植物需要的浇水速度（如每天浇水约100毫升）。', 4),
        (v_project_id, '实际应用', '将装置部署到家里的花盆上，观察几天确认植物生长良好，计算储水瓶能维持多少天的浇水。', 5),
        (v_project_id, '改进方案', '讨论如何改进：加大储水容量、增加多个出水口浇多盆花、添加水位指示器等，设计升级版方案。', 6);

    -- Project 16: 太阳能小车
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('太阳能小车', '利用太阳能电池板驱动小马达让小车自主行驶，体验光能转化为电能再转化为动能的完整能量链。通过调整太阳能板角度和车身重量，优化小车的行驶性能。', v_author_id, v_sub_id, 4, 60, 'approved', '/projects/eng_machines.webp', ARRAY['太阳能','光伏','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小型太阳能电池板', 1),
        (v_project_id, '小型直流马达', 2),
        (v_project_id, '导线2根', 3),
        (v_project_id, '瓶盖4个（车轮）', 4),
        (v_project_id, '竹签2根（车轴）', 5),
        (v_project_id, '硬纸板或泡沫板（车身）', 6),
        (v_project_id, '橡皮筋（传动用）', 7),
        (v_project_id, '热熔胶枪', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '测试太阳能板', '在阳光下将太阳能板连接马达，确认马达能在光照下转动，了解太阳能板的正负极。', 1),
        (v_project_id, '制作车身和车轮', '用硬纸板剪出车身底盘，用瓶盖做四个车轮，竹签穿过瓶盖中心做车轴，固定在底盘下方。', 2),
        (v_project_id, '安装动力系统', '将马达固定在车身上，用橡皮筋将马达转轴和后轮车轴连接形成传动装置。', 3),
        (v_project_id, '安装太阳能板', '将太阳能板固定在车身顶部，用导线连接到马达，确保在阳光下马达能驱动车轮转动。', 4),
        (v_project_id, '户外测试', '在晴天将小车放在平坦的地面上，观察它在阳光下自主行驶。调整太阳能板角度寻找最佳发电位置。', 5),
        (v_project_id, '性能优化', '尝试减轻车身重量、改善轮轴摩擦、优化传动比，记录每次改进后的行驶速度和距离变化。', 6);

    -- Project 17: 蒸汽动力小船
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('蒸汽动力小船', '制作一艘靠蜡烛加热水产生蒸汽推动前行的"噗噗船"，重现蒸汽动力的经典原理。通过观察水蒸气的膨胀和冷凝循环，理解热能转化为动能的工作过程。这是工业革命核心技术的微缩演示。', v_author_id, v_sub_id, 5, 60, 'approved', '/projects/eng_machines.webp', ARRAY['蒸汽','热能','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '铝制易拉罐（做锅炉）', 1),
        (v_project_id, '铜管或铝管（弯成线圈）', 2),
        (v_project_id, '泡沫板或轻木板（船身）', 3),
        (v_project_id, '小蜡烛', 4),
        (v_project_id, '热熔胶枪', 5),
        (v_project_id, '剪刀和钳子', 6),
        (v_project_id, '大水盆', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作船身', '用泡沫板或轻木板切割出船的形状，确保底部平整能稳定漂浮在水面上。', 1),
        (v_project_id, '制作蒸汽锅炉', '用铝罐制作一个小型密封锅炉，将铜管弯成螺旋形并连接到锅炉上，铜管末端从船尾伸入水下。', 2),
        (v_project_id, '安装动力系统', '将锅炉固定在船身上，在锅炉下方放置小蜡烛的位置，铜管出口对准船尾方向并浸入水中。', 3),
        (v_project_id, '注水和测试', '先从铜管口注入少量水，放入大水盆中，点燃蜡烛加热锅炉，等待蒸汽产生推动船前行。', 4),
        (v_project_id, '观察与调整', '观察蒸汽从管口喷出推船前进的过程，调整蜡烛位置和水量，优化船的行驶速度和稳定性。', 5),
        (v_project_id, '蒸汽动力探讨', '讨论蒸汽机的发明如何引发工业革命，从蒸汽火车到蒸汽轮船，理解热机效率和能量转换。', 6);

    -- Project 18: 多级水力发电站
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('多级水力发电站', '搭建一个多级梯田式水力发电模型，水从高处逐级流下依次驱动多个涡轮发电。通过这个综合工程项目，理解级联发电的效率优势和水资源多次利用的智慧。', v_author_id, v_sub_id, 5, 75, 'draft', '/projects/eng_machines.webp', ARRAY['水力','级联','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小滑轮或涡轮叶片组3套', 1),
        (v_project_id, '小马达3个', 2),
        (v_project_id, 'LED灯3个', 3),
        (v_project_id, '导线若干', 4),
        (v_project_id, '塑料板或纸板（搭建阶梯）', 5),
        (v_project_id, '水管或PVC管', 6),
        (v_project_id, '大水盆和水泵（或水壶循环供水）', 7),
        (v_project_id, '热熔胶枪和防水胶带', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计阶梯结构', '画出三级阶梯的设计图，每级高度差约10-15厘米，规划水流路径和涡轮安装位置。', 1),
        (v_project_id, '搭建阶梯平台', '用塑料板搭建三级阶梯结构，每级之间用倾斜水槽连接引导水流，确保结构稳固防水。', 2),
        (v_project_id, '安装涡轮发电机', '在每级阶梯的水流冲击处安装涡轮叶片连接马达，每个马达接一个LED灯。', 3),
        (v_project_id, '供水系统', '从顶部持续供水，让水逐级流下依次冲击每一级涡轮，底部水盆收集回流水。', 4),
        (v_project_id, '发电测试', '开始供水，观察三级LED灯是否依次亮起。调整水量和涡轮位置优化每级的发电效果。', 5),
        (v_project_id, '效率分析', '讨论级联发电为什么比单级更高效，了解三峡大坝等真实梯级水电站的设计理念和工程挑战。', 6);

    -- Project 19: 自动喂食器
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自动喂食器', '设计并制作一个简易的自动定量喂食器，利用重力和机械联动实现定时定量地释放食物。结合齿轮传动、凸轮机构等简单机械原理，打造一个实用的自动化装置。', v_author_id, v_sub_id, 5, 70, 'draft', '/projects/eng_machines.webp', ARRAY['机构','定量','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大塑料瓶（储料仓）', 1),
        (v_project_id, '硬纸板（机构零件）', 2),
        (v_project_id, '竹签和吸管（转轴和连杆）', 3),
        (v_project_id, '橡皮筋', 4),
        (v_project_id, '小容器（食盆）', 5),
        (v_project_id, '热熔胶枪', 6),
        (v_project_id, '小石子或干粮（测试用）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计机构方案', '在纸上画出喂食器的工作流程图：储料→定量分配→释放到食盆，设计阀门或旋转分配盘的开关机构。', 1),
        (v_project_id, '制作储料仓', '将大塑料瓶倒置作为储料仓，底部开口处安装可旋转的纸板分配盘，控制每次出料量。', 2),
        (v_project_id, '制作定量机构', '用硬纸板制作带格子的旋转分配盘，每转动一格释放固定量的食物，实现定量控制。', 3),
        (v_project_id, '搭建触发装置', '设计一个简单的触发机构：可以是拉线式、翘板式或定时重力式，让分配盘在需要时转动。', 4),
        (v_project_id, '组装测试', '将储料仓、分配盘和触发装置组装在一起，放入测试颗粒反复调试，确保每次出料量一致。', 5),
        (v_project_id, '优化和展示', '调整各部分尺寸和配合精度，解决卡料和出料不均等问题，向家人展示自动喂食器的使用效果。', 6);

    -- Project 20: 风力水泵
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('风力水泵', '建造一个风力驱动的水泵模型，让风车通过曲柄连杆机构带动活塞泵将水抽起。这个项目综合运用风车、曲柄连杆和活塞泵三种简单机械，是一项完整的机械工程挑战。', v_author_id, v_sub_id, 5, 75, 'draft', '/projects/eng_machines.webp', ARRAY['风能','泵送','工程','机器'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '塑料瓶（做风车叶片和泵体）', 1),
        (v_project_id, '竹签和吸管（转轴和连杆）', 2),
        (v_project_id, '注射器（做活塞泵）', 3),
        (v_project_id, '软管（进出水管）', 4),
        (v_project_id, '硬纸板（结构件）', 5),
        (v_project_id, '热熔胶枪', 6),
        (v_project_id, '水盆和食用色素', 7),
        (v_project_id, '电风扇（提供风力）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作风车部分', '用塑料瓶切割出4-6片叶片安装在竹签转轴上，确保在风力下能稳定旋转。', 1),
        (v_project_id, '制作曲柄连杆', '在风车转轴末端偏心安装一个短竹签作为曲柄，用吸管和竹签制作连杆连接曲柄和活塞。', 2),
        (v_project_id, '制作活塞泵', '将注射器作为泵体，连杆推拉注射器活塞。在注射器两端分别连接进水管和出水管。', 3),
        (v_project_id, '制作单向阀', '用小塑料片在进水管和出水管口制作简易单向阀，确保水只能单方向流动。', 4),
        (v_project_id, '组装整体', '将风车、曲柄连杆和活塞泵三个部分组装在支架上，将进水管放入水盆，出水管对准收集容器。', 5),
        (v_project_id, '测试与优化', '用电风扇吹动风车，观察活塞泵是否成功抽水。调整各部件配合精度，解决漏水和卡顿问题，实现稳定抽水。', 6);

END $$;
