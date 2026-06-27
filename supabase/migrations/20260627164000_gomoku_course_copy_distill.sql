-- 五子棋课程首课文案再减噪：拆分首屏信息职责，并把实战观察放到最后一步。
DO $$
DECLARE
  v_course_id bigint;
BEGIN
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE title = '五子棋博弈论入门'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RAISE NOTICE 'Gomoku course not found, skip copy distill update';
    RETURN;
  END IF;

  UPDATE public.course_lessons
  SET content = COALESCE(content, '{}'::jsonb) || jsonb_build_object(
    'summary',
    '学会落子顺序和胜负判定，最后完成一局入门练习。'
  )
  WHERE course_id = v_course_id
    AND title = '认识棋盘与连五规则';

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                steps,
                '{0,description}',
                to_jsonb('棋子落在交点上。黑方先手，双方轮流下一子。'::text),
                false
              ),
              '{0,hint}',
              to_jsonb('先找到棋盘中心的天元；第一局从中心附近开始观察。'::text),
              false
            ),
            '{0,checklist}',
            '["知道棋子落在交点上","知道黑先白后轮流落子"]'::jsonb,
            false
          ),
          '{0,visuals,0,caption}',
          to_jsonb('中心点是天元'::text),
          false
        ),
        '{1,description}',
        to_jsonb('五连有四个方向：横、竖、左上到右下、右上到左下。任一方向先连成 5 子就获胜。'::text),
        false
      ),
      '{1,hint}',
      to_jsonb('每落一子，只检查经过这颗棋子的四条线。'::text),
      false
    ),
    '{3,hint}',
    to_jsonb('第一局结束后，记下一次关键防守或漏防。'::text),
    false
  )
  WHERE course_id = v_course_id
    AND title = '认识棋盘与连五规则'
    AND jsonb_typeof(steps) = 'array'
    AND jsonb_array_length(steps) >= 4;
END $$;
