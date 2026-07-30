-- The animation object is present in OSS and belongs on PPT page 5. The lesson
-- lost both fields during its LDraw-specific updates, leaving flow step 3 as a
-- static slide instead of the inline video player.
UPDATE public.course_lessons AS l
SET
  content = jsonb_set(
    jsonb_set(
      COALESCE(l.content, '{}'::jsonb),
      '{building3d,videoUrl}',
      to_jsonb('https://assets.steamx.cc/courses/3-chang-jing-long/animation.mp4'::text),
      true
    ),
    '{building3d,videoSlideIndex}',
    '5'::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 32
  AND l.course_id = 5
  AND l.title = '长颈龙'
  AND l.lesson_type = 'building_3d';
