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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '地球与天空' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 地球与天空'; END IF;

    -- Project 1: 云的观察日记
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '云的观察日记',
        '抬头看天空，你会发现云朵每天都不一样！在这个项目中，参与者将连续观察并记录不同类型的云，学习积云、层云和卷云的区别。通过坚持记录，参与者能初步理解云与天气变化之间的关系。',
        v_author_id, v_sub_id, 1, 30, 'draft', '/projects/science_earth_sky.webp',
        ARRAY['云','天气','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '观察笔记本', 1),
        (v_project_id, '彩色铅笔或蜡笔', 2),
        (v_project_id, '云朵分类参考图（可打印）', 3),
        (v_project_id, '铅笔', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识云的种类', '查看云朵分类参考图，了解积云、层云、卷云等常见云的外观特征和名称。', 1),
        (v_project_id, '选择观察地点', '选一个视野开阔的地方，如阳台、操场或公园，确保能看到大片天空。', 2),
        (v_project_id, '观察并绘画', '抬头观察天空中的云朵，用彩色铅笔在笔记本上画出你看到的云的形状，并尝试标注云的种类。', 3),
        (v_project_id, '记录天气信息', '在画旁边写下日期、时间、气温和当天的天气情况（晴、阴、多云等）。', 4),
        (v_project_id, '对比与总结', '连续观察一周后，翻看记录，找一找哪种云出现最多，云的类型和天气变化有没有规律。', 5);

    -- Project 2: 化石印模制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '化石印模制作',
        '你有没有想过恐龙时代的动植物是怎么变成化石的？在这个项目中，参与者将用黏土和小物件模拟化石形成的过程，亲手制作一枚属于自己的"化石"。通过动手操作，理解化石是如何在岩层中保存下来的。',
        v_author_id, v_sub_id, 1, 40, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['化石','地质','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '风干黏土或超轻黏土', 1),
        (v_project_id, '树叶、贝壳或小型塑料恐龙模型', 2),
        (v_project_id, '擀面杖或圆柱形瓶子', 3),
        (v_project_id, '食用油（防粘）', 4),
        (v_project_id, '纸盘或塑料垫板', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备黏土', '取出适量黏土，用擀面杖将黏土擀平，厚度约1厘米，放在纸盘上备用。', 1),
        (v_project_id, '涂抹防粘油', '在树叶、贝壳或模型表面薄薄地涂一层食用油，防止粘在黏土上取不出来。', 2),
        (v_project_id, '制作印模', '将准备好的物件轻轻按入黏土中，确保留下清晰的印痕，然后小心地取出物件。', 3),
        (v_project_id, '晾干成型', '将黏土印模放在通风处自然晾干，风干黏土通常需要24小时完全变硬。', 4),
        (v_project_id, '观察与讨论', '观察你的"化石"印模，讨论真正的化石是怎样经过数百万年在岩石中形成的。', 5);

    -- Project 3: 自制雨量筒测雨
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '自制雨量筒测雨',
        '用透明瓶自制雨量筒，在一次降雨后测量降水高度并记录结果。通过简单工具学习降雨测量。',
        v_author_id, v_sub_id, 1, 25, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['天气','测量','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '透明直筒塑料瓶（如矿泉水瓶）', 1),
        (v_project_id, '直尺', 2),
        (v_project_id, '防水记号笔', 3),
        (v_project_id, '记录本和铅笔', 4),
        (v_project_id, '剪刀', 5),
        (v_project_id, '小石子（用于稳定瓶子）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作雨量计', '用剪刀将塑料瓶上部剪掉约三分之一，翻转倒扣在瓶身上方做成漏斗状，防止雨水蒸发。', 1),
        (v_project_id, '标注刻度', '用直尺和防水记号笔在瓶身外侧从底部开始标注刻度线，每5毫米画一条线。', 2),
        (v_project_id, '放置雨量计', '在瓶底放入一些小石子增加稳定性，然后将雨量计放在室外开阔处，远离树木和建筑遮挡。', 3),
        (v_project_id, '记录降雨数据', '每次下雨后读取水面所在的刻度，记录日期、降雨量，并倒空瓶子准备下一次测量。', 4),
        (v_project_id, '数据对比', '收集一段时间的数据后，比较不同日期的降雨量，找出哪天雨最大、哪周降雨最多。', 5);

    -- Project 4: 沙中寻宝
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '沙中寻宝',
        '沙子里藏着很多秘密！参与者将收集一些沙子，用放大镜仔细观察沙粒的颜色、形状和大小，并尝试用筛网将不同大小的颗粒分开。通过这个活动，了解沙子的来源以及自然界的风化和分选过程。',
        v_author_id, v_sub_id, 1, 35, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['沙石','分选','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '沙子（一小袋，可从沙坑或河边收集）', 1),
        (v_project_id, '放大镜', 2),
        (v_project_id, '不同孔径的筛网2-3个', 3),
        (v_project_id, '白纸或浅色托盘', 4),
        (v_project_id, '小镊子', 5),
        (v_project_id, '记录本和铅笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '收集沙子样本', '从不同地方（如沙坑、花园、河边）收集少量沙子，分别装好并标注来源。', 1),
        (v_project_id, '放大镜观察', '将沙子倒在白纸上，用放大镜仔细观察沙粒的颜色、形状和大小，看看有没有闪光的矿物颗粒。', 2),
        (v_project_id, '筛网分选', '用不同孔径的筛网依次过筛，将沙子按颗粒大小分成几组，观察各组的差异。', 3),
        (v_project_id, '寻找特殊颗粒', '用小镊子挑出特别的颗粒，如小贝壳碎片、彩色石子或微小的矿物晶体。', 4),
        (v_project_id, '记录与分享', '画出或拍下你观察到的不同沙粒，记录它们的特征，讨论沙子是怎样从大岩石变小的。', 5);

    -- Project 5: 自制风向标
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '自制风向标',
        '风从哪里来？参与者将用简单的材料制作一个风向标，放在室外观察风的方向。通过这个项目，学习风向的概念、指南针方位以及风与天气变化的关系。',
        v_author_id, v_sub_id, 1, 35, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['天气','风向','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '吸管', 1),
        (v_project_id, '硬纸板', 2),
        (v_project_id, '大头针或图钉', 3),
        (v_project_id, '带橡皮头的铅笔', 4),
        (v_project_id, '剪刀和胶带', 5),
        (v_project_id, '指南针', 6),
        (v_project_id, '小块黏土', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作箭头和尾翼', '用硬纸板剪出一个小三角形箭头和一个较大的菱形尾翼，分别插入吸管的两端并用胶带固定。', 1),
        (v_project_id, '组装风向标', '找到吸管的平衡点，用大头针穿过该位置，将大头针插入铅笔顶端的橡皮头中，确保吸管能自由转动。', 2),
        (v_project_id, '固定底座', '用黏土将铅笔竖直固定在一个平稳的底座上，确保风向标不会倒下。', 3),
        (v_project_id, '标注方位', '用指南针确定东南西北方向，在底座上标注四个方位。', 4),
        (v_project_id, '观察风向', '将风向标放到室外空旷处，观察箭头指向哪个方向，记录每天不同时间的风向变化。', 5);

    -- Project 6: 岩石硬度分类实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '岩石硬度分类实验',
        '准备几块常见岩石，用指甲、硬币等工具测试硬度并比较纹理。通过简单实验学习岩石分类的基本方法。',
        v_author_id, v_sub_id, 2, 60, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['矿物','岩石','地质','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '收集袋或小盒子', 1),
        (v_project_id, '放大镜', 2),
        (v_project_id, '岩石分类参考图', 3),
        (v_project_id, '标签贴纸和记号笔', 4),
        (v_project_id, '硬币（用于刮擦测试硬度）', 5),
        (v_project_id, '记录本和铅笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '外出收集', '去公园、河边或山脚下收集8-10块不同外观的岩石，注意记录每块岩石的发现地点。', 1),
        (v_project_id, '清洗和编号', '回家后用清水冲洗岩石，晾干后用标签贴纸给每块岩石编号。', 2),
        (v_project_id, '观察特征', '用放大镜仔细观察每块岩石的颜色、纹理、有无晶体或层状结构，用硬币刮擦测试硬度，并记录下来。', 3),
        (v_project_id, '分类归组', '对照岩石分类参考图，根据观察到的特征尝试将岩石分为火成岩、沉积岩和变质岩三大类。', 4),
        (v_project_id, '制作岩石标本卡', '为每块岩石制作一张标本卡，写上编号、发现地点、特征描述和分类结果。', 5),
        (v_project_id, '展示与讨论', '将岩石和标本卡摆放整齐，向家人或同学介绍你的岩石收藏以及三大类岩石的形成方式。', 6);

    -- Project 7: 月相观察日记
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '月相观察日记',
        '月亮为什么有时圆有时弯？参与者将在一个月内持续观察月亮的形状变化，用画笔记录每天看到的月相。通过这个项目，理解月球绕地球运动导致月相周期变化的科学原理。',
        v_author_id, v_sub_id, 2, 30, 'draft', '/projects/science_earth_sky.webp',
        ARRAY['天文','月亮','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '月相观察记录表（可自制）', 1),
        (v_project_id, '铅笔和彩色笔', 2),
        (v_project_id, '月相参考图', 3),
        (v_project_id, '手电筒（室内演示用）', 4),
        (v_project_id, '小球（如乒乓球，模拟月球）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解月相知识', '查看月相参考图，认识新月、上弦月、满月、下弦月等月相名称和形状。', 1),
        (v_project_id, '室内模拟', '在暗室里用手电筒代表太阳，小球代表月球，绕着你的头转动，观察小球被照亮部分的变化。', 2),
        (v_project_id, '每日观察记录', '每天晚上在同一时间同一地点观察月亮，在记录表上画出月亮的形状，标注日期。', 3),
        (v_project_id, '标注月相名称', '对照参考图，为每天记录的月亮形状标注正确的月相名称。', 4),
        (v_project_id, '总结月相规律', '一个月后回顾所有记录，总结月相变化的周期规律，画出完整的月相变化图。', 5);

    -- Project 8: 土壤分层实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '土壤分层实验',
        '脚下的土壤其实是由不同成分混合而成的。参与者将把土壤放入水中搅拌，观察静置后土壤自然分成不同的层次。通过这个实验，了解土壤中沙、粉砂、黏土和有机质的组成以及沉积分层的原理。',
        v_author_id, v_sub_id, 2, 45, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['土壤','沉积','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '透明玻璃罐或塑料瓶（带盖）', 1),
        (v_project_id, '花园土壤（约半杯）', 2),
        (v_project_id, '清水', 3),
        (v_project_id, '尺子', 4),
        (v_project_id, '标签贴纸和记号笔', 5),
        (v_project_id, '记录本和铅笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '收集土壤', '从花园或户外挖取约半杯土壤，去掉大块石子和树根，放入透明容器中。', 1),
        (v_project_id, '加水搅拌', '在容器中加入清水至约四分之三满，盖紧盖子，用力摇晃约一分钟，让土壤充分与水混合。', 2),
        (v_project_id, '静置观察', '将容器放在平稳的桌面上静置，不要移动。每隔30分钟观察一次，记录变化，最好静置24小时。', 3),
        (v_project_id, '测量分层', '用尺子测量每一层的厚度，你会看到底部是沙粒，中间是粉砂，上面是黏土，水面可能漂浮有机质。', 4),
        (v_project_id, '标注和记录', '用标签在容器外侧标出各层名称和厚度，在记录本上画出分层示意图并写下你的发现。', 5);

    -- Project 9: 自制日晷
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '自制日晷',
        '在没有钟表的古代，人们是怎样知道时间的呢？参与者将制作一个简易日晷，利用阳光下影子的移动来判断时间。通过这个项目，学习地球自转与太阳位置变化的关系，理解古人的计时智慧。',
        v_author_id, v_sub_id, 2, 50, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['天文','时间','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '纸盘或硬纸板', 1),
        (v_project_id, '小木棍或铅笔', 2),
        (v_project_id, '黏土（用于固定木棍）', 3),
        (v_project_id, '指南针', 4),
        (v_project_id, '记号笔', 5),
        (v_project_id, '手表或手机（对照标准时间）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作日晷盘面', '在纸盘中心用黏土固定一根小木棍，使其垂直站立，这根棍叫做"晷针"。', 1),
        (v_project_id, '确定方位', '用指南针找到正北方向，将日晷放在阳光下的空旷处，确保不被遮挡。', 2),
        (v_project_id, '标记整点影子', '从上午开始，每隔一小时在盘面上沿影子位置画线并标注当前时间，持续到下午。', 3),
        (v_project_id, '测试日晷', '第二天在同一位置和方向放好日晷，观察影子是否对准昨天标记的时间线，验证日晷的准确性。', 4),
        (v_project_id, '思考与讨论', '讨论为什么影子会移动（地球自转），以及不同季节日晷的影子长度会有什么变化。', 5);

    -- Project 10: 喷雾彩虹角度实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '喷雾彩虹角度实验',
        '在阳光下用喷壶制造小彩虹，改变站位和喷水方向观察彩虹变化。用一次可重复实验理解彩虹形成条件。',
        v_author_id, v_sub_id, 2, 40, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['光学','天气','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '喷水壶或花园水管', 1),
        (v_project_id, '阳光（选择晴天进行）', 2),
        (v_project_id, '三棱镜（可选）', 3),
        (v_project_id, '白色纸张', 4),
        (v_project_id, '记录本和彩色笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '室内初探', '如果有三棱镜，先在室内让阳光穿过三棱镜照到白纸上，观察白光被分解成七种颜色的现象。', 1),
        (v_project_id, '制造彩虹', '在晴天的户外，背对太阳站立，用喷水壶向前方喷出细密的水雾，观察水雾中是否出现彩虹。', 2),
        (v_project_id, '改变条件', '尝试改变喷水的角度、方向和水雾的粗细，记录哪种条件下彩虹最清晰、颜色最鲜艳。', 3),
        (v_project_id, '记录颜色顺序', '仔细观察彩虹中颜色的排列顺序，用彩色笔在记录本上按顺序画出赤、橙、黄、绿、蓝、靛、紫七色。', 4),
        (v_project_id, '总结形成条件', '记录彩虹出现时太阳的位置、你面对的方向和水雾的状态，总结彩虹形成需要的三个条件：光源、水滴和正确的角度。', 5);

    -- Project 11: 制作地层模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '制作地层模型',
        '地球的表面下方藏着一层又一层的岩石和沉积物，记录着数亿年的历史。参与者将用不同颜色的材料制作一个地层模型，了解地层是如何一层层堆积形成的，以及化石如何被埋藏在不同层中。',
        v_author_id, v_sub_id, 2, 60, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['地质','地层','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '透明塑料杯或玻璃容器', 1),
        (v_project_id, '不同颜色的沙子（可用彩色手工沙）', 2),
        (v_project_id, '小石子和碎石', 3),
        (v_project_id, '黏土（棕色和灰色）', 4),
        (v_project_id, '小塑料玩具（模拟化石）', 5),
        (v_project_id, '标签贴纸和记号笔', 6),
        (v_project_id, '勺子', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解地层知识', '先阅读关于地层的简单资料，了解沉积岩层的形成过程以及不同地质时期的特点。', 1),
        (v_project_id, '铺设底层', '在容器底部铺一层小石子代表最古老的基岩层，再铺一层灰色黏土代表早期沉积层。', 2),
        (v_project_id, '逐层堆积', '依次加入不同颜色的沙子和黏土，每一层代表不同的地质时期，在某些层中埋入小塑料玩具模拟化石。', 3),
        (v_project_id, '标注地层', '在容器外侧用标签标注每一层代表的地质时期或岩石类型。', 4),
        (v_project_id, '模拟地质活动', '轻轻倾斜或挤压容器，观察地层会发生怎样的变形，理解真实地质活动如褶皱和断层的形成。', 5),
        (v_project_id, '展示讲解', '向家人或同学展示你的地层模型，讲解每一层的含义和"化石"的位置。', 6);

    -- Project 12: 自制简易气象站
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '自制简易气象站',
        '气象学家是怎样预测天气的？参与者将制作温度计读数牌、风向标和简易气压计等工具，组成一个小型气象站。通过每天记录和分析多项气象数据，培养科学观测习惯，理解各种气象要素之间的关系。',
        v_author_id, v_sub_id, 3, 90, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['天气','气象观测','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '室外温度计', 1),
        (v_project_id, '自制风向标（参考风向标项目）', 2),
        (v_project_id, '自制雨量计（参考雨量计项目）', 3),
        (v_project_id, '气球和玻璃瓶（制作简易气压计）', 4),
        (v_project_id, '吸管和橡皮筋', 5),
        (v_project_id, '记录表格（打印或手绘）', 6),
        (v_project_id, '硬纸板和胶带（组装展示板）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作简易气压计', '将气球剪开蒙在玻璃瓶口上，用橡皮筋扎紧。将吸管一端粘在气球膜上，另一端指向旁边竖立的刻度纸。气压变化会使气球膜凹凸，带动吸管上下移动。', 1),
        (v_project_id, '组装气象站', '选择室外一个固定的观测点，将温度计、风向标、雨量计和气压计分别安放好，制作一块展示板标明各仪器名称。', 2),
        (v_project_id, '设计记录表', '制作包含日期、时间、温度、风向、降雨量、气压变化和云量的记录表格，准备每天填写。', 3),
        (v_project_id, '每日观测', '每天在固定时间（如早上8点和下午3点）到气象站读取各仪器的数据，认真记录在表格中。', 4),
        (v_project_id, '数据分析', '一周后回顾所有数据，尝试找出温度、气压和天气变化之间的关系，比如气压下降是否预示着下雨。', 5),
        (v_project_id, '尝试天气预报', '根据你发现的规律，试着预测第二天的天气，然后验证你的预测是否准确。', 6);

    -- Project 13: 矿物硬度测试
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '矿物硬度测试',
        '钻石为什么能切割玻璃？因为它是最硬的矿物！参与者将收集几种常见矿物和日常物品，按照莫氏硬度标准互相刮擦测试，给矿物排出硬度等级。通过这个实验，学习莫氏硬度计的原理和矿物鉴定的基本方法。',
        v_author_id, v_sub_id, 3, 60, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['矿物','莫氏硬度','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '常见矿物标本3-5种（如石英、长石、方解石、滑石）', 1),
        (v_project_id, '铜硬币', 2),
        (v_project_id, '铁钉', 3),
        (v_project_id, '玻璃片（请在大人陪同下使用）', 4),
        (v_project_id, '指甲', 5),
        (v_project_id, '莫氏硬度对照表', 6),
        (v_project_id, '记录本和铅笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习莫氏硬度', '阅读莫氏硬度对照表，了解1-10级硬度标准以及每级的代表矿物，记住常见参照物的硬度：指甲2.5、铜币3.5、铁钉5.5、玻璃5.5。', 1),
        (v_project_id, '刮擦测试', '取一块矿物，先用指甲刮擦，如果留下痕迹说明硬度低于2.5；再用铜币、铁钉依次测试，找出该矿物的大致硬度范围。', 2),
        (v_project_id, '互相刮擦', '用不同矿物互相刮擦，记录哪块能在哪块上留下划痕，这能帮你排出硬度高低顺序。', 3),
        (v_project_id, '记录结果', '制作一张矿物硬度表，列出每种矿物的名称、颜色、光泽和测定的硬度等级。', 4),
        (v_project_id, '对照鉴定', '将你的测试结果与莫氏硬度对照表比较，尝试确认每种矿物的名称，讨论硬度在矿物鉴定中的重要性。', 5);

    -- Project 14: 星座观察记录
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '星座观察记录',
        '夜空中闪烁的星星组成了美丽的星座图案。参与者将在晴朗的夜晚观察夜空，学习辨认几个著名的星座，并用星图记录它们的位置。通过持续观察，了解星座随季节变化的原因以及古人利用星座导航的故事。',
        v_author_id, v_sub_id, 3, 60, 'draft', '/projects/science_earth_sky.webp',
        ARRAY['天文','星座','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '星座图（可打印当季星图）', 1),
        (v_project_id, '红色手电筒（保护夜视能力）', 2),
        (v_project_id, '记录本和铅笔', 3),
        (v_project_id, '指南针', 4),
        (v_project_id, '保暖衣物和坐垫', 5),
        (v_project_id, '双筒望远镜（可选）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习基础星座', '在室内先通过星座图学习3-5个当季容易辨认的星座，如北斗七星、猎户座或天蝎座，记住它们的形状。', 1),
        (v_project_id, '选择观测条件', '选一个晴朗无月光或月光较弱的夜晚，找一个远离路灯的开阔地点，带上所有材料。', 2),
        (v_project_id, '辨认星座', '用指南针确定方位，面向正确的方向，对照星座图在夜空中寻找目标星座，用红色手电筒查看星图（红光不影响夜视）。', 3),
        (v_project_id, '绘制星空记录', '在记录本上画出你看到的星座位置和周围明亮的星星，标注日期、时间和方位。', 4),
        (v_project_id, '多次观察比较', '在不同日期和时间重复观察，比较同一星座在夜空中位置的变化。', 5),
        (v_project_id, '总结规律', '总结你的观察发现，讨论为什么星座在夜空中会移动（地球自转和公转），以及不同季节能看到不同星座的原因。', 6);

    -- Project 15: 水循环模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '水循环模型',
        '地球上的水是怎样循环往复的？参与者将用一个密封容器制作微型水循环模型，亲眼观察蒸发、凝结和降水的过程。通过这个项目，直观理解自然界水循环的完整过程以及太阳能在其中的关键作用。',
        v_author_id, v_sub_id, 3, 60, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['水循环','蒸发','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大号透明塑料盒（带盖）', 1),
        (v_project_id, '小碗或杯子', 2),
        (v_project_id, '温水', 3),
        (v_project_id, '冰块', 4),
        (v_project_id, '蓝色食用色素（可选）', 5),
        (v_project_id, '保鲜膜（如果盒子没有盖子）', 6),
        (v_project_id, '小石子和沙子', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建地形', '在透明盒子的一端用小石子和沙子堆出一个小"山坡"，另一端放入小碗作为"湖泊"。', 1),
        (v_project_id, '加入水源', '在小碗中倒入温水（可加几滴蓝色食用色素使水更醒目），水面不要超过碗的边缘。', 2),
        (v_project_id, '密封盒子', '盖上盖子或用保鲜膜密封盒子，在盖子顶部"山坡"一侧放上几块冰块。', 3),
        (v_project_id, '放在阳光下', '将盒子放在阳光充足的窗台上，让太阳加热盒内的水。', 4),
        (v_project_id, '观察水循环', '观察温水蒸发后在盖子上形成水滴（凝结），水滴积聚后沿冰块冷却的一侧滑落（降水），流回"湖泊"或沿"山坡"流下。', 5),
        (v_project_id, '记录与讲解', '画出你观察到的水循环过程示意图，标注蒸发、凝结、降水三个环节，并解释太阳在水循环中的作用。', 6);

    -- Project 16: 火山分层模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '火山分层模型',
        '火山是怎样爆发的？参与者将制作一个有内部分层结构的火山模型，并用小苏打和醋模拟火山喷发。通过这个项目，学习火山的内部结构、岩浆通道以及火山喷发的化学反应原理。',
        v_author_id, v_sub_id, 3, 75, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['火山','地质结构','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '空塑料瓶（小号）', 1),
        (v_project_id, '黏土或石膏', 2),
        (v_project_id, '不同颜色的颜料', 3),
        (v_project_id, '小苏打', 4),
        (v_project_id, '白醋', 5),
        (v_project_id, '红色食用色素和洗洁精', 6),
        (v_project_id, '托盘（接住溢出物）', 7),
        (v_project_id, '报纸（保护桌面）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作火山外形', '将空塑料瓶放在托盘中央，用黏土围绕瓶子塑造出火山锥的形状，注意留出瓶口作为火山口。', 1),
        (v_project_id, '展示内部分层', '在火山模型一侧做一个"剖面"窗口，用不同颜色的黏土表示地壳、地幔和岩浆通道等内部结构。', 2),
        (v_project_id, '上色装饰', '待黏土干燥后用颜料给火山上色，山顶涂白色模拟积雪，山腰涂绿色和棕色模拟植被和岩石。', 3),
        (v_project_id, '准备喷发材料', '在瓶中加入两勺小苏打、几滴红色食用色素和一点洗洁精，搅拌均匀。', 4),
        (v_project_id, '模拟喷发', '慢慢倒入白醋，观察"岩浆"从火山口涌出的壮观景象，观察气泡和泡沫的产生过程。', 5),
        (v_project_id, '讨论原理', '讨论真实火山喷发的成因（地球内部压力和热量），以及模拟实验中小苏打和醋发生酸碱反应产生二氧化碳气体的原理。', 6);

    -- Project 17: 河流侵蚀模拟实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '河流侵蚀模拟实验',
        '河流是如何一点点改变地形的？参与者将搭建一个倾斜的沙土模型，用流水模拟河流侵蚀和沉积的过程。通过观察水流如何冲刷出河道、搬运泥沙并在下游堆积，理解自然界中河流塑造地貌的力量。',
        v_author_id, v_sub_id, 4, 90, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['地质','侵蚀','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大号铝箔烤盘或塑料浅盆', 1),
        (v_project_id, '沙子和泥土', 2),
        (v_project_id, '小石子', 3),
        (v_project_id, '浇水壶或量杯', 4),
        (v_project_id, '书本（用于垫高一端制造斜坡）', 5),
        (v_project_id, '小旗子或牙签（标记位置）', 6),
        (v_project_id, '相机或手机（记录变化）', 7),
        (v_project_id, '记录本和铅笔', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建地形', '在浅盆中铺上约5厘米厚的沙土混合物，用手塑造出山丘、平原等微型地形，用小石子点缀。', 1),
        (v_project_id, '制造斜坡', '用书本将盆的一端垫高约10-15厘米，形成自然的倾斜角度，模拟河流上游的高地。', 2),
        (v_project_id, '标记初始地形', '用小旗子在几个关键位置做标记，拍照记录水流前的地形样貌。', 3),
        (v_project_id, '模拟降雨', '用浇水壶从高处缓慢而均匀地浇水，模拟降雨，观察水流如何汇聚形成"河道"并携带泥沙向下流动。', 4),
        (v_project_id, '观察侵蚀与沉积', '注意观察高处的泥沙被水流带走（侵蚀），在低处和水流变缓的地方泥沙堆积（沉积），拍照记录变化。', 5),
        (v_project_id, '对比与分析', '比较水流前后的地形变化，画出示意图，标注侵蚀区和沉积区，讨论水量大小和坡度对侵蚀速度的影响。', 6);

    -- Project 18: 地震模拟与建筑抗震
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '地震模拟与建筑抗震',
        '地震来了，什么样的建筑不容易倒？参与者将搭建不同结构的小型建筑模型，并在模拟地震的振动台上测试它们的抗震能力。通过这个项目，了解地震的成因、地震波的传播方式，以及三角形结构在建筑抗震中的重要作用。',
        v_author_id, v_sub_id, 4, 90, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['地震','结构','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '木棍或竹签', 1),
        (v_project_id, '软糖或黏土球（做连接点）', 2),
        (v_project_id, '纸板', 3),
        (v_project_id, '橡皮筋', 4),
        (v_project_id, '弹珠若干', 5),
        (v_project_id, '浅盘或纸板盒盖（做振动台）', 6),
        (v_project_id, '尺子和胶带', 7),
        (v_project_id, '记录本和铅笔', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解地震知识', '阅读关于地震成因的资料，了解板块运动、断层和地震波，知道震级和烈度的区别。', 1),
        (v_project_id, '搭建振动台', '在浅盘底部铺一层弹珠，上面放一块纸板，这样推动纸板时弹珠会使其左右振动，模拟地震效果。', 2),
        (v_project_id, '搭建不同结构模型', '用木棍和软糖搭建三种不同结构的小楼：一个纯正方形框架、一个加了对角斜撑的框架、一个三角形底座的金字塔形结构。', 3),
        (v_project_id, '地震测试', '将每个模型依次放在振动台上，用力推动纸板模拟不同强度的地震，观察哪个模型最先倒塌、哪个最稳固。', 4),
        (v_project_id, '记录与改进', '记录每种结构的表现，分析三角形和斜撑为什么能增强抗震能力，然后尝试改进设计再测试。', 5),
        (v_project_id, '总结抗震原理', '总结什么样的结构最抗震，了解现实中建筑抗震设计采用的方法，如阻尼器和隔震支座。', 6);

    -- Project 19: 晶体矿物鉴定
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '晶体矿物鉴定',
        '矿物的世界像一座宝藏等你去发掘！参与者将学习使用多种方法——包括观察晶体形状、测试硬度、检查条痕颜色和光泽——对矿物标本进行系统鉴定。通过这个项目，掌握矿物学的基本鉴定流程，培养严谨的科学观察能力。',
        v_author_id, v_sub_id, 4, 80, 'approved', '/projects/science_earth_sky.webp',
        ARRAY['矿物','鉴定','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '矿物标本套装（5-8种常见矿物）', 1),
        (v_project_id, '白色无釉瓷板（条痕板）', 2),
        (v_project_id, '放大镜', 3),
        (v_project_id, '铜硬币和铁钉', 4),
        (v_project_id, '稀盐酸（5%浓度，需大人协助）', 5),
        (v_project_id, '矿物鉴定参考手册或对照表', 6),
        (v_project_id, '记录本和铅笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '观察外部特征', '用放大镜仔细观察每块矿物的颜色、光泽（金属光泽、玻璃光泽、土状光泽等）和晶体形状，记录下来。', 1),
        (v_project_id, '条痕测试', '将矿物在白色瓷板上用力划过，观察留下的粉末颜色（条痕色），注意条痕色可能与矿物表面颜色不同。', 2),
        (v_project_id, '硬度测试', '用指甲、铜币和铁钉依次刮擦矿物，确定其大致硬度等级。', 3),
        (v_project_id, '酸性反应测试', '在大人的帮助下，滴一小滴稀盐酸在矿物表面，如果冒泡则说明含碳酸钙成分（如方解石）。', 4),
        (v_project_id, '综合鉴定', '将所有测试结果填入鉴定表，对照矿物参考手册，根据颜色、条痕、硬度、光泽和酸性反应综合判断矿物种类。', 5),
        (v_project_id, '制作鉴定报告', '为每块矿物写一份简短的鉴定报告，包括所有测试数据和最终鉴定结果，配上矿物照片或手绘图。', 6);

    -- Project 20: 本地气象数据分析
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '本地气象数据分析',
        '你所在城市的天气有什么规律？参与者将收集本地一段时间的气象数据，包括温度、降水、风速和湿度，使用图表进行整理和分析。通过这个项目，学习数据收集、图表绘制和数据分析的基本方法，并尝试发现本地气候的季节性规律。',
        v_author_id, v_sub_id, 5, 120, 'draft', '/projects/science_earth_sky.webp',
        ARRAY['气象','数据分析','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑或平板（查询气象数据网站）', 1),
        (v_project_id, '方格纸或绘图纸', 2),
        (v_project_id, '直尺和彩色笔', 3),
        (v_project_id, '计算器', 4),
        (v_project_id, '打印的空白数据表格', 5),
        (v_project_id, '文件夹（整理资料）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '确定研究目标', '选择你想研究的主题，例如"过去一个月的温度变化趋势"或"降雨量与湿度的关系"，明确要收集哪些数据。', 1),
        (v_project_id, '收集气象数据', '从气象网站或天气应用获取本地过去30天的每日气温（最高、最低）、降水量、风速和湿度数据，填入数据表格。', 2),
        (v_project_id, '整理数据', '计算每周的平均温度、总降水量等统计值，将数据按时间顺序排列，检查有无缺失或异常数据。', 3),
        (v_project_id, '绘制图表', '用方格纸绘制折线图展示温度变化趋势，柱状图展示每日降水量，还可以绘制温度与湿度的散点图。', 4),
        (v_project_id, '分析规律', '观察图表中的模式和趋势：温度是上升还是下降？降雨集中在哪几天？风速与温度变化有关系吗？写出你的发现。', 5),
        (v_project_id, '撰写分析报告', '将所有图表和分析结果整理成一份完整的气象分析报告，包括研究目的、数据来源、图表、发现和结论。', 6);

    -- Project 21: 地质徒步考察记录
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '地质徒步考察记录',
        '像真正的地质学家一样去野外考察！参与者将在大人陪同下进行一次户外地质徒步，沿途观察和记录地形地貌、岩石露头、水文特征和土壤类型。通过实地考察，综合运用所学的地球科学知识，培养野外科学考察的能力和地质记录的规范方法。',
        v_author_id, v_sub_id, 5, 180, 'draft', '/projects/science_earth_sky.webp',
        ARRAY['地质','野外考察','科学','地球'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '野外记录本（防水型最佳）', 1),
        (v_project_id, '铅笔和彩色铅笔', 2),
        (v_project_id, '放大镜', 3),
        (v_project_id, '指南针', 4),
        (v_project_id, '样品收集袋和标签', 5),
        (v_project_id, '相机或手机', 6),
        (v_project_id, '地质锤（可选，需大人使用）', 7),
        (v_project_id, '当地地形图或卫星地图打印件', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '考察准备', '选择一条有地质特征的徒步路线（如山地小径、河边或采石场附近），打印地图标注计划路线，准备好所有器材，穿好适合徒步的衣物和鞋子。', 1),
        (v_project_id, '沿途观察记录', '沿路线行走时，在记录本上记下每个观察点的位置、地形特征、岩石类型、土壤颜色和质地，并用相机拍照。', 2),
        (v_project_id, '岩石与矿物观察', '在岩石露头处停下，用放大镜观察岩石的纹理和矿物组成，判断是火成岩、沉积岩还是变质岩，采集小样品装袋标注。', 3),
        (v_project_id, '水文特征记录', '如果途经溪流或河流，记录水流方向、速度、河床岩石类型，观察有无侵蚀或沉积现象。', 4),
        (v_project_id, '绘制地质剖面图', '回家后根据记录和照片，绘制一幅沿路线的简易地质剖面图，标注不同岩层和地形特征。', 5),
        (v_project_id, '撰写考察报告', '整理所有记录、照片和样品，撰写一份完整的地质考察报告，包括考察路线、观察发现、样品描述和你的地质推断。', 6);

END $$;
