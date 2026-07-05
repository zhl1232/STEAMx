-- 3+ 课件100「电影院」补挂自托管 LDraw 模型，并让侧栏 steps 与 15 个 0 STEP 对齐。
-- 模型源：scripts/ldraw-models/duplo_cinema_steps.ldr
-- 打包产物：public/courses/ldraw/duplo_cinema_steps.mpd。

WITH lesson_payload AS (
  SELECT
    $steps$[
      {"title":"铺好影院地基","description":"先搭出电影院的长条底座和左右边界，确定建筑的占地范围。","hint":"底座要平直，左右两端保持对称。","checklist":["底座边线平直","左右边界对齐"]},
      {"title":"补齐右侧墙底","description":"在右侧继续补上墙脚砖，给侧墙留出稳定支撑。","hint":"墙脚要贴着底座边缘摆放。","checklist":["右侧墙脚连续","没有明显空隙"]},
      {"title":"搭高右侧墙体","description":"把右侧墙体逐层加高，形成影院侧面的高墙。","hint":"每一层都要压住下面的接缝。","checklist":["墙体竖直","砖块交错压缝"]},
      {"title":"装上右侧窗边","description":"在右侧墙面两边装上浅色窗边或装饰边，让墙面轮廓更明显。","hint":"两侧装饰条高度要一致。","checklist":["左右装饰条一样高","位置前后对齐"]},
      {"title":"封住右侧墙顶","description":"在右侧墙顶部补上横向砖，完成这一侧的上沿。","hint":"顶部一排要放平，别让墙面外扩。","checklist":["墙顶水平","侧墙稳固"]},
      {"title":"搭建中间地面","description":"回到中间区域铺上地面砖，连接右侧墙和影厅主体。","hint":"中间地面要和底座方向一致。","checklist":["地面砖排齐","和右侧墙连接"]},
      {"title":"加高中间台阶","description":"继续在中间区域叠第二层，做出影厅入口或台阶的高度变化。","hint":"上下两层边缘要对齐。","checklist":["第二层稳定","台阶边缘整齐"]},
      {"title":"继续抬高中间墙面","description":"把中间墙面再加高一层，为门洞和影厅轮廓做准备。","hint":"先检查前后方向，再往上叠。","checklist":["墙面不歪","高度逐步升高"]},
      {"title":"安装弧形门洞","description":"放上两个弧形件，做出电影院入口或放映厅的拱形轮廓。","hint":"两个弧形件要朝向一致。","checklist":["弧形件方向一致","左右位置对称"]},
      {"title":"搭建中央影厅墙","description":"在弧形件周围继续砌墙，让中央影厅主体成形。","hint":"围绕中线向上叠，保持墙面垂直。","checklist":["中央墙体竖直","门洞没有被挡住"]},
      {"title":"放置入口短墙","description":"在入口附近补上短墙和边柱，丰富电影院正面的层次。","hint":"短墙不要超出入口轮廓。","checklist":["入口仍然清楚","短墙位置对齐"]},
      {"title":"加高入口台面","description":"继续叠入口附近的砖块，让前部结构更牢固。","hint":"这一层要压住下面的接缝。","checklist":["前部结构稳","台面没有悬空"]},
      {"title":"砌左侧立柱","description":"在左侧搭出一组竖向立柱，和右侧高墙形成呼应。","hint":"立柱要一层层垂直向上。","checklist":["左侧立柱竖直","和右侧高度协调"]},
      {"title":"完成左侧顶部","description":"给左侧立柱加上顶部砖和装饰件，收完整个建筑外框。","hint":"顶部小件要放在正中，不要偏斜。","checklist":["顶部装饰居中","外框完整"]},
      {"title":"布置观影座位","description":"最后在前部摆好座位或装饰砖，检查电影院整体是否平稳。","hint":"完成后从正面和侧面各看一次。","checklist":["座位摆放整齐","建筑整体稳定"]}
    ]$steps$::jsonb AS steps,
    $steps3d$[
      {"title":"铺好影院地基","description":"搭出长条底座和左右边界。","partIds":[],"cameraHint":"top"},
      {"title":"补齐右侧墙底","description":"补上右侧墙脚。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭高右侧墙体","description":"逐层加高右侧高墙。","partIds":[],"cameraHint":"front"},
      {"title":"装上右侧窗边","description":"安装侧墙浅色窗边或装饰边。","partIds":[],"cameraHint":"side"},
      {"title":"封住右侧墙顶","description":"补齐右侧墙顶横向砖。","partIds":[],"cameraHint":"isometric"},
      {"title":"搭建中间地面","description":"铺设中间连接区域。","partIds":[],"cameraHint":"top"},
      {"title":"加高中间台阶","description":"叠出中间第二层台阶。","partIds":[],"cameraHint":"isometric"},
      {"title":"继续抬高中间墙面","description":"继续加高中央墙面。","partIds":[],"cameraHint":"front"},
      {"title":"安装弧形门洞","description":"放上两个弧形门洞件。","partIds":[],"cameraHint":"front"},
      {"title":"搭建中央影厅墙","description":"围绕门洞搭出影厅主体墙。","partIds":[],"cameraHint":"isometric"},
      {"title":"放置入口短墙","description":"补上入口附近短墙和边柱。","partIds":[],"cameraHint":"front"},
      {"title":"加高入口台面","description":"继续叠高入口前部结构。","partIds":[],"cameraHint":"isometric"},
      {"title":"砌左侧立柱","description":"搭出左侧竖向立柱。","partIds":[],"cameraHint":"front"},
      {"title":"完成左侧顶部","description":"加上左侧顶部砖和装饰件。","partIds":[],"cameraHint":"front"},
      {"title":"布置观影座位","description":"摆好前部座位或装饰砖，完成电影院。","partIds":[],"cameraHint":"isometric"}
    ]$steps3d$::jsonb AS steps3d
)
UPDATE public.course_lessons AS l
SET
  steps = lesson_payload.steps,
  content = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(l.content, '{}'::jsonb),
          '{building3d}',
          COALESCE(l.content->'building3d', '{}'::jsonb),
          true
        ),
        '{building3d,ldrawModelUrl}',
        to_jsonb('/courses/ldraw/duplo_cinema_steps.mpd'::text),
        true
      ),
      '{building3d,ldrawColorUrl}',
      to_jsonb('/courses/ldraw/LDConfig.ldr'::text),
      true
    ),
    '{building3d,steps3d}',
    lesson_payload.steps3d,
    true
  ),
  updated_at = now()
FROM lesson_payload
WHERE l.id = 42
  AND l.course_id = 5
  AND l.title = '电影院'
  AND l.lesson_type = 'building_3d';
