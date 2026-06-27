-- 五子棋前两课文案去重：第 1 课只讲规则定位，第 2 课专讲开局候选点。
DO $$
DECLARE
  v_course_id bigint;
BEGIN
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE title = '五子棋博弈论入门'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RAISE NOTICE 'Gomoku course not found, skip opening copy deduplicate update';
    RETURN;
  END IF;

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    steps,
    '{0,hint}',
    to_jsonb('先找到棋盘中心的天元，记住它只是定位点。'::text),
    false
  )
  WHERE course_id = v_course_id
    AND title = '认识棋盘与连五规则'
    AND jsonb_typeof(steps) = 'array'
    AND jsonb_array_length(steps) >= 1;

  UPDATE public.course_lessons
  SET content = COALESCE(content, '{}'::jsonb) || jsonb_build_object(
    'summary',
    '把先手优势转成可比较的开局候选点。'
  )
  WHERE course_id = v_course_id
    AND title = '开局与先手优势';

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          steps,
          '{2,title}',
          to_jsonb('什么时候可以贴边'::text),
          false
        ),
        '{2,description}',
        to_jsonb('贴边不是禁手。只有在能立刻防住对手、补成四，或制造明确威胁时，边线落点才值得优先考虑。'::text),
        false
      ),
      '{2,hint}',
      to_jsonb('判断贴边点时先问：这步有没有马上解决问题？如果只是靠近边角，就先放后面。'::text),
      false
    ),
    '{2,checklist}',
    '["能说出一个贴边有用的理由","能把普通边角点放到候选点后面"]'::jsonb,
    true
  )
  WHERE course_id = v_course_id
    AND title = '开局与先手优势'
    AND jsonb_typeof(steps) = 'array'
    AND jsonb_array_length(steps) >= 3;
END $$;
