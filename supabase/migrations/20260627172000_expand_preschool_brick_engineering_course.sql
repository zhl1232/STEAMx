-- 扩展学前大颗粒积木工程启蒙为 12 课时课程包。
-- 内容为原创学前 STEAM 搭建活动；仅参考公开教案常见结构（目标、材料、引导、观察、延伸）。
DO $$
DECLARE
  v_course_id bigint;
  v_lesson_id bigint;
  lesson record;
BEGIN
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE title = '小小积木工程师：学前大颗粒启蒙'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    INSERT INTO public.courses (
      title, description, image_url, tags, difficulty_stars, status, sort_order, steam_weights
    )
    VALUES (
      '小小积木工程师：学前大颗粒启蒙',
      '面向 3-6 岁孩子的 12 课时通用大颗粒积木课程包。围绕稳定、对称、轮子、支撑、坡道、平衡、路径、围合与表达，完成从小结构到小乐园的连续搭建。',
      '/projects/eng_models.webp',
      ARRAY['大颗粒积木','学前','工程启蒙','亲子','12课时'],
      1,
      'approved',
      18,
      '{"S":15,"T":5,"E":35,"A":25,"M":20}'::jsonb
    )
    RETURNING id INTO v_course_id;
  ELSE
    UPDATE public.courses
    SET
      description = '面向 3-6 岁孩子的 12 课时通用大颗粒积木课程包。围绕稳定、对称、轮子、支撑、坡道、平衡、路径、围合与表达，完成从小结构到小乐园的连续搭建。',
      image_url = '/projects/eng_models.webp',
      tags = ARRAY['大颗粒积木','学前','工程启蒙','亲子','12课时'],
      difficulty_stars = 1,
      status = 'approved',
      sort_order = 18,
      steam_weights = '{"S":15,"T":5,"E":35,"A":25,"M":20}'::jsonb
    WHERE id = v_course_id;
  END IF;

  FOR lesson IN
    SELECT *
    FROM (
      VALUES
      (
        '高高塔不倒',
        'building_3d',
        1,
        12,
        $steps$[
          {"title":"提出问题","description":"今天的问题是：怎样让高塔站得更稳？先让孩子观察一块窄积木和几块宽积木，猜猜哪一种更适合做底座。","hint":"先猜，再搭，再测试。","checklist":["说出自己的猜想","能指出宽和窄"]},
          {"title":"搭宽底座","description":"把 2 到 3 块大积木并排放平，做成宽宽的底座。轻轻推一推，确认底座不会滑走。","hint":"底座越宽，塔越不容易倒。","checklist":["底座放平了","轻推时不会马上倒"]},
          {"title":"叠上楼层","description":"把中等积木一层一层放在底座中间，鼓励孩子说出每层颜色和位置。","hint":"每层尽量压在中间，不要只压住角落。","checklist":["至少叠了 3 层","能说出一层的位置"]},
          {"title":"测试和改进","description":"用一根手指轻轻碰塔身，观察它是摇晃还是倒下。试着加宽底座或降低塔顶，再测试一次。","hint":"工程师会反复测试和改进。","checklist":["完成轻推测试","做过一次调整","能说出变稳了没有"]}
        ]$steps$::jsonb,
        $content${
          "summary":"搭一座不容易倒的高塔，感受宽底座和重心。",
          "learningGoals":["比较宽底座和窄底座的稳定性","用“高、矮、宽、窄、中间”等词描述结构","经历猜想、搭建、测试、改进的过程"],
          "teacherGuide":{
            "inquiryQuestion":"怎样让高塔站得更稳？",
            "prepare":["大颗粒长积木 6-8 块","小积木 1-2 块","平整桌面"],
            "guidePrompts":["哪一层最容易歪？","如果底座再宽一点，会发生什么？","塔倒了以后，你想先改哪里？"],
            "observe":["孩子是否能等待轮流搭建","是否能主动调整底座或楼层位置","是否能用方位词描述积木"],
            "extension":"用同样数量的积木搭两座塔，比一比哪座更高、哪座更稳。",
            "familyShare":"请孩子向家人介绍：我的塔为什么不容易倒。"
          },
          "building3d":{
            "parts":[
              {"id":"wide_base","name":"宽底座积木","color":"#2563eb","quantity":3},
              {"id":"middle_brick","name":"中间楼层积木","color":"#facc15","quantity":4},
              {"id":"top_flag","name":"塔顶小积木","color":"#ef4444","quantity":1}
            ],
            "steps3d":[
              {"title":"铺出宽底座","description":"先把几块宽积木并排放平，让塔有稳定的脚。","partIds":["wide_base"],"cameraHint":"isometric"},
              {"title":"叠上楼层","description":"把中间楼层放在底座中心，尽量上下对齐。","partIds":["middle_brick"],"cameraHint":"front"},
              {"title":"放上塔顶","description":"用小积木做塔顶，再从侧面检查有没有歪。","partIds":["top_flag"],"cameraHint":"side"},
              {"title":"观察稳定性","description":"看一看塔的底部是不是比顶部宽，想一想为什么更稳。","partIds":["wide_base"],"highlightNodeIds":["tower-base-left","tower-base-center","tower-base-right"],"cameraHint":"isometric"}
            ],
            "brickInstances":[
              {"id":"tower-base-left","partId":"wide_base","position":[-1.2,0.18,0],"scale":[1.5,0.35,1.2]},
              {"id":"tower-base-center","partId":"wide_base","position":[0,0.18,0],"scale":[1.5,0.35,1.2]},
              {"id":"tower-base-right","partId":"wide_base","position":[1.2,0.18,0],"scale":[1.5,0.35,1.2]},
              {"id":"tower-floor-1","partId":"middle_brick","position":[-0.45,0.7,0],"scale":[1.3,0.45,1]},
              {"id":"tower-floor-2","partId":"middle_brick","position":[0.45,1.2,0],"scale":[1.3,0.45,1]},
              {"id":"tower-floor-3","partId":"middle_brick","position":[-0.25,1.7,0],"scale":[1.1,0.45,0.9]},
              {"id":"tower-floor-4","partId":"middle_brick","position":[0.25,2.2,0],"scale":[0.95,0.45,0.85]},
              {"id":"tower-top","partId":"top_flag","position":[0,2.72,0],"scale":[0.55,0.45,0.55]}
            ]
          }
        }$content$::jsonb
      ),
      (
        '小车向前跑',
        'building_3d',
        2,
        15,
        $steps$[
          {"title":"认识车身和轮子","description":"把长积木、圆形积木分成两类：车身和会转的部分。请孩子用手指滚一滚圆形积木。","hint":"会滚动的形状更适合做轮子。","checklist":["能指出车身","能指出轮子"]},
          {"title":"左右装轮子","description":"把轮子放在车身两侧，观察左边和右边是不是差不多高、差不多靠前。","hint":"左右对称，小车更容易跑直。","checklist":["左边有轮子","右边有轮子","位置大致对齐"]},
          {"title":"加上驾驶座","description":"在车身上放一块小积木当驾驶座，请孩子想象谁坐在车里。","hint":"故事会让搭建更有目标。","checklist":["驾驶座不容易掉","能说出车里坐的是谁"]},
          {"title":"推行测试","description":"在桌上轻轻推小车，观察它是直直跑、转弯，还是卡住。每次只调整一个地方再试。","hint":"每次只改一个地方，更容易知道哪里变好了。","checklist":["做过推行测试","能说出跑得直不直","调整过轮子"]}
        ]$steps$::jsonb,
        $content${
          "summary":"搭一辆能向前推的小车，练习对称和简单测试。",
          "learningGoals":["认识轮子和车身的作用","观察左右对称对运动方向的影响","用测试结果改进作品"],
          "teacherGuide":{
            "inquiryQuestion":"怎样让小车跑得更直？",
            "prepare":["长积木 1-2 块","圆形积木或轮子 4 个","小积木 1 块"],
            "guidePrompts":["左边和右边一样吗？","如果一个轮子靠后，小车会怎样？","你想让谁坐上这辆车？"],
            "observe":["孩子是否能比较左右位置","是否能根据路线调整轮子","是否能进行角色想象"],
            "extension":"在桌面贴一条纸胶带当道路，让小车沿道路前进。",
            "familyShare":"请孩子演示小车测试，说一说自己调整了哪里。"
          },
          "building3d":{
            "parts":[
              {"id":"car_body","name":"长车身积木","color":"#22c55e","quantity":1},
              {"id":"wheel","name":"圆形轮子","color":"#111827","quantity":4},
              {"id":"seat","name":"驾驶座小积木","color":"#f97316","quantity":1}
            ],
            "steps3d":[
              {"title":"放好车身","description":"先放一块长积木当车身，确认前后方向。","partIds":["car_body"],"cameraHint":"isometric"},
              {"title":"左右装轮子","description":"把四个轮子放到车身两侧，左右尽量对齐。","partIds":["wheel"],"cameraHint":"front"},
              {"title":"加上驾驶座","description":"把驾驶座放在车身上方中央，让小车保持平衡。","partIds":["seat"],"cameraHint":"side"},
              {"title":"检查对称","description":"从正面看，左右轮子是不是差不多高。","partIds":["wheel"],"highlightNodeIds":["wheel-fl","wheel-fr","wheel-bl","wheel-br"],"cameraHint":"front"}
            ],
            "brickInstances":[
              {"id":"car-body","partId":"car_body","position":[0,0.55,0],"scale":[3.8,0.5,1.5]},
              {"id":"wheel-fl","partId":"wheel","shape":"cylinder","position":[-1.35,0.18,-1.02],"scale":[1,1,1],"rotation":[1.5708,0,0]},
              {"id":"wheel-fr","partId":"wheel","shape":"cylinder","position":[-1.35,0.18,1.02],"scale":[1,1,1],"rotation":[1.5708,0,0]},
              {"id":"wheel-bl","partId":"wheel","shape":"cylinder","position":[1.35,0.18,-1.02],"scale":[1,1,1],"rotation":[1.5708,0,0]},
              {"id":"wheel-br","partId":"wheel","shape":"cylinder","position":[1.35,0.18,1.02],"scale":[1,1,1],"rotation":[1.5708,0,0]},
              {"id":"car-seat","partId":"seat","position":[0.35,1.15,0],"scale":[1.1,0.65,1.05]}
            ]
          }
        }$content$::jsonb
      ),
      (
        '小桥能通过',
        'building_3d',
        3,
        15,
        $steps$[
          {"title":"搭两个桥墩","description":"在左右两边各叠一小摞积木，中间留出洞洞，让小车或小人偶可以通过。","hint":"两个桥墩要差不多高，桥面才平。","checklist":["左边有桥墩","右边有桥墩","中间有空位"]},
          {"title":"放上桥面","description":"把长积木横放在两个桥墩上，像盖上一块平平的路。","hint":"桥面两端都要压在桥墩上。","checklist":["桥面压住左桥墩","桥面压住右桥墩"]},
          {"title":"通过测试","description":"让小车或小积木从桥洞下面通过，再试着从桥面上通过。","hint":"桥不只要好看，还要能完成任务。","checklist":["桥洞下能通过","桥面上能停住一个小物件"]},
          {"title":"加支撑","description":"如果桥会摇，就在桥墩旁边加一块支撑积木，再测试一次。","hint":"加支撑是很常见的工程改进。","checklist":["发现过摇晃或不稳","尝试加过支撑"]}
        ]$steps$::jsonb,
        $content${
          "summary":"搭一座能通过的小桥，理解支撑、跨度和任务测试。",
          "learningGoals":["知道桥墩支撑桥面","比较桥洞宽窄是否能通过","尝试加固摇晃的结构"],
          "teacherGuide":{
            "inquiryQuestion":"小桥怎样才能让车通过又不塌？",
            "prepare":["桥墩积木 4-6 块","长积木 1-2 块","小车或小人偶 1 个"],
            "guidePrompts":["桥洞够宽吗？","桥面两头都压住了吗？","哪里最摇晃？"],
            "observe":["孩子是否能保留中间通道","是否能发现两端支撑","是否能用小车完成测试"],
            "extension":"把桥洞变宽，再想办法让桥面不塌。",
            "familyShare":"请孩子介绍小车从桥上和桥下经过的路线。"
          },
          "building3d":{
            "parts":[
              {"id":"pier","name":"桥墩积木","color":"#3b82f6","quantity":4},
              {"id":"deck","name":"桥面长积木","color":"#facc15","quantity":1},
              {"id":"support","name":"加固支撑积木","color":"#ef4444","quantity":2}
            ],
            "steps3d":[
              {"title":"搭两个桥墩","description":"左右各搭一个桥墩，中间留出通道。","partIds":["pier"],"cameraHint":"front"},
              {"title":"放上桥面","description":"把长桥面横跨在两个桥墩上。","partIds":["deck"],"cameraHint":"isometric"},
              {"title":"加固两侧","description":"在桥墩旁加支撑，让桥更稳。","partIds":["support"],"cameraHint":"front"},
              {"title":"观察桥洞","description":"看一看桥洞和桥面，想象小车从哪里通过。","partIds":["pier","deck","support"],"highlightNodeIds":["bridge-gap-left","bridge-gap-right"],"cameraHint":"front"}
            ],
            "brickInstances":[
              {"id":"bridge-left-low","partId":"pier","position":[-1.55,0.35,0],"scale":[0.75,0.7,1]},
              {"id":"bridge-right-low","partId":"pier","position":[1.55,0.35,0],"scale":[0.75,0.7,1]},
              {"id":"bridge-left-high","partId":"pier","position":[-1.55,1.05,0],"scale":[0.75,0.7,1]},
              {"id":"bridge-right-high","partId":"pier","position":[1.55,1.05,0],"scale":[0.75,0.7,1]},
              {"id":"bridge-deck","partId":"deck","position":[0,1.58,0],"scale":[4.1,0.35,1.1]},
              {"id":"bridge-support-left","partId":"support","position":[-2.2,0.72,0],"scale":[0.55,1.35,0.75]},
              {"id":"bridge-support-right","partId":"support","position":[2.2,0.72,0],"scale":[0.55,1.35,0.75]},
              {"id":"bridge-gap-left","partId":"guide","position":[-0.55,0.05,0],"scale":[0.08,0.08,0.08],"color":"#93c5fd"},
              {"id":"bridge-gap-right","partId":"guide","position":[0.55,0.05,0],"scale":[0.08,0.08,0.08],"color":"#93c5fd"}
            ]
          }
        }$content$::jsonb
      ),
      (
        '动物朋友的家',
        'building_3d',
        4,
        15,
        $steps$[
          {"title":"选择住户","description":"请孩子选一个小玩具、纸片动物或想象中的动物，说说它需要什么样的家。","hint":"先想住户，再搭房子。","checklist":["选好了动物朋友","能说出它喜欢什么"]},
          {"title":"围出墙和门","description":"用积木围出左墙、右墙和后墙，前面留一个门口。","hint":"门口要够宽，动物朋友才能进去。","checklist":["有左墙","有右墙","有后墙","前面留了门"]},
          {"title":"盖上屋顶","description":"把长积木或平板放在墙上方当屋顶。屋顶可以平平的，也可以一边高一边低。","hint":"屋顶要压住墙，不要挡住门。","checklist":["屋顶放上去了","门口没有被挡住"]},
          {"title":"讲述这个家","description":"把动物放进去，说一句：这里是门、这里是床、这里可以玩。","hint":"表达结构和用途，也是学习的一部分。","checklist":["动物能进家","能介绍 2 个地方"]}
        ]$steps$::jsonb,
        $content${
          "summary":"给动物朋友搭一个有墙、有门、有屋顶的家，练习围合和表达。",
          "learningGoals":["理解围合、入口和屋顶的基本空间关系","用作品讲述一个简单场景","在限制条件下保留入口"],
          "teacherGuide":{
            "inquiryQuestion":"怎样让动物朋友住进去，还能从门口出来？",
            "prepare":["墙面积木 5-8 块","屋顶长积木 1-2 块","动物玩具或纸片 1 个"],
            "guidePrompts":["门在哪里？","屋顶会不会挡住门？","动物朋友睡在哪里？"],
            "observe":["孩子是否先计划住户需求","是否能留出入口","是否能讲述空间用途"],
            "extension":"给动物朋友再加一个院子或食物区。",
            "familyShare":"请孩子带着动物朋友讲一个回家的故事。"
          },
          "building3d":{
            "parts":[
              {"id":"wall","name":"墙面积木","color":"#60a5fa","quantity":5},
              {"id":"roof","name":"屋顶积木","color":"#f97316","quantity":2},
              {"id":"animal","name":"动物朋友位置","color":"#a855f7","quantity":1},
              {"id":"door","name":"门口标记","color":"#22c55e","quantity":1}
            ],
            "steps3d":[
              {"title":"放好动物朋友","description":"先想好小动物会住在哪里。","partIds":["animal"],"cameraHint":"isometric"},
              {"title":"围出墙和门","description":"搭出左右和后面的墙，前面留门口。","partIds":["wall","door"],"cameraHint":"front"},
              {"title":"盖上屋顶","description":"把屋顶压在墙上方，让小屋像一个完整的家。","partIds":["roof"],"cameraHint":"side"},
              {"title":"讲述空间","description":"指一指门、屋顶和动物的位置，说出它们的用途。","partIds":["animal","door","roof"],"highlightNodeIds":["animal-place","front-door","roof-left","roof-right"],"cameraHint":"isometric"}
            ],
            "brickInstances":[
              {"id":"animal-place","partId":"animal","shape":"cylinder","position":[0,0.32,0],"scale":[0.75,0.75,0.75]},
              {"id":"left-wall-back","partId":"wall","position":[-1.25,0.55,0.45],"scale":[0.55,1.1,1]},
              {"id":"left-wall-front","partId":"wall","position":[-1.25,0.55,-0.55],"scale":[0.55,1.1,1]},
              {"id":"right-wall-back","partId":"wall","position":[1.25,0.55,0.45],"scale":[0.55,1.1,1]},
              {"id":"right-wall-front","partId":"wall","position":[1.25,0.55,-0.55],"scale":[0.55,1.1,1]},
              {"id":"back-wall","partId":"wall","position":[0,0.55,1.05],"scale":[2.8,1.1,0.45]},
              {"id":"front-door","partId":"door","position":[0,0.12,-1.1],"scale":[0.9,0.22,0.18]},
              {"id":"roof-left","partId":"roof","position":[-0.7,1.45,0.2],"scale":[1.8,0.35,1.5],"rotation":[0,0,0.28]},
              {"id":"roof-right","partId":"roof","position":[0.7,1.45,0.2],"scale":[1.8,0.35,1.5],"rotation":[0,0,-0.28]}
            ]
          }
        }$content$::jsonb
      ),
      (
        '坡道滚滚球',
        'building_3d',
        5,
        15,
        $steps$[
          {"title":"提出坡道问题","description":"今天让小球或圆形积木滚起来：坡道高一点和低一点，滚得会一样快吗？","hint":"先让孩子做预测。","checklist":["说出高坡或低坡","做出一个预测"]},
          {"title":"搭出低坡道","description":"用一块积木垫高斜坡的一端，把长积木斜放上去。","hint":"坡道要接触桌面，圆形积木才容易滚下来。","checklist":["有垫高的一端","坡道没有悬空太多"]},
          {"title":"加高再比较","description":"再加一块支撑积木，让坡道变高。比较小球滚得远不远、快不快。","hint":"只改变坡道高度，比较更清楚。","checklist":["试过低坡","试过高坡","能说出不同"]},
          {"title":"放上终点门","description":"在坡道末端摆两块积木当终点门，让小球滚进门里。","hint":"工程挑战有目标，测试更有趣。","checklist":["摆出终点门","小球能滚向终点"]}
        ]$steps$::jsonb,
        $content${
          "summary":"搭坡道让圆形积木滚动，比较高度和运动距离。",
          "learningGoals":["观察坡度变化对滚动的影响","理解起点、坡道、终点的路径关系","用远、近、快、慢描述结果"],
          "teacherGuide":{
            "inquiryQuestion":"坡道高一点，小球会滚得更远吗？",
            "prepare":["长积木 1-2 块","支撑积木 2-3 块","圆形积木或小球 1 个","终点积木 2 块"],
            "guidePrompts":["你觉得哪次会滚得更远？","坡道太陡会发生什么？","终点门要放在哪里？"],
            "observe":["孩子是否能等待同一颗球重复测试","是否能比较远近","是否能调整终点位置"],
            "extension":"用纸条标记每次滚到的位置，排出远近顺序。",
            "familyShare":"请孩子在家找一个安全斜面，比较不同高度的滚动。"
          },
          "building3d":{
            "parts":[
              {"id":"ramp","name":"坡道长积木","color":"#facc15","quantity":1},
              {"id":"support","name":"支撑积木","color":"#3b82f6","quantity":2},
              {"id":"ball","name":"滚动圆形积木","color":"#ef4444","quantity":1},
              {"id":"gate","name":"终点门积木","color":"#22c55e","quantity":2}
            ],
            "steps3d":[
              {"title":"搭低坡道","description":"先用支撑积木垫起坡道的一端。","partIds":["support","ramp"],"cameraHint":"side"},
              {"title":"放上小球","description":"把圆形积木放在坡道高的一端。","partIds":["ball"],"cameraHint":"isometric"},
              {"title":"摆出终点门","description":"在坡道末端摆出终点门。","partIds":["gate"],"cameraHint":"front"},
              {"title":"比较高度","description":"观察支撑越高，坡道越陡。","partIds":["support","ramp"],"highlightNodeIds":["ramp-board","ramp-support-high"],"cameraHint":"side"}
            ],
            "brickInstances":[
              {"id":"ramp-support-low","partId":"support","position":[-1.4,0.28,0],"scale":[0.7,0.55,1]},
              {"id":"ramp-support-high","partId":"support","position":[-1.4,0.82,0],"scale":[0.7,0.55,1]},
              {"id":"ramp-board","partId":"ramp","position":[0,1.12,0],"scale":[4.2,0.25,1],"rotation":[0,0,-0.28]},
              {"id":"ramp-ball","partId":"ball","shape":"cylinder","position":[-1.42,1.78,0],"scale":[0.55,0.55,0.55]},
              {"id":"gate-left","partId":"gate","position":[2.2,0.38,-0.55],"scale":[0.35,0.75,0.35]},
              {"id":"gate-right","partId":"gate","position":[2.2,0.38,0.55],"scale":[0.35,0.75,0.35]}
            ]
          }
        }$content$::jsonb
      ),
      (
        '齿轮朋友转一转',
        'building_3d',
        6,
        15,
        $steps$[
          {"title":"认识会转的圆盘","description":"找两个圆形积木当齿轮朋友，用手指分别转一转。","hint":"学前阶段先体验相邻圆盘一起动，不要求真实齿轮咬合。","checklist":["能转动圆形积木","能指出两个圆盘"]},
          {"title":"摆近一点","description":"把两个圆形积木摆近，让它们像互相碰到的朋友。转动一个，观察另一个方向。","hint":"太远就碰不到，太近可能卡住。","checklist":["两个圆盘靠近了","能说出有没有卡住"]},
          {"title":"加上把手","description":"在一个圆盘旁边加一块小积木当把手，让孩子用把手带动转动。","hint":"把手让动作更容易被看见。","checklist":["把手装好了","能用手拨动"]},
          {"title":"做方向游戏","description":"转左边的圆盘，请孩子观察右边是跟着转、卡住，还是没有动。","hint":"重点是观察和描述。","checklist":["做过转动测试","能说出观察结果"]}
        ]$steps$::jsonb,
        $content${
          "summary":"用圆形积木体验转动和相邻部件的关系。",
          "learningGoals":["认识旋转运动","尝试调整两个圆形部件的距离","用转、卡住、跟着动描述现象"],
          "teacherGuide":{
            "inquiryQuestion":"两个圆形积木靠近时，会不会一起动？",
            "prepare":["圆形积木 2-3 个","底板或长积木 1 块","小把手积木 1 块"],
            "guidePrompts":["它们离得太远会怎样？","转一个，另一个有没有变化？","哪里卡住了？"],
            "observe":["孩子是否能轻柔转动","是否能调整距离","是否能描述方向或状态"],
            "extension":"尝试三个圆形积木排成一排，观察中间的作用。",
            "familyShare":"请孩子用“转一转、停一停”给家人表演。"
          },
          "building3d":{
            "parts":[
              {"id":"base","name":"底板积木","color":"#94a3b8","quantity":1},
              {"id":"gear","name":"圆形齿轮朋友","color":"#38bdf8","quantity":2},
              {"id":"handle","name":"转动把手","color":"#f97316","quantity":1}
            ],
            "steps3d":[
              {"title":"放好底板","description":"底板让圆形部件有固定位置。","partIds":["base"],"cameraHint":"top"},
              {"title":"摆上圆盘","description":"两个圆形朋友靠近摆放。","partIds":["gear"],"cameraHint":"front"},
              {"title":"装上把手","description":"给一个圆盘加上把手，方便拨动。","partIds":["handle"],"cameraHint":"isometric"},
              {"title":"观察距离","description":"看两个圆盘是不是靠得太远或太近。","partIds":["gear"],"highlightNodeIds":["gear-left","gear-right"],"cameraHint":"top"}
            ],
            "brickInstances":[
              {"id":"gear-base","partId":"base","position":[0,0.12,0],"scale":[3.2,0.25,1.6]},
              {"id":"gear-left","partId":"gear","shape":"cylinder","position":[-0.7,0.55,0],"scale":[0.85,0.85,0.22],"rotation":[1.5708,0,0]},
              {"id":"gear-right","partId":"gear","shape":"cylinder","position":[0.7,0.55,0],"scale":[0.85,0.85,0.22],"rotation":[1.5708,0,0]},
              {"id":"gear-handle","partId":"handle","position":[-1.18,1.18,0],"scale":[0.25,0.75,0.25],"rotation":[0,0,0.7]}
            ]
          }
        }$content$::jsonb
      ),
      (
        '跷跷板平不平',
        'building_3d',
        7,
        15,
        $steps$[
          {"title":"找到中间支点","description":"把一块小积木放在中间当支点，再把长积木横放上去。","hint":"支点在中间，跷跷板更容易平。","checklist":["支点在中间附近","长积木能放上去"]},
          {"title":"两边放同样多","description":"在左右两边各放一块小积木，观察跷跷板是不是比较平。","hint":"同样多，比较容易平衡。","checklist":["左边有积木","右边有积木","能观察高低"]},
          {"title":"改变一边重量","description":"只在一边多放一块，看看哪边低下去。","hint":"重的一边会往下。","checklist":["改变了一边","能说出哪边低"]},
          {"title":"试着调回平衡","description":"移动积木的位置，或者给另一边也加一块，让跷跷板尽量平。","hint":"可以移动，也可以增减。","checklist":["尝试调平","说出用了什么办法"]}
        ]$steps$::jsonb,
        $content${
          "summary":"搭跷跷板体验支点、左右和简单平衡。",
          "learningGoals":["认识支点和左右两边","观察重量变化造成的高低变化","尝试用移动或增减积木恢复平衡"],
          "teacherGuide":{
            "inquiryQuestion":"怎样让跷跷板变平？",
            "prepare":["长积木 1 块","支点小积木 1 块","小积木 3-4 块"],
            "guidePrompts":["哪边更低？","支点如果不在中间会怎样？","你想移动哪一块？"],
            "observe":["孩子是否能比较左右","是否能根据结果调整","是否愿意反复尝试"],
            "extension":"让两个不同大小的小玩具坐上跷跷板，想办法调平。",
            "familyShare":"请孩子演示“重的一边往下”。"
          },
          "building3d":{
            "parts":[
              {"id":"pivot","name":"中间支点","color":"#ef4444","quantity":1},
              {"id":"beam","name":"跷跷板长积木","color":"#facc15","quantity":1},
              {"id":"rider","name":"两边小积木","color":"#3b82f6","quantity":3}
            ],
            "steps3d":[
              {"title":"放支点","description":"支点放在中间。","partIds":["pivot"],"cameraHint":"front"},
              {"title":"放长板","description":"长积木横放在支点上。","partIds":["beam"],"cameraHint":"front"},
              {"title":"两边加小积木","description":"左右两边各放一个小积木。","partIds":["rider"],"cameraHint":"isometric"},
              {"title":"比较高低","description":"观察哪边更低，思考怎样调平。","partIds":["rider"],"highlightNodeIds":["rider-left","rider-right","rider-extra"],"cameraHint":"front"}
            ],
            "brickInstances":[
              {"id":"seesaw-pivot","partId":"pivot","position":[0,0.32,0],"scale":[0.55,0.65,0.8]},
              {"id":"seesaw-beam","partId":"beam","position":[0,0.82,0],"scale":[4,0.25,0.75],"rotation":[0,0,-0.12]},
              {"id":"rider-left","partId":"rider","position":[-1.35,1.05,0],"scale":[0.45,0.45,0.45]},
              {"id":"rider-right","partId":"rider","position":[1.15,0.77,0],"scale":[0.45,0.45,0.45]},
              {"id":"rider-extra","partId":"rider","position":[1.65,0.72,0],"scale":[0.45,0.45,0.45]}
            ]
          }
        }$content$::jsonb
      ),
      (
        '迷宫找路线',
        'building_3d',
        8,
        15,
        $steps$[
          {"title":"摆出起点和终点","description":"用两种颜色标出起点和终点，请孩子用手指从起点走到终点。","hint":"先有目标，再设计路线。","checklist":["有起点","有终点","能用手指走路线"]},
          {"title":"搭第一条墙","description":"用长积木摆出一面墙，挡住最直接的路。","hint":"墙是为了让路线更有趣，不是完全堵死。","checklist":["摆出一面墙","还留有通路"]},
          {"title":"加转弯","description":"再放几块积木，让路线需要转弯。请孩子说“向前、转弯、到终点”。","hint":"路线词能帮助孩子计划动作。","checklist":["路线有转弯","能说出前进或转弯"]},
          {"title":"测试迷宫","description":"用小车或小动物走迷宫，如果卡住，就移动一块墙。","hint":"卡住就是路线需要改进。","checklist":["测试过路线","卡住时调整过墙"]}
        ]$steps$::jsonb,
        $content${
          "summary":"搭一个有起点、终点和转弯的简单迷宫，练习路径规划。",
          "learningGoals":["理解起点、终点和障碍物","用方向词描述路径","测试并调整路线"],
          "teacherGuide":{
            "inquiryQuestion":"怎样让小动物绕过墙走到终点？",
            "prepare":["长积木 5-8 块","起点/终点颜色积木各 1 块","小车或小动物 1 个"],
            "guidePrompts":["哪里是起点？哪里是终点？","这条墙有没有完全堵住路？","下一步向前还是转弯？"],
            "observe":["孩子是否能保留通路","是否能用方向词表达","是否能在卡住时调整"],
            "extension":"邀请家人走你的迷宫，再根据反馈改一块墙。",
            "familyShare":"请孩子用手指带家人走完整条路线。"
          },
          "building3d":{
            "parts":[
              {"id":"start","name":"起点积木","color":"#22c55e","quantity":1},
              {"id":"finish","name":"终点积木","color":"#ef4444","quantity":1},
              {"id":"wall","name":"迷宫墙","color":"#3b82f6","quantity":6},
              {"id":"walker","name":"行走小车","color":"#f97316","quantity":1}
            ],
            "steps3d":[
              {"title":"标出起点终点","description":"先放起点和终点。","partIds":["start","finish"],"cameraHint":"top"},
              {"title":"摆墙","description":"用墙挡住直线路线。","partIds":["wall"],"cameraHint":"top"},
              {"title":"放入小车","description":"小车从起点出发。","partIds":["walker"],"cameraHint":"isometric"},
              {"title":"观察路线","description":"沿着空出来的路线走到终点。","partIds":["start","finish","wall","walker"],"highlightNodeIds":["maze-start","maze-finish"],"cameraHint":"top"}
            ],
            "brickInstances":[
              {"id":"maze-start","partId":"start","position":[-2.1,0.15,-1.25],"scale":[0.5,0.3,0.5]},
              {"id":"maze-finish","partId":"finish","position":[2.1,0.15,1.25],"scale":[0.5,0.3,0.5]},
              {"id":"maze-wall-1","partId":"wall","position":[-0.7,0.35,-1.25],"scale":[1.8,0.7,0.25]},
              {"id":"maze-wall-2","partId":"wall","position":[0.55,0.35,-0.25],"scale":[0.25,0.7,1.8]},
              {"id":"maze-wall-3","partId":"wall","position":[-1.45,0.35,0.25],"scale":[0.25,0.7,1.6]},
              {"id":"maze-wall-4","partId":"wall","position":[0.7,0.35,1.1],"scale":[1.8,0.7,0.25]},
              {"id":"maze-wall-5","partId":"wall","position":[1.65,0.35,0.25],"scale":[0.25,0.7,1.25]},
              {"id":"maze-wall-6","partId":"wall","position":[-0.25,0.35,0.65],"scale":[1.25,0.7,0.25]},
              {"id":"maze-walker","partId":"walker","position":[-2.1,0.45,-0.55],"scale":[0.5,0.5,0.5]}
            ]
          }
        }$content$::jsonb
      ),
      (
        '小花园有规律',
        'building_3d',
        9,
        12,
        $steps$[
          {"title":"选两种颜色","description":"请孩子选择两种颜色当花朵，比如红花和黄花。","hint":"两种颜色更容易看出规律。","checklist":["选了两种颜色","能说出颜色名"]},
          {"title":"排出 ABAB","description":"按红、黄、红、黄的顺序摆出一排花。请孩子读出颜色顺序。","hint":"重复出现就是规律。","checklist":["摆出至少 4 朵","能读出顺序"]},
          {"title":"加上小树","description":"在花园后面搭两棵小树，让花园更像一个场景。","hint":"场景可以帮助孩子表达用途。","checklist":["有花朵","有小树"]},
          {"title":"补下一朵","description":"挡住最后一朵，问孩子下一朵应该是什么颜色，再摆出来验证。","hint":"能预测，说明看懂了规律。","checklist":["尝试预测下一朵","说出理由"]}
        ]$steps$::jsonb,
        $content${
          "summary":"用积木搭小花园，练习颜色规律和预测。",
          "learningGoals":["识别 ABAB 重复规律","用颜色词描述序列","尝试预测下一项"],
          "teacherGuide":{
            "inquiryQuestion":"下一朵花应该是什么颜色？",
            "prepare":["两种颜色小积木各 3-4 块","绿色积木 2-3 块","底板或桌面"],
            "guidePrompts":["现在的顺序是什么？","下一朵和哪一朵一样？","如果加第三种颜色，会怎样排？"],
            "observe":["孩子是否能保持顺序","是否能口头读出规律","是否能预测下一块"],
            "extension":"挑战 AAB 或 ABB 规律，例如红红黄、红红黄。",
            "familyShare":"请孩子让家人猜下一朵花的颜色。"
          },
          "building3d":{
            "parts":[
              {"id":"red_flower","name":"红色花朵","color":"#ef4444","quantity":3},
              {"id":"yellow_flower","name":"黄色花朵","color":"#facc15","quantity":3},
              {"id":"tree","name":"小树","color":"#22c55e","quantity":2},
              {"id":"base","name":"花园底座","color":"#84cc16","quantity":1}
            ],
            "steps3d":[
              {"title":"铺花园底座","description":"先放一块绿色底座。","partIds":["base"],"cameraHint":"isometric"},
              {"title":"摆红黄花朵","description":"按红、黄、红、黄摆出规律。","partIds":["red_flower","yellow_flower"],"cameraHint":"front"},
              {"title":"加小树","description":"在后面放两棵小树。","partIds":["tree"],"cameraHint":"isometric"},
              {"title":"预测下一朵","description":"看规律，想想下一朵是什么颜色。","partIds":["red_flower","yellow_flower"],"highlightNodeIds":["flower-red-3"],"cameraHint":"top"}
            ],
            "brickInstances":[
              {"id":"garden-base","partId":"base","position":[0,0.08,0],"scale":[4.4,0.18,2]},
              {"id":"flower-red-1","partId":"red_flower","position":[-1.7,0.35,-0.45],"scale":[0.35,0.55,0.35]},
              {"id":"flower-yellow-1","partId":"yellow_flower","position":[-1.0,0.35,-0.45],"scale":[0.35,0.55,0.35]},
              {"id":"flower-red-2","partId":"red_flower","position":[-0.3,0.35,-0.45],"scale":[0.35,0.55,0.35]},
              {"id":"flower-yellow-2","partId":"yellow_flower","position":[0.4,0.35,-0.45],"scale":[0.35,0.55,0.35]},
              {"id":"flower-red-3","partId":"red_flower","position":[1.1,0.35,-0.45],"scale":[0.35,0.55,0.35]},
              {"id":"flower-yellow-3","partId":"yellow_flower","position":[1.8,0.35,-0.45],"scale":[0.35,0.55,0.35]},
              {"id":"tree-left","partId":"tree","position":[-1.35,0.75,0.65],"scale":[0.55,1.25,0.55]},
              {"id":"tree-right","partId":"tree","position":[1.35,0.75,0.65],"scale":[0.55,1.25,0.55]}
            ]
          }
        }$content$::jsonb
      ),
      (
        '吊车抬高高',
        'building_3d',
        10,
        15,
        $steps$[
          {"title":"搭稳底座","description":"先用几块积木搭一个宽底座，让吊车不会一抬东西就倒。","hint":"吊车越高，底座越要稳。","checklist":["底座够宽","轻推不容易倒"]},
          {"title":"竖起立柱","description":"在底座中间竖起一根柱子，可以由几块积木叠成。","hint":"柱子要压在底座中间。","checklist":["立柱在中间","不会明显歪"]},
          {"title":"伸出吊臂","description":"把长积木横着伸出去当吊臂，观察哪边变重。","hint":"伸得越远，越需要底座帮忙。","checklist":["有吊臂","能指出伸出的方向"]},
          {"title":"挂上小货物","description":"用小积木当货物，放在吊臂末端下方，讲一讲吊车要把它送到哪里。","hint":"如果吊车倒了，先加宽底座。","checklist":["货物放好了","尝试过加固"]}
        ]$steps$::jsonb,
        $content${
          "summary":"搭一个简易吊车，体验高结构、伸出部分和稳定底座。",
          "learningGoals":["理解高结构需要稳定底座","观察伸出吊臂带来的倾倒风险","用加宽或加重底座改进作品"],
          "teacherGuide":{
            "inquiryQuestion":"吊臂伸出去以后，怎样不让吊车倒？",
            "prepare":["底座积木 3-4 块","柱子积木 3-5 块","长积木 1 块","小货物积木 1 块"],
            "guidePrompts":["吊车往哪边倒？","底座还能怎么加宽？","货物越远会怎样？"],
            "observe":["孩子是否能发现倾倒方向","是否能主动加固底座","是否能讲述吊车任务"],
            "extension":"改变吊臂长度，比一比哪种更容易倒。",
            "familyShare":"请孩子解释：为什么吊车脚下要宽。"
          },
          "building3d":{
            "parts":[
              {"id":"base","name":"吊车底座","color":"#2563eb","quantity":3},
              {"id":"tower","name":"吊车立柱","color":"#facc15","quantity":4},
              {"id":"arm","name":"吊车吊臂","color":"#f97316","quantity":1},
              {"id":"load","name":"小货物","color":"#ef4444","quantity":1}
            ],
            "steps3d":[
              {"title":"搭底座","description":"宽底座让吊车站稳。","partIds":["base"],"cameraHint":"isometric"},
              {"title":"竖立柱","description":"立柱叠在底座中间。","partIds":["tower"],"cameraHint":"front"},
              {"title":"伸吊臂","description":"吊臂向一边伸出去。","partIds":["arm"],"cameraHint":"side"},
              {"title":"挂货物","description":"货物在吊臂末端下方。","partIds":["load"],"highlightNodeIds":["crane-load"],"cameraHint":"isometric"}
            ],
            "brickInstances":[
              {"id":"crane-base-left","partId":"base","position":[-0.9,0.18,0],"scale":[1.4,0.35,1.25]},
              {"id":"crane-base-center","partId":"base","position":[0.2,0.18,0],"scale":[1.4,0.35,1.25]},
              {"id":"crane-base-right","partId":"base","position":[1.3,0.18,0],"scale":[1.4,0.35,1.25]},
              {"id":"crane-tower-1","partId":"tower","position":[0,0.65,0],"scale":[0.65,0.6,0.65]},
              {"id":"crane-tower-2","partId":"tower","position":[0,1.2,0],"scale":[0.65,0.6,0.65]},
              {"id":"crane-tower-3","partId":"tower","position":[0,1.75,0],"scale":[0.65,0.6,0.65]},
              {"id":"crane-tower-4","partId":"tower","position":[0,2.3,0],"scale":[0.65,0.6,0.65]},
              {"id":"crane-arm","partId":"arm","position":[1.15,2.65,0],"scale":[2.8,0.3,0.45]},
              {"id":"crane-load","partId":"load","position":[2.35,1.62,0],"scale":[0.55,0.55,0.55]}
            ]
          }
        }$content$::jsonb
      ),
      (
        '旋转小风车',
        'building_3d',
        11,
        15,
        $steps$[
          {"title":"搭一个支架","description":"先搭一个能站稳的小支架，给风车一个中心位置。","hint":"支架不稳，叶片一转就会倒。","checklist":["支架能站稳","中心位置找到了"]},
          {"title":"做十字叶片","description":"用两根长积木交叉摆成十字，观察四个方向是不是差不多长。","hint":"四边差不多长，看起来更平衡。","checklist":["有十字形","四边长度接近"]},
          {"title":"装到中心","description":"把十字叶片放在支架前面，想象它可以绕中心转。","hint":"真实转动需要轴，这里先理解中心和叶片。","checklist":["叶片对准中心","能指出中心"]},
          {"title":"吹风表演","description":"用嘴轻轻吹或用手转动，讲一讲风从哪里来、叶片往哪里动。","hint":"轻轻吹，注意安全距离。","checklist":["做过轻吹或手转","能说出方向"]}
        ]$steps$::jsonb,
        $content${
          "summary":"搭一个十字风车，认识中心、叶片和旋转方向。",
          "learningGoals":["认识中心和四向叶片","比较叶片长短对平衡外观的影响","用方向词描述旋转"],
          "teacherGuide":{
            "inquiryQuestion":"风车的叶片为什么要围着中心？",
            "prepare":["支架积木 3-4 块","长条积木 2 块","中心小积木 1 块"],
            "guidePrompts":["中心在哪里？","哪片叶子最长？","风从哪边来？"],
            "observe":["孩子是否能对齐中心","是否能组成十字","是否能安全地轻吹或手转"],
            "extension":"改变一片叶子的长度，观察风车看起来是否平衡。",
            "familyShare":"请孩子用手指绕中心画圈，讲解风车怎么转。"
          },
          "building3d":{
            "parts":[
              {"id":"stand","name":"风车支架","color":"#3b82f6","quantity":3},
              {"id":"blade","name":"风车叶片","color":"#facc15","quantity":2},
              {"id":"center","name":"中心积木","color":"#ef4444","quantity":1}
            ],
            "steps3d":[
              {"title":"搭支架","description":"支架先站稳。","partIds":["stand"],"cameraHint":"front"},
              {"title":"摆十字叶片","description":"两根长积木组成十字。","partIds":["blade"],"cameraHint":"front"},
              {"title":"装中心","description":"中心积木压住十字交叉点。","partIds":["center"],"cameraHint":"front"},
              {"title":"观察四向","description":"四片叶子围着中心。","partIds":["blade","center"],"highlightNodeIds":["windmill-center"],"cameraHint":"front"}
            ],
            "brickInstances":[
              {"id":"windmill-stand-base","partId":"stand","position":[0,0.18,0],"scale":[1.4,0.35,1]},
              {"id":"windmill-stand-mid","partId":"stand","position":[0,0.75,0],"scale":[0.55,0.9,0.55]},
              {"id":"windmill-stand-top","partId":"stand","position":[0,1.45,0],"scale":[0.55,0.9,0.55]},
              {"id":"windmill-blade-h","partId":"blade","position":[0,2.12,-0.08],"scale":[2.6,0.22,0.35]},
              {"id":"windmill-blade-v","partId":"blade","position":[0,2.12,-0.04],"scale":[2.6,0.22,0.35],"rotation":[0,0,1.5708]},
              {"id":"windmill-center","partId":"center","shape":"cylinder","position":[0,2.12,-0.35],"scale":[0.42,0.42,0.25],"rotation":[1.5708,0,0]}
            ]
          }
        }$content$::jsonb
      ),
      (
        '我的积木小乐园',
        'building_3d',
        12,
        20,
        $steps$[
          {"title":"选择三个区域","description":"请孩子从前面课程里选三个最喜欢的结构：塔、小车、桥、房子、坡道、花园等。","hint":"综合作品先选主题。","checklist":["选了至少 3 个区域","能说出喜欢的理由"]},
          {"title":"铺出乐园地图","description":"用底板或几块积木划分区域，想一想入口、道路和活动区在哪里。","hint":"先摆大位置，再加细节。","checklist":["有入口","有道路或空地","区域分开"]},
          {"title":"搭主要设施","description":"搭一个最重要的设施，再搭两个小设施。鼓励孩子复用前面学过的稳定、支撑、路径、围合。","hint":"遇到倒塌时，回想哪一课能帮忙。","checklist":["有一个主要设施","至少两个小设施","做过加固"]},
          {"title":"展示和复盘","description":"请孩子带别人参观小乐园，说出：我最满意哪里，我改进过哪里，我下次想加什么。","hint":"复盘能让搭建经验留下来。","checklist":["完成参观介绍","说出一个改进","说出下次想法"]}
        ]$steps$::jsonb,
        $content${
          "summary":"综合运用前面学到的结构，搭一个有入口、道路和设施的小乐园。",
          "learningGoals":["综合使用稳定、支撑、路径、围合和规律","规划多个区域之间的关系","用展示语言复盘自己的搭建"],
          "teacherGuide":{
            "inquiryQuestion":"怎样把多个小作品连成一个可以参观的小乐园？",
            "prepare":["前面课程用过的大颗粒积木","小车或小人偶","可选纸条作为道路"],
            "guidePrompts":["游客从哪里进来？","哪里需要更稳？","你最想让别人先看哪里？"],
            "observe":["孩子是否能整合多个结构","是否能解释区域用途","是否能说出改进经验"],
            "extension":"给小乐园画一张简单地图，标出入口、道路和三个设施。",
            "familyShare":"请孩子做 1 分钟小导游，带家人参观作品。"
          },
          "building3d":{
            "parts":[
              {"id":"base","name":"乐园地面","color":"#84cc16","quantity":1},
              {"id":"tower","name":"小塔设施","color":"#facc15","quantity":3},
              {"id":"bridge","name":"小桥设施","color":"#3b82f6","quantity":3},
              {"id":"house","name":"小屋设施","color":"#f97316","quantity":3},
              {"id":"path","name":"参观道路","color":"#e5e7eb","quantity":3}
            ],
            "steps3d":[
              {"title":"铺出地图","description":"先确定乐园地面和入口道路。","partIds":["base","path"],"cameraHint":"top"},
              {"title":"搭小塔","description":"搭一个醒目的小塔。","partIds":["tower"],"cameraHint":"isometric"},
              {"title":"搭小桥和小屋","description":"把小桥、小屋放在不同区域。","partIds":["bridge","house"],"cameraHint":"front"},
              {"title":"参观复盘","description":"沿道路参观三个设施。","partIds":["base","path","tower","bridge","house"],"highlightNodeIds":["park-path-1","park-path-2","park-path-3"],"cameraHint":"top"}
            ],
            "brickInstances":[
              {"id":"park-base","partId":"base","position":[0,0.08,0],"scale":[4.8,0.18,3]},
              {"id":"park-path-1","partId":"path","position":[-1.6,0.22,-0.8],"scale":[1.4,0.12,0.35]},
              {"id":"park-path-2","partId":"path","position":[0,0.22,-0.15],"scale":[1.4,0.12,0.35],"rotation":[0,1.5708,0]},
              {"id":"park-path-3","partId":"path","position":[1.25,0.22,0.65],"scale":[1.4,0.12,0.35]},
              {"id":"park-tower-1","partId":"tower","position":[-1.55,0.45,0.75],"scale":[0.6,0.7,0.6]},
              {"id":"park-tower-2","partId":"tower","position":[-1.55,1.08,0.75],"scale":[0.55,0.65,0.55]},
              {"id":"park-tower-3","partId":"tower","position":[-1.55,1.66,0.75],"scale":[0.45,0.55,0.45]},
              {"id":"park-bridge-left","partId":"bridge","position":[0.55,0.42,-0.75],"scale":[0.45,0.75,0.65]},
              {"id":"park-bridge-right","partId":"bridge","position":[1.55,0.42,-0.75],"scale":[0.45,0.75,0.65]},
              {"id":"park-bridge-deck","partId":"bridge","position":[1.05,0.92,-0.75],"scale":[1.55,0.22,0.65]},
              {"id":"park-house-left","partId":"house","position":[0.65,0.45,1.05],"scale":[0.45,0.9,0.65]},
              {"id":"park-house-right","partId":"house","position":[1.45,0.45,1.05],"scale":[0.45,0.9,0.65]},
              {"id":"park-house-roof","partId":"house","position":[1.05,1.1,1.05],"scale":[1.25,0.28,0.8]}
            ]
          }
        }$content$::jsonb
      )
    ) AS lessons(title, lesson_type, sort_order, duration_minutes, steps, content)
  LOOP
    SELECT id INTO v_lesson_id
    FROM public.course_lessons
    WHERE course_id = v_course_id
      AND title = lesson.title
    LIMIT 1;

    IF v_lesson_id IS NULL THEN
      INSERT INTO public.course_lessons (
        course_id, title, lesson_type, sort_order, duration_minutes, steps, resources, content
      )
      VALUES (
        v_course_id,
        lesson.title,
        lesson.lesson_type,
        lesson.sort_order,
        lesson.duration_minutes,
        lesson.steps,
        '[]'::jsonb,
        lesson.content
      );
    ELSE
      UPDATE public.course_lessons
      SET
        lesson_type = lesson.lesson_type,
        sort_order = lesson.sort_order,
        duration_minutes = lesson.duration_minutes,
        steps = lesson.steps,
        resources = '[]'::jsonb,
        content = lesson.content
      WHERE id = v_lesson_id;
    END IF;
  END LOOP;
END $$;
