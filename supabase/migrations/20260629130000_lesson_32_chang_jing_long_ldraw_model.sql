-- 3+ 课件100「长颈龙」补挂自托管 LDraw 模型，steps3d 对齐 12 步搭建说明。
-- 模型源：scripts/ldraw-models/gen-3-chang-jing-long.mjs -> scripts/ldraw-models/3-chang-jing-long.ldr
-- 打包产物：public/courses/ldraw/3-chang-jing-long.mpd（12 个 0 STEP 驱动分步显隐）。

UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(l.content, '{}'::jsonb),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/3-chang-jing-long.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    $steps3d$[
      {"title":"搭建恐龙脚","description":"四块绿色弧面脚分别向上叠四层，黄绿交替的 2×2 积木拼出四条大长腿。","partIds":[],"cameraHint":"isometric"},
      {"title":"连接四肢","description":"四条腿上方压上一块绿色 6×12 大底板，把四肢连成一体。","partIds":[],"cameraHint":"top"},
      {"title":"立起拱门支架","description":"底板前后两端立起黄色拱门支架墙，为后面的滑梯管道留好圆孔。","partIds":[],"cameraHint":"front"},
      {"title":"拼滑梯管道","description":"四节直滑梯管相接，从前后两个黄色拱门的圆孔中穿过。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建恐龙尾巴","description":"左端滑梯向外、向下弯曲，一直接到地面，形成尾巴滑梯。","partIds":[],"cameraHint":"side"},
      {"title":"搭建滑梯入口","description":"右端安装红色平台板，并接上一节弯管作为入口滑梯。","partIds":[],"cameraHint":"back"},
      {"title":"拼恐龙脖子","description":"垂直向上拼接三节直管和两节弯管，搭出高耸的脖子滑梯。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建恐龙头部","description":"脖子顶端用黄色积木和红色嘴巴拼头部，装上带眼睛的印刷砖。","partIds":[],"cameraHint":"front"},
      {"title":"砌起身体墙壁","description":"直管道两侧砌起黄色与绿色 2×4 墙壁，围出恐龙身体。","partIds":[],"cameraHint":"isometric"},
      {"title":"连接恐龙背脊","description":"两面墙顶部用绿色积木连接，拼成平整的后背。","partIds":[],"cameraHint":"top"},
      {"title":"装饰后背","description":"后背后方叠上黄色和绿色的起伏积木，让背脊更有层次。","partIds":[],"cameraHint":"isometric"},
      {"title":"完成长颈龙","description":"长颈龙恐龙滑梯游乐场搭建完成，检查所有插口并对照成品图。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb,
    true
  ),
  updated_at = now()
WHERE l.id = 32
  AND l.course_id = 5
  AND l.title = '长颈龙'
  AND l.lesson_type = 'building_3d';
