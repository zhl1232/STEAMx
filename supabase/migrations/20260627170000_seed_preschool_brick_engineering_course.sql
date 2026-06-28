-- 学前大颗粒积木工程启蒙：原创课程内容，不引用官方 LEGO Education 图纸/PDF/素材。
-- 课程结构参考探究式动手学习：提出问题、搭建尝试、测试观察、表达分享。
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
      '面向 3-6 岁孩子的通用大颗粒积木课。用高塔、小车、小桥和动物小屋，练习稳定、对称、支撑和故事表达，家长或老师可陪同完成。',
      '/projects/eng_models.webp',
      ARRAY['大颗粒积木','学前','工程启蒙','亲子'],
      1,
      'approved',
      18,
      '{"S":15,"T":5,"E":35,"A":25,"M":20}'::jsonb
    )
    RETURNING id INTO v_course_id;
  ELSE
    UPDATE public.courses
    SET
      description = '面向 3-6 岁孩子的通用大颗粒积木课。用高塔、小车、小桥和动物小屋，练习稳定、对称、支撑和故事表达，家长或老师可陪同完成。',
      image_url = '/projects/eng_models.webp',
      tags = ARRAY['大颗粒积木','学前','工程启蒙','亲子'],
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
          {
            "title":"摸一摸宽宽的底座",
            "description":"先找 2 到 3 块最大的积木放在桌上，请孩子用手轻轻推一推，感觉底座是不是稳。",
            "hint":"底座越宽，塔越不容易被小手推倒。",
            "checklist":["底座放平了","轻轻推时不会马上倒"]
          },
          {
            "title":"一层一层往上叠",
            "description":"把中等积木放在底座中间，颜色可以交替摆，让孩子说出每一层的颜色。",
            "hint":"尽量让每一层对齐，不要只压住一小角。",
            "checklist":["至少叠了 3 层","每层大多在中间"]
          },
          {
            "title":"放上小旗子",
            "description":"最后放一块小积木当塔顶。完成后从正面和侧面看一看，塔有没有歪。",
            "hint":"如果塔歪了，不是失败，是发现了要调整的地方。",
            "checklist":["塔顶放好了","能说出塔有没有歪"]
          },
          {
            "title":"做轻轻推测试",
            "description":"用一根手指轻轻碰塔身，观察它会摇晃还是倒下。试着把底座加宽，再测试一次。",
            "hint":"工程师会反复测试和改进。",
            "checklist":["做过一次轻推测试","尝试加宽或调整底座"]
          }
        ]$steps$::jsonb,
        $content${
          "summary":"搭一座不容易倒的高塔，感受宽底座和重心。",
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
          {
            "title":"找出车身和轮子",
            "description":"请孩子把长积木、轮子或圆形积木分成两堆：一堆做车身，一堆做会转的部分。",
            "hint":"分类是工程开始前的准备。",
            "checklist":["能指出车身","能指出轮子或圆形积木"]
          },
          {
            "title":"让左右两边一样",
            "description":"把轮子放在车身两侧，观察左边和右边是不是差不多高、差不多靠前。",
            "hint":"左右对称，小车更容易跑直。",
            "checklist":["左边有轮子","右边有轮子","轮子位置大致对齐"]
          },
          {
            "title":"装上驾驶座",
            "description":"在车身上放一块小积木当驾驶座，请孩子想象谁坐在车里。",
            "hint":"故事会让搭建更有目标。",
            "checklist":["驾驶座不容易掉","能说出车里坐的是谁"]
          },
          {
            "title":"推一推，看路线",
            "description":"在桌上轻轻推小车，观察它是直直跑、转弯，还是卡住。再调整轮子试一次。",
            "hint":"每次只改一个地方，更容易知道哪里变好了。",
            "checklist":["做过推行测试","能说出跑得直不直"]
          }
        ]$steps$::jsonb,
        $content${
          "summary":"搭一辆能向前推的小车，练习对称和简单测试。",
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
          {
            "title":"先搭两个桥墩",
            "description":"在左右两边各叠一小摞积木，中间留出洞洞，让小车或小人偶可以通过。",
            "hint":"两个桥墩要差不多高，桥面才平。",
            "checklist":["左边有桥墩","右边有桥墩","中间有空位"]
          },
          {
            "title":"放上桥面",
            "description":"把长积木横放在两个桥墩上，像盖上一块平平的路。",
            "hint":"桥面两端都要压在桥墩上，不能只搭一边。",
            "checklist":["桥面压住左桥墩","桥面压住右桥墩"]
          },
          {
            "title":"请小车过桥",
            "description":"让小车或小积木从桥洞下面通过，再试着从桥面上通过。",
            "hint":"桥不只要好看，还要能完成任务。",
            "checklist":["桥洞下能通过","桥面上能停住一个小物件"]
          },
          {
            "title":"加固桥墩",
            "description":"如果桥会摇，就在桥墩旁边加一块支撑积木，再测试一次。",
            "hint":"加支撑是很常见的工程改进。",
            "checklist":["发现过摇晃或不稳","尝试加过支撑"]
          }
        ]$steps$::jsonb,
        $content${
          "summary":"搭一座能通过的小桥，理解支撑、跨度和任务测试。",
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
          {
            "title":"选一个动物朋友",
            "description":"请孩子选一个小玩具、纸片动物或想象中的动物，先说说它需要一个什么样的家。",
            "hint":"先想住户，再搭房子。",
            "checklist":["选好了动物朋友","能说出它喜欢什么"]
          },
          {
            "title":"围出三面墙",
            "description":"用积木围出左墙、右墙和后墙，前面留一个门口。",
            "hint":"门口要够宽，动物朋友才能进去。",
            "checklist":["有左墙","有右墙","有后墙","前面留了门"]
          },
          {
            "title":"搭一个屋顶",
            "description":"把长积木或平板放在墙上方当屋顶。屋顶可以平平的，也可以一边高一边低。",
            "hint":"屋顶要压住墙，不然会滑下来。",
            "checklist":["屋顶放上去了","门口没有被挡住"]
          },
          {
            "title":"讲讲这个家",
            "description":"请孩子把动物放进去，说一句：这里是门、这里是床、这里可以玩。",
            "hint":"表达结构和用途，也是学习的一部分。",
            "checklist":["动物能进家","能介绍 2 个地方"]
          }
        ]$steps$::jsonb,
        $content${
          "summary":"给动物朋友搭一个有墙、有门、有屋顶的家，练习围合和表达。",
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
