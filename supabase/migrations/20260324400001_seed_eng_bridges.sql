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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '桥梁建造' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 桥梁建造'; END IF;

    -- Project 1: 纸张折叠桥
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '纸张折叠桥',
        '用一张普通的A4纸通过不同的折叠方式搭建一座能承重的小桥！参与者将体验折叠如何改变纸张的强度，理解折叠结构在工程中的应用。简单的材料就能创造令人惊叹的承重效果。',
        v_author_id, v_sub_id, 1, 15, 'approved', '/projects/eng_bridges.webp',
        ARRAY['折叠','承重','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'A4纸 5张', 1),
        (v_project_id, '两摞等高的书本（作为桥墩）', 2),
        (v_project_id, '硬币若干（作为重物）', 3),
        (v_project_id, '直尺', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建桥墩', '将两摞等高的书本平放在桌上，间距约15厘米，作为桥的两个支撑点。', 1),
        (v_project_id, '测试平铺纸桥', '先将一张未折叠的纸平放在两摞书之间，轻轻放上硬币测试承重，记录纸塌陷时的硬币数。', 2),
        (v_project_id, '折叠纸张', '将另一张纸按手风琴式反复折叠成波浪形，折痕间距约1.5厘米，折好后放在两摞书之间。', 3),
        (v_project_id, '承重对比', '在折叠后的纸桥上逐枚放硬币，记录塌陷时的硬币数，与平铺纸桥对比承重差异。', 4),
        (v_project_id, '讨论原理', '讨论为什么折叠后纸张能承受更多重量：折叠增加了截面高度，分散了受力面积。', 5);

    -- Project 2: 积木桥梁搭建
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '积木桥梁搭建',
        '用积木搭建各种桥梁结构，探索平衡与稳定的奥秘！参与者将在搭建过程中感受重力和支撑力的关系，了解桥梁为什么需要稳固的基础。这是认识桥梁结构的绝佳入门项目。',
        v_author_id, v_sub_id, 1, 20, 'draft', '/projects/eng_bridges.webp',
        ARRAY['平衡','结构','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '木质积木一套（至少30块）', 1),
        (v_project_id, '小玩具车（作为通行测试）', 2),
        (v_project_id, '硬纸板 1张（作桥面）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '规划桥梁', '用积木在桌上摆出桥梁的大致轮廓，确定桥墩位置和桥面高度。', 1),
        (v_project_id, '搭建桥墩', '用长方形积木在两侧交错叠放搭建桥墩，确保每层积木对齐稳固。', 2),
        (v_project_id, '铺设桥面', '将硬纸板或长积木横搭在两个桥墩之间，形成桥面，调整使其平稳。', 3),
        (v_project_id, '通行测试', '让小玩具车在桥上通过，观察桥梁是否稳固，如果晃动则加固桥墩。', 4),
        (v_project_id, '改进设计', '尝试加高桥墩或加宽桥面，讨论哪种搭建方式最稳定，为什么底座宽大更不容易倒。', 5);

    -- Project 3: 吸管桥梁
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '吸管桥梁',
        '用普通吸管和胶带搭建一座轻巧的桥梁，挑战用最少材料承受最大重量！参与者将学会如何连接轻质材料形成稳定结构，了解工程师如何在轻量化和强度之间寻找平衡。',
        v_author_id, v_sub_id, 1, 25, 'approved', '/projects/eng_bridges.webp',
        ARRAY['轻量','连接','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '塑料吸管 20根', 1),
        (v_project_id, '透明胶带', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '两个纸杯（作桥墩）', 4),
        (v_project_id, '小玩具或硬币（测试承重）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计桥型', '观察几种常见桥梁图片，选择一种简单的梁桥造型，用铅笔画出设计草图。', 1),
        (v_project_id, '制作桥面', '将4-5根吸管平行排列，用胶带固定成一个平面，作为桥面主体。', 2),
        (v_project_id, '加固结构', '在桥面下方用吸管制作X形或三角形支撑，用胶带牢固粘接每个连接点。', 3),
        (v_project_id, '架桥测试', '将两个纸杯倒扣作为桥墩，把吸管桥架在上面，逐个放置硬币测试承重极限。', 4);

    -- Project 4: 纸杯堆叠挑战
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '纸杯堆叠挑战',
        '用纸杯和纸板交替堆叠，搭建一座又高又稳的桥塔结构！参与者将在实践中感受结构稳定性的重要，了解底部宽大、层层递减的金字塔形为何最稳定。简单材料也能建出惊人的高度。',
        v_author_id, v_sub_id, 1, 20, 'draft', '/projects/eng_bridges.webp',
        ARRAY['结构','稳定','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '一次性纸杯 30个', 1),
        (v_project_id, '硬纸板（裁成长方形）10张', 2),
        (v_project_id, '直尺', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '铺设底层', '将6个纸杯倒扣排成一排，保持等间距，在上面平放一块硬纸板作为第一层桥面。', 1),
        (v_project_id, '逐层递减', '在纸板上再放5个纸杯，再盖纸板，依次递减纸杯数量，每层少一个。', 2),
        (v_project_id, '挑战高度', '尽可能往上堆叠更多层，观察结构在哪一层开始变得不稳定。', 3),
        (v_project_id, '总结规律', '讨论为什么底大顶小的结构最稳定，测量最终高度并记录各种堆法的对比结果。', 4);

    -- Project 5: 纸桥承重实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '纸桥承重实验',
        '用不同折叠方式制作纸桥并进行系统的承重测试，探索哪种折法最强！参与者将用科学对比实验的方法，量化测量不同结构的承重能力。培养实验记录和数据对比分析的能力。',
        v_author_id, v_sub_id, 2, 30, 'approved', '/projects/eng_bridges.webp',
        ARRAY['结构','折叠','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'A4纸 10张', 1),
        (v_project_id, '两摞等高书本', 2),
        (v_project_id, '一次性纸杯 1个', 3),
        (v_project_id, '硬币或玻璃弹珠若干', 4),
        (v_project_id, '记录本和笔', 5),
        (v_project_id, '直尺', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备不同折法', '分别用平铺、波浪折、卷筒形、U形槽四种方式制作4座纸桥，每座用1张纸。', 1),
        (v_project_id, '统一测试条件', '将两摞书设置为相同间距（15厘米），在每座纸桥中央放一个纸杯用于盛放重物。', 2),
        (v_project_id, '逐个测试', '依次在纸杯中放入硬币或弹珠，记录每座桥塌陷时的重量，每种折法测试两次取平均值。', 3),
        (v_project_id, '制作对比图表', '将结果整理成表格或柱状图，直观对比不同折法的承重能力。', 4),
        (v_project_id, '分析结论', '讨论为什么某种折法承重最强，思考折叠结构如何改变力的传递路径。', 5);

    -- Project 6: 冰棍棒平板桥
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '冰棍棒平板桥',
        '用冰棍棒和白胶搭建一座简单的平板桥，学习粘合与承重的关系！参与者将掌握基本的木质材料粘接技巧，了解多层叠合如何增强结构强度。完成后可以涂色装饰。',
        v_author_id, v_sub_id, 2, 35, 'approved', '/projects/eng_bridges.webp',
        ARRAY['粘合','承重','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '冰棍棒 50根', 1),
        (v_project_id, '白胶（木工胶）', 2),
        (v_project_id, '橡皮筋 若干', 3),
        (v_project_id, '剪刀', 4),
        (v_project_id, '纸杯2个（作桥墩）', 5),
        (v_project_id, '硬币（测试用）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作桥面板', '将10根冰棍棒紧密排列，用两根横向冰棍棒粘在上面固定，形成一个平面桥板。', 1),
        (v_project_id, '制作护栏', '在桥面两侧各粘一排冰棍棒作为护栏，增强桥面的横向稳定性。', 2),
        (v_project_id, '加固底部', '在桥面底部中间位置粘上2-3根纵向冰棍棒作为加强梁，用橡皮筋夹紧等待胶干。', 3),
        (v_project_id, '组装测试', '将纸杯倒扣作为桥墩，架上桥面，逐枚放硬币测试承重能力。', 4),
        (v_project_id, '优化改进', '根据断裂位置分析薄弱点，增加冰棍棒加固后再次测试，对比改进前后的承重数据。', 5);

    -- Project 7: 意大利面桥
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '意大利面桥',
        '用干燥的意大利面条和棉花糖搭建桥梁，挑战脆性材料的极限！参与者将体验脆性材料在受压和受拉时的不同表现，学会如何利用三角形结构来分散应力。这是全球经典的STEM挑战项目。',
        v_author_id, v_sub_id, 2, 30, 'approved', '/projects/eng_bridges.webp',
        ARRAY['脆性材料','结构','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '意大利直面（细款）1包', 1),
        (v_project_id, '棉花糖 1袋（作连接点）', 2),
        (v_project_id, '两个纸盒（作桥墩）', 3),
        (v_project_id, '小纸杯（盛放重物）', 4),
        (v_project_id, '硬币若干', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识材料', '折断一根意大利面感受它的脆性，讨论脆性材料怕弯折但能承受压力的特点。', 1),
        (v_project_id, '搭建三角单元', '用3根面条和3个棉花糖组成一个三角形，制作6-8个相同的三角形单元。', 2),
        (v_project_id, '组装桥身', '将三角形单元用面条和棉花糖连接成桥的形状，确保每个节点牢固。', 3),
        (v_project_id, '架桥承重', '将桥架在两个纸盒之间，在中间挂上纸杯，逐个放入硬币测试承重极限。', 4),
        (v_project_id, '分析失败点', '观察桥断裂的位置和方式，讨论如何改进设计以避免薄弱点。', 5);

    -- Project 8: 纸板拱桥
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '纸板拱桥',
        '用硬纸板制作一座漂亮的拱桥，探索拱形结构为什么特别能承重！参与者将直观理解拱形如何将向下的力分散到两侧桥墩，明白古代石拱桥千年不倒的力学秘密。',
        v_author_id, v_sub_id, 2, 30, 'approved', '/projects/eng_bridges.webp',
        ARRAY['拱形','分力','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板（瓦楞纸板）2张', 1),
        (v_project_id, '剪刀', 2),
        (v_project_id, '胶带和白胶', 3),
        (v_project_id, '直尺和铅笔', 4),
        (v_project_id, '重物（书本或罐头）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '裁剪拱形', '在纸板上用铅笔画出半圆拱形的轮廓，裁剪出两片相同的拱形侧板。', 1),
        (v_project_id, '制作桥面', '裁一条长方形纸板弯成拱形，粘贴在两片侧板之间，形成拱桥的主体。', 2),
        (v_project_id, '加固桥墩', '在拱桥两端底部粘贴额外纸板加固桥墩部分，确保底部平整不会滑动。', 3),
        (v_project_id, '承重测试', '在拱桥顶部逐步放置重物，观察拱形结构在受力时的表现。', 4),
        (v_project_id, '对比实验', '制作一座同样纸板的平桥进行对比承重测试，直观感受拱形结构的力学优势。', 5);

    -- Project 9: 冰棍棒桁架桥
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '冰棍棒桁架桥',
        '用冰棍棒搭建真正的桁架结构桥梁，体验三角形是最稳定几何形状的工程原理！参与者将学习桁架桥的基本构造，理解为什么铁路桥和钢桥大量使用三角形桁架。这是进阶桥梁工程的标志性项目。',
        v_author_id, v_sub_id, 3, 50, 'approved', '/projects/eng_bridges.webp',
        ARRAY['桁架','三角形','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '冰棍棒 80根', 1),
        (v_project_id, '白胶（木工胶）', 2),
        (v_project_id, '夹子或橡皮筋（固定用）', 3),
        (v_project_id, '直尺和铅笔', 4),
        (v_project_id, '砂纸（细目）', 5),
        (v_project_id, '重物（测试用）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计桁架图', '在纸上画出桁架桥的设计图，标注三角形的排列方式和尺寸，计划所需冰棍棒数量。', 1),
        (v_project_id, '制作桁架侧面', '用冰棍棒按设计图拼出一侧桁架，先排列再逐个胶粘，用夹子固定等干。制作两片相同的桁架。', 2),
        (v_project_id, '连接两侧桁架', '用短截冰棍棒将两片桁架的对应节点横向连接，形成立体桥身。', 3),
        (v_project_id, '铺设桥面', '在桥身顶部或底部粘上一排冰棍棒作为桥面，确保平整。', 4),
        (v_project_id, '承重测试', '将桥架在两个支撑点之间，在中间逐步加载重物，记录最大承重量。', 5),
        (v_project_id, '评估优化', '观察受力后哪些节点出现松动或变形，分析改进方案并讨论真实桁架桥的工程案例。', 6);

    -- Project 10: 悬索桥模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '悬索桥模型',
        '用绳子和纸板搭建一座迷你悬索桥，探索拉力在桥梁中的奇妙作用！参与者将了解金门大桥等著名悬索桥的工作原理，理解主缆、吊索和桥面之间的力学关系。',
        v_author_id, v_sub_id, 3, 45, 'approved', '/projects/eng_bridges.webp',
        ARRAY['悬索','拉力','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板（做桥面和塔柱）', 1),
        (v_project_id, '棉线或细绳 2米', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '胶带和白胶', 4),
        (v_project_id, '两个纸盒（做桥塔底座）', 5),
        (v_project_id, '竹签 4根（做桥塔）', 6),
        (v_project_id, '小夹子若干', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建桥塔', '将竹签两两绑成A字形，插在纸盒上形成两座桥塔，间距约30厘米。', 1),
        (v_project_id, '架设主缆', '将一根长绳从一侧桥塔顶部经过另一侧顶部固定，使绳子自然下垂呈抛物线。', 2),
        (v_project_id, '安装吊索', '用短绳从主缆上等间距垂下，每根短绳底端用夹子夹住纸板桥面的边缘。', 3),
        (v_project_id, '调整桥面', '调整各吊索长度使桥面水平，确保桥面不会前后倾斜或晃动过大。', 4),
        (v_project_id, '测试与讨论', '在桥面放置小物件测试稳定性，讨论悬索桥如何通过拉力将重量传递到桥塔和锚碇。', 5);

    -- Project 11: 竹签桥梁
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '竹签桥梁',
        '用竹签和热熔胶搭建精致的桥梁模型，锻炼精细节点连接技巧！参与者将学习如何在小尺寸结构中保持节点的强度和精确度，体验工程中"连接决定强度"的核心理念。',
        v_author_id, v_sub_id, 3, 45, 'approved', '/projects/eng_bridges.webp',
        ARRAY['节点','胶合','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '竹签（烧烤签）50根', 1),
        (v_project_id, '热熔胶枪和胶棒', 2),
        (v_project_id, '剪刀或钳子', 3),
        (v_project_id, '直尺和铅笔', 4),
        (v_project_id, '硬纸板（底板）', 5),
        (v_project_id, '重物（测试用）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计与裁切', '画出桥梁设计图，按尺寸用剪刀将竹签裁切成不同长度，分类摆放。', 1),
        (v_project_id, '搭建底梁', '用两根长竹签作为桥的主纵梁，每隔2厘米用短竹签横向连接，形成桥面骨架。', 2),
        (v_project_id, '添加斜撑', '在骨架侧面添加对角斜撑竹签，形成三角形加固结构，用热熔胶固定每个交叉点。', 3),
        (v_project_id, '安装桥面', '在骨架顶部密铺一排竹签作为桥面，胶粘固定，修剪齐整。', 4),
        (v_project_id, '承重测试', '将桥架在两个支点间，逐步添加重物记录最大承重，分析哪些节点最先损坏。', 5);

    -- Project 12: 自锁桥（达芬奇桥）
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '自锁桥（达芬奇桥）',
        '不用任何胶水或绳子，仅靠木棍之间的摩擦力和互锁关系搭建一座自支撑桥！参与者将惊叹于达芬奇500多年前的天才设计，理解摩擦力和结构互锁如何替代粘合剂。',
        v_author_id, v_sub_id, 3, 30, 'approved', '/projects/eng_bridges.webp',
        ARRAY['摩擦力','互锁','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '冰棍棒或筷子 20根（长度一致）', 1),
        (v_project_id, '橡皮筋 若干（辅助练习用）', 2),
        (v_project_id, '平整桌面', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习原理', '观看达芬奇桥的图片或视频，理解每根木棍如何压住相邻木棍形成互锁。', 1),
        (v_project_id, '练习基本单元', '先用3根棍子练习最基本的交叉互锁：两根平行，一根垂直压在上面并插入下方两根之间。', 2),
        (v_project_id, '逐步延伸', '在掌握基本单元后，一根接一根地添加新棍子，每根都按"上压下穿"的规律编织进去。', 3),
        (v_project_id, '形成拱形', '当棍子数量足够时，整体结构会自然弯曲形成优美的拱桥形状。', 4),
        (v_project_id, '测试与欣赏', '轻按桥面测试强度，讨论这座桥为什么不需要任何连接材料就能稳固站立。', 5);

    -- Project 13: 开合桥模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '开合桥模型',
        '制作一座可以打开让"船只"通过的开合桥模型，引入简单的机械结构！参与者将学习铰链的工作原理，用注射器和水管模拟液压系统驱动桥面升降。机械与结构的完美结合。',
        v_author_id, v_sub_id, 4, 60, 'draft', '/projects/eng_bridges.webp',
        ARRAY['铰链','液压','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板（做桥身）', 1),
        (v_project_id, '冰棍棒 30根', 2),
        (v_project_id, '注射器（无针头）2个', 3),
        (v_project_id, '软管 1段（连接注射器）', 4),
        (v_project_id, '铁丝或牙签（做铰链轴）', 5),
        (v_project_id, '白胶和胶带', 6),
        (v_project_id, '水和食用色素', 7),
        (v_project_id, '剪刀', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作桥身', '用冰棍棒和纸板搭建桥的固定部分和两扇可活动的桥面板。', 1),
        (v_project_id, '安装铰链', '在桥面板与桥身连接处用铁丝穿过作为铰链轴，确保桥面可以绕轴旋转抬起。', 2),
        (v_project_id, '搭建液压系统', '将两个注射器用软管连接并灌满有色水，一个固定在桥身下方，活塞杆顶住桥面板底部。', 3),
        (v_project_id, '测试开合', '推动另一端注射器的活塞，水压传递到桥下的注射器将桥面顶起，实现开合功能。', 4),
        (v_project_id, '通行演示', '打开桥面让纸船模型通过，再关闭桥面让小车通行，完整演示开合桥的运作。', 5);

    -- Project 14: 斜拉桥模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '斜拉桥模型',
        '制作一座带有标志性斜拉钢缆的桥梁模型，分析每根拉索承受力的方向和大小！参与者将了解现代斜拉桥的设计原理，理解拉索如何将桥面重量高效传递到桥塔。',
        v_author_id, v_sub_id, 4, 60, 'draft', '/projects/eng_bridges.webp',
        ARRAY['斜拉','力分析','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板和卡纸', 1),
        (v_project_id, '竹签或木棒（做桥塔）', 2),
        (v_project_id, '棉线 3米', 3),
        (v_project_id, '冰棍棒 40根', 4),
        (v_project_id, '热熔胶枪', 5),
        (v_project_id, '剪刀和直尺', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建桥面', '用冰棍棒平铺并粘合成一条长桥面板，长度约40厘米，宽度约8厘米。', 1),
        (v_project_id, '制作桥塔', '用竹签或木棒在桥面中部竖立一根高塔（约20厘米），用纸板三角支架加固塔根。', 2),
        (v_project_id, '安装斜拉索', '从塔顶向桥面两侧等间距拉出棉线并固定，形成扇形的斜拉索阵列，每侧4-5根。', 3),
        (v_project_id, '调整张力', '逐根调整拉索的松紧度，使桥面在无载荷时保持水平，所有拉索均匀受力。', 4),
        (v_project_id, '加载测试', '在桥面不同位置放置重物，观察拉索的张紧变化和桥面的下挠情况。', 5),
        (v_project_id, '力学分析', '讨论斜拉桥与悬索桥的区别，分析为什么不同角度的拉索承受的力大小不同。', 6);

    -- Project 15: 承重优化挑战
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '承重优化挑战',
        '在限定材料和重量条件下，设计并建造承重比最大的桥梁！参与者将体验真正的工程优化过程，反复迭代设计方案，在材料用量和承重能力之间找到最佳平衡点。',
        v_author_id, v_sub_id, 4, 60, 'draft', '/projects/eng_bridges.webp',
        ARRAY['结构优化','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '冰棍棒 限定50根', 1),
        (v_project_id, '白胶', 2),
        (v_project_id, '厨房秤（称桥重）', 3),
        (v_project_id, '重物或沙袋（测承重）', 4),
        (v_project_id, '记录本和笔', 5),
        (v_project_id, '直尺和铅笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '确定规则', '设定挑战规则：桥跨度不小于25厘米，仅用50根冰棍棒和白胶，比拼"承重÷桥重"的效率比。', 1),
        (v_project_id, '设计方案', '画出至少两种不同的桥梁设计草图，标注每种方案的冰棍棒分配和结构特点。', 2),
        (v_project_id, '建造第一版', '选择一种方案开始建造，注意节约材料，每个节点的胶量尽量少而牢固。', 3),
        (v_project_id, '测试记录', '称量桥的自重，然后进行承重测试记录最大承重值，计算效率比。', 4),
        (v_project_id, '迭代优化', '根据第一版的测试结果分析弱点，建造改进版本，对比两版数据。', 5),
        (v_project_id, '总结经验', '总结哪些设计策略最有效，讨论工程优化中"迭代改进"的重要性。', 6);

    -- Project 16: 多材料复合桥
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '多材料复合桥',
        '综合使用纸板、冰棍棒、绳子等多种材料搭建一座复合桥梁，发挥每种材料的最佳特性！参与者将理解复合材料的设计理念——用抗压材料做柱子、用抗拉材料做拉索、用轻质材料做桥面。',
        v_author_id, v_sub_id, 4, 50, 'approved', '/projects/eng_bridges.webp',
        ARRAY['复合材料','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板（做桥面）', 1),
        (v_project_id, '冰棍棒 30根（做桁架）', 2),
        (v_project_id, '棉线 1米（做拉索）', 3),
        (v_project_id, '竹签 10根（做斜撑）', 4),
        (v_project_id, '白胶和胶带', 5),
        (v_project_id, '剪刀和直尺', 6),
        (v_project_id, '重物（测试用）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '材料分析', '逐一测试每种材料的特性：弯折纸板感受柔韧、压冰棍棒感受硬度、拉棉线感受韧性。', 1),
        (v_project_id, '分配角色', '根据材料特性分配功能：冰棍棒做主梁（抗压），棉线做拉索（抗拉），纸板做桥面（轻质大面积）。', 2),
        (v_project_id, '搭建主体', '先用冰棍棒搭建桥梁的承重骨架，再用竹签做斜撑加固。', 3),
        (v_project_id, '添加拉索', '在关键位置用棉线从高点拉向桥面边缘，提供额外的向上拉力支撑。', 4),
        (v_project_id, '铺设桥面', '将裁好的纸板铺在骨架上，用胶带固定边缘，完成桥面装配。', 5),
        (v_project_id, '综合测试', '进行承重测试，分析每种材料在整体中的贡献，讨论为什么多材料配合比单一材料更高效。', 6);

    -- Project 17: 桥梁承重极限测试
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '桥梁承重极限测试',
        '对多种不同设计的桥梁进行系统化的极限承重测试，收集数据并分析规律！参与者将像真正的工程师一样设计实验方案、收集数据、绘制图表，用科学方法评估桥梁结构性能。',
        v_author_id, v_sub_id, 5, 90, 'draft', '/projects/eng_bridges.webp',
        ARRAY['测试','数据分析','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '之前制作的各种桥梁模型（至少3座）', 1),
        (v_project_id, '厨房秤', 2),
        (v_project_id, '标准重物（如等重的硬币或螺母）', 3),
        (v_project_id, '直尺（测量挠度）', 4),
        (v_project_id, '记录本、笔和方格纸', 5),
        (v_project_id, '手机或相机（记录过程）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制定测试方案', '设计标准化测试流程：统一跨度、统一加载位置、统一加载速率，确保对比公平。', 1),
        (v_project_id, '测量基础数据', '用秤称量每座桥的自重，用直尺量取跨度和高度，记录每座桥的结构类型和材料清单。', 2),
        (v_project_id, '逐级加载', '对每座桥从零开始逐级添加重物，每级加载后等待10秒观察是否稳定，记录挠度变化。', 3),
        (v_project_id, '记录破坏过程', '继续加载直到桥梁破坏，记录最大承重值、破坏位置和破坏方式（折断、扭曲、节点脱落等）。', 4),
        (v_project_id, '数据分析', '将所有数据整理成表格，计算每座桥的承重效率比，绘制"载荷-挠度"曲线图。', 5),
        (v_project_id, '撰写报告', '写一份简短的测试报告，总结哪种结构最高效，分析各类桥梁的优缺点和适用场景。', 6);

    -- Project 18: 大跨度桥梁设计
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '大跨度桥梁设计',
        '挑战建造跨度超过50厘米的大型桥梁模型，解决大跨度带来的特殊工程难题！参与者将面对自重增加、中部下挠、侧向不稳等真实工程问题，学习大跨度桥梁设计的核心策略。',
        v_author_id, v_sub_id, 5, 90, 'draft', '/projects/eng_bridges.webp',
        ARRAY['跨度','结构','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '冰棍棒 120根', 1),
        (v_project_id, '竹签 20根', 2),
        (v_project_id, '棉线 3米', 3),
        (v_project_id, '白胶和热熔胶', 4),
        (v_project_id, '硬纸板', 5),
        (v_project_id, '直尺、铅笔和方格纸', 6),
        (v_project_id, '重物（测试用）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '研究大跨度桥', '查阅世界著名大跨度桥梁资料（如港珠澳大桥、明石海峡大桥），总结大跨度设计的关键技术。', 1),
        (v_project_id, '绘制设计图', '在方格纸上精确绘制桥梁设计图，标注尺寸、材料分配和结构细节，跨度目标50厘米以上。', 2),
        (v_project_id, '分段建造', '将桥梁分为左段、中段、右段分别建造，每段独立保证质量后再进行整体拼接。', 3),
        (v_project_id, '整体组装', '将三段依次连接拼装，用拉索和斜撑加强连接部位，确保整体刚性。', 4),
        (v_project_id, '测试与调整', '架桥后检查中部是否下挠，侧向是否稳定，针对薄弱处添加加强构件。', 5),
        (v_project_id, '终极承重', '进行最终承重测试，记录数据并与小跨度桥梁对比，分析跨度增大后效率如何变化。', 6);

    -- Project 19: 桥梁材料对比实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '桥梁材料对比实验',
        '用相同的设计方案分别使用纸、冰棍棒、竹签、吸管等不同材料建造桥梁，系统对比材料性能！参与者将深入理解材料力学的基础概念，体验工程师选择材料时需要考虑的各种因素。',
        v_author_id, v_sub_id, 5, 90, 'draft', '/projects/eng_bridges.webp',
        ARRAY['材料力学','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'A4纸 5张', 1),
        (v_project_id, '冰棍棒 30根', 2),
        (v_project_id, '竹签 30根', 3),
        (v_project_id, '吸管 30根', 4),
        (v_project_id, '白胶和胶带', 5),
        (v_project_id, '厨房秤', 6),
        (v_project_id, '标准重物', 7),
        (v_project_id, '记录本和方格纸', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '统一设计', '设计一种简单的桁架桥方案作为标准，所有材料都按同一图纸建造，仅改变材料。', 1),
        (v_project_id, '分组建造', '分别用纸卷管、冰棍棒、竹签、吸管四种材料建造同样结构的桥梁，注意控制变量。', 2),
        (v_project_id, '材料属性测试', '在建桥前先测试每种材料的单根抗弯强度和重量，记录基础数据。', 3),
        (v_project_id, '统一承重测试', '用相同方法对四座桥进行承重测试，记录最大承重、破坏方式和自重。', 4),
        (v_project_id, '数据对比分析', '制作综合对比表格和图表，从承重、效率比、建造难度、成本等维度全面对比。', 5),
        (v_project_id, '结论与选材建议', '总结每种材料的优缺点，讨论在真实工程中不同场景下该如何选择桥梁材料。', 6);

    -- Project 20: 双桥型受力仿真对比
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '双桥型受力仿真对比',
        '选取两种桥型做基础受力仿真，对比变形和受力分布差异。通过一次小范围仿真练习结构对比分析。',
        v_author_id, v_sub_id, 5, 90, 'draft', '/projects/eng_bridges.webp',
        ARRAY['力学分析','工程','桥梁'], '工程'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '之前建造的桥梁模型 1座', 1),
        (v_project_id, '方格纸和铅笔', 2),
        (v_project_id, '直尺和量角器', 3),
        (v_project_id, '彩色笔（标注不同类型的力）', 4),
        (v_project_id, '弹簧秤（测量力的大小）', 5),
        (v_project_id, '细线（传递力用）', 6),
        (v_project_id, '计算器', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绘制结构简图', '将桥梁模型简化为线条图，标出每个节点和构件的位置，画出结构示意图。', 1),
        (v_project_id, '标注外力', '在结构图上标出桥梁承受的所有外力：自重（向下箭头）、载荷（向下箭头）、支座反力（向上箭头）。', 2),
        (v_project_id, '分析节点受力', '选择关键节点，画出该节点的受力图，标出每根构件上的拉力或压力方向。', 3),
        (v_project_id, '实测验证', '用弹簧秤和细线在实际桥梁模型上测量某些构件的实际受力，与分析结果对比。', 4),
        (v_project_id, '找出薄弱环节', '通过力学分析找出受力最大的构件，验证是否与实际承重测试中最先破坏的位置一致。', 5),
        (v_project_id, '优化设计方案', '根据分析结果提出优化建议：加强受力大的构件、减少受力小的构件用料，实现更高效的结构设计。', 6);

END $$;
