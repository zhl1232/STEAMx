-- 调整埃菲尔样板课的落点：上一版（20260628140000）误把埃菲尔放进了「大颗粒积木工程启蒙·会跑的小车」。
-- 现按需求改为：①把「会跑的小车」还原回小车；②把「小小积木工程师：学前大颗粒启蒙」第 1 课
-- 「稳稳高塔」替换为「埃菲尔铁塔」（13 步对照搭建说明 PDF，自托管 LDraw eiffel-tower.mpd）。
-- 因 20260628140000 已在目标库执行，无法重跑，故用本迁移做幂等纠正。

-- ① 还原「大颗粒积木工程启蒙」的第一课为「会跑的小车」（duplo-car.mpd，3 步）。
UPDATE public.course_lessons AS l
SET
  title = '会跑的小车',
  duration_minutes = 25,
  steps = '[
    {"title":"放好带轮子的车底盘","description":"先放一块带轮子的红色车底盘，把它放平并确认车头和车尾方向。","hint":"底盘放平，后面叠车身时才不会歪。","checklist":["底盘没有倾斜","四个轮子都能转动"]},
    {"title":"叠上车身","description":"在底盘正中间叠一块黄色长积木做车身，前后对齐底盘。","hint":"车身放在正中间，小车重心才稳。","checklist":["车身和底盘对齐","左右没有露出太多"]},
    {"title":"装上驾驶舱","description":"在车身上再叠一块蓝色小积木当驾驶舱，让重心保持在中央。","hint":"驾驶舱放中间，推起来才直。","checklist":["驾驶舱不容易倒","小车向前推能直线滑动一小段"]}
  ]'::jsonb,
  resources = '[]'::jsonb,
  content = '{
    "summary":"用大颗粒积木搭一辆稳定的小车，练习对称和重心。",
    "building3d":{
      "ldrawModelUrl":"/courses/ldraw/duplo-car.mpd",
      "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
      "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
      "parts":[
        {"id":"base","name":"红色车底盘（带轮）","color":"#ef4444","quantity":1},
        {"id":"body","name":"黄色车身 2x4","color":"#facc15","quantity":1},
        {"id":"cab","name":"蓝色驾驶舱 2x2","color":"#3b82f6","quantity":1}
      ],
      "steps3d":[
        {"title":"放好带轮子的车底盘","description":"先放一块带轮子的红色车底盘，确认车头方向。","partIds":["base"],"cameraHint":"isometric"},
        {"title":"叠上车身","description":"在底盘正中间叠一块黄色长积木做车身。","partIds":["body"],"cameraHint":"front"},
        {"title":"装上驾驶舱","description":"在车身上叠一块蓝色小积木当驾驶舱。","partIds":["cab"],"cameraHint":"side"}
      ]
    }
  }'::jsonb
FROM public.courses AS c
WHERE l.course_id = c.id
  AND c.title = '大颗粒积木工程启蒙'
  AND l.title IN ('会跑的小车', '埃菲尔铁塔');

-- ② 把「小小积木工程师：学前大颗粒启蒙」第 1 课替换为「埃菲尔铁塔」。
UPDATE public.course_lessons AS l
SET
  title = '埃菲尔铁塔',
  duration_minutes = 40,
  steps = '[
    {"title":"铺底板·搭蓝色大长腿","description":"先放绿色大底板，再在四个角搭出 4 条蓝色「大长腿」，每条腿是 L 形、叠 2 层。","hint":"四条腿要对称、一样高，塔才稳。","checklist":["四条腿左右对称","每条腿都是 2 层高"]},
    {"title":"腿上加红色一层","description":"给 4 条蓝腿各叠一层红色 2x4 砖。","hint":"红砖压住蓝腿的接缝，更牢固。","checklist":["每条腿顶上都有红砖"]},
    {"title":"盖灰色大平台","description":"在 4 条腿顶上盖一块灰色 8x8 平台，把腿连成一体。","hint":"平台放正中间，前后左右都搭到腿上。","checklist":["平台居中","四条腿都顶住平台"]},
    {"title":"红色风车圈收窄","description":"平台上叠红色「风车圈」(2 层)，塔身开始往里收。","hint":"四块砖像风车一样首尾相接，中间留小孔。","checklist":["四块砖围成方框","中间有方孔"]},
    {"title":"四角立蓝色小柱","description":"在风车圈四个角各立一根蓝色 2x2 小柱(2 层)。","hint":"四角小柱一样高，下一块平台才放得平。","checklist":["四角都有小柱","四根一样高"]},
    {"title":"再盖一块灰平台","description":"在四角小柱上盖第二块灰色平台。","hint":"平台压住四个角柱。","checklist":["平台放平","四角都顶住"]},
    {"title":"蓝色风车圈","description":"第二块平台上再叠蓝色风车圈(2 层)。","hint":"和下面的风车圈对齐。","checklist":["围成方框","与下层对齐"]},
    {"title":"红色装饰带","description":"加一圈红色 2x4 薄板做装饰带。","hint":"薄薄一圈，像塔身上的花纹。","checklist":["围成一圈薄板"]},
    {"title":"蓝色塔芯","description":"中间叠一段蓝色 4x4 实心塔芯(2 层)，给塔尖打底。","hint":"塔芯要正中，塔尖才直。","checklist":["塔芯居中","叠了 2 层"]},
    {"title":"竖起条纹塔尖","description":"中央竖起蓝红交替的条纹塔尖(下段)。","hint":"一蓝一红往上叠，注意对正中心。","checklist":["塔尖在正中央","蓝红交替"]},
    {"title":"加观景平台","description":"在塔尖上加一块灰色观景平台。","hint":"小平台稳稳卡在塔尖上。","checklist":["平台居中","不晃动"]},
    {"title":"接塔尖与顶帽","description":"平台上接塔尖上段和顶帽，越往上越细。","hint":"最后一块是塔顶帽子。","checklist":["塔尖到顶","整体不歪"]},
    {"title":"完成！","description":"积木版埃菲尔铁塔搭好了，转一转 3D 看看每一面。","hint":"对照成品图检查一遍。","checklist":["和成品图一样","结构稳固不倒"]}
  ]'::jsonb,
  resources = '[]'::jsonb,
  content = '{
    "summary":"跟着动画和图纸，用积木分 13 步搭出埃菲尔铁塔，练习对称、承重与收分。",
    "building3d":{
      "ldrawModelUrl":"/courses/ldraw/eiffel-tower.mpd",
      "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
      "videoUrl":"/courses/eiffel-tower/animation.mp4",
      "videoSlideIndex":5,
      "slideImageUrls":[
        "/courses/eiffel-tower/slides/slide-01.png","/courses/eiffel-tower/slides/slide-02.png",
        "/courses/eiffel-tower/slides/slide-03.png","/courses/eiffel-tower/slides/slide-04.png",
        "/courses/eiffel-tower/slides/slide-05.png","/courses/eiffel-tower/slides/slide-06.png",
        "/courses/eiffel-tower/slides/slide-07.png","/courses/eiffel-tower/slides/slide-08.png",
        "/courses/eiffel-tower/slides/slide-09.png","/courses/eiffel-tower/slides/slide-10.png",
        "/courses/eiffel-tower/slides/slide-11.png","/courses/eiffel-tower/slides/slide-12.png",
        "/courses/eiffel-tower/slides/slide-13.png","/courses/eiffel-tower/slides/slide-14.png",
        "/courses/eiffel-tower/slides/slide-15.png","/courses/eiffel-tower/slides/slide-16.png"
      ],
      "slidesPdfUrl":"/courses/eiffel-tower/instructions.pdf",
      "finishedImageUrl":"/courses/eiffel-tower/finished.png",
      "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。课件素材版权归原作者所有，仅作本地演示。",
      "parts":[
        {"id":"baseplate","name":"绿色 32x32 底板","color":"#16a34a","quantity":1},
        {"id":"blue24","name":"蓝色 2x4 砖","color":"#2563eb","quantity":32},
        {"id":"red24","name":"红色 2x4 砖","color":"#ef4444","quantity":12},
        {"id":"blue22","name":"蓝色 2x2 砖","color":"#2563eb","quantity":15},
        {"id":"red22","name":"红色 2x2 砖","color":"#ef4444","quantity":3},
        {"id":"plate88","name":"灰色 8x8 平台","color":"#9ca3af","quantity":2},
        {"id":"redplate","name":"红色 2x4 薄板","color":"#ef4444","quantity":4},
        {"id":"deck","name":"灰色观景平台","color":"#9ca3af","quantity":2}
      ],
      "steps3d":[
        {"title":"铺底板·搭蓝色大长腿","description":"绿底板 + 4 条蓝色外八字腿(2 层)。","partIds":["baseplate","blue24"],"cameraHint":"top"},
        {"title":"腿上加红色一层","description":"4 条腿各加一层红色 2x4。","partIds":["red24"],"cameraHint":"isometric"},
        {"title":"盖灰色大平台","description":"灰色 8x8 平台桥接 4 条腿。","partIds":["plate88"],"cameraHint":"top"},
        {"title":"红色风车圈收窄","description":"红色风车圈 2 层。","partIds":["red24"],"cameraHint":"isometric"},
        {"title":"四角立蓝色小柱","description":"四角蓝色 2x2 柱 2 层。","partIds":["blue22"],"cameraHint":"isometric"},
        {"title":"再盖一块灰平台","description":"第二块灰色平台。","partIds":["plate88"],"cameraHint":"isometric"},
        {"title":"蓝色风车圈","description":"蓝色风车圈 2 层。","partIds":["blue24"],"cameraHint":"isometric"},
        {"title":"红色装饰带","description":"红色 2x4 薄板一圈。","partIds":["redplate"],"cameraHint":"isometric"},
        {"title":"蓝色塔芯","description":"蓝色 4x4 实心塔芯 2 层。","partIds":["blue24"],"cameraHint":"front"},
        {"title":"竖起条纹塔尖","description":"中央蓝红交替塔尖下段。","partIds":["blue22","red22"],"cameraHint":"front"},
        {"title":"加观景平台","description":"塔尖上灰色观景平台。","partIds":["deck"],"cameraHint":"front"},
        {"title":"接塔尖与顶帽","description":"塔尖上段与顶帽。","partIds":["blue22","red22"],"cameraHint":"front"},
        {"title":"完成！","description":"完整的积木埃菲尔铁塔。","partIds":[],"cameraHint":"isometric"}
      ]
    }
  }'::jsonb
FROM public.courses AS c
WHERE l.course_id = c.id
  AND c.title = '小小积木工程师：学前大颗粒启蒙'
  AND l.title IN ('稳稳高塔', '埃菲尔铁塔');
