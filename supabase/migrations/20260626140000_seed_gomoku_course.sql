-- 五子棋博弈论入门课：把 playground/gomoku 的概念讲解沉淀成「技能课程」。
-- 游戏页面仍保留在 /playground/gomoku，本课作为导学入口出现在 /create 技能课程 Tab。
DO $$
DECLARE
  v_course_id bigint;
BEGIN
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE title = '五子棋博弈论入门'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    INSERT INTO public.courses (
      title, description, image_url, tags, difficulty_stars, status, sort_order, steam_weights
    )
    VALUES (
      '五子棋博弈论入门',
      '用五子棋体验「极小极大算法」与 α-β 剪枝：从规则、棋型到 AI 决策思路，分步讲解 + 游乐场实战。',
      '/projects/tech_3dprint.webp',
      ARRAY['五子棋','博弈论','算法','策略'],
      2,
      'approved',
      30,
      '{"S":10,"T":30,"E":10,"A":10,"M":40}'::jsonb
    )
    RETURNING id INTO v_course_id;
  END IF;

  -- 课时 1：认识棋盘与胜负规则
  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes, steps, resources, content
  )
  SELECT
    v_course_id,
    '认识棋盘与连五规则',
    'playground',
    1,
    15,
    '[
      {"title":"看看 15×15 棋盘","description":"五子棋在 15×15 的格子上落子，黑白两方轮流下，先在横、竖、斜任一方向连成 5 子者获胜。","hint":"注意是连成 5 子，不是 4 子也不是 6 子。"},
      {"title":"观察威胁与机会","description":"每一步既要看自己能不能连成 5，也要看对手下一步会不会连成 5，攻守要同时考虑。","hint":"初学者常只看自己，记得抬头看对手。","checklist":["能说出胜负规则","能识别一步内的活四威胁"]},
      {"title":"到游乐场试一局","description":"打开游乐场的五子棋，选「入门」难度和 AI 对一局，先感受落子与胜负。","hint":"不必追求赢，先把规则走完一遍。"}
    ]'::jsonb,
    '[]'::jsonb,
    '{
      "summary":"建立五子棋的基本规则与胜负判断。",
      "playground":{
        "gameKey":"gomoku",
        "practiceHref":"/playground/gomoku",
        "practiceCta":"去和 AI 下一局"
      }
    }'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons
    WHERE course_id = v_course_id AND title = '认识棋盘与连五规则'
  );

  -- 课时 2：常见棋型与攻防
  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes, steps, resources, content
  )
  SELECT
    v_course_id,
    '活三、冲四与棋型攻防',
    'playground',
    2,
    20,
    '[
      {"title":"认识活三","description":"三颗同色棋子相连且两端都没有被挡住，下一步可以变成活四，威胁很大。","hint":"活三一旦形成，对手通常必须防守。"},
      {"title":"认识冲四","description":"四颗同色棋子排成一排但一端被挡住，只有一种方式可以补成五连，对手不挡就输。","hint":"冲四是「不挡就输」的强威胁。"},
      {"title":"组合威胁","description":"试着同时制造两个活三，或一个活三加一个冲四，让对手挡了这边漏了那边。","hint":"这是中盘常用的双杀思路。","checklist":["能识别活三和冲四","能说出双威胁的思路"]},
      {"title":"到游乐场练一局","description":"切到「进阶」难度，注意自己落子时是不是同时威胁了两条线。","hint":"进阶 AI 会拦截常见战术。"}
    ]'::jsonb,
    '[]'::jsonb,
    '{
      "summary":"识别活三、冲四等关键棋型，理解攻防与组合威胁。",
      "playground":{
        "gameKey":"gomoku",
        "practiceHref":"/playground/gomoku",
        "practiceCta":"去进阶难度练一局"
      }
    }'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons
    WHERE course_id = v_course_id AND title = '活三、冲四与棋型攻防'
  );

  -- 课时 3：极小极大算法与 AI 决策
  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes, steps, resources, content
  )
  SELECT
    v_course_id,
    'AI 是怎么想棋的：极小极大算法',
    'playground',
    3,
    25,
    '[
      {"title":"零和博弈的假设","description":"五子棋是零和博弈：你要赢，AI 就要输。AI 假设你每一步都走最优，自己则挑「最不吃亏」的一步。","hint":"理解这个假设，就能预测 AI 的反应。"},
      {"title":"模拟几步看后果","description":"AI 在每个候选落点假设自己下子，再假设你最优反击，来回模拟 2~3 手，比较哪种局面对自己最有利。","hint":"这就是「极小极大」：自己走时取最大，对手走时取最小。"},
      {"title":"α-β 剪枝加速","description":"搜索时如果发现某条分支已经比已有方案更差，就提前剪掉不再展开，能在 4 层深度内快速完成搜索。","hint":"剪枝不改变最终选择，只是让搜索更快。"},
      {"title":"三档难度差别","description":"入门只做单步评估；进阶 3 层 minimax 能拦常见战术；大师 5 层 + VCF 看得到 10 步外的强制胜负。","hint":"想挑战就选「大师」试试。","checklist":["能说出 minimax 的核心假设","能解释 α-β 剪枝的作用"]},
      {"title":"挑战大师难度","description":"回到游乐场选「大师」难度，观察 AI 的长距离杀招，思考它在「想象」什么局面。","hint":"输了也别灰心，回放每一步想想自己哪步漏算。"}
    ]'::jsonb,
    '[]'::jsonb,
    '{
      "summary":"理解极小极大算法与 α-β 剪枝，看懂 AI 三档难度的差别。",
      "playground":{
        "gameKey":"gomoku",
        "practiceHref":"/playground/gomoku",
        "practiceCta":"挑战大师难度"
      }
    }'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons
    WHERE course_id = v_course_id AND title = 'AI 是怎么想棋的：极小极大算法'
  );
END $$;
