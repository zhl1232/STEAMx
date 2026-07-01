-- 3+ 课件100「长颈龙」第 6 步改从反向水平视角展示，避免入口搭建方向看反。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    COALESCE(l.content, '{}'::jsonb),
    '{building3d,steps3d,5,cameraHint}',
    to_jsonb('back'::text),
    false
  ),
  updated_at = now()
WHERE l.id = 32
  AND l.course_id = 5
  AND l.title = '长颈龙'
  AND l.lesson_type = 'building_3d';
