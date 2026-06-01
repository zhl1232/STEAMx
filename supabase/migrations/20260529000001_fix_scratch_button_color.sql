-- 修正 Scratch 课程中「选择角色」按钮的颜色描述
DO $$
DECLARE
  v_course_id bigint;
  v_lesson_id bigint;
  v_steps jsonb;
BEGIN
  SELECT id INTO v_course_id FROM public.courses
  WHERE title = 'Scratch 少儿编程入门'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RAISE NOTICE 'Course not found';
    RETURN;
  END IF;

  -- 获取「动画故事」课程的 lesson_id 和当前 steps
  SELECT id, steps INTO v_lesson_id, v_steps
  FROM public.course_lessons
  WHERE course_id = v_course_id AND title = '动画故事'
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE NOTICE 'Lesson not found';
    RETURN;
  END IF;

  -- 更新第一步的 hint，将"蓝色"改为"紫色"
  v_steps = jsonb_set(
    v_steps,
    '{0,hint}',
    '"屏幕右下角，舞台下方，有个紫色的「选择角色」按钮（猫咪图标）"'
  );

  -- 应用更新
  UPDATE public.course_lessons
  SET steps = v_steps
  WHERE id = v_lesson_id;

  RAISE NOTICE 'Updated button color description from blue to purple';

END $$;
