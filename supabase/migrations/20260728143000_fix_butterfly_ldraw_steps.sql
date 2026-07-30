-- The butterfly instruction has 10 construction pages. Page 11 is the BOM and
-- page 12 is a finished-model photo, so neither should appear as a 3D step.
WITH step_copy(step_no, title, description, hint, checklist, camera_hint) AS (
  VALUES
    (1, '搭建蝴蝶 第 1 步', '搭出左右分开的黄色下翼底脚。', '先对齐左右底脚，保持间距对称。', '["左右底脚对称","积木方向一致"]'::jsonb, 'isometric'),
    (2, '搭建蝴蝶 第 2 步', '在底脚上方加入内收的黄色连接层。', '从左右两侧同时向中间收拢。', '["连接层左右对称","上下压紧"]'::jsonb, 'front'),
    (3, '搭建蝴蝶 第 3 步', '扩展黄色下翼，并在中央加入蓝色积木。', '中央蓝色积木要落在对称轴上。', '["下翼展开","中央积木居中"]'::jsonb, 'front'),
    (4, '搭建蝴蝶 第 4 步', '搭建第一层红色身体。', '两块红色积木保持同高。', '["红色身体对称","层面平整"]'::jsonb, 'isometric'),
    (5, '搭建蝴蝶 第 5 步', '扩展红色翅膀，并补上蓝色中心。', '左右红翼与蓝色中心保持一条水平线。', '["红翼左右对称","蓝色中心就位"]'::jsonb, 'front'),
    (6, '搭建蝴蝶 第 6 步', '搭出向两侧展开的红色宽翼。', '先放中间红砖，再检查两端蓝色翼尖。', '["宽翼展开","两端翼尖对称"]'::jsonb, 'front'),
    (7, '搭建蝴蝶 第 7 步', '加入错缝红翼和三块蓝色锁定砖。', '三块蓝色积木要均匀分布。', '["红翼错缝","三处蓝砖压紧"]'::jsonb, 'isometric'),
    (8, '搭建蝴蝶 第 8 步', '搭建第二层红色宽翼。', '对照下方宽翼检查外轮廓。', '["上下宽翼呼应","左右边缘对齐"]'::jsonb, 'front'),
    (9, '搭建蝴蝶 第 9 步', '收窄肩部并搭好头部支撑层。', '中间两块积木要紧贴，给眼睛砖留稳固支撑。', '["肩部收窄","头部支撑稳固"]'::jsonb, 'front'),
    (10, '完成蝴蝶', '安装两块眼睛砖和两级黄色触角，完成蝴蝶。', '眼睛朝前，左右触角高度和张开角度一致。', '["眼睛朝前","触角左右对称","整体结构稳固"]'::jsonb, 'isometric')
),
payload AS (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'title', title,
        'description', description,
        'hint', hint,
        'checklist', checklist
      ) ORDER BY step_no
    ) AS steps,
    jsonb_agg(
      jsonb_build_object(
        'title', title,
        'description', description,
        'partIds', '[]'::jsonb,
        'cameraHint', camera_hint
      ) ORDER BY step_no
    ) AS steps3d
  FROM step_copy
)
UPDATE public.course_lessons AS l
SET
  steps = payload.steps,
  content = jsonb_set(
    COALESCE(l.content, '{}'::jsonb),
    '{building3d,steps3d}',
    payload.steps3d,
    true
  ),
  updated_at = now()
FROM payload
WHERE l.id = 51
  AND l.course_id = 5
  AND l.title = '蝴蝶'
  AND l.lesson_type = 'building_3d';
