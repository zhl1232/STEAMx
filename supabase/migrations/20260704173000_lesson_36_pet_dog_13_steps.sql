-- 3+ 课件100「宠物狗」步骤数对齐 LDraw 模型内 13 个有效 0 STEP 段。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    COALESCE(l.content, '{}'::jsonb),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"搭建第 1 步","description":"按图纸放好宠物狗主体的第一组积木。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建第 2 步","description":"继续叠加身体结构，注意左右位置对齐。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建第 3 步","description":"加入身体上方的连接件，稳固主体。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建第 4 步","description":"补上背部和头部连接处的积木。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建第 5 步","description":"继续完善头部和身体之间的过渡。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建第 6 步","description":"搭出头部基础轮廓。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建第 7 步","description":"继续加高头部，检查正反方向。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建第 8 步","description":"完成头部表情和顶部结构。","partIds":[],"cameraHint":"front"},
      {"title":"搭建第 9 步","description":"开始搭建食盆底部。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建第 10 步","description":"围出食盆外框。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建第 11 步","description":"继续加高食盆边缘。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建第 12 步","description":"补齐食盆侧边结构。","partIds":[],"cameraHint":"isometric"},
      {"title":"完成检查","description":"宠物狗和食盆搭建完成，对照成品图检查一遍。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 36
  AND l.course_id = 5
  AND l.title = '宠物狗'
  AND l.lesson_type = 'building_3d';
