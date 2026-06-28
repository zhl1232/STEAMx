-- 学前大颗粒课程改用自托管 LDraw .mpd 模型，避免 3D 工作区退回抽象方块渲染。
-- 模型源文件位于 scripts/ldraw-models/preschool-*.ldr，打包产物位于 public/courses/ldraw/。
WITH model_updates(title, model_url) AS (
  VALUES
    ('高高塔不倒', '/courses/ldraw/preschool-tower.mpd'),
    ('小车向前跑', '/courses/ldraw/preschool-car.mpd'),
    ('小桥能通过', '/courses/ldraw/preschool-bridge.mpd'),
    ('动物朋友的家', '/courses/ldraw/preschool-house.mpd'),
    ('坡道滚滚球', '/courses/ldraw/preschool-ramp.mpd'),
    ('齿轮朋友转一转', '/courses/ldraw/preschool-gears.mpd'),
    ('跷跷板平不平', '/courses/ldraw/preschool-seesaw.mpd'),
    ('迷宫找路线', '/courses/ldraw/preschool-maze.mpd'),
    ('小花园有规律', '/courses/ldraw/preschool-garden.mpd'),
    ('吊车抬高高', '/courses/ldraw/preschool-crane.mpd'),
    ('旋转小风车', '/courses/ldraw/preschool-windmill.mpd'),
    ('我的积木小乐园', '/courses/ldraw/preschool-park.mpd')
)
UPDATE public.course_lessons AS lesson
SET content = jsonb_set(
  COALESCE(lesson.content, '{}'::jsonb),
  '{building3d}',
  (
    (COALESCE(lesson.content->'building3d', '{}'::jsonb) - 'brickInstances')
    || jsonb_build_object(
      'ldrawModelUrl', model_updates.model_url,
      'ldrawColorUrl', '/courses/ldraw/LDConfig.ldr',
      'attribution', '积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。'
    )
  ),
  true
)
FROM public.courses AS course, model_updates
WHERE lesson.course_id = course.id
  AND course.title = '小小积木工程师：学前大颗粒启蒙'
  AND lesson.title = model_updates.title;
