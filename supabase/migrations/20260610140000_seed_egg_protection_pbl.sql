-- =============================================================================
-- 种子：鸡蛋快递保护舱挑战（PBL）
-- 包含：
--   1. 4 张可复用资料卡（learning_resources）：原理 / 材料 / 方法 / 技能兜底
--   2. 长期挑战（8 要素 + 4 阶段 kind/checklist/hint）
--   3. 配套示例项目「鸡蛋跌落测试初体验」——演示测试方法而非最优保护结构
--   4. 挑战 resources 按三分类（project / skill / reference）挂全部真实落点
-- 幂等：按标题匹配，可重复执行。
-- =============================================================================

DO $$
DECLARE
    v_author_id UUID;
    v_category_id INT;
    v_sub_id INT;
    v_challenge_id BIGINT;
    v_project_id BIGINT;
    v_res_principle BIGINT;
    v_res_material BIGINT;
    v_res_method BIGINT;
    v_res_skill BIGINT;
BEGIN
    SELECT id INTO v_author_id
      FROM public.profiles
     WHERE role = 'admin'
     ORDER BY created_at ASC
     LIMIT 1;

    IF v_author_id IS NULL THEN
        SELECT id INTO v_author_id
          FROM public.profiles
         ORDER BY created_at ASC
         LIMIT 1;
    END IF;

    IF v_author_id IS NULL THEN
        RAISE EXCEPTION 'No users found in profiles table';
    END IF;

    SELECT id INTO v_category_id
      FROM public.categories
     WHERE name = '工程'
     LIMIT 1;

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION '找不到分类: 工程';
    END IF;

    SELECT id INTO v_sub_id
      FROM public.sub_categories
     WHERE category_id = v_category_id
       AND name = '模型制作'
     LIMIT 1;

    IF v_sub_id IS NULL THEN
        RAISE EXCEPTION '找不到子分类: 模型制作';
    END IF;

    -- -------------------------------------------------------------------------
    -- 1. 资料卡（learning_resources）
    -- -------------------------------------------------------------------------

    -- 1.1 原理卡：冲击力与缓冲原理
    SELECT id INTO v_res_principle FROM public.learning_resources WHERE title = '冲击力与缓冲原理' LIMIT 1;
    IF v_res_principle IS NULL THEN
        INSERT INTO public.learning_resources (title, summary, content_md, category, status)
        VALUES (
            '冲击力与缓冲原理',
            '搞不懂鸡蛋为什么会碎、缓冲为什么有用时，先读这篇。',
            $md$## 鸡蛋为什么会碎

鸡蛋从高处落下时速度越来越快，落地的一瞬间速度突然变成零。让它停下来的那股力，就是冲击力。冲击力太大，蛋壳承受不住，就碎了。

## 关键规律：停下来的时间越长，冲击力越小

想象两种落地方式：

- 落在水泥地上：一瞬间停住，冲击力非常大
- 落在厚海绵上：慢慢陷进去再停住，冲击力小很多

鸡蛋落地前的速度是一样的，区别只在"停下来用了多久"。**缓冲做的事，就是把"急刹车"变成"慢刹车"。**

## 三种常见的缓冲思路

- **垫**：在鸡蛋外面包一层能被压缩的材料（棉花、纸团），让它慢慢停
- **吊**：把鸡蛋悬挂在盒子中央（橡皮筋、皮筋网），外壳着地时鸡蛋还在减速
- **撑**：用会变形的结构（吸管支架、纸弹簧）替鸡蛋"牺牲"——结构压坏了，鸡蛋没事

## 回到你的设计

设计保护舱时问自己：

- 鸡蛋落地时，是什么帮它"慢慢停下来"？
- 如果舱体停了，鸡蛋会不会还在里面继续动、撞到内壁？$md$,
            'principle',
            'published'
        )
        RETURNING id INTO v_res_principle;
    END IF;

    -- 1.2 材料卡：常见缓冲材料对比
    SELECT id INTO v_res_material FROM public.learning_resources WHERE title = '常见缓冲材料对比' LIMIT 1;
    IF v_res_material IS NULL THEN
        INSERT INTO public.learning_resources (title, summary, content_md, category, status)
        VALUES (
            '常见缓冲材料对比',
            '不知道选什么材料做缓冲层时查这张卡。',
            $md$## 怎么比较缓冲材料

好的缓冲材料一般有两个本事：受力时**能被压缩**（吸收冲击），压缩后**不会把力直接传给鸡蛋**。挑材料时还要考虑重量和体积——挑战要求保护舱又轻又小。

## 家里常见材料的特点

- **棉花 / 化妆棉**：很软、很轻，贴身包裹效果好；但压得太实缓冲会变差，别塞太紧
- **纸团（揉皱的纸）**：免费易得，皱褶能吸收冲击；揉得太实会变硬，蓬松一点更好
- **吸管**：本身不软，但搭成支架后，结构变形能吸收大量冲击，适合做"外壳牺牲层"
- **海绵 / 洗碗棉**：压缩回弹好，是稳定的缓冲层；缺点是占体积
- **橡皮筋**：不能当垫子，但可以把鸡蛋悬吊在盒子中央，是"吊"思路的核心材料
- **保鲜袋充气**：自制小气囊，缓冲好又轻；缺点是容易破，适合做外层

## 选材小提示

- 不同位置可以用不同材料：外层抗撞、内层贴身
- 材料不是越多越好——堆太多会超出重量和尺寸限制
- 先用手压一压：按下去能慢慢回弹的，通常是好缓冲$md$,
            'material',
            'published'
        )
        RETURNING id INTO v_res_material;
    END IF;

    -- 1.3 方法卡：跌落测试怎么做
    SELECT id INTO v_res_method FROM public.learning_resources WHERE title = '跌落测试怎么做' LIMIT 1;
    IF v_res_method IS NULL THEN
        INSERT INTO public.learning_resources (title, summary, content_md, category, status)
        VALUES (
            '跌落测试怎么做',
            '开始测试前读这张卡，学会公平测试和记录数据。',
            $md$## 测试前的准备

- 在地面铺塑料布或旧报纸，方便清理
- 用卷尺量出 0.5 米、1 米、2 米的高度，在墙上贴标记
- 准备一张记录表（见下方模板）

## 公平测试三原则

1. **固定变量**：每次测试只改一个东西。高度变了，保护舱就不要同时改
2. **统一姿势**：每次都用同样的方式松手自由落下，不要抛、不要扔
3. **逐级升高**：从 0.5 米开始，这一级通过了再升到下一级

## 每次跌落后检查什么

- 鸡蛋：完好 / 有裂纹 / 破碎（有裂纹也算失效，继续测试前要换蛋或停止）
- 保护舱：哪个部位变形、压坏了？这就是冲击力走过的路线
- 落地姿态：是不是按预想的那一面着地？

## 记录表模板

每次测试记一行：

- 第几次测试 / 跌落高度 / 鸡蛋状态 / 保护舱破损部位 / 观察与猜想

## 测试结束后

对着记录表想两个问题：

- 失效发生在哪一级高度、哪个部位？
- 如果只能改一个地方，你会先改哪里？为什么？$md$,
            'method',
            'published'
        )
        RETURNING id INTO v_res_method;
    END IF;

    -- 1.4 技能卡（兜底，站内暂无对应缓冲结构项目）：结构与缓冲设计入门
    SELECT id INTO v_res_skill FROM public.learning_resources WHERE title = '结构与缓冲设计入门' LIMIT 1;
    IF v_res_skill IS NULL THEN
        INSERT INTO public.learning_resources (title, summary, content_md, category, status)
        VALUES (
            '结构与缓冲设计入门',
            '完全不知道保护舱从什么结构入手时，先补这一课。',
            $md$## 保护舱的三层思维

把保护舱想成三层，每层回答一个问题：

1. **外壳**：着地时先接触地面的是什么？它要替鸡蛋挨这一下
2. **缓冲层**：冲击穿过外壳后，靠什么慢慢吸收掉？
3. **固定层**：鸡蛋在舱内会不会晃动、撞壁？怎么让它"动弹不得"又"不被夹太紧"？

## 三种入门结构

### 包裹式（最简单）

鸡蛋用软材料层层包住，放进盒子里塞满缓冲物。

- 优点：好做、稳定
- 缺点：容易超重、超大

### 悬吊式（最巧妙）

用橡皮筋把鸡蛋悬挂在框架中央，四面不贴壁。

- 优点：轻，缓冲效果好
- 缺点：橡皮筋松紧要反复调试

### 骨架式（最工程）

用吸管或纸卷搭一个外部骨架，靠骨架变形吸收冲击。

- 优点：很轻，结构感强
- 缺点：连接点容易散，要做好三角加固

## 动手前的小练习

随手拿 5 根吸管和胶带，试着搭一个能护住乒乓球的小框架，用手压一压看哪里先垮——你会立刻明白三角形为什么重要。$md$,
            'skill',
            'published'
        )
        RETURNING id INTO v_res_skill;
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. 挑战本体
    -- -------------------------------------------------------------------------
    SELECT id INTO v_challenge_id
      FROM public.challenges
     WHERE title = '鸡蛋快递保护舱挑战'
     LIMIT 1;

    IF v_challenge_id IS NULL THEN
        INSERT INTO public.challenges (
            title,
            description,
            image_url,
            tags,
            participants_count,
            challenge_type,
            status,
            scenario,
            driving_question,
            expected_outcome,
            constraints,
            resources,
            stages,
            steam_weights,
            difficulty_stars,
            completions_count
        ) VALUES (
            '鸡蛋快递保护舱挑战',
            '你是包装设计师，要为一枚生鸡蛋设计能从 2 米跌落不碎的「快递保护舱」。用有限材料做出原型，逐级跌落测试，并用数据说明你的设计为什么有效。',
            '/projects/eng_models.webp',
            ARRAY['PBL', '工程设计', '缓冲结构', '跌落测试', '包装设计'],
            0,
            'evergreen',
            'active',
            '网购的杯子、鸡蛋等易碎品常在快递运输中摔坏。快递公司想要一种轻巧、不浪费材料的保护包装，而鸡蛋是最苛刻的测试对象——你需要为一枚生鸡蛋设计一个保护舱，让它经得起搬运和跌落。',
            '怎样用有限的材料，让鸡蛋从 2 米高度跌落不碎，同时让保护舱尽量轻、尽量小？',
            '提交一个鸡蛋保护舱实物，包含设计草图、逐级跌落测试记录（0.5 米 → 1 米 → 2 米）、测试数据表和一次以上迭代说明。',
            ARRAY[
                '只能使用纸张、吸管、棉花、橡皮筋、胶带、保鲜袋等家用低成本材料',
                '保护舱整体不超过 20×20×20 厘米',
                '鸡蛋放入和取出要能在 30 秒内完成，不能整体缠死',
                '按 0.5 米 → 1 米 → 2 米逐级测试，每级记录结果后再升高',
                '提交时说明一次失败或改进，而不只展示最终成品',
                '测试时铺好垫布，破损鸡蛋及时清理，注意卫生'
            ],
            '[]'::jsonb,
            '[
              {"title":"研究缓冲与真实包装","description":"观察或回忆一个真实快递包装是怎么保护易碎品的，结合资料卡理解冲击力与缓冲的关系。","hint":"先想清楚\"鸡蛋为什么会碎\"，再想\"怎么不让它碎\"。","kind":"observe","checklist":["观察或回忆了至少 1 种真实快递包装的保护方式","能用自己的话说出为什么缓冲能保护鸡蛋","列出了家里能找到的候选缓冲材料"]},
              {"title":"画出保护舱方案","description":"画出至少两种保护舱草图，标注材料和缓冲层位置，比较它们的优缺点。","hint":"两个方案最好走不同思路，比如\"悬吊固定\"和\"包裹缓冲\"。","kind":"design","checklist":["画了至少 2 种保护舱草图","标注了每种方案用什么材料、缓冲层在哪里","比较了它们的重量、大小和制作难度"]},
              {"title":"制作并逐级跌落测试","description":"制作第一版保护舱，按 0.5 米、1 米、2 米逐级跌落测试，记录每一级的结果。","hint":"每级测试前检查鸡蛋是否有裂纹，并保持同样的松手方式。","kind":"build_test","checklist":["做出了第一版保护舱并能放进取出鸡蛋","按 0.5 米 → 1 米 → 2 米逐级测试并记录每级结果","记录了一次失败或意外"]},
              {"title":"只改一个变量再测","description":"根据测试结果改进保护舱，但一次只改一个关键变量，再用同样流程测试对比。","hint":"如果 2 米还是碎，先看破损位置：是着地点直接受力，还是鸡蛋在舱内晃动撞壁？","kind":"iterate","checklist":["根据测试结果只改了一个关键变量","用同样流程重新测试并记录对比","写清楚保留/放弃了什么以及为什么"]}
            ]'::jsonb,
            '{"S":20,"T":5,"E":35,"A":5,"M":15}'::jsonb,
            3,
            0
        )
        RETURNING id INTO v_challenge_id;
    ELSE
        UPDATE public.challenges
           SET description = '你是包装设计师，要为一枚生鸡蛋设计能从 2 米跌落不碎的「快递保护舱」。用有限材料做出原型，逐级跌落测试，并用数据说明你的设计为什么有效。',
               image_url = '/projects/eng_models.webp',
               tags = ARRAY['PBL', '工程设计', '缓冲结构', '跌落测试', '包装设计'],
               challenge_type = 'evergreen',
               status = 'active',
               scenario = '网购的杯子、鸡蛋等易碎品常在快递运输中摔坏。快递公司想要一种轻巧、不浪费材料的保护包装，而鸡蛋是最苛刻的测试对象——你需要为一枚生鸡蛋设计一个保护舱，让它经得起搬运和跌落。',
               driving_question = '怎样用有限的材料，让鸡蛋从 2 米高度跌落不碎，同时让保护舱尽量轻、尽量小？',
               expected_outcome = '提交一个鸡蛋保护舱实物，包含设计草图、逐级跌落测试记录（0.5 米 → 1 米 → 2 米）、测试数据表和一次以上迭代说明。',
               constraints = ARRAY[
                   '只能使用纸张、吸管、棉花、橡皮筋、胶带、保鲜袋等家用低成本材料',
                   '保护舱整体不超过 20×20×20 厘米',
                   '鸡蛋放入和取出要能在 30 秒内完成，不能整体缠死',
                   '按 0.5 米 → 1 米 → 2 米逐级测试，每级记录结果后再升高',
                   '提交时说明一次失败或改进，而不只展示最终成品',
                   '测试时铺好垫布，破损鸡蛋及时清理，注意卫生'
               ],
               stages = '[
                 {"title":"研究缓冲与真实包装","description":"观察或回忆一个真实快递包装是怎么保护易碎品的，结合资料卡理解冲击力与缓冲的关系。","hint":"先想清楚\"鸡蛋为什么会碎\"，再想\"怎么不让它碎\"。","kind":"observe","checklist":["观察或回忆了至少 1 种真实快递包装的保护方式","能用自己的话说出为什么缓冲能保护鸡蛋","列出了家里能找到的候选缓冲材料"]},
                 {"title":"画出保护舱方案","description":"画出至少两种保护舱草图，标注材料和缓冲层位置，比较它们的优缺点。","hint":"两个方案最好走不同思路，比如\"悬吊固定\"和\"包裹缓冲\"。","kind":"design","checklist":["画了至少 2 种保护舱草图","标注了每种方案用什么材料、缓冲层在哪里","比较了它们的重量、大小和制作难度"]},
                 {"title":"制作并逐级跌落测试","description":"制作第一版保护舱，按 0.5 米、1 米、2 米逐级跌落测试，记录每一级的结果。","hint":"每级测试前检查鸡蛋是否有裂纹，并保持同样的松手方式。","kind":"build_test","checklist":["做出了第一版保护舱并能放进取出鸡蛋","按 0.5 米 → 1 米 → 2 米逐级测试并记录每级结果","记录了一次失败或意外"]},
                 {"title":"只改一个变量再测","description":"根据测试结果改进保护舱，但一次只改一个关键变量，再用同样流程测试对比。","hint":"如果 2 米还是碎，先看破损位置：是着地点直接受力，还是鸡蛋在舱内晃动撞壁？","kind":"iterate","checklist":["根据测试结果只改了一个关键变量","用同样流程重新测试并记录对比","写清楚保留/放弃了什么以及为什么"]}
               ]'::jsonb,
               steam_weights = '{"S":20,"T":5,"E":35,"A":5,"M":15}'::jsonb,
               difficulty_stars = 3
         WHERE id = v_challenge_id;
    END IF;

    -- -------------------------------------------------------------------------
    -- 3. 示例项目：鸡蛋跌落测试初体验（演示测试方法，不给最优保护结构）
    -- -------------------------------------------------------------------------
    SELECT id INTO v_project_id
      FROM public.projects
     WHERE title = '鸡蛋跌落测试初体验'
     LIMIT 1;

    IF v_project_id IS NULL THEN
        INSERT INTO public.projects (
            title,
            description,
            author_id,
            image_url,
            category,
            sub_category_id,
            difficulty,
            difficulty_stars,
            status,
            challenge_id,
            reflection,
            problem_statement,
            iterations,
            steam_weights,
            tags
        ) VALUES (
            '鸡蛋跌落测试初体验',
            '用一个故意简陋的"基准包装"，完整走一遍鸡蛋跌落测试流程：固定高度、逐级跌落、记录结果、分析破损。这个项目教的是测试和记录的方法——保护舱该怎么设计，留给你自己探索。',
            v_author_id,
            '/projects/eng_models.webp',
            '工程',
            v_sub_id,
            'easy',
            2,
            'approved',
            v_challenge_id,
            '基准包装在 0.5 米完好、1 米就碎了，说明只靠两张纸巾的缓冲远远不够。但这次测试让我们看清了鸡蛋是从着地一侧先裂的，记录表也让对比有了依据——下一步改什么，心里就有数了。',
            '在动手设计保护舱之前，我们先要学会"怎么测试"：怎样保证每次跌落条件一致？记录什么数据才能帮助改进？',
            '[
              {"description":"用 2 张纸巾随意包住鸡蛋装进保鲜袋，作为基准包装。从 0.5 米松手跌落。","result":"鸡蛋完好，但纸巾已经被压实，缓冲余量明显不足。","created_at":"2026-06-10T10:00:00.000Z"},
              {"description":"同一包装升到 1 米重复测试，落地姿势保持一致。","result":"鸡蛋着地一侧出现裂纹，判定失效。破损集中在直接受力点，说明缓冲层太薄、没有分散冲击。","created_at":"2026-06-10T10:15:00.000Z"}
            ]'::jsonb,
            '{"S":25,"T":5,"E":20,"A":0,"M":20}'::jsonb,
            ARRAY['PBL', '跌落测试', '实验方法', '数据记录', '工程']
        )
        RETURNING id INTO v_project_id;
    ELSE
        UPDATE public.projects
           SET description = '用一个故意简陋的"基准包装"，完整走一遍鸡蛋跌落测试流程：固定高度、逐级跌落、记录结果、分析破损。这个项目教的是测试和记录的方法——保护舱该怎么设计，留给你自己探索。',
               author_id = v_author_id,
               image_url = '/projects/eng_models.webp',
               category = '工程',
               sub_category_id = v_sub_id,
               difficulty = 'easy',
               difficulty_stars = 2,
               status = 'approved',
               challenge_id = v_challenge_id,
               updated_at = NOW()
         WHERE id = v_project_id;
    END IF;

    DELETE FROM public.project_materials
     WHERE project_id = v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '生鸡蛋 2-3 枚（可先用水煮蛋练习流程）', 1),
        (v_project_id, '纸巾或餐巾纸 2 张', 2),
        (v_project_id, '保鲜袋 1 个', 3),
        (v_project_id, '透明胶带', 4),
        (v_project_id, '卷尺或软尺', 5),
        (v_project_id, '塑料布或旧报纸（保护地面）', 6),
        (v_project_id, '记录表或实验笔记本', 7);

    DELETE FROM public.project_steps
     WHERE project_id = v_project_id;

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '布置测试场地', '在地面铺好塑料布或旧报纸，用卷尺在墙上量出 0.5 米、1 米、2 米三个高度并贴上标记。', 1),
        (v_project_id, '制作基准包装', '只用 2 张纸巾随意包住鸡蛋，装进保鲜袋封口。这个包装故意做得简陋，作为后续改进的对照组。', 2),
        (v_project_id, '设计记录表', '画一张记录表，至少包含：第几次测试、跌落高度、鸡蛋状态（完好/裂纹/破碎）、包装破损部位、观察备注。', 3),
        (v_project_id, '从 0.5 米开始逐级跌落', '手持包装到 0.5 米标记处自然松手（不要抛掷），落地后立刻检查并记录。通过后再升到 1 米、2 米。', 4),
        (v_project_id, '分析破损模式', '观察鸡蛋从哪个方向先裂、包装哪个部位先失效。破损位置就是冲击力走过的路线。', 5),
        (v_project_id, '写测试结论', '总结：基准包装在多高失效？失效原因是什么？如果只能改一个变量，你会先改哪里？带着这个结论去挑战里设计你的保护舱。', 6);

    -- -------------------------------------------------------------------------
    -- 4. 挂载三分类脚手架（全部真实落点）
    -- -------------------------------------------------------------------------
    UPDATE public.challenges
       SET resources = jsonb_build_array(
           jsonb_build_object(
               'title', '鸡蛋跌落测试初体验',
               'url', format('/project/%s', v_project_id),
               'type', 'project',
               'description', '演示完整测试流程，学方法、不抄结构'
           ),
           jsonb_build_object(
               'title', '结构与缓冲设计入门',
               'url', format('/resources/%s', v_res_skill),
               'type', 'skill',
               'description', '不知道从什么结构入手时先补这一课'
           ),
           jsonb_build_object(
               'title', '冲击力与缓冲原理',
               'url', format('/resources/%s', v_res_principle),
               'type', 'reference',
               'description', '搞不懂鸡蛋为什么会碎时先读这篇'
           ),
           jsonb_build_object(
               'title', '常见缓冲材料对比',
               'url', format('/resources/%s', v_res_material),
               'type', 'reference',
               'description', '选缓冲材料拿不定主意时查这张卡'
           ),
           jsonb_build_object(
               'title', '跌落测试怎么做',
               'url', format('/resources/%s', v_res_method),
               'type', 'reference',
               'description', '开始测试前学会公平测试和记录'
           )
       )
     WHERE id = v_challenge_id;
END $$;
