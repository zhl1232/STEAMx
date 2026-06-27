-- 五子棋课程交互训练题：给已有 playground 课时步骤补充 gomoku_best_move 训练数据。
DO $$
DECLARE
  v_course_id bigint;
BEGIN
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE title = '五子棋博弈论入门'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RAISE NOTICE 'Gomoku course not found, skip training exercise update';
    RETURN;
  END IF;

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    steps,
    '{0,training}',
    $json${
      "type":"gomoku_best_move",
      "prompt":"黑方第一选在哪里？",
      "player":"black",
      "blackStones":[{"r":7,"c":4},{"r":8,"c":6},{"r":8,"c":7}],
      "whiteStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":7,"c":8}],
      "bestMoves":[{"r":7,"c":9,"label":"A","reason":"白方右端下一手可成五，黑方必须先挡。"}],
      "candidateMoves":[
        {"r":7,"c":9,"label":"A","reason":"挡住白方唯一成五点，是当前最高优先级。"},
        {"r":8,"c":8,"label":"B","reason":"能连接黑子，但会漏掉白方立即成五。"},
        {"r":6,"c":6,"label":"C","reason":"靠近战场，却没有解决眼前冲四。"}
      ],
      "explanation":"先看对手有没有一步成五。白方横向四连左端已经被黑子挡住，右端 A 是唯一成五点，黑方第一选必须落在 A。",
      "correctFeedback":"对，先挡成五点",
      "wrongFeedback":"还不是第一选"
    }$json$::jsonb,
    true
  )
  WHERE course_id = v_course_id
    AND title = '防守优先级与堵点选择'
    AND jsonb_array_length(steps) >= 1;

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    steps,
    '{2,training}',
    $json${
      "type":"gomoku_best_move",
      "prompt":"黑方能赢时，第一选是哪一步？",
      "player":"black",
      "blackStones":[{"r":6,"c":5},{"r":6,"c":6},{"r":6,"c":7},{"r":6,"c":8}],
      "whiteStones":[{"r":8,"c":5},{"r":8,"c":6},{"r":8,"c":7}],
      "bestMoves":[{"r":6,"c":4,"label":"A","reason":"这步直接补成五连，立即获胜。"},{"r":6,"c":9,"label":"B","reason":"这步也直接补成五连，立即获胜。"}],
      "candidateMoves":[
        {"r":6,"c":4,"label":"A","reason":"一步成五，优先级最高。"},
        {"r":6,"c":9,"label":"B","reason":"同样一步成五。"},
        {"r":8,"c":8,"label":"C","reason":"防守白方潜在连接，但不如直接获胜。"}
      ],
      "explanation":"我方已经有横向四连，两端 A/B 都能一步成五。能直接赢时，不需要再去防守普通威胁。",
      "correctFeedback":"对，能赢就直接赢",
      "wrongFeedback":"先检查自己有没有一步成五"
    }$json$::jsonb,
    true
  )
  WHERE course_id = v_course_id
    AND title = '防守优先级与堵点选择'
    AND jsonb_array_length(steps) >= 3;

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    steps,
    '{1,training}',
    $json${
      "type":"gomoku_best_move",
      "prompt":"哪一步能一手生成两个活三？",
      "player":"black",
      "blackStones":[{"r":7,"c":6},{"r":7,"c":8},{"r":6,"c":7},{"r":8,"c":7}],
      "whiteStones":[{"r":6,"c":8}],
      "bestMoves":[{"r":7,"c":7,"label":"A","reason":"交叉点落下后，横线和竖线同时形成活三。"}],
      "candidateMoves":[
        {"r":7,"c":7,"label":"A","reason":"同时连接横竖两条线，对手很难一次处理。"},
        {"r":7,"c":5,"label":"B","reason":"只加强横线，没有形成双威胁。"},
        {"r":5,"c":7,"label":"C","reason":"只加强竖线，威胁数量不够。"}
      ],
      "explanation":"双威胁要找交叉点。A 同时补上横向和纵向的缺口，一手制造两个活三，对手只能先处理其中一边。",
      "correctFeedback":"对，这就是双三交叉点",
      "wrongFeedback":"这步没有同时威胁两条线"
    }$json$::jsonb,
    true
  )
  WHERE course_id = v_course_id
    AND title = '双威胁：双三、四三、双四'
    AND jsonb_array_length(steps) >= 2;

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    steps,
    '{3,training}',
    $json${
      "type":"gomoku_best_move",
      "prompt":"哪一步能形成双四？",
      "player":"black",
      "blackStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":8},{"r":5,"c":7},{"r":6,"c":7},{"r":8,"c":7}],
      "whiteStones":[],
      "bestMoves":[{"r":7,"c":7,"label":"A","reason":"落在交叉点后，横线和竖线同时成为四。"}],
      "candidateMoves":[
        {"r":7,"c":7,"label":"A","reason":"双四几乎挡不完，是当前第一选。"},
        {"r":7,"c":9,"label":"B","reason":"只补横线，威胁变少。"},
        {"r":9,"c":7,"label":"C","reason":"只补竖线，威胁变少。"}
      ],
      "explanation":"A 是横线和竖线共同的缺口。落下后，两条线都形成四，对手挡一条会漏另一条。",
      "correctFeedback":"对，交叉点形成双四",
      "wrongFeedback":"再找能同时影响两条线的点"
    }$json$::jsonb,
    true
  )
  WHERE course_id = v_course_id
    AND title = '双威胁：双三、四三、双四'
    AND jsonb_array_length(steps) >= 4;

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    steps,
    '{1,training}',
    $json${
      "type":"gomoku_best_move",
      "prompt":"黑方 VCF 的起手在哪里？",
      "player":"black",
      "blackStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":6,"c":8},{"r":8,"c":8},{"r":9,"c":8}],
      "whiteStones":[{"r":6,"c":6},{"r":8,"c":6},{"r":7,"c":9}],
      "bestMoves":[{"r":7,"c":8,"label":"1","reason":"先制造横向冲四，迫使白方回应。"}],
      "candidateMoves":[
        {"r":7,"c":8,"label":"1","reason":"强制应手起点，对手不能无视。"},
        {"r":10,"c":8,"label":"2","reason":"后续可能继续冲四，但当前应先逼出横向防守。"},
        {"r":6,"c":7,"label":"3","reason":"局部连接，但不形成强制应手。"}
      ],
      "explanation":"VCF 要优先找能立刻制造冲四的手。黑 1 落在横线缺口后，白方必须处理，否则黑方下一手成五。",
      "correctFeedback":"对，先用冲四逼应",
      "wrongFeedback":"VCF 起手要先制造必须回应的四"
    }$json$::jsonb,
    true
  )
  WHERE course_id = v_course_id
    AND title = 'VCF 与 VCT：连续威胁读棋'
    AND jsonb_array_length(steps) >= 2;

  UPDATE public.course_lessons
  SET steps = jsonb_set(
    steps,
    '{4,training}',
    $json${
      "type":"gomoku_best_move",
      "prompt":"按 AI 检查表，黑方第一选是哪步？",
      "player":"black",
      "blackStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":9,"c":6},{"r":9,"c":7}],
      "whiteStones":[{"r":6,"c":7},{"r":8,"c":8},{"r":10,"c":5}],
      "bestMoves":[{"r":7,"c":8,"label":"A","reason":"补成冲四，制造最高优先级威胁。"}],
      "candidateMoves":[
        {"r":7,"c":8,"label":"A","reason":"形成冲四，对手必须防守。"},
        {"r":9,"c":8,"label":"B","reason":"扩展活二，但威胁强度低于冲四。"},
        {"r":8,"c":7,"label":"C","reason":"靠近中心，但没有立即制造强威胁。"}
      ],
      "explanation":"AI 会先找强威胁。A 把横线变成冲四，迫使对手处理；B/C 只是普通连接，评分低一档。",
      "correctFeedback":"对，先制造强威胁",
      "wrongFeedback":"按检查表先找四和活三"
    }$json$::jsonb,
    true
  )
  WHERE course_id = v_course_id
    AND title = 'AI 是怎么想棋的：评估函数与搜索'
    AND jsonb_array_length(steps) >= 5;
END $$;
