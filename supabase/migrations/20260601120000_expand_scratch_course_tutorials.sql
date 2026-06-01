-- 完善 Scratch 训练营：扩充课时 + 每课对齐 Scratch 内置官方教程 + 步骤可视化
-- 1) content.tutorialDeckId 记录对应官方教程 deck id，「教程」按钮据此按课直达官方中文图文教程。
-- 2) 步骤文案用标记 [[cat:x]] / [[block:x|文字]]，前端渲染为 Scratch 配色的分类圆点与积木块，
--    分类英文 key 统一映射中文名（motion=运动、looks=外观…），避免文案再写错分类名。
-- deck id 与中文分类名均已在 scratch-gui bundle 校验。
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

  -- 课程简介更新为更完整的进阶路径
  UPDATE public.courses
  SET description = '从零开始玩转 Scratch 图形化编程：从让小猫动起来，到动画故事、电子贺卡，再到追逐、弹球、飞行小游戏和音乐创作。每课配分步引导，并可一键打开对应的官方图文教程，在浏览器里直接创作并保存作品。'
  WHERE id = v_course_id;

  -- ===========================================================================
  -- 现有 3 课：补 tutorialDeckId、重排顺序，并把步骤重写为可视化标记
  -- ===========================================================================

  -- [2] 动画故事 —— tell-a-story
  UPDATE public.course_lessons
  SET sort_order = 2,
      content = jsonb_set(COALESCE(content, '{}'::jsonb), '{tutorialDeckId}', '"tell-a-story"'),
      steps = '[
        {"title":"选择角色","description":"点右下角的「选择角色」按钮（猫咪图标），给故事选个主角。","hint":"屏幕右下角、舞台下方的紫色按钮"},
        {"title":"让角色说话","description":"点 [[cat:looks]]，把 [[block:looks|说 你好！持续 2 秒]] 拖到右边。","hint":"找气泡形状的积木"},
        {"title":"点绿旗试试","description":"点舞台正上方的绿色旗子，看角色会不会说话。","hint":"绿旗运行，红色按钮停止"},
        {"title":"让角色动起来","description":"从 [[cat:motion]] 拖一个 [[block:motion|移动 10 步]]，接在说话积木下面。","hint":"积木像拼图，对准凹槽自动吸附"},
        {"title":"换个背景","description":"点右下角的「选择背景」按钮（风景图标），选一个喜欢的背景。","hint":"在舞台下方右侧"},
        {"title":"加入第二个角色","description":"再点一次「选择角色」，添加第二个角色到舞台上。","hint":"动物、人物都行"},
        {"title":"让第二个角色也动","description":"点舞台上第二个角色把它选中，给它也拼 [[block:looks|说 你好！]] 或 [[block:motion|移动 10 步]]。","hint":"先点舞台上的角色，右边积木区会切换到它"},
        {"title":"保存作品","description":"点上方「保存到课程」保存，再点「完成课时」。","hint":"给作品起个名字"}
      ]'::jsonb
  WHERE course_id = v_course_id AND title = '动画故事';

  -- [3] 电子贺卡 —— animate-a-name
  UPDATE public.course_lessons
  SET sort_order = 3,
      content = jsonb_set(COALESCE(content, '{}'::jsonb), '{tutorialDeckId}', '"animate-a-name"'),
      steps = '[
        {"title":"确定贺卡主题","description":"想好做生日、节日还是感谢卡，先在纸上画个草图。","hint":"生日蛋糕、新年烟花都行"},
        {"title":"选择或绘制背景","description":"点「选择背景」选一个，或点「绘制」自己画。","hint":"旁边的画笔图标可以自己画"},
        {"title":"添加装饰角色","description":"添加 2-3 个装饰角色（气球、蛋糕、花等）。","hint":"搜 balloon、cake、flower"},
        {"title":"让装饰动起来","description":"选中一个角色，用 [[cat:control]] 的 [[block:control|重复执行 10 次]] 包住 [[cat:looks]] 的 [[block:looks|将颜色特效增加 25]]。","hint":"重复执行是 C 形积木，把其它积木放进它的口里"},
        {"title":"添加点击互动","description":"从 [[cat:events]] 拖 [[block:events|当角色被点击]]，下面接 [[cat:sound]] 的 [[block:sound|播放声音]]。","hint":"帽子积木另起一列"},
        {"title":"写祝福语","description":"用 [[cat:looks]] 的 [[block:looks|说 生日快乐！]] 让角色说出祝福。","hint":"点积木上的文字可以改内容"},
        {"title":"保存并测试","description":"点绿旗试试，点击各个角色看效果，满意后点「保存到课程」再点「完成课时」。","hint":"起个好听的名字"}
      ]'::jsonb
  WHERE course_id = v_course_id AND title = '电子贺卡';

  -- [6] 弹球游戏 —— pong-game
  UPDATE public.course_lessons
  SET sort_order = 6,
      content = jsonb_set(COALESCE(content, '{}'::jsonb), '{tutorialDeckId}', '"pong-game"'),
      steps = '[
        {"title":"准备角色和背景","description":"删除小猫，添加 Ball（球）和 Paddle（挡板）角色，选个简单背景。","hint":"右键点角色可删除；搜 ball、paddle"},
        {"title":"让球移动","description":"给球拼 [[block:events|当绿旗被点击]] → [[cat:motion]] [[block:motion|移到 x:0 y:0]] → [[block:motion|面向 45 方向]] → [[cat:control]] [[block:control|重复执行]] → [[block:motion|移动 5 步]]。","hint":"要选无限循环的「重复执行」"},
        {"title":"让球反弹","description":"在 [[block:control|重复执行]] 里、[[block:motion|移动 5 步]] 下面加 [[block:motion|碰到边缘就反弹]]。","hint":"运动分类最下面"},
        {"title":"控制挡板移动","description":"挡板拼 [[block:events|当绿旗被点击]] → [[block:motion|移到 x:0 y:-130]] → [[block:control|重复执行]] → [[block:control|如果…那么]] 里放 [[cat:sensing]] [[block:sensing|按下 ← 键？]]，成立就 [[block:motion|将 x 坐标增加 -10]]。","hint":"侦测里找按键积木"},
        {"title":"添加右键控制","description":"在挡板的重复里再加一个 [[block:control|如果…那么]] [[block:sensing|按下 → 键？]] → [[block:motion|将 x 坐标增加 10]]。","hint":"右键复制上一个「如果」改一下即可"},
        {"title":"创建分数变量","description":"点 [[cat:variables]] 的「建立一个变量」，命名为「分数」。","hint":"变量分类在最下面"},
        {"title":"碰到挡板加分","description":"球的重复里加 [[block:control|如果…那么]] [[block:sensing|碰到 Paddle？]] → [[block:variables|将 分数 增加 1]] 和 [[block:motion|面向 (180 - 方向) 方向]] 反弹。","hint":"用 [[cat:operators]] 的减法拼出 180-方向"},
        {"title":"球落地游戏结束","description":"球的重复里加 [[block:control|如果…那么]] [[cat:operators]] [[block:operators|y 坐标 < -160]] → [[block:control|停止 全部]]。","hint":"运算里找 < ；运动里找 y 坐标"},
        {"title":"测试和保存","description":"点绿旗多玩几次，调整球速和挡板速度，满意后「保存到课程」「完成课时」。","hint":"改移动步数可调难度"}
      ]'::jsonb
  WHERE course_id = v_course_id AND title = '弹球游戏';

  -- ===========================================================================
  -- 新增课时（幂等：仅当同名课时不存在时插入）
  -- ===========================================================================

  -- [1] 认识 Scratch —— intro-move-sayhello
  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes, steps, resources, content
  )
  SELECT v_course_id, '认识 Scratch', 'scratch', 1, 25,
    '[
      {"title":"认识舞台和小猫","description":"右边白色区域是「舞台」，上面的小猫就是我们要指挥的角色，中间一大片就是放积木的地方。","hint":"先认识界面，再开始拼积木"},
      {"title":"让小猫动一动","description":"点左侧 [[cat:motion]]，把 [[block:motion|移动 10 步]] 拖到右边，点一下它，看小猫往前走。","hint":"点积木本身就能立刻试效果"},
      {"title":"让小猫说话","description":"点 [[cat:looks]]，把 [[block:looks|说 你好！持续 2 秒]] 拼到 [[block:motion|移动 10 步]] 下面。","hint":"两块积木对准凹槽会自动吸在一起"},
      {"title":"加一顶开始帽子","description":"点 [[cat:events]]，把 [[block:events|当绿旗被点击]] 拖到最上面，盖在两块积木上。","hint":"帽子形状的积木只能放最顶上"},
      {"title":"点绿旗运行","description":"点舞台正上方的绿色旗子，看小猫走一步又说话。","hint":"旁边红色按钮是停止"},
      {"title":"保存作品","description":"点上方「保存到课程」保存，再点「完成课时」。","hint":"先保存，再点完成才算过关"}
    ]'::jsonb,
    '[]'::jsonb,
    '{"summary":"第一次见面！让小猫动起来、说句话，认识 Scratch 的舞台和积木。","tutorialDeckId":"intro-move-sayhello"}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons WHERE course_id = v_course_id AND title = '认识 Scratch'
  );

  -- [4] 想象世界 —— imagine
  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes, steps, resources, content
  )
  SELECT v_course_id, '想象世界', 'scratch', 4, 40,
    '[
      {"title":"选一个想去的地方","description":"点右下角「选择背景」，挑一个场景——太空、海底、城堡都行。","hint":"想去哪就选哪，这是你的世界"},
      {"title":"加入主角","description":"点「选择角色」，添加一个你喜欢的角色当主角。","hint":"动物、人物、物品都可以"},
      {"title":"出场说句话","description":"[[cat:events]] 的 [[block:events|当绿旗被点击]] → [[cat:looks]] 的 [[block:looks|说 出发啦！]]，让主角一开始就打招呼。","hint":"帽子积木在最上面"},
      {"title":"飞来飞去","description":"用 [[cat:control]] 的 [[block:control|重复执行]] 包住 [[cat:motion]] 的 [[block:motion|移动 10 步]] 和 [[block:motion|碰到边缘就反弹]]，让它满屏跑。","hint":"把动作放进 C 形积木的口里"},
      {"title":"变大变小或换造型","description":"在重复里加 [[cat:looks]] 的 [[block:looks|将大小增加 10]]、[[block:looks|下一个造型]]，做出动起来的感觉。","hint":"换造型能让角色像在动"},
      {"title":"加点声音","description":"用 [[cat:sound]] 的 [[block:sound|播放声音]]，或自己录一段，让世界有声响。","hint":"声音库在外观旁边"},
      {"title":"切换场景","description":"再选一个背景，用 [[cat:looks]] 的 [[block:looks|换成 背景2]] 切到新场景。","hint":"可以做出穿越的效果"},
      {"title":"保存作品","description":"点上方「保存到课程」保存，再点「完成课时」。","hint":"给你的想象世界起个名字"}
    ]'::jsonb,
    '[]'::jsonb,
    '{"summary":"放飞想象：选场景、加角色，让它飞、变身、发声，创造属于你的小世界。","tutorialDeckId":"imagine"}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons WHERE course_id = v_course_id AND title = '想象世界'
  );

  -- [5] 追逐游戏 —— chase-game
  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes, steps, resources, content
  )
  SELECT v_course_id, '追逐游戏', 'scratch', 5, 45,
    '[
      {"title":"准备场地和角色","description":"选一个背景，保留或换一个主角，再加一个要吃的目标（如苹果）。","hint":"右键点角色可以删除"},
      {"title":"用左右键控制主角","description":"主角：[[cat:events]] 的 [[block:events|当按下 → 键]] → [[cat:motion]] 的 [[block:motion|将 x 坐标增加 10]]；再做一组 [[block:events|当按下 ← 键]] → [[block:motion|将 x 坐标增加 -10]]。","hint":"按键积木可在下拉里选不同的键"},
      {"title":"加上下移动","description":"再做两组：[[block:events|当按下 ↑ 键]] → [[block:motion|将 y 坐标增加 10]]；[[block:events|当按下 ↓ 键]] → [[block:motion|将 y 坐标增加 -10]]。","hint":"x 是左右，y 是上下"},
      {"title":"让目标会躲","description":"目标角色：[[block:events|当绿旗被点击]] → [[cat:control]] [[block:control|重复执行]] → [[block:control|如果…那么]] 里放 [[cat:sensing]] 的 [[block:sensing|碰到 主角？]]，成立就 [[cat:motion]] [[block:motion|移到 随机位置]]。","hint":"侦测里找「碰到…？」"},
      {"title":"建立分数","description":"点 [[cat:variables]] 的「建立一个变量」，命名「分数」。","hint":"分数会显示在舞台左上角"},
      {"title":"吃到就加分","description":"在「碰到主角」里加 [[cat:variables]] 的 [[block:variables|将 分数 增加 1]]，并 [[cat:sound]] [[block:sound|播放声音]] 反馈。","hint":"每抓到一次就 +1"},
      {"title":"测试并保存","description":"点绿旗试玩，调整移动步数让游戏更顺手，再「保存到课程」「完成课时」。","hint":"步数适中才好控制"}
    ]'::jsonb,
    '[]'::jsonb,
    '{"summary":"做一个用方向键抓目标的小游戏，掌握按键控制、碰撞侦测和计分。","tutorialDeckId":"chase-game"}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons WHERE course_id = v_course_id AND title = '追逐游戏'
  );

  -- [7] 飞行闯关 —— make-it-fly
  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes, steps, resources, content
  )
  SELECT v_course_id, '飞行闯关', 'scratch', 7, 50,
    '[
      {"title":"选天空背景","description":"点「选择背景」挑一个天空或太空场景。","hint":"想飞得高就选辽阔的背景"},
      {"title":"选会飞的主角","description":"加一个角色（鹦鹉、火箭等），拖到舞台左边。","hint":"搜 parrot、rocket 等关键词"},
      {"title":"用鼠标控制飞行","description":"主角：[[block:events|当绿旗被点击]] → [[cat:control]] [[block:control|重复执行]] → [[cat:motion]] [[block:motion|移到 鼠标的 y 坐标]]。","hint":"「鼠标的 y 坐标」在 [[cat:sensing]] 里"},
      {"title":"让风景往后退","description":"给云或山角色：[[block:control|重复执行]] → [[cat:motion]] [[block:motion|将 x 坐标增加 -5]]；到最左边就回到右边，做出前进感。","hint":"背景在动，就像主角在往前飞"},
      {"title":"放要收集的东西","description":"加一个金币或星星角色，用 [[block:control|重复执行]] 让它从右往左移动。","hint":"这是飞行中要吃到的奖励"},
      {"title":"收集加分","description":"用 [[cat:variables]] 建立变量「得分」；金币：[[block:control|如果…那么]] [[cat:sensing]] [[block:sensing|碰到 主角？]] → [[block:variables|将 得分 增加 1]]，并回到右边随机高度。","hint":"吃到就 +1 并重新出现"},
      {"title":"扇动翅膀","description":"主角的重复里加 [[cat:looks]] [[block:looks|下一个造型]] + [[cat:control]] [[block:control|等待 0.2 秒]]，做出扇翅膀动画。","hint":"两个造型轮流切换就像在扇动"},
      {"title":"保存作品","description":"点绿旗试飞，满意后「保存到课程」「完成课时」。","hint":"调整速度让闯关更好玩"}
    ]'::jsonb,
    '[]'::jsonb,
    '{"summary":"用鼠标操控角色飞行、躲避并收集道具，综合运用坐标、循环和变量。","tutorialDeckId":"make-it-fly"}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons WHERE course_id = v_course_id AND title = '飞行闯关'
  );

  -- [8] 音乐创作 —— music
  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes, steps, resources, content
  )
  SELECT v_course_id, '音乐创作', 'scratch', 8, 35,
    '[
      {"title":"添加音乐积木","description":"点左下角「添加扩展」，选「音乐」，左侧会多出一组 [[cat:music]] 积木。","hint":"左下角蓝色的加号按钮"},
      {"title":"弹一个音符","description":"拖 [[block:music|演奏音符 60 0.5 拍]] 到右边，点一下听听声音。","hint":"数字越大音越高"},
      {"title":"编一小段旋律","description":"多拖几个 [[block:music|演奏音符 60 0.5 拍]]，改不同数字，连成一句你喜欢的调子。","hint":"60 是中音 do，往上数试试"},
      {"title":"加上鼓点节奏","description":"用 [[cat:control]] [[block:control|重复执行]] 包住 [[block:music|演奏鼓声 1 0.25 拍]]，让节奏一直跟着。","hint":"鼓声让音乐更有节奏感"},
      {"title":"调整速度","description":"加 [[block:music|将演奏速度设定为 60]]，试试调快或调慢整段音乐。","hint":"数值大就快，小就慢"},
      {"title":"绿旗开始演奏","description":"用 [[cat:events]] [[block:events|当绿旗被点击]] 触发整段音乐。","hint":"帽子积木放最上面"},
      {"title":"保存作品","description":"点绿旗听一遍，满意后「保存到课程」「完成课时」。","hint":"给你的曲子起个名字"}
    ]'::jsonb,
    '[]'::jsonb,
    '{"summary":"用音乐扩展演奏音符和鼓点，编出属于自己的一小段旋律。","tutorialDeckId":"music"}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons WHERE course_id = v_course_id AND title = '音乐创作'
  );

END $$;
