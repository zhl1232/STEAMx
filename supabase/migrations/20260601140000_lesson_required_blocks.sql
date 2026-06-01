-- 为「Scratch 少儿编程入门」三课写入「完成课时」的关键积木校验规则。
-- 每条规则满足 anyOf 中任一 opcode 即算达成；门槛保持友好，只挑最能代表本课知识点的关键积木。
DO $$
DECLARE
  v_course_id bigint;
BEGIN
  SELECT id INTO v_course_id FROM public.courses
  WHERE title = 'Scratch 少儿编程入门'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RAISE NOTICE 'Course not found';
    RETURN;
  END IF;

  -- 第一课：动画故事 —— 让角色说话、移动
  UPDATE public.course_lessons
  SET content = jsonb_set(
    COALESCE(content, '{}'::jsonb),
    '{requiredBlocks}',
    '[
      {"label": "说话", "anyOf": ["looks_say", "looks_sayforsecs"]},
      {"label": "移动", "anyOf": ["motion_movesteps"]}
    ]'::jsonb
  )
  WHERE course_id = v_course_id AND title = '动画故事';

  -- 第二课：电子贺卡 —— 循环 + 点击事件
  UPDATE public.course_lessons
  SET content = jsonb_set(
    COALESCE(content, '{}'::jsonb),
    '{requiredBlocks}',
    '[
      {"label": "重复执行", "anyOf": ["control_repeat", "control_forever"]},
      {"label": "当角色被点击", "anyOf": ["event_whenthisspriteclicked"]}
    ]'::jsonb
  )
  WHERE course_id = v_course_id AND title = '电子贺卡';

  -- 第三课：弹球游戏 —— 循环 + 反弹 + 条件 + 变量
  UPDATE public.course_lessons
  SET content = jsonb_set(
    COALESCE(content, '{}'::jsonb),
    '{requiredBlocks}',
    '[
      {"label": "重复执行", "anyOf": ["control_forever", "control_repeat"]},
      {"label": "碰到边缘就反弹", "anyOf": ["motion_ifonedgebounce"]},
      {"label": "如果…那么", "anyOf": ["control_if", "control_if_else"]},
      {"label": "分数变量改变", "anyOf": ["data_changevariableby"]}
    ]'::jsonb
  )
  WHERE course_id = v_course_id AND title = '弹球游戏';

END $$;
