-- 3+ 课件100「大熊猫」补挂自托管 LDraw 模型，steps3d 对齐 13 个 0 STEP。
-- 模型源：scripts/ldraw-models/duplo_panda_steps.ldr
-- 打包产物：public/courses/ldraw/duplo_panda_steps.mpd。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(l.content, '{}'::jsonb),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/duplo_panda_steps.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"搭建身体底座","description":"先放好底部管件、圆环和 2×4 砖，确定大熊猫身体的宽度。","partIds":[],"cameraHint":"isometric"},
      {"title":"加宽身体底部","description":"在底部两侧继续补砖，让身体底座更稳定。","partIds":[],"cameraHint":"isometric"},
      {"title":"连接身体中层","description":"用连接砖把左右结构锁在一起，形成身体中间层。","partIds":[],"cameraHint":"front"},
      {"title":"搭建左侧手臂","description":"在身体左侧接上管件和弯管，做出向外伸出的手臂。","partIds":[],"cameraHint":"side"},
      {"title":"搭建右侧手臂","description":"在身体右侧用同样方式接出手臂，保持左右平衡。","partIds":[],"cameraHint":"side"},
      {"title":"搭建头部底层","description":"在身体上方铺出头部第一层，为脸部轮廓做支撑。","partIds":[],"cameraHint":"isometric"},
      {"title":"砌出脸部轮廓","description":"继续叠加白色砖块，围出大熊猫圆圆的脸。","partIds":[],"cameraHint":"front"},
      {"title":"加宽头部两侧","description":"补齐头部两侧和后侧的砖，让头部更饱满。","partIds":[],"cameraHint":"isometric"},
      {"title":"加高头部","description":"继续向上叠砖，把脸部主体高度搭出来。","partIds":[],"cameraHint":"front"},
      {"title":"收拢头顶","description":"用较少的砖块向中间收拢，形成头顶轮廓。","partIds":[],"cameraHint":"isometric"},
      {"title":"封住头顶","description":"补上顶部砖块，让头部结构闭合并保持稳固。","partIds":[],"cameraHint":"top"},
      {"title":"安装耳朵和脚部","description":"在头部和底部装上黑色点缀件，形成耳朵和脚。","partIds":[],"cameraHint":"front"},
      {"title":"完成大熊猫","description":"最后检查头部、身体和两侧手臂都连接牢固。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 39
  AND l.course_id = 5
  AND l.title = '大熊猫'
  AND l.lesson_type = 'building_3d';
