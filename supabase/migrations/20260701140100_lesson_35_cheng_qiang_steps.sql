-- 3+ 课件100「城墙」侧栏步骤对齐 9 步 LDraw 模型。

UPDATE public.course_lessons AS l
SET steps = $steps$[
    {"title":"搭建墙体","description":"铺两块绿色底板，两面平行墙各叠 7 层黄橙交替砖，中间留出 2 格走道。","hint":"先确认底板接缝在中间，两面墙对称。","checklist":["两块绿色底板铺平","两面墙平行","中间走道留出"]},
    {"title":"连接走道","description":"用 4 块红色 2×10 薄板横跨两面墙，铺出中间红色走道。","hint":"红色薄板要同时压住两面墙顶。","checklist":["红色薄板 ×4","走道连通","薄板压稳"]},
    {"title":"墙体加高","description":"两面墙继续各加两层橙色 2×4 砖，把墙身加高。","hint":"只在两面外墙继续叠高，不要堵住走道。","checklist":["橙色砖每层 8 块","两面墙同步加高"]},
    {"title":"黄色墙顶","description":"两面墙顶部再压一层黄色 2×4 砖，为城楼立柱做准备。","hint":"黄色层要平整，方便后面立柱落点。","checklist":["黄色顶层压紧","墙身垂直"]},
    {"title":"搭建楼柱","description":"在两座城楼位置各立 4 根红黄交替立柱，形成四脚支撑。","hint":"立柱颜色按黄-红-黄-红交替向上叠。","checklist":["每座城楼 4 根柱","红黄交替","立柱垂直"]},
    {"title":"搭建楼体","description":"立柱顶盖灰色楼板，铺红色走道薄板，并加上黄色垛口。","hint":"垛口之间要留出间隔。","checklist":["灰色楼板盖平","红色走道铺好","黄色垛口分布均匀"]},
    {"title":"城楼屋顶","description":"走道铺橙色薄板，给两座城楼盖上阶梯式橙色屋顶。","hint":"屋顶从大到小阶梯收顶。","checklist":["橙色走道铺平","阶梯屋顶居中"]},
    {"title":"连接旗子","description":"两座城楼各插一根旗杆和一面红旗。","hint":"旗杆垂直插在屋顶中央。","checklist":["旗杆竖直","红旗朝外固定"]},
    {"title":"完成城墙","description":"城墙搭建完成，对照成品图检查走道、城楼和旗帜。","hint":"从正面和上方各检查一遍整体对称。","checklist":["两面墙对称","城楼稳固","旗帜固定","与成品图一致"]}
  ]$steps$::jsonb,
  updated_at = now()
WHERE l.id = 35
  AND l.course_id = 5
  AND l.title = '城墙'
  AND l.lesson_type = 'building_3d';
