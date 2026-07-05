-- 3+ 课件100「大象」补挂自托管 LDraw 模型，steps3d 对齐 15 个 0 STEP。
-- 模型源：scripts/ldraw-models/duplo_elephant_steps.ldr
-- 打包产物：public/courses/ldraw/duplo_elephant_steps.mpd。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(l.content, '{}'::jsonb),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/duplo_elephant_steps.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"搭建四条腿","description":"用黄橙相间的 2×2 和弧面砖搭出四个脚底，再向上叠出大象的四条腿。","partIds":[],"cameraHint":"isometric"},
      {"title":"加高后排腿柱","description":"继续补上后排腿部的黄橙砖，让四条腿高度一致。","partIds":[],"cameraHint":"isometric"},
      {"title":"盖上身体底板","description":"在腿柱上方放一块绿色 8×16 大底板，形成身体平台。","partIds":[],"cameraHint":"top"},
      {"title":"安装头部拱门","description":"在前端装上黄色大拱门件，预留象鼻和头部的连接位置。","partIds":[],"cameraHint":"front"},
      {"title":"砌第一层身体墙","description":"沿绿色底板两侧叠一圈橙色 2×4 砖，围出身体外形。","partIds":[],"cameraHint":"isometric"},
      {"title":"砌第二层身体墙","description":"用黄绿色砖错位加高身体墙，并在前端补 2×2 砖让轮廓收稳。","partIds":[],"cameraHint":"isometric"},
      {"title":"砌第三层身体墙","description":"再叠一圈橙色 2×4 砖，让身体更厚实。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建背部和尾巴座","description":"用黄绿色砖抬高背部结构，并在后端留出尾巴支撑。","partIds":[],"cameraHint":"side"},
      {"title":"搭建尾巴","description":"用橙色弧面砖向后上方接出短尾巴。","partIds":[],"cameraHint":"side"},
      {"title":"封住背部平台","description":"在背部放上橙色 2×4 砖和小薄板，整理身体顶面。","partIds":[],"cameraHint":"top"},
      {"title":"连接象鼻和耳朵","description":"用弯管件从头部向下接出象鼻，并在两侧布置弯管形成耳朵轮廓。","partIds":[],"cameraHint":"front"},
      {"title":"固定头部横梁","description":"在头部中间加红色横梁和两侧圆环件，锁住象鼻连接处。","partIds":[],"cameraHint":"front"},
      {"title":"搭建头部主体","description":"用红色 2×4 砖围出大象头部，让头顶和两侧更饱满。","partIds":[],"cameraHint":"front"},
      {"title":"装上眼睛","description":"在头部上层装 2×2 砖、眼睛印刷砖和红色连接砖，形成表情。","partIds":[],"cameraHint":"front"},
      {"title":"完成头顶","description":"最后用红色弧面砖封住头顶，检查象鼻、耳朵和身体都连接牢固。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 38
  AND l.course_id = 5
  AND l.title = '大象'
  AND l.lesson_type = 'building_3d';
