-- 3+ 课件100「东方明珠」补挂自托管 LDraw 模型，steps3d 对齐 9 个 0 STEP。
-- 模型源：scripts/ldraw-models/3-dong-fang-ming-zhu.ldr
-- 打包产物：public/courses/ldraw/3-dong-fang-ming-zhu.mpd。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(l.content, '{}'::jsonb),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/3-dong-fang-ming-zhu.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"搭建塔基支脚","description":"先用长砖向四周搭出稳定支脚，确定东方明珠的底座范围。","partIds":[],"cameraHint":"top"},
      {"title":"加固底部平台","description":"继续补齐底部砖块，让塔身能够垂直向上搭建。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建第一层塔身","description":"在底座中央开始向上叠塔身，注意中心对齐。","partIds":[],"cameraHint":"front"},
      {"title":"扩展中部结构","description":"围绕塔身补上横向结构，形成东方明珠的中部轮廓。","partIds":[],"cameraHint":"isometric"},
      {"title":"继续加高塔身","description":"继续向上叠砖，让塔身高度逐渐升高。","partIds":[],"cameraHint":"front"},
      {"title":"搭建上部平台","description":"在塔身上方收拢并搭出上部平台。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建顶部塔柱","description":"用小砖块继续向上搭出细长塔柱。","partIds":[],"cameraHint":"front"},
      {"title":"收拢塔尖","description":"在顶部逐步收窄结构，形成塔尖过渡。","partIds":[],"cameraHint":"front"},
      {"title":"完成东方明珠","description":"最后补上塔尖砖块，检查底座、塔身和顶部是否竖直稳定。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 43
  AND l.course_id = 5
  AND l.title = '东方明珠'
  AND l.lesson_type = 'building_3d';
