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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '植物观察' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 植物观察'; END IF;

    -- Project 1: 种子发芽观察日记
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '种子发芽观察日记',
        '选择几种常见的种子，在不同条件下进行发芽实验。每天观察并记录种子的变化过程，了解种子萌发所需的条件以及植物生长的基本规律。',
        v_author_id, v_sub_id, 1, 30, 'approved', '/projects/science_plants.webp',
        ARRAY['种子','植物生长','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '绿豆或黄豆若干', 1),
        (v_project_id, '透明塑料杯3个', 2),
        (v_project_id, '纸巾或棉花', 3),
        (v_project_id, '喷水壶', 4),
        (v_project_id, '观察记录本和彩笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备种子', '挑选饱满的绿豆或黄豆，提前用清水浸泡一晚让种皮变软。', 1),
        (v_project_id, '布置发芽环境', '在塑料杯底铺上湿纸巾或棉花，将泡好的种子均匀摆放在上面。', 2),
        (v_project_id, '设置对照组', '一杯放在有光的窗台、一杯放在黑暗的柜子里、一杯不浇水，观察不同条件的影响。', 3),
        (v_project_id, '每日观察记录', '每天用喷壶给需要浇水的杯子保湿，观察种子的变化并画下来或拍照记录。', 4),
        (v_project_id, '总结发现', '一周后对比三杯种子的发芽情况，总结种子发芽需要哪些条件。', 5);

    -- Project 2: 树叶标本采集与分类
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '树叶标本采集与分类',
        '到户外采集不同形状和颜色的树叶，制作精美的标本并尝试分类。通过观察叶片的形态特征，认识常见树木种类，培养分类和归纳能力。',
        v_author_id, v_sub_id, 1, 45, 'approved', '/projects/science_plants.webp',
        ARRAY['树木','标本','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '各种树叶（户外采集）', 1),
        (v_project_id, '旧报纸或吸水纸', 2),
        (v_project_id, '厚书本若干', 3),
        (v_project_id, '白色卡纸', 4),
        (v_project_id, '透明胶带或白乳胶', 5),
        (v_project_id, '标签贴纸和笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '户外采集', '到公园或校园里采集不同种类的树叶，尽量选择完整、无破损的叶片。', 1),
        (v_project_id, '压制干燥', '将树叶夹在报纸中间，放入厚书本里压紧，等待3-5天让叶片干燥变平。', 2),
        (v_project_id, '分类整理', '取出压好的树叶，按照叶片形状（圆形、椭圆形、掌形等）进行分类。', 3),
        (v_project_id, '制作标本卡', '将分好类的树叶用胶带固定在白色卡纸上，写上树叶名称和采集日期。', 4),
        (v_project_id, '展示交流', '把标本卡装订成册，和小伙伴分享你认识的树木种类。', 5);

    -- Project 3: 制作干花书签
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '制作干花书签',
        '用压花技术将美丽的花朵保存下来，制作独一无二的干花书签。在手工制作过程中认识不同花卉的结构，体会植物之美。',
        v_author_id, v_sub_id, 1, 40, 'approved', '/projects/science_plants.webp',
        ARRAY['花卉','压花','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小花朵和花瓣（如三叶草花、雏菊等）', 1),
        (v_project_id, '旧报纸', 2),
        (v_project_id, '厚重的书', 3),
        (v_project_id, '硬卡纸（裁成书签大小）', 4),
        (v_project_id, '白乳胶', 5),
        (v_project_id, '透明宽胶带或覆膜纸', 6),
        (v_project_id, '丝带', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '采集花朵', '选择小巧扁平的花朵和叶片，采集后轻轻擦干表面水分。', 1),
        (v_project_id, '压花干燥', '将花朵摆放在报纸上，合上书本压紧，等待5-7天完全干燥。', 2),
        (v_project_id, '设计构图', '在卡纸书签上摆放干花，尝试不同的排列方式，选择最喜欢的构图。', 3),
        (v_project_id, '粘贴固定', '用白乳胶小心地将干花粘在卡纸上，轻轻按压使其贴合。', 4),
        (v_project_id, '覆膜保护', '用透明胶带或覆膜纸覆盖书签正面，保护干花不脱落，再穿上丝带装饰。', 5);

    -- Project 4: 蔬菜水培实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '蔬菜水培实验',
        '利用厨房里常见的蔬菜根部进行水培再生实验。观察蔬菜在水中重新生长的过程，了解植物的再生能力和水培种植的基本原理。',
        v_author_id, v_sub_id, 1, 20, 'approved', '/projects/science_plants.webp',
        ARRAY['蔬菜','水培','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大葱根部或白菜根', 1),
        (v_project_id, '胡萝卜头（带叶芽部分）', 2),
        (v_project_id, '透明玻璃杯或碗', 3),
        (v_project_id, '清水', 4),
        (v_project_id, '尺子', 5),
        (v_project_id, '观察记录本', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备蔬菜', '从厨房取一根大葱的根部（约5厘米）和一个胡萝卜头，保留有芽眼的部分。', 1),
        (v_project_id, '放入水中', '将蔬菜根部放入装有少量清水的透明杯中，水位刚好没过根部底端即可。', 2),
        (v_project_id, '日常养护', '每天换一次清水，放在有阳光的窗台上，保持水位稳定。', 3),
        (v_project_id, '观察记录', '每天用尺子量一量新长出的部分有多长，把数据记录在本子上。', 4),
        (v_project_id, '总结对比', '一周后对比不同蔬菜的生长速度，思考为什么有些蔬菜长得更快。', 5);

    -- Project 5: 花瓣染色实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '花瓣染色实验',
        '将白色花朵插入彩色墨水中，观察花瓣逐渐变色的神奇过程。通过这个实验理解植物茎的毛细作用，了解水分在植物体内的运输方式。',
        v_author_id, v_sub_id, 1, 30, 'approved', '/projects/science_plants.webp',
        ARRAY['花卉','毛细作用','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白色花朵（如白色康乃馨或白色菊花）3支', 1),
        (v_project_id, '食用色素（红、蓝、绿各一种）', 2),
        (v_project_id, '透明玻璃杯3个', 3),
        (v_project_id, '清水', 4),
        (v_project_id, '剪刀', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '配制彩色水', '在三个玻璃杯中各加入半杯清水，分别滴入红、蓝、绿三种食用色素搅拌均匀。', 1),
        (v_project_id, '修剪花茎', '用剪刀将花茎底端斜着剪一刀，使切口更大，方便吸水。', 2),
        (v_project_id, '插入花朵', '将三支白花分别插入三杯彩色水中，放在光线充足的地方。', 3),
        (v_project_id, '观察变色', '每隔几小时观察一次花瓣的颜色变化，记录哪种颜色最先出现。', 4),
        (v_project_id, '探究原理', '讨论花瓣为什么会变色，画一画水分从茎到花瓣的运输路径。', 5);

    -- Project 6: 植物向光性观察
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '植物向光性观察',
        '用简单的纸盒制作迷宫，观察植物幼苗如何绕过障碍物朝着光源生长。通过实验理解植物的向光性，感受植物对环境的适应能力。',
        v_author_id, v_sub_id, 1, 30, 'approved', '/projects/science_plants.webp',
        ARRAY['植物生长','向光性','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '鞋盒1个', 1),
        (v_project_id, '硬纸板2-3块', 2),
        (v_project_id, '发芽的豆苗或小盆栽', 3),
        (v_project_id, '剪刀和胶带', 4),
        (v_project_id, '观察记录本', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作光迷宫', '在鞋盒的一端开一个小孔让光线进入，用硬纸板在盒内交替粘贴做成隔板迷宫。', 1),
        (v_project_id, '放入植物', '将发芽的豆苗放在鞋盒内远离小孔的一端，盖上盒盖。', 2),
        (v_project_id, '日常观察', '每天打开盒盖观察豆苗的生长方向，拍照或画图记录变化。', 3),
        (v_project_id, '记录数据', '连续观察一周，记录豆苗每天弯曲的角度和生长的长度。', 4),
        (v_project_id, '得出结论', '总结植物为什么会朝着有光的方向弯曲生长，了解向光性的意义。', 5);

    -- Project 7: 花的解剖观察
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '花的解剖观察',
        '挑选一朵完整的花，小心地将各个部分分离并观察。认识花萼、花瓣、雄蕊和雌蕊等结构，了解花的基本组成和各部分的功能。',
        v_author_id, v_sub_id, 2, 40, 'approved', '/projects/science_plants.webp',
        ARRAY['园林花卉','花的结构','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '新鲜花朵（如百合或桃花）2-3朵', 1),
        (v_project_id, '镊子', 2),
        (v_project_id, '放大镜', 3),
        (v_project_id, '白纸', 4),
        (v_project_id, '双面胶', 5),
        (v_project_id, '彩色铅笔和记录本', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '外部观察', '先整体观察花朵，数一数花瓣有几片，闻一闻花的气味，用放大镜观察细节。', 1),
        (v_project_id, '分离各部分', '用镊子从外向内依次取下花萼、花瓣、雄蕊和雌蕊，轻放在白纸上。', 2),
        (v_project_id, '观察结构', '用放大镜仔细观察每个部分，注意雄蕊顶端的花粉和雌蕊的形状。', 3),
        (v_project_id, '制作解剖图', '将各部分用双面胶粘在记录本上，旁边画出结构示意图并标注名称。', 4),
        (v_project_id, '了解功能', '查阅资料了解各部分的功能，思考花朵为什么需要这些结构来完成繁殖。', 5);

    -- Project 8: 阳台小菜园
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '阳台小菜园',
        '在阳台或窗台上种植小白菜、香葱等蔬菜，体验从播种到收获的完整过程。学习植物种植的基本方法，培养耐心和责任感。',
        v_author_id, v_sub_id, 2, 60, 'approved', '/projects/science_plants.webp',
        ARRAY['蔬菜','种植','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '花盆或泡沫箱2-3个', 1),
        (v_project_id, '营养土', 2),
        (v_project_id, '蔬菜种子（小白菜、香葱、生菜等）', 3),
        (v_project_id, '小铲子', 4),
        (v_project_id, '喷水壶', 5),
        (v_project_id, '植物标签牌', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备盆土', '在花盆底部铺一层小石子帮助排水，再填入营养土至八分满。', 1),
        (v_project_id, '播种', '用手指在土面按出小浅沟，将种子均匀撒入，覆盖薄薄一层细土。', 2),
        (v_project_id, '浇水标记', '用喷壶轻轻浇透水，插上标签牌写好品种名和播种日期。', 3),
        (v_project_id, '日常管理', '每天检查土壤湿度，保持土面微湿，放在阳光充足的阳台。', 4),
        (v_project_id, '观察记录', '每周记录蔬菜的生长变化，测量株高，画下叶子的形状变化。', 5),
        (v_project_id, '收获分享', '蔬菜长大后可以采摘品尝，和家人分享自己种出来的蔬菜。', 6);

    -- Project 9: 野花图鉴绘制
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '野花图鉴绘制',
        '到户外寻找各种野花，用画笔记录它们的样貌并查阅资料制作手绘图鉴。在观察与绘画中认识身边常见的野生植物，提升自然观察力。',
        v_author_id, v_sub_id, 2, 60, 'approved', '/projects/science_plants.webp',
        ARRAY['野花','手绘','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '素描本或空白笔记本', 1),
        (v_project_id, '彩色铅笔或水彩笔', 2),
        (v_project_id, '铅笔和橡皮', 3),
        (v_project_id, '放大镜', 4),
        (v_project_id, '手机（用于拍照和查阅资料）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '户外观察', '到公园、田野或路边寻找野花，仔细观察花朵的颜色、形状和大小。', 1),
        (v_project_id, '拍照记录', '用手机给每种野花拍照，记录发现地点和周围环境。', 2),
        (v_project_id, '手绘写生', '回家后对照照片，用彩色铅笔画出每种野花的样子，注意花瓣数量和叶片形状。', 3),
        (v_project_id, '查阅资料', '通过植物识别APP或书籍查出每种野花的名称和基本信息。', 4),
        (v_project_id, '制作图鉴', '在每幅画旁边写上花名、花期、生长环境等信息，装订成自己的野花图鉴。', 5);

    -- Project 10: 水果氧化实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '水果氧化实验',
        '切开苹果后观察它为什么会变褐色，并测试不同方法能否阻止变色。通过对比实验了解水果中酚类物质的氧化反应，培养科学实验的思维方法。',
        v_author_id, v_sub_id, 2, 45, 'approved', '/projects/science_plants.webp',
        ARRAY['水果','氧化反应','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '苹果2个', 1),
        (v_project_id, '柠檬汁', 2),
        (v_project_id, '盐水', 3),
        (v_project_id, '保鲜膜', 4),
        (v_project_id, '小盘子5个', 5),
        (v_project_id, '计时器', 6),
        (v_project_id, '记录本和笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '切苹果', '将苹果切成大小相同的5片，分别放在5个小盘子中编号。', 1),
        (v_project_id, '设置实验组', '1号不做处理，2号涂柠檬汁，3号泡盐水，4号覆盖保鲜膜，5号放入冰箱。', 2),
        (v_project_id, '定时观察', '每隔15分钟观察一次每片苹果的颜色变化，记录变色程度。', 3),
        (v_project_id, '对比分析', '2小时后比较5片苹果的颜色差异，排列出变色速度从快到慢的顺序。', 4),
        (v_project_id, '探讨原理', '查阅资料了解苹果变色的原因，总结哪些方法可以有效防止氧化。', 5);

    -- Project 11: 年轮观察日记
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '年轮观察日记',
        '找到树木截面或木头切片，观察和计数年轮。通过研究年轮的宽窄变化了解树木的生长历史，感受大自然中蕴含的时间密码。',
        v_author_id, v_sub_id, 2, 40, 'approved', '/projects/science_plants.webp',
        ARRAY['树木','年轮','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '木头切片或树桩截面', 1),
        (v_project_id, '放大镜', 2),
        (v_project_id, '直尺', 3),
        (v_project_id, '铅笔和彩色笔', 4),
        (v_project_id, '观察记录本', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '获取样本', '找一块木头切片或去公园观察新锯开的树桩截面。', 1),
        (v_project_id, '数年轮', '用放大镜从中心向外仔细数一数有多少圈年轮，推算树木的年龄。', 2),
        (v_project_id, '测量宽度', '用直尺测量不同位置年轮之间的宽度，记录宽窄变化。', 3),
        (v_project_id, '画年轮图', '在记录本上画出年轮的示意图，用不同颜色标注宽窄变化区域。', 4),
        (v_project_id, '推测故事', '思考年轮宽的年份和窄的年份分别发生了什么，了解气候对树木生长的影响。', 5);

    -- Project 12: 苔藓微景观制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '苔藓微景观制作',
        '收集苔藓和小石子，在玻璃瓶中创造一个迷你生态世界。了解苔藓的生长特点和生态瓶的水循环原理，体验微观生态系统的奇妙。',
        v_author_id, v_sub_id, 2, 50, 'approved', '/projects/science_plants.webp',
        ARRAY['苔藓','微景观','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '透明玻璃瓶或玻璃碗', 1),
        (v_project_id, '小石子和碎石', 2),
        (v_project_id, '活性炭少量', 3),
        (v_project_id, '营养土', 4),
        (v_project_id, '新鲜苔藓（户外采集）', 5),
        (v_project_id, '小装饰物（石头、小木屋模型等）', 6),
        (v_project_id, '喷水壶', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '铺设底层', '在玻璃瓶底部铺一层小石子用于排水，再撒一薄层活性炭帮助净化。', 1),
        (v_project_id, '添加土壤', '在碎石层上铺上2-3厘米厚的营养土，用手指轻轻压实。', 2),
        (v_project_id, '种植苔藓', '将采集来的苔藓轻轻铺在土壤表面，用手指按压使其贴合土壤。', 3),
        (v_project_id, '造景装饰', '摆放小石头和装饰物，设计出山坡、小路等微型景观。', 4),
        (v_project_id, '喷水养护', '用喷壶均匀喷水，保持苔藓湿润，放在散射光充足的地方养护。', 5);

    -- Project 13: 树皮拓印收集
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '树皮拓印收集',
        '用纸和蜡笔在不同树木的树干上进行拓印，收集各种树皮纹理。比较不同树种的树皮特征，建立自己的树皮纹理图库。',
        v_author_id, v_sub_id, 2, 45, 'approved', '/projects/science_plants.webp',
        ARRAY['树木','纹理','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白纸若干张', 1),
        (v_project_id, '蜡笔（去掉纸套）', 2),
        (v_project_id, '胶带', 3),
        (v_project_id, '记录本', 4),
        (v_project_id, '铅笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择树木', '在校园或公园里选择几棵不同种类的树，观察它们的树皮有什么不同。', 1),
        (v_project_id, '固定纸张', '将白纸用胶带固定在树干上，确保纸面贴紧树皮表面。', 2),
        (v_project_id, '拓印纹理', '用蜡笔侧面在纸上均匀涂抹，树皮的凹凸纹理会清晰地显现在纸上。', 3),
        (v_project_id, '标注信息', '在每张拓印纸上写好树木名称、位置和拓印日期。', 4),
        (v_project_id, '对比分类', '将所有拓印作品排列在一起，按照纹理粗细、深浅进行分类对比。', 5);

    -- Project 14: 植物蒸腾作用实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '植物蒸腾作用实验',
        '用塑料袋套住植物枝叶，观察袋子内壁出现的水珠。通过实验直观地了解植物蒸腾作用，理解植物在水循环中的重要角色。',
        v_author_id, v_sub_id, 3, 35, 'approved', '/projects/science_plants.webp',
        ARRAY['蒸腾作用','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '健康的盆栽植物1盆', 1),
        (v_project_id, '透明塑料袋3个', 2),
        (v_project_id, '绳子或橡皮筋', 3),
        (v_project_id, '凡士林（可选）', 4),
        (v_project_id, '电子秤', 5),
        (v_project_id, '记录本', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '套袋实验', '选取植物一根有叶子的枝条，用透明塑料袋套住并用绳子扎紧袋口。', 1),
        (v_project_id, '设置对照', '另一个袋子套在没有叶子的枝条上，还有一个袋子在叶片两面涂上凡士林后套袋。', 2),
        (v_project_id, '等待观察', '将植物放在阳光下，每隔1小时观察各个袋子内壁的水珠情况。', 3),
        (v_project_id, '称量对比', '4小时后取下塑料袋，用电子秤称量袋中积累的水分重量。', 4),
        (v_project_id, '分析讨论', '比较三组实验结果，解释为什么有叶子的枝条蒸腾最多，以及凡士林的作用。', 5);

    -- Project 15: 无土栽培实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '无土栽培实验',
        '不用泥土，利用营养液和支撑材料种植蔬菜或花卉。对比无土栽培与土壤种植的生长差异，理解植物生长所需的基本营养元素。',
        v_author_id, v_sub_id, 3, 60, 'approved', '/projects/science_plants.webp',
        ARRAY['水培','营养液','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '塑料瓶2个（切开做容器）', 1),
        (v_project_id, '海绵或珍珠岩', 2),
        (v_project_id, '植物营养液', 3),
        (v_project_id, '生菜或小白菜种子', 4),
        (v_project_id, '清水', 5),
        (v_project_id, '尺子和记录本', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作容器', '将塑料瓶从中间切开，上半部分倒扣在下半部分中，瓶口朝下作为种植篮。', 1),
        (v_project_id, '固定种子', '在上半部分的瓶口处塞入湿海绵，将种子放在海绵上方，保持湿润。', 2),
        (v_project_id, '配制营养液', '按照说明书将营养液稀释后倒入下半部分容器，液面刚好接触到海绵底部。', 3),
        (v_project_id, '对照实验', '同时用普通泥土在另一个花盆中种下相同的种子，保持其他条件一致。', 4),
        (v_project_id, '记录对比', '每天测量两组植物的株高和叶片数，持续记录2-3周。', 5),
        (v_project_id, '总结报告', '制作对比图表，分析无土栽培和土壤种植的优缺点。', 6);

    -- Project 16: 叶脉书签制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '叶脉书签制作',
        '使用碱水煮叶片去除叶肉，保留精美的叶脉网络制作透明书签。在制作过程中观察叶脉的分布规律，了解叶脉在植物中输送水分和养分的功能。',
        v_author_id, v_sub_id, 3, 90, 'approved', '/projects/science_plants.webp',
        ARRAY['树叶','化学处理','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '质地较硬的树叶（如桂花叶、玉兰叶）', 1),
        (v_project_id, '食用碱（碳酸钠）', 2),
        (v_project_id, '锅和水', 3),
        (v_project_id, '旧牙刷', 4),
        (v_project_id, '食用色素', 5),
        (v_project_id, '卡纸和丝带', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '煮碱水', '在锅中加水，放入适量食用碱，大人帮忙加热至微微沸腾。', 1),
        (v_project_id, '煮叶片', '将洗净的树叶放入碱水中小火煮20-30分钟，直到叶肉变得软烂。', 2),
        (v_project_id, '刷去叶肉', '取出叶片放在清水中，用旧牙刷轻轻刷去叶肉，只留下叶脉网络。', 3),
        (v_project_id, '漂白染色', '将叶脉放入清水中漂洗干净，再放入稀释的食用色素溶液中染上喜欢的颜色。', 4),
        (v_project_id, '晾干装饰', '将染好色的叶脉夹在书本中压平晾干，粘在卡纸上穿上丝带做成精美书签。', 5);

    -- Project 17: 果实与种子传播方式
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '果实与种子传播方式',
        '收集不同类型的果实和种子，研究它们各自的传播方式。通过观察种子的外形特征，推测风力传播、动物传播、弹射传播等策略，感叹大自然的智慧。',
        v_author_id, v_sub_id, 3, 50, 'approved', '/projects/science_plants.webp',
        ARRAY['种子','传播','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '各种果实和种子（蒲公英、苍耳、豌豆荚、枫树翅果等）', 1),
        (v_project_id, '放大镜', 2),
        (v_project_id, '白纸', 3),
        (v_project_id, '双面胶', 4),
        (v_project_id, '彩色笔和记录本', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '采集种子', '到户外收集各种果实和种子，如蒲公英绒球、苍耳刺果、枫树翅果等。', 1),
        (v_project_id, '观察特征', '用放大镜仔细观察每种种子的形态特征，注意有没有翅膀、钩刺、绒毛等结构。', 2),
        (v_project_id, '模拟传播', '试着吹蒲公英、把苍耳粘在衣服上、挤压豌豆荚，模拟各种传播方式。', 3),
        (v_project_id, '分类归纳', '根据传播方式将种子分为风力传播、动物传播、弹射传播、水力传播等类别。', 4),
        (v_project_id, '制作展板', '将种子粘在展板上，画出传播方式示意图，写上每种种子的名称和传播策略。', 5);

    -- Project 18: 多肉植物繁殖实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '多肉植物繁殖实验',
        '用叶插和分株两种方法繁殖多肉植物，比较不同繁殖方式的成功率。了解无性繁殖的原理，亲手培育新的多肉植株。',
        v_author_id, v_sub_id, 3, 30, 'approved', '/projects/science_plants.webp',
        ARRAY['多肉','扦插','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '多肉植物母株1盆', 1),
        (v_project_id, '多肉专用颗粒土', 2),
        (v_project_id, '小花盆或育苗盒', 3),
        (v_project_id, '喷水壶', 4),
        (v_project_id, '镊子', 5),
        (v_project_id, '标签和记录本', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '取叶片', '从多肉母株上轻轻左右摇动取下几片饱满健康的叶子，确保叶片根部完整。', 1),
        (v_project_id, '晾干伤口', '将取下的叶片放在阴凉通风处晾1-2天，让伤口愈合结痂。', 2),
        (v_project_id, '叶插摆放', '将晾好的叶片平放在颗粒土表面，不要插入土中，放在散光通风处。', 3),
        (v_project_id, '分株操作', '同时从母株上分出带根的侧芽，直接种入新花盆中作为对照组。', 4),
        (v_project_id, '养护观察', '每3天喷少量水保持微湿，记录叶片生根发芽和分株生长的时间差异。', 5),
        (v_project_id, '总结对比', '对比叶插和分株两种方式的成功率和生长速度，总结各自的优缺点。', 6);

    -- Project 19: 植物色素提取
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '植物色素提取',
        '从不同颜色的花瓣和叶片中提取天然色素，并用这些色素进行简单的染色或绘画。了解植物中色素的种类和功能，探索天然染料的奥秘。',
        v_author_id, v_sub_id, 4, 60, 'approved', '/projects/science_plants.webp',
        ARRAY['色素','提取','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '紫甘蓝、菠菜叶、红色花瓣等植物材料', 1),
        (v_project_id, '研钵和研杵（或碗和勺子）', 2),
        (v_project_id, '纱布或滤纸', 3),
        (v_project_id, '酒精或热水', 4),
        (v_project_id, '小玻璃杯若干', 5),
        (v_project_id, '白色棉布小块', 6),
        (v_project_id, '醋和小苏打', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '研磨植物', '将紫甘蓝叶撕碎放入研钵，加少量酒精或热水，用力研磨直到液体变色。', 1),
        (v_project_id, '过滤提取', '用纱布过滤研磨液，将彩色滤液收集到玻璃杯中，分别提取不同植物的色素。', 2),
        (v_project_id, '酸碱变色', '向紫甘蓝色素液中分别加入醋和小苏打水，观察颜色的奇妙变化。', 3),
        (v_project_id, '天然染色', '将白色棉布浸入不同的色素液中，观察布料的染色效果。', 4),
        (v_project_id, '色素绘画', '用提取的各色色素当作颜料，在白纸上画一幅天然色素画。', 5),
        (v_project_id, '总结报告', '记录各种植物色素的颜色特点、酸碱变色现象，分析色素在植物中的作用。', 6);

    -- Project 20: 嫁接与扦插实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '嫁接与扦插实验',
        '学习并实践植物的嫁接和扦插两种无性繁殖技术。通过亲手操作了解植物形成层的愈合过程，观察新植株的生长发育。',
        v_author_id, v_sub_id, 4, 60, 'approved', '/projects/science_plants.webp',
        ARRAY['嫁接','无性繁殖','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '月季或仙人掌（做砧木）', 1),
        (v_project_id, '不同品种的接穗枝条', 2),
        (v_project_id, '锋利的嫁接刀或美工刀', 3),
        (v_project_id, '嫁接专用胶带或保鲜膜', 4),
        (v_project_id, '花盆和营养土', 5),
        (v_project_id, '生根粉（可选）', 6),
        (v_project_id, '记录本', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备材料', '选择健壮的砧木和新鲜的接穗枝条，提前一天给砧木浇透水。', 1),
        (v_project_id, '嫁接操作', '在大人指导下用刀在砧木上切出V形缺口，将削好的接穗插入对齐形成层，用胶带缠紧固定。', 2),
        (v_project_id, '扦插操作', '另取一段枝条，底端蘸上生根粉，斜插入湿润的营养土中约三分之一深度。', 3),
        (v_project_id, '养护管理', '将嫁接和扦插的植物放在阴凉通风处，保持土壤湿润但不积水。', 4),
        (v_project_id, '观察记录', '每周检查嫁接口的愈合情况和扦插枝条的生根情况，详细记录变化。', 5),
        (v_project_id, '成果展示', '一个月后评估存活率，拍照记录成长过程，写一篇实验小报告。', 6);

    -- Project 21: 校园植物多样性调查
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '校园植物多样性调查',
        '对校园内的植物进行系统调查，记录各区域的植物种类和数量。学习生物多样性调查的基本方法，了解校园生态环境，提出绿化改善建议。',
        v_author_id, v_sub_id, 4, 90, 'approved', '/projects/science_plants.webp',
        ARRAY['植物','生态调查','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '植物图鉴或识别APP', 1),
        (v_project_id, '记录表格（提前设计）', 2),
        (v_project_id, '卷尺', 3),
        (v_project_id, '手机或相机', 4),
        (v_project_id, '校园地图打印版', 5),
        (v_project_id, '铅笔和彩色笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制定计划', '将校园划分为几个区域（教学区、操场、花园等），设计调查记录表格。', 1),
        (v_project_id, '实地调查', '分组前往各区域，记录每种植物的名称、数量、高度和生长状况，拍照留证。', 2),
        (v_project_id, '鉴定分类', '用植物图鉴或识别APP确认植物名称，按乔木、灌木、草本、藤本分类。', 3),
        (v_project_id, '数据整理', '汇总各区域调查数据，统计植物种类总数，计算各区域的物种丰富度。', 4),
        (v_project_id, '绘制图表', '制作柱状图比较各区域植物多样性，在校园地图上标注植物分布。', 5),
        (v_project_id, '撰写报告', '撰写调查报告，分析校园植物多样性现状并提出增加多样性的建议。', 6);

    -- Project 22: 植物对不同光照的响应
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '植物对不同光照的响应',
        '将同种植物分别放在全日照、半遮阴和全遮阴的环境中，记录生长差异。通过严格的对照实验了解光照对光合作用和植物生长的影响，培养实验设计能力。',
        v_author_id, v_sub_id, 4, 45, 'approved', '/projects/science_plants.webp',
        ARRAY['光合作用','实验设计','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '相同大小的盆栽植物3盆（如绿豆苗）', 1),
        (v_project_id, '遮光纸板或黑色塑料袋', 2),
        (v_project_id, '半透明纱布', 3),
        (v_project_id, '尺子', 4),
        (v_project_id, '电子秤', 5),
        (v_project_id, '数据记录表', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '实验设计', '设计三组对照：全日照（阳台）、半遮阴（纱布遮挡）、全遮阴（纸板箱内），其他条件保持一致。', 1),
        (v_project_id, '初始测量', '测量三盆植物的初始株高、叶片数和颜色，称量植物连盆重量并记录。', 2),
        (v_project_id, '放置实验', '将三盆植物分别放在三种光照条件下，每天定时浇等量的水。', 3),
        (v_project_id, '每日记录', '每天同一时间测量株高、数叶片、观察叶色变化，拍照对比。', 4),
        (v_project_id, '数据分析', '两周后绘制生长曲线图，比较三组植物在株高、叶色、叶片大小上的差异。', 5),
        (v_project_id, '撰写结论', '分析光照如何影响植物的光合作用和生长，写出完整的实验报告。', 6);

    -- Project 23: 简易植物组织培养
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '简易植物组织培养',
        '在简易无菌条件下进行植物组织培养实验，用一小块植物组织培育出新的植株。体验生物技术的魅力，了解细胞全能性的基本概念。',
        v_author_id, v_sub_id, 5, 90, 'approved', '/projects/science_plants.webp',
        ARRAY['组织培养','无菌','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '马铃薯或胡萝卜', 1),
        (v_project_id, '琼脂粉', 2),
        (v_project_id, '白砂糖', 3),
        (v_project_id, '带盖玻璃瓶（提前高温消毒）', 4),
        (v_project_id, '酒精灯或蜡烛', 5),
        (v_project_id, '消毒棉球和医用酒精', 6),
        (v_project_id, '镊子和刀片（消毒过）', 7),
        (v_project_id, '高压锅（成年人协助）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制备培养基', '将琼脂粉、白砂糖和水混合加热溶解，倒入玻璃瓶中，用高压锅灭菌。', 1),
        (v_project_id, '准备外植体', '将马铃薯芽眼处切取小块组织，用酒精表面消毒后用无菌水冲洗。', 2),
        (v_project_id, '无菌接种', '在酒精灯火焰旁（模拟无菌环境），用消毒镊子将外植体放入培养基表面。', 3),
        (v_project_id, '密封培养', '迅速盖上瓶盖密封，放在有散射光的温暖环境中培养。', 4),
        (v_project_id, '观察记录', '每天观察瓶内变化，记录是否有愈伤组织形成、新芽萌发或污染现象。', 5),
        (v_project_id, '分析总结', '2-3周后评估实验结果，总结成功或失败的原因，了解组织培养对无菌要求的重要性。', 6);

    -- Project 24: 校园植物分布图绘制
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '校园植物分布图绘制',
        '通过实地考察将校园中各种植物的位置标注在地图上，制作一份详细的校园植物生态地图。综合运用植物识别、地图绘制和数据分析技能，为校园绿化提供参考。',
        v_author_id, v_sub_id, 5, 120, 'approved', '/projects/science_plants.webp',
        ARRAY['植物','生态地图','科学','植物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '校园平面图（可打印或手绘底图）', 1),
        (v_project_id, '植物识别APP或图鉴', 2),
        (v_project_id, '指南针', 3),
        (v_project_id, '卷尺或测距仪', 4),
        (v_project_id, '彩色铅笔和马克笔', 5),
        (v_project_id, 'A3绘图纸', 6),
        (v_project_id, '手机或相机', 7),
        (v_project_id, '数据记录本', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绘制底图', '在A3纸上参照校园平面图绘制出建筑、道路、操场等主要地标的位置。', 1),
        (v_project_id, '分区考察', '将校园分为若干区域，逐区走访记录每棵乔木和灌木丛的大致位置和种类。', 2),
        (v_project_id, '植物鉴定', '利用识别APP或图鉴确认每种植物的名称，统计每种植物的数量。', 3),
        (v_project_id, '标注地图', '用不同颜色和符号在底图上标注各种植物的位置，制定清晰的图例。', 4),
        (v_project_id, '数据统计', '统计校园植物总种类数、各区域密度、常绿与落叶比例等数据。', 5),
        (v_project_id, '完善报告', '美化地图并附上植物名录、照片和分析说明，形成完整的校园植物分布报告。', 6);

END $$;
