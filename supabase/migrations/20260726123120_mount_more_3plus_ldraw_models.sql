-- Mount the next reviewed 3+ LDraw MPD models onto their course lessons.
-- The MPD files were published in public/courses/ldraw by ad1566a1; this
-- migration wires the Supabase lesson content so the building workspace uses
-- the 3D renderer instead of the legacy slide-only construction pages.

WITH model_updates(lesson_id, lesson_title, model_slug, step_count) AS (
  VALUES
    (46, '购物车', '3-gou-wu-che', 10),
    (49, '柜子', '3-gui-zi', 19),
    (51, '蝴蝶', '3-hu-die', 12),
    (52, '滑滑梯', '3-hua-hua-ti', 10),
    (55, '火箭', '3-huo-jian', 13),
    (56, '急救包', '3-ji-jiu-bao', 9),
    (57, '奖杯', '3-jiang-bei', 11),
    (58, '警车', '3-jing-che', 10),
    (61, '跨海大桥', '3-kua-hai-da-qiao', 10),
    (62, '拉杆箱', '3-la-gan-xiang', 12),
    (67, '凉亭', '3-liang-ting', 18),
    (68, '溜冰鞋', '3-liu-bing-xie', 18),
    (70, '轮船', '3-lun-chuan', 12),
    (71, '马车', '3-ma-che', 11),
    (72, '毛毛虫', '3-mao-mao-chong', 9)
),
lesson_payload AS (
  SELECT
    model_updates.lesson_id,
    model_updates.lesson_title,
    model_updates.model_slug,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'title',
          CASE
            WHEN step_no = model_updates.step_count
              THEN format('完成%s', model_updates.lesson_title)
            ELSE format('搭建%s 第 %s 步', model_updates.lesson_title, step_no)
          END,
          'description',
          CASE
            WHEN step_no = model_updates.step_count
              THEN format('对照 3D 模型检查%s的整体结构、方向和连接是否稳固。', model_updates.lesson_title)
            ELSE format('按照 3D 模型完成%s的第 %s 个搭建步骤。', model_updates.lesson_title, step_no)
          END,
          'partIds',
          '[]'::jsonb,
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
      )
      FROM generate_series(1, model_updates.step_count) AS steps(step_no)
    ) AS steps3d
  FROM model_updates
)
UPDATE public.course_lessons AS l
SET
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
        to_jsonb(format('/courses/ldraw/%s.mpd', lesson_payload.model_slug)),
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
WHERE l.id = lesson_payload.lesson_id
  AND l.course_id = 5
  AND l.title = lesson_payload.lesson_title
  AND l.lesson_type = 'building_3d';
