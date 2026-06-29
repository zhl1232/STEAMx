-- 3+ 课件100「城堡」侧栏步骤对齐 19 步 LDraw 模型。

UPDATE public.course_lessons AS l
SET steps = $steps$[
    {"title":"铺好城堡地基","description":"铺绿色底板，围出橙色城墙和白红栏杆，留出正面入口。","hint":"先确认底板方向，入口留在正面。","checklist":["底板铺平","围墙闭合","正面入口留出"]},
    {"title":"搭主塔底层","description":"在底板中央搭出主塔底层，正面留出门洞和窗格。","hint":"门洞朝向正面，左右保持对称。","checklist":["主塔位置居中","门洞朝前","底层压稳"]},
    {"title":"主塔红黄墙身","description":"继续叠主塔墙身，用红黄相间的砖块形成城堡条纹。","hint":"每一层都要压紧，颜色按红黄交替。","checklist":["红黄交替","墙身垂直"]},
    {"title":"主塔继续加高","description":"把中央主塔继续向上加高，保持墙身垂直稳定。","hint":"从正面和侧面都看一眼，避免塔身歪斜。","checklist":["高度增加","四边稳定"]},
    {"title":"加入上层窗格","description":"给主塔上部加入白色窗格和红色墙带。","hint":"窗格要在同一高度，看起来更整齐。","checklist":["窗格对齐","红色墙带压稳"]},
    {"title":"盖主塔平台","description":"在主塔顶部盖黄色平台，形成观景台。","hint":"平台要覆盖塔身，四边尽量均匀。","checklist":["平台盖平","边缘对齐"]},
    {"title":"搭小塔座","description":"在平台上继续搭小塔座，准备收出塔顶。","hint":"小塔座放在主塔平台中央。","checklist":["塔座居中","连接牢固"]},
    {"title":"小塔加窗","description":"给小塔座加上窗格，让塔顶更像城堡瞭望塔。","hint":"窗格面向正面，便于观察。","checklist":["窗格朝前","塔顶不松动"]},
    {"title":"主塔城垛","description":"在主塔顶部加红色城垛，形成城堡轮廓。","hint":"城垛之间留出间隔，像城堡顶部的齿形边。","checklist":["城垛分布均匀","顶部压紧"]},
    {"title":"主塔插旗","description":"给最高的主塔插上旗杆和红旗。","hint":"旗杆垂直插好，红旗朝外。","checklist":["旗杆竖直","红旗固定"]},
    {"title":"右塔底层","description":"在右侧搭出副塔底层，与围墙连接起来。","hint":"右塔位置贴近右侧城墙。","checklist":["右塔落点正确","与围墙连接"]},
    {"title":"右塔墙身","description":"右侧塔继续叠红黄墙身，保持和主塔风格一致。","hint":"右塔比主塔矮一些，颜色仍按红黄交替。","checklist":["墙身稳定","颜色延续"]},
    {"title":"右塔窗格","description":"给右侧塔加入上层窗格。","hint":"窗格朝向正面，和主塔视觉一致。","checklist":["窗格朝前","高度合适"]},
    {"title":"右塔平台城垛","description":"给右侧塔盖平台并加上城垛。","hint":"平台压住塔身，城垛放在顶部边缘。","checklist":["平台盖平","城垛稳固"]},
    {"title":"左塔底层","description":"在左侧搭出副塔底层，和右侧塔保持对称。","hint":"对照右塔位置，让左右两边平衡。","checklist":["左塔落点正确","左右对称"]},
    {"title":"左塔墙身","description":"左侧塔继续叠红黄墙身。","hint":"高度和右塔保持一致。","checklist":["墙身稳定","高度匹配"]},
    {"title":"左塔窗格","description":"给左侧塔加入上层窗格。","hint":"窗格朝前，与右塔呼应。","checklist":["窗格朝前","左右一致"]},
    {"title":"左塔平台城垛","description":"给左侧塔盖平台并加上城垛。","hint":"检查左右塔平台高度是否一致。","checklist":["平台盖平","城垛稳固"]},
    {"title":"完成城堡","description":"两侧塔插上小红旗，城堡搭建完成，对照成品图检查一遍。","hint":"最后从正面、侧面和上方分别检查一次。","checklist":["三面旗帜固定","塔身不歪","整体和成品图一致"]}
  ]$steps$::jsonb,
  updated_at = now()
WHERE l.id = 34
  AND l.course_id = 5
  AND l.title = '城堡'
  AND l.lesson_type = 'building_3d';
