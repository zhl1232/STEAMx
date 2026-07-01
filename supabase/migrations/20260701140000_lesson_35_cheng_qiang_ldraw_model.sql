-- 3+ 课件100「城墙」补挂自托管 LDraw 模型，steps3d 对齐 9 步搭建说明。
-- 模型源：scripts/ldraw-models/gen-3-cheng-qiang.mjs -> scripts/ldraw-models/3-cheng-qiang.ldr
-- 打包产物：public/courses/ldraw/3-cheng-qiang.mpd（9 个 0 STEP 驱动分步显隐）。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(l.content, '{}'::jsonb),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/3-cheng-qiang.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"搭建墙体","description":"铺两块绿色底板，两面平行墙各叠 7 层黄橙交替砖，中间留出 2 格走道。","partIds":[],"cameraHint":"isometric"},
      {"title":"连接走道","description":"用 4 块红色 2×10 薄板横跨两面墙，铺出中间红色走道。","partIds":[],"cameraHint":"top"},
      {"title":"墙体加高","description":"两面墙继续各加两层橙色 2×4 砖，把墙身加高。","partIds":[],"cameraHint":"isometric"},
      {"title":"黄色墙顶","description":"两面墙顶部再压一层黄色 2×4 砖，为城楼立柱做准备。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建楼柱","description":"在两座城楼位置各立 4 根红黄交替立柱，形成四脚支撑。","partIds":[],"cameraHint":"front"},
      {"title":"搭建楼体","description":"立柱顶盖灰色楼板，铺红色走道薄板，并加上黄色垛口。","partIds":[],"cameraHint":"isometric"},
      {"title":"城楼屋顶","description":"走道铺橙色薄板，给两座城楼盖上阶梯式橙色屋顶。","partIds":[],"cameraHint":"isometric"},
      {"title":"连接旗子","description":"两座城楼各插一根旗杆和一面红旗。","partIds":[],"cameraHint":"front"},
      {"title":"完成城墙","description":"城墙搭建完成，对照成品图检查走道、城楼和旗帜。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 35
  AND l.course_id = 5
  AND l.title = '城墙'
  AND l.lesson_type = 'building_3d';
