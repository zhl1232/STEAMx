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
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '数学游戏' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 数学游戏'; END IF;

    -- Project 1: 数字配对翻牌
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('数字配对翻牌', '制作一套数字配对卡片，通过翻牌找到相同数字的配对来锻炼记忆力。孩子将在游戏中熟悉数字认知，同时提升专注力和短期记忆能力。', v_author_id, v_sub_id, 1, 20, 'approved', '/projects/sensory_box.webp', ARRAY['记忆','配对','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬卡纸若干张', 1),
        (v_project_id, '彩色马克笔', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '直尺', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作卡片', '用直尺在硬卡纸上画出大小一致的方形格子（约6厘米×6厘米），剪出20张卡片。', 1),
        (v_project_id, '书写数字', '在10张卡片正面分别写上数字1到10，再制作一套完全相同的10张，共组成10对配对卡片。', 2),
        (v_project_id, '装饰背面', '将所有卡片背面涂上统一的颜色或图案，确保从背面无法区分不同卡片。', 3),
        (v_project_id, '开始游戏', '将所有卡片背面朝上随机排列成4×5的方阵，每次翻开两张，如果数字相同就取走，不同则翻回去。', 4),
        (v_project_id, '挑战升级', '记录完成配对所需的翻牌次数，尝试用更少次数完成游戏，还可以增加卡片数量提升难度。', 5);

    -- Project 2: 骰子比大小
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('骰子比大小', '用骰子进行各种比大小的趣味数学游戏，感受随机和概率的魅力。孩子将在掷骰子的过程中练习数字比较和简单加法，初步体验概率的概念。', v_author_id, v_sub_id, 1, 15, 'approved', '/projects/sensory_box.webp', ARRAY['概率','比较','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '骰子2-4颗', 1),
        (v_project_id, '记分纸和铅笔', 2),
        (v_project_id, '小零食或贴纸（做奖品）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '基础比大小', '每人掷一颗骰子，点数大的一方得1分，平局则各得0.5分，先到10分者获胜。', 1),
        (v_project_id, '双骰求和', '每人同时掷两颗骰子，将点数相加，总和更大的人获胜，练习快速心算能力。', 2),
        (v_project_id, '预测游戏', '掷骰子之前先猜测点数是大于3还是小于等于3，猜对得2分，猜错不得分。', 3),
        (v_project_id, '记录统计', '连续掷骰子30次，记录每个点数出现的次数，观察是否每个数字出现的频率大致相同。', 4),
        (v_project_id, '发现规律', '讨论为什么每个点数出现的概率都是六分之一，以及两颗骰子之和为7的情况最多。', 5);

    -- Project 3: 数字连线画
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('数字连线画', '按照数字从小到大的顺序依次连线，最终呈现出一幅完整的图案。孩子将在有趣的绘画过程中巩固数字顺序的认知，训练手眼协调能力。', v_author_id, v_sub_id, 1, 25, 'approved', '/projects/sensory_box.webp', ARRAY['数序','连线','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'A4白纸若干张', 1),
        (v_project_id, '铅笔', 2),
        (v_project_id, '彩色画笔', 3),
        (v_project_id, '橡皮擦', 4),
        (v_project_id, '直尺', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计图案', '先在纸上用铅笔轻轻画出一个简单图案的轮廓，比如一颗星星、一只小鱼或一朵花。', 1),
        (v_project_id, '标注数字', '沿着轮廓线均匀选取20-30个关键点，按顺序标上数字1、2、3……然后擦除原来的轮廓线。', 2),
        (v_project_id, '连线验证', '将做好的连线图给伙伴，让他按照数字从1开始依次用直线连接各个点，看能否还原出图案。', 3),
        (v_project_id, '涂色美化', '连线完成后用彩色画笔给图案涂上漂亮的颜色，让作品更加生动。', 4),
        (v_project_id, '进阶挑战', '尝试制作更复杂的连线画，增加到50个甚至100个点，或者使用偶数序列（2、4、6……）来连线。', 5);

    -- Project 4: 测量身边的物品
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('测量身边的物品', '用不同的工具测量家中各种物品的长度、重量和容积，建立对度量单位的直观认知。孩子将学会使用测量工具，感受厘米、克、毫升等单位在日常生活中的实际意义。', v_author_id, v_sub_id, 1, 30, 'approved', '/projects/sensory_box.webp', ARRAY['测量','单位','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '直尺和卷尺', 1),
        (v_project_id, '厨房电子秤', 2),
        (v_project_id, '量杯', 3),
        (v_project_id, '记录本和铅笔', 4),
        (v_project_id, '家中各种物品（书本、水果、玩具等）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '长度测量', '用直尺测量铅笔、手机、书本等物品的长度，记录在表格中，学会正确读数到毫米。', 1),
        (v_project_id, '重量测量', '用电子秤称量苹果、鸡蛋、玩具等物品的重量，感受100克、500克、1千克分别是多重。', 2),
        (v_project_id, '容积测量', '用量杯测量不同杯子、碗和瓶子能装多少水，理解毫升和升的关系。', 3),
        (v_project_id, '估测练习', '先凭感觉估计一个物品的尺寸或重量，再实际测量，看看估计值和实际值相差多少。', 4),
        (v_project_id, '制作测量报告', '将所有测量数据整理成图表，找出家中最长、最重、容积最大的物品，分享你的发现。', 5);

    -- Project 5: 概率实验：硬币与骰子
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('概率实验：硬币与骰子', '通过大量抛硬币和掷骰子实验，记录结果并统计频率，亲身验证概率理论。孩子将学会用数据说话，理解"大数定律"——实验次数越多，结果越接近理论概率。', v_author_id, v_sub_id, 2, 35, 'approved', '/projects/sensory_box.webp', ARRAY['概率','统计','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬币若干枚', 1),
        (v_project_id, '骰子2颗', 2),
        (v_project_id, '记录表格纸', 3),
        (v_project_id, '铅笔和彩色笔', 4),
        (v_project_id, '计算器', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '硬币实验', '抛掷一枚硬币50次，每次记录正面或反面，统计各出现了多少次，计算频率。', 1),
        (v_project_id, '增加次数', '将实验扩大到100次和200次，观察正面出现的频率是否越来越接近50%。', 2),
        (v_project_id, '骰子实验', '掷一颗骰子60次，记录每个点数出现的次数，画成柱状图进行对比。', 3),
        (v_project_id, '双骰实验', '同时掷两颗骰子50次，记录点数之和，统计哪个和出现次数最多。', 4),
        (v_project_id, '数据分析', '用柱状图展示所有实验结果，讨论为什么两颗骰子之和为7最容易出现（有6种组合），理解概率的计算方法。', 5);

    -- Project 6: 数字华容道
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('数字华容道', '制作一个可以滑动数字方块的华容道游戏，通过策略性移动将打乱的数字恢复顺序。孩子将在解谜过程中锻炼空间推理能力和策略规划思维。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/sensory_box.webp', ARRAY['策略','移动','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬纸板或薄木板', 1),
        (v_project_id, '直尺和铅笔', 2),
        (v_project_id, '美工刀或剪刀', 3),
        (v_project_id, '彩色马克笔', 4),
        (v_project_id, '胶水', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作底盘', '用硬纸板裁出一个正方形底盘，划分为4×4共16个等大的格子，边缘做出挡边防止方块滑出。', 1),
        (v_project_id, '制作方块', '裁出15个正方形小方块，大小略小于格子以便滑动，分别写上数字1到15并涂上颜色。', 2),
        (v_project_id, '学习规则', '将数字方块按顺序放入格子中，留一个空格。通过滑动相邻方块到空格位置来移动方块。', 3),
        (v_project_id, '打乱与还原', '先将方块随机打乱，然后尝试通过滑动操作将所有数字恢复成从左到右、从上到下的顺序。', 4),
        (v_project_id, '记录步数', '计算还原所用的步数，多次练习后尝试用更少的步数完成，与朋友比赛谁用的步数最少。', 5),
        (v_project_id, '策略总结', '总结解题策略：先还原第一行，再还原第一列，逐步缩小问题规模，讨论为什么有些排列无法还原。', 6);

    -- Project 7: 速算比赛卡片
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('速算比赛卡片', '制作一套速算卡片进行限时数学运算比赛，看谁算得又快又准。孩子将在紧张有趣的竞赛氛围中提升四则运算的速度和准确率。', v_author_id, v_sub_id, 2, 25, 'approved', '/projects/sensory_box.webp', ARRAY['运算','速度','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '硬卡纸', 1),
        (v_project_id, '马克笔', 2),
        (v_project_id, '剪刀', 3),
        (v_project_id, '计时器或手机秒表', 4),
        (v_project_id, '记分本', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '制作题卡', '在卡片正面写上算术题（如 7+8、15-6、4×3），背面写上正确答案，制作至少40张题卡。', 1),
        (v_project_id, '分级设计', '将题卡分为三个难度等级：绿色为简单加减法，黄色为两位数运算，红色为乘除法混合运算。', 2),
        (v_project_id, '限时挑战', '设定1分钟计时，翻出题卡快速口答，答对放一堆、答错放另一堆，最后统计正确数量。', 3),
        (v_project_id, '双人对战', '两人面对面，同时看到一张题卡，先说出正确答案的人赢得这张卡片，最终卡片多的人获胜。', 4),
        (v_project_id, '进步追踪', '记录每次一分钟内答对的题目数量，制作折线图追踪自己的进步情况。', 5);

    -- Project 8: 数字黑洞 6174
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('数字黑洞 6174', '探索神秘的卡普雷卡尔常数6174——任何四位数经过特定运算后都会被"吸入"这个数字黑洞。孩子将在反复计算中发现令人惊叹的数学规律，感受数字的魔力。', v_author_id, v_sub_id, 2, 30, 'approved', '/projects/sensory_box.webp', ARRAY['数字规律','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '练习本', 1),
        (v_project_id, '铅笔和橡皮', 2),
        (v_project_id, '计算器（辅助验算）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择数字', '任意选择一个四位数（四个数字不能全部相同），例如选择3812。', 1),
        (v_project_id, '排列与相减', '将这四个数字从大到小排列得到最大数8321，从小到大排列得到最小数1238，用大数减小数：8321-1238=7083。', 2),
        (v_project_id, '重复操作', '对结果7083继续执行同样的操作：8730-0378=8352，再继续：8532-2358=6174。', 3),
        (v_project_id, '验证黑洞', '对6174执行操作：7641-1467=6174，数字不再变化，这就是"数字黑洞"！', 4),
        (v_project_id, '批量测试', '换不同的四位数重复实验，记录每个数到达6174所需的步骤数，发现最多只需要7步。', 5),
        (v_project_id, '拓展探索', '尝试对三位数做同样的操作（数字黑洞是495），思考为什么会出现这种神奇的现象。', 6);

    -- Project 9: 斐波那契数列寻宝
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('斐波那契数列寻宝', '在自然界中寻找斐波那契数列的踪迹，发现花瓣、松果、贝壳中隐藏的数学密码。孩子将学习这个著名数列的规律，惊叹于数学与自然界的奇妙联系。', v_author_id, v_sub_id, 3, 40, 'approved', '/projects/sensory_box.webp', ARRAY['数列','自然','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '笔记本和铅笔', 1),
        (v_project_id, '放大镜', 2),
        (v_project_id, '手机（拍照记录）', 3),
        (v_project_id, '松果、向日葵或其他植物', 4),
        (v_project_id, '直尺和圆规', 5),
        (v_project_id, '方格纸', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识数列', '学习斐波那契数列的规则：1, 1, 2, 3, 5, 8, 13, 21……每个数等于前两个数的和，自己推算前20项。', 1),
        (v_project_id, '花瓣计数', '到花园或公园中数不同花朵的花瓣数量，你会发现大部分花的花瓣数恰好是斐波那契数：百合3瓣、梅花5瓣、雏菊13或21瓣。', 2),
        (v_project_id, '螺旋观察', '仔细观察松果和向日葵花盘上的螺旋纹理，分别数顺时针和逆时针方向的螺旋数，它们通常是相邻的斐波那契数。', 3),
        (v_project_id, '绘制黄金螺旋', '在方格纸上画出斐波那契正方形序列（1×1、1×1、2×2、3×3、5×5……），在每个正方形中画四分之一圆弧连接成螺旋线。', 4),
        (v_project_id, '制作寻宝报告', '将所有发现整理成图文并茂的报告，记录在自然界中找到的每个斐波那契数的实例。', 5);

    -- Project 10: 密码学入门：凯撒密码
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('密码学入门：凯撒密码', '学习古罗马凯撒大帝使用的加密方法，用字母偏移制作密码和破解密码。孩子将体验密码学的基本思想，理解加密和解密的数学原理。', v_author_id, v_sub_id, 3, 35, 'approved', '/projects/sensory_box.webp', ARRAY['密码','偏移','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '纸和铅笔', 1),
        (v_project_id, '字母表对照卡', 2),
        (v_project_id, '硬纸板和图钉（制作密码转盘）', 3),
        (v_project_id, '剪刀和圆规', 4),
        (v_project_id, '彩色马克笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '理解原理', '学习凯撒密码的核心思想：将每个字母按固定位数向后偏移。例如偏移3位时，A变成D，B变成E，Z变成C。', 1),
        (v_project_id, '制作密码盘', '用硬纸板剪出一大一小两个圆盘，边缘分别写上26个字母或拼音，用图钉在圆心固定，旋转小盘即可设定偏移量。', 2),
        (v_project_id, '加密信息', '选择一段文字和一个偏移量，使用密码盘将明文逐字转换为密文，写一封加密信给朋友。', 3),
        (v_project_id, '解密挑战', '收到朋友的密文后，尝试用不同偏移量逐个测试，或者统计字母频率来破解密码。', 4),
        (v_project_id, '拓展思考', '讨论凯撒密码的弱点——只有25种可能的偏移量，用暴力穷举就能破解。现代密码如何解决这个问题？', 5);

    -- Project 11: 幻方填数
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('幻方填数', '在方格中填入数字使每行、每列和对角线的数字之和都相等，探索幻方的神奇规律。孩子将在填数过程中锻炼逻辑推理能力，感受古老数学谜题的魅力。', v_author_id, v_sub_id, 3, 30, 'approved', '/projects/sensory_box.webp', ARRAY['幻方','策略','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '方格纸', 1),
        (v_project_id, '铅笔和橡皮', 2),
        (v_project_id, '数字卡片（1-9、1-16）', 3),
        (v_project_id, '计算器', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '认识幻方', '了解幻方的定义：在n×n方格中填入连续自然数，使每行、每列和两条对角线的和都相等。这个和叫做"幻和"。', 1),
        (v_project_id, '计算幻和', '学习计算幻和的公式：三阶幻方用1-9，总和45÷3=15，所以每行每列之和都是15。', 2),
        (v_project_id, '填写三阶幻方', '用数字卡片在3×3方格中反复尝试，找到所有满足条件的填法。提示：5一定在中间。', 3),
        (v_project_id, '学习构造法', '学习"阶梯法"构造奇数阶幻方：从顶部中间开始，沿右上方向依次填数，遇到边界则绕到对面继续。', 4),
        (v_project_id, '挑战四阶', '尝试构造4×4的四阶幻方，用1-16填入，幻和为34，难度大幅提升但也更有成就感。', 5);

    -- Project 12: 数独策略研究
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('数独策略研究', '系统学习数独的解题策略，从简单排除法到高级技巧逐步进阶。孩子将在解数独的过程中大幅提升逻辑推理能力和系统化思维水平。', v_author_id, v_sub_id, 3, 40, 'approved', '/projects/sensory_box.webp', ARRAY['数独','逻辑','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '打印的数独题目（各难度各5题）', 1),
        (v_project_id, '铅笔和橡皮', 2),
        (v_project_id, '彩色铅笔（标记候选数）', 3),
        (v_project_id, '计时器', 4),
        (v_project_id, '数独策略笔记本', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习基础规则', '理解数独规则：在9×9的格子中填入1-9，使每行、每列和每个3×3宫格内的数字都不重复。', 1),
        (v_project_id, '掌握排除法', '从已知数字最多的行、列或宫格入手，排除已出现的数字，找出唯一可能的答案。', 2),
        (v_project_id, '学习候选数法', '在空格中用小字标注所有可能的候选数字，随着解题推进逐步排除候选数。', 3),
        (v_project_id, '进阶技巧', '学习"唯余法"（一个数字在某行列宫中只有一个可填位置）和"数对法"（两个格子只能填相同两个数）。', 4),
        (v_project_id, '限时挑战', '用计时器记录解题时间，从简单题开始逐步挑战高难度数独，追踪解题速度的提升。', 5),
        (v_project_id, '自创数独', '尝试自己设计一道数独题目：先填好完整解答，再有策略地挖去一些数字，确保解唯一。', 6);

    -- Project 13: 蒙提霍尔问题实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('蒙提霍尔问题实验', '用卡片模拟著名的"三门问题"，通过大量实验验证换门策略是否真的能提高中奖概率。孩子将亲身体验概率中的反直觉现象，学会用数据而非直觉做判断。', v_author_id, v_sub_id, 4, 40, 'approved', '/projects/sensory_box.webp', ARRAY['概率','直觉','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '三张卡片（一张标记"大奖"，两张标记"谢谢参与"）', 1),
        (v_project_id, '三个不透明杯子', 2),
        (v_project_id, '记录表格纸', 3),
        (v_project_id, '铅笔', 4),
        (v_project_id, '计算器', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解问题', '学习蒙提霍尔问题：三扇门后有一辆汽车和两只山羊，选一扇门后主持人打开一扇有山羊的门，此时你应该换门还是不换？', 1),
        (v_project_id, '直觉猜测', '先让参与者凭直觉猜测"换"和"不换"哪个胜率更高，大部分人会认为概率一样都是50%。', 2),
        (v_project_id, '模拟实验', '一人扮演主持人在杯子下放卡片，另一人选择和决定是否换。做50次"始终不换"和50次"始终换"的实验。', 3),
        (v_project_id, '统计结果', '计算两种策略各自的中奖次数和比率，你会发现"换门"赢的概率接近2/3，而"不换"只有1/3。', 4),
        (v_project_id, '理解原理', '用树状图分析：最初选中大奖的概率是1/3，选错的概率是2/3；如果选错了，换门必中，所以换门的赢面是2/3。', 5);

    -- Project 14: 囚徒困境模拟
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('囚徒困境模拟', '通过角色扮演模拟博弈论中经典的囚徒困境，体验合作与背叛的策略选择。孩子将初步了解博弈论的基本概念，思考为什么在竞争中合作往往是最优策略。', v_author_id, v_sub_id, 4, 45, 'approved', '/projects/sensory_box.webp', ARRAY['博弈论','策略','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '得分规则卡', 1),
        (v_project_id, '选择卡片（"合作"和"背叛"各若干张）', 2),
        (v_project_id, '记分表', 3),
        (v_project_id, '铅笔', 4),
        (v_project_id, '计分用的小道具（硬币或积分币）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习规则', '了解囚徒困境的得分规则：双方合作各得3分；双方背叛各得1分；一方合作一方背叛时，背叛者得5分合作者得0分。', 1),
        (v_project_id, '单轮博弈', '两人各自秘密选择"合作"或"背叛"卡片同时亮出，按规则计分。玩10轮，统计总分。', 2),
        (v_project_id, '多轮策略', '进行30轮以上的重复博弈，双方可以根据对方之前的选择调整策略，观察合作关系如何建立。', 3),
        (v_project_id, '策略比较', '尝试不同策略——始终合作、始终背叛、以牙还牙（模仿对方上一轮的选择），记录各策略的总得分。', 4),
        (v_project_id, '多人锦标赛', '邀请更多朋友参加循环赛，每对选手进行20轮博弈，最终总分最高者获胜。', 5),
        (v_project_id, '讨论与反思', '讨论哪种策略表现最好，理解"以牙还牙"策略为什么在重复博弈中往往最优——它既有报复也有宽容。', 6);

    -- Project 15: 最短路径游戏
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('最短路径游戏', '在自制地图上寻找从起点到终点的最短路径，初步体验图论中的路径问题。孩子将学会用数学思维解决"走哪条路最近"的日常问题，锻炼空间分析能力。', v_author_id, v_sub_id, 4, 45, 'approved', '/projects/sensory_box.webp', ARRAY['图论','路径','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '大张白纸或硬纸板', 1),
        (v_project_id, '彩色马克笔', 2),
        (v_project_id, '直尺', 3),
        (v_project_id, '小棋子或硬币（做标记）', 4),
        (v_project_id, '便签纸', 5),
        (v_project_id, '铅笔和计算器', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '绘制地图', '在纸上画出8-10个地点（用圆圈表示），用线段连接有通路的地点，在每条线段上标注距离数值。', 1),
        (v_project_id, '穷举尝试', '选定起点和终点，尝试找出所有可能的路径，计算每条路径的总距离，找出最短的那条。', 2),
        (v_project_id, '学习贪心法', '学习贪心策略：每一步都走当前最短的边。发现贪心法虽然简单但不一定能找到全局最优解。', 3),
        (v_project_id, '学习迪杰斯特拉', '用简化版的迪杰斯特拉算法：从起点出发，每次标记距离最近的未访问节点，更新其邻居的最短距离。', 4),
        (v_project_id, '实战对比', '用贪心法和迪杰斯特拉算法分别求解同一张地图，比较两种方法的结果差异。', 5),
        (v_project_id, '生活应用', '讨论导航软件如何为我们规划最短路线，理解图论在现代交通和物流中的重要应用。', 6);

    -- Project 16: 加密与解密挑战
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('加密与解密挑战', '学习多种密码编码方法，设计自己的加密系统并挑战朋友来破解。孩子将深入了解密码学中的数学原理，体验信息安全的核心思想。', v_author_id, v_sub_id, 4, 50, 'approved', '/projects/sensory_box.webp', ARRAY['密码学','编码','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '笔记本和铅笔', 1),
        (v_project_id, '方格纸', 2),
        (v_project_id, '密码对照表模板', 3),
        (v_project_id, '信封', 4),
        (v_project_id, '彩色笔', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '字母替换密码', '设计一套字母替换规则（如A=M, B=N……），用替换表将一段明文加密成密文。', 1),
        (v_project_id, '栅栏密码', '学习栅栏密码：将明文字母交替写在两行或三行上，再按行连接成密文。例如HELLO变成HLO和EL，密文为HLOEL。', 2),
        (v_project_id, '数字编码', '设计一种数字编码方案，比如用数字坐标表示字母在方格中的位置（波利比奥斯方阵）。', 3),
        (v_project_id, '综合加密', '将多种方法组合使用：先替换再栅栏，或先编码再偏移，创造出更难破解的复合密码。', 4),
        (v_project_id, '破解挑战', '与朋友互相交换密文，尝试在不知道密钥的情况下通过分析字母频率和规律来破解对方的密码。', 5),
        (v_project_id, '安全讨论', '讨论现代加密技术（如密码锁、网上银行）是如何保护我们的信息安全的。', 6);

    -- Project 17: 用数学分析桌游策略
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('用数学分析桌游策略', '用概率和期望值分析常见桌游中的最优策略，让数学成为赢得游戏的秘密武器。孩子将学会用数学工具进行决策分析，理解为什么有些策略长期来看更优。', v_author_id, v_sub_id, 5, 60, 'approved', '/projects/sensory_box.webp', ARRAY['概率','期望','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '常见桌游一套（如大富翁、飞行棋等）', 1),
        (v_project_id, '骰子', 2),
        (v_project_id, '记录本和铅笔', 3),
        (v_project_id, '计算器', 4),
        (v_project_id, '方格纸（画图表）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择分析对象', '选一款熟悉的桌游（如大富翁），记录游戏中涉及随机性的环节（掷骰子移动、抽卡片等）。', 1),
        (v_project_id, '计算概率分布', '算出掷两颗骰子的概率分布：和为7概率最高（6/36），和为2或12最低（1/36），画出概率柱状图。', 2),
        (v_project_id, '分析落点频率', '根据概率分布计算从起点出发最容易停留的格子，发现距起点6-8步的格子被踩到的概率最高。', 3),
        (v_project_id, '计算期望收益', '学习期望值概念：对游戏中的投资选择（如购买哪块地产），计算每种选择的期望收益=收益×概率。', 4),
        (v_project_id, '制定最优策略', '综合概率和期望值分析，制定一套"数学最优"策略并在实际游戏中验证。', 5),
        (v_project_id, '策略报告', '撰写分析报告，用图表展示概率分布和期望收益，总结数学分析带来的策略优势。', 6);

    -- Project 18: 抽样调查实验
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('抽样调查实验', '设计并执行一次真实的抽样调查，从小样本推断总体特征，体验统计学的核心方法。孩子将学会科学的调查方法，理解为什么民调和统计可以用少数人的数据推测整体情况。', v_author_id, v_sub_id, 5, 60, 'approved', '/projects/sensory_box.webp', ARRAY['统计学','抽样','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '不透明袋子', 1),
        (v_project_id, '两种颜色的弹珠各50颗（如红色和蓝色）', 2),
        (v_project_id, '记录表格', 3),
        (v_project_id, '计算器', 4),
        (v_project_id, '方格纸（画图表）', 5),
        (v_project_id, '铅笔和彩色笔', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '准备总体', '请一位家人在袋子里放入红蓝两色弹珠共100颗（比例保密），这就是我们要调查的"总体"。', 1),
        (v_project_id, '随机抽样', '不看袋内，随机抽出10颗弹珠记录颜色后放回袋中并摇匀，重复此过程5次，每次都是独立抽样。', 2),
        (v_project_id, '计算估计值', '计算每次抽样中红色弹珠的比例，以及5次抽样的平均比例，用这个平均比例估计袋中红色弹珠的实际数量。', 3),
        (v_project_id, '增大样本量', '将每次抽样量增加到20颗和30颗，观察估计值是否变得更准确、波动是否更小。', 4),
        (v_project_id, '验证结果', '打开袋子清点实际的红蓝弹珠数量，与抽样估计值对比，讨论样本大小对估计准确性的影响。', 5),
        (v_project_id, '真实调查', '设计一个真实的调查问题（如"班级同学最喜欢的科目"），用学到的抽样方法进行调查并分析结果。', 6);

    -- Project 19: 数列与规律探索
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('数列与规律探索', '研究各种有趣的数列，学会发现规律、总结公式并预测后续数字。孩子将锻炼归纳推理能力，体验从具体数字中提炼抽象规律的数学思维过程。', v_author_id, v_sub_id, 5, 50, 'approved', '/projects/sensory_box.webp', ARRAY['数列','归纳','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '笔记本', 1),
        (v_project_id, '铅笔和彩色笔', 2),
        (v_project_id, '计算器', 3),
        (v_project_id, '方格纸', 4),
        (v_project_id, '小积木或棋子（辅助摆出图形数列）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '等差数列', '研究等差数列如2, 5, 8, 11……发现每次增加相同的差值（公差为3），推导通项公式 an = a1 + (n-1)×d。', 1),
        (v_project_id, '等比数列', '研究等比数列如3, 6, 12, 24……发现每次乘以相同的比值（公比为2），推导通项公式 an = a1 × r^(n-1)。', 2),
        (v_project_id, '图形数列', '用积木摆出三角形数（1, 3, 6, 10……）和正方形数（1, 4, 9, 16……），找出它们的递推规律和通项公式。', 3),
        (v_project_id, '差分法破解', '学习差分法：对数列做逐次差分直到差值为常数，从而判断数列类型并推出通项公式。', 4),
        (v_project_id, '挑战谜题', '解决10道数列填空谜题，运用所学方法发现规律并填出下一个数，记录思考过程。', 5),
        (v_project_id, '创造数列', '发明自己独特的数列规则，用它创建谜题挑战家人和朋友，看谁能最快找出规律。', 6);

    -- Project 20: 数学建模入门
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('数学建模入门', '学习用数学模型描述和解决实际生活中的问题，迈出从"学数学"到"用数学"的关键一步。孩子将体验数学建模的完整流程，理解数学是解决真实世界问题的强大工具。', v_author_id, v_sub_id, 5, 60, 'approved', '/projects/sensory_box.webp', ARRAY['建模','实际问题','数学','游戏'], '数学')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '笔记本和铅笔', 1),
        (v_project_id, '计算器', 2),
        (v_project_id, '方格纸和坐标纸', 3),
        (v_project_id, '直尺和量角器', 4),
        (v_project_id, '实验材料（根据具体问题准备，如弹簧、小球等）', 5),
        (v_project_id, '手机（计时和拍照记录）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择问题', '选一个生活中的问题作为建模对象，例如"课间休息多久效率最高"或"零花钱怎样存增长最快"。', 1),
        (v_project_id, '简化假设', '将复杂的现实问题简化：确定哪些因素最重要需要考虑，哪些次要因素可以暂时忽略。', 2),
        (v_project_id, '建立模型', '用数学语言（方程、函数、图表）描述问题中各因素之间的关系，这就是"数学模型"。', 3),
        (v_project_id, '求解与预测', '运用学过的数学知识求解模型，得出具体的数值结果或趋势预测。', 4),
        (v_project_id, '验证模型', '将模型的预测结果与实际情况对比，如果偏差较大则调整假设和模型参数重新计算。', 5),
        (v_project_id, '展示成果', '将完整的建模过程整理成报告：问题描述、假设条件、数学模型、求解过程、验证结果和改进方向。', 6);

END $$;
