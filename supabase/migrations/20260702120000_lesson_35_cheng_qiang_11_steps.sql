-- 3+ 课件100「城墙」Duplo 模型对齐 11 步 LDraw（scripts/ldraw-models/3-cheng-qiang.ldr）。

UPDATE public.course_lessons AS l
SET steps = $steps$[
    {"title":"第1-2层墙","description":"两面平行墙各叠第1层黄色与第2层棕色砖，保持对称。","hint":"棕层两端用 2×2，中间用 2×4。","checklist":["两面墙平行","黄棕交替正确","层间对齐"]},
    {"title":"第3-4层墙","description":"继续各加第3层黄色与第4层棕色砖，把墙身加高。","hint":"与前面两层同样的拼法。","checklist":["第3层全黄","第4层棕黄分布正确"]},
    {"title":"第5层墙","description":"两面墙各加一层黄色 2×4 砖。","hint":"只在两侧外墙叠高。","checklist":["每排 12 块黄砖","两面同步"]},
    {"title":"第6层墙","description":"两面墙各加一层棕色砖，完成主体墙身。","hint":"棕层两端 2×2，中间 2×4。","checklist":["墙身收顶平整","中间走道仍留出"]},
    {"title":"铺走道底板","description":"在中间走道铺 4 块绿色 6×12 底板，连接两面墙。","hint":"底板落在第6层顶面中央。","checklist":["4 块绿板铺平","走道连通"]},
    {"title":"铺橙色墙顶","description":"两侧墙顶各铺 12 块橙色 2×4 砖。","hint":"橙色砖在 z=±80 两侧墙顶。","checklist":["每侧 12 块","与墙顶贴合"]},
    {"title":"加黄色城垛","description":"在橙色墙顶加 16 个黄色 2×2 城垛，按垛口间隔排列。","hint":"分布：2 砖 - 空 2 格 - 4 砖 - 空 2 格 - 2 砖。","checklist":["垛口间隔均匀","前后两排对称"]},
    {"title":"建烽火台柱","description":"在城垛空隙中立 8 根柱，每柱 5 层红-黄-红-黄-红交替。","hint":"柱子在垛口空位，X 方向略外移对齐。","checklist":["8 根柱垂直","颜色交替正确"]},
    {"title":"盖灰色顶板","description":"两组立柱顶各盖一块灰色 8×8 平板，形成烽火台基座。","hint":"平板中心在 X=±480。","checklist":["两块灰板水平","压住柱顶"]},
    {"title":"叠烽火台顶","description":"两座烽火台顶各用橙色 2×4 砖阶梯收顶。","hint":"先铺底层再逐层收窄。","checklist":["两座对称","与灰板贴合"]},
    {"title":"插旗","description":"两座烽火台各插一根棕色旗杆和一面红旗。","hint":"旗杆竖直插在塔顶中央。","checklist":["旗杆垂直","红旗朝外固定"]}
  ]$steps$::jsonb,
  content = jsonb_set(
    COALESCE(l.content, '{}'::jsonb),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"第1-2层墙","description":"两面平行墙各叠第1层黄色与第2层棕色砖，保持对称。","partIds":[],"cameraHint":"isometric"},
      {"title":"第3-4层墙","description":"继续各加第3层黄色与第4层棕色砖，把墙身加高。","partIds":[],"cameraHint":"isometric"},
      {"title":"第5层墙","description":"两面墙各加一层黄色 2×4 砖。","partIds":[],"cameraHint":"isometric"},
      {"title":"第6层墙","description":"两面墙各加一层棕色砖，完成主体墙身。","partIds":[],"cameraHint":"isometric"},
      {"title":"铺走道底板","description":"在中间走道铺 4 块绿色 6×12 底板，连接两面墙。","partIds":[],"cameraHint":"top"},
      {"title":"铺橙色墙顶","description":"两侧墙顶各铺 12 块橙色 2×4 砖。","partIds":[],"cameraHint":"isometric"},
      {"title":"加黄色城垛","description":"在橙色墙顶加 16 个黄色 2×2 城垛，按垛口间隔排列。","partIds":[],"cameraHint":"isometric"},
      {"title":"建烽火台柱","description":"在城垛空隙中立 8 根柱，每柱 5 层红-黄-红-黄-红交替。","partIds":[],"cameraHint":"front"},
      {"title":"盖灰色顶板","description":"两组立柱顶各盖一块灰色 8×8 平板，形成烽火台基座。","partIds":[],"cameraHint":"isometric"},
      {"title":"叠烽火台顶","description":"两座烽火台顶各用橙色 2×4 砖阶梯收顶。","partIds":[],"cameraHint":"isometric"},
      {"title":"插旗","description":"两座烽火台各插一根棕色旗杆和一面红旗。","partIds":[],"cameraHint":"front"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 35
  AND l.course_id = 5
  AND l.title = '城墙'
  AND l.lesson_type = 'building_3d';
