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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '电子制作' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 电子制作'; END IF;

    -- Project 1: LED 发光贺卡
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        'LED 发光贺卡',
        '用铜箔胶带和LED灯珠制作一张会发光的创意贺卡！参与者将学习最基本的电路知识，了解电流从电池正极经过导线和LED回到负极的完整回路。送给家人朋友一张自己做的发光贺卡，既有趣又有心意。',
        v_author_id, v_sub_id, 1, 25, 'approved', '/projects/tech_electronics.webp',
        ARRAY['LED','电路','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '彩色卡纸 1张', 1),
        (v_project_id, '铜箔胶带 1卷', 2),
        (v_project_id, 'LED灯珠（5mm）2-3颗', 3),
        (v_project_id, '纽扣电池（CR2032）1颗', 4),
        (v_project_id, '透明胶带', 5),
        (v_project_id, '彩笔和贴纸（装饰用）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计贺卡图案', '在卡纸上画出贺卡的图案，标记出希望LED发光的位置，比如星星、花朵或灯笼。', 1),
        (v_project_id, '铺设铜箔电路', '用铜箔胶带在卡纸背面粘贴出连接电池和LED位置的线路，注意正负极的走向不要交叉。', 2),
        (v_project_id, '安装LED灯珠', '将LED灯珠的长脚（正极）和短脚（负极）分别压在对应的铜箔胶带上，用透明胶带固定。', 3),
        (v_project_id, '连接电池测试', '将纽扣电池放在铜箔线路的末端，正面朝上对准正极线路，按住观察LED是否亮起。', 4),
        (v_project_id, '装饰完成', '确认电路正常后用胶带固定电池，在贺卡正面用彩笔和贴纸装饰，完成你的发光贺卡。', 5);

    -- Project 2: 简易手电筒
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '简易手电筒',
        '用纸杯、电池和小灯泡组装一个真正能照明的手电筒！参与者将理解简单电路中电池、导线、开关和灯泡各自的作用。完成后可以在黑暗中使用自己做的手电筒，体验动手制作的成就感。',
        v_author_id, v_sub_id, 1, 20, 'approved', '/projects/tech_electronics.webp',
        ARRAY['电路','开关','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '纸杯 1个', 1),
        (v_project_id, '小灯泡（2.5V）1颗', 2),
        (v_project_id, '5号电池 2节', 3),
        (v_project_id, '导线 2根', 4),
        (v_project_id, '电池盒 1个', 5),
        (v_project_id, '透明胶带和剪刀', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备灯座', '在纸杯底部中央戳一个小孔，将小灯泡从杯内穿出，灯泡头露在杯底外面。', 1),
        (v_project_id, '连接电路', '将两根导线分别连接灯泡底部的两个触点，另一端连接电池盒的正负极。', 2),
        (v_project_id, '安装电池', '将电池按正确方向装入电池盒，检查灯泡是否亮起，如不亮检查接触是否良好。', 3),
        (v_project_id, '组装外壳', '用胶带将电池盒固定在纸杯内侧，整理好导线，确保手持时不会松动。', 4),
        (v_project_id, '测试使用', '关掉房间的灯，用自制手电筒照明，讨论电流是如何从电池流经灯泡形成完整回路的。', 5);

    -- Project 3: 锡纸导电实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '锡纸导电实验',
        '用厨房里的锡纸（铝箔）代替导线连接电路，测试哪些材料能导电、哪些不能！参与者将亲手验证导体和绝缘体的区别，建立对材料导电性的直观认识。这是一个材料简单但知识点丰富的入门实验。',
        v_author_id, v_sub_id, 1, 20, 'approved', '/projects/tech_electronics.webp',
        ARRAY['导体','绝缘体','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '锡纸（铝箔）1张', 1),
        (v_project_id, 'LED灯珠 1颗', 2),
        (v_project_id, '纽扣电池 1颗', 3),
        (v_project_id, '待测材料：铅笔、橡皮、硬币、塑料尺、钥匙、木筷', 4),
        (v_project_id, '记录纸和笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建测试电路', '将锡纸剪成两条细长条作为导线，一条连接电池正极和LED长脚，另一条连接电池负极，末端留出空隙。', 1),
        (v_project_id, '验证电路', '先用一小段锡纸连接空隙两端，确认LED能亮起来，说明电路搭建正确。', 2),
        (v_project_id, '逐一测试材料', '将各种待测材料依次放在电路空隙处，观察LED是否亮起，亮则说明该材料导电。', 3),
        (v_project_id, '记录与分类', '在记录纸上列出所有测试结果，将材料分成"导体"和"绝缘体"两类，总结导体通常是金属材质。', 4);

    -- Project 4: 水果导电测试
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '水果导电测试',
        '测试不同水果是否能导电，探究哪种水果的导电能力最强！参与者将了解水果中的酸性汁液含有离子可以导电的原理。用柠檬、苹果、香蕉等常见水果来做实验，发现大自然中隐藏的电学知识。',
        v_author_id, v_sub_id, 1, 25, 'approved', '/projects/tech_electronics.webp',
        ARRAY['导电性','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '各种水果（柠檬、苹果、香蕉、橙子）各1个', 1),
        (v_project_id, '铜片 4片', 2),
        (v_project_id, '镀锌铁钉 4根', 3),
        (v_project_id, '导线（带鳄鱼夹）4根', 4),
        (v_project_id, 'LED灯珠 1颗', 5),
        (v_project_id, '万用表（如有）', 6),
        (v_project_id, '记录纸和笔', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备水果电极', '在每个水果上分别插入一片铜片和一根锌钉，间隔约2厘米，插入深度约一半。', 1),
        (v_project_id, '单个水果测试', '用导线将一个水果的铜片和锌钉分别连接到LED灯珠的两个引脚，观察是否发光。', 2),
        (v_project_id, '串联增强', '如果单个水果电压不够，将多个水果用导线串联起来（前一个的铜片接后一个的锌钉），再连接LED。', 3),
        (v_project_id, '对比记录', '记录每种水果单独使用和串联使用时LED的亮度，讨论为什么酸性越强的水果导电性越好。', 4);

    -- Project 5: LED 创意灯
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        'LED 创意灯',
        '用多颗LED灯珠和并联电路制作一盏漂亮的创意小夜灯！参与者将学习并联电路的接线方式，理解并联时每个灯泡两端电压相同的特点。还可以发挥创意用彩纸和瓶子制作独特的灯罩。',
        v_author_id, v_sub_id, 2, 35, 'approved', '/projects/tech_electronics.webp',
        ARRAY['电路','并联','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'LED灯珠（不同颜色）5-8颗', 1),
        (v_project_id, '纽扣电池（CR2032）2颗', 2),
        (v_project_id, '电池盒 1个', 3),
        (v_project_id, '导线 若干', 4),
        (v_project_id, '透明塑料瓶或玻璃瓶 1个', 5),
        (v_project_id, '彩色薄纸或描图纸', 6),
        (v_project_id, '热熔胶枪（需成年人帮助）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计灯的造型', '选择一个透明瓶子作为灯体，在纸上画出LED的摆放位置，规划好想要的发光效果。', 1),
        (v_project_id, '搭建并联电路', '将所有LED灯珠的正极用导线连在一起，负极也连在一起，形成并联电路，再连接到电池盒。', 2),
        (v_project_id, '固定LED灯珠', '用热熔胶将LED灯珠按设计好的位置固定在瓶子内壁或瓶口周围。', 3),
        (v_project_id, '制作灯罩', '用彩色薄纸包裹瓶身或剪出图案贴在瓶子上，让光线透过时呈现出美丽的色彩效果。', 4),
        (v_project_id, '通电测试', '安装电池通电，在暗处欣赏自己制作的创意灯，讨论并联电路中一颗LED坏了为什么其他灯还能亮。', 5);

    -- Project 6: 简易开关制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '简易开关制作',
        '用回形针和图钉制作几种不同类型的简易开关，控制电路的通断！参与者将理解开关的本质就是控制电路是否闭合。通过制作按压式、滑动式和拨动式开关，了解日常生活中各种开关的工作原理。',
        v_author_id, v_sub_id, 2, 30, 'approved', '/projects/tech_electronics.webp',
        ARRAY['开关','电路','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '回形针 3-4个', 1),
        (v_project_id, '图钉 4-6个', 2),
        (v_project_id, '硬纸板 1块', 3),
        (v_project_id, 'LED灯珠 1颗', 4),
        (v_project_id, '电池和电池盒', 5),
        (v_project_id, '导线 若干', 6),
        (v_project_id, '铝箔纸 少量', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作按压开关', '将两个图钉钉在硬纸板上间隔5毫米，之间放一小段铝箔纸折叠的弹片，按下时铝箔接触两个图钉导通。', 1),
        (v_project_id, '制作拨动开关', '将一个图钉和一个回形针钉在硬纸板上，旋转回形针可以接触或离开另一个图钉。', 2),
        (v_project_id, '搭建测试电路', '用导线将电池、LED灯珠和自制开关串联起来，形成完整电路。', 3),
        (v_project_id, '逐个测试', '分别用不同的自制开关控制LED的亮灭，观察开关闭合时灯亮、断开时灯灭。', 4),
        (v_project_id, '联系生活', '讨论家里的灯开关、遥控器按钮等都是什么类型的开关，它们如何控制电路的通与断。', 5);

    -- Project 7: 导电面团实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '导电面团实验',
        '制作能导电的面团和不导电的面团，用它们搭建有趣的电路！参与者将通过揉面团和点亮LED的方式学习导体与绝缘体的概念。用面团代替导线搭电路，既安全又好玩，是学习电路的绝佳方式。',
        v_author_id, v_sub_id, 2, 40, 'approved', '/projects/tech_electronics.webp',
        ARRAY['导电','电路','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '面粉 1杯', 1),
        (v_project_id, '食盐 1/4杯', 2),
        (v_project_id, '水 适量', 3),
        (v_project_id, '食用油 1勺', 4),
        (v_project_id, 'LED灯珠（多颗多色）', 5),
        (v_project_id, '电池（4.5V 或 9V）', 6),
        (v_project_id, '导线 2根', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作导电面团', '将面粉、大量食盐和水混合揉成面团，盐越多导电性越好。', 1),
        (v_project_id, '制作绝缘面团', '将面粉、食用油和少量水（不加盐）混合揉成另一种面团，这种面团不导电。', 2),
        (v_project_id, '搭建面团电路', '捏两块导电面团作为"导线"，中间用绝缘面团隔开防止短路，将LED灯珠的两脚分别插入两块导电面团。', 3),
        (v_project_id, '通电测试', '用导线将两块导电面团分别连接电池的正负极，观察LED灯是否亮起。', 4),
        (v_project_id, '创意电路', '用面团捏出各种造型（小人、动物等），在上面插LED让它们发光，讨论为什么加盐的面团能导电。', 5);

    -- Project 8: 串联与并联电路对比
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '串联与并联电路对比',
        '动手搭建串联和并联两种电路，对比观察灯泡亮度的差异！参与者将直观理解串联电路中电流只有一条路径而并联电路有多条路径的区别。这是电学学习中最重要的基础概念之一。',
        v_author_id, v_sub_id, 2, 30, 'approved', '/projects/tech_electronics.webp',
        ARRAY['串联','并联','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'LED灯珠（相同规格）4颗', 1),
        (v_project_id, '电池盒及电池', 2),
        (v_project_id, '导线（带鳄鱼夹）6-8根', 3),
        (v_project_id, '小面包板 1块（可选）', 4),
        (v_project_id, '记录纸和笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建串联电路', '将2颗LED灯珠首尾相连串联起来，再接上电池，观察两颗灯的亮度并记录。', 1),
        (v_project_id, '搭建并联电路', '将另外2颗LED灯珠并排并联在电池两端，每颗灯各自有独立的回路，观察亮度并记录。', 2),
        (v_project_id, '对比观察', '对比串联和并联电路中LED的亮度差异，串联时灯较暗，并联时灯更亮。', 3),
        (v_project_id, '断路测试', '分别拔掉串联和并联电路中的一颗LED，观察另一颗LED的变化——串联全灭，并联不受影响。', 4),
        (v_project_id, '总结规律', '画出两种电路的电路图，讨论串联和并联各自的特点以及在生活中的应用（如节日灯串和家庭照明）。', 5);

    -- Project 9: 简易报警器
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '简易报警器',
        '用蜂鸣器和简易开关制作一个门窗报警器，当门被打开时会发出响亮的警报声！参与者将学习蜂鸣器的使用方法和常闭开关的原理。这个项目将电子知识应用到实际生活场景中，非常有实用价值。',
        v_author_id, v_sub_id, 3, 35, 'approved', '/projects/tech_electronics.webp',
        ARRAY['蜂鸣器','开关','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '有源蜂鸣器 1个', 1),
        (v_project_id, '电池（9V）1节', 2),
        (v_project_id, '电池扣 1个', 3),
        (v_project_id, '导线 若干', 4),
        (v_project_id, '回形针和图钉', 5),
        (v_project_id, '硬纸板 1块', 6),
        (v_project_id, '细绳或鱼线 1段', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识蜂鸣器', '了解有源蜂鸣器的正负极，通电即响，正极接电池正极，负极接电池负极。', 1),
        (v_project_id, '制作触发开关', '用回形针和图钉制作一个常闭开关：回形针夹着一小片硬纸板绝缘片，抽走绝缘片电路就导通。', 2),
        (v_project_id, '连接报警电路', '将电池、蜂鸣器和触发开关用导线串联起来，此时绝缘片插入开关中电路断开。', 3),
        (v_project_id, '安装到门上', '将报警器固定在门框上，用细绳将绝缘片连接到门上，门打开时绝缘片被拉出，电路导通蜂鸣器响起。', 4),
        (v_project_id, '测试与改进', '开关门测试报警器是否正常工作，讨论如何改进让报警器更灵敏或声音更大。', 5);

    -- Project 10: 光控小夜灯
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '光控小夜灯',
        '用光敏电阻制作一个天黑自动亮灯、天亮自动灭灯的智能小夜灯！参与者将了解传感器如何感知环境变化并控制电路。光敏电阻是最容易理解的传感器之一，这个项目让参与者初步认识自动控制的概念。',
        v_author_id, v_sub_id, 3, 40, 'approved', '/projects/tech_electronics.webp',
        ARRAY['光敏电阻','传感器','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '光敏电阻 1个', 1),
        (v_project_id, 'LED灯珠（白色）1颗', 2),
        (v_project_id, '三极管（NPN型 S8050）1个', 3),
        (v_project_id, '电阻（10KΩ）1个', 4),
        (v_project_id, '电池盒及电池（3V-5V）', 5),
        (v_project_id, '小面包板 1块', 6),
        (v_project_id, '杜邦线 若干', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识光敏电阻', '了解光敏电阻的特性：光线越强电阻越小，光线越弱电阻越大，用手遮挡时可以测量到明显变化。', 1),
        (v_project_id, '搭建控制电路', '在面包板上将光敏电阻和固定电阻串联分压，中间节点接三极管基极，三极管集电极接LED。', 2),
        (v_project_id, '连接电源', '将电池盒连接到面包板的电源轨道，检查所有连线是否正确。', 3),
        (v_project_id, '光照测试', '用手遮挡光敏电阻模拟天黑，观察LED是否亮起；移开手让光照射，LED应该熄灭。', 4),
        (v_project_id, '制作灯罩', '为小夜灯制作一个简单的灯罩，放在床头或走廊测试实际使用效果。', 5);

    -- Project 11: 电磁铁起重机
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '电磁铁起重机',
        '用铁钉和漆包线自制电磁铁，再搭建成一台能吸起回形针的小起重机！参与者将了解电流通过线圈产生磁场的原理。通过改变线圈圈数和电流大小，探究影响电磁铁磁力强弱的因素。',
        v_author_id, v_sub_id, 3, 40, 'approved', '/projects/tech_electronics.webp',
        ARRAY['电磁铁','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大铁钉 1根', 1),
        (v_project_id, '漆包线 2-3米', 2),
        (v_project_id, '电池（1.5V）2节', 3),
        (v_project_id, '电池盒 1个', 4),
        (v_project_id, '开关 1个', 5),
        (v_project_id, '回形针 若干（被吸物）', 6),
        (v_project_id, '硬纸板和胶水（搭建起重机架）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绕制电磁铁', '将漆包线紧密地缠绕在铁钉上，至少绕50圈以上，两端留出足够长度用于连接电池，注意线圈方向一致。', 1),
        (v_project_id, '测试磁力', '将线圈两端的漆包线刮去绝缘漆，连接电池和开关，按下开关用铁钉靠近回形针，观察是否能吸起来。', 2),
        (v_project_id, '搭建起重机架', '用硬纸板制作一个简单的起重机支架，将电磁铁悬挂在顶端，可以用细绳控制升降。', 3),
        (v_project_id, '起重操作', '通电后让电磁铁靠近回形针吸起，移动到目标位置后断电释放，模拟起重机的工作过程。', 4),
        (v_project_id, '探究实验', '分别改变线圈圈数和电池节数，记录每次能吸起的回形针数量，探究磁力强弱的影响因素。', 5);

    -- Project 12: 摩尔斯电码通信器
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '摩尔斯电码通信器',
        '制作一个能发出长短信号的摩尔斯电码通信器，用灯光或声音传递秘密消息！参与者将学习数字编码的基本概念，了解信息是如何用简单的点和划来表达的。这是通信技术最早期的形式。',
        v_author_id, v_sub_id, 3, 45, 'approved', '/projects/tech_electronics.webp',
        ARRAY['电报','编码','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'LED灯珠 1颗', 1),
        (v_project_id, '有源蜂鸣器 1个', 2),
        (v_project_id, '按钮开关 1个', 3),
        (v_project_id, '电池盒及电池', 4),
        (v_project_id, '导线 若干', 5),
        (v_project_id, '硬纸板（底座）', 6),
        (v_project_id, '摩尔斯电码对照表（打印）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习摩尔斯电码', '打印一份摩尔斯电码对照表，了解每个字母对应的点（短按）和划（长按）组合。', 1),
        (v_project_id, '搭建发报电路', '将按钮开关、LED灯珠和蜂鸣器并联后串联电池，按下按钮时灯亮且发出声音。', 2),
        (v_project_id, '组装发报机', '将所有元件固定在硬纸板底座上，按钮放在方便按压的位置，整理好线路。', 3),
        (v_project_id, '练习发报', '对照电码表，练习用短按和长按发出自己名字的摩尔斯电码，让搭档来"解码"。', 4),
        (v_project_id, '双向通信', '如果条件允许，制作两台发报机用长导线连接，和朋友进行双向摩尔斯电码通信。', 5),
        (v_project_id, '延伸学习', '讨论摩尔斯电码在历史上的重要作用，以及数字编码如何发展成现代计算机的二进制编码。', 6);

    -- Project 13: Arduino LED 跑马灯
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        'Arduino LED 跑马灯',
        '用Arduino开发板控制一排LED灯珠依次点亮形成跑马灯效果！参与者将第一次接触编程控制硬件的概念，学习如何用简单的代码让LED按照自己设计的模式闪烁。这是进入创客世界的第一步。',
        v_author_id, v_sub_id, 4, 60, 'approved', '/projects/tech_electronics.webp',
        ARRAY['Arduino','编程','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino UNO 开发板 1块', 1),
        (v_project_id, 'USB数据线 1根', 2),
        (v_project_id, 'LED灯珠 8颗', 3),
        (v_project_id, '220Ω电阻 8个', 4),
        (v_project_id, '面包板 1块', 5),
        (v_project_id, '杜邦线 若干', 6),
        (v_project_id, '电脑（安装Arduino IDE）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建LED阵列', '在面包板上将8颗LED灯珠排成一行，每颗LED串联一个220Ω电阻，分别连接到Arduino的2-9号数字引脚。', 1),
        (v_project_id, '编写跑马灯代码', '在Arduino IDE中编写程序：用for循环依次将每个引脚设为HIGH点亮LED，延时后设为LOW熄灭，实现依次亮灭效果。', 2),
        (v_project_id, '上传程序', '用USB线将Arduino连接到电脑，选择正确的开发板和端口后上传程序。', 3),
        (v_project_id, '观察效果', '观察LED灯珠是否按顺序依次点亮形成跑马灯效果，调整延时参数改变速度。', 4),
        (v_project_id, '创意模式', '修改代码尝试其他灯光模式：双向跑马灯、中间往两边扩散、随机闪烁等。', 5),
        (v_project_id, '分享展示', '将跑马灯安装在纸板造型上（如小房子、汽车），制成一个完整的创意作品。', 6);

    -- Project 14: 触摸感应灯
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '触摸感应灯',
        '制作一个用手指触摸金属片就能控制亮灭的感应灯！参与者将了解人体也是导体、能改变电路电容值的有趣原理。触摸感应是智能手机屏幕的基础技术，通过这个项目初步认识电容感应的概念。',
        v_author_id, v_sub_id, 4, 45, 'approved', '/projects/tech_electronics.webp',
        ARRAY['电容感应','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino UNO 开发板 1块', 1),
        (v_project_id, 'LED灯珠 1颗', 2),
        (v_project_id, '220Ω电阻 1个', 3),
        (v_project_id, '1MΩ电阻 1个', 4),
        (v_project_id, '铝箔纸（作为触摸片）', 5),
        (v_project_id, '面包板和杜邦线', 6),
        (v_project_id, 'USB数据线和电脑', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作触摸片', '将铝箔纸剪成一块约3×3厘米的正方形贴在硬纸板上，用杜邦线从铝箔引出一根连接线。', 1),
        (v_project_id, '搭建电路', '在面包板上将LED串联220Ω电阻连接到Arduino一个数字引脚，将触摸片通过1MΩ电阻连接到另一个引脚。', 2),
        (v_project_id, '编写感应程序', '使用Arduino的CapacitiveSensor库编写程序，检测触摸片上的电容变化，超过阈值时切换LED状态。', 3),
        (v_project_id, '上传与调试', '上传程序后用手指触摸铝箔片，观察LED是否在每次触摸时切换亮灭，调整灵敏度阈值。', 4),
        (v_project_id, '创意外壳', '为触摸感应灯设计一个外壳，将触摸片做成有趣的形状（如手掌、星星），完成一盏触控灯。', 5);

    -- Project 15: 简易电子琴
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '简易电子琴',
        '用蜂鸣器和按钮制作一个能弹奏不同音调的简易电子琴！参与者将了解声音的高低由频率决定的原理，学习如何用电路产生不同频率的蜂鸣声来模拟音符。把物理声学和电子制作结合在一起。',
        v_author_id, v_sub_id, 4, 50, 'approved', '/projects/tech_electronics.webp',
        ARRAY['蜂鸣器','频率','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino UNO 开发板 1块', 1),
        (v_project_id, '无源蜂鸣器 1个', 2),
        (v_project_id, '按钮开关 7个', 3),
        (v_project_id, '10KΩ电阻 7个', 4),
        (v_project_id, '面包板 1块', 5),
        (v_project_id, '杜邦线 若干', 6),
        (v_project_id, 'USB数据线和电脑', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解音调原理', '学习Do Re Mi Fa Sol La Si七个音符对应的频率值：262、294、330、349、392、440、494 Hz。', 1),
        (v_project_id, '搭建按键电路', '在面包板上安装7个按钮开关，每个按钮一端接Arduino数字引脚，另一端通过下拉电阻接地。', 2),
        (v_project_id, '连接蜂鸣器', '将无源蜂鸣器的正极连接到Arduino的一个PWM引脚，负极接地。', 3),
        (v_project_id, '编写演奏程序', '编写Arduino程序检测每个按钮的状态，按下不同按钮时用tone()函数驱动蜂鸣器发出对应频率的声音。', 4),
        (v_project_id, '弹奏测试', '上传程序后依次按下7个按钮，听听是否能发出Do到Si的完整音阶，尝试弹一首简单的儿歌。', 5),
        (v_project_id, '改进升级', '尝试增加按钮数量扩展音域，或用代码编写自动播放旋律的功能。', 6);

    -- Project 16: 温度感应风扇
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '温度感应风扇',
        '用温度传感器和小风扇制作一个温度升高自动开启的智能风扇！参与者将学习模拟传感器的读取方法和条件判断编程。当周围温度超过设定值时风扇自动转起来，模拟真实的智能家电控制逻辑。',
        v_author_id, v_sub_id, 4, 50, 'approved', '/projects/tech_electronics.webp',
        ARRAY['传感器','Arduino','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino UNO 开发板 1块', 1),
        (v_project_id, 'LM35 温度传感器 1个', 2),
        (v_project_id, '小直流风扇（5V）1个', 3),
        (v_project_id, 'NPN三极管（S8050）1个', 4),
        (v_project_id, '二极管（1N4007）1个', 5),
        (v_project_id, '面包板和杜邦线', 6),
        (v_project_id, 'USB数据线和电脑', 7),
        (v_project_id, 'LCD显示屏 1块（可选）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '连接温度传感器', '将LM35温度传感器插在面包板上，VCC接5V，GND接地，中间输出脚接Arduino的模拟输入引脚A0。', 1),
        (v_project_id, '连接风扇电路', '由于风扇功率较大不能直接用Arduino驱动，用三极管作为开关，Arduino数字引脚通过电阻连接三极管基极，风扇接集电极。', 2),
        (v_project_id, '编写控制程序', '读取温度传感器的模拟值并换算为摄氏度，设定阈值（如28°C），温度超过阈值时输出HIGH驱动风扇转动。', 3),
        (v_project_id, '上传与测试', '上传程序后用手捂住传感器提升温度或用吹风机微微加热，观察风扇是否在达到阈值时自动启动。', 4),
        (v_project_id, '显示温度', '如果有LCD显示屏，增加实时温度显示功能，让装置更像一个完整的智能设备。', 5);

    -- Project 17: Arduino 气象站
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        'Arduino 气象站',
        '用Arduino和多种传感器搭建一个能测量温度、湿度和气压的小型气象站！参与者将学习多个传感器的协同工作方式和数据采集的基本方法。可以连续记录天气数据，像真正的气象员一样观测气候变化。',
        v_author_id, v_sub_id, 5, 90, 'approved', '/projects/tech_electronics.webp',
        ARRAY['Arduino','多传感器','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino UNO 开发板 1块', 1),
        (v_project_id, 'DHT11 温湿度传感器 1个', 2),
        (v_project_id, 'BMP180 气压传感器 1个', 3),
        (v_project_id, 'LCD1602 液晶显示屏 1块', 4),
        (v_project_id, '面包板和杜邦线 若干', 5),
        (v_project_id, 'USB数据线和电脑', 6),
        (v_project_id, '10KΩ电位器 1个（调节LCD对比度）', 7),
        (v_project_id, '外壳材料（纸盒或3D打印）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '连接温湿度传感器', '将DHT11传感器连接到面包板，VCC接5V，GND接地，数据脚通过10KΩ上拉电阻接Arduino数字引脚。', 1),
        (v_project_id, '连接气压传感器', '将BMP180通过I2C总线连接到Arduino，SDA接A4，SCL接A5，VCC和GND分别接电源和地线。', 2),
        (v_project_id, '连接LCD显示屏', '按照LCD1602的接线图将其连接到Arduino，安装电位器调节显示对比度到清晰可见。', 3),
        (v_project_id, '编写综合程序', '安装DHT和BMP180库，编写程序循环读取温度、湿度和气压值，格式化后显示在LCD屏幕上。', 4),
        (v_project_id, '组装与测试', '将所有元件整理固定在外壳中，通电运行后与手机天气APP的数据对比验证准确性。', 5),
        (v_project_id, '持续观测', '将气象站放在窗台或阳台，每天记录数据，制作天气变化图表，学习气象数据的含义。', 6);

    -- Project 18: 红外遥控小车
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '红外遥控小车',
        '用红外遥控器和接收模块控制一辆自制小车的前进、后退和转弯！参与者将学习红外通信的原理和电机驱动的方法。这个项目综合了机械结构搭建、电路连接和编程控制，是一个综合性很强的挑战。',
        v_author_id, v_sub_id, 5, 120, 'approved', '/projects/tech_electronics.webp',
        ARRAY['红外','遥控','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino UNO 开发板 1块', 1),
        (v_project_id, 'L298N 电机驱动模块 1个', 2),
        (v_project_id, '直流减速电机 2个（带轮子）', 3),
        (v_project_id, '红外接收模块 1个', 4),
        (v_project_id, '红外遥控器 1个', 5),
        (v_project_id, '小车底盘 1个', 6),
        (v_project_id, '电池组（7.4V锂电池或6节5号电池）', 7),
        (v_project_id, '杜邦线和扎带', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '组装底盘', '将两个电机和万向轮安装在小车底盘上，确保两侧电机对称，轮子转动顺畅。', 1),
        (v_project_id, '连接驱动模块', '将L298N电机驱动模块安装在底盘上，两个电机分别连接到模块的A和B输出端，电池组接模块电源输入。', 2),
        (v_project_id, '连接控制电路', '将Arduino固定在底盘上，L298N的控制引脚（IN1-IN4和ENA、ENB）连接到Arduino数字引脚，红外接收模块连接到另一个引脚。', 3),
        (v_project_id, '解码遥控器', '先编写红外解码程序上传，按下遥控器各按键记录对应的编码值，选定前进、后退、左转、右转和停止的按键。', 4),
        (v_project_id, '编写控制程序', '根据解码的按键值编写小车控制程序：收到"前进"编码时两电机正转，"左转"时左轮停右轮转，"停止"时两电机停止。', 5),
        (v_project_id, '测试与优化', '在开阔地面测试遥控小车的各项操控，调整电机速度和转向灵敏度，让小车完成绕障碍物行驶的任务。', 6);

    -- Project 19: 超声波测距仪
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '超声波测距仪',
        '用超声波传感器制作一个能精确测量距离的电子测距仪！参与者将学习声波反射测距的原理，理解"发射-反射-接收"的计时测距方法。还可以加入蜂鸣器做成倒车雷达，距离越近蜂鸣越急促。',
        v_author_id, v_sub_id, 5, 60, 'approved', '/projects/tech_electronics.webp',
        ARRAY['超声波','Arduino','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'Arduino UNO 开发板 1块', 1),
        (v_project_id, 'HC-SR04 超声波传感器 1个', 2),
        (v_project_id, 'LCD1602 显示屏 1块', 3),
        (v_project_id, '有源蜂鸣器 1个', 4),
        (v_project_id, '面包板和杜邦线', 5),
        (v_project_id, 'USB数据线和电脑', 6),
        (v_project_id, '卷尺（用于验证精度）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解测距原理', '超声波传感器发出40kHz超声脉冲，遇到障碍物后反射回来，通过计算声波往返时间乘以声速再除以2得到距离。', 1),
        (v_project_id, '连接硬件', '将HC-SR04的Trig和Echo分别连接Arduino两个数字引脚，VCC接5V，GND接地，同时连接LCD显示屏和蜂鸣器。', 2),
        (v_project_id, '编写测距程序', '编写Arduino程序：Trig引脚发出10微秒高电平触发脉冲，用pulseIn()读取Echo引脚的返回时间，换算为厘米距离。', 3),
        (v_project_id, '显示与报警', '将测量到的距离实时显示在LCD屏幕上，当距离小于设定值（如20cm）时蜂鸣器开始报警，越近蜂鸣越快。', 4),
        (v_project_id, '精度验证', '用卷尺在不同距离放置障碍物，对比超声波测距仪的读数和实际距离，计算误差。', 5),
        (v_project_id, '实际应用', '将测距仪安装在小车后方做成倒车雷达模型，或放在门口做人员经过检测器。', 6);

    -- Project 20: 蓝牙音箱制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES (
        '蓝牙音箱制作',
        '用蓝牙音频接收模块和功放板组装一个真正能用手机连接播放音乐的蓝牙音箱！参与者将了解无线通信、音频信号放大和扬声器发声的完整链路。这是一个实用性极高的项目，完成后可以日常使用。',
        v_author_id, v_sub_id, 5, 90, 'approved', '/projects/tech_electronics.webp',
        ARRAY['蓝牙模块','音频','技术','电子'], '技术'
    ) RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '蓝牙音频接收模块（如MH-M18）1个', 1),
        (v_project_id, 'PAM8403 功放模块 1个', 2),
        (v_project_id, '3W全频喇叭 2个', 3),
        (v_project_id, '3.7V锂电池 1块', 4),
        (v_project_id, 'TP4056 充电模块 1个', 5),
        (v_project_id, '电源开关 1个', 6),
        (v_project_id, '导线和焊接工具（需成年人帮助）', 7),
        (v_project_id, '木盒或纸盒（音箱外壳）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解各模块功能', '认识蓝牙模块（接收手机音频信号）、功放模块（放大信号驱动喇叭）、充电模块（给锂电池充电）各自的作用。', 1),
        (v_project_id, '连接音频通路', '将蓝牙模块的音频输出（左右声道和地线）连接到功放模块的音频输入端，功放的两个输出端分别连接两个喇叭。', 2),
        (v_project_id, '搭建电源系统', '将锂电池通过TP4056充电模块连接，输出端经开关连接到蓝牙模块和功放模块的供电引脚。', 3),
        (v_project_id, '测试音质', '开机后用手机搜索蓝牙设备并连接，播放音乐测试声音是否正常，检查有无杂音或接触不良。', 4),
        (v_project_id, '组装外壳', '在木盒或纸盒上为喇叭开孔，将所有模块整齐固定在盒内，开关和充电口露在外面方便使用。', 5),
        (v_project_id, '装饰与使用', '装饰音箱外壳使其美观，享受用自己亲手制作的蓝牙音箱播放喜欢的音乐，体会从零到一的创造乐趣。', 6);

END $$;
