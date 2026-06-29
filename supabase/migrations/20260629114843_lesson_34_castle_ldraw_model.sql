-- 3+ 课件100「城堡」补挂自托管 LDraw 模型。
-- 模型源：scripts/ldraw-models/gen-3-cheng-bao.mjs -> scripts/ldraw-models/3-cheng-bao.ldr
-- 打包产物：public/courses/ldraw/3-cheng-bao.mpd（19 个 0 STEP 驱动分步显隐）。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(l.content, '{}'::jsonb),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/3-cheng-bao.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"铺好城堡地基","description":"铺绿色底板，围出橙色城墙和白红栏杆，留出正面入口。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭主塔底层","description":"在底板中央搭出主塔底层，正面留出门洞和窗格。","partIds":[],"cameraHint":"front"},
      {"title":"主塔红黄墙身","description":"继续叠主塔墙身，用红黄相间的砖块形成城堡条纹。","partIds":[],"cameraHint":"isometric"},
      {"title":"主塔继续加高","description":"把中央主塔继续向上加高，保持墙身垂直稳定。","partIds":[],"cameraHint":"isometric"},
      {"title":"加入上层窗格","description":"给主塔上部加入白色窗格和红色墙带。","partIds":[],"cameraHint":"front"},
      {"title":"盖主塔平台","description":"在主塔顶部盖黄色平台，形成观景台。","partIds":[],"cameraHint":"top"},
      {"title":"搭小塔座","description":"在平台上继续搭小塔座，准备收出塔顶。","partIds":[],"cameraHint":"isometric"},
      {"title":"小塔加窗","description":"给小塔座加上窗格，让塔顶更像城堡瞭望塔。","partIds":[],"cameraHint":"front"},
      {"title":"主塔城垛","description":"在主塔顶部加红色城垛，形成城堡轮廓。","partIds":[],"cameraHint":"isometric"},
      {"title":"主塔插旗","description":"给最高的主塔插上旗杆和红旗。","partIds":[],"cameraHint":"front"},
      {"title":"右塔底层","description":"在右侧搭出副塔底层，与围墙连接起来。","partIds":[],"cameraHint":"isometric"},
      {"title":"右塔墙身","description":"右侧塔继续叠红黄墙身，保持和主塔风格一致。","partIds":[],"cameraHint":"isometric"},
      {"title":"右塔窗格","description":"给右侧塔加入上层窗格。","partIds":[],"cameraHint":"front"},
      {"title":"右塔平台城垛","description":"给右侧塔盖平台并加上城垛。","partIds":[],"cameraHint":"isometric"},
      {"title":"左塔底层","description":"在左侧搭出副塔底层，和右侧塔保持对称。","partIds":[],"cameraHint":"isometric"},
      {"title":"左塔墙身","description":"左侧塔继续叠红黄墙身。","partIds":[],"cameraHint":"isometric"},
      {"title":"左塔窗格","description":"给左侧塔加入上层窗格。","partIds":[],"cameraHint":"front"},
      {"title":"左塔平台城垛","description":"给左侧塔盖平台并加上城垛。","partIds":[],"cameraHint":"isometric"},
      {"title":"完成城堡","description":"两侧塔插上小红旗，城堡搭建完成，对照成品图检查一遍。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 34
  AND l.course_id = 5
  AND l.title = '城堡'
  AND l.lesson_type = 'building_3d';
