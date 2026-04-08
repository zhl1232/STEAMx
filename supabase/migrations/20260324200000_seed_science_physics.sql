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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '物理实验' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 物理实验'; END IF;

    -- Project 1: 静电章鱼
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('静电章鱼', '用塑料袋制作一只可爱的"章鱼"，通过摩擦产生静电让它飘浮在空中。参与者将亲身体验摩擦起电的原理，观察同种电荷相互排斥的有趣现象。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/science_physics.webp', ARRAY['静电','摩擦起电','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '薄塑料袋（超市购物袋）', 1),
        (v_project_id, 'PVC水管或塑料尺（约30厘米）', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '干燥的毛巾或毛皮', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作章鱼', '将塑料袋剪成长条状，顶部扎紧形成章鱼的"头部"，下方的长条就是"触须"。', 1),
        (v_project_id, '充电准备', '用干燥的毛巾快速摩擦PVC管约30秒，让管子带上静电。', 2),
        (v_project_id, '给章鱼充电', '同样用毛巾快速摩擦塑料章鱼，让它也带上同种电荷。', 3),
        (v_project_id, '让章鱼飞起来', '将章鱼抛向空中，用带电的PVC管从下方靠近，观察章鱼因为同种电荷排斥而悬浮在空中。', 4),
        (v_project_id, '观察与思考', '尝试改变管子的距离和角度，观察章鱼的运动变化，理解静电力的作用方式。', 5);

    -- Project 2: 彩虹制造机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('彩虹制造机', '利用水和阳光在家中制造出美丽的彩虹，学习白光如何被分解成七种颜色。通过动手实验理解光的色散原理，感受牛顿发现的光学奥秘。', v_author_id, v_sub_id, 1, 15, 'approved', '/projects/science_physics.webp', ARRAY['光学','色散','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '一盆清水', 1),
        (v_project_id, '小镜子一面', 2),
        (v_project_id, '白色纸板或白墙', 3),
        (v_project_id, '手电筒（或利用阳光）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备水盆', '在水盆中倒入清水，将小镜子斜靠在盆底，角度约为45度。', 1),
        (v_project_id, '布置光源', '在阳光充足的窗边放置水盆，或者用手电筒对准水中的镜子照射。', 2),
        (v_project_id, '寻找彩虹', '在镜子反射光线的方向放置白色纸板，缓慢调整镜子角度，直到纸板上出现彩虹。', 3),
        (v_project_id, '观察颜色', '仔细观察彩虹中的颜色顺序：红、橙、黄、绿、蓝、靛、紫，记录下你看到的颜色。', 4),
        (v_project_id, '探索变化', '尝试改变镜子角度和水量，观察彩虹的大小和亮度如何变化，理解光通过水发生折射和色散的原理。', 5);

    -- Project 3: 纸飞机飞行实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸飞机飞行实验', '折叠不同造型的纸飞机，测量和比较它们的飞行距离与滞空时间。参与者将通过实验了解空气动力学的基本知识，包括升力、阻力和重心对飞行的影响。', v_author_id, v_sub_id, 1, 30, 'approved', '/projects/science_physics.webp', ARRAY['空气动力学','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'A4纸若干张', 1),
        (v_project_id, '卷尺或直尺', 2),
        (v_project_id, '秒表或手机计时器', 3),
        (v_project_id, '记录本和铅笔', 4),
        (v_project_id, '回形针若干', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '折叠飞机', '用相同大小的纸分别折叠三种不同造型的纸飞机：经典飞镖型、宽翼型和细长型。', 1),
        (v_project_id, '标记起飞线', '在地面用胶带标记一条起飞线，确保每次从同一位置以相同力度投掷。', 2),
        (v_project_id, '飞行测试', '每种纸飞机各飞行三次，用卷尺测量飞行距离，用秒表记录滞空时间。', 3),
        (v_project_id, '改装实验', '在飞机头部夹上回形针改变重心位置，观察飞行表现的变化。', 4),
        (v_project_id, '记录与分析', '将所有数据记录在表格中，比较不同造型和配重的飞机表现，讨论机翼形状和重心位置如何影响飞行。', 5);

    -- Project 4: 影子戏剧场
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('影子戏剧场', '制作简易影子剧场，用手电筒和剪纸表演一场精彩的影子戏。参与者将在游戏中学习光的直线传播原理，理解影子的形成原因以及大小变化规律。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/science_physics.webp', ARRAY['光的直线传播','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '鞋盒或纸箱', 1),
        (v_project_id, '白色薄纸或描图纸', 2),
        (v_project_id, '手电筒', 3),
        (v_project_id, '卡纸和剪刀', 4),
        (v_project_id, '竹签或冰棒棍', 5),
        (v_project_id, '胶带', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作幕布', '将鞋盒的一面剪开，用白色薄纸覆盖作为投影幕布，用胶带固定。', 1),
        (v_project_id, '制作角色', '在卡纸上画出小动物或人物的轮廓并剪下，用胶带粘在竹签上制成影子道具。', 2),
        (v_project_id, '布置灯光', '在幕布后方放置手电筒作为光源，关闭房间其他灯光。', 3),
        (v_project_id, '表演与观察', '将剪纸道具放在灯光和幕布之间，观察幕布上投射出的影子。', 4),
        (v_project_id, '探索影子大小', '移动道具靠近或远离光源，观察影子大小的变化，理解光沿直线传播时，物体距光源越近影子越大的规律。', 5);

    -- Project 5: 气球火箭
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('气球火箭', '用气球和绳子制作一枚能沿绳索飞行的"火箭"，感受反作用力的威力。这个实验完美演示了牛顿第三定律——每个作用力都有一个方向相反的反作用力。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/science_physics.webp', ARRAY['反作用力','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '长条气球', 1),
        (v_project_id, '光滑的绳子或钓鱼线（3-5米）', 2),
        (v_project_id, '吸管一根', 3),
        (v_project_id, '胶带', 4),
        (v_project_id, '夹子', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建发射轨道', '将绳子穿过吸管，然后将绳子两端分别固定在房间两端的椅子上，拉紧绳子。', 1),
        (v_project_id, '安装气球', '给气球吹满气，用夹子夹住气球口防止漏气，然后用胶带将气球粘贴在吸管上。', 2),
        (v_project_id, '发射火箭', '将气球移到绳子一端，松开夹子，观察气球沿绳子快速滑行到另一端。', 3),
        (v_project_id, '对比实验', '分别用不同充气量发射气球，记录每次飞行的距离和速度变化。', 4),
        (v_project_id, '原理总结', '讨论为什么气球会前进：气体向后喷出产生反作用力推动气球前进，这就是火箭的飞行原理。', 5);

    -- Project 6: 水中硬币魔术
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('水中硬币魔术', '将硬币放在碗底，通过倒水让"消失"的硬币重新出现，表演一场神奇的光学魔术。参与者将直观地理解光的折射现象，明白光在不同介质中传播方向会发生改变。', v_author_id, v_sub_id, 1, 15, 'approved', '/projects/science_physics.webp', ARRAY['光的折射','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '不透明的碗', 1),
        (v_project_id, '硬币一枚', 2),
        (v_project_id, '水壶（装满水）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '放置硬币', '将硬币放在空碗底部，站在碗前方慢慢后退，直到刚好看不到硬币为止。', 1),
        (v_project_id, '固定位置', '保持你的眼睛位置不变，请家人帮忙往碗里缓慢倒入清水。', 2),
        (v_project_id, '观察魔术', '随着水慢慢升高，你会神奇地看到硬币重新出现在视线中。', 3),
        (v_project_id, '理解原理', '光从水中射向空气时发生折射弯曲，让原本被碗壁挡住的硬币的光线绕过遮挡到达你的眼睛。', 4);

    -- Project 7: 自制简易潜水艇
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自制简易潜水艇', '用塑料瓶制作一艘可以下沉和上浮的迷你潜水艇，体验真实潜水艇的工作原理。参与者将学习浮力和水压的关系，理解潜水艇通过改变自身重量来控制沉浮。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/science_physics.webp', ARRAY['浮力','水压','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大塑料瓶（2升装）', 1),
        (v_project_id, '小塑料瓶或笔帽', 2),
        (v_project_id, '橡皮泥', 3),
        (v_project_id, '水', 4),
        (v_project_id, '剪刀', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作潜水艇', '在小塑料瓶侧面戳几个小孔，在瓶底粘上适量橡皮泥作为压舱物，使它刚好能竖直浮在水面上。', 1),
        (v_project_id, '放入水中', '将大塑料瓶装满水，把调整好的小瓶放入其中，盖紧大瓶盖。', 2),
        (v_project_id, '控制沉浮', '用力挤压大塑料瓶，观察小瓶缓缓下沉；松开手后，小瓶又会慢慢上浮。', 3),
        (v_project_id, '调节灵敏度', '增减橡皮泥的重量，找到最佳的平衡点，让潜水艇对挤压的反应更灵敏。', 4),
        (v_project_id, '原理分析', '挤压大瓶时水压增大，水被压入小瓶让它变重下沉；松开后水压减小，空气膨胀排出水，小瓶变轻上浮。', 5);

    -- Project 8: 磁力小车
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('磁力小车', '制作一辆由磁铁驱动的小车，不需要电池也能跑起来。通过实验探索磁铁的吸引和排斥特性，理解磁力可以转化为驱动物体运动的能量。', v_author_id, v_sub_id, 2, 25, 'approved', '/projects/science_physics.webp', ARRAY['磁铁','磁力','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小磁铁若干（圆形或方形）', 1),
        (v_project_id, '硬纸板', 2),
        (v_project_id, '瓶盖4个（做车轮）', 3),
        (v_project_id, '竹签2根（做车轴）', 4),
        (v_project_id, '胶水和胶带', 5),
        (v_project_id, '剪刀', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作车身', '剪一块长方形硬纸板作为车身底盘，大小约为10厘米×5厘米。', 1),
        (v_project_id, '安装车轮', '将竹签穿过纸板底部两端，在竹签两头各插上一个瓶盖作为车轮，确保车轮能自由转动。', 2),
        (v_project_id, '安装磁铁', '在车头前方用胶带固定一块磁铁，注意记住朝前的是哪个极。', 3),
        (v_project_id, '磁力驱动', '手持另一块磁铁，用同极靠近车头磁铁产生排斥力推动小车前进，或用异极在前方吸引小车前进。', 4),
        (v_project_id, '竞速挑战', '设计一条赛道，尝试只用磁铁的吸引和排斥力让小车跑完全程，记录完成时间。', 5);

    -- Project 9: 简易万花筒
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('简易万花筒', '用镜面材料制作一个万花筒，透过它看到无穷无尽的美丽图案。参与者将学习光的反射原理，理解多面镜子如何通过反复反射创造出对称的图案。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/science_physics.webp', ARRAY['光的反射','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸筒（保鲜膜芯或自制纸筒）', 1),
        (v_project_id, '镜面卡纸或铝箔贴在硬纸板上（3条长条）', 2),
        (v_project_id, '透明塑料片2片', 3),
        (v_project_id, '小彩色珠子、亮片、彩色碎纸', 4),
        (v_project_id, '胶带和剪刀', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作反射镜', '将三条等宽的镜面卡纸拼成三棱柱形状，镜面朝内，用胶带固定好。', 1),
        (v_project_id, '组装筒身', '将三棱镜组插入纸筒中，确保它贴合紧密不会滑动。', 2),
        (v_project_id, '制作彩色仓', '在纸筒一端放一片透明塑料片，加入小珠子和亮片，再盖上第二片透明塑料片并密封。', 3),
        (v_project_id, '制作观察孔', '在纸筒另一端用纸板封住，中间留一个小圆孔作为观察孔。', 4),
        (v_project_id, '欣赏万花世界', '对着光源，透过观察孔旋转万花筒，欣赏镜面反复反射形成的对称图案，思考为什么三面镜子能产生这么多图案。', 5);

    -- Project 10: 摩擦力滑道实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('摩擦力滑道实验', '搭建不同材质的滑道，让小物体从上面滑下来比较速度差异。通过对比实验，参与者将直观感受不同表面粗糙度对摩擦力大小的影响。', v_author_id, v_sub_id, 2, 25, 'approved', '/projects/science_physics.webp', ARRAY['摩擦力','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '长木板或硬纸板', 1),
        (v_project_id, '砂纸', 2),
        (v_project_id, '光滑塑料纸', 3),
        (v_project_id, '毛巾布', 4),
        (v_project_id, '小玩具车或积木块', 5),
        (v_project_id, '书本若干（搭建斜面）', 6),
        (v_project_id, '卷尺和秒表', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建斜面', '用书本将木板一端垫高，形成一个固定角度的斜面。', 1),
        (v_project_id, '铺设不同材质', '分别在斜面上铺上砂纸、塑料纸和毛巾布三种不同材质的表面。', 2),
        (v_project_id, '滑行测试', '将小车放在斜面顶端同一位置释放，用秒表记录滑到底部的时间，每种材质测三次取平均值。', 3),
        (v_project_id, '记录数据', '将三种材质表面的滑行时间记录在表格中进行对比。', 4),
        (v_project_id, '分析结果', '比较数据得出结论：表面越粗糙摩擦力越大，物体滑行越慢；讨论摩擦力在日常生活中的应用。', 5);

    -- Project 11: 弹力球高度实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('弹力球高度实验', '从不同高度释放弹力球，测量反弹高度与下落高度的关系。参与者将学习弹性和能量转换的概念，理解为什么球不能弹回到原来的高度。', v_author_id, v_sub_id, 2, 25, 'approved', '/projects/science_physics.webp', ARRAY['弹性','能量','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '不同材质的球（弹力球、乒乓球、网球）', 1),
        (v_project_id, '卷尺', 2),
        (v_project_id, '胶带', 3),
        (v_project_id, '记录本和铅笔', 4),
        (v_project_id, '手机（慢动作录像功能）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设置测量标尺', '用胶带将卷尺固定在墙上，从地面开始向上延伸至少1.5米。', 1),
        (v_project_id, '释放与观察', '将弹力球从50厘米高度释放（不要用力扔），观察并记录反弹的最高点。', 2),
        (v_project_id, '改变高度', '分别从30厘米、50厘米、80厘米、100厘米和120厘米高度释放，每个高度测三次。', 3),
        (v_project_id, '换球测试', '用乒乓球和网球重复实验，记录不同球的反弹表现。', 4),
        (v_project_id, '数据分析', '计算每次反弹高度与释放高度的比值，发现球永远不能弹回原高度，因为部分能量在碰撞中转化为热能和声能。', 5);

    -- Project 12: 自制指南针
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自制指南针', '用缝衣针和磁铁制作一个简易指南针，观察它如何指向南北方向。参与者将认识地球磁场的存在，理解磁铁指南北的原理以及指南针在导航中的重要作用。', v_author_id, v_sub_id, 2, 20, 'approved', '/projects/science_physics.webp', ARRAY['磁场','地磁','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '缝衣针', 1),
        (v_project_id, '条形磁铁', 2),
        (v_project_id, '小块泡沫或软木塞', 3),
        (v_project_id, '浅盘装水', 4),
        (v_project_id, '真正的指南针（用于对比验证）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '磁化针', '用磁铁沿同一方向在缝衣针上反复摩擦约50次，让针变成一个小磁铁。', 1),
        (v_project_id, '制作浮台', '将泡沫或软木塞切成小圆片，把磁化后的针平放在上面。', 2),
        (v_project_id, '放入水中', '将带针的浮台轻轻放在浅盘水面上，确保它能自由旋转。', 3),
        (v_project_id, '观察指向', '等浮台稳定后，观察针尖指向的方向，用真正的指南针验证是否指向北方。', 4),
        (v_project_id, '干扰实验', '将磁铁靠近自制指南针，观察针的偏转，移开后看它是否恢复指向南北方向。', 5);

    -- Project 13: 声音可视化实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('声音可视化实验', '用保鲜膜和盐粒让声音变得"看得见"，观察不同声音频率产生的振动图案。参与者将直观理解声波是一种振动，不同频率的声音会产生不同的振动模式。', v_author_id, v_sub_id, 3, 30, 'approved', '/projects/science_physics.webp', ARRAY['声波','振动','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '碗或塑料杯', 1),
        (v_project_id, '保鲜膜', 2),
        (v_project_id, '橡皮筋', 3),
        (v_project_id, '细盐或白砂糖', 4),
        (v_project_id, '蓝牙音箱或手机', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作振动膜', '用保鲜膜紧紧蒙住碗口，用橡皮筋固定，确保膜面绷得很平很紧。', 1),
        (v_project_id, '撒上盐粒', '在保鲜膜表面均匀撒上一薄层细盐粒。', 2),
        (v_project_id, '播放声音', '将音箱靠近碗口播放音乐，观察盐粒随声音振动跳跃和移动的情况。', 3),
        (v_project_id, '测试不同频率', '用手机播放不同频率的纯音（可搜索"频率测试音"），观察低频和高频声音对盐粒运动的不同影响。', 4),
        (v_project_id, '记录发现', '记录不同频率下盐粒形成的图案，讨论为什么高频声音让盐粒跳得更快但幅度更小。', 5);

    -- Project 14: 自制针孔相机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自制针孔相机', '用鞋盒制作一台真正能成像的针孔相机，看到倒立的影像。这个经典实验让参与者深入理解小孔成像的原理，体验人类最早的成像技术。', v_author_id, v_sub_id, 3, 35, 'approved', '/projects/science_physics.webp', ARRAY['小孔成像','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '鞋盒（带盖）', 1),
        (v_project_id, '白色薄纸或半透明描图纸', 2),
        (v_project_id, '铝箔纸', 3),
        (v_project_id, '大头针或图钉', 4),
        (v_project_id, '黑色颜料或黑纸', 5),
        (v_project_id, '胶带和剪刀', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '涂黑内壁', '用黑色颜料或黑纸将鞋盒内壁全部覆盖，减少内部光线反射。', 1),
        (v_project_id, '制作针孔', '在鞋盒一端中央挖一个小方孔，贴上铝箔纸，用大头针在铝箔中心戳一个小而圆的孔。', 2),
        (v_project_id, '安装成像屏', '在鞋盒另一端剪出一个方形窗口，用白色薄纸覆盖作为成像屏幕。', 3),
        (v_project_id, '观察成像', '将针孔对准明亮的窗外或点燃的蜡烛，从成像屏一侧观察，你会看到清晰的倒立影像。', 4),
        (v_project_id, '实验改进', '尝试改变针孔大小，观察影像清晰度和亮度的变化：孔越小影像越清晰但越暗。', 5),
        (v_project_id, '原理思考', '讨论为什么影像是倒立的：因为光沿直线传播，上方物体发出的光穿过小孔后照到屏幕下方。', 6);

    -- Project 15: 密度彩虹塔
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('密度彩虹塔', '利用不同密度的液体在一个杯子里叠出漂亮的彩虹分层效果。参与者将学习密度的概念，理解为什么不同液体可以像楼层一样整齐地分层。', v_author_id, v_sub_id, 3, 30, 'approved', '/projects/science_physics.webp', ARRAY['密度','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '透明高杯', 1),
        (v_project_id, '蜂蜜', 2),
        (v_project_id, '洗洁精（彩色的）', 3),
        (v_project_id, '清水（加食用色素染色）', 4),
        (v_project_id, '食用油', 5),
        (v_project_id, '酒精（加食用色素染色）', 6),
        (v_project_id, '勺子', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '倒入蜂蜜', '先往杯底缓慢倒入蜂蜜，这是密度最大的液体，形成最底层。', 1),
        (v_project_id, '加入洗洁精', '沿杯壁非常缓慢地倒入洗洁精，让它浮在蜂蜜上方形成第二层。', 2),
        (v_project_id, '倒入彩色水', '用勺子背面抵住杯壁，让染了色的水沿勺背缓缓流入，形成第三层。', 3),
        (v_project_id, '加入食用油', '同样沿杯壁缓慢加入食用油，形成第四层。', 4),
        (v_project_id, '放入小物体', '分别放入葡萄、塑料珠、木块等小物体，观察它们停留在不同层之间，进一步理解密度决定沉浮。', 5);

    -- Project 16: 热气球模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('热气球模型', '制作一个简易热气球模型，观察热空气如何让它升起。参与者将亲眼看到热胀冷缩的物理现象，理解热气球飞上天空的科学原理。', v_author_id, v_sub_id, 3, 35, 'approved', '/projects/science_physics.webp', ARRAY['热胀冷缩','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大号薄塑料袋（干洗店袋子最佳）', 1),
        (v_project_id, '吹风机', 2),
        (v_project_id, '细线', 3),
        (v_project_id, '胶带', 4),
        (v_project_id, '轻质纸板（做装饰吊篮）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '检查气密性', '检查塑料袋是否有破洞，用胶带封好所有可能漏气的地方，只留一个开口。', 1),
        (v_project_id, '制作吊篮', '用轻质纸板做一个小吊篮，用细线连接到塑料袋底部四个角。', 2),
        (v_project_id, '加热空气', '用吹风机调到热风档，从开口处向塑料袋内吹入热空气，慢慢将袋子鼓起来。', 3),
        (v_project_id, '释放升空', '当袋子充满热空气后，松开手让它自由上升，观察热气球缓缓升起。', 4),
        (v_project_id, '观察下降', '热空气冷却后气球会慢慢下降，讨论热胀冷缩原理：热空气密度小于周围冷空气所以会上升。', 5);

    -- Project 17: 自制温度计
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自制温度计', '用瓶子、吸管和彩色水制作一个简易温度计，观察液柱随温度升降。参与者将理解热膨胀原理，知道温度计是如何利用液体受热膨胀来测量温度的。', v_author_id, v_sub_id, 3, 30, 'approved', '/projects/science_physics.webp', ARRAY['热膨胀','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小玻璃瓶或塑料瓶', 1),
        (v_project_id, '透明吸管', 2),
        (v_project_id, '橡皮泥或黏土', 3),
        (v_project_id, '食用色素', 4),
        (v_project_id, '水', 5),
        (v_project_id, '热水和冰水（用于测试）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作彩色液体', '在瓶中装入约四分之三的水，加入几滴食用色素搅拌均匀。', 1),
        (v_project_id, '安装吸管', '将吸管插入瓶中使下端浸入水中但不触底，用橡皮泥密封瓶口，确保完全气密。', 2),
        (v_project_id, '标记刻度', '在室温下用笔在吸管上标记当前液面位置作为基准线。', 3),
        (v_project_id, '加热测试', '将瓶子放入温热水中，观察吸管中的液柱缓慢上升，标记新位置。', 4),
        (v_project_id, '冷却测试', '将瓶子放入冷水中，观察液柱下降，标记新位置。', 5),
        (v_project_id, '理解原理', '液体受热膨胀体积变大，被密封的空间挤压，只能沿吸管上升，这就是温度计的工作原理。', 6);

    -- Project 18: 杠杆平衡实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('杠杆平衡实验', '用尺子和橡皮搭建杠杆，探索力矩与平衡的秘密。参与者将通过动手实验理解杠杆原理——力乘以力臂等于阻力乘以阻力臂，感受阿基米德"给我一个支点"的力量。', v_author_id, v_sub_id, 3, 25, 'approved', '/projects/science_physics.webp', ARRAY['力矩','杠杆','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '30厘米直尺', 1),
        (v_project_id, '三角形积木或橡皮（做支点）', 2),
        (v_project_id, '硬币若干（重量相同的）', 3),
        (v_project_id, '小标签纸', 4),
        (v_project_id, '记录本和铅笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建杠杆', '将三角形积木放在桌上作为支点，把直尺平放在支点上，调整使直尺平衡。', 1),
        (v_project_id, '等臂实验', '在尺子两端等距位置各放一枚硬币，确认杠杆保持平衡。', 2),
        (v_project_id, '改变位置', '将一侧的硬币移近支点，观察杠杆失去平衡；在另一侧增减硬币使其重新平衡。', 3),
        (v_project_id, '记录数据', '系统地改变硬币数量和位置，记录每次平衡时两侧"硬币数×距离"的乘积。', 4),
        (v_project_id, '发现规律', '分析数据后发现：平衡时两侧的"力×力臂"总是相等的，这就是杠杆原理。', 5),
        (v_project_id, '生活应用', '找出生活中的杠杆应用实例：剪刀、跷跷板、开瓶器等，判断它们的支点、力点和阻力点。', 6);

    -- Project 19: 液压机械臂
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('液压机械臂', '用注射器和软管制作一个液压驱动的机械臂，实现夹取物体的动作。参与者将学习帕斯卡原理，理解液压系统如何将小力放大为大力来完成工作。', v_author_id, v_sub_id, 4, 60, 'approved', '/projects/science_physics.webp', ARRAY['帕斯卡原理','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '注射器（不带针头）4-6个', 1),
        (v_project_id, '软胶管若干段', 2),
        (v_project_id, '硬纸板或冰棒棍', 3),
        (v_project_id, '热熔胶枪', 4),
        (v_project_id, '螺丝和螺母', 5),
        (v_project_id, '水', 6),
        (v_project_id, '扎带', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作液压系统', '将两个注射器通过软管连接，注入水排尽空气，推一个注射器活塞观察另一个被推出。', 1),
        (v_project_id, '搭建臂架', '用硬纸板或冰棒棍制作机械臂的骨架，包括底座、大臂和小臂三个部分，用螺丝连接形成可转动的关节。', 2),
        (v_project_id, '安装液压缸', '将注射器分别固定在关节两侧，一端固定在臂架上，另一端通过软管连到控制端的注射器。', 3),
        (v_project_id, '制作夹爪', '在机械臂末端安装两片硬纸板做成夹爪，用一组液压注射器控制开合。', 4),
        (v_project_id, '操控测试', '推拉控制端的注射器来操控机械臂的各个关节，尝试夹取小物体搬运到指定位置。', 5),
        (v_project_id, '原理学习', '感受帕斯卡原理：密闭液体传递压强不变，改变注射器大小可以实现力的放大或缩小。', 6);

    -- Project 20: 电磁铁制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('电磁铁制作', '用铁钉和电线制作一个可以开关的电磁铁，体验电流产生磁场的奇妙。参与者将学习电磁感应的基本原理，了解电和磁之间的密切关系。', v_author_id, v_sub_id, 4, 35, 'approved', '/projects/science_physics.webp', ARRAY['电磁感应','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大铁钉（10厘米左右）', 1),
        (v_project_id, '漆包铜线（约1-2米）', 2),
        (v_project_id, '1.5V电池和电池盒', 3),
        (v_project_id, '回形针若干', 4),
        (v_project_id, '开关（可用鳄鱼夹代替）', 5),
        (v_project_id, '胶带', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绕制线圈', '将漆包铜线紧密地绕在铁钉上，尽量多绕几圈（至少50圈），两头各留出约15厘米的引线。', 1),
        (v_project_id, '刮除漆皮', '用砂纸将铜线两头的漆皮刮掉，露出铜线便于导电。', 2),
        (v_project_id, '连接电路', '将铜线两端通过开关连接到电池的正负极，形成完整电路。', 3),
        (v_project_id, '测试磁力', '闭合开关，将铁钉靠近回形针，观察回形针被吸附；断开开关，回形针掉落。', 4),
        (v_project_id, '改变强度', '增减线圈圈数或更换电池数量，测试吸附回形针的数量变化，探究影响电磁铁强度的因素。', 5);

    -- Project 21: 简易电动机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('简易电动机', '用铜线、磁铁和电池制作一个能旋转的简易电动机。参与者将亲手实现电能到动能的转换，理解磁场对通电导线产生力的作用。', v_author_id, v_sub_id, 4, 40, 'approved', '/projects/science_physics.webp', ARRAY['磁场与电流','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '漆包铜线（约50厘米）', 1),
        (v_project_id, '强力圆形磁铁', 2),
        (v_project_id, '1.5V AA电池', 3),
        (v_project_id, '两个大回形针', 4),
        (v_project_id, '橡皮筋', 5),
        (v_project_id, '砂纸', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绕制线圈', '将铜线在电池上绕5-6圈制成圆形线圈，两端各留出约3厘米作为轴，两个轴要在同一直线上。', 1),
        (v_project_id, '处理轴端', '用砂纸将一端的漆皮全部刮除，另一端只刮除半边（上半面），这是电动机工作的关键。', 2),
        (v_project_id, '制作支架', '将两个回形针弯成支架形状，用橡皮筋分别固定在电池正负极两端。', 3),
        (v_project_id, '组装电动机', '将磁铁放在电池上方，线圈的两个轴分别架在回形针支架上。', 4),
        (v_project_id, '启动旋转', '轻轻拨动线圈使其开始旋转，如果一切正确，线圈将持续自动旋转。', 5),
        (v_project_id, '原理探索', '讨论半刮漆的作用：它使线圈每转半圈断电一次，利用惯性继续转动，形成持续的旋转运动。', 6);

    -- Project 22: 自制望远镜
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自制望远镜', '用两片不同焦距的放大镜制作一架简易望远镜，能看清远处的物体。参与者将学习凸透镜的成像原理，理解望远镜如何通过两片透镜的组合实现放大远处物体的效果。', v_author_id, v_sub_id, 4, 40, 'approved', '/projects/science_physics.webp', ARRAY['透镜成像','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大放大镜（焦距较长，做物镜）', 1),
        (v_project_id, '小放大镜（焦距较短，做目镜）', 2),
        (v_project_id, '两个直径不同可套在一起的纸筒', 3),
        (v_project_id, '黑色卡纸', 4),
        (v_project_id, '胶带和剪刀', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '初步测试', '两手各拿一片放大镜，伸直手臂拿大镜，靠近眼睛拿小镜，对准远处物体前后调整距离直到看清。', 1),
        (v_project_id, '制作镜筒', '将两个纸筒套在一起，确保内筒可以在外筒中自由伸缩以调节焦距。', 2),
        (v_project_id, '安装镜片', '将大放大镜固定在外筒前端作为物镜，小放大镜固定在内筒后端作为目镜。', 3),
        (v_project_id, '内壁遮光', '在纸筒内壁贴上黑色卡纸以减少杂散光的干扰，提高成像质量。', 4),
        (v_project_id, '调焦观察', '将望远镜对准远处景物，缓慢伸缩内筒调节焦距，直到看到清晰放大的影像。', 5),
        (v_project_id, '注意事项', '严禁用望远镜直接观察太阳！可以观察远处的建筑、树木和月亮等安全目标。', 6);

    -- Project 23: 自制小型发电机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自制小型发电机', '用磁铁和线圈制作一个能点亮LED灯的微型发电机。参与者将亲手实现"运动生电"的奇迹，深入理解电磁感应——转动线圈切割磁力线即可产生电流。', v_author_id, v_sub_id, 5, 60, 'approved', '/projects/science_physics.webp', ARRAY['电磁感应','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '强力钕磁铁若干', 1),
        (v_project_id, '漆包铜线（约5米）', 2),
        (v_project_id, 'LED小灯', 3),
        (v_project_id, '硬纸板', 4),
        (v_project_id, '竹签或铁丝（做转轴）', 5),
        (v_project_id, '胶水、胶带', 6),
        (v_project_id, '砂纸', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绕制线圈', '用硬纸板做一个小方框，将漆包铜线在方框上紧密绕约200圈，两端引线留出20厘米并刮除漆皮。', 1),
        (v_project_id, '制作转子', '将线圈安装在竹签转轴上，确保转轴穿过线圈中心且能自由旋转。', 2),
        (v_project_id, '搭建磁场', '在线圈两侧固定强力磁铁，N极和S极相对放置，形成穿过线圈的磁场。', 3),
        (v_project_id, '连接LED', '将线圈两端引线连接到LED灯上。', 4),
        (v_project_id, '手动发电', '快速旋转线圈的转轴，观察LED灯闪烁发光，转速越快灯越亮。', 5),
        (v_project_id, '深入思考', '讨论法拉第电磁感应定律：线圈在磁场中转动切割磁力线，产生感应电流，这是发电厂发电的基本原理。', 6);

    -- Project 24: 测量声速实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('测量声速实验', '利用回声或音叉在管中共振的方法测量声音的传播速度。参与者将掌握科学测量的方法，学习声速的概念，并感受理论与实验相结合的科学精神。', v_author_id, v_sub_id, 5, 45, 'approved', '/projects/science_physics.webp', ARRAY['声速','测量','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '长塑料管或纸筒（约1米）', 1),
        (v_project_id, '音叉（或手机播放固定频率声音）', 2),
        (v_project_id, '水盆', 3),
        (v_project_id, '卷尺', 4),
        (v_project_id, '温度计', 5),
        (v_project_id, '记录本和计算器', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备共振管', '将塑料管竖直插入水盆中，管口朝上，通过上下移动管子改变管内空气柱的长度。', 1),
        (v_project_id, '敲响音叉', '敲击音叉使其振动，将振动的音叉放在管口正上方。', 2),
        (v_project_id, '寻找共振', '缓慢上提管子增加空气柱长度，仔细聆听——当听到声音突然变大时，就找到了共振点。', 3),
        (v_project_id, '测量记录', '用卷尺测量此时管口到水面的距离（空气柱长度L），这约等于声波波长的四分之一。', 4),
        (v_project_id, '计算声速', '声速 = 频率 × 波长 = 频率 × 4L。用音叉上标注的频率代入计算，与理论值340米/秒对比。', 5),
        (v_project_id, '误差分析', '测量室温并查阅不同温度下的声速值，讨论实验误差来源以及温度对声速的影响。', 6);

    -- Project 25: 自制分光器
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自制分光器', '用光盘和纸盒制作一台分光器，观察不同光源的光谱特征。参与者将学习光谱分析的基本方法，了解科学家如何通过分析光谱来判断物质的成分。', v_author_id, v_sub_id, 5, 45, 'approved', '/projects/science_physics.webp', ARRAY['光谱分析','科学','物理'], '科学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '旧CD或DVD光盘', 1),
        (v_project_id, '小纸盒（如手机包装盒）', 2),
        (v_project_id, '美工刀和剪刀', 3),
        (v_project_id, '黑色胶带', 4),
        (v_project_id, '直尺', 5),
        (v_project_id, '黑色卡纸', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作狭缝', '在纸盒一端中央用美工刀切出一条约1毫米宽、2厘米长的狭缝，作为光线入口。', 1),
        (v_project_id, '安装光盘', '在纸盒另一端靠底部切一个方形口，将光盘的彩虹面朝向盒内，以约60度角固定在方形口处。', 2),
        (v_project_id, '遮光处理', '用黑色胶带封好盒子所有缝隙，确保只有狭缝能进光。在光盘正对方向的盒壁开一个观察窗。', 3),
        (v_project_id, '观察白炽灯', '将狭缝对准白炽灯，从观察窗看光盘，你会看到连续的彩虹色带——这就是白炽灯的连续光谱。', 4),
        (v_project_id, '对比不同光源', '分别观察日光灯、LED灯、手机屏幕等光源的光谱，你会发现它们的光谱各不相同。', 5),
        (v_project_id, '光谱分析意义', '讨论为什么不同光源光谱不同，了解科学家如何利用光谱分析来鉴定遥远恒星的化学组成。', 6);

END $$;
