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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '机械结构' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 机械结构'; END IF;

    -- Project 1: 纸板陀螺
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸板陀螺', '用硬纸板和牙签制作一个旋转稳定的陀螺，探索重心与旋转的关系。参与者将在制作和调试过程中理解重心位置如何影响陀螺的平衡与旋转时间。', v_author_id, v_sub_id, 1, 15, 'approved', '/projects/eng_mechanical.webp', ARRAY['旋转','重心','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板（瓦楞纸或卡纸）', 1),
        (v_project_id, '牙签或竹签', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '彩色笔', 4),
        (v_project_id, '圆规或杯盖（画圆用）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '裁剪圆盘', '用圆规或杯盖在硬纸板上画出直径约6厘米的圆，剪下2-3个相同大小的圆盘叠在一起增加厚度。', 1),
        (v_project_id, '安装转轴', '找到圆盘的中心点，用牙签穿过中心，确保牙签垂直于圆盘平面，上下各露出约1.5厘米。', 2),
        (v_project_id, '装饰与配重', '用彩色笔在圆盘上画出螺旋或扇形图案，旋转时会产生有趣的视觉效果。', 3),
        (v_project_id, '调试平衡', '在光滑桌面上旋转陀螺，观察旋转是否稳定。如果晃动严重，调整牙签位置使其恰好在重心处。', 4),
        (v_project_id, '挑战与思考', '尝试改变圆盘大小、厚度和转轴长度，比较哪种组合旋转时间最长，理解重心越低越稳定的原理。', 5);

    -- Project 2: 橡皮筋动力风扇
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('橡皮筋动力风扇', '用橡皮筋的弹性势能驱动一个纸质风扇叶片旋转，感受储能与释放的过程。参与者将直观地理解弹性势能如何转化为动能，体验简易动力机械的工作方式。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/eng_mechanical.webp', ARRAY['弹性势能','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '橡皮筋2-3根', 1),
        (v_project_id, '纸杯', 2),
        (v_project_id, '硬纸板', 3),
        (v_project_id, '竹签', 4),
        (v_project_id, '剪刀和胶带', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作扇叶', '在硬纸板上画出四片扇叶形状并剪下，将每片扇叶略微倾斜折弯，模仿风扇叶片的角度。', 1),
        (v_project_id, '组装转子', '将四片扇叶均匀粘贴在竹签的一端，形成风扇头部，确保扇叶角度一致。', 2),
        (v_project_id, '搭建底座', '在纸杯底部中心戳一个孔，将竹签穿过纸杯底部，竹签需能自由旋转。', 3),
        (v_project_id, '安装橡皮筋', '将橡皮筋套在竹签的尾端，另一端固定在纸杯内壁上。旋转竹签拧紧橡皮筋储存弹性势能。', 4),
        (v_project_id, '释放旋转', '松手释放竹签，观察橡皮筋回弹驱动风扇叶片高速旋转，感受弹性势能转化为动能的过程。', 5);

    -- Project 3: 简易纸弹簧
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('简易纸弹簧', '用两条纸条通过交替折叠的方式制作一个能伸缩弹跳的纸弹簧。这个项目让参与者在折叠中体验弹性结构的原理，理解折叠如何赋予纸张弹性恢复力。', v_author_id, v_sub_id, 1, 15, 'approved', '/projects/eng_mechanical.webp', ARRAY['弹性','折叠','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '彩色纸条若干（宽约2厘米，长约30厘米）', 1),
        (v_project_id, '胶棒或胶水', 2),
        (v_project_id, '剪刀', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '粘合起点', '取两条不同颜色的纸条，将一端呈90度直角粘合在一起，形成L形。', 1),
        (v_project_id, '交替折叠', '将下方的纸条向上折叠盖住上方纸条，再将另一条纸条向对面折叠，如此交替重复直到纸条用完。', 2),
        (v_project_id, '固定末端', '将最后剩余的纸条末端用胶水粘牢，防止弹簧散开。', 3),
        (v_project_id, '测试弹性', '用手按压纸弹簧再松开，观察它弹回原状的过程。尝试在顶部放一个小玩偶，按下弹簧后释放让玩偶弹起。', 4),
        (v_project_id, '延伸探索', '尝试用不同宽度和长度的纸条制作弹簧，比较弹力大小的差异，思考折叠密度如何影响弹性。', 5);

    -- Project 4: 纸板抽签机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸板抽签机', '用纸板制作一个可以随机抽出纸签的小机关，旋转手柄即可弹出一根签条。参与者将在搭建过程中接触简单机构的设计思路，体验随机机制的趣味。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/eng_mechanical.webp', ARRAY['机构','随机','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板（快递盒）', 1),
        (v_project_id, '竹签或冰棒棍若干', 2),
        (v_project_id, '胶水和胶带', 3),
        (v_project_id, '剪刀和美工刀', 4),
        (v_project_id, '彩色小纸条（写上内容）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作盒体', '用硬纸板裁剪并粘合成一个长方体小盒，顶部留一个窄缝作为出签口，侧面留圆孔用于安装手柄。', 1),
        (v_project_id, '制作拨片转轮', '用硬纸板剪一个圆盘，在圆盘边缘粘上几个小凸片作为拨片，将竹签穿过圆心做成转轮。', 2),
        (v_project_id, '组装机关', '将转轮安装在盒子侧面的圆孔中，使拨片能在盒内旋转，每次旋转拨片会推动一根纸签从顶部缝隙中弹出。', 3),
        (v_project_id, '装入纸签', '在小纸条上写好内容，卷起来或折好放入盒中，确保纸签能被拨片顺利推出。', 4),
        (v_project_id, '试玩调试', '旋转手柄测试出签效果，如果卡住可调整缝隙宽度或拨片角度，享受随机抽签的乐趣。', 5);

    -- Project 5: 橡皮筋动力车
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('橡皮筋动力车', '利用橡皮筋的弹性势能驱动一辆纸板小车前进，学习能量转化和简单传动原理。参与者将通过调整橡皮筋的拧紧圈数来控制行驶距离，感受储能与动力传动的关系。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/eng_mechanical.webp', ARRAY['弹性势能','传动','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板', 1),
        (v_project_id, '橡皮筋2-3根', 2),
        (v_project_id, '瓶盖4个（做车轮）', 3),
        (v_project_id, '竹签2根（做车轴）', 4),
        (v_project_id, '吸管2段（做轴承）', 5),
        (v_project_id, '胶带和胶水', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作底盘', '剪一块约15厘米×8厘米的硬纸板作为底盘，在前后两端各用胶带固定一段吸管作为轴承。', 1),
        (v_project_id, '安装车轮', '将竹签穿过吸管，竹签两端各插上一个瓶盖做车轮，确保车轮转动顺畅。', 2),
        (v_project_id, '安装动力', '将橡皮筋一端挂在前轴上，另一端挂在后轴的竹签上。旋转后轴让橡皮筋拧紧储能。', 3),
        (v_project_id, '发射测试', '将车放在平地上松手释放，橡皮筋回弹带动车轴旋转推动小车前进。', 4),
        (v_project_id, '优化改进', '尝试不同粗细和数量的橡皮筋，调整拧紧圈数，记录行驶距离，找出最佳组合。', 5),
        (v_project_id, '原理总结', '弹性势能通过橡皮筋回弹转化为车轴的旋转动能，再通过车轮与地面的摩擦力转化为前进的动力。', 6);

    -- Project 6: 纸板齿轮联动
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸板齿轮联动', '用硬纸板制作两个相互咬合的齿轮，转动一个齿轮带动另一个旋转。参与者将直观地理解齿轮传动的基本原理，观察两个齿轮旋转方向相反的有趣现象。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/eng_mechanical.webp', ARRAY['齿轮','传动','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '厚硬纸板', 1),
        (v_project_id, '图钉或螺丝钉2个', 2),
        (v_project_id, '泡沫板或瓦楞纸板（底板）', 3),
        (v_project_id, '圆规和直尺', 4),
        (v_project_id, '剪刀和美工刀', 5),
        (v_project_id, '铅笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绘制齿轮', '用圆规在硬纸板上画两个不同大小的圆，沿圆周均匀画出锯齿形的齿，注意两个齿轮的齿距要一致才能咬合。', 1),
        (v_project_id, '裁剪齿轮', '用剪刀或美工刀沿齿形轮廓仔细剪下两个齿轮，齿的形状要规整。', 2),
        (v_project_id, '安装到底板', '在底板上确定两个齿轮的中心位置，使齿刚好咬合，用图钉穿过齿轮中心固定在底板上，保持能自由转动。', 3),
        (v_project_id, '测试联动', '转动大齿轮，观察小齿轮被带动旋转，注意两个齿轮的旋转方向相反。', 4),
        (v_project_id, '探索传动比', '数一数大齿轮和小齿轮各有多少个齿，转动大齿轮一圈时小齿轮转了几圈，理解齿数比决定转速比。', 5);

    -- Project 7: 双坡弹珠轨道搭建
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('双坡弹珠轨道搭建', '搭建一段包含两个坡面的弹珠轨道，让弹珠顺利从起点滚到终点。通过局部结构搭建理解坡度和连接。', v_author_id, v_sub_id, 2, 25, 'approved', '/projects/eng_mechanical.webp', ARRAY['轨道','重力','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板若干', 1),
        (v_project_id, '纸巾筒或保鲜膜芯', 2),
        (v_project_id, '弹珠', 3),
        (v_project_id, '胶带和热熔胶', 4),
        (v_project_id, '剪刀', 5),
        (v_project_id, '大纸箱或墙面（用于固定）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作轨道段', '将纸板裁成长条，沿中线对折形成V形槽道，或将纸巾筒纵向切开一半作为半管轨道。', 1),
        (v_project_id, '设计路线', '在纸箱侧面或墙面上规划弹珠从高到低的路线，每段轨道略微向下倾斜，确保弹珠能持续滚动。', 2),
        (v_project_id, '固定轨道', '用胶带将各段轨道逐段固定到墙面或纸箱上，注意轨道之间的衔接要平滑，弹珠不会飞出。', 3),
        (v_project_id, '测试滚动', '从最高点释放弹珠，观察它沿轨道滚下。如果某处卡住，调整该段的倾斜角度。', 4),
        (v_project_id, '增加趣味', '在轨道中加入弯道、漏斗或跳台等元素，让弹珠轨迹更有趣。', 5);

    -- Project 8: 翻转木偶机关
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('翻转木偶机关', '制作一个凸轮驱动的纸板木偶，转动手柄木偶就能做出上下翻转的动作。参与者将学习凸轮机构如何把旋转运动变成上下往复运动，感受机械联动的趣味。', v_author_id, v_sub_id, 2, 35, 'approved', '/projects/eng_mechanical.webp', ARRAY['凸轮','联动','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板', 1),
        (v_project_id, '竹签', 2),
        (v_project_id, '小纸盒（做底座）', 3),
        (v_project_id, '胶水和胶带', 4),
        (v_project_id, '彩色笔和贴纸', 5),
        (v_project_id, '剪刀', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作凸轮', '在硬纸板上画一个偏心的椭圆形（非正圆），剪下来作为凸轮，在中心偏上位置戳孔穿入竹签做转轴。', 1),
        (v_project_id, '制作推杆', '将一根竹签竖直安装在纸盒顶部开孔中，底端抵住凸轮的边缘，使凸轮转动时推杆能上下移动。', 2),
        (v_project_id, '制作木偶', '在硬纸板上画一个可爱的人物或动物，剪下并粘在推杆的顶端。', 3),
        (v_project_id, '安装到底座', '将凸轮和转轴安装在纸盒内部，手柄从侧面伸出，推杆从顶部伸出。', 4),
        (v_project_id, '表演测试', '旋转侧面的手柄，观察木偶随着凸轮的旋转做出节奏感十足的上下弹跳动作。', 5),
        (v_project_id, '改变运动', '尝试制作不同形状的凸轮（心形、三角形等），观察木偶的运动节奏如何随之变化。', 6);

    -- Project 9: 纸板弹珠机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸板弹珠机', '用纸板制作一台完整的弹珠台游戏机，包含弹射器、障碍物和得分区域。参与者将综合运用弹射、反弹等机械原理，体验从设计到搭建完整机械装置的成就感。', v_author_id, v_sub_id, 3, 60, 'draft', '/projects/eng_mechanical.webp', ARRAY['机械','弹射','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大纸板箱（拆开使用）', 1),
        (v_project_id, '弹珠若干', 2),
        (v_project_id, '橡皮筋', 3),
        (v_project_id, '冰棒棍若干', 4),
        (v_project_id, '瓶盖和小钉子', 5),
        (v_project_id, '热熔胶枪', 6),
        (v_project_id, '彩色笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作面板', '将纸板裁成约40厘米×30厘米的底板，四周粘上纸板围墙形成弹珠活动区域，一端略微垫高形成倾斜角度。', 1),
        (v_project_id, '安装弹射器', '在底板低端侧面制作弹射通道，用橡皮筋和冰棒棍制成弹射杆，拉动后释放可将弹珠弹入游戏区域。', 2),
        (v_project_id, '布置障碍物', '用冰棒棍和瓶盖在面板上布置挡板、弯道和隧道等障碍物，用钉子做成可旋转的弹珠偏转器。', 3),
        (v_project_id, '设置得分区', '在底板底部开几个不同大小的洞作为进球口，标注不同分数——洞越小分数越高。', 4),
        (v_project_id, '装饰与测试', '用彩色笔装饰弹珠机外观，测试弹射力度和障碍物布局，调整直到游戏体验流畅有趣。', 5);

    -- Project 10: 凸轮玩具制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('凸轮玩具制作', '设计并制作一个凸轮驱动的场景玩具，转动手柄可以让多个角色做出不同的动作。参与者将深入学习凸轮的形状如何决定运动轨迹，理解往复运动的机械原理。', v_author_id, v_sub_id, 3, 45, 'approved', '/projects/eng_mechanical.webp', ARRAY['凸轮','往复运动','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板', 1),
        (v_project_id, '竹签（粗细各若干）', 2),
        (v_project_id, '小纸盒（做底座箱体）', 3),
        (v_project_id, '胶水和热熔胶', 4),
        (v_project_id, '彩色卡纸', 5),
        (v_project_id, '剪刀和美工刀', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计场景', '构思一个有2-3个角色的场景（如小鸡啄米、花朵开合、小人锤打等），画出草图，确定每个角色需要什么运动。', 1),
        (v_project_id, '制作凸轮', '根据需要的运动特点裁剪不同形状的纸板凸轮：圆形偏心凸轮产生平滑升降，心形凸轮产生快升慢降的效果。', 2),
        (v_project_id, '安装传动轴', '将各个凸轮穿在同一根竹签轴上，固定好间距使每个凸轮对准各自的推杆位置，轴端伸出箱体作为手柄。', 3),
        (v_project_id, '制作角色', '用彩色卡纸制作各个角色并固定在推杆顶部，推杆穿过箱体顶面的导向孔。', 4),
        (v_project_id, '组装测试', '转动手柄，观察各角色随着不同凸轮做出各具特色的运动，检查是否顺畅。', 5),
        (v_project_id, '装饰完善', '为场景添加背景装饰，调整凸轮相位让角色动作协调配合，打造出生动的机械剧场。', 6);

    -- Project 11: 纸板自动贩卖机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸板自动贩卖机', '用纸板制作一台能投币出货的迷你自动贩卖机，包含投币检测和推送货物的机关。参与者将学习多个简单机构的组合设计，理解联动机关的工作流程。', v_author_id, v_sub_id, 3, 60, 'draft', '/projects/eng_mechanical.webp', ARRAY['机构','联动','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大纸板箱', 1),
        (v_project_id, '硬纸板若干', 2),
        (v_project_id, '冰棒棍', 3),
        (v_project_id, '热熔胶枪', 4),
        (v_project_id, '小糖果或橡皮擦（做商品）', 5),
        (v_project_id, '硬币', 6),
        (v_project_id, '剪刀和美工刀', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作箱体', '将纸板箱改造成贩卖机外壳，正面留出商品展示窗口、投币口和出货口。', 1),
        (v_project_id, '制作货架', '在箱内用硬纸板分隔出多层倾斜的货架通道，商品能沿通道自动滑向出口处。', 2),
        (v_project_id, '制作投币联动', '设计一个投币机关：硬币从投币口滑入落到一个翘板上，翘板被压下后通过连杆拨开挡板，释放一个商品。', 3),
        (v_project_id, '安装挡板', '在每个货道出口安装可活动的挡板，平时挡住商品，联动触发时挡板打开让一个商品滑出。', 4),
        (v_project_id, '测试调整', '投入硬币测试出货是否顺畅，调整翘板灵敏度、通道坡度和挡板位置，确保机关可靠。', 5),
        (v_project_id, '外观装饰', '在正面画上商品图案和价格标签，装饰成真实贩卖机的样子，邀请朋友来体验。', 6);

    -- Project 12: 连杆机构动物
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('连杆机构动物', '用硬纸板和铆钉制作一只能活动四肢的机械动物，拉动操控杆让它做出走路或飞翔的动作。参与者将学习连杆机构的运动传递原理，理解如何将一个动作分解为多个关节的协调运动。', v_author_id, v_sub_id, 3, 40, 'approved', '/projects/eng_mechanical.webp', ARRAY['连杆','运动','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '厚硬纸板', 1),
        (v_project_id, '铆钉或两脚钉若干', 2),
        (v_project_id, '竹签', 3),
        (v_project_id, '彩色笔和贴纸', 4),
        (v_project_id, '剪刀和打孔器', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计动物', '选择一种动物（如恐龙、小鸟或马），画出身体、四肢等各部件，标注关节连接点的位置。', 1),
        (v_project_id, '裁剪部件', '在硬纸板上画出身体、上臂、下臂、大腿、小腿等各个部件并剪下，在关节处打孔。', 2),
        (v_project_id, '铆接关节', '用铆钉或两脚钉将各部件在关节处连接起来，每个关节需能自由转动但不能太松。', 3),
        (v_project_id, '制作连杆', '用纸板条制作连杆将各个关节串联起来，当拉动底部操控杆时，连杆带动所有肢体协调运动。', 4),
        (v_project_id, '装饰与测试', '用彩色笔给动物上色装饰，拉动操控杆观察四肢的运动是否协调自然。', 5),
        (v_project_id, '改进优化', '调整连杆长度和关节位置，让动作更加流畅逼真，理解四杆机构的运动规律。', 6);

    -- Project 13: 液压机械臂
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('液压机械臂', '用注射器和软管搭建液压系统驱动的多关节机械臂，能够夹取和搬运物体。参与者将深入学习帕斯卡原理，亲身感受液体传递压力的强大力量以及液压系统在工程中的广泛应用。', v_author_id, v_sub_id, 4, 90, 'approved', '/projects/eng_mechanical.webp', ARRAY['帕斯卡原理','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '注射器（不带针头）大小各3个', 1),
        (v_project_id, '软胶管3段', 2),
        (v_project_id, '冰棒棍或木条若干', 3),
        (v_project_id, '热熔胶枪', 4),
        (v_project_id, '螺丝、螺母和垫片', 5),
        (v_project_id, '厚纸板（做底座）', 6),
        (v_project_id, '水和食用色素', 7),
        (v_project_id, '扎带', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作液压组', '将三对注射器分别通过软管连接，注入带色水排尽气泡，分别标记为"底座旋转""大臂升降"和"夹爪开合"。', 1),
        (v_project_id, '搭建臂架', '用冰棒棍和螺丝制作三段式机械臂骨架：固定底座、可抬升的大臂和前端小臂，关节处用螺丝连接使其能转动。', 2),
        (v_project_id, '安装液压缸', '将操作端注射器固定在控制面板上，执行端注射器分别用扎带固定在对应关节两侧，推拉操作端即可驱动关节运动。', 3),
        (v_project_id, '制作夹爪', '在小臂末端安装两片可开合的硬纸板夹爪，由第三组液压控制夹合和张开。', 4),
        (v_project_id, '协调操控', '同时操控三组注射器，练习精确地控制机械臂移动到目标位置并夹取物体搬运到指定地点。', 5),
        (v_project_id, '原理探究', '感受不同大小注射器之间的力量差异，理解帕斯卡原理：密闭液体各处压强相等，改变截面积可放大力。', 6);

    -- Project 14: 复合齿轮传动装置
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('复合齿轮传动装置', '用纸板制作一套含有多对齿轮的传动装置，实现变速和方向改变。参与者将深入理解齿轮组的传动比概念，学习如何通过齿轮组合实现加速、减速和改变旋转方向。', v_author_id, v_sub_id, 4, 60, 'approved', '/projects/eng_mechanical.webp', ARRAY['齿轮组','变速','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '厚瓦楞纸板', 1),
        (v_project_id, '竹签若干（做轴）', 2),
        (v_project_id, '泡沫板（做底板）', 3),
        (v_project_id, '圆规和量角器', 4),
        (v_project_id, '热熔胶枪', 5),
        (v_project_id, '美工刀和剪刀', 6),
        (v_project_id, '彩色笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计齿轮组', '画出传动方案草图：输入轴上的小齿轮驱动中间轴上的大齿轮（减速），中间轴上的另一个小齿轮再驱动输出轴上的大齿轮（二级减速）。', 1),
        (v_project_id, '精确制齿', '用圆规画出4个齿轮：两大两小，用量角器等分齿距确保各齿轮的齿距完全相同，仔细裁剪。', 2),
        (v_project_id, '组装中间轴', '在同一根竹签轴上固定一大一小两个齿轮，大齿轮接收上级动力，小齿轮传递给下级。', 3),
        (v_project_id, '安装到底板', '将三根轴依次安装到底板上，调整间距使每对齿轮完美咬合，能顺畅转动。', 4),
        (v_project_id, '测试传动比', '慢转输入轴一圈，数输出轴转了几圈（或几分之几圈），计算出总传动比并用彩色标记各齿轮方便观察。', 5),
        (v_project_id, '变速实验', '交换齿轮的大小搭配方式，体验加速和减速的不同效果，理解齿轮组在自行车变速器和钟表中的应用。', 6);

    -- Project 15: 弹珠过山车
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('弹珠过山车', '搭建一条包含环形翻转、螺旋下降和跳跃飞台的弹珠过山车轨道，挑战让弹珠顺利跑完全程。参与者将综合运用重力势能、动能和能量守恒的知识来设计轨道的高度与弯度。', v_author_id, v_sub_id, 4, 90, 'approved', '/projects/eng_mechanical.webp', ARRAY['轨道','能量守恒','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '泡沫管保温管（剖开做轨道）', 1),
        (v_project_id, '硬纸板和纸板箱', 2),
        (v_project_id, '弹珠', 3),
        (v_project_id, '热熔胶枪', 4),
        (v_project_id, '胶带', 5),
        (v_project_id, '剪刀和美工刀', 6),
        (v_project_id, '书本或积木（搭建支撑）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '规划路线', '在纸上画出过山车的路线草图，包括起始高台、下坡加速段、环形翻转、螺旋弯道和终点。起点必须是全程最高点。', 1),
        (v_project_id, '搭建支撑', '用纸板箱和书本搭建不同高度的支撑柱，从高到低排列形成轨道的骨架。', 2),
        (v_project_id, '铺设轨道', '将泡沫管纵向剖开作为轨道，依次固定在支撑结构上，注意弯道处要缓和过渡避免弹珠飞出。', 3),
        (v_project_id, '制作翻转环', '弯曲一段轨道形成竖直环形，关键是环的顶部高度不能超过起点高度的一半，否则弹珠速度不够会掉下来。', 4),
        (v_project_id, '反复调试', '从起点释放弹珠测试全程，逐段排查卡住或飞出的位置，微调轨道角度和衔接直到弹珠能完整跑完。', 5),
        (v_project_id, '能量分析', '讨论为什么每段轨道的最高点都不能超过起点高度——弹珠只靠初始的重力势能运动，摩擦还会消耗部分能量。', 6);

    -- Project 16: 自动翻页机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自动翻页机', '设计并制作一台能自动翻动书页的机械装置，利用凸轮和摩擦片实现逐页翻转。参与者将在这个综合项目中学习机构设计的思维方法，将旋转运动转化为间歇性的翻页动作。', v_author_id, v_sub_id, 4, 75, 'draft', '/projects/eng_mechanical.webp', ARRAY['机构设计','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板', 1),
        (v_project_id, '橡皮筋', 2),
        (v_project_id, '竹签和吸管', 3),
        (v_project_id, '小海绵片或橡皮', 4),
        (v_project_id, '热熔胶枪', 5),
        (v_project_id, '一本薄杂志（用于测试）', 6),
        (v_project_id, '剪刀和美工刀', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '分析翻页动作', '观察手动翻页的动作分解：接触页面→摩擦带起一页→翻转过中线→松开页面。设计机构来模仿这个流程。', 1),
        (v_project_id, '制作翻页臂', '用硬纸板制作一根可旋转的翻页臂，末端粘上小海绵片增加与纸面的摩擦力以带起书页。', 2),
        (v_project_id, '制作驱动凸轮', '制作一个带有缺口的凸轮，安装在手柄轴上。凸轮旋转时推动翻页臂向下压住书页，经过缺口时翻页臂弹起完成翻转。', 3),
        (v_project_id, '搭建框架', '制作一个书架形底座，将翻页机构安装在书脊上方，确保翻页臂的活动范围恰好覆盖书页。', 4),
        (v_project_id, '测试与调试', '放上杂志，慢速转动手柄测试翻页效果。调整海绵的压力和凸轮的时序，确保每次只翻一页。', 5),
        (v_project_id, '持续改进', '尝试加入弹簧复位或多级传动让翻页更稳定，思考如何改为电动驱动实现全自动翻页。', 6);

    -- Project 17: 多级齿轮变速箱
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('多级齿轮变速箱', '制作一个包含多个档位的齿轮变速箱，能够通过拨杆切换不同的传动比。参与者将深入理解变速箱的核心原理，学习汽车和自行车变速器是如何通过齿轮组合实现速度变换的。', v_author_id, v_sub_id, 5, 120, 'draft', '/projects/eng_mechanical.webp', ARRAY['变速','传动比','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '厚瓦楞纸板（双层粘合增加强度）', 1),
        (v_project_id, '竹签和木棒（做轴）', 2),
        (v_project_id, '热熔胶枪', 3),
        (v_project_id, '圆规、量角器和直尺', 4),
        (v_project_id, '美工刀和剪刀', 5),
        (v_project_id, '泡沫板或木板（做底板）', 6),
        (v_project_id, '纸板条（做拨叉）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计传动方案', '画出三档变速的齿轮布局图：输入轴上固定三个不同大小的齿轮，中间轴上对应三个齿轮，通过滑动啮合切换档位。', 1),
        (v_project_id, '精密制齿', '用圆规和量角器精确绘制6个齿轮（三大三小），所有齿轮的齿距必须严格一致，仔细裁剪每个齿的轮廓。', 2),
        (v_project_id, '制作滑动机构', '在中间轴上安装可沿轴滑动的齿轮组，制作拨叉使其能前后滑动到三个位置分别与不同大小的输入齿轮啮合。', 3),
        (v_project_id, '组装箱体', '制作纸板箱体容纳所有齿轮，安装输入轴手柄和输出轴指示器，拨杆从箱体侧面伸出。', 4),
        (v_project_id, '测试各档位', '拨到不同档位转动输入轴，观察输出轴的转速变化：低档大力矩慢转速，高档小力矩快转速。', 5),
        (v_project_id, '计算传动比', '测量并记录每个档位的传动比，对比汽车变速箱的工作原理，理解为什么起步用低档上坡用低档高速巡航用高档。', 6);

    -- Project 18: 曲柄连杆发动机模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('曲柄连杆发动机模型', '制作一个活塞式发动机的工作模型，展示曲柄连杆机构如何将活塞的直线往复运动转化为曲轴的旋转运动。参与者将理解汽车发动机最核心的机械原理，感受工程设计的精妙之处。', v_author_id, v_sub_id, 5, 120, 'approved', '/projects/eng_mechanical.webp', ARRAY['曲柄连杆','活塞','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '厚硬纸板', 1),
        (v_project_id, '粗铁丝或衣架铁丝（做曲轴）', 2),
        (v_project_id, '竹签和吸管', 3),
        (v_project_id, '小木块或泡沫块（做活塞）', 4),
        (v_project_id, '热熔胶枪', 5),
        (v_project_id, '钳子（弯折铁丝用）', 6),
        (v_project_id, '圆规和直尺', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作曲轴', '用钳子将粗铁丝弯折成曲轴形状：中间弯出一个偏心的"Z"形曲拐，两端是直线轴段，曲拐偏移量决定活塞行程。', 1),
        (v_project_id, '制作汽缸', '用硬纸板卷成圆筒作为汽缸，内径略大于活塞块，使活塞能在缸内顺畅滑动。', 2),
        (v_project_id, '制作活塞和连杆', '将小木块修整为能在汽缸内滑动的活塞，用竹签作为连杆连接活塞底部和曲轴的曲拐销。', 3),
        (v_project_id, '搭建框架', '制作一个纸板支架固定汽缸和曲轴的两个轴承座，确保曲轴能自由旋转且连杆运动顺畅。', 4),
        (v_project_id, '运转测试', '转动曲轴手柄，观察活塞在汽缸内做上下往复运动。反过来推拉活塞，也能带动曲轴旋转。', 5),
        (v_project_id, '原理对照', '与真实发动机对比：燃料爆炸推动活塞下行（做功冲程），通过连杆驱动曲轴旋转，飞轮的惯性帮助完成排气和进气冲程。', 6);

    -- Project 19: 纸板自动分拣机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸板自动分拣机', '制作一台能按大小或重量自动将物品分拣到不同通道的纸板机器，体验自动化分拣的工程思维。参与者将学习如何用纯机械方式实现简单的分拣逻辑，理解工业自动化的基本概念。', v_author_id, v_sub_id, 5, 90, 'draft', '/projects/eng_mechanical.webp', ARRAY['分拣','传送','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大纸板（做主体结构）', 1),
        (v_project_id, '冰棒棍若干', 2),
        (v_project_id, '竹签', 3),
        (v_project_id, '橡皮筋', 4),
        (v_project_id, '弹珠（大中小三种尺寸）', 5),
        (v_project_id, '热熔胶枪', 6),
        (v_project_id, '美工刀和剪刀', 7),
        (v_project_id, '收集盒3个', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计分拣原理', '利用不同大小的筛孔原理：倾斜传送面上依次开设小孔、中孔和大孔，小球先掉入小孔，中球掉入中孔，大球滚到末端。', 1),
        (v_project_id, '制作传送坡道', '用纸板制作一个长约40厘米的倾斜坡道，坡度约15度，两侧有挡板防止弹珠滚出。', 2),
        (v_project_id, '开设筛选孔', '在坡道上依次开三个逐渐增大的方孔：第一个只让小弹珠通过，第二个让中弹珠通过，大弹珠直接滚到末端。', 3),
        (v_project_id, '安装收集通道', '在每个筛选孔下方安装倾斜的导向通道，将掉落的弹珠引导到各自的收集盒中。', 4),
        (v_project_id, '测试分拣效果', '从坡道顶部依次放入混合大小的弹珠，观察分拣是否准确。调整孔的大小和位置直到分拣成功率接近100%。', 5),
        (v_project_id, '进阶挑战', '思考如何增加按重量分拣的功能（利用翘板原理），或加入手摇传送带实现连续上料和自动分拣。', 6);

    -- Project 20: 鲁布·戈德堡机械
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('鲁布·戈德堡机械', '设计并搭建一台鲁布·戈德堡连锁反应装置，用一系列精心设计的机关完成一个简单的最终任务。参与者将综合运用杠杆、斜面、齿轮、重力等所有学过的机械原理，创造一台富有想象力的连锁反应奇迹。', v_author_id, v_sub_id, 5, 150, 'draft', '/projects/eng_mechanical.webp', ARRAY['连锁反应','创意','工程','机械'], '工程')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '纸板箱和硬纸板若干', 1),
        (v_project_id, '弹珠、多米诺骨牌', 2),
        (v_project_id, '橡皮筋、气球', 3),
        (v_project_id, '冰棒棍、竹签、吸管', 4),
        (v_project_id, '瓶盖、杯子、漏斗', 5),
        (v_project_id, '小磁铁、回形针', 6),
        (v_project_id, '热熔胶枪和胶带', 7),
        (v_project_id, '绳子和滑轮（可用线轴替代）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '确定最终任务', '选定一个简单的最终目标（如敲响铃铛、戳破气球或倒出一杯水），从这个终点倒推设计各个机关步骤。', 1),
        (v_project_id, '设计连锁流程', '在纸上画出至少8个连锁机关的流程图：弹珠滚落→撞倒多米诺→拉动绳子→释放重物→触发杠杆……直到完成最终任务。', 2),
        (v_project_id, '逐步搭建', '从最终任务开始向前逐个搭建每个机关。先确保每个单独机关能正常工作，再将它们串联起来。', 3),
        (v_project_id, '衔接调试', '最关键的步骤：反复调试每个机关之间的衔接，确保上一个机关的输出能可靠地触发下一个机关。', 4),
        (v_project_id, '全程测试', '从第一个机关开始触发，观察连锁反应能传递到第几步。找出失败点逐个修复，直到能一次性跑完全程。', 5),
        (v_project_id, '录制与分享', '成功后用手机录制整个连锁反应的过程，总结每个机关用到了什么机械原理，与家人和朋友分享你的杰作。', 6);

END $$;
