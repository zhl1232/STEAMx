-- 3+「宝剑」改为严格按 instructions.pdf 的 14 个搭建步骤。
-- 侧栏 steps、3D steps3d、右侧本步零件 parts 与 PDF 每页零件框保持一致。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(l.content, '{}'::jsonb),
          '{summary}',
          to_jsonb('宝剑：按照搭建说明 PDF 的 14 个步骤，依次完成剑身、剑格、剑柄和展示架。'::text),
          true
        ),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/3-bao-jian.mpd'::text),
        true
      ),
      '{building3d,parts}',
      $parts$[
        {"id":"s1-blue-2x4","name":"蓝色 2×4","color":"#2563eb","quantity":4},
        {"id":"s1-yellow-2x4","name":"黄色 2×4","color":"#facc15","quantity":2},
        {"id":"s2-blue-2x4","name":"蓝色 2×4","color":"#2563eb","quantity":4},
        {"id":"s2-yellow-2x4","name":"黄色 2×4","color":"#facc15","quantity":2},
        {"id":"s3-blue-2x4","name":"蓝色 2×4","color":"#2563eb","quantity":4},
        {"id":"s3-yellow-2x4","name":"黄色 2×4","color":"#facc15","quantity":2},
        {"id":"s4-blue-2x4","name":"蓝色 2×4","color":"#2563eb","quantity":2},
        {"id":"s4-yellow-2x4","name":"黄色 2×4","color":"#facc15","quantity":1},
        {"id":"s5-blue-2x4","name":"蓝色 2×4","color":"#2563eb","quantity":2},
        {"id":"s6-blue-2x4","name":"蓝色 2×4","color":"#2563eb","quantity":4},
        {"id":"s7-blue-2x4","name":"蓝色 2×4","color":"#2563eb","quantity":6},
        {"id":"s8-red-2x4-plate","name":"红色 2×4 薄板","color":"#ef4444","quantity":2},
        {"id":"s8-yellow-2x4","name":"黄色 2×4","color":"#facc15","quantity":1},
        {"id":"s9-red-2x4-plate","name":"红色 2×4 薄板","color":"#ef4444","quantity":8},
        {"id":"s9-yellow-2x4","name":"黄色 2×4","color":"#facc15","quantity":5},
        {"id":"s10-yellow-2x2","name":"黄色 2×2","color":"#facc15","quantity":2},
        {"id":"s10-yellow-2x4","name":"黄色 2×4","color":"#facc15","quantity":10},
        {"id":"s11-red-2x4-plate","name":"红色 2×4 薄板","color":"#ef4444","quantity":2},
        {"id":"s11-red-2x4","name":"红色 2×4","color":"#ef4444","quantity":2},
        {"id":"s12-red-2x4-plate","name":"红色 2×4 薄板","color":"#ef4444","quantity":2},
        {"id":"s12-red-2x4","name":"红色 2×4","color":"#ef4444","quantity":2},
        {"id":"s13-red-2x4-plate","name":"红色 2×4 薄板","color":"#ef4444","quantity":8}
      ]$parts$::jsonb,
      true
    ),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"步骤 1","description":"使用 4 块蓝色 2×4 和 2 块黄色 2×4，按 PDF 方向搭出剑身起点。","partIds":["s1-blue-2x4","s1-yellow-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 2","description":"继续加入 4 块蓝色 2×4 和 2 块黄色 2×4，沿同一方向延长剑身。","partIds":["s2-blue-2x4","s2-yellow-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 3","description":"继续加入 4 块蓝色 2×4 和 2 块黄色 2×4，保持蓝色外侧、黄色中线。","partIds":["s3-blue-2x4","s3-yellow-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 4","description":"加入 2 块蓝色 2×4 和 1 块黄色 2×4，完成剑身长条。","partIds":["s4-blue-2x4","s4-yellow-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 5","description":"加入 2 块蓝色 2×4，按 PDF 方向立起剑格竖梁。","partIds":["s5-blue-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 6","description":"加入 4 块蓝色 2×4，加厚并延伸剑格竖梁。","partIds":["s6-blue-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 7","description":"加入 6 块蓝色 2×4，搭出剑柄。","partIds":["s7-blue-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 8","description":"加入 2 块红色 2×4 薄板和 1 块黄色 2×4，开始搭建展示架横梁。","partIds":["s8-red-2x4-plate","s8-yellow-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 9","description":"加入 8 块红色 2×4 薄板和 5 块黄色 2×4，延长展示架横梁。","partIds":["s9-red-2x4-plate","s9-yellow-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 10","description":"加入 2 块黄色 2×2 和 10 块黄色 2×4，搭建两侧黄色支撑。","partIds":["s10-yellow-2x2","s10-yellow-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 11","description":"加入 2 块红色 2×4 薄板和 2 块红色 2×4，加固左侧底座。","partIds":["s11-red-2x4-plate","s11-red-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 12","description":"加入 2 块红色 2×4 薄板和 2 块红色 2×4，加固右侧底座。","partIds":["s12-red-2x4-plate","s12-red-2x4"],"cameraHint":"isometric"},
      {"title":"步骤 13","description":"加入 8 块红色 2×4 薄板，包边并完成两侧红色支撑。","partIds":["s13-red-2x4-plate"],"cameraHint":"isometric"},
      {"title":"步骤 14","description":"宝剑搭建完成，对照 PDF 第 14 页检查剑身、剑柄和展示架方向。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  steps = $steps$[
    {"title":"步骤 1","description":"使用 4 块蓝色 2×4 和 2 块黄色 2×4，按 PDF 方向搭出剑身起点。","hint":"蓝色在外侧，黄色作为中间长条。","checklist":["蓝色 2×4 ×4","黄色 2×4 ×2","方向与 PDF 第 1 页一致"]},
    {"title":"步骤 2","description":"继续加入 4 块蓝色 2×4 和 2 块黄色 2×4，沿同一方向延长剑身。","hint":"新增积木接在右侧，保持三条平行长线。","checklist":["蓝色 2×4 ×4","黄色 2×4 ×2","剑身继续保持平直"]},
    {"title":"步骤 3","description":"继续加入 4 块蓝色 2×4 和 2 块黄色 2×4，保持蓝色外侧、黄色中线。","hint":"黄色条要和前两步连续。","checklist":["蓝色 2×4 ×4","黄色 2×4 ×2","中线不断开"]},
    {"title":"步骤 4","description":"加入 2 块蓝色 2×4 和 1 块黄色 2×4，完成剑身长条。","hint":"这是剑身末端的收尾。","checklist":["蓝色 2×4 ×2","黄色 2×4 ×1","剑身方向与 PDF 第 4 页一致"]},
    {"title":"步骤 5","description":"加入 2 块蓝色 2×4，按 PDF 方向立起剑格竖梁。","hint":"两块蓝色积木垂直于剑身方向。","checklist":["蓝色 2×4 ×2","剑格竖梁位置正确"]},
    {"title":"步骤 6","description":"加入 4 块蓝色 2×4，加厚并延伸剑格竖梁。","hint":"注意前后两侧都要有蓝色竖向结构。","checklist":["蓝色 2×4 ×4","剑格厚度与 PDF 第 6 页一致"]},
    {"title":"步骤 7","description":"加入 6 块蓝色 2×4，搭出剑柄。","hint":"剑柄从剑格向右延伸。","checklist":["蓝色 2×4 ×6","剑柄方向正确"]},
    {"title":"步骤 8","description":"加入 2 块红色 2×4 薄板和 1 块黄色 2×4，开始搭建展示架横梁。","hint":"红色是薄板，不是普通高砖。","checklist":["红色 2×4 薄板 ×2","黄色 2×4 ×1","展示架与剑身分开"]},
    {"title":"步骤 9","description":"加入 8 块红色 2×4 薄板和 5 块黄色 2×4，延长展示架横梁。","hint":"红色薄板夹住黄色长条。","checklist":["红色 2×4 薄板 ×8","黄色 2×4 ×5","横梁长度与 PDF 第 9 页一致"]},
    {"title":"步骤 10","description":"加入 2 块黄色 2×2 和 10 块黄色 2×4，搭建两侧黄色支撑。","hint":"两侧黄色支撑要顶到剑身下方。","checklist":["黄色 2×2 ×2","黄色 2×4 ×10","左右支撑位置正确"]},
    {"title":"步骤 11","description":"加入 2 块红色 2×4 薄板和 2 块红色 2×4，加固左侧底座。","hint":"同时有薄板和普通红色 2×4。","checklist":["红色 2×4 薄板 ×2","红色 2×4 ×2","左侧底座与 PDF 一致"]},
    {"title":"步骤 12","description":"加入 2 块红色 2×4 薄板和 2 块红色 2×4，加固右侧底座。","hint":"右侧底座和第 11 步形成对应关系。","checklist":["红色 2×4 薄板 ×2","红色 2×4 ×2","右侧底座与 PDF 一致"]},
    {"title":"步骤 13","description":"加入 8 块红色 2×4 薄板，包边并完成两侧红色支撑。","hint":"红色薄板沿黄色支撑外侧包边。","checklist":["红色 2×4 薄板 ×8","两侧红色支撑完成"]},
    {"title":"步骤 14","description":"宝剑搭建完成，对照 PDF 第 14 页检查剑身、剑柄和展示架方向。","hint":"检查蓝色剑身、黄色中线、红色展示架的位置。","checklist":["剑身方向正确","展示架方向正确","整体与 PDF 第 14 页一致"]}
  ]$steps$::jsonb,
  updated_at = now()
WHERE l.id = 31
  AND l.course_id = 5
  AND l.title = '宝剑'
  AND l.lesson_type = 'building_3d';
