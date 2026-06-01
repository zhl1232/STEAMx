-- 重构 Scratch 三课：优化学习曲线，每步明确操作指引
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

  -- 更新第一课：动画故事（降低难度，步骤更细）
  UPDATE public.course_lessons
  SET
    duration_minutes = 45,
    steps = '[
      {
        "title": "选择角色",
        "description": "先给故事选个主角！点击右下角的猫咪图标。",
        "hint": "屏幕右下角，舞台下方，有个紫色的「选择角色」按钮（猫咪图标）"
      },
      {
        "title": "让角色说话",
        "description": "从左侧积木区找到「外观」分类（紫色），拖一个「说 你好！持续 2 秒」到右边。",
        "hint": "点左边紫色的「外观」，找到气泡形状的积木，拖到右边空白处"
      },
      {
        "title": "点绿旗试试",
        "description": "点击舞台上方的绿旗，看看角色会不会说话。",
        "hint": "舞台正上方有个绿色旗子按钮，点它就能运行程序"
      },
      {
        "title": "让角色动起来",
        "description": "从「动作」分类（深蓝色）拖一个「移动 10 步」积木，接在「说话」积木下面。",
        "hint": "积木要像拼图一样拼在一起，对准凹槽就会自动吸附"
      },
      {
        "title": "换个背景",
        "description": "点击右下角的风景图标，选一个你喜欢的背景。",
        "hint": "舞台下方右侧，「选择背景」按钮（风景图标），点开后选一张图"
      },
      {
        "title": "加入第二个角色",
        "description": "再点一次「选择角色」，添加第二个角色到舞台上。",
        "hint": "可以选动物、人物或物品，想选几个都行"
      },
      {
        "title": "让第二个角色也动",
        "description": "点击舞台上的第二个角色，给它也拖几个积木（说话或移动）。",
        "hint": "先点舞台上的角色选中它，右边的积木区就会切换到这个角色"
      },
      {
        "title": "保存作品",
        "description": "点击页面上的「保存到训练营」按钮，给作品起个名字。",
        "hint": "保存后记得点「完成课时」按钮，才算完成本课"
      }
    ]'::jsonb,
    content = jsonb_set(
      COALESCE(content, '{}'::jsonb),
      '{summary}',
      '"让角色动起来、说话，创作你的第一个 Scratch 作品。"'
    )
  WHERE course_id = v_course_id AND title = '动画故事';

  -- 更新第二课：电子贺卡（引入事件和循环）
  UPDATE public.course_lessons
  SET
    duration_minutes = 40,
    steps = '[
      {
        "title": "确定贺卡主题",
        "description": "想好要做生日、节日还是感谢卡，在纸上画个草图。",
        "hint": "可以是生日蛋糕、新年烟花、母亲节康乃馨等"
      },
      {
        "title": "选择或绘制背景",
        "description": "点「选择背景」，选一个合适的背景；或点「绘制」自己画。",
        "hint": "「选择背景」旁边有个画笔图标，点它可以自己画背景"
      },
      {
        "title": "添加装饰角色",
        "description": "添加 2-3 个装饰角色（气球、蛋糕、花等）。",
        "hint": "点「选择角色」，搜索 balloon、cake、flower 等关键词"
      },
      {
        "title": "让装饰动起来",
        "description": "选中一个角色，从「外观」拖「将颜色特效增加 25」，从「控制」拖「重复执行 10 次」把它包住。",
        "hint": "橙色的「控制」分类里，找 C 形的「重复执行」积木，把其他积木拖进去"
      },
      {
        "title": "添加点击互动",
        "description": "从「事件」（金黄色）拖「当角色被点击」到新的一列，下面接「播放声音」或「说话」。",
        "hint": "「事件」在最上面，找帽子形状的积木；「声音」在紫色「外观」旁边"
      },
      {
        "title": "写祝福语",
        "description": "添加一个文字角色，或让现有角色说出祝福的话。",
        "hint": "可以用「说 生日快乐！」积木，点击文字可以修改内容"
      },
      {
        "title": "保存并测试",
        "description": "点绿旗运行，试试点击各个角色，确认效果满意后保存。",
        "hint": "保存到训练营，起个好听的名字，然后点「完成课时」"
      }
    ]'::jsonb,
    content = jsonb_set(
      COALESCE(content, '{}'::jsonb),
      '{summary}',
      '"制作会动、能互动的电子贺卡，掌握循环和事件。"'
    )
  WHERE course_id = v_course_id AND title = '电子贺卡';

  -- 更新第三课：弹球游戏（综合运用，引入变量）
  UPDATE public.course_lessons
  SET
    duration_minutes = 50,
    steps = '[
      {
        "title": "准备角色和背景",
        "description": "删除小猫，添加「Ball」（球）和「Paddle」（挡板）角色，选个简单背景。",
        "hint": "右键点小猫选「删除」；搜索 ball 和 paddle；背景选纯色或简单图案"
      },
      {
        "title": "让球移动",
        "description": "给球添加：「当绿旗被点击」→「移动到 x:0 y:0」→「面向 45 方向」→「重复执行」→「移动 5 步」。",
        "hint": "「动作」里找「移动到」和「面向」；「控制」里找「重复执行」（不要选「重复 10 次」，要选无限循环的）"
      },
      {
        "title": "让球反弹",
        "description": "在「重复执行」里面，「移动 5 步」下面加上「碰到边缘就反弹」。",
        "hint": "「动作」分类最下面，有个「碰到边缘就反弹」积木"
      },
      {
        "title": "控制挡板移动",
        "description": "给挡板添加：「当绿旗被点击」→「移动到 x:0 y:-130」→「重复执行」→「如果 按下左键？那么 x 改变 -10」。",
        "hint": "「控制」里找「如果...那么」；「侦测」（浅蓝色）里找「按下...键？」；「动作」里找「x 改变」"
      },
      {
        "title": "添加右键控制",
        "description": "在挡板的「重复执行」里，再加一个「如果 按下右键？那么 x 改变 10」。",
        "hint": "复制上一个「如果」积木（右键点击选「复制」），改成右键和 +10"
      },
      {
        "title": "创建分数变量",
        "description": "点左侧「变量」（橙红色）→「建立一个变量」→输入「分数」→确定。",
        "hint": "「变量」在积木分类最下面，点开后有个「建立一个变量」按钮"
      },
      {
        "title": "碰到挡板加分",
        "description": "在球的「重复执行」里加：「如果 碰到 Paddle？那么 分数 改变 1」和「面向 180-方向 方向」（反弹）。",
        "hint": "「侦测」里找「碰到...？」；「变量」里找「分数 改变」；「运算」（绿色）里找减法，组合成 180-方向"
      },
      {
        "title": "球落地游戏结束",
        "description": "在球的「重复执行」里加：「如果 y 坐标 < -160 那么 全部停止」。",
        "hint": "「运算」里找「<」；「动作」里找「y 坐标」；「控制」里找「全部停止」"
      },
      {
        "title": "测试和保存",
        "description": "点绿旗玩几次，调整球速（改「移动步数」）和挡板速度，满意后保存。",
        "hint": "可以改移动的步数让游戏更简单或更难，保存后点「完成课时」"
      }
    ]'::jsonb,
    content = jsonb_set(
      COALESCE(content, '{}'::jsonb),
      '{summary}',
      '"综合运用移动、碰撞、变量和条件，完成可玩的弹球游戏。"'
    )
  WHERE course_id = v_course_id AND title = '弹球游戏';

END $$;
