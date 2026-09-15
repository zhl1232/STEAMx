-- Correct factual claims in the selected Explore projects while preserving
-- each project's existing step rows, IDs, images, and step count.
BEGIN;

SET LOCAL statement_timeout = '60s';
SET LOCAL request.jwt.claim.role = 'service_role';

DO $$
DECLARE
  v_expected record;
  v_actual text;
BEGIN
  FOR v_expected IN
    SELECT * FROM (VALUES
      (158::bigint, '光控小夜灯'), (259::bigint, '简易抽水机'),
      (263::bigint, '自动浇水装置'), (52::bigint, '电解水实验'),
      (39::bigint, '彩色泡泡实验'), (51::bigint, '自制肥皂'),
      (31::bigint, '电磁铁制作'), (320::bigint, '陶艺杯子'),
      (319::bigint, '木工小板凳'), (343::bigint, '几何印章肥皂雕刻'),
      (359::bigint, '黄金比例寻找'), (378::bigint, '数字黑洞 6174')
    ) AS expected(id, title)
  LOOP
    SELECT title INTO v_actual FROM public.projects WHERE id = v_expected.id;
    IF v_actual IS DISTINCT FROM v_expected.title THEN
      RAISE EXCEPTION 'Project % changed before migration: expected %, got %', v_expected.id, v_expected.title, v_actual;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_expected record;
  v_count integer;
BEGIN
  FOR v_expected IN
    SELECT * FROM (VALUES
      (158::bigint, 2, '搭建控制电路'), (158::bigint, 3, '连接电源'),
      (259::bigint, 1, '虹吸实验'), (259::bigint, 3, '抽水测试'),
      (263::bigint, 1, '虹吸原理复习'), (263::bigint, 4, '测试校准'),
      (52::bigint, 5, '分析结果'), (51::bigint, 1, '融化皂基'),
      (320::bigint, 1, '揉泥排气'), (319::bigint, 1, '量测标记'),
      (319::bigint, 3, '安装凳腿'), (319::bigint, 5, '装饰完成'),
      (343::bigint, 1, '选择造型与画线'), (343::bigint, 2, '粗略切削'),
      (343::bigint, 3, '精细雕刻'), (343::bigint, 4, '刻画细节'),
      (343::bigint, 5, '打磨光滑'), (359::bigint, 1, '认识黄金比例'),
      (359::bigint, 5, '绘制黄金螺旋'), (378::bigint, 1, '选择数字'),
      (378::bigint, 3, '重复操作'), (378::bigint, 5, '批量测试'),
      (378::bigint, 6, '拓展探索')
    ) AS expected(project_id, sort_order, title)
  LOOP
    SELECT count(*) INTO v_count
    FROM public.project_steps
    WHERE project_id = v_expected.project_id
      AND sort_order = v_expected.sort_order
      AND title = v_expected.title;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Step %/% changed before migration: expected title %', v_expected.project_id, v_expected.sort_order, v_expected.title;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_expected record;
  v_count integer;
BEGIN
  FOR v_expected IN
    SELECT * FROM (VALUES
      (158::bigint, '电池盒及电池（3V-5V）'),
      (158::bigint, '电阻（10KΩ）1个'),
      (320::bigint, '陶土或超轻黏土约200克'),
      (319::bigint, '松木板（约20×25厘米，做凳面）'),
      (319::bigint, '方木条4根（约20厘米，做凳腿）')
    ) AS expected(project_id, material)
  LOOP
    SELECT count(*) INTO v_count
    FROM public.project_materials
    WHERE project_id = v_expected.project_id AND material = v_expected.material;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Material for project % changed before migration: expected %', v_expected.project_id, v_expected.material;
    END IF;
  END LOOP;
END $$;

UPDATE public.projects AS p
SET title = v.title,
    description = v.description,
    reflection = v.reflection,
    updated_at = now()
FROM (VALUES
  (158::bigint, '光控小夜灯',
    '用光敏电阻、NPN三极管和分压电路制作一个天暗时亮起的小夜灯。电路为：+4.5V→10kΩ→节点A→光敏电阻→GND，节点A→4.7kΩ→基极B，发射极E→GND；+4.5V→330Ω→LED阳极，LED阴极→集电极C。制作时还要根据S8050数据表核对引脚。',
    '光敏电阻与10kΩ电阻组成的分压节点，经4.7kΩ基极电阻控制NPN三极管；S8050的发射极接地，LED串联330Ω限流电阻并核对极性和引脚后，光线变暗时电路才会可靠亮灯。'),
  (259::bigint, '注射器提水与手动转移',
    '用去针头的大号注射器和软管做提水实验，观察活塞如何吸入和排出水，再把水从一个容器手动转移到另一个容器，理解气压差和流体转移。',
    '注射器活塞改变筒内压力并推动水流，适合做重复的手动提水和转移；水不会因此获得持续向更高处流动的能力。'),
  (263::bigint, '自动浇水装置',
    '用储水瓶、棉线或细管和夹子制作一个简易滴灌装置，比较棉线的毛细输水与充水软管的虹吸输水，观察水流如何受高度、管路和夹子影响。',
    '棉线可依靠毛细作用带水，充满水且出口较低的软管可能形成虹吸；出水会随材料、液面高度和管路变化，需通过观察记录验证。'),
  (52::bigint, '电解水实验',
    '用低压电源、石墨电极和少量小苏打水溶液观察电解过程。气泡数量只能作为现象记录，不能单凭气泡证明气体体积比；石墨电极和碳酸氢盐电解液还可能发生副反应，因此要把结果写成有限条件下的观察。',
    '通电时电极附近会出现气泡，但气泡大小、附着和石墨/碳酸氢盐副反应都会影响观察，不能只凭气泡数量证明氢氧体积比或水的组成。'),
  (39::bigint, '彩色泡泡实验',
    '制作泡泡液并观察泡泡膜在光线下的颜色，分别记录薄膜干涉产生的彩色条纹，以及含染料的泡泡压在纸上留下的彩色泡泡印迹。',
    '泡泡表面的彩色变化主要来自厚度变化造成的薄膜干涉；泡泡落在纸上的彩色图案则主要是含染料液膜留下的印迹，两者是不同现象。'),
  (51::bigint, '自制肥皂',
    '把现成皂基融化、调色、加香并倒入模具，制作一块可使用的手工皂。这个项目是融化和浇注皂基，不进行油脂与碱的皂化反应。',
    '本项目通过融化现成皂基并浇注成型制作肥皂；皂基中的清洁成分可帮助带走油污，但这里没有进行皂化反应。'),
  (31::bigint, '电磁铁制作',
    '用电池、开关、漆包线和铁钉制作可通断的电磁铁，比较通电与断电时的磁性，并测试线圈匝数等因素对吸附效果的影响。',
    '电流通过线圈时会产生磁场，使铁钉暂时具有吸引铁磁性物体的能力；断电后这种电流产生的磁效应会明显减弱。'),
  (320::bigint, '黏土装饰杯',
    '用风干黏土手捏一个仅供展示的装饰杯，练习揉泥、捏塑、修整和表面装饰。作品不可盛放食物和饮料，完成后按风干黏土说明自然干燥。',
    '手捏风干黏土可以做出装饰杯形；作品用于展示，不能当作食品器皿使用。'),
  (319::bigint, '木工迷你板凳模型',
    '用木板和木条制作一个非承重的迷你板凳展示模型，练习测量、打磨和固定。预切凳面约20×25×1厘米，四条凳腿各约2×2×20厘米，用于观察结构和稳定性，不可坐人或承载重量。',
    '按约20×25厘米凳面和四条约20厘米凳腿制作并固定后，可检查四脚是否同时着地、模型是否摇晃；它是非承重展示模型，不能坐人。'),
  (343::bigint, '几何印章肥皂雕刻',
    '在肥皂块上画出方形、三角形、圆形等几何图案，按印章需要雕去留白部分，做出平整的印面，再用印泥测试印出的图案，体验几何图案的减材雕刻。',
    '从几何图案出发雕去印面上的留白并保持底面平整，可以做出简单肥皂印章；实际测试印迹后再修整图案和深浅。'),
  (359::bigint, '黄金比例寻找',
    '测量身体、自然图案或艺术构图中的若干长度，计算比值并记录误差，把黄金比例和斐波那契螺旋作为待检验的假设。测量结果是样本中的近似，不能据此断言所有自然物或作品都符合黄金比例。',
    '黄金比例约为1.618，可作为测量与比较的假设；不同对象和测量方法会得到不同结果，斐波那契圆弧也只是黄金螺旋的近似画法。'),
  (378::bigint, '数字黑洞 6174',
    '对不全为同一数字的四位数反复执行“降序排列减升序排列”，并保留前导零。所有符合条件的四位数都将在最多7步内到达6174；三位数拓展使用同样规则，示例521应按521→396→594→495计算。',
    '对不全相同的四位数按固定四位格式排列并相减，所有符合条件的输入都将在最多7步内到达6174；三位数示例521按521→396→594→495，计算时保留前导零。')
) AS v(id, title, description, reflection)
WHERE p.id = v.id;

UPDATE public.project_steps AS s
SET description = v.description
FROM (VALUES
  (158::bigint, 1, '查阅光敏电阻、S8050等NPN三极管和LED的基本资料，记录光照变化、三极管发射极与引脚排列，以及LED正负极。'),
  (158::bigint, 2, '按图接线：+4.5V→10kΩ→节点A→光敏电阻→GND，节点A→4.7kΩ→基极B，发射极E→GND；+4.5V→330Ω→LED阳极，LED阴极→集电极C。'),
  (158::bigint, 3, '接入3节AA电池组成的4.5V电源，依据S8050数据表确认E、B、C引脚，并检查LED极性和三只电阻后再通电。'),
  (158::bigint, 4, '遮住和照亮光敏电阻，观察LED是否随分压变化而亮灭；记录环境光和电路反应，不把结果归因于单一元件。'),
  (158::bigint, 5, '用不遮挡光敏电阻和LED的材料制作简单灯罩，装回电路后再次检查接线，再观察亮度。'),
  (259::bigint, 1, '将软管装满水后比较水在高低容器之间的流动，观察水从高处容器流向低处容器的过程。'),
  (259::bigint, 2, '把去针头注射器出口接到软管并密封接口，另一端放入水中，检查连接处不漏气。'),
  (259::bigint, 3, '将软管一端连接注射器，先把自由端放入水源容器；拉动活塞吸入水后，将自由端移到目标容器，再推动活塞排水，记录每次手动转移的水量。'),
  (259::bigint, 4, '记录拉动活塞时筒内压力降低、外界压力推动水进入的过程，并比较活塞行程与转移水量。'),
  (259::bigint, 5, '把水从一个容器分次转移到另一个容器，记录每次操作和转移量，比较活塞行程与水量。'),
  (263::bigint, 1, '分别把棉线浸入水中观察毛细输水，并做一条充满水的软管从高处容器通向低处容器的对照，区分两种现象。'),
  (263::bigint, 2, '将储水瓶、棉线或软管和花盆摆好；使用软管时先排尽空气，并确认出水端低于水面，分别观察软管和棉线的输水过程。'),
  (263::bigint, 3, '用夹子改变软管开度，或调整棉线浸水长度，观察出水是否连续、变慢或停止，记录实际现象。'),
  (263::bigint, 4, '用量杯在若干相同观察时段收集出水量，比较不同高度、管路和夹子设置，记录实际流量。'),
  (263::bigint, 5, '把装置放在花盆旁观察土壤湿润范围，检查是否漏水或断流，并记录观察期间的出水变化。'),
  (263::bigint, 6, '根据观察改进储水瓶位置、棉线或软管数量和出水端固定方式，并写下装置的适用条件和局限。'),
  (52::bigint, 1, '在纸板上固定两根石墨棒作电极，保持间距并让电极浸入液体；检查导线和电池电压，避免短路。'),
  (52::bigint, 2, '在水中加入少量小苏打改善导电性，注明碳酸氢盐和石墨电极可能参与副反应，观察液体变化并避免接触。'),
  (52::bigint, 3, '将两电极分别接电池正负极，确认接线、浸入深度和装置稳定后再短时间通电。'),
  (52::bigint, 4, '观察两电极表面气泡出现的位置、多少和大小，把气泡作为定性现象记录，不直接当作气体体积测量。'),
  (52::bigint, 5, '比较重复观察的差异，说明气泡附着、石墨变化和小苏打副反应会影响结果；若要比较体积，必须另用集气和测量方法。'),
  (39::bigint, 1, '将水、洗洁精和甘油或白糖混合，静置后观察液体是否容易形成连续薄膜。'),
  (39::bigint, 2, '分装泡泡液并分别加入少量染料，记录染料在液膜和纸面上留下的颜色。'),
  (39::bigint, 3, '用吸管或环吹出泡泡，观察光线角度和泡泡膜厚度变化时出现的彩色条纹。'),
  (39::bigint, 4, '记录泡泡圆形和表面彩色变化：前者与表面张力有关，后者主要与薄膜干涉有关。'),
  (39::bigint, 5, '让含染料泡泡落在白纸上，比较纸上的彩色印迹与泡泡表面的干涉条纹，明确这是两种不同现象。'),
  (51::bigint, 1, '将现成皂基切块后低温融化，按产品说明加热并搅拌；这里只融化皂基，不使用油脂和碱进行皂化。'),
  (51::bigint, 2, '在液态皂基中加入少量色料和适合的香味材料，缓慢搅拌至均匀。'),
  (51::bigint, 3, '把皂液倒入硅胶模具，挑破表面气泡并保持模具平稳。'),
  (51::bigint, 4, '等待皂基完全冷却变硬后脱模，检查表面和边缘是否完整。'),
  (51::bigint, 5, '用成品清洁双手并记录使用感受，讨论现成肥皂成分如何帮助水带走油污。'),
  (31::bigint, 1, '将漆包线均匀绕在铁钉上并数出匝数，两端留出引线；线圈匝数是后续比较的变量。'),
  (31::bigint, 2, '刮掉两端漆皮并确认露出金属导体，避免漆层使电路断路。'),
  (31::bigint, 3, '把线圈、开关和电池串成回路，通电时间保持短暂，防止导线和电池发热。'),
  (31::bigint, 4, '闭合开关让铁钉靠近回形针，再断开开关比较吸附与掉落，观察电流产生的磁效应。'),
  (31::bigint, 5, '一次只改变线圈匝数或电源条件，记录能吸起的回形针数量，并说明电池电压、接触和通电时间也会影响结果。'),
  (320::bigint, 1, '取适量风干黏土揉匀，用少量水润湿手指和接缝，使泥土均匀柔软。'),
  (320::bigint, 2, '取泥团从中心向外均匀推薄，捏出杯形并保持底部和杯壁厚度尽量一致；成品仅作装饰。'),
  (320::bigint, 3, '用同种黏土连接杯把并抹平接缝，确认连接牢固；不把它作为承重或盛液结构。'),
  (320::bigint, 4, '修整杯口、杯壁和底部，使装饰杯能平稳放置；检查是否有裂缝或尖锐边缘。'),
  (320::bigint, 5, '风干完成后按材料说明装饰上色；作品仅供展示，不可盛放食物或饮料。'),
  (319::bigint, 1, '准备预切的20×25×1厘米凳面和4条2×2×20厘米木腿，量测并标记四腿位置，确保间距对称。'),
  (319::bigint, 2, '打磨木材表面和边角，去除毛刺，保留平整的连接面。'),
  (319::bigint, 3, '请成年人在标记处钻导孔；涂木工胶后用夹具固定四条腿，再用螺丝锁紧，等待胶水完全固化。'),
  (319::bigint, 4, '将模型放在平面上检查四脚是否同时着地、是否摇晃；用直尺和砂纸微调稳定性，保持模型不承重。'),
  (319::bigint, 5, '上色或涂饰后作为展示模型摆放，标明其非承重、不可坐人，等待涂层完全干燥。'),
  (343::bigint, 1, '在肥皂表面画方形、三角形、圆形等几何印面，并标出要保留的凸起图案和要削去的留白。'),
  (343::bigint, 2, '沿印面外侧逐步削去大块肥皂，先得到平整的几何块面。'),
  (343::bigint, 3, '靠近轮廓薄薄削切，保持印面平整并让图案凸起高度适合留下清晰印迹。'),
  (343::bigint, 4, '用牙签或塑料刀刻出几何线条和凹槽，清理碎屑，让印面保持清楚平整。'),
  (343::bigint, 5, '在白纸上蘸少量印泥或水性印台测试印章，依据印迹的断线、深浅和边缘清晰度继续修整。'),
  (359::bigint, 1, '写下黄金比例的定义和约1.618的参考值，并说明它是待测假设，不是所有对象都必须符合的规律。'),
  (359::bigint, 2, '测量若干身体长度并计算比值，记录对象、测量方法和误差，比较结果与1.618的接近程度。'),
  (359::bigint, 3, '观察向日葵、松果或贝壳图片中的排列和曲线，记录哪些地方与斐波那契数列或黄金比例近似，哪些地方不符合。'),
  (359::bigint, 4, '选取名画或建筑图片测量指定边长，报告样本、比值和误差，比较它们与黄金矩形的接近程度。'),
  (359::bigint, 5, '按斐波那契数列画正方形和四分之一圆弧，标注这是对黄金螺旋的近似构造，再与测量结果比较。'),
  (378::bigint, 1, '选择一个四位数，四个数字不能全部相同；后续每次都把结果补足四位，避免前导零丢失。'),
  (378::bigint, 2, '将数字降序与升序排列后相减。例如3812得到8321−1238=7083；升序排列按四位数书写。'),
  (378::bigint, 3, '继续计算：7083→8730−0378=8352，再算8532−2358=6174，保留结果中的位数。'),
  (378::bigint, 4, '对6174计算7641−1467=6174，记录它成为不变值，并说明输入须满足不全相同的条件。'),
  (378::bigint, 5, '选择不同的符合条件的四位数，记录到达6174的步数；按此规则，所有符合条件的输入最多经过7步到达6174。'),
  (378::bigint, 6, '拓展到三位数并排除三个数字全相同的输入；例如521→521−125=396→963−369=594→954−459=495，始终保留三位格式。')
) AS v(project_id, sort_order, description)
WHERE s.project_id = v.project_id AND s.sort_order = v.sort_order;

UPDATE public.project_steps AS s
SET title = v.title
FROM (VALUES
  (158::bigint, 2, '按电路图接线'), (158::bigint, 3, '核对引脚与通电'),
  (259::bigint, 1, '观察水流对照'), (259::bigint, 3, '移管手动转移'),
  (263::bigint, 1, '区分毛细与虹吸'), (263::bigint, 4, '测量出水量'),
  (52::bigint, 5, '分析观察结果'), (51::bigint, 1, '融化现成皂基'),
  (320::bigint, 1, '准备风干黏土'),
  (319::bigint, 1, '准备模型木料'), (319::bigint, 3, '成年人协助固定'),
  (319::bigint, 5, '装饰模型'),
  (343::bigint, 1, '绘制几何印面'), (343::bigint, 2, '雕出几何外形'),
  (343::bigint, 3, '修整印面'), (343::bigint, 4, '刻出几何凹槽'),
  (343::bigint, 5, '测试印迹'), (359::bigint, 1, '提出测量假设'),
  (359::bigint, 5, '绘制近似螺旋'), (378::bigint, 1, '选择并补足四位数'),
  (378::bigint, 3, '重复四位运算'), (378::bigint, 5, '验证七步上限'),
  (378::bigint, 6, '拓展三位运算')
) AS v(project_id, sort_order, title)
WHERE s.project_id = v.project_id AND s.sort_order = v.sort_order;

UPDATE public.project_materials
SET material = '3节AA电池盒（4.5V）'
WHERE project_id = 158 AND material = '电池盒及电池（3V-5V）';

UPDATE public.project_materials
SET material = '10kΩ电阻 1个'
WHERE project_id = 158 AND material = '电阻（10KΩ）1个';

INSERT INTO public.project_materials (project_id, material, sort_order)
SELECT 158, v.material, v.sort_order
FROM (VALUES ('330Ω电阻 1个', 8), ('4.7kΩ电阻 1个', 9)) AS v(material, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_materials m
  WHERE m.project_id = 158 AND m.material = v.material
);

UPDATE public.project_materials
SET material = '风干黏土 约200克'
WHERE project_id = 320 AND material = '陶土或超轻黏土约200克';

INSERT INTO public.project_materials (project_id, material, sort_order)
SELECT 263, '量杯（测量出水量）', 7
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_materials m
  WHERE m.project_id = 263 AND m.material = '量杯（测量出水量）'
);

UPDATE public.project_materials
SET material = '松木板（预切20×25×1厘米，凳面）'
WHERE project_id = 319 AND material = '松木板（约20×25厘米，做凳面）';

UPDATE public.project_materials
SET material = '方木条4根（各2×2×20厘米，凳腿）'
WHERE project_id = 319 AND material = '方木条4根（约20厘米，做凳腿）';

UPDATE public.project_materials
SET material = '木螺丝'
WHERE project_id = 319 AND material = '铁钉或木螺丝';

UPDATE public.project_materials
SET material = '电钻或手电钻（成人使用）及螺丝刀'
WHERE project_id = 319 AND material = '锤子或螺丝刀';

INSERT INTO public.project_materials (project_id, material, sort_order)
SELECT 319, '夹具（固定凳腿）', 8
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_materials m
  WHERE m.project_id = 319 AND m.material = '夹具（固定凳腿）'
);

INSERT INTO public.project_materials (project_id, material, sort_order)
SELECT 343, v.material, v.sort_order
FROM (VALUES ('印泥或水性印台', 6), ('白纸（试印用）', 7)) AS v(material, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_materials m
  WHERE m.project_id = 343 AND m.material = v.material
);

INSERT INTO public.project_materials (project_id, material, sort_order)
SELECT 359, '圆规', 6
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_materials m
  WHERE m.project_id = 359 AND m.material = '圆规'
);

UPDATE public.project_materials
SET material = '大号注射器（去针头）'
WHERE project_id = 259 AND material = '大号注射器（去针头）或气筒';

UPDATE public.project_materials
SET material = '细软管和棉线（分别比较输水效果）'
WHERE project_id = 263 AND material = '细软管或棉线（导水用）';

INSERT INTO public.project_materials (project_id, material, sort_order)
SELECT 39, '白纸（接泡泡印迹）', 7
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_materials WHERE project_id = 39 AND material = '白纸（接泡泡印迹）'
);

DO $$
DECLARE
  v_count integer;
  v_title text;
  v_expected record;
BEGIN
  FOR v_expected IN
    SELECT * FROM (VALUES
      (158::bigint, '光控小夜灯', 5),
      (259::bigint, '注射器提水与手动转移', 5),
      (263::bigint, '自动浇水装置', 6),
      (52::bigint, '电解水实验', 5),
      (39::bigint, '彩色泡泡实验', 5),
      (51::bigint, '自制肥皂', 5),
      (31::bigint, '电磁铁制作', 5),
      (320::bigint, '黏土装饰杯', 5),
      (319::bigint, '木工迷你板凳模型', 5),
      (343::bigint, '几何印章肥皂雕刻', 5),
      (359::bigint, '黄金比例寻找', 5),
      (378::bigint, '数字黑洞 6174', 6)
    ) AS expected(id, title, step_count)
  LOOP
    SELECT title INTO v_title FROM public.projects WHERE id = v_expected.id;
    IF v_title IS DISTINCT FROM v_expected.title THEN
      RAISE EXCEPTION 'Project % title mismatch: expected %, got %', v_expected.id, v_expected.title, v_title;
    END IF;
    SELECT count(*) INTO v_count FROM public.project_steps WHERE project_id = v_expected.id;
    IF v_count <> v_expected.step_count THEN
      RAISE EXCEPTION 'Project % step count mismatch: expected %, got %', v_expected.id, v_expected.step_count, v_count;
    END IF;
  END LOOP;
END $$;

COMMIT;
