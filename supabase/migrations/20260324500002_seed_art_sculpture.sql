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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '雕塑' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 雕塑'; END IF;

    -- Project 1: 黏土小动物
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('黏土小动物', '用彩色黏土捏出可爱的小动物，如兔子、小猫或小熊。参与者通过揉、捏、搓等基本手法锻炼手指灵活性，同时发挥想象力赋予每只小动物独特的表情和姿态。', v_author_id, v_sub_id, 1, 30, 'approved', '/projects/tumbler_toy.webp', ARRAY['黏土','造型','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '彩色超轻黏土（多色套装）', 1),
        (v_project_id, '塑料刀具和模具工具', 2),
        (v_project_id, '牙签若干', 3),
        (v_project_id, '小珠子或纽扣（做眼睛）', 4),
        (v_project_id, '硬纸板底座', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择动物造型', '选定想要制作的小动物，观察参考图片了解动物的基本形态特征。', 1),
        (v_project_id, '制作身体主体', '取适量黏土搓成椭圆形作为身体，再搓一个较小的圆球作为头部，用牙签连接固定。', 2),
        (v_project_id, '添加四肢和尾巴', '搓出四条小圆柱作为四肢，捏出尾巴的形状，逐一粘贴到身体上。', 3),
        (v_project_id, '制作五官和装饰', '用小珠子做眼睛，用黏土捏出耳朵、鼻子等细节，用工具刻画嘴巴和毛发纹理。', 4),
        (v_project_id, '整体调整与展示', '调整各部分比例和姿态，放在硬纸板底座上晾干，完成后可以摆放展示。', 5);

    -- Project 2: 盐面团挂饰
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('盐面团挂饰', '用面粉、盐和水自制面团，捏塑成各种挂饰造型后烘干上色。这是一种经济实惠又有趣的雕塑入门方式，参与者可以体验从原料到成品的完整创作过程。', v_author_id, v_sub_id, 1, 60, 'approved', '/projects/tumbler_toy.webp', ARRAY['盐面团','烘干','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '面粉（2杯）', 1),
        (v_project_id, '食盐（1杯）', 2),
        (v_project_id, '温水（适量）', 3),
        (v_project_id, '擀面杖', 4),
        (v_project_id, '饼干模具或手工刀', 5),
        (v_project_id, '吸管（打孔用）', 6),
        (v_project_id, '丙烯颜料和画笔', 7),
        (v_project_id, '丝带或绳子', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作面团', '将面粉和食盐混合均匀，缓慢加入温水揉成光滑的面团，静置几分钟。', 1),
        (v_project_id, '塑形与打孔', '将面团擀平至约5毫米厚，用模具或手工刀切出星星、爱心、小动物等造型，用吸管在顶部打一个小孔。', 2),
        (v_project_id, '烘干定型', '将造型放在烤盘上，在通风处自然晾干1-2天，或者放入烤箱低温（100°C）烘烤2小时。', 3),
        (v_project_id, '上色装饰', '面团完全干透后，用丙烯颜料涂上喜欢的颜色和图案，等颜料干透。', 4),
        (v_project_id, '穿绳展示', '将丝带或绳子穿过小孔，打结固定，就可以挂在房间里装饰了。', 5);

    -- Project 3: 橡皮泥水果
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('橡皮泥水果', '用彩色橡皮泥塑造逼真的水果模型，学习色彩搭配和仿真造型技巧。通过观察真实水果的形状、颜色和纹理，培养参与者的观察力和艺术表现力。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/tumbler_toy.webp', ARRAY['造型','色彩','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '彩色橡皮泥（红、黄、绿、橙、紫等）', 1),
        (v_project_id, '塑形工具套装', 2),
        (v_project_id, '牙签', 3),
        (v_project_id, '真实水果（作为参考）', 4),
        (v_project_id, '小果篮或纸盘', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '观察水果特征', '仔细观察真实水果的形状、颜色过渡和表面纹理，了解每种水果的特点。', 1),
        (v_project_id, '制作水果主体', '选取对应颜色的橡皮泥，搓成苹果的圆球形、香蕉的弯月形或草莓的锥形等基本形状。', 2),
        (v_project_id, '添加细节特征', '用工具刻出橘子的表面纹理，用绿色橡皮泥做叶子和果蒂，用牙签固定小部件。', 3),
        (v_project_id, '色彩渐变处理', '在水果表面轻轻混合不同颜色，模拟苹果的红绿渐变、香蕉的黄褐斑点等自然效果。', 4),
        (v_project_id, '摆盘展示', '将做好的水果整齐摆放在果篮或纸盘中，创造出一幅美观的静物作品。', 5);

    -- Project 4: 纸团雕塑
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸团雕塑', '用废旧报纸和胶带创作立体雕塑，将废纸变成艺术品。这个项目教会参与者如何利用简单的废旧材料进行三维造型，培养环保意识和创造力。', v_author_id, v_sub_id, 1, 35, 'approved', '/projects/tumbler_toy.webp', ARRAY['废纸','造型','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '废旧报纸或草稿纸', 1),
        (v_project_id, '透明胶带', 2),
        (v_project_id, '白乳胶', 3),
        (v_project_id, '丙烯颜料', 4),
        (v_project_id, '画笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '构思造型', '决定要制作的雕塑主题，可以是动物、人物或抽象造型，画一张简单草图。', 1),
        (v_project_id, '揉捏纸团', '将报纸揉成大小不同的纸团，用作雕塑的各个部件，大纸团做身体，小纸团做头和四肢。', 2),
        (v_project_id, '胶带组装', '用透明胶带将各个纸团紧密缠绕固定在一起，塑造出想要的整体形状。', 3),
        (v_project_id, '表面处理', '在纸团表面涂一层白乳胶，再贴上一层报纸条使表面更光滑平整，晾干后更坚固。', 4),
        (v_project_id, '上色完成', '待表面干透后，用丙烯颜料涂上颜色和图案，完成你的纸团雕塑作品。', 5);

    -- Project 5: 黏土地形沙盘
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('黏土地形沙盘', '用黏土制作微缩地形沙盘，包括山峰、河流、平原和湖泊等地貌特征。参与者在动手塑造地形的过程中学习地理知识，理解不同地形地貌的形成与特点。', v_author_id, v_sub_id, 2, 50, 'approved', '/projects/tumbler_toy.webp', ARRAY['地理','地形','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '超轻黏土（棕、绿、蓝、白色）', 1),
        (v_project_id, '硬纸板或木板底座（约30×40厘米）', 2),
        (v_project_id, '塑形工具', 3),
        (v_project_id, '小树模型或绿色海绵', 4),
        (v_project_id, '蓝色透明胶或蓝色颜料', 5),
        (v_project_id, '地图或地理参考图片', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '规划地形布局', '参考地图或地理课本，在底座上用铅笔画出山脉、河流、平原和湖泊的大致位置。', 1),
        (v_project_id, '塑造山脉与丘陵', '用棕色黏土堆叠出山峰形状，注意表现山脉的走向和高低起伏，山顶可以加白色黏土表示积雪。', 2),
        (v_project_id, '制作河流与湖泊', '用工具在地形上刻出河道，用蓝色黏土或蓝色颜料填充河流和湖泊区域。', 3),
        (v_project_id, '添加植被与细节', '用绿色黏土覆盖平原区域，放置小树模型或绿色海绵表示森林，添加更多地貌细节。', 4),
        (v_project_id, '标注与展示', '用小纸牌标注各地形名称，如"山峰""河谷""盆地"等，完成一个生动的地理教学沙盘。', 5);

    -- Project 6: 石膏翻模体验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('石膏翻模体验', '学习石膏翻模的基本技术，用黏土制作模具并倒入石膏复制造型。参与者将体验工业制造中"翻模"的基本原理，理解正模与负模的关系。', v_author_id, v_sub_id, 2, 60, 'approved', '/projects/tumbler_toy.webp', ARRAY['石膏','翻模','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '石膏粉', 1),
        (v_project_id, '超轻黏土', 2),
        (v_project_id, '纸杯或塑料容器', 3),
        (v_project_id, '搅拌棒', 4),
        (v_project_id, '食用油或凡士林（脱模剂）', 5),
        (v_project_id, '砂纸', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作原型', '用黏土捏出一个简单的造型，如贝壳、树叶或卡通脸，作为翻模的原始模型。', 1),
        (v_project_id, '制作模具', '将黏土压成厚饼状，把原型按压进去形成凹陷的负模，取出原型后在模具表面涂一层薄薄的食用油作为脱模剂。', 2),
        (v_project_id, '调配石膏', '在纸杯中倒入适量水，缓慢加入石膏粉并搅拌均匀至酸奶状浓稠度，注意避免产生气泡。', 3),
        (v_project_id, '浇注脱模', '将调好的石膏液缓慢倒入黏土模具中，轻轻震动排出气泡，等待约30分钟完全凝固后小心脱模。', 4),
        (v_project_id, '打磨上色', '用砂纸打磨石膏表面的毛刺和瑕疵，可以用颜料为石膏作品上色装饰。', 5);

    -- Project 7: 超轻黏土多肉盆栽
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('超轻黏土多肉盆栽', '用超轻黏土制作逼真的多肉植物盆栽，学习仿真造型技巧。通过观察真实多肉植物的叶片排列和色彩变化，培养精细造型能力和色彩感知力。', v_author_id, v_sub_id, 2, 45, 'approved', '/projects/tumbler_toy.webp', ARRAY['仿真','多肉','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '超轻黏土（绿、粉、紫、棕色等）', 1),
        (v_project_id, '小花盆或纸杯', 2),
        (v_project_id, '塑形工具', 3),
        (v_project_id, '牙签', 4),
        (v_project_id, '棕色碎纸或仿真泥土', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '观察多肉特征', '观察真实多肉植物或参考图片，注意叶片的形状、排列方式和颜色渐变。', 1),
        (v_project_id, '制作叶片', '取绿色黏土搓成水滴形，用手指压扁成叶片状，叶尖处可混入少量粉色或紫色黏土做出渐变效果。', 2),
        (v_project_id, '组装多肉', '从中心开始，将叶片围绕一个小黏土球逐层排列，外层叶片逐渐张开，模拟多肉的莲座状结构。', 3),
        (v_project_id, '制作花盆', '在小花盆底部填入棕色碎纸模拟泥土，也可以用棕色黏土做一个迷你花盆。', 4),
        (v_project_id, '组合与点缀', '将做好的多肉植物放入花盆中，添加小石子、苔藓等装饰，完成一盆精致的仿真多肉盆栽。', 5);

    -- Project 8: 锡纸雕塑
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('锡纸雕塑', '利用厨房锡纸的可塑性，揉捏折叠出各种立体造型。锡纸独特的金属质感让作品充满现代感，参与者能快速看到成果，体验三维塑形的乐趣。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/tumbler_toy.webp', ARRAY['锡纸','塑形','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '铝箔锡纸（整卷）', 1),
        (v_project_id, '剪刀', 2),
        (v_project_id, '马克笔（装饰用）', 3),
        (v_project_id, '硬纸板底座', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '裁剪锡纸', '根据要制作的造型大小，裁剪出不同尺寸的锡纸片，大件用大张锡纸，细节用小张。', 1),
        (v_project_id, '塑造基本形状', '将锡纸揉成球形、柱形或锥形等基本几何体，作为雕塑的各个部位。', 2),
        (v_project_id, '拼接组装', '将各部件用锡纸条缠绕连接在一起，可以用揉捏和折叠的方式加固连接处。', 3),
        (v_project_id, '精细塑形', '用手指轻轻调整造型细节，捏出翅膀、尾巴等精细部分，用剪刀修剪多余部分。', 4),
        (v_project_id, '装饰展示', '可以用马克笔在锡纸表面画上眼睛等装饰，将作品固定在硬纸板底座上展示。', 5);

    -- Project 9: 铁丝骨架黏土人物
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('铁丝骨架黏土人物', '先用铁丝搭建人物骨架，再用黏土包裹塑造完整的人物雕塑。学习专业雕塑中"先搭骨架再塑形"的工作方法，让人物造型更稳固、姿态更生动。', v_author_id, v_sub_id, 3, 60, 'approved', '/projects/tumbler_toy.webp', ARRAY['骨架','雕塑','艺术'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '铝丝或扭扭棒（1-2毫米粗）', 1),
        (v_project_id, '尖嘴钳', 2),
        (v_project_id, '超轻黏土（多色）', 3),
        (v_project_id, '塑形工具套装', 4),
        (v_project_id, '小木板底座', 5),
        (v_project_id, '人体姿态参考图', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建骨架', '用铝丝弯折出人物的基本骨架结构：头部圆环、脊柱、手臂和腿部，用钳子拧紧各连接处。', 1),
        (v_project_id, '调整姿态', '参考姿态图片，弯曲铁丝骨架摆出想要的动作姿势，将脚部固定在底座上保持稳定。', 2),
        (v_project_id, '包裹躯干', '用黏土逐步包裹骨架，先从躯干开始，塑造出胸腔和腹部的基本体积。', 3),
        (v_project_id, '塑造四肢', '给手臂和腿部包裹黏土，注意表现肌肉的起伏和关节的转折。', 4),
        (v_project_id, '制作头部与细节', '在头部骨架上塑造脸部特征，添加头发、衣服褶皱等细节，用工具刻画纹理。', 5),
        (v_project_id, '整体调整', '退远观察整体比例和动态是否协调，进行最后的细节修饰和表面光滑处理。', 6);

    -- Project 10: 石膏面具制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('石膏面具制作', '用石膏绷带在气球上制作面具，体验面部雕塑的基础造型方法。参与者将学习如何利用模具创作立体面具，并通过彩绘赋予面具独特的文化内涵。', v_author_id, v_sub_id, 3, 70, 'approved', '/projects/tumbler_toy.webp', ARRAY['石膏','面具','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '石膏绷带', 1),
        (v_project_id, '气球', 2),
        (v_project_id, '凡士林', 3),
        (v_project_id, '温水盆', 4),
        (v_project_id, '剪刀', 5),
        (v_project_id, '丙烯颜料和画笔', 6),
        (v_project_id, '松紧带', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作模具', '将气球吹至脸部大小，在气球表面涂一层薄薄的凡士林方便后续脱模。', 1),
        (v_project_id, '贴敷石膏绷带', '将石膏绷带剪成小条状，逐条浸水后贴在气球的正面（约半球范围），交错叠放3-4层确保厚度均匀。', 2),
        (v_project_id, '塑造面部特征', '在石膏绷带未干时，用手指和工具塑出眉弓、鼻梁、颧骨等面部起伏，增加面具的立体感。', 3),
        (v_project_id, '脱模与修整', '待石膏完全干燥后，戳破气球取出，用剪刀修剪面具边缘，用砂纸打磨粗糙处。', 4),
        (v_project_id, '彩绘装饰', '用丙烯颜料为面具绘制图案，可以参考京剧脸谱、非洲面具或威尼斯面具等不同文化风格。', 5),
        (v_project_id, '安装佩戴', '在面具两侧打孔，穿上松紧带，一副独一无二的艺术面具就完成了。', 6);

    -- Project 11: 纸浆立体雕塑
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸浆立体雕塑', '将废纸打成纸浆，混合胶水塑造成立体雕塑作品。纸浆雕塑是一种古老而环保的艺术形式，参与者可以体验材料从平面到立体的神奇转变过程。', v_author_id, v_sub_id, 3, 90, 'approved', '/projects/tumbler_toy.webp', ARRAY['纸浆','立体','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '废旧报纸或纸巾', 1),
        (v_project_id, '白乳胶', 2),
        (v_project_id, '面粉', 3),
        (v_project_id, '水盆', 4),
        (v_project_id, '气球或纸团（作为内部支撑）', 5),
        (v_project_id, '砂纸', 6),
        (v_project_id, '丙烯颜料', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作纸浆', '将废纸撕成碎片浸泡在温水中数小时，用手捏碎成糊状，挤去多余水分。', 1),
        (v_project_id, '调配黏合剂', '在纸浆中加入白乳胶和少量面粉搅拌均匀，直到纸浆具有良好的可塑性和黏性。', 2),
        (v_project_id, '搭建骨架', '用气球、纸团或铁丝搭建雕塑的内部骨架结构，确定基本形态和比例。', 3),
        (v_project_id, '层层堆塑', '将纸浆一层层涂抹在骨架表面，逐步塑造出造型的细节，每层之间需要适当晾干。', 4),
        (v_project_id, '干燥打磨', '将作品放在通风处彻底晾干（可能需要1-2天），用砂纸打磨表面至光滑。', 5),
        (v_project_id, '上色完成', '用丙烯颜料为作品上色，可以涂一层清漆保护表面，展示你的纸浆雕塑杰作。', 6);

    -- Project 12: 黏土浮雕创作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('黏土浮雕创作', '在平面黏土板上创作有凹凸层次的浮雕作品，学习浮雕的基本构图和造型技法。浮雕介于绘画和雕塑之间，参与者将理解如何用有限的厚度表现丰富的空间层次。', v_author_id, v_sub_id, 3, 50, 'approved', '/projects/tumbler_toy.webp', ARRAY['浮雕','构图','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '超轻黏土或陶土', 1),
        (v_project_id, '擀面杖', 2),
        (v_project_id, '雕塑工具套装', 3),
        (v_project_id, '硬纸板底板', 4),
        (v_project_id, '铅笔（画稿用）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计图稿', '在纸上绘制浮雕草图，确定主题内容（如花卉、风景或动物），标注前景、中景和远景的层次关系。', 1),
        (v_project_id, '制作底板', '将黏土擀平成约1厘米厚的方形底板，放在硬纸板上方便搬动。', 2),
        (v_project_id, '勾勒轮廓', '用铅笔或工具在黏土底板上轻轻刻出设计图案的轮廓线。', 3),
        (v_project_id, '堆塑浮雕', '按照从背景到前景的顺序，逐层添加黏土，前景部分堆得更高更突出，背景部分保持较浅的浮雕效果。', 4),
        (v_project_id, '细节刻画', '用雕塑工具刻画细节纹理，如花瓣的脉络、叶片的锯齿等，丰富浮雕的表现力。', 5),
        (v_project_id, '晾干与上色', '将浮雕作品自然晾干，可以保持黏土原色，也可以用颜料上色增强视觉效果。', 6);

    -- Project 13: 肥皂雕刻入门
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('肥皂雕刻入门', '用雕刻工具在肥皂上进行减材雕刻，学习"去掉多余部分，留下想要的形状"的雕刻思维。肥皂质地柔软易于切削，是参与者学习减材雕刻的理想入门材料。', v_author_id, v_sub_id, 4, 45, 'approved', '/projects/tumbler_toy.webp', ARRAY['雕刻','减材','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大块肥皂（象牙白或浅色优先）', 1),
        (v_project_id, '塑料刀或木刻刀', 2),
        (v_project_id, '牙签（刻细节用）', 3),
        (v_project_id, '铅笔', 4),
        (v_project_id, '废纸（垫在下面接碎屑）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择造型与画线', '选择一个简单的造型如鱼、乌龟或爱心，用铅笔在肥皂表面画出正面和侧面的轮廓线。', 1),
        (v_project_id, '粗略切削', '沿着轮廓线外侧约5毫米处，用塑料刀小心地切去大块多余部分，逐步露出基本形状。', 2),
        (v_project_id, '精细雕刻', '慢慢靠近轮廓线，用小刀片薄薄地削去多余材料，注意力度均匀避免切掉过多。', 3),
        (v_project_id, '刻画细节', '用牙签和小刀刻出眼睛、鳞片、纹理等细节，耐心地一点一点雕琢。', 4),
        (v_project_id, '打磨光滑', '用手指蘸少量水轻轻抹平表面的刀痕和粗糙处，让雕塑表面变得细腻光滑。', 5);

    -- Project 14: 石膏雕刻
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('石膏雕刻', '在预先浇注的石膏块上进行减材雕刻，体验接近真实石雕的创作过程。石膏比石头柔软但比肥皂坚硬，参与者将学习使用专业雕刻工具进行造型创作。', v_author_id, v_sub_id, 4, 80, 'approved', '/projects/tumbler_toy.webp', ARRAY['石膏','工具','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '石膏粉', 1),
        (v_project_id, '纸盒模具（方形或圆柱形）', 2),
        (v_project_id, '木刻刀套装', 3),
        (v_project_id, '锉刀和砂纸', 4),
        (v_project_id, '铅笔和尺子', 5),
        (v_project_id, '防护手套和口罩', 6),
        (v_project_id, '丙烯颜料（可选）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '浇注石膏块', '将石膏粉按比例与水混合倒入纸盒模具中，等待完全凝固后撕去纸盒，得到一块石膏坯。', 1),
        (v_project_id, '绘制轮廓', '在石膏块的多个面上用铅笔画出要雕刻的造型轮廓线，确定各方向的基本形状。', 2),
        (v_project_id, '粗雕定形', '戴好防护装备，用木刻刀沿轮廓线外侧大胆去除多余石膏，快速确定造型的基本体积。', 3),
        (v_project_id, '精雕细刻', '逐步缩小刀具和力度，仔细雕刻五官、衣纹等细节，注意从不同角度观察整体效果。', 4),
        (v_project_id, '打磨抛光', '用锉刀修整大面，再用不同号数的砂纸从粗到细打磨，直到表面达到理想的光滑度。', 5),
        (v_project_id, '上色保护', '可以保持石膏白色的纯净质感，也可以用丙烯颜料上色，最后涂一层清漆保护作品。', 6);

    -- Project 15: 环保材料装置艺术
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('环保材料装置艺术', '收集生活中的废旧物品，组合创作一件有主题的装置艺术作品。参与者将学习当代艺术的表达方式，用废旧材料传达环保理念，培养创新思维和批判性思考。', v_author_id, v_sub_id, 4, 90, 'approved', '/projects/tumbler_toy.webp', ARRAY['废旧材料','装置','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '废旧塑料瓶、瓶盖', 1),
        (v_project_id, '旧报纸和杂志', 2),
        (v_project_id, '废旧光盘、纸筒', 3),
        (v_project_id, '铁丝和扎带', 4),
        (v_project_id, '热熔胶枪', 5),
        (v_project_id, '剪刀和小刀', 6),
        (v_project_id, '喷漆或丙烯颜料', 7),
        (v_project_id, '展示底座（纸板或木板）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '确定主题', '围绕环保话题确定装置艺术的主题，如"海洋污染""过度消费"或"重生"，用文字记录创作构思。', 1),
        (v_project_id, '收集与分类', '在家中收集各种废旧物品，按材质和颜色分类整理，思考每种材料可以代表什么含义。', 2),
        (v_project_id, '设计结构', '画出作品草图，规划各种材料在作品中的位置和组合方式，考虑作品的稳定性。', 3),
        (v_project_id, '组装搭建', '用热熔胶、铁丝和扎带将材料按设计方案固定组合，从底部向上逐步搭建。', 4),
        (v_project_id, '上色与调整', '必要时用喷漆或颜料统一或强调色调，调整各部分位置确保视觉平衡。', 5),
        (v_project_id, '创作说明', '为作品写一段创作说明，解释主题含义和材料选择的原因，完成这件有态度的环保装置艺术。', 6);

    -- Project 16: 陶艺手捏花器
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('陶艺手捏花器', '用陶土手捏成型制作一个可以使用的小花器，体验陶艺从泥到器的完整过程。参与者将学习盘条法和捏塑法等陶艺基本技法，制作出兼具美观和功能性的作品。', v_author_id, v_sub_id, 4, 75, 'approved', '/projects/tumbler_toy.webp', ARRAY['陶艺','功能性','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '陶土或软陶泥', 1),
        (v_project_id, '陶艺工具套装', 2),
        (v_project_id, '转台或光滑板面', 3),
        (v_project_id, '水和海绵', 4),
        (v_project_id, '釉料或丙烯颜料', 5),
        (v_project_id, '保鲜膜', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '揉泥排气', '将陶土反复揉捏排出内部气泡，使泥料质地均匀细腻，避免烧制时开裂。', 1),
        (v_project_id, '制作底部', '取一块泥搓成球状后按扁成圆饼，厚度约8毫米，作为花器底部。', 2),
        (v_project_id, '盘条筑壁', '将泥搓成均匀的长条，沿底部边缘一圈圈往上盘，每层之间用手指压紧粘合，逐渐筑高器壁。', 3),
        (v_project_id, '塑造外形', '用手和工具修整花器的形状，可以做成直筒形、鼓肚形或不规则的有机形态。', 4),
        (v_project_id, '表面处理', '用湿海绵抹平表面，可以刻上花纹或压印纹理作为装饰，制作完后用保鲜膜包裹慢慢阴干。', 5),
        (v_project_id, '上釉装饰', '阴干后涂上釉料或丙烯颜料，如有条件可以送去窑炉烧制，没有条件自然干透也可使用。', 6);

    -- Project 17: 人物头像雕塑
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('人物头像雕塑', '学习人体头部的基本解剖结构，用黏土或陶土塑造写实的人物头像。这是雕塑艺术中最经典的训练项目之一，需要对骨骼、肌肉和五官比例有深入理解。', v_author_id, v_sub_id, 5, 120, 'approved', '/projects/tumbler_toy.webp', ARRAY['雕塑','解剖','艺术'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '雕塑专用黏土或陶土（约2公斤）', 1),
        (v_project_id, '雕塑工具全套', 2),
        (v_project_id, '木质雕塑架或泡沫头模', 3),
        (v_project_id, '喷水壶', 4),
        (v_project_id, '人体头部解剖参考图', 5),
        (v_project_id, '镜子（对照自己的脸）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习头部结构', '研究头部解剖参考图，了解头骨的基本形状、五官的比例关系（三庭五眼），以及面部肌肉的分布。', 1),
        (v_project_id, '搭建基本体积', '在雕塑架上堆出蛋形的头部基本体积，确定头部的大小和朝向，标记出五官的中线和水平线。', 2),
        (v_project_id, '塑造骨骼结构', '先塑出额骨、颧骨、下颌骨等骨性标志点，建立起头部的基本骨架感。', 3),
        (v_project_id, '雕刻五官', '按照"先整体后局部"的原则，逐步刻画眼窝、鼻子、嘴巴和耳朵，注意五官之间的比例和空间关系。', 4),
        (v_project_id, '深入塑造', '添加面部肌肉的起伏和转折，刻画眼睑、嘴唇等精细部分，让表情更加生动自然。', 5),
        (v_project_id, '整体调整', '不断从不同角度审视作品，调整对称性和比例，处理脖子与头部的连接，进行最终的表面光滑处理。', 6);

    -- Project 18: 动态雕塑（悬挂）
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('动态雕塑（悬挂）', '制作可以随风摆动的悬挂式动态雕塑，学习平衡原理与空间构成。灵感来源于艺术大师考尔德的活动雕塑，参与者将在艺术创作中融入物理平衡的科学知识。', v_author_id, v_sub_id, 5, 90, 'approved', '/projects/tumbler_toy.webp', ARRAY['平衡','动态','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '铝丝或细铁丝（多种长度）', 1),
        (v_project_id, '彩色卡纸或薄木片', 2),
        (v_project_id, '鱼线或细绳', 3),
        (v_project_id, '尖嘴钳', 4),
        (v_project_id, '剪刀', 5),
        (v_project_id, '小坠子或小珠子', 6),
        (v_project_id, '挂钩', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计与裁剪形状', '在卡纸上设计并剪出各种有趣的形状，如星形、月牙形、鱼形或抽象图形，大小各异，颜色丰富。', 1),
        (v_project_id, '制作悬臂', '将铝丝剪成不同长度的横杆，在每根横杆的两端弯出小钩用于悬挂部件。', 2),
        (v_project_id, '单层平衡测试', '先从最底层开始，在一根横杆两端分别挂上纸片，找到横杆的平衡点并用鱼线系牢。', 3),
        (v_project_id, '逐层向上搭建', '将已平衡的底层组件挂到上一层横杆的一端，另一端挂上新的纸片或下一组已平衡的组件，再次找到平衡点。', 4),
        (v_project_id, '微调整体平衡', '反复调整每层横杆的悬挂点和各部件的重量分布，确保整个雕塑在静止时保持水平平衡。', 5),
        (v_project_id, '悬挂与欣赏', '在顶部横杆的平衡点系上鱼线，用挂钩挂在天花板或门框上，轻轻吹气欣赏雕塑的优美动态。', 6);

    -- Project 19: 大型纸板公共雕塑
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('大型纸板公共雕塑', '利用回收的大型瓦楞纸板，团队协作搭建一座大型公共雕塑作品。这个项目锻炼团队协作能力和空间想象力，让参与者体验从设计到搭建大型作品的完整流程。', v_author_id, v_sub_id, 5, 150, 'approved', '/projects/tumbler_toy.webp', ARRAY['大型','协作','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大型瓦楞纸板（冰箱或家电包装箱）', 1),
        (v_project_id, '美工刀和直尺', 2),
        (v_project_id, '热熔胶枪和胶棒', 3),
        (v_project_id, '宽胶带和牛皮纸胶带', 4),
        (v_project_id, '铅笔和粉笔', 5),
        (v_project_id, '丙烯颜料和大号刷子', 6),
        (v_project_id, '切割垫', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '团队设计', '全体成员讨论确定雕塑主题和造型，画出设计图并标注尺寸，将整体结构分解为可独立制作的模块。', 1),
        (v_project_id, '测量与裁切', '根据设计图在纸板上画出各个部件的展开图，用美工刀沿线精确裁切，注意预留折叠和连接的余量。', 2),
        (v_project_id, '折叠与加固', '将裁切好的纸板沿折线折叠成立体结构，在内部用三角形纸板加固支撑，确保结构牢固。', 3),
        (v_project_id, '模块拼装', '分组制作的各模块按设计方案用热熔胶和胶带连接在一起，逐步搭建出完整的大型造型。', 4),
        (v_project_id, '彩绘美化', '全体成员分工为雕塑上色，用丙烯颜料绘制图案和色彩，让纸板雕塑焕发生机。', 5),
        (v_project_id, '展示与发表', '将大型雕塑放置在公共空间展示，团队共同发表创作理念和心得，接受大家的欣赏和反馈。', 6);

    -- Project 20: 多材料组合雕塑
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('多材料组合雕塑', '综合运用黏土、金属丝、木片、石膏、织物等多种材料创作一件组合雕塑。这是对所有雕塑技法的综合应用，参与者需要思考如何让不同材质和谐共存，表达统一的艺术主题。', v_author_id, v_sub_id, 5, 120, 'approved', '/projects/tumbler_toy.webp', ARRAY['综合材料','艺术','雕塑'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '超轻黏土和陶土', 1),
        (v_project_id, '铝丝和铜丝', 2),
        (v_project_id, '木片和树枝', 3),
        (v_project_id, '石膏粉', 4),
        (v_project_id, '织物和麻绳', 5),
        (v_project_id, '热熔胶枪', 6),
        (v_project_id, '雕塑工具全套', 7),
        (v_project_id, '展示底座', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '确定主题与构思', '围绕一个主题进行创作构思，思考每种材料的质感特点以及它在作品中可以承担的角色和表达的情感。', 1),
        (v_project_id, '搭建骨架结构', '用铝丝和木片搭建雕塑的主体骨架，确保结构稳固并预留各种材料的附着空间。', 2),
        (v_project_id, '黏土与石膏造型', '在骨架上用黏土塑造主要造型，局部可浇注石膏增加质感对比和坚固度。', 3),
        (v_project_id, '添加金属元素', '用铜丝和铝丝弯折出线条感强的装饰部分，与柔软的黏土形成材质反差。', 4),
        (v_project_id, '织物与自然材料', '在合适的位置缠绕织物或麻绳，插入树枝等自然材料，丰富作品的材质层次。', 5),
        (v_project_id, '整体统一与完成', '审视作品整体效果，调整各材料之间的比例和色彩关系，确保多种材料和谐统一，固定在展示底座上完成作品。', 6);

END $$;
