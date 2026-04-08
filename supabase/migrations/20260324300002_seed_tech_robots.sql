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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '机器人' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 机器人'; END IF;

    -- Project 1: 纸杯振动机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸杯振动机器人', '用纸杯和小马达制作一个会自己移动的振动机器人。参与者将了解偏心振动产生运动的原理，体验最简单的机器人制作乐趣。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/tech_robots.webp', ARRAY['振动','运动','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '纸杯一个', 1),
        (v_project_id, '小型振动马达（手机拆机马达即可）', 2),
        (v_project_id, '1.5V纽扣电池', 3),
        (v_project_id, '胶带', 4),
        (v_project_id, '彩色笔（3-4支，做"腿"）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '组装腿部', '将3-4支彩色笔用胶带均匀固定在纸杯外壁底部，笔尖朝下作为机器人的"腿"，确保杯子能稳定站立。', 1),
        (v_project_id, '安装马达', '将振动马达用胶带牢牢固定在纸杯底部内侧中央位置。', 2),
        (v_project_id, '连接电源', '将马达导线连接到纽扣电池正负极，用胶带固定电池在杯内。', 3),
        (v_project_id, '观察运动', '通电后马达振动带动整个纸杯移动，观察机器人在桌面上的运动轨迹，尝试在纸上留下彩色笔迹。', 4),
        (v_project_id, '创意改造', '改变马达位置或笔的数量与角度，观察运动轨迹的变化，理解偏心振动如何转化为位移。', 5);

    -- Project 2: 牙刷机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('牙刷机器人', '用旧牙刷头和振动马达制作一个灵活的微型机器人。刷毛的弹性和马达的振动配合产生有趣的爬行运动，是入门级机器人制作的经典项目。', v_author_id, v_sub_id, 1, 15, 'approved', '/projects/tech_robots.webp', ARRAY['振动马达','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '旧牙刷一把', 1),
        (v_project_id, '小型振动马达', 2),
        (v_project_id, '纽扣电池（3V）', 3),
        (v_project_id, '双面胶或热熔胶', 4),
        (v_project_id, '剪刀或锯子', 5),
        (v_project_id, '小装饰物（做眼睛等，可选）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '裁剪牙刷', '用剪刀或小锯将牙刷手柄剪短，只保留刷头和约3厘米的手柄部分作为机器人底盘。', 1),
        (v_project_id, '安装马达', '用双面胶将振动马达粘在牙刷头背面，注意马达的偏心块不要被阻挡。', 2),
        (v_project_id, '连接电池', '将纽扣电池用胶带固定在马达旁边，将马达导线分别接触电池正负极并固定好。', 3),
        (v_project_id, '测试与装饰', '通电后观察牙刷机器人在光滑桌面上快速爬行，贴上小眼睛等装饰让它更可爱。', 4),
        (v_project_id, '比赛挑战', '制作多个牙刷机器人进行赛跑比赛，探索刷毛角度和马达位置对速度的影响。', 5);

    -- Project 3: 气球动力机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('气球动力机器人', '利用气球放气产生的反作用力驱动一个简易小车机器人前进。参与者将直观体验牛顿第三定律，明白火箭和喷气发动机的基本工作原理。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/tech_robots.webp', ARRAY['反作用力','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '气球若干', 1),
        (v_project_id, '硬纸板', 2),
        (v_project_id, '瓶盖4个（做车轮）', 3),
        (v_project_id, '竹签2根（做车轴）', 4),
        (v_project_id, '吸管一根', 5),
        (v_project_id, '胶带和剪刀', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作底盘', '剪一块约15厘米×8厘米的硬纸板作为车身底盘。', 1),
        (v_project_id, '安装车轮', '将两根竹签穿过纸板底部前后端做车轴，在竹签两端各插入一个瓶盖做车轮，确保转动顺畅。', 2),
        (v_project_id, '安装喷气装置', '将气球套在吸管一端并用胶带密封好，把吸管用胶带固定在车身上方，开口朝后。', 3),
        (v_project_id, '发射机器人', '从吸管另一端吹气将气球吹大，用手指捏住吸管口，放在地面上松手，观察小车向前冲出。', 4),
        (v_project_id, '对比实验', '改变气球大小或吸管粗细，测量小车行驶距离，理解气体喷出速度和推力的关系。', 5);

    -- Project 4: 纸板机器人手偶
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸板机器人手偶', '用纸板和铆钉制作一个关节可动的机器人手偶，通过手指操控实现各种动作。参与者将学习简单机构和联动原理，理解机器人关节的运动方式。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/tech_robots.webp', ARRAY['机构','联动','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板若干', 1),
        (v_project_id, '铆钉或图钉5-8个', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '彩色笔或颜料', 4),
        (v_project_id, '细绳或棉线', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计外形', '在纸板上画出机器人的头、身体、上臂、下臂和腿各部分，注意关节连接处留出重叠区域。', 1),
        (v_project_id, '裁剪部件', '沿轮廓线仔细剪下各个部件，每个部件的连接处用打孔器或铅笔戳出小孔。', 2),
        (v_project_id, '组装关节', '用铆钉或图钉将各部件在关节处连接起来，确保每个关节都能自由转动。', 3),
        (v_project_id, '添加控制线', '在手臂和腿的末端系上细绳，从背面引出作为操控线，拉动绳子就能让手脚活动。', 4),
        (v_project_id, '装饰与表演', '用彩色笔画上机器人的面部和装甲细节，操控你的机器人手偶表演各种动作和故事。', 5);

    -- Project 5: 弹射机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('弹射机器人', '用冰棒棍和橡皮筋制作一个弹射装置造型的机器人，能将小球弹射出去。参与者将学习弹性势能转化为动能的过程，体验投石机的力学原理。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/tech_robots.webp', ARRAY['弹性','发射','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '冰棒棍10根左右', 1),
        (v_project_id, '橡皮筋若干', 2),
        (v_project_id, '塑料瓶盖一个（做弹射勺）', 3),
        (v_project_id, '热熔胶枪', 4),
        (v_project_id, '小绒球或乒乓球', 5),
        (v_project_id, '彩色贴纸（装饰用）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作弹力组', '将8根冰棒棍叠在一起，用橡皮筋紧紧捆住两端形成一个厚实的弹力块。', 1),
        (v_project_id, '制作发射臂', '取一根冰棒棍作为发射臂，在一端用热熔胶粘上瓶盖作为"弹射勺"。', 2),
        (v_project_id, '组装弹射器', '将发射臂和另一根底座冰棒棍呈十字交叉，把弹力块插入交叉处下方，用橡皮筋将交叉点绑紧固定。', 3),
        (v_project_id, '装饰与测试', '贴上机器人眼睛和装饰，在瓶盖中放入小球，按下发射臂然后松手，观察小球被弹射出去的效果。', 4),
        (v_project_id, '调节与挑战', '改变弹力块中冰棒棍的数量来调节弹射力度，设置目标杯子进行投射比赛，记录命中率。', 5);

    -- Project 6: 遥控纸板车
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('遥控纸板车', '用纸板制作车身，配合简易遥控器实现前进和转弯，打造自己的第一辆遥控车。参与者将学习电机驱动和遥控信号的基本概念，体验远程控制的乐趣。', v_author_id, v_sub_id, 2, 40, 'approved', '/projects/tech_robots.webp', ARRAY['遥控','传动','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板', 1),
        (v_project_id, '小型直流电机2个', 2),
        (v_project_id, '瓶盖4个（做车轮）', 3),
        (v_project_id, '电池盒和5号电池', 4),
        (v_project_id, '旧遥控器和接收模块（或简易有线控制器）', 5),
        (v_project_id, '导线若干', 6),
        (v_project_id, '胶带和热熔胶', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作底盘', '用硬纸板剪出车身底盘，在前后端标记车轮和电机的安装位置。', 1),
        (v_project_id, '安装驱动', '将两个直流电机用热熔胶固定在底盘后部两侧，电机轴上各安装一个瓶盖做驱动轮，前部安装两个自由转动的导向轮。', 2),
        (v_project_id, '搭建电路', '将电池盒、开关和遥控接收模块安装在底盘上，用导线将电机分别连接到接收模块的输出端。', 3),
        (v_project_id, '制作车壳', '用纸板折叠出机器人造型的车壳，画上酷炫的图案，罩在底盘上。', 4),
        (v_project_id, '遥控测试', '用遥控器控制小车前进、后退和转弯，通过单独控制左右电机实现差速转向。', 5),
        (v_project_id, '赛道挑战', '用书本搭建赛道障碍物，练习遥控操作技巧，挑战最快完成赛道的记录。', 6);

    -- Project 7: 简易爬坡车
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('简易爬坡车', '设计一辆能爬上斜坡的小车，探索重心位置和轮胎摩擦力对爬坡能力的影响。参与者将在反复测试中学会调整设计方案，理解重心和摩擦力在机械中的重要作用。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/tech_robots.webp', ARRAY['重心','摩擦力','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板', 1),
        (v_project_id, '小型直流电机一个', 2),
        (v_project_id, '橡皮筋若干（做传动带和增加摩擦）', 3),
        (v_project_id, '瓶盖4个', 4),
        (v_project_id, '竹签', 5),
        (v_project_id, '电池盒和电池', 6),
        (v_project_id, '砂纸（增加轮胎摩擦力）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作车体', '用纸板制作坚固的长方形底盘，在底部两端安装竹签车轴和瓶盖车轮。', 1),
        (v_project_id, '安装动力', '将电机固定在底盘上，用橡皮筋做传动带连接电机轴和后轮车轴，实现动力传递。', 2),
        (v_project_id, '增加摩擦', '在驱动轮外侧缠绕橡皮筋或粘贴砂纸条，增大轮胎与地面的摩擦力。', 3),
        (v_project_id, '搭建斜坡测试', '用书本搭建不同角度的斜坡，测试小车能爬上的最大坡度。', 4),
        (v_project_id, '优化重心', '在车身不同位置添加配重（如硬币），观察重心变化对爬坡能力的影响，找到最佳配重方案。', 5);

    -- Project 8: 橡皮筋动力机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('橡皮筋动力机器人', '用橡皮筋储存的弹性势能驱动一个纸板机器人行走，不需要电池和马达。参与者将理解弹性势能到动能的转换过程，感受机械能量储存与释放的巧妙。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/tech_robots.webp', ARRAY['弹性势能','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板', 1),
        (v_project_id, '粗橡皮筋若干', 2),
        (v_project_id, '竹签或木棒', 3),
        (v_project_id, '瓶盖或纸板圆片（做车轮）', 4),
        (v_project_id, '胶带和剪刀', 5),
        (v_project_id, '回形针', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作车身', '用硬纸板剪出机器人造型的车身，在底部前后端开孔用于安装车轴。', 1),
        (v_project_id, '安装车轮', '将竹签穿过车身底部做车轴，两端安装瓶盖车轮，后轴车轮要固定在竹签上不能打滑。', 2),
        (v_project_id, '安装动力橡皮筋', '将橡皮筋一端挂在车身前端的回形针钩上，另一端绕在后车轴上。', 3),
        (v_project_id, '蓄能与释放', '向后滚动车轮使橡皮筋缠绕在车轴上储存弹性势能，放在地面上松手，机器人就会自动向前行驶。', 4),
        (v_project_id, '距离挑战', '尝试不同的缠绕圈数，记录行驶距离，找出橡皮筋弹力和行驶距离的关系。', 5);

    -- Project 9: 纸板液压机械臂
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸板液压机械臂', '用纸板和注射器制作一个液压驱动的机械臂，能够抬起和夹取物体。参与者将深入理解帕斯卡原理和液压传动系统，体验工业机器人的核心技术。', v_author_id, v_sub_id, 3, 60, 'approved', '/projects/tech_robots.webp', ARRAY['液压','机械','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板若干', 1),
        (v_project_id, '注射器（10ml）4-6个（不带针头）', 2),
        (v_project_id, '软胶管若干段', 3),
        (v_project_id, '热熔胶枪', 4),
        (v_project_id, '螺丝和螺母', 5),
        (v_project_id, '水和食用色素', 6),
        (v_project_id, '剪刀和美工刀', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作液压单元', '将两个注射器通过软胶管连接，注满有色水排尽气泡，推一个活塞观察另一个同步移动。', 1),
        (v_project_id, '搭建臂架', '用硬纸板制作底座、大臂和小臂三段，在关节处用螺丝连接使其可转动。', 2),
        (v_project_id, '安装液压缸', '将注射器分别固定在关节两侧，推拉控制端注射器即可驱动关节转动。', 3),
        (v_project_id, '制作夹爪', '在臂端用纸板制作两片夹爪，通过一组液压注射器控制夹爪的开合动作。', 4),
        (v_project_id, '综合操控', '通过推拉不同的控制注射器，协调操控机械臂完成抬起、旋转和夹取物体的动作。', 5),
        (v_project_id, '原理学习', '讨论帕斯卡原理：封闭液体各处压强相等，改变注射器面积比可以实现力的放大效果。', 6);

    -- Project 10: 四足行走机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('四足行走机器人', '用纸板和连杆机构制作一个能模仿动物行走的四足机器人。参与者将学习连杆机构将旋转运动转化为往复行走运动的原理，感受仿生机器人的魅力。', v_author_id, v_sub_id, 3, 50, 'approved', '/projects/tech_robots.webp', ARRAY['连杆机构','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板若干', 1),
        (v_project_id, '小型直流减速电机一个', 2),
        (v_project_id, '竹签或铁丝若干', 3),
        (v_project_id, '电池盒和电池', 4),
        (v_project_id, '热熔胶枪', 5),
        (v_project_id, '开关', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作曲柄', '在电机轴上固定一个小偏心轮或曲柄臂，将旋转运动转化为偏心运动。', 1),
        (v_project_id, '制作连杆与腿', '用纸板剪出四条腿和连杆部件，在连接处打孔，用竹签做铰链连接曲柄与腿部。', 2),
        (v_project_id, '组装机身', '制作纸板机身框架，将电机安装在机身中央，四条腿对称安装在两侧，调整连杆长度使步态协调。', 3),
        (v_project_id, '通电测试', '连接电池盒和开关，通电后观察四条腿交替抬起落下形成行走动作。', 4),
        (v_project_id, '调试步态', '如果行走不稳，调整连杆长度、腿部角度和重心位置，直到机器人能在平面上稳定行走。', 5),
        (v_project_id, '仿生思考', '对比机器人和真实动物的行走方式，讨论连杆机构在机械工程中的广泛应用。', 6);

    -- Project 11: 风力行走机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('风力行走机器人', '制作一个仅靠风力驱动就能在桌面上行走的机器人，灵感来源于荷兰艺术家Theo Jansen的风力仿生兽。参与者将学习风能的利用方式和连杆行走机构的设计。', v_author_id, v_sub_id, 3, 45, 'approved', '/projects/tech_robots.webp', ARRAY['风能','运动','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板若干', 1),
        (v_project_id, '吸管若干（做腿部连杆）', 2),
        (v_project_id, '竹签若干（做轴和铰链）', 3),
        (v_project_id, '小风车叶片（纸或塑料片制作）', 4),
        (v_project_id, '热熔胶和胶带', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作风车', '用纸或塑料片制作4-6片风车叶片，安装在竹签轴上，确保吹风时能灵活转动。', 1),
        (v_project_id, '制作曲柄连杆', '在风车轴上安装偏心曲柄，通过吸管连杆将旋转运动传递到腿部。', 2),
        (v_project_id, '制作行走腿', '用吸管和竹签组装出仿生腿结构，每侧至少两条腿，确保落地和抬起的动作交替进行。', 3),
        (v_project_id, '组装测试', '将风车、曲柄和腿部连接到纸板机身上，对着风车吹风或用电风扇，观察机器人行走。', 4),
        (v_project_id, '优化改进', '调整风车叶片角度、连杆比例和腿部长度，让行走动作更流畅高效，讨论风能转化为机械能的过程。', 5);

    -- Project 12: 提线木偶机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('提线木偶机器人', '用纸板和线绳制作一个关节可动的提线木偶机器人，通过操纵杆控制它的四肢动作。参与者将学习联动控制机构的设计，理解机器人多关节协调运动的基本思路。', v_author_id, v_sub_id, 3, 45, 'approved', '/projects/tech_robots.webp', ARRAY['联动','控制','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板若干', 1),
        (v_project_id, '细绳或棉线（约2米）', 2),
        (v_project_id, '竹筷子两根（做操纵杆）', 3),
        (v_project_id, '铆钉或曲别针若干', 4),
        (v_project_id, '彩色笔或颜料', 5),
        (v_project_id, '打孔器和剪刀', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计与裁剪', '在纸板上画出机器人的头、躯干、上臂、下臂、大腿和小腿各部件并裁剪出来。', 1),
        (v_project_id, '铆接关节', '在各部件的关节连接处打孔，用铆钉将肩、肘、胯、膝关节连接起来，确保活动自如。', 2),
        (v_project_id, '安装提线', '在双手、双脚、头部和背部分别系上细绳，绳子的另一端集中连接到两根十字交叉的操纵杆上。', 3),
        (v_project_id, '调试控制', '提起操纵杆让木偶悬空，倾斜不同方向的操纵杆使手脚交替运动，练习让机器人做出行走和挥手动作。', 4),
        (v_project_id, '装饰表演', '给机器人上色画出酷炫造型，编排一段表演动作，体会多线联动控制的挑战和乐趣。', 5);

    -- Project 13: Arduino 巡线小车
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Arduino 巡线小车', '使用Arduino和红外传感器制作一辆能沿着黑线自动行驶的智能小车。参与者将首次接触编程控制硬件，学习传感器检测和条件判断的基本逻辑。', v_author_id, v_sub_id, 4, 90, 'approved', '/projects/tech_robots.webp', ARRAY['Arduino','传感器','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino Uno开发板', 1),
        (v_project_id, '红外巡线传感器模块2个', 2),
        (v_project_id, 'L298N电机驱动模块', 3),
        (v_project_id, '直流减速电机2个（带车轮）', 4),
        (v_project_id, '小车底盘（亚克力或纸板）', 5),
        (v_project_id, '电池盒和18650锂电池', 6),
        (v_project_id, '杜邦线和USB数据线', 7),
        (v_project_id, '黑色电工胶带（铺赛道）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '组装底盘', '将电机、车轮和万向轮安装在底盘上，将Arduino和电机驱动模块固定在底盘上方。', 1),
        (v_project_id, '连接电路', '将红外传感器安装在底盘前端朝下，按照接线图将传感器、电机驱动模块和Arduino连接起来。', 2),
        (v_project_id, '编写程序', '在Arduino IDE中编写巡线程序：读取左右传感器值，黑线上为低电平，根据检测结果控制左右电机实现转向。', 3),
        (v_project_id, '铺设赛道', '在白色地面上用黑色胶带贴出赛道线路，包含直线和弯道。', 4),
        (v_project_id, '调试运行', '上传程序到Arduino，将小车放在赛道上测试，调整传感器高度和程序参数直到小车能稳定巡线。', 5),
        (v_project_id, '进阶挑战', '增加赛道难度（急弯、交叉路口），优化程序算法提高巡线速度和稳定性。', 6);

    -- Project 14: 避障机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('避障机器人', '使用Arduino和超声波传感器制作一个能自动检测并避开障碍物的智能小车。参与者将学习超声波测距原理和简单的决策算法，让机器人具备"眼睛"的感知能力。', v_author_id, v_sub_id, 4, 90, 'approved', '/projects/tech_robots.webp', ARRAY['超声波','Arduino','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino Uno开发板', 1),
        (v_project_id, 'HC-SR04超声波传感器', 2),
        (v_project_id, 'SG90舵机一个（做传感器旋转头）', 3),
        (v_project_id, 'L298N电机驱动模块', 4),
        (v_project_id, '直流减速电机2个（带车轮）', 5),
        (v_project_id, '小车底盘', 6),
        (v_project_id, '电池盒和电池', 7),
        (v_project_id, '杜邦线和USB数据线', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '组装底盘', '将电机、车轮安装在底盘上，在前端安装舵机，将超声波传感器固定在舵机上使其可左右扫描。', 1),
        (v_project_id, '连接电路', '按照接线图将超声波传感器、舵机、电机驱动模块与Arduino连接，注意电源的正确分配。', 2),
        (v_project_id, '编写避障程序', '编程实现：超声波发出脉冲并计算回波时间得出距离，当前方障碍物小于20厘米时停车，舵机左右扫描选择空旷方向转弯。', 3),
        (v_project_id, '搭建测试场地', '用书本、纸盒等搭建障碍物场地，留出足够的通道让小车穿行。', 4),
        (v_project_id, '调试优化', '上传程序测试，调整超声波检测距离阈值和转弯时间参数，让避障动作更灵活准确。', 5),
        (v_project_id, '算法升级', '尝试改进策略：加入后退功能、记忆路径、或优先选择最远距离方向，提升避障智能。', 6);

    -- Project 15: 机械抓手制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('机械抓手制作', '制作一个可以远程操控抓取物体的机械抓手，模拟工业机器人末端执行器的功能。参与者将学习机械臂夹持机构的设计原理，理解连杆放大运动和力的方式。', v_author_id, v_sub_id, 4, 50, 'approved', '/projects/tech_robots.webp', ARRAY['机械臂','夹持','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '冰棒棍或硬纸板条若干', 1),
        (v_project_id, '螺丝螺母和垫片若干', 2),
        (v_project_id, '粗吸管一根（做手柄）', 3),
        (v_project_id, '细绳约1米', 4),
        (v_project_id, '热熔胶枪', 5),
        (v_project_id, '橡皮筋', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作夹爪连杆', '用冰棒棍制作两组X形交叉连杆，每组用螺丝在交叉点连接，形成可开合的剪刀式结构。', 1),
        (v_project_id, '串联延长', '将多组X形连杆首尾串联，形成一个可伸缩的长臂结构，拉一端另一端同步联动。', 2),
        (v_project_id, '安装夹爪', '在连杆前端安装两个弯曲的"手指"，通过连杆的开合运动实现夹爪的抓取和松开。', 3),
        (v_project_id, '制作控制手柄', '在连杆尾端制作操控手柄，用绳子和橡皮筋辅助控制，拉动绳子收紧夹爪、松开橡皮筋弹开。', 4),
        (v_project_id, '抓取测试', '用机械抓手尝试抓取不同大小和重量的物体，如积木、球、纸杯等，记录成功率。', 5),
        (v_project_id, '工程思考', '讨论真实工厂中机械抓手的应用场景和设计要求，理解不同夹持方式的优缺点。', 6);

    -- Project 16: 双足行走模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('双足行走模型', '制作一个能依靠重力沿斜面自动行走的双足机器人模型，模拟人类的步态运动。参与者将学习双足行走的力学平衡原理，理解重心转移和步态周期的概念。', v_author_id, v_sub_id, 4, 50, 'approved', '/projects/tech_robots.webp', ARRAY['步态','平衡','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板或薄木板', 1),
        (v_project_id, '螺丝螺母若干', 2),
        (v_project_id, '大号回形针或铁丝', 3),
        (v_project_id, '硬币或小螺母（做配重）', 4),
        (v_project_id, '热熔胶枪', 5),
        (v_project_id, '长木板（做斜面坡道）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计腿部', '用纸板裁出两条弧形腿部件，弧度要足够使得每条腿能像不倒翁一样前后摆动。', 1),
        (v_project_id, '制作髋关节', '用螺丝在两条腿的顶端连接一个横杆作为髋部，使两腿可以交替前后摆动。', 2),
        (v_project_id, '添加配重', '在腿部和髋部不同位置粘贴硬币调整重心，使机器人站立时略微前倾。', 3),
        (v_project_id, '搭建坡道', '将长木板一端垫高约5-10度作为行走斜面。', 4),
        (v_project_id, '行走测试', '将机器人放在斜面顶端轻轻推一下，在重力作用下它应该能交替摆腿缓缓走下坡道。', 5),
        (v_project_id, '调试优化', '微调腿部弧度、配重位置和坡度角度，让行走动作更稳定流畅，讨论人类行走时的重心变化规律。', 6);

    -- Project 17: Arduino 蓝牙遥控车
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Arduino 蓝牙遥控车', '使用Arduino和蓝牙模块制作一辆能通过手机App遥控的智能小车。参与者将学习蓝牙无线通信的基本原理，掌握手机与硬件设备之间的数据交互方法。', v_author_id, v_sub_id, 5, 120, 'approved', '/projects/tech_robots.webp', ARRAY['蓝牙','Arduino','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino Uno开发板', 1),
        (v_project_id, 'HC-05或HC-06蓝牙模块', 2),
        (v_project_id, 'L298N电机驱动模块', 3),
        (v_project_id, '直流减速电机2个（带车轮）', 4),
        (v_project_id, '小车底盘（带万向轮）', 5),
        (v_project_id, '18650锂电池和电池盒', 6),
        (v_project_id, '杜邦线若干', 7),
        (v_project_id, '智能手机（安装蓝牙控制App）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '组装底盘', '将电机、车轮和万向轮安装在底盘上，将Arduino、电机驱动模块和蓝牙模块固定好。', 1),
        (v_project_id, '连接电路', '将蓝牙模块的TX/RX连接到Arduino对应引脚，电机驱动模块连接电机和Arduino的PWM引脚。', 2),
        (v_project_id, '编写控制程序', '编写Arduino程序：通过串口接收蓝牙传来的指令字符（如F前进、B后退、L左转、R右转），对应控制电机转动。', 3),
        (v_project_id, '配置手机App', '在手机上安装蓝牙串口控制App，与HC-05模块配对连接，设置方向控制按钮对应的发送字符。', 4),
        (v_project_id, '联调测试', '上传程序，用手机App发送指令测试小车各方向运动，调整电机转速和转弯时间参数。', 5),
        (v_project_id, '功能扩展', '添加PWM调速功能实现变速控制，或加装蜂鸣器和LED灯增加声光效果，打造个性化遥控车。', 6);

    -- Project 18: 自平衡机器人入门
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自平衡机器人入门', '制作一个能自动保持直立平衡的两轮机器人，类似赛格威的工作原理。参与者将初步接触陀螺仪传感器和PID控制算法，理解反馈控制系统的核心思想。', v_author_id, v_sub_id, 5, 150, 'approved', '/projects/tech_robots.webp', ARRAY['陀螺仪','PID','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino Nano或Uno', 1),
        (v_project_id, 'MPU6050陀螺仪加速度计模块', 2),
        (v_project_id, 'L298N电机驱动模块', 3),
        (v_project_id, 'N20减速电机2个（带橡胶轮）', 4),
        (v_project_id, '3D打印或纸板机身框架', 5),
        (v_project_id, '锂电池（7.4V）和电池盒', 6),
        (v_project_id, '杜邦线和USB数据线', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '组装机身', '搭建竖直的机身框架，两个电机安装在底部两侧，MPU6050安装在机身中部保持水平。', 1),
        (v_project_id, '连接电路', '将MPU6050通过I2C连接Arduino，电机驱动模块连接电机和Arduino的PWM引脚，安装好电池。', 2),
        (v_project_id, '读取姿态数据', '编写程序读取MPU6050的倾斜角度数据，通过串口监视器观察机器人倾斜时数值的变化。', 3),
        (v_project_id, '实现PID控制', '编写PID控制算法：将倾斜角度作为输入，计算出电机应输出的速度和方向来纠正倾斜。', 4),
        (v_project_id, '调节PID参数', '反复调整P（比例）、I（积分）、D（微分）三个参数，从只有P开始，逐步加入I和D，让机器人稳定站立。', 5),
        (v_project_id, '深入理解', '讨论PID控制的含义：P响应当前误差、I消除累计偏差、D预测变化趋势，理解反馈控制在机器人中的核心地位。', 6);

    -- Project 19: 机器人迷宫挑战
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('机器人迷宫挑战', '编程让机器人自主导航通过迷宫找到出口，综合运用传感器和算法知识。参与者将学习基本的迷宫求解算法（如左手法则），培养算法思维和系统调试能力。', v_author_id, v_sub_id, 5, 150, 'approved', '/projects/tech_robots.webp', ARRAY['算法','导航','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino Uno开发板', 1),
        (v_project_id, 'HC-SR04超声波传感器3个（前、左、右）', 2),
        (v_project_id, 'L298N电机驱动模块', 3),
        (v_project_id, '直流减速电机2个（带车轮）', 4),
        (v_project_id, '小车底盘', 5),
        (v_project_id, '电池组', 6),
        (v_project_id, '纸板或泡沫板（搭建迷宫墙壁）', 7),
        (v_project_id, '杜邦线和USB数据线', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建迷宫', '用纸板或泡沫板搭建一个简单迷宫，通道宽度约为小车宽度的两倍，设置入口和出口。', 1),
        (v_project_id, '组装小车', '在小车前方和左右两侧各安装一个超声波传感器，连接电机驱动模块和Arduino。', 2),
        (v_project_id, '编写感知程序', '编程读取三个方向的距离数据，在串口监视器中验证测距是否准确。', 3),
        (v_project_id, '实现左手法则', '编写导航算法：优先左转，左侧无墙则左转，前方有墙且左侧有墙则右转，三面有墙则掉头。', 4),
        (v_project_id, '迷宫测试', '将小车放入迷宫入口，观察它按照算法自主导航，记录通过迷宫所需时间。', 5),
        (v_project_id, '算法优化', '尝试改进算法或增加迷宫复杂度，讨论不同迷宫求解算法的优劣和适用场景。', 6);

    -- Project 20: 可编程绘图机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('可编程绘图机器人', '制作一个能按照程序指令在纸上画出图案的绘图机器人，类似迷你版的CNC绘图仪。参与者将学习步进电机的精确控制和坐标系的概念，体验数控技术的魅力。', v_author_id, v_sub_id, 5, 180, 'approved', '/projects/tech_robots.webp', ARRAY['CNC','步进电机','技术','机器人'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino Uno开发板', 1),
        (v_project_id, '28BYJ-48步进电机2个（带ULN2003驱动板）', 2),
        (v_project_id, 'SG90舵机一个（控制笔的抬起放下）', 3),
        (v_project_id, '光轴或光滑铁丝（做导轨）', 4),
        (v_project_id, '硬纸板或亚克力板（做框架）', 5),
        (v_project_id, '同步带或棉线', 6),
        (v_project_id, '马克笔', 7),
        (v_project_id, '杜邦线和USB数据线', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建XY轴框架', '用纸板搭建框架，安装两根导轨分别作为X轴和Y轴，确保滑块能在导轨上平滑移动。', 1),
        (v_project_id, '安装驱动系统', '将两个步进电机分别安装在X轴和Y轴末端，通过同步带或绕线方式驱动滑块移动。', 2),
        (v_project_id, '安装笔架', '在XY轴交汇处的滑块上安装笔架，用舵机控制马克笔的抬起和落下。', 3),
        (v_project_id, '编写控制程序', '编写Arduino程序，实现步进电机的精确步数控制，将坐标指令转换为X/Y轴的电机步数。', 4),
        (v_project_id, '绘制简单图形', '编程让机器人画出正方形、三角形和圆形等基本图案，在纸上验证绘图精度。', 5),
        (v_project_id, '创意绘图', '编写更复杂的绘图程序画出文字、星形或自定义图案，探索G-code解析等进阶数控概念。', 6);

END $$;
