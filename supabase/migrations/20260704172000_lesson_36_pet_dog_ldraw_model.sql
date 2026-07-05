-- 3+ 课件100「宠物狗」补挂自托管 LDraw 模型。
-- 模型源：scripts/ldraw-models/3-chong-wu-gou.ldr
-- 打包产物：public/courses/ldraw/3-chong-wu-gou.mpd

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      COALESCE(l.content, '{}'::jsonb),
      '{building3d,ldrawModelUrl}',
      to_jsonb('/courses/ldraw/3-chong-wu-gou.mpd'::text),
      true
    ),
    '{building3d,ldrawColorUrl}',
    to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
    true
  ),
  updated_at = now()
WHERE l.id = 36
  AND l.course_id = 5
  AND l.title = '宠物狗'
  AND l.lesson_type = 'building_3d';
