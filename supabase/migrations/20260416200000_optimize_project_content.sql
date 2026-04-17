-- ============================================
-- 批量优化项目文案、步骤和难度评级
-- + 删除不合理项目
-- ============================================
-- AI优化+自动替换: 399个 | 删除: 6个
-- ============================================

BEGIN;

-- ============================================
-- 删除不合理的项目
-- ============================================
DELETE FROM public.project_steps WHERE project_id IN (411,412,413,414,415,416);
DELETE FROM public.project_materials WHERE project_id IN (411,412,413,414,415,416);
DELETE FROM public.likes WHERE project_id IN (411,412,413,414,415,416);
DELETE FROM public.comments WHERE project_id IN (411,412,413,414,415,416);
DELETE FROM public.completed_projects WHERE project_id IN (411,412,413,414,415,416);
DELETE FROM public.collections WHERE project_id IN (411,412,413,414,415,416);
DELETE FROM public.projects WHERE id IN (411,412,413,414,415,416);

-- ============================================
-- 优化项目文案、步骤和难度
-- ============================================
-- [162] 触摸感应灯
UPDATE public.projects SET description = '制作一个用手指触摸金属片就能控制亮灭的感应灯！你将了解人体也是导体、能改变电路电容值的有趣原理。触摸感应是智能手机屏幕的基础技术，通过这个项目初步认识电容感应的概念。', difficulty_stars = 4 WHERE id = 162;
DELETE FROM public.project_steps WHERE project_id = 162;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (162, '制作触摸片', '将铝箔纸剪成一块约3×3厘米的正方形贴在硬纸板上，用杜邦线从铝箔引出一根连接线。', 1),
  (162, '搭建电路', '在面包板上将LED串联220Ω电阻连接到Arduino一个数字引脚，将触摸片通过1MΩ电阻连接到另一个引脚。', 2),
  (162, '编写感应程序', '使用Arduino的CapacitiveSensor库编写程序，检测触摸片上的电容变化，超过阈值时切换LED状态。', 3),
  (162, '上传与调试', '上传程序后用手指触摸铝箔片，观察LED是否在每次触摸时切换亮灭，调整灵敏度阈值。', 4),
  (162, '创意外壳', '为触摸感应灯设计一个外壳，将触摸片做成有趣的形状（如手掌、星星），完成一盏触控灯。', 5);

-- [164] 温度感应风扇
UPDATE public.projects SET description = '用温度传感器和小风扇制作一个温度升高自动开启的智能风扇！你将学习模拟传感器的读取方法和条件判断编程。当周围温度超过设定值时风扇自动转起来，模拟真实的智能家电控制逻辑。', difficulty_stars = 4 WHERE id = 164;
DELETE FROM public.project_steps WHERE project_id = 164;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (164, '连接温度传感器', '将LM35温度传感器插在面包板上，VCC接5V，GND接地，中间输出脚接Arduino的模拟输入引脚A0。', 1),
  (164, '连接风扇电路', '由于风扇功率较大不能直接用Arduino驱动，用三极管作为开关，Arduino数字引脚通过电阻连接三极管基极，风扇接集电极。', 2),
  (164, '编写控制程序', '读取温度传感器的模拟值并换算为摄氏度，设定阈值（如28°C），温度超过阈值时输出HIGH驱动风扇转动。', 3),
  (164, '上传与测试', '上传程序后用手捂住传感器提升温度或用吹风机微微加热，观察风扇是否在达到阈值时自动启动。', 4),
  (164, '显示温度', '如果有LCD显示屏，增加实时温度显示功能，让装置更像一个完整的智能设备。', 5);

-- [163] 简易电子琴
UPDATE public.projects SET description = '用蜂鸣器和按钮制作一个能弹奏不同音调的简易电子琴！你将了解声音的高低由频率决定的原理，学习如何用电路产生不同频率的蜂鸣声来模拟音符。把物理声学和电子制作结合在一起。', difficulty_stars = 4 WHERE id = 163;
DELETE FROM public.project_steps WHERE project_id = 163;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (163, '查阅音符频率表', '查找并记录Do Re Mi Fa Sol La Si七个音符对应的频率值：262、294、330、349、392、440、494 Hz，写在纸上备用。', 1),
  (163, '搭建按键电路', '在面包板上安装7个按钮开关，每个按钮一端接Arduino数字引脚，另一端通过下拉电阻接地。', 2),
  (163, '连接蜂鸣器', '将无源蜂鸣器的正极连接到Arduino的一个PWM引脚，负极接地。', 3),
  (163, '编写演奏程序', '编写Arduino程序检测每个按钮的状态，按下不同按钮时用tone()函数驱动蜂鸣器发出对应频率的声音。', 4),
  (163, '弹奏测试', '上传程序后依次按下7个按钮，听听是否能发出Do到Si的完整音阶，尝试弹一首简单的儿歌。', 5),
  (163, '改进升级', '尝试增加按钮数量扩展音域，或用代码编写自动播放旋律的功能。', 6);

-- [184] 双足行走模型
UPDATE public.projects SET description = '制作一个能依靠重力沿斜面自动行走的双足机器人模型，模拟人类的步态运动。你将学习双足行走的力学平衡原理，理解重心转移和步态周期的概念。', difficulty_stars = 4 WHERE id = 184;
DELETE FROM public.project_steps WHERE project_id = 184;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (184, '设计腿部', '用纸板裁出两条弧形腿部件，弧度要足够使得每条腿能像不倒翁一样前后摆动。', 1),
  (184, '制作髋关节', '用螺丝在两条腿的顶端连接一个横杆作为髋部，使两腿可以交替前后摆动。', 2),
  (184, '添加配重', '在腿部和髋部不同位置粘贴硬币调整重心，使机器人站立时略微前倾。', 3),
  (184, '搭建坡道', '将长木板一端垫高约5-10度作为行走斜面。', 4),
  (184, '行走测试', '将机器人放在斜面顶端轻轻推一下，在重力作用下它应该能交替摆腿缓缓走下坡道。', 5),
  (184, '调试优化', '微调腿部弧度、配重位置和坡度角度，让行走动作更稳定流畅。在笔记本上画出机器人行走时重心转移的示意图。', 6);

-- [143] Scratch 双人对战游戏
UPDATE public.projects SET description = '制作一个双人同屏对战游戏（如乒乓球、坦克大战），两个玩家分别用不同按键控制角色。你将学习多角色同时控制、碰撞交互和公平竞技规则的编程实现。', difficulty_stars = 3 WHERE id = 143;
DELETE FROM public.project_steps WHERE project_id = 143;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (143, '设计游戏规则', '确定对战游戏类型（如乒乓球），规划两个玩家的操控按键（玩家1用W/S，玩家2用上/下箭头）。', 1),
  (143, '创建双方角色', '制作两个挡板角色，分别编程响应不同按键控制上下移动，确保互不干扰。', 2),
  (143, '编写球的运动', '创建球角色，设置自动运动和边缘反弹逻辑，碰到挡板反弹并加速，增加紧张感。', 3),
  (143, '实现得分系统', '当球越过某方挡板到达边界时对方得分，使用两个变量分别记录双方分数并显示在舞台上。', 4),
  (143, '胜负判定', '当一方先达到指定分数时宣布获胜，显示胜利画面和最终比分，提供重新开始选项。', 5),
  (143, '优化游戏体验', '调整球速和挡板速度使游戏平衡，添加开场倒计时、音效和得分动画效果。', 6);

-- [144] Python 简易聊天机器人
UPDATE public.projects SET description = '用 Python 制作一个能对话的简易聊天机器人，它能理解简单问题并给出回答。你将学习字符串匹配和处理技巧，初步了解人工智能对话系统的基本原理。', difficulty_stars = 3 WHERE id = 144;
DELETE FROM public.project_steps WHERE project_id = 144;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (144, '设计对话内容', '列出机器人能回答的问题类型（问候、天气、笑话、知识问答等），设计对应的回答内容。', 1),
  (144, '基础对话框架', '编写主循环：获取用户输入→分析关键词→匹配回答→输出回复，用 while 循环保持持续对话。', 2),
  (144, '关键词匹配', '使用 if/elif 和字符串的 in 运算符检测用户输入中的关键词，匹配到不同关键词给出不同回答。', 3),
  (144, '添加随机回复', '对同一类问题准备多个回答，使用 random.choice() 随机选择，让机器人不总是说同样的话。', 4),
  (144, '增强智能感', '添加记住用户名字、记录对话历史、根据时间问候等功能，让机器人更像真正的聊天伙伴。', 5);

-- [141] 网页版计算器
UPDATE public.projects SET description = '用 HTML、CSS 和 JavaScript 制作一个功能完整的网页计算器，支持加减乘除运算。你将学习前端三件套的协作方式，理解事件处理和DOM操作的基本概念。', difficulty_stars = 3 WHERE id = 141;
DELETE FROM public.project_steps WHERE project_id = 141;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (141, '搭建HTML结构', '创建计算器的HTML结构：一个显示屏div和多个按钮（0-9数字、+-×÷运算符、等号、清除）。', 1),
  (141, 'CSS美化界面', '用CSS Grid布局排列按钮为网格形式，设置按钮颜色、圆角、阴影效果，让计算器外观美观。', 2),
  (141, '实现数字输入', '用JavaScript给每个数字按钮添加点击事件，点击后将数字显示在屏幕上，处理多位数输入。', 3),
  (141, '实现运算逻辑', '编写计算函数处理加减乘除运算，点击等号时执行计算并显示结果，处理连续运算。', 4),
  (141, '处理特殊情况', '添加清除功能、退格删除、小数点输入，处理除以零等错误情况，添加按钮点击动画效果。', 5);

-- [181] Arduino 巡线小车
UPDATE public.projects SET description = '使用Arduino和红外传感器制作一辆能沿着黑线自动行驶的智能小车。你将首次接触编程控制硬件，学习传感器检测和条件判断的基本逻辑。', difficulty_stars = 4 WHERE id = 181;
DELETE FROM public.project_steps WHERE project_id = 181;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (181, '组装底盘', '将电机、车轮和万向轮安装在底盘上，将Arduino和电机驱动模块固定在底盘上方。', 1),
  (181, '连接电路', '将红外传感器安装在底盘前端朝下，按照接线图将传感器、电机驱动模块和Arduino连接起来。', 2),
  (181, '编写程序', '在Arduino IDE中编写巡线程序：读取左右传感器值，黑线上为低电平，根据检测结果控制左右电机实现转向。', 3),
  (181, '铺设赛道', '在白色地面上用黑色胶带贴出赛道线路，包含直线和弯道。', 4),
  (181, '调试运行', '上传程序到Arduino，将小车放在赛道上测试，调整传感器高度和程序参数直到小车能稳定巡线。', 5),
  (181, '进阶挑战', '增加赛道难度（急弯、交叉路口），优化程序算法提高巡线速度和稳定性。', 6);

-- [182] 避障机器人
UPDATE public.projects SET description = '使用Arduino和超声波传感器制作一个能自动检测并避开障碍物的智能小车。你将学习超声波测距原理和简单的决策算法，让机器人具备"眼睛"的感知能力。', difficulty_stars = 4 WHERE id = 182;
DELETE FROM public.project_steps WHERE project_id = 182;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (182, '组装底盘', '将电机、车轮安装在底盘上，在前端安装舵机，将超声波传感器固定在舵机上使其可左右扫描。', 1),
  (182, '连接电路', '按照接线图将超声波传感器、舵机、电机驱动模块与Arduino连接，注意电源的正确分配。', 2),
  (182, '编写避障程序', '编程实现：超声波发出脉冲并计算回波时间得出距离，当前方障碍物小于20厘米时停车，舵机左右扫描选择空旷方向转弯。', 3),
  (182, '搭建测试场地', '用书本、纸盒等搭建障碍物场地，留出足够的通道让小车穿行。', 4),
  (182, '调试优化', '上传程序测试，调整超声波检测距离阈值和转弯时间参数，让避障动作更灵活准确。', 5),
  (182, '算法升级', '尝试改进策略：加入后退功能、记忆路径、或优先选择最远距离方向，提升避障智能。', 6);

-- [140] Python 自动化小工具
UPDATE public.projects SET description = '用 Python 编写实用的自动化脚本，比如批量重命名文件、整理桌面文件夹等。你将学习文件操作和字符串处理，体验编程解决实际生活问题的乐趣。', difficulty_stars = 4 WHERE id = 140;
DELETE FROM public.project_steps WHERE project_id = 140;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (140, '运行文件操作示例', '在Python中导入os模块，运行 os.listdir(".") 列出当前目录文件，运行 os.mkdir("test") 创建测试文件夹，确认基本文件操作命令可用。', 1),
  (140, '批量重命名文件', '编写脚本读取文件夹中的所有文件，按规则批量重命名（如添加日期前缀、统一编号）。', 2),
  (140, '自动整理文件', '编写脚本根据文件扩展名自动将文件分类移动到对应文件夹（图片、文档、视频等）。', 3),
  (140, '添加用户交互', '使用 input() 让用户选择要执行的操作、指定文件夹路径等，让工具更灵活实用。', 4),
  (140, '安全措施和测试', '先在测试文件夹中运行脚本确认效果，添加确认提示防止误操作，处理文件名冲突等异常。', 5);

-- [202] 可活动关节模型
UPDATE public.projects SET description = '设计一个多关节的可动人偶或机器人模型，每个关节都能自由转动摆出各种姿势。你将学习旋转关节和球形关节的设计方法，掌握多零件装配的技巧。', difficulty_stars = 4 WHERE id = 202;
DELETE FROM public.project_steps WHERE project_id = 202;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (202, '绘制关节结构草图', '在纸上分别画出球形关节（球窝结构，可全方向转动）和铰链关节（单轴转动）的截面示意图，标注活动方向。', 1),
  (202, '建模身体部件', '设计人偶的头部、躯干、上臂、前臂、大腿、小腿等各个部件，在连接处预留关节接口。', 2),
  (202, '设计关节结构', '肩膀和髋部使用球形关节实现多方向活动，肘部和膝盖使用铰链关节实现单向弯曲。', 3),
  (202, '公差测试', '先打印一组测试关节，检查球头和球窝的配合松紧度，调整间隙至转动顺畅但能保持姿势。', 4),
  (202, '打印与装配', '打印所有部件，按照从躯干到四肢的顺序逐一装配关节，确保每个关节活动自如。', 5),
  (202, '摆姿势展示', '为你的可动人偶摆出各种有趣的姿势并拍照，体验从零设计一个玩具的乐趣。', 6);

-- [183] 机械抓手制作
UPDATE public.projects SET description = '制作一个可以远程操控抓取物体的机械抓手，模拟工业机器人末端执行器的功能。你将学习机械臂夹持机构的设计原理，理解连杆放大运动和力的方式。', difficulty_stars = 4 WHERE id = 183;
DELETE FROM public.project_steps WHERE project_id = 183;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (183, '制作夹爪连杆', '用冰棒棍制作两组X形交叉连杆，每组用螺丝在交叉点连接，形成可开合的剪刀式结构。', 1),
  (183, '串联延长', '将多组X形连杆首尾串联，形成一个可伸缩的长臂结构，拉一端另一端同步联动。', 2),
  (183, '安装夹爪', '在连杆前端安装两个弯曲的"手指"，通过连杆的开合运动实现夹爪的抓取和松开。', 3),
  (183, '制作控制手柄', '在连杆尾端制作操控手柄，用绳子和橡皮筋辅助控制，拉动绳子收紧夹爪、松开橡皮筋弹开。', 4),
  (183, '抓取测试', '用机械抓手尝试抓取不同大小和重量的物体，如积木、球、纸杯等，记录成功率。', 5),
  (183, '对比测试', '更换不同形状和材质的夹爪指头（如加橡皮垫增加摩擦），分别抓取同一组物体，记录成功率对比。', 6);

-- [186] 自平衡机器人入门
UPDATE public.projects SET description = '制作一个能自动保持直立平衡的两轮机器人，类似赛格威的工作原理。你将初步接触陀螺仪传感器和PID控制算法，理解反馈控制系统的核心思想。', difficulty_stars = 5 WHERE id = 186;
DELETE FROM public.project_steps WHERE project_id = 186;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (186, '组装机身', '搭建竖直的机身框架，两个电机安装在底部两侧，MPU6050安装在机身中部保持水平。', 1),
  (186, '连接电路', '将MPU6050通过I2C连接Arduino，电机驱动模块连接电机和Arduino的PWM引脚，安装好电池。', 2),
  (186, '读取姿态数据', '编写程序读取MPU6050的倾斜角度数据，通过串口监视器观察机器人倾斜时数值的变化。', 3),
  (186, '实现PID控制', '编写PID控制算法：将倾斜角度作为输入，计算出电机应输出的速度和方向来纠正倾斜。', 4),
  (186, '调节PID参数', '反复调整P（比例）、I（积分）、D（微分）三个参数，从只有P开始，逐步加入I和D，让机器人稳定站立。', 5),
  (186, '记录与总结', '在笔记本上画出PID控制的工作流程图，标注P（响应当前误差）、I（消除累计偏差）、D（预测变化趋势）各自的作用。', 6);

-- [205] 行星齿轮组
UPDATE public.projects SET description = '设计并打印一套完整的行星齿轮机构——包括太阳轮、行星轮、行星架和齿圈。你将深入学习行星齿轮系的传动原理，理解自动变速箱中这一核心机构的工作方式。', difficulty_stars = 5 WHERE id = 205;
DELETE FROM public.project_steps WHERE project_id = 205;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (205, '绘制行星齿轮草图', '在纸上画出行星齿轮系的结构草图：中心画太阳轮，周围画3个行星轮，外圈画齿圈，标注各部件名称和转动方向箭头。', 1),
  (205, '计算齿轮参数', '确定模数为1，太阳轮16齿，行星轮8齿，齿圈32齿（满足齿圈齿数=太阳轮齿数+2×行星轮齿数），设计3个均布的行星轮。', 2),
  (205, '建模各齿轮', '分别建模太阳轮、行星轮、齿圈（内齿轮）和行星架，每个齿轮中心留出轴孔。', 3),
  (205, '虚拟装配验证', '在软件中将所有零件组装到位，检查齿轮啮合是否正确，旋转仿真验证传动关系。', 4),
  (205, '高精度打印', '以0.1毫米层高打印所有零件，用不同颜色区分各部件，打印后仔细去除毛刺。', 5),
  (205, '组装与演示', '涂抹少量润滑油，组装整个行星齿轮系，固定齿圈转动太阳轮，观察行星架的减速输出效果。', 6);

-- [148] Python 图片批量处理
UPDATE public.projects SET description = '用 Python 的 Pillow 库编写图片处理脚本，实现批量缩放、加水印、格式转换等实用功能。你将学习图像处理的基本原理，体验用编程高效完成重复性工作的能力。', difficulty_stars = 4 WHERE id = 148;
DELETE FROM public.project_steps WHERE project_id = 148;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (148, '安装并测试Pillow', '运行 pip install Pillow 安装库，然后编写三行代码：from PIL import Image → img = Image.open("test.jpg") → print(img.size, img.mode)，确认环境就绪。', 1),
  (148, '处理单张图片', '对一张测试图片依次调用 resize() 缩放、rotate() 旋转、crop() 裁剪、filter() 加滤镜，每步保存结果并对比效果。', 2),
  (148, '批量处理脚本', '结合 os 模块遍历文件夹，编写脚本将所有图片统一缩放到指定尺寸或转换为统一格式。', 3),
  (148, '添加文字水印', '使用 ImageDraw 和 ImageFont 在图片上添加文字水印，设置字体、大小、颜色和位置。', 4),
  (148, '制作拼图和相册', '将多张图片自动拼接成一张大图或按网格排列制作照片墙，综合运用所有技能创作最终作品。', 5);

-- [166] 红外遥控小车
UPDATE public.projects SET description = '用红外遥控器和接收模块控制一辆自制小车的前进、后退和转弯！你将学习红外通信的原理和电机驱动的方法。这个项目综合了机械结构搭建、电路连接和编程控制，是一个综合性很强的挑战。', difficulty_stars = 5 WHERE id = 166;
DELETE FROM public.project_steps WHERE project_id = 166;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (166, '组装底盘', '将两个电机和万向轮安装在小车底盘上，确保两侧电机对称，轮子转动顺畅。', 1),
  (166, '连接驱动模块', '将L298N电机驱动模块安装在底盘上，两个电机分别连接到模块的A和B输出端，电池组接模块电源输入。', 2),
  (166, '连接控制电路', '将Arduino固定在底盘上，L298N的控制引脚（IN1-IN4和ENA、ENB）连接到Arduino数字引脚，红外接收模块连接到另一个引脚。', 3),
  (166, '解码遥控器', '先编写红外解码程序上传，按下遥控器各按键记录对应的编码值，选定前进、后退、左转、右转和停止的按键。', 4),
  (166, '编写控制程序', '根据解码的按键值编写小车控制程序：收到"前进"编码时两电机正转，"左转"时左轮停右轮转，"停止"时两电机停止。', 5),
  (166, '测试与优化', '在开阔地面测试遥控小车的各项操控，调整电机速度和转向灵敏度，让小车完成绕障碍物行驶的任务。', 6);

-- [168] 蓝牙音箱制作
UPDATE public.projects SET description = '用蓝牙音频接收模块和功放板组装一个真正能用手机连接播放音乐的蓝牙音箱！你将了解无线通信、音频信号放大和扬声器发声的完整链路。这是一个实用性极高的项目，完成后可以日常使用。', difficulty_stars = 5 WHERE id = 168;
DELETE FROM public.project_steps WHERE project_id = 168;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (168, '识别各模块接口', '拿出蓝牙模块、功放模块和充电模块，对照说明书辨认每个模块的输入输出引脚和接口位置，用标签纸标注。', 1),
  (168, '连接音频通路', '将蓝牙模块的音频输出（左右声道和地线）连接到功放模块的音频输入端，功放的两个输出端分别连接两个喇叭。', 2),
  (168, '搭建电源系统', '将锂电池通过TP4056充电模块连接，输出端经开关连接到蓝牙模块和功放模块的供电引脚。', 3),
  (168, '测试音质', '开机后用手机搜索蓝牙设备并连接，播放音乐测试声音是否正常，检查有无杂音或接触不良。', 4),
  (168, '组装外壳', '在木盒或纸盒上为喇叭开孔，将所有模块整齐固定在盒内，开关和充电口露在外面方便使用。', 5),
  (168, '装饰与使用', '装饰音箱外壳使其美观，享受用自己亲手制作的蓝牙音箱播放喜欢的音乐，体会从零到一的创造乐趣。', 6);

-- [147] Python 爬虫入门
UPDATE public.projects SET description = '用 Python 的 requests 库学习网页数据抓取的基本技术，从网页中提取有用的信息。你将了解网页的工作原理，学习HTTP请求和HTML解析，同时建立网络安全和道德爬虫的意识。', difficulty_stars = 4 WHERE id = 147;
DELETE FROM public.project_steps WHERE project_id = 147;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (147, '查看网页源代码', '在浏览器中对任意网页右键选择「查看源代码」，找到 <h1>、<p>、<a> 等标签，在笔记中记录网页的基本结构。', 1),
  (147, '发送第一个HTTP请求', '在Python中运行 requests.get("https://example.com")，打印返回的状态码和前200个字符的文本内容，验证请求成功。', 2),
  (147, '解析HTML内容', '使用 BeautifulSoup 解析网页，学习 find()、find_all()、select() 等方法定位和提取特定内容。', 3),
  (147, '提取并保存数据', '编写脚本从练习网页中提取标题、文本等信息，将结果保存到CSV文件中。', 4);

-- [165] Arduino 气象站
UPDATE public.projects SET description = '用Arduino和多种传感器搭建一个能测量温度、湿度和气压的小型气象站！你将学习多个传感器的协同工作方式和数据采集的基本方法。可以连续记录天气数据，像真正的气象员一样观测气候变化。', difficulty_stars = 5 WHERE id = 165;
DELETE FROM public.project_steps WHERE project_id = 165;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (165, '连接温湿度传感器', '将DHT11传感器连接到面包板，VCC接5V，GND接地，数据脚通过10KΩ上拉电阻接Arduino数字引脚。', 1),
  (165, '连接气压传感器', '将BMP180通过I2C总线连接到Arduino，SDA接A4，SCL接A5，VCC和GND分别接电源和地线。', 2),
  (165, '连接LCD显示屏', '按照LCD1602的接线图将其连接到Arduino，安装电位器调节显示对比度到清晰可见。', 3),
  (165, '编写综合程序', '安装DHT和BMP180库，编写程序循环读取温度、湿度和气压值，格式化后显示在LCD屏幕上。', 4),
  (165, '组装与测试', '将所有元件整理固定在外壳中，通电运行后与手机天气APP的数据对比验证准确性。', 5),
  (165, '持续观测', '将气象站放在窗台或阳台，连续一周每天同一时间记录温度、湿度和气压数据，用表格整理并画出变化折线图。', 6);

-- [146] 网页版记事本应用
UPDATE public.projects SET description = '用 HTML、CSS 和 JavaScript 制作一个功能完整的网页记事本，支持添加、编辑、删除和本地保存笔记。你将学习 DOM 操作、事件监听和 localStorage 本地存储。', difficulty_stars = 4 WHERE id = 146;
DELETE FROM public.project_steps WHERE project_id = 146;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (146, '设计界面布局', '用HTML创建页面结构：顶部标题栏、笔记输入区（标题+内容）、添加按钮和笔记列表展示区。', 1),
  (146, '美化样式', '用CSS设计现代风格界面：卡片式笔记列表、渐变背景、悬浮阴影效果、响应式布局适配不同屏幕。', 2),
  (146, '实现添加功能', '用JavaScript获取输入内容，动态创建笔记卡片DOM元素并添加到列表中，每条笔记显示标题、内容和时间。', 3),
  (146, '实现删除和编辑', '为每条笔记添加删除按钮和编辑按钮，点击删除移除DOM元素，点击编辑将内容回填到输入框修改后保存。', 4),
  (146, '本地存储', '使用localStorage将笔记数据以JSON格式保存在浏览器中，页面加载时自动读取并显示已保存的笔记。', 5),
  (146, '高级功能', '添加笔记搜索过滤、按时间排序、笔记分类标签、双击确认删除等功能，提升应用实用性。', 6);

-- [207] 3D打印乐器
UPDATE public.projects SET description = '设计并打印一个能发出真实音调的简易乐器，如口哨、排箫或小号嘴。你将学习声学共鸣的原理，理解乐器的腔体形状和大小如何决定音高和音色。', difficulty_stars = 5 WHERE id = 207;
DELETE FROM public.project_steps WHERE project_id = 207;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (207, '测量管长与音高关系', '准备几根不同长度的吸管（剪成6cm、8cm、10cm、12cm），逐根吹响并用手机调音器APP记录音高，验证管越短音越高。', 1),
  (207, '设计排箫管', '建模一组不同长度的空心管（从60毫米到120毫米），内径统一为10毫米，壁厚1.5毫米，一端封闭一端开放。', 2),
  (207, '计算音调', '根据管长计算每根管的理论音高（频率 = 声速 ÷ (4 × 管长)），对应到音阶上的do、re、mi等音符。', 3),
  (207, '打印与打磨', '打印所有管子，仔细打磨开口端使边缘光滑，以获得更清晰的吹奏效果。', 4),
  (207, '调音测试', '逐根吹奏并用手机调音器检测实际音高，与理论值对比，微调管长直到音准正确。', 5),
  (207, '组装与演奏', '将所有管子按音高顺序排列并固定在支架上，组装成完整的排箫，吹奏一段简单旋律（如《小星星》）并录音。', 6);

-- [187] 机器人迷宫挑战
UPDATE public.projects SET description = '编程让机器人自主导航通过迷宫找到出口，综合运用传感器和算法知识。你将学习基本的迷宫求解算法（如左手法则），培养算法思维和系统调试能力。', difficulty_stars = 5 WHERE id = 187;
DELETE FROM public.project_steps WHERE project_id = 187;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (187, '搭建迷宫', '用纸板或泡沫板搭建一个简单迷宫，通道宽度约为小车宽度的两倍，设置入口和出口。', 1),
  (187, '组装小车', '在小车前方和左右两侧各安装一个超声波传感器，连接电机驱动模块和Arduino。', 2),
  (187, '编写感知程序', '编程读取三个方向的距离数据，在串口监视器中验证测距是否准确。', 3),
  (187, '实现左手法则', '编写导航算法：优先左转，左侧无墙则左转，前方有墙且左侧有墙则右转，三面有墙则掉头。', 4),
  (187, '迷宫测试', '将小车放入迷宫入口，观察它按照算法自主导航，记录通过迷宫所需时间。', 5),
  (187, '算法优化', '增加迷宫中的弯道和死胡同数量，用计时器记录小车通过不同复杂度迷宫的时间，尝试调整参数缩短通过时间。', 6);

-- [145] Python 数据可视化
UPDATE public.projects SET description = '使用 Python 的 matplotlib 库将数据变成直观的图表，让枯燥的数字活起来。你将学习数据收集、整理和可视化展示的完整流程，培养用数据讲故事的能力。', difficulty_stars = 4 WHERE id = 145;
DELETE FROM public.project_steps WHERE project_id = 145;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (145, '收集数据', '选择一个有趣的主题（如一周气温变化、班级同学身高分布），收集并整理数据到Python列表中。', 1),
  (145, '绘制折线图', '导入 matplotlib.pyplot，用 plot() 函数将气温数据绘制成折线图，调用 xlabel()、ylabel()、title() 添加坐标轴标签和标题，savefig() 保存图片。', 2),
  (145, '绘制柱状图和饼图', '用 bar() 绘制柱状图比较不同类别的数据，用 pie() 绘制饼图展示比例关系。', 3),
  (145, '美化图表', '为图表设置自定义颜色、线型和标记样式，添加图例 legend()、网格线 grid()，调整字体大小，保存一张专业美观的图表。', 4),
  (145, '数据分析报告', '用多个子图组合展示不同维度的数据分析结果，添加文字注解，形成一份完整的数据分析小报告。', 5);

-- [206] 可折叠结构设计
UPDATE public.projects SET description = '设计一个能够从平面展开为立体结构的折叠机构，如折叠杯、折叠盒或折叠手机架。你将学习折叠铰链和活动连杆的设计方法，探索折纸数学在工程中的应用。', difficulty_stars = 5 WHERE id = 206;
DELETE FROM public.project_steps WHERE project_id = 206;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (206, '纸板原型验证', '先用纸板制作折叠结构的简易模型，验证折叠和展开的动作是否顺畅，确定铰链位置和折叠方向。', 1),
  (206, '设计铰链机构', '在建模软件中设计活动铰链——可以采用一体打印的柔性铰链（薄壁弯折处）或分件销轴铰链。', 2),
  (206, '建模折叠面板', '设计各个折叠面板的形状和尺寸，在面板连接处添加铰链结构，确保折叠后能紧密贴合。', 3),
  (206, '设计锁定机构', '添加卡扣或磁吸结构，使结构在展开状态下能固定住不会自行折叠。', 4),
  (206, '打印与测试', '打印所有部件并组装，反复折叠和展开测试耐久性，检查铰链是否有疲劳断裂的风险。', 5),
  (206, '优化迭代', '根据测试结果调整铰链厚度、间隙和锁定力度，打印改进版本直到满意。', 6);

-- [167] 超声波测距仪
UPDATE public.projects SET description = '用超声波传感器制作一个能精确测量距离的电子测距仪！你将学习声波反射测距的原理，理解"发射-反射-接收"的计时测距方法。还可以加入蜂鸣器做成倒车雷达，距离越近蜂鸣越急促。', difficulty_stars = 5 WHERE id = 167;
DELETE FROM public.project_steps WHERE project_id = 167;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (167, '验证测距公式', '在纸上写出测距公式：距离 = 声波往返时间 x 声速(340m/s) / 2，用计算器算出往返时间为1ms时对应的距离（17cm），记录备用。', 1),
  (167, '连接硬件', '将HC-SR04的Trig和Echo分别连接Arduino两个数字引脚，VCC接5V，GND接地，同时连接LCD显示屏和蜂鸣器。', 2),
  (167, '编写测距程序', '编写Arduino程序：Trig引脚发出10微秒高电平触发脉冲，用pulseIn()读取Echo引脚的返回时间，换算为厘米距离。', 3),
  (167, '显示与报警', '将测量到的距离实时显示在LCD屏幕上，当距离小于设定值（如20cm）时蜂鸣器开始报警，越近蜂鸣越快。', 4),
  (167, '精度验证', '用卷尺在不同距离放置障碍物，对比超声波测距仪的读数和实际距离，计算误差。', 5),
  (167, '实际应用', '将测距仪安装在小车后方做成倒车雷达模型，或放在门口做人员经过检测器。', 6);

-- [208] 仿生结构设计
UPDATE public.projects SET description = '从自然界中获取灵感，模仿蜂巢、骨骼或贝壳等天然结构设计轻量高强度的3D打印零件。你将学习仿生学的核心思想，理解自然界经过亿万年进化出的结构为何如此高效。', difficulty_stars = 5 WHERE id = 208;
DELETE FROM public.project_steps WHERE project_id = 208;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (208, '收集自然结构样本', '收集或拍摄蜂巢、鸡骨横截面、贝壳等自然结构的照片，用放大镜观察其内部纹理，在笔记本上画出结构示意图。', 1),
  (208, '选择仿生对象', '选择一种自然结构作为灵感来源（如蜂巢六边形），分析其几何规律和受力特点。', 2),
  (208, '建模仿生结构', '在建模软件中用六边形蜂窝网格填充一个板状零件的内部，调整蜂窝壁厚和单元大小。', 3),
  (208, '设计对照组', '同时设计一个相同外形但使用普通实心填充（如直线网格）的对照零件，确保两者材料用量相同。', 4),
  (208, '打印与测试', '打印仿生结构和对照组零件，分别进行承载测试，记录断裂时的最大荷载并计算强度重量比。', 5),
  (208, '承载对比测试', '分别在仿生结构和对照组零件上逐步加载重物，记录各自断裂时的最大荷载，计算强度重量比并制作对比图表。', 6);

-- [185] Arduino 蓝牙遥控车
UPDATE public.projects SET description = '使用Arduino和蓝牙模块制作一辆能通过手机App遥控的智能小车。你将学习蓝牙无线通信的基本原理，掌握手机与硬件设备之间的数据交互方法。', difficulty_stars = 5 WHERE id = 185;
DELETE FROM public.project_steps WHERE project_id = 185;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (185, '组装底盘', '将电机、车轮和万向轮安装在底盘上，将Arduino、电机驱动模块和蓝牙模块固定好。', 1),
  (185, '连接电路', '将蓝牙模块的TX/RX连接到Arduino对应引脚，电机驱动模块连接电机和Arduino的PWM引脚。', 2),
  (185, '编写控制程序', '编写Arduino程序：通过串口接收蓝牙传来的指令字符（如F前进、B后退、L左转、R右转），对应控制电机转动。', 3),
  (185, '配置手机App', '在手机上安装蓝牙串口控制App，与HC-05模块配对连接，设置方向控制按钮对应的发送字符。', 4),
  (185, '联调测试', '上传程序，用手机App发送指令测试小车各方向运动，调整电机转速和转弯时间参数。', 5),
  (185, '功能扩展', '添加PWM调速功能实现变速控制，或加装蜂鸣器和LED灯增加声光效果，打造个性化遥控车。', 6);

-- [188] 可编程绘图机器人
UPDATE public.projects SET description = '制作一个能按照程序指令在纸上画出图案的绘图机器人，类似迷你版的CNC绘图仪。你将学习步进电机的精确控制和坐标系的概念，体验数控技术的魅力。', difficulty_stars = 5 WHERE id = 188;
DELETE FROM public.project_steps WHERE project_id = 188;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (188, '搭建XY轴框架', '用纸板搭建框架，安装两根导轨分别作为X轴和Y轴，确保滑块能在导轨上平滑移动。', 1),
  (188, '安装驱动系统', '将两个步进电机分别安装在X轴和Y轴末端，通过同步带或绕线方式驱动滑块移动。', 2),
  (188, '安装笔架', '在XY轴交汇处的滑块上安装笔架，用舵机控制马克笔的抬起和落下。', 3),
  (188, '编写控制程序', '编写Arduino程序，实现步进电机的精确步数控制，将坐标指令转换为X/Y轴的电机步数。', 4),
  (188, '绘制简单图形', '编程让机器人画出正方形、三角形和圆形等基本图案，在纸上验证绘图精度。', 5),
  (188, '创意绘图', '编写更复杂的绘图程序画出文字、星形或自定义图案，探索G-code解析等进阶数控概念。', 6);

-- [352] 七巧板拼图
UPDATE public.projects SET description = '用七块简单的几何板拼出各种有趣的图形，从动物到建筑无所不能。七巧板是中国传统益智玩具，你在拼摆中锻炼空间想象力，认识三角形、正方形和平行四边形的组合关系。', difficulty_stars = 1 WHERE id = 352;
DELETE FROM public.project_steps WHERE project_id = 352;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (352, '画出七巧板', '在硬卡纸上画一个正方形，按照七巧板的标准分割线画出五个三角形、一个正方形和一个平行四边形。', 1),
  (352, '裁剪上色', '沿线剪出七块板，用不同颜色的彩笔为每块板涂上颜色，便于区分。', 2),
  (352, '还原正方形', '先尝试把七块板重新拼回原来的正方形，这是最基础的挑战。', 3),
  (352, '拼出图案', '根据图样卡或自由发挥，用七块板拼出小猫、房子、小船等各种有趣的图案。', 4),
  (352, '创造与记录', '发挥想象力创造新图案，将成功的拼法描在纸上记录下来，和家人分享你的作品。', 5);

-- [393] 找规律填数
UPDATE public.projects SET description = '观察一组数字序列，发现隐藏的规律并填出缺失的数字。这个经典的数学游戏训练你的观察力和归纳推理能力，从简单的等差数列到有趣的斐波那契数列逐步进阶。', difficulty_stars = 1 WHERE id = 393;
DELETE FROM public.project_steps WHERE project_id = 393;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (393, '热身练习', '从最简单的等差数列开始：2, 4, 6, ?, 10——找到"每次加2"的规律，填入8。', 1),
  (393, '进阶挑战', '尝试更复杂的规律，例如：1, 1, 2, 3, 5, ?——观察前两个数相加等于第三个数的斐波那契规律。', 2),
  (393, '自创数列', '自己设计一组有规律的数列，把某些数字空出来，让家人或朋友来猜。', 3),
  (393, '图形数列', '将规律从纯数字扩展到图形：用圆形、三角形、方形排列出有规律的序列，训练模式识别能力。', 4),
  (393, '总结规律类型', '回顾今天发现的所有规律类型（加法、乘法、交替、组合等），在笔记本上记录下来作为"规律宝典"。', 5);

-- [372] 骰子比大小
UPDATE public.projects SET description = '用骰子进行各种比大小的趣味数学游戏，感受随机和概率的魅力。你将在掷骰子的过程中练习数字比较和简单加法，初步体验概率的概念。', difficulty_stars = 1 WHERE id = 372;
DELETE FROM public.project_steps WHERE project_id = 372;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (372, '基础比大小', '每人掷一颗骰子，点数大的一方得1分，平局则各得0.5分，先到10分者获胜。', 1),
  (372, '双骰求和', '每人同时掷两颗骰子，将点数相加，总和更大的人获胜，练习快速心算能力。', 2),
  (372, '预测游戏', '掷骰子之前先猜测点数是大于3还是小于等于3，猜对得2分，猜错不得分。', 3),
  (372, '记录统计', '连续掷骰子30次，记录每个点数出现的次数，观察是否每个数字出现的频率大致相同。', 4),
  (372, '计算概率', '把30次掷骰子的结果整理成柱状图，计算每个点数出现的频率（次数/30），与理论概率1/6对比，看差距有多大。', 5);

-- [391] 七巧板几何挑战
UPDATE public.projects SET description = '用七块简单的几何板拼出各种有趣的图形，锻炼空间想象力和几何直觉。你将在拼拼摆摆中认识三角形、正方形和平行四边形，体会"部分组成整体"的数学思想。', difficulty_stars = 1 WHERE id = 391;
DELETE FROM public.project_steps WHERE project_id = 391;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (391, '认识七巧板', '观察七巧板的七个组件：两个大三角形、一个中三角形、两个小三角形、一个正方形和一个平行四边形，了解它们的形状和大小关系。', 1),
  (391, '还原正方形', '先尝试将七块板拼回一个完整的正方形，这是最基本的七巧板挑战。', 2),
  (391, '拼出简单图形', '根据模板卡片，用七块板拼出小猫、小鸟、房子等简单图形，注意每块板都要用到且不能重叠。', 3),
  (391, '挑战创意拼图', '不看模板，自由发挥创造新的图形，用铅笔描下轮廓记录你的作品。', 4),
  (391, '面积验证', '用方格纸描出七巧板的每块板，数格子计算每块板的面积，再加总验证：无论怎么拼，七块板的总面积始终不变。', 5);

-- [371] 数字配对翻牌
UPDATE public.projects SET description = '制作一套数字配对卡片，通过翻牌找到相同数字的配对来锻炼记忆力。你将在游戏中熟悉数字认知，同时提升专注力和短期记忆能力。', difficulty_stars = 1 WHERE id = 371;
DELETE FROM public.project_steps WHERE project_id = 371;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (371, '制作卡片', '用直尺在硬卡纸上画出大小一致的方形格子（约6厘米×6厘米），剪出20张卡片。', 1),
  (371, '书写数字', '在10张卡片正面分别写上数字1到10，再制作一套完全相同的10张，共组成10对配对卡片。', 2),
  (371, '装饰背面', '将所有卡片背面涂上统一的颜色或图案，确保从背面无法区分不同卡片。', 3),
  (371, '开始游戏', '将所有卡片背面朝上随机排列成4×5的方阵，每次翻开两张，如果数字相同就取走，不同则翻回去。', 4),
  (371, '挑战升级', '记录完成配对所需的翻牌次数，尝试用更少次数完成游戏，还可以增加卡片数量提升难度。', 5);

-- [373] 数字连线画
UPDATE public.projects SET description = '按照数字从小到大的顺序依次连线，最终呈现出一幅完整的图案。你将在有趣的绘画过程中巩固数字顺序的认知，训练手眼协调能力。', difficulty_stars = 1 WHERE id = 373;
DELETE FROM public.project_steps WHERE project_id = 373;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (373, '设计图案', '先在纸上用铅笔轻轻画出一个简单图案的轮廓，比如一颗星星、一只小鱼或一朵花。', 1),
  (373, '标注数字', '沿着轮廓线均匀选取20-30个关键点，按顺序标上数字1、2、3……然后擦除原来的轮廓线。', 2),
  (373, '连线验证', '将做好的连线图给伙伴，让他按照数字从1开始依次用直线连接各个点，看能否还原出图案。', 3),
  (373, '涂色美化', '连线完成后用彩色画笔给图案涂上漂亮的颜色，让作品更加生动。', 4),
  (373, '进阶挑战', '尝试制作更复杂的连线画，增加到50个甚至100个点，或者使用偶数序列（2、4、6……）来连线。', 5);

-- [353] 找找生活中的几何
UPDATE public.projects SET description = '带着"几何之眼"在家里和户外寻找各种几何图形，记录它们藏在哪里。你将惊喜地发现圆形、三角形、长方形无处不在，从窗户到车轮，从蜂巢到路标，几何就在身边。', difficulty_stars = 1 WHERE id = 353;
DELETE FROM public.project_steps WHERE project_id = 353;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (353, '室内寻宝', '在家中寻找各种几何图形：窗户是什么形状？钟面是什么形状？把找到的图形画在记录本上。', 1),
  (353, '户外探索', '到户外散步，观察建筑、路标、井盖、花朵中隐藏的几何图形，用手机拍照或速写记录。', 2),
  (353, '分类整理', '将找到的图形按类别整理：圆形、三角形、四边形、多边形等，统计每种图形出现的次数。', 3),
  (353, '制作几何图鉴', '选出最有趣的发现，配上图画和文字说明，制作一本属于自己的"生活几何图鉴"。', 4);

-- [354] 用积木搭几何体
UPDATE public.projects SET description = '用积木搭建正方体、长方体、三棱柱等基本几何体，从不同角度观察它们的形状。你通过动手搭建获得对立体图形的直觉认识，学会数面、棱和顶点的数量。', difficulty_stars = 1 WHERE id = 354;
DELETE FROM public.project_steps WHERE project_id = 354;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (354, '搭建基本体', '用积木搭出正方体和长方体，数一数它们各有几个面、几条棱、几个顶点。', 1),
  (354, '制作棱柱', '用橡皮泥做顶点、牙签做棱，搭出三棱柱和四棱柱的骨架模型，感受立体结构。', 2),
  (354, '多角度观察', '从正面、侧面和上方分别观察同一个几何体，画出每个角度看到的平面图形。', 3),
  (354, '搭建挑战', '尝试用积木搭出金字塔（四棱锥）形状，讨论它与长方体在面和棱上的不同之处。', 4),
  (354, '记录与比较', '把每种几何体的面数、棱数和顶点数记录在表格里，看看能否发现数量之间的规律。', 5);

-- [394] 图形推理游戏
UPDATE public.projects SET description = '通过观察图形的形状、颜色、大小和方向变化规律，推理出下一个图形是什么。这类非语言推理游戏能有效提升你的视觉逻辑能力和抽象思维水平。', difficulty_stars = 1 WHERE id = 394;
DELETE FROM public.project_steps WHERE project_id = 394;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (394, '单维度变化', '画出只有一个属性变化的图形序列，例如：小圆→中圆→大圆→?（大小变化），让你推理下一个。', 1),
  (394, '双维度变化', '同时改变两个属性，例如形状和颜色交替变化：红色三角→蓝色方形→红色圆形→?，增加推理难度。', 2),
  (394, '矩阵推理', '画一个3×3的九宫格，每行每列的图形都有规律变化，空出右下角让你推理应该填什么图形。', 3),
  (394, '自己出题', '你根据学到的规律模式，自己设计图形推理题目，锻炼逆向思维能力。', 4),
  (394, '生活中的图案', '观察生活中的重复图案（地砖、壁纸、织物花纹），找出其中的规律和对称性。', 5);

-- [351] 对称剪纸图案
UPDATE public.projects SET description = '将纸张对折后剪出图案，展开就能得到完美的对称图形。你在剪纸过程中直观感受对称轴的概念，发现折叠次数越多，展开后的对称图案越复杂美丽。', difficulty_stars = 1 WHERE id = 351;
DELETE FROM public.project_steps WHERE project_id = 351;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (351, '认识对称', '拿一张纸对折，沿折线剪出半个爱心，展开后观察得到完整爱心，理解对称轴的含义。', 1),
  (351, '单轴对称剪纸', '将纸对折一次，用铅笔画出半边图案（如蝴蝶、树叶），沿线剪下再展开，欣赏对称图形。', 2),
  (351, '多轴对称挑战', '将纸连续对折两次或三次后剪出图案，展开观察出现四重或八重对称的效果。', 3),
  (351, '创作窗花', '将正方形纸沿对角线和中线反复对折，剪出复杂镂空图案，展开后就是一幅漂亮的窗花。', 4),
  (351, '展示与标注', '将所有作品粘贴在白纸上，用彩笔画出每个图案的对称轴，标注对称轴数量，拍照记录你的作品集。', 5);

-- [392] 简易迷宫设计
UPDATE public.projects SET description = '自己动手在方格纸上设计一座迷宫，并邀请朋友来挑战。在设计过程中你将学会规划路径、设置死胡同和岔路口，培养逻辑规划和空间推理能力。', difficulty_stars = 1 WHERE id = 392;
DELETE FROM public.project_steps WHERE project_id = 392;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (392, '画出边界', '在方格纸上画出迷宫的外框，标记入口和出口的位置，入口和出口最好在对角线两端。', 1),
  (392, '设计正确路径', '先用铅笔轻轻画出从入口到出口的唯一正确路径，路线要曲折有趣。', 2),
  (392, '添加墙壁和岔路', '在正确路径周围画上墙壁，然后添加多条岔路和死胡同来迷惑走迷宫的人。', 3),
  (392, '测试与修改', '自己先走一遍迷宫，确保只有一条正确路径，难度适中不会太简单也不会无解。', 4),
  (392, '交换挑战', '把设计好的迷宫交给朋友或家人挑战，看谁能最快找到出路，然后互相交流设计心得。', 5);

-- [374] 测量身边的物品
UPDATE public.projects SET description = '用不同的工具测量家中各种物品的长度、重量和容积，建立对度量单位的直观认知。你将学会使用测量工具，感受厘米、克、毫升等单位在日常生活中的实际意义。', difficulty_stars = 1 WHERE id = 374;
DELETE FROM public.project_steps WHERE project_id = 374;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (374, '长度测量', '用直尺测量铅笔、手机、书本等物品的长度，记录在表格中，学会正确读数到毫米。', 1),
  (374, '重量测量', '用电子秤称量苹果、鸡蛋、玩具等物品的重量，感受100克、500克、1千克分别是多重。', 2),
  (374, '容积测量', '用量杯测量不同杯子、碗和瓶子能装多少水，理解毫升和升的关系。', 3),
  (374, '估测练习', '先凭感觉估计一个物品的尺寸或重量，再实际测量，看看估计值和实际值相差多少。', 4),
  (374, '制作测量报告', '将所有测量数据整理成图表，找出家中最长、最重、容积最大的物品，分享你的发现。', 5);

-- [356] 莫比乌斯带探索
UPDATE public.projects SET description = '用纸条扭转粘合制作神奇的莫比乌斯带，发现它只有一个面和一条边。你将通过剪切实验见证拓扑学的奇妙——沿中线剪开莫比乌斯带不会变成两条，而是变成一个更大的环。', difficulty_stars = 1 WHERE id = 356;
DELETE FROM public.project_steps WHERE project_id = 356;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (356, '制作普通纸环', '将一条纸条直接首尾粘合成一个普通圆环，用笔沿一面画线，发现需要翻面才能画满。', 1),
  (356, '制作莫比乌斯带', '将另一条纸条扭转半圈（180度）后首尾粘合，得到莫比乌斯带。', 2),
  (356, '画线实验', '用彩笔沿莫比乌斯带中线不停地画，惊讶地发现不用翻面就能画回起点——它只有一个面。', 3),
  (356, '沿中线剪开', '用剪刀沿中线将莫比乌斯带剪开，猜猜会怎样？结果不是两个环，而是一个更大的扭转环！', 4),
  (356, '沿三分线剪开', '再做一条莫比乌斯带，这次沿三分之一处剪开，观察得到两个套在一起的环。', 5),
  (356, '制作应用模型', '用长纸条制作一条莫比乌斯带形状的传送带模型，演示为什么莫比乌斯带传送带能让两面都被均匀磨损。', 6);

-- [395] 火柴棍谜题
UPDATE public.projects SET description = '用火柴棍摆出算式或图形，通过移动指定数量的火柴来改变结果或变换图形。这类经典谜题需要灵活的思维和打破常规的创造力，是训练逻辑思维的绝佳方式。', difficulty_stars = 1 WHERE id = 395;
DELETE FROM public.project_steps WHERE project_id = 395;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (395, '算式变换入门', '用火柴棍摆出"6+4=4"，要求只移动一根火柴使等式成立（将6变成0，得到0+4=4）。', 1),
  (395, '图形变换', '用火柴摆出4个正方形组成的田字格，要求移动3根火柴使其变成3个正方形，锻炼空间思维。', 2),
  (395, '增减挑战', '用火柴摆出一个由6根火柴组成的三角形，要求再加3根火柴变成4个小三角形。', 3),
  (395, '自己设计谜题', '尝试自己用火柴创造新的变换谜题，先摆出初始状态，再想出变换规则和目标状态。', 4),
  (395, '记录解题策略', '在笔记本上画出今天解过的每道火柴谜题的初始状态和解法，标注用了哪种策略（逆向推理、逐一尝试、分类讨论）。', 5);

-- [355] 正多面体纸模型
UPDATE public.projects SET description = '制作五种正多面体（柏拉图立体）的纸模型，从正四面体到正二十面体。你将在折叠粘贴中认识展开图与立体图形的关系，理解为什么宇宙中只存在五种正多面体。', difficulty_stars = 2 WHERE id = 355;
DELETE FROM public.project_steps WHERE project_id = 355;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (355, '绘制展开图', '在卡纸上用直尺和圆规绘制正四面体的展开图——由四个等边三角形组成，并画出折叠线。', 1),
  (355, '裁剪与折叠', '沿轮廓剪下展开图，沿折叠线折起每个面，用胶水粘合成正四面体。', 2),
  (355, '制作更多面体', '用同样方法依次制作正六面体（正方体）、正八面体、正十二面体和正二十面体。', 3),
  (355, '观察与统计', '数出每种正多面体的面数、棱数和顶点数，填入统计表格中。', 4),
  (355, '发现规律', '计算每种多面体的"顶点数 - 棱数 + 面数"，惊喜地发现结果都等于2，这就是欧拉公式。', 5);

-- [378] 数字黑洞 6174
UPDATE public.projects SET description = '探索神秘的卡普雷卡尔常数6174——任何四位数经过特定运算后都会被"吸入"这个数字黑洞。你将在反复计算中发现令人惊叹的数学规律，感受数字的魔力。', difficulty_stars = 2 WHERE id = 378;
DELETE FROM public.project_steps WHERE project_id = 378;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (378, '选择数字', '任意选择一个四位数（四个数字不能全部相同），例如选择3812。', 1),
  (378, '排列与相减', '将这四个数字从大到小排列得到最大数8321，从小到大排列得到最小数1238，用大数减小数：8321-1238=7083。', 2),
  (378, '重复操作', '对结果7083继续执行同样的操作：8730-0378=8352，再继续：8532-2358=6174。', 3),
  (378, '验证黑洞', '对6174执行操作：7641-1467=6174，数字不再变化，这就是"数字黑洞"！', 4),
  (378, '批量测试', '换不同的四位数重复实验，记录每个数到达6174所需的步骤数，发现最多只需要7步。', 5),
  (378, '拓展探索', '用三位数重复同样的操作（如选521：521→352→？），记录每步结果，验证三位数的数字黑洞是495。', 6);

-- [377] 速算比赛卡片
UPDATE public.projects SET description = '制作一套速算卡片进行限时数学运算比赛，看谁算得又快又准。你将在紧张有趣的竞赛氛围中提升四则运算的速度和准确率。', difficulty_stars = 2 WHERE id = 377;
DELETE FROM public.project_steps WHERE project_id = 377;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (377, '制作题卡', '在卡片正面写上算术题（如 7+8、15-6、4×3），背面写上正确答案，制作至少40张题卡。', 1),
  (377, '分级设计', '将题卡分为三个难度等级：绿色为简单加减法，黄色为两位数运算，红色为乘除法混合运算。', 2),
  (377, '限时挑战', '设定1分钟计时，翻出题卡快速口答，答对放一堆、答错放另一堆，最后统计正确数量。', 3),
  (377, '双人对战', '两人面对面，同时看到一张题卡，先说出正确答案的人赢得这张卡片，最终卡片多的人获胜。', 4),
  (377, '进步追踪', '记录每次一分钟内答对的题目数量，制作折线图追踪自己的进步情况。', 5);

-- [376] 数字华容道
UPDATE public.projects SET description = '制作一个可以滑动数字方块的华容道游戏，通过策略性移动将打乱的数字恢复顺序。你将在解谜过程中锻炼空间推理能力和策略规划思维。', difficulty_stars = 2 WHERE id = 376;
DELETE FROM public.project_steps WHERE project_id = 376;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (376, '制作底盘', '用硬纸板裁出一个正方形底盘，划分为4×4共16个等大的格子，边缘做出挡边防止方块滑出。', 1),
  (376, '制作方块', '裁出15个正方形小方块，大小略小于格子以便滑动，分别写上数字1到15并涂上颜色。', 2),
  (376, '熟悉规则', '将数字方块按顺序放入格子中，留一个空格。通过滑动相邻方块到空格位置来移动方块，动手试玩几次熟悉操作。', 3),
  (376, '打乱与还原', '先将方块随机打乱，然后尝试通过滑动操作将所有数字恢复成从左到右、从上到下的顺序。', 4),
  (376, '记录步数', '计算还原所用的步数，多次练习后尝试用更少的步数完成，与朋友比赛谁用的步数最少。', 5),
  (376, '策略总结', '尝试先还原第一行，再还原第一列，逐步缩小问题规模。思考为什么有些排列无法还原，把你的策略写在纸上。', 6);

-- [396] 逻辑推理破案
UPDATE public.projects SET description = '化身小侦探，通过一系列线索和条件用排除法推理出真相。你将从多条信息中提取关键线索，通过逻辑排除缩小范围，最终找到唯一的正确答案。', difficulty_stars = 2 WHERE id = 396;
DELETE FROM public.project_steps WHERE project_id = 396;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (396, '阅读案件', '仔细阅读谜题描述，例如："三个人分别喜欢不同的水果和颜色，根据线索找出每人的喜好"。', 1),
  (396, '整理线索', '将所有条件逐条列出，用推理表格（行列分别是人物和属性）把确定的信息先填上。', 2),
  (396, '排除推理', '根据"如果A不是…那么A就是…"的逻辑，在表格中逐步排除不可能的选项，用×标记排除项。', 3),
  (396, '验证答案', '当所有空格都填满后，回头检查每条线索是否都满足，确保推理过程没有矛盾。', 4),
  (396, '自己编案件', '尝试自己编写一个逻辑推理小故事，设计好答案后反向给出线索，让朋友来破案。', 5);

-- [397] 数字谜题（算式谜）
UPDATE public.projects SET description = '在竖式计算中，某些数字被字母或星号替换，通过推理还原出每个位置的真实数字。这类算式谜需要综合运用进位规则和逻辑推理，是锻炼数学思维的经典练习。', difficulty_stars = 2 WHERE id = 397;
DELETE FROM public.project_steps WHERE project_id = 397;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (397, '认识算式谜', '了解规则：竖式中每个字母代表一个0-9的数字，相同字母代表相同数字，不同字母代表不同数字，在纸上画出或写下关键信息。', 1),
  (397, '从简单开始', '先解一位数加法谜：A+B=C（无进位），列出所有可能组合，找到满足条件的解。', 2),
  (397, '进位推理', '挑战带进位的加法谜，例如 AB+CD=EFG（三位数结果意味着最高位一定进位为1），利用进位条件缩小范围。', 3),
  (397, '经典挑战', '尝试经典算式谜 SEND+MORE=MONEY，从M=1入手逐步推理每个字母代表的数字。', 4),
  (397, '创造自己的算式谜', '先写一个正常的竖式计算，然后把某些数字替换成字母，测试谜题是否有唯一解。', 5);

-- [398] 路线规划游戏
UPDATE public.projects SET description = '在地图上规划从起点到终点的最佳路线，考虑距离、时间和经过的地点。你将体验路径优化思想，理解"最短路径"和"最优路径"可能并不相同。', difficulty_stars = 2 WHERE id = 398;
DELETE FROM public.project_steps WHERE project_id = 398;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (398, '绘制地图', '在纸上画出一个小镇地图，包含学校、公园、超市、图书馆等6-8个地点，用线段连接相邻地点并标注距离。', 1),
  (398, '简单路径', '找出从学校到公园的所有可能路线，比较总距离，找到最短路径。', 2),
  (398, '多点巡游', '规划一条经过所有地点且总距离最短的路线（类似旅行商问题的简化版），比较不同方案的总距离。', 3),
  (398, '加入限制条件', '增加约束：某条路正在维修不能走、必须先去超市再去公园等，看如何重新规划最优路线。', 4),
  (398, '总结记录', '在笔记本上写下你的发现和思考：为什么有时看起来绕远的路反而更快（考虑拥堵等因素），理解现实中导航软件的基本工作思路。', 5);

-- [375] 概率实验：硬币与骰子
UPDATE public.projects SET description = '通过大量抛硬币和掷骰子实验，记录结果并统计频率，亲身验证概率理论。你将用数据说话，理解"大数定律"——实验次数越多，结果越接近理论概率。', difficulty_stars = 2 WHERE id = 375;
DELETE FROM public.project_steps WHERE project_id = 375;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (375, '硬币实验', '抛掷一枚硬币50次，每次记录正面或反面，统计各出现了多少次，计算频率。', 1),
  (375, '增加次数', '将实验扩大到100次和200次，观察正面出现的频率是否越来越接近50%。', 2),
  (375, '骰子实验', '掷一颗骰子60次，记录每个点数出现的次数，画成柱状图进行对比。', 3),
  (375, '双骰实验', '同时掷两颗骰子50次，记录点数之和，统计哪个和出现次数最多。', 4),
  (375, '数据分析', '用柱状图展示所有实验结果，讨论为什么两颗骰子之和为7最容易出现（有6种组合），理解概率的计算方法。', 5);

-- [358] 坐标画图
UPDATE public.projects SET description = '在坐标纸上按照坐标点依次连线，画出隐藏的有趣图案。你将熟悉坐标系的使用方法，用数字对（x, y）精确定位平面上的点。', difficulty_stars = 2 WHERE id = 358;
DELETE FROM public.project_steps WHERE project_id = 358;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (358, '建立坐标系', '在方格纸上画出横轴（x轴）和纵轴（y轴），标上刻度数字，标明原点O。', 1),
  (358, '练习描点', '根据给出的坐标如（3,5）、（-2,4）等在坐标系中找到对应位置并标上点。', 2),
  (358, '连线画图', '按照一组预设坐标点依次描点并连线，完成后发现线条组成了一个有趣的图案，如星星或动物轮廓。', 3),
  (358, '自主创作', '自己设计一个简单图案，测量关键顶点的坐标写成坐标列表，让家人按你的坐标来画。', 4),
  (358, '图形变换', '将所有坐标的x值加上一个数再画图，观察图案整体右移；将y值都乘以-1，发现图案上下翻转。', 5);

-- [357] 图形镶嵌
UPDATE public.projects SET description = '用相同或不同的几何图形密铺平面，不留间隙也不重叠，创造出美丽的镶嵌图案。你将动手探索哪些正多边形可以铺满平面，理解角度之和等于360度的镶嵌条件。', difficulty_stars = 2 WHERE id = 357;
DELETE FROM public.project_steps WHERE project_id = 357;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (357, '制作图形模板', '在卡纸上画出等边三角形、正方形和正六边形的模板，每种剪出多个大小一致的图形。', 1),
  (357, '正方形镶嵌', '用正方形拼铺大张白纸，发现四个直角正好凑成360度，可以完美铺满平面。', 2),
  (357, '三角形和六边形', '分别用等边三角形和正六边形进行镶嵌实验，验证它们也能无缝铺满平面。', 3),
  (357, '混合镶嵌', '尝试将不同形状的图形混合使用进行镶嵌，比如正方形与三角形的组合铺设。', 4),
  (357, '角度分析', '量出每种正多边形的内角度数，计算顶点处角度之和，理解只有和为360度才能镶嵌。', 5);

-- [379] 斐波那契数列寻宝
UPDATE public.projects SET description = '在自然界中寻找斐波那契数列的踪迹，发现花瓣、松果、贝壳中隐藏的数学密码。你将认识这个著名数列的规律，惊叹于数学与自然界的奇妙联系。', difficulty_stars = 3 WHERE id = 379;
DELETE FROM public.project_steps WHERE project_id = 379;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (379, '认识数列', '学习斐波那契数列的规则：1, 1, 2, 3, 5, 8, 13, 21……每个数等于前两个数的和，自己推算前20项，在纸上画出或写下关键信息。', 1),
  (379, '花瓣计数', '到花园或公园中数不同花朵的花瓣数量，你会发现大部分花的花瓣数恰好是斐波那契数：百合3瓣、梅花5瓣、雏菊13或21瓣。', 2),
  (379, '螺旋观察', '仔细观察松果和向日葵花盘上的螺旋纹理，分别数顺时针和逆时针方向的螺旋数，它们通常是相邻的斐波那契数。', 3),
  (379, '绘制黄金螺旋', '在方格纸上画出斐波那契正方形序列（1×1、1×1、2×2、3×3、5×5……），在每个正方形中画四分之一圆弧连接成螺旋线。', 4),
  (379, '制作发现卡片', '把你在自然界中找到的斐波那契数实例画在卡片上，每张卡片一个发现，配上简单说明。', 5);

-- [380] 密码学入门：凯撒密码
UPDATE public.projects SET description = '学习古罗马凯撒大帝使用的加密方法，用字母偏移制作密码和破解密码。你将体验密码学的基本思想，理解加密和解密的数学原理。', difficulty_stars = 3 WHERE id = 380;
DELETE FROM public.project_steps WHERE project_id = 380;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (380, '理解加密原理', '凯撒密码的核心思想：将每个字母按固定位数向后偏移。例如偏移3位时，A变成D，B变成E，Z变成C。在纸上写出完整的偏移对照表。', 1),
  (380, '制作密码盘', '用硬纸板剪出一大一小两个圆盘，边缘分别写上26个字母或拼音，用图钉在圆心固定，旋转小盘即可设定偏移量。', 2),
  (380, '加密信息', '选择一段文字和一个偏移量，使用密码盘将明文逐字转换为密文，写一封加密信给朋友。', 3),
  (380, '解密挑战', '收到朋友的密文后，尝试用不同偏移量逐个测试，或者统计字母频率来破解密码。', 4),
  (380, '拓展思考', '在笔记本上记录你的思考：凯撒密码的弱点——只有25种可能的偏移量，用暴力穷举就能破解。现代密码如何解决这个问题？', 5);

-- [401] 汉诺塔手工挑战
UPDATE public.projects SET description = '亲手制作汉诺塔道具并挑战用最少步骤完成移动，体验这个经典的递归思维问题。你将感受到递归策略的精妙，发现移动次数与层数之间的数学规律。', difficulty_stars = 3 WHERE id = 401;
DELETE FROM public.project_steps WHERE project_id = 401;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (401, '制作汉诺塔', '在底座上固定三根柱子，将从大到小的圆片按顺序套在第一根柱子上，最大的在最下面。', 1),
  (401, '熟悉规则', '每次只能移动一个圆片，大圆片不能放在小圆片上面，目标是把所有圆片从第一根柱子移到第三根。先用2个圆片试玩。', 2),
  (401, '从少到多', '先用2个圆片练习（3步完成），再用3个（7步），逐步增加到4个、5个，记录每次的步数。', 3),
  (401, '发现规律', '观察步数序列：1, 3, 7, 15, 31...发现n个圆片需要2^n-1步，每增加一个圆片步数翻倍再加1。', 4),
  (401, '理解递归思想', '在笔记本上记录你的思考：解题策略：要移动n个圆片，先把上面n-1个移到中间柱，再把最大的移到目标柱，最后把n-1个移回来——这就是递归，用自己的话在纸上写下理解。', 5);

-- [402] 七桥问题探索
UPDATE public.projects SET description = '重现数学史上著名的柯尼斯堡七桥问题，探索能否一次走过所有桥且每座桥只经过一次。你将接触图论的基本概念，理解欧拉如何用数学证明了这个问题的不可能性。', difficulty_stars = 3 WHERE id = 402;
DELETE FROM public.project_steps WHERE project_id = 402;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (402, '画出七桥问题地图', '在纸上画出柯尼斯堡的地图：一条河流中有两个小岛，七座桥连接着岛屿和两岸，尝试找到一条能走遍所有桥的路线。', 1),
  (402, '动手实验', '用纸板制作简易地图模型，用小人偶在上面反复尝试不同的行走路线，记录每次的结果。', 2),
  (402, '抽象为图', '学习欧拉的方法：把每块陆地看作一个点，每座桥看作一条线，将地图简化为由点和线组成的图。', 3),
  (402, '数奇偶点', '数每个点连接的线数（度数），发现四个点全部是奇数度——欧拉证明了只有0或2个奇数度点时才能一笔画。', 4),
  (402, '拓展挑战', '自己画不同的图形（如五角星、房子形），数每个点的度数判断能否一笔画完成，验证欧拉定理。', 5);

-- [399] 数独进阶技巧
UPDATE public.projects SET description = '从基本的数独规则出发，学习和掌握唯余法、排除法、区块排除等进阶解题技巧。你将提升逻辑推理的严密性，体验用策略攻克难题的成就感。', difficulty_stars = 3 WHERE id = 399;
DELETE FROM public.project_steps WHERE project_id = 399;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (399, '回顾并练习基本规则', '回顾数独的三条核心规则：每行、每列、每个3×3宫格内，1-9各出现且仅出现一次，用一道简单题目验证你的理解。', 1),
  (399, '唯余法训练', '在每个空格中标注所有可能的候选数字，当某格只剩一个候选数时，该数即为答案。', 2),
  (399, '排除法进阶', '在某行/列/宫中，如果某个数字只可能出现在一个位置，那么这个位置就填这个数字，即使还有其他候选数。', 3),
  (399, '区块排除法', '当某宫内的某个数字只可能出现在同一行（或列）时，可以排除该行（或列）其他宫格中的这个候选数。', 4),
  (399, '实战计时挑战', '选一道中等难度数独，用学到的技巧限时完成，记录用时并尝试不断刷新最佳成绩。', 5),
  (399, '总结记录', '在笔记本上写下你的发现和思考：回顾解题过程中哪种技巧用得最多、哪里卡住了以及如何突破，属于自己的解题策略。', 6);

-- [382] 数独策略研究
UPDATE public.projects SET description = '系统学习数独的解题策略，从简单排除法到高级技巧逐步进阶。你将大幅提升逻辑推理能力和系统化思维水平。', difficulty_stars = 3 WHERE id = 382;
DELETE FROM public.project_steps WHERE project_id = 382;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (382, '熟悉基础规则', '理解数独规则：在9×9的格子中填入1-9，使每行、每列和每个3×3宫格内的数字都不重复，用一道简单题目验证。', 1),
  (382, '掌握排除法', '从已知数字最多的行、列或宫格入手，排除已出现的数字，找出唯一可能的答案。', 2),
  (382, '学习候选数法', '在空格中用小字标注所有可能的候选数字，随着解题推进逐步排除候选数。', 3),
  (382, '进阶技巧', '学习"唯余法"（一个数字在某行列宫中只有一个可填位置）和"数对法"（两个格子只能填相同两个数）。', 4),
  (382, '限时挑战', '用计时器记录解题时间，从简单题开始逐步挑战高难度数独，追踪解题速度的提升。', 5),
  (382, '自创数独', '尝试自己设计一道数独题目：先填好完整解答，再有策略地挖去一些数字，确保解唯一。', 6);

-- [400] 逻辑电路与门
UPDATE public.projects SET description = '用简单的开关和灯泡理解与门、或门、非门的工作原理，亲手搭建基本逻辑电路。你将认识计算机最底层的"思考方式"——用0和1进行逻辑运算，感受数字世界的奥秘。', difficulty_stars = 3 WHERE id = 400;
DELETE FROM public.project_steps WHERE project_id = 400;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (400, '认识逻辑门', '在纸上画出与门（AND）、或门（OR）、非门（NOT）的符号和真值表，理解每种门的输入输出关系。', 1),
  (400, '搭建与门电路', '将两个开关串联连接灯泡和电池，测试只有两个开关都打开时灯泡才亮——这就是与门。', 2),
  (400, '搭建或门电路', '将两个开关并联连接灯泡和电池，测试任何一个开关打开灯泡就亮——这就是或门。', 3),
  (400, '填写真值表', '分别在两个开关的四种组合状态（开开、开关、关开、关关）下观察灯泡状态，填写真值表验证。', 4),
  (400, '组合电路挑战', '用三个开关组合搭建"(A AND B) OR C"的电路，预测并验证灯泡在不同开关组合下的亮灭情况。', 5);

-- [381] 幻方填数
UPDATE public.projects SET description = '在方格中填入数字使每行、每列和对角线的数字之和都相等，探索幻方的神奇规律。你将锻炼逻辑推理能力，感受古老数学谜题的魅力。', difficulty_stars = 3 WHERE id = 381;
DELETE FROM public.project_steps WHERE project_id = 381;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (381, '认识幻方', '了解幻方的定义：在n×n方格中填入连续自然数，使每行、每列和两条对角线的和都相等。这个和叫做"幻和"，在纸上画出或写下关键信息。', 1),
  (381, '计算幻和', '学习计算幻和的公式：三阶幻方用1-9，总和45÷3=15，所以每行每列之和都是15。', 2),
  (381, '填写三阶幻方', '用数字卡片在3×3方格中反复尝试，找到所有满足条件的填法。提示：5一定在中间。', 3),
  (381, '学习构造法', '学习"阶梯法"构造奇数阶幻方：从顶部中间开始，沿右上方向依次填数，遇到边界则绕到对面继续，在纸上练习几个例子。', 4),
  (381, '挑战四阶', '尝试构造4×4的四阶幻方，用1-16填入，幻和为34，难度大幅提升但也更有成就感。', 5);

-- [359] 黄金比例寻找
UPDATE public.projects SET description = '在自然界、艺术品和人体中寻找神秘的黄金比例（约1:1.618）。你将使用测量工具发现这一隐藏在万物中的数学密码，感受数学与美的深刻联系。', difficulty_stars = 3 WHERE id = 359;
DELETE FROM public.project_steps WHERE project_id = 359;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (359, '认识黄金比例', '了解黄金比例的定义：将一条线段分成两部分，长段与短段之比等于全长与长段之比，约为1.618，在纸上画出或写下关键信息。', 1),
  (359, '测量身体比例', '测量从肚脐到脚底的长度和身高，计算比值；测量手指各节长度的比值，看是否接近黄金比例。', 2),
  (359, '寻找自然中的黄金', '观察向日葵种子排列、松果鳞片螺旋、鹦鹉螺壳的曲线，了解斐波那契数列与黄金比例的关系。', 3),
  (359, '艺术中的黄金', '在名画和古建筑照片中测量关键比例，发现许多经典作品暗含黄金矩形的构图。', 4),
  (359, '绘制黄金螺旋', '用直尺和圆规按照斐波那契数列画出一系列正方形，在每个正方形中画四分之一圆弧，连成优美的黄金螺旋。', 5);

-- [361] 圆周率测量实验
UPDATE public.projects SET description = '通过测量各种圆形物品的周长和直径来亲手"发现"圆周率π。你将通过实验方法逼近π的值，体会测量、记录、取平均值的科学方法。', difficulty_stars = 3 WHERE id = 361;
DELETE FROM public.project_steps WHERE project_id = 361;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (361, '选取圆形物品', '收集五个以上大小不同的圆形物品，如杯口、盘子、硬币、瓶盖等。', 1),
  (361, '测量周长', '用软尺绕圆形物品一圈测量周长，或者用线绳绕一圈后再测线绳长度，每个物品测量三次取平均。', 2),
  (361, '测量直径', '用直尺测量每个物品的直径，注意尺子要通过圆心，同样每个测三次取平均。', 3),
  (361, '计算比值', '将每个物品的周长除以直径，把结果记录在表格中，观察这些比值有什么共同特点。', 4),
  (361, '发现π', '所有比值都接近3.14！这就是圆周率π，取所有测量结果的平均值与3.14159比较，讨论误差来源。', 5);

-- [362] 几何光学作图
UPDATE public.projects SET description = '用直尺和量角器画出光的反射和折射光路图，用几何方法预测光线走向。你将运用角度知识理解入射角等于反射角的规律，用作图方法解决光路问题。', difficulty_stars = 3 WHERE id = 362;
DELETE FROM public.project_steps WHERE project_id = 362;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (362, '画反射光路', '在纸上画一条直线代表镜面，画出法线（垂直于镜面），用量角器画入射光线，再画出入射角等于反射角的反射光线。', 1),
  (362, '实验验证', '将小镜子立在纸上的镜面线位置，用手电筒沿画好的入射光线照射，观察反射光是否沿预测方向。', 2),
  (362, '多次反射', '画两面相对的镜子，用作图法画出光线在两面镜子之间来回反射的完整路径。', 3),
  (362, '折射作图', '在纸上画水面分界线，学习用几何方法画出光从空气进入水中时的折射弯曲路径。', 4),
  (362, '挑战题目', '画一间有两面镜子的房间，找出从灯泡出发经过两次反射照到指定点的光路。', 5);

-- [360] 分形图案绘制
UPDATE public.projects SET description = '手绘谢尔宾斯基三角形和科赫雪花等经典分形图案，观察"自相似"的奇妙结构。你将发现局部放大后和整体形状一样的神奇现象，初步接触无穷和递归的数学思想。', difficulty_stars = 3 WHERE id = 360;
DELETE FROM public.project_steps WHERE project_id = 360;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (360, '画谢尔宾斯基三角形', '先画一个大等边三角形，取三边中点连线形成内部小三角形并涂黑挖去，对剩余的三个三角形重复操作。', 1),
  (360, '迭代加深', '对每个小三角形继续执行相同的中点连线和挖去操作，重复三到四次，图案越来越精细。', 2),
  (360, '画科赫雪花', '从一个等边三角形开始，将每条边三等分，在中间一段向外搭建更小的等边三角形，重复三次。', 3),
  (360, '观察自相似性', '用手或放大镜局部观察分形图案，发现不论放大哪个局部，形状都与整体相似。', 4),
  (360, '分形在自然中', '在笔记本上记录你的思考：自然界中的分形现象：树枝分叉、花椰菜表面、海岸线轮廓、雪花形状等。', 5);

-- [404] 逻辑悖论探索
UPDATE public.projects SET description = '认识和讨论经典的逻辑悖论，如说谎者悖论、理发师悖论等，感受逻辑推理的奇妙边界。你将在思维碰撞中体会到逻辑的精妙与局限，激发对哲学和数学基础的好奇心。', difficulty_stars = 3 WHERE id = 404;
DELETE FROM public.project_steps WHERE project_id = 404;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (404, '说谎者悖论', '思考这句话："我说的这句话是假的"——如果它是真的，那它就是假的；如果它是假的，那它就是真的。讨论为什么会产生矛盾。', 1),
  (404, '理发师悖论', '一个小镇的理发师声称"只给不自己理发的人理发"——那他该不该给自己理发？用画图的方式分析两种情况都会矛盾。', 2),
  (404, '鳄鱼悖论', '鳄鱼抓走了孩子对妈妈说"猜猜我会不会还你孩子，猜对了就还"——如果妈妈说"你不会还"，鳄鱼会怎样？讨论这个两难困境。', 3),
  (404, '寻找生活中的悖论', '想想生活中类似的矛盾情境：例如"别听任何人的建议"本身就是一条建议，收集并记录这些有趣的例子。', 4),
  (404, '总结记录', '在笔记本上写下你的发现和思考：悖论产生的原因（自我指涉、无限循环等），了解数学家和哲学家们如何看待和处理这些问题。', 5);

-- [365] 曲面几何体纸模
UPDATE public.projects SET description = '用纸条和卡纸制作圆柱、圆锥和球面近似模型，探索曲面如何从平面"变身"而来。你将理解展开图的概念，发现圆柱的侧面展开是长方形，圆锥的侧面展开是扇形。', difficulty_stars = 4 WHERE id = 365;
DELETE FROM public.project_steps WHERE project_id = 365;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (365, '制作圆柱', '画一个长方形和两个等大的圆形，将长方形卷成筒状粘合，两端盖上圆形，长方形的长要等于圆的周长。', 1),
  (365, '制作圆锥', '用圆规画一个扇形，卷成锥形粘合，底部加上合适大小的圆形底面。', 2),
  (365, '近似球面', '将多条纸带交叉编织或用经纬线法制作一个近似球面，感受球面不能完全展开为平面。', 3),
  (365, '测量与计算', '测量制作好的圆柱和圆锥的尺寸，用公式计算侧面积和体积，与实际测量对比。', 4),
  (365, '展开图对比', '将圆柱和圆锥小心拆开铺平，观察展开图的形状，讨论为什么球面无法像它们一样展开。', 5);

-- [386] 加密与解密挑战
UPDATE public.projects SET description = '学习多种密码编码方法，设计自己的加密系统并挑战朋友来破解。你将了解密码学中的数学原理，体验信息安全的核心思想。', difficulty_stars = 4 WHERE id = 386;
DELETE FROM public.project_steps WHERE project_id = 386;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (386, '字母替换密码', '设计一套字母替换规则（如A=M, B=N……），用替换表将一段明文加密成密文。', 1),
  (386, '栅栏密码', '学习栅栏密码：将明文字母交替写在两行或三行上，再按行连接成密文。例如HELLO变成HLO和EL，密文为HLOEL。', 2),
  (386, '数字编码', '设计一种数字编码方案，比如用数字坐标表示字母在方格中的位置（波利比奥斯方阵）。', 3),
  (386, '综合加密', '将多种方法组合使用：先替换再栅栏，或先编码再偏移，创造出更难破解的复合密码。', 4),
  (386, '破解挑战', '与朋友互相交换密文，尝试在不知道密钥的情况下通过分析字母频率和规律来破解对方的密码。', 5),
  (386, '总结记录', '在笔记本上写下你的发现和思考：现代加密技术（如密码锁、网上银行）是如何保护我们的信息安全的。', 6);

-- [406] 约瑟夫环问题
UPDATE public.projects SET description = '通过模拟约瑟夫环的报数淘汰游戏，探索循环计数中的数学规律。你将亲手实验并记录数据，发现最后幸存者位置与总人数之间的神奇数学关系。', difficulty_stars = 3 WHERE id = 406;
DELETE FROM public.project_steps WHERE project_id = 406;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (406, '模拟故事场景', '讲述约瑟夫的故事：一群人围成圆圈，从第一个人开始报数，每报到3的人出列，问最后剩下的人在什么位置。', 1),
  (406, '小规模模拟', '先用5个棋子围成圈编号1-5，模拟每数到3淘汰一人的过程，记录淘汰顺序和最后幸存者编号。', 2),
  (406, '扩大实验', '分别用6人、7人、8人、9人、10人重复实验，把每次的幸存者编号记录在表格中。', 3),
  (406, '寻找规律', '观察幸存者编号随总人数变化的模式，尝试发现其中的数学规律或递推关系。', 4),
  (406, '改变报数值', '把"报到3淘汰"改成"报到2淘汰"，重新实验观察幸存者位置的变化，发现与2的幂次相关的规律。', 5),
  (406, '编程延伸', '在笔记本上记录你的思考：如何用编程来模拟更大规模的约瑟夫环问题，了解递推公式 J(n)=(J(n-1)+k) mod n 的含义。', 6);

-- [403] 流程图设计
UPDATE public.projects SET description = '学习用流程图的方式描述日常生活中的决策过程和操作步骤，培养编程思维。你将掌握顺序、分支和循环三种基本结构，为未来学习编程打下坚实的逻辑基础。', difficulty_stars = 3 WHERE id = 403;
DELETE FROM public.project_steps WHERE project_id = 403;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (403, '认识流程图符号', '学习基本符号：椭圆（开始/结束）、矩形（处理步骤）、菱形（判断/分支）、箭头（流向），在纸上练习画每种符号。', 1),
  (403, '画第一个流程图', '将"早上起床到出门上学"的过程画成流程图，包含起床、洗漱、吃早餐、检查书包、出门等步骤。', 2),
  (403, '加入分支判断', '在流程中加入判断节点，例如"今天下雨吗？"→是→带雨伞，否→不带，体会分支结构。', 3),
  (403, '设计循环结构', '画一个"背单词"的流程图：背一个单词→测试→没记住→再背一次（循环），记住了→下一个单词。', 4),
  (403, '综合挑战', '为"去超市买东西"设计完整流程图，包含列购物清单、选商品、比价、结账等环节，综合运用三种结构。', 5),
  (403, '互相测试', '把流程图交给朋友，让他按流程图一步步执行，看是否能顺利完成任务，找出流程图中的漏洞并修正。', 6);

-- [383] 蒙提霍尔问题实验
UPDATE public.projects SET description = '用卡片模拟著名的"三门问题"，通过大量实验验证换门策略是否真的能提高中奖概率。你将亲身体验概率中的反直觉现象，学会用数据而非直觉做判断。', difficulty_stars = 3 WHERE id = 383;
DELETE FROM public.project_steps WHERE project_id = 383;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (383, '认识问题', '学习蒙提霍尔问题：三扇门后有一辆汽车和两只山羊，选一扇门后主持人打开一扇有山羊的门，此时你应该换门还是不换？', 1),
  (383, '直觉猜测', '先凭直觉猜测"换"和"不换"哪个胜率更高，大部分人会认为概率一样都是50%。', 2),
  (383, '模拟实验', '一人扮演主持人在杯子下放卡片，另一人选择和决定是否换。做50次"始终不换"和50次"始终换"的实验。', 3),
  (383, '统计结果', '计算两种策略各自的中奖次数和比率，你会发现"换门"赢的概率接近2/3，而"不换"只有1/3。', 4),
  (383, '理解原理', '用树状图分析：最初选中大奖的概率是1/3，选错的概率是2/3；如果选错了，换门必中，所以换门的赢面是2/3。', 5);

-- [405] 博弈树分析
UPDATE public.projects SET description = '用树状图分析简单的二人博弈游戏（如取石子、井字棋），找出必胜策略。你将系统地列举所有可能情况，用逆推法从结果反推出最优决策。', difficulty_stars = 4 WHERE id = 405;
DELETE FROM public.project_steps WHERE project_id = 405;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (405, '学习取石子游戏', '桌上放7颗石子，两人轮流取，每次可取1或2颗，取到最后一颗的人输。先玩几局感受规律，在纸上练习几个例子。', 1),
  (405, '画博弈树', '从7颗石子开始，画出每种取法对应的分支，一直展开到有人取到最后一颗为止，形成完整的树状图。', 2),
  (405, '标记胜负', '在博弈树的每个终点标注谁赢谁输（用不同颜色），然后从终点往回推——每一步选择对自己最有利的分支。', 3),
  (405, '找出必胜策略', '通过逆推发现先手应该取几颗才能保证必胜，理解控制"关键数"的策略思想。', 4),
  (405, '拓展到井字棋', '尝试画井字棋前两步的博弈树（完整树太大），讨论为什么先手占中心最有利。', 5),
  (405, '策略总结', '在笔记本上记录博弈分析的方法：穷举所有可能→标记结果→逆推最优选择，写下这种思维方式在生活决策中的应用例子。', 6);

-- [385] 最短路径游戏
UPDATE public.projects SET description = '在自制地图上寻找从起点到终点的最短路径，初步体验图论中的路径问题。你将用数学思维解决"走哪条路最近"的日常问题，锻炼空间分析能力。', difficulty_stars = 4 WHERE id = 385;
DELETE FROM public.project_steps WHERE project_id = 385;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (385, '绘制地图', '在纸上画出8-10个地点（用圆圈表示），用线段连接有通路的地点，在每条线段上标注距离数值。', 1),
  (385, '穷举尝试', '选定起点和终点，尝试找出所有可能的路径，计算每条路径的总距离，找出最短的那条。', 2),
  (385, '学习贪心法', '学习贪心策略：每一步都走当前最短的边。发现贪心法虽然简单但不一定能找到全局最优解，在纸上练习几个例子。', 3),
  (385, '学习迪杰斯特拉', '用简化版的迪杰斯特拉算法：从起点出发，每次标记距离最近的未访问节点，更新其邻居的最短距离。', 4),
  (385, '实战对比', '用贪心法和迪杰斯特拉算法分别求解同一张地图，比较两种方法的结果差异。', 5),
  (385, '生活应用', '在笔记本上记录你的思考：导航软件如何为我们规划最短路线，理解图论在现代交通和物流中的重要应用。', 6);

-- [366] 正多面体对偶关系
UPDATE public.projects SET description = '探索正多面体之间的对偶关系：正方体和正八面体互为对偶，正十二面体和正二十面体互为对偶。你将在每个正多面体的面中心连线，发现藏在里面的另一个正多面体。', difficulty_stars = 4 WHERE id = 366;
DELETE FROM public.project_steps WHERE project_id = 366;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (366, '制作正方体', '用卡纸或铁丝制作一个正方体骨架模型，标记出每个面的中心点。', 1),
  (366, '连接面心', '用彩色线将正方体六个面的中心点相互连接，观察这些线围成的形状——竟然是一个正八面体。', 2),
  (366, '反向验证', '再制作一个正八面体，连接八个面的中心点，验证得到的是正方体，证明它们互为对偶。', 3),
  (366, '探索更多对偶', '制作正十二面体和正二十面体，用同样方法找出它们的对偶关系。', 4),
  (366, '数据验证', '对比对偶多面体的数据：一个的面数等于另一个的顶点数，棱数相同。', 5),
  (366, '正四面体的秘密', '对正四面体执行同样操作，惊喜发现它的对偶是它自己——正四面体是自对偶的。', 6);

-- [384] 囚徒困境模拟
UPDATE public.projects SET description = '通过角色扮演模拟博弈论中经典的囚徒困境，体验合作与背叛的策略选择。你将了解博弈论的基本概念，思考为什么在竞争中合作往往是最优策略。', difficulty_stars = 4 WHERE id = 384;
DELETE FROM public.project_steps WHERE project_id = 384;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (384, '熟悉规则', '了解囚徒困境的得分规则：双方合作各得3分；双方背叛各得1分；一方合作一方背叛时，背叛者得5分合作者得0分，动手试玩几次熟悉操作。', 1),
  (384, '单轮博弈', '两人各自秘密选择"合作"或"背叛"卡片同时亮出，按规则计分。玩10轮，统计总分。', 2),
  (384, '多轮策略', '进行30轮以上的重复博弈，双方可以根据对方之前的选择调整策略，观察合作关系如何建立。', 3),
  (384, '策略比较', '尝试不同策略——始终合作、始终背叛、以牙还牙（模仿对方上一轮的选择），记录各策略的总得分。', 4),
  (384, '多人锦标赛', '邀请更多朋友参加循环赛，每对选手进行20轮博弈，最终总分最高者获胜。', 5),
  (384, '总结记录', '在笔记本上写下你的发现和思考：哪种策略表现最好，理解"以牙还牙"策略为什么在重复博弈中往往最优——它既有报复也有宽容。', 6);

-- [364] 四色定理地图着色
UPDATE public.projects SET description = '尝试用最少的颜色给地图着色，使相邻区域颜色不同，探索著名的四色定理。你将体验图论的魅力，理解为什么任何地图最多只需要四种颜色。', difficulty_stars = 4 WHERE id = 364;
DELETE FROM public.project_steps WHERE project_id = 364;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (364, '简单地图尝试', '在白纸上画一张有五六个区域的简单地图，尝试用尽量少的颜色着色，使相邻区域颜色不同。', 1),
  (364, '增加难度', '画出更复杂的地图，有十个以上交错的区域，继续尝试着色，记录最少用了几种颜色。', 2),
  (364, '给真实地图着色', '用四种彩笔给中国省份地图着色，确保每两个相邻的省份颜色不同。', 3),
  (364, '发现规律', '多次尝试后发现：无论地图多复杂，四种颜色总是够用，这就是四色定理。', 4),
  (364, '构造挑战', '尝试画一张"必须"用到四种颜色的地图（三种颜色不够），理解什么情况下需要第四种颜色。', 5),
  (364, '延伸思考', '在笔记本上记录你的思考：四色定理的历史——这是第一个用计算机辅助证明的数学定理，至今没有纯手工证明。', 6);

-- [363] 欧拉多面体公式验证
UPDATE public.projects SET description = '数各种多面体模型的顶点、棱和面，验证欧拉公式V - E + F = 2是否总是成立。你将制作多种多面体并仔细计数，感受这个简洁公式背后的深刻数学之美。', difficulty_stars = 4 WHERE id = 363;
DELETE FROM public.project_steps WHERE project_id = 363;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (363, '制作简单多面体', '用橡皮泥做顶点、牙签做棱，搭建正四面体和正方体的骨架模型。', 1),
  (363, '计数V、E、F', '仔细数出每个模型的顶点数V、棱数E和面数F，记录在表格中。', 2),
  (363, '验证公式', '计算V - E + F，发现正四面体是4 - 6 + 4 = 2，正方体是8 - 12 + 6 = 2，结果都是2。', 3),
  (363, '挑战更多形状', '继续制作正八面体、正十二面体、三棱柱、五棱锥等不同多面体，逐一验证公式。', 4),
  (363, '寻找例外', '尝试制作一个中间有洞的环形多面体（如甜甜圈形），发现公式结果不再是2，讨论为什么。', 5),
  (363, '总结规律', '整理所有数据，总结欧拉公式对凸多面体总是成立，思考"有洞"的情况公式如何修正。', 6);

-- [387] 用数学分析桌游策略
UPDATE public.projects SET description = '用概率和期望值分析常见桌游中的最优策略，让数学成为赢得游戏的秘密武器。你将用数学工具进行决策分析，理解为什么有些策略长期来看更优。', difficulty_stars = 4 WHERE id = 387;
DELETE FROM public.project_steps WHERE project_id = 387;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (387, '选择分析对象', '选一款熟悉的桌游（如大富翁），记录游戏中涉及随机性的环节（掷骰子移动、抽卡片等）。', 1),
  (387, '计算概率分布', '算出掷两颗骰子的概率分布：和为7概率最高（6/36），和为2或12最低（1/36），画出概率柱状图。', 2),
  (387, '分析落点频率', '根据概率分布计算从起点出发最容易停留的格子，发现距起点6-8步的格子被踩到的概率最高。', 3),
  (387, '计算期望收益', '学习期望值概念：对游戏中的投资选择（如购买哪块地产），计算每种选择的期望收益=收益×概率。', 4),
  (387, '制定最优策略', '综合概率和期望值分析，制定一套"数学最优"策略并在实际游戏中验证。', 5),
  (387, '整理策略卡片', '把你发现的概率数据和最优策略写在卡片上，用图表展示关键数据。', 6);

-- [369] 投影与影子几何
UPDATE public.projects SET description = '用手电筒将立体图形的影子投射到墙面和桌面上，探索不同角度投影的形状变化。你将理解三维物体如何产生二维投影，学习正交投影和透视投影的区别。', difficulty_stars = 5 WHERE id = 369;
DELETE FROM public.project_steps WHERE project_id = 369;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (369, '基础投影', '在暗室中用手电筒从正面照射正方体，在墙上看到正方形的影子；从斜上方照射，影子变成什么形状？', 1),
  (369, '一物多影', '转动正方体的角度，记录不同方向的投影形状：正方形、长方形、六边形等，画出每种投影。', 2),
  (369, '猜影游戏', '一人在幕后放置不同立体图形，只让另一人看影子来猜原物是什么形状。', 3),
  (369, '截面探索', '用橡皮泥做一个正方体，用细线从不同角度切开，观察截面形状：三角形、长方形甚至六边形。', 4),
  (369, '三视图绘制', '从正面、侧面和上方分别观察立体模型，画出对应的正视图、侧视图和俯视图。', 5),
  (369, '工程应用', '在笔记本上记录你的思考：建筑师和工程师如何用三视图和投影图来描述复杂的三维结构。', 6);

-- [409] 图论入门：网络分析
UPDATE public.projects SET description = '用图论的方法分析社交网络和交通网络，学习节点、边、度数等基本概念。你将把抽象的数学理论与真实的网络世界联系起来，理解网络科学的基本思想。', difficulty_stars = 5 WHERE id = 409;
DELETE FROM public.project_steps WHERE project_id = 409;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (409, '画社交关系图', '以自己为中心，画出与家人和好朋友的关系网络——每个人是一个圆（节点），认识的人之间画线（边）。', 1),
  (409, '计算度数', '数每个节点连接的边数（度数），度数最大的人就是这个网络中的"社交达人"，讨论度数的含义。', 2),
  (409, '分析连通性', '检查网络中是否所有人都能通过关系链互相联系到。如果去掉某个关键人物，网络会断开吗？这样的人叫"关键节点"。', 3),
  (409, '交通网络分析', '画出附近几个地点之间的交通路线图，标注每条路的距离，用之前学过的方法找出最短路径。', 4),
  (409, '六度分隔理论', '讨论"世界上任意两个人最多只需要六个中间人就能联系上"的理论，思考社交网络规模扩大后度数和连通性如何变化。', 5),
  (409, '网络可视化', '尝试把网络图画得更美观：节点大小按度数调整（度数越大越大），用不同颜色标记不同的社群，欣赏网络之美。', 6);

-- [410] 算法思维笔记
UPDATE public.projects SET description = '通过扑克牌排序、字典查词等日常活动，亲身体验和理解排序、搜索等基本算法思想。你将用可视化的方式记录算法步骤，建立起计算思维的基本框架。', difficulty_stars = 5 WHERE id = 410;
DELETE FROM public.project_steps WHERE project_id = 410;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (410, '冒泡排序体验', '取10张扑克牌随机排列，按冒泡排序法相邻比较交换，一轮轮处理直到完全有序，用彩笔在纸上画出每一步的变化。', 1),
  (410, '选择排序对比', '同样的10张牌，改用选择排序（每次找最小的放到最前面），画出步骤并与冒泡排序比较哪个交换次数更少。', 2),
  (410, '二分查找体验', '将牌按顺序排好，让朋友心里想一个数，你用"比中间大还是小"的方式来猜，记录每次只需猜几次就能找到。', 3),
  (410, '可视化算法笔记', '在笔记本上为每种算法画一页图解：用箭头表示比较、用颜色标记交换、用方框表示当前检查的范围。', 4),
  (410, '效率大比拼', '分别用30张牌测试冒泡排序和选择排序的耗时，讨论为什么数据量越大、算法效率的差异越明显。', 5),
  (410, '算法思维总结', '整理算法笔记，在纸上画出三个核心思想的示意图：分而治之（把大问题拆成小问题）、贪心策略（每步选当前最优）、穷举与剪枝（尝试所有可能但跳过不可能的）。', 6);

-- [407] 自制密室逃脱谜题
UPDATE public.projects SET description = '设计一套完整的密室逃脱谜题，包含密码锁、线索链和多种逻辑解谜环节。这是一个综合性极强的项目，孩子需要运用所学的各种逻辑推理技能来创造一场精彩的解谜冒险。', difficulty_stars = 5 WHERE id = 407;
DELETE FROM public.project_steps WHERE project_id = 407;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (407, '设计故事背景', '构思一个吸引人的故事：例如"科学家被困在实验室，你需要在60分钟内破解所有谜题找到钥匙逃出去"。', 1),
  (407, '设计谜题链', '规划5-6个环环相扣的谜题，每个谜题的答案是下一个谜题的线索——如解码获得密码锁数字、拼图发现下一条线索位置。', 2),
  (407, '制作谜题道具', '动手制作各种谜题：用镜像文字写线索、设计摩尔斯电码解密、画藏头诗隐藏数字、制作拼图碎片等。', 3),
  (407, '布置场景', '在房间中布置所有谜题和线索，确保线索链完整可解，没有断裂环节，设置好密码锁和隐藏物品。', 4),
  (407, '测试与调整', '自己先完整走一遍流程，检查每个谜题的难度是否合适、线索是否足够清晰，必要时增加提示或调整难度。', 5),
  (407, '邀请挑战', '邀请家人或朋友来挑战你的密室逃脱，用计时器记录时间，观察他们在哪里卡住并收集改进意见。', 6);

-- [370] 球面几何与地图投影
UPDATE public.projects SET description = '探索把球面地图展开到平面时产生的形变问题，比较不同地图投影方式的优劣。你将剥橘子皮来直观感受球面无法完美展开为平面，理解所有世界地图都是"有误差的"。', difficulty_stars = 5 WHERE id = 370;
DELETE FROM public.project_steps WHERE project_id = 370;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (370, '橘子皮实验', '在橘子表面用记号笔画出简化的大陆轮廓和经纬线，然后剥下橘皮尝试铺平——发现必然会撕裂或重叠。', 1),
  (370, '理解投影原理', '用手电筒从地球仪中心向外照射，观察经纬线投射到包裹地球仪的纸筒或纸锥上的形状。', 2),
  (370, '比较面积失真', '在墨卡托投影地图上测量格陵兰和非洲的面积，再在地球仪上比较——实际上非洲比格陵兰大14倍！', 3),
  (370, '制作简易投影', '将半透明纸包裹在地球仪上，描出海岸线，展开后得到一种投影地图，观察哪里变形最大。', 4),
  (370, '讨论投影选择', '了解不同投影的优缺点：墨卡托保角度但面积失真大，等面积投影保面积但形状变形。', 5),
  (370, '航海与导航', '在笔记本上记录你的思考：为什么航海地图使用墨卡托投影——因为直线等于等角航线，方便船只按固定方位角航行。', 6);

-- [408] NP 问题趣味入门
UPDATE public.projects SET description = '通过亲身体验背包问题和图着色问题，感受"容易验证但难以求解"的NP问题的本质。你将了解计算复杂度的概念，理解为什么有些看似简单的问题连超级计算机也头疼。', difficulty_stars = 5 WHERE id = 408;
DELETE FROM public.project_steps WHERE project_id = 408;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (408, '体验背包问题', '给8个物品分别标注重量和价值，背包限重5公斤，尝试选出总价值最高的物品组合——你会发现需要尝试很多种搭配。', 1),
  (408, '感受难度增长', '把物品增加到12个再试一次，记录你花了多少时间。讨论：物品数翻倍，需要尝试的组合数会增长多少倍？', 2),
  (408, '图着色问题', '在纸上画一个有8个区域的地图，要求相邻区域颜色不同。尝试只用3种颜色能否完成？用4种颜色呢？', 3),
  (408, '验证vs求解', '让朋友给出一个背包方案，你能很快算出总重量和总价值来验证；但自己从头找最优方案却很费时间——这就是NP问题的核心特征。', 4),
  (408, '体会计算复杂度', '在笔记本上记录你的思考：P与NP的直觉含义：P是"容易解的问题"，NP是"容易验证的问题"，P=NP?是数学界的百万美元难题。', 5);

-- [367] 分形雪花编程绘制
UPDATE public.projects SET description = '用编程（Scratch或Python Turtle）递归绘制科赫雪花和分形树等图案。你将把分形概念与递归思想结合，用代码创造出手工难以完成的精美分形图案。', difficulty_stars = 5 WHERE id = 367;
DELETE FROM public.project_steps WHERE project_id = 367;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (367, '理解递归思想', '从一条直线开始，将中间三分之一替换为向外突出的等边三角形两条边，理解这一步如何重复应用。', 1),
  (367, '画科赫线段', '编写程序画出科赫曲线：如果层数为0画直线，否则递归画四段更小的科赫曲线。', 2),
  (367, '组成雪花', '将三条科赫曲线按等边三角形排列，形成完整的科赫雪花，调整递归深度观察效果。', 3),
  (367, '绘制分形树', '编写新程序：画一条树干，末端分叉成两条更短的树枝，每条树枝再分叉，递归生成整棵树。', 4),
  (367, '添加变化', '为分形树增加随机角度和颜色变化，让每次运行生成的树都略有不同，更接近真实的树木。', 5),
  (367, '探索更多分形', '尝试编程绘制谢尔宾斯基三角形或龙形曲线，理解不同的递归规则产生不同的分形图案。', 6);

-- [368] 非欧几何初探
UPDATE public.projects SET description = '在球面和马鞍面上画"直线"和三角形，发现三角形内角和不再是180度。你将突破欧几里得几何的思维定势，初步接触球面几何和双曲几何的奇妙世界。', difficulty_stars = 5 WHERE id = 368;
DELETE FROM public.project_steps WHERE project_id = 368;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (368, '平面上的三角形', '在白纸上画一个三角形，用量角器测量三个内角，验证内角和等于180度。', 1),
  (368, '球面上的三角形', '在地球仪上用橡皮筋沿大圆围成一个三角形（如北极-赤道上两点），测量三个角发现内角和大于180度。', 2),
  (368, '球面上的平行线', '在地球仪上画两条经线，它们在赤道处看似平行，但在两极相交，说明球面上没有真正的平行线。', 3),
  (368, '马鞍面上的探索', '在马鞍形曲面上画三角形，测量内角和发现小于180度，这就是双曲几何。', 4),
  (368, '对比三种几何', '制作表格比较平面、球面和马鞍面上的几何性质：三角形内角和、平行线数量、最短路径形状等。', 5),
  (368, '联系现实', '在笔记本上记录你的思考：爱因斯坦广义相对论如何用非欧几何描述被大质量物体弯曲的时空。', 6);

-- [390] 数学建模入门
UPDATE public.projects SET description = '学习用数学模型描述和解决实际生活中的问题，迈出从"学数学"到"用数学"的关键一步。你将体验数学建模的完整流程，理解数学是解决真实世界问题的强大工具。', difficulty_stars = 4 WHERE id = 390;
DELETE FROM public.project_steps WHERE project_id = 390;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (390, '选择问题', '选一个生活中的问题作为建模对象，例如"课间休息多久效率最高"或"零花钱怎样存增长最快"。', 1),
  (390, '简化假设', '将复杂的现实问题简化：确定哪些因素最重要需要考虑，哪些次要因素可以暂时忽略。', 2),
  (390, '建立模型', '用数学语言（方程、函数、图表）描述问题中各因素之间的关系，这就是"数学模型"。', 3),
  (390, '求解与预测', '运用学过的数学知识求解模型，得出具体的数值结果或趋势预测。', 4),
  (390, '验证模型', '将模型的预测结果与实际情况对比，如果偏差较大则调整假设和模型参数重新计算。', 5),
  (390, '整理成果', '将完整的建模过程写在一张大纸上：问题→假设→模型→结果→验证，形成一页纸总结。', 6);

-- [389] 数列与规律探索
UPDATE public.projects SET description = '研究各种有趣的数列，学会发现规律、总结公式并预测后续数字。你将锻炼归纳推理能力，体验从具体数字中提炼抽象规律的数学思维过程。', difficulty_stars = 5 WHERE id = 389;
DELETE FROM public.project_steps WHERE project_id = 389;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (389, '等差数列', '研究等差数列如2, 5, 8, 11……发现每次增加相同的差值（公差为3），推导通项公式 an = a1 + (n-1)×d。', 1),
  (389, '等比数列', '研究等比数列如3, 6, 12, 24……发现每次乘以相同的比值（公比为2），推导通项公式 an = a1 × r^(n-1)。', 2),
  (389, '图形数列', '用积木摆出三角形数（1, 3, 6, 10……）和正方形数（1, 4, 9, 16……），找出它们的递推规律和通项公式。', 3),
  (389, '差分法破解', '学习差分法：对数列做逐次差分直到差值为常数，从而判断数列类型并推出通项公式。', 4),
  (389, '挑战谜题', '解决10道数列填空谜题，运用所学方法发现规律并填出下一个数，记录思考过程。', 5),
  (389, '创造数列', '发明自己独特的数列规则，用它创建谜题挑战家人和朋友，看谁能最快找出规律。', 6);

-- [388] 抽样调查实验
UPDATE public.projects SET description = '设计并执行一次真实的抽样调查，从小样本推断总体特征，体验统计学的核心方法。你将掌握科学的调查方法，理解为什么民调和统计可以用少数人的数据推测整体情况。', difficulty_stars = 3 WHERE id = 388;
DELETE FROM public.project_steps WHERE project_id = 388;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (388, '准备总体', '请一位家人在袋子里放入红蓝两色弹珠共100颗（比例保密），这就是我们要调查的"总体"。', 1),
  (388, '随机抽样', '不看袋内，随机抽出10颗弹珠记录颜色后放回袋中并摇匀，重复此过程5次，每次都是独立抽样。', 2),
  (388, '计算估计值', '计算每次抽样中红色弹珠的比例，以及5次抽样的平均比例，用这个平均比例估计袋中红色弹珠的实际数量。', 3),
  (388, '增大样本量', '将每次抽样量增加到20颗和30颗，观察估计值是否变得更准确、波动是否更小。', 4),
  (388, '验证结果', '打开袋子清点实际的红蓝弹珠数量，与抽样估计值对比，讨论样本大小对估计准确性的影响。', 5),
  (388, '真实调查', '设计一个真实的调查问题（如"班级同学最喜欢的科目"），用学到的抽样方法进行调查并分析结果。', 6);

-- [106] 化石印模制作
UPDATE public.projects SET description = '你有没有想过恐龙时代的动植物是怎么变成化石的？在这个项目中，你将用黏土和小物件模拟化石形成的过程，亲手制作一枚属于自己的"化石"。通过动手操作，理解化石是如何在岩层中保存下来的。', difficulty_stars = 1 WHERE id = 106;
DELETE FROM public.project_steps WHERE project_id = 106;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (106, '准备黏土', '取出适量黏土，用擀面杖将黏土擀平，厚度约1厘米，放在纸盘上备用。', 1),
  (106, '涂抹防粘油', '在树叶、贝壳或模型表面薄薄地涂一层食用油，防止粘在黏土上取不出来。', 2),
  (106, '制作印模', '将准备好的物件轻轻按入黏土中，确保留下清晰的印痕，然后小心地取出物件。', 3),
  (106, '晾干成型', '将黏土印模放在通风处自然晾干，风干黏土通常需要24小时完全变硬。', 4),
  (106, '观察与思考', '观察你的"化石"印模，思考真正的化石是怎样经过数百万年在岩石中形成的。', 5);

-- [58] 蜗牛行为小实验
UPDATE public.projects SET description = '找一只蜗牛作为观察对象，通过简单的实验了解蜗牛对光线、食物和湿度的反应。观察蜗牛爬行时留下的黏液痕迹，认识软体动物的基本特征。', difficulty_stars = 1 WHERE id = 58;
DELETE FROM public.project_steps WHERE project_id = 58;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (58, '采集蜗牛', '雨后在花园的石头下或潮湿的墙角寻找蜗牛，轻轻放入透明塑料盒中。', 1),
  (58, '观察外形', '用放大镜观察蜗牛的触角、眼睛、壳的螺旋方向，画出蜗牛的身体结构图。', 2),
  (58, '光照实验', '用手电筒照射蜗牛，观察它是朝向光源还是躲避光源，记录它的反应。', 3),
  (58, '食物偏好测试', '在蜗牛面前摆放不同的食物（菜叶、水果片、面包），观察它最先爬向哪种食物。', 4),
  (58, '记录与总结', '把观察结果整理成表格，总结蜗牛的行为特点和喜好。', 5);

-- [13] 彩虹制造机
UPDATE public.projects SET description = '利用水和阳光在家中制造出美丽的彩虹，学习白光如何被分解成七种颜色。理解光的色散原理，感受牛顿发现的光学奥秘。', difficulty_stars = 1 WHERE id = 13;
DELETE FROM public.project_steps WHERE project_id = 13;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (13, '准备水盆', '在水盆中倒入清水，将小镜子斜靠在盆底，角度约为45度。', 1),
  (13, '布置光源', '在阳光充足的窗边放置水盆，或者用手电筒对准水中的镜子照射。', 2),
  (13, '寻找彩虹', '在镜子反射光线的方向放置白色纸板，缓慢调整镜子角度，直到纸板上出现彩虹。', 3),
  (13, '观察颜色', '仔细观察彩虹中的颜色顺序：红、橙、黄、绿、蓝、靛、紫，记录下你看到的颜色。', 4),
  (13, '探索变化', '尝试改变镜子角度和水量，观察彩虹的大小和亮度如何变化，理解光通过水发生折射和色散的原理。', 5);

-- [60] 喂鸟观察站
UPDATE public.projects SET description = '用简单的材料制作一个鸟类喂食器，挂在窗外或阳台上，吸引附近的小鸟前来取食。通过每天观察记录，认识身边常见的鸟类，', difficulty_stars = 2 WHERE id = 60;
DELETE FROM public.project_steps WHERE project_id = 60;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (60, '制作喂食器', '在空牛奶盒侧面剪出一个拱形开口，底部留出约2厘米作为食物托盘。', 1),
  (60, '安装悬挂', '在盒子顶部穿绳子，将喂食器挂在窗外的树枝或栏杆上。', 2),
  (60, '放入食物', '在喂食器底部撒上一层小米或葵花籽，每天补充新鲜食物。', 3),
  (60, '安静观察', '在远处安静等待，当鸟儿来吃食时，观察它们的体型、颜色和行为。', 4),
  (60, '记录与辨认', '画出看到的鸟的样子，借助图鉴或网络查询它们的名字，记录每天来访的鸟种。', 5);

-- [61] 宠物行为观察日记
UPDATE public.projects SET description = '选择家里或朋友家的宠物（猫、狗、仓鼠等），连续几天观察和记录它们的日常行为，如进食、睡眠、玩耍等。了解动物的基本需求。', difficulty_stars = 3 WHERE id = 61;
DELETE FROM public.project_steps WHERE project_id = 61;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (61, '制定观察计划', '选择一只宠物，决定每天固定的观察时间段（如早晨、中午、傍晚各15分钟）。', 1),
  (61, '观察与记录', '在观察时间内安静地待在宠物附近，记录它正在做什么：吃东西、睡觉、跑动还是其他行为。', 2),
  (61, '画行为时间表', '用表格记录宠物在不同时间段的行为，画出一天的活动时间线。', 3),
  (61, '连续记录', '坚持记录至少3天，比较每天的行为是否有规律。', 4),
  (61, '整理观察记录', '用表格或图表整理宠物的行为规律和你发现的有趣现象。', 5);

-- [37] 火山爆发模型
UPDATE public.projects SET description = '用小苏打和醋模拟真实的火山喷发效果！你将亲手搭建火山模型，观察酸碱混合后产生大量气泡的壮观场景。理解酸碱反应产生二氧化碳气体的基本化学原理。', difficulty_stars = 1 WHERE id = 37;
DELETE FROM public.project_steps WHERE project_id = 37;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (37, '搭建火山外形', '用黏土或橡皮泥包裹塑料瓶，捏出火山的形状，顶部留出瓶口作为火山口。', 1),
  (37, '准备"岩浆"', '在塑料瓶中加入两勺小苏打、几滴红色食用色素和少量洗洁精。', 2),
  (37, '触发喷发', '将白醋缓缓倒入瓶中，观察"岩浆"从火山口涌出。', 3),
  (37, '观察与记录', '观察气泡的产生过程，记录喷发的高度和持续时间，在记录本上写下酸和碱混合后为什么会产生气体。', 4);

-- [57] 校园昆虫大搜索
UPDATE public.projects SET description = '带上放大镜和记录本，走遍校园的花坛、草地和树下，寻找各种小昆虫。观察它们的外形特征，学习简单的昆虫分类方法，了解昆虫与环境的关系。', difficulty_stars = 2 WHERE id = 57;
DELETE FROM public.project_steps WHERE project_id = 57;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (57, '选择观察区域', '在校园里选择花坛、草地、大树下等不同区域作为观察点。', 1),
  (57, '仔细搜索', '蹲下来用放大镜仔细观察叶片背面、石头下方和树皮缝隙，记录发现的昆虫。', 2),
  (57, '画图记录', '用彩色铅笔画出每种昆虫的外形，标注颜色、腿的数量和大致体长。', 3),
  (57, '尝试分类', '根据翅膀有无、腿的数量等特征，尝试将发现的昆虫分成不同的类别。', 4),
  (57, '总结发现', '统计一共发现了几种昆虫，在记录本上写下哪种区域昆虫最多，思考原因。', 5);

-- [105] 云的观察日记
UPDATE public.projects SET description = '抬头看天空，你会发现云朵每天都不一样！连续观察并记录不同类型的云，学习积云、层云和卷云的区别。坚持记录后，你能初步理解云与天气变化之间的关系。', difficulty_stars = 3 WHERE id = 105;
DELETE FROM public.project_steps WHERE project_id = 105;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (105, '制作云朵参考卡', '查看云朵分类参考图，在卡片上画出积云、层云、卷云的典型形状，标注名称和特征，作为后续观察的对照工具。', 1),
  (105, '选择观察地点', '选一个视野开阔的地方，如阳台、操场或公园，确保能看到大片天空。', 2),
  (105, '观察并绘画', '抬头观察天空中的云朵，用彩色铅笔在笔记本上画出你看到的云的形状，并尝试标注云的种类。', 3),
  (105, '记录天气信息', '在画旁边写下日期、时间、气温和当天的天气情况（晴、阴、多云等）。', 4),
  (105, '对比与总结', '连续观察一周后，翻看记录，找一找哪种云出现最多，云的类型和天气变化有没有规律。', 5);

-- [17] 水中硬币魔术
UPDATE public.projects SET description = '将硬币放在碗底，通过倒水让"消失"的硬币重新出现，表演一场神奇的光学魔术。你将直观地理解光的折射现象，明白光在不同介质中传播方向会发生改变。', difficulty_stars = 1 WHERE id = 17;
DELETE FROM public.project_steps WHERE project_id = 17;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (17, '放置硬币', '将硬币放在空碗底部，站在碗前方慢慢后退，直到刚好看不到硬币为止。', 1),
  (17, '固定位置', '保持你的眼睛位置不变，请家人帮忙往碗里缓慢倒入清水。', 2),
  (17, '观察魔术', '随着水慢慢升高，你会神奇地看到硬币重新出现在视线中。', 3),
  (17, '画出光路图', '在记录本上画出光从水中射向空气时的折射路径，标注为什么原本被碗壁挡住的硬币光线能绕过遮挡到达你的眼睛。', 4);

-- [15] 影子戏剧场
UPDATE public.projects SET description = '制作简易影子剧场，用手电筒和剪纸表演一场精彩的影子戏。你将学习光的直线传播原理，理解影子的形成原因以及大小变化规律。', difficulty_stars = 2 WHERE id = 15;
DELETE FROM public.project_steps WHERE project_id = 15;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (15, '制作幕布', '将鞋盒的一面剪开，用白色薄纸覆盖作为投影幕布，用胶带固定。', 1),
  (15, '制作角色', '在卡纸上画出小动物或人物的轮廓并剪下，用胶带粘在竹签上制成影子道具。', 2),
  (15, '布置灯光', '在幕布后方放置手电筒作为光源，关闭房间其他灯光。', 3),
  (15, '表演与观察', '将剪纸道具放在灯光和幕布之间，观察幕布上投射出的影子。', 4),
  (15, '探索影子大小', '移动道具靠近或远离光源，观察影子大小的变化，理解光沿直线传播时，物体距光源越近影子越大的规律。', 5);

-- [59] 蚂蚁觅食路线追踪
UPDATE public.projects SET description = '在蚂蚁经常出没的地方放置少量食物，观察蚂蚁发现食物后的行为和搬运路线。了解蚂蚁的信息素通讯方式，认识昆虫的群体协作行为。', difficulty_stars = 2 WHERE id = 59;
DELETE FROM public.project_steps WHERE project_id = 59;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (59, '寻找蚂蚁巢穴', '在户外地面的缝隙处寻找蚂蚁进出的洞口，确认蚁巢位置。', 1),
  (59, '放置诱饵', '在距离蚁巢约半米处的白纸上放几粒白糖，耐心等待蚂蚁发现。', 2),
  (59, '追踪路线', '当蚂蚁开始搬运食物时，用彩色粉笔沿着它们的行走路线轻轻标记。', 3),
  (59, '计时观察', '记录第一只蚂蚁发现食物的时间，以及越来越多蚂蚁前来的时间间隔。', 4),
  (59, '总结与记录', '在记录本上写下你的想法：蚂蚁是怎样通知同伴食物位置的？为什么它们总是走同一条路线？', 5);

-- [108] 沙中寻宝
UPDATE public.projects SET description = '沙子里藏着很多秘密！你将收集一些沙子，用放大镜仔细观察沙粒的颜色、形状和大小，并尝试用筛网将不同大小的颗粒分开。了解沙子的来源以及自然界的风化和分选过程。', difficulty_stars = 2 WHERE id = 108;
DELETE FROM public.project_steps WHERE project_id = 108;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (108, '收集沙子样本', '从不同地方（如沙坑、花园、河边）收集少量沙子，分别装好并标注来源。', 1),
  (108, '放大镜观察', '将沙子倒在白纸上，用放大镜仔细观察沙粒的颜色、形状和大小，看看有没有闪光的矿物颗粒。', 2),
  (108, '筛网分选', '用不同孔径的筛网依次过筛，将沙子按颗粒大小分成几组，观察各组的差异。', 3),
  (108, '寻找特殊颗粒', '用小镊子挑出特别的颗粒，如小贝壳碎片、彩色石子或微小的矿物晶体。', 4),
  (108, '记录与分享', '画出或拍下你观察到的不同沙粒，记录它们的特征，在记录本上写下沙子是怎样从大岩石变小的。', 5);

-- [82] 树叶标本采集与分类
UPDATE public.projects SET description = '到户外采集不同形状和颜色的树叶，制作精美的标本并尝试分类。通过观察叶片的形态特征，认识常见树木种类，', difficulty_stars = 2 WHERE id = 82;
DELETE FROM public.project_steps WHERE project_id = 82;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (82, '户外采集', '到公园或校园里采集不同种类的树叶，尽量选择完整、无破损的叶片。', 1),
  (82, '压制干燥', '将树叶夹在报纸中间，放入厚书本里压紧，等待3-5天让叶片干燥变平。', 2),
  (82, '分类整理', '取出压好的树叶，按照叶片形状（圆形、椭圆形、掌形等）进行分类。', 3),
  (82, '制作标本卡', '将分好类的树叶用胶带固定在白色卡纸上，写上树叶名称和采集日期。', 4),
  (82, '完成作品展示', '把标本卡装订成册，拍照记录你的标本册。', 5);

-- [107] 雨量测量记录
UPDATE public.projects SET description = '下雨的时候，你知道到底下了多少雨吗？你将自制一个简易雨量计，放在室外收集雨水并测量降雨量。通过持续记录，学习天气数据的收集方法和简单的数据比较。', difficulty_stars = 2 WHERE id = 107;
DELETE FROM public.project_steps WHERE project_id = 107;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (107, '制作雨量计', '用剪刀将塑料瓶上部剪掉约三分之一，翻转倒扣在瓶身上方做成漏斗状，防止雨水蒸发。', 1),
  (107, '标注刻度', '用直尺和防水记号笔在瓶身外侧从底部开始标注刻度线，每5毫米画一条线。', 2),
  (107, '放置雨量计', '在瓶底放入一些小石子增加稳定性，然后将雨量计放在室外开阔处，远离树木和建筑遮挡。', 3),
  (107, '记录降雨数据', '每次下雨后读取水面所在的刻度，记录日期、降雨量，并倒空瓶子准备下一次测量。', 4),
  (107, '数据对比', '收集一段时间的数据后，比较不同日期的降雨量，找出哪天雨最大、哪周降雨最多。', 5);

-- [14] 纸飞机飞行实验
UPDATE public.projects SET description = '折叠不同造型的纸飞机，测量和比较它们的飞行距离与滞空时间。你将了解空气动力学的基本知识，包括升力、阻力和重心对飞行的影响。', difficulty_stars = 2 WHERE id = 14;
DELETE FROM public.project_steps WHERE project_id = 14;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (14, '折叠飞机', '用相同大小的纸分别折叠三种不同造型的纸飞机：经典飞镖型、宽翼型和细长型。', 1),
  (14, '标记起飞线', '在地面用胶带标记一条起飞线，确保每次从同一位置以相同力度投掷。', 2),
  (14, '飞行测试', '每种纸飞机各飞行三次，用卷尺测量飞行距离，用秒表记录滞空时间。', 3),
  (14, '改装实验', '在飞机头部夹上回形针改变重心位置，观察飞行表现的变化。', 4),
  (14, '记录与分析', '将所有数据记录在表格中，比较不同造型和配重的飞机表现，在记录本上写下机翼形状和重心位置如何影响飞行。', 5);

-- [41] 盐画艺术
UPDATE public.projects SET description = '用胶水在纸上画出图案，撒上食盐，再滴上彩色颜料水，创作出独特的盐画！你将观察盐的溶解与结晶过程，了解水分蒸发后盐如何重新形成晶体。艺术与科学的完美结合。', difficulty_stars = 1 WHERE id = 41;
DELETE FROM public.project_steps WHERE project_id = 41;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (41, '绘制胶水图案', '用白胶在卡纸上画出喜欢的图案或文字，线条要饱满连续。', 1),
  (41, '撒盐覆盖', '趁胶水未干，大量撒上食盐覆盖所有胶水线条，然后轻轻抖落多余的盐。', 2),
  (41, '滴入颜色', '用滴管吸取稀释的水彩颜料或色素水，沿着盐线轻轻滴下，观察颜色如何沿盐粒扩散。', 3),
  (41, '干燥与观察', '将作品平放晾干，观察水分蒸发后盐结晶的样子，在记录本上写下溶解和结晶的过程。', 4);

-- [40] 面团发酵观察
UPDATE public.projects SET description = '用面粉和酵母制作面团，观察发酵过程中面团如何膨胀变大！你将了解酵母菌这种微生物如何将糖分解并产生二氧化碳气体。实验结束还可以把面团做成小面包品尝。', difficulty_stars = 2 WHERE id = 40;
DELETE FROM public.project_steps WHERE project_id = 40;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (40, '激活酵母', '将干酵母和白糖加入温水（约35°C）中，轻轻搅拌后静置5分钟，观察水面是否出现小气泡。', 1),
  (40, '揉制面团', '将酵母水倒入面粉中，揉成光滑的面团，放入透明玻璃碗中。', 2),
  (40, '标记与等待', '用记号笔在碗外侧标记面团的初始高度，盖上保鲜膜，放在温暖处等待30-40分钟。', 3),
  (40, '观察膨胀', '每10分钟观察并记录面团高度的变化，看它如何慢慢变大。', 4),
  (40, '揭秘气体', '用手指按压发酵好的面团，感受里面的气孔，在记录本上写下酵母菌产生二氧化碳使面团膨胀的原理。', 5);

-- [39] 彩色泡泡实验
UPDATE public.projects SET description = '自制彩色泡泡液，吹出五颜六色的泡泡并观察它们在阳光下的色彩变化！你将了解泡泡薄膜的表面张力原理，以及色素如何在液膜中分布。', difficulty_stars = 2 WHERE id = 39;
DELETE FROM public.project_steps WHERE project_id = 39;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (39, '配制泡泡液', '将水、洗洁精和甘油（或白糖）混合搅拌均匀，静置几分钟让泡泡液稳定。', 1),
  (39, '分装染色', '将泡泡液分装到几个小杯中，每杯加入不同颜色的食用色素搅拌均匀。', 2),
  (39, '吹出彩色泡泡', '用吸管或铁丝环蘸取不同颜色的泡泡液，轻轻吹出彩色泡泡。', 3),
  (39, '观察泡泡', '观察泡泡表面的颜色和光泽变化，在记录本上写下为什么泡泡是圆形的，表面张力如何让液膜保持形状。', 4),
  (39, '泡泡画创作', '在白纸上方吹泡泡，让彩色泡泡落在纸上留下美丽的痕迹，制作一幅泡泡画。', 5);

-- [86] 植物向光性观察
UPDATE public.projects SET description = '用简单的纸盒制作迷宫，观察植物幼苗如何绕过障碍物朝着光源生长。理解植物的向光性，感受植物对环境的适应能力。', difficulty_stars = 3 WHERE id = 86;
DELETE FROM public.project_steps WHERE project_id = 86;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (86, '制作光迷宫', '在鞋盒的一端开一个小孔让光线进入，用硬纸板在盒内交替粘贴做成隔板迷宫。', 1),
  (86, '放入植物', '将发芽的豆苗放在鞋盒内远离小孔的一端，盖上盒盖。', 2),
  (86, '日常观察', '每天打开盒盖观察豆苗的生长方向，拍照或画图记录变化。', 3),
  (86, '记录数据', '连续观察一周，记录豆苗每天弯曲的角度和生长的长度。', 4),
  (86, '记录实验结论', '在记录本上写下豆苗弯曲生长的方向与光源位置的关系，画出向光性示意图。', 5);

-- [62] 蝌蚪变青蛙观察
UPDATE public.projects SET description = '在春天采集几只蝌蚪，放在适宜的容器中饲养，每天观察蝌蚪从长出后腿到变成小青蛙的全过程。认识两栖动物的变态发育，了解生命的奇妙变化。', difficulty_stars = 3 WHERE id = 62;
DELETE FROM public.project_steps WHERE project_id = 62;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (62, '准备饲养环境', '在玻璃缸中加入池塘水和水草，水深约10厘米，放在通风阴凉处。', 1),
  (62, '放入蝌蚪', '将采集的蝌蚪轻轻放入缸中，每天喂少量煮软的菜叶碎。', 2),
  (62, '每日观察', '每天画出蝌蚪的样子，记录尾巴长度、是否长出后腿和前腿等变化。', 3),
  (62, '记录关键变化', '重点记录后腿出现、前腿出现、尾巴变短这三个关键阶段的日期。', 4),
  (62, '放归自然', '当蝌蚪完全变成小青蛙后，带到采集地附近的水塘边放归自然。', 5);

-- [109] 自制风向标
UPDATE public.projects SET description = '风从哪里来？你将用简单的材料制作一个风向标，放在室外观察风的方向。学习风向的概念、指南针方位以及风与天气变化的关系。', difficulty_stars = 2 WHERE id = 109;
DELETE FROM public.project_steps WHERE project_id = 109;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (109, '制作箭头和尾翼', '用硬纸板剪出一个小三角形箭头和一个较大的菱形尾翼，分别插入吸管的两端并用胶带固定。', 1),
  (109, '组装风向标', '找到吸管的平衡点，用大头针穿过该位置，将大头针插入铅笔顶端的橡皮头中，确保吸管能自由转动。', 2),
  (109, '固定底座', '用黏土将铅笔竖直固定在一个平稳的底座上，确保风向标不会倒下。', 3),
  (109, '标注方位', '用指南针确定东南西北方向，在底座上标注四个方位。', 4),
  (109, '观察风向', '将风向标放到室外空旷处，观察箭头指向哪个方向，记录每天不同时间的风向变化。', 5);

-- [12] 静电章鱼
UPDATE public.projects SET description = '用塑料袋制作一只可爱的"章鱼"，通过摩擦产生静电让它飘浮在空中。你将亲身体验摩擦起电的原理，观察同种电荷相互排斥的有趣现象。', difficulty_stars = 1 WHERE id = 12;
DELETE FROM public.project_steps WHERE project_id = 12;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (12, '制作章鱼', '将塑料袋剪成长条状，顶部扎紧形成章鱼的"头部"，下方的长条就是"触须"。', 1),
  (12, '充电准备', '用干燥的毛巾快速摩擦PVC管约30秒，让管子带上静电。', 2),
  (12, '给章鱼充电', '同样用毛巾快速摩擦塑料章鱼，让它也带上同种电荷。', 3),
  (12, '让章鱼飞起来', '将章鱼抛向空中，用带电的PVC管从下方靠近，观察章鱼因为同种电荷排斥而悬浮在空中。', 4),
  (12, '观察与记录', '尝试改变管子的距离和角度，观察章鱼的运动变化，理解静电力的作用方式。', 5);

-- [84] 蔬菜水培实验
UPDATE public.projects SET description = '利用厨房里常见的蔬菜根部进行水培再生实验。观察蔬菜在水中重新生长的过程，了解植物的再生能力和水培种植的基本原理。', difficulty_stars = 2 WHERE id = 84;
DELETE FROM public.project_steps WHERE project_id = 84;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (84, '准备蔬菜', '从厨房取一根大葱的根部（约5厘米）和一个胡萝卜头，保留有芽眼的部分。', 1),
  (84, '放入水中', '将蔬菜根部放入装有少量清水的透明杯中，水位刚好没过根部底端即可。', 2),
  (84, '日常养护', '每天换一次清水，放在有阳光的窗台上，保持水位稳定。', 3),
  (84, '观察记录', '每天用尺子量一量新长出的部分有多长，把数据记录在本子上。', 4),
  (84, '总结对比', '一周后对比不同蔬菜的生长速度，思考为什么有些蔬菜长得更快。', 5);

-- [85] 花瓣染色实验
UPDATE public.projects SET description = '将白色花朵插入彩色墨水中，观察花瓣逐渐变色的神奇过程。通过这个实验理解植物茎的毛细作用，了解水分在植物体内的运输方式。', difficulty_stars = 2 WHERE id = 85;
DELETE FROM public.project_steps WHERE project_id = 85;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (85, '配制彩色水', '在三个玻璃杯中各加入半杯清水，分别滴入红、蓝、绿三种食用色素搅拌均匀。', 1),
  (85, '修剪花茎', '用剪刀将花茎底端斜着剪一刀，使切口更大，方便吸水。', 2),
  (85, '插入花朵', '将三支白花分别插入三杯彩色水中，放在光线充足的地方。', 3),
  (85, '观察变色', '每隔几小时观察一次花瓣的颜色变化，记录哪种颜色最先出现。', 4),
  (85, '画出运输路径', '在记录本上画出水分从茎到花瓣的运输路径示意图，标注毛细作用如何让彩色水上升到花瓣。', 5);

-- [38] 牛奶星空画
UPDATE public.projects SET description = '在牛奶表面滴入不同颜色的色素，再用棉签蘸洗洁精轻触，看颜色奇妙地旋转扩散！你将观察表面张力被破坏后液体的运动规律。这个实验色彩绚烂，既是科学探索也是艺术创作。', difficulty_stars = 1 WHERE id = 38;
DELETE FROM public.project_steps WHERE project_id = 38;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (38, '倒入牛奶', '将全脂牛奶倒入浅盘中，液面约1厘米深，等待表面平静。', 1),
  (38, '滴入色素', '在牛奶表面不同位置分别滴入红、黄、蓝等颜色的食用色素，每种2-3滴。', 2),
  (38, '魔法触碰', '棉签一端蘸少量洗洁精，轻轻触碰牛奶表面有色素的地方，观察颜色的变化。', 3),
  (38, '探索更多', '尝试在不同位置触碰，观察颜色旋转和混合的效果，在记录本上写下洗洁精如何破坏牛奶的表面张力。', 4);

-- [16] 气球火箭
UPDATE public.projects SET description = '用气球和绳子制作一枚能沿绳索飞行的"火箭"，感受反作用力的威力。这个实验完美演示了牛顿第三定律——每个作用力都有一个方向相反的反作用力。', difficulty_stars = 1 WHERE id = 16;
DELETE FROM public.project_steps WHERE project_id = 16;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (16, '搭建发射轨道', '将绳子穿过吸管，然后将绳子两端分别固定在房间两端的椅子上，拉紧绳子。', 1),
  (16, '安装气球', '给气球吹满气，用夹子夹住气球口防止漏气，然后用胶带将气球粘贴在吸管上。', 2),
  (16, '发射火箭', '将气球移到绳子一端，松开夹子，观察气球沿绳子快速滑行到另一端。', 3),
  (16, '对比实验', '分别用不同充气量发射气球，记录每次飞行的距离和速度变化。', 4),
  (16, '记录实验数据', '在记录本上写下每次充气量对应的飞行距离，画出对比图，标注气体向后喷出如何产生反作用力推动气球前进。', 5);

-- [81] 种子发芽观察日记
UPDATE public.projects SET description = '选择几种常见的种子，在不同条件下进行发芽实验。每天观察并记录种子的变化过程，了解种子萌发所需的条件以及植物生长的基本规律。', difficulty_stars = 3 WHERE id = 81;
DELETE FROM public.project_steps WHERE project_id = 81;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (81, '准备种子', '挑选饱满的绿豆或黄豆，提前用清水浸泡一晚让种皮变软。', 1),
  (81, '布置发芽环境', '在塑料杯底铺上湿纸巾或棉花，将泡好的种子均匀摆放在上面。', 2),
  (81, '设置对照组', '一杯放在有光的窗台、一杯放在黑暗的柜子里、一杯不浇水，观察不同条件的影响。', 3),
  (81, '每日观察记录', '每天用喷壶给需要浇水的杯子保湿，观察种子的变化并画下来或拍照记录。', 4),
  (81, '总结发现', '一周后对比三杯种子的发芽情况，总结种子发芽需要哪些条件。', 5);

-- [83] 制作干花书签
UPDATE public.projects SET description = '用压花技术将美丽的花朵保存下来，制作独一无二的干花书签。认识不同花卉的结构。', difficulty_stars = 3 WHERE id = 83;
DELETE FROM public.project_steps WHERE project_id = 83;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (83, '采集花朵', '选择小巧扁平的花朵和叶片，采集后轻轻擦干表面水分。', 1),
  (83, '压花干燥', '将花朵摆放在报纸上，合上书本压紧，等待5-7天完全干燥。', 2),
  (83, '设计构图', '在卡纸书签上摆放干花，尝试不同的排列方式，选择最喜欢的构图。', 3),
  (83, '粘贴固定', '用白乳胶小心地将干花粘在卡纸上，轻轻按压使其贴合。', 4),
  (83, '覆膜保护', '用透明胶带或覆膜纸覆盖书签正面，保护干花不脱落，再穿上丝带装饰。', 5);

-- [20] 简易万花筒
UPDATE public.projects SET description = '用镜面材料制作一个万花筒，透过它看到无穷无尽的美丽图案。你将学习光的反射原理，理解多面镜子如何通过反复反射创造出对称的图案。', difficulty_stars = 2 WHERE id = 20;
DELETE FROM public.project_steps WHERE project_id = 20;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (20, '制作反射镜', '将三条等宽的镜面卡纸拼成三棱柱形状，镜面朝内，用胶带固定好。', 1),
  (20, '组装筒身', '将三棱镜组插入纸筒中，确保它贴合紧密不会滑动。', 2),
  (20, '制作彩色仓', '在纸筒一端放一片透明塑料片，加入小珠子和亮片，再盖上第二片透明塑料片并密封。', 3),
  (20, '制作观察孔', '在纸筒另一端用纸板封住，中间留一个小圆孔作为观察孔。', 4),
  (20, '欣赏万花世界', '对着光源，透过观察孔旋转万花筒，欣赏镜面反复反射形成的对称图案，数一数你能看到多少个重复的图形。', 5);

-- [44] 隐形墨水
UPDATE public.projects SET description = '用柠檬汁作为隐形墨水写下秘密信息，再用加热的方式让字迹显现！你将了解柠檬汁中的有机物在加热后发生氧化反应而变色的原理。像间谍一样传递秘密信息。', difficulty_stars = 2 WHERE id = 44;
DELETE FROM public.project_steps WHERE project_id = 44;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (44, '制作墨水', '将柠檬切开，挤出柠檬汁到小碗中，可以加入少量清水稀释。', 1),
  (44, '书写秘密信息', '用棉签蘸取柠檬汁，在白纸上写字或画图，等待纸张完全干透。', 2),
  (44, '晾干检查', '纸张干透后，字迹几乎不可见，可以让家人猜猜纸上写了什么。', 3),
  (44, '加热显字', '在家长帮助下，用台灯或吹风机对纸张加热，观察字迹慢慢变为棕色显现出来。', 4),
  (44, '总结原理', '写下为什么加热后字迹会显现：柠檬酸是有机物，受热后发生氧化反应变成棕色。', 5);

-- [69] 贝壳收集与分类
UPDATE public.projects SET description = '在海边或水族市场收集各种贝壳，按照形状、颜色、大小和纹理进行分类整理。学习科学分类的基本方法，了解不同贝类动物的外壳特征和生活环境。', difficulty_stars = 2 WHERE id = 69;
DELETE FROM public.project_steps WHERE project_id = 69;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (69, '收集贝壳', '在海边、河边或水族市场收集尽量多种类的贝壳，清洗干净晾干。', 1),
  (69, '观察与测量', '用放大镜观察每个贝壳的纹理、颜色和形状，用直尺量出长度和宽度，记录特征。', 2),
  (69, '分类整理', '按照你选定的标准（如单壳/双壳、螺旋形/扇形、大小）将贝壳分成不同组。', 3),
  (69, '制作标签', '为每个贝壳写标签，包括名称（如能辨认）、尺寸、采集地点和分类组别。', 4),
  (69, '制作展示板', '将分好类的贝壳粘贴或摆放在展示板上，配上手绘图和文字说明，制作成贝壳标本展。', 5);

-- [112] 土壤分层实验
UPDATE public.projects SET description = '脚下的土壤其实是由不同成分混合而成的。你将把土壤放入水中搅拌，观察静置后土壤自然分成不同的层次。了解土壤中沙、粉砂、黏土和有机质的组成以及沉积分层的原理。', difficulty_stars = 2 WHERE id = 112;
DELETE FROM public.project_steps WHERE project_id = 112;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (112, '收集土壤', '从花园或户外挖取约半杯土壤，去掉大块石子和树根，放入透明容器中。', 1),
  (112, '加水搅拌', '在容器中加入清水至约四分之三满，盖紧盖子，用力摇晃约一分钟，让土壤充分与水混合。', 2),
  (112, '静置观察', '将容器放在平稳的桌面上静置，不要移动。每隔30分钟观察一次，记录变化，最好静置24小时。', 3),
  (112, '测量分层', '用尺子测量每一层的厚度，你会看到底部是沙粒，中间是粉砂，上面是黏土，水面可能漂浮有机质。', 4),
  (112, '标注和记录', '用标签在容器外侧标出各层名称和厚度，在记录本上画出分层示意图并写下你的发现。', 5);

-- [114] 彩虹形成条件记录
UPDATE public.projects SET description = '彩虹是怎么出现的？你将用喷水壶在阳光下制造彩虹，并记录彩虹出现时的条件。学习光的折射和色散原理，理解自然界中彩虹形成的科学条件。', difficulty_stars = 2 WHERE id = 114;
DELETE FROM public.project_steps WHERE project_id = 114;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (114, '室内初探', '如果有三棱镜，先在室内让阳光穿过三棱镜照到白纸上，观察白光被分解成七种颜色的现象。', 1),
  (114, '制造彩虹', '在晴天的户外，背对太阳站立，用喷水壶向前方喷出细密的水雾，观察水雾中是否出现彩虹。', 2),
  (114, '改变条件', '尝试改变喷水的角度、方向和水雾的粗细，记录哪种条件下彩虹最清晰、颜色最鲜艳。', 3),
  (114, '记录颜色顺序', '仔细观察彩虹中颜色的排列顺序，用彩色笔在记录本上按顺序画出赤、橙、黄、绿、蓝、靛、紫七色。', 4),
  (114, '总结形成条件', '记录彩虹出现时太阳的位置、你面对的方向和水雾的状态，总结彩虹形成需要的三个条件：光源、水滴和正确的角度。', 5);

-- [87] 花的解剖观察
UPDATE public.projects SET description = '挑选一朵完整的花，小心地将各个部分分离并观察。认识花萼、花瓣、雄蕊和雌蕊等结构，了解花的基本组成和各部分的功能。', difficulty_stars = 2 WHERE id = 87;
DELETE FROM public.project_steps WHERE project_id = 87;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (87, '外部观察', '先整体观察花朵，数一数花瓣有几片，闻一闻花的气味，用放大镜观察细节。', 1),
  (87, '分离各部分', '用镊子从外向内依次取下花萼、花瓣、雄蕊和雌蕊，轻放在白纸上。', 2),
  (87, '观察结构', '用放大镜仔细观察每个部分，注意雄蕊顶端的花粉和雌蕊的形状。', 3),
  (87, '制作解剖图', '将各部分用双面胶粘在记录本上，旁边画出结构示意图并标注名称。', 4),
  (87, '查阅并记录功能', '查阅资料了解各部分的功能，思考花朵为什么需要这些结构来完成繁殖。', 5);

-- [63] 小区鸟类图鉴
UPDATE public.projects SET description = '在一周内多次到小区或公园里观察鸟类，用文字和图画记录它们的外形特征、叫声和行为，最终制作成一本属于自己的鸟类图鉴小册子。', difficulty_stars = 3 WHERE id = 63;
DELETE FROM public.project_steps WHERE project_id = 63;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (63, '选择观察地点', '选择小区花园、湖边或公园等鸟类经常出没的地方，确定3～5个固定观察点。', 1),
  (63, '多次观察记录', '在一周内的不同时间段（清晨和傍晚最佳）前往观察点，记录看到的鸟类。', 2),
  (63, '绘制鸟类插图', '根据观察和拍照，为每种鸟画一幅彩色插图，标注关键特征（喙形、羽色、体型）。', 3),
  (63, '查阅资料', '借助图鉴或网络确认每种鸟的名称、食性和生活习性，写成简短的文字介绍。', 4),
  (63, '装订成册', '将所有插图和文字按顺序排列，装订成一本小册子，设计封面。', 5),
  (63, '完成作品展示', '拍照记录你的图鉴成品。', 6);

-- [90] 水果氧化实验
UPDATE public.projects SET description = '切开苹果后观察它为什么会变褐色，并测试不同方法能否阻止变色。通过对比实验了解水果中酚类物质的氧化反应，', difficulty_stars = 2 WHERE id = 90;
DELETE FROM public.project_steps WHERE project_id = 90;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (90, '切苹果', '将苹果切成大小相同的5片，分别放在5个小盘子中编号。', 1),
  (90, '设置实验组', '1号不做处理，2号涂柠檬汁，3号泡盐水，4号覆盖保鲜膜，5号放入冰箱。', 2),
  (90, '定时观察', '每隔15分钟观察一次每片苹果的颜色变化，记录变色程度。', 3),
  (90, '对比分析', '2小时后比较5片苹果的颜色差异，排列出变色速度从快到慢的顺序。', 4),
  (90, '查阅并记录原理', '查阅资料了解苹果变色的原因（酚类氧化），在记录本上写下哪些方法可以有效防止氧化及其原理。', 5);

-- [45] 碘液检测淀粉
UPDATE public.projects SET description = '用碘酒测试各种食物中是否含有淀粉，看看哪些食物会变成蓝紫色！你将学习碘遇淀粉变色这一经典化学检测方法。，了解不同食物的成分差异。', difficulty_stars = 2 WHERE id = 45;
DELETE FROM public.project_steps WHERE project_id = 45;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (45, '准备食物样品', '将面包、米饭、苹果、土豆等食物分别放在白色小盘子中，每份取少量即可。', 1),
  (45, '预测结果', '在记录纸上列出所有食物名称，先猜测哪些含淀粉、哪些不含。', 2),
  (45, '滴加碘酒', '用滴管在每种食物上滴1-2滴碘酒，仔细观察颜色变化。', 3),
  (45, '记录与对比', '记录每种食物滴碘酒后的颜色，变蓝紫色的说明含有淀粉，与预测结果对比。', 4),
  (45, '总结规律', '总结哪些食物含淀粉较多，在记录本上写下淀粉在我们饮食中的作用。', 5);

-- [67] 蜘蛛织网观察
UPDATE public.projects SET description = '在花园或阳台角落找到蜘蛛网，仔细观察蜘蛛网的结构和蜘蛛的织网过程。了解蜘蛛网的几何之美和蜘蛛捕食的策略，认识蛛形纲动物的特征。', difficulty_stars = 2 WHERE id = 67;
DELETE FROM public.project_steps WHERE project_id = 67;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (67, '寻找蜘蛛网', '在花园的树枝间、窗户角落或灌木丛中寻找完整的蜘蛛网。', 1),
  (67, '观察网的结构', '用放大镜仔细观察蜘蛛网的形状，数一数有多少条辐射丝和螺旋丝，画出网的结构图。', 2),
  (67, '喷水显形', '用喷雾瓶轻轻向蜘蛛网喷水雾，水珠会挂在丝上，让网的结构更加清晰，适合拍照记录。', 3),
  (67, '观察捕食行为', '耐心等待，观察当小虫触网时蜘蛛的反应和捕食过程，记录整个过程。', 4),
  (67, '查阅并记录蜘蛛特征', '查阅资料，了解蜘蛛与昆虫的区别（8条腿vs6条腿），写出蛛形纲动物的主要特征。', 5);

-- [68] 螃蟹行为观察
UPDATE public.projects SET description = '观察小螃蟹的爬行方式、进食行为和对环境的反应。通过简单的实验了解螃蟹为什么横着走路，认识甲壳动物的身体结构与运动方式的关系。', difficulty_stars = 2 WHERE id = 68;
DELETE FROM public.project_steps WHERE project_id = 68;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (68, '布置观察环境', '在浅水盆中铺一层细沙和小石子，加入少量水，模拟螃蟹的自然生活环境。', 1),
  (68, '观察身体结构', '用放大镜观察螃蟹的身体，数一数它有几条腿、几只螯，画出身体结构图。', 2),
  (68, '观察爬行方式', '轻轻把螃蟹放在平面上，观察它的爬行方向和腿的运动方式，记录它为什么横着走。', 3),
  (68, '进食观察', '在螃蟹面前放一小块鱼肉，观察它如何用螯夹取食物、如何送入口中。', 4),
  (68, '总结报告', '整理观察记录，画出螃蟹的运动示意图，写出甲壳动物的主要特征。', 5);

-- [65] 蚯蚓与土壤实验
UPDATE public.projects SET description = '通过对比实验观察蚯蚓对土壤的改良作用。将蚯蚓放入分层土壤中，连续观察土壤层的变化，了解蚯蚓在生态系统中的重要角色。', difficulty_stars = 3 WHERE id = 65;
DELETE FROM public.project_steps WHERE project_id = 65;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (65, '准备分层土壤', '在透明瓶中交替铺入花园土和细沙，各约2厘米厚，共铺3～4层，最上面撒一层落叶碎片。', 1),
  (65, '放入蚯蚓', '将蚯蚓轻轻放在土壤表面，喷少量水保持湿润，用深色纸包住瓶身。', 2),
  (65, '每日观察', '每天揭开遮光纸，观察土壤各层的界限是否变模糊，记录蚯蚓的隧道痕迹。', 3),
  (65, '对比记录', '画出第1天、第3天和第7天的土壤分层变化图进行对比。', 4),
  (65, '总结实验发现', '在记录本上写下蚯蚓如何混合土壤、改善土壤结构，以及蚯蚓对植物生长的帮助。实验结束后将蚯蚓放回花园。', 5);

-- [66] 鱼的呼吸观察
UPDATE public.projects SET description = '通过观察鱼的鳃盖开合来探究鱼的呼吸方式。在不同水温条件下计数鳃盖运动频率，了解温度对鱼呼吸速率的影响，认识水生动物的呼吸适应。', difficulty_stars = 2 WHERE id = 66;
DELETE FROM public.project_steps WHERE project_id = 66;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (66, '观察鳃盖运动', '将鱼放入清水鱼缸中静置10分钟，然后仔细观察鱼嘴和鳃盖的一张一合运动。', 1),
  (66, '计数呼吸频率', '用计时器计时1分钟，数鱼的鳃盖开合次数，重复三次取平均值。', 2),
  (66, '改变水温测试', '缓慢加入少量温水使水温升高约3～5度，等鱼适应后再次计数呼吸频率。', 3),
  (66, '记录数据', '将不同水温下的呼吸频率记录在表格中，画出简单的柱状图。', 4),
  (66, '分析与总结', '比较不同水温下鱼的呼吸频率，在记录本上写下温度如何影响鱼的呼吸，思考鱼用鳃呼吸与人用肺呼吸的区别。', 5);

-- [110] 岩石收集与分类
UPDATE public.projects SET description = '地球上的岩石各不相同，它们有的来自火山，有的来自海底沉积，有的经历了高温高压的变化。你将外出收集不同的岩石，通过观察颜色、纹理和硬度，学习将岩石分为火成岩、沉积岩和变质岩三大类。', difficulty_stars = 2 WHERE id = 110;
DELETE FROM public.project_steps WHERE project_id = 110;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (110, '外出收集', '去公园、河边或山脚下收集8-10块不同外观的岩石，注意记录每块岩石的发现地点。', 1),
  (110, '清洗和编号', '回家后用清水冲洗岩石，晾干后用标签贴纸给每块岩石编号。', 2),
  (110, '观察特征', '用放大镜仔细观察每块岩石的颜色、纹理、有无晶体或层状结构，用硬币刮擦测试硬度，并记录下来。', 3),
  (110, '分类归组', '对照岩石分类参考图，根据观察到的特征尝试将岩石分为火成岩、沉积岩和变质岩三大类。', 4),
  (110, '制作岩石标本卡', '为每块岩石制作一张标本卡，写上编号、发现地点、特征描述和分类结果。', 5),
  (110, '完成标本展示', '将岩石和标本卡摆放整齐，拍照记录你的岩石标本集。', 6);

-- [111] 月相观察日记
UPDATE public.projects SET description = '月亮为什么有时圆有时弯？你将在一个月内持续观察月亮的形状变化，用画笔记录每天看到的月相。理解月球绕地球运动导致月相周期变化的科学原理。', difficulty_stars = 3 WHERE id = 111;
DELETE FROM public.project_steps WHERE project_id = 111;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (111, '制作月相参考卡', '查看月相参考图，在卡片上画出新月、上弦月、满月、下弦月的形状，标注名称，作为每日观察的对照工具。', 1),
  (111, '室内模拟', '在暗室里用手电筒代表太阳，小球代表月球，绕着你的头转动，观察小球被照亮部分的变化。', 2),
  (111, '每日观察记录', '每天晚上在同一时间同一地点观察月亮，在记录表上画出月亮的形状，标注日期。', 3),
  (111, '标注月相名称', '对照参考图，为每天记录的月亮形状标注正确的月相名称。', 4),
  (111, '总结月相规律', '一个月后回顾所有记录，总结月相变化的周期规律，画出完整的月相变化图。', 5);

-- [313] 编织友谊手链
UPDATE public.projects SET description = '用彩色绣线编织精美的友谊手链，掌握基本的编织技法和图案搭配。在编织过程中锻炼耐心和手指协调能力，完成后送给好朋友传递友谊。', difficulty_stars = 2 WHERE id = 313;
DELETE FROM public.project_steps WHERE project_id = 313;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (313, '准备线材', '选择4根不同颜色的绣线，对齐后在一端打结，留出约5厘米做系带，用胶带将结固定在桌面上。', 1),
  (313, '练习基本结', '用最左边的线绕第二根线打两个正结，依次向右对每根线重复，完成一行后最左边的线变到最右边。', 2),
  (313, '编织图案', '重复基本结的步骤，每次都从最左边开始，编织到手链达到适合手腕的长度。', 3),
  (313, '尝试变化', '学会基本编法后，尝试反向结或V形图案，创造更丰富的花纹效果。', 4),
  (313, '收尾打结', '编到合适长度后打一个紧实的结，修剪多余线头，将两端系在一起佩戴。', 5);

-- [314] 风筝制作与放飞
UPDATE public.projects SET description = '用竹条和轻薄纸张制作一只传统菱形风筝，在户外放飞感受风的力量。在制作和放飞中体会空气动力学基础知识，体验传统手工艺的魅力。', difficulty_stars = 2 WHERE id = 314;
DELETE FROM public.project_steps WHERE project_id = 314;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (314, '搭建骨架', '将两根竹条十字交叉绑扎在一起，长竹条竖放，短竹条横放在上方约三分之一处。', 1),
  (314, '绷线围边', '沿四个竹条端点用线拉出菱形轮廓，在每个端点上用线缠绕固定。', 2),
  (314, '蒙面装饰', '将纸张裁剪成比菱形稍大的形状，翻折边缘包住围线并用胶水粘牢，在纸面上画上喜欢的图案。', 3),
  (314, '系提线', '在竹条交叉点和下端点系上提线，调整长度使风筝倾斜约15-20度角。', 4),
  (314, '安装尾巴', '在风筝底部系上一条约1米长的布条尾巴，帮助风筝在空中保持平衡。', 5),
  (314, '放飞试验', '选择空旷有风的场地，逆风奔跑放线让风筝升空，通过收放线控制高度和方向。', 6);

-- [316] 纸浆画
UPDATE public.projects SET description = '将废旧报纸制成彩色纸浆，在画板上堆塑出立体的浮雕画作品。这种独特的创作方式让你在环保再利用中感受材料的可塑性，创造出富有层次感的艺术作品。', difficulty_stars = 2 WHERE id = 316;
DELETE FROM public.project_steps WHERE project_id = 316;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (316, '制作纸浆', '将报纸撕成碎片放入盆中加水浸泡一小时，然后用手反复揉搓直到变成细腻的纸浆。', 1),
  (316, '调配彩色纸浆', '挤去多余水分后将纸浆分成几份，分别加入不同颜色的颜料和适量白乳胶搅拌均匀。', 2),
  (316, '画出底稿', '在硬纸板上用铅笔画出想要表现的图案轮廓，如花朵、动物或风景。', 3),
  (316, '堆塑造型', '将不同颜色的纸浆按照底稿堆塑在纸板上，用手指按压塑形，营造出高低起伏的浮雕效果。', 4),
  (316, '晾干完成', '将作品放在通风处自然晾干（约需1-2天），干燥后纸浆会变硬定型，形成持久的立体画面。', 5);

-- [317] 毛毡小挂件
UPDATE public.projects SET description = '用彩色不织布（毛毡）裁剪缝制可爱的小挂件，如水果、动物或星星。通过掌握基础手缝针法，锻炼细心和耐心，制作出可以挂在书包上的精美饰品。', difficulty_stars = 2 WHERE id = 317;
DELETE FROM public.project_steps WHERE project_id = 317;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (317, '设计模板', '在纸上画出想要制作的挂件形状（如小草莓、小猫脸），剪下作为裁剪模板。', 1),
  (317, '裁剪毛毡', '将模板放在毛毡上描出轮廓，剪出前后两片相同形状以及眼睛、嘴巴等装饰小件。', 2),
  (317, '装饰正面', '用针线或胶水将五官、花纹等装饰小件固定在正面毛毡片上。', 3),
  (317, '缝合填充', '将前后两片对齐，用毯边缝沿边缘缝合，留一小口塞入填充棉后缝合封口。', 4),
  (317, '安装挂件', '在顶部缝上挂绳或扣上钥匙扣配件，一个可爱的毛毡小挂件就完成了。', 5);

-- [338] 锡纸雕塑
UPDATE public.projects SET description = '利用厨房锡纸的可塑性，揉捏折叠出各种立体造型。锡纸独特的金属质感让作品充满现代感，你能快速看到成果，体验三维塑形的乐趣。', difficulty_stars = 2 WHERE id = 338;
DELETE FROM public.project_steps WHERE project_id = 338;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (338, '裁剪锡纸', '根据要制作的造型大小，裁剪出不同尺寸的锡纸片，大件用大张锡纸，细节用小张。', 1),
  (338, '塑造基本形状', '将锡纸揉成球形、柱形或锥形等基本几何体，作为雕塑的各个部位。', 2),
  (338, '拼接组装', '将各部件用锡纸条缠绕连接在一起，可以用揉捏和折叠的方式加固连接处。', 3),
  (338, '精细塑形', '用手指轻轻调整造型细节，捏出翅膀、尾巴等精细部分，用剪刀修剪多余部分。', 4),
  (338, '装饰展示', '可以用马克笔在锡纸表面画上眼睛等装饰，将作品固定在硬纸板底座上展示。', 5);

-- [337] 超轻黏土多肉盆栽
UPDATE public.projects SET description = '用超轻黏土制作逼真的多肉植物盆栽，掌握仿真造型技巧。通过观察真实多肉植物的叶片排列和色彩变化，提升精细造型能力和色彩感知力。', difficulty_stars = 2 WHERE id = 337;
DELETE FROM public.project_steps WHERE project_id = 337;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (337, '参考多肉特征', '找一张多肉植物的参考图片，注意叶片的形状、排列方式和颜色渐变，用铅笔在纸上简单勾画出目标造型。', 1),
  (337, '制作叶片', '取绿色黏土搓成水滴形，用手指压扁成叶片状，叶尖处可混入少量粉色或紫色黏土做出渐变效果。', 2),
  (337, '组装多肉', '从中心开始，将叶片围绕一个小黏土球逐层排列，外层叶片逐渐张开，模拟多肉的莲座状结构。', 3),
  (337, '制作花盆', '在小花盆底部填入棕色碎纸模拟泥土，也可以用棕色黏土做一个迷你花盆。', 4),
  (337, '组合与点缀', '将做好的多肉植物放入花盆中，添加小石子、苔藓等装饰，完成一盆精致的仿真多肉盆栽。', 5);

-- [295] 点彩画入门
UPDATE public.projects SET description = '掌握印象派大师修拉的点彩技法，用一个个小色点拼出完整的画面。当退后几步观看时，各色点会在眼中自动混合成丰富的色调，非常神奇。', difficulty_stars = 2 WHERE id = 295;
DELETE FROM public.project_steps WHERE project_id = 295;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (295, '铅笔起稿', '用铅笔在画纸上轻轻勾出简单的轮廓，比如一个苹果或一棵树。', 1),
  (295, '点彩练习', '用棉签蘸取颜料在纸的空白处练习点画，体会用圆点铺色的节奏。', 2),
  (295, '逐区填色', '从画面一个区域开始，用相近颜色的小圆点密集排列填满，点与点之间留有微小间隙。', 3),
  (295, '色彩混合', '在两种颜色的交界处穿插点上两种色的圆点，退后观看会发现它们自然融合成了新的色调。', 4),
  (295, '完成与欣赏', '完成全部填色后退后两三步观看整体效果，感受色点在视觉中融合的奇妙。', 5);

-- [315] 扎染 T 恤
UPDATE public.projects SET description = '用橡皮筋扎出各种花样，再浸入染料制作独一无二的扎染 T 恤。这门古老的染色工艺让你体验色彩的融合与渗透，每件作品都是不可复制的艺术品。', difficulty_stars = 2 WHERE id = 315;
DELETE FROM public.project_steps WHERE project_id = 315;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (315, '湿润衣物', '将白色 T 恤放入清水中浸透，拧去多余水分保持湿润状态。', 1),
  (315, '扎出花样', '根据想要的图案，将 T 恤揪起、折叠或卷绕后用橡皮筋扎紧，扎得越紧花纹越清晰。', 2),
  (315, '涂染颜料', '戴上手套，将不同颜色的染料分别挤在扎好的衣物不同区域，让颜色充分渗透。', 3),
  (315, '包裹静置', '用保鲜膜包裹染好的 T 恤放入塑料袋，静置6-8小时让颜色充分固定。', 4),
  (315, '拆线冲洗', '剪掉橡皮筋，先用冷水冲洗掉多余染料，直到水变清澈，展开欣赏独一无二的花纹。', 5);

-- [321] 刺绣入门
UPDATE public.projects SET description = '掌握基础刺绣针法，在绣布上绣出简单的花卉或文字图案。在一针一线中培养专注力和审美能力，体验这门优雅的传统手工艺术。', difficulty_stars = 3 WHERE id = 321;
DELETE FROM public.project_steps WHERE project_id = 321;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (321, '绷布描图', '将绣布固定在绷子上绷紧，用水消笔在布面上描出简单的花朵或字母图案。', 1),
  (321, '练习平针', '穿好线后从布背面起针，掌握最基础的平针绣：沿线条均匀地上下穿刺。', 2),
  (321, '练习回针', '练习回针绣法：每次向前一针再退回半针，形成连续不断的线条，适合勾勒轮廓。', 3),
  (321, '填充缎面绣', '练习缎面绣：用紧密平行的长短针填满花瓣等区域，呈现丝缎般的光泽效果。', 4),
  (321, '完成作品', '将整个图案绣完后在背面打结固定收针，修剪多余线头，作品可以装框展示。', 5);

-- [298] 自画像创作
UPDATE public.projects SET description = '对着镜子仔细观察自己的面部特征，掌握五官比例和位置关系，画出一幅属于自己的肖像画。自画像是训练观察力和表现力的经典绘画练习。', difficulty_stars = 3 WHERE id = 298;
DELETE FROM public.project_steps WHERE project_id = 298;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (298, '掌握比例关系', '认识面部基本比例：三庭五眼——脸部纵向三等分，横向约五个眼睛宽度。', 1),
  (298, '画出轮廓', '用铅笔轻轻画一个鸡蛋形的脸部轮廓，画出横竖中线辅助定位五官。', 2),
  (298, '定位五官', '对着镜子观察，在辅助线上标出眼睛、鼻子、嘴巴的位置，注意大小和间距。', 3),
  (298, '刻画特征', '仔细观察自己的特征——眉毛的弧度、鼻子的形状、嘴唇的厚薄，如实画出来。', 4),
  (298, '添加头发与细节', '画出自己的发型，添加耳朵和脖子，擦掉辅助线，可以用彩色铅笔上色。', 5);

-- [341] 纸浆立体雕塑
UPDATE public.projects SET description = '将废纸打成纸浆，混合胶水塑造成立体雕塑作品。纸浆雕塑是一种古老而环保的艺术形式，你可以体验材料从平面到立体的神奇转变过程。', difficulty_stars = 3 WHERE id = 341;
DELETE FROM public.project_steps WHERE project_id = 341;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (341, '制作纸浆', '将废纸撕成碎片浸泡在温水中数小时，用手捏碎成糊状，挤去多余水分。', 1),
  (341, '调配黏合剂', '在纸浆中加入白乳胶和少量面粉搅拌均匀，直到纸浆具有良好的可塑性和黏性。', 2),
  (341, '搭建骨架', '用气球、纸团或铁丝搭建雕塑的内部骨架结构，确定基本形态和比例。', 3),
  (341, '层层堆塑', '将纸浆一层层涂抹在骨架表面，逐步塑造出造型的细节，每层之间需要适当晾干。', 4),
  (341, '干燥打磨', '将作品放在通风处彻底晾干（可能需要1-2天），用砂纸打磨表面至光滑。', 5),
  (341, '上色完成', '用丙烯颜料为作品上色，可以涂一层清漆保护表面，展示你的纸浆雕塑杰作。', 6);

-- [342] 黏土浮雕创作
UPDATE public.projects SET description = '在平面黏土板上创作有凹凸层次的浮雕作品，掌握浮雕的基本构图和造型技法。浮雕介于绘画和雕塑之间，你将体会如何用有限的厚度表现丰富的空间层次。', difficulty_stars = 3 WHERE id = 342;
DELETE FROM public.project_steps WHERE project_id = 342;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (342, '设计图稿', '在纸上绘制浮雕草图，确定主题内容（如花卉、风景或动物），标注前景、中景和远景的层次关系。', 1),
  (342, '制作底板', '将黏土擀平成约1厘米厚的方形底板，放在硬纸板上方便搬动。', 2),
  (342, '勾勒轮廓', '用铅笔或工具在黏土底板上轻轻刻出设计图案的轮廓线。', 3),
  (342, '堆塑浮雕', '按照从背景到前景的顺序，逐层添加黏土，前景部分堆得更高更突出，背景部分保持较浅的浮雕效果。', 4),
  (342, '细节刻画', '用雕塑工具刻画细节纹理，如花瓣的脉络、叶片的锯齿等，丰富浮雕的表现力。', 5),
  (342, '晾干与上色', '将浮雕作品自然晾干，可以保持黏土原色，也可以用颜料上色增强视觉效果。', 6);

-- [300] 光影素描入门
UPDATE public.projects SET description = '通过画一个简单的球体或苹果，掌握用铅笔表现光影明暗的基本方法。理解亮面、暗面、投影和反光的关系，这是素描绘画的核心基础技能。', difficulty_stars = 3 WHERE id = 300;
DELETE FROM public.project_steps WHERE project_id = 300;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (300, '布置静物', '将球体放在桌上，用台灯从一侧照射，观察明暗分界线、投影和反光区域。', 1),
  (300, '画出轮廓', '用HB铅笔轻轻画出物体的外轮廓，标出明暗分界线的大致位置。', 2),
  (300, '铺设暗部', '用2B铅笔从暗面开始排线，线条方向一致，均匀铺出暗部的基本色调。', 3),
  (300, '加深层次', '用4B或6B铅笔加深最暗的部分，特别是明暗分界线附近和投影的根部。', 4),
  (300, '表现过渡', '在明暗交界处用不同力度的排线实现柔和过渡，让球体看起来圆润立体。', 5),
  (300, '提亮高光', '用可塑橡皮轻轻擦出高光点和反光区域，让画面产生光泽感。', 6);

-- [297] 透视法画街景
UPDATE public.projects SET description = '掌握一点透视的基本原理，画出一条向远方延伸的街道。通过实际绘画理解近大远小的空间规律，让平面的画纸呈现出立体的纵深感。', difficulty_stars = 3 WHERE id = 297;
DELETE FROM public.project_steps WHERE project_id = 297;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (297, '确定消失点', '在纸面中央偏上的位置标一个点作为消失点，画一条水平线作为视平线。', 1),
  (297, '画出道路', '从纸的底边两侧各引一条线到消失点，形成向远处收窄的街道。', 2),
  (297, '添加建筑', '在道路两侧画出高矮不一的建筑物，注意越远越小，所有纵深线都指向消失点。', 3),
  (297, '画出细节', '为建筑添加门窗、招牌，在街道上画出路灯、行人和车辆，越远越小。', 4),
  (297, '上色完成', '用彩色铅笔或马克笔为画面上色，近处颜色鲜艳、远处颜色灰淡，增强空间感。', 5);

-- [299] 水彩植物写生
UPDATE public.projects SET description = '选一株真实的花草进行观察写生，用水彩表现植物的形态和色彩变化。写生训练"看到什么画什么"的观察能力，是绘画进阶的重要基础练习。', difficulty_stars = 3 WHERE id = 299;
DELETE FROM public.project_steps WHERE project_id = 299;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (299, '仔细观察', '从不同角度观察植物，注意叶片的形状、花瓣的层次和颜色的深浅变化。', 1),
  (299, '铅笔起稿', '用铅笔轻轻画出植物的大致轮廓和主要枝叶的走向，不需要太多细节。', 2),
  (299, '铺设底色', '先用大笔蘸浅色为叶子和花朵铺上第一层底色，保持颜色通透。', 3),
  (299, '层层叠加', '等底色半干时叠加第二层颜色，表现叶脉、花瓣阴影等较深的部分。', 4),
  (299, '细节刻画', '用小笔画出叶片的细微纹理、花蕊的形态和茎秆的质感。', 5),
  (299, '调整完善', '退后观察整体效果，补充不够深的暗部、提亮高光区域，完成写生作品。', 6);

-- [320] 陶艺杯子
UPDATE public.projects SET description = '用陶土手捏技法制作一个独特的小杯子，体验泥土在手中变成器皿的神奇过程。掌握揉泥、捏塑和修整的陶艺基本功，感受这门延续数千年的古老手艺。', difficulty_stars = 3 WHERE id = 320;
DELETE FROM public.project_steps WHERE project_id = 320;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (320, '揉泥排气', '将陶土反复揉捏约5分钟，排出内部气泡使泥土均匀柔软，避免烧制时开裂。', 1),
  (320, '捏制杯身', '取一团泥搓成球形，用大拇指从中心按入向四周均匀推薄，慢慢捏出杯子形状，保持壁厚一致。', 2),
  (320, '安装杯把', '另取一小段泥搓成条状弯成C形，在杯身侧面刻画交叉纹路后用泥浆粘合杯把并抹平接缝。', 3),
  (320, '修整表面', '用刮刀和湿手指修整杯子的形状和表面，使之圆润光滑，底部压平确保能稳定放置。', 4),
  (320, '装饰上色', '在杯身刻画花纹或等完全干燥后用丙烯颜料上色，创作出个人专属的艺术杯子。', 5);

-- [322] 蜡烛制作
UPDATE public.projects SET description = '用蜡块和模具制作各种造型和颜色的手工蜡烛，还可以添加香精营造氛围。在制作中认识蜡的熔化与凝固过程，体验将液态材料变成固态艺术品的乐趣。', difficulty_stars = 3 WHERE id = 322;
DELETE FROM public.project_steps WHERE project_id = 322;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (322, '融化蜡块', '将蜡块放入小锅中隔水加热，缓慢搅拌直到完全融化成液态，注意温度不要过高。', 1),
  (322, '调色加香', '在液态蜡中加入蜡笔碎块调成喜欢的颜色，搅拌均匀，可选择加入几滴香精油。', 2),
  (322, '固定烛芯', '将烛芯底座粘在模具底部中央，烛芯上端绕在横放的筷子上保持垂直居中。', 3),
  (322, '浇注蜡液', '将调好色的蜡液缓慢倒入模具中，避免产生气泡，注意不要倒满留出一点余量。', 4),
  (322, '冷却脱模', '静置数小时等蜡完全凝固，如果表面出现凹陷可补浇少量蜡液，完全冷却后取出成品。', 5);

-- [319] 木工小板凳
UPDATE public.projects SET description = '使用基本木工工具制作一张简单实用的小板凳，掌握锯、钉、磨等基础技能。这是接触木工的入门项目，在安全操作中体验将木材变成家具的成就感。', difficulty_stars = 3 WHERE id = 319;
DELETE FROM public.project_steps WHERE project_id = 319;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (319, '量测标记', '在凳面板底部四角标记凳腿安装位置，确保四条腿对称均匀分布。', 1),
  (319, '打磨木材', '用粗砂纸打磨所有木材表面和边角，去除毛刺，再用细砂纸精磨至光滑。', 2),
  (319, '安装凳腿', '在标记位置涂上木工胶，将凳腿对准粘好后用铁钉或螺丝加固连接。', 3),
  (319, '检查稳固', '将小板凳放在平面上检查是否平稳，如有歪斜可用砂纸微调凳腿底部。', 4),
  (319, '装饰完成', '可以用彩色颜料或木蜡油涂刷表面，既美观又能保护木材，等待完全干燥后使用。', 5);

-- [318] 皮影戏道具制作
UPDATE public.projects SET description = '用卡纸制作可活动的皮影戏人物道具，搭建小型皮影舞台进行表演。在制作中认识中国传统皮影艺术，掌握关节连接技术，并通过光影表演发挥创造力。', difficulty_stars = 3 WHERE id = 318;
DELETE FROM public.project_steps WHERE project_id = 318;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (318, '设计角色', '在纸上画出皮影人物的各个部件：头、身体、上臂、下臂、大腿、小腿，注意侧面轮廓要有特色。', 1),
  (318, '裁剪部件', '将设计好的部件画到卡纸上并仔细剪下，可以用美工刀刻出眼睛、衣纹等镂空装饰。', 2),
  (318, '连接关节', '在手臂、腿部关节处用小铜扣连接各部件，确保关节能灵活转动但不会松脱。', 3),
  (318, '安装操控杆', '在人物身体和手部各粘贴一根竹签作为操控杆，方便表演时控制动作。', 4),
  (318, '搭建舞台', '在桌子或纸箱上撑起白色幕布，在幕布后方放置台灯作为光源。', 5),
  (318, '排练表演', '将皮影人物贴近幕布操控表演，通过灯光投射出清晰的影子，编一个小故事进行演出。', 6);

-- [339] 铁丝骨架黏土人物
UPDATE public.projects SET description = '先用铁丝搭建人物骨架，再用黏土包裹塑造完整的人物雕塑。掌握专业雕塑中"先搭骨架再塑形"的工作方法，让人物造型更稳固、姿态更生动。', difficulty_stars = 3 WHERE id = 339;
DELETE FROM public.project_steps WHERE project_id = 339;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (339, '搭建骨架', '用铝丝弯折出人物的基本骨架结构：头部圆环、脊柱、手臂和腿部，用钳子拧紧各连接处。', 1),
  (339, '调整姿态', '参考姿态图片，弯曲铁丝骨架摆出想要的动作姿势，将脚部固定在底座上保持稳定。', 2),
  (339, '包裹躯干', '用黏土逐步包裹骨架，先从躯干开始，塑造出胸腔和腹部的基本体积。', 3),
  (339, '塑造四肢', '给手臂和腿部包裹黏土，注意表现肌肉的起伏和关节的转折。', 4),
  (339, '制作头部与细节', '在头部骨架上塑造脸部特征，添加头发、衣服褶皱等细节，用工具刻画纹理。', 5),
  (339, '整体调整', '退远观察整体比例和动态是否协调，进行最后的细节修饰和表面光滑处理。', 6);

-- [340] 石膏面具制作
UPDATE public.projects SET description = '用石膏绷带在气球上制作面具，体验面部雕塑的基础造型方法。掌握如何利用模具创作立体面具，并通过彩绘赋予面具独特的文化内涵。', difficulty_stars = 3 WHERE id = 340;
DELETE FROM public.project_steps WHERE project_id = 340;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (340, '制作模具', '将气球吹至脸部大小，在气球表面涂一层薄薄的凡士林方便后续脱模。', 1),
  (340, '贴敷石膏绷带', '将石膏绷带剪成小条状，逐条浸水后贴在气球的正面（约半球范围），交错叠放3-4层确保厚度均匀。', 2),
  (340, '塑造面部特征', '在石膏绷带未干时，用手指和工具塑出眉弓、鼻梁、颧骨等面部起伏，增加面具的立体感。', 3),
  (340, '脱模与修整', '待石膏完全干燥后，戳破气球取出，用剪刀修剪面具边缘，用砂纸打磨粗糙处。', 4),
  (340, '彩绘装饰', '用丙烯颜料为面具绘制图案，可以参考京剧脸谱、非洲面具或威尼斯面具等不同文化风格。', 5),
  (340, '安装佩戴', '在面具两侧打孔，穿上松紧带，一副独一无二的艺术面具就完成了。', 6);

-- [323] 竹编小篮子
UPDATE public.projects SET description = '用竹篾条编织一个精致的小篮子，掌握中国传统竹编的基本技法。在经纬交错的编织中体会传统匠人的智慧，完成一件兼具实用性与美感的手工作品。', difficulty_stars = 4 WHERE id = 323;
DELETE FROM public.project_steps WHERE project_id = 323;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (323, '浸泡竹篾', '将竹篾条在温水中浸泡半小时以上，使其变得柔软不易折断，方便编织。', 1),
  (323, '编织底部', '取6-8根竹篾十字交叉排列形成米字形底部骨架，用另一根竹篾从中心开始绕编固定。', 2),
  (323, '编到转角', '底部编到需要的大小后，将所有竖篾向上弯折90度，用夹子临时固定形成篮壁骨架。', 3),
  (323, '编织篮壁', '用竹篾条从底部交替穿插编织篮壁，每一层压紧使编织紧密均匀。', 4),
  (323, '收口整理', '篮壁编到理想高度后，将多余的竖篾向内折叠插入编织层中锁定，修剪多余部分。', 5),
  (323, '打磨完善', '用砂纸打磨篮子边缘和表面的毛刺，使之手感光滑，完成一个精致的小竹篮。', 6);

-- [343] 肥皂雕刻入门
UPDATE public.projects SET description = '用雕刻工具在肥皂上进行减材雕刻，掌握"去掉多余部分，留下想要的形状"的雕刻思维。肥皂质地柔软易于切削，是掌握减材雕刻的理想入门材料。', difficulty_stars = 4 WHERE id = 343;
DELETE FROM public.project_steps WHERE project_id = 343;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (343, '选择造型与画线', '选择一个简单的造型如鱼、乌龟或爱心，用铅笔在肥皂表面画出正面和侧面的轮廓线。', 1),
  (343, '粗略切削', '沿着轮廓线外侧约5毫米处，用塑料刀小心地切去大块多余部分，逐步露出基本形状。', 2),
  (343, '精细雕刻', '慢慢靠近轮廓线，用小刀片薄薄地削去多余材料，注意力度均匀避免切掉过多。', 3),
  (343, '刻画细节', '用牙签和小刀刻出眼睛、鳞片、纹理等细节，耐心地一点一点雕琢。', 4),
  (343, '打磨光滑', '用手指蘸少量水轻轻抹平表面的刀痕和粗糙处，让雕塑表面变得细腻光滑。', 5);

-- [344] 石膏雕刻
UPDATE public.projects SET description = '在预先浇注的石膏块上进行减材雕刻，体验接近真实石雕的创作过程。石膏比石头柔软但比肥皂坚硬，你将掌握使用专业雕刻工具进行造型创作。', difficulty_stars = 4 WHERE id = 344;
DELETE FROM public.project_steps WHERE project_id = 344;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (344, '浇注石膏块', '将石膏粉按比例与水混合倒入纸盒模具中，等待完全凝固后撕去纸盒，得到一块石膏坯。', 1),
  (344, '绘制轮廓', '在石膏块的多个面上用铅笔画出要雕刻的造型轮廓线，确定各方向的基本形状。', 2),
  (344, '粗雕定形', '戴好防护装备，用木刻刀沿轮廓线外侧大胆去除多余石膏，快速确定造型的基本体积。', 3),
  (344, '精雕细刻', '逐步缩小刀具和力度，仔细雕刻五官、衣纹等细节，注意从不同角度观察整体效果。', 4),
  (344, '打磨抛光', '用锉刀修整大面，再用不同号数的砂纸从粗到细打磨，直到表面达到理想的光滑度。', 5),
  (344, '上色保护', '可以保持石膏白色的纯净质感，也可以用丙烯颜料上色，最后涂一层清漆保护作品。', 6);

-- [346] 陶艺手捏花器
UPDATE public.projects SET description = '用陶土手捏成型制作一个可以使用的小花器，体验陶艺从泥到器的完整过程。掌握盘条法和捏塑法等陶艺基本技法，制作出兼具美观和功能性的作品。', difficulty_stars = 4 WHERE id = 346;
DELETE FROM public.project_steps WHERE project_id = 346;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (346, '揉泥排气', '将陶土反复揉捏排出内部气泡，使泥料质地均匀细腻，避免烧制时开裂。', 1),
  (346, '制作底部', '取一块泥搓成球状后按扁成圆饼，厚度约8毫米，作为花器底部。', 2),
  (346, '盘条筑壁', '将泥搓成均匀的长条，沿底部边缘一圈圈往上盘，每层之间用手指压紧粘合，逐渐筑高器壁。', 3),
  (346, '塑造外形', '用手和工具修整花器的形状，可以做成直筒形、鼓肚形或不规则的有机形态。', 4),
  (346, '表面处理', '用湿海绵抹平表面，可以刻上花纹或压印纹理作为装饰，制作完后用保鲜膜包裹慢慢阴干。', 5),
  (346, '上釉装饰', '阴干后涂上釉料或丙烯颜料，如有条件可以送去窑炉烧制，没有条件自然干透也可使用。', 6);

-- [302] 油画棒风景创作
UPDATE public.projects SET description = '用油画棒丰富的色彩和厚重的质感，描绘一幅充满阳光的风景画。掌握油画棒的叠色、混色和刮画技法，创作出色彩浓郁、层次丰富的风景作品。', difficulty_stars = 4 WHERE id = 302;
DELETE FROM public.project_steps WHERE project_id = 302;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (302, '构图起稿', '用铅笔轻轻画出风景的基本构图：天空、远山、近处的草地和树木。', 1),
  (302, '铺设天空', '用蓝色和白色油画棒大面积涂抹天空，用纸巾轻轻揉擦使颜色均匀柔和。', 2),
  (302, '绘制远景', '用灰蓝和浅紫色画远处的山峦，颜色要淡，表现空气透视的效果。', 3),
  (302, '丰富中景', '用黄绿、深绿交替涂抹草地和树木，颜色可以叠加混合增加层次。', 4),
  (302, '刻画近景', '用鲜艳浓重的颜色画出近处的花草和石头细节，可以用刮刀刮出草叶纹理。', 5),
  (302, '统一调整', '退后审视整体画面，补充不足的色彩，用刮画技法添加光线和纹理效果。', 6);

-- [301] 一点透视建筑画
UPDATE public.projects SET description = '运用一点透视法精确绘制建筑物的室内或室外空间，表现真实的空间纵深。在掌握透视线汇聚原理的基础上，创作出具有建筑感的完整画面。', difficulty_stars = 4 WHERE id = 301;
DELETE FROM public.project_steps WHERE project_id = 301;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (301, '建立透视框架', '在纸面上画出视平线，确定一个消失点，从消失点向四周发散出多条辅助透视线。', 1),
  (301, '绘制主体建筑', '选择绘制一间房间的内部视角或一栋建筑的正面，用直尺沿透视线画出墙面、地面和天花板。', 2),
  (301, '添加结构细节', '画出窗户、门框、柱子等建筑元素，所有纵深方向的线条都严格汇聚于消失点。', 3),
  (301, '绘制装饰物', '在空间中添加家具、盆栽、画框等物件，注意它们的大小随距离而变化。', 4),
  (301, '上色与质感', '用马克笔或彩铅上色，通过色彩的深浅变化增强空间的前后层次。', 5),
  (301, '检查透视', '最后用直尺复查所有纵深线是否准确指向消失点，修正偏差后完成作品。', 6);

-- [345] 环保材料装置艺术
UPDATE public.projects SET description = '收集生活中的废旧物品，组合创作一件有主题的装置艺术作品。掌握当代艺术的表达方式，用废旧材料传达环保理念，锻炼创新思维和批判性思考。', difficulty_stars = 4 WHERE id = 345;
DELETE FROM public.project_steps WHERE project_id = 345;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (345, '确定主题', '围绕环保话题确定装置艺术的主题，如"海洋污染""过度消费"或"重生"，用文字记录创作构思。', 1),
  (345, '收集与分类', '在家中收集各种废旧物品，按材质和颜色分类整理，思考每种材料可以代表什么含义。', 2),
  (345, '设计结构', '画出作品草图，规划各种材料在作品中的位置和组合方式，考虑作品的稳定性。', 3),
  (345, '组装搭建', '用热熔胶、铁丝和扎带将材料按设计方案固定组合，从底部向上逐步搭建。', 4),
  (345, '上色与调整', '必要时用喷漆或颜料统一或强调色调，调整各部分位置确保视觉平衡。', 5),
  (345, '创作说明', '为作品写一段创作说明，解释主题含义和材料选择的原因，完成这件有态度的环保装置艺术。', 6);

-- [303] 色彩搭配与情绪表达
UPDATE public.projects SET description = '探索色彩与情绪的对应关系，用不同的色彩组合表达快乐、平静、忧伤等情感。理解色彩理论中的冷暖色调、互补色与类似色搭配，创作情感表达的抽象画。', difficulty_stars = 4 WHERE id = 303;
DELETE FROM public.project_steps WHERE project_id = 303;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (303, '认识色轮', '观察色轮图，认识原色、间色、互补色和类似色的位置关系。', 1),
  (303, '色彩联想', '闭上眼想象"快乐""平静""愤怒""忧伤"的感觉，思考每种情绪让你联想到什么颜色。', 2),
  (303, '快乐之画', '选用暖色调的鲜艳色彩（如黄、橙、亮粉），用自由奔放的笔触画一幅抽象画。', 3),
  (303, '平静之画', '选用蓝绿冷色调的柔和色彩，用平稳流畅的线条画第二幅抽象画。', 4),
  (303, '对比欣赏', '将不同情绪的画作放在一起对比，观察色彩如何影响画面的情感氛围，用铅笔在每幅画旁标注你感受到的情绪关键词。', 5),
  (303, '自由表达', '选择今天你最真实的心情，用你认为最合适的色彩搭配创作一幅情绪表达画。', 6);

-- [324] 木工收纳盒
UPDATE public.projects SET description = '使用锯切和榫接工艺制作一个实用的木质收纳盒，掌握精确量测和组装技巧。这个项目比板凳更进一步，引入简单的榫接结构，体验传统木工的精密与优雅。', difficulty_stars = 4 WHERE id = 324;
DELETE FROM public.project_steps WHERE project_id = 324;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (324, '设计尺寸', '根据收纳需求确定盒子的长、宽、高尺寸，在木板上用直角尺精确标出每块板材的裁切线。', 1),
  (324, '锯切板材', '沿标记线小心锯切出底板1块和侧板4块，锯口要平直，锯完后用砂纸打磨切面。', 2),
  (324, '制作榫口', '在侧板端部标记出指接榫的齿形并仔细锯切，让相邻两块侧板能像手指交叉一样咬合。', 3),
  (324, '组装胶合', '在榫口处涂木工胶，依次将四块侧板拼接咬合，再粘上底板，用夹子固定等待胶水干燥。', 4),
  (324, '打磨上油', '胶水干透后拆除夹子，用砂纸从粗到细打磨全部表面至光滑，涂上木蜡油保护木材。', 5);

-- [325] 皮革钥匙包
UPDATE public.projects SET description = '用植鞣革手工制作一个简约实用的钥匙包，掌握皮革裁剪、打孔和手缝技术。通过这个项目接触皮革手工艺的基础技能，完成一件可以日常使用的精美皮具。', difficulty_stars = 4 WHERE id = 325;
DELETE FROM public.project_steps WHERE project_id = 325;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (325, '裁剪皮料', '按照纸样模板在皮革上画线，用裁皮刀沿线裁出钥匙包的主体皮片。', 1),
  (325, '打斩定孔', '用间距规沿边缘画出缝线轨迹，再用菱斩沿轨迹打出均匀的缝孔。', 2),
  (325, '安装配件', '在标记位置安装按扣和钥匙圈挂钩，确保按扣公母面方向正确。', 3),
  (325, '双针手缝', '将蜡线两端各穿一根针，从第一个孔开始采用双针交叉缝法依次穿过每个缝孔。', 4),
  (325, '封边处理', '用砂纸打磨皮革边缘至圆润光滑，涂上封边液反复打磨直到边缘呈现光泽。', 5);

-- [326] 微缩家具制作
UPDATE public.projects SET description = '按照1:12的比例用巴尔沙木或硬纸板制作精致的微缩家具模型。掌握比例缩放的数学概念、精细加工和空间结构设计，打造出一套迷你又逼真的小家具。', difficulty_stars = 4 WHERE id = 326;
DELETE FROM public.project_steps WHERE project_id = 326;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (326, '设计图纸', '选择要制作的家具（如椅子或书桌），测量真实家具尺寸后按1:12缩小计算各部件尺寸并画出展开图。', 1),
  (326, '裁切部件', '在木片或卡纸板上标记尺寸，用美工刀沿线精确切割出每个部件。', 2),
  (326, '打磨修整', '用砂纸仔细打磨每个切割面和边角，确保部件尺寸准确、表面光滑。', 3),
  (326, '组装粘合', '按照设计图将各部件用白乳胶粘合组装，注意保持垂直和对称。', 4),
  (326, '上色装饰', '待胶水干透后用丙烯颜料上色，添加碎布做的小靠垫等细节装饰，使家具更加逼真。', 5);

-- [304] 动物解剖素描
UPDATE public.projects SET description = '掌握动物的基本骨骼和肌肉结构，通过理解内部构造来画出更准确生动的动物形象。从简单的几何形体出发逐步构建动物身体，是专业动物画的入门训练。', difficulty_stars = 4 WHERE id = 304;
DELETE FROM public.project_steps WHERE project_id = 304;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (304, '认识骨骼结构', '参考动物骨骼图，认识猫或狗等常见动物的骨骼框架和主要关节位置。', 1),
  (304, '几何概括', '用圆形、椭圆形和长方形等简单几何体概括出动物的头部、胸腔和臀部。', 2),
  (304, '连接关节', '用线条连接各几何体，表示脊柱、四肢和关节的连接关系，形成骨架草图。', 3),
  (304, '填充肌肉', '在骨架基础上画出肌肉的体积感，让身体各部分变得饱满且有弹性。', 4),
  (304, '勾勒外轮廓', '沿着肌肉形态画出动物的外部轮廓线和皮毛纹理，擦掉内部辅助线。', 5),
  (304, '添加细节', '刻画眼睛、鼻子、耳朵和爪子等细节，用不同硬度的铅笔表现毛发的质感。', 6);

-- [327] 木工鸟屋制作
UPDATE public.projects SET description = '用木板设计和搭建一座结构完整的小鸟房屋，可以悬挂在户外吸引鸟类栖息。这个项目综合运用量测、锯切、钻孔、组装等木工技能，是一次完整的木工实践。', difficulty_stars = 5 WHERE id = 327;
DELETE FROM public.project_steps WHERE project_id = 327;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (327, '绘制图纸', '设计鸟屋的尺寸（底板约15×15厘米），画出底板、前后板、侧板和屋顶板的裁切图纸。', 1),
  (327, '锯切板材', '按照图纸尺寸在木板上标线，用手工锯逐一锯切出所有部件，前板锯成五边形留出屋顶斜面。', 2),
  (327, '钻入口孔', '在前板中上部用电钻钻出直径约3-4厘米的圆形入口孔，入口下方钉一根短木棍做栖息杆。', 3),
  (327, '组装墙体', '先将四面墙板与底板用胶水和螺丝固定组装，确保各面垂直严密。', 4),
  (327, '安装屋顶', '将两块屋顶板以一定角度拼合成人字形屋顶，固定在墙体上方并确保能遮雨。', 5),
  (327, '防水悬挂', '全面打磨后涂刷防水木蜡油保护木材，在屋顶安装挂钩或绑上麻绳用于悬挂在树上。', 6);

-- [308] 连环画创作
UPDATE public.projects SET description = '构思一个简短的故事，用连续多幅画面来讲述，掌握叙事绘画的分镜技巧。连环画创作需要综合运用构图、人物设计、场景绘制和故事节奏等多种能力，是绘画的高级综合训练。', difficulty_stars = 5 WHERE id = 308;
DELETE FROM public.project_steps WHERE project_id = 308;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (308, '故事构思', '想一个有起因、经过和结果的简短故事，写出6-8个关键情节点。', 1),
  (308, '角色设计', '设计故事的主要角色，画出角色的正面、侧面造型，确定服装和标志性特征。', 2),
  (308, '分镜草稿', '用直尺在纸上画出格子，将每个情节分配到对应的格子中，草稿画出每格的构图。', 3),
  (308, '铅笔正稿', '在正式纸张上仔细画出每一格的画面，注意镜头远近变化和人物表情动作。', 4),
  (308, '描线上色', '用针管笔描出主要线条，添加对话气泡和文字，用彩色铅笔或马克笔上色。', 5),
  (308, '装订成册', '将所有页面按故事顺序排列，设计一个封面，装订成一本完整的连环画小册子。', 6);

-- [328] 布艺玩偶缝制
UPDATE public.projects SET description = '从打版裁剪到缝合填充，完整制作一个布艺玩偶。掌握服装打版的基础思路、多种手缝针法以及立体造型技巧，完成一个独一无二的柔软伙伴。', difficulty_stars = 5 WHERE id = 328;
DELETE FROM public.project_steps WHERE project_id = 328;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (328, '设计打版', '在纸上画出玩偶的身体、四肢、耳朵等各部件的纸样，注意留出约0.5厘米的缝份。', 1),
  (328, '裁剪布料', '将纸样固定在布料上用水消笔描出轮廓，每个部件裁剪正反两片，标记缝合对位点。', 2),
  (328, '缝合部件', '将每个部件的两片布正面相对，用回针缝沿轮廓线缝合，在不显眼处留返口。', 3),
  (328, '翻面填充', '从返口将每个部件翻到正面，用筷子或填充棒将填充棉均匀塞入，不要过满也不要太松。', 4),
  (328, '组装连接', '用藏针缝将四肢、耳朵等部件缝合到身体上，确保对称且连接牢固。', 5),
  (328, '装饰完成', '缝上纽扣做眼睛，用绣线绣出嘴巴和腮红，系上丝带或制作小衣服点缀玩偶。', 6);

-- [306] 水彩人物速写
UPDATE public.projects SET description = '用水彩快速捕捉人物的动态和神情，掌握用洗练的笔触表现人体比例和动作。水彩速写要求在短时间内抓住人物的主要特征，是训练绘画概括能力的高级练习。', difficulty_stars = 5 WHERE id = 306;
DELETE FROM public.project_steps WHERE project_id = 306;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (306, '掌握人体比例', '认识人体基本比例：成人约7-8个头高，儿童约5-6个头高，学会用头部大小衡量全身比例。', 1),
  (306, '动态线练习', '快速画出人物的动态线——从头顶到脚底的一条主要曲线，抓住姿态的核心动势。', 2),
  (306, '铅笔速写', '用铅笔在3分钟内快速勾出人物的大致轮廓和主要体块关系，不拘泥于细节。', 3),
  (306, '水彩铺色', '用大笔蘸取肤色为面部和手臂铺底色，趁湿加入衣服的主要颜色，让色彩自然渗透。', 4),
  (306, '强化特征', '趁半干时用浓色点出五官、头发和衣服的褶皱，笔触果断不犹豫。', 5),
  (306, '多幅练习', '用不同姿态的照片重复练习，每幅限时15分钟，通过大量速写提高概括能力。', 6);

-- [329] 金属丝雕塑
UPDATE public.projects SET description = '用铝线或铜丝弯折焊接出立体的人物、动物或抽象造型雕塑作品。在三维空间中构思和创作，锻炼空间想象力和手指精细操控能力，感受线条艺术的独特魅力。', difficulty_stars = 5 WHERE id = 329;
DELETE FROM public.project_steps WHERE project_id = 329;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (329, '构思设计', '在纸上从正面和侧面画出雕塑的线条草图，规划好哪些部分需要用一根线连贯完成。', 1),
  (329, '制作骨架', '取一根长金属丝从头部开始弯折出身体的基本骨架轮廓，在关键处拧紧固定。', 2),
  (329, '塑造细节', '用短段金属丝缠绕补充四肢、翅膀或尾巴等细节部分，用尖嘴钳精确弯折出手指或羽毛等。', 3),
  (329, '调整姿态', '整体审视雕塑的比例和姿态，用钳子微调各部分的弯曲角度使造型更加生动自然。', 4),
  (329, '安装底座', '在木块上钻孔，将雕塑底部的金属丝插入并用胶水固定，确保作品能稳定站立。', 5),
  (329, '打磨收尾', '用砂纸打磨金属丝末端避免扎手，可以喷涂透明漆保护金属表面防止氧化。', 6);

-- [305] 两点透视城市画
UPDATE public.projects SET description = '掌握两点透视法绘制复杂的城市建筑群，从街角视角展现高楼大厦的立体感和纵深感。两点透视是绘制建筑和场景的核心技法，需要精准的线条控制和空间理解。', difficulty_stars = 5 WHERE id = 305;
DELETE FROM public.project_steps WHERE project_id = 305;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (305, '建立透视系统', '画出视平线，在视平线两端各设一个消失点，两点间距要足够远以避免画面变形。', 1),
  (305, '画出第一栋建筑', '在两个消失点之间画一条竖直线作为建筑的近边棱，从棱的上下端向两个消失点引线，确定建筑的两个可见面。', 2),
  (305, '扩展建筑群', '在第一栋建筑周围添加更多高矮不一的建筑，所有水平线都严格指向左右两个消失点。', 3),
  (305, '丰富城市元素', '添加道路、人行道、路灯、车辆和行人等城市元素，注意透视的一致性。', 4),
  (305, '细节与质感', '为建筑画出窗户、广告牌、空调外机等细节，用不同线条密度表现不同材质。', 5),
  (305, '描线与阴影', '用针管笔或马克笔描出主要线条，添加光影效果，让城市画面更加真实有力。', 6);

-- [330] 榫卯结构木工
UPDATE public.projects SET description = '掌握中国传统榫卯工艺，不用一颗钉子制作一个稳固的木质结构作品。深入认识古代匠人的智慧结晶，体验凸榫与凹卯精密咬合的力学之美和文化底蕴。', difficulty_stars = 5 WHERE id = 330;
DELETE FROM public.project_steps WHERE project_id = 330;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (330, '研究榫卯结构', '通过图解对比几种基础榫卯类型：直角榫、半榫搭接和十字搭接，在纸上画出凸出的"榫"和凹入的"卯"的示意图，确定要制作的类型。', 1),
  (330, '精确画线', '选择制作直角榫连接，在两根木条端部用直角尺和卡尺精确标出榫头和卯眼的尺寸线。', 2),
  (330, '锯切榫头', '将木条夹在台钳上，用细齿锯沿标记线锯切出榫头形状，切面要平整垂直。', 3),
  (330, '凿刻卯眼', '在另一根木条上用凿子沿标记线小心凿出与榫头匹配的卯眼，反复试配直到榫卯能紧密咬合。', 4),
  (330, '试配组装', '将榫头插入卯眼中检验配合度，过紧则微调卯眼，过松则用木楔加固，追求"严丝合缝"的效果。', 5),
  (330, '完善作品', '全面打磨所有表面至光滑细腻，可涂上木蜡油展现木材天然纹理之美，完成一件不用钉子的传统木工作品。', 6);

-- [307] 综合材料拼贴画
UPDATE public.projects SET description = '将绘画与多种材料拼贴相结合，用布料、纸张、毛线、纽扣等创作一幅有丰富质感的综合艺术作品。打破单一绘画手法的局限，探索材料的无限创意可能。', difficulty_stars = 5 WHERE id = 307;
DELETE FROM public.project_steps WHERE project_id = 307;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (307, '确定主题', '选择一个创作主题，如"海底世界""梦中花园"或"城市夜景"，用铅笔在底板上画出构图草稿。', 1),
  (307, '绘制背景', '用丙烯颜料为画面铺设背景色调，可以是渐变色或纹理效果。', 2),
  (307, '剪裁拼贴', '从杂志中剪出需要的图案，用彩纸剪出形状，将布料裁成合适大小。', 3),
  (307, '层层粘贴', '按照从远到近、从大到小的顺序将材料逐层粘贴到画面上，注意疏密节奏。', 4),
  (307, '添加立体元素', '用纽扣做花朵、毛线做头发、麻绳做边框等，让画面产生丰富的触感和立体层次。', 5),
  (307, '绘画点睛', '最后用画笔添加绘画部分，如人物的表情、文字或装饰线条，统一整体风格。', 6);

-- [347] 人物头像雕塑
UPDATE public.projects SET description = '掌握人体头部的基本解剖结构，用黏土或陶土塑造写实的人物头像。这是雕塑艺术中最经典的训练项目之一，需要对骨骼、肌肉和五官比例有深入理解。', difficulty_stars = 5 WHERE id = 347;
DELETE FROM public.project_steps WHERE project_id = 347;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (347, '研究头部结构', '研究头部解剖参考图，认识头骨的基本形状、五官的比例关系（三庭五眼），以及面部肌肉的分布。', 1),
  (347, '搭建基本体积', '在雕塑架上堆出蛋形的头部基本体积，确定头部的大小和朝向，标记出五官的中线和水平线。', 2),
  (347, '塑造骨骼结构', '先塑出额骨、颧骨、下颌骨等骨性标志点，建立起头部的基本骨架感。', 3),
  (347, '雕刻五官', '按照"先整体后局部"的原则，逐步刻画眼窝、鼻子、嘴巴和耳朵，注意五官之间的比例和空间关系。', 4),
  (347, '深入塑造', '添加面部肌肉的起伏和转折，刻画眼睑、嘴唇等精细部分，让表情更加生动自然。', 5),
  (347, '整体调整', '不断从不同角度审视作品，调整对称性和比例，处理脖子与头部的连接，进行最终的表面光滑处理。', 6);

-- [348] 动态雕塑（悬挂）
UPDATE public.projects SET description = '制作可以随风摆动的悬挂式动态雕塑，掌握平衡原理与空间构成。灵感来源于艺术大师考尔德的活动雕塑，在艺术创作中融入物理平衡的科学知识。', difficulty_stars = 5 WHERE id = 348;
DELETE FROM public.project_steps WHERE project_id = 348;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (348, '设计与裁剪形状', '在卡纸上设计并剪出各种有趣的形状，如星形、月牙形、鱼形或抽象图形，大小各异，颜色丰富。', 1),
  (348, '制作悬臂', '将铝丝剪成不同长度的横杆，在每根横杆的两端弯出小钩用于悬挂部件。', 2),
  (348, '单层平衡测试', '先从最底层开始，在一根横杆两端分别挂上纸片，找到横杆的平衡点并用鱼线系牢。', 3),
  (348, '逐层向上搭建', '将已平衡的底层组件挂到上一层横杆的一端，另一端挂上新的纸片或下一组已平衡的组件，再次找到平衡点。', 4),
  (348, '微调整体平衡', '反复调整每层横杆的悬挂点和各部件的重量分布，确保整个雕塑在静止时保持水平平衡。', 5),
  (348, '悬挂调试', '在顶部横杆的平衡点系上鱼线，用挂钩挂在天花板或门框上，轻轻吹气观察各层的摆动幅度，必要时微调配重使动态更流畅。', 6);

-- [349] 大型纸板公共雕塑
UPDATE public.projects SET description = '利用回收的大型瓦楞纸板，团队协作搭建一座大型公共雕塑作品。这个项目锻炼团队协作能力和空间想象力，体验从设计到搭建大型作品的完整流程。', difficulty_stars = 5 WHERE id = 349;
DELETE FROM public.project_steps WHERE project_id = 349;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (349, '团队设计', '全体成员投票确定雕塑主题和造型，画出设计图并标注尺寸，将整体结构分解为可独立制作的模块。', 1),
  (349, '测量与裁切', '根据设计图在纸板上画出各个部件的展开图，用美工刀沿线精确裁切，注意预留折叠和连接的余量。', 2),
  (349, '折叠与加固', '将裁切好的纸板沿折线折叠成立体结构，在内部用三角形纸板加固支撑，确保结构牢固。', 3),
  (349, '模块拼装', '分组制作的各模块按设计方案用热熔胶和胶带连接在一起，逐步搭建出完整的大型造型。', 4),
  (349, '彩绘美化', '全体成员分工为雕塑上色，用丙烯颜料绘制图案和色彩，让纸板雕塑焕发生机。', 5),
  (349, '布置展示', '将大型雕塑搬运到公共空间，调整摆放角度和灯光，在旁边放置一张卡片写上作品名称和创作理念。', 6);

-- [350] 多材料组合雕塑
UPDATE public.projects SET description = '综合运用黏土、金属丝、木片、石膏、织物等多种材料创作一件组合雕塑。这是对所有雕塑技法的综合应用，你需要思考如何让不同材质和谐共存，表达统一的艺术主题。', difficulty_stars = 5 WHERE id = 350;
DELETE FROM public.project_steps WHERE project_id = 350;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (350, '确定主题与构思', '围绕一个主题进行创作构思，思考每种材料的质感特点以及它在作品中可以承担的角色和表达的情感。', 1),
  (350, '搭建骨架结构', '用铝丝和木片搭建雕塑的主体骨架，确保结构稳固并预留各种材料的附着空间。', 2),
  (350, '黏土与石膏造型', '在骨架上用黏土塑造主要造型，局部可浇注石膏增加质感对比和坚固度。', 3),
  (350, '添加金属元素', '用铜丝和铝丝弯折出线条感强的装饰部分，与柔软的黏土形成材质反差。', 4),
  (350, '织物与自然材料', '在合适的位置缠绕织物或麻绳，插入树枝等自然材料，丰富作品的材质层次。', 5),
  (350, '整体统一与完成', '审视作品整体效果，调整各材料之间的比例和色彩关系，确保多种材料和谐统一，固定在展示底座上完成作品。', 6);

-- [312] 彩纸拉花装饰
UPDATE public.projects SET description = '用彩色手工纸通过折叠和剪裁制作漂亮的拉花装饰。简单的对称剪纸技巧就能变出花朵、蝴蝶等精美图案，装点房间或节日派对。', difficulty_stars = 1 WHERE id = 312;
DELETE FROM public.project_steps WHERE project_id = 312;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (312, '折叠纸张', '取一张正方形彩纸，沿对角线或中线反复对折两到三次，形成扇形或三角形。', 1),
  (312, '画出图案', '用铅笔在折叠好的纸上画出半个花朵、心形或其他对称图案的轮廓。', 2),
  (312, '剪裁展开', '沿铅笔线小心剪裁，然后慢慢展开纸张，欣赏对称的拉花图案。', 3),
  (312, '串联装饰', '制作多个不同颜色和图案的拉花，用胶水或细线将它们串联起来，挂在墙上或天花板上装饰房间。', 4);

-- [291] 树叶拓印画
UPDATE public.projects SET description = '收集各种形状的树叶，用颜料将叶脉纹理拓印到纸上，制作一幅自然之美的作品。在创作中感受大自然的丰富形态，学习拓印这种古老的艺术技法。', difficulty_stars = 1 WHERE id = 291;
DELETE FROM public.project_steps WHERE project_id = 291;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (291, '采集树叶', '到户外收集不同形状和大小的树叶，选择叶脉清晰、表面平整的叶子效果最佳。', 1),
  (291, '涂抹颜料', '在树叶叶脉突出的背面均匀涂上颜料，注意不要涂得太厚。', 2),
  (291, '拓印成画', '将涂好颜料的叶面朝下放在卡纸上，用手轻轻按压叶子的每个部分，然后小心揭起。', 3),
  (291, '组合构图', '用不同大小和颜色的叶子拓印出树木、花朵或抽象风景画面。', 4),
  (291, '添加细节', '用画笔添加树干、花茎或小昆虫等细节，完善整幅作品。', 5);

-- [331] 黏土小动物
UPDATE public.projects SET description = '用彩色黏土捏出可爱的小动物，如兔子、小猫或小熊。通过揉、捏、搓等基本手法锻炼手指灵活性，同时发挥想象力赋予每只小动物独特的表情和姿态。', difficulty_stars = 1 WHERE id = 331;
DELETE FROM public.project_steps WHERE project_id = 331;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (331, '选择动物造型', '选定想要制作的小动物，观察参考图片了解动物的基本形态特征。', 1),
  (331, '制作身体主体', '取适量黏土搓成椭圆形作为身体，再搓一个较小的圆球作为头部，用牙签连接固定。', 2),
  (331, '添加四肢和尾巴', '搓出四条小圆柱作为四肢，捏出尾巴的形状，逐一粘贴到身体上。', 3),
  (331, '制作五官和装饰', '用小珠子做眼睛，用黏土捏出耳朵、鼻子等细节，用工具刻画嘴巴和毛发纹理。', 4),
  (331, '整体调整与展示', '调整各部分比例和姿态，放在硬纸板底座上晾干，完成后可以摆放展示。', 5);

-- [310] 毛根小动物
UPDATE public.projects SET description = '用彩色毛根条（扭扭棒）弯折出各种可爱的小动物造型。毛根柔软易弯折，非常适合低龄儿童锻炼手指灵活性和空间想象力。', difficulty_stars = 1 WHERE id = 310;
DELETE FROM public.project_steps WHERE project_id = 310;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (310, '选择动物', '挑选想要制作的小动物（如蝴蝶、蜘蛛、小狗等），选好对应颜色的毛根条。', 1),
  (310, '弯折身体', '取一根毛根条对折后弯出动物身体的基本轮廓，拧紧连接处使其牢固。', 2),
  (310, '制作四肢', '用短段毛根条缠绕在身体上制作腿、翅膀或尾巴等部位，调整弯曲角度使造型生动。', 3),
  (310, '粘贴眼睛', '在头部位置用胶水粘上小活动眼睛，让小动物变得栩栩如生。', 4);

-- [289] 蔬菜印章画
UPDATE public.projects SET description = '把蔬菜横切面蘸上颜料，在纸上印出各种有趣的图案。不同蔬菜的截面纹理各不相同，可以组合出独一无二的版画作品。', difficulty_stars = 1 WHERE id = 289;
DELETE FROM public.project_steps WHERE project_id = 289;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (289, '准备蔬菜印章', '请家长将蔬菜横切或纵切，露出横截面纹理，用纸巾吸干水分。', 1),
  (289, '调配颜料', '在调色盘中倒入不同颜色的颜料，适当加水调到不稀不稠的程度。', 2),
  (289, '蘸取印制', '将蔬菜截面均匀蘸上颜料，轻轻按压在卡纸上，稳住几秒后提起。', 3),
  (289, '自由创作', '用不同蔬菜和颜色组合排列，创作花朵、动物或抽象图案。', 4),
  (289, '展示与分享', '晾干作品后为画面取一个名字，和家人分享你的蔬菜版画创作。', 5);

-- [290] 手指画创作
UPDATE public.projects SET description = '用手指蘸取颜料直接在纸上涂抹和点画，感受色彩与手指触感的结合。这是最原始也是最自由的绘画方式，能充分激发创造力和色彩感知。', difficulty_stars = 1 WHERE id = 290;
DELETE FROM public.project_steps WHERE project_id = 290;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (290, '准备工作', '穿好围裙，在桌上铺好旧报纸，将颜料分别倒入调色盘中。', 1),
  (290, '认识色彩', '先用手指分别蘸取红黄蓝三种基本色，在纸上试画，感受颜料的质感。', 2),
  (290, '混色探索', '将两种颜色用手指直接在纸上混合，观察能调出什么新颜色。', 3),
  (290, '自由创作', '用手指点画小动物、用手掌印出大树、用指尖画出细节花纹，尽情发挥想象力。', 4);

-- [292] 吹画艺术
UPDATE public.projects SET description = '将墨水或颜料滴在纸上，用嘴巴或吸管吹散，形成随机而富有动感的图案。每一次吹画都是独一无二的，非常适合体验偶然性在艺术创作中的魅力。', difficulty_stars = 1 WHERE id = 292;
DELETE FROM public.project_steps WHERE project_id = 292;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (292, '滴墨', '用滴管将墨水或稀释颜料滴在卡纸上，形成几个大小不一的墨滴。', 1),
  (292, '吹散墨滴', '用吸管对准墨滴轻轻吹气，将墨水向不同方向吹散，形成树枝般的纹路。', 2),
  (292, '叠加色彩', '换用不同颜色的墨水继续滴和吹，让色彩交织叠加产生丰富的效果。', 3),
  (292, '联想补画', '观察吹画形成的随机图案，联想它像什么，用细笔添加眼睛、花朵等细节完成作品。', 4);

-- [334] 纸团雕塑
UPDATE public.projects SET description = '用废旧报纸和胶带创作立体雕塑，将废纸变成艺术品。利用简单的废旧材料进行三维造型，培养环保意识和创造力。', difficulty_stars = 1 WHERE id = 334;
DELETE FROM public.project_steps WHERE project_id = 334;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (334, '构思造型', '决定要制作的雕塑主题，可以是动物、人物或抽象造型，画一张简单草图。', 1),
  (334, '揉捏纸团', '将报纸揉成大小不同的纸团，用作雕塑的各个部件，大纸团做身体，小纸团做头和四肢。', 2),
  (334, '胶带组装', '用透明胶带将各个纸团紧密缠绕固定在一起，塑造出想要的整体形状。', 3),
  (334, '表面处理', '在纸团表面涂一层白乳胶，再贴上一层报纸条使表面更光滑平整，晾干后更坚固。', 4),
  (334, '上色完成', '待表面干透后，用丙烯颜料涂上颜色和图案，完成你的纸团雕塑作品。', 5);

-- [333] 橡皮泥水果
UPDATE public.projects SET description = '用彩色橡皮泥塑造逼真的水果模型，学习色彩搭配和仿真造型技巧。通过观察真实水果的形状、颜色和纹理，提升观察力和艺术表现力。', difficulty_stars = 1 WHERE id = 333;
DELETE FROM public.project_steps WHERE project_id = 333;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (333, '观察水果特征', '仔细观察真实水果的形状、颜色过渡和表面纹理，了解每种水果的特点。', 1),
  (333, '制作水果主体', '选取对应颜色的橡皮泥，搓成苹果的圆球形、香蕉的弯月形或草莓的锥形等基本形状。', 2),
  (333, '添加细节特征', '用工具刻出橘子的表面纹理，用绿色橡皮泥做叶子和果蒂，用牙签固定小部件。', 3),
  (333, '色彩渐变处理', '在水果表面轻轻混合不同颜色，模拟苹果的红绿渐变、香蕉的黄褐斑点等自然效果。', 4),
  (333, '摆盘展示', '将做好的水果整齐摆放在果篮或纸盘中，创造出一幅美观的静物作品。', 5);

-- [332] 盐面团挂饰
UPDATE public.projects SET description = '用面粉、盐和水自制面团，捏塑成各种挂饰造型后烘干上色。这是一种经济实惠又有趣的雕塑入门方式，你可以体验从原料到成品的完整创作过程。', difficulty_stars = 1 WHERE id = 332;
DELETE FROM public.project_steps WHERE project_id = 332;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (332, '制作面团', '将面粉和食盐混合均匀，缓慢加入温水揉成光滑的面团，静置几分钟。', 1),
  (332, '塑形与打孔', '将面团擀平至约5毫米厚，用模具或手工刀切出星星、爱心、小动物等造型，用吸管在顶部打一个小孔。', 2),
  (332, '烘干定型', '将造型放在烤盘上，在通风处自然晾干1-2天，或者放入烤箱低温（100°C）烘烤2小时。', 3),
  (332, '上色装饰', '面团完全干透后，用丙烯颜料涂上喜欢的颜色和图案，等颜料干透。', 4),
  (332, '穿绳展示', '将丝带或绳子穿过小孔，打结固定，就可以挂在房间里装饰了。', 5);

-- [293] 自然色彩采集本
UPDATE public.projects SET description = '带上画纸走进大自然，用颜料调配出与花朵、泥土、天空相匹配的颜色，制作一本自然色卡。在这个过程中训练对色彩的敏锐观察力和精确调色能力。', difficulty_stars = 2 WHERE id = 293;
DELETE FROM public.project_steps WHERE project_id = 293;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (293, '户外寻色', '去公园或花园里仔细观察，收集花瓣、树皮、石头等不同颜色的自然物。', 1),
  (293, '观察比对', '将收集到的自然物放在纸上，仔细观察它的颜色包含哪些色调。', 2),
  (293, '调色匹配', '用水彩颜料反复调配，直到调出与自然物尽量一致的颜色，涂在旁边对比。', 3),
  (293, '制作色卡', '将调好的颜色整齐地涂在卡纸上，旁边粘贴对应的自然物或写上名称。', 4),
  (293, '装订成册', '将所有色卡按色系整理排列，装订成一本属于自己的自然色彩采集本。', 5);

-- [335] 黏土地形沙盘
UPDATE public.projects SET description = '用黏土制作微缩地形沙盘，包括山峰、河流、平原和湖泊等地貌特征。在动手塑造地形的过程中学习地理知识，理解不同地形地貌的形成与特点。', difficulty_stars = 2 WHERE id = 335;
DELETE FROM public.project_steps WHERE project_id = 335;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (335, '规划地形布局', '参考地图或地理课本，在底座上用铅笔画出山脉、河流、平原和湖泊的大致位置。', 1),
  (335, '塑造山脉与丘陵', '用棕色黏土堆叠出山峰形状，注意表现山脉的走向和高低起伏，山顶可以加白色黏土表示积雪。', 2),
  (335, '制作河流与湖泊', '用工具在地形上刻出河道，用蓝色黏土或蓝色颜料填充河流和湖泊区域。', 3),
  (335, '添加植被与细节', '用绿色黏土覆盖平原区域，放置小树模型或绿色海绵表示森林，添加更多地貌细节。', 4),
  (335, '标注与展示', '用小纸牌标注各地形名称，如"山峰""河谷""盆地"等，完成一个生动的地理教学沙盘。', 5);

-- [296] 水彩渐变天空
UPDATE public.projects SET description = '用水彩的湿画法画出从深蓝到橙红的渐变天空，表现日出或日落的壮美。你将学会控制水分和色彩流动，掌握水彩画中最基本也最迷人的渐变技法。', difficulty_stars = 2 WHERE id = 296;
DELETE FROM public.project_steps WHERE project_id = 296;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (296, '固定纸张', '用纸胶带将水彩纸四边贴在桌面或画板上，防止纸张受潮变形。', 1),
  (296, '打湿纸面', '用喷壶或大笔蘸清水将整张纸均匀打湿，保持湿润但不积水。', 2),
  (296, '铺设天空色', '从纸的顶部开始涂深蓝色，大笔横向平涂，逐渐向下减少蓝色、增加紫色。', 3),
  (296, '过渡暖色', '在中间区域用橙色和粉色衔接，让冷暖色在湿纸上自然融合渗透。', 4),
  (296, '点缀云彩', '趁纸面未干，用干净画笔吸起部分颜料留出白色区域作为云朵，或点入少许白色。', 5),
  (296, '添加剪影', '待天空完全干透后，用深色颜料在底部画出建筑或树木的剪影，衬托天空的绚丽。', 6);

-- [336] 石膏翻模体验
UPDATE public.projects SET description = '学习石膏翻模的基本技术，用黏土制作模具并倒入石膏复制造型。你将体验工业制造中“翻模”的基本原理，理解正模与负模的关系。', difficulty_stars = 2 WHERE id = 336;
DELETE FROM public.project_steps WHERE project_id = 336;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (336, '制作原型', '用黏土捏出一个简单的造型，如贝壳、树叶或卡通脸，作为翻模的原始模型。', 1),
  (336, '制作模具', '将黏土压成厚饼状，把原型按压进去形成凹陷的负模，取出原型后在模具表面涂一层薄薄的食用油作为脱模剂。', 2),
  (336, '调配石膏', '在纸杯中倒入适量水，缓慢加入石膏粉并搅拌均匀至酸奶状浓稠度，注意避免产生气泡。', 3),
  (336, '浇注脱模', '将调好的石膏液缓慢倒入黏土模具中，轻轻震动排出气泡，等待约30分钟完全凝固后小心脱模。', 4),
  (336, '打磨上色', '用砂纸打磨石膏表面的毛刺和瑕疵，可以用颜料为石膏作品上色装饰。', 5);

-- [294] 对称蝴蝶画
UPDATE public.projects SET description = '在纸的一半涂上颜料后对折按压，打开后得到一只色彩绚丽的对称蝴蝶。这种印染技法让你直观理解对称的数学概念，同时享受色彩融合的惊喜效果。', difficulty_stars = 2 WHERE id = 294;
DELETE FROM public.project_steps WHERE project_id = 294;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (294, '折出中线', '将卡纸对折后展开，折痕就是蝴蝶身体的对称轴线。', 1),
  (294, '涂抹颜料', '在折痕的一侧画出蝴蝶翅膀的半边轮廓，在翅膀内大胆涂上色彩鲜艳的颜料。', 2),
  (294, '对折印染', '趁颜料未干时将纸沿折痕对折，用手均匀按压，让颜料充分转印到另一半。', 3),
  (294, '揭开欣赏', '小心展开纸张，一只色彩对称的蝴蝶便出现了，观察两侧的图案是否完全一样。', 4),
  (294, '完善细节', '用黑色记号笔画出蝴蝶的身体、触角和翅膀边缘，让蝴蝶更加生动。', 5);

-- [274] 纸板城堡
UPDATE public.projects SET description = '用纸板搭建一座拥有塔楼、城墙和吊桥的中世纪城堡模型吧！你将了解城堡建筑的基本结构和防御设计理念，学会如何把平面纸板变成立体建筑。这个项目需要你提前规划布局，完成后会非常有成就感。', difficulty_stars = 2 WHERE id = 274;

-- [276] 恐龙模型
UPDATE public.projects SET description = '用黏土和铁丝骨架制作一个栩栩如生的恐龙模型吧！你将了解恐龙的身体结构特征，学习如何通过骨架支撑来制作大型造型。选择你最喜欢的恐龙种类，发挥创造力还原远古生物的风采。', difficulty_stars = 2 WHERE id = 276;

-- [258] 水力涡轮机
UPDATE public.projects SET description = '制作一个水力驱动的涡轮机模型，让水流冲击叶片带动转轴旋转做功吧！你将探索叶片形状和水流量对涡轮转速的影响，理解水力发电的基本原理。', difficulty_stars = 3 WHERE id = 258;

-- [237] 冰棍棒桁架桥
UPDATE public.projects SET description = '用冰棍棒搭建真正的桁架结构桥梁，体验三角形是最稳定几何形状的工程原理吧！你将学习桁架桥的基本构造，理解为什么铁路桥和钢桥大量使用三角形桁架。这是进阶桥梁工程的标志性项目。', difficulty_stars = 3 WHERE id = 237;

-- [240] 自锁桥（达芬奇桥）
UPDATE public.projects SET description = '不用任何胶水或绳子，仅靠木棍之间的摩擦力和互锁关系搭建一座自支撑桥！你将惊叹于达芬奇500多年前的天才设计，理解摩擦力和结构互锁如何替代粘合剂。', difficulty_stars = 2 WHERE id = 240;

-- [239] 竹签桥梁
UPDATE public.projects SET description = '用竹签和热熔胶搭建精致的桥梁模型，锻炼精细节点连接技巧吧！你将学习如何在小尺寸结构中保持节点的强度和精确度，体验工程中"连接决定强度"的核心理念。', difficulty_stars = 3 WHERE id = 239;

-- [238] 悬索桥模型
UPDATE public.projects SET description = '用绳子和纸板搭建一座迷你悬索桥，探索拉力在桥梁中的奇妙作用吧！你将了解金门大桥等著名悬索桥的工作原理，理解主缆、吊索和桥面之间的力学关系。', difficulty_stars = 3 WHERE id = 238;

-- [280] 建筑沙盘
UPDATE public.projects SET description = '设计并制作一个小型社区的建筑沙盘，包含房屋、道路、绿化和公共设施吧！你将学习基本的城市规划概念，理解建筑物之间的空间关系和功能分区。这是一个综合性很强的模型制作项目。', difficulty_stars = 3 WHERE id = 280;

-- [212] 纸板抽签机
UPDATE public.projects SET description = '用纸板制作一个可以随机抽出纸签的小机关，旋转手柄即可弹出一根签条。你将在搭建过程中接触简单机构的设计思路，体验随机机制的趣味。', difficulty_stars = 1 WHERE id = 212;
DELETE FROM public.project_steps WHERE project_id = 212;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (212, '制作盒体', '用硬纸板裁剪并粘合成一个长方体小盒，顶部留一个窄缝作为出签口，侧面留圆孔用于安装手柄。', 1),
  (212, '制作拨片转轮', '用硬纸板剪一个圆盘，在圆盘边缘粘上几个小凸片作为拨片，将竹签穿过圆心做成转轮。', 2),
  (212, '组装机关', '将转轮安装在盒子侧面的圆孔中，使拨片能在盒内旋转，每次旋转拨片会推动一根纸签从顶部缝隙中弹出。', 3),
  (212, '装入纸签', '在小纸条上写好内容，卷起来或折好放入盒中，确保纸签能被拨片顺利推出。', 4),
  (212, '试玩调试', '旋转手柄测试出签效果，如果卡住可调整缝隙宽度或拨片角度，享受随机抽签的乐趣。', 5);

-- [252] 弹弓制作
UPDATE public.projects SET description = '用树枝和橡皮筋制作一个小弹弓，了解弹性势能如何转化为动能来发射物体。通过调整橡皮筋的拉伸程度，探索弹性与发射距离的关系。', difficulty_stars = 1 WHERE id = 252;
DELETE FROM public.project_steps WHERE project_id = 252;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (252, '制作弹弓架', '选择一根坚固的Y形树枝，或用冰棒棍拼成Y形，用细线绑紧连接处。', 1),
  (252, '安装橡皮筋', '将橡皮筋两端分别绑在Y形叉的两个顶端，确保两边长度一致，绑牢不会脱落。', 2),
  (252, '制作弹兜', '在橡皮筋中间绑上一小块布或皮革作为弹兜，用来放置棉花球弹丸。', 3),
  (252, '安全测试', '在空旷的安全区域，将棉花球放入弹兜，拉伸橡皮筋后释放，观察弹丸的飞行距离。', 4),
  (252, '探索弹性', '试验不同拉伸程度对发射距离的影响，讨论弹性势能如何存储和释放为动能。', 5);

-- [250] 简易滑轮装置
UPDATE public.projects SET description = '用线轴和绳子搭建一个简单的定滑轮装置，体验滑轮改变力的方向的神奇效果。通过提升不同重量的物体，直观感受滑轮的省力原理。', difficulty_stars = 1 WHERE id = 250;
DELETE FROM public.project_steps WHERE project_id = 250;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (250, '搭建支架', '将衣架或木棍固定在桌边或门框上方，作为悬挂滑轮的支撑点，确保牢固稳定。', 1),
  (250, '安装滑轮', '把线轴或小滑轮挂在支架上，让它能自由旋转，然后将细绳绕过滑轮。', 2),
  (250, '连接负载', '在绳子一端绑上小桶，放入小玩具或硬币作为要提升的重物。', 3),
  (250, '体验省力', '拉动绳子另一端，感受用滑轮向下拉绳子就能把重物向上提升，对比直接用手提的感觉。', 4),
  (250, '验证与测试', '回顾并验证定滑轮虽然不省力但改变了力的方向，想一想生活中哪里用到了滑轮（如旗杆、电梯）。', 5);

-- [249] 纸风车
UPDATE public.projects SET description = '用彩色卡纸制作一个能随风旋转的小风车，探索风能如何驱动物体运动。通过调整叶片角度和大小，观察风车转速的变化，感受空气动力学的奇妙。', difficulty_stars = 1 WHERE id = 249;
DELETE FROM public.project_steps WHERE project_id = 249;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (249, '裁剪纸片', '将彩色卡纸剪成正方形，沿对角线从四个角向中心剪开，每条线剪到离中心约2厘米处停下。', 1),
  (249, '折叠叶片', '将每个角的一侧依次折向中心点，形成四片风车叶片，注意不要把纸压出折痕。', 2),
  (249, '固定风车', '用大头针穿过所有叶片的角和中心点，加上小珠子作垫片，再插入吸管或竹签上固定。', 3),
  (249, '测试旋转', '对着风车吹气或在有风的地方测试，观察它是否顺畅旋转。调整叶片角度让风车转得更快。', 4),
  (249, '探索与记录', '尝试改变叶片大小、数量和角度，记录哪种设计转得最快，讨论风能是如何转化为旋转运动的。', 5);

-- [211] 简易纸弹簧
UPDATE public.projects SET description = '用两条纸条通过交替折叠的方式制作一个能伸缩弹跳的纸弹簧。这个项目让你在折叠中体验弹性结构的原理，理解折叠如何赋予纸张弹性恢复力。', difficulty_stars = 1 WHERE id = 211;
DELETE FROM public.project_steps WHERE project_id = 211;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (211, '粘合起点', '取两条不同颜色的纸条，将一端呈90度直角粘合在一起，形成L形。', 1),
  (211, '交替折叠', '将下方的纸条向上折叠盖住上方纸条，再将另一条纸条向对面折叠，如此交替重复直到纸条用完。', 2),
  (211, '固定末端', '将最后剩余的纸条末端用胶水粘牢，防止弹簧散开。', 3),
  (211, '测试弹性', '用手按压纸弹簧再松开，观察它弹回原状的过程。尝试在顶部放一个小玩偶，按下弹簧后释放让玩偶弹起。', 4),
  (211, '验证与测试', '尝试用不同宽度和长度的纸条制作弹簧，比较弹力大小的差异，思考折叠密度如何影响弹性。', 5);

-- [229] 纸张折叠桥
UPDATE public.projects SET description = '用一张普通的A4纸通过不同的折叠方式搭建一座能承重的小桥！你将体验折叠如何改变纸张的强度，理解折叠结构在工程中的应用。简单的材料就能创造令人惊叹的承重效果。', difficulty_stars = 1 WHERE id = 229;
DELETE FROM public.project_steps WHERE project_id = 229;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (229, '搭建桥墩', '将两摞等高的书本平放在桌上，间距约15厘米，作为桥的两个支撑点。', 1),
  (229, '测试平铺纸桥', '先将一张未折叠的纸平放在两摞书之间，轻轻放上硬币测试承重，记录纸塌陷时的硬币数。', 2),
  (229, '折叠纸张', '将另一张纸按手风琴式反复折叠成波浪形，折痕间距约1.5厘米，折好后放在两摞书之间。', 3),
  (229, '承重对比', '在折叠后的纸桥上逐枚放硬币，记录塌陷时的硬币数，与平铺纸桥对比承重差异。', 4),
  (229, '验证与测试', '回顾并验证为什么折叠后纸张能承受更多重量：折叠增加了截面高度，分散了受力面积。', 5);

-- [230] 积木桥梁搭建
UPDATE public.projects SET description = '用积木搭建各种桥梁结构，探索平衡与稳定的奥秘！你将在搭建过程中感受重力和支撑力的关系，了解桥梁为什么需要稳固的基础。这是低龄你认识桥梁结构的最佳入门项目。', difficulty_stars = 1 WHERE id = 230;
DELETE FROM public.project_steps WHERE project_id = 230;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (230, '规划桥梁', '用积木在桌上摆出桥梁的大致轮廓，确定桥墩位置和桥面高度。', 1),
  (230, '搭建桥墩', '用长方形积木在两侧交错叠放搭建桥墩，确保每层积木对齐稳固。', 2),
  (230, '铺设桥面', '将硬纸板或长积木横搭在两个桥墩之间，形成桥面，调整使其平稳。', 3),
  (230, '通行测试', '让小玩具车在桥上通过，观察桥梁是否稳固，如果晃动则加固桥墩。', 4),
  (230, '改进设计', '尝试加高桥墩或加宽桥面，讨论哪种搭建方式最稳定，为什么底座宽大更不容易倒。', 5);

-- [251] 斜面滚球实验
UPDATE public.projects SET description = '用纸板搭建不同角度的斜面，观察小球在斜面上的滚动规律。通过测量小球的滚动距离和速度，理解斜面如何将重力转化为运动，是最基础的简单机械之一。', difficulty_stars = 1 WHERE id = 251;
DELETE FROM public.project_steps WHERE project_id = 251;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (251, '搭建斜面', '将硬纸板一端架在一本书上，另一端放在桌面上，形成一个倾斜面。', 1),
  (251, '滚球测试', '从斜面顶端释放小球，观察它沿斜面滚下后在桌面上继续滚动的距离，用尺子测量并记录。', 2),
  (251, '改变角度', '用不同数量的书本改变斜面高度和角度，每次释放小球并测量滚动距离，记录数据。', 3),
  (251, '对比分析', '比较不同角度下小球的滚动距离和速度，讨论为什么角度越大小球速度越快。', 4),
  (251, '生活联想', '想一想生活中的斜面应用：滑梯、公路坡道、轮椅坡道，讨论斜面如何让搬运重物变得更省力。', 5);

-- [209] 纸板陀螺
UPDATE public.projects SET description = '用硬纸板和牙签制作一个旋转稳定的陀螺，探索重心与旋转的关系。你将在制作和调试过程中理解重心位置如何影响陀螺的平衡与旋转时间。', difficulty_stars = 1 WHERE id = 209;
DELETE FROM public.project_steps WHERE project_id = 209;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (209, '裁剪圆盘', '用圆规或杯盖在硬纸板上画出直径约6厘米的圆，剪下2-3个相同大小的圆盘叠在一起增加厚度。', 1),
  (209, '安装转轴', '找到圆盘的中心点，用牙签穿过中心，确保牙签垂直于圆盘平面，上下各露出约1.5厘米。', 2),
  (209, '装饰与配重', '用彩色笔在圆盘上画出螺旋或扇形图案，旋转时会产生有趣的视觉效果。', 3),
  (209, '调试平衡', '在光滑桌面上旋转陀螺，观察旋转是否稳定。如果晃动严重，调整牙签位置使其恰好在重心处。', 4),
  (209, '挑战与思考', '尝试改变圆盘大小、厚度和转轴长度，比较哪种组合旋转时间最长，理解重心越低越稳定的原理。', 5);

-- [269] 纸板小房子
UPDATE public.projects SET description = '用废旧纸板剪裁、折叠、粘贴，搭建一座迷你小房子！你将学习基本的建筑结构知识，理解墙壁、屋顶和门窗的比例关系。通过动手实践培养空间想象力和精细动手能力。', difficulty_stars = 1 WHERE id = 269;
DELETE FROM public.project_steps WHERE project_id = 269;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (269, '设计房子图纸', '在纸上画出小房子的正面、侧面和屋顶的展开图，标注好尺寸和折叠线。', 1),
  (269, '剪裁纸板', '按照图纸在纸板上画线并剪裁出墙壁、屋顶等各部件，注意留出粘贴边。', 2),
  (269, '折叠与粘贴', '沿折叠线折出立体形状，用白胶将各面粘合在一起，组装成房子的基本结构。', 3),
  (269, '添加门窗', '在墙壁上用剪刀小心地剪出门和窗户的位置，可以做成能打开的小门。', 4),
  (269, '装饰美化', '用彩色画笔或贴纸装饰房子外墙，画上砖纹、花草等细节，让小房子更加生动。', 5);

-- [232] 纸杯堆叠挑战
UPDATE public.projects SET description = '用纸杯和纸板交替堆叠，搭建一座又高又稳的桥塔结构！你将在实践中感受结构稳定性的重要，了解底部宽大、层层递减的金字塔形为何最稳定。简单材料也能建出惊人的高度。', difficulty_stars = 1 WHERE id = 232;
DELETE FROM public.project_steps WHERE project_id = 232;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (232, '铺设底层', '将6个纸杯倒扣排成一排，保持等间距，在上面平放一块硬纸板作为第一层桥面。', 1),
  (232, '逐层递减', '在纸板上再放5个纸杯，再盖纸板，依次递减纸杯数量，每层少一个。', 2),
  (232, '挑战高度', '尽可能往上堆叠更多层，观察结构在哪一层开始变得不稳定。', 3),
  (232, '总结规律', '对比分析为什么底大顶小的结构最稳定，测量最终高度并记录各种堆法的对比结果。', 4);

-- [272] 折纸小船
UPDATE public.projects SET description = '用纸折出不同造型的小船，放在水中测试它们的浮力和载重能力！你将了解浮力原理和船体形状对稳定性的影响。通过动手折叠和实际测试，体会工程设计中的反复优化过程。', difficulty_stars = 1 WHERE id = 272;
DELETE FROM public.project_steps WHERE project_id = 272;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (272, '折叠基础小船', '按照传统折纸方法折出一只经典纸船，确保折痕整齐对称。', 1),
  (272, '防水处理', '用蜡笔或蜡烛在纸船底部涂上一层薄蜡，增强防水性能延长漂浮时间。', 2),
  (272, '浮力测试', '将纸船放入水中，逐个放入小硬币测试载重能力，记录每艘船能承载多少枚硬币。', 3),
  (272, '改进设计', '观察沉没的原因，尝试改变船体形状或大小来提高载重能力，反复测试找到最优设计。', 4);

-- [271] 纸飞机模型集
UPDATE public.projects SET description = '学习折叠多种经典纸飞机，探索不同机翼形状对飞行距离和稳定性的影响！你将初步了解空气动力学的基本概念，理解升力和阻力的关系。折好后还可以举办一场纸飞机比赛。', difficulty_stars = 1 WHERE id = 271;
DELETE FROM public.project_steps WHERE project_id = 271;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (271, '学习基础折法', '按照教程折出标准飞镖型纸飞机，注意对称和折痕要压实。', 1),
  (271, '折叠多种机型', '分别折出宽翼型、窄翼型、三角翼型等不同样式的纸飞机，共制作4-5种。', 2),
  (271, '试飞测试', '在空旷处逐一试飞每种纸飞机，用卷尺测量飞行距离，记录每次的成绩。', 3),
  (271, '对比分析', '对比不同机翼形状的飞行距离和稳定性，讨论为什么有的飞得远、有的飞得稳。', 4);

-- [270] 黏土动物模型
UPDATE public.projects SET description = '用超轻黏土捏出各种可爱的小动物造型！你将锻炼手部精细运动能力，学习观察动物的身体比例和特征。这是一个充满创意和乐趣的造型入门项目。', difficulty_stars = 1 WHERE id = 270;
DELETE FROM public.project_steps WHERE project_id = 270;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (270, '选择动物造型', '选一种喜欢的动物，观察它的照片或图片，注意身体各部分的大小比例。', 1),
  (270, '制作身体主体', '取一块黏土揉成椭圆形作为身体，再搓一个圆球作为头部，用牙签连接固定。', 2),
  (270, '添加四肢和尾巴', '搓出四条腿和尾巴，粘在身体上合适的位置，调整姿势使动物能稳稳站立。', 3),
  (270, '制作五官细节', '用小珠子或不同颜色的黏土做出眼睛、鼻子和嘴巴，用工具刻出毛发纹理等细节。', 4),
  (270, '晾干展示', '将做好的动物模型放在硬纸板底座上，自然晾干24小时后即可展示。', 5);

-- [231] 吸管桥梁
UPDATE public.projects SET description = '用普通吸管和胶带搭建一座轻巧的桥梁，挑战用最少材料承受最大重量！你将学会如何连接轻质材料形成稳定结构，了解工程师如何在轻量化和强度之间寻找平衡。', difficulty_stars = 1 WHERE id = 231;
DELETE FROM public.project_steps WHERE project_id = 231;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (231, '设计桥型', '观察几种常见桥梁图片，选择一种简单的梁桥造型，用铅笔画出设计草图。', 1),
  (231, '制作桥面', '将4-5根吸管平行排列，用胶带固定成一个平面，作为桥面主体。', 2),
  (231, '加固结构', '在桥面下方用吸管制作X形或三角形支撑，用胶带牢固粘接每个连接点。', 3),
  (231, '架桥测试', '将两个纸杯倒扣作为桥墩，把吸管桥架在上面，逐个放置硬币测试承重极限。', 4);

-- [210] 橡皮筋动力风扇
UPDATE public.projects SET description = '用橡皮筋的弹性势能驱动一个纸质风扇叶片旋转，感受储能与释放的过程。你将直观地理解弹性势能如何转化为动能，体验简易动力机械的工作方式。', difficulty_stars = 1 WHERE id = 210;
DELETE FROM public.project_steps WHERE project_id = 210;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (210, '制作扇叶', '在硬纸板上画出四片扇叶形状并剪下，将每片扇叶略微倾斜折弯，模仿风扇叶片的角度。', 1),
  (210, '组装转子', '将四片扇叶均匀粘贴在竹签的一端，形成风扇头部，确保扇叶角度一致。', 2),
  (210, '搭建底座', '在纸杯底部中心戳一个孔，将竹签穿过纸杯底部，竹签需能自由旋转。', 3),
  (210, '安装橡皮筋', '将橡皮筋套在竹签的尾端，另一端固定在纸杯内壁上。旋转竹签拧紧橡皮筋储存弹性势能。', 4),
  (210, '释放旋转', '松手释放竹签，观察橡皮筋回弹驱动风扇叶片高速旋转，感受弹性势能转化为动能的过程。', 5);

-- [273] 太阳系模型
UPDATE public.projects SET description = '用泡沫球和颜料制作一个按比例缩放的太阳系模型，展示八大行星的相对大小和位置！你将学习天文学基础知识，了解太阳系中各行星的特点。这是一个集科学与艺术于一体的展示项目。', difficulty_stars = 2 WHERE id = 273;
DELETE FROM public.project_steps WHERE project_id = 273;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (273, '了解行星资料', '查阅八大行星的大小、颜色和离太阳的距离，列出比例换算表。', 1),
  (273, '涂装行星', '按照各行星的实际外观特征，用丙烯颜料给泡沫球上色，如木星画出条纹、土星做出光环。', 2),
  (273, '制作支架', '将铁丝或木棍固定在大纸板上，按距离比例排列，每根支架高度错开便于展示。', 3),
  (273, '组装太阳系', '将涂好色的行星球安装到对应的支架上，贴上标签写明行星名称和基本数据。', 4),
  (273, '展示讲解', '向家人或同学介绍自己制作的太阳系模型，讲解每颗行星的特点。', 5);

-- [215] 弹珠轨道入门
UPDATE public.projects SET description = '用纸板和纸筒搭建一条简易弹珠轨道，让弹珠从高处顺畅滚到低处。你将在搭建中学习重力势能转化为动能的过程，培养空间规划能力。', difficulty_stars = 2 WHERE id = 215;
DELETE FROM public.project_steps WHERE project_id = 215;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (215, '制作轨道段', '将纸板裁成长条，沿中线对折形成V形槽道，或将纸巾筒纵向切开一半作为半管轨道。', 1),
  (215, '设计路线', '在纸箱侧面或墙面上规划弹珠从高到低的路线，每段轨道略微向下倾斜，确保弹珠能持续滚动。', 2),
  (215, '固定轨道', '用胶带将各段轨道逐段固定到墙面或纸箱上，注意轨道之间的衔接要平滑，弹珠不会飞出。', 3),
  (215, '测试滚动', '从最高点释放弹珠，观察它沿轨道滚下。如果某处卡住，调整该段的倾斜角度。', 4),
  (215, '增加趣味', '在轨道中加入弯道、漏斗或跳台等元素，让弹珠轨迹更有趣。', 5);

-- [254] 简易滑轮组
UPDATE public.projects SET description = '组合定滑轮和动滑轮搭建一个滑轮组，亲身体验滑轮组的省力效果。通过测量拉力大小，验证滑轮组"省力不省距离"的物理规律。', difficulty_stars = 2 WHERE id = 254;
DELETE FROM public.project_steps WHERE project_id = 254;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (254, '搭建定滑轮', '将一个滑轮固定在支架顶部作为定滑轮，绕上绳子挂上重物，用弹簧秤测量拉力并记录。', 1),
  (254, '添加动滑轮', '在重物上方加一个动滑轮，将绳子穿过动滑轮再绕过定滑轮，重新测量拉力。', 2),
  (254, '组合滑轮组', '再增加一个滑轮，组成更复杂的滑轮组，记录每种组合下提升相同重物所需的拉力。', 3),
  (254, '测量绳子拉动距离', '提升重物相同高度时，分别测量不同滑轮组中绳子需要拉动的长度，记录数据。', 4),
  (254, '数据分析', '比较各组数据，发现滑轮越多越省力但绳子拉动距离越长的规律，讨论"省力不省功"的道理。', 5);

-- [233] 纸桥承重实验
UPDATE public.projects SET description = '用不同折叠方式制作纸桥并进行系统的承重测试，探索哪种折法最强！你将用科学对比实验的方法，量化测量不同结构的承重能力。培养实验记录和数据对比分析的能力。', difficulty_stars = 2 WHERE id = 233;
DELETE FROM public.project_steps WHERE project_id = 233;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (233, '准备不同折法', '分别用平铺、波浪折、卷筒形、U形槽四种方式制作4座纸桥，每座用1张纸。', 1),
  (233, '统一测试条件', '将两摞书设置为相同间距（15厘米），在每座纸桥中央放一个纸杯用于盛放重物。', 2),
  (233, '逐个测试', '依次在纸杯中放入硬币或弹珠，记录每座桥塌陷时的重量，每种折法测试两次取平均值。', 3),
  (233, '制作对比图表', '将结果整理成表格或柱状图，直观对比不同折法的承重能力。', 4),
  (233, '分析结论', '对比分析为什么某种折法承重最强，思考折叠结构如何改变力的传递路径。', 5);

-- [216] 翻转木偶机关
UPDATE public.projects SET description = '制作一个凸轮驱动的纸板木偶，转动手柄木偶就能做出上下翻转的动作。你将学习凸轮机构如何把旋转运动变成上下往复运动，感受机械联动的趣味。', difficulty_stars = 2 WHERE id = 216;
DELETE FROM public.project_steps WHERE project_id = 216;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (216, '制作凸轮', '在硬纸板上画一个偏心的椭圆形（非正圆），剪下来作为凸轮，在中心偏上位置戳孔穿入竹签做转轴。', 1),
  (216, '制作推杆', '将一根竹签竖直安装在纸盒顶部开孔中，底端抵住凸轮的边缘，使凸轮转动时推杆能上下移动。', 2),
  (216, '制作木偶', '在硬纸板上画一个可爱的人物或动物，剪下并粘在推杆的顶端。', 3),
  (216, '安装到底座', '将凸轮和转轴安装在纸盒内部，手柄从侧面伸出，推杆从顶部伸出。', 4),
  (216, '表演测试', '旋转侧面的手柄，观察木偶随着凸轮的旋转做出节奏感十足的上下弹跳动作。', 5),
  (216, '改变运动', '尝试制作不同形状的凸轮（心形、三角形等），观察木偶的运动节奏如何随之变化。', 6);

-- [253] 杠杆投石机
UPDATE public.projects SET description = '用冰棒棍和橡皮筋搭建一台小型投石机，了解杠杆原理在古代战争中的应用。通过调整支点位置和投臂长度，探索如何让投石机把物体抛得更远。', difficulty_stars = 2 WHERE id = 253;
DELETE FROM public.project_steps WHERE project_id = 253;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (253, '搭建底座', '将5-6根冰棒棍叠在一起用橡皮筋绑紧两端，做成一个厚实的支撑底座。', 1),
  (253, '安装投臂', '取一根冰棒棍作为投臂，用橡皮筋将其一端绑在底座顶部一端，形成可翘起的杠杆结构。', 2),
  (253, '安装弹篮', '用热熔胶或橡皮筋将塑料瓶盖固定在投臂的长端作为弹药篮。', 3),
  (253, '发射测试', '在弹篮中放入棉球，按下投臂短端后松手，观察棉球被抛出的距离和角度。', 4),
  (253, '优化调整', '移动支点位置、改变投臂两端的比例，测量不同设置下的发射距离，记录最优方案。', 5),
  (253, '原理总结', '对比分析杠杆三要素（支点、力臂、阻力臂）和投石机的工作原理，了解古人如何利用杠杆打仗。', 6);

-- [236] 纸板拱桥
UPDATE public.projects SET description = '用硬纸板制作一座漂亮的拱桥，探索拱形结构为什么特别能承重！你将直观理解拱形如何将向下的力分散到两侧桥墩，明白古代石拱桥千年不倒的力学秘密。', difficulty_stars = 2 WHERE id = 236;
DELETE FROM public.project_steps WHERE project_id = 236;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (236, '裁剪拱形', '在纸板上用铅笔画出半圆拱形的轮廓，裁剪出两片相同的拱形侧板。', 1),
  (236, '制作桥面', '裁一条长方形纸板弯成拱形，粘贴在两片侧板之间，形成拱桥的主体。', 2),
  (236, '加固桥墩', '在拱桥两端底部粘贴额外纸板加固桥墩部分，确保底部平整不会滑动。', 3),
  (236, '承重测试', '在拱桥顶部逐步放置重物，观察拱形结构在受力时的表现。', 4),
  (236, '对比实验', '制作一座同样纸板的平桥进行对比承重测试，直观感受拱形结构的力学优势。', 5);

-- [256] 简易天平
UPDATE public.projects SET description = '利用杠杆平衡原理制作一个简易天平，用来称量和比较物体的重量。通过寻找平衡点和使用砝码，理解等臂杠杆的精妙之处。', difficulty_stars = 2 WHERE id = 256;
DELETE FROM public.project_steps WHERE project_id = 256;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (256, '找平衡点', '将直尺放在三角积木上，左右移动找到能让直尺水平平衡的位置，这就是支点。', 1),
  (256, '安装托盘', '在直尺两端分别用细线挂上小杯子或纸盘作为称量托盘，确保两侧一样重。', 2),
  (256, '校准天平', '空盘时调整位置使天平水平，如果不平衡可以在轻的一侧贴一小块胶带微调。', 3),
  (256, '称量物体', '在一侧放入要称量的物体，另一侧逐个添加硬币，直到天平平衡，数硬币个数确定重量。', 4),
  (256, '趣味挑战', '尝试比较不同物品的重量（如橡皮和回形针），讨论杠杆原理和为什么两臂等长时才能准确测量。', 5);

-- [214] 纸板齿轮联动
UPDATE public.projects SET description = '用硬纸板制作两个相互咬合的齿轮，转动一个齿轮带动另一个旋转。你将直观地理解齿轮传动的基本原理，观察两个齿轮旋转方向相反的有趣现象。', difficulty_stars = 2 WHERE id = 214;
DELETE FROM public.project_steps WHERE project_id = 214;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (214, '绘制齿轮', '用圆规在硬纸板上画两个不同大小的圆，沿圆周均匀画出锯齿形的齿，注意两个齿轮的齿距要一致才能咬合。', 1),
  (214, '裁剪齿轮', '用剪刀或美工刀沿齿形轮廓仔细剪下两个齿轮，齿的形状要规整。', 2),
  (214, '安装到底板', '在底板上确定两个齿轮的中心位置，使齿刚好咬合，用图钉穿过齿轮中心固定在底板上，保持能自由转动。', 3),
  (214, '测试联动', '转动大齿轮，观察小齿轮被带动旋转，注意两个齿轮的旋转方向相反。', 4),
  (214, '探索传动比', '数一数大齿轮和小齿轮各有多少个齿，转动大齿轮一圈时小齿轮转了几圈，理解齿数比决定转速比。', 5);

-- [275] 火山模型
UPDATE public.projects SET description = '用黏土和纸板制作一个可以展示内部结构的火山截面模型！你将了解火山的构造，包括岩浆室、火山口和不同岩层。这个模型可以清楚地展示地球内部的热能如何驱动火山喷发。', difficulty_stars = 2 WHERE id = 275;
DELETE FROM public.project_steps WHERE project_id = 275;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (275, '搭建火山骨架', '将塑料瓶固定在纸板中央，用揉皱的报纸和胶带围绕瓶身堆出火山的锥形外形。', 1),
  (275, '覆盖黏土层', '用不同颜色的黏土分层覆盖火山表面，棕色代表岩石层、绿色代表植被、白色代表积雪。', 2),
  (275, '制作截面', '将火山模型纵向切开一半，用红色和橙色黏土填充内部，展示岩浆室、岩浆通道等结构。', 3),
  (275, '标注结构名称', '用标签纸标注火山口、岩浆室、岩浆通道、岩层等各部分的名称。', 4),
  (275, '讲解火山知识', '对照模型讲解火山喷发的过程：岩浆从地下深处沿通道上升并从火山口喷出。', 5);

-- [234] 冰棍棒平板桥
UPDATE public.projects SET description = '用冰棍棒和白胶搭建一座简单的平板桥，学习粘合与承重的关系！你将掌握基本的木质材料粘接技巧，了解多层叠合如何增强结构强度。完成后可以涂色装饰。', difficulty_stars = 2 WHERE id = 234;
DELETE FROM public.project_steps WHERE project_id = 234;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (234, '制作桥面板', '将10根冰棍棒紧密排列，用两根横向冰棍棒粘在上面固定，形成一个平面桥板。', 1),
  (234, '制作护栏', '在桥面两侧各粘一排冰棍棒作为护栏，增强桥面的横向稳定性。', 2),
  (234, '加固底部', '在桥面底部中间位置粘上2-3根纵向冰棍棒作为加强梁，用橡皮筋夹紧等待胶干。', 3),
  (234, '组装测试', '将纸杯倒扣作为桥墩，架上桥面，逐枚放硬币测试承重能力。', 4),
  (234, '优化改进', '根据断裂位置分析薄弱点，增加冰棍棒加固后再次测试，对比改进前后的承重数据。', 5);

-- [255] 水车模型
UPDATE public.projects SET description = '用塑料杯和竹签制作一个能被水流驱动旋转的小水车模型，了解古人如何利用水力做功。通过观察水流对叶片的冲击，理解水力能量转化的过程。', difficulty_stars = 2 WHERE id = 255;
DELETE FROM public.project_steps WHERE project_id = 255;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (255, '制作叶片', '将塑料杯剪成半杯状或用勺形纸片作为水车叶片，均匀粘贴在圆形硬纸板边缘，所有开口朝同一方向。', 1),
  (255, '安装转轴', '在圆形纸板中心穿一根竹签作为转轴，确保纸板能在竹签上自由旋转。', 2),
  (255, '搭建支架', '用纸板或木块做两个支撑架，将竹签两端架起，让水车悬空能自由转动。', 3),
  (255, '水流测试', '用水壶缓缓将水倒在水车叶片上，观察水车被水流驱动旋转的效果。', 4),
  (255, '优化与探索', '调整叶片数量、角度和水流大小，找出让水车转得最快的方案，讨论古代水车的用途。', 5);

-- [213] 橡皮筋动力车
UPDATE public.projects SET description = '利用橡皮筋的弹性势能驱动一辆纸板小车前进，学习能量转化和简单传动原理。你将通过调整橡皮筋的拧紧圈数来控制行驶距离，感受储能与动力传动的关系。', difficulty_stars = 2 WHERE id = 213;
DELETE FROM public.project_steps WHERE project_id = 213;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (213, '制作底盘', '剪一块约15厘米×8厘米的硬纸板作为底盘，在前后两端各用胶带固定一段吸管作为轴承。', 1),
  (213, '安装车轮', '将竹签穿过吸管，竹签两端各插上一个瓶盖做车轮，确保车轮转动顺畅。', 2),
  (213, '安装动力', '将橡皮筋一端挂在前轴上，另一端挂在后轴的竹签上。旋转后轴让橡皮筋拧紧储能。', 3),
  (213, '发射测试', '将车放在平地上松手释放，橡皮筋回弹带动车轴旋转推动小车前进。', 4),
  (213, '优化改进', '尝试不同粗细和数量的橡皮筋，调整拧紧圈数，记录行驶距离，找出最佳组合。', 5),
  (213, '原理总结', '弹性势能通过橡皮筋回弹转化为车轴的旋转动能，再通过车轮与地面的摩擦力转化为前进的动力。', 6);

-- [235] 意大利面桥
UPDATE public.projects SET description = '用干燥的意大利面条和棉花糖搭建桥梁，挑战脆性材料的极限！你将体验脆性材料在受压和受拉时的不同表现，学会如何利用三角形结构来分散应力。这是全球经典的STEM挑战项目。', difficulty_stars = 2 WHERE id = 235;
DELETE FROM public.project_steps WHERE project_id = 235;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (235, '认识材料', '折断一根意大利面感受它的脆性，讨论脆性材料怕弯折但能承受压力的特点。', 1),
  (235, '搭建三角单元', '用3根面条和3个棉花糖组成一个三角形，制作6-8个相同的三角形单元。', 2),
  (235, '组装桥身', '将三角形单元用面条和棉花糖连接成桥的形状，确保每个节点牢固。', 3),
  (235, '架桥承重', '将桥架在两个纸盒之间，在中间挂上纸杯，逐个放入硬币测试承重极限。', 4),
  (235, '分析失败点', '观察桥断裂的位置和方式，讨论如何改进设计以避免薄弱点。', 5);

-- [279] DNA 双螺旋模型
UPDATE public.projects SET description = '用铁丝和彩色珠子制作一个DNA双螺旋结构模型，展示碱基配对的规律！你将了解遗传信息的载体——DNA的分子结构。用四种颜色的珠子分别代表A、T、G、C四种碱基，直观展示互补配对。', difficulty_stars = 3 WHERE id = 279;
DELETE FROM public.project_steps WHERE project_id = 279;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (279, '学习DNA结构', '查看DNA双螺旋的基本知识：两条糖-磷酸骨架螺旋缠绕，碱基A配T、G配C。', 1),
  (279, '制作骨架', '将两根长铁丝分别穿入白色或银色珠子代表糖-磷酸骨架，每隔一定间距留出连接点。', 2),
  (279, '连接碱基对', '用短铁丝两端各穿一颗彩色珠子代表配对碱基（红配蓝=A-T，绿配黄=G-C），将短铁丝横接在两条骨架之间。', 3),
  (279, '扭转成螺旋', '将整个结构轻轻扭转成双螺旋形状，固定在底座上保持造型稳定。', 4),
  (279, '标注与讲解', '用标签标注碱基名称和配对规律，讲解DNA如何储存和传递遗传信息。', 5);

-- [278] 细胞结构模型
UPDATE public.projects SET description = '用果冻和各种糖果制作一个放大版的动物细胞模型，展示细胞膜、细胞核、线粒体等结构！你将了解细胞这个生命基本单位的内部构造。用食物来模拟微观世界，既好玩又好记。', difficulty_stars = 3 WHERE id = 278;
DELETE FROM public.project_steps WHERE project_id = 278;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (278, '了解细胞结构', '查看动物细胞的基本结构：细胞膜、细胞质、细胞核、线粒体、内质网、高尔基体等。', 1),
  (278, '制作细胞质基质', '将果冻粉用热水溶解，倒入圆形容器中，冷却至半凝固状态作为细胞质。', 2),
  (278, '放入细胞器', '趁果冻未完全凝固，将大葡萄（细胞核）放在中央，各种糖果分别代表线粒体、内质网等放入对应位置。', 3),
  (278, '冷藏定型', '放入冰箱冷藏2小时至完全凝固，果冻固定住所有"细胞器"的位置。', 4),
  (278, '标注展示', '脱模后用牙签和标签纸标注每个结构的名称，对照生物课本讲解各细胞器的功能。', 5);

-- [218] 凸轮玩具制作
UPDATE public.projects SET description = '设计并制作一个凸轮驱动的场景玩具，转动手柄可以让多个角色做出不同的动作。你将深入学习凸轮的形状如何决定运动轨迹，理解往复运动的机械原理。', difficulty_stars = 3 WHERE id = 218;
DELETE FROM public.project_steps WHERE project_id = 218;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (218, '设计场景', '构思一个有2-3个角色的场景（如小鸡啄米、花朵开合、小人锤打等），画出草图，确定每个角色需要什么运动。', 1),
  (218, '制作凸轮', '根据需要的运动特点裁剪不同形状的纸板凸轮：圆形偏心凸轮产生平滑升降，心形凸轮产生快升慢降的效果。', 2),
  (218, '安装传动轴', '将各个凸轮穿在同一根竹签轴上，固定好间距使每个凸轮对准各自的推杆位置，轴端伸出箱体作为手柄。', 3),
  (218, '制作角色', '用彩色卡纸制作各个角色并固定在推杆顶部，推杆穿过箱体顶面的导向孔。', 4),
  (218, '组装测试', '转动手柄，观察各角色随着不同凸轮做出各具特色的运动，检查是否顺畅。', 5),
  (218, '装饰完善', '为场景添加背景装饰，调整凸轮相位让角色动作协调配合，打造出生动的机械剧场。', 6);

-- [259] 简易抽水机
UPDATE public.projects SET description = '利用气压差和虹吸原理制作一个简易抽水机，能把低处的水抽到高处。通过动手操作，直观理解大气压力和虹吸效应在日常生活中的广泛应用。', difficulty_stars = 3 WHERE id = 259;
DELETE FROM public.project_steps WHERE project_id = 259;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (259, '虹吸实验', '先做一个虹吸实验：将软管灌满水，一端放入高处水杯，另一端放在低处空杯，观察水自动流向低处。', 1),
  (259, '组装抽水机', '将注射器出口连接软管，用胶带密封接口确保不漏气。将软管另一端放入装水的容器中。', 2),
  (259, '抽水测试', '反复拉动和推动注射器活塞，观察水通过软管被吸入和排出的过程。', 3),
  (259, '探索气压', '对比分析拉动活塞时管内气压降低、外部大气压把水压入管内的原理，理解气压差的作用。', 4),
  (259, '应用拓展', '想一想生活中哪些地方用到了类似原理（如吸管喝水、抽水马桶），讨论古代抽水灌溉的方法。', 5);

-- [217] 纸板弹珠机
UPDATE public.projects SET description = '用纸板制作一台完整的弹珠台游戏机，包含弹射器、障碍物和得分区域。你将综合运用弹射、反弹等机械原理，体验从设计到搭建完整机械装置的成就感。', difficulty_stars = 3 WHERE id = 217;
DELETE FROM public.project_steps WHERE project_id = 217;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (217, '制作面板', '将纸板裁成约40厘米×30厘米的底板，四周粘上纸板围墙形成弹珠活动区域，一端略微垫高形成倾斜角度。', 1),
  (217, '安装弹射器', '在底板低端侧面制作弹射通道，用橡皮筋和冰棒棍制成弹射杆，拉动后释放可将弹珠弹入游戏区域。', 2),
  (217, '布置障碍物', '用冰棒棍和瓶盖在面板上布置挡板、弯道和隧道等障碍物，用钉子做成可旋转的弹珠偏转器。', 3),
  (217, '设置得分区', '在底板底部开几个不同大小的洞作为进球口，标注不同分数——洞越小分数越高。', 4),
  (217, '装饰与测试', '用彩色笔装饰弹珠机外观，测试弹射力度和障碍物布局，调整直到游戏体验流畅有趣。', 5);

-- [219] 纸板自动贩卖机
UPDATE public.projects SET description = '用纸板制作一台能投币出货的迷你自动贩卖机，包含投币检测和推送货物的机关。你将学习多个简单机构的组合设计，理解联动机关的工作流程。', difficulty_stars = 3 WHERE id = 219;
DELETE FROM public.project_steps WHERE project_id = 219;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (219, '制作箱体', '将纸板箱改造成贩卖机外壳，正面留出商品展示窗口、投币口和出货口。', 1),
  (219, '制作货架', '在箱内用硬纸板分隔出多层倾斜的货架通道，商品能沿通道自动滑向出口处。', 2),
  (219, '制作投币联动', '设计一个投币机关：硬币从投币口滑入落到一个翘板上，翘板被压下后通过连杆拨开挡板，释放一个商品。', 3),
  (219, '安装挡板', '在每个货道出口安装可活动的挡板，平时挡住商品，联动触发时挡板打开让一个商品滑出。', 4),
  (219, '测试调整', '投入硬币测试出货是否顺畅，调整翘板灵敏度、通道坡度和挡板位置，确保机关可靠。', 5),
  (219, '外观装饰', '在正面画上商品图案和价格标签，装饰成真实贩卖机的样子，邀请朋友来体验。', 6);

-- [220] 连杆机构动物
UPDATE public.projects SET description = '用硬纸板和铆钉制作一只能活动四肢的机械动物，拉动操控杆让它做出走路或飞翔的动作。你将学习连杆机构的运动传递原理，理解如何将一个动作分解为多个关节的协调运动。', difficulty_stars = 3 WHERE id = 220;
DELETE FROM public.project_steps WHERE project_id = 220;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (220, '设计动物', '选择一种动物（如恐龙、小鸟或马），画出身体、四肢等各部件，标注关节连接点的位置。', 1),
  (220, '裁剪部件', '在硬纸板上画出身体、上臂、下臂、大腿、小腿等各个部件并剪下，在关节处打孔。', 2),
  (220, '铆接关节', '用铆钉或两脚钉将各部件在关节处连接起来，每个关节需能自由转动但不能太松。', 3),
  (220, '制作连杆', '用纸板条制作连杆将各个关节串联起来，当拉动底部操控杆时，连杆带动所有肢体协调运动。', 4),
  (220, '装饰与测试', '用彩色笔给动物上色装饰，拉动操控杆观察四肢的运动是否协调自然。', 5),
  (220, '改进优化', '调整连杆长度和关节位置，让动作更加流畅逼真，理解四杆机构的运动规律。', 6);

-- [257] 风力发电小模型
UPDATE public.projects SET description = '制作一个小型风力发电装置，让风吹动扇叶带动小马达产生电流点亮LED灯。通过这个项目理解风能转化为电能的完整过程，感受可再生能源的魅力。', difficulty_stars = 3 WHERE id = 257;
DELETE FROM public.project_steps WHERE project_id = 257;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (257, '制作扇叶', '将塑料瓶切成四片均匀的叶片并弯折一定角度，或用硬纸板剪出螺旋桨形状的扇叶。', 1),
  (257, '安装扇叶到马达', '将扇叶固定在小马达的转轴上，确保牢固且转动平衡，不会因晃动而脱落。', 2),
  (257, '搭建支架', '将马达用热熔胶固定在支架上，使扇叶正对风向并能自由旋转。', 3),
  (257, '连接电路', '用导线将马达的两个接线端连接到LED灯，注意正负极方向。', 4),
  (257, '风力测试', '用电风扇或吹风机对准扇叶吹风，观察LED灯是否亮起。调整叶片角度和风力距离找到最佳发电状态。', 5),
  (257, '记录与讨论', '记录不同风速下LED的亮度变化，讨论真实风力发电站的工作原理和风能作为清洁能源的意义。', 6);

-- [277] 人体器官模型
UPDATE public.projects SET description = '用黏土制作可拆卸的人体躯干模型，展示心脏、肺、胃、肝等主要器官的位置和形状！你将直观地了解人体内部结构。每个器官用不同颜色区分，可以取出单独观察再放回原位。', difficulty_stars = 3 WHERE id = 277;
DELETE FROM public.project_steps WHERE project_id = 277;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (277, '研究器官位置', '参照人体解剖图，了解心脏、肺、胃、肝、肠等主要器官在体内的位置和大小。', 1),
  (277, '制作躯干外壳', '用泡沫板或厚纸板制作一个简化的人体躯干形状，中间掏空用来放置器官。', 2),
  (277, '塑造各器官', '用不同颜色的黏土分别制作各个器官：红色心脏、粉色肺、黄色胃、棕色肝等。', 3),
  (277, '组装器官模型', '按照正确的解剖位置将各器官放入躯干中，确保每个器官可以单独取出和放回。', 4),
  (277, '标注与讲解', '用标签纸标注每个器官的名称和主要功能，对照模型学习人体器官知识。', 5);

-- [260] 弹射器优化挑战
UPDATE public.projects SET description = '在基础投石机的基础上进行系统优化，通过调整发射角度、臂长比例和弹性强度，挑战将弹丸发射到最远距离。运用科学实验方法记录数据，找到最优发射方案。', difficulty_stars = 3 WHERE id = 260;
DELETE FROM public.project_steps WHERE project_id = 260;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (260, '搭建基础弹射器', '用冰棒棍和橡皮筋组装基础弹射器结构，在投臂端安装塑料勺子作为弹丸托盘。', 1),
  (260, '角度实验', '用量角器测量并记录不同发射角度（30°、45°、60°等），每个角度发射三次取平均距离。', 2),
  (260, '臂长比例实验', '改变支点位置调整投臂两端的比例，保持角度不变，记录不同比例下的发射距离。', 3),
  (260, '弹性实验', '更换不同粗细的橡皮筋或改变橡皮筋数量，观察弹性强度对发射效果的影响。', 4),
  (260, '数据分析', '整理所有实验数据制成表格，分析角度、臂长和弹性三个变量各自的最优值。', 5),
  (260, '最终挑战', '综合所有最优参数组装终极弹射器，向全家展示最远发射距离，讨论工程优化的方法论。', 6);

-- [262] 复合滑轮系统
UPDATE public.projects SET description = '设计并搭建包含多个定滑轮和动滑轮的复合滑轮系统，精确测量不同配置下的省力效果。通过定量实验验证理论计算，深入理解机械效率和能量守恒的关系。', difficulty_stars = 4 WHERE id = 262;
DELETE FROM public.project_steps WHERE project_id = 262;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (262, '单滑轮基准测试', '分别测试单个定滑轮和单个动滑轮提升重物时所需的拉力，记录数据作为对比基准。', 1),
  (262, '设计滑轮组方案', '在纸上画出2种以上不同的复合滑轮组绕绳方案，标注定滑轮和动滑轮的位置。', 2),
  (262, '搭建并测量', '按设计方案逐一搭建滑轮系统，每种方案都用弹簧秤测量拉力，同时测量绳子拉动的距离。', 3),
  (262, '计算机械效率', '用公式"机械效率 = 有用功 ÷ 总功 × 100%"计算每种方案的效率，分析摩擦力的影响。', 4),
  (262, '理论对比验证', '用"承重绳段数"理论值与实测值对比，讨论为什么实际拉力总是比理论值大。', 5),
  (262, '工程应用讨论', '查看吊车、起重机中的复合滑轮系统，讨论如何在省力和效率之间取得最佳平衡。', 6);

-- [224] 自动翻页机
UPDATE public.projects SET description = '设计并制作一台能自动翻动书页的机械装置，利用凸轮和摩擦片实现逐页翻转。你将在这个综合项目中学习机构设计的思维方法，将旋转运动转化为间歇性的翻页动作。', difficulty_stars = 4 WHERE id = 224;
DELETE FROM public.project_steps WHERE project_id = 224;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (224, '分析翻页动作', '观察手动翻页的动作分解：接触页面→摩擦带起一页→翻转过中线→松开页面。设计机构来模仿这个流程。', 1),
  (224, '制作翻页臂', '用硬纸板制作一根可旋转的翻页臂，末端粘上小海绵片增加与纸面的摩擦力以带起书页。', 2),
  (224, '制作驱动凸轮', '制作一个带有缺口的凸轮，安装在手柄轴上。凸轮旋转时推动翻页臂向下压住书页，经过缺口时翻页臂弹起完成翻转。', 3),
  (224, '搭建框架', '制作一个书架形底座，将翻页机构安装在书脊上方，确保翻页臂的活动范围恰好覆盖书页。', 4),
  (224, '测试与调试', '放上杂志，慢速转动手柄测试翻页效果。调整海绵的压力和凸轮的时序，确保每次只翻一页。', 5),
  (224, '持续改进', '尝试加入弹簧复位或多级传动让翻页更稳定，思考如何改为电动驱动实现全自动翻页。', 6);

-- [244] 多材料复合桥
UPDATE public.projects SET description = '综合使用纸板、冰棍棒、绳子等多种材料搭建一座复合桥梁，发挥每种材料的最佳特性！你将理解复合材料的设计理念——用抗压材料做柱子、用抗拉材料做拉索、用轻质材料做桥面。', difficulty_stars = 4 WHERE id = 244;
DELETE FROM public.project_steps WHERE project_id = 244;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (244, '材料分析', '逐一测试每种材料的特性：弯折纸板感受柔韧、压冰棍棒感受硬度、拉棉线感受韧性。', 1),
  (244, '分配角色', '根据材料特性分配功能：冰棍棒做主梁（抗压），棉线做拉索（抗拉），纸板做桥面（轻质大面积）。', 2),
  (244, '搭建主体', '先用冰棍棒搭建桥梁的承重骨架，再用竹签做斜撑加固。', 3),
  (244, '添加拉索', '在关键位置用棉线从高点拉向桥面边缘，提供额外的向上拉力支撑。', 4),
  (244, '铺设桥面', '将裁好的纸板铺在骨架上，用胶带固定边缘，完成桥面装配。', 5),
  (244, '综合测试', '进行承重测试，分析每种材料在整体中的贡献，讨论为什么多材料配合比单一材料更高效。', 6);

-- [223] 弹珠过山车
UPDATE public.projects SET description = '搭建一条包含环形翻转、螺旋下降和跳跃飞台的弹珠过山车轨道，挑战让弹珠顺利跑完全程。你将综合运用重力势能、动能和能量守恒的知识来设计轨道的高度与弯度。', difficulty_stars = 4 WHERE id = 223;
DELETE FROM public.project_steps WHERE project_id = 223;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (223, '规划路线', '在纸上画出过山车的路线草图，包括起始高台、下坡加速段、环形翻转、螺旋弯道和终点。起点必须是全程最高点。', 1),
  (223, '搭建支撑', '用纸板箱和书本搭建不同高度的支撑柱，从高到低排列形成轨道的骨架。', 2),
  (223, '铺设轨道', '将泡沫管纵向剖开作为轨道，依次固定在支撑结构上，注意弯道处要缓和过渡避免弹珠飞出。', 3),
  (223, '制作翻转环', '弯曲一段轨道形成竖直环形，关键是环的顶部高度不能超过起点高度的一半，否则弹珠速度不够会掉下来。', 4),
  (223, '反复调试', '从起点释放弹珠测试全程，逐段排查卡住或飞出的位置，微调轨道角度和衔接直到弹珠能完整跑完。', 5),
  (223, '能量分析', '对比分析为什么每段轨道的最高点都不能超过起点高度——弹珠只靠初始的重力势能运动，摩擦还会消耗部分能量。', 6);

-- [222] 复合齿轮传动装置
UPDATE public.projects SET description = '用纸板制作一套含有多对齿轮的传动装置，实现变速和方向改变。你将深入理解齿轮组的传动比概念，学习如何通过齿轮组合实现加速、减速和改变旋转方向。', difficulty_stars = 4 WHERE id = 222;
DELETE FROM public.project_steps WHERE project_id = 222;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (222, '设计齿轮组', '画出传动方案草图：输入轴上的小齿轮驱动中间轴上的大齿轮（减速），中间轴上的另一个小齿轮再驱动输出轴上的大齿轮（二级减速）。', 1),
  (222, '精确制齿', '用圆规画出4个齿轮：两大两小，用量角器等分齿距确保各齿轮的齿距完全相同，仔细裁剪。', 2),
  (222, '组装中间轴', '在同一根竹签轴上固定一大一小两个齿轮，大齿轮接收上级动力，小齿轮传递给下级。', 3),
  (222, '安装到底板', '将三根轴依次安装到底板上，调整间距使每对齿轮完美咬合，能顺畅转动。', 4),
  (222, '测试传动比', '慢转输入轴一圈，数输出轴转了几圈（或几分之几圈），计算出总传动比并用彩色标记各齿轮方便观察。', 5),
  (222, '变速实验', '交换齿轮的大小搭配方式，体验加速和减速的不同效果，理解齿轮组在自行车变速器和钟表中的应用。', 6);

-- [221] 液压机械臂
UPDATE public.projects SET description = '用注射器和软管搭建液压系统驱动的多关节机械臂，能够夹取和搬运物体。你将深入学习帕斯卡原理，亲身感受液体传递压力的强大力量以及液压系统在工程中的广泛应用。', difficulty_stars = 4 WHERE id = 221;
DELETE FROM public.project_steps WHERE project_id = 221;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (221, '制作液压组', '将三对注射器分别通过软管连接，注入带色水排尽气泡，分别标记为"底座旋转""大臂升降"和"夹爪开合"。', 1),
  (221, '搭建臂架', '用冰棒棍和螺丝制作三段式机械臂骨架：固定底座、可抬升的大臂和前端小臂，关节处用螺丝连接使其能转动。', 2),
  (221, '安装液压缸', '将操作端注射器固定在控制面板上，执行端注射器分别用扎带固定在对应关节两侧，推拉操作端即可驱动关节运动。', 3),
  (221, '制作夹爪', '在小臂末端安装两片可开合的硬纸板夹爪，由第三组液压控制夹合和张开。', 4),
  (221, '协调操控', '同时操控三组注射器，练习精确地控制机械臂移动到目标位置并夹取物体搬运到指定地点。', 5),
  (221, '原理探究', '感受不同大小注射器之间的力量差异，理解帕斯卡原理：密闭液体各处压强相等，改变截面积可放大力。', 6);

-- [283] 心脏工作模型
UPDATE public.projects SET description = '用塑料瓶和气球制作一个可以模拟心脏泵血功能的工作模型！按压气球时水会被"泵"出，松手时水又被吸入。你将直观理解心脏的四个腔室如何通过收缩和舒张来推动血液循环。', difficulty_stars = 4 WHERE id = 283;
DELETE FROM public.project_steps WHERE project_id = 283;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (283, '制作泵体', '将塑料瓶底部剪掉，在瓶口套上气球并用胶固定密封，气球面朝外作为"心室壁"。', 1),
  (283, '安装管道', '在瓶身侧面插入两根吸管作为进出血管，用热熔胶密封连接处防止漏水。', 2),
  (283, '制作单向阀', '在吸管内端用小片气球膜做成单向活瓣，确保水只能朝一个方向流动。', 3),
  (283, '组装并测试', '将模型放入水盆，用红色颜料水代表血液，反复按压气球观察水流方向。', 4),
  (283, '讲解心脏原理', '对照模型讲解心脏的工作方式：心室收缩时血液被泵出，舒张时血液被吸入，瓣膜防止回流。', 5);

-- [261] 液压升降台
UPDATE public.projects SET description = '用注射器和软管制作一个液压升降台，推动一个注射器就能让远处的平台升起。通过这个项目理解帕斯卡定律和液压传动的原理，感受液压系统在工程中的强大力量。', difficulty_stars = 4 WHERE id = 261;
DELETE FROM public.project_steps WHERE project_id = 261;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (261, '制作液压系统', '将两个注射器用软管连接，灌满带颜色的水并排除气泡，确保推一个注射器时另一个会被推出。', 1),
  (261, '搭建升降台结构', '用硬纸板和冰棒棍制作一个可折叠的X形剪刀结构作为升降台支架，底部固定一个注射器。', 2),
  (261, '连接液压驱动', '将升降台底部的注射器与控制端注射器通过软管连接，用防水胶带密封所有接口。', 3),
  (261, '升降测试', '推动控制端注射器，观察升降台平稳升起。释放后升降台在重力作用下下降。', 4),
  (261, '载重实验', '在升降台上放置不同重量的物品，测试液压系统的承载能力，观察大小不同注射器的力量放大效果。', 5),
  (261, '原理探索', '对比分析帕斯卡定律：液体传递压强不变，截面积大的注射器产生更大的力。联想挖掘机和电梯的液压系统。', 6);

-- [263] 自动浇水装置
UPDATE public.projects SET description = '利用虹吸原理和简单的定时机构制作一个自动浇水装置，让花盆在你外出时也能按时得到灌溉。结合物理原理和工程设计，解决实际生活问题。', difficulty_stars = 4 WHERE id = 263;
DELETE FROM public.project_steps WHERE project_id = 263;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (263, '虹吸原理复习', '先做虹吸实验确保理解原理：将灌满水的软管一端放入高处水瓶，另一端放在低处容器中观察水流。', 1),
  (263, '组装浇水系统', '将储水瓶放在高于花盆的位置，用软管或棉线连接水瓶和花盆土壤，利用虹吸效应导水。', 2),
  (263, '控制流量', '用小夹子夹住软管调节水流速度，或在瓶盖上扎不同大小的孔控制出水量，实现缓慢滴灌。', 3),
  (263, '测试校准', '用计时器记录每小时的出水量，调整到适合植物需要的浇水速度（如每天浇水约100毫升）。', 4),
  (263, '实际应用', '将装置部署到家里的花盆上，观察几天确认植物生长良好，计算储水瓶能维持多少天的浇水。', 5),
  (263, '改进方案', '对比分析如何改进：加大储水容量、增加多个出水口浇多盆花、添加水位指示器等，设计升级版方案。', 6);

-- [242] 斜拉桥模型
UPDATE public.projects SET description = '制作一座带有标志性斜拉钢缆的桥梁模型，分析每根拉索承受力的方向和大小！你将了解现代斜拉桥的设计原理，理解拉索如何将桥面重量高效传递到桥塔。', difficulty_stars = 4 WHERE id = 242;
DELETE FROM public.project_steps WHERE project_id = 242;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (242, '搭建桥面', '用冰棍棒平铺并粘合成一条长桥面板，长度约40厘米，宽度约8厘米。', 1),
  (242, '制作桥塔', '用竹签或木棒在桥面中部竖立一根高塔（约20厘米），用纸板三角支架加固塔根。', 2),
  (242, '安装斜拉索', '从塔顶向桥面两侧等间距拉出棉线并固定，形成扇形的斜拉索阵列，每侧4-5根。', 3),
  (242, '调整张力', '逐根调整拉索的松紧度，使桥面在无载荷时保持水平，所有拉索均匀受力。', 4),
  (242, '加载测试', '在桥面不同位置放置重物，观察拉索的张紧变化和桥面的下挠情况。', 5),
  (242, '力学分析', '对比分析斜拉桥与悬索桥的区别，分析为什么不同角度的拉索承受的力大小不同。', 6);

-- [243] 承重优化挑战
UPDATE public.projects SET description = '在限定材料和重量条件下，设计并建造承重比最大的桥梁！你将体验真正的工程优化过程，反复迭代设计方案，在材料用量和承重能力之间找到最佳平衡点。', difficulty_stars = 4 WHERE id = 243;
DELETE FROM public.project_steps WHERE project_id = 243;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (243, '确定规则', '设定挑战规则：桥跨度不小于25厘米，仅用50根冰棍棒和白胶，比拼"承重÷桥重"的效率比。', 1),
  (243, '设计方案', '画出至少两种不同的桥梁设计草图，标注每种方案的冰棍棒分配和结构特点。', 2),
  (243, '建造第一版', '选择一种方案开始建造，注意节约材料，每个节点的胶量尽量少而牢固。', 3),
  (243, '测试记录', '称量桥的自重，然后进行承重测试记录最大承重值，计算效率比。', 4),
  (243, '迭代优化', '根据第一版的测试结果分析弱点，建造改进版本，对比两版数据。', 5),
  (243, '总结经验', '总结哪些设计策略最有效，讨论工程优化中"迭代改进"的重要性。', 6);

-- [241] 开合桥模型
UPDATE public.projects SET description = '制作一座可以打开让"船只"通过的开合桥模型，引入简单的机械结构！你将学习铰链的工作原理，用注射器和水管模拟液压系统驱动桥面升降。机械与结构的完美结合。', difficulty_stars = 4 WHERE id = 241;
DELETE FROM public.project_steps WHERE project_id = 241;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (241, '制作桥身', '用冰棍棒和纸板搭建桥的固定部分和两扇可活动的桥面板。', 1),
  (241, '安装铰链', '在桥面板与桥身连接处用铁丝穿过作为铰链轴，确保桥面可以绕轴旋转抬起。', 2),
  (241, '搭建液压系统', '将两个注射器用软管连接并灌满有色水，一个固定在桥身下方，活塞杆顶住桥面板底部。', 3),
  (241, '测试开合', '推动另一端注射器的活塞，水压传递到桥下的注射器将桥面顶起，实现开合功能。', 4),
  (241, '通行演示', '打开桥面让纸船模型通过，再关闭桥面让小车通行，完整演示开合桥的运作。', 5);

-- [264] 太阳能小车
UPDATE public.projects SET description = '利用太阳能电池板驱动小马达让小车自主行驶，体验光能转化为电能再转化为动能的完整能量链。通过调整太阳能板角度和车身重量，优化小车的行驶性能。', difficulty_stars = 4 WHERE id = 264;
DELETE FROM public.project_steps WHERE project_id = 264;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (264, '测试太阳能板', '在阳光下将太阳能板连接马达，确认马达能在光照下转动，了解太阳能板的正负极。', 1),
  (264, '制作车身和车轮', '用硬纸板剪出车身底盘，用瓶盖做四个车轮，竹签穿过瓶盖中心做车轴，固定在底盘下方。', 2),
  (264, '安装动力系统', '将马达固定在车身上，用橡皮筋将马达转轴和后轮车轴连接形成传动装置。', 3),
  (264, '安装太阳能板', '将太阳能板固定在车身顶部，用导线连接到马达，确保在阳光下马达能驱动车轮转动。', 4),
  (264, '户外测试', '在晴天将小车放在平坦的地面上，观察它在阳光下自主行驶。调整太阳能板角度寻找最佳发电位置。', 5),
  (264, '性能优化', '尝试减轻车身重量、改善轮轴摩擦、优化传动比，记录每次改进后的行驶速度和距离变化。', 6);

-- [284] 比例建筑模型
UPDATE public.projects SET description = '选择一座著名建筑，按照精确比例缩小制作它的模型！你将学习比例尺的概念和应用，掌握精确测量和等比缩放的方法。这个项目对耐心和精确度要求较高，适合有一定手工基础的你。', difficulty_stars = 4 WHERE id = 284;
DELETE FROM public.project_steps WHERE project_id = 284;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (284, '选定建筑与比例', '选择一座感兴趣的建筑（如天安门或埃菲尔铁塔），查阅实际尺寸，确定缩小比例（如1:200）。', 1),
  (284, '绘制图纸', '按比例尺将建筑的正面、侧面和顶部投影图精确地画在纸上，标注所有尺寸。', 2),
  (284, '裁切零件', '按照图纸在纸板或巴尔沙木上精确划线并裁切出所有零部件。', 3),
  (284, '组装结构', '按照从底部到顶部的顺序逐步粘合各零件，随时用直尺检查垂直度和水平度。', 4),
  (284, '细节处理', '添加窗户、门、栏杆等精细装饰，用颜料上色还原建筑真实外观。', 5),
  (284, '验证比例', '测量模型各部位尺寸，验证与原建筑的比例是否一致，总结比例尺的应用方法。', 6);

-- [282] 水循环演示模型
UPDATE public.projects SET description = '制作一个能真实演示蒸发、凝结和降水过程的水循环模型！在密封容器中用热水和冰块模拟自然界的水循环。你将直观看到水蒸气上升、遇冷凝结成水滴并"降雨"的完整过程。', difficulty_stars = 4 WHERE id = 282;
DELETE FROM public.project_steps WHERE project_id = 282;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (282, '搭建地形', '在塑料盒一侧用黏土和石子堆出高低不平的"山地"，另一侧做一个低洼处代表"湖泊"。', 1),
  (282, '布置植被', '在"山地"上放置小塑料植物或绿色海绵，模拟自然植被覆盖。', 2),
  (282, '注入温水', '在低洼处倒入加了蓝色色素的温水代表湖水，水量不宜太多。', 3),
  (282, '加热蒸发', '将装有热水的小碗放在盒内湖水旁边提供热源，盖上盖子，在盖子外侧放上冰块。', 4),
  (282, '观察水循环', '观察温水蒸发后水蒸气上升，遇到冰冷的盖子凝结成小水滴，水滴汇集后滴落回"地面"。', 5),
  (282, '总结原理', '对照模型讲解自然界水循环的完整过程：蒸发→上升→凝结→降水→汇流，循环往复。', 6);

-- [281] 地球内部结构模型
UPDATE public.projects SET description = '制作一个可以切开展示的地球分层模型，展示地壳、地幔、外核和内核四个圈层！你将了解地球并非实心球体，而是由不同物质和温度的圈层组成。通过颜色区分各层，直观理解地球内部构造。', difficulty_stars = 4 WHERE id = 281;
DELETE FROM public.project_steps WHERE project_id = 281;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (281, '学习地球圈层', '查阅资料了解地球的四个圈层：地壳（薄而坚硬）、地幔（高温半流动）、外核（液态金属）、内核（固态金属）。', 1),
  (281, '逐层包裹', '先用红色黏土做一个小球代表内核，再依次用橙色（外核）、黄色（地幔）、蓝色（地壳）层层包裹。', 2),
  (281, '切开截面', '在家长帮助下将球体切成两半或四分之一，露出内部的分层结构。', 3),
  (281, '绘制地表', '在蓝色地壳表面用颜料画出简化的大陆和海洋轮廓。', 4),
  (281, '标注各圈层', '用标签纸标注每一层的名称、厚度和主要特征（温度、状态等）。', 5),
  (281, '讲解地球知识', '对照模型讲解地球内部结构，讨论地震波如何帮助科学家探测地球内部。', 6);

-- [245] 桥梁承重极限测试
UPDATE public.projects SET description = '对多种不同设计的桥梁进行系统化的极限承重测试，收集数据并分析规律！你将像真正的工程师一样设计实验方案、收集数据、绘制图表，用科学方法评估桥梁结构性能。', difficulty_stars = 5 WHERE id = 245;
DELETE FROM public.project_steps WHERE project_id = 245;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (245, '制定测试方案', '设计标准化测试流程：统一跨度、统一加载位置、统一加载速率，确保对比公平。', 1),
  (245, '测量基础数据', '用秤称量每座桥的自重，用直尺量取跨度和高度，记录每座桥的结构类型和材料清单。', 2),
  (245, '逐级加载', '对每座桥从零开始逐级添加重物，每级加载后等待10秒观察是否稳定，记录挠度变化。', 3),
  (245, '记录破坏过程', '继续加载直到桥梁破坏，记录最大承重值、破坏位置和破坏方式（折断、扭曲、节点脱落等）。', 4),
  (245, '数据分析', '将所有数据整理成表格，计算每座桥的承重效率比，绘制"载荷-挠度"曲线图。', 5),
  (245, '撰写报告', '写一份简短的测试报告，总结哪种结构最高效，分析各类桥梁的优缺点和适用场景。', 6);

-- [268] 风力水泵
UPDATE public.projects SET description = '建造一个风力驱动的水泵模型，让风车通过曲柄连杆机构带动活塞泵将水抽起。这个项目综合运用风车、曲柄连杆和活塞泵三种简单机械，是一项完整的机械工程挑战。', difficulty_stars = 5 WHERE id = 268;
DELETE FROM public.project_steps WHERE project_id = 268;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (268, '制作风车部分', '用塑料瓶切割出4-6片叶片安装在竹签转轴上，确保在风力下能稳定旋转。', 1),
  (268, '制作曲柄连杆', '在风车转轴末端偏心安装一个短竹签作为曲柄，用吸管和竹签制作连杆连接曲柄和活塞。', 2),
  (268, '制作活塞泵', '将注射器作为泵体，连杆推拉注射器活塞。在注射器两端分别连接进水管和出水管。', 3),
  (268, '制作单向阀', '用小塑料片在进水管和出水管口制作简易单向阀，确保水只能单方向流动。', 4),
  (268, '组装整体', '将风车、曲柄连杆和活塞泵三个部分组装在支架上，将进水管放入水盆，出水管对准收集容器。', 5),
  (268, '测试与优化', '用电风扇吹动风车，观察活塞泵是否成功抽水。调整各部件配合精度，解决漏水和卡顿问题，实现稳定抽水。', 6);

-- [266] 多级水力发电站
UPDATE public.projects SET description = '搭建一个多级梯田式水力发电模型，水从高处逐级流下依次驱动多个涡轮发电。通过这个综合工程项目，理解级联发电的效率优势和水资源多次利用的智慧。', difficulty_stars = 5 WHERE id = 266;
DELETE FROM public.project_steps WHERE project_id = 266;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (266, '设计阶梯结构', '画出三级阶梯的设计图，每级高度差约10-15厘米，规划水流路径和涡轮安装位置。', 1),
  (266, '搭建阶梯平台', '用塑料板搭建三级阶梯结构，每级之间用倾斜水槽连接引导水流，确保结构稳固防水。', 2),
  (266, '安装涡轮发电机', '在每级阶梯的水流冲击处安装涡轮叶片连接马达，每个马达接一个LED灯。', 3),
  (266, '供水系统', '从顶部持续供水，让水逐级流下依次冲击每一级涡轮，底部水盆收集回流水。', 4),
  (266, '发电测试', '开始供水，观察三级LED灯是否依次亮起。调整水量和涡轮位置优化每级的发电效果。', 5),
  (266, '效率分析', '对比分析级联发电为什么比单级更高效，了解三峡大坝等真实梯级水电站的设计理念和工程挑战。', 6);

-- [288] 城市规划沙盘
UPDATE public.projects SET description = '设计并制作一个完整的城市微缩沙盘，包含住宅区、商业区、工业区、交通系统和公共绿地！你将综合运用建筑、规划和工程知识，思考城市功能分区和交通组织的合理性。这是模型制作的高阶挑战项目。', difficulty_stars = 5 WHERE id = 288;
DELETE FROM public.project_steps WHERE project_id = 288;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (288, '城市功能规划', '在纸上绘制城市总体规划图，划分住宅区、商业区、工业区、绿化带，规划主干道和河流走向。', 1),
  (288, '制作建筑群', '用纸盒制作不同高度和风格的建筑：住宅楼、写字楼、工厂、学校、医院等，涂上不同颜色区分功能。', 2),
  (288, '铺设交通网', '在底板上铺贴道路，制作十字路口、环形交叉和立交桥模型，画出交通标线。', 3),
  (288, '布置绿地和水系', '用假草皮做公园和绿化带，蓝色玻璃纸做河流和湖泊，添加桥梁连接两岸。', 4),
  (288, '安放建筑与设施', '将制作好的建筑按功能分区放置到对应位置，添加路灯、公交站、停车场等配套设施。', 5),
  (288, '总结与评估', '从城市规划角度评估沙盘：功能分区是否合理、交通是否便捷、绿化是否充足，讨论改进方案。', 6);

-- [247] 桥梁材料对比实验
UPDATE public.projects SET description = '用相同的设计方案分别使用纸、冰棍棒、竹签、吸管等不同材料建造桥梁，系统对比材料性能！你将深入理解材料力学的基础概念，体验工程师选择材料时需要考虑的各种因素。', difficulty_stars = 5 WHERE id = 247;
DELETE FROM public.project_steps WHERE project_id = 247;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (247, '统一设计', '设计一种简单的桁架桥方案作为标准，所有材料都按同一图纸建造，仅改变材料。', 1),
  (247, '分组建造', '分别用纸卷管、冰棍棒、竹签、吸管四种材料建造同样结构的桥梁，注意控制变量。', 2),
  (247, '材料属性测试', '在建桥前先测试每种材料的单根抗弯强度和重量，记录基础数据。', 3),
  (247, '统一承重测试', '用相同方法对四座桥进行承重测试，记录最大承重、破坏方式和自重。', 4),
  (247, '数据对比分析', '制作综合对比表格和图表，从承重、效率比、建造难度、成本等维度全面对比。', 5),
  (247, '结论与选材建议', '总结每种材料的优缺点，讨论在真实工程中不同场景下该如何选择桥梁材料。', 6);

-- [267] 自动喂食器
UPDATE public.projects SET description = '设计并制作一个简易的自动定量喂食器，利用重力和机械联动实现定时定量地释放食物。结合齿轮传动、凸轮机构等简单机械原理，打造一个实用的自动化装置。', difficulty_stars = 5 WHERE id = 267;
DELETE FROM public.project_steps WHERE project_id = 267;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (267, '设计机构方案', '在纸上画出喂食器的工作流程图：储料→定量分配→释放到食盆，设计阀门或旋转分配盘的开关机构。', 1),
  (267, '制作储料仓', '将大塑料瓶倒置作为储料仓，底部开口处安装可旋转的纸板分配盘，控制每次出料量。', 2),
  (267, '制作定量机构', '用硬纸板制作带格子的旋转分配盘，每转动一格释放固定量的食物，实现定量控制。', 3),
  (267, '搭建触发装置', '设计一个简单的触发机构：可以是拉线式、翘板式或定时重力式，让分配盘在需要时转动。', 4),
  (267, '组装测试', '将储料仓、分配盘和触发装置组装在一起，放入测试颗粒反复调试，确保每次出料量一致。', 5),
  (267, '优化和展示', '调整各部分尺寸和配合精度，解决卡料和出料不均等问题，向家人展示自动喂食器的使用效果。', 6);

-- [286] 生态系统微缩模型
UPDATE public.projects SET description = '在一个大玻璃容器中构建一个完整的微型生态系统，包含土壤、植物、水体和小动物模型！你将学习食物链、能量流动和物质循环等生态学核心概念。这是一个需要综合运用多学科知识的复杂项目。', difficulty_stars = 5 WHERE id = 286;
DELETE FROM public.project_steps WHERE project_id = 286;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (286, '选择生态类型', '决定要模拟的生态系统类型（森林、池塘、草原或沙漠），查阅该生态系统中的典型生物。', 1),
  (286, '构建地形', '用石子和沙子在容器内塑造地形，包括高低起伏的陆地和低洼的水域区域。', 2),
  (286, '种植植物', '在适当位置铺设苔藓、种植小植物，用枯枝营造林地效果。', 3),
  (286, '制作动物模型', '用黏土制作该生态系统中的代表性动物（如兔子、鹰、蛇等），放置在合理位置。', 4),
  (286, '标注食物链', '用标签和箭头标注出生态系统中的食物链关系：植物→草食动物→肉食动物→分解者。', 5),
  (286, '讲解生态原理', '对照模型讲解能量流动和物质循环，讨论如果某个环节被破坏会对整个生态系统产生什么影响。', 6);

-- [228] 鲁布·戈德堡机械
UPDATE public.projects SET description = '设计并搭建一台鲁布·戈德堡连锁反应装置，用一系列精心设计的机关完成一个简单的最终任务。你将综合运用杠杆、斜面、齿轮、重力等所有学过的机械原理，创造一台富有想象力的连锁反应奇迹。', difficulty_stars = 5 WHERE id = 228;
DELETE FROM public.project_steps WHERE project_id = 228;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (228, '确定最终任务', '选定一个简单的最终目标（如敲响铃铛、戳破气球或倒出一杯水），从这个终点倒推设计各个机关步骤。', 1),
  (228, '设计连锁流程', '在纸上画出至少8个连锁机关的流程图：弹珠滚落→撞倒多米诺→拉动绳子→释放重物→触发杠杆……直到完成最终任务。', 2),
  (228, '逐步搭建', '从最终任务开始向前逐个搭建每个机关。先确保每个单独机关能正常工作，再将它们串联起来。', 3),
  (228, '衔接调试', '最关键的步骤：反复调试每个机关之间的衔接，确保上一个机关的输出能可靠地触发下一个机关。', 4),
  (228, '全程测试', '从第一个机关开始触发，观察连锁反应能传递到第几步。找出失败点逐个修复，直到能一次性跑完全程。', 5),
  (228, '录制与分享', '成功后用手机录制整个连锁反应的过程，总结每个机关用到了什么机械原理，与家人和朋友分享你的杰作。', 6);

-- [225] 多级齿轮变速箱
UPDATE public.projects SET description = '制作一个包含多个档位的齿轮变速箱，能够通过拨杆切换不同的传动比。你将深入理解变速箱的核心原理，学习汽车和自行车变速器是如何通过齿轮组合实现速度变换的。', difficulty_stars = 5 WHERE id = 225;
DELETE FROM public.project_steps WHERE project_id = 225;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (225, '设计传动方案', '画出三档变速的齿轮布局图：输入轴上固定三个不同大小的齿轮，中间轴上对应三个齿轮，通过滑动啮合切换档位。', 1),
  (225, '精密制齿', '用圆规和量角器精确绘制6个齿轮（三大三小），所有齿轮的齿距必须严格一致，仔细裁剪每个齿的轮廓。', 2),
  (225, '制作滑动机构', '在中间轴上安装可沿轴滑动的齿轮组，制作拨叉使其能前后滑动到三个位置分别与不同大小的输入齿轮啮合。', 3),
  (225, '组装箱体', '制作纸板箱体容纳所有齿轮，安装输入轴手柄和输出轴指示器，拨杆从箱体侧面伸出。', 4),
  (225, '测试各档位', '拨到不同档位转动输入轴，观察输出轴的转速变化：低档大力矩慢转速，高档小力矩快转速。', 5),
  (225, '计算传动比', '测量并记录每个档位的传动比，对比汽车变速箱的工作原理，理解为什么起步用低档上坡用低档高速巡航用高档。', 6);

-- [265] 蒸汽动力小船
UPDATE public.projects SET description = '制作一艘靠蜡烛加热水产生蒸汽推动前行的"噗噗船"，重现蒸汽动力的经典原理。通过观察水蒸气的膨胀和冷凝循环，理解热能转化为动能的工作过程。这是工业革命核心技术的微缩演示。', difficulty_stars = 5 WHERE id = 265;
DELETE FROM public.project_steps WHERE project_id = 265;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (265, '制作船身', '用泡沫板或轻木板切割出船的形状，确保底部平整能稳定漂浮在水面上。', 1),
  (265, '制作蒸汽锅炉', '用铝罐制作一个小型密封锅炉，将铜管弯成螺旋形并连接到锅炉上，铜管末端从船尾伸入水下。', 2),
  (265, '安装动力系统', '将锅炉固定在船身上，在锅炉下方放置小蜡烛的位置，铜管出口对准船尾方向并浸入水中。', 3),
  (265, '注水和测试', '先从铜管口注入少量水，放入大水盆中，点燃蜡烛加热锅炉，等待蒸汽产生推动船前行。', 4),
  (265, '观察与调整', '观察蒸汽从管口喷出推船前进的过程，调整蜡烛位置和水量，优化船的行驶速度和稳定性。', 5),
  (265, '蒸汽动力探讨', '对比分析蒸汽机的发明如何引发工业革命，从蒸汽火车到蒸汽轮船，理解热机效率和能量转换。', 6);

-- [248] 仿真桥梁结构分析
UPDATE public.projects SET description = '结合物理模型和简易力学计算，对桥梁进行仿真结构分析！你将学习画受力图、标注力的方向和大小，用简单数学估算各构件承受的力。这是从"搭桥玩"到"设计桥"的质的飞跃。', difficulty_stars = 5 WHERE id = 248;
DELETE FROM public.project_steps WHERE project_id = 248;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (248, '绘制结构简图', '将桥梁模型简化为线条图，标出每个节点和构件的位置，画出结构示意图。', 1),
  (248, '标注外力', '在结构图上标出桥梁承受的所有外力：自重（向下箭头）、载荷（向下箭头）、支座反力（向上箭头）。', 2),
  (248, '分析节点受力', '选择关键节点，画出该节点的受力图，标出每根构件上的拉力或压力方向。', 3),
  (248, '实测验证', '用弹簧秤和细线在实际桥梁模型上测量某些构件的实际受力，与分析结果对比。', 4),
  (248, '找出薄弱环节', '通过力学分析找出受力最大的构件，验证是否与实际承重测试中最先破坏的位置一致。', 5),
  (248, '优化设计方案', '根据分析结果提出优化建议：加强受力大的构件、减少受力小的构件用料，实现更高效的结构设计。', 6);

-- [227] 纸板自动分拣机
UPDATE public.projects SET description = '制作一台能按大小或重量自动将物品分拣到不同通道的纸板机器，体验自动化分拣的工程思维。你将学习如何用纯机械方式实现简单的分拣逻辑，理解工业自动化的基本概念。', difficulty_stars = 5 WHERE id = 227;
DELETE FROM public.project_steps WHERE project_id = 227;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (227, '设计分拣原理', '利用不同大小的筛孔原理：倾斜传送面上依次开设小孔、中孔和大孔，小球先掉入小孔，中球掉入中孔，大球滚到末端。', 1),
  (227, '制作传送坡道', '用纸板制作一个长约40厘米的倾斜坡道，坡度约15度，两侧有挡板防止弹珠滚出。', 2),
  (227, '开设筛选孔', '在坡道上依次开三个逐渐增大的方孔：第一个只让小弹珠通过，第二个让中弹珠通过，大弹珠直接滚到末端。', 3),
  (227, '安装收集通道', '在每个筛选孔下方安装倾斜的导向通道，将掉落的弹珠引导到各自的收集盒中。', 4),
  (227, '测试分拣效果', '从坡道顶部依次放入混合大小的弹珠，观察分拣是否准确。调整孔的大小和位置直到分拣成功率接近100%。', 5),
  (227, '进阶挑战', '思考如何增加按重量分拣的功能（利用翘板原理），或加入手摇传送带实现连续上料和自动分拣。', 6);

-- [285] 可活动人体骨骼模型
UPDATE public.projects SET description = '用硬纸板制作一个各关节可以活动的人体骨骼模型！用铆钉或图钉连接各骨骼部件，实现肩、肘、髋、膝等关节的真实运动。你将深入了解人体骨骼系统的206块骨骼和主要关节的运动方式。', difficulty_stars = 5 WHERE id = 285;
DELETE FROM public.project_steps WHERE project_id = 285;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (285, '研究骨骼结构', '对照人体骨骼图，了解主要骨骼的名称、形状和关节连接方式（球窝关节、铰链关节等）。', 1),
  (285, '绘制骨骼部件', '在白色卡纸上分别画出头骨、脊柱、肋骨、上臂骨、前臂骨、手掌、大腿骨、小腿骨、脚掌等部件。', 2),
  (285, '剪裁打孔', '仔细剪出每个骨骼部件，在关节连接处用打孔器打孔。', 3),
  (285, '铆钉连接关节', '用两脚钉将各部件在关节处连接起来，确保连接松紧适度，能灵活转动但不会太松。', 4),
  (285, '标注骨骼名称', '用记号笔在各骨骼部件上写上名称，如肱骨、股骨、胫骨、肋骨等。', 5),
  (285, '悬挂展示', '在头骨顶部系上细线悬挂起来，尝试活动各关节，讲解不同关节的运动方式和范围。', 6);

-- [246] 大跨度桥梁设计
UPDATE public.projects SET description = '挑战建造跨度超过50厘米的大型桥梁模型，解决大跨度带来的特殊工程难题！你将面对自重增加、中部下挠、侧向不稳等真实工程问题，学习大跨度桥梁设计的核心策略。', difficulty_stars = 5 WHERE id = 246;
DELETE FROM public.project_steps WHERE project_id = 246;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (246, '研究大跨度桥', '查阅世界著名大跨度桥梁资料（如港珠澳大桥、明石海峡大桥），总结大跨度设计的关键技术。', 1),
  (246, '绘制设计图', '在方格纸上精确绘制桥梁设计图，标注尺寸、材料分配和结构细节，跨度目标50厘米以上。', 2),
  (246, '分段建造', '将桥梁分为左段、中段、右段分别建造，每段独立保证质量后再进行整体拼接。', 3),
  (246, '整体组装', '将三段依次连接拼装，用拉索和斜撑加强连接部位，确保整体刚性。', 4),
  (246, '测试与调整', '架桥后检查中部是否下挠，侧向是否稳定，针对薄弱处添加加强构件。', 5),
  (246, '终极承重', '进行最终承重测试，记录数据并与小跨度桥梁对比，分析跨度增大后效率如何变化。', 6);

-- [226] 曲柄连杆发动机模型
UPDATE public.projects SET description = '制作一个活塞式发动机的工作模型，展示曲柄连杆机构如何将活塞的直线往复运动转化为曲轴的旋转运动。你将理解汽车发动机最核心的机械原理，感受工程设计的精妙之处。', difficulty_stars = 5 WHERE id = 226;
DELETE FROM public.project_steps WHERE project_id = 226;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (226, '制作曲轴', '用钳子将粗铁丝弯折成曲轴形状：中间弯出一个偏心的"Z"形曲拐，两端是直线轴段，曲拐偏移量决定活塞行程。', 1),
  (226, '制作汽缸', '用硬纸板卷成圆筒作为汽缸，内径略大于活塞块，使活塞能在缸内顺畅滑动。', 2),
  (226, '制作活塞和连杆', '将小木块修整为能在汽缸内滑动的活塞，用竹签作为连杆连接活塞底部和曲轴的曲拐销。', 3),
  (226, '搭建框架', '制作一个纸板支架固定汽缸和曲轴的两个轴承座，确保曲轴能自由旋转且连杆运动顺畅。', 4),
  (226, '运转测试', '转动曲轴手柄，观察活塞在汽缸内做上下往复运动。反过来推拉活塞，也能带动曲轴旋转。', 5),
  (226, '原理对照', '与真实发动机对比：燃料爆炸推动活塞下行（做功冲程），通过连杆驱动曲轴旋转，飞轮的惯性帮助完成排气和进气冲程。', 6);

-- [287] 机械钟表模型
UPDATE public.projects SET description = '用硬纸板制作一个展示齿轮传动原理的机械钟表模型！通过多个互相咬合的齿轮，将动力从发条传递到指针。你将深入理解齿轮比、传动速率和机械能转换的工程原理。', difficulty_stars = 5 WHERE id = 287;
DELETE FROM public.project_steps WHERE project_id = 287;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (287, '学习齿轮原理', '查看齿轮传动的基本知识：齿轮比、转速关系（大齿轮带小齿轮转快、小齿轮带大齿轮转慢）。', 1),
  (287, '设计齿轮组', '在纸上设计3-4个不同大小的齿轮，计算齿数和模数，确保相邻齿轮能正确啮合。', 2),
  (287, '制作齿轮', '用圆规在纸板上画出齿轮轮廓，用美工刀仔细裁切出齿形，中心打孔装入轴。', 3),
  (287, '组装传动系统', '将齿轮安装在背板上的对应位置，调整轴距使齿轮顺畅啮合，转动一个齿轮时其他齿轮联动。', 4),
  (287, '安装表盘和指针', '制作一个钟表表盘固定在前面，将最后一级齿轮的轴穿过表盘连接指针。', 5),
  (287, '测试与调整', '转动驱动齿轮测试整个传动链是否顺畅，讨论齿轮比如何决定时针和分针的转速差异。', 6);

-- [169] 纸杯振动机器人
UPDATE public.projects SET description = '用纸杯和小马达制作一个会自己移动的振动机器人。你将了解偏心振动产生运动的原理，体验最简单的机器人制作乐趣。', difficulty_stars = 1 WHERE id = 169;
DELETE FROM public.project_steps WHERE project_id = 169;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (169, '组装腿部', '将3-4支彩色笔用胶带均匀固定在纸杯外壁底部，笔尖朝下作为机器人的"腿"，确保杯子能稳定站立。', 1),
  (169, '安装马达', '将振动马达用胶带牢牢固定在纸杯底部内侧中央位置。', 2),
  (169, '连接电源', '将马达导线连接到纽扣电池正负极，用胶带固定电池在杯内。', 3),
  (169, '观察运动', '通电后马达振动带动整个纸杯移动，观察机器人在桌面上的运动轨迹，尝试在纸上留下彩色笔迹。', 4),
  (169, '创意改造', '改变马达位置或笔的数量与角度，观察运动轨迹的变化，理解偏心振动如何转化为位移。', 5);

-- [151] 锡纸导电实验
UPDATE public.projects SET description = '用厨房里的锡纸（铝箔）代替导线连接电路，测试哪些材料能导电、哪些不能！你将亲手验证导体和绝缘体的区别，建立对材料导电性的直观认识。这是一个材料简单但知识点丰富的入门实验。', difficulty_stars = 1 WHERE id = 151;
DELETE FROM public.project_steps WHERE project_id = 151;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (151, '搭建测试电路', '将锡纸剪成两条细长条作为导线，一条连接电池正极和LED长脚，另一条连接电池负极，末端留出空隙。', 1),
  (151, '验证电路', '先用一小段锡纸连接空隙两端，确认LED能亮起来，说明电路搭建正确。', 2),
  (151, '逐一测试材料', '将各种待测材料依次放在电路空隙处，观察LED是否亮起，亮则说明该材料导电。', 3),
  (151, '记录与分类', '在记录纸上列出所有测试结果，将材料分成"导体"和"绝缘体"两类，总结导体通常是金属材质。', 4);

-- [190] 3D打印手机支架
UPDATE public.projects SET description = '设计并打印一个实用的手机支架，可以在桌上稳固地放置手机观看视频。你将学习考虑实际使用需求来设计产品，理解结构稳定性和重心的关系。', difficulty_stars = 1 WHERE id = 190;
DELETE FROM public.project_steps WHERE project_id = 190;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (190, '测量与规划', '用直尺测量手机的宽度和厚度，在纸上画出支架的侧面草图，确定倾斜角度约为60度。', 1),
  (190, '建模底座', '在建模软件中创建一个足够宽的底座，确保放上手机后重心不会前倾导致翻倒。', 2),
  (190, '设计支撑结构', '从底座向上延伸一个带有凹槽的支撑面，凹槽宽度略大于手机厚度，用于卡住手机底部。', 3),
  (190, '打印与测试', '导出STL文件进行切片和打印，打印完成后放上手机测试稳定性，如有问题则调整设计重新打印。', 4);

-- [189] 设计你的名字标牌
UPDATE public.projects SET description = '使用TinkerCAD软件设计一个带有自己名字的个性化标牌，并用3D打印机打印出来。你将学习基础的3D建模操作，理解从数字设计到实体制造的完整流程。', difficulty_stars = 1 WHERE id = 189;
DELETE FROM public.project_steps WHERE project_id = 189;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (189, '注册并认识界面', '在TinkerCAD网站注册一个账号，熟悉工作台上的基本形状和操作工具，学习移动、缩放和旋转视角。', 1),
  (189, '设计底板', '拖入一个长方体作为标牌底板，调整长度约80毫米、宽度30毫米、厚度3毫米。', 2),
  (189, '添加文字', '使用文字工具输入自己的名字，调整字体大小和位置，将文字放在底板上方并对齐居中。', 3),
  (189, '导出并打印', '将设计导出为STL文件，导入切片软件设置打印参数（层高0.2毫米、填充20%），开始3D打印。', 4),
  (189, '后处理展示', '打印完成后小心取下模型，去除支撑材料，用砂纸打磨边缘，完成你的专属名字标牌。', 5);

-- [172] 纸板机器人手偶
UPDATE public.projects SET description = '用纸板和铆钉制作一个关节可动的机器人手偶，通过手指操控实现各种动作。你将学习简单机构和联动原理，理解机器人关节的运动方式。', difficulty_stars = 1 WHERE id = 172;
DELETE FROM public.project_steps WHERE project_id = 172;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (172, '设计外形', '在纸板上画出机器人的头、身体、上臂、下臂和腿各部分，注意关节连接处留出重叠区域。', 1),
  (172, '裁剪部件', '沿轮廓线仔细剪下各个部件，每个部件的连接处用打孔器或铅笔戳出小孔。', 2),
  (172, '组装关节', '用铆钉或图钉将各部件在关节处连接起来，确保每个关节都能自由转动。', 3),
  (172, '添加控制线', '在手臂和腿的末端系上细绳，从背面引出作为操控线，拉动绳子就能让手脚活动。', 4),
  (172, '装饰与表演', '用彩色笔画上机器人的面部和装甲细节，操控你的机器人手偶表演各种动作和故事。', 5);

-- [171] 气球动力机器人
UPDATE public.projects SET description = '利用气球放气产生的反作用力驱动一个简易小车机器人前进。你将直观体验牛顿第三定律，明白火箭和喷气发动机的基本工作原理。', difficulty_stars = 1 WHERE id = 171;
DELETE FROM public.project_steps WHERE project_id = 171;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (171, '制作底盘', '剪一块约15厘米×8厘米的硬纸板作为车身底盘。', 1),
  (171, '安装车轮', '将两根竹签穿过纸板底部前后端做车轴，在竹签两端各插入一个瓶盖做车轮，确保转动顺畅。', 2),
  (171, '安装喷气装置', '将气球套在吸管一端并用胶带密封好，把吸管用胶带固定在车身上方，开口朝后。', 3),
  (171, '发射机器人', '从吸管另一端吹气将气球吹大，用手指捏住吸管口，放在地面上松手，观察小车向前冲出。', 4),
  (171, '对比实验', '改变气球大小或吸管粗细，测量小车行驶距离，理解气体喷出速度和推力的关系。', 5);

-- [170] 牙刷机器人
UPDATE public.projects SET description = '用旧牙刷头和振动马达制作一个灵活的微型机器人。刷毛的弹性和马达的振动配合产生有趣的爬行运动，是入门级机器人制作的经典项目。', difficulty_stars = 1 WHERE id = 170;
DELETE FROM public.project_steps WHERE project_id = 170;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (170, '裁剪牙刷', '用剪刀或小锯将牙刷手柄剪短，只保留刷头和约3厘米的手柄部分作为机器人底盘。', 1),
  (170, '安装马达', '用双面胶将振动马达粘在牙刷头背面，注意马达的偏心块不要被阻挡。', 2),
  (170, '连接电池', '将纽扣电池用胶带固定在马达旁边，将马达导线分别接触电池正负极并固定好。', 3),
  (170, '测试与装饰', '通电后观察牙刷机器人在光滑桌面上快速爬行，贴上小眼睛等装饰让它更可爱。', 4),
  (170, '比赛挑战', '制作多个牙刷机器人进行赛跑比赛，探索刷毛角度和马达位置对速度的影响。', 5);

-- [192] 3D打印书签
UPDATE public.projects SET description = '设计一个薄而有趣的3D打印书签，可以夹在书页上标记阅读进度。你将学习薄壁结构的设计技巧，理解3D打印对最小壁厚的要求。', difficulty_stars = 1 WHERE id = 192;
DELETE FROM public.project_steps WHERE project_id = 192;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (192, '设计书签形状', '在建模软件中创建一个长约120毫米、宽20毫米、厚度仅0.8毫米的薄片作为书签主体。', 1),
  (192, '添加装饰图案', '在书签顶部添加喜欢的形状装饰（如星星、小动物轮廓），使书签露出书页的部分更加美观。', 2),
  (192, '设计夹持结构', '在书签底部设计一个回形夹的结构，让书签能牢固地夹在书页上不易滑落。', 3),
  (192, '切片与打印', '导出STL文件，在切片软件中将层高设为0.12毫米、填充100%以保证薄壁强度，开始打印。', 4),
  (192, '测试使用', '小心取下打印好的书签，测试夹在不同厚度书页上的效果，体验从设计到使用的成就感。', 5);

-- [149] LED 发光贺卡
UPDATE public.projects SET description = '用铜箔胶带和LED灯珠制作一张会发光的创意贺卡！你将学习最基本的电路知识，了解电流从电池正极经过导线和LED回到负极的完整回路。送给家人朋友一张自己做的发光贺卡，既有趣又有心意。', difficulty_stars = 1 WHERE id = 149;
DELETE FROM public.project_steps WHERE project_id = 149;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (149, '设计贺卡图案', '在卡纸上画出贺卡的图案，标记出希望LED发光的位置，比如星星、花朵或灯笼。', 1),
  (149, '铺设铜箔电路', '用铜箔胶带在卡纸背面粘贴出连接电池和LED位置的线路，注意正负极的走向不要交叉。', 2),
  (149, '安装LED灯珠', '将LED灯珠的长脚（正极）和短脚（负极）分别压在对应的铜箔胶带上，用透明胶带固定。', 3),
  (149, '连接电池测试', '将纽扣电池放在铜箔线路的末端，正面朝上对准正极线路，按住观察LED是否亮起。', 4),
  (149, '装饰完成', '确认电路正常后用胶带固定电池，在贺卡正面用彩笔和贴纸装饰，完成你的发光贺卡。', 5);

-- [129] Scratch 电子贺卡
UPDATE public.projects SET description = '用 Scratch 制作一张会动、会说话的电子贺卡，送给家人或朋友。你将练习使用循环、外观特效和声音模块，制作出充满心意的互动贺卡。', difficulty_stars = 1 WHERE id = 129;
DELETE FROM public.project_steps WHERE project_id = 129;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (129, '设计贺卡', '确定贺卡主题（生日、节日、感恩等），在纸上画出贺卡布局，想好要放哪些元素。', 1),
  (129, '制作背景', '在Scratch中绘制贺卡背景，使用绘图工具画上装饰图案、写上祝福文字。', 2),
  (129, '添加互动元素', '添加角色（蛋糕、气球、爱心等），用"重复执行"让它们不断旋转、缩放或改变颜色特效。', 3),
  (129, '设置点击效果', '使用"当角色被点击"积木，让点击不同元素时播放音乐、弹出祝福语或触发动画。', 4),
  (129, '录制祝福', '用Scratch的录音功能录一段祝福语，设置在打开贺卡时自动播放。', 5);

-- [127] 不插电编程：人体机器人
UPDATE public.projects SET description = '一个人扮演"机器人"，另一个人扮演"程序员"，通过发出精确指令完成任务。你将体会到计算机只能执行明确指令，学习指令的精确性和顺序的重要性。', difficulty_stars = 1 WHERE id = 127;
DELETE FROM public.project_steps WHERE project_id = 127;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (127, '设置场地', '在房间里用障碍物布置一条路线，在终点放一个目标物品，让"机器人"需要绕过障碍才能到达。', 1),
  (127, '角色分配', '一人蒙上眼睛扮演"机器人"，另一人扮演"程序员"。机器人只能听从指令行动，不能自己做决定。', 2),
  (127, '发出指令', '程序员使用简单指令（"前进两步""左转""右转""弯腰拿起"）引导机器人到达终点并拿到物品。', 3),
  (127, '遇到Bug', '如果机器人撞到障碍物就算"程序崩溃"，需要回到起点重新开始，程序员要修改指令。', 4),
  (127, '角色互换', '交换角色再玩一次，比较两个人写出的"程序"有什么不同，讨论哪个更高效。', 5),
  (127, '进阶挑战', '尝试让"程序员"提前写好全部指令（而不是边走边说），一次性交给"机器人"执行，体验预编程的难度。', 6);

-- [152] 水果导电测试
UPDATE public.projects SET description = '测试不同水果是否能导电，探究哪种水果的导电能力最强！你将了解水果中的酸性汁液含有离子可以导电的原理。用柠檬、苹果、香蕉等常见水果来做实验，发现大自然中隐藏的电学知识。', difficulty_stars = 1 WHERE id = 152;
DELETE FROM public.project_steps WHERE project_id = 152;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (152, '准备水果电极', '在每个水果上分别插入一片铜片和一根锌钉，间隔约2厘米，插入深度约一半。', 1),
  (152, '单个水果测试', '用导线将一个水果的铜片和锌钉分别连接到LED灯珠的两个引脚，观察是否发光。', 2),
  (152, '串联增强', '如果单个水果电压不够，将多个水果用导线串联起来（前一个的铜片接后一个的锌钉），再连接LED。', 3),
  (152, '对比记录', '记录每种水果单独使用和串联使用时LED的亮度，讨论为什么酸性越强的水果导电性越好。', 4);

-- [126] 不插电编程：指令画图
UPDATE public.projects SET description = '不需要电脑，只用纸和笔就能体验编程的乐趣！你将学会用"上、下、左、右"等简单指令在格子纸上画出图案，理解程序就是一组按顺序执行的指令。', difficulty_stars = 1 WHERE id = 126;
DELETE FROM public.project_steps WHERE project_id = 126;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (126, '认识指令', '查看四个基本方向指令：上↑、下↓、左←、右→，以及"涂色"指令，了解每个指令让画笔移动一格。', 1),
  (126, '跟着指令画', '家长读出一组指令序列（如：右→右→下↓涂色→下↓涂色），你在格子纸上按指令移动并涂色，画出简单图案。', 2),
  (126, '自己编写指令', '你选择一个简单图形（如字母L、十字形），自己写出能画出该图形的指令序列。', 3),
  (126, '交换挑战', '和家长或小伙伴交换指令，互相执行对方写的"程序"，看看能不能画出正确的图案。', 4),
  (126, '验证与测试', '回顾并验证如果指令写错了会怎样（bug），以及怎样让指令更简洁（优化），初步体会调试和优化的概念。', 5);

-- [191] 设计一个骰子
UPDATE public.projects SET description = '用3D建模软件设计一个标准六面骰子，在每个面上刻出正确数量的点数。你将练习精确尺寸控制和布尔运算，学习几何体的面、棱、顶点概念。', difficulty_stars = 1 WHERE id = 191;
DELETE FROM public.project_steps WHERE project_id = 191;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (191, '创建立方体', '在建模软件中创建一个边长为16毫米的正方体，将所有棱角进行圆角处理使骰子更美观。', 1),
  (191, '制作点数凹坑', '创建小球体作为"挖孔"工具，直径约2.5毫米，用来在骰子每个面上刻出对应的点数凹坑。', 2),
  (191, '布置六面点数', '将1到6的点数分别布置在六个面上，注意相对面的点数之和为7（1对6、2对5、3对4）。', 3),
  (191, '布尔运算与打印', '对每个面执行布尔差集运算刻出凹坑，导出STL文件并打印，层高设置为0.1毫米以获得更好的细节。', 4),
  (191, '上色完成', '用丙烯颜料为凹坑上色，让点数更加清晰可见，完成一个漂亮的自制骰子。', 5);

-- [128] Scratch 动画故事
UPDATE public.projects SET description = '使用 Scratch 图形化编程工具创作一段有趣的动画故事，让角色说话、移动和变换造型。你将学习顺序执行、事件触发等编程基础概念，同时发挥想象力创编故事。', difficulty_stars = 1 WHERE id = 128;
DELETE FROM public.project_steps WHERE project_id = 128;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (128, '构思故事', '在纸上画出故事分镜：谁是主角？发生了什么事？有几个场景？先把故事想清楚再开始编程。', 1),
  (128, '搭建舞台', '打开Scratch，选择或绘制背景，添加故事中需要的角色（角色库中选择或自己画）。', 2),
  (128, '让角色动起来', '使用"移动""滑行""切换造型"积木块让角色在舞台上移动和变化，用"说"积木块添加对话。', 3),
  (128, '添加场景切换', '使用"当背景切换到"和"广播消息"积木块实现多场景切换，让故事有起承转合。', 4),
  (128, '加入音效', '从声音库选择或录制音效和背景音乐，让故事更生动有趣。', 5),
  (128, '分享作品', '给作品起个好名字，点击"分享"按钮让朋友也能看到你的动画故事。', 6);

-- [150] 简易手电筒
UPDATE public.projects SET description = '用纸杯、电池和小灯泡组装一个真正能照明的手电筒！你将理解简单电路中电池、导线、开关和灯泡各自的作用。完成后可以在黑暗中使用自己做的手电筒，体验动手制作的成就感。', difficulty_stars = 1 WHERE id = 150;
DELETE FROM public.project_steps WHERE project_id = 150;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (150, '准备灯座', '在纸杯底部中央戳一个小孔，将小灯泡从杯内穿出，灯泡头露在杯底外面。', 1),
  (150, '连接电路', '将两根导线分别连接灯泡底部的两个触点，另一端连接电池盒的正负极。', 2),
  (150, '安装电池', '将电池按正确方向装入电池盒，检查灯泡是否亮起，如不亮检查接触是否良好。', 3),
  (150, '组装外壳', '用胶带将电池盒固定在纸杯内侧，整理好导线，确保手持时不会松动。', 4),
  (150, '测试使用', '关掉房间的灯，用自制手电筒照明，讨论电流是如何从电池流经灯泡形成完整回路的。', 5);

-- [153] LED 创意灯
UPDATE public.projects SET description = '用多颗LED灯珠和并联电路制作一盏漂亮的创意小夜灯！你将学习并联电路的接线方式，理解并联时每个灯泡两端电压相同的特点。还可以发挥创意用彩纸和瓶子制作独特的灯罩。', difficulty_stars = 2 WHERE id = 153;
DELETE FROM public.project_steps WHERE project_id = 153;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (153, '设计灯的造型', '选择一个透明瓶子作为灯体，在纸上画出LED的摆放位置，规划好想要的发光效果。', 1),
  (153, '搭建并联电路', '将所有LED灯珠的正极用导线连在一起，负极也连在一起，形成并联电路，再连接到电池盒。', 2),
  (153, '固定LED灯珠', '用热熔胶将LED灯珠按设计好的位置固定在瓶子内壁或瓶口周围。', 3),
  (153, '制作灯罩', '用彩色薄纸包裹瓶身或剪出图案贴在瓶子上，让光线透过时呈现出美丽的色彩效果。', 4),
  (153, '通电测试', '安装电池通电，在暗处欣赏自己制作的创意灯，讨论并联电路中一颗LED坏了为什么其他灯还能亮。', 5);

-- [196] 动物模型设计
UPDATE public.projects SET description = '用3D建模软件设计一个自己喜爱的小动物模型并打印出来，如小猫、小狗或小兔子。你将学习有机形状的建模方法，提升空间想象力和艺术造型能力。', difficulty_stars = 2 WHERE id = 196;
DELETE FROM public.project_steps WHERE project_id = 196;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (196, '观察与草图', '找到喜欢的动物照片，从正面和侧面观察其外形特征，在纸上画出简化的轮廓草图。', 1),
  (196, '搭建基础形状', '用球体做头部、椭球体做身体，圆柱体做四肢，通过调整大小和位置拼出动物的基本体态。', 2),
  (196, '添加细节特征', '添加耳朵、尾巴、鼻子等特征部位，调整形状使动物看起来更加生动可爱。', 3),
  (196, '合并与优化', '将所有部件合并为一个整体模型，检查是否有悬空部分需要添加支撑，确保可打印性。', 4),
  (196, '打印与上色', '打印模型后用砂纸打磨表面，再用丙烯颜料为小动物涂上逼真的颜色和表情。', 5);

-- [134] 不插电编程：排序体验
UPDATE public.projects SET description = '通过实物卡片体验冒泡排序和选择排序算法，像计算机一样给数字排队。你将理解算法是解决问题的步骤，感受不同排序方法的效率差异。', difficulty_stars = 2 WHERE id = 134;
DELETE FROM public.project_steps WHERE project_id = 134;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (134, '打乱卡片', '将数字卡片打乱顺序排成一排，这就是我们要排序的"数据"。', 1),
  (134, '冒泡排序', '从左到右比较相邻两张卡片，如果左边大就交换位置，一轮走完后最大的数会到最右边。重复直到排好序，记录比较次数。', 2),
  (134, '选择排序', '重新打乱卡片。每轮找出最小的数放到最左边，然后在剩下的数中找最小的放到第二位，以此类推，记录比较次数。', 3),
  (134, '对比分析', '比较两种排序方法的比较次数和交换次数，讨论哪种方法更快，为什么。', 4),
  (134, '生活中的排序', '想一想生活中哪些场景用到了排序（如考试排名、身高排队），讨论计算机排序为什么比人快。', 5);

-- [155] 导电面团实验
UPDATE public.projects SET description = '制作能导电的面团和不导电的面团，用它们搭建有趣的电路！你将通过揉面团和点亮LED的方式学习导体与绝缘体的概念。用面团代替导线搭电路，既安全又好玩，是学习电路的绝佳方式。', difficulty_stars = 2 WHERE id = 155;
DELETE FROM public.project_steps WHERE project_id = 155;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (155, '制作导电面团', '将面粉、大量食盐和水混合揉成面团，盐越多导电性越好。', 1),
  (155, '制作绝缘面团', '将面粉、食用油和少量水（不加盐）混合揉成另一种面团，这种面团不导电。', 2),
  (155, '搭建面团电路', '捏两块导电面团作为"导线"，中间用绝缘面团隔开防止短路，将LED灯珠的两脚分别插入两块导电面团。', 3),
  (155, '通电测试', '用导线将两块导电面团分别连接电池的正负极，观察LED灯是否亮起。', 4),
  (155, '创意电路', '用面团捏出各种造型（小人、动物等），在上面插LED让它们发光，讨论为什么加盐的面团能导电。', 5);

-- [194] 定制笔筒设计
UPDATE public.projects SET description = '设计一个带有多个分隔区域的个性化笔筒，可以分类收纳不同文具。你将学习空心体建模技巧，理解壁厚对结构强度的影响以及"挖空"操作的原理。', difficulty_stars = 2 WHERE id = 194;
DELETE FROM public.project_steps WHERE project_id = 194;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (194, '需求分析', '清点自己常用的文具类型和数量，规划笔筒需要几个分区，在纸上画出俯视图草图。', 1),
  (194, '建模外壳', '创建一个圆柱体或多边形柱体作为笔筒外壳，高度约100毫米，直径约80毫米。', 2),
  (194, '挖空内部', '创建一个略小的相同形状作为"挖孔"对象，从顶部减去形成空心结构，壁厚保留2毫米。', 3),
  (194, '添加分隔板', '在内部添加薄板将空间分隔成不同区域，方便分类放置笔、尺子、橡皮等文具。', 4),
  (194, '装饰与导出', '在外壁添加喜欢的图案或纹理装饰，检查模型完整性后导出STL文件。', 5),
  (194, '打印与使用', '设置合适的打印参数（填充15%、壁厚3层），打印完成后即可用来整理桌面文具。', 6);

-- [173] 弹射机器人
UPDATE public.projects SET description = '用冰棒棍和橡皮筋制作一个弹射装置造型的机器人，能将小球弹射出去。你将学习弹性势能转化为动能的过程，体验投石机的力学原理。', difficulty_stars = 2 WHERE id = 173;
DELETE FROM public.project_steps WHERE project_id = 173;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (173, '制作弹力组', '将8根冰棒棍叠在一起，用橡皮筋紧紧捆住两端形成一个厚实的弹力块。', 1),
  (173, '制作发射臂', '取一根冰棒棍作为发射臂，在一端用热熔胶粘上瓶盖作为"弹射勺"。', 2),
  (173, '组装弹射器', '将发射臂和另一根底座冰棒棍呈十字交叉，把弹力块插入交叉处下方，用橡皮筋将交叉点绑紧固定。', 3),
  (173, '装饰与测试', '贴上机器人眼睛和装饰，在瓶盖中放入小球，按下发射臂然后松手，观察小球被弹射出去的效果。', 4),
  (173, '调节与挑战', '改变弹力块中冰棒棍的数量来调节弹射力度，设置目标杯子进行投射比赛，记录命中率。', 5);

-- [154] 简易开关制作
UPDATE public.projects SET description = '用回形针和图钉制作几种不同类型的简易开关，控制电路的通断！你将理解开关的本质就是控制电路是否闭合。通过制作按压式、滑动式和拨动式开关，了解日常生活中各种开关的工作原理。', difficulty_stars = 2 WHERE id = 154;
DELETE FROM public.project_steps WHERE project_id = 154;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (154, '制作按压开关', '将两个图钉钉在硬纸板上间隔5毫米，之间放一小段铝箔纸折叠的弹片，按下时铝箔接触两个图钉导通。', 1),
  (154, '制作拨动开关', '将一个图钉和一个回形针钉在硬纸板上，旋转回形针可以接触或离开另一个图钉。', 2),
  (154, '搭建测试电路', '用导线将电池、LED灯珠和自制开关串联起来，形成完整电路。', 3),
  (154, '逐个测试', '分别用不同的自制开关控制LED的亮灭，观察开关闭合时灯亮、断开时灯灭。', 4),
  (154, '联系生活', '对比分析家里的灯开关、遥控器按钮等都是什么类型的开关，它们如何控制电路的通与断。', 5);

-- [174] 遥控纸板车
UPDATE public.projects SET description = '用纸板制作车身，配合简易遥控器实现前进和转弯，打造自己的第一辆遥控车。你将学习电机驱动和遥控信号的基本概念，体验远程控制的乐趣。', difficulty_stars = 2 WHERE id = 174;
DELETE FROM public.project_steps WHERE project_id = 174;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (174, '制作底盘', '用硬纸板剪出车身底盘，在前后端标记车轮和电机的安装位置。', 1),
  (174, '安装驱动', '将两个直流电机用热熔胶固定在底盘后部两侧，电机轴上各安装一个瓶盖做驱动轮，前部安装两个自由转动的导向轮。', 2),
  (174, '搭建电路', '将电池盒、开关和遥控接收模块安装在底盘上，用导线将电机分别连接到接收模块的输出端。', 3),
  (174, '制作车壳', '用纸板折叠出机器人造型的车壳，画上酷炫的图案，罩在底盘上。', 4),
  (174, '遥控测试', '用遥控器控制小车前进、后退和转弯，通过单独控制左右电机实现差速转向。', 5),
  (174, '赛道挑战', '用书本搭建赛道障碍物，练习遥控操作技巧，挑战最快完成赛道的记录。', 6);

-- [131] Scratch 打地鼠游戏
UPDATE public.projects SET description = '制作一个打地鼠小游戏：地鼠随机从洞里冒出来，点击它就能得分。你将学习随机数、计时器和计分系统的编程实现，理解事件驱动编程的概念。', difficulty_stars = 2 WHERE id = 131;
DELETE FROM public.project_steps WHERE project_id = 131;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (131, '设计场景', '绘制一个有多个洞口的草地背景，设计地鼠角色的"藏起来"和"冒出来"两个造型。', 1),
  (131, '编程地鼠出现', '使用"随机数"积木让地鼠在不同洞口随机出现，用"等待"控制出现频率，随时间加快增加难度。', 2),
  (131, '实现点击得分', '给地鼠添加"当角色被点击"事件，点中后播放音效、切换造型并给分数变量加分。', 3),
  (131, '添加计时系统', '创建倒计时变量，每秒减一，时间到零时广播"游戏结束"消息并显示最终得分。', 4),
  (131, '优化体验', '添加开始界面、最高分记录、打中和错过的不同音效，让游戏体验更完整。', 5);

-- [193] 3D打印钥匙扣
UPDATE public.projects SET description = '设计一个独一无二的个性化钥匙扣，可以加入自己的名字首字母或喜爱的图案。你将深入学习TinkerCAD的组合与分组功能，培养个性化产品设计的创意思维。', difficulty_stars = 2 WHERE id = 193;
DELETE FROM public.project_steps WHERE project_id = 193;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (193, '创意构思', '在纸上画出钥匙扣的设计草图，确定整体形状（圆形、方形或自定义轮廓），大小控制在40毫米以内。', 1),
  (193, '建模主体', '在TinkerCAD中创建钥匙扣的主体形状，厚度设为4毫米以保证强度，添加一个直径5毫米的挂孔。', 2),
  (193, '添加个性元素', '使用文字工具添加名字首字母，或用基本形状组合出喜欢的图案（如小动物、星星），通过凸起或凹刻方式呈现。', 3),
  (193, '组合与检查', '将所有元素分组合并，检查模型是否有悬空或过薄的部分，确保打印时不会出现问题。', 4),
  (193, '打印与组装', '导出并打印模型，完成后穿入钥匙环，一个专属于自己的钥匙扣就完成了。', 5);

-- [132] Scratch 音乐创作
UPDATE public.projects SET description = '用 Scratch 的音乐积木块创作属于自己的乐曲，把键盘变成钢琴！你将学习音符、节拍和循环的概念，在编程中感受音乐的魅力。', difficulty_stars = 2 WHERE id = 132;
DELETE FROM public.project_steps WHERE project_id = 132;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (132, '认识音乐积木', '探索Scratch音乐扩展中的"播放音符""设置乐器""设置节奏"等积木块，试着播放不同的音符。', 1),
  (132, '编写简单旋律', '参考乐谱，用"播放音符__拍__"积木依次排列音符，编出"小星星"或其他简单歌曲。', 2),
  (132, '制作键盘钢琴', '创建多个琴键角色，分别绑定键盘按键，按下对应键时播放不同音符，实现键盘弹琴。', 3),
  (132, '添加节奏和伴奏', '使用"打鼓"积木块添加节奏，用循环积木让伴奏自动重复播放，和旋律配合。', 4),
  (132, '创作原创曲目', '自由组合不同音符、节拍和乐器，创作一首属于自己的原创音乐作品。', 5);

-- [175] 简易爬坡车
UPDATE public.projects SET description = '设计一辆能爬上斜坡的小车，探索重心位置和轮胎摩擦力对爬坡能力的影响。你将在反复测试中学会调整设计方案，理解重心和摩擦力在机械中的重要作用。', difficulty_stars = 2 WHERE id = 175;
DELETE FROM public.project_steps WHERE project_id = 175;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (175, '制作车体', '用纸板制作坚固的长方形底盘，在底部两端安装竹签车轴和瓶盖车轮。', 1),
  (175, '安装动力', '将电机固定在底盘上，用橡皮筋做传动带连接电机轴和后轮车轴，实现动力传递。', 2),
  (175, '增加摩擦', '在驱动轮外侧缠绕橡皮筋或粘贴砂纸条，增大轮胎与地面的摩擦力。', 3),
  (175, '搭建斜坡测试', '用书本搭建不同角度的斜坡，测试小车能爬上的最大坡度。', 4),
  (175, '优化重心', '在车身不同位置添加配重（如硬币），观察重心变化对爬坡能力的影响，找到最佳配重方案。', 5);

-- [195] 3D打印迷宫球
UPDATE public.projects SET description = '设计一个透明外壳内含有迷宫轨道的球形玩具，小钢珠需要沿着迷宫路径滚到终点。你将学习嵌套结构的设计方法，掌握3D打印一体成型的组装技巧。', difficulty_stars = 2 WHERE id = 195;
DELETE FROM public.project_steps WHERE project_id = 195;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (195, '设计迷宫路径', '在纸上画出迷宫路径草图，包含起点、终点和若干岔路，确保路径宽度足够钢珠通过（约6毫米）。', 1),
  (195, '建模内部轨道', '在建模软件中创建球形内壁，沿球壁内侧建立迷宫轨道和挡板，形成曲折的滚珠通道。', 2),
  (195, '创建外壳', '设计两个半球形外壳，与内部轨道保留足够间隙，预留一个放入钢珠的小口。', 3),
  (195, '打印与组装', '分别打印上下两个半球，放入钢珠后用胶水粘合两半球体，确保密封但钢珠能自由滚动。', 4),
  (195, '测试游玩', '摇晃和旋转迷宫球，尝试将钢珠引导通过迷宫到达终点，和朋友比赛谁先完成。', 5);

-- [176] 橡皮筋动力机器人
UPDATE public.projects SET description = '用橡皮筋储存的弹性势能驱动一个纸板机器人行走，不需要电池和马达。你将理解弹性势能到动能的转换过程，感受机械能量储存与释放的巧妙。', difficulty_stars = 2 WHERE id = 176;
DELETE FROM public.project_steps WHERE project_id = 176;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (176, '制作车身', '用硬纸板剪出机器人造型的车身，在底部前后端开孔用于安装车轴。', 1),
  (176, '安装车轮', '将竹签穿过车身底部做车轴，两端安装瓶盖车轮，后轴车轮要固定在竹签上不能打滑。', 2),
  (176, '安装动力橡皮筋', '将橡皮筋一端挂在车身前端的回形针钩上，另一端绕在后车轴上。', 3),
  (176, '蓄能与释放', '向后滚动车轮使橡皮筋缠绕在车轴上储存弹性势能，放在地面上松手，机器人就会自动向前行驶。', 4),
  (176, '距离挑战', '尝试不同的缠绕圈数，记录行驶距离，找出橡皮筋弹力和行驶距离的关系。', 5);

-- [156] 串联与并联电路对比
UPDATE public.projects SET description = '动手搭建串联和并联两种电路，对比观察灯泡亮度的差异！你将直观理解串联电路中电流只有一条路径而并联电路有多条路径的区别。这是电学学习中最重要的基础概念之一。', difficulty_stars = 2 WHERE id = 156;
DELETE FROM public.project_steps WHERE project_id = 156;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (156, '搭建串联电路', '将2颗LED灯珠首尾相连串联起来，再接上电池，观察两颗灯的亮度并记录。', 1),
  (156, '搭建并联电路', '将另外2颗LED灯珠并排并联在电池两端，每颗灯各自有独立的回路，观察亮度并记录。', 2),
  (156, '对比观察', '对比串联和并联电路中LED的亮度差异，串联时灯较暗，并联时灯更亮。', 3),
  (156, '断路测试', '分别拔掉串联和并联电路中的一颗LED，观察另一颗LED的变化——串联全灭，并联不受影响。', 4),
  (156, '总结规律', '画出两种电路的电路图，讨论串联和并联各自的特点以及在生活中的应用（如节日灯串和家庭照明）。', 5);

-- [130] Scratch 弹球游戏
UPDATE public.projects SET description = '制作一个经典的弹球游戏：控制底部挡板反弹小球，击碎上方的砖块。你将学习坐标系统、角度反弹和条件判断，体验游戏编程的乐趣。', difficulty_stars = 2 WHERE id = 130;
DELETE FROM public.project_steps WHERE project_id = 130;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (130, '创建挡板', '绘制一个长方形挡板角色，用"当按下左/右箭头"积木控制它左右移动，限制不超出舞台边缘。', 1),
  (130, '制作小球', '创建圆形小球角色，设置初始位置和方向，使用"移动""碰到边缘就反弹"让它不断运动。', 2),
  (130, '实现反弹逻辑', '当小球碰到挡板时根据碰撞位置改变反弹角度，碰到舞台底部则游戏结束。', 3),
  (130, '添加砖块', '用克隆功能创建多排砖块，当小球碰到砖块时砖块消失并加分。', 4),
  (130, '完善游戏', '添加计分变量、生命值、游戏开始和结束画面，让游戏更加完整。', 5);

-- [133] Scratch 画笔绘图
UPDATE public.projects SET description = '使用 Scratch 画笔功能编程绘制各种几何图案，从简单的正方形到复杂的万花筒。你将理解循环和角度的概念，体会数学与艺术的美妙结合。', difficulty_stars = 2 WHERE id = 133;
DELETE FROM public.project_steps WHERE project_id = 133;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (133, '学习画笔基础', '添加Scratch画笔扩展，学习"落笔""抬笔""设置颜色""设置粗细"等积木的用法。', 1),
  (133, '画正方形', '使用"重复4次：移动100步，右转90度"画出一个正方形，理解循环如何减少重复代码。', 2),
  (133, '画多边形', '修改循环次数和旋转角度，画出三角形、五边形、六边形，发现"次数×角度=360"的规律。', 3),
  (133, '画螺旋图案', '在循环中逐渐增加移动距离或改变颜色，创作出彩色螺旋线条图案。', 4),
  (133, '创作万花筒', '将画多边形的代码嵌套在另一个循环中，每次旋转一定角度再画，生成令人惊叹的万花筒图案。', 5);

-- [198] 可组装积木设计
UPDATE public.projects SET description = '设计一套可以互相拼接的3D打印积木，各部件之间通过凸起和凹槽精确配合。你将学习制造公差的概念，理解零件配合精度对组装效果的重要影响。', difficulty_stars = 3 WHERE id = 198;
DELETE FROM public.project_steps WHERE project_id = 198;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (198, '设计接口标准', '确定积木的连接方式——凸起直径为5毫米、高4毫米，凹槽直径为5.2毫米、深4毫米，预留0.2毫米的配合间隙。', 1),
  (198, '建模基础块', '设计一个20毫米×20毫米×20毫米的标准积木块，顶面设置凸起，底面设置对应凹槽。', 2),
  (198, '打印测试件', '先打印一对测试积木，检验凸起和凹槽是否能顺畅插入又不会太松，根据实际情况调整公差。', 3),
  (198, '设计多种形状', '在标准接口基础上设计不同形状的积木：长条形、L形、T形等，保持连接口规格统一。', 4),
  (198, '批量打印', '用不同颜色的线材打印完整一套积木（至少10块不同形状），确保每块都能与其他块互相拼接。', 5),
  (198, '创意搭建', '用自己设计的积木搭建各种造型，体验从设计标准到批量生产的完整制造流程。', 6);

-- [157] 简易报警器
UPDATE public.projects SET description = '用蜂鸣器和简易开关制作一个门窗报警器，当门被打开时会发出响亮的警报声！你将学习蜂鸣器的使用方法和常闭开关的原理。这个项目将电子知识应用到实际生活场景中，非常有实用价值。', difficulty_stars = 3 WHERE id = 157;
DELETE FROM public.project_steps WHERE project_id = 157;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (157, '认识蜂鸣器', '查看有源蜂鸣器的正负极，通电即响，正极接电池正极，负极接电池负极。', 1),
  (157, '制作触发开关', '用回形针和图钉制作一个常闭开关：回形针夹着一小片硬纸板绝缘片，抽走绝缘片电路就导通。', 2),
  (157, '连接报警电路', '将电池、蜂鸣器和触发开关用导线串联起来，此时绝缘片插入开关中电路断开。', 3),
  (157, '安装到门上', '将报警器固定在门框上，用细绳将绝缘片连接到门上，门打开时绝缘片被拉出，电路导通蜂鸣器响起。', 4),
  (157, '测试与改进', '开关门测试报警器是否正常工作，讨论如何改进让报警器更灵敏或声音更大。', 5);

-- [137] Scratch 平台跳跃游戏
UPDATE public.projects SET description = '制作一个超级马里奥风格的平台跳跃游戏，控制角色跳跃、奔跑和收集道具。你将学习重力模拟、碰撞检测和关卡设计，挑战更复杂的游戏编程逻辑。', difficulty_stars = 3 WHERE id = 137;
DELETE FROM public.project_steps WHERE project_id = 137;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (137, '创建角色和平台', '绘制主角角色和多个平台色块，将平台角色摆放在舞台上构建关卡地形。', 1),
  (137, '实现左右移动', '用"当按下左/右箭头"控制角色水平移动，添加走路动画切换造型。', 2),
  (137, '模拟重力和跳跃', '创建"速度Y"变量模拟重力，按上箭头时给予向上速度实现跳跃，碰到平台时停止下落。', 3),
  (137, '添加道具和敌人', '添加金币收集和敌人角色，碰到金币加分消失，碰到敌人减血或游戏结束。', 4),
  (137, '设计多关卡', '使用广播消息和背景切换实现多个关卡，每关难度递增，到达出口进入下一关。', 5),
  (137, '完善和测试', '添加生命值显示、得分统计、胜利和失败画面，反复测试调整难度至合适水平。', 6);

-- [136] 用 HTML 做个人主页
UPDATE public.projects SET description = '学习 HTML 和 CSS 基础知识，制作一个介绍自己的个人主页网站。你将了解网页是如何构成的，学会使用标题、段落、图片和链接等基本元素来展示自己的兴趣爱好。', difficulty_stars = 3 WHERE id = 136;
DELETE FROM public.project_steps WHERE project_id = 136;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (136, '认识HTML结构', '创建第一个HTML文件，学习html、head、body标签，用h1写标题，用p写段落，在浏览器中打开查看效果。', 1),
  (136, '添加内容', '用标题标签写名字，用段落介绍自己的爱好，用img标签添加照片，用a标签添加喜欢的网站链接。', 2),
  (136, '用CSS美化', '创建style标签，学习设置字体颜色、背景色、边框和间距，让页面变得好看。', 3),
  (136, '制作多区块', '用div标签将页面分为"关于我""我的爱好""我的相册"等区块，每个区块有不同的背景色和样式。', 4),
  (136, '发布分享', '将网页文件分享给家人在浏览器中打开观看，或了解如何将网页发布到互联网上。', 5);

-- [158] 光控小夜灯
UPDATE public.projects SET description = '用光敏电阻制作一个天黑自动亮灯、天亮自动灭灯的智能小夜灯！你将了解传感器如何感知环境变化并控制电路。光敏电阻是最容易理解的传感器之一，这个项目让你初步认识自动控制的概念。', difficulty_stars = 3 WHERE id = 158;
DELETE FROM public.project_steps WHERE project_id = 158;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (158, '认识光敏电阻', '查看光敏电阻的特性：光线越强电阻越小，光线越弱电阻越大，用手遮挡时可以测量到明显变化。', 1),
  (158, '搭建控制电路', '在面包板上将光敏电阻和固定电阻串联分压，中间节点接三极管基极，三极管集电极接LED。', 2),
  (158, '连接电源', '将电池盒连接到面包板的电源轨道，检查所有连线是否正确。', 3),
  (158, '光照测试', '用手遮挡光敏电阻模拟天黑，观察LED是否亮起；移开手让光照射，LED应该熄灭。', 4),
  (158, '制作灯罩', '为小夜灯制作一个简单的灯罩，放在床头或走廊测试实际使用效果。', 5);

-- [160] 摩尔斯电码通信器
UPDATE public.projects SET description = '制作一个能发出长短信号的摩尔斯电码通信器，用灯光或声音传递秘密消息！你将学习数字编码的基本概念，了解信息是如何用简单的点和划来表达的。这是通信技术最早期的形式。', difficulty_stars = 3 WHERE id = 160;
DELETE FROM public.project_steps WHERE project_id = 160;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (160, '学习摩尔斯电码', '打印一份摩尔斯电码对照表，了解每个字母对应的点（短按）和划（长按）组合。', 1),
  (160, '搭建发报电路', '将按钮开关、LED灯珠和蜂鸣器并联后串联电池，按下按钮时灯亮且发出声音。', 2),
  (160, '组装发报机', '将所有元件固定在硬纸板底座上，按钮放在方便按压的位置，整理好线路。', 3),
  (160, '练习发报', '对照电码表，练习用短按和长按发出自己名字的摩尔斯电码，让搭档来"解码"。', 4),
  (160, '双向通信', '如果条件允许，制作两台发报机用长导线连接，和朋友进行双向摩尔斯电码通信。', 5),
  (160, '延伸学习', '对比分析摩尔斯电码在历史上的重要作用，以及数字编码如何发展成现代计算机的二进制编码。', 6);

-- [180] 提线木偶机器人
UPDATE public.projects SET description = '用纸板和线绳制作一个关节可动的提线木偶机器人，通过操纵杆控制它的四肢动作。你将学习联动控制机构的设计，理解机器人多关节协调运动的基本思路。', difficulty_stars = 3 WHERE id = 180;
DELETE FROM public.project_steps WHERE project_id = 180;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (180, '设计与裁剪', '在纸板上画出机器人的头、躯干、上臂、下臂、大腿和小腿各部件并裁剪出来。', 1),
  (180, '铆接关节', '在各部件的关节连接处打孔，用铆钉将肩、肘、胯、膝关节连接起来，确保活动自如。', 2),
  (180, '安装提线', '在双手、双脚、头部和背部分别系上细绳，绳子的另一端集中连接到两根十字交叉的操纵杆上。', 3),
  (180, '调试控制', '提起操纵杆让木偶悬空，倾斜不同方向的操纵杆使手脚交替运动，练习让机器人做出行走和挥手动作。', 4),
  (180, '装饰表演', '给机器人上色画出酷炫造型，编排一段表演动作，体会多线联动控制的挑战和乐趣。', 5);

-- [179] 风力行走机器人
UPDATE public.projects SET description = '制作一个仅靠风力驱动就能在桌面上行走的机器人，灵感来源于荷兰艺术家Theo Jansen的风力仿生兽。你将学习风能的利用方式和连杆行走机构的设计。', difficulty_stars = 3 WHERE id = 179;
DELETE FROM public.project_steps WHERE project_id = 179;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (179, '制作风车', '用纸或塑料片制作4-6片风车叶片，安装在竹签轴上，确保吹风时能灵活转动。', 1),
  (179, '制作曲柄连杆', '在风车轴上安装偏心曲柄，通过吸管连杆将旋转运动传递到腿部。', 2),
  (179, '制作行走腿', '用吸管和竹签组装出仿生腿结构，每侧至少两条腿，确保落地和抬起的动作交替进行。', 3),
  (179, '组装测试', '将风车、曲柄和腿部连接到纸板机身上，对着风车吹风或用电风扇，观察机器人行走。', 4),
  (179, '优化改进', '调整风车叶片角度、连杆比例和腿部长度，让行走动作更流畅高效，讨论风能转化为机械能的过程。', 5);

-- [197] 3D打印齿轮玩具
UPDATE public.projects SET description = '设计并打印一组能够互相啮合转动的齿轮，安装在底板上制成有趣的机械玩具。你将学习齿轮的基本参数（齿数、模数、压力角），理解齿轮传动的速比关系。', difficulty_stars = 3 WHERE id = 197;
DELETE FROM public.project_steps WHERE project_id = 197;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (197, '学习齿轮知识', '查看齿轮的基本概念：齿数决定大小，模数决定齿的粗细，两个啮合齿轮的模数必须相同。', 1),
  (197, '设计齿轮组', '使用齿轮生成工具创建一大一小两个齿轮（如20齿和10齿，模数1），确保中心距正确以便顺利啮合。', 2),
  (197, '建模底板与轴', '设计安装底板，上面留出两个轴孔，间距等于两齿轮的中心距，轴孔直径与竹签匹配。', 3),
  (197, '打印与组装', '分别打印齿轮和底板，将竹签插入底板轴孔，再把齿轮套在轴上使齿轮啮合。', 4),
  (197, '测试传动', '转动大齿轮观察小齿轮的转速变化，验证传动比：小齿轮转速 = 大齿轮转速 × 大齿轮齿数 ÷ 小齿轮齿数。', 5),
  (197, '扩展创造', '尝试添加更多齿轮组成齿轮链，在最后一个齿轮上装上箭头指针，制成一个有趣的机械联动装置。', 6);

-- [200] 建筑模型设计
UPDATE public.projects SET description = '选择一座喜欢的建筑物，按照一定比例缩小设计并3D打印出精美的建筑模型。你将学习比例尺的概念和建筑结构的基本知识，提升空间想象力。', difficulty_stars = 3 WHERE id = 200;
DELETE FROM public.project_steps WHERE project_id = 200;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (200, '选择建筑与确定比例', '选择一座感兴趣的建筑（如学校、塔楼），查找其实际尺寸，确定缩放比例使模型总高约100-150毫米。', 1),
  (200, '建模主体结构', '按照比例在建模软件中搭建建筑的主体框架——墙壁、楼层、屋顶，注意保持各部分比例协调。', 2),
  (200, '添加建筑细节', '添加门窗、阳台、台阶等细节元素，用布尔运算在墙壁上开出窗洞和门洞。', 3),
  (200, '分件设计', '如果建筑模型较大或有悬空结构，将其拆分为多个可独立打印的部件，设计好拼接接口。', 4),
  (200, '打印与拼装', '分别打印各部件，用胶水拼装组合，必要时用丙烯颜料为建筑模型上色。', 5),
  (200, '展示与介绍', '将完成的建筑模型放在展示底座上，向家人朋友介绍这座建筑的特点和你的设计过程。', 6);

-- [199] 3D打印花瓶
UPDATE public.projects SET description = '使用参数化建模方法设计一个优雅的曲面花瓶，通过调整参数即可生成不同造型。你将学习曲面建模和参数化设计思想，理解数学函数如何塑造美丽的三维形态。', difficulty_stars = 3 WHERE id = 199;
DELETE FROM public.project_steps WHERE project_id = 199;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (199, '了解参数化设计', '查看参数化设计的概念——通过修改数值参数自动改变模型形状，而不是手动拖拽每个面。', 1),
  (199, '定义花瓶轮廓', '用数学曲线定义花瓶的侧面轮廓——底部宽、中间收窄、顶部外翻，设置高度、最大直径等参数。', 2),
  (199, '旋转成体', '将轮廓曲线绕中轴旋转360度生成三维花瓶实体，调整壁厚为2毫米形成空心结构。', 3),
  (199, '参数调试', '修改不同参数观察花瓶造型变化，如增大波浪幅度让瓶身更有动感，找到最满意的造型。', 4),
  (199, '螺旋花瓶模式打印', '在切片软件中启用"花瓶模式"（螺旋外壁），一层连续打印出光滑无缝的花瓶。', 5);

-- [135] Python 绘图小海龟
UPDATE public.projects SET description = '使用 Python 内置的 Turtle 库控制一只小海龟在屏幕上画出各种图形和图案。你将在可视化的环境中学习 Python 基础语法，包括变量、循环和函数调用。', difficulty_stars = 3 WHERE id = 135;
DELETE FROM public.project_steps WHERE project_id = 135;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (135, '初识海龟', '编写第一个Python程序：import turtle，然后用 turtle.forward(100) 和 turtle.right(90) 让海龟走直线和转弯。', 1),
  (135, '画彩色图形', '使用 turtle.color() 设置颜色，用 for 循环画出正方形、三角形和圆形，学习循环语法。', 2),
  (135, '创作花朵图案', '用嵌套循环和旋转组合，让海龟画出由多个几何形组成的花朵或星星图案。', 3),
  (135, '封装成函数', '将画图形的代码封装成函数如 draw_square(size)，学习函数定义和参数的概念。', 4),
  (135, '创作自由画', '综合运用所学，创作一幅完整的海龟画作品（如房子、花园、夜空），分享给家人欣赏。', 5);

-- [139] Scratch 迷宫游戏
UPDATE public.projects SET description = '设计并编程一个迷宫冒险游戏，控制角色避开墙壁找到出口。你将深入学习碰撞检测的编程实现，练习关卡设计和游戏逻辑规划。', difficulty_stars = 3 WHERE id = 139;
DELETE FROM public.project_steps WHERE project_id = 139;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (139, '设计迷宫', '在方格纸上先画好迷宫路线，确保有一条从入口到出口的通路，然后在Scratch背景编辑器中用特定颜色画出迷宫墙壁。', 1),
  (139, '控制角色移动', '创建小角色，用上下左右箭头键控制移动，每次移动几个像素确保能走进迷宫通道。', 2),
  (139, '实现墙壁碰撞', '使用"碰到颜色"积木检测是否碰到墙壁颜色，碰到墙壁则将角色弹回上一个位置。', 3),
  (139, '添加终点判定', '在出口位置放置目标角色或特定颜色区域，碰到时显示"恭喜通关"并记录完成时间。', 4),
  (139, '增加挑战元素', '添加计时器、移动的敌人障碍物、可收集的钥匙和锁住的门，增加游戏趣味性和难度。', 5);

-- [138] Python 猜数字游戏
UPDATE public.projects SET description = '用 Python 编写一个猜数字小游戏：电脑随机想一个数，玩家来猜，程序会告诉你猜大了还是猜小了。你将学习条件判断、循环和随机数等核心编程概念。', difficulty_stars = 3 WHERE id = 138;
DELETE FROM public.project_steps WHERE project_id = 138;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (138, '画流程图', '在纸上画出游戏逻辑流程图：生成随机数→获取猜测→判断大小→提示结果→猜对则结束。', 1),
  (138, '生成随机数', '查看使用 import random 和 random.randint(1, 100) 让电脑随机选一个1到100之间的数。', 2),
  (138, '编写猜测循环', '使用 while 循环和 input() 函数不断获取玩家输入，用 if/elif/else 判断猜大了、猜小了还是猜对了。', 3),
  (138, '添加计次功能', '添加变量记录猜测次数，猜对时显示"你用了X次猜对了！"给出评价。', 4),
  (138, '扩展功能', '添加难度选择（不同数字范围）、再玩一次功能、猜测次数限制等，让游戏更有趣。', 5);

-- [159] 电磁铁起重机
UPDATE public.projects SET description = '用铁钉和漆包线自制电磁铁，再搭建成一台能吸起回形针的小起重机！你将了解电流通过线圈产生磁场的原理。通过改变线圈圈数和电流大小，探究影响电磁铁磁力强弱的因素。', difficulty_stars = 3 WHERE id = 159;
DELETE FROM public.project_steps WHERE project_id = 159;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (159, '绕制电磁铁', '将漆包线紧密地缠绕在铁钉上，至少绕50圈以上，两端留出足够长度用于连接电池，注意线圈方向一致。', 1),
  (159, '测试磁力', '将线圈两端的漆包线刮去绝缘漆，连接电池和开关，按下开关用铁钉靠近回形针，观察是否能吸起来。', 2),
  (159, '搭建起重机架', '用硬纸板制作一个简单的起重机支架，将电磁铁悬挂在顶端，可以用细绳控制升降。', 3),
  (159, '起重操作', '通电后让电磁铁靠近回形针吸起，移动到目标位置后断电释放，模拟起重机的工作过程。', 4),
  (159, '探究实验', '分别改变线圈圈数和电池节数，记录每次能吸起的回形针数量，探究磁力强弱的影响因素。', 5);

-- [177] 纸板液压机械臂
UPDATE public.projects SET description = '用纸板和注射器制作一个液压驱动的机械臂，能够抬起和夹取物体。你将深入理解帕斯卡原理和液压传动系统，体验工业机器人的核心技术。', difficulty_stars = 3 WHERE id = 177;
DELETE FROM public.project_steps WHERE project_id = 177;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (177, '制作液压单元', '将两个注射器通过软胶管连接，注满有色水排尽气泡，推一个活塞观察另一个同步移动。', 1),
  (177, '搭建臂架', '用硬纸板制作底座、大臂和小臂三段，在关节处用螺丝连接使其可转动。', 2),
  (177, '安装液压缸', '将注射器分别固定在关节两侧，推拉控制端注射器即可驱动关节转动。', 3),
  (177, '制作夹爪', '在臂端用纸板制作两片夹爪，通过一组液压注射器控制夹爪的开合动作。', 4),
  (177, '综合操控', '通过推拉不同的控制注射器，协调操控机械臂完成抬起、旋转和夹取物体的动作。', 5),
  (177, '验证与测试', '回顾并验证帕斯卡原理：封闭液体各处压强相等，改变注射器面积比可以实现力的放大效果。', 6);

-- [178] 四足行走机器人
UPDATE public.projects SET description = '用纸板和连杆机构制作一个能模仿动物行走的四足机器人。你将学习连杆机构将旋转运动转化为往复行走运动的原理，感受仿生机器人的魅力。', difficulty_stars = 3 WHERE id = 178;
DELETE FROM public.project_steps WHERE project_id = 178;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (178, '制作曲柄', '在电机轴上固定一个小偏心轮或曲柄臂，将旋转运动转化为偏心运动。', 1),
  (178, '制作连杆与腿', '用纸板剪出四条腿和连杆部件，在连接处打孔，用竹签做铰链连接曲柄与腿部。', 2),
  (178, '组装机身', '制作纸板机身框架，将电机安装在机身中央，四条腿对称安装在两侧，调整连杆长度使步态协调。', 3),
  (178, '通电测试', '连接电池盒和开关，通电后观察四条腿交替抬起落下形成行走动作。', 4),
  (178, '调试步态', '如果行走不稳，调整连杆长度、腿部角度和重心位置，直到机器人能在平面上稳定行走。', 5),
  (178, '仿生思考', '对比机器人和真实动物的行走方式，讨论连杆机构在机械工程中的广泛应用。', 6);

-- [142] Python 文字冒险游戏
UPDATE public.projects SET description = '用 Python 编写一个文字冒险游戏，玩家通过输入选择推动剧情发展，探索不同结局。你将学习字典数据结构来管理游戏场景，理解分支叙事和状态管理。', difficulty_stars = 4 WHERE id = 142;
DELETE FROM public.project_steps WHERE project_id = 142;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (142, '设计故事', '在纸上画出故事的分支流程图：从起点出发，每个场景有2-3个选择，不同选择导向不同场景和结局。', 1),
  (142, '用字典存储场景', '用Python字典定义每个场景，包含描述文字、可选选项和对应的下一个场景ID。', 2),
  (142, '编写游戏引擎', '编写主循环：显示当前场景描述→显示选项→获取玩家输入→跳转到对应场景，直到到达结局场景。', 3),
  (142, '添加游戏元素', '加入背包系统（收集道具）、生命值、随机事件等，使用列表和变量管理玩家状态。', 4),
  (142, '丰富故事内容', '添加更多场景和分支，设计至少3个不同结局（好结局、坏结局、隐藏结局），丰富故事体验。', 5),
  (142, '测试与完善', '反复游玩测试所有分支路线，确保没有死路和逻辑错误，优化文字描述让故事更引人入胜。', 6);

-- [204] 镂空灯罩设计
UPDATE public.projects SET description = '设计一个带有精美镂空图案的灯罩，安装LED灯后能投射出美丽的光影效果。你将学习镂空建模技巧和图案设计方法，感受光与影的艺术魅力。', difficulty_stars = 4 WHERE id = 204;
DELETE FROM public.project_steps WHERE project_id = 204;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (204, '设计灯罩外形', '选择灯罩的基本形状——球形、圆柱形或多面体，建模空心薄壁结构，壁厚约1.5毫米。', 1),
  (204, '绘制镂空图案', '在灯罩壁面上设计镂空图案，可以是几何纹样、星星月亮或自然花纹，图案开口不要太小以确保可打印性。', 2),
  (204, '布尔运算镂空', '将设计好的图案形状从灯罩壁面上减去，形成贯穿的镂空效果，检查是否有断裂的薄弱处。', 3),
  (204, '预留灯口', '在灯罩底部留出放入LED灯的开口和固定结构，确保灯泡不会接触到打印件造成过热。', 4),
  (204, '打印与组装', '打印灯罩，安装LED灯泡，在暗室中点亮，欣赏镂空图案在墙壁和天花板上投射出的美丽光影。', 5);

-- [201] 3D打印机械手指
UPDATE public.projects SET description = '设计并打印一个带有铰链关节的机械手指，拉动线绳就能像真手指一样弯曲。你将学习铰链结构和活动件的设计方法，理解人体手指关节的运动原理。', difficulty_stars = 4 WHERE id = 201;
DELETE FROM public.project_steps WHERE project_id = 201;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (201, '研究手指结构', '观察自己的手指弯曲动作，了解手指有三个指节和两个关节，肌腱通过拉伸控制弯曲和伸展。', 1),
  (201, '设计指节与铰链', '建模三个指节部件，在相邻指节连接处设计铰链结构——一侧为销孔，另一侧为销轴，可绕轴转动。', 2),
  (201, '设计线绳通道', '在每个指节内部留出一条线绳通道，从指尖贯穿到手指底部，供控制线绳穿过。', 3),
  (201, '打印与组装', '打印所有指节，用小螺丝将铰链连接起来，穿入线绳，在手指背面粘贴橡皮筋提供回弹力。', 4),
  (201, '测试与调试', '拉动线绳观察手指弯曲效果，松开后橡皮筋将手指拉回伸直状态，调整线绳长度和橡皮筋张力。', 5),
  (201, '扩展：机械手', '尝试制作五根机械手指并安装在手掌底座上，用五根线绳分别控制每根手指，制成完整的机械手。', 6);

-- [203] 3D打印桥梁结构
UPDATE public.projects SET description = '设计并打印不同结构类型的桥梁模型，通过加载测试比较哪种结构最坚固。你将学习桁架、拱形等经典结构的力学原理，理解结构设计如何用最少材料承受最大荷载。', difficulty_stars = 4 WHERE id = 203;
DELETE FROM public.project_steps WHERE project_id = 203;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (203, '学习桥梁结构', '查看三种经典桥梁结构：简支梁桥（平板）、拱桥（弧形）、桁架桥（三角形网格），画出各自的截面草图。', 1),
  (203, '统一设计规范', '所有桥梁模型使用相同的跨度（150毫米）和材料用量，以便公平比较承载能力。', 2),
  (203, '建模三种桥梁', '分别设计简支梁桥、拱桥和桁架桥的3D模型，桁架桥使用三角形单元构成网格结构。', 3),
  (203, '打印桥梁', '用相同的打印参数（填充率、层高）打印三座桥梁模型，确保材料消耗量接近。', 4),
  (203, '承载测试', '将桥梁架在两个支撑物之间，在桥面中央逐步增加重物，记录每座桥梁断裂时的最大承载重量。', 5),
  (203, '分析与总结', '比较三种结构的承载能力，分析为什么三角形桁架结构最稳固——三角形不易变形，力沿杆件轴向传递。', 6);

-- [161] Arduino LED 跑马灯
UPDATE public.projects SET description = '用Arduino开发板控制一排LED灯珠依次点亮形成跑马灯效果！你将第一次接触编程控制硬件的概念，学习如何用简单的代码让LED按照自己设计的模式闪烁。这是进入创客世界的第一步。', difficulty_stars = 4 WHERE id = 161;
DELETE FROM public.project_steps WHERE project_id = 161;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (161, '搭建LED阵列', '在面包板上将8颗LED灯珠排成一行，每颗LED串联一个220Ω电阻，分别连接到Arduino的2-9号数字引脚。', 1),
  (161, '编写跑马灯代码', '在Arduino IDE中编写程序：用for循环依次将每个引脚设为HIGH点亮LED，延时后设为LOW熄灭，实现依次亮灭效果。', 2),
  (161, '上传程序', '用USB线将Arduino连接到电脑，选择正确的开发板和端口后上传程序。', 3),
  (161, '观察效果', '观察LED灯珠是否按顺序依次点亮形成跑马灯效果，调整延时参数改变速度。', 4),
  (161, '创意模式', '修改代码尝试其他灯光模式：双向跑马灯、中间往两边扩散、随机闪烁等。', 5),
  (161, '分享展示', '将跑马灯安装在纸板造型上（如小房子、汽车），制成一个完整的创意作品。', 6);

-- [92] 苔藓微景观制作
UPDATE public.projects SET description = '收集苔藓和小石子，在玻璃瓶中创造一个迷你生态世界。了解苔藓的生长特点和生态瓶的水循环原理，体验微观生态系统的奇妙。', difficulty_stars = 2 WHERE id = 92;
DELETE FROM public.project_steps WHERE project_id = 92;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (92, '铺设底层', '在玻璃瓶底部铺一层小石子用于排水，再撒一薄层活性炭帮助净化。', 1),
  (92, '添加土壤', '在碎石层上铺上2-3厘米厚的营养土，用手指轻轻压实。', 2),
  (92, '种植苔藓', '将采集来的苔藓轻轻铺在土壤表面，用手指按压使其贴合土壤。', 3),
  (92, '造景装饰', '摆放小石头和装饰物，设计出山坡、小路等微型景观。', 4),
  (92, '喷水养护', '用喷壶均匀喷水，保持苔藓湿润，放在散射光充足的地方养护。', 5);

-- [22] 弹力球高度实验
UPDATE public.projects SET description = '从不同高度释放弹力球，测量反弹高度与下落高度的关系。你将学习弹性和能量转换的概念，理解为什么球不能弹回到原来的高度。', difficulty_stars = 2 WHERE id = 22;
DELETE FROM public.project_steps WHERE project_id = 22;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (22, '设置测量标尺', '用胶带将卷尺固定在墙上，从地面开始向上延伸至少1.5米。', 1),
  (22, '释放与观察', '将弹力球从50厘米高度释放（不要用力扔），观察并记录反弹的最高点。', 2),
  (22, '改变高度', '分别从30厘米、50厘米、80厘米、100厘米和120厘米高度释放，每个高度测三次。', 3),
  (22, '换球测试', '用乒乓球和网球重复实验，记录不同球的反弹表现。', 4),
  (22, '数据分析', '计算每次反弹高度与释放高度的比值，发现球永远不能弹回原高度，因为部分能量在碰撞中转化为热能和声能。', 5);

-- [88] 阳台小菜园
UPDATE public.projects SET description = '在阳台或窗台上种植小白菜、香葱等蔬菜，体验从播种到收获的完整过程。学习植物种植的基本方法，培养耐心和责任感。', difficulty_stars = 2 WHERE id = 88;
DELETE FROM public.project_steps WHERE project_id = 88;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (88, '准备盆土', '在花盆底部铺一层小石子帮助排水，再填入营养土至八分满。', 1),
  (88, '播种', '用手指在土面按出小浅沟，将种子均匀撒入，覆盖薄薄一层细土。', 2),
  (88, '浇水标记', '用喷壶轻轻浇透水，插上标签牌写好品种名和播种日期。', 3),
  (88, '日常管理', '每天检查土壤湿度，保持土面微湿，放在阳光充足的阳台。', 4),
  (88, '观察记录', '每周记录蔬菜的生长变化，测量株高，画下叶子的形状变化。', 5),
  (88, '收获分享', '蔬菜长大后可以采摘品尝，和家人分享自己种出来的蔬菜。', 6);

-- [89] 野花图鉴绘制
UPDATE public.projects SET description = '到户外寻找各种野花，用画笔记录它们的样貌并查阅资料制作手绘图鉴。在观察与绘画中认识身边常见的野生植物，提升自然观察力。', difficulty_stars = 2 WHERE id = 89;
DELETE FROM public.project_steps WHERE project_id = 89;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (89, '户外观察', '到公园、田野或路边寻找野花，仔细观察花朵的颜色、形状和大小。', 1),
  (89, '拍照记录', '用手机给每种野花拍照，记录发现地点和周围环境。', 2),
  (89, '手绘写生', '回家后对照照片，用彩色铅笔画出每种野花的样子，注意花瓣数量和叶片形状。', 3),
  (89, '查阅资料', '通过植物识别APP或书籍查出每种野花的名称和基本信息。', 4),
  (89, '制作图鉴', '在每幅画旁边写上花名、花期、生长环境等信息，装订成自己的野花图鉴。', 5);

-- [91] 年轮观察日记
UPDATE public.projects SET description = '找到树木截面或木头切片，观察和计数年轮。通过研究年轮的宽窄变化了解树木的生长历史，感受大自然中蕴含的时间密码。', difficulty_stars = 2 WHERE id = 91;
DELETE FROM public.project_steps WHERE project_id = 91;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (91, '获取样本', '找一块木头切片或去公园观察新锯开的树桩截面。', 1),
  (91, '数年轮', '用放大镜从中心向外仔细数一数有多少圈年轮，推算树木的年龄。', 2),
  (91, '测量宽度', '用直尺测量不同位置年轮之间的宽度，记录宽窄变化。', 3),
  (91, '画年轮图', '在记录本上画出年轮的示意图，用不同颜色标注宽窄变化区域。', 4),
  (91, '推测故事', '思考年轮宽的年份和窄的年份分别发生了什么，了解气候对树木生长的影响。', 5);

-- [23] 自制指南针
UPDATE public.projects SET description = '用缝衣针和磁铁制作一个简易指南针，观察它如何指向南北方向。你将认识地球磁场的存在，理解磁铁指南北的原理以及指南针在导航中的重要作用。', difficulty_stars = 2 WHERE id = 23;
DELETE FROM public.project_steps WHERE project_id = 23;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (23, '磁化针', '用磁铁沿同一方向在缝衣针上反复摩擦约50次，让针变成一个小磁铁。', 1),
  (23, '制作浮台', '将泡沫或软木塞切成小圆片，把磁化后的针平放在上面。', 2),
  (23, '放入水中', '将带针的浮台轻轻放在浅盘水面上，确保它能自由旋转。', 3),
  (23, '观察指向', '等浮台稳定后，观察针尖指向的方向，用真正的指南针验证是否指向北方。', 4),
  (23, '干扰实验', '将磁铁靠近自制指南针，观察针的偏转，移开后看它是否恢复指向南北方向。', 5);

-- [93] 树皮拓印收集
UPDATE public.projects SET description = '用纸和蜡笔在不同树木的树干上进行拓印，收集各种树皮纹理。比较不同树种的树皮特征，建立自己的树皮纹理图库。', difficulty_stars = 2 WHERE id = 93;
DELETE FROM public.project_steps WHERE project_id = 93;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (93, '选择树木', '在校园或公园里选择几棵不同种类的树，观察它们的树皮有什么不同。', 1),
  (93, '固定纸张', '将白纸用胶带固定在树干上，确保纸面贴紧树皮表面。', 2),
  (93, '拓印纹理', '用蜡笔侧面在纸上均匀涂抹，树皮的凹凸纹理会清晰地显现在纸上。', 3),
  (93, '标注信息', '在每张拓印纸上写好树木名称、位置和拓印日期。', 4),
  (93, '对比分类', '将所有拓印作品排列在一起，按照纹理粗细、深浅进行分类对比。', 5);

-- [113] 自制日晷
UPDATE public.projects SET description = '在没有钟表的古代，人们是怎样知道时间的呢？你将制作一个简易日晷，利用阳光下影子的移动来判断时间。通过这个项目，学习地球自转与太阳位置变化的关系，理解古人的计时智慧。', difficulty_stars = 2 WHERE id = 113;
DELETE FROM public.project_steps WHERE project_id = 113;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (113, '制作日晷盘面', '在纸盘中心用黏土固定一根小木棍，使其垂直站立，这根棍叫做"晷针"。', 1),
  (113, '确定方位', '用指南针找到正北方向，将日晷放在阳光下的空旷处，确保不被遮挡。', 2),
  (113, '标记整点影子', '从上午开始，每隔一小时在盘面上沿影子位置画线并标注当前时间，持续到下午。', 3),
  (113, '测试日晷', '第二天在同一位置和方向放好日晷，观察影子是否对准昨天标记的时间线，验证日晷的准确性。', 4),
  (113, '思考与讨论', '对比分析为什么影子会移动（地球自转），以及不同季节日晷的影子长度会有什么变化。', 5);

-- [42] 自制酸碱指示剂
UPDATE public.projects SET description = '用紫甘蓝汁制作天然的酸碱指示剂，测试家中各种液体的酸碱性！你将看到紫甘蓝汁遇到酸性物质变红、遇到碱性物质变绿的神奇变化。这是认识化学检测方法的入门实验。', difficulty_stars = 2 WHERE id = 42;
DELETE FROM public.project_steps WHERE project_id = 42;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (42, '制作指示剂', '将紫甘蓝切碎，倒入热水浸泡15分钟，用滤网过滤得到紫色的指示剂液体。', 1),
  (42, '准备测试样品', '在每个透明杯中分别倒入白醋、柠檬汁、小苏打水、肥皂水、清水等不同液体。', 2),
  (42, '滴入指示剂', '向每个杯子中加入等量的紫甘蓝指示剂，观察颜色变化。', 3),
  (42, '记录结果', '记录每种液体对应的颜色变化，红色/粉色代表酸性，紫色代表中性，绿色/黄色代表碱性。', 4),
  (42, '归纳总结', '将测试结果按酸碱性排列，制作一张简单的酸碱对照表，讨论生活中常见物质的酸碱性。', 5);

-- [21] 摩擦力滑道实验
UPDATE public.projects SET description = '搭建不同材质的滑道，让小物体从上面滑下来比较速度差异。通过对比实验，你将直观感受不同表面粗糙度对摩擦力大小的影响。', difficulty_stars = 2 WHERE id = 21;
DELETE FROM public.project_steps WHERE project_id = 21;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (21, '搭建斜面', '用书本将木板一端垫高，形成一个固定角度的斜面。', 1),
  (21, '铺设不同材质', '分别在斜面上铺上砂纸、塑料纸和毛巾布三种不同材质的表面。', 2),
  (21, '滑行测试', '将小车放在斜面顶端同一位置释放，用秒表记录滑到底部的时间，每种材质测三次取平均值。', 3),
  (21, '记录数据', '将三种材质表面的滑行时间记录在表格中进行对比。', 4),
  (21, '分析结果', '比较数据得出结论：表面越粗糙摩擦力越大，物体滑行越慢；讨论摩擦力在日常生活中的应用。', 5);

-- [64] 蚂蚁王国观察记
UPDATE public.projects SET description = '制作一个简易的蚂蚁观察巢，长期观察蚂蚁的社会分工和协作行为。了解蚂蚁群体中工蚁、兵蚁和蚁后的不同角色，认识昆虫的社会性行为。', difficulty_stars = 2 WHERE id = 64;
DELETE FROM public.project_steps WHERE project_id = 64;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (64, '搭建观察巢', '将两片透明板平行放置，中间填入湿润的细沙土，间距约1厘米，四周用胶带封住留一个小口。', 1),
  (64, '引入蚂蚁', '在户外蚁巢附近小心地收集一些蚂蚁，放入观察巢中，用深色布遮盖大部分区域模拟地下环境。', 2),
  (64, '日常喂养', '每隔一天在小口处放入少量食物和水滴，保持沙土适当湿润。', 3),
  (64, '观察记录', '每天掀开遮光布观察几分钟，记录蚂蚁是否开始挖掘隧道、如何搬运食物、如何分工合作。', 4),
  (64, '绘制隧道地图', '用纸笔画出蚂蚁挖掘的隧道形状变化，标注不同日期的进展。', 5),
  (64, '总结分享', '写一篇观察报告，描述蚂蚁的社会分工现象，完成后将蚂蚁放回户外。', 6);

-- [43] 水果电池
UPDATE public.projects SET description = '用柠檬、铜币和锌片制作一个能点亮小灯泡的水果电池！你将了解电化学的基本原理，知道化学能如何转化为电能。多个水果串联还能让效果更明显。', difficulty_stars = 2 WHERE id = 43;
DELETE FROM public.project_steps WHERE project_id = 43;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (43, '插入电极', '在每个柠檬上相隔2厘米各插入一片铜片和一根锌钉，插入深度约2厘米。', 1),
  (43, '串联连接', '用导线将第一个柠檬的铜片连接到第二个柠檬的锌钉，依此类推，将所有柠檬串联起来。', 2),
  (43, '连接灯泡', '将第一个柠檬的锌钉和最后一个柠檬的铜片分别连接到LED灯泡的两个引脚。', 3),
  (43, '观察发光', '观察LED灯泡是否亮起，如果太暗可以再增加柠檬的数量。', 4),
  (43, '探究原理', '对比分析为什么柠檬能发电：柠檬汁是电解质，铜和锌是不同活性的金属，产生了电位差。', 5);

-- [46] 色彩分层饮料
UPDATE public.projects SET description = '利用不同浓度糖水的密度差异，制作一杯彩虹分层饮料！你将理解溶液密度的概念，学会如何通过控制糖的浓度来实现液体分层。这是一个视觉效果极佳的实验。', difficulty_stars = 2 WHERE id = 46;
DELETE FROM public.project_steps WHERE project_id = 46;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (46, '配制不同浓度糖水', '在4个小杯中各加等量温水，分别加入4勺、3勺、2勺、1勺白糖，搅拌至完全溶解。', 1),
  (46, '添加颜色', '给每杯糖水加入不同颜色的食用色素，浓度最高的用最深的颜色。', 2),
  (46, '分层倒入', '先将浓度最高（最重）的糖水倒入高杯底部，然后用勺子背面或滴管沿杯壁缓缓加入次浓度的糖水。', 3),
  (46, '逐层叠加', '依次加入浓度越来越低的糖水，每层操作要非常缓慢，避免扰动下层液体。', 4),
  (46, '观察彩虹', '观察最终的分层效果，讨论为什么糖水浓度越高密度越大，重的液体沉在下面。', 5);

-- [115] 制作地层模型
UPDATE public.projects SET description = '地球的表面下方藏着一层又一层的岩石和沉积物，记录着数亿年的历史。你将用不同颜色的材料制作一个地层模型，了解地层是如何一层层堆积形成的，以及化石如何被埋藏在不同层中。', difficulty_stars = 2 WHERE id = 115;
DELETE FROM public.project_steps WHERE project_id = 115;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (115, '了解地层知识', '先阅读关于地层的简单资料，了解沉积岩层的形成过程以及不同地质时期的特点。', 1),
  (115, '铺设底层', '在容器底部铺一层小石子代表最古老的基岩层，再铺一层灰色黏土代表早期沉积层。', 2),
  (115, '逐层堆积', '依次加入不同颜色的沙子和黏土，每一层代表不同的地质时期，在某些层中埋入小塑料玩具模拟化石。', 3),
  (115, '标注地层', '在容器外侧用标签标注每一层代表的地质时期或岩石类型。', 4),
  (115, '模拟地质活动', '轻轻倾斜或挤压容器，观察地层会发生怎样的变形，理解真实地质活动如褶皱和断层的形成。', 5),
  (115, '展示讲解', '向家人或同学展示你的地层模型，讲解每一层的含义和"化石"的位置。', 6);

-- [18] 自制简易潜水艇
UPDATE public.projects SET description = '用塑料瓶制作一艘可以下沉和上浮的迷你潜水艇，体验真实潜水艇的工作原理。你将学习浮力和水压的关系，理解潜水艇通过改变自身重量来控制沉浮。', difficulty_stars = 2 WHERE id = 18;
DELETE FROM public.project_steps WHERE project_id = 18;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (18, '制作潜水艇', '在小塑料瓶侧面戳几个小孔，在瓶底粘上适量橡皮泥作为压舱物，使它刚好能竖直浮在水面上。', 1),
  (18, '放入水中', '将大塑料瓶装满水，把调整好的小瓶放入其中，盖紧大瓶盖。', 2),
  (18, '控制沉浮', '用力挤压大塑料瓶，观察小瓶缓缓下沉；松开手后，小瓶又会慢慢上浮。', 3),
  (18, '调节灵敏度', '增减橡皮泥的重量，找到最佳的平衡点，让潜水艇对挤压的反应更灵敏。', 4),
  (18, '原理分析', '挤压大瓶时水压增大，水被压入小瓶让它变重下沉；松开后水压减小，空气膨胀排出水，小瓶变轻上浮。', 5);

-- [19] 磁力小车
UPDATE public.projects SET description = '制作一辆由磁铁驱动的小车，不需要电池也能跑起来。通过实验探索磁铁的吸引和排斥特性，理解磁力可以转化为驱动物体运动的能量。', difficulty_stars = 2 WHERE id = 19;
DELETE FROM public.project_steps WHERE project_id = 19;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (19, '制作车身', '剪一块长方形硬纸板作为车身底盘，大小约为10厘米×5厘米。', 1),
  (19, '安装车轮', '将竹签穿过纸板底部两端，在竹签两头各插上一个瓶盖作为车轮，确保车轮能自由转动。', 2),
  (19, '安装磁铁', '在车头前方用胶带固定一块磁铁，注意记住朝前的是哪个极。', 3),
  (19, '磁力驱动', '手持另一块磁铁，用同极靠近车头磁铁产生排斥力推动小车前进，或用异极在前方吸引小车前进。', 4),
  (19, '竞速挑战', '设计一条赛道，尝试只用磁铁的吸引和排斥力让小车跑完全程，记录完成时间。', 5);

-- [70] 蝴蝶生命周期记录
UPDATE public.projects SET description = '饲养菜粉蝶的幼虫（菜青虫），完整记录卵→幼虫→蛹→成虫的变态发育全过程。通过长期观察和绘图记录，深入理解昆虫完全变态发育的生命周期。', difficulty_stars = 3 WHERE id = 70;
DELETE FROM public.project_steps WHERE project_id = 70;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (70, '采集幼虫', '在菜地的白菜叶上寻找菜青虫和虫卵，连同叶片一起放入饲养盒。', 1),
  (70, '日常饲养', '每天更换新鲜菜叶，保持饲养盒内适当湿度，清理粪便和残叶。', 2),
  (70, '记录幼虫阶段', '每天观察幼虫的体长变化、蜕皮次数和进食量，用彩色铅笔画出不同龄期幼虫的样子。', 3),
  (70, '记录化蛹过程', '当幼虫停止进食并开始吐丝固定身体时，仔细观察化蛹过程，记录蛹的颜色和形状。', 4),
  (70, '记录羽化过程', '密切关注蛹的颜色变化，当蝴蝶破蛹而出时记录整个过程，观察翅膀展开的过程。', 5),
  (70, '制作生命周期图', '将所有观察记录和图画整理成一张完整的蝴蝶生命周期图，标注每个阶段的持续天数。', 6);

-- [50] CO₂ 气球实验
UPDATE public.projects SET description = '不用嘴吹，利用小苏打和醋产生的二氧化碳气体自动把气球吹大！你将直观看到化学反应产生气体的过程。这个实验安全有趣，是理解化学反应中气体生成的绝佳方式。', difficulty_stars = 3 WHERE id = 50;
DELETE FROM public.project_steps WHERE project_id = 50;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (50, '装入小苏打', '用小漏斗将两勺小苏打装入气球内部。', 1),
  (50, '准备醋瓶', '将白醋倒入塑料瓶中，约瓶身三分之一的高度。', 2),
  (50, '套上气球', '小心地将气球口套在瓶口上，注意先不要让气球里的小苏打掉进瓶中。', 3),
  (50, '触发反应', '将气球提起使小苏打落入醋中，观察瓶内冒泡并且气球慢慢鼓起来。', 4),
  (50, '观察讨论', '观察气球膨胀的大小，讨论是什么气体吹大了气球，为什么二氧化碳能被收集在气球中。', 5);

-- [27] 热气球模型
UPDATE public.projects SET description = '制作一个简易热气球模型，观察热空气如何让它升起。你将亲眼看到热胀冷缩的物理现象，理解热气球飞上天空的科学原理。', difficulty_stars = 3 WHERE id = 27;
DELETE FROM public.project_steps WHERE project_id = 27;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (27, '检查气密性', '检查塑料袋是否有破洞，用胶带封好所有可能漏气的地方，只留一个开口。', 1),
  (27, '制作吊篮', '用轻质纸板做一个小吊篮，用细线连接到塑料袋底部四个角。', 2),
  (27, '加热空气', '用吹风机调到热风档，从开口处向塑料袋内吹入热空气，慢慢将袋子鼓起来。', 3),
  (27, '释放升空', '当袋子充满热空气后，松开手让它自由上升，观察热气球缓缓升起。', 4),
  (27, '观察下降', '热空气冷却后气球会慢慢下降，讨论热胀冷缩原理：热空气密度小于周围冷空气所以会上升。', 5);

-- [71] 鱼的身体结构观察
UPDATE public.projects SET description = '通过对一条新鲜鱼的外部形态和内部结构进行细致观察，了解鱼类适应水中生活的身体特征。学习使用简单的解剖工具，培养科学观察和记录能力。', difficulty_stars = 3 WHERE id = 71;
DELETE FROM public.project_steps WHERE project_id = 71;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (71, '外形观察', '将鱼放在解剖盘上，观察鱼的整体外形：流线型身体、鳞片排列方向、各鳍的位置。', 1),
  (71, '细节记录', '用放大镜观察鳞片的结构、侧线的位置、鳃盖下的鳃丝颜色，画出详细的外形图并标注各部位名称。', 2),
  (71, '鳍的功能分析', '观察并记录背鳍、胸鳍、腹鳍、臀鳍和尾鳍的形状和大小，查阅资料了解每种鳍的功能。', 3),
  (71, '体表触感测试', '戴上手套，用手沿不同方向抚摸鱼体表面，感受鳞片方向和黏液层，思考这些特征如何帮助鱼在水中运动。', 4),
  (71, '绘制结构图', '画一幅完整的鱼体结构标注图，标出所有外部器官的名称和功能。', 5),
  (71, '撰写观察报告', '总结鱼类适应水中生活的身体特征，与陆地动物做简单对比。', 6);

-- [98] 多肉植物繁殖实验
UPDATE public.projects SET description = '用叶插和分株两种方法繁殖多肉植物，比较不同繁殖方式的成功率。了解无性繁殖的原理，亲手培育新的多肉宝宝。', difficulty_stars = 3 WHERE id = 98;
DELETE FROM public.project_steps WHERE project_id = 98;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (98, '取叶片', '从多肉母株上轻轻左右摇动取下几片饱满健康的叶子，确保叶片根部完整。', 1),
  (98, '晾干伤口', '将取下的叶片放在阴凉通风处晾1-2天，让伤口愈合结痂。', 2),
  (98, '叶插摆放', '将晾好的叶片平放在颗粒土表面，不要插入土中，放在散光通风处。', 3),
  (98, '分株操作', '同时从母株上分出带根的侧芽，直接种入新花盆中作为对照组。', 4),
  (98, '养护观察', '每3天喷少量水保持微湿，记录叶片生根发芽和分株生长的时间差异。', 5),
  (98, '总结对比', '对比叶插和分株两种方式的成功率和生长速度，总结各自的优缺点。', 6);

-- [25] 自制针孔相机
UPDATE public.projects SET description = '用鞋盒制作一台真正能成像的针孔相机，看到倒立的影像。这个经典实验让你深入理解小孔成像的原理，体验人类最早的成像技术。', difficulty_stars = 3 WHERE id = 25;
DELETE FROM public.project_steps WHERE project_id = 25;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (25, '涂黑内壁', '用黑色颜料或黑纸将鞋盒内壁全部覆盖，减少内部光线反射。', 1),
  (25, '制作针孔', '在鞋盒一端中央挖一个小方孔，贴上铝箔纸，用大头针在铝箔中心戳一个小而圆的孔。', 2),
  (25, '安装成像屏', '在鞋盒另一端剪出一个方形窗口，用白色薄纸覆盖作为成像屏幕。', 3),
  (25, '观察成像', '将针孔对准明亮的窗外或点燃的蜡烛，从成像屏一侧观察，你会看到清晰的倒立影像。', 4),
  (25, '实验改进', '尝试改变针孔大小，观察影像清晰度和亮度的变化：孔越小影像越清晰但越暗。', 5),
  (25, '原理思考', '对比分析为什么影像是倒立的：因为光沿直线传播，上方物体发出的光穿过小孔后照到屏幕下方。', 6);

-- [74] 水生生物观察
UPDATE public.projects SET description = '从池塘或小溪中采集水样，用放大镜和简易显微镜观察水中的各种微小生物。认识水蚤、水螅、水蜗牛等常见水生生物，了解淡水生态系统的多样性。', difficulty_stars = 3 WHERE id = 74;
DELETE FROM public.project_steps WHERE project_id = 74;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (74, '采集水样', '在池塘、小溪或水沟边用取样瓶采集水样，同时用细网兜捞取水草和水底沉积物。', 1),
  (74, '肉眼初观', '将水样倒入白色浅盘中，在明亮的光线下用肉眼观察，寻找能看到的小生物。', 2),
  (74, '放大观察', '用吸管将发现的小生物转移到培养皿中，用放大镜仔细观察它们的外形和运动方式。', 3),
  (74, '绘图记录', '为每种发现的生物画出外形图，标注体长、颜色和运动特点。', 4),
  (74, '查阅辨认', '借助图鉴或网络资料，辨认发现的水生生物的名称和种类。', 5),
  (74, '总结生态关系', '对比分析这些水生生物之间的食物链关系，画出简单的水塘食物网。观察结束后将生物送回采集地点。', 6);

-- [120] 火山分层模型
UPDATE public.projects SET description = '火山是怎样爆发的？你将制作一个有内部分层结构的火山模型，并用小苏打和醋模拟火山喷发。通过这个项目，学习火山的内部结构、岩浆通道以及火山喷发的化学反应原理。', difficulty_stars = 3 WHERE id = 120;
DELETE FROM public.project_steps WHERE project_id = 120;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (120, '制作火山外形', '将空塑料瓶放在托盘中央，用黏土围绕瓶子塑造出火山锥的形状，注意留出瓶口作为火山口。', 1),
  (120, '展示内部分层', '在火山模型一侧做一个"剖面"窗口，用不同颜色的黏土表示地壳、地幔和岩浆通道等内部结构。', 2),
  (120, '上色装饰', '待黏土干燥后用颜料给火山上色，山顶涂白色模拟积雪，山腰涂绿色和棕色模拟植被和岩石。', 3),
  (120, '准备喷发材料', '在瓶中加入两勺小苏打、几滴红色食用色素和一点洗洁精，搅拌均匀。', 4),
  (120, '模拟喷发', '慢慢倒入白醋，观察"岩浆"从火山口涌出的壮观景象，观察气泡和泡沫的产生过程。', 5),
  (120, '验证与测试', '回顾并验证真实火山喷发的成因（地球内部压力和热量），以及模拟实验中小苏打和醋发生酸碱反应产生二氧化碳气体的原理。', 6);

-- [48] 铁锈实验
UPDATE public.projects SET description = '对比观察铁钉在不同环境下的生锈速度，探究铁生锈需要哪些条件！你将通过设置对照实验，理解氧化反应的概念以及水和氧气在生锈过程中的作用。培养科学实验的对照思维。', difficulty_stars = 3 WHERE id = 48;
DELETE FROM public.project_steps WHERE project_id = 48;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (48, '设计对照组', '杯1：铁钉放在干燥空气中；杯2：铁钉浸没在清水中；杯3：铁钉浸没在盐水中。', 1),
  (48, '设置实验', '分别将铁钉放入对应的玻璃杯中，杯1保持干燥，杯2加满清水，杯3加盐水，贴好标签。', 2),
  (48, '每日观察', '连续5-7天，每天同一时间观察并记录每根铁钉的变化，拍照对比。', 3),
  (48, '对比分析', '对比三组铁钉的生锈程度，盐水中的最快，干燥环境最慢，验证生锈需要水和氧气。', 4),
  (48, '防锈讨论', '对比分析生活中常见的防锈方法（涂漆、镀锌、涂油），理解隔绝水和氧气能防止氧化。', 5);

-- [49] 自制灭火器
UPDATE public.projects SET description = '用小苏打和醋产生二氧化碳气体，制作一个简易灭火器扑灭小蜡烛火焰！你将理解二氧化碳比空气重且不支持燃烧的特性。这个实验需要在家长监督下进行，兼顾安全教育。', difficulty_stars = 3 WHERE id = 49;
DELETE FROM public.project_steps WHERE project_id = 49;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (49, '准备灭火器', '在塑料瓶中放入小苏打，瓶盖上钻一个小孔作为喷嘴。', 1),
  (49, '点燃蜡烛', '请家长在托盘上点燃小蜡烛，确保周围没有易燃物。', 2),
  (49, '启动灭火器', '快速将白醋从瓶盖小孔倒入瓶中并立刻盖紧，瓶内会产生大量二氧化碳气体。', 3),
  (49, '喷射灭火', '将瓶口的小孔对准蜡烛火焰，轻轻挤压瓶身让气体喷出，观察火焰熄灭。', 4),
  (49, '原理讲解', '对比分析二氧化碳为什么能灭火：它比空气重，覆盖在火焰上隔绝了氧气，火就熄灭了。', 5);

-- [73] 昆虫标本制作
UPDATE public.projects SET description = '收集自然死亡的昆虫，学习简单的标本制作技术，将昆虫标本整齐地固定在标本盒中并标注信息。了解昆虫的身体结构，体验科学标本制作的基本方法。', difficulty_stars = 3 WHERE id = 73;
DELETE FROM public.project_steps WHERE project_id = 73;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (73, '收集昆虫', '在户外收集自然死亡的昆虫（路灯下、窗台上），选择身体完整的个体，注意不要伤害活体昆虫。', 1),
  (73, '软化处理', '如果昆虫已经干硬，放入密封盒中加湿纸巾软化1～2天，使肢体可以调整。', 2),
  (73, '展翅整姿', '用镊子小心展开昆虫的翅膀和足，用大头针在泡沫板上固定好姿态，保持对称。', 3),
  (73, '干燥定型', '将固定好的标本放在通风干燥处晾干约一周，让标本完全定型。', 4),
  (73, '制作标签', '为每个标本写标签，包括名称、采集日期、采集地点和采集人。', 5),
  (73, '装盒展示', '将干燥定型的标本固定在标本盒中，贴上标签，制作成整齐的昆虫标本展示盒。', 6);

-- [28] 自制温度计
UPDATE public.projects SET description = '用瓶子、吸管和彩色水制作一个简易温度计，观察液柱随温度升降。你将理解热膨胀原理，知道温度计是如何利用液体受热膨胀来测量温度的。', difficulty_stars = 3 WHERE id = 28;
DELETE FROM public.project_steps WHERE project_id = 28;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (28, '制作彩色液体', '在瓶中装入约四分之三的水，加入几滴食用色素搅拌均匀。', 1),
  (28, '安装吸管', '将吸管插入瓶中使下端浸入水中但不触底，用橡皮泥密封瓶口，确保完全气密。', 2),
  (28, '标记刻度', '在室温下用笔在吸管上标记当前液面位置作为基准线。', 3),
  (28, '加热测试', '将瓶子放入温热水中，观察吸管中的液柱缓慢上升，标记新位置。', 4),
  (28, '冷却测试', '将瓶子放入冷水中，观察液柱下降，标记新位置。', 5),
  (28, '理解原理', '液体受热膨胀体积变大，被密封的空间挤压，只能沿吸管上升，这就是温度计的工作原理。', 6);

-- [24] 声音可视化实验
UPDATE public.projects SET description = '用保鲜膜和盐粒让声音变得"看得见"，观察不同声音频率产生的振动图案。你将直观理解声波是一种振动，不同频率的声音会产生不同的振动模式。', difficulty_stars = 3 WHERE id = 24;
DELETE FROM public.project_steps WHERE project_id = 24;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (24, '制作振动膜', '用保鲜膜紧紧蒙住碗口，用橡皮筋固定，确保膜面绷得很平很紧。', 1),
  (24, '撒上盐粒', '在保鲜膜表面均匀撒上一薄层细盐粒。', 2),
  (24, '播放声音', '将音箱靠近碗口播放音乐，观察盐粒随声音振动跳跃和移动的情况。', 3),
  (24, '测试不同频率', '用手机播放不同频率的纯音（可搜索"频率测试音"），观察低频和高频声音对盐粒运动的不同影响。', 4),
  (24, '记录发现', '记录不同频率下盐粒形成的图案，讨论为什么高频声音让盐粒跳得更快但幅度更小。', 5);

-- [116] 自制简易气象站
UPDATE public.projects SET description = '气象学家是怎样预测天气的？你将制作温度计读数牌、风向标和简易气压计等工具，组成一个小型气象站。通过每天记录和分析多项气象数据，培养科学观测习惯，理解各种气象要素之间的关系。', difficulty_stars = 3 WHERE id = 116;
DELETE FROM public.project_steps WHERE project_id = 116;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (116, '制作简易气压计', '将气球剪开蒙在玻璃瓶口上，用橡皮筋扎紧。将吸管一端粘在气球膜上，另一端指向旁边竖立的刻度纸。气压变化会使气球膜凹凸，带动吸管上下移动。', 1),
  (116, '组装气象站', '选择室外一个固定的观测点，将温度计、风向标、雨量计和气压计分别安放好，制作一块展示板标明各仪器名称。', 2),
  (116, '设计记录表', '制作包含日期、时间、温度、风向、降雨量、气压变化和云量的记录表格，准备每天填写。', 3),
  (116, '每日观测', '每天在固定时间（如早上8点和下午3点）到气象站读取各仪器的数据，认真记录在表格中。', 4),
  (116, '数据分析', '一周后回顾所有数据，尝试找出温度、气压和天气变化之间的关系，比如气压下降是否预示着下雨。', 5),
  (116, '尝试天气预报', '根据你发现的规律，试着预测第二天的天气，然后验证你的预测是否准确。', 6);

-- [96] 叶脉书签制作
UPDATE public.projects SET description = '使用碱水煮叶片去除叶肉，保留精美的叶脉网络制作透明书签。在制作过程中观察叶脉的分布规律，了解叶脉在植物中输送水分和养分的功能。', difficulty_stars = 3 WHERE id = 96;
DELETE FROM public.project_steps WHERE project_id = 96;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (96, '煮碱水', '在锅中加水，放入适量食用碱，大人帮忙加热至微微沸腾。', 1),
  (96, '煮叶片', '将洗净的树叶放入碱水中小火煮20-30分钟，直到叶肉变得软烂。', 2),
  (96, '刷去叶肉', '取出叶片放在清水中，用旧牙刷轻轻刷去叶肉，只留下叶脉网络。', 3),
  (96, '漂白染色', '将叶脉放入清水中漂洗干净，再放入稀释的食用色素溶液中染上喜欢的颜色。', 4),
  (96, '晾干装饰', '将染好色的叶脉夹在书本中压平晾干，粘在卡纸上穿上丝带做成精美书签。', 5);

-- [119] 水循环模型
UPDATE public.projects SET description = '地球上的水是怎样循环往复的？你将用一个密封容器制作微型水循环模型，亲眼观察蒸发、凝结和降水的过程。通过这个项目，直观理解自然界水循环的完整过程以及太阳能在其中的关键作用。', difficulty_stars = 3 WHERE id = 119;
DELETE FROM public.project_steps WHERE project_id = 119;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (119, '搭建地形', '在透明盒子的一端用小石子和沙子堆出一个小"山坡"，另一端放入小碗作为"湖泊"。', 1),
  (119, '加入水源', '在小碗中倒入温水（可加几滴蓝色食用色素使水更醒目），水面不要超过碗的边缘。', 2),
  (119, '密封盒子', '盖上盖子或用保鲜膜密封盒子，在盖子顶部"山坡"一侧放上几块冰块。', 3),
  (119, '放在阳光下', '将盒子放在阳光充足的窗台上，让太阳加热盒内的水。', 4),
  (119, '观察水循环', '观察温水蒸发后在盖子上形成水滴（凝结），水滴积聚后沿冰块冷却的一侧滑落（降水），流回"湖泊"或沿"山坡"流下。', 5),
  (119, '记录与讲解', '画出你观察到的水循环过程示意图，标注蒸发、凝结、降水三个环节，并解释太阳在水循环中的作用。', 6);

-- [26] 密度彩虹塔
UPDATE public.projects SET description = '利用不同密度的液体在一个杯子里叠出漂亮的彩虹分层效果。你将学习密度的概念，理解为什么不同液体可以像楼层一样整齐地分层。', difficulty_stars = 3 WHERE id = 26;
DELETE FROM public.project_steps WHERE project_id = 26;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (26, '倒入蜂蜜', '先往杯底缓慢倒入蜂蜜，这是密度最大的液体，形成最底层。', 1),
  (26, '加入洗洁精', '沿杯壁非常缓慢地倒入洗洁精，让它浮在蜂蜜上方形成第二层。', 2),
  (26, '倒入彩色水', '用勺子背面抵住杯壁，让染了色的水沿勺背缓缓流入，形成第三层。', 3),
  (26, '加入食用油', '同样沿杯壁缓慢加入食用油，形成第四层。', 4),
  (26, '放入小物体', '分别放入葡萄、塑料珠、木块等小物体，观察它们停留在不同层之间，进一步理解密度决定沉浮。', 5);

-- [94] 植物蒸腾作用实验
UPDATE public.projects SET description = '用塑料袋套住植物枝叶，观察袋子内壁出现的水珠。通过实验直观地了解植物蒸腾作用，理解植物在水循环中的重要角色。', difficulty_stars = 3 WHERE id = 94;
DELETE FROM public.project_steps WHERE project_id = 94;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (94, '套袋实验', '选取植物一根有叶子的枝条，用透明塑料袋套住并用绳子扎紧袋口。', 1),
  (94, '设置对照', '另一个袋子套在没有叶子的枝条上，还有一个袋子在叶片两面涂上凡士林后套袋。', 2),
  (94, '等待观察', '将植物放在阳光下，每隔1小时观察各个袋子内壁的水珠情况。', 3),
  (94, '称量对比', '4小时后取下塑料袋，用电子秤称量袋中积累的水分重量。', 4),
  (94, '分析讨论', '比较三组实验结果，解释为什么有叶子的枝条蒸腾最多，以及凡士林的作用。', 5);

-- [95] 无土栽培实验
UPDATE public.projects SET description = '不用泥土，利用营养液和支撑材料种植蔬菜或花卉。对比无土栽培与土壤种植的生长差异，理解植物生长所需的基本营养元素。', difficulty_stars = 3 WHERE id = 95;
DELETE FROM public.project_steps WHERE project_id = 95;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (95, '制作容器', '将塑料瓶从中间切开，上半部分倒扣在下半部分中，瓶口朝下作为种植篮。', 1),
  (95, '固定种子', '在上半部分的瓶口处塞入湿海绵，将种子放在海绵上方，保持湿润。', 2),
  (95, '配制营养液', '按照说明书将营养液稀释后倒入下半部分容器，液面刚好接触到海绵底部。', 3),
  (95, '对照实验', '同时用普通泥土在另一个花盆中种下相同的种子，保持其他条件一致。', 4),
  (95, '记录对比', '每天测量两组植物的株高和叶片数，持续记录2-3周。', 5),
  (95, '总结报告', '制作对比图表，分析无土栽培和土壤种植的优缺点。', 6);

-- [47] 自制彩色晶体
UPDATE public.projects SET description = '用明矾或食盐培养属于自己的彩色晶体，见证小小的晶种慢慢长大的过程！你将学习溶解度随温度变化的规律以及结晶的原理。这需要耐心等待几天，但成果会非常惊艳。', difficulty_stars = 3 WHERE id = 47;
DELETE FROM public.project_steps WHERE project_id = 47;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (47, '制作饱和溶液', '在热水中不断加入明矾并搅拌，直到无法再溶解为止，制成过饱和溶液。', 1),
  (47, '添色过滤', '加入喜欢的食用色素搅匀，用滤纸过滤掉未溶解的杂质，倒入干净的玻璃杯。', 2),
  (47, '悬挂晶种', '将棉线系在铅笔上，末端可绑一小颗明矾晶体作为晶种，横搁在杯口让线悬入溶液。', 3),
  (47, '耐心等待', '将玻璃杯放在阴凉不被打扰的地方，每天观察晶体的生长情况，持续3-7天。', 4),
  (47, '收获晶体', '取出长好的晶体，观察它的形状和颜色，讨论温度降低时溶质从溶液中析出结晶的过程。', 5);

-- [29] 杠杆平衡实验
UPDATE public.projects SET description = '用尺子和橡皮搭建杠杆，探索力矩与平衡的秘密。你将通过动手实验理解杠杆原理——力乘以力臂等于阻力乘以阻力臂，感受阿基米德"给我一个支点"的力量。', difficulty_stars = 3 WHERE id = 29;
DELETE FROM public.project_steps WHERE project_id = 29;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (29, '搭建杠杆', '将三角形积木放在桌上作为支点，把直尺平放在支点上，调整使直尺平衡。', 1),
  (29, '等臂实验', '在尺子两端等距位置各放一枚硬币，确认杠杆保持平衡。', 2),
  (29, '改变位置', '将一侧的硬币移近支点，观察杠杆失去平衡；在另一侧增减硬币使其重新平衡。', 3),
  (29, '记录数据', '系统地改变硬币数量和位置，记录每次平衡时两侧"硬币数×距离"的乘积。', 4),
  (29, '发现规律', '分析数据后发现：平衡时两侧的"力×力臂"总是相等的，这就是杠杆原理。', 5),
  (29, '生活应用', '找出生活中的杠杆应用实例：剪刀、跷跷板、开瓶器等，判断它们的支点、力点和阻力点。', 6);

-- [51] 自制肥皂
UPDATE public.projects SET description = '用皂基和天然精油制作属于自己的手工肥皂！你将了解皂化反应的基本概念，知道油脂与碱反应后如何变成清洁用品。还可以发挥创意制作不同形状和香味的肥皂。', difficulty_stars = 3 WHERE id = 51;
DELETE FROM public.project_steps WHERE project_id = 51;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (51, '融化皂基', '将皂基切成小块放入耐热量杯，用微波炉加热30秒（或隔水加热），直到完全融化。', 1),
  (51, '添加色素和香味', '在液态皂基中加入几滴食用色素和精油，用搅拌棒轻轻搅匀，避免产生过多气泡。', 2),
  (51, '倒入模具', '将调配好的皂液倒入硅胶模具中，表面有气泡可用牙签戳破。', 3),
  (51, '冷却脱模', '室温放置1-2小时或冰箱冷藏30分钟后脱模，取出手工肥皂。', 4),
  (51, '测试与讨论', '用自制肥皂洗手体验效果，讨论肥皂如何通过亲水基和亲油基去除油污。', 5);

-- [72] 鸟巢观察与记录
UPDATE public.projects SET description = '在春夏季节寻找鸟巢，从远处安全地观察鸟类的筑巢过程和育雏行为。记录鸟巢的位置、材料和结构，了解不同鸟类筑巢策略的差异。', difficulty_stars = 3 WHERE id = 72;
DELETE FROM public.project_steps WHERE project_id = 72;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (72, '寻找鸟巢', '在春天留意树上、屋檐下、灌木丛中频繁飞进飞出的鸟儿，顺着它们的路线找到鸟巢位置。', 1),
  (72, '远距离观察', '在不惊扰鸟类的距离（至少5米以外）用望远镜观察，记录鸟巢的位置高度、所在树种和朝向。', 2),
  (72, '记录筑巢材料', '观察亲鸟叼回的筑巢材料（树枝、草茎、泥土、羽毛等），推测鸟巢的结构组成。', 3),
  (72, '观察育雏行为', '记录亲鸟喂食幼鸟的频率和时间规律，观察雏鸟的成长变化。', 4),
  (72, '绘制观察日记', '将每次观察的内容画成图文日记，包括鸟巢的样子、亲鸟的行为和雏鸟的变化。', 5),
  (72, '总结鸟巢知识', '查阅资料对比不同鸟类的筑巢方式（杯状巢、洞巢、平台巢等），写成知识小报。', 6);

-- [97] 果实与种子传播方式
UPDATE public.projects SET description = '收集不同类型的果实和种子，研究它们各自的传播方式。通过观察种子的外形特征，推测风力传播、动物传播、弹射传播等策略，感叹大自然的智慧。', difficulty_stars = 3 WHERE id = 97;
DELETE FROM public.project_steps WHERE project_id = 97;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (97, '采集种子', '到户外收集各种果实和种子，如蒲公英绒球、苍耳刺果、枫树翅果等。', 1),
  (97, '观察特征', '用放大镜仔细观察每种种子的形态特征，注意有没有翅膀、钩刺、绒毛等结构。', 2),
  (97, '模拟传播', '试着吹蒲公英、把苍耳粘在衣服上、挤压豌豆荚，模拟各种传播方式。', 3),
  (97, '分类归纳', '根据传播方式将种子分为风力传播、动物传播、弹射传播、水力传播等类别。', 4),
  (97, '制作展板', '将种子粘在展板上，画出传播方式示意图，写上每种种子的名称和传播策略。', 5);

-- [117] 矿物硬度测试
UPDATE public.projects SET description = '钻石为什么能切割玻璃？因为它是最硬的矿物！你将收集几种常见矿物和日常物品，按照莫氏硬度标准互相刮擦测试，给矿物排出硬度等级。通过这个实验，学习莫氏硬度计的原理和矿物鉴定的基本方法。', difficulty_stars = 3 WHERE id = 117;
DELETE FROM public.project_steps WHERE project_id = 117;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (117, '学习莫氏硬度', '阅读莫氏硬度对照表，了解1-10级硬度标准以及每级的代表矿物，记住常见参照物的硬度：指甲2.5、铜币3.5、铁钉5.5、玻璃5.5。', 1),
  (117, '刮擦测试', '取一块矿物，先用指甲刮擦，如果留下痕迹说明硬度低于2.5；再用铜币、铁钉依次测试，找出该矿物的大致硬度范围。', 2),
  (117, '互相刮擦', '用不同矿物互相刮擦，记录哪块能在哪块上留下划痕，这能帮你排出硬度高低顺序。', 3),
  (117, '记录结果', '制作一张矿物硬度表，列出每种矿物的名称、颜色、光泽和测定的硬度等级。', 4),
  (117, '对照鉴定', '将你的测试结果与莫氏硬度对照表比较，尝试确认每种矿物的名称，讨论硬度在矿物鉴定中的重要性。', 5);

-- [118] 星座观察记录
UPDATE public.projects SET description = '夜空中闪烁的星星组成了美丽的星座图案。你将在晴朗的夜晚观察夜空，学习辨认几个著名的星座，并用星图记录它们的位置。通过持续观察，了解星座随季节变化的原因以及古人利用星座导航的故事。', difficulty_stars = 3 WHERE id = 118;
DELETE FROM public.project_steps WHERE project_id = 118;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (118, '学习基础星座', '在室内先通过星座图学习3-5个当季容易辨认的星座，如北斗七星、猎户座或天蝎座，记住它们的形状。', 1),
  (118, '选择观测条件', '选一个晴朗无月光或月光较弱的夜晚，找一个远离路灯的开阔地点，带上所有材料。', 2),
  (118, '辨认星座', '用指南针确定方位，面向正确的方向，对照星座图在夜空中寻找目标星座，用红色手电筒查看星图（红光不影响夜视）。', 3),
  (118, '绘制星空记录', '在记录本上画出你看到的星座位置和周围明亮的星星，标注日期、时间和方位。', 4),
  (118, '多次观察比较', '在不同日期和时间重复观察，比较同一星座在夜空中位置的变化。', 5),
  (118, '总结规律', '总结你的观察发现，讨论为什么星座在夜空中会移动（地球自转和公转），以及不同季节能看到不同星座的原因。', 6);

-- [30] 液压机械臂
UPDATE public.projects SET description = '用注射器和软管制作一个液压驱动的机械臂，实现夹取物体的动作。你将学习帕斯卡原理，理解液压系统如何将小力放大为大力来完成工作。', difficulty_stars = 4 WHERE id = 30;
DELETE FROM public.project_steps WHERE project_id = 30;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (30, '制作液压系统', '将两个注射器通过软管连接，注入水排尽空气，推一个注射器活塞观察另一个被推出。', 1),
  (30, '搭建臂架', '用硬纸板或冰棒棍制作机械臂的骨架，包括底座、大臂和小臂三个部分，用螺丝连接形成可转动的关节。', 2),
  (30, '安装液压缸', '将注射器分别固定在关节两侧，一端固定在臂架上，另一端通过软管连到控制端的注射器。', 3),
  (30, '制作夹爪', '在机械臂末端安装两片硬纸板做成夹爪，用一组液压注射器控制开合。', 4),
  (30, '操控测试', '推拉控制端的注射器来操控机械臂的各个关节，尝试夹取小物体搬运到指定位置。', 5),
  (30, '验证与测试', '感受帕斯卡原理：密闭液体传递压强不变，改变注射器大小可以实现力的放大或缩小。', 6);

-- [32] 简易电动机
UPDATE public.projects SET description = '用铜线、磁铁和电池制作一个能旋转的简易电动机。你将亲手实现电能到动能的转换，理解磁场对通电导线产生力的作用。', difficulty_stars = 4 WHERE id = 32;
DELETE FROM public.project_steps WHERE project_id = 32;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (32, '绕制线圈', '将铜线在电池上绕5-6圈制成圆形线圈，两端各留出约3厘米作为轴，两个轴要在同一直线上。', 1),
  (32, '处理轴端', '用砂纸将一端的漆皮全部刮除，另一端只刮除半边（上半面），这是电动机工作的关键。', 2),
  (32, '制作支架', '将两个回形针弯成支架形状，用橡皮筋分别固定在电池正负极两端。', 3),
  (32, '组装电动机', '将磁铁放在电池上方，线圈的两个轴分别架在回形针支架上。', 4),
  (32, '启动旋转', '轻轻拨动线圈使其开始旋转，如果一切正确，线圈将持续自动旋转。', 5),
  (32, '原理探索', '对比分析半刮漆的作用：它使线圈每转半圈断电一次，利用惯性继续转动，形成持续的旋转运动。', 6);

-- [99] 植物色素提取
UPDATE public.projects SET description = '从不同颜色的花瓣和叶片中提取天然色素，并用这些色素进行简单的染色或绘画。了解植物中色素的种类和功能，探索天然染料的奥秘。', difficulty_stars = 4 WHERE id = 99;
DELETE FROM public.project_steps WHERE project_id = 99;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (99, '研磨植物', '将紫甘蓝叶撕碎放入研钵，加少量酒精或热水，用力研磨直到液体变色。', 1),
  (99, '过滤提取', '用纱布过滤研磨液，将彩色滤液收集到玻璃杯中，分别提取不同植物的色素。', 2),
  (99, '酸碱变色', '向紫甘蓝色素液中分别加入醋和小苏打水，观察颜色的奇妙变化。', 3),
  (99, '天然染色', '将白色棉布浸入不同的色素液中，观察布料的染色效果。', 4),
  (99, '色素绘画', '用提取的各色色素当作颜料，在白纸上画一幅天然色素画。', 5),
  (99, '总结报告', '记录各种植物色素的颜色特点、酸碱变色现象，分析色素在植物中的作用。', 6);

-- [33] 自制望远镜
UPDATE public.projects SET description = '用两片不同焦距的放大镜制作一架简易望远镜，能看清远处的物体。你将学习凸透镜的成像原理，理解望远镜如何通过两片透镜的组合实现放大远处物体的效果。', difficulty_stars = 4 WHERE id = 33;
DELETE FROM public.project_steps WHERE project_id = 33;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (33, '初步测试', '两手各拿一片放大镜，伸直手臂拿大镜，靠近眼睛拿小镜，对准远处物体前后调整距离直到看清。', 1),
  (33, '制作镜筒', '将两个纸筒套在一起，确保内筒可以在外筒中自由伸缩以调节焦距。', 2),
  (33, '安装镜片', '将大放大镜固定在外筒前端作为物镜，小放大镜固定在内筒后端作为目镜。', 3),
  (33, '内壁遮光', '在纸筒内壁贴上黑色卡纸以减少杂散光的干扰，提高成像质量。', 4),
  (33, '调焦观察', '将望远镜对准远处景物，缓慢伸缩内筒调节焦距，直到看到清晰放大的影像。', 5),
  (33, '注意事项', '严禁用望远镜直接观察太阳！可以观察远处的建筑、树木和月亮等安全目标。', 6);

-- [100] 嫁接与扦插实验
UPDATE public.projects SET description = '学习并实践植物的嫁接和扦插两种无性繁殖技术。通过亲手操作了解植物形成层的愈合过程，观察新植株的生长发育。', difficulty_stars = 4 WHERE id = 100;
DELETE FROM public.project_steps WHERE project_id = 100;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (100, '准备材料', '选择健壮的砧木和新鲜的接穗枝条，提前一天给砧木浇透水。', 1),
  (100, '嫁接操作', '在大人指导下用刀在砧木上切出V形缺口，将削好的接穗插入对齐形成层，用胶带缠紧固定。', 2),
  (100, '扦插操作', '另取一段枝条，底端蘸上生根粉，斜插入湿润的营养土中约三分之一深度。', 3),
  (100, '养护管理', '将嫁接和扦插的植物放在阴凉通风处，保持土壤湿润但不积水。', 4),
  (100, '观察记录', '每周检查嫁接口的愈合情况和扦插枝条的生根情况，详细记录变化。', 5),
  (100, '成果展示', '一个月后评估存活率，拍照记录成长过程，写一篇实验小报告。', 6);

-- [53] 铜币变色实验
UPDATE public.projects SET description = '用醋和盐清洁氧化变暗的铜币，让它们重新变得闪亮！你将观察金属氧化和还原的过程，理解铜表面的氧化铜如何被酸溶解。还可以用铜液让铁钉表面镀上一层铜色。', difficulty_stars = 4 WHERE id = 53;
DELETE FROM public.project_steps WHERE project_id = 53;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (53, '配制清洁液', '在玻璃碗中混合白醋和食盐，搅拌直到盐完全溶解。', 1),
  (53, '浸泡铜币', '将暗淡的旧铜币放入醋盐溶液中，等待5分钟，观察铜币逐渐变亮。', 2),
  (53, '取出对比', '取出铜币用清水冲洗，与未浸泡的铜币对比亮度差异。', 3),
  (53, '铁钉镀铜', '将干净的铁钉放入浸泡过铜币的溶液中，等待15-20分钟，观察铁钉表面出现铜色。', 4),
  (53, '解释原理', '醋酸溶解了铜币表面的氧化铜，溶液中的铜离子又在铁钉上析出，因为铁比铜更活泼。', 5);

-- [101] 校园植物多样性调查
UPDATE public.projects SET description = '对校园内的植物进行系统调查，记录各区域的植物种类和数量。学习生物多样性调查的基本方法，了解校园生态环境，提出绿化改善建议。', difficulty_stars = 4 WHERE id = 101;
DELETE FROM public.project_steps WHERE project_id = 101;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (101, '制定计划', '将校园划分为几个区域（教学区、操场、花园等），设计调查记录表格。', 1),
  (101, '实地调查', '分组前往各区域，记录每种植物的名称、数量、高度和生长状况，拍照留证。', 2),
  (101, '鉴定分类', '用植物图鉴或识别APP确认植物名称，按乔木、灌木、草本、藤本分类。', 3),
  (101, '数据整理', '汇总各区域调查数据，统计植物种类总数，计算各区域的物种丰富度。', 4),
  (101, '绘制图表', '制作柱状图比较各区域植物多样性，在校园地图上标注植物分布。', 5),
  (101, '撰写报告', '撰写调查报告，分析校园植物多样性现状并提出增加多样性的建议。', 6);

-- [54] 蛋壳溶解实验
UPDATE public.projects SET description = '将鸡蛋浸泡在醋中，观察蛋壳如何被慢慢溶解，最终得到一个有弹性的"裸蛋"！你将了解醋酸与碳酸钙反应产生二氧化碳的过程。这个实验需要耐心等待1-2天，但结果非常神奇。', difficulty_stars = 4 WHERE id = 54;
DELETE FROM public.project_steps WHERE project_id = 54;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (54, '浸泡鸡蛋', '将一个生鸡蛋轻轻放入装满白醋的玻璃杯中，另一个放入清水作为对照组。', 1),
  (54, '观察初始反应', '立刻观察醋中鸡蛋表面冒出的小气泡，这是二氧化碳气体。', 2),
  (54, '每日记录', '每隔12小时观察并记录鸡蛋表面的变化，如果醋变浑浊可以换一次新醋。', 3),
  (54, '取出裸蛋', '约24-48小时后蛋壳完全溶解，小心取出变得半透明有弹性的"裸蛋"。', 4),
  (54, '对比总结', '与清水中的鸡蛋对比，讨论醋酸如何与蛋壳中的碳酸钙反应：CaCO₃ + 2CH₃COOH → Ca²⁺ + 2CH₃COO⁻ + H₂O + CO₂↑。', 5);

-- [102] 植物对不同光照的响应
UPDATE public.projects SET description = '将同种植物分别放在全日照、半遮阴和全遮阴的环境中，记录生长差异。通过严格的对照实验了解光照对光合作用和植物生长的影响，培养实验设计能力。', difficulty_stars = 4 WHERE id = 102;
DELETE FROM public.project_steps WHERE project_id = 102;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (102, '实验设计', '设计三组对照：全日照（阳台）、半遮阴（纱布遮挡）、全遮阴（纸板箱内），其他条件保持一致。', 1),
  (102, '初始测量', '测量三盆植物的初始株高、叶片数和颜色，称量植物连盆重量并记录。', 2),
  (102, '放置实验', '将三盆植物分别放在三种光照条件下，每天定时浇等量的水。', 3),
  (102, '每日记录', '每天同一时间测量株高、数叶片、观察叶色变化，拍照对比。', 4),
  (102, '数据分析', '两周后绘制生长曲线图，比较三组植物在株高、叶色、叶片大小上的差异。', 5),
  (102, '撰写结论', '分析光照如何影响植物的光合作用和生长，写出完整的实验报告。', 6);

-- [75] 鸟类迁徙追踪记录
UPDATE public.projects SET description = '在春秋迁徙季节，通过长期定点观察和网络数据查询，记录候鸟经过本地的种类和时间。了解鸟类迁徙的原因和路线，学习使用观鸟数据平台。', difficulty_stars = 4 WHERE id = 75;
DELETE FROM public.project_steps WHERE project_id = 75;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (75, '了解迁徙知识', '阅读资料了解什么是候鸟、留鸟，为什么鸟类要迁徙，本地区常见的候鸟有哪些。', 1),
  (75, '制定观察计划', '选择公园湖边、湿地或农田等开阔地带作为观察点，制定每周至少两次的观察计划。', 2),
  (75, '定点观察记录', '每次观察时记录日期、天气、看到的鸟种、数量和行为（停歇、觅食或飞越）。', 3),
  (75, '查阅迁徙数据', '在观鸟平台上查询本地区的候鸟记录，与自己的观察结果做对比。', 4),
  (75, '绘制迁徙图', '在地图上标注本地观察到的候鸟种类，查阅它们的迁徙路线，画出迁徙路线示意图。', 5),
  (75, '撰写调查报告', '汇总所有数据，分析迁徙季节中鸟种组成的变化，写一份图文并茂的迁徙观察报告。', 6);

-- [76] 昆虫夜间观察
UPDATE public.projects SET description = '利用灯光诱集的方法，在夏夜观察被光源吸引来的各种昆虫。比较不同颜色光源对昆虫的吸引效果，探究昆虫的趋光性，了解夜行性昆虫的多样性。', difficulty_stars = 4 WHERE id = 76;
DELETE FROM public.project_steps WHERE project_id = 76;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (76, '准备灯诱装置', '选择一个远离路灯的户外场地，将白色床单悬挂起来，在床单前方架设光源。', 1),
  (76, '开启灯光等待', '天黑后开启灯光，在旁边安静等候，昆虫通常在开灯后20～30分钟开始聚集。', 2),
  (76, '观察与采集', '用透明观察盒轻轻罩住感兴趣的昆虫进行近距离观察，用放大镜辨别特征。', 3),
  (76, '对比不同光源', '分别测试白光、黄光和紫外光对昆虫的吸引效果，记录每种光源吸引的昆虫种类和数量。', 4),
  (76, '数据分析', '将不同光源的吸引结果做成对比表格和柱状图，分析哪种光源吸引昆虫最多。', 5),
  (76, '撰写实验报告', '总结实验结果，解释昆虫趋光性的原因，讨论路灯对夜间昆虫的影响。', 6);

-- [52] 电解水实验
UPDATE public.projects SET description = '用电池将水分解成氢气和氧气两种气体，亲眼看到水的化学组成！你将通过观察两个电极上气泡数量的不同，理解水由氢和氧组成，体积比为2:1。这是经典的化学分解实验。', difficulty_stars = 4 WHERE id = 52;
DELETE FROM public.project_steps WHERE project_id = 52;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (52, '制作电解装置', '在纸板上戳两个小孔，将两根石墨棒插入作为电极，间隔约3厘米。', 1),
  (52, '配制电解液', '在玻璃杯中倒入水并加入少量小苏打搅拌溶解，提高水的导电性。', 2),
  (52, '连接电路', '将纸板架在杯口，石墨棒浸入水中，用导线分别连接两根石墨棒和电池的正负极。', 3),
  (52, '观察气泡', '通电后观察两根石墨棒上产生的气泡，注意哪一根产生的气泡更多。', 4),
  (52, '分析结果', '负极产生氢气（气泡多），正极产生氧气（气泡少），体积比约为2:1，证明水是H₂O。', 5);

-- [121] 河流侵蚀模拟实验
UPDATE public.projects SET description = '河流是如何一点点改变地形的？你将搭建一个倾斜的沙土模型，用流水模拟河流侵蚀和沉积的过程。通过观察水流如何冲刷出河道、搬运泥沙并在下游堆积，理解自然界中河流塑造地貌的力量。', difficulty_stars = 4 WHERE id = 121;
DELETE FROM public.project_steps WHERE project_id = 121;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (121, '搭建地形', '在浅盆中铺上约5厘米厚的沙土混合物，用手塑造出山丘、平原等微型地形，用小石子点缀。', 1),
  (121, '制造斜坡', '用书本将盆的一端垫高约10-15厘米，形成自然的倾斜角度，模拟河流上游的高地。', 2),
  (121, '标记初始地形', '用小旗子在几个关键位置做标记，拍照记录水流前的地形样貌。', 3),
  (121, '模拟降雨', '用浇水壶从高处缓慢而均匀地浇水，模拟降雨，观察水流如何汇聚形成"河道"并携带泥沙向下流动。', 4),
  (121, '观察侵蚀与沉积', '注意观察高处的泥沙被水流带走（侵蚀），在低处和水流变缓的地方泥沙堆积（沉积），拍照记录变化。', 5),
  (121, '对比与分析', '比较水流前后的地形变化，画出示意图，标注侵蚀区和沉积区，讨论水量大小和坡度对侵蚀速度的影响。', 6);

-- [122] 地震模拟与建筑抗震
UPDATE public.projects SET description = '地震来了，什么样的建筑不容易倒？你将搭建不同结构的小型建筑模型，并在模拟地震的振动台上测试它们的抗震能力。通过这个项目，了解地震的成因、地震波的传播方式，以及三角形结构在建筑抗震中的重要作用。', difficulty_stars = 4 WHERE id = 122;
DELETE FROM public.project_steps WHERE project_id = 122;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (122, '了解地震知识', '阅读关于地震成因的资料，了解板块运动、断层和地震波，知道震级和烈度的区别。', 1),
  (122, '搭建振动台', '在浅盘底部铺一层弹珠，上面放一块纸板，这样推动纸板时弹珠会使其左右振动，模拟地震效果。', 2),
  (122, '搭建不同结构模型', '用木棍和软糖搭建三种不同结构的小楼：一个纯正方形框架、一个加了对角斜撑的框架、一个三角形底座的金字塔形结构。', 3),
  (122, '地震测试', '将每个模型依次放在振动台上，用力推动纸板模拟不同强度的地震，观察哪个模型最先倒塌、哪个最稳固。', 4),
  (122, '记录与改进', '记录每种结构的表现，分析三角形和斜撑为什么能增强抗震能力，然后尝试改进设计再测试。', 5),
  (122, '总结抗震原理', '总结什么样的结构最抗震，了解现实中建筑抗震设计采用的方法，如阻尼器和隔震支座。', 6);

-- [31] 电磁铁制作
UPDATE public.projects SET description = '用铁钉和电线制作一个可以开关的电磁铁，体验电流产生磁场的奇妙。你将学习电磁感应的基本原理，了解电和磁之间的密切关系。', difficulty_stars = 4 WHERE id = 31;
DELETE FROM public.project_steps WHERE project_id = 31;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (31, '绕制线圈', '将漆包铜线紧密地绕在铁钉上，尽量多绕几圈（至少50圈），两头各留出约15厘米的引线。', 1),
  (31, '刮除漆皮', '用砂纸将铜线两头的漆皮刮掉，露出铜线便于导电。', 2),
  (31, '连接电路', '将铜线两端通过开关连接到电池的正负极，形成完整电路。', 3),
  (31, '测试磁力', '闭合开关，将铁钉靠近回形针，观察回形针被吸附；断开开关，回形针掉落。', 4),
  (31, '改变强度', '增减线圈圈数或更换电池数量，测试吸附回形针的数量变化，探究影响电磁铁强度的因素。', 5);

-- [123] 晶体矿物鉴定
UPDATE public.projects SET description = '矿物的世界像一座宝藏等你去发掘！你将学习使用多种方法——包括观察晶体形状、测试硬度、检查条痕颜色和光泽——对矿物标本进行系统鉴定。通过这个项目，掌握矿物学的基本鉴定流程，培养严谨的科学观察能力。', difficulty_stars = 4 WHERE id = 123;
DELETE FROM public.project_steps WHERE project_id = 123;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (123, '观察外部特征', '用放大镜仔细观察每块矿物的颜色、光泽（金属光泽、玻璃光泽、土状光泽等）和晶体形状，记录下来。', 1),
  (123, '条痕测试', '将矿物在白色瓷板上用力划过，观察留下的粉末颜色（条痕色），注意条痕色可能与矿物表面颜色不同。', 2),
  (123, '硬度测试', '用指甲、铜币和铁钉依次刮擦矿物，确定其大致硬度等级。', 3),
  (123, '酸性反应测试', '在大人的帮助下，滴一小滴稀盐酸在矿物表面，如果冒泡则说明含碳酸钙成分（如方解石）。', 4),
  (123, '综合鉴定', '将所有测试结果填入鉴定表，对照矿物参考手册，根据颜色、条痕、硬度、光泽和酸性反应综合判断矿物种类。', 5),
  (123, '制作鉴定报告', '为每块矿物写一份简短的鉴定报告，包括所有测试数据和最终鉴定结果，配上矿物照片或手绘图。', 6);

-- [78] 动物足迹识别
UPDATE public.projects SET description = '到公园、林地或泥地中寻找并记录动物留下的足迹和痕迹。学习制作足迹石膏模型，通过对比资料识别不同动物的足迹特征，锻炼野外观察能力。', difficulty_stars = 4 WHERE id = 78;
DELETE FROM public.project_steps WHERE project_id = 78;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (78, '选择搜索区域', '在雨后或清晨前往公园小径、河边泥地或林间小道，这些地方最容易发现动物足迹。', 1),
  (78, '寻找并记录足迹', '仔细搜索地面，发现足迹后先拍照，用直尺测量足迹的长宽，记录发现位置和周围环境。', 2),
  (78, '制作石膏模型', '用硬纸板条围住足迹，将搅拌好的石膏浆缓缓倒入，等待约30分钟凝固后小心取出。', 3),
  (78, '清理与辨认', '轻轻刷去模型上的泥土，对照足迹图鉴辨认是哪种动物留下的足迹。', 4),
  (78, '制作足迹图鉴', '将石膏模型拍照，配上动物名称、足迹尺寸和发现环境的文字说明，制作成动物足迹图鉴。', 5),
  (78, '分享展示', '在班级展示你的石膏模型和足迹图鉴，分享野外寻踪的经验和发现。', 6);

-- [77] 潮间带生物调查
UPDATE public.projects SET description = '在退潮时前往海边潮间带，系统调查不同潮位带的生物种类和分布规律。学习使用样方法进行简单的生态调查，了解潮间带生态系统的独特性。', difficulty_stars = 4 WHERE id = 77;
DELETE FROM public.project_steps WHERE project_id = 77;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (77, '查询潮汐时间', '出发前查询当天的退潮时间，计划在低潮前1小时到达海边。', 1),
  (77, '设置样方', '在高潮带、中潮带和低潮带各选1～2个位置，放下方形框作为固定调查区域。', 2),
  (77, '记录生物种类', '在每个样方内仔细搜索，记录所有能看到的动物种类（螺类、蟹类、海葵、海星等）和数量。', 3),
  (77, '拍照存档', '为每个样方和发现的生物拍照，注意记录样方编号和位置信息。', 4),
  (77, '对比分析', '对比不同潮位带的生物组成差异，分析为什么某些生物只出现在特定潮位带。', 5),
  (77, '完成调查报告', '整理数据制作物种清单，画出潮间带生物分布示意图，撰写完整的调查报告。', 6);

-- [80] 昆虫行为对比实验
UPDATE public.projects SET description = '选择两种常见昆虫（如蚂蚁与面包虫），设计对照实验比较它们对不同刺激（光照、温度、食物气味）的行为反应差异。学习实验设计、变量控制和数据分析的科学方法。', difficulty_stars = 5 WHERE id = 80;
DELETE FROM public.project_steps WHERE project_id = 80;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (80, '明确研究问题', '提出你想探究的问题，例如"蚂蚁和面包虫对光照的反应是否不同？"确定自变量、因变量和控制变量。', 1),
  (80, '设计实验方案', '制作选择箱：将长方形盒一端遮光、一端透光。设计对照组和实验组，每组至少重复5次实验。', 2),
  (80, '趋光性实验', '分别将蚂蚁和面包虫放入选择箱中央，记录1分钟后它们停留在明亮端还是黑暗端的数量。', 3),
  (80, '食物偏好实验', '在盒子不同角落放置蘸有糖水、醋和清水的棉签，记录两种昆虫分别最先趋向哪种气味。', 4),
  (80, '数据整理与分析', '将所有实验数据整理成表格，计算每种反应的百分比，用柱状图和饼图展示两种昆虫的行为差异。', 5),
  (80, '撰写实验报告', '按"提出问题→作出假设→实验设计→结果分析→结论"的格式写出完整的实验报告，讨论实验结果的意义。', 6);

-- [56] 牛奶塑料制作
UPDATE public.projects SET description = '用牛奶和醋制作天然的"酪素塑料"，可以塑造成各种小物件！你将了解蛋白质在酸性环境中变性凝固的原理，认识高分子材料的基本概念。这是一个跨越化学与材料科学的趣味实验。', difficulty_stars = 5 WHERE id = 56;
DELETE FROM public.project_steps WHERE project_id = 56;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (56, '加热牛奶', '将牛奶倒入小锅中，小火加热至微微冒泡（约70°C），不要煮沸。', 1),
  (56, '加醋凝固', '关火后缓缓加入白醋，轻轻搅拌，观察牛奶中出现白色凝固块（酪蛋白）。', 2),
  (56, '过滤收集', '用滤网或纱布过滤，收集白色固体凝块，用纸巾轻压吸去多余水分。', 3),
  (56, '塑形创作', '趁凝块柔软时揉捏塑形，可以加入食用色素调色，用模具或手工捏成想要的形状。', 4),
  (56, '干燥硬化', '将作品放在通风处晾干2-3天，干燥后会变得坚硬如同真正的塑料。', 5),
  (56, '原理总结', '对比分析酪蛋白的变性过程：酸使牛奶蛋白质结构改变并凝固，形成天然高分子材料，这就是最早期塑料的制作原理。', 6);

-- [35] 测量声速实验
UPDATE public.projects SET description = '利用回声或音叉在管中共振的方法测量声音的传播速度。你将掌握科学测量的方法，学习声速的概念，并感受理论与实验相结合的科学精神。', difficulty_stars = 5 WHERE id = 35;
DELETE FROM public.project_steps WHERE project_id = 35;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (35, '准备共振管', '将塑料管竖直插入水盆中，管口朝上，通过上下移动管子改变管内空气柱的长度。', 1),
  (35, '敲响音叉', '敲击音叉使其振动，将振动的音叉放在管口正上方。', 2),
  (35, '寻找共振', '缓慢上提管子增加空气柱长度，仔细聆听——当听到声音突然变大时，就找到了共振点。', 3),
  (35, '测量记录', '用卷尺测量此时管口到水面的距离（空气柱长度L），这约等于声波波长的四分之一。', 4),
  (35, '计算声速', '声速 = 频率 × 波长 = 频率 × 4L。用音叉上标注的频率代入计算，与理论值340米/秒对比。', 5),
  (35, '误差分析', '测量室温并查阅不同温度下的声速值，讨论实验误差来源以及温度对声速的影响。', 6);

-- [79] 本地鸟类多样性调查
UPDATE public.projects SET description = '运用样线法和样点法，对本地不同生境（城市公园、农田、湿地等）的鸟类多样性进行系统调查。学习使用科学调查方法和数据分析工具，完成一份正式的鸟类多样性调查报告。', difficulty_stars = 5 WHERE id = 79;
DELETE FROM public.project_steps WHERE project_id = 79;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (79, '选定调查区域', '在地图上选择3～4个不同类型的生境（如城市公园、河流湿地、居民小区、农田边缘），标注具体位置。', 1),
  (79, '设计调查方案', '为每个生境设计固定的样线路线（长约1公里），确定每次观察的时间和行走速度，设计统一的记录表格。', 2),
  (79, '开展野外调查', '在清晨（6:00-9:00）沿样线匀速行走，记录沿途看到和听到的所有鸟种、数量、行为和所在生境类型。', 3),
  (79, '重复调查', '对每个生境至少重复调查3次（不同日期），确保数据具有代表性。', 4),
  (79, '数据分析', '计算每个生境的鸟种数、个体总数和多样性指数，用表格和图表展示各生境的差异。', 5),
  (79, '撰写调查报告', '按照正式科学报告的格式，写出包括引言、方法、结果和讨论的完整鸟类多样性调查报告。', 6);

-- [104] 校园植物分布图绘制
UPDATE public.projects SET description = '通过实地考察将校园中各种植物的位置标注在地图上，制作一份详细的校园植物生态地图。综合运用植物识别、地图绘制和数据分析技能，为校园绿化提供参考。', difficulty_stars = 5 WHERE id = 104;
DELETE FROM public.project_steps WHERE project_id = 104;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (104, '绘制底图', '在A3纸上参照校园平面图绘制出建筑、道路、操场等主要地标的位置。', 1),
  (104, '分区考察', '将校园分为若干区域，逐区走访记录每棵乔木和灌木丛的大致位置和种类。', 2),
  (104, '植物鉴定', '利用识别APP或图鉴确认每种植物的名称，统计每种植物的数量。', 3),
  (104, '标注地图', '用不同颜色和符号在底图上标注各种植物的位置，制定清晰的图例。', 4),
  (104, '数据统计', '统计校园植物总种类数、各区域密度、常绿与落叶比例等数据。', 5),
  (104, '完善报告', '美化地图并附上植物名录、照片和分析说明，形成完整的校园植物分布报告。', 6);

-- [124] 本地气象数据分析
UPDATE public.projects SET description = '你所在城市的天气有什么规律？你将收集本地一段时间的气象数据，包括温度、降水、风速和湿度，使用图表进行整理和分析。通过这个项目，学习数据收集、图表绘制和数据分析的基本方法，并尝试发现本地气候的季节性规律。', difficulty_stars = 5 WHERE id = 124;
DELETE FROM public.project_steps WHERE project_id = 124;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (124, '确定研究目标', '选择你想研究的主题，例如"过去一个月的温度变化趋势"或"降雨量与湿度的关系"，明确要收集哪些数据。', 1),
  (124, '收集气象数据', '从气象网站或天气应用获取本地过去30天的每日气温（最高、最低）、降水量、风速和湿度数据，填入数据表格。', 2),
  (124, '整理数据', '计算每周的平均温度、总降水量等统计值，将数据按时间顺序排列，检查有无缺失或异常数据。', 3),
  (124, '绘制图表', '用方格纸绘制折线图展示温度变化趋势，柱状图展示每日降水量，还可以绘制温度与湿度的散点图。', 4),
  (124, '分析规律', '观察图表中的模式和趋势：温度是上升还是下降？降雨集中在哪几天？风速与温度变化有关系吗？写出你的发现。', 5),
  (124, '撰写分析报告', '将所有图表和分析结果整理成一份完整的气象分析报告，包括研究目的、数据来源、图表、发现和结论。', 6);

-- [103] 简易植物组织培养
UPDATE public.projects SET description = '在简易无菌条件下进行植物组织培养实验，用一小块植物组织培育出新的植株。体验生物技术的魅力，了解细胞全能性的基本概念。', difficulty_stars = 5 WHERE id = 103;
DELETE FROM public.project_steps WHERE project_id = 103;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (103, '制备培养基', '将琼脂粉、白砂糖和水混合加热溶解，倒入玻璃瓶中，用高压锅灭菌。', 1),
  (103, '准备外植体', '将马铃薯芽眼处切取小块组织，用酒精表面消毒后用无菌水冲洗。', 2),
  (103, '无菌接种', '在酒精灯火焰旁（模拟无菌环境），用消毒镊子将外植体放入培养基表面。', 3),
  (103, '密封培养', '迅速盖上瓶盖密封，放在有散射光的温暖环境中培养。', 4),
  (103, '观察记录', '每天观察瓶内变化，记录是否有愈伤组织形成、新芽萌发或污染现象。', 5),
  (103, '分析总结', '2-3周后评估实验结果，总结成功或失败的原因，了解组织培养对无菌要求的重要性。', 6);

-- [125] 地质徒步考察记录
UPDATE public.projects SET description = '像真正的地质学家一样去野外考察！你将在大人陪同下进行一次户外地质徒步，沿途观察和记录地形地貌、岩石露头、水文特征和土壤类型。通过实地考察，综合运用所学的地球科学知识，培养野外科学考察的能力和地质记录的规范方法。', difficulty_stars = 5 WHERE id = 125;
DELETE FROM public.project_steps WHERE project_id = 125;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (125, '考察准备', '选择一条有地质特征的徒步路线（如山地小径、河边或采石场附近），打印地图标注计划路线，准备好所有器材，穿好适合徒步的衣物和鞋子。', 1),
  (125, '沿途观察记录', '沿路线行走时，在记录本上记下每个观察点的位置、地形特征、岩石类型、土壤颜色和质地，并用相机拍照。', 2),
  (125, '岩石与矿物观察', '在岩石露头处停下，用放大镜观察岩石的纹理和矿物组成，判断是火成岩、沉积岩还是变质岩，采集小样品装袋标注。', 3),
  (125, '水文特征记录', '如果途经溪流或河流，记录水流方向、速度、河床岩石类型，观察有无侵蚀或沉积现象。', 4),
  (125, '绘制地质剖面图', '回家后根据记录和照片，绘制一幅沿路线的简易地质剖面图，标注不同岩层和地形特征。', 5),
  (125, '撰写考察报告', '整理所有记录、照片和样品，撰写一份完整的地质考察报告，包括考察路线、观察发现、样品描述和你的地质推断。', 6);

-- [55] 简易水质检测
UPDATE public.projects SET description = '用简易方法检测不同来源水的酸碱度、硬度和杂质含量！你将学习基本的化学分析方法，了解水质好坏对健康和环境的影响。培养环保意识和科学检测能力。', difficulty_stars = 5 WHERE id = 55;
DELETE FROM public.project_steps WHERE project_id = 55;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (55, '采集水样', '收集不同来源的水样：自来水、矿泉水、凉白开、雨水等，分别倒入标记好的透明杯中。', 1),
  (55, '酸碱度检测', '将pH试纸分别浸入各水样中，取出后与标准色卡对比，记录每种水的pH值。', 2),
  (55, '硬度检测', '在每种水样中加入等量肥皂水并搅拌，泡沫越少说明水的硬度越高（矿物质含量多）。', 3),
  (55, '杂质观察', '用白色滤纸分别过滤各水样，晾干后用放大镜观察滤纸上残留物的多少和颜色。', 4),
  (55, '综合评估', '汇总所有检测数据，制作水质对比表，讨论哪种水最干净、各指标的意义。', 5),
  (55, '环保倡议', '对比分析水污染的来源和危害，思考在日常生活中如何节约和保护水资源。', 6);

-- [34] 自制小型发电机
UPDATE public.projects SET description = '用磁铁和线圈制作一个能点亮LED灯的微型发电机。你将亲手实现"运动生电"的奇迹，深入理解电磁感应——转动线圈切割磁力线即可产生电流。', difficulty_stars = 5 WHERE id = 34;
DELETE FROM public.project_steps WHERE project_id = 34;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (34, '绕制线圈', '用硬纸板做一个小方框，将漆包铜线在方框上紧密绕约200圈，两端引线留出20厘米并刮除漆皮。', 1),
  (34, '制作转子', '将线圈安装在竹签转轴上，确保转轴穿过线圈中心且能自由旋转。', 2),
  (34, '搭建磁场', '在线圈两侧固定强力磁铁，N极和S极相对放置，形成穿过线圈的磁场。', 3),
  (34, '连接LED', '将线圈两端引线连接到LED灯上。', 4),
  (34, '手动发电', '快速旋转线圈的转轴，观察LED灯闪烁发光，转速越快灯越亮。', 5),
  (34, '深入思考', '对比分析法拉第电磁感应定律：线圈在磁场中转动切割磁力线，产生感应电流，这是发电厂发电的基本原理。', 6);

-- [36] 自制分光器
UPDATE public.projects SET description = '用光盘和纸盒制作一台分光器，观察不同光源的光谱特征。你将学习光谱分析的基本方法，了解科学家如何通过分析光谱来判断物质的成分。', difficulty_stars = 5 WHERE id = 36;
DELETE FROM public.project_steps WHERE project_id = 36;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (36, '制作狭缝', '在纸盒一端中央用美工刀切出一条约1毫米宽、2厘米长的狭缝，作为光线入口。', 1),
  (36, '安装光盘', '在纸盒另一端靠底部切一个方形口，将光盘的彩虹面朝向盒内，以约60度角固定在方形口处。', 2),
  (36, '遮光处理', '用黑色胶带封好盒子所有缝隙，确保只有狭缝能进光。在光盘正对方向的盒壁开一个观察窗。', 3),
  (36, '观察白炽灯', '将狭缝对准白炽灯，从观察窗看光盘，你会看到连续的彩虹色带——这就是白炽灯的连续光谱。', 4),
  (36, '对比不同光源', '分别观察日光灯、LED灯、手机屏幕等光源的光谱，你会发现它们的光谱各不相同。', 5),
  (36, '光谱分析意义', '对比分析为什么不同光源光谱不同，了解科学家如何利用光谱分析来鉴定遥远恒星的化学组成。', 6);

-- [309] 纸盘动物面具
UPDATE public.projects SET description = '用一次性纸盘制作各种可爱的动物面具，锻炼你的想象力和动手能力。通过剪、贴、涂色等手工操作，创造出独一无二的动物角色面具。', difficulty_stars = 1 WHERE id = 309;
DELETE FROM public.project_steps WHERE project_id = 309;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (309, '选择动物', '决定要制作哪种动物面具（如小猫、小熊、兔子等），在纸上简单画出设计草稿。', 1),
  (309, '裁剪纸盘', '在纸盘上标记眼睛位置并剪出两个圆形眼洞，根据需要修剪纸盘边缘形状。', 2),
  (309, '涂色装饰', '用水彩颜料将纸盘涂上动物对应的底色，等待完全干燥后再进行下一步。', 3),
  (309, '添加五官', '用彩色卡纸剪出耳朵、鼻子、胡须等部件，用胶水粘贴到纸盘上合适的位置。', 4),
  (309, '安装手柄', '在面具背面粘上竹筷作为手持柄，或在两侧打孔穿上橡皮筋做成可佩戴的面具。', 5);

-- [311] 纸杯电话
UPDATE public.projects SET description = '用两个纸杯和一根棉线制作简易电话，体验声音通过振动传播的神奇。你在和小伙伴通话的乐趣中，直观理解声波沿固体传导的科学原理。', difficulty_stars = 1 WHERE id = 311;
DELETE FROM public.project_steps WHERE project_id = 311;
INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
  (311, '杯底穿孔', '用锥子或剪刀尖在两个纸杯底部中央各戳一个小孔，孔径刚好能穿过棉线。', 1),
  (311, '穿线固定', '将棉线两端分别从杯底外侧穿入，在杯内绑上牙签或回形针防止线脱出。', 2),
  (311, '拉紧通话', '两人各持一个纸杯走开直到线绷直，一人对杯口说话，另一人将杯口贴在耳边倾听。', 3),
  (311, '实验探索', '尝试用不同粗细和材质的线替换，对比传声效果；试试线松弛时还能不能听到声音。', 4);

COMMIT;

DO $$ BEGIN
  RAISE NOTICE '✅ 已优化 399 个项目，删除 6 个不合理项目';
END $$;