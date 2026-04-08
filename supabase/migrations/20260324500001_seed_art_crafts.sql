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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '手工' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 手工'; END IF;

    -- Project 1: 纸盘动物面具
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸盘动物面具', '用一次性纸盘制作各种可爱的动物面具，锻炼参与者的想象力和动手能力。通过剪、贴、涂色等手工操作，创造出独一无二的动物角色面具。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/handmade_coaster.webp', ARRAY['面具','剪贴','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '一次性纸盘（白色）2-3个', 1),
        (v_project_id, '彩色卡纸', 2),
        (v_project_id, '水彩颜料和画笔', 3),
        (v_project_id, '剪刀', 4),
        (v_project_id, '胶水或双面胶', 5),
        (v_project_id, '橡皮筋或竹筷（固定用）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择动物', '决定要制作哪种动物面具（如小猫、小熊、兔子等），在纸上简单画出设计草稿。', 1),
        (v_project_id, '裁剪纸盘', '在纸盘上标记眼睛位置并剪出两个圆形眼洞，根据需要修剪纸盘边缘形状。', 2),
        (v_project_id, '涂色装饰', '用水彩颜料将纸盘涂上动物对应的底色，等待完全干燥后再进行下一步。', 3),
        (v_project_id, '添加五官', '用彩色卡纸剪出耳朵、鼻子、胡须等部件，用胶水粘贴到纸盘上合适的位置。', 4),
        (v_project_id, '安装手柄', '在面具背面粘上竹筷作为手持柄，或在两侧打孔穿上橡皮筋做成可佩戴的面具。', 5);

    -- Project 2: 毛根小动物
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('毛根小动物', '用彩色毛根条（扭扭棒）弯折出各种可爱的小动物造型。毛根柔软易弯折，很适合用来锻炼手指灵活性和空间想象力。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/handmade_coaster.webp', ARRAY['造型','弯折','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '彩色毛根条若干（多种颜色）', 1),
        (v_project_id, '小号活动眼睛贴片', 2),
        (v_project_id, '胶水', 3),
        (v_project_id, '剪刀', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择动物', '挑选想要制作的小动物（如蝴蝶、蜘蛛、小狗等），选好对应颜色的毛根条。', 1),
        (v_project_id, '弯折身体', '取一根毛根条对折后弯出动物身体的基本轮廓，拧紧连接处使其牢固。', 2),
        (v_project_id, '制作四肢', '用短段毛根条缠绕在身体上制作腿、翅膀或尾巴等部位，调整弯曲角度使造型生动。', 3),
        (v_project_id, '粘贴眼睛', '在头部位置用胶水粘上小活动眼睛，让小动物变得栩栩如生。', 4);

    -- Project 3: 纸杯电话
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸杯电话', '用两个纸杯和一根棉线制作简易电话，体验声音通过振动传播的神奇。参与者在和小伙伴通话的乐趣中，直观理解声波沿固体传导的科学原理。', v_author_id, v_sub_id, 1, 15, 'approved', '/projects/handmade_coaster.webp', ARRAY['声音传播','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '纸杯2个', 1),
        (v_project_id, '棉线或毛线（3-5米）', 2),
        (v_project_id, '牙签或回形针2个', 3),
        (v_project_id, '剪刀或锥子', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '杯底穿孔', '用锥子或剪刀尖在两个纸杯底部中央各戳一个小孔，孔径刚好能穿过棉线。', 1),
        (v_project_id, '穿线固定', '将棉线两端分别从杯底外侧穿入，在杯内绑上牙签或回形针防止线脱出。', 2),
        (v_project_id, '拉紧通话', '两人各持一个纸杯走开直到线绷直，一人对杯口说话，另一人将杯口贴在耳边倾听。', 3),
        (v_project_id, '实验探索', '尝试用不同粗细和材质的线替换，对比传声效果；试试线松弛时还能不能听到声音。', 4);

    -- Project 4: 彩纸拉花装饰
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('彩纸拉花装饰', '用彩色手工纸通过折叠和剪裁制作漂亮的拉花装饰。简单的对称剪纸技巧就能变出花朵、蝴蝶等精美图案，装点房间或节日派对。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/handmade_coaster.webp', ARRAY['剪纸','装饰','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '彩色手工纸若干', 1),
        (v_project_id, '剪刀', 2),
        (v_project_id, '铅笔', 3),
        (v_project_id, '胶水或订书机', 4),
        (v_project_id, '细线或丝带', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '折叠纸张', '取一张正方形彩纸，沿对角线或中线反复对折两到三次，形成扇形或三角形。', 1),
        (v_project_id, '画出图案', '用铅笔在折叠好的纸上画出半个花朵、心形或其他对称图案的轮廓。', 2),
        (v_project_id, '剪裁展开', '沿铅笔线小心剪裁，然后慢慢展开纸张，欣赏对称的拉花图案。', 3),
        (v_project_id, '串联装饰', '制作多个不同颜色和图案的拉花，用胶水或细线将它们串联起来，挂在墙上或天花板上装饰房间。', 4);

    -- Project 5: 编织友谊手链
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('编织友谊手链', '用彩色绣线编织精美的友谊手链，学习基本的编织技法和图案搭配。在编织过程中锻炼耐心和手指协调能力，完成后送给好朋友传递友谊。', v_author_id, v_sub_id, 2, 40, 'approved', '/projects/handmade_coaster.webp', ARRAY['编织','图案','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '彩色绣线4-6根（每根约60厘米）', 1),
        (v_project_id, '剪刀', 2),
        (v_project_id, '胶带或安全别针（固定用）', 3),
        (v_project_id, '硬纸板（可选，辅助编织）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备线材', '选择4根不同颜色的绣线，对齐后在一端打结，留出约5厘米做系带，用胶带将结固定在桌面上。', 1),
        (v_project_id, '学习基本结', '用最左边的线绕第二根线打两个正结，依次向右对每根线重复，完成一行后最左边的线变到最右边。', 2),
        (v_project_id, '编织图案', '重复基本结的步骤，每次都从最左边开始，编织到手链达到适合手腕的长度。', 3),
        (v_project_id, '尝试变化', '学会基本编法后，尝试反向结或V形图案，创造更丰富的花纹效果。', 4),
        (v_project_id, '收尾打结', '编到合适长度后打一个紧实的结，修剪多余线头，将两端系在一起佩戴。', 5);

    -- Project 6: 风筝制作与放飞
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('风筝制作与放飞', '用竹条和轻薄纸张制作一只传统菱形风筝，在户外放飞感受风的力量。参与者将在制作和放飞中了解空气动力学基础知识，体验传统手工艺的魅力。', v_author_id, v_sub_id, 2, 60, 'approved', '/projects/handmade_coaster.webp', ARRAY['空气动力学','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '竹条或细木条2根（约50厘米和40厘米）', 1),
        (v_project_id, '轻薄纸张或塑料薄膜', 2),
        (v_project_id, '棉线或风筝线（至少30米）', 3),
        (v_project_id, '胶带和胶水', 4),
        (v_project_id, '剪刀', 5),
        (v_project_id, '彩色颜料或贴纸（装饰用）', 6),
        (v_project_id, '轻薄布条（做尾巴）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建骨架', '将两根竹条十字交叉绑扎在一起，长竹条竖放，短竹条横放在上方约三分之一处。', 1),
        (v_project_id, '绷线围边', '沿四个竹条端点用线拉出菱形轮廓，在每个端点上用线缠绕固定。', 2),
        (v_project_id, '蒙面装饰', '将纸张裁剪成比菱形稍大的形状，翻折边缘包住围线并用胶水粘牢，在纸面上画上喜欢的图案。', 3),
        (v_project_id, '系提线', '在竹条交叉点和下端点系上提线，调整长度使风筝倾斜约15-20度角。', 4),
        (v_project_id, '安装尾巴', '在风筝底部系上一条约1米长的布条尾巴，帮助风筝在空中保持平衡。', 5),
        (v_project_id, '放飞试验', '选择空旷有风的场地，逆风奔跑放线让风筝升空，通过收放线控制高度和方向。', 6);

    -- Project 7: 扎染 T 恤
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('扎染 T 恤', '用橡皮筋扎出各种花样，再浸入染料制作独一无二的扎染 T 恤。这门古老的染色工艺让参与者体验色彩的融合与渗透，每件作品都是不可复制的艺术品。', v_author_id, v_sub_id, 2, 50, 'approved', '/projects/handmade_coaster.webp', ARRAY['扎染','色彩','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白色纯棉 T 恤一件', 1),
        (v_project_id, '织物染料2-3种颜色', 2),
        (v_project_id, '橡皮筋若干', 3),
        (v_project_id, '塑料挤瓶（装染料用）', 4),
        (v_project_id, '一次性手套', 5),
        (v_project_id, '保鲜膜和塑料袋', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '湿润衣物', '将白色 T 恤放入清水中浸透，拧去多余水分保持湿润状态。', 1),
        (v_project_id, '扎出花样', '根据想要的图案，将 T 恤揪起、折叠或卷绕后用橡皮筋扎紧，扎得越紧花纹越清晰。', 2),
        (v_project_id, '涂染颜料', '戴上手套，将不同颜色的染料分别挤在扎好的衣物不同区域，让颜色充分渗透。', 3),
        (v_project_id, '包裹静置', '用保鲜膜包裹染好的 T 恤放入塑料袋，静置6-8小时让颜色充分固定。', 4),
        (v_project_id, '拆线冲洗', '剪掉橡皮筋，先用冷水冲洗掉多余染料，直到水变清澈，展开欣赏独一无二的花纹。', 5);

    -- Project 8: 纸浆画
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('纸浆画', '将废旧报纸制成彩色纸浆，在画板上堆塑出立体的浮雕画作品。这种独特的创作方式让参与者在环保再利用中感受材料的可塑性，创造出富有层次感的艺术作品。', v_author_id, v_sub_id, 2, 45, 'approved', '/projects/handmade_coaster.webp', ARRAY['纸浆','浮雕','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '旧报纸或废纸若干', 1),
        (v_project_id, '白乳胶', 2),
        (v_project_id, '水彩或丙烯颜料', 3),
        (v_project_id, '硬纸板（做底板）', 4),
        (v_project_id, '盆和水', 5),
        (v_project_id, '铅笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作纸浆', '将报纸撕成碎片放入盆中加水浸泡一小时，然后用手反复揉搓直到变成细腻的纸浆。', 1),
        (v_project_id, '调配彩色纸浆', '挤去多余水分后将纸浆分成几份，分别加入不同颜色的颜料和适量白乳胶搅拌均匀。', 2),
        (v_project_id, '画出底稿', '在硬纸板上用铅笔画出想要表现的图案轮廓，如花朵、动物或风景。', 3),
        (v_project_id, '堆塑造型', '将不同颜色的纸浆按照底稿堆塑在纸板上，用手指按压塑形，营造出高低起伏的浮雕效果。', 4),
        (v_project_id, '晾干完成', '将作品放在通风处自然晾干（约需1-2天），干燥后纸浆会变硬定型，形成持久的立体画面。', 5);

    -- Project 9: 毛毡小挂件
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('毛毡小挂件', '用彩色不织布（毛毡）裁剪缝制可爱的小挂件，如水果、动物或星星。通过学习基础手缝针法，培养参与者的细心和耐心，制作出可以挂在书包上的精美饰品。', v_author_id, v_sub_id, 2, 35, 'approved', '/projects/handmade_coaster.webp', ARRAY['毛毡','缝制','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '彩色不织布（毛毡）若干', 1),
        (v_project_id, '针和绣线', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '填充棉', 4),
        (v_project_id, '挂绳或钥匙扣配件', 5),
        (v_project_id, '铅笔和纸（画模板）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计模板', '在纸上画出想要制作的挂件形状（如小草莓、小猫脸），剪下作为裁剪模板。', 1),
        (v_project_id, '裁剪毛毡', '将模板放在毛毡上描出轮廓，剪出前后两片相同形状以及眼睛、嘴巴等装饰小件。', 2),
        (v_project_id, '装饰正面', '用针线或胶水将五官、花纹等装饰小件固定在正面毛毡片上。', 3),
        (v_project_id, '缝合填充', '将前后两片对齐，用毯边缝沿边缘缝合，留一小口塞入填充棉后缝合封口。', 4),
        (v_project_id, '安装挂件', '在顶部缝上挂绳或扣上钥匙扣配件，一个可爱的毛毡小挂件就完成了。', 5);

    -- Project 10: 皮影戏道具制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('皮影戏道具制作', '用卡纸制作可活动的皮影戏人物道具，搭建小型皮影舞台进行表演。参与者将在制作中了解中国传统皮影艺术，学习关节连接技术，并通过光影表演发挥创造力。', v_author_id, v_sub_id, 3, 50, 'approved', '/projects/handmade_coaster.webp', ARRAY['皮影','光影','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '黑色或深色卡纸', 1),
        (v_project_id, '铅笔和橡皮', 2),
        (v_project_id, '剪刀和美工刀', 3),
        (v_project_id, '小铜扣或毛线（做关节）', 4),
        (v_project_id, '竹签或细木棍', 5),
        (v_project_id, '白色床单或半透明纸（做幕布）', 6),
        (v_project_id, '台灯或手电筒', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计角色', '在纸上画出皮影人物的各个部件：头、身体、上臂、下臂、大腿、小腿，注意侧面轮廓要有特色。', 1),
        (v_project_id, '裁剪部件', '将设计好的部件画到卡纸上并仔细剪下，可以用美工刀刻出眼睛、衣纹等镂空装饰。', 2),
        (v_project_id, '连接关节', '在手臂、腿部关节处用小铜扣连接各部件，确保关节能灵活转动但不会松脱。', 3),
        (v_project_id, '安装操控杆', '在人物身体和手部各粘贴一根竹签作为操控杆，方便表演时控制动作。', 4),
        (v_project_id, '搭建舞台', '在桌子或纸箱上撑起白色幕布，在幕布后方放置台灯作为光源。', 5),
        (v_project_id, '排练表演', '将皮影人物贴近幕布操控表演，通过灯光投射出清晰的影子，编一个小故事进行演出。', 6);

    -- Project 11: 木工小板凳
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('木工小板凳', '使用基本木工工具制作一张简单实用的小板凳，学习锯、钉、磨等基础技能。这是参与者接触木工的入门项目，在安全操作中体验将木材变成家具的成就感。', v_author_id, v_sub_id, 3, 90, 'approved', '/projects/handmade_coaster.webp', ARRAY['木工','工具','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '松木板（约20×25厘米，做凳面）', 1),
        (v_project_id, '方木条4根（约20厘米，做凳腿）', 2),
        (v_project_id, '木工胶水', 3),
        (v_project_id, '砂纸（粗细各一张）', 4),
        (v_project_id, '铁钉或木螺丝', 5),
        (v_project_id, '锤子或螺丝刀', 6),
        (v_project_id, '铅笔和直角尺', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '量测标记', '在凳面板底部四角标记凳腿安装位置，确保四条腿对称均匀分布。', 1),
        (v_project_id, '打磨木材', '用粗砂纸打磨所有木材表面和边角，去除毛刺，再用细砂纸精磨至光滑。', 2),
        (v_project_id, '安装凳腿', '在标记位置涂上木工胶，将凳腿对准粘好后用铁钉或螺丝加固连接。', 3),
        (v_project_id, '检查稳固', '将小板凳放在平面上检查是否平稳，如有歪斜可用砂纸微调凳腿底部。', 4),
        (v_project_id, '装饰完成', '可以用彩色颜料或木蜡油涂刷表面，既美观又能保护木材，等待完全干燥后使用。', 5);

    -- Project 12: 陶艺杯子
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('陶艺杯子', '用陶土手捏技法制作一个独特的小杯子，体验泥土在手中变成器皿的神奇过程。参与者将学习揉泥、捏塑和修整的陶艺基本功，感受这门延续数千年的古老手艺。', v_author_id, v_sub_id, 3, 60, 'approved', '/projects/handmade_coaster.webp', ARRAY['陶艺','手捏','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '陶土或超轻黏土约200克', 1),
        (v_project_id, '小盆水（润手用）', 2),
        (v_project_id, '塑料刮刀和小木棍', 3),
        (v_project_id, '转盘或光滑板面', 4),
        (v_project_id, '丙烯颜料（装饰用）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '揉泥排气', '将陶土反复揉捏约5分钟，排出内部气泡使泥土均匀柔软，避免烧制时开裂。', 1),
        (v_project_id, '捏制杯身', '取一团泥搓成球形，用大拇指从中心按入向四周均匀推薄，慢慢捏出杯子形状，保持壁厚一致。', 2),
        (v_project_id, '安装杯把', '另取一小段泥搓成条状弯成C形，在杯身侧面刻画交叉纹路后用泥浆粘合杯把并抹平接缝。', 3),
        (v_project_id, '修整表面', '用刮刀和湿手指修整杯子的形状和表面，使之圆润光滑，底部压平确保能稳定放置。', 4),
        (v_project_id, '装饰上色', '在杯身刻画花纹或等完全干燥后用丙烯颜料上色，创作出个人专属的艺术杯子。', 5);

    -- Project 13: 刺绣入门
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('刺绣入门', '学习基础刺绣针法，在绣布上绣出简单的花卉或文字图案。参与者将在一针一线中培养专注力和审美能力，体验这门优雅的传统手工艺术。', v_author_id, v_sub_id, 3, 50, 'approved', '/projects/handmade_coaster.webp', ARRAY['刺绣','图案','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '绣花绷子（直径约15厘米）', 1),
        (v_project_id, '棉麻绣布一块', 2),
        (v_project_id, '彩色绣线若干颜色', 3),
        (v_project_id, '绣花针', 4),
        (v_project_id, '水消笔或铅笔', 5),
        (v_project_id, '剪刀', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绷布描图', '将绣布固定在绷子上绷紧，用水消笔在布面上描出简单的花朵或字母图案。', 1),
        (v_project_id, '学习平针', '穿好线后从布背面起针，学习最基础的平针绣：沿线条均匀地上下穿刺。', 2),
        (v_project_id, '练习回针', '学习回针绣法：每次向前一针再退回半针，形成连续不断的线条，适合勾勒轮廓。', 3),
        (v_project_id, '填充缎面', '学习缎面绣：用紧密平行的长短针填满花瓣等区域，呈现丝缎般的光泽效果。', 4),
        (v_project_id, '完成作品', '将整个图案绣完后在背面打结固定收针，修剪多余线头，作品可以装框展示。', 5);

    -- Project 14: 蜡烛制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('蜡烛制作', '用蜡块和模具制作各种造型和颜色的手工蜡烛，还可以添加香精营造氛围。参与者将在制作中了解蜡的熔化与凝固过程，体验将液态材料变成固态艺术品的乐趣。', v_author_id, v_sub_id, 3, 45, 'approved', '/projects/handmade_coaster.webp', ARRAY['蜡烛','造型','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大豆蜡或石蜡块约200克', 1),
        (v_project_id, '蜡烛芯和底座夹', 2),
        (v_project_id, '蜡笔碎块或蜡烛专用色素', 3),
        (v_project_id, '耐热容器（做模具，如纸杯或玻璃杯）', 4),
        (v_project_id, '小锅和大锅（隔水加热用）', 5),
        (v_project_id, '筷子或竹签（固定烛芯）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '融化蜡块', '将蜡块放入小锅中隔水加热，缓慢搅拌直到完全融化成液态，注意温度不要过高。', 1),
        (v_project_id, '调色加香', '在液态蜡中加入蜡笔碎块调成喜欢的颜色，搅拌均匀，可选择加入几滴香精油。', 2),
        (v_project_id, '固定烛芯', '将烛芯底座粘在模具底部中央，烛芯上端绕在横放的筷子上保持垂直居中。', 3),
        (v_project_id, '浇注蜡液', '将调好色的蜡液缓慢倒入模具中，避免产生气泡，注意不要倒满留出一点余量。', 4),
        (v_project_id, '冷却脱模', '静置数小时等蜡完全凝固，如果表面出现凹陷可补浇少量蜡液，完全冷却后取出成品。', 5);

    -- Project 15: 竹编小篮子
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('竹编小篮子', '用竹篾条编织一个精致的小篮子，学习中国传统竹编的基本技法。参与者将在经纬交错的编织中体会传统匠人的智慧，完成一件兼具实用性与美感的手工作品。', v_author_id, v_sub_id, 4, 90, 'approved', '/projects/handmade_coaster.webp', ARRAY['竹编','编织','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '竹篾条若干（宽约5毫米，长约40厘米）', 1),
        (v_project_id, '水盆（泡竹篾用）', 2),
        (v_project_id, '剪刀或小刀', 3),
        (v_project_id, '夹子若干', 4),
        (v_project_id, '砂纸', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '浸泡竹篾', '将竹篾条在温水中浸泡半小时以上，使其变得柔软不易折断，方便编织。', 1),
        (v_project_id, '编织底部', '取6-8根竹篾十字交叉排列形成米字形底部骨架，用另一根竹篾从中心开始绕编固定。', 2),
        (v_project_id, '编到转角', '底部编到需要的大小后，将所有竖篾向上弯折90度，用夹子临时固定形成篮壁骨架。', 3),
        (v_project_id, '编织篮壁', '用竹篾条从底部交替穿插编织篮壁，每一层压紧使编织紧密均匀。', 4),
        (v_project_id, '收口整理', '篮壁编到理想高度后，将多余的竖篾向内折叠插入编织层中锁定，修剪多余部分。', 5),
        (v_project_id, '打磨完善', '用砂纸打磨篮子边缘和表面的毛刺，使之手感光滑，完成一个精致的小竹篮。', 6);

    -- Project 16: 木工收纳盒
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('木工收纳盒', '使用锯切和榫接工艺制作一个实用的木质收纳盒，学习精确量测和组装技巧。这个项目比板凳更进一步，引入简单的榫接结构，让参与者体验传统木工的精密与优雅。', v_author_id, v_sub_id, 4, 120, 'approved', '/projects/handmade_coaster.webp', ARRAY['木工','榫接','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '松木板或桐木板若干', 1),
        (v_project_id, '手工锯', 2),
        (v_project_id, '直角尺和铅笔', 3),
        (v_project_id, '木工胶水', 4),
        (v_project_id, '砂纸（120目和240目）', 5),
        (v_project_id, '夹子（固定胶合用）', 6),
        (v_project_id, '木蜡油或清漆（保护用）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计尺寸', '根据收纳需求确定盒子的长、宽、高尺寸，在木板上用直角尺精确标出每块板材的裁切线。', 1),
        (v_project_id, '锯切板材', '沿标记线小心锯切出底板1块和侧板4块，锯口要平直，锯完后用砂纸打磨切面。', 2),
        (v_project_id, '制作榫口', '在侧板端部标记出指接榫的齿形并仔细锯切，让相邻两块侧板能像手指交叉一样咬合。', 3),
        (v_project_id, '组装胶合', '在榫口处涂木工胶，依次将四块侧板拼接咬合，再粘上底板，用夹子固定等待胶水干燥。', 4),
        (v_project_id, '打磨上油', '胶水干透后拆除夹子，用砂纸从粗到细打磨全部表面至光滑，涂上木蜡油保护木材。', 5);

    -- Project 17: 皮革钥匙包
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('皮革钥匙包', '用植鞣革手工制作一个简约实用的钥匙包，学习皮革裁剪、打孔和手缝技术。参与者将通过这个项目接触皮革手工艺的基础技能，完成一件可以日常使用的精美皮具。', v_author_id, v_sub_id, 4, 80, 'approved', '/projects/handmade_coaster.webp', ARRAY['皮革','缝制','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '植鞣革一块（约15×10厘米，厚1.5毫米）', 1),
        (v_project_id, '菱斩或间距规和圆锥', 2),
        (v_project_id, '蜡线和圆针2根', 3),
        (v_project_id, '按扣一套', 4),
        (v_project_id, '钥匙圈挂钩', 5),
        (v_project_id, '裁皮刀和垫板', 6),
        (v_project_id, '砂纸和封边液', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '裁剪皮料', '按照纸样模板在皮革上画线，用裁皮刀沿线裁出钥匙包的主体皮片。', 1),
        (v_project_id, '打斩定孔', '用间距规沿边缘画出缝线轨迹，再用菱斩沿轨迹打出均匀的缝孔。', 2),
        (v_project_id, '安装配件', '在标记位置安装按扣和钥匙圈挂钩，确保按扣公母面方向正确。', 3),
        (v_project_id, '双针手缝', '将蜡线两端各穿一根针，从第一个孔开始采用双针交叉缝法依次穿过每个缝孔。', 4),
        (v_project_id, '封边处理', '用砂纸打磨皮革边缘至圆润光滑，涂上封边液反复打磨直到边缘呈现光泽。', 5);

    -- Project 18: 微缩家具制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('微缩家具制作', '按照1:12的比例用巴尔沙木或硬纸板制作精致的微缩家具模型。参与者将学习比例缩放的数学概念、精细加工和空间结构设计，打造出一套迷你又逼真的小家具。', v_author_id, v_sub_id, 4, 90, 'approved', '/projects/handmade_coaster.webp', ARRAY['微缩','精细','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '巴尔沙木片或厚卡纸板', 1),
        (v_project_id, '美工刀和切割垫', 2),
        (v_project_id, '直尺和铅笔', 3),
        (v_project_id, '白乳胶', 4),
        (v_project_id, '丙烯颜料', 5),
        (v_project_id, '砂纸', 6),
        (v_project_id, '碎布和小珠子（装饰用）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计图纸', '选择要制作的家具（如椅子或书桌），测量真实家具尺寸后按1:12缩小计算各部件尺寸并画出展开图。', 1),
        (v_project_id, '裁切部件', '在木片或卡纸板上标记尺寸，用美工刀沿线精确切割出每个部件。', 2),
        (v_project_id, '打磨修整', '用砂纸仔细打磨每个切割面和边角，确保部件尺寸准确、表面光滑。', 3),
        (v_project_id, '组装粘合', '按照设计图将各部件用白乳胶粘合组装，注意保持垂直和对称。', 4),
        (v_project_id, '上色装饰', '待胶水干透后用丙烯颜料上色，添加碎布做的小靠垫等细节装饰，使家具更加逼真。', 5);

    -- Project 19: 木工鸟屋制作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('木工鸟屋制作', '用木板设计和搭建一座结构完整的小鸟房屋，可以悬挂在户外吸引鸟类栖息。这个项目综合运用量测、锯切、钻孔、组装等木工技能，是一次完整的木工实践。', v_author_id, v_sub_id, 5, 150, 'approved', '/projects/handmade_coaster.webp', ARRAY['木工','组装','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '松木板（厚约1.5厘米）', 1),
        (v_project_id, '手工锯', 2),
        (v_project_id, '电钻或手摇钻', 3),
        (v_project_id, '木螺丝和铁钉', 4),
        (v_project_id, '木工胶水', 5),
        (v_project_id, '砂纸和铅笔、直角尺', 6),
        (v_project_id, '防水木蜡油或外墙漆', 7),
        (v_project_id, '麻绳或铁丝（悬挂用）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绘制图纸', '设计鸟屋的尺寸（底板约15×15厘米），画出底板、前后板、侧板和屋顶板的裁切图纸。', 1),
        (v_project_id, '锯切板材', '按照图纸尺寸在木板上标线，用手工锯逐一锯切出所有部件，前板锯成五边形留出屋顶斜面。', 2),
        (v_project_id, '钻入口孔', '在前板中上部用电钻钻出直径约3-4厘米的圆形入口孔，入口下方钉一根短木棍做栖息杆。', 3),
        (v_project_id, '组装墙体', '先将四面墙板与底板用胶水和螺丝固定组装，确保各面垂直严密。', 4),
        (v_project_id, '安装屋顶', '将两块屋顶板以一定角度拼合成人字形屋顶，固定在墙体上方并确保能遮雨。', 5),
        (v_project_id, '防水悬挂', '全面打磨后涂刷防水木蜡油保护木材，在屋顶安装挂钩或绑上麻绳用于悬挂在树上。', 6);

    -- Project 20: 布艺玩偶缝制
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('布艺玩偶缝制', '从打版裁剪到缝合填充，完整制作一个布艺玩偶。参与者将学习服装打版的基础思路、多种手缝针法以及立体造型技巧，完成一个独一无二的柔软伙伴。', v_author_id, v_sub_id, 5, 120, 'approved', '/projects/handmade_coaster.webp', ARRAY['布艺','打版','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '棉布或绒布若干（2-3种颜色）', 1),
        (v_project_id, '针线套装（含多色线）', 2),
        (v_project_id, '填充棉约100克', 3),
        (v_project_id, '纸样模板纸', 4),
        (v_project_id, '剪刀和水消笔', 5),
        (v_project_id, '纽扣或小珠子（做眼睛）', 6),
        (v_project_id, '丝带和碎布（装饰用）', 7);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计打版', '在纸上画出玩偶的身体、四肢、耳朵等各部件的纸样，注意留出约0.5厘米的缝份。', 1),
        (v_project_id, '裁剪布料', '将纸样固定在布料上用水消笔描出轮廓，每个部件裁剪正反两片，标记缝合对位点。', 2),
        (v_project_id, '缝合部件', '将每个部件的两片布正面相对，用回针缝沿轮廓线缝合，在不显眼处留返口。', 3),
        (v_project_id, '翻面填充', '从返口将每个部件翻到正面，用筷子或填充棒将填充棉均匀塞入，不要过满也不要太松。', 4),
        (v_project_id, '组装连接', '用藏针缝将四肢、耳朵等部件缝合到身体上，确保对称且连接牢固。', 5),
        (v_project_id, '装饰完成', '缝上纽扣做眼睛，用绣线绣出嘴巴和腮红，系上丝带或制作小衣服点缀玩偶。', 6);

    -- Project 21: 金属丝雕塑
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('金属丝雕塑', '用铝线或铜丝弯折焊接出立体的人物、动物或抽象造型雕塑作品。参与者将在三维空间中构思和创作，锻炼空间想象力和手指精细操控能力，感受线条艺术的独特魅力。', v_author_id, v_sub_id, 5, 90, 'approved', '/projects/handmade_coaster.webp', ARRAY['金属丝','造型','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '铝线或铜丝（1-2毫米粗）若干米', 1),
        (v_project_id, '尖嘴钳和斜口钳', 2),
        (v_project_id, '圆嘴钳（弯曲用）', 3),
        (v_project_id, '木块或石头（做底座）', 4),
        (v_project_id, '砂纸', 5),
        (v_project_id, '铅笔和纸（画草图）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '构思设计', '在纸上从正面和侧面画出雕塑的线条草图，规划好哪些部分需要用一根线连贯完成。', 1),
        (v_project_id, '制作骨架', '取一根长金属丝从头部开始弯折出身体的基本骨架轮廓，在关键处拧紧固定。', 2),
        (v_project_id, '塑造细节', '用短段金属丝缠绕补充四肢、翅膀或尾巴等细节部分，用尖嘴钳精确弯折出手指或羽毛等。', 3),
        (v_project_id, '调整姿态', '整体审视雕塑的比例和姿态，用钳子微调各部分的弯曲角度使造型更加生动自然。', 4),
        (v_project_id, '安装底座', '在木块上钻孔，将雕塑底部的金属丝插入并用胶水固定，确保作品能稳定站立。', 5),
        (v_project_id, '打磨收尾', '用砂纸打磨金属丝末端避免扎手，可以喷涂透明漆保护金属表面防止氧化。', 6);

    -- Project 22: 榫卯结构木工
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('榫卯结构木工', '学习中国传统榫卯工艺，不用一颗钉子制作一个稳固的木质结构作品。参与者将深入了解古代匠人的智慧结晶，体验凸榫与凹卯精密咬合的力学之美和文化底蕴。', v_author_id, v_sub_id, 5, 180, 'approved', '/projects/handmade_coaster.webp', ARRAY['榫卯','传统工艺','艺术','手工'], '艺术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬木条若干（如榉木或橡木，截面约2×2厘米）', 1),
        (v_project_id, '手工锯（细齿）', 2),
        (v_project_id, '凿子和木槌', 3),
        (v_project_id, '直角尺、卡尺和铅笔', 4),
        (v_project_id, '砂纸（多种目数）', 5),
        (v_project_id, '木工台钳', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习榫卯', '通过图解学习几种基础榫卯类型：直角榫、半榫搭接和十字搭接，理解凸出的部分叫"榫"，凹入的部分叫"卯"。', 1),
        (v_project_id, '精确画线', '选择制作直角榫连接，在两根木条端部用直角尺和卡尺精确标出榫头和卯眼的尺寸线。', 2),
        (v_project_id, '锯切榫头', '将木条夹在台钳上，用细齿锯沿标记线锯切出榫头形状，切面要平整垂直。', 3),
        (v_project_id, '凿刻卯眼', '在另一根木条上用凿子沿标记线小心凿出与榫头匹配的卯眼，反复试配直到榫卯能紧密咬合。', 4),
        (v_project_id, '试配组装', '将榫头插入卯眼中检验配合度，过紧则微调卯眼，过松则用木楔加固，追求"严丝合缝"的效果。', 5),
        (v_project_id, '完善作品', '全面打磨所有表面至光滑细腻，可涂上木蜡油展现木材天然纹理之美，完成一件不用钉子的传统木工作品。', 6);

END $$;
