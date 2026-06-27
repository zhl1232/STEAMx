-- 五子棋课程内容减噪：补分层、前置轻量训练题，并收敛重复实战/禁手文案。
DO $$
DECLARE
  v_course_id bigint;
BEGIN
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE title = '五子棋博弈论入门'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RAISE NOTICE 'Gomoku course not found, skip content polish update';
    RETURN;
  END IF;

  UPDATE public.course_lessons AS cl
  SET content = COALESCE(cl.content, '{}'::jsonb) || jsonb_build_object(
    'track',
    CASE
      WHEN cl.title IN ('认识棋盘与连五规则', '开局与先手优势', '关键棋型：活二、活三、冲四、活四', '防守优先级与堵点选择') THEN 'foundation'
      WHEN cl.title IN ('双威胁：双三、四三、双四', 'VCF 与 VCT：连续威胁读棋') THEN 'tactics'
      WHEN cl.title = 'AI 是怎么想棋的：评估函数与搜索' THEN 'ai'
      WHEN cl.title = '实战复盘：从入门到高手的训练清单' THEN 'review'
    END,
    'levelLabel',
    CASE
      WHEN cl.title IN ('认识棋盘与连五规则', '开局与先手优势', '关键棋型：活二、活三、冲四、活四', '防守优先级与堵点选择') THEN '基础必学'
      WHEN cl.title IN ('双威胁：双三、四三、双四', 'VCF 与 VCT：连续威胁读棋') THEN '战术进阶'
      WHEN cl.title = 'AI 是怎么想棋的：评估函数与搜索' THEN 'AI 原理'
      WHEN cl.title = '实战复盘：从入门到高手的训练清单' THEN '复盘训练'
    END
  )
  WHERE cl.course_id = v_course_id
    AND cl.title IN (
      '认识棋盘与连五规则',
      '开局与先手优势',
      '关键棋型：活二、活三、冲四、活四',
      '防守优先级与堵点选择',
      '双威胁：双三、四三、双四',
      'VCF 与 VCT：连续威胁读棋',
      'AI 是怎么想棋的：评估函数与搜索',
      '实战复盘：从入门到高手的训练清单'
    );

  UPDATE public.course_lessons AS cl
  SET content = COALESCE(cl.content, '{}'::jsonb) || jsonb_build_object(
    'summary',
    CASE cl.title
      WHEN '认识棋盘与连五规则' THEN '会判断横、竖、斜四个方向的五连，并完成一局入门练习。'
      WHEN '开局与先手优势' THEN '会在中心附近找候选点，让前几手保持连接。'
      WHEN '关键棋型：活二、活三、冲四、活四' THEN '会区分活二、活三、冲四、活四，并指出关键成五点。'
      WHEN '防守优先级与堵点选择' THEN '会按“先赢、再挡、再反击”的顺序选择防守点。'
      WHEN '双威胁：双三、四三、双四' THEN '会找双三、四三、双四的交叉点，理解一手制造两条威胁。'
      WHEN 'VCF 与 VCT：连续威胁读棋' THEN '会读 2 到 3 手连续强制应手，区分 VCF 和 VCT。'
      WHEN 'AI 是怎么想棋的：评估函数与搜索' THEN '会用 AI 检查表比较候选点，理解评估函数和搜索层数。'
      WHEN '实战复盘：从入门到高手的训练清单' THEN '会用 5 秒检查和三类错误复盘一局。'
    END
  )
  WHERE cl.course_id = v_course_id
    AND cl.title IN (
      '认识棋盘与连五规则',
      '开局与先手优势',
      '关键棋型：活二、活三、冲四、活四',
      '防守优先级与堵点选择',
      '双威胁：双三、四三、双四',
      'VCF 与 VCT：连续威胁读棋',
      'AI 是怎么想棋的：评估函数与搜索',
      '实战复盘：从入门到高手的训练清单'
    );

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          steps,
          '{0,hint}',
          to_jsonb('练习时从天元出发，分别沿横、竖、两条斜线各数几个交点。'::text),
          false
        ),
        '{2,description}',
        to_jsonb('本站先练自由五子棋：长连会判胜，暂不启用连珠禁手。'::text),
        false
      ),
      '{2,hint}',
      to_jsonb('三三、四四、长连放到最后一课作为拓展。'::text),
      false
    ),
    '{3,description}',
    to_jsonb('目标：每一步先看自己四个方向，再看对手四个方向。'::text),
    false
  )
  WHERE course_id = v_course_id
    AND title = '认识棋盘与连五规则'
    AND jsonb_array_length(steps) >= 4;

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    steps,
    '{3,description}',
    to_jsonb('每手先找 3 个靠近已有棋子的候选点，再选最能连接、堵点或制造威胁的一手。'::text),
    false
  )
  WHERE course_id = v_course_id
    AND title = '开局与先手优势'
    AND jsonb_array_length(steps) >= 4;

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    steps,
    '{1,hint}',
    to_jsonb('本站先按自由五子棋练，双三可以当作正常战术。'::text),
    false
  )
  WHERE course_id = v_course_id
    AND title = '双威胁：双三、四三、双四'
    AND jsonb_array_length(steps) >= 2;

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    steps,
    '{1,training}',
    $json${
      "type":"gomoku_best_move",
      "prompt":"黑方哪一步能立刻连成五子？",
      "player":"black",
      "blackStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":7,"c":8}],
      "whiteStones":[{"r":7,"c":4},{"r":5,"c":7}],
      "bestMoves":[{"r":7,"c":9,"label":"A","reason":"补在右端后，黑方横向正好连成五子。"}],
      "candidateMoves":[
        {"r":7,"c":9,"label":"A","reason":"直接补成横向五连，立即获胜。"},
        {"r":6,"c":8,"label":"B","reason":"靠近黑子，但没有形成五连。"},
        {"r":8,"c":7,"label":"C","reason":"能连接中心附近，却错过立即获胜。"}
      ],
      "explanation":"判断胜负先沿横、竖、两条斜线数同色棋子。这里黑方横线左端被白子挡住，右端 A 是唯一能补成五连的位置。",
      "correctFeedback":"对，横向五连",
      "wrongFeedback":"先沿横线数一数"
    }$json$::jsonb,
    true
  )
  WHERE course_id = v_course_id
    AND title = '认识棋盘与连五规则'
    AND jsonb_array_length(steps) >= 2;

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    steps,
    '{1,training}',
    $json${
      "type":"gomoku_best_move",
      "prompt":"黑方第二手下哪里更灵活？",
      "player":"black",
      "blackStones":[{"r":7,"c":7}],
      "whiteStones":[{"r":8,"c":7}],
      "bestMoves":[{"r":7,"c":8,"label":"A","reason":"贴着中心黑子延展，横线和斜线都还有发展空间。"}],
      "candidateMoves":[
        {"r":7,"c":8,"label":"A","reason":"保持连接，后续可向多条线发展。"},
        {"r":0,"c":0,"label":"B","reason":"太早贴角，发展方向少，也离主战场太远。"},
        {"r":12,"c":12,"label":"C","reason":"远离已有棋子，暂时帮不上中心战场。"}
      ],
      "explanation":"开局先让棋子互相照应。A 靠近天元和已有黑子，能继续形成活二、活三；角落或远点会让先手优势断掉。",
      "correctFeedback":"对，先保持连接",
      "wrongFeedback":"开局优先靠近中心和已有棋子"
    }$json$::jsonb,
    true
  )
  WHERE course_id = v_course_id
    AND title = '开局与先手优势'
    AND jsonb_array_length(steps) >= 2;
END $$;
