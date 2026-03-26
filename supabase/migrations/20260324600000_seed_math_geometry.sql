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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '几何探索' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 几何探索'; END IF;

    -- Project 1: 对称剪纸图案
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('对称剪纸图案', '将纸张对折后剪出图案，展开就能得到完美的对称图形。孩子在剪纸过程中直观感受对称轴的概念，发现折叠次数越多，展开后的对称图案越复杂美丽。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/sensory_box.webp', ARRAY['对称','剪纸','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '彩色正方形纸若干', 1),
        (v_project_id, '剪刀', 2),
        (v_project_id, '铅笔', 3),
        (v_project_id, '白纸（用于粘贴展示）', 4),
        (v_project_id, '胶棒', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识对称', '拿一张纸对折，沿折线剪出半个爱心，展开后观察得到完整爱心，理解对称轴的含义。', 1),
        (v_project_id, '单轴对称剪纸', '将纸对折一次，用铅笔画出半边图案（如蝴蝶、树叶），沿线剪下再展开，欣赏对称图形。', 2),
        (v_project_id, '多轴对称挑战', '将纸连续对折两次或三次后剪出图案，展开观察出现四重或八重对称的效果。', 3),
        (v_project_id, '创作窗花', '将正方形纸沿对角线和中线反复对折，剪出复杂镂空图案，展开后就是一幅漂亮的窗花。', 4),
        (v_project_id, '展示与总结', '将所有作品粘贴在白纸上，标出每个图案的对称轴数量，讨论对称在自然界和建筑中的美。', 5);

    -- Project 2: 七巧板拼图
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('七巧板拼图', '用七块简单的几何板拼出各种有趣的图形，从动物到建筑无所不能。七巧板是中国传统益智玩具，孩子在拼摆中锻炼空间想象力，认识三角形、正方形和平行四边形的组合关系。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/sensory_box.webp', ARRAY['图形组合','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬卡纸一张', 1),
        (v_project_id, '直尺', 2),
        (v_project_id, '铅笔', 3),
        (v_project_id, '剪刀', 4),
        (v_project_id, '彩色笔或颜料', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '画出七巧板', '在硬卡纸上画一个正方形，按照七巧板的标准分割线画出五个三角形、一个正方形和一个平行四边形。', 1),
        (v_project_id, '裁剪上色', '沿线剪出七块板，用不同颜色的彩笔为每块板涂上颜色，便于区分。', 2),
        (v_project_id, '还原正方形', '先尝试把七块板重新拼回原来的正方形，这是最基础的挑战。', 3),
        (v_project_id, '拼出图案', '根据图样卡或自由发挥，用七块板拼出小猫、房子、小船等各种有趣的图案。', 4),
        (v_project_id, '创造与记录', '发挥想象力创造新图案，将成功的拼法描在纸上记录下来，和家人分享你的作品。', 5);

    -- Project 3: 找找生活中的几何
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('找找生活中的几何', '带着"几何之眼"在家里和户外寻找各种几何图形，记录它们藏在哪里。孩子将惊喜地发现圆形、三角形、长方形无处不在，从窗户到车轮，从蜂巢到路标，几何就在身边。', v_author_id, v_sub_id, 1, 30, 'approved', '/projects/sensory_box.webp', ARRAY['几何','观察','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '记录本', 1),
        (v_project_id, '彩色铅笔', 2),
        (v_project_id, '手机或相机（可选）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '室内寻宝', '在家中寻找各种几何图形：窗户是什么形状？钟面是什么形状？把找到的图形画在记录本上。', 1),
        (v_project_id, '户外探索', '到户外散步，观察建筑、路标、井盖、花朵中隐藏的几何图形，用手机拍照或速写记录。', 2),
        (v_project_id, '分类整理', '将找到的图形按类别整理：圆形、三角形、四边形、多边形等，统计每种图形出现的次数。', 3),
        (v_project_id, '制作几何图鉴', '选出最有趣的发现，配上图画和文字说明，制作一本属于自己的"生活几何图鉴"。', 4);

    -- Project 4: 用积木搭几何体
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('用积木搭几何体', '用积木搭建正方体、长方体、三棱柱等基本几何体，从不同角度观察它们的形状。孩子通过动手搭建获得对立体图形的直觉认识，学会数面、棱和顶点的数量。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/sensory_box.webp', ARRAY['立体图形','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '积木或方块若干', 1),
        (v_project_id, '橡皮泥', 2),
        (v_project_id, '牙签或竹签', 3),
        (v_project_id, '记录本和铅笔', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建基本体', '用积木搭出正方体和长方体，数一数它们各有几个面、几条棱、几个顶点。', 1),
        (v_project_id, '制作棱柱', '用橡皮泥做顶点、牙签做棱，搭出三棱柱和四棱柱的骨架模型，感受立体结构。', 2),
        (v_project_id, '多角度观察', '从正面、侧面和上方分别观察同一个几何体，画出每个角度看到的平面图形。', 3),
        (v_project_id, '搭建挑战', '尝试用积木搭出金字塔（四棱锥）形状，讨论它与长方体在面和棱上的不同之处。', 4),
        (v_project_id, '记录与比较', '把每种几何体的面数、棱数和顶点数记录在表格里，看看能否发现数量之间的规律。', 5);

    -- Project 5: 正多面体纸模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('正多面体纸模型', '制作五种正多面体（柏拉图立体）的纸模型，从正四面体到正二十面体。孩子将在折叠粘贴中认识展开图与立体图形的关系，理解为什么宇宙中只存在五种正多面体。', v_author_id, v_sub_id, 2, 45, 'approved', '/projects/sensory_box.webp', ARRAY['立体几何','展开图','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬卡纸若干张', 1),
        (v_project_id, '直尺和圆规', 2),
        (v_project_id, '铅笔', 3),
        (v_project_id, '剪刀', 4),
        (v_project_id, '胶水或双面胶', 5),
        (v_project_id, '彩色笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绘制展开图', '在卡纸上用直尺和圆规绘制正四面体的展开图——由四个等边三角形组成，并画出折叠线。', 1),
        (v_project_id, '裁剪与折叠', '沿轮廓剪下展开图，沿折叠线折起每个面，用胶水粘合成正四面体。', 2),
        (v_project_id, '制作更多面体', '用同样方法依次制作正六面体（正方体）、正八面体、正十二面体和正二十面体。', 3),
        (v_project_id, '观察与统计', '数出每种正多面体的面数、棱数和顶点数，填入统计表格中。', 4),
        (v_project_id, '发现规律', '计算每种多面体的"顶点数 - 棱数 + 面数"，惊喜地发现结果都等于2，这就是欧拉公式。', 5);

    -- Project 6: 莫比乌斯带探索
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('莫比乌斯带探索', '用纸条扭转粘合制作神奇的莫比乌斯带，发现它只有一个面和一条边。孩子将通过剪切实验见证拓扑学的奇妙——沿中线剪开莫比乌斯带不会变成两条，而是变成一个更大的环。', v_author_id, v_sub_id, 2, 20, 'approved', '/projects/sensory_box.webp', ARRAY['拓扑','单侧面','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '长纸条若干（约3厘米宽、30厘米长）', 1),
        (v_project_id, '胶带或胶水', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '彩色笔', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作普通纸环', '将一条纸条直接首尾粘合成一个普通圆环，用笔沿一面画线，发现需要翻面才能画满。', 1),
        (v_project_id, '制作莫比乌斯带', '将另一条纸条扭转半圈（180度）后首尾粘合，得到莫比乌斯带。', 2),
        (v_project_id, '画线实验', '用彩笔沿莫比乌斯带中线不停地画，惊讶地发现不用翻面就能画回起点——它只有一个面。', 3),
        (v_project_id, '沿中线剪开', '用剪刀沿中线将莫比乌斯带剪开，猜猜会怎样？结果不是两个环，而是一个更大的扭转环！', 4),
        (v_project_id, '沿三分线剪开', '再做一条莫比乌斯带，这次沿三分之一处剪开，观察得到两个套在一起的环。', 5),
        (v_project_id, '讨论与延伸', '讨论莫比乌斯带为什么如此特别，了解它在传送带和磁带中的实际应用。', 6);

    -- Project 7: 图形镶嵌
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('图形镶嵌', '用相同或不同的几何图形密铺平面，不留间隙也不重叠，创造出美丽的镶嵌图案。孩子将探索哪些正多边形可以铺满平面，理解角度之和等于360度的镶嵌条件。', v_author_id, v_sub_id, 2, 35, 'approved', '/projects/sensory_box.webp', ARRAY['镶嵌','平铺','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '彩色卡纸', 1),
        (v_project_id, '直尺和量角器', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '铅笔', 4),
        (v_project_id, '胶棒', 5),
        (v_project_id, '大张白纸（做底板）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作图形模板', '在卡纸上画出等边三角形、正方形和正六边形的模板，每种剪出多个大小一致的图形。', 1),
        (v_project_id, '正方形镶嵌', '用正方形拼铺大张白纸，发现四个直角正好凑成360度，可以完美铺满平面。', 2),
        (v_project_id, '三角形和六边形', '分别用等边三角形和正六边形进行镶嵌实验，验证它们也能无缝铺满平面。', 3),
        (v_project_id, '混合镶嵌', '尝试将不同形状的图形混合使用进行镶嵌，比如正方形与三角形的组合铺设。', 4),
        (v_project_id, '角度分析', '量出每种正多边形的内角度数，计算顶点处角度之和，理解只有和为360度才能镶嵌。', 5);

    -- Project 8: 坐标画图
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('坐标画图', '在坐标纸上按照坐标点依次连线，画出隐藏的有趣图案。孩子将在游戏中熟悉坐标系的使用方法，学会用数字对（x, y）精确定位平面上的点。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/sensory_box.webp', ARRAY['坐标系','描点','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '方格纸或坐标纸', 1),
        (v_project_id, '直尺', 2),
        (v_project_id, '铅笔和彩色笔', 3),
        (v_project_id, '橡皮', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '建立坐标系', '在方格纸上画出横轴（x轴）和纵轴（y轴），标上刻度数字，标明原点O。', 1),
        (v_project_id, '练习描点', '根据给出的坐标如（3,5）、（-2,4）等在坐标系中找到对应位置并标上点。', 2),
        (v_project_id, '连线画图', '按照一组预设坐标点依次描点并连线，完成后发现线条组成了一个有趣的图案，如星星或动物轮廓。', 3),
        (v_project_id, '自主创作', '自己设计一个简单图案，测量关键顶点的坐标写成坐标列表，让家人按你的坐标来画。', 4),
        (v_project_id, '图形变换', '将所有坐标的x值加上一个数再画图，观察图案整体右移；将y值都乘以-1，发现图案上下翻转。', 5);

    -- Project 9: 黄金比例寻找
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('黄金比例寻找', '在自然界、艺术品和人体中寻找神秘的黄金比例（约1:1.618）。孩子将学会使用测量工具发现这一隐藏在万物中的数学密码，感受数学与美的深刻联系。', v_author_id, v_sub_id, 3, 40, 'approved', '/projects/sensory_box.webp', ARRAY['黄金比例','美学','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '卷尺或直尺', 1),
        (v_project_id, '计算器', 2),
        (v_project_id, '记录本和铅笔', 3),
        (v_project_id, '鹦鹉螺贝壳图片或实物（可选）', 4),
        (v_project_id, '名画图片若干（如蒙娜丽莎）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识黄金比例', '了解黄金比例的定义：将一条线段分成两部分，长段与短段之比等于全长与长段之比，约为1.618。', 1),
        (v_project_id, '测量身体比例', '测量从肚脐到脚底的长度和身高，计算比值；测量手指各节长度的比值，看是否接近黄金比例。', 2),
        (v_project_id, '寻找自然中的黄金', '观察向日葵种子排列、松果鳞片螺旋、鹦鹉螺壳的曲线，了解斐波那契数列与黄金比例的关系。', 3),
        (v_project_id, '艺术中的黄金', '在名画和古建筑照片中测量关键比例，发现许多经典作品暗含黄金矩形的构图。', 4),
        (v_project_id, '绘制黄金螺旋', '用直尺和圆规按照斐波那契数列画出一系列正方形，在每个正方形中画四分之一圆弧，连成优美的黄金螺旋。', 5);

    -- Project 10: 分形图案绘制
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('分形图案绘制', '手绘谢尔宾斯基三角形和科赫雪花等经典分形图案，观察"自相似"的奇妙结构。孩子将发现局部放大后和整体形状一样的神奇现象，初步接触无穷和递归的数学思想。', v_author_id, v_sub_id, 3, 40, 'approved', '/projects/sensory_box.webp', ARRAY['分形','自相似','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白纸若干', 1),
        (v_project_id, '直尺', 2),
        (v_project_id, '铅笔和彩色笔', 3),
        (v_project_id, '三角板', 4),
        (v_project_id, '橡皮', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '画谢尔宾斯基三角形', '先画一个大等边三角形，取三边中点连线形成内部小三角形并涂黑挖去，对剩余的三个三角形重复操作。', 1),
        (v_project_id, '迭代加深', '对每个小三角形继续执行相同的中点连线和挖去操作，重复三到四次，图案越来越精细。', 2),
        (v_project_id, '画科赫雪花', '从一个等边三角形开始，将每条边三等分，在中间一段向外搭建更小的等边三角形，重复三次。', 3),
        (v_project_id, '观察自相似性', '用手或放大镜局部观察分形图案，发现不论放大哪个局部，形状都与整体相似。', 4),
        (v_project_id, '分形在自然中', '讨论自然界中的分形现象：树枝分叉、花椰菜表面、海岸线轮廓、雪花形状等。', 5);

    -- Project 11: 圆周率测量实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('圆周率测量实验', '通过测量各种圆形物品的周长和直径来亲手"发现"圆周率π。孩子将像古代数学家一样通过实验方法逼近π的值，体会测量、记录、取平均值的科学方法。', v_author_id, v_sub_id, 3, 35, 'approved', '/projects/sensory_box.webp', ARRAY['圆周率','测量','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '各种圆形物品（杯子、盘子、硬币、锅盖等）', 1),
        (v_project_id, '软尺或线绳加直尺', 2),
        (v_project_id, '计算器', 3),
        (v_project_id, '记录本和铅笔', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选取圆形物品', '收集五个以上大小不同的圆形物品，如杯口、盘子、硬币、瓶盖等。', 1),
        (v_project_id, '测量周长', '用软尺绕圆形物品一圈测量周长，或者用线绳绕一圈后再测线绳长度，每个物品测量三次取平均。', 2),
        (v_project_id, '测量直径', '用直尺测量每个物品的直径，注意尺子要通过圆心，同样每个测三次取平均。', 3),
        (v_project_id, '计算比值', '将每个物品的周长除以直径，把结果记录在表格中，观察这些比值有什么共同特点。', 4),
        (v_project_id, '发现π', '所有比值都接近3.14！这就是圆周率π，取所有测量结果的平均值与3.14159比较，讨论误差来源。', 5);

    -- Project 12: 几何光学作图
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('几何光学作图', '用直尺和量角器画出光的反射和折射光路图，用几何方法预测光线走向。孩子将运用角度知识理解入射角等于反射角的规律，用作图方法解决光路问题。', v_author_id, v_sub_id, 3, 35, 'approved', '/projects/sensory_box.webp', ARRAY['光路','反射折射','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白纸若干', 1),
        (v_project_id, '直尺', 2),
        (v_project_id, '量角器', 3),
        (v_project_id, '铅笔和彩色笔', 4),
        (v_project_id, '小镜子（用于验证）', 5),
        (v_project_id, '手电筒', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '画反射光路', '在纸上画一条直线代表镜面，画出法线（垂直于镜面），用量角器画入射光线，再画出入射角等于反射角的反射光线。', 1),
        (v_project_id, '实验验证', '将小镜子立在纸上的镜面线位置，用手电筒沿画好的入射光线照射，观察反射光是否沿预测方向。', 2),
        (v_project_id, '多次反射', '画两面相对的镜子，用作图法画出光线在两面镜子之间来回反射的完整路径。', 3),
        (v_project_id, '折射作图', '在纸上画水面分界线，学习用几何方法画出光从空气进入水中时的折射弯曲路径。', 4),
        (v_project_id, '挑战题目', '画一间有两面镜子的房间，找出从灯泡出发经过两次反射照到指定点的光路。', 5);

    -- Project 13: 欧拉多面体公式验证
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('欧拉多面体公式验证', '数各种多面体模型的顶点、棱和面，验证欧拉公式V - E + F = 2是否总是成立。孩子将动手制作多种多面体并仔细计数，感受这个简洁公式背后的深刻数学之美。', v_author_id, v_sub_id, 4, 50, 'approved', '/projects/sensory_box.webp', ARRAY['欧拉公式','V-E+F','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '橡皮泥', 1),
        (v_project_id, '牙签或竹签', 2),
        (v_project_id, '硬卡纸', 3),
        (v_project_id, '剪刀和胶水', 4),
        (v_project_id, '记录本和铅笔', 5),
        (v_project_id, '计算器', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作简单多面体', '用橡皮泥做顶点、牙签做棱，搭建正四面体和正方体的骨架模型。', 1),
        (v_project_id, '计数V、E、F', '仔细数出每个模型的顶点数V、棱数E和面数F，记录在表格中。', 2),
        (v_project_id, '验证公式', '计算V - E + F，发现正四面体是4 - 6 + 4 = 2，正方体是8 - 12 + 6 = 2，结果都是2。', 3),
        (v_project_id, '挑战更多形状', '继续制作正八面体、正十二面体、三棱柱、五棱锥等不同多面体，逐一验证公式。', 4),
        (v_project_id, '寻找例外', '尝试制作一个中间有洞的环形多面体（如甜甜圈形），发现公式结果不再是2，讨论为什么。', 5),
        (v_project_id, '总结规律', '整理所有数据，总结欧拉公式对凸多面体总是成立，思考"有洞"的情况公式如何修正。', 6);

    -- Project 14: 四色定理地图着色
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('四色定理地图着色', '尝试用最少的颜色给地图着色，使相邻区域颜色不同，探索著名的四色定理。孩子将在动手涂色中体验图论的魅力，理解为什么任何地图最多只需要四种颜色。', v_author_id, v_sub_id, 4, 40, 'approved', '/projects/sensory_box.webp', ARRAY['图论','着色','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '打印的各国或各省地图', 1),
        (v_project_id, '四种不同颜色的彩笔', 2),
        (v_project_id, '白纸', 3),
        (v_project_id, '铅笔和橡皮', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '简单地图尝试', '在白纸上画一张有五六个区域的简单地图，尝试用尽量少的颜色着色，使相邻区域颜色不同。', 1),
        (v_project_id, '增加难度', '画出更复杂的地图，有十个以上交错的区域，继续尝试着色，记录最少用了几种颜色。', 2),
        (v_project_id, '给真实地图着色', '用四种彩笔给中国省份地图着色，确保每两个相邻的省份颜色不同。', 3),
        (v_project_id, '发现规律', '多次尝试后发现：无论地图多复杂，四种颜色总是够用，这就是四色定理。', 4),
        (v_project_id, '构造挑战', '尝试画一张"必须"用到四种颜色的地图（三种颜色不够），理解什么情况下需要第四种颜色。', 5),
        (v_project_id, '延伸思考', '讨论四色定理的历史——这是第一个用计算机辅助证明的数学定理，至今没有纯手工证明。', 6);

    -- Project 15: 曲面几何体纸模
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('曲面几何体纸模', '用纸条和卡纸制作圆柱、圆锥和球面近似模型，探索曲面如何从平面"变身"而来。孩子将理解展开图的概念，发现圆柱的侧面展开是长方形，圆锥的侧面展开是扇形。', v_author_id, v_sub_id, 4, 45, 'approved', '/projects/sensory_box.webp', ARRAY['曲面','展开','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬卡纸若干', 1),
        (v_project_id, '圆规', 2),
        (v_project_id, '直尺', 3),
        (v_project_id, '剪刀', 4),
        (v_project_id, '胶水或双面胶', 5),
        (v_project_id, '计算器', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作圆柱', '画一个长方形和两个等大的圆形，将长方形卷成筒状粘合，两端盖上圆形，长方形的长要等于圆的周长。', 1),
        (v_project_id, '制作圆锥', '用圆规画一个扇形，卷成锥形粘合，底部加上合适大小的圆形底面。', 2),
        (v_project_id, '近似球面', '将多条纸带交叉编织或用经纬线法制作一个近似球面，感受球面不能完全展开为平面。', 3),
        (v_project_id, '测量与计算', '测量制作好的圆柱和圆锥的尺寸，用公式计算侧面积和体积，与实际测量对比。', 4),
        (v_project_id, '展开图对比', '将圆柱和圆锥小心拆开铺平，观察展开图的形状，讨论为什么球面无法像它们一样展开。', 5);

    -- Project 16: 正多面体对偶关系
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('正多面体对偶关系', '探索正多面体之间的对偶关系：正方体和正八面体互为对偶，正十二面体和正二十面体互为对偶。孩子将在每个正多面体的面中心连线，发现藏在里面的另一个正多面体。', v_author_id, v_sub_id, 4, 50, 'approved', '/projects/sensory_box.webp', ARRAY['对偶','几何','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '透明或半透明硬卡纸', 1),
        (v_project_id, '细铁丝或竹签', 2),
        (v_project_id, '橡皮泥', 3),
        (v_project_id, '直尺和圆规', 4),
        (v_project_id, '彩色线', 5),
        (v_project_id, '剪刀和胶水', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作正方体', '用卡纸或铁丝制作一个正方体骨架模型，标记出每个面的中心点。', 1),
        (v_project_id, '连接面心', '用彩色线将正方体六个面的中心点相互连接，观察这些线围成的形状——竟然是一个正八面体。', 2),
        (v_project_id, '反向验证', '再制作一个正八面体，连接八个面的中心点，验证得到的是正方体，证明它们互为对偶。', 3),
        (v_project_id, '探索更多对偶', '制作正十二面体和正二十面体，用同样方法找出它们的对偶关系。', 4),
        (v_project_id, '数据验证', '对比对偶多面体的数据：一个的面数等于另一个的顶点数，棱数相同。', 5),
        (v_project_id, '正四面体的秘密', '对正四面体执行同样操作，惊喜发现它的对偶是它自己——正四面体是自对偶的。', 6);

    -- Project 17: 分形雪花编程绘制
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('分形雪花编程绘制', '用编程（Scratch或Python Turtle）递归绘制科赫雪花和分形树等图案。孩子将把数学中的分形概念与编程中的递归思想结合，用代码创造出手工难以完成的精美分形图案。', v_author_id, v_sub_id, 5, 60, 'approved', '/projects/sensory_box.webp', ARRAY['分形','递归','编程','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑', 1),
        (v_project_id, 'Scratch软件或Python环境', 2),
        (v_project_id, '参考图片（科赫雪花、分形树）', 3),
        (v_project_id, '记录本（记录递归逻辑）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '理解递归思想', '从一条直线开始，将中间三分之一替换为向外突出的等边三角形两条边，理解这一步如何重复应用。', 1),
        (v_project_id, '画科赫线段', '编写程序画出科赫曲线：如果层数为0画直线，否则递归画四段更小的科赫曲线。', 2),
        (v_project_id, '组成雪花', '将三条科赫曲线按等边三角形排列，形成完整的科赫雪花，调整递归深度观察效果。', 3),
        (v_project_id, '绘制分形树', '编写新程序：画一条树干，末端分叉成两条更短的树枝，每条树枝再分叉，递归生成整棵树。', 4),
        (v_project_id, '添加变化', '为分形树增加随机角度和颜色变化，让每次运行生成的树都略有不同，更接近真实的树木。', 5),
        (v_project_id, '探索更多分形', '尝试编程绘制谢尔宾斯基三角形或龙形曲线，理解不同的递归规则产生不同的分形图案。', 6);

    -- Project 18: 非欧几何初探
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('非欧几何初探', '在球面和马鞍面上画"直线"和三角形，发现三角形内角和不再是180度。孩子将突破欧几里得几何的思维定势，初步接触球面几何和双曲几何的奇妙世界。', v_author_id, v_sub_id, 5, 50, 'approved', '/projects/sensory_box.webp', ARRAY['球面','双曲面','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '地球仪或大球', 1),
        (v_project_id, '橡皮筋', 2),
        (v_project_id, '马鞍形曲面模型或薯片（双曲面近似）', 3),
        (v_project_id, '量角器', 4),
        (v_project_id, '彩色笔', 5),
        (v_project_id, '白纸和直尺（对比用）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '平面上的三角形', '在白纸上画一个三角形，用量角器测量三个内角，验证内角和等于180度。', 1),
        (v_project_id, '球面上的三角形', '在地球仪上用橡皮筋沿大圆围成一个三角形（如北极-赤道上两点），测量三个角发现内角和大于180度。', 2),
        (v_project_id, '球面上的平行线', '在地球仪上画两条经线，它们在赤道处看似平行，但在两极相交，说明球面上没有真正的平行线。', 3),
        (v_project_id, '马鞍面上的探索', '在马鞍形曲面上画三角形，测量内角和发现小于180度，这就是双曲几何。', 4),
        (v_project_id, '对比三种几何', '制作表格比较平面、球面和马鞍面上的几何性质：三角形内角和、平行线数量、最短路径形状等。', 5),
        (v_project_id, '联系现实', '讨论爱因斯坦广义相对论如何用非欧几何描述被大质量物体弯曲的时空。', 6);

    -- Project 19: 投影与影子几何
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('投影与影子几何', '用手电筒将立体图形的影子投射到墙面和桌面上，探索不同角度投影的形状变化。孩子将理解三维物体如何产生二维投影，学习正交投影和透视投影的区别。', v_author_id, v_sub_id, 5, 45, 'approved', '/projects/sensory_box.webp', ARRAY['投影','截面','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '手电筒', 1),
        (v_project_id, '各种立体模型（正方体、球、圆柱、圆锥）', 2),
        (v_project_id, '白色墙壁或白纸板', 3),
        (v_project_id, '铅笔和记录本', 4),
        (v_project_id, '橡皮泥（制作自定义形状）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '基础投影', '在暗室中用手电筒从正面照射正方体，在墙上看到正方形的影子；从斜上方照射，影子变成什么形状？', 1),
        (v_project_id, '一物多影', '转动正方体的角度，记录不同方向的投影形状：正方形、长方形、六边形等，画出每种投影。', 2),
        (v_project_id, '猜影游戏', '一人在幕后放置不同立体图形，只让另一人看影子来猜原物是什么形状。', 3),
        (v_project_id, '截面探索', '用橡皮泥做一个正方体，用细线从不同角度切开，观察截面形状：三角形、长方形甚至六边形。', 4),
        (v_project_id, '三视图绘制', '从正面、侧面和上方分别观察立体模型，画出对应的正视图、侧视图和俯视图。', 5),
        (v_project_id, '工程应用', '讨论建筑师和工程师如何用三视图和投影图来描述复杂的三维结构。', 6);

    -- Project 20: 球面几何与地图投影
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('球面几何与地图投影', '探索把球面地图展开到平面时产生的形变问题，比较不同地图投影方式的优劣。孩子将动手剥橘子皮来直观感受球面无法完美展开为平面，理解所有世界地图都是"有误差的"。', v_author_id, v_sub_id, 5, 55, 'approved', '/projects/sensory_box.webp', ARRAY['地图','投影变形','数学','几何'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '橘子或乒乓球', 1),
        (v_project_id, '记号笔', 2),
        (v_project_id, '世界地图（墨卡托投影）', 3),
        (v_project_id, '地球仪', 4),
        (v_project_id, '白纸和胶带', 5),
        (v_project_id, '直尺和圆规', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '橘子皮实验', '在橘子表面用记号笔画出简化的大陆轮廓和经纬线，然后剥下橘皮尝试铺平——发现必然会撕裂或重叠。', 1),
        (v_project_id, '理解投影原理', '用手电筒从地球仪中心向外照射，观察经纬线投射到包裹地球仪的纸筒或纸锥上的形状。', 2),
        (v_project_id, '比较面积失真', '在墨卡托投影地图上测量格陵兰和非洲的面积，再在地球仪上比较——实际上非洲比格陵兰大14倍！', 3),
        (v_project_id, '制作简易投影', '将半透明纸包裹在地球仪上，描出海岸线，展开后得到一种投影地图，观察哪里变形最大。', 4),
        (v_project_id, '讨论投影选择', '了解不同投影的优缺点：墨卡托保角度但面积失真大，等面积投影保面积但形状变形。', 5),
        (v_project_id, '航海与导航', '讨论为什么航海地图使用墨卡托投影——因为直线等于等角航线，方便船只按固定方位角航行。', 6);

END $$;
