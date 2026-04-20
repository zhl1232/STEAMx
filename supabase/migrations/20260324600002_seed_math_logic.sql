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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '逻辑谜题' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 逻辑谜题'; END IF;

    -- Project 1: 七巧板几何挑战
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('七巧板几何挑战', '用七块简单的几何板拼出各种有趣的图形，锻炼空间想象力和几何直觉。参与者将在拼拼摆摆中认识三角形、正方形和平行四边形，体会"部分组成整体"的数学思想。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/sensory_box.webp', ARRAY['七巧板','拼图','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '七巧板一副（可购买或自制）', 1),
        (v_project_id, '正方形卡纸（用于自制七巧板）', 2),
        (v_project_id, '直尺和铅笔', 3),
        (v_project_id, '剪刀', 4),
        (v_project_id, '图形模板卡片（打印或手绘）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识七巧板', '观察七巧板的七个组件：两个大三角形、一个中三角形、两个小三角形、一个正方形和一个平行四边形，了解它们的形状和大小关系。', 1),
        (v_project_id, '还原正方形', '先尝试将七块板拼回一个完整的正方形，这是最基本的七巧板挑战。', 2),
        (v_project_id, '拼出简单图形', '根据模板卡片，用七块板拼出小猫、小鸟、房子等简单图形，注意每块板都要用到且不能重叠。', 3),
        (v_project_id, '挑战创意拼图', '不看模板，自由发挥创造新的图形，用铅笔描下轮廓记录你的作品。', 4),
        (v_project_id, '几何思考', '讨论为什么七块形状简单的板能拼出这么多不同的图案，思考面积守恒的道理——无论怎么拼，总面积不变。', 5);

    -- Project 2: 简易迷宫设计
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('简易迷宫设计', '自己动手在方格纸上设计一座迷宫，并邀请朋友来挑战。在设计过程中参与者将学会规划路径、设置死胡同和岔路口，培养逻辑规划和空间推理能力。', v_author_id, v_sub_id, 1, 30, 'approved', '/projects/sensory_box.webp', ARRAY['迷宫','路径','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '方格纸或白纸', 1),
        (v_project_id, '铅笔和橡皮', 2),
        (v_project_id, '直尺', 3),
        (v_project_id, '彩色笔（用于标记路径）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '画出边界', '在方格纸上画出迷宫的外框，标记入口和出口的位置，入口和出口最好在对角线两端。', 1),
        (v_project_id, '设计正确路径', '先用铅笔轻轻画出从入口到出口的唯一正确路径，路线要曲折有趣。', 2),
        (v_project_id, '添加墙壁和岔路', '在正确路径周围画上墙壁，然后添加多条岔路和死胡同来迷惑走迷宫的人。', 3),
        (v_project_id, '测试与修改', '自己先走一遍迷宫，确保只有一条正确路径，难度适中不会太简单也不会无解。', 4),
        (v_project_id, '交换挑战', '把设计好的迷宫交给朋友或家人挑战，看谁能最快找到出路，然后互相交流设计心得。', 5);

    -- Project 3: 找规律填数
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('找规律填数', '观察一组数字序列，发现隐藏的规律并填出缺失的数字。这个经典的数学游戏训练参与者的观察力和归纳推理能力，从简单的等差数列到有趣的斐波那契数列逐步进阶。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/sensory_box.webp', ARRAY['规律','推理','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '练习纸', 1),
        (v_project_id, '铅笔和橡皮', 2),
        (v_project_id, '数字卡片（可选）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '热身练习', '从最简单的等差数列开始：2, 4, 6, ?, 10——找到"每次加2"的规律，填入8。', 1),
        (v_project_id, '进阶挑战', '尝试更复杂的规律，例如：1, 1, 2, 3, 5, ?——观察前两个数相加等于第三个数的斐波那契规律。', 2),
        (v_project_id, '自创数列', '自己设计一组有规律的数列，把某些数字空出来，让家人或朋友来猜。', 3),
        (v_project_id, '图形数列', '将规律从纯数字扩展到图形：用圆形、三角形、方形排列出有规律的序列，训练模式识别能力。', 4),
        (v_project_id, '总结规律类型', '回顾今天发现的所有规律类型（加法、乘法、交替、组合等），在笔记本上记录下来作为"规律宝典"。', 5);

    -- Project 4: 图形推理游戏
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('图形推理游戏', '通过观察图形的形状、颜色、大小和方向变化规律，推理出下一个图形是什么。这类非语言推理游戏能有效提升参与者的视觉逻辑能力和抽象思维水平。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/sensory_box.webp', ARRAY['图形','找规律','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白纸若干张', 1),
        (v_project_id, '彩色笔', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '几何模板（圆形、三角形、方形）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '单维度变化', '画出只有一个属性变化的图形序列，例如：小圆→中圆→大圆→?（大小变化），让参与者推理下一个。', 1),
        (v_project_id, '双维度变化', '同时改变两个属性，例如形状和颜色交替变化：红色三角→蓝色方形→红色圆形→?，增加推理难度。', 2),
        (v_project_id, '矩阵推理', '画一个3×3的九宫格，每行每列的图形都有规律变化，空出右下角让参与者推理应该填什么图形。', 3),
        (v_project_id, '自己出题', '参与者根据学到的规律模式，自己设计图形推理题目，锻炼逆向思维能力。', 4),
        (v_project_id, '生活中的图案', '观察生活中的重复图案（地砖、壁纸、织物花纹），找出其中的规律和对称性。', 5);

    -- Project 5: 火柴棍谜题
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('火柴棍谜题', '用火柴棍摆出算式或图形，通过移动指定数量的火柴来改变结果或变换图形。这类经典谜题需要灵活的思维和打破常规的创造力，是训练逻辑思维的绝佳方式。', v_author_id, v_sub_id, 2, 25, 'approved', '/projects/sensory_box.webp', ARRAY['火柴','变换','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '火柴棍或牙签若干（约50根）', 1),
        (v_project_id, '平坦的桌面', 2),
        (v_project_id, '题目卡片（打印或手写）', 3),
        (v_project_id, '记录本和铅笔', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '算式变换入门', '用火柴棍摆出"6+4=4"，要求只移动一根火柴使等式成立（将6变成0，得到0+4=4）。', 1),
        (v_project_id, '图形变换', '用火柴摆出4个正方形组成的田字格，要求移动3根火柴使其变成3个正方形，锻炼空间思维。', 2),
        (v_project_id, '增减挑战', '用火柴摆出一个由6根火柴组成的三角形，要求再加3根火柴变成4个小三角形。', 3),
        (v_project_id, '自己设计谜题', '尝试自己用火柴创造新的变换谜题，先摆出初始状态，再想出变换规则和目标状态。', 4),
        (v_project_id, '思维总结', '讨论解决火柴谜题的技巧：逆向思维（从结果倒推）、逐一尝试法和分类讨论法。', 5);

    -- Project 6: 逻辑推理破案
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('逻辑推理破案', '化身小侦探，通过一系列线索和条件用排除法推理出真相。参与者将学习如何从多条信息中提取关键线索，通过逻辑排除缩小范围，最终找到唯一的正确答案。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/sensory_box.webp', ARRAY['推理','排除','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '推理谜题卡片（成年人准备或打印）', 1),
        (v_project_id, '记录本和铅笔', 2),
        (v_project_id, '推理表格（网格法辅助工具）', 3),
        (v_project_id, '角色头像卡片（可选，增加趣味）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '阅读案件', '仔细阅读谜题描述，例如："三个人分别喜欢不同的水果和颜色，根据线索找出每人的喜好"。', 1),
        (v_project_id, '整理线索', '将所有条件逐条列出，用推理表格（行列分别是人物和属性）把确定的信息先填上。', 2),
        (v_project_id, '排除推理', '根据"如果A不是…那么A就是…"的逻辑，在表格中逐步排除不可能的选项，用×标记排除项。', 3),
        (v_project_id, '验证答案', '当所有空格都填满后，回头检查每条线索是否都满足，确保推理过程没有矛盾。', 4),
        (v_project_id, '自己编案件', '尝试自己编写一个逻辑推理小故事，设计好答案后反向给出线索，让朋友来破案。', 5);

    -- Project 7: 数字谜题（算式谜）
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('数字谜题（算式谜）', '在竖式计算中，某些数字被字母或星号替换，通过推理还原出每个位置的真实数字。这类算式谜需要综合运用进位规则和逻辑推理，是锻炼数学思维的经典练习。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/sensory_box.webp', ARRAY['竖式','推理','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '练习纸（方格纸最佳）', 1),
        (v_project_id, '铅笔和橡皮', 2),
        (v_project_id, '算式谜题集（打印或手抄）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识算式谜', '了解规则：竖式中每个字母代表一个0-9的数字，相同字母代表相同数字，不同字母代表不同数字。', 1),
        (v_project_id, '从简单开始', '先解一位数加法谜：A+B=C（无进位），列出所有可能组合，找到满足条件的解。', 2),
        (v_project_id, '进位推理', '挑战带进位的加法谜，例如 AB+CD=EFG（三位数结果意味着最高位一定进位为1），利用进位条件缩小范围。', 3),
        (v_project_id, '经典挑战', '尝试经典算式谜 SEND+MORE=MONEY，从M=1入手逐步推理每个字母代表的数字。', 4),
        (v_project_id, '创造自己的算式谜', '先写一个正常的竖式计算，然后把某些数字替换成字母，测试谜题是否有唯一解。', 5);

    -- Project 8: 路线规划游戏
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('路线规划游戏', '在地图上规划从起点到终点的最佳路线，考虑距离、时间和经过的地点。参与者将学习基本的路径优化思想，理解"最短路径"和"最优路径"可能并不相同。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/sensory_box.webp', ARRAY['路径','优化','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白纸（大幅）或方格纸', 1),
        (v_project_id, '彩色笔若干', 2),
        (v_project_id, '直尺', 3),
        (v_project_id, '小贴纸（标记地点）', 4),
        (v_project_id, '骰子（可选，增加随机性）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绘制地图', '在纸上画出一个小镇地图，包含学校、公园、超市、图书馆等6-8个地点，用线段连接相邻地点并标注距离。', 1),
        (v_project_id, '简单路径', '找出从学校到公园的所有可能路线，比较总距离，找到最短路径。', 2),
        (v_project_id, '多点巡游', '规划一条经过所有地点且总距离最短的路线（类似旅行商问题的简化版），比较不同方案的总距离。', 3),
        (v_project_id, '加入限制条件', '增加约束：某条路正在维修不能走、必须先去超市再去公园等，看如何重新规划最优路线。', 4),
        (v_project_id, '讨论与总结', '讨论为什么有时看起来绕远的路反而更快（考虑拥堵等因素），理解现实中导航软件的基本工作思路。', 5);

    -- Project 9: 数独进阶技巧
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('数独进阶技巧', '从基本的数独规则出发，学习和掌握唯余法、排除法、区块排除等进阶解题技巧。参与者将通过系统训练提升逻辑推理的严密性，体验用策略攻克难题的成就感。', v_author_id, v_sub_id, 3, 40, 'approved', '/projects/sensory_box.webp', ARRAY['数独','策略','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '数独题目（从易到难各若干道）', 1),
        (v_project_id, '铅笔和橡皮', 2),
        (v_project_id, '候选数标注笔（细笔头）', 3),
        (v_project_id, '计时器（可选）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '复习基本规则', '回顾数独的三条核心规则：每行、每列、每个3×3宫格内，1-9各出现且仅出现一次。', 1),
        (v_project_id, '唯余法训练', '在每个空格中标注所有可能的候选数字，当某格只剩一个候选数时，该数即为答案。', 2),
        (v_project_id, '排除法进阶', '在某行/列/宫中，如果某个数字只可能出现在一个位置，那么这个位置就填这个数字，即使还有其他候选数。', 3),
        (v_project_id, '区块排除法', '当某宫内的某个数字只可能出现在同一行（或列）时，可以排除该行（或列）其他宫格中的这个候选数。', 4),
        (v_project_id, '实战计时挑战', '选一道中等难度数独，用学到的技巧限时完成，记录用时并尝试不断刷新最佳成绩。', 5),
        (v_project_id, '反思策略', '回顾解题过程中哪种技巧用得最多、哪里卡住了以及如何突破，总结属于自己的解题策略。', 6);

    -- Project 10: 逻辑电路与门
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('逻辑电路与门', '用简单的开关和灯泡理解与门、或门、非门的工作原理，亲手搭建基本逻辑电路。参与者将认识计算机最底层的"思考方式"——用0和1进行逻辑运算，感受数字世界的奥秘。', v_author_id, v_sub_id, 3, 35, 'approved', '/projects/sensory_box.webp', ARRAY['与或非','逻辑','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'LED小灯泡2-3个', 1),
        (v_project_id, '小开关2-3个', 2),
        (v_project_id, '电池和电池盒', 3),
        (v_project_id, '导线若干', 4),
        (v_project_id, '硬纸板（做电路底板）', 5),
        (v_project_id, '记录表格', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识逻辑门', '在纸上画出与门（AND）、或门（OR）、非门（NOT）的符号和真值表，理解每种门的输入输出关系。', 1),
        (v_project_id, '搭建与门电路', '将两个开关串联连接灯泡和电池，测试只有两个开关都打开时灯泡才亮——这就是与门。', 2),
        (v_project_id, '搭建或门电路', '将两个开关并联连接灯泡和电池，测试任何一个开关打开灯泡就亮——这就是或门。', 3),
        (v_project_id, '填写真值表', '分别在两个开关的四种组合状态（开开、开关、关开、关关）下观察灯泡状态，填写真值表验证。', 4),
        (v_project_id, '组合电路挑战', '用三个开关组合搭建"(A AND B) OR C"的电路，预测并验证灯泡在不同开关组合下的亮灭情况。', 5);

    -- Project 11: 汉诺塔手工挑战
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('汉诺塔手工挑战', '亲手制作汉诺塔道具并挑战用最少步骤完成移动，体验这个经典的递归思维问题。参与者将在动手操作中感受到递归策略的精妙，发现移动次数与层数之间的数学规律。', v_author_id, v_sub_id, 3, 35, 'draft', '/projects/sensory_box.webp', ARRAY['递归','策略','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板或木板（做底座）', 1),
        (v_project_id, '三根木棍或筷子（做柱子）', 2),
        (v_project_id, '大小不同的圆形纸片或垫片5-7个', 3),
        (v_project_id, '胶水或橡皮泥（固定柱子）', 4),
        (v_project_id, '记录本和铅笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作汉诺塔', '在底座上固定三根柱子，将从大到小的圆片按顺序套在第一根柱子上，最大的在最下面。', 1),
        (v_project_id, '理解规则', '每次只能移动一个圆片，大圆片不能放在小圆片上面，目标是把所有圆片从第一根柱子移到第三根。', 2),
        (v_project_id, '从少到多', '先用2个圆片练习（3步完成），再用3个（7步），逐步增加到4个、5个，记录每次的步数。', 3),
        (v_project_id, '发现规律', '观察步数序列：1, 3, 7, 15, 31...发现n个圆片需要2^n-1步，每增加一个圆片步数翻倍再加1。', 4),
        (v_project_id, '理解递归思想', '讨论解题策略：要移动n个圆片，先把上面n-1个移到中间柱，再把最大的移到目标柱，最后把n-1个移回来——这就是递归。', 5);

    -- Project 12: 七桥问题探索
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('七桥问题探索', '重现数学史上著名的柯尼斯堡七桥问题，探索能否一次走过所有桥且每座桥只经过一次。参与者将初步接触图论的基本概念，理解欧拉如何用数学证明了这个问题的不可能性。', v_author_id, v_sub_id, 3, 30, 'approved', '/projects/sensory_box.webp', ARRAY['图论','欧拉','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白纸和彩色笔', 1),
        (v_project_id, '硬纸板（制作岛屿和桥梁模型）', 2),
        (v_project_id, '剪刀和胶水', 3),
        (v_project_id, '小人偶或棋子（模拟行走）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解七桥问题', '在纸上画出柯尼斯堡的地图：一条河流中有两个小岛，七座桥连接着岛屿和两岸，尝试找到一条能走遍所有桥的路线。', 1),
        (v_project_id, '动手实验', '用纸板制作简易地图模型，用小人偶在上面反复尝试不同的行走路线，记录每次的结果。', 2),
        (v_project_id, '抽象为图', '学习欧拉的方法：把每块陆地看作一个点，每座桥看作一条线，将地图简化为由点和线组成的图。', 3),
        (v_project_id, '数奇偶点', '数每个点连接的线数（度数），发现四个点全部是奇数度——欧拉证明了只有0或2个奇数度点时才能一笔画。', 4),
        (v_project_id, '拓展挑战', '自己画不同的图形（如五角星、房子形），数每个点的度数判断能否一笔画完成，验证欧拉定理。', 5);

    -- Project 13: 日常任务流程图
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('日常任务流程图', '选择一个日常任务，如早晨出门或泡一杯茶，画出完整流程图。通过具体情境学习流程拆解。', v_author_id, v_sub_id, 4, 40, 'approved', '/projects/sensory_box.webp', ARRAY['编程思维','流程','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '白纸或大幅绘图纸', 1),
        (v_project_id, '彩色笔和铅笔', 2),
        (v_project_id, '直尺', 3),
        (v_project_id, '便利贴（不同颜色）', 4),
        (v_project_id, '流程图符号参考卡', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识流程图符号', '学习基本符号：椭圆（开始/结束）、矩形（处理步骤）、菱形（判断/分支）、箭头（流向），在纸上练习画每种符号。', 1),
        (v_project_id, '画第一个流程图', '将"早上起床到出门上学"的过程画成流程图，包含起床、洗漱、吃早餐、检查书包、出门等步骤。', 2),
        (v_project_id, '加入分支判断', '在流程中加入判断节点，例如"今天下雨吗？"→是→带雨伞，否→不带，体会分支结构。', 3),
        (v_project_id, '设计循环结构', '画一个"背单词"的流程图：背一个单词→测试→没记住→再背一次（循环），记住了→下一个单词。', 4),
        (v_project_id, '综合挑战', '为"去超市买东西"设计完整流程图，包含列购物清单、选商品、比价、结账等环节，综合运用三种结构。', 5),
        (v_project_id, '互相测试', '把流程图交给朋友，让他按流程图一步步执行，看是否能顺利完成任务，找出流程图中的漏洞并修正。', 6);

    -- Project 14: 逻辑悖论探索
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('逻辑悖论探索', '认识和讨论经典的逻辑悖论，如说谎者悖论、理发师悖论等，感受逻辑推理的奇妙边界。参与者将在思维碰撞中体会到逻辑的精妙与局限，激发对哲学和数学基础的好奇心。', v_author_id, v_sub_id, 4, 35, 'approved', '/projects/sensory_box.webp', ARRAY['悖论','哲学','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '笔记本和铅笔', 1),
        (v_project_id, '悖论故事卡片（成年人准备）', 2),
        (v_project_id, '彩色便利贴', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '说谎者悖论', '思考这句话："我说的这句话是假的"——如果它是真的，那它就是假的；如果它是假的，那它就是真的。讨论为什么会产生矛盾。', 1),
        (v_project_id, '理发师悖论', '一个小镇的理发师声称"只给不自己理发的人理发"——那他该不该给自己理发？用画图的方式分析两种情况都会矛盾。', 2),
        (v_project_id, '鳄鱼悖论', '鳄鱼抓走了一个人并对对方的妈妈说"猜猜我会不会把人还给你，猜对了就还"——如果对方回答"你不会还"，鳄鱼会怎样？讨论这个两难困境。', 3),
        (v_project_id, '寻找生活中的悖论', '想想生活中类似的矛盾情境：例如"别听任何人的建议"本身就是一条建议，收集并记录这些有趣的例子。', 4),
        (v_project_id, '总结与反思', '讨论悖论产生的原因（自我指涉、无限循环等），了解数学家和哲学家们如何看待和处理这些问题。', 5);

    -- Project 15: 三层决策树推演
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('三层决策树推演', '围绕一个简单游戏或选择题画出三层决策树，并比较不同路径结果。通过小规模推演理解决策树。', v_author_id, v_sub_id, 4, 45, 'approved', '/projects/sensory_box.webp', ARRAY['博弈','决策','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大幅白纸', 1),
        (v_project_id, '彩色笔（两种颜色代表两位玩家）', 2),
        (v_project_id, '小石子或棋子若干', 3),
        (v_project_id, '直尺', 4),
        (v_project_id, '记录本', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习取石子游戏', '桌上放7颗石子，两人轮流取，每次可取1或2颗，取到最后一颗的人输。先玩几局感受规律。', 1),
        (v_project_id, '画博弈树', '从7颗石子开始，画出每种取法对应的分支，一直展开到有人取到最后一颗为止，形成完整的树状图。', 2),
        (v_project_id, '标记胜负', '在博弈树的每个终点标注谁赢谁输（用不同颜色），然后从终点往回推——每一步选择对自己最有利的分支。', 3),
        (v_project_id, '找出必胜策略', '通过逆推发现先手应该取几颗才能保证必胜，理解控制"关键数"的策略思想。', 4),
        (v_project_id, '拓展到井字棋', '尝试画井字棋前两步的博弈树（完整树太大），讨论为什么先手占中心最有利。', 5),
        (v_project_id, '策略总结', '总结博弈分析的方法：穷举所有可能→标记结果→逆推最优选择，这种思维方式在生活决策中同样有用。', 6);

    -- Project 16: 约瑟夫环问题
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('约瑟夫环问题', '通过模拟约瑟夫环的报数淘汰游戏，探索循环计数中的数学规律。参与者将亲手实验并记录数据，发现最后幸存者位置与总人数之间的神奇数学关系。', v_author_id, v_sub_id, 4, 40, 'approved', '/projects/sensory_box.webp', ARRAY['数学','循环','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小纸片或棋子（代表人，10-15个）', 1),
        (v_project_id, '圆形纸板（摆放棋子用）', 2),
        (v_project_id, '记录本和铅笔', 3),
        (v_project_id, '编号贴纸', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解故事背景', '讲述约瑟夫的故事：一群人围成圆圈，从第一个人开始报数，每报到3的人出列，问最后剩下的人在什么位置。', 1),
        (v_project_id, '小规模模拟', '先用5个棋子围成圈编号1-5，模拟每数到3淘汰一人的过程，记录淘汰顺序和最后幸存者编号。', 2),
        (v_project_id, '扩大实验', '分别用6人、7人、8人、9人、10人重复实验，把每次的幸存者编号记录在表格中。', 3),
        (v_project_id, '寻找规律', '观察幸存者编号随总人数变化的模式，尝试发现其中的数学规律或递推关系。', 4),
        (v_project_id, '改变报数值', '把"报到3淘汰"改成"报到2淘汰"，重新实验观察幸存者位置的变化，发现与2的幂次相关的规律。', 5),
        (v_project_id, '编程延伸', '讨论如何用编程来模拟更大规模的约瑟夫环问题，了解递推公式 J(n)=(J(n-1)+k) mod n 的含义。', 6);

    -- Project 17: 自制密室逃脱谜题
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('自制密室逃脱谜题', '设计一套完整的密室逃脱谜题，包含密码锁、线索链和多种逻辑解谜环节。这是一个综合性极强的项目，参与者需要运用所学的各种逻辑推理技能来创造一场精彩的解谜冒险。', v_author_id, v_sub_id, 5, 90, 'draft', '/projects/sensory_box.webp', ARRAY['综合','设计','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '密码锁（数字组合锁1-2个）', 1),
        (v_project_id, '信封若干（装线索）', 2),
        (v_project_id, '白纸和彩色笔', 3),
        (v_project_id, '小盒子（藏线索用）', 4),
        (v_project_id, '紫外线笔和灯（可选，写隐形字）', 5),
        (v_project_id, '胶带和剪刀', 6),
        (v_project_id, '计时器', 7),
        (v_project_id, '小奖品（通关奖励）', 8);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计故事背景', '构思一个吸引人的故事：例如"科学家被困在实验室，你需要在60分钟内破解所有谜题找到钥匙逃出去"。', 1),
        (v_project_id, '设计谜题链', '规划5-6个环环相扣的谜题，每个谜题的答案是下一个谜题的线索——如解码获得密码锁数字、拼图发现下一条线索位置。', 2),
        (v_project_id, '制作谜题道具', '动手制作各种谜题：用镜像文字写线索、设计摩尔斯电码解密、画藏头诗隐藏数字、制作拼图碎片等。', 3),
        (v_project_id, '布置场景', '在房间中布置所有谜题和线索，确保线索链完整可解，没有断裂环节，设置好密码锁和隐藏物品。', 4),
        (v_project_id, '测试与调整', '自己先完整走一遍流程，检查每个谜题的难度是否合适、线索是否足够清晰，必要时增加提示或调整难度。', 5),
        (v_project_id, '邀请挑战', '邀请家人或朋友来挑战你的密室逃脱，用计时器记录时间，观察他们在哪里卡住并收集改进意见。', 6);

    -- Project 18: 旅行商路线谜题
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('旅行商路线谜题', '用几个地点组成一个小型路线谜题，尝试找出更短的访问顺序。通过具体谜题体验组合优化问题。', v_author_id, v_sub_id, 5, 45, 'approved', '/projects/sensory_box.webp', ARRAY['计算复杂度','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '小物品若干（不同重量和价值的玩具或文具）', 1),
        (v_project_id, '小背包或袋子', 2),
        (v_project_id, '厨房秤', 3),
        (v_project_id, '白纸和彩色笔（至少4种颜色）', 4),
        (v_project_id, '计时器', 5),
        (v_project_id, '记录本和铅笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '体验背包问题', '给8个物品分别标注重量和价值，背包限重5公斤，尝试选出总价值最高的物品组合——你会发现需要尝试很多种搭配。', 1),
        (v_project_id, '感受难度增长', '把物品增加到12个再试一次，记录你花了多少时间。讨论：物品数翻倍，需要尝试的组合数会增长多少倍？', 2),
        (v_project_id, '图着色问题', '在纸上画一个有8个区域的地图，要求相邻区域颜色不同。尝试只用3种颜色能否完成？用4种颜色呢？', 3),
        (v_project_id, '验证vs求解', '让朋友给出一个背包方案，你能很快算出总重量和总价值来验证；但自己从头找最优方案却很费时间——这就是NP问题的核心特征。', 4),
        (v_project_id, '了解计算复杂度', '讨论P与NP的直觉含义：P是"容易解的问题"，NP是"容易验证的问题"，P=NP?是数学界的百万美元难题。', 5);

    -- Project 19: 班级关系网络图
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('班级关系网络图', '把班级同学之间的认识关系画成节点和连线，观察谁连接更多、谁形成小团体。通过具体对象理解网络图。', v_author_id, v_sub_id, 5, 45, 'approved', '/projects/sensory_box.webp', ARRAY['图论','度','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大幅白纸', 1),
        (v_project_id, '彩色笔和马克笔', 2),
        (v_project_id, '小圆形贴纸（代表节点）', 3),
        (v_project_id, '毛线或绳子（代表边）', 4),
        (v_project_id, '记录本和计算器', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '画社交关系图', '以自己为中心，画出与家人和好朋友的关系网络——每个人是一个圆（节点），认识的人之间画线（边）。', 1),
        (v_project_id, '计算度数', '数每个节点连接的边数（度数），度数最大的人就是这个网络中的"社交达人"，讨论度数的含义。', 2),
        (v_project_id, '分析连通性', '检查网络中是否所有人都能通过关系链互相联系到。如果去掉某个关键人物，网络会断开吗？这样的人叫"关键节点"。', 3),
        (v_project_id, '交通网络分析', '画出附近几个地点之间的交通路线图，标注每条路的距离，用之前学过的方法找出最短路径。', 4),
        (v_project_id, '六度分隔理论', '讨论"世界上任意两个人最多只需要六个中间人就能联系上"的理论，思考社交网络规模扩大后度数和连通性如何变化。', 5),
        (v_project_id, '网络可视化', '尝试把网络图画得更美观：节点大小按度数调整（度数越大越大），用不同颜色标记不同的社群，欣赏网络之美。', 6);

    -- Project 20: 冒泡排序卡片演示
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('冒泡排序卡片演示', '用数字卡片演示冒泡排序，让数字一步步交换到正确位置。通过可视化动作理解排序过程。', v_author_id, v_sub_id, 5, 50, 'approved', '/projects/sensory_box.webp', ARRAY['算法','可视化','数学','逻辑'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '扑克牌一副', 1),
        (v_project_id, '大幅白纸若干', 2),
        (v_project_id, '彩色笔和马克笔', 3),
        (v_project_id, '便利贴（写数字用）', 4),
        (v_project_id, '计时器', 5),
        (v_project_id, '笔记本（做算法笔记）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '冒泡排序体验', '取10张扑克牌随机排列，按冒泡排序法相邻比较交换，一轮轮处理直到完全有序，用彩笔在纸上画出每一步的变化。', 1),
        (v_project_id, '选择排序对比', '同样的10张牌，改用选择排序（每次找最小的放到最前面），画出步骤并与冒泡排序比较哪个交换次数更少。', 2),
        (v_project_id, '二分查找体验', '将牌按顺序排好，让朋友心里想一个数，你用"比中间大还是小"的方式来猜，记录每次只需猜几次就能找到。', 3),
        (v_project_id, '可视化算法笔记', '在笔记本上为每种算法画一页图解：用箭头表示比较、用颜色标记交换、用方框表示当前检查的范围。', 4),
        (v_project_id, '效率大比拼', '分别用30张牌测试冒泡排序和选择排序的耗时，讨论为什么数据量越大、算法效率的差异越明显。', 5),
        (v_project_id, '算法思维总结', '整理算法笔记，总结三个核心思想：分而治之（把大问题拆成小问题）、贪心策略（每步选当前最优）、穷举与剪枝（尝试所有可能但跳过不可能的）。', 6);

END $$;
