-- 3+ 课件100「灯塔」补挂自托管 LDraw 模型，steps3d 对齐 17 个 0 STEP。
-- 模型源：scripts/ldraw-models/duplo_lighthouse_steps.ldr
-- 打包产物：public/courses/ldraw/duplo_lighthouse_steps.mpd。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(l.content, '{}'::jsonb),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/duplo_lighthouse_steps.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"搭建灯塔底座","description":"先搭好底部平台和围栏件，确定灯塔占地范围。","partIds":[],"cameraHint":"isometric"},
      {"title":"加固底座角柱","description":"在底座四周叠砖，加高并加固底部支撑。","partIds":[],"cameraHint":"isometric"},
      {"title":"补齐底层平台","description":"继续补齐底层砖块，让塔身可以平稳向上搭建。","partIds":[],"cameraHint":"top"},
      {"title":"搭建塔身第一层","description":"在底座中央开始砌塔身，注意四边对齐。","partIds":[],"cameraHint":"front"},
      {"title":"加宽塔身墙面","description":"沿塔身四周继续补砖，形成稳定的墙面。","partIds":[],"cameraHint":"isometric"},
      {"title":"继续抬高塔身","description":"向上叠加塔身砖块，让灯塔高度逐渐升高。","partIds":[],"cameraHint":"front"},
      {"title":"安装中层平台","description":"在塔身中部放上平台件，作为上层结构的支撑。","partIds":[],"cameraHint":"top"},
      {"title":"搭建上层塔身","description":"在中层平台上继续搭建较高的塔身部分。","partIds":[],"cameraHint":"front"},
      {"title":"收窄塔身","description":"用较小的砖块向中间收拢，准备搭建灯室。","partIds":[],"cameraHint":"isometric"},
      {"title":"加固灯室底座","description":"在塔身顶部加固连接点，让灯室更稳。","partIds":[],"cameraHint":"front"},
      {"title":"搭建灯室围栏","description":"围出灯室的四周结构，保留中间灯光位置。","partIds":[],"cameraHint":"isometric"},
      {"title":"安装灯室主体","description":"放上透明或浅色灯室件，形成灯塔发光区域。","partIds":[],"cameraHint":"front"},
      {"title":"盖上灯室顶板","description":"在灯室上方加盖顶板，把灯室结构锁住。","partIds":[],"cameraHint":"top"},
      {"title":"加装灯塔屋顶","description":"继续搭建顶部屋顶，让灯塔轮廓更完整。","partIds":[],"cameraHint":"front"},
      {"title":"搭建顶部支柱","description":"在屋顶上方叠起小支柱，准备安装顶端标志。","partIds":[],"cameraHint":"isometric"},
      {"title":"放上灯塔顶端","description":"安装最上方的顶端砖块，完成灯塔顶部。","partIds":[],"cameraHint":"front"},
      {"title":"完成灯塔","description":"最后检查底座、塔身和灯室是否垂直稳固。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 40
  AND l.course_id = 5
  AND l.title = '灯塔'
  AND l.lesson_type = 'building_3d';
