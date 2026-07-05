-- 3+ 课件100「抽屉」补挂自托管 LDraw 模型，steps3d 对齐 8 个 0 STEP。
-- 模型源：scripts/ldraw-models/3-chou-ti.ldr
-- 打包产物：public/courses/ldraw/3-chou-ti.mpd。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(l.content, '{}'::jsonb),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/3-chou-ti.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"搭建下层抽屉底座","description":"先放好灰色 8×8 底板，再用蓝色 2×4 砖围出第一层抽屉框。","partIds":[],"cameraHint":"isometric"},
      {"title":"加高下层抽屉","description":"在第一层上方继续叠一圈黄绿色 2×4 砖，让抽屉侧壁升高。","partIds":[],"cameraHint":"isometric"},
      {"title":"安装下层拉手","description":"叠上蓝色第三层砖，并在抽屉正面装上红色圆环拉手。","partIds":[],"cameraHint":"front"},
      {"title":"搭建下层柜体","description":"补齐下层抽屉最后一层，同时搭好柜体底板和下半部外框，正面留出抽屉开口。","partIds":[],"cameraHint":"isometric"},
      {"title":"放上中间隔板","description":"在下层柜体上方盖两块绿色长板，形成上下抽屉之间的隔板。","partIds":[],"cameraHint":"top"},
      {"title":"搭建上层外框","description":"沿着隔板继续砌上层柜体外墙，保留正面开口并撑起顶部空间。","partIds":[],"cameraHint":"isometric"},
      {"title":"放入上层抽屉","description":"搭好上层小抽屉，装上红色拉手后推入上层柜体。","partIds":[],"cameraHint":"front"},
      {"title":"封顶完成","description":"最后盖上两块绿色顶板，检查上下两个抽屉都能对齐。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 37
  AND l.course_id = 5
  AND l.title = '抽屉'
  AND l.lesson_type = 'building_3d';
