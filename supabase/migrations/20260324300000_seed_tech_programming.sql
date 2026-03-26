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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '编程入门' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 编程入门'; END IF;

    -- Project 1: 不插电编程：指令画图
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('不插电编程：指令画图', '不需要电脑，只用纸和笔就能体验编程的乐趣！孩子将学会用"上、下、左、右"等简单指令在格子纸上画出图案，理解程序就是一组按顺序执行的指令。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/tech_programming.webp', ARRAY['编程思维','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '方格纸（5×5或更大）', 1),
        (v_project_id, '彩色铅笔或水彩笔', 2),
        (v_project_id, '指令卡片（可自制）', 3),
        (v_project_id, '直尺', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识指令', '学习四个基本方向指令：上↑、下↓、左←、右→，以及"涂色"指令，了解每个指令让画笔移动一格。', 1),
        (v_project_id, '跟着指令画', '家长读出一组指令序列（如：右→右→下↓涂色→下↓涂色），孩子在格子纸上按指令移动并涂色，画出简单图案。', 2),
        (v_project_id, '自己编写指令', '孩子选择一个简单图形（如字母L、十字形），自己写出能画出该图形的指令序列。', 3),
        (v_project_id, '交换挑战', '和家长或小伙伴交换指令，互相执行对方写的"程序"，看看能不能画出正确的图案。', 4),
        (v_project_id, '总结与思考', '讨论如果指令写错了会怎样（bug），以及怎样让指令更简洁（优化），初步体会调试和优化的概念。', 5);

    -- Project 2: 不插电编程：人体机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('不插电编程：人体机器人', '一个人扮演"机器人"，另一个人扮演"程序员"，通过发出精确指令完成任务。孩子将体会到计算机只能执行明确指令，学习指令的精确性和顺序的重要性。', v_author_id, v_sub_id, 1, 30, 'approved', '/projects/tech_programming.webp', ARRAY['编程思维','指令','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '眼罩或围巾（蒙眼用）', 1),
        (v_project_id, '障碍物若干（书包、椅子等）', 2),
        (v_project_id, '终点标记（玩具或小零食）', 3),
        (v_project_id, '指令卡片（前进、左转、右转、拿起）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设置场地', '在房间里用障碍物布置一条路线，在终点放一个目标物品，让"机器人"需要绕过障碍才能到达。', 1),
        (v_project_id, '角色分配', '一人蒙上眼睛扮演"机器人"，另一人扮演"程序员"。机器人只能听从指令行动，不能自己做决定。', 2),
        (v_project_id, '发出指令', '程序员使用简单指令（"前进两步""左转""右转""弯腰拿起"）引导机器人到达终点并拿到物品。', 3),
        (v_project_id, '遇到Bug', '如果机器人撞到障碍物就算"程序崩溃"，需要回到起点重新开始，程序员要修改指令。', 4),
        (v_project_id, '角色互换', '交换角色再玩一次，比较两个人写出的"程序"有什么不同，讨论哪个更高效。', 5),
        (v_project_id, '进阶挑战', '尝试让"程序员"提前写好全部指令（而不是边走边说），一次性交给"机器人"执行，体验预编程的难度。', 6);

    -- Project 3: Scratch 动画故事
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Scratch 动画故事', '使用 Scratch 图形化编程工具创作一段有趣的动画故事，让角色说话、移动和变换造型。孩子将学习顺序执行、事件触发等编程基础概念，同时发挥想象力创编故事。', v_author_id, v_sub_id, 1, 40, 'approved', '/projects/tech_programming.webp', ARRAY['Scratch','动画','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑或平板（安装Scratch或访问scratch.mit.edu）', 1),
        (v_project_id, '故事草稿纸和铅笔', 2),
        (v_project_id, '角色设计草图（可选）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '构思故事', '在纸上画出故事分镜：谁是主角？发生了什么事？有几个场景？先把故事想清楚再开始编程。', 1),
        (v_project_id, '搭建舞台', '打开Scratch，选择或绘制背景，添加故事中需要的角色（角色库中选择或自己画）。', 2),
        (v_project_id, '让角色动起来', '使用"移动""滑行""切换造型"积木块让角色在舞台上移动和变化，用"说"积木块添加对话。', 3),
        (v_project_id, '添加场景切换', '使用"当背景切换到"和"广播消息"积木块实现多场景切换，让故事有起承转合。', 4),
        (v_project_id, '加入音效', '从声音库选择或录制音效和背景音乐，让故事更生动有趣。', 5),
        (v_project_id, '分享作品', '给作品起个好名字，点击"分享"按钮让朋友也能看到你的动画故事。', 6);

    -- Project 4: Scratch 电子贺卡
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Scratch 电子贺卡', '用 Scratch 制作一张会动、会说话的电子贺卡，送给家人或朋友。孩子将练习使用循环、外观特效和声音模块，制作出充满心意的互动贺卡。', v_author_id, v_sub_id, 1, 35, 'approved', '/projects/tech_programming.webp', ARRAY['Scratch','互动','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑或平板（安装Scratch）', 1),
        (v_project_id, '贺卡设计草图', 2),
        (v_project_id, '祝福语内容', 3),
        (v_project_id, '麦克风（录制祝福语用，可选）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计贺卡', '确定贺卡主题（生日、节日、感恩等），在纸上画出贺卡布局，想好要放哪些元素。', 1),
        (v_project_id, '制作背景', '在Scratch中绘制贺卡背景，使用绘图工具画上装饰图案、写上祝福文字。', 2),
        (v_project_id, '添加互动元素', '添加角色（蛋糕、气球、爱心等），用"重复执行"让它们不断旋转、缩放或改变颜色特效。', 3),
        (v_project_id, '设置点击效果', '使用"当角色被点击"积木，让点击不同元素时播放音乐、弹出祝福语或触发动画。', 4),
        (v_project_id, '录制祝福', '用Scratch的录音功能录一段祝福语，设置在打开贺卡时自动播放。', 5);

    -- Project 5: Scratch 弹球游戏
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Scratch 弹球游戏', '制作一个经典的弹球游戏：控制底部挡板反弹小球，击碎上方的砖块。孩子将学习坐标系统、角度反弹和条件判断，体验游戏编程的乐趣。', v_author_id, v_sub_id, 2, 50, 'approved', '/projects/tech_programming.webp', ARRAY['Scratch','游戏编程','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Scratch）', 1),
        (v_project_id, '游戏设计草图', 2),
        (v_project_id, '方格纸（理解坐标用）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '创建挡板', '绘制一个长方形挡板角色，用"当按下左/右箭头"积木控制它左右移动，限制不超出舞台边缘。', 1),
        (v_project_id, '制作小球', '创建圆形小球角色，设置初始位置和方向，使用"移动""碰到边缘就反弹"让它不断运动。', 2),
        (v_project_id, '实现反弹逻辑', '当小球碰到挡板时根据碰撞位置改变反弹角度，碰到舞台底部则游戏结束。', 3),
        (v_project_id, '添加砖块', '用克隆功能创建多排砖块，当小球碰到砖块时砖块消失并加分。', 4),
        (v_project_id, '完善游戏', '添加计分变量、生命值、游戏开始和结束画面，让游戏更加完整。', 5);

    -- Project 6: Scratch 打地鼠游戏
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Scratch 打地鼠游戏', '制作一个打地鼠小游戏：地鼠随机从洞里冒出来，点击它就能得分。孩子将学习随机数、计时器和计分系统的编程实现，理解事件驱动编程的概念。', v_author_id, v_sub_id, 2, 45, 'approved', '/projects/tech_programming.webp', ARRAY['Scratch','计分','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Scratch）', 1),
        (v_project_id, '游戏设计草图', 2),
        (v_project_id, '计分规则设计', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计场景', '绘制一个有多个洞口的草地背景，设计地鼠角色的"藏起来"和"冒出来"两个造型。', 1),
        (v_project_id, '编程地鼠出现', '使用"随机数"积木让地鼠在不同洞口随机出现，用"等待"控制出现频率，随时间加快增加难度。', 2),
        (v_project_id, '实现点击得分', '给地鼠添加"当角色被点击"事件，点中后播放音效、切换造型并给分数变量加分。', 3),
        (v_project_id, '添加计时系统', '创建倒计时变量，每秒减一，时间到零时广播"游戏结束"消息并显示最终得分。', 4),
        (v_project_id, '优化体验', '添加开始界面、最高分记录、打中和错过的不同音效，让游戏体验更完整。', 5);

    -- Project 7: Scratch 音乐创作
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Scratch 音乐创作', '用 Scratch 的音乐积木块创作属于自己的乐曲，把键盘变成钢琴！孩子将学习音符、节拍和循环的概念，在编程中感受音乐的魅力。', v_author_id, v_sub_id, 2, 40, 'approved', '/projects/tech_programming.webp', ARRAY['Scratch','声音','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Scratch）', 1),
        (v_project_id, '简单乐谱（如小星星）', 2),
        (v_project_id, '耳机或音箱', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识音乐积木', '探索Scratch音乐扩展中的"播放音符""设置乐器""设置节奏"等积木块，试着播放不同的音符。', 1),
        (v_project_id, '编写简单旋律', '参考乐谱，用"播放音符__拍__"积木依次排列音符，编出"小星星"或其他简单歌曲。', 2),
        (v_project_id, '制作键盘钢琴', '创建多个琴键角色，分别绑定键盘按键，按下对应键时播放不同音符，实现键盘弹琴。', 3),
        (v_project_id, '添加节奏和伴奏', '使用"打鼓"积木块添加节奏，用循环积木让伴奏自动重复播放，和旋律配合。', 4),
        (v_project_id, '创作原创曲目', '自由组合不同音符、节拍和乐器，创作一首属于自己的原创音乐作品。', 5);

    -- Project 8: Scratch 画笔绘图
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Scratch 画笔绘图', '使用 Scratch 画笔功能编程绘制各种几何图案，从简单的正方形到复杂的万花筒。孩子将理解循环和角度的概念，体会数学与艺术的美妙结合。', v_author_id, v_sub_id, 2, 40, 'approved', '/projects/tech_programming.webp', ARRAY['Scratch','画笔','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Scratch）', 1),
        (v_project_id, '几何图形参考卡', 2),
        (v_project_id, '草稿纸和量角器（理解角度用）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习画笔基础', '添加Scratch画笔扩展，学习"落笔""抬笔""设置颜色""设置粗细"等积木的用法。', 1),
        (v_project_id, '画正方形', '使用"重复4次：移动100步，右转90度"画出一个正方形，理解循环如何减少重复代码。', 2),
        (v_project_id, '画多边形', '修改循环次数和旋转角度，画出三角形、五边形、六边形，发现"次数×角度=360"的规律。', 3),
        (v_project_id, '画螺旋图案', '在循环中逐渐增加移动距离或改变颜色，创作出彩色螺旋线条图案。', 4),
        (v_project_id, '创作万花筒', '将画多边形的代码嵌套在另一个循环中，每次旋转一定角度再画，生成令人惊叹的万花筒图案。', 5);

    -- Project 9: 不插电编程：排序体验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('不插电编程：排序体验', '通过实物卡片体验冒泡排序和选择排序算法，像计算机一样给数字排队。孩子将理解算法是解决问题的步骤，感受不同排序方法的效率差异。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/tech_programming.webp', ARRAY['算法思维','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '数字卡片（1-10各一张）', 1),
        (v_project_id, '计数器或小石子（记录比较次数）', 2),
        (v_project_id, '秒表', 3),
        (v_project_id, '记录表和铅笔', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '打乱卡片', '将数字卡片打乱顺序排成一排，这就是我们要排序的"数据"。', 1),
        (v_project_id, '冒泡排序', '从左到右比较相邻两张卡片，如果左边大就交换位置，一轮走完后最大的数会到最右边。重复直到排好序，记录比较次数。', 2),
        (v_project_id, '选择排序', '重新打乱卡片。每轮找出最小的数放到最左边，然后在剩下的数中找最小的放到第二位，以此类推，记录比较次数。', 3),
        (v_project_id, '对比分析', '比较两种排序方法的比较次数和交换次数，讨论哪种方法更快，为什么。', 4),
        (v_project_id, '生活中的排序', '想一想生活中哪些场景用到了排序（如考试排名、身高排队），讨论计算机排序为什么比人快。', 5);

    -- Project 10: Python 绘图小海龟
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Python 绘图小海龟', '使用 Python 内置的 Turtle 库控制一只小海龟在屏幕上画出各种图形和图案。孩子将在可视化的环境中学习 Python 基础语法，包括变量、循环和函数调用。', v_author_id, v_sub_id, 3, 45, 'approved', '/projects/tech_programming.webp', ARRAY['Python','turtle','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Python 3）', 1),
        (v_project_id, '文本编辑器或IDLE', 2),
        (v_project_id, 'Python turtle参考卡', 3),
        (v_project_id, '图案设计草稿', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '初识海龟', '编写第一个Python程序：import turtle，然后用 turtle.forward(100) 和 turtle.right(90) 让海龟走直线和转弯。', 1),
        (v_project_id, '画彩色图形', '使用 turtle.color() 设置颜色，用 for 循环画出正方形、三角形和圆形，学习循环语法。', 2),
        (v_project_id, '创作花朵图案', '用嵌套循环和旋转组合，让海龟画出由多个几何形组成的花朵或星星图案。', 3),
        (v_project_id, '封装成函数', '将画图形的代码封装成函数如 draw_square(size)，学习函数定义和参数的概念。', 4),
        (v_project_id, '创作自由画', '综合运用所学，创作一幅完整的海龟画作品（如房子、花园、夜空），分享给家人欣赏。', 5);

    -- Project 11: 用 HTML 做个人主页
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('用 HTML 做个人主页', '学习 HTML 和 CSS 基础知识，制作一个介绍自己的个人主页网站。孩子将了解网页是如何构成的，学会使用标题、段落、图片和链接等基本元素来展示自己的兴趣爱好。', v_author_id, v_sub_id, 3, 50, 'approved', '/projects/tech_programming.webp', ARRAY['HTML','CSS','网页','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑', 1),
        (v_project_id, '文本编辑器（VS Code或记事本）', 2),
        (v_project_id, '浏览器（Chrome或Firefox）', 3),
        (v_project_id, '个人照片和介绍内容', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识HTML结构', '创建第一个HTML文件，学习html、head、body标签，用h1写标题，用p写段落，在浏览器中打开查看效果。', 1),
        (v_project_id, '添加内容', '用标题标签写名字，用段落介绍自己的爱好，用img标签添加照片，用a标签添加喜欢的网站链接。', 2),
        (v_project_id, '用CSS美化', '创建style标签，学习设置字体颜色、背景色、边框和间距，让页面变得好看。', 3),
        (v_project_id, '制作多区块', '用div标签将页面分为"关于我""我的爱好""我的相册"等区块，每个区块有不同的背景色和样式。', 4),
        (v_project_id, '发布分享', '将网页文件分享给家人在浏览器中打开观看，或了解如何将网页发布到互联网上。', 5);

    -- Project 12: Scratch 平台跳跃游戏
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Scratch 平台跳跃游戏', '制作一个超级马里奥风格的平台跳跃游戏，控制角色跳跃、奔跑和收集道具。孩子将学习重力模拟、碰撞检测和关卡设计，挑战更复杂的游戏编程逻辑。', v_author_id, v_sub_id, 3, 60, 'approved', '/projects/tech_programming.webp', ARRAY['Scratch','物理模拟','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Scratch）', 1),
        (v_project_id, '关卡设计草图', 2),
        (v_project_id, '角色和道具设计草图', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '创建角色和平台', '绘制主角角色和多个平台色块，将平台角色摆放在舞台上构建关卡地形。', 1),
        (v_project_id, '实现左右移动', '用"当按下左/右箭头"控制角色水平移动，添加走路动画切换造型。', 2),
        (v_project_id, '模拟重力和跳跃', '创建"速度Y"变量模拟重力，按上箭头时给予向上速度实现跳跃，碰到平台时停止下落。', 3),
        (v_project_id, '添加道具和敌人', '添加金币收集和敌人角色，碰到金币加分消失，碰到敌人减血或游戏结束。', 4),
        (v_project_id, '设计多关卡', '使用广播消息和背景切换实现多个关卡，每关难度递增，到达出口进入下一关。', 5),
        (v_project_id, '完善和测试', '添加生命值显示、得分统计、胜利和失败画面，反复测试调整难度至合适水平。', 6);

    -- Project 13: Python 猜数字游戏
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Python 猜数字游戏', '用 Python 编写一个猜数字小游戏：电脑随机想一个数，玩家来猜，程序会告诉你猜大了还是猜小了。孩子将学习条件判断、循环和随机数等核心编程概念。', v_author_id, v_sub_id, 3, 40, 'approved', '/projects/tech_programming.webp', ARRAY['Python','条件判断','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Python 3）', 1),
        (v_project_id, '文本编辑器或IDLE', 2),
        (v_project_id, '程序流程图草稿纸', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '画流程图', '在纸上画出游戏逻辑流程图：生成随机数→获取猜测→判断大小→提示结果→猜对则结束。', 1),
        (v_project_id, '生成随机数', '学习使用 import random 和 random.randint(1, 100) 让电脑随机选一个1到100之间的数。', 2),
        (v_project_id, '编写猜测循环', '使用 while 循环和 input() 函数不断获取玩家输入，用 if/elif/else 判断猜大了、猜小了还是猜对了。', 3),
        (v_project_id, '添加计次功能', '添加变量记录猜测次数，猜对时显示"你用了X次猜对了！"给出评价。', 4),
        (v_project_id, '扩展功能', '添加难度选择（不同数字范围）、再玩一次功能、猜测次数限制等，让游戏更有趣。', 5);

    -- Project 14: Scratch 迷宫游戏
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Scratch 迷宫游戏', '设计并编程一个迷宫冒险游戏，控制角色避开墙壁找到出口。孩子将深入学习碰撞检测的编程实现，练习关卡设计和游戏逻辑规划。', v_author_id, v_sub_id, 3, 50, 'approved', '/projects/tech_programming.webp', ARRAY['Scratch','碰撞检测','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Scratch）', 1),
        (v_project_id, '方格纸（设计迷宫用）', 2),
        (v_project_id, '彩色笔', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计迷宫', '在方格纸上先画好迷宫路线，确保有一条从入口到出口的通路，然后在Scratch背景编辑器中用特定颜色画出迷宫墙壁。', 1),
        (v_project_id, '控制角色移动', '创建小角色，用上下左右箭头键控制移动，每次移动几个像素确保能走进迷宫通道。', 2),
        (v_project_id, '实现墙壁碰撞', '使用"碰到颜色"积木检测是否碰到墙壁颜色，碰到墙壁则将角色弹回上一个位置。', 3),
        (v_project_id, '添加终点判定', '在出口位置放置目标角色或特定颜色区域，碰到时显示"恭喜通关"并记录完成时间。', 4),
        (v_project_id, '增加挑战元素', '添加计时器、移动的敌人障碍物、可收集的钥匙和锁住的门，增加游戏趣味性和难度。', 5);

    -- Project 15: Python 自动化小工具
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Python 自动化小工具', '用 Python 编写实用的自动化脚本，比如批量重命名文件、整理桌面文件夹等。孩子将学习文件操作和字符串处理，体验编程解决实际生活问题的乐趣。', v_author_id, v_sub_id, 4, 50, 'approved', '/projects/tech_programming.webp', ARRAY['Python','文件操作','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Python 3）', 1),
        (v_project_id, '文本编辑器', 2),
        (v_project_id, '练习用的测试文件夹和文件', 3),
        (v_project_id, 'Python os模块参考文档', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解文件操作', '学习 os 和 shutil 模块的基本用法：列出文件、创建文件夹、移动文件、重命名文件。', 1),
        (v_project_id, '批量重命名文件', '编写脚本读取文件夹中的所有文件，按规则批量重命名（如添加日期前缀、统一编号）。', 2),
        (v_project_id, '自动整理文件', '编写脚本根据文件扩展名自动将文件分类移动到对应文件夹（图片、文档、视频等）。', 3),
        (v_project_id, '添加用户交互', '使用 input() 让用户选择要执行的操作、指定文件夹路径等，让工具更灵活实用。', 4),
        (v_project_id, '安全措施和测试', '先在测试文件夹中运行脚本确认效果，添加确认提示防止误操作，处理文件名冲突等异常。', 5);

    -- Project 16: 网页版计算器
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('网页版计算器', '用 HTML、CSS 和 JavaScript 制作一个功能完整的网页计算器，支持加减乘除运算。孩子将学习前端三件套的协作方式，理解事件处理和DOM操作的基本概念。', v_author_id, v_sub_id, 4, 60, 'approved', '/projects/tech_programming.webp', ARRAY['HTML','CSS','JavaScript','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑', 1),
        (v_project_id, '文本编辑器（VS Code推荐）', 2),
        (v_project_id, '浏览器', 3),
        (v_project_id, '计算器界面设计草图', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '搭建HTML结构', '创建计算器的HTML结构：一个显示屏div和多个按钮（0-9数字、+-×÷运算符、等号、清除）。', 1),
        (v_project_id, 'CSS美化界面', '用CSS Grid布局排列按钮为网格形式，设置按钮颜色、圆角、阴影效果，让计算器外观美观。', 2),
        (v_project_id, '实现数字输入', '用JavaScript给每个数字按钮添加点击事件，点击后将数字显示在屏幕上，处理多位数输入。', 3),
        (v_project_id, '实现运算逻辑', '编写计算函数处理加减乘除运算，点击等号时执行计算并显示结果，处理连续运算。', 4),
        (v_project_id, '处理特殊情况', '添加清除功能、退格删除、小数点输入，处理除以零等错误情况，添加按钮点击动画效果。', 5);

    -- Project 17: Python 文字冒险游戏
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Python 文字冒险游戏', '用 Python 编写一个文字冒险游戏，玩家通过输入选择推动剧情发展，探索不同结局。孩子将学习字典数据结构来管理游戏场景，理解分支叙事和状态管理。', v_author_id, v_sub_id, 4, 60, 'approved', '/projects/tech_programming.webp', ARRAY['Python','字典','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Python 3）', 1),
        (v_project_id, '文本编辑器', 2),
        (v_project_id, '故事剧情流程图', 3),
        (v_project_id, '彩色笔和大纸（画分支图用）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计故事', '在纸上画出故事的分支流程图：从起点出发，每个场景有2-3个选择，不同选择导向不同场景和结局。', 1),
        (v_project_id, '用字典存储场景', '用Python字典定义每个场景，包含描述文字、可选选项和对应的下一个场景ID。', 2),
        (v_project_id, '编写游戏引擎', '编写主循环：显示当前场景描述→显示选项→获取玩家输入→跳转到对应场景，直到到达结局场景。', 3),
        (v_project_id, '添加游戏元素', '加入背包系统（收集道具）、生命值、随机事件等，使用列表和变量管理玩家状态。', 4),
        (v_project_id, '丰富故事内容', '添加更多场景和分支，设计至少3个不同结局（好结局、坏结局、隐藏结局），丰富故事体验。', 5),
        (v_project_id, '测试与完善', '反复游玩测试所有分支路线，确保没有死路和逻辑错误，优化文字描述让故事更引人入胜。', 6);

    -- Project 18: Scratch 双人对战游戏
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Scratch 双人对战游戏', '制作一个双人同屏对战游戏（如乒乓球、坦克大战），两个玩家分别用不同按键控制角色。孩子将学习多角色同时控制、碰撞交互和公平竞技规则的编程实现。', v_author_id, v_sub_id, 4, 60, 'approved', '/projects/tech_programming.webp', ARRAY['Scratch','多角色','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Scratch）', 1),
        (v_project_id, '游戏设计方案', 2),
        (v_project_id, '按键分配规划', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计游戏规则', '确定对战游戏类型（如乒乓球），规划两个玩家的操控按键（玩家1用W/S，玩家2用上/下箭头）。', 1),
        (v_project_id, '创建双方角色', '制作两个挡板角色，分别编程响应不同按键控制上下移动，确保互不干扰。', 2),
        (v_project_id, '编写球的运动', '创建球角色，设置自动运动和边缘反弹逻辑，碰到挡板反弹并加速，增加紧张感。', 3),
        (v_project_id, '实现得分系统', '当球越过某方挡板到达边界时对方得分，使用两个变量分别记录双方分数并显示在舞台上。', 4),
        (v_project_id, '胜负判定', '当一方先达到指定分数时宣布获胜，显示胜利画面和最终比分，提供重新开始选项。', 5),
        (v_project_id, '优化游戏体验', '调整球速和挡板速度使游戏平衡，添加开场倒计时、音效和得分动画效果。', 6);

    -- Project 19: Python 简易聊天机器人
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Python 简易聊天机器人', '用 Python 制作一个能对话的简易聊天机器人，它能理解简单问题并给出回答。孩子将学习字符串匹配和处理技巧，初步了解人工智能对话系统的基本原理。', v_author_id, v_sub_id, 4, 50, 'approved', '/projects/tech_programming.webp', ARRAY['Python','字符串','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Python 3）', 1),
        (v_project_id, '文本编辑器', 2),
        (v_project_id, '对话设计脑图', 3),
        (v_project_id, '常见问答列表', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计对话内容', '列出机器人能回答的问题类型（问候、天气、笑话、知识问答等），设计对应的回答内容。', 1),
        (v_project_id, '基础对话框架', '编写主循环：获取用户输入→分析关键词→匹配回答→输出回复，用 while 循环保持持续对话。', 2),
        (v_project_id, '关键词匹配', '使用 if/elif 和字符串的 in 运算符检测用户输入中的关键词，匹配到不同关键词给出不同回答。', 3),
        (v_project_id, '添加随机回复', '对同一类问题准备多个回答，使用 random.choice() 随机选择，让机器人不总是说同样的话。', 4),
        (v_project_id, '增强智能感', '添加记住用户名字、记录对话历史、根据时间问候等功能，让机器人更像真正的聊天伙伴。', 5);

    -- Project 20: Python 数据可视化
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Python 数据可视化', '使用 Python 的 matplotlib 库将数据变成直观的图表，让枯燥的数字活起来。孩子将学习数据收集、整理和可视化展示的完整流程，培养用数据讲故事的能力。', v_author_id, v_sub_id, 5, 60, 'approved', '/projects/tech_programming.webp', ARRAY['Python','matplotlib','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Python 3和matplotlib）', 1),
        (v_project_id, '文本编辑器', 2),
        (v_project_id, '要分析的数据（如天气记录、成绩单）', 3),
        (v_project_id, '记录本（收集数据用）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '收集数据', '选择一个有趣的主题（如一周气温变化、班级同学身高分布），收集并整理数据到Python列表中。', 1),
        (v_project_id, '绘制折线图', '学习 matplotlib.pyplot 的基本用法，用 plot() 函数将气温数据绘制成折线图，添加标题和坐标轴标签。', 2),
        (v_project_id, '绘制柱状图和饼图', '用 bar() 绘制柱状图比较不同类别的数据，用 pie() 绘制饼图展示比例关系。', 3),
        (v_project_id, '美化图表', '学习设置颜色、线型、图例、网格线等样式，让图表更专业美观。', 4),
        (v_project_id, '数据分析报告', '用多个子图组合展示不同维度的数据分析结果，添加文字注解，形成一份完整的数据分析小报告。', 5);

    -- Project 21: 网页版记事本应用
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('网页版记事本应用', '用 HTML、CSS 和 JavaScript 制作一个功能完整的网页记事本，支持添加、编辑、删除和本地保存笔记。孩子将学习 DOM 操作、事件监听和 localStorage 本地存储。', v_author_id, v_sub_id, 5, 70, 'approved', '/projects/tech_programming.webp', ARRAY['HTML','CSS','JavaScript','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑', 1),
        (v_project_id, '文本编辑器（VS Code推荐）', 2),
        (v_project_id, '浏览器', 3),
        (v_project_id, '应用界面设计草图', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计界面布局', '用HTML创建页面结构：顶部标题栏、笔记输入区（标题+内容）、添加按钮和笔记列表展示区。', 1),
        (v_project_id, '美化样式', '用CSS设计现代风格界面：卡片式笔记列表、渐变背景、悬浮阴影效果、响应式布局适配不同屏幕。', 2),
        (v_project_id, '实现添加功能', '用JavaScript获取输入内容，动态创建笔记卡片DOM元素并添加到列表中，每条笔记显示标题、内容和时间。', 3),
        (v_project_id, '实现删除和编辑', '为每条笔记添加删除按钮和编辑按钮，点击删除移除DOM元素，点击编辑将内容回填到输入框修改后保存。', 4),
        (v_project_id, '本地存储', '使用localStorage将笔记数据以JSON格式保存在浏览器中，页面加载时自动读取并显示已保存的笔记。', 5),
        (v_project_id, '高级功能', '添加笔记搜索过滤、按时间排序、笔记分类标签、双击确认删除等功能，提升应用实用性。', 6);

    -- Project 22: Python 爬虫入门
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Python 爬虫入门', '用 Python 的 requests 库学习网页数据抓取的基本技术，从网页中提取有用的信息。孩子将了解网页的工作原理，学习HTTP请求和HTML解析，同时建立网络安全和道德爬虫的意识。', v_author_id, v_sub_id, 5, 60, 'approved', '/projects/tech_programming.webp', ARRAY['Python','requests','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Python 3、requests和BeautifulSoup）', 1),
        (v_project_id, '文本编辑器', 2),
        (v_project_id, '浏览器（学习查看网页源代码）', 3),
        (v_project_id, '练习用的目标网页地址', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解网页原理', '在浏览器中右键"查看源代码"，了解网页由HTML标签构成，认识常见标签和网页结构。', 1),
        (v_project_id, '发送HTTP请求', '学习使用 requests.get() 获取网页内容，理解URL、状态码和响应的概念。', 2),
        (v_project_id, '解析HTML内容', '使用 BeautifulSoup 解析网页，学习 find()、find_all()、select() 等方法定位和提取特定内容。', 3),
        (v_project_id, '提取并保存数据', '编写脚本从练习网页中提取标题、文本等信息，将结果保存到CSV文件中。', 4),
        (v_project_id, '道德爬虫讨论', '学习robots.txt协议、请求频率控制和隐私尊重，理解合法合规爬取数据的重要性。', 5);

    -- Project 23: Python 图片批量处理
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('Python 图片批量处理', '用 Python 的 Pillow 库编写图片处理脚本，实现批量缩放、加水印、格式转换等实用功能。孩子将学习图像处理的基本原理，体验用编程高效完成重复性工作的能力。', v_author_id, v_sub_id, 5, 55, 'approved', '/projects/tech_programming.webp', ARRAY['Python','Pillow','技术','编程'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '电脑（安装Python 3和Pillow库）', 1),
        (v_project_id, '文本编辑器', 2),
        (v_project_id, '练习用的图片文件若干', 3),
        (v_project_id, '水印logo图片（可选）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识Pillow库', '学习使用 from PIL import Image 打开图片，了解图片的尺寸、模式和格式属性，用 show() 查看图片。', 1),
        (v_project_id, '单张图片处理', '学习 resize() 缩放、rotate() 旋转、crop() 裁剪、filter() 滤镜等方法，处理单张图片并保存。', 2),
        (v_project_id, '批量处理脚本', '结合 os 模块遍历文件夹，编写脚本将所有图片统一缩放到指定尺寸或转换为统一格式。', 3),
        (v_project_id, '添加文字水印', '使用 ImageDraw 和 ImageFont 在图片上添加文字水印，设置字体、大小、颜色和位置。', 4),
        (v_project_id, '制作拼图和相册', '将多张图片自动拼接成一张大图或按网格排列制作照片墙，综合运用所有技能创作最终作品。', 5);

END $$;
