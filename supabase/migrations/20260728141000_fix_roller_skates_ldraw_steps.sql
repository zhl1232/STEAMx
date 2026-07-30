-- Replace the stale pavilion-derived step list with the 13 steps in the
-- user-confirmed 150-piece Roller Skates Studio model.
WITH lesson_payload AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'title',
      CASE
        WHEN step_no = 13 THEN '完成溜冰鞋'
        ELSE format('搭建溜冰鞋 第 %s 步', step_no)
      END,
      'description',
      CASE
        WHEN step_no = 13
          THEN '对照 3D 模型检查溜冰鞋的整体结构、方向和连接是否稳固。'
        ELSE format('按照 3D 模型完成溜冰鞋的第 %s 个搭建步骤。', step_no)
      END,
      'partIds', '[]'::jsonb,
      'cameraHint',
      CASE (step_no - 1) % 5
        WHEN 0 THEN 'isometric'
        WHEN 1 THEN 'front'
        WHEN 2 THEN 'side'
        WHEN 3 THEN 'top'
        ELSE 'isometric'
      END
    )
    ORDER BY step_no
  ) AS steps3d
  FROM generate_series(1, 13) AS steps(step_no)
)
UPDATE public.course_lessons
SET
  content = jsonb_set(
    jsonb_set(
      COALESCE(content, '{}'::jsonb),
      '{building3d,ldrawModelUrl}',
      to_jsonb('/courses/ldraw/3-liu-bing-xie.mpd'::text),
      true
    ),
    '{building3d,steps3d}',
    lesson_payload.steps3d,
    true
  ),
  updated_at = now()
FROM lesson_payload
WHERE id = 68
  AND course_id = 5
  AND title = '溜冰鞋'
  AND lesson_type = 'building_3d';
