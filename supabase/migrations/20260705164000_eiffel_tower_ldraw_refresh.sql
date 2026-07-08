-- 刷新「小小积木工程师：学前大颗粒启蒙」第 1 课「埃菲尔铁塔」的 LDraw 课程字段。
-- 源 LDR 已移除；课程继续使用已完成的 public/courses/ldraw/eiffel-tower.mpd。
-- 课件、视频、PDF、成品图和作品墙字段保持原值。

WITH lesson_payload AS (
  SELECT
    $steps$[
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
    ]$steps$::jsonb AS steps,
    $steps3d$[
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
    ]$steps3d$::jsonb AS steps3d
)
UPDATE public.course_lessons AS l
SET
  steps = lesson_payload.steps,
  content = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(l.content, '{}'::jsonb),
          '{building3d}',
          COALESCE(l.content->'building3d', '{}'::jsonb),
          true
        ),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/eiffel-tower.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    lesson_payload.steps3d,
    true
  ),
  updated_at = now()
FROM lesson_payload, public.courses AS c
WHERE l.course_id = c.id
  AND c.title = '小小积木工程师：学前大颗粒启蒙'
  AND l.title = '埃菲尔铁塔'
  AND l.lesson_type = 'building_3d';
