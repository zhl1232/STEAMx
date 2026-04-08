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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '绘画' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 绘画'; END IF;

    -- Project 1: 蔬菜印章画
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('蔬菜印章画', '把蔬菜横切面蘸上颜料，在纸上印出各种有趣的图案。不同蔬菜的截面纹理各不相同，可以组合出独一无二的版画作品。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/art_painting.webp', ARRAY['版画','色彩','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '各种蔬菜（青椒、莲藕、芹菜根、秋葵等）', 1),
        (v_project_id, '水粉颜料或丙烯颜料', 2),
        (v_project_id, '调色盘或一次性纸盘', 3),
        (v_project_id, '白色卡纸', 4),
        (v_project_id, '菜刀（需成年人协助）', 5),
        (v_project_id, '旧报纸（铺桌面防污）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备蔬菜印章', '请成年人将蔬菜横切或纵切，露出横截面纹理，用纸巾吸干水分。', 1),
        (v_project_id, '调配颜料', '在调色盘中倒入不同颜色的颜料，适当加水调到不稀不稠的程度。', 2),
        (v_project_id, '蘸取印制', '将蔬菜截面均匀蘸上颜料，轻轻按压在卡纸上，稳住几秒后提起。', 3),
        (v_project_id, '自由创作', '用不同蔬菜和颜色组合排列，创作花朵、动物或抽象图案。', 4),
        (v_project_id, '展示与分享', '晾干作品后为画面取一个名字，和家人分享你的蔬菜版画创作。', 5);

    -- Project 2: 手指画创作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('手指画创作', '用手指蘸取颜料直接在纸上涂抹和点画，感受色彩与手指触感的结合。这是最原始也是最自由的绘画方式，非常适合激发参与者的创造力和色彩感知。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/art_painting.webp', ARRAY['色彩','涂鸦','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '安全手指画颜料（多色）', 1),
        (v_project_id, '厚卡纸或水彩纸', 2),
        (v_project_id, '调色盘', 3),
        (v_project_id, '湿巾或湿毛巾', 4),
        (v_project_id, '围裙或旧衣服', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备工作', '穿好围裙，在桌上铺好旧报纸，将颜料分别倒入调色盘中。', 1),
        (v_project_id, '认识色彩', '先用手指分别蘸取红黄蓝三种基本色，在纸上试画，感受颜料的质感。', 2),
        (v_project_id, '混色探索', '将两种颜色用手指直接在纸上混合，观察能调出什么新颜色。', 3),
        (v_project_id, '自由创作', '用手指点画小动物、用手掌印出大树、用指尖画出细节花纹，尽情发挥想象力。', 4);

    -- Project 3: 树叶拓印画
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('树叶拓印画', '收集各种形状的树叶，用颜料将叶脉纹理拓印到纸上，制作一幅自然之美的作品。在创作中感受大自然的丰富形态，学习拓印这种古老的艺术技法。', v_author_id, v_sub_id, 1, 30, 'approved', '/projects/art_painting.webp', ARRAY['拓印','自然','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '各种形状的新鲜树叶', 1),
        (v_project_id, '水粉颜料或丙烯颜料', 2),
        (v_project_id, '小刷子或海绵', 3),
        (v_project_id, '白色卡纸', 4),
        (v_project_id, '旧报纸', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '采集树叶', '到户外收集不同形状和大小的树叶，选择叶脉清晰、表面平整的叶子效果最佳。', 1),
        (v_project_id, '涂抹颜料', '在树叶叶脉突出的背面均匀涂上颜料，注意不要涂得太厚。', 2),
        (v_project_id, '拓印成画', '将涂好颜料的叶面朝下放在卡纸上，用手轻轻按压叶子的每个部分，然后小心揭起。', 3),
        (v_project_id, '组合构图', '用不同大小和颜色的叶子拓印出树木、花朵或抽象风景画面。', 4),
        (v_project_id, '添加细节', '用画笔添加树干、花茎或小昆虫等细节，完善整幅作品。', 5);

    -- Project 4: 吹画艺术
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('吹画艺术', '将墨水或颜料滴在纸上，用嘴巴或吸管吹散，形成随机而富有动感的图案。每一次吹画都是独一无二的，非常适合体验偶然性在艺术创作中的魅力。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/art_painting.webp', ARRAY['随机','墨水','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '墨水或稀释的水彩颜料', 1),
        (v_project_id, '吸管', 2),
        (v_project_id, '白色卡纸', 3),
        (v_project_id, '滴管或小勺', 4),
        (v_project_id, '旧报纸（铺桌面）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '滴墨', '用滴管将墨水或稀释颜料滴在卡纸上，形成几个大小不一的墨滴。', 1),
        (v_project_id, '吹散墨滴', '用吸管对准墨滴轻轻吹气，将墨水向不同方向吹散，形成树枝般的纹路。', 2),
        (v_project_id, '叠加色彩', '换用不同颜色的墨水继续滴和吹，让色彩交织叠加产生丰富的效果。', 3),
        (v_project_id, '联想补画', '观察吹画形成的随机图案，联想它像什么，用细笔添加眼睛、花朵等细节完成作品。', 4);

    -- Project 5: 自然色彩采集本
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自然色彩采集本', '带上画纸走进大自然，用颜料调配出与花朵、泥土、天空相匹配的颜色，制作一本自然色卡。这个项目训练参与者对色彩的敏锐观察力和精确调色能力。', v_author_id, v_sub_id, 2, 40, 'approved', '/projects/art_painting.webp', ARRAY['色彩','观察','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '水彩颜料套装', 1),
        (v_project_id, '水彩纸或厚卡纸', 2),
        (v_project_id, '调色盘', 3),
        (v_project_id, '水杯和画笔', 4),
        (v_project_id, '双面胶', 5),
        (v_project_id, '铅笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '户外寻色', '去公园或花园里仔细观察，收集花瓣、树皮、石头等不同颜色的自然物。', 1),
        (v_project_id, '观察比对', '将收集到的自然物放在纸上，仔细观察它的颜色包含哪些色调。', 2),
        (v_project_id, '调色匹配', '用水彩颜料反复调配，直到调出与自然物尽量一致的颜色，涂在旁边对比。', 3),
        (v_project_id, '制作色卡', '将调好的颜色整齐地涂在卡纸上，旁边粘贴对应的自然物或写上名称。', 4),
        (v_project_id, '装订成册', '将所有色卡按色系整理排列，装订成一本属于自己的自然色彩采集本。', 5);

    -- Project 6: 对称蝴蝶画
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('对称蝴蝶画', '在纸的一半涂上颜料后对折按压，打开后得到一只色彩绚丽的对称蝴蝶。这种印染技法让参与者直观理解对称的数学概念，同时享受色彩融合的惊喜效果。', v_author_id, v_sub_id, 2, 25, 'approved', '/projects/art_painting.webp', ARRAY['对称','印染','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白色卡纸', 1),
        (v_project_id, '水粉颜料（多种鲜艳色）', 2),
        (v_project_id, '画笔', 3),
        (v_project_id, '铅笔', 4),
        (v_project_id, '黑色记号笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '折出中线', '将卡纸对折后展开，折痕就是蝴蝶身体的对称轴线。', 1),
        (v_project_id, '涂抹颜料', '在折痕的一侧画出蝴蝶翅膀的半边轮廓，在翅膀内大胆涂上色彩鲜艳的颜料。', 2),
        (v_project_id, '对折印染', '趁颜料未干时将纸沿折痕对折，用手均匀按压，让颜料充分转印到另一半。', 3),
        (v_project_id, '揭开欣赏', '小心展开纸张，一只色彩对称的蝴蝶便出现了，观察两侧的图案是否完全一样。', 4),
        (v_project_id, '完善细节', '用黑色记号笔画出蝴蝶的身体、触角和翅膀边缘，让蝴蝶更加生动。', 5);

    -- Project 7: 点彩画入门
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('点彩画入门', '学习印象派大师修拉的点彩技法，用一个个小色点拼出完整的画面。当退后几步观看时，各色点会在眼中自动混合成丰富的色调，非常神奇。', v_author_id, v_sub_id, 2, 35, 'approved', '/projects/art_painting.webp', ARRAY['点彩','色彩混合','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '棉签或圆头画笔', 1),
        (v_project_id, '丙烯颜料或水粉颜料', 2),
        (v_project_id, '厚卡纸或画布板', 3),
        (v_project_id, '调色盘', 4),
        (v_project_id, '铅笔', 5),
        (v_project_id, '参考图片（简单水果或风景）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '铅笔起稿', '用铅笔在画纸上轻轻勾出简单的轮廓，比如一个苹果或一棵树。', 1),
        (v_project_id, '点彩练习', '用棉签蘸取颜料在纸的空白处练习点画，体会用圆点铺色的节奏。', 2),
        (v_project_id, '逐区填色', '从画面一个区域开始，用相近颜色的小圆点密集排列填满，点与点之间留有微小间隙。', 3),
        (v_project_id, '色彩混合', '在两种颜色的交界处穿插点上两种色的圆点，退后观看会发现它们自然融合成了新的色调。', 4),
        (v_project_id, '完成与欣赏', '完成全部填色后退后两三步观看整体效果，感受色点在视觉中融合的奇妙。', 5);

    -- Project 8: 水彩渐变天空
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('水彩渐变天空', '用水彩的湿画法画出从深蓝到橙红的渐变天空，表现日出或日落的壮美。参与者将学会控制水分和色彩流动，掌握水彩画中最基本也最迷人的渐变技法。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/art_painting.webp', ARRAY['水彩','渐变','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '水彩颜料', 1),
        (v_project_id, '水彩纸（200克以上）', 2),
        (v_project_id, '大号扁头水彩笔', 3),
        (v_project_id, '水杯两个（清水和涮笔）', 4),
        (v_project_id, '纸胶带', 5),
        (v_project_id, '喷壶', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '固定纸张', '用纸胶带将水彩纸四边贴在桌面或画板上，防止纸张受潮变形。', 1),
        (v_project_id, '打湿纸面', '用喷壶或大笔蘸清水将整张纸均匀打湿，保持湿润但不积水。', 2),
        (v_project_id, '铺设天空色', '从纸的顶部开始涂深蓝色，大笔横向平涂，逐渐向下减少蓝色、增加紫色。', 3),
        (v_project_id, '过渡暖色', '在中间区域用橙色和粉色衔接，让冷暖色在湿纸上自然融合渗透。', 4),
        (v_project_id, '点缀云彩', '趁纸面未干，用干净画笔吸起部分颜料留出白色区域作为云朵，或点入少许白色。', 5),
        (v_project_id, '添加剪影', '待天空完全干透后，用深色颜料在底部画出建筑或树木的剪影，衬托天空的绚丽。', 6);

    -- Project 9: 透视法画街景
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('透视法画街景', '学习一点透视的基本原理，画出一条向远方延伸的街道。通过实际绘画理解近大远小的空间规律，让平面的画纸呈现出立体的纵深感。', v_author_id, v_sub_id, 3, 40, 'approved', '/projects/art_painting.webp', ARRAY['透视','空间感','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '素描纸', 1),
        (v_project_id, '铅笔和橡皮', 2),
        (v_project_id, '直尺', 3),
        (v_project_id, '彩色铅笔或马克笔', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '确定消失点', '在纸面中央偏上的位置标一个点作为消失点，画一条水平线作为视平线。', 1),
        (v_project_id, '画出道路', '从纸的底边两侧各引一条线到消失点，形成向远处收窄的街道。', 2),
        (v_project_id, '添加建筑', '在道路两侧画出高矮不一的建筑物，注意越远越小，所有纵深线都指向消失点。', 3),
        (v_project_id, '画出细节', '为建筑添加门窗、招牌，在街道上画出路灯、行人和车辆，越远越小。', 4),
        (v_project_id, '上色完成', '用彩色铅笔或马克笔为画面上色，近处颜色鲜艳、远处颜色灰淡，增强空间感。', 5);

    -- Project 10: 自画像创作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自画像创作', '对着镜子仔细观察自己的面部特征，学习五官比例和位置关系，画出一幅属于自己的肖像画。自画像是训练观察力和表现力的经典绘画练习。', v_author_id, v_sub_id, 3, 45, 'approved', '/projects/art_painting.webp', ARRAY['肖像','比例','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '素描纸', 1),
        (v_project_id, '铅笔（HB和2B）', 2),
        (v_project_id, '橡皮', 3),
        (v_project_id, '镜子', 4),
        (v_project_id, '彩色铅笔（可选）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习比例', '了解面部基本比例：三庭五眼——脸部纵向三等分，横向约五个眼睛宽度。', 1),
        (v_project_id, '画出轮廓', '用铅笔轻轻画一个鸡蛋形的脸部轮廓，画出横竖中线辅助定位五官。', 2),
        (v_project_id, '定位五官', '对着镜子观察，在辅助线上标出眼睛、鼻子、嘴巴的位置，注意大小和间距。', 3),
        (v_project_id, '刻画特征', '仔细观察自己的特征——眉毛的弧度、鼻子的形状、嘴唇的厚薄，如实画出来。', 4),
        (v_project_id, '添加头发与细节', '画出自己的发型，添加耳朵和脖子，擦掉辅助线，可以用彩色铅笔上色。', 5);

    -- Project 11: 水彩植物写生
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('水彩植物写生', '选一株真实的花草进行观察写生，用水彩表现植物的形态和色彩变化。写生训练参与者"看到什么画什么"的观察能力，是绘画进阶的重要基础练习。', v_author_id, v_sub_id, 3, 50, 'approved', '/projects/art_painting.webp', ARRAY['水彩','写生','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '水彩颜料', 1),
        (v_project_id, '水彩纸', 2),
        (v_project_id, '圆头水彩笔（大中小各一支）', 3),
        (v_project_id, '铅笔和橡皮', 4),
        (v_project_id, '水杯', 5),
        (v_project_id, '一盆真实的植物或鲜花', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '仔细观察', '从不同角度观察植物，注意叶片的形状、花瓣的层次和颜色的深浅变化。', 1),
        (v_project_id, '铅笔起稿', '用铅笔轻轻画出植物的大致轮廓和主要枝叶的走向，不需要太多细节。', 2),
        (v_project_id, '铺设底色', '先用大笔蘸浅色为叶子和花朵铺上第一层底色，保持颜色通透。', 3),
        (v_project_id, '层层叠加', '等底色半干时叠加第二层颜色，表现叶脉、花瓣阴影等较深的部分。', 4),
        (v_project_id, '细节刻画', '用小笔画出叶片的细微纹理、花蕊的形态和茎秆的质感。', 5),
        (v_project_id, '调整完善', '退后观察整体效果，补充不够深的暗部、提亮高光区域，完成写生作品。', 6);

    -- Project 12: 光影素描入门
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('光影素描入门', '通过画一个简单的球体或苹果，学习用铅笔表现光影明暗的基本方法。理解亮面、暗面、投影和反光的关系，这是素描绘画的核心基础技能。', v_author_id, v_sub_id, 3, 45, 'approved', '/projects/art_painting.webp', ARRAY['素描','明暗','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '素描纸', 1),
        (v_project_id, '铅笔套装（HB、2B、4B、6B）', 2),
        (v_project_id, '橡皮和可塑橡皮', 3),
        (v_project_id, '一个白色球体或苹果', 4),
        (v_project_id, '台灯（做定向光源）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '布置静物', '将球体放在桌上，用台灯从一侧照射，观察明暗分界线、投影和反光区域。', 1),
        (v_project_id, '画出轮廓', '用HB铅笔轻轻画出物体的外轮廓，标出明暗分界线的大致位置。', 2),
        (v_project_id, '铺设暗部', '用2B铅笔从暗面开始排线，线条方向一致，均匀铺出暗部的基本色调。', 3),
        (v_project_id, '加深层次', '用4B或6B铅笔加深最暗的部分，特别是明暗分界线附近和投影的根部。', 4),
        (v_project_id, '表现过渡', '在明暗交界处用不同力度的排线实现柔和过渡，让球体看起来圆润立体。', 5),
        (v_project_id, '提亮高光', '用可塑橡皮轻轻擦出高光点和反光区域，让画面产生光泽感。', 6);

    -- Project 13: 一点透视建筑画
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('一点透视建筑画', '运用一点透视法精确绘制建筑物的室内或室外空间，表现真实的空间纵深。在掌握透视线汇聚原理的基础上，创作出具有建筑感的完整画面。', v_author_id, v_sub_id, 4, 50, 'approved', '/projects/art_painting.webp', ARRAY['透视','建筑','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '素描纸或制图纸', 1),
        (v_project_id, '铅笔（HB和2B）', 2),
        (v_project_id, '直尺和三角板', 3),
        (v_project_id, '橡皮', 4),
        (v_project_id, '马克笔或彩铅（上色用）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '建立透视框架', '在纸面上画出视平线，确定一个消失点，从消失点向四周发散出多条辅助透视线。', 1),
        (v_project_id, '绘制主体建筑', '选择绘制一间房间的内部视角或一栋建筑的正面，用直尺沿透视线画出墙面、地面和天花板。', 2),
        (v_project_id, '添加结构细节', '画出窗户、门框、柱子等建筑元素，所有纵深方向的线条都严格汇聚于消失点。', 3),
        (v_project_id, '绘制装饰物', '在空间中添加家具、盆栽、画框等物件，注意它们的大小随距离而变化。', 4),
        (v_project_id, '上色与质感', '用马克笔或彩铅上色，通过色彩的深浅变化增强空间的前后层次。', 5),
        (v_project_id, '检查透视', '最后用直尺复查所有纵深线是否准确指向消失点，修正偏差后完成作品。', 6);

    -- Project 14: 油画棒风景创作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('油画棒风景创作', '用油画棒丰富的色彩和厚重的质感，描绘一幅充满阳光的风景画。学习油画棒的叠色、混色和刮画技法，创作出色彩浓郁、层次丰富的风景作品。', v_author_id, v_sub_id, 4, 50, 'approved', '/projects/art_painting.webp', ARRAY['油画棒','风景','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '油画棒（24色或36色）', 1),
        (v_project_id, '厚卡纸或油画棒专用纸', 2),
        (v_project_id, '铅笔', 3),
        (v_project_id, '刮刀或竹签（刮画用）', 4),
        (v_project_id, '纸巾（混色用）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '构图起稿', '用铅笔轻轻画出风景的基本构图：天空、远山、近处的草地和树木。', 1),
        (v_project_id, '铺设天空', '用蓝色和白色油画棒大面积涂抹天空，用纸巾轻轻揉擦使颜色均匀柔和。', 2),
        (v_project_id, '绘制远景', '用灰蓝和浅紫色画远处的山峦，颜色要淡，表现空气透视的效果。', 3),
        (v_project_id, '丰富中景', '用黄绿、深绿交替涂抹草地和树木，颜色可以叠加混合增加层次。', 4),
        (v_project_id, '刻画近景', '用鲜艳浓重的颜色画出近处的花草和石头细节，可以用刮刀刮出草叶纹理。', 5),
        (v_project_id, '统一调整', '退后审视整体画面，补充不足的色彩，用刮画技法添加光线和纹理效果。', 6);

    -- Project 15: 色彩搭配与情绪表达
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('色彩搭配与情绪表达', '探索色彩与情绪的对应关系，用不同的色彩组合表达快乐、平静、忧伤等情感。理解色彩理论中的冷暖色调、互补色与类似色搭配，创作情感表达的抽象画。', v_author_id, v_sub_id, 4, 45, 'approved', '/projects/art_painting.webp', ARRAY['色彩理论','表达','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '丙烯颜料或水粉颜料', 1),
        (v_project_id, '画布板或厚卡纸（多张）', 2),
        (v_project_id, '画笔和调色盘', 3),
        (v_project_id, '色轮图（参考）', 4),
        (v_project_id, '水杯', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识色轮', '观察色轮图，了解原色、间色、互补色和类似色的位置关系。', 1),
        (v_project_id, '色彩联想', '闭上眼想象"快乐""平静""愤怒""忧伤"的感觉，思考每种情绪让你联想到什么颜色。', 2),
        (v_project_id, '快乐之画', '选用暖色调的鲜艳色彩（如黄、橙、亮粉），用自由奔放的笔触画一幅抽象画。', 3),
        (v_project_id, '平静之画', '选用蓝绿冷色调的柔和色彩，用平稳流畅的线条画第二幅抽象画。', 4),
        (v_project_id, '对比欣赏', '将不同情绪的画作放在一起对比，讨论色彩如何影响观者的情感感受。', 5),
        (v_project_id, '自由表达', '选择今天你最真实的心情，用你认为最合适的色彩搭配创作一幅情绪表达画。', 6);

    -- Project 16: 动物解剖素描
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('动物解剖素描', '学习动物的基本骨骼和肌肉结构，通过理解内部构造来画出更准确生动的动物形象。从简单的几何形体出发逐步构建动物身体，是专业动物画的入门训练。', v_author_id, v_sub_id, 4, 55, 'approved', '/projects/art_painting.webp', ARRAY['结构素描','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '素描纸', 1),
        (v_project_id, '铅笔套装（HB、2B、4B）', 2),
        (v_project_id, '橡皮', 3),
        (v_project_id, '动物照片或图鉴', 4),
        (v_project_id, '动物骨骼结构参考图', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识结构', '参考动物骨骼图，了解猫或狗等常见动物的骨骼框架和主要关节位置。', 1),
        (v_project_id, '几何概括', '用圆形、椭圆形和长方形等简单几何体概括出动物的头部、胸腔和臀部。', 2),
        (v_project_id, '连接关节', '用线条连接各几何体，表示脊柱、四肢和关节的连接关系，形成骨架草图。', 3),
        (v_project_id, '填充肌肉', '在骨架基础上画出肌肉的体积感，让身体各部分变得饱满且有弹性。', 4),
        (v_project_id, '勾勒外轮廓', '沿着肌肉形态画出动物的外部轮廓线和皮毛纹理，擦掉内部辅助线。', 5),
        (v_project_id, '添加细节', '刻画眼睛、鼻子、耳朵和爪子等细节，用不同硬度的铅笔表现毛发的质感。', 6);

    -- Project 17: 两点透视城市画
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('两点透视城市画', '学习两点透视法绘制复杂的城市建筑群，从街角视角展现高楼大厦的立体感和纵深感。两点透视是绘制建筑和场景的核心技法，需要精准的线条控制和空间理解。', v_author_id, v_sub_id, 5, 60, 'approved', '/projects/art_painting.webp', ARRAY['透视','复杂场景','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大幅素描纸或制图纸', 1),
        (v_project_id, '铅笔（HB和2B）', 2),
        (v_project_id, '长直尺（30厘米以上）', 3),
        (v_project_id, '三角板', 4),
        (v_project_id, '橡皮', 5),
        (v_project_id, '马克笔或针管笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '建立透视系统', '画出视平线，在视平线两端各设一个消失点，两点间距要足够远以避免画面变形。', 1),
        (v_project_id, '画出第一栋建筑', '在两个消失点之间画一条竖直线作为建筑的近边棱，从棱的上下端向两个消失点引线，确定建筑的两个可见面。', 2),
        (v_project_id, '扩展建筑群', '在第一栋建筑周围添加更多高矮不一的建筑，所有水平线都严格指向左右两个消失点。', 3),
        (v_project_id, '丰富城市元素', '添加道路、人行道、路灯、车辆和行人等城市元素，注意透视的一致性。', 4),
        (v_project_id, '细节与质感', '为建筑画出窗户、广告牌、空调外机等细节，用不同线条密度表现不同材质。', 5),
        (v_project_id, '描线与阴影', '用针管笔或马克笔描出主要线条，添加光影效果，让城市画面更加真实有力。', 6);

    -- Project 18: 水彩人物速写
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('水彩人物速写', '用水彩快速捕捉人物的动态和神情，学习用洗练的笔触表现人体比例和动作。水彩速写要求在短时间内抓住人物的主要特征，是训练绘画概括能力的高级练习。', v_author_id, v_sub_id, 5, 55, 'approved', '/projects/art_painting.webp', ARRAY['水彩','人物','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '水彩颜料', 1),
        (v_project_id, '水彩纸（多张，可裁成小幅）', 2),
        (v_project_id, '圆头水彩笔（中号和小号）', 3),
        (v_project_id, '铅笔', 4),
        (v_project_id, '水杯', 5),
        (v_project_id, '人物照片或请家人做模特', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '人体比例学习', '了解人体基本比例：成人约7-8个头高，不同成长阶段的人体比例会有所差异，学会用头部大小衡量全身比例。', 1),
        (v_project_id, '动态线练习', '快速画出人物的动态线——从头顶到脚底的一条主要曲线，抓住姿态的核心动势。', 2),
        (v_project_id, '铅笔速写', '用铅笔在3分钟内快速勾出人物的大致轮廓和主要体块关系，不拘泥于细节。', 3),
        (v_project_id, '水彩铺色', '用大笔蘸取肤色为面部和手臂铺底色，趁湿加入衣服的主要颜色，让色彩自然渗透。', 4),
        (v_project_id, '强化特征', '趁半干时用浓色点出五官、头发和衣服的褶皱，笔触果断不犹豫。', 5),
        (v_project_id, '多幅练习', '用不同姿态的照片重复练习，每幅限时15分钟，通过大量速写提高概括能力。', 6);

    -- Project 19: 综合材料拼贴画
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('综合材料拼贴画', '将绘画与多种材料拼贴相结合，用布料、纸张、毛线、纽扣等创作一幅有丰富质感的综合艺术作品。打破单一绘画手法的局限，探索材料的无限创意可能。', v_author_id, v_sub_id, 5, 60, 'approved', '/projects/art_painting.webp', ARRAY['综合材料','创意','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '厚画板或硬卡纸（底板）', 1),
        (v_project_id, '丙烯颜料和画笔', 2),
        (v_project_id, '旧杂志、报纸、彩纸', 3),
        (v_project_id, '布料碎片、毛线、麻绳', 4),
        (v_project_id, '纽扣、珠子、小木片', 5),
        (v_project_id, '白乳胶和剪刀', 6),
        (v_project_id, '铅笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '确定主题', '选择一个创作主题，如"海底世界""梦中花园"或"城市夜景"，用铅笔在底板上画出构图草稿。', 1),
        (v_project_id, '绘制背景', '用丙烯颜料为画面铺设背景色调，可以是渐变色或纹理效果。', 2),
        (v_project_id, '剪裁拼贴', '从杂志中剪出需要的图案，用彩纸剪出形状，将布料裁成合适大小。', 3),
        (v_project_id, '层层粘贴', '按照从远到近、从大到小的顺序将材料逐层粘贴到画面上，注意疏密节奏。', 4),
        (v_project_id, '添加立体元素', '用纽扣做花朵、毛线做头发、麻绳做边框等，让画面产生丰富的触感和立体层次。', 5),
        (v_project_id, '绘画点睛', '最后用画笔添加绘画部分，如人物的表情、文字或装饰线条，统一整体风格。', 6);

    -- Project 20: 连环画创作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('连环画创作', '构思一个简短的故事，用连续多幅画面来讲述，学习叙事绘画的分镜技巧。连环画创作需要综合运用构图、人物设计、场景绘制和故事节奏等多种能力，是绘画的高级综合训练。', v_author_id, v_sub_id, 5, 90, 'approved', '/projects/art_painting.webp', ARRAY['叙事','分镜','艺术','绘画'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '素描纸或漫画原稿纸', 1),
        (v_project_id, '铅笔和橡皮', 2),
        (v_project_id, '针管笔或签字笔', 3),
        (v_project_id, '直尺', 4),
        (v_project_id, '彩色铅笔或马克笔', 5),
        (v_project_id, '订书机（装订用）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '故事构思', '想一个有起因、经过和结果的简短故事，写出6-8个关键情节点。', 1),
        (v_project_id, '角色设计', '设计故事的主要角色，画出角色的正面、侧面造型，确定服装和标志性特征。', 2),
        (v_project_id, '分镜草稿', '用直尺在纸上画出格子，将每个情节分配到对应的格子中，草稿画出每格的构图。', 3),
        (v_project_id, '铅笔正稿', '在正式纸张上仔细画出每一格的画面，注意镜头远近变化和人物表情动作。', 4),
        (v_project_id, '描线上色', '用针管笔描出主要线条，添加对话气泡和文字，用彩色铅笔或马克笔上色。', 5),
        (v_project_id, '装订成册', '将所有页面按故事顺序排列，设计一个封面，装订成一本完整的连环画小册子。', 6);

END $$;
