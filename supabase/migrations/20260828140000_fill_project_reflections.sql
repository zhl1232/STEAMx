-- =============================================================================
-- 为全部已审核公开项目补全一句话 reflection（家长/AI 可引用的事实句）
--
-- 覆盖 sitemap 与公开库中 status=approved 且 moderation_state=approved 的项目。
-- 共 214 条：科学 76，技术 26，工程 35，艺术 45，数学 32。
-- 科学写原理事实；非科学写孩子做出或学到的事实，不编造与步骤矛盾的定律。
-- 仅当 reflection 为空或全空白时更新；已有非空真实句子的行会被 WHERE 跳过。
-- 本次线上查询全部 214 条 reflection 均为 NULL，故无跳过项；WHERE 仍保留以免覆盖后来手写内容。
-- =============================================================================

BEGIN;

SET LOCAL statement_timeout = '60s';
SET LOCAL request.jwt.claim.role = 'service_role';


-- ----- 科学 -----
-- [12] 静电章鱼
UPDATE public.projects
SET reflection = $r$摩擦使塑料带上同种电荷，同种电荷互相排斥，章鱼触须张开并悬浮。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 12;

-- [13] 彩虹制造机
UPDATE public.projects
SET reflection = $r$白光经水面和镜子折射色散，会按红橙黄绿蓝靛紫的顺序分开。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 13;

-- [14] 纸飞机飞行实验
UPDATE public.projects
SET reflection = $r$机翼形状和重心位置会改变升力与阻力，从而影响飞行距离和滞空时间。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 14;

-- [15] 影子戏剧场
UPDATE public.projects
SET reflection = $r$光沿直线传播，挡住光线就成影；物体离光源越近，影子越大。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 15;

-- [16] 气球火箭
UPDATE public.projects
SET reflection = $r$气球向后喷气时，反作用力把它沿绳子向前推，这就是牛顿第三定律。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 16;

-- [17] 水中硬币魔术
UPDATE public.projects
SET reflection = $r$光从水进入空气发生折射，碗底硬币的光线能绕过碗沿到达眼睛。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 17;

-- [18] 自制简易潜水艇
UPDATE public.projects
SET reflection = $r$挤压增大水压使水进入小瓶变重下沉，松开后空气膨胀排水上浮。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 18;

-- [19] 磁力小车
UPDATE public.projects
SET reflection = $r$磁铁同极相斥、异极相吸，排斥力或吸引力都能推动小车前进。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 19;

-- [20] 简易万花筒
UPDATE public.projects
SET reflection = $r$三面镜子朝内反复反射，把少量碎片变成多组对称重复的图案。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 20;

-- [21] 摩擦力滑道实验
UPDATE public.projects
SET reflection = $r$接触面越粗糙摩擦力越大，所以同一斜面上物体滑到底部就越慢。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 21;

-- [22] 弹力球高度实验
UPDATE public.projects
SET reflection = $r$碰撞把部分动能变成热和声，所以球无法弹回原来的释放高度。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 22;

-- [23] 自制指南针
UPDATE public.projects
SET reflection = $r$磁化后的缝衣针在地磁场中自由转动，稳定后会沿南北方向排列。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 23;

-- [24] 声音可视化实验
UPDATE public.projects
SET reflection = $r$声音是空气振动传到薄膜，不同频率会让盐粒跳出不同的图案。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 24;

-- [25] 自制针孔相机
UPDATE public.projects
SET reflection = $r$光沿直线穿过小孔，景物会上下颠倒地投到对面的成像屏上，孔越小越清晰越暗。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 25;

-- [26] 密度彩虹塔
UPDATE public.projects
SET reflection = $r$密度大的液体沉在下层，密度小的浮在上层，于是叠成稳定分层。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 26;

-- [27] 热气球模型
UPDATE public.projects
SET reflection = $r$热空气密度小于周围冷空气，充满热空气的袋子因此会向上升起。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 27;

-- [28] 自制温度计
UPDATE public.projects
SET reflection = $r$液体受热膨胀、遇冷收缩，密封瓶里多出的体积只能沿吸管升降。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 28;

-- [29] 杠杆平衡实验
UPDATE public.projects
SET reflection = $r$杠杆平衡时两侧力与力臂的乘积相等，把硬币移近支点就要在另一侧加力。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 29;

-- [31] 电磁铁制作
UPDATE public.projects
SET reflection = $r$通电线圈产生磁场，铁钉被磁化后能吸铁，断电磁力随即消失。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 31;

-- [32] 简易电动机
UPDATE public.projects
SET reflection = $r$通电线圈在磁场中受力转动，半刮漆使电流半圈通断从而持续旋转。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 32;

-- [33] 自制望远镜
UPDATE public.projects
SET reflection = $r$长焦距物镜收集远处光线，短焦距目镜再放大，合起来就能看清远景。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 33;

-- [36] 自制分光器
UPDATE public.projects
SET reflection = $r$光盘光栅把复色光按波长分开，不同光源的光谱条纹并不相同。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 36;

-- [38] 牛奶星空画
UPDATE public.projects
SET reflection = $r$洗洁精破坏牛奶表面的张力平衡，色素便随液体向四周旋转扩散。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 38;

-- [39] 彩色泡泡实验
UPDATE public.projects
SET reflection = $r$表面张力把液膜拉成球面，薄膜干涉让泡泡在阳光下呈现彩色。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 39;

-- [40] 气球酵母发酵实验
UPDATE public.projects
SET reflection = $r$酵母分解糖产生二氧化碳气体，气泡留在面团里把它撑大膨胀。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 40;

-- [41] 盐画艺术
UPDATE public.projects
SET reflection = $r$颜料水沿盐粒发生毛细扩散，水分蒸发后盐重新结晶留下纹理。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 41;

-- [42] 自制酸碱指示剂
UPDATE public.projects
SET reflection = $r$紫甘蓝花青素遇酸变红、遇碱变绿或黄，可用来判断液体酸碱性。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 42;

-- [43] 水果电池
UPDATE public.projects
SET reflection = $r$柠檬汁作电解质，铜和锌两极产生电位差，从而把化学能转化为电能。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 43;

-- [44] 隐形墨水
UPDATE public.projects
SET reflection = $r$柠檬汁中的有机物受热氧化变棕，干后看不见的字会被加热显现。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 44;

-- [45] 碘液检测淀粉
UPDATE public.projects
SET reflection = $r$碘遇到淀粉会变成蓝紫色，在食物上滴碘酒就能判断它是否含淀粉。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 45;

-- [46] 色彩分层饮料
UPDATE public.projects
SET reflection = $r$糖水浓度越高密度越大，沿杯壁缓缓倒入就能叠出稳定的彩色分层。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 46;

-- [47] 自制彩色晶体
UPDATE public.projects
SET reflection = $r$过饱和溶液降温后溶质析出，晶体会沿着悬挂的晶种慢慢长大。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 47;

-- [48] 铁锈实验
UPDATE public.projects
SET reflection = $r$铁生锈需要同时接触水和氧气，盐水会加快铁锈的氧化过程。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 48;

-- [50] CO₂ 气球实验
UPDATE public.projects
SET reflection = $r$小苏打与醋发生酸碱反应生成二氧化碳，气体进入气球把它吹大。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 50;

-- [51] 自制肥皂
UPDATE public.projects
SET reflection = $r$肥皂分子一端亲水一端亲油，能把油污乳化进水里再冲洗带走。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 51;

-- [52] 电解水实验
UPDATE public.projects
SET reflection = $r$通电把水分解成氢气和氧气，负极气泡多、正极气泡少，体积比约二比一。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 52;

-- [53] 铜币变色实验
UPDATE public.projects
SET reflection = $r$醋盐溶解铜表面的氧化铜，溶液里的铜离子会在更活泼的铁上析出。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 53;

-- [54] 蛋壳溶解实验
UPDATE public.projects
SET reflection = $r$醋酸与蛋壳碳酸钙反应放出二氧化碳，壳溶解后剩下有弹性的膜。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 54;

-- [55] 简易水质检测
UPDATE public.projects
SET reflection = $r$试纸测酸碱、肥皂泡沫测硬度、滤渣看杂质，可比较不同水源的水质。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 55;

-- [56] 牛奶塑料制作
UPDATE public.projects
SET reflection = $r$醋酸使牛奶中的酪蛋白变性凝固，干燥后变成坚硬的酪素塑料。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 56;

-- [58] 蜗牛行为小实验
UPDATE public.projects
SET reflection = $r$蜗牛喜湿避光，靠腹足爬行并留下黏液，触角用来感知光线和食物。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 58;

-- [65] 蚯蚓与土壤实验
UPDATE public.projects
SET reflection = $r$蚯蚓钻穴混合土层、分解落叶，能让分层土壤逐渐变得疏松均匀。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 65;

-- [66] 鱼鳃开合频率记录
UPDATE public.projects
SET reflection = $r$鱼用鳃从水中取氧，水温升高时代谢加快，鳃盖开合会更频繁。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 66;

-- [69] 贝壳形状分类卡
UPDATE public.projects
SET reflection = $r$贝壳可按单壳或双壳、螺旋或扇形、大小纹理等外形特征分类比较。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 69;

-- [71] 鱼鳍和鱼鳃结构识别
UPDATE public.projects
SET reflection = $r$流线体型、鳞片、侧线和各鳍分工，帮助鱼在水中平衡、推进和呼吸。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 71;

-- [73] 昆虫标本制作
UPDATE public.projects
SET reflection = $r$昆虫身体分头胸腹，展翅定型并标注采集信息才能做成可对照的标本。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 73;

-- [81] 绿豆发芽对照实验
UPDATE public.projects
SET reflection = $r$绿豆发芽需要水分、空气和适宜温度，光照不是发芽的必要条件。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 81;

-- [82] 树叶分类标本卡
UPDATE public.projects
SET reflection = $r$把压平的叶片按叶形、叶缘和叶脉整理，这些外形特征可用来识别树种。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 82;

-- [83] 制作干花书签
UPDATE public.projects
SET reflection = $r$压花去掉水分后花形被固定在纸上，便于观察花瓣层次和叶片结构。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 83;

-- [84] 蔬菜水培实验
UPDATE public.projects
SET reflection = $r$带芽眼的蔬菜根茎仍储存养分，浸在清水里就能重新长出新叶。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 84;

-- [85] 花瓣染色实验
UPDATE public.projects
SET reflection = $r$植物茎内导管靠毛细作用把水分送到花瓣，所以白花会吸进色素变色。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 85;

-- [86] 纸箱植物向光实验
UPDATE public.projects
SET reflection = $r$纸箱只留一个进光口时，幼苗会弯向光源生长，这是植物的向光性。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 86;

-- [87] 一朵花的结构解剖
UPDATE public.projects
SET reflection = $r$花由萼片、花瓣、雄蕊和雌蕊组成，雄蕊产花粉、雌蕊接受花粉完成繁殖。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 87;

-- [90] 水果氧化实验
UPDATE public.projects
SET reflection = $r$切开的苹果中酚类被氧气氧化变褐，酸、盐、隔绝空气或低温能减慢变色。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 90;

-- [91] 树桩年轮判读
UPDATE public.projects
SET reflection = $r$树木一年长一圈年轮，轮宽反映当年生长快慢，圈数约等于树龄。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 91;

-- [92] 苔藓微景观制作
UPDATE public.projects
SET reflection = $r$封闭瓶中水分蒸发再凝结形成小循环，苔藓靠散射光和湿润环境生长。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 92;

-- [93] 树皮拓印收集
UPDATE public.projects
SET reflection = $r$不同树种的树皮凹凸纹理不同，蜡笔拓印能留下可比较的图案。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 93;

-- [94] 植物蒸腾作用实验
UPDATE public.projects
SET reflection = $r$叶片气孔蒸腾水分，套袋后水汽凝结成珠；封住气孔或去掉叶片则水珠减少。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 94;

-- [95] 无土栽培实验
UPDATE public.projects
SET reflection = $r$植物生长需要水和矿质营养，不一定必须土壤，海绵加营养液也能种植。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 95;

-- [96] 叶脉书签制作
UPDATE public.projects
SET reflection = $r$叶脉是输送水分和养分的维管网络，去掉叶肉后纹路仍保持原样。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 96;

-- [97] 果实与种子传播方式
UPDATE public.projects
SET reflection = $r$种子的翅、毛、钩刺或弹射结构，分别适应风、动物或自身弹射传播。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 97;

-- [98] 多肉植物繁殖实验
UPDATE public.projects
SET reflection = $r$多肉可用叶插或分株无性繁殖，完整叶片生根后能长成新植株。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 98;

-- [99] 植物色素提取
UPDATE public.projects
SET reflection = $r$花青素等植物色素可被溶剂提出，紫甘蓝汁遇酸变红、遇碱变绿。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 99;

-- [102] 植物对不同光照的响应
UPDATE public.projects
SET reflection = $r$光照不足会减弱光合作用，全遮阴的植株往往更瘦高、叶片更少更淡。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 102;

-- [107] 自制雨量筒测雨
UPDATE public.projects
SET reflection = $r$直筒容器中的水深就是降水量，漏斗口能减少蒸发造成的读数误差。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 107;

-- [108] 沙中寻宝
UPDATE public.projects
SET reflection = $r$沙粒是岩石风化破碎的产物，大小和形状可被风或水进一步分选。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 108;

-- [109] 自制风向标
UPDATE public.projects
SET reflection = $r$风向标尾翼受风面积更大，箭头会转到风吹来的方向并停在那里。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 109;

-- [110] 岩石硬度分类实验
UPDATE public.projects
SET reflection = $r$较硬矿物能在较软岩石上留下划痕，硬度是岩石分类的辅助依据。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 110;

-- [112] 土壤分层实验
UPDATE public.projects
SET reflection = $r$混在水中的沙、粉砂和黏土因颗粒大小不同，静置后按沉降速度分层。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 112;

-- [113] 自制日晷
UPDATE public.projects
SET reflection = $r$地球自转使太阳方位改变，晷针影子沿盘面移动可用来估测时刻。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 113;

-- [114] 喷雾彩虹角度实验
UPDATE public.projects
SET reflection = $r$阳光在水滴中折射反射色散，背对太阳并保持合适角度才能看到彩虹。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 114;

-- [116] 自制简易气象站
UPDATE public.projects
SET reflection = $r$气温、风向、雨量和气压一起变化，气压下降常预示天气转阴或下雨。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 116;

-- [117] 矿物硬度测试
UPDATE public.projects
SET reflection = $r$莫氏硬度用互相刮擦来比较，能在另一块上留下划痕的一方更硬。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 117;

-- [119] 水循环模型
UPDATE public.projects
SET reflection = $r$太阳加热使水蒸发，遇冷凝结成滴再落下，完成蒸发、凝结、降水循环。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 119;

-- [120] 火山分层模型
UPDATE public.projects
SET reflection = $r$瓶内小苏打与醋反应产生二氧化碳，气体推动泡沫从火山口涌出。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 120;

-- [121] 河流侵蚀模拟实验
UPDATE public.projects
SET reflection = $r$坡面流水冲刷带走泥沙叫侵蚀，到低处流速变缓后泥沙堆积叫沉积。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 121;

-- ----- 技术 -----
-- [149] LED 发光贺卡
UPDATE public.projects
SET reflection = $r$电流必须从正极经LED回到负极形成回路，贺卡上的灯才会亮。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 149;

-- [150] 简易手电筒
UPDATE public.projects
SET reflection = $r$电池、导线、开关和灯泡必须连成闭合回路，纸杯手电筒才能照明。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 150;

-- [151] 锡纸导电实验
UPDATE public.projects
SET reflection = $r$铝箔和金属能导电让LED亮起，橡皮、塑料、木头等绝缘体则不能。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 151;

-- [152] 水果导电测试
UPDATE public.projects
SET reflection = $r$酸性水果汁含自由离子所以能导电，多个水果串联可以提高电压。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 152;

-- [153] LED 创意灯
UPDATE public.projects
SET reflection = $r$并联时每盏灯两端电压相同，其中一盏坏了其余灯仍能继续亮。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 153;

-- [154] 简易开关制作
UPDATE public.projects
SET reflection = $r$开关用来接通或断开电路：触点闭合时灯亮，断开时灯灭。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 154;

-- [155] 导电面团实验
UPDATE public.projects
SET reflection = $r$加盐的面团能导电点亮LED，加油不加盐的面团绝缘，可隔开电路防短路。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 155;

-- [156] 串联与并联电路对比
UPDATE public.projects
SET reflection = $r$串联共用一条路径所以一盏灭全灭；并联各有回路，灯更亮也互不影响。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 156;

-- [157] 简易报警器
UPDATE public.projects
SET reflection = $r$门拉开抽走绝缘片后常闭开关接通，蜂鸣器所在电路导通就会报警。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 157;

-- [158] 光控小夜灯
UPDATE public.projects
SET reflection = $r$光敏电阻随光线变暗而阻值增大，可驱动电路在天黑时自动亮灯。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 158;

-- [159] 电磁铁起重机
UPDATE public.projects
SET reflection = $r$通电线圈让铁钉变成电磁铁，断电后磁力消失就能放下回形针。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 159;

-- [160] 摩尔斯电码通信器
UPDATE public.projects
SET reflection = $r$用短点与长划的固定组合代表字母，就能用灯光或蜂鸣声传递文字。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 160;

-- [169] 纸杯振动机器人
UPDATE public.projects
SET reflection = $r$马达偏心块转动产生振动，打破平衡后纸杯就会自己在桌面上挪动。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 169;

-- [170] 牙刷机器人
UPDATE public.projects
SET reflection = $r$振动马达加上刷毛的弹性支撑，让短牙刷头在光滑桌面上爬行。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 170;

-- [171] 气球动力机器人
UPDATE public.projects
SET reflection = $r$气球向后喷出空气产生反作用力，从而推动纸板小车沿地面前进。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 171;

-- [172] 纸板机器人手偶
UPDATE public.projects
SET reflection = $r$铆钉做成可转动关节，拉动细绳就能让纸板手脚做出联动动作。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 172;

-- [173] 弹射机器人
UPDATE public.projects
SET reflection = $r$按下发射臂拉紧橡皮筋储能，松开后弹性势能变成动能把小球弹出去。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 173;

-- [174] 遥控纸板车
UPDATE public.projects
SET reflection = $r$左右电机转速不同就会差速转向，配合遥控可前进、后退和转弯。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 174;

-- [175] 简易爬坡车
UPDATE public.projects
SET reflection = $r$把配重放低并给轮胎加摩擦，小车才能爬上更陡的斜坡而不打滑。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 175;

-- [176] 橡皮筋动力机器人
UPDATE public.projects
SET reflection = $r$向后卷绕橡皮筋储存弹性势能，回弹带动后轴转动使机器人前进。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 176;

-- [177] 纸板液压机械臂
UPDATE public.projects
SET reflection = $r$封闭液体各处压强相等，推动一只注射器就能带动远处的机械臂关节。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 177;

-- [178] 四足行走机器人
UPDATE public.projects
SET reflection = $r$曲柄连杆把电机的连续旋转变成四条腿交替抬落，从而模仿动物行走。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 178;

-- [179] 风力行走机器人
UPDATE public.projects
SET reflection = $r$风车把风能变成转动，再经曲柄连杆传到仿生腿，机器人就能迈步。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 179;

-- [180] 提线木偶机器人
UPDATE public.projects
SET reflection = $r$手脚和头部的提线集中到操纵杆，倾斜杆就能让木偶四肢协调动作。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 180;

-- [183] 机械抓手制作
UPDATE public.projects
SET reflection = $r$多组X形连杆串联会放大开合行程，拉动绳子就能远程夹取物体。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 183;

-- [184] 双足行走模型
UPDATE public.projects
SET reflection = $r$弧形腿配上略微前倾的重心，在斜面上靠重力左右转移就能交替迈步。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 184;

-- ----- 工程 -----
-- [209] 纸板陀螺
UPDATE public.projects
SET reflection = $r$转轴必须穿过圆盘重心，而且重心越低，陀螺旋转越稳定、转得越久。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 209;

-- [210] 橡皮筋动力风扇
UPDATE public.projects
SET reflection = $r$拧紧橡皮筋储存弹性势能，松开后回弹转化为动能，带动扇叶旋转。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 210;

-- [211] 简易纸弹簧
UPDATE public.projects
SET reflection = $r$两条纸条呈直角交替折叠，形成可伸缩的纸弹簧，按压后能弹回原状。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 211;

-- [212] 纸板抽签机
UPDATE public.projects
SET reflection = $r$旋转手柄让边缘拨片拨动盒内纸签，每次从顶部缝口弹出一根。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 212;

-- [213] 橡皮筋动力车
UPDATE public.projects
SET reflection = $r$橡皮筋回弹带动车轴旋转，车轮与地面的摩擦再把转动变成前进。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 213;

-- [214] 纸板齿轮联动
UPDATE public.projects
SET reflection = $r$互相咬合的齿轮转向必定相反，齿数多的转得慢，齿数比就是转速比。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 214;

-- [215] 双坡弹珠轨道搭建
UPDATE public.projects
SET reflection = $r$轨道持续向下倾斜并平滑衔接，弹珠才能靠重力从起点滚到终点。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 215;

-- [216] 翻转木偶机关
UPDATE public.projects
SET reflection = $r$偏心凸轮把手柄的连续旋转变成推杆上下往复，顶端木偶就会弹跳。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 216;

-- [218] 凸轮玩具制作
UPDATE public.projects
SET reflection = $r$不同凸轮外形决定升降节奏，同一转轴可让多个角色做不同动作。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 218;

-- [220] 连杆机构动物
UPDATE public.projects
SET reflection = $r$连杆把一根操控杆的运动传到肩、肘、胯、膝，四肢就能协调摆动。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 220;

-- [222] 复合齿轮传动装置
UPDATE public.projects
SET reflection = $r$小齿轮带动大齿轮会减速增力，多级齿轮组能连续改变转速和转向。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 222;

-- [223] 弹珠过山车
UPDATE public.projects
SET reflection = $r$起点必须是全程最高点，弹珠只靠重力势能运动，摩擦还会损耗能量。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 223;

-- [226] 曲柄连杆发动机模型
UPDATE public.projects
SET reflection = $r$曲柄连杆把活塞的直线往复变成曲轴旋转，也能反向带动活塞。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 226;

-- [233] 纸桥承重实验
UPDATE public.projects
SET reflection = $r$把纸折成波浪、槽形或卷筒，能把载荷分散到更多路径，承重明显提高。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 233;

-- [249] 纸风车
UPDATE public.projects
SET reflection = $r$风吹在倾斜叶片上产生力矩，调整叶片角度就能改变风车转速。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 249;

-- [250] 简易滑轮装置
UPDATE public.projects
SET reflection = $r$定滑轮不省力，但能改变力的方向，向下拉就能把重物向上提升。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 250;

-- [251] 斜面滚球实验
UPDATE public.projects
SET reflection = $r$斜面越陡，小球滚下后获得的速度越大，滚动距离通常也更远。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 251;

-- [253] 杠杆投石机
UPDATE public.projects
SET reflection = $r$投石机是杠杆：改变支点位置和力臂比例，就能把弹丸抛得更远。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 253;

-- [254] 简易滑轮组
UPDATE public.projects
SET reflection = $r$滑轮组承重绳越多越省力，但要把重物提高相同高度，绳子要拉得更长。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 254;

-- [255] 水车模型
UPDATE public.projects
SET reflection = $r$水流冲击朝向一致的叶片产生力矩，水车把水的动能变成转轴旋转。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 255;

-- [256] 简易天平
UPDATE public.projects
SET reflection = $r$等臂天平两侧力矩相等时保持水平，可用已知硬币当砝码比较重量。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 256;

-- [257] 风力发电小模型
UPDATE public.projects
SET reflection = $r$风吹转扇叶带动直流马达发电，把风能转化成电能，足以点亮LED。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 257;

-- [258] 水力涡轮机
UPDATE public.projects
SET reflection = $r$水流冲击勺形叶片使涡轮旋转，从而把水的动能转化为转轴机械能。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 258;

-- [259] 简易抽水机
UPDATE public.projects
SET reflection = $r$拉动活塞使管内气压降低，外界大气压把水压入软管，从而抽水。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 259;

-- [261] 液压升降台
UPDATE public.projects
SET reflection = $r$液体传递的压强不变，大活塞截面积更大，就能把较小推力放大成升力。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 261;

-- [262] 复合滑轮系统
UPDATE public.projects
SET reflection = $r$复合滑轮组省力但效率低于理论值，因为摩擦会多消耗一部分功。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 262;

-- [263] 自动浇水装置
UPDATE public.projects
SET reflection = $r$高处储水经虹吸或滴管缓慢流向低处花盆，就能做成自动浇水。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 263;

-- [264] 太阳能小车
UPDATE public.projects
SET reflection = $r$太阳能电池板把光变成电，再经电机和传动把电能变成小车的动能。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 264;

-- [269] 纸板小房子
UPDATE public.projects
SET reflection = $r$墙壁承重、屋顶排水、门窗开洞，纸板房子要把平面裁片折成立体结构。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 269;

-- [271] 纸飞机模型集
UPDATE public.projects
SET reflection = $r$不同机翼形状改变升力和阻力，有的纸飞机飞得远，有的飞得稳。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 271;

-- [272] 折纸小船
UPDATE public.projects
SET reflection = $r$船体排开水的体积产生浮力，底宽、防水更好的纸船载重更大。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 272;

-- [273] 太阳系模型
UPDATE public.projects
SET reflection = $r$按相对大小和距离排列泡沫球，能做成可讲解的太阳系比例模型。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 273;

-- [274] 纸板城堡
UPDATE public.projects
SET reflection = $r$城墙、塔楼和可升降吊桥组成防御布局，纸板能搭出立体城堡。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 274;

-- [276] 恐龙模型
UPDATE public.projects
SET reflection = $r$先弯铁丝做出脊柱四肢骨架，再裹黏土塑形，恐龙模型才能按比例站稳。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 276;

-- [277] 人体器官模型
UPDATE public.projects
SET reflection = $r$用不同颜色黏土做出可取出的器官，对照位置认识人体内部结构。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 277;

-- ----- 艺术 -----
-- [289] 蔬菜印章画
UPDATE public.projects
SET reflection = $r$不同蔬菜的横切面纹理不同，蘸颜料按印到纸上就能做成独特版画。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 289;

-- [290] 手指画创作
UPDATE public.projects
SET reflection = $r$用手指蘸安全颜料直接点涂，红黄蓝在纸上混合还能调出新颜色。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 290;

-- [291] 树叶拓印画
UPDATE public.projects
SET reflection = $r$在叶脉突出的背面涂色再按压，就能把叶片纹理拓印到卡纸上。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 291;

-- [292] 吹画艺术
UPDATE public.projects
SET reflection = $r$用吸管吹散墨滴形成分叉纹路，再根据形状添画细节完成作品。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 292;

-- [293] 自然色彩采集本
UPDATE public.projects
SET reflection = $r$对照花瓣、泥土和天空反复调色并贴样，能做成一本自然色彩采集本。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 293;

-- [294] 对称蝴蝶画
UPDATE public.projects
SET reflection = $r$只在折痕一侧涂鲜艳颜料再对折按压，打开就是左右对称的蝴蝶。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 294;

-- [295] 点彩水果画
UPDATE public.projects
SET reflection = $r$用密集小色点铺满轮廓，退后观看时色点会融合成体积和渐变。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 295;

-- [296] 水彩渐变天空
UPDATE public.projects
SET reflection = $r$在湿纸上从冷色过渡到暖色让它们渗化，能画出日出或日落的渐变天空。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 296;

-- [298] 自画像创作
UPDATE public.projects
SET reflection = $r$脸部大致符合三庭五眼，对着镜子定位五官才能画出自己的肖像。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 298;

-- [299] 水彩植物写生
UPDATE public.projects
SET reflection = $r$先观察再铺浅色、再加暗部，写生能画出植物真实的形态和层次。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 299;

-- [300] 球体明暗素描
UPDATE public.projects
SET reflection = $r$侧光下球体有亮面、明暗交界、反光和投影，排线能把它画成立体。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 300;

-- [302] 油画棒风景创作
UPDATE public.projects
SET reflection = $r$远景宜淡、近景宜浓，油画棒叠色和刮画能做出有层次的风景。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 302;

-- [303] 色彩搭配与情绪表达
UPDATE public.projects
SET reflection = $r$暖色常让人感到热烈，冷色更显平静，可用不同搭配表达情绪。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 303;

-- [307] 综合材料拼贴画
UPDATE public.projects
SET reflection = $r$布料、纸片和纽扣分层粘贴，能做成有触感的综合材料拼贴画。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 307;

-- [309] 纸盘动物面具
UPDATE public.projects
SET reflection = $r$在纸盘上剪出眼洞、涂底色并贴上耳朵鼻子，能做成可佩戴的动物面具。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 309;

-- [310] 毛根小动物
UPDATE public.projects
SET reflection = $r$彩色毛根条对折拧紧再缠出四肢，贴上眼睛就能做出小动物造型。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 310;

-- [311] 纸杯电话
UPDATE public.projects
SET reflection = $r$棉线必须拉直绷紧，说话引起的振动才能沿固体传到另一只纸杯。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 311;

-- [312] 彩纸拉花装饰
UPDATE public.projects
SET reflection = $r$彩纸多次对折后按半边轮廓剪裁再展开，能得到对称的拉花装饰。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 312;

-- [313] 编织友谊手链
UPDATE public.projects
SET reflection = $r$用彩色绣线从左到右反复打结，编到手腕长度就能做成友谊手链。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 313;

-- [314] 风筝制作与放飞
UPDATE public.projects
SET reflection = $r$十字竹条蒙成菱形并加上尾巴配重，逆风放线就能让风筝升空稳定。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 314;

-- [315] 扎染 T 恤
UPDATE public.projects
SET reflection = $r$橡皮筋扎得越紧花纹越清晰，染料渗透后展开就是独一无二的扎染。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 315;

-- [316] 纸浆画
UPDATE public.projects
SET reflection = $r$废纸打成彩色纸浆再按底稿堆塑晾干，能做成有起伏的浮雕画。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 316;

-- [317] 毛毡小挂件
UPDATE public.projects
SET reflection = $r$两片毛毡沿边缝合并填入棉花，顶部加绳就能做成书包小挂件。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 317;

-- [318] 皮影戏道具制作
UPDATE public.projects
SET reflection = $r$侧面镂空人物用铜扣做活动关节，灯光投在幕布上就能演皮影。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 318;

-- [319] 木工小板凳
UPDATE public.projects
SET reflection = $r$打磨木材后把四条腿对称固定在凳面下，检查四脚着地就能坐稳。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 319;

-- [320] 陶艺杯子
UPDATE public.projects
SET reflection = $r$揉泥排气后用拇指均匀推薄杯壁，再接上杯把，能手捏出一个小杯子。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 320;

-- [321] 叶片针法刺绣
UPDATE public.projects
SET reflection = $r$平针走线、回针勾轮廓、缎针填满叶片，就能绣出一枚叶片图案。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 321;

-- [322] 蜡烛制作
UPDATE public.projects
SET reflection = $r$蜡隔水熔化后浇入模具，冷却凝固就能做成带烛芯的手工蜡烛。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 322;

-- [323] 竹编小篮子
UPDATE public.projects
SET reflection = $r$经纬竹篾从底部绕编固定，竖篾上折后再编篮壁，收口就成小篮子。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 323;

-- [326] 微缩家具制作
UPDATE public.projects
SET reflection = $r$把真实家具尺寸按一比十二缩小后切割粘合，能做成一套微缩家具。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 326;

-- [328] 布艺玩偶缝制
UPDATE public.projects
SET reflection = $r$按纸样裁布、正面相对缝合再翻面填充，能缝出一个立体布艺玩偶。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 328;

-- [331] 黏土小动物
UPDATE public.projects
SET reflection = $r$先搓出头和身体，再接四肢、耳朵和五官，黏土能捏出有表情的小动物。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 331;

-- [332] 盐面团挂饰
UPDATE public.projects
SET reflection = $r$盐面团擀平压模并打孔，烘干上色后穿绳，能做成可悬挂的小挂饰。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 332;

-- [333] 橡皮泥水果
UPDATE public.projects
SET reflection = $r$对照真水果的形状、颜色过渡和表面纹理，橡皮泥能捏出仿真水果。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 333;

-- [334] 纸团雕塑
UPDATE public.projects
SET reflection = $r$废报纸团用胶带缠成形体，再刷胶贴平表面，就能上色做成立体雕塑。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 334;

-- [336] 石膏翻模体验
UPDATE public.projects
SET reflection = $r$在负模中倒入石膏凝固后取出，就能复制出与原型相反的造型。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 336;

-- [337] 超轻黏土多肉盆栽
UPDATE public.projects
SET reflection = $r$叶片从中心向外一层层张开排列，能捏出莲座状的仿真多肉盆栽。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 337;

-- [338] 锡纸雕塑
UPDATE public.projects
SET reflection = $r$锡纸可揉可折可缠，把几何体拼接起来就能快速做出金属质感造型。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 338;

-- [339] 铁丝骨架黏土人物
UPDATE public.projects
SET reflection = $r$先用铁丝搭出脊柱和四肢骨架并摆好姿势，再裹黏土塑出人物。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 339;

-- [340] 石膏面具制作
UPDATE public.projects
SET reflection = $r$石膏绷带贴在涂过隔离剂的气球上塑出五官，干后脱模彩绘即成面具。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 340;

-- [341] 纸浆立体雕塑
UPDATE public.projects
SET reflection = $r$把纸浆一层层堆在内部骨架上，彻底晾干打磨后上色，做成环保雕塑。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 341;

-- [342] 黏土浮雕创作
UPDATE public.projects
SET reflection = $r$前景堆得更高、背景保持较浅，平面黏土就能做出有层次的浮雕。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 342;

-- [343] 几何印章肥皂雕刻
UPDATE public.projects
SET reflection = $r$从轮廓外侧逐步削去多余肥皂，再刻细节，能减材雕刻出几何印章。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 343;

-- [346] 陶艺手捏花器
UPDATE public.projects
SET reflection = $r$泥条沿底部一圈圈盘高并层层压紧，修整后能手捏出一个可用的小花器。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 346;

-- [348] 动态雕塑（悬挂）
UPDATE public.projects
SET reflection = $r$每层横杆两端配重平衡后向上悬挂，轻微气流就能让雕塑摆动。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 348;

-- ----- 数学 -----
-- [351] 对称剪纸图案
UPDATE public.projects
SET reflection = $r$对折后剪半边再展开，得到的图形关于折痕对称，折次越多对称轴越多。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 351;

-- [352] 七巧板拼图
UPDATE public.projects
SET reflection = $r$七块板包含三角、正方形和平行四边形，既能拼回大正方形也能拼轮廓。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 352;

-- [353] 找找生活中的几何
UPDATE public.projects
SET reflection = $r$圆形、三角形和四边形藏在窗户、车轮和路标里，可以分类记录。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 353;

-- [354] 用积木搭几何体
UPDATE public.projects
SET reflection = $r$动手数立体图形的面、棱和顶点，并从正面、侧面、上方画出不同视图。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 354;

-- [355] 正多面体纸模型
UPDATE public.projects
SET reflection = $r$五种正多面体都可由正多边形展开图折成，且顶点数减棱数加面数等于二。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 355;

-- [356] 莫比乌斯带探索
UPDATE public.projects
SET reflection = $r$纸条扭转半圈再粘合只有一个面；沿中线剪开不会分成两条，而变成更大的环。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 356;

-- [357] 图形镶嵌
UPDATE public.projects
SET reflection = $r$正多边形能密铺平面的条件是顶点处内角之和刚好等于三百六十度。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 357;

-- [358] 坐标画图
UPDATE public.projects
SET reflection = $r$按给定坐标描点连线，向右平移时横坐标加四，关于横轴翻折时纵坐标变号。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 358;

-- [359] 黄金比例寻找
UPDATE public.projects
SET reflection = $r$黄金比例约为一点六一八，可在身高、螺线和经典构图中测量到近似值。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 359;

-- [360] 分形图案绘制
UPDATE public.projects
SET reflection = $r$分形局部放大后与整体相似，谢尔宾斯基三角形和科赫雪花都靠重复同一规则生成。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 360;

-- [361] 圆周率测量实验
UPDATE public.projects
SET reflection = $r$圆形物品的周长除以直径都接近三点一四，多次测量取平均能逼近圆周率。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 361;

-- [362] 几何光学作图
UPDATE public.projects
SET reflection = $r$反射时入射角等于反射角，在纸上用量角器作图就能预测光线走向。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 362;

-- [363] 欧拉多面体公式验证
UPDATE public.projects
SET reflection = $r$对凸多面体逐一数顶点、棱和面，会发现顶点数减棱数加面数总等于二。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 363;

-- [364] 四色定理地图着色
UPDATE public.projects
SET reflection = $r$相邻区域必须涂不同颜色，任意一张平面地图最多四种颜色就够用。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 364;

-- [365] 曲面几何体纸模
UPDATE public.projects
SET reflection = $r$圆柱侧面展开是长方形，圆锥侧面展开是扇形，球面不能无褶皱地摊平。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 365;

-- [366] 正多面体对偶关系
UPDATE public.projects
SET reflection = $r$正方体与正八面体互为对偶：一个的面心连线会围出另一个，棱数相同。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 366;

-- [369] 投影与影子几何
UPDATE public.projects
SET reflection = $r$同一立体从不同方向投影形状不同，正视图、侧视图和俯视图一起描述三维物体。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 369;

-- [373] 数字连线画
UPDATE public.projects
SET reflection = $r$按编号顺序连给定坐标点，就能还原小鱼或小火箭；横坐标取相反数得到左右镜像。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 373;

-- [374] 测量身边的物品
UPDATE public.projects
SET reflection = $r$用尺、秤和量杯测量身边物品，能建立厘米、克、毫升的直观感受。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 374;

-- [375] 概率实验：硬币与骰子
UPDATE public.projects
SET reflection = $r$抛硬币次数越多正面频率越接近一半；两颗骰子之和为七的组合最多。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 375;

-- [376] 数字华容道
UPDATE public.projects
SET reflection = $r$华容道通过把邻块滑入空格还原顺序，可先完成一行再缩小其余区域。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 376;

-- [378] 数字黑洞 6174
UPDATE public.projects
SET reflection = $r$任意不全相同的四位数反复做最大排列减最小排列，最多七步会落到六一七四。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 378;

-- [379] 斐波那契数列寻宝
UPDATE public.projects
SET reflection = $r$斐波那契数列每一项等于前两项之和，花瓣数和松果螺旋常出现这些数。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 379;

-- [380] 密码学入门：凯撒密码
UPDATE public.projects
SET reflection = $r$凯撒密码把字母按固定位数偏移；只有二十五种子钥，可逐一试出来。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 380;

-- [381] 幻方填数
UPDATE public.projects
SET reflection = $r$三阶幻方用一到九且每线之和为十五，四阶用一到十六且每线之和为三十四。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 381;

-- [383] 蒙提霍尔问题实验
UPDATE public.projects
SET reflection = $r$三门问题中最初选错的概率是三分之二，主持人打开山羊门后换门中奖约为三分之二。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 383;

-- [385] 最短路径游戏
UPDATE public.projects
SET reflection = $r$在带权地图上比较各条通路的总距离，逐步标记最近节点能找出最短路径。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 385;

-- [389] 数列与规律探索
UPDATE public.projects
SET reflection = $r$等差每次加同一数，等比每次乘同一数，观察差分能判断数列类型并写出通项。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 389;

-- [392] 简易迷宫设计
UPDATE public.projects
SET reflection = $r$先确定唯一通路再添加死胡同，就能设计出有解但不直通的迷宫。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 392;

-- [395] 火柴棍谜题
UPDATE public.projects
SET reflection = $r$移动指定火柴改变算式或图形，需要同时考虑数字形状和空间结构。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 395;

-- [400] 逻辑电路与门
UPDATE public.projects
SET reflection = $r$与门要两开关都闭合灯才亮，或门任一闭合就亮，这是计算机逻辑的底层。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 400;

-- [402] 七桥问题探索
UPDATE public.projects
SET reflection = $r$把陆地当点、桥当线，奇数度点不是零个或两个时，就不能一笔画走遍所有桥。$r$
WHERE (reflection IS NULL OR btrim(reflection) = '') AND id = 402;

COMMIT;
