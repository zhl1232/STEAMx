-- 3+ 课件100「长颈鹿」补挂自托管 LDraw 模型，steps3d 对齐 8 个 0 STEP。
-- 模型源：scripts/ldraw-models/3-chang-jing-lu.ldr
-- 打包产物：public/courses/ldraw/3-chang-jing-lu.mpd。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(l.content, '{}'::jsonb),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/3-chang-jing-lu.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"搭建四肢","description":"用黄橙相间的大颗粒积木搭出四条腿，并在底部装上弧形脚。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建身体","description":"用红蓝弧形件和黄橙积木连接四肢，形成长颈鹿身体。","partIds":[],"cameraHint":"isometric"},
      {"title":"连接尾巴","description":"在身体后端接上弯管，让尾巴向后自然伸出。","partIds":[],"cameraHint":"side"},
      {"title":"完善身体","description":"继续叠加身体上的黄橙积木，让背部更稳定。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建颈部","description":"用直管和弯管向上搭出长长的脖子，并把头部方向调整好。","partIds":[],"cameraHint":"front"},
      {"title":"搭建头部","description":"在脖子顶端装上头部框架，形成长颈鹿的脸部轮廓。","partIds":[],"cameraHint":"front"},
      {"title":"搭建眼睛","description":"装上带眼睛图案的 2×2 积木、薄板和脸部两侧的弧形件。","partIds":[],"cameraHint":"front"},
      {"title":"搭建头角","description":"在眼睛上方叠起左右两根黄橙相间的头角，完成长颈鹿。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 33
  AND l.course_id = 5
  AND l.title = '长颈鹿'
  AND l.lesson_type = 'building_3d';
