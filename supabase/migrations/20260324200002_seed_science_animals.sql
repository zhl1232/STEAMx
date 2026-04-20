-- ============================================
-- 种子数据：动物观察 × 24 个项目
-- ============================================

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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '动物观察' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 动物观察'; END IF;

    -- ============================================
    -- 项目 1: 校园昆虫大搜索 ★1
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '校园昆虫大搜索',
        '带上放大镜和记录本，走遍校园的花坛、草地和树下，寻找各种小昆虫。观察它们的外形特征，学习简单的昆虫分类方法，了解昆虫与环境的关系。',
        v_author_id, v_sub_id, 1, 40, 'approved', '/projects/science_animals.webp',
        ARRAY['昆虫','分类','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '放大镜', 1),
        (v_project_id, '观察记录本', 2),
        (v_project_id, '彩色铅笔', 3),
        (v_project_id, '透明观察盒', 4),
        (v_project_id, '软毛刷（用于轻轻拨动昆虫）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择观察区域', '在校园里选择花坛、草地、大树下等不同区域作为观察点。', 1),
        (v_project_id, '仔细搜索', '蹲下来用放大镜仔细观察叶片背面、石头下方和树皮缝隙，记录发现的昆虫。', 2),
        (v_project_id, '画图记录', '用彩色铅笔画出每种昆虫的外形，标注颜色、腿的数量和大致体长。', 3),
        (v_project_id, '尝试分类', '根据翅膀有无、腿的数量等特征，尝试将发现的昆虫分成不同的类别。', 4),
        (v_project_id, '总结发现', '统计一共发现了几种昆虫，讨论哪种区域昆虫最多，思考原因。', 5);

    -- ============================================
    -- 项目 2: 蜗牛行为小实验 ★1
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '蜗牛行为小实验',
        '找一只蜗牛作为观察对象，通过简单的实验了解蜗牛对光线、食物和湿度的反应。观察蜗牛爬行时留下的黏液痕迹，认识软体动物的基本特征。',
        v_author_id, v_sub_id, 1, 30, 'approved', '/projects/science_animals.webp',
        ARRAY['软体动物','行为','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '蜗牛1～2只', 1),
        (v_project_id, '透明塑料盒', 2),
        (v_project_id, '喷水壶', 3),
        (v_project_id, '菜叶（生菜或白菜）', 4),
        (v_project_id, '手电筒', 5),
        (v_project_id, '放大镜', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '采集蜗牛', '雨后在花园的石头下或潮湿的墙角寻找蜗牛，轻轻放入透明塑料盒中。', 1),
        (v_project_id, '观察外形', '用放大镜观察蜗牛的触角、眼睛、壳的螺旋方向，画出蜗牛的身体结构图。', 2),
        (v_project_id, '光照实验', '用手电筒照射蜗牛，观察它是朝向光源还是躲避光源，记录它的反应。', 3),
        (v_project_id, '食物偏好测试', '在蜗牛面前摆放不同的食物（菜叶、水果片、面包），观察它最先爬向哪种食物。', 4),
        (v_project_id, '记录与总结', '把观察结果整理成表格，总结蜗牛的行为特点和喜好。', 5);

    -- ============================================
    -- 项目 3: 蚂蚁觅食路线追踪 ★1
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '蚂蚁觅食路线追踪',
        '在蚂蚁经常出没的地方放置少量食物，观察蚂蚁发现食物后的行为和搬运路线。了解蚂蚁的信息素通讯方式，认识昆虫的群体协作行为。',
        v_author_id, v_sub_id, 1, 35, 'draft', '/projects/science_animals.webp',
        ARRAY['昆虫','行为','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '少量白糖或饼干碎', 1),
        (v_project_id, '白纸', 2),
        (v_project_id, '彩色粉笔', 3),
        (v_project_id, '放大镜', 4),
        (v_project_id, '计时器或手表', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '寻找蚂蚁巢穴', '在户外地面的缝隙处寻找蚂蚁进出的洞口，确认蚁巢位置。', 1),
        (v_project_id, '放置诱饵', '在距离蚁巢约半米处的白纸上放几粒白糖，耐心等待蚂蚁发现。', 2),
        (v_project_id, '追踪路线', '当蚂蚁开始搬运食物时，用彩色粉笔沿着它们的行走路线轻轻标记。', 3),
        (v_project_id, '计时观察', '记录第一只蚂蚁发现食物的时间，以及越来越多蚂蚁前来的时间间隔。', 4),
        (v_project_id, '讨论与思考', '想一想：蚂蚁是怎样通知同伴食物位置的？为什么它们总是走同一条路线？', 5);

    -- ============================================
    -- 项目 4: 喂鸟观察站 ★1
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '喂鸟观察站',
        '用简单的材料制作一个鸟类喂食器，挂在窗外或阳台上，吸引附近的小鸟前来取食。通过每天观察记录，认识身边常见的鸟类，培养关爱动物的意识。',
        v_author_id, v_sub_id, 1, 45, 'draft', '/projects/science_animals.webp',
        ARRAY['鸟类','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '空牛奶盒或塑料瓶', 1),
        (v_project_id, '剪刀', 2),
        (v_project_id, '细绳', 3),
        (v_project_id, '小米或葵花籽', 4),
        (v_project_id, '观察记录本', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作喂食器', '在空牛奶盒侧面剪出一个拱形开口，底部留出约2厘米作为食物托盘。', 1),
        (v_project_id, '安装悬挂', '在盒子顶部穿绳子，将喂食器挂在窗外的树枝或栏杆上。', 2),
        (v_project_id, '放入食物', '在喂食器底部撒上一层小米或葵花籽，每天补充新鲜食物。', 3),
        (v_project_id, '安静观察', '在远处安静等待，当鸟儿来吃食时，观察它们的体型、颜色和行为。', 4),
        (v_project_id, '记录与辨认', '画出看到的鸟的样子，借助图鉴或网络查询它们的名字，记录每天来访的鸟种。', 5);

    -- ============================================
    -- 项目 5: 宠物行为观察日记 ★1
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '宠物行为观察日记',
        '选择家里或朋友家的宠物（猫、狗、仓鼠等），连续几天观察和记录它们的日常行为，如进食、睡眠、玩耍等。学习科学观察和记录方法，了解动物的基本需求。',
        v_author_id, v_sub_id, 1, 30, 'draft', '/projects/science_animals.webp',
        ARRAY['动物行为','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '观察记录本', 1),
        (v_project_id, '彩色铅笔', 2),
        (v_project_id, '计时器或手表', 3),
        (v_project_id, '相机或手机（拍照记录）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制定观察计划', '选择一只宠物，决定每天固定的观察时间段（如早晨、中午、傍晚各15分钟）。', 1),
        (v_project_id, '观察与记录', '在观察时间内安静地待在宠物附近，记录它正在做什么：吃东西、睡觉、跑动还是其他行为。', 2),
        (v_project_id, '画行为时间表', '用表格记录宠物在不同时间段的行为，画出一天的活动时间线。', 3),
        (v_project_id, '连续记录', '坚持记录至少3天，比较每天的行为是否有规律。', 4),
        (v_project_id, '总结发现', '写一篇简短的观察报告，描述宠物的行为规律和你发现的有趣现象。', 5);

    -- ============================================
    -- 项目 6: 蝌蚪变青蛙观察 ★1
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '蝌蚪变青蛙观察',
        '在春天采集几只蝌蚪，放在适宜的容器中饲养，每天观察蝌蚪从长出后腿到变成小青蛙的全过程。认识两栖动物的变态发育，了解生命的奇妙变化。',
        v_author_id, v_sub_id, 1, 20, 'draft', '/projects/science_animals.webp',
        ARRAY['两栖动物','变态发育','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '蝌蚪3～5只', 1),
        (v_project_id, '大玻璃缸或塑料盒', 2),
        (v_project_id, '池塘水或静置自来水', 3),
        (v_project_id, '水草少量', 4),
        (v_project_id, '煮熟的菜叶（作为蝌蚪食物）', 5),
        (v_project_id, '观察记录本', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备饲养环境', '在玻璃缸中加入池塘水和水草，水深约10厘米，放在通风阴凉处。', 1),
        (v_project_id, '放入蝌蚪', '将采集的蝌蚪轻轻放入缸中，每天喂少量煮软的菜叶碎。', 2),
        (v_project_id, '每日观察', '每天画出蝌蚪的样子，记录尾巴长度、是否长出后腿和前腿等变化。', 3),
        (v_project_id, '记录关键变化', '重点记录后腿出现、前腿出现、尾巴变短这三个关键阶段的日期。', 4),
        (v_project_id, '放归自然', '当蝌蚪完全变成小青蛙后，带到采集地附近的水塘边放归自然。', 5);

    -- ============================================
    -- 项目 7: 小区鸟类图鉴 ★2
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '小区鸟类图鉴',
        '在一周内多次到小区或公园里观察鸟类，用文字和图画记录它们的外形特征、叫声和行为，最终制作成一本属于自己的鸟类图鉴小册子。',
        v_author_id, v_sub_id, 2, 60, 'draft', '/projects/science_animals.webp',
        ARRAY['鸟类','观察记录','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '双筒望远镜（可选）', 1),
        (v_project_id, 'A4纸数张', 2),
        (v_project_id, '彩色铅笔或水彩笔', 3),
        (v_project_id, '鸟类图鉴参考书', 4),
        (v_project_id, '订书机或线绳（装订用）', 5),
        (v_project_id, '观察记录本', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择观察地点', '选择小区花园、湖边或公园等鸟类经常出没的地方，确定3～5个固定观察点。', 1),
        (v_project_id, '多次观察记录', '在一周内的不同时间段（清晨和傍晚最佳）前往观察点，记录看到的鸟类。', 2),
        (v_project_id, '绘制鸟类插图', '根据观察和拍照，为每种鸟画一幅彩色插图，标注关键特征（喙形、羽色、体型）。', 3),
        (v_project_id, '查阅资料', '借助图鉴或网络确认每种鸟的名称、食性和生活习性，写成简短的文字介绍。', 4),
        (v_project_id, '装订成册', '将所有插图和文字按顺序排列，装订成一本小册子，设计封面。', 5),
        (v_project_id, '分享展示', '在班级或家庭中展示你的鸟类图鉴，讲述观察过程中最有趣的发现。', 6);

    -- ============================================
    -- 项目 8: 蚂蚁王国观察记 ★2
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '蚂蚁王国观察记',
        '制作一个简易的蚂蚁观察巢，长期观察蚂蚁的社会分工和协作行为。了解蚂蚁群体中工蚁、兵蚁和蚁后的不同角色，认识昆虫的社会性行为。',
        v_author_id, v_sub_id, 2, 50, 'draft', '/projects/science_animals.webp',
        ARRAY['昆虫','社会行为','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '两片透明亚克力板或玻璃板', 1),
        (v_project_id, '湿润的细沙土', 2),
        (v_project_id, '蚂蚁若干（含工蚁）', 3),
        (v_project_id, '深色布（遮光用）', 4),
        (v_project_id, '少量白糖和面包屑', 5),
        (v_project_id, '喷水壶', 6),
        (v_project_id, '观察记录本', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建观察巢', '将两片透明板平行放置，中间填入湿润的细沙土，间距约1厘米，四周用胶带封住留一个小口。', 1),
        (v_project_id, '引入蚂蚁', '在户外蚁巢附近小心地收集一些蚂蚁，放入观察巢中，用深色布遮盖大部分区域模拟地下环境。', 2),
        (v_project_id, '日常喂养', '每隔一天在小口处放入少量食物和水滴，保持沙土适当湿润。', 3),
        (v_project_id, '观察记录', '每天掀开遮光布观察几分钟，记录蚂蚁是否开始挖掘隧道、如何搬运食物、如何分工合作。', 4),
        (v_project_id, '绘制隧道地图', '用纸笔画出蚂蚁挖掘的隧道形状变化，标注不同日期的进展。', 5),
        (v_project_id, '总结分享', '写一篇观察报告，描述蚂蚁的社会分工现象，完成后将蚂蚁放回户外。', 6);

    -- ============================================
    -- 项目 9: 蚯蚓与土壤实验 ★2
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '蚯蚓与土壤实验',
        '通过对比实验观察蚯蚓对土壤的改良作用。将蚯蚓放入分层土壤中，连续观察土壤层的变化，了解蚯蚓在生态系统中的重要角色。',
        v_author_id, v_sub_id, 2, 45, 'approved', '/projects/science_animals.webp',
        ARRAY['环节动物','土壤','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大透明玻璃瓶或塑料瓶', 1),
        (v_project_id, '花园土', 2),
        (v_project_id, '细沙', 3),
        (v_project_id, '落叶碎片', 4),
        (v_project_id, '蚯蚓5～8条', 5),
        (v_project_id, '喷水壶', 6),
        (v_project_id, '深色纸（遮光）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备分层土壤', '在透明瓶中交替铺入花园土和细沙，各约2厘米厚，共铺3～4层，最上面撒一层落叶碎片。', 1),
        (v_project_id, '放入蚯蚓', '将蚯蚓轻轻放在土壤表面，喷少量水保持湿润，用深色纸包住瓶身。', 2),
        (v_project_id, '每日观察', '每天揭开遮光纸，观察土壤各层的界限是否变模糊，记录蚯蚓的隧道痕迹。', 3),
        (v_project_id, '对比记录', '画出第1天、第3天和第7天的土壤分层变化图进行对比。', 4),
        (v_project_id, '总结讨论', '讨论蚯蚓如何混合土壤、改善土壤结构，以及蚯蚓对植物生长的帮助。实验结束后将蚯蚓放回花园。', 5);

    -- ============================================
    -- 项目 10: 鱼鳃开合频率记录 ★2
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '鱼鳃开合频率记录',
        '选择一条鱼，在固定时间内记录鱼鳃开合次数，并比较不同时间段或环境下的变化。通过量化记录认识鱼类呼吸节奏。',
        v_author_id, v_sub_id, 2, 40, 'approved', '/projects/science_animals.webp',
        ARRAY['鱼类','呼吸','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小鱼1～2条（如金鱼）', 1),
        (v_project_id, '透明鱼缸', 2),
        (v_project_id, '温度计', 3),
        (v_project_id, '计时器', 4),
        (v_project_id, '记录本和笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '观察鳃盖运动', '将鱼放入清水鱼缸中静置10分钟，然后仔细观察鱼嘴和鳃盖的一张一合运动。', 1),
        (v_project_id, '计数呼吸频率', '用计时器计时1分钟，数鱼的鳃盖开合次数，重复三次取平均值。', 2),
        (v_project_id, '改变水温测试', '缓慢加入少量温水使水温升高约3～5度，等鱼适应后再次计数呼吸频率。', 3),
        (v_project_id, '记录数据', '将不同水温下的呼吸频率记录在表格中，画出简单的柱状图。', 4),
        (v_project_id, '分析与总结', '比较不同水温下鱼的呼吸频率，讨论温度如何影响鱼的呼吸，思考鱼用鳃呼吸与人用肺呼吸的区别。', 5);

    -- ============================================
    -- 项目 11: 蜘蛛织网观察 ★2
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '蜘蛛织网观察',
        '在花园或阳台角落找到蜘蛛网，仔细观察蜘蛛网的结构和蜘蛛的织网过程。了解蜘蛛网的几何之美和蜘蛛捕食的策略，认识蛛形纲动物的特征。',
        v_author_id, v_sub_id, 2, 50, 'draft', '/projects/science_animals.webp',
        ARRAY['蛛形纲','行为','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '放大镜', 1),
        (v_project_id, '观察记录本', 2),
        (v_project_id, '彩色铅笔', 3),
        (v_project_id, '喷雾瓶（清水）', 4),
        (v_project_id, '相机或手机', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '寻找蜘蛛网', '在花园的树枝间、窗户角落或灌木丛中寻找完整的蜘蛛网。', 1),
        (v_project_id, '观察网的结构', '用放大镜仔细观察蜘蛛网的形状，数一数有多少条辐射丝和螺旋丝，画出网的结构图。', 2),
        (v_project_id, '喷水显形', '用喷雾瓶轻轻向蜘蛛网喷水雾，水珠会挂在丝上，让网的结构更加清晰，适合拍照记录。', 3),
        (v_project_id, '观察捕食行为', '耐心等待，观察当小虫触网时蜘蛛的反应和捕食过程，记录整个过程。', 4),
        (v_project_id, '了解蜘蛛特征', '查阅资料，了解蜘蛛与昆虫的区别（8条腿vs6条腿），写出蛛形纲动物的主要特征。', 5);

    -- ============================================
    -- 项目 12: 螃蟹行为观察 ★2
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '螃蟹行为观察',
        '观察小螃蟹的爬行方式、进食行为和对环境的反应。通过简单的实验了解螃蟹为什么横着走路，认识甲壳动物的身体结构与运动方式的关系。',
        v_author_id, v_sub_id, 2, 40, 'draft', '/projects/science_animals.webp',
        ARRAY['甲壳动物','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小螃蟹1～2只', 1),
        (v_project_id, '浅水盆', 2),
        (v_project_id, '小石子和细沙', 3),
        (v_project_id, '少量鱼肉或虾肉', 4),
        (v_project_id, '放大镜', 5),
        (v_project_id, '观察记录本', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '布置观察环境', '在浅水盆中铺一层细沙和小石子，加入少量水，模拟螃蟹的自然生活环境。', 1),
        (v_project_id, '观察身体结构', '用放大镜观察螃蟹的身体，数一数它有几条腿、几只螯，画出身体结构图。', 2),
        (v_project_id, '观察爬行方式', '轻轻把螃蟹放在平面上，观察它的爬行方向和腿的运动方式，记录它为什么横着走。', 3),
        (v_project_id, '进食观察', '在螃蟹面前放一小块鱼肉，观察它如何用螯夹取食物、如何送入口中。', 4),
        (v_project_id, '总结报告', '整理观察记录，画出螃蟹的运动示意图，写出甲壳动物的主要特征。', 5);

    -- ============================================
    -- 项目 13: 贝壳形状分类卡 ★2
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '贝壳形状分类卡',
        '收集几枚常见贝壳，按照形状、纹理和开口方式制作分类卡片。通过对比特征练习观察和分类。',
        v_author_id, v_sub_id, 2, 50, 'approved', '/projects/science_animals.webp',
        ARRAY['贝类','分类','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '各种贝壳10～20个', 1),
        (v_project_id, '放大镜', 2),
        (v_project_id, '直尺', 3),
        (v_project_id, '白纸或分类盒', 4),
        (v_project_id, '标签贴纸', 5),
        (v_project_id, '彩色铅笔', 6),
        (v_project_id, '贝类参考书或图鉴', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '收集贝壳', '在海边、河边或水族市场收集尽量多种类的贝壳，清洗干净晾干。', 1),
        (v_project_id, '观察与测量', '用放大镜观察每个贝壳的纹理、颜色和形状，用直尺量出长度和宽度，记录特征。', 2),
        (v_project_id, '分类整理', '按照你选定的标准（如单壳/双壳、螺旋形/扇形、大小）将贝壳分成不同组。', 3),
        (v_project_id, '制作标签', '为每个贝壳写标签，包括名称（如能辨认）、尺寸、采集地点和分类组别。', 4),
        (v_project_id, '制作展示板', '将分好类的贝壳粘贴或摆放在展示板上，配上手绘图和文字说明，制作成贝壳标本展。', 5);

    -- ============================================
    -- 项目 14: 蝴蝶生命周期记录 ★3
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '蝴蝶生命周期记录',
        '饲养菜粉蝶的幼虫（菜青虫），完整记录卵→幼虫→蛹→成虫的变态发育全过程。通过长期观察和绘图记录，深入理解昆虫完全变态发育的生命周期。',
        v_author_id, v_sub_id, 3, 60, 'draft', '/projects/science_animals.webp',
        ARRAY['昆虫','生命周期','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '菜青虫（菜粉蝶幼虫）3～5只', 1),
        (v_project_id, '透明饲养盒（带通气孔）', 2),
        (v_project_id, '新鲜菜叶（白菜或卷心菜）', 3),
        (v_project_id, '喷水壶', 4),
        (v_project_id, '放大镜', 5),
        (v_project_id, '观察记录本', 6),
        (v_project_id, '彩色铅笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '采集幼虫', '在菜地的白菜叶上寻找菜青虫和虫卵，连同叶片一起放入饲养盒。', 1),
        (v_project_id, '日常饲养', '每天更换新鲜菜叶，保持饲养盒内适当湿度，清理粪便和残叶。', 2),
        (v_project_id, '记录幼虫阶段', '每天观察幼虫的体长变化、蜕皮次数和进食量，用彩色铅笔画出不同龄期幼虫的样子。', 3),
        (v_project_id, '记录化蛹过程', '当幼虫停止进食并开始吐丝固定身体时，仔细观察化蛹过程，记录蛹的颜色和形状。', 4),
        (v_project_id, '记录羽化过程', '密切关注蛹的颜色变化，当蝴蝶破蛹而出时记录整个过程，观察翅膀展开的过程。', 5),
        (v_project_id, '制作生命周期图', '将所有观察记录和图画整理成一张完整的蝴蝶生命周期图，标注每个阶段的持续天数。', 6);

    -- ============================================
    -- 项目 15: 鱼鳍和鱼鳃结构识别 ★3
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '鱼鳍和鱼鳃结构识别',
        '观察鱼的鳍、鳃盖和身体侧线，画出结构示意图并标注功能。用一次明确的识别任务认识鱼类身体结构。',
        v_author_id, v_sub_id, 3, 60, 'approved', '/projects/science_animals.webp',
        ARRAY['鱼类','解剖','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '新鲜的完整鱼一条（如鲫鱼）', 1),
        (v_project_id, '解剖盘或大盘子', 2),
        (v_project_id, '镊子', 3),
        (v_project_id, '放大镜', 4),
        (v_project_id, '一次性手套', 5),
        (v_project_id, '观察记录本', 6),
        (v_project_id, '彩色铅笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '外形观察', '将鱼放在解剖盘上，观察鱼的整体外形：流线型身体、鳞片排列方向、各鳍的位置。', 1),
        (v_project_id, '细节记录', '用放大镜观察鳞片的结构、侧线的位置、鳃盖下的鳃丝颜色，画出详细的外形图并标注各部位名称。', 2),
        (v_project_id, '鳍的功能分析', '观察并记录背鳍、胸鳍、腹鳍、臀鳍和尾鳍的形状和大小，查阅资料了解每种鳍的功能。', 3),
        (v_project_id, '体表触感测试', '戴上手套，用手沿不同方向抚摸鱼体表面，感受鳞片方向和黏液层，思考这些特征如何帮助鱼在水中运动。', 4),
        (v_project_id, '绘制结构图', '画一幅完整的鱼体结构标注图，标出所有外部器官的名称和功能。', 5),
        (v_project_id, '撰写观察报告', '总结鱼类适应水中生活的身体特征，与陆地动物做简单对比。', 6);

    -- ============================================
    -- 项目 16: 鸟巢观察与记录 ★3
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '鸟巢观察与记录',
        '在春夏季节寻找鸟巢，从远处安全地观察鸟类的筑巢过程和育雏行为。记录鸟巢的位置、材料和结构，了解不同鸟类筑巢策略的差异。',
        v_author_id, v_sub_id, 3, 60, 'draft', '/projects/science_animals.webp',
        ARRAY['鸟类','筑巢','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '双筒望远镜', 1),
        (v_project_id, '观察记录本', 2),
        (v_project_id, '彩色铅笔', 3),
        (v_project_id, '相机（长焦镜头更佳）', 4),
        (v_project_id, '鸟类图鉴', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '寻找鸟巢', '在春天留意树上、屋檐下、灌木丛中频繁飞进飞出的鸟儿，顺着它们的路线找到鸟巢位置。', 1),
        (v_project_id, '远距离观察', '在不惊扰鸟类的距离（至少5米以外）用望远镜观察，记录鸟巢的位置高度、所在树种和朝向。', 2),
        (v_project_id, '记录筑巢材料', '观察亲鸟叼回的筑巢材料（树枝、草茎、泥土、羽毛等），推测鸟巢的结构组成。', 3),
        (v_project_id, '观察育雏行为', '记录亲鸟喂食幼鸟的频率和时间规律，观察雏鸟的成长变化。', 4),
        (v_project_id, '绘制观察日记', '将每次观察的内容画成图文日记，包括鸟巢的样子、亲鸟的行为和雏鸟的变化。', 5),
        (v_project_id, '总结鸟巢知识', '查阅资料对比不同鸟类的筑巢方式（杯状巢、洞巢、平台巢等），写成知识小报。', 6);

    -- ============================================
    -- 项目 17: 昆虫标本制作 ★3
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '昆虫标本制作',
        '收集自然死亡的昆虫，学习简单的标本制作技术，将昆虫标本整齐地固定在标本盒中并标注信息。了解昆虫的身体结构，体验科学标本制作的基本方法。',
        v_author_id, v_sub_id, 3, 90, 'approved', '/projects/science_animals.webp',
        ARRAY['昆虫','标本','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '自然死亡的昆虫若干', 1),
        (v_project_id, '泡沫板或软木板', 2),
        (v_project_id, '昆虫针（或大头针）', 3),
        (v_project_id, '镊子', 4),
        (v_project_id, '标本盒（可用鞋盒改造）', 5),
        (v_project_id, '标签纸', 6),
        (v_project_id, '放大镜', 7),
        (v_project_id, '白胶', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '收集昆虫', '在户外收集自然死亡的昆虫（路灯下、窗台上），选择身体完整的个体，注意不要伤害活体昆虫。', 1),
        (v_project_id, '软化处理', '如果昆虫已经干硬，放入密封盒中加湿纸巾软化1～2天，使肢体可以调整。', 2),
        (v_project_id, '展翅整姿', '用镊子小心展开昆虫的翅膀和足，用大头针在泡沫板上固定好姿态，保持对称。', 3),
        (v_project_id, '干燥定型', '将固定好的标本放在通风干燥处晾干约一周，让标本完全定型。', 4),
        (v_project_id, '制作标签', '为每个标本写标签，包括名称、采集日期、采集地点和采集人。', 5),
        (v_project_id, '装盒展示', '将干燥定型的标本固定在标本盒中，贴上标签，制作成整齐的昆虫标本展示盒。', 6);

    -- ============================================
    -- 项目 18: 水生生物观察 ★3
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '水生生物观察',
        '从池塘或小溪中采集水样，用放大镜和简易显微镜观察水中的各种微小生物。认识水蚤、水螅、水蜗牛等常见水生生物，了解淡水生态系统的多样性。',
        v_author_id, v_sub_id, 3, 60, 'draft', '/projects/science_animals.webp',
        ARRAY['水生动物','生态','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '取样瓶（带盖透明瓶）', 1),
        (v_project_id, '细网兜或纱布', 2),
        (v_project_id, '放大镜', 3),
        (v_project_id, '培养皿或白色浅盘', 4),
        (v_project_id, '吸管', 5),
        (v_project_id, '观察记录本', 6),
        (v_project_id, '彩色铅笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '采集水样', '在池塘、小溪或水沟边用取样瓶采集水样，同时用细网兜捞取水草和水底沉积物。', 1),
        (v_project_id, '肉眼初观', '将水样倒入白色浅盘中，在明亮的光线下用肉眼观察，寻找能看到的小生物。', 2),
        (v_project_id, '放大观察', '用吸管将发现的小生物转移到培养皿中，用放大镜仔细观察它们的外形和运动方式。', 3),
        (v_project_id, '绘图记录', '为每种发现的生物画出外形图，标注体长、颜色和运动特点。', 4),
        (v_project_id, '查阅辨认', '借助图鉴或网络资料，辨认发现的水生生物的名称和种类。', 5),
        (v_project_id, '总结生态关系', '讨论这些水生生物之间的食物链关系，画出简单的水塘食物网。观察结束后将生物送回采集地点。', 6);

    -- ============================================
    -- 项目 19: 鸟类迁徙追踪记录 ★4
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '鸟类迁徙追踪记录',
        '在春秋迁徙季节，通过长期定点观察和网络数据查询，记录候鸟经过本地的种类和时间。了解鸟类迁徙的原因和路线，学习使用观鸟数据平台。',
        v_author_id, v_sub_id, 4, 90, 'draft', '/projects/science_animals.webp',
        ARRAY['鸟类','迁徙','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '双筒望远镜', 1),
        (v_project_id, '鸟类图鉴', 2),
        (v_project_id, '观察记录本', 3),
        (v_project_id, '地图（本地及迁徙路线图）', 4),
        (v_project_id, '电脑或平板（查阅迁徙数据）', 5),
        (v_project_id, '彩色铅笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解迁徙知识', '阅读资料了解什么是候鸟、留鸟，为什么鸟类要迁徙，本地区常见的候鸟有哪些。', 1),
        (v_project_id, '制定观察计划', '选择公园湖边、湿地或农田等开阔地带作为观察点，制定每周至少两次的观察计划。', 2),
        (v_project_id, '定点观察记录', '每次观察时记录日期、天气、看到的鸟种、数量和行为（停歇、觅食或飞越）。', 3),
        (v_project_id, '查阅迁徙数据', '在观鸟平台上查询本地区的候鸟记录，与自己的观察结果做对比。', 4),
        (v_project_id, '绘制迁徙图', '在地图上标注本地观察到的候鸟种类，查阅它们的迁徙路线，画出迁徙路线示意图。', 5),
        (v_project_id, '撰写调查报告', '汇总所有数据，分析迁徙季节中鸟种组成的变化，写一份图文并茂的迁徙观察报告。', 6);

    -- ============================================
    -- 项目 20: 昆虫夜间观察 ★4
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '昆虫夜间观察',
        '利用灯光诱集的方法，在夏夜观察被光源吸引来的各种昆虫。比较不同颜色光源对昆虫的吸引效果，探究昆虫的趋光性，了解夜行性昆虫的多样性。',
        v_author_id, v_sub_id, 4, 90, 'draft', '/projects/science_animals.webp',
        ARRAY['昆虫','趋光性','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白色床单', 1),
        (v_project_id, '手电筒（白光和黄光各一）', 2),
        (v_project_id, '紫外灯（可选）', 3),
        (v_project_id, '透明观察盒', 4),
        (v_project_id, '放大镜', 5),
        (v_project_id, '观察记录本', 6),
        (v_project_id, '头灯', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备灯诱装置', '选择一个远离路灯的户外场地，将白色床单悬挂起来，在床单前方架设光源。', 1),
        (v_project_id, '开启灯光等待', '天黑后开启灯光，在旁边安静等候，昆虫通常在开灯后20～30分钟开始聚集。', 2),
        (v_project_id, '观察与采集', '用透明观察盒轻轻罩住感兴趣的昆虫进行近距离观察，用放大镜辨别特征。', 3),
        (v_project_id, '对比不同光源', '分别测试白光、黄光和紫外光对昆虫的吸引效果，记录每种光源吸引的昆虫种类和数量。', 4),
        (v_project_id, '数据分析', '将不同光源的吸引结果做成对比表格和柱状图，分析哪种光源吸引昆虫最多。', 5),
        (v_project_id, '撰写实验报告', '总结实验结果，解释昆虫趋光性的原因，讨论路灯对夜间昆虫的影响。', 6);

    -- ============================================
    -- 项目 21: 潮间带生物调查 ★4
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '潮间带生物调查',
        '在退潮时前往海边潮间带，系统调查不同潮位带的生物种类和分布规律。学习使用样方法进行简单的生态调查，了解潮间带生态系统的独特性。',
        v_author_id, v_sub_id, 4, 120, 'draft', '/projects/science_animals.webp',
        ARRAY['海洋生物','生态','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '方形框（50cm×50cm，可用PVC管制作）', 1),
        (v_project_id, '防水观察记录板', 2),
        (v_project_id, '防滑水鞋', 3),
        (v_project_id, '放大镜', 4),
        (v_project_id, '小铲子和镊子', 5),
        (v_project_id, '透明取样袋', 6),
        (v_project_id, '相机', 7),
        (v_project_id, '海洋生物图鉴', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '查询潮汐时间', '出发前查询当天的退潮时间，计划在低潮前1小时到达海边。', 1),
        (v_project_id, '设置样方', '在高潮带、中潮带和低潮带各选1～2个位置，放下方形框作为固定调查区域。', 2),
        (v_project_id, '记录生物种类', '在每个样方内仔细搜索，记录所有能看到的动物种类（螺类、蟹类、海葵、海星等）和数量。', 3),
        (v_project_id, '拍照存档', '为每个样方和发现的生物拍照，注意记录样方编号和位置信息。', 4),
        (v_project_id, '对比分析', '对比不同潮位带的生物组成差异，分析为什么某些生物只出现在特定潮位带。', 5),
        (v_project_id, '完成调查报告', '整理数据制作物种清单，画出潮间带生物分布示意图，撰写完整的调查报告。', 6);

    -- ============================================
    -- 项目 22: 动物足迹识别 ★4
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '动物足迹识别',
        '到公园、林地或泥地中寻找并记录动物留下的足迹和痕迹。学习制作足迹石膏模型，通过对比资料识别不同动物的足迹特征，锻炼野外观察能力。',
        v_author_id, v_sub_id, 4, 90, 'draft', '/projects/science_animals.webp',
        ARRAY['动物','野外观察','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '石膏粉', 1),
        (v_project_id, '水和搅拌容器', 2),
        (v_project_id, '硬纸板条（围模用）', 3),
        (v_project_id, '软毛刷', 4),
        (v_project_id, '直尺', 5),
        (v_project_id, '相机', 6),
        (v_project_id, '动物足迹参考图鉴', 7),
        (v_project_id, '观察记录本', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择搜索区域', '在雨后或清晨前往公园小径、河边泥地或林间小道，这些地方最容易发现动物足迹。', 1),
        (v_project_id, '寻找并记录足迹', '仔细搜索地面，发现足迹后先拍照，用直尺测量足迹的长宽，记录发现位置和周围环境。', 2),
        (v_project_id, '制作石膏模型', '用硬纸板条围住足迹，将搅拌好的石膏浆缓缓倒入，等待约30分钟凝固后小心取出。', 3),
        (v_project_id, '清理与辨认', '轻轻刷去模型上的泥土，对照足迹图鉴辨认是哪种动物留下的足迹。', 4),
        (v_project_id, '制作足迹图鉴', '将石膏模型拍照，配上动物名称、足迹尺寸和发现环境的文字说明，制作成动物足迹图鉴。', 5),
        (v_project_id, '分享展示', '在班级展示你的石膏模型和足迹图鉴，分享野外寻踪的经验和发现。', 6);

    -- ============================================
    -- 项目 23: 本地鸟类多样性调查 ★5
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '本地鸟类多样性调查',
        '运用样线法和样点法，对本地不同生境（城市公园、农田、湿地等）的鸟类多样性进行系统调查。学习使用科学调查方法和数据分析工具，完成一份正式的鸟类多样性调查报告。',
        v_author_id, v_sub_id, 5, 180, 'draft', '/projects/science_animals.webp',
        ARRAY['鸟类','生态调查','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '双筒望远镜', 1),
        (v_project_id, '鸟类图鉴（本地区）', 2),
        (v_project_id, '观察记录表（预先设计）', 3),
        (v_project_id, '地图和GPS定位工具', 4),
        (v_project_id, '计时器', 5),
        (v_project_id, '电脑（数据分析用）', 6),
        (v_project_id, '相机（长焦镜头）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选定调查区域', '在地图上选择3～4个不同类型的生境（如城市公园、河流湿地、居民小区、农田边缘），标注具体位置。', 1),
        (v_project_id, '设计调查方案', '为每个生境设计固定的样线路线（长约1公里），确定每次观察的时间和行走速度，设计统一的记录表格。', 2),
        (v_project_id, '开展野外调查', '在清晨（6:00-9:00）沿样线匀速行走，记录沿途看到和听到的所有鸟种、数量、行为和所在生境类型。', 3),
        (v_project_id, '重复调查', '对每个生境至少重复调查3次（不同日期），确保数据具有代表性。', 4),
        (v_project_id, '数据分析', '计算每个生境的鸟种数、个体总数和多样性指数，用表格和图表展示各生境的差异。', 5),
        (v_project_id, '撰写调查报告', '按照正式科学报告的格式，写出包括引言、方法、结果和讨论的完整鸟类多样性调查报告。', 6);

    -- ============================================
    -- 项目 24: 昆虫行为对比实验 ★5
    -- ============================================
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '昆虫行为对比实验',
        '选择两种常见昆虫（如蚂蚁与面包虫），设计对照实验比较它们对不同刺激（光照、温度、食物气味）的行为反应差异。学习实验设计、变量控制和数据分析的科学方法。',
        v_author_id, v_sub_id, 5, 120, 'approved', '/projects/science_animals.webp',
        ARRAY['昆虫','实验设计','科学','动物'], '科学'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '蚂蚁和面包虫各10只以上', 1),
        (v_project_id, '选择箱（两端明暗不同的长方形盒）', 2),
        (v_project_id, '手电筒', 3),
        (v_project_id, '温度计', 4),
        (v_project_id, '不同食物样本（糖水、醋、果汁）', 5),
        (v_project_id, '棉签', 6),
        (v_project_id, '计时器', 7),
        (v_project_id, '观察记录本和方格纸', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '明确研究问题', '提出你想探究的问题，例如"蚂蚁和面包虫对光照的反应是否不同？"确定自变量、因变量和控制变量。', 1),
        (v_project_id, '设计实验方案', '制作选择箱：将长方形盒一端遮光、一端透光。设计对照组和实验组，每组至少重复5次实验。', 2),
        (v_project_id, '趋光性实验', '分别将蚂蚁和面包虫放入选择箱中央，记录1分钟后它们停留在明亮端还是黑暗端的数量。', 3),
        (v_project_id, '食物偏好实验', '在盒子不同角落放置蘸有糖水、醋和清水的棉签，记录两种昆虫分别最先趋向哪种气味。', 4),
        (v_project_id, '数据整理与分析', '将所有实验数据整理成表格，计算每种反应的百分比，用柱状图和饼图展示两种昆虫的行为差异。', 5),
        (v_project_id, '撰写实验报告', '按"提出问题→作出假设→实验设计→结果分析→结论"的格式写出完整的实验报告，讨论实验结果的意义。', 6);

END $$;
