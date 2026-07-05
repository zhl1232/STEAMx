-- 3+ 课件100「电话机」补挂自托管 LDraw 模型，steps3d 对齐 7 个 0 STEP。
-- 模型源：scripts/ldraw-models/duplo_telephone_steps.ldr
-- 打包产物：public/courses/ldraw/duplo_telephone_steps.mpd。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(l.content, '{}'::jsonb),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/duplo_telephone_steps.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"搭建电话机底座","description":"先搭好电话机底部平台和左右支撑，确定整体宽度。","partIds":[],"cameraHint":"isometric"},
      {"title":"围出机身外框","description":"沿底座继续叠砖，形成电话机主体外框。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建按键区域","description":"在机身上方排布小砖块，做出电话按键区域。","partIds":[],"cameraHint":"top"},
      {"title":"安装拨号装饰","description":"在机身正面装上圆形或装饰件，表现电话拨号区域。","partIds":[],"cameraHint":"front"},
      {"title":"补齐机身细节","description":"继续补上两侧和正面的砖块，让电话机轮廓更完整。","partIds":[],"cameraHint":"isometric"},
      {"title":"安装听筒支点","description":"在电话机上方搭出听筒支撑位置。","partIds":[],"cameraHint":"front"},
      {"title":"连接电话听筒","description":"最后用直管和弯管组成听筒，放到机身上方并检查连接是否稳固。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 41
  AND l.course_id = 5
  AND l.title = '电话机'
  AND l.lesson_type = 'building_3d';
