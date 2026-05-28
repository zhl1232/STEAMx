-- 首期 Scratch 少儿编程训练营种子数据
DO $$
DECLARE
  v_course_id bigint;
BEGIN
  SELECT id INTO v_course_id FROM public.courses
  WHERE title = 'Scratch 少儿编程入门'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    INSERT INTO public.courses (
      title,
      description,
      image_url,
      tags,
      difficulty_stars,
      status,
      sort_order,
      steam_weights
    ) VALUES (
      'Scratch 少儿编程入门',
      '从零开始学习 Scratch 图形化编程：动画故事、电子贺卡与简单游戏。每课配有分步引导，在浏览器中直接创作并保存作品。',
      '/projects/tech_programming.webp',
      ARRAY['Scratch', '编程', '技术', '少儿'],
      1,
      'approved',
      0,
      '{"S":5,"T":35,"E":5,"A":15,"M":15}'::jsonb
    )
    RETURNING id INTO v_course_id;
  END IF;

  IF v_course_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes,
    steps, resources, content
  )
  SELECT v_course_id, '动画故事', 'scratch', 1, 40,
    '[
      {"title":"构思故事","description":"在纸上画出分镜：主角、情节、有几个场景。","hint":"先想故事再拖积木"},
      {"title":"搭建舞台","description":"选择或绘制背景，从角色库添加主角。","hint":"点「选择角色」"},
      {"title":"让角色动起来","description":"用移动、切换造型、说积木让角色表演。","hint":"从「事件」里拖「当绿旗被点击」"},
      {"title":"场景切换","description":"用广播或切换背景实现多场景。","hint":"试试「广播消息」"},
      {"title":"加入声音","description":"添加背景音乐或配音。","hint":"打开声音库或录音"},
      {"title":"保存作品","description":"点击「保存到课程」提交本课作品。","hint":"记得保存后再点完成课时"}
    ]'::jsonb,
    '[{"title":"Scratch 积木参考","url":"https://scratch.mit.edu/projects/editor/?tutorial=all","type":"link"}]'::jsonb,
    '{"summary":"创作一段有趣的动画故事，学习顺序执行与事件。"}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons
    WHERE course_id = v_course_id AND title = '动画故事'
  );

  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes,
    steps, resources, content
  )
  SELECT v_course_id, '电子贺卡', 'scratch', 2, 35,
    '[
      {"title":"确定主题","description":"生日、节日或感恩——想好贺卡主题。","hint":""},
      {"title":"绘制背景","description":"用绘图工具画装饰和祝福文字。","hint":""},
      {"title":"互动元素","description":"让气球、蛋糕等角色旋转或变色。","hint":"用「重复执行」和「外观」"},
      {"title":"点击效果","description":"点击元素时播放音乐或弹出祝福语。","hint":"「当角色被点击」"},
      {"title":"保存并分享","description":"保存到课程，可下载 .sb3 给家人看。","hint":""}
    ]'::jsonb,
    '[]'::jsonb,
    '{"summary":"制作会动、会说话的电子贺卡。"}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons
    WHERE course_id = v_course_id AND title = '电子贺卡'
  );

  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes,
    steps, resources, content
  )
  SELECT v_course_id, '弹球游戏', 'scratch', 3, 45,
    '[
      {"title":"设计球场","description":"绘制或选择背景，添加挡板与球角色。","hint":""},
      {"title":"球的运动","description":"让球移动并在边缘反弹。","hint":"移动 + 碰到边缘就反弹"},
      {"title":"挡板控制","description":"用方向键控制挡板左右移动。","hint":""},
      {"title":"得分与结束","description":"用变量记录分数，球落地时游戏结束。","hint":"变量在「变量」分类"},
      {"title":"保存作品","description":"保存到课程并标记完成。","hint":""}
    ]'::jsonb,
    '[]'::jsonb,
    '{"summary":"综合运用运动、碰撞与变量完成小游戏。"}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons
    WHERE course_id = v_course_id AND title = '弹球游戏'
  );

END $$;
