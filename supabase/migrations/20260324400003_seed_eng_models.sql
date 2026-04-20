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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '模型制作' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 模型制作'; END IF;

    -- Project 1: 纸板小房子
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '纸板小房子',
        '用废旧纸板剪裁、折叠、粘贴，搭建一座迷你小房子！参与者将学习基本的建筑结构知识，理解墙壁、屋顶和门窗的比例关系。通过动手实践培养空间想象力和精细动手能力。',
        v_author_id, v_sub_id, 1, 30, 'approved', '/projects/eng_models.webp',
        ARRAY['建筑','折叠','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '废旧纸板 2-3张', 1),
        (v_project_id, '剪刀', 2),
        (v_project_id, '白胶或热熔胶', 3),
        (v_project_id, '直尺', 4),
        (v_project_id, '铅笔', 5),
        (v_project_id, '彩色画笔或贴纸（装饰用）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计房子图纸', '在纸上画出小房子的正面、侧面和屋顶的展开图，标注好尺寸和折叠线。', 1),
        (v_project_id, '剪裁纸板', '按照图纸在纸板上画线并剪裁出墙壁、屋顶等各部件，注意留出粘贴边。', 2),
        (v_project_id, '折叠与粘贴', '沿折叠线折出立体形状，用白胶将各面粘合在一起，组装成房子的基本结构。', 3),
        (v_project_id, '添加门窗', '在墙壁上用剪刀小心地剪出门和窗户的位置，可以做成能打开的小门。', 4),
        (v_project_id, '装饰美化', '用彩色画笔或贴纸装饰房子外墙，画上砖纹、花草等细节，让小房子更加生动。', 5);

    -- Project 2: 黏土动物模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '黏土动物模型',
        '用超轻黏土捏出各种可爱的小动物造型！参与者将锻炼手部精细运动能力，学习观察动物的身体比例和特征。这是一个充满创意和乐趣的造型入门项目。',
        v_author_id, v_sub_id, 1, 25, 'approved', '/projects/eng_models.webp',
        ARRAY['雕塑','造型','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '超轻黏土（多色）', 1),
        (v_project_id, '塑形工具套装', 2),
        (v_project_id, '牙签（骨架用）', 3),
        (v_project_id, '小珠子（做眼睛用）', 4),
        (v_project_id, '硬纸板（底座用）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择动物造型', '选一种喜欢的动物，观察它的照片或图片，注意身体各部分的大小比例。', 1),
        (v_project_id, '制作身体主体', '取一块黏土揉成椭圆形作为身体，再搓一个圆球作为头部，用牙签连接固定。', 2),
        (v_project_id, '添加四肢和尾巴', '搓出四条腿和尾巴，粘在身体上合适的位置，调整姿势使动物能稳稳站立。', 3),
        (v_project_id, '制作五官细节', '用小珠子或不同颜色的黏土做出眼睛、鼻子和嘴巴，用工具刻出毛发纹理等细节。', 4),
        (v_project_id, '晾干展示', '将做好的动物模型放在硬纸板底座上，自然晾干24小时后即可展示。', 5);

    -- Project 3: 纸飞机模型集
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '纸飞机模型集',
        '学习折叠多种经典纸飞机，探索不同机翼形状对飞行距离和稳定性的影响！参与者将初步了解空气动力学的基本概念，理解升力和阻力的关系。折好后还可以举办一场纸飞机比赛。',
        v_author_id, v_sub_id, 1, 20, 'approved', '/projects/eng_models.webp',
        ARRAY['空气动力学','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'A4纸 10张', 1),
        (v_project_id, '彩色卡纸 若干', 2),
        (v_project_id, '直尺', 3),
        (v_project_id, '卷尺（测量飞行距离）', 4),
        (v_project_id, '记录本和笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习基础折法', '按照教程折出标准飞镖型纸飞机，注意对称和折痕要压实。', 1),
        (v_project_id, '折叠多种机型', '分别折出宽翼型、窄翼型、三角翼型等不同样式的纸飞机，共制作4-5种。', 2),
        (v_project_id, '试飞测试', '在空旷处逐一试飞每种纸飞机，用卷尺测量飞行距离，记录每次的成绩。', 3),
        (v_project_id, '对比分析', '对比不同机翼形状的飞行距离和稳定性，讨论为什么有的飞得远、有的飞得稳。', 4);

    -- Project 4: 折纸小船
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '折纸小船',
        '用纸折出不同造型的小船，放在水中测试它们的浮力和载重能力！参与者将了解浮力原理和船体形状对稳定性的影响。通过动手折叠和实际测试，体会工程设计中的反复优化过程。',
        v_author_id, v_sub_id, 1, 20, 'approved', '/projects/eng_models.webp',
        ARRAY['折纸','浮力','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'A4纸 若干张', 1),
        (v_project_id, '防水蜡笔或蜡烛', 2),
        (v_project_id, '大盆或水槽', 3),
        (v_project_id, '小硬币（测试载重）', 4),
        (v_project_id, '毛巾（擦水用）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '折叠基础小船', '按照传统折纸方法折出一只经典纸船，确保折痕整齐对称。', 1),
        (v_project_id, '防水处理', '用蜡笔或蜡烛在纸船底部涂上一层薄蜡，增强防水性能延长漂浮时间。', 2),
        (v_project_id, '浮力测试', '将纸船放入水中，逐个放入小硬币测试载重能力，记录每艘船能承载多少枚硬币。', 3),
        (v_project_id, '改进设计', '观察沉没的原因，尝试改变船体形状或大小来提高载重能力，反复测试找到最优设计。', 4);

    -- Project 5: 太阳系模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '太阳系模型',
        '用泡沫球和颜料制作一个按比例缩放的太阳系模型，展示八大行星的相对大小和位置！参与者将学习天文学基础知识，了解太阳系中各行星的特点。这是一个集科学与艺术于一体的展示项目。',
        v_author_id, v_sub_id, 2, 45, 'approved', '/projects/eng_models.webp',
        ARRAY['天文','比例','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '泡沫球（不同大小）9个', 1),
        (v_project_id, '丙烯颜料（多色）', 2),
        (v_project_id, '画笔', 3),
        (v_project_id, '铁丝或木棍', 4),
        (v_project_id, '大纸板（底座用）', 5),
        (v_project_id, '标签纸和笔', 6),
        (v_project_id, '热熔胶枪', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解行星资料', '查阅八大行星的大小、颜色和离太阳的距离，列出比例换算表。', 1),
        (v_project_id, '涂装行星', '按照各行星的实际外观特征，用丙烯颜料给泡沫球上色，如木星画出条纹、土星做出光环。', 2),
        (v_project_id, '制作支架', '将铁丝或木棍固定在大纸板上，按距离比例排列，每根支架高度错开便于展示。', 3),
        (v_project_id, '组装太阳系', '将涂好色的行星球安装到对应的支架上，贴上标签写明行星名称和基本数据。', 4),
        (v_project_id, '展示讲解', '向家人或同学介绍自己制作的太阳系模型，讲解每颗行星的特点。', 5);

    -- Project 6: 纸板城堡
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '纸板城堡',
        '用纸板搭建一座拥有塔楼、城墙和吊桥的中世纪城堡模型！参与者将了解城堡建筑的基本结构和防御设计理念。这个项目需要一定的规划能力，完成后非常有成就感。',
        v_author_id, v_sub_id, 2, 60, 'approved', '/projects/eng_models.webp',
        ARRAY['建筑','设计','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大纸板箱 2-3个', 1),
        (v_project_id, '卫生纸芯（做塔楼）4个', 2),
        (v_project_id, '剪刀和美工刀（需成年人辅助）', 3),
        (v_project_id, '白胶和热熔胶', 4),
        (v_project_id, '丙烯颜料（灰色、棕色等）', 5),
        (v_project_id, '细绳（做吊桥用）', 6),
        (v_project_id, '冰棍棒（做吊桥板面）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '规划城堡布局', '在纸上画出城堡的俯视图，确定城墙、塔楼、大门和吊桥的位置与尺寸。', 1),
        (v_project_id, '搭建城墙', '将纸板裁剪成城墙形状，顶部剪出锯齿状城垛，围合成方形或圆形。', 2),
        (v_project_id, '安装塔楼', '将卫生纸芯粘贴在城墙四角作为塔楼，顶部可以加锥形纸帽作为塔尖。', 3),
        (v_project_id, '制作吊桥', '用冰棍棒并排粘成桥面，两端系上细绳连接到城门口，做出可升降的效果。', 4),
        (v_project_id, '上色装饰', '用灰色和棕色颜料画出石砖纹理，添加旗帜、窗户等细节，完成整座城堡。', 5);

    -- Project 7: 火山模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '火山模型',
        '用黏土和纸板制作一个可以展示内部结构的火山截面模型！参与者将了解火山的构造，包括岩浆室、火山口和不同岩层。这个模型可以清楚地展示地球内部的热能如何驱动火山喷发。',
        v_author_id, v_sub_id, 2, 40, 'approved', '/projects/eng_models.webp',
        ARRAY['地质','截面','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '黏土或超轻黏土（多色）', 1),
        (v_project_id, '硬纸板（底座用）', 2),
        (v_project_id, '塑料瓶（内部支撑）', 3),
        (v_project_id, '丙烯颜料', 4),
        (v_project_id, '小刀（需成年人辅助）', 5),
        (v_project_id, '标签纸', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建火山骨架', '将塑料瓶固定在纸板中央，用揉皱的报纸和胶带围绕瓶身堆出火山的锥形外形。', 1),
        (v_project_id, '覆盖黏土层', '用不同颜色的黏土分层覆盖火山表面，棕色代表岩石层、绿色代表植被、白色代表积雪。', 2),
        (v_project_id, '制作截面', '将火山模型纵向切开一半，用红色和橙色黏土填充内部，展示岩浆室、岩浆通道等结构。', 3),
        (v_project_id, '标注结构名称', '用标签纸标注火山口、岩浆室、岩浆通道、岩层等各部分的名称。', 4),
        (v_project_id, '讲解火山知识', '对照模型讲解火山喷发的过程：岩浆从地下深处沿通道上升并从火山口喷出。', 5);

    -- Project 8: 恐龙模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '恐龙模型',
        '用黏土和铁丝骨架制作一个栩栩如生的恐龙模型！参与者将了解恐龙的身体结构特征，学习如何通过骨架支撑来制作大型造型。选择自己喜欢的恐龙种类，发挥创造力还原远古生物的风采。',
        v_author_id, v_sub_id, 2, 50, 'approved', '/projects/eng_models.webp',
        ARRAY['古生物','造型','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '超轻黏土（绿色、棕色等）', 1),
        (v_project_id, '铝丝或铁丝（骨架用）', 2),
        (v_project_id, '钳子', 3),
        (v_project_id, '塑形工具', 4),
        (v_project_id, '丙烯颜料和画笔', 5),
        (v_project_id, '硬纸板（底座用）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '研究恐龙资料', '选择一种恐龙（如霸王龙或三角龙），查阅它的外形特征、体型比例和身体细节。', 1),
        (v_project_id, '制作铁丝骨架', '用铝丝弯折出恐龙的基本骨架，包括脊柱、四肢和尾巴，确保骨架能稳定站立。', 2),
        (v_project_id, '包裹黏土塑形', '在骨架上逐层包裹黏土，先塑出大致体形，再精雕头部、爪子和尾巴的细节。', 3),
        (v_project_id, '刻画表面纹理', '用工具在黏土表面刻出鳞片、皮肤褶皱等纹理，使恐龙模型更加逼真。', 4),
        (v_project_id, '上色完成', '晾干后用丙烯颜料给恐龙上色，画出斑纹和阴影效果，固定在底座上展示。', 5);

    -- Project 9: 人体器官模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '人体器官模型',
        '用黏土制作可拆卸的人体躯干模型，展示心脏、肺、胃、肝等主要器官的位置和形状！参与者将直观地了解人体内部结构。每个器官用不同颜色区分，可以取出单独观察再放回原位。',
        v_author_id, v_sub_id, 3, 60, 'approved', '/projects/eng_models.webp',
        ARRAY['人体','解剖','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '超轻黏土（多色）', 1),
        (v_project_id, '大号泡沫板（做躯干外壳）', 2),
        (v_project_id, '人体解剖图（参考用）', 3),
        (v_project_id, '塑形工具', 4),
        (v_project_id, '标签纸和细铁丝（做标注）', 5),
        (v_project_id, '丙烯颜料', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '研究器官位置', '参照人体解剖图，了解心脏、肺、胃、肝、肠等主要器官在体内的位置和大小。', 1),
        (v_project_id, '制作躯干外壳', '用泡沫板或厚纸板制作一个简化的人体躯干形状，中间掏空用来放置器官。', 2),
        (v_project_id, '塑造各器官', '用不同颜色的黏土分别制作各个器官：红色心脏、粉色肺、黄色胃、棕色肝等。', 3),
        (v_project_id, '组装器官模型', '按照正确的解剖位置将各器官放入躯干中，确保每个器官可以单独取出和放回。', 4),
        (v_project_id, '标注与讲解', '用标签纸标注每个器官的名称和主要功能，对照模型学习人体器官知识。', 5);

    -- Project 10: 细胞结构模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '细胞结构模型',
        '用果冻和各种糖果制作一个放大版的动物细胞模型，展示细胞膜、细胞核、线粒体等结构！参与者将了解细胞这个生命基本单位的内部构造。用食物来模拟微观世界，既好玩又好记。',
        v_author_id, v_sub_id, 3, 45, 'approved', '/projects/eng_models.webp',
        ARRAY['生物','微观','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '透明果冻粉和热水', 1),
        (v_project_id, '大圆形容器（做细胞外形）', 2),
        (v_project_id, '大号葡萄（做细胞核）', 3),
        (v_project_id, '各种小糖果（做细胞器）', 4),
        (v_project_id, '保鲜膜', 5),
        (v_project_id, '标签纸和牙签', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解细胞结构', '学习动物细胞的基本结构：细胞膜、细胞质、细胞核、线粒体、内质网、高尔基体等。', 1),
        (v_project_id, '制作细胞质基质', '将果冻粉用热水溶解，倒入圆形容器中，冷却至半凝固状态作为细胞质。', 2),
        (v_project_id, '放入细胞器', '趁果冻未完全凝固，将大葡萄（细胞核）放在中央，各种糖果分别代表线粒体、内质网等放入对应位置。', 3),
        (v_project_id, '冷藏定型', '放入冰箱冷藏2小时至完全凝固，果冻固定住所有"细胞器"的位置。', 4),
        (v_project_id, '标注展示', '脱模后用牙签和标签纸标注每个结构的名称，对照生物课本讲解各细胞器的功能。', 5);

    -- Project 11: DNA 双螺旋模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        'DNA 双螺旋模型',
        '用铁丝和彩色珠子制作一个DNA双螺旋结构模型，展示碱基配对的规律！参与者将了解遗传信息的载体——DNA的分子结构。用四种颜色的珠子分别代表A、T、G、C四种碱基，直观展示互补配对。',
        v_author_id, v_sub_id, 3, 50, 'approved', '/projects/eng_models.webp',
        ARRAY['生物','分子','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '铝丝或铁丝 2根（各50厘米）', 1),
        (v_project_id, '彩色珠子（红、蓝、绿、黄各20颗）', 2),
        (v_project_id, '短铁丝段 10根（做碱基对横梁）', 3),
        (v_project_id, '钳子', 4),
        (v_project_id, '底座（木块或纸板）', 5),
        (v_project_id, '标签纸', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习DNA结构', '了解DNA双螺旋的基本知识：两条糖-磷酸骨架螺旋缠绕，碱基A配T、G配C。', 1),
        (v_project_id, '制作骨架', '将两根长铁丝分别穿入白色或银色珠子代表糖-磷酸骨架，每隔一定间距留出连接点。', 2),
        (v_project_id, '连接碱基对', '用短铁丝两端各穿一颗彩色珠子代表配对碱基（红配蓝=A-T，绿配黄=G-C），将短铁丝横接在两条骨架之间。', 3),
        (v_project_id, '扭转成螺旋', '将整个结构轻轻扭转成双螺旋形状，固定在底座上保持造型稳定。', 4),
        (v_project_id, '标注与讲解', '用标签标注碱基名称和配对规律，讲解DNA如何储存和传递遗传信息。', 5);

    -- Project 12: 建筑沙盘
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '建筑沙盘',
        '设计并制作一个小型社区的建筑沙盘，包含房屋、道路、绿化和公共设施！参与者将学习基本的城市规划概念，理解建筑物之间的空间关系。这是一个综合性很强的模型制作项目。',
        v_author_id, v_sub_id, 3, 90, 'draft', '/projects/eng_models.webp',
        ARRAY['建筑','规划','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大号硬纸板或木板（底座）', 1),
        (v_project_id, '小纸盒若干（做建筑）', 2),
        (v_project_id, '绿色海绵或棉花（做绿化）', 3),
        (v_project_id, '灰色卡纸（做道路）', 4),
        (v_project_id, '丙烯颜料和画笔', 5),
        (v_project_id, '白胶和剪刀', 6),
        (v_project_id, '小树模型或牙签（做路灯）', 7),
        (v_project_id, '铅笔和直尺', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绘制规划图', '在纸上画出社区的平面规划图，确定道路走向、建筑位置、绿化区域和公共设施。', 1),
        (v_project_id, '制作建筑模型', '用小纸盒制作不同大小的房屋、商店和学校，涂上颜色并画出门窗细节。', 2),
        (v_project_id, '铺设道路', '在底座上按规划图铺贴灰色卡纸做道路，画上车道线和斑马线。', 3),
        (v_project_id, '布置绿化', '用绿色海绵做草坪，牙签插绿色纸团做小树，布置公园和行道树。', 4),
        (v_project_id, '安装设施', '添加路灯、长椅、停车场等公共设施的微缩模型，让社区更加完整。', 5),
        (v_project_id, '整体调整', '从高处俯瞰沙盘全貌，调整各部件位置和细节，确保整体布局美观合理。', 6);

    -- Project 13: 地球内部结构模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '地球内部结构模型',
        '制作一个可以切开展示的地球分层模型，展示地壳、地幔、外核和内核四个圈层！参与者将了解地球并非实心球体，而是由不同物质和温度的圈层组成。通过颜色区分各层，直观理解地球内部构造。',
        v_author_id, v_sub_id, 4, 60, 'approved', '/projects/eng_models.webp',
        ARRAY['地质','分层','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '超轻黏土（红、橙、黄、蓝色）', 1),
        (v_project_id, '泡沫球（直径约10厘米）', 2),
        (v_project_id, '小刀（需成年人辅助）', 3),
        (v_project_id, '丙烯颜料', 4),
        (v_project_id, '标签纸和细铁丝', 5),
        (v_project_id, '参考地球结构图', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习地球圈层', '查阅资料了解地球的四个圈层：地壳（薄而坚硬）、地幔（高温半流动）、外核（液态金属）、内核（固态金属）。', 1),
        (v_project_id, '逐层包裹', '先用红色黏土做一个小球代表内核，再依次用橙色（外核）、黄色（地幔）、蓝色（地壳）层层包裹。', 2),
        (v_project_id, '切开截面', '在成年人帮助下将球体切成两半或四分之一，露出内部的分层结构。', 3),
        (v_project_id, '绘制地表', '在蓝色地壳表面用颜料画出简化的大陆和海洋轮廓。', 4),
        (v_project_id, '标注各圈层', '用标签纸标注每一层的名称、厚度和主要特征（温度、状态等）。', 5),
        (v_project_id, '讲解地球知识', '对照模型讲解地球内部结构，讨论地震波如何帮助科学家探测地球内部。', 6);

    -- Project 14: 水循环演示模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '水循环演示模型',
        '制作一个能真实演示蒸发、凝结和降水过程的水循环模型！在密封容器中用热水和冰块模拟自然界的水循环。参与者将直观看到水蒸气上升、遇冷凝结成水滴并"降雨"的完整过程。',
        v_author_id, v_sub_id, 4, 50, 'approved', '/projects/eng_models.webp',
        ARRAY['水循环','动态','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大号透明塑料盒（带盖）', 1),
        (v_project_id, '小碗（装热水用）', 2),
        (v_project_id, '冰块', 3),
        (v_project_id, '蓝色食用色素', 4),
        (v_project_id, '黏土或石子（做地形）', 5),
        (v_project_id, '小塑料植物或绿色海绵', 6),
        (v_project_id, '保鲜膜（备用密封）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建地形', '在塑料盒一侧用黏土和石子堆出高低不平的"山地"，另一侧做一个低洼处代表"湖泊"。', 1),
        (v_project_id, '布置植被', '在"山地"上放置小塑料植物或绿色海绵，模拟自然植被覆盖。', 2),
        (v_project_id, '注入温水', '在低洼处倒入加了蓝色色素的温水代表湖水，水量不宜太多。', 3),
        (v_project_id, '加热蒸发', '将装有热水的小碗放在盒内湖水旁边提供热源，盖上盖子，在盖子外侧放上冰块。', 4),
        (v_project_id, '观察水循环', '观察温水蒸发后水蒸气上升，遇到冰冷的盖子凝结成小水滴，水滴汇集后滴落回"地面"。', 5),
        (v_project_id, '总结原理', '对照模型讲解自然界水循环的完整过程：蒸发→上升→凝结→降水→汇流，循环往复。', 6);

    -- Project 15: 心脏工作模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '心脏工作模型',
        '用塑料瓶和气球制作一个可以模拟心脏泵血功能的工作模型！按压气球时水会被"泵"出，松手时水又被吸入。参与者将直观理解心脏的四个腔室如何通过收缩和舒张来推动血液循环。',
        v_author_id, v_sub_id, 4, 45, 'approved', '/projects/eng_models.webp',
        ARRAY['人体','循环','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '塑料瓶 2个', 1),
        (v_project_id, '气球 2个', 2),
        (v_project_id, '吸管 4根', 3),
        (v_project_id, '红色和蓝色颜料', 4),
        (v_project_id, '热熔胶', 5),
        (v_project_id, '剪刀', 6),
        (v_project_id, '水盆', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作泵体', '将塑料瓶底部剪掉，在瓶口套上气球并用胶固定密封，气球面朝外作为"心室壁"。', 1),
        (v_project_id, '安装管道', '在瓶身侧面插入两根吸管作为进出血管，用热熔胶密封连接处防止漏水。', 2),
        (v_project_id, '制作单向阀', '在吸管内端用小片气球膜做成单向活瓣，确保水只能朝一个方向流动。', 3),
        (v_project_id, '组装并测试', '将模型放入水盆，用红色颜料水代表血液，反复按压气球观察水流方向。', 4),
        (v_project_id, '讲解心脏原理', '对照模型讲解心脏的工作方式：心室收缩时血液被泵出，舒张时血液被吸入，瓣膜防止回流。', 5);

    -- Project 16: 比例建筑模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '比例建筑模型',
        '选择一座著名建筑，按照精确比例缩小制作它的模型！参与者将学习比例尺的概念和应用，掌握精确测量和等比缩放的方法。这个项目对耐心和精确度要求较高，适合有一定手工基础的参与者。',
        v_author_id, v_sub_id, 4, 90, 'approved', '/projects/eng_models.webp',
        ARRAY['建筑','精确比例','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '巴尔沙木或硬纸板', 1),
        (v_project_id, '直尺和三角尺', 2),
        (v_project_id, '美工刀（需成年人辅助）', 3),
        (v_project_id, '白胶', 4),
        (v_project_id, '铅笔和橡皮', 5),
        (v_project_id, '丙烯颜料', 6),
        (v_project_id, '参考建筑图片和尺寸资料', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选定建筑与比例', '选择一座感兴趣的建筑（如天安门或埃菲尔铁塔），查阅实际尺寸，确定缩小比例（如1:200）。', 1),
        (v_project_id, '绘制图纸', '按比例尺将建筑的正面、侧面和顶部投影图精确地画在纸上，标注所有尺寸。', 2),
        (v_project_id, '裁切零件', '按照图纸在纸板或巴尔沙木上精确划线并裁切出所有零部件。', 3),
        (v_project_id, '组装结构', '按照从底部到顶部的顺序逐步粘合各零件，随时用直尺检查垂直度和水平度。', 4),
        (v_project_id, '细节处理', '添加窗户、门、栏杆等精细装饰，用颜料上色还原建筑真实外观。', 5),
        (v_project_id, '验证比例', '测量模型各部位尺寸，验证与原建筑的比例是否一致，总结比例尺的应用方法。', 6);

    -- Project 17: 可活动人体骨骼模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '可活动人体骨骼模型',
        '用硬纸板制作一个各关节可以活动的人体骨骼模型！用铆钉或图钉连接各骨骼部件，实现肩、肘、髋、膝等关节的真实运动。参与者将深入了解人体骨骼系统的206块骨骼和主要关节的运动方式。',
        v_author_id, v_sub_id, 5, 120, 'draft', '/projects/eng_models.webp',
        ARRAY['解剖','关节','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白色硬卡纸 5-6张', 1),
        (v_project_id, '两脚钉（铆钉）20个', 2),
        (v_project_id, '剪刀和打孔器', 3),
        (v_project_id, '铅笔和橡皮', 4),
        (v_project_id, '人体骨骼参考图', 5),
        (v_project_id, '细线（悬挂用）', 6),
        (v_project_id, '黑色记号笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '研究骨骼结构', '对照人体骨骼图，了解主要骨骼的名称、形状和关节连接方式（球窝关节、铰链关节等）。', 1),
        (v_project_id, '绘制骨骼部件', '在白色卡纸上分别画出头骨、脊柱、肋骨、上臂骨、前臂骨、手掌、大腿骨、小腿骨、脚掌等部件。', 2),
        (v_project_id, '剪裁打孔', '仔细剪出每个骨骼部件，在关节连接处用打孔器打孔。', 3),
        (v_project_id, '铆钉连接关节', '用两脚钉将各部件在关节处连接起来，确保连接松紧适度，能灵活转动但不会太松。', 4),
        (v_project_id, '标注骨骼名称', '用记号笔在各骨骼部件上写上名称，如肱骨、股骨、胫骨、肋骨等。', 5),
        (v_project_id, '悬挂展示', '在头骨顶部系上细线悬挂起来，尝试活动各关节，讲解不同关节的运动方式和范围。', 6);

    -- Project 18: 生态系统微缩模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '生态系统微缩模型',
        '在一个大玻璃容器中构建一个完整的微型生态系统，包含土壤、植物、水体和小动物模型！参与者将学习食物链、能量流动和物质循环等生态学核心概念。这是一个需要综合运用多学科知识的复杂项目。',
        v_author_id, v_sub_id, 5, 120, 'draft', '/projects/eng_models.webp',
        ARRAY['生态','综合','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大号玻璃鱼缸或透明盒子', 1),
        (v_project_id, '小石子和沙子（做地形）', 2),
        (v_project_id, '真苔藓和小植物', 3),
        (v_project_id, '超轻黏土（做动物模型）', 4),
        (v_project_id, '蓝色凝胶或树脂（做水体）', 5),
        (v_project_id, '小枯枝和树皮', 6),
        (v_project_id, '微型LED灯（模拟阳光，可选）', 7),
        (v_project_id, '标签纸和细铁丝', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择生态类型', '决定要模拟的生态系统类型（森林、池塘、草原或沙漠），查阅该生态系统中的典型生物。', 1),
        (v_project_id, '构建地形', '用石子和沙子在容器内塑造地形，包括高低起伏的陆地和低洼的水域区域。', 2),
        (v_project_id, '种植植物', '在适当位置铺设苔藓、种植小植物，用枯枝营造林地效果。', 3),
        (v_project_id, '制作动物模型', '用黏土制作该生态系统中的代表性动物（如兔子、鹰、蛇等），放置在合理位置。', 4),
        (v_project_id, '标注食物链', '用标签和箭头标注出生态系统中的食物链关系：植物→草食动物→肉食动物→分解者。', 5),
        (v_project_id, '讲解生态原理', '对照模型讲解能量流动和物质循环，讨论如果某个环节被破坏会对整个生态系统产生什么影响。', 6);

    -- Project 19: 机械钟表模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '机械钟表模型',
        '用硬纸板制作一个展示齿轮传动原理的机械钟表模型！通过多个互相咬合的齿轮，将动力从发条传递到指针。参与者将深入理解齿轮比、传动速率和机械能转换的工程原理。',
        v_author_id, v_sub_id, 5, 150, 'approved', '/projects/eng_models.webp',
        ARRAY['钟表','齿轮','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '厚硬纸板或薄木板', 1),
        (v_project_id, '圆规和直尺', 2),
        (v_project_id, '美工刀（需成年人辅助）', 3),
        (v_project_id, '竹签或木棍（做齿轮轴）', 4),
        (v_project_id, '热熔胶', 5),
        (v_project_id, '铅笔和橡皮', 6),
        (v_project_id, '图钉或螺丝（做转轴）', 7),
        (v_project_id, '钟表机芯参考图', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习齿轮原理', '了解齿轮传动的基本知识：齿轮比、转速关系（大齿轮带小齿轮转快、小齿轮带大齿轮转慢）。', 1),
        (v_project_id, '设计齿轮组', '在纸上设计3-4个不同大小的齿轮，计算齿数和模数，确保相邻齿轮能正确啮合。', 2),
        (v_project_id, '制作齿轮', '用圆规在纸板上画出齿轮轮廓，用美工刀仔细裁切出齿形，中心打孔装入轴。', 3),
        (v_project_id, '组装传动系统', '将齿轮安装在背板上的对应位置，调整轴距使齿轮顺畅啮合，转动一个齿轮时其他齿轮联动。', 4),
        (v_project_id, '安装表盘和指针', '制作一个钟表表盘固定在前面，将最后一级齿轮的轴穿过表盘连接指针。', 5),
        (v_project_id, '测试与调整', '转动驱动齿轮测试整个传动链是否顺畅，讨论齿轮比如何决定时针和分针的转速差异。', 6);

    -- Project 20: 城市规划沙盘
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '城市规划沙盘',
        '设计并制作一个完整的城市微缩沙盘，包含住宅区、商业区、工业区、交通系统和公共绿地！参与者将综合运用建筑、规划和工程知识，思考城市功能分区和交通组织的合理性。这是模型制作的高阶挑战项目。',
        v_author_id, v_sub_id, 5, 180, 'draft', '/projects/eng_models.webp',
        ARRAY['城市','综合设计','工程','模型'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大号木板或泡沫板（60×80厘米以上）', 1),
        (v_project_id, '各种小纸盒和纸板', 2),
        (v_project_id, '灰色卡纸（做道路）', 3),
        (v_project_id, '绿色海绵和假草皮', 4),
        (v_project_id, '蓝色玻璃纸或凝胶（做河流）', 5),
        (v_project_id, '丙烯颜料和画笔', 6),
        (v_project_id, '小型车辆和人物模型（可选）', 7),
        (v_project_id, '白胶、热熔胶和剪刀', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '城市功能规划', '在纸上绘制城市总体规划图，划分住宅区、商业区、工业区、绿化带，规划主干道和河流走向。', 1),
        (v_project_id, '制作建筑群', '用纸盒制作不同高度和风格的建筑：住宅楼、写字楼、工厂、学校、医院等，涂上不同颜色区分功能。', 2),
        (v_project_id, '铺设交通网', '在底板上铺贴道路，制作十字路口、环形交叉和立交桥模型，画出交通标线。', 3),
        (v_project_id, '布置绿地和水系', '用假草皮做公园和绿化带，蓝色玻璃纸做河流和湖泊，添加桥梁连接两岸。', 4),
        (v_project_id, '安放建筑与设施', '将制作好的建筑按功能分区放置到对应位置，添加路灯、公交站、停车场等配套设施。', 5),
        (v_project_id, '总结与评估', '从城市规划角度评估沙盘：功能分区是否合理、交通是否便捷、绿化是否充足，讨论改进方案。', 6);

END $$;
