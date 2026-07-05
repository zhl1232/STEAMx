-- 3+ 课件100「东方明珠」同步侧栏 steps 与 3D steps3d，避免课程步数和模型步数不一致。

WITH lesson_payload AS (
  SELECT
    $steps$[
      {"title":"搭建塔基支脚","description":"先用长砖向四周搭出稳定支脚，确定东方明珠的底座范围。","hint":"支脚要分布均匀，给高塔留出稳固重心。","checklist":["底座范围清楚","支脚摆放稳定"]},
      {"title":"加固底部平台","description":"继续补齐底部砖块，让塔身能够垂直向上搭建。","hint":"平台越平，后面的塔身越容易站直。","checklist":["平台平整","中心位置清楚"]},
      {"title":"搭建第一层塔身","description":"在底座中央开始向上叠塔身，注意中心对齐。","hint":"每层都围绕中心线搭。","checklist":["塔身在中心","第一层没有歪"]},
      {"title":"扩展中部结构","description":"围绕塔身补上横向结构，形成东方明珠的中部轮廓。","hint":"左右两边要保持平衡。","checklist":["中部结构对称","连接牢固"]},
      {"title":"继续加高塔身","description":"继续向上叠砖，让塔身高度逐渐升高。","hint":"边搭边从正面检查是否竖直。","checklist":["塔身继续升高","没有明显倾斜"]},
      {"title":"搭建上部平台","description":"在塔身上方收拢并搭出上部平台。","hint":"平台要压稳下面的塔身。","checklist":["上部平台平整","塔身连接稳定"]},
      {"title":"搭建顶部塔柱","description":"用小砖块继续向上搭出细长塔柱。","hint":"顶部塔柱更细，摆放时要对准中心。","checklist":["塔柱居中","上下连接稳"]},
      {"title":"收拢塔尖","description":"在顶部逐步收窄结构，形成塔尖过渡。","hint":"越往上越要轻放，避免碰歪。","checklist":["塔尖逐步收窄","整体仍然竖直"]},
      {"title":"完成东方明珠","description":"最后补上塔尖砖块，检查底座、塔身和顶部是否竖直稳定。","hint":"完成后转动 3D，从不同角度检查轮廓。","checklist":["底座稳定","塔身竖直","顶部完整"]}
    ]$steps$::jsonb AS steps,
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
        to_jsonb('/courses/ldraw/3-dong-fang-ming-zhu.mpd'::text),
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
FROM lesson_payload
WHERE l.id = 43
  AND l.course_id = 5
  AND l.title = '东方明珠'
  AND l.lesson_type = 'building_3d';
