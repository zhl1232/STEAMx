-- 修正学前大颗粒课程中不符合真实搭建的课时文案，并补充官方课程/图纸入口。
-- 注意：模型文件随代码发版；本迁移只修数据库中的课时文本与资源。
DO $$
DECLARE
  v_course_id bigint;
  v_resources jsonb := '[
    {"title":"LEGO Education 官方课程库（按套装筛选真实课案）","url":"https://education.lego.com/en-us/lessons","type":"link"},
    {"title":"LEGO 官方搭建说明（按套装号查找图纸）","url":"https://www.lego.com/en-us/service/buildinginstructions","type":"link"}
  ]'::jsonb;
BEGIN
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE title = '小小积木工程师：学前大颗粒启蒙'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.course_lessons
  SET resources = v_resources, updated_at = now()
  WHERE course_id = v_course_id
    AND lesson_type = 'building_3d';

  WITH lesson_updates(sort_order, title, duration_minutes, steps, content) AS (
    VALUES
    (
      2,
      '小车跑直线',
      15,
      $steps$[
        {"title":"认识带轮底盘","description":"观察一体式带轮车底盘，指出前后、左右和轮子位置。","hint":"左右对称的小车更容易跑直。","checklist":["能指出车头方向","能找到左右两侧轮子"]},
        {"title":"装上车身","description":"把长积木横向扣在车底盘中间，检查有没有偏到一边。","hint":"车身放在中间，小车不容易歪。","checklist":["长积木扣在中间","车身没有明显偏斜"]},
        {"title":"加座位和货物","description":"在车身上放两个小积木，一个当座位，一个当货物，试着保持左右平衡。","hint":"上面的积木也会影响重心。","checklist":["座位扣牢","货物不会一推就掉"]},
        {"title":"推行测试","description":"沿桌面轻推小车，观察它是直走、偏左还是偏右。每次只调整一个地方再试。","hint":"一次只改一个地方，才知道哪里有用。","checklist":["完成一次推行","说出行驶方向","做过一次调整"]}
      ]$steps$::jsonb,
      $content${
        "summary":"用带轮底盘搭一辆能向前推的小车，练习左右对称和运动测试。",
        "learningGoals":["认识车身、带轮底盘的作用","观察左右对称对行驶方向的影响","用测试结果改进作品"],
        "teacherGuide":{
          "inquiryQuestion":"怎样让小车跑得更直？",
          "prepare":["DUPLO 一体式带轮车底盘 1 个","DUPLO 2x4 长积木 1 块","DUPLO 2x2 小积木 2 块","纸胶带直线跑道"],
          "guidePrompts":["哪边看起来更重？","车身在轮子中间吗？","如果只移动一个小积木，小车会变直吗？"],
          "observe":["孩子是否能比较左右位置","是否能等待测试结果再调整","是否能用直、歪、左、右描述运动"],
          "extension":"在桌上贴一条直线跑道，记录小车能不能沿线前进。",
          "familyShare":"请孩子演示自己的小车测试，并说出哪次调整最有效。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-car.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"chassis","name":"一体式带轮车底盘","color":"#16a34a","quantity":1},
            {"id":"body","name":"长车身","color":"#facc15","quantity":1},
            {"id":"seat","name":"座位和货物","color":"#f97316","quantity":2},
            {"id":"test","name":"测试跑道","color":"#64748b","quantity":1}
          ],
          "steps3d":[
            {"title":"放好带轮底盘","description":"先确认轮子在左右两边，车头方向清楚。","partIds":["chassis"],"cameraHint":"isometric"},
            {"title":"扣上车身","description":"把长车身扣在底盘中央。","partIds":["body"],"cameraHint":"front"},
            {"title":"加座位和货物","description":"在上方放两块小积木，保持左右平衡。","partIds":["seat"],"cameraHint":"side"},
            {"title":"检查对称","description":"从正面看左右是否差不多，再进行推行测试。","partIds":["test"],"cameraHint":"front"}
          ]
        }
      }$content$::jsonb
    ),
    (
      4,
      '动物小屋',
      16,
      $steps$[
        {"title":"确定住户","description":"用一块小积木当动物朋友，先放在桌面上，讨论小屋需要门、墙和屋顶。","hint":"先知道谁要住进去，再决定空间大小。","checklist":["说出动物在哪里","说出小屋需要门"]},
        {"title":"围出墙面","description":"用三面墙围出小屋，前面留下门口，让动物可以进出。左右墙和后墙之间留出一点距离，不要互相穿插。","hint":"不要把门口堵住。","checklist":["有左墙","有右墙","有后墙","有门口"]},
        {"title":"加上屋顶","description":"用两块长积木平放在墙上当屋顶，检查两端都有墙支撑。","hint":"屋顶要压在墙上，不能悬空。","checklist":["屋顶压住墙","动物还能进出"]},
        {"title":"讲小屋故事","description":"给屋顶上加一块门牌或装饰，讲一讲动物怎么进门、在哪里休息。","hint":"装饰要扣在屋顶上。","checklist":["有门牌或装饰","能讲出进出路线","说出屋顶作用"]}
      ]$steps$::jsonb,
      $content${
        "summary":"为动物朋友搭一间有门、有墙、有屋顶的小屋。",
        "learningGoals":["认识围合空间、入口和覆盖结构","用前后左右描述墙和门的位置","通过角色故事表达作品功能"],
        "teacherGuide":{
          "inquiryQuestion":"怎样搭一间动物能进出的房子？",
          "prepare":["DUPLO 2x4 长积木 5 块","DUPLO 2x2 小积木 2 块","小动物玩偶或替代积木"],
          "guidePrompts":["门口在哪里？","动物进去以后屋顶会不会碰到？","哪面墙挡风，哪面留给进出？"],
          "observe":["孩子是否能保留入口","是否能把屋顶放在支撑上","是否能用故事说明结构用途"],
          "extension":"给小屋加院子或小路，让动物从门口走到外面。",
          "familyShare":"请孩子介绍小屋的门、墙和屋顶分别有什么用。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-house.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"animal","name":"动物朋友","color":"#8b5cf6","quantity":1},
            {"id":"wall","name":"三面墙","color":"#2563eb","quantity":3},
            {"id":"roof","name":"平屋顶","color":"#f59e0b","quantity":2},
            {"id":"sign","name":"门牌积木","color":"#dc2626","quantity":1}
          ],
          "steps3d":[
            {"title":"放动物朋友","description":"先确定动物的位置和门口方向。","partIds":["animal"],"cameraHint":"isometric"},
            {"title":"围三面墙","description":"左右和后方围出空间，前方留门，墙面之间保留清楚边界。","partIds":["wall"],"cameraHint":"top"},
            {"title":"加屋顶","description":"两块长积木平放并压在墙上，形成有支撑的覆盖。","partIds":["roof"],"cameraHint":"front"},
            {"title":"加门牌","description":"小积木扣在屋顶上，不悬空。","partIds":["sign"],"cameraHint":"isometric"}
          ]
        }
      }$content$::jsonb
    ),
    (
      5,
      '高低平台',
      15,
      $steps$[
        {"title":"观察高低","description":"用小积木搭出一个高平台，再在旁边放一个低平台，比较哪个更高。","hint":"平台要放平，才容易比较。","checklist":["能指出高平台","能指出低平台"]},
        {"title":"搭高平台支撑","description":"左右各叠两块小积木，做成一样高的支撑。","hint":"两边一样高，上面的长积木才不会斜。","checklist":["左支撑两层","右支撑两层","两边高度一致"]},
        {"title":"铺平台并放测试物","description":"把长积木平放在两个支撑上，再把测试小积木扣在平台中央。","hint":"长积木两端都要压在支撑上。","checklist":["平台两端有支撑","测试物扣牢"]},
        {"title":"比较高度","description":"在旁边搭一个低平台，比较测试物在高平台和低平台上的位置。","hint":"只改变高度，比较更清楚。","checklist":["完成高低比较","说出高和低","尝试改变一层高度"]}
      ]$steps$::jsonb,
      $content${
        "summary":"搭一个高平台和一个低平台，观察支撑、高低和稳定性。",
        "learningGoals":["认识高平台、低平台和支撑结构","比较两边等高对平台稳定的影响","尝试一次只改变一个变量"],
        "teacherGuide":{
          "inquiryQuestion":"怎样搭一个不晃的高平台？",
          "prepare":["DUPLO 2x2 小积木 6 块","DUPLO 2x4 长积木 1 块","小积木测试物"],
          "guidePrompts":["两个支撑一样高吗？","平台两端都有支撑吗？","如果少一层支撑，平台会发生什么变化？"],
          "observe":["孩子是否能区分高低","是否能检查两端支撑","是否能比较两次高度变化"],
          "extension":"用一层、两层、三层支撑分别搭平台，按高度排序。",
          "familyShare":"请孩子演示高低平台比较，并说出自己改变了哪个条件。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-ramp.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"support","name":"高平台支撑","color":"#2563eb","quantity":4},
            {"id":"ramp","name":"高平台长积木","color":"#facc15","quantity":1},
            {"id":"tester","name":"测试物","color":"#dc2626","quantity":1},
            {"id":"finish","name":"低平台对照","color":"#16a34a","quantity":2}
          ],
          "steps3d":[
            {"title":"搭两边支撑","description":"左右各叠两层小积木，形成等高支撑。","partIds":["support"],"cameraHint":"front"},
            {"title":"铺高平台","description":"长积木平放在两个支撑上，两端都被托住。","partIds":["ramp"],"cameraHint":"front"},
            {"title":"放测试物","description":"测试物扣在平台中央，检查平台是否稳定。","partIds":["tester"],"cameraHint":"front"},
            {"title":"加低平台对照","description":"旁边放低平台，用来比较高和低。","partIds":["finish"],"cameraHint":"isometric"}
          ]
        }
      }$content$::jsonb
    ),
    (
      6,
      '转向指针',
      14,
      $steps$[
        {"title":"认识方向","description":"在桌面上指出前、后、左、右。讨论如果有一个指针，它能告诉我们去哪里。","hint":"方向词要和身体或桌面对应。","checklist":["能指出左和右","能说出一个方向"]},
        {"title":"搭中心点","description":"用底座和小积木搭出指针的中心点。中心点像转动的轴。","hint":"中心点要稳，指针才好观察。","checklist":["底座放平","中心点在中间"]},
        {"title":"放上指针","description":"把长积木平放在中心点上，像一个指向左右的箭头。","hint":"长积木要扣在中心点上，不要斜插或悬空。","checklist":["指针跨过中心","能说出指向哪里"]},
        {"title":"玩方向游戏","description":"在两个方向放上标记，转动身体或移动标记，说出指针指向哪里。","hint":"先说方向，再移动测试物。","checklist":["能读出方向","能按方向移动","能换一次方向"]}
      ]$steps$::jsonb,
      $content${
        "summary":"用大颗粒搭一个直线方向指针，练习中心、左右和方向词。",
        "learningGoals":["理解中心点和指向关系","使用前后左右、斜向等方向词","把搭建作品用于方向游戏"],
        "teacherGuide":{
          "inquiryQuestion":"一个指针怎样告诉我们往哪里走？",
          "prepare":["DUPLO 2x4 长积木 2 块","DUPLO 2x2 小积木 3 块","方向卡片或纸条"],
          "guidePrompts":["指针的中心在哪里？","这端指向左还是右？","如果标记换位置，路线会变吗？"],
          "observe":["孩子是否能把指针扣在中心上","是否能用方向词表达","是否能根据指向移动标记"],
          "extension":"在桌面四角放颜色卡，孩子转动指针后走到对应颜色。",
          "familyShare":"请孩子用指针给家人发出一个方向指令。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-gears.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"base","name":"指针底座","color":"#64748b","quantity":1},
            {"id":"pivot","name":"中心点","color":"#facc15","quantity":1},
            {"id":"pointer","name":"长指针","color":"#f97316","quantity":1},
            {"id":"marker","name":"方向标记","color":"#ef4444","quantity":2}
          ],
          "steps3d":[
            {"title":"放底座","description":"长积木放平，确定指针游戏区域。","partIds":["base"],"cameraHint":"top"},
            {"title":"搭中心点","description":"小积木放在底座中心，当作旋转中心。","partIds":["pivot"],"cameraHint":"isometric"},
            {"title":"放长指针","description":"长积木平放并扣住中心，形成左右方向指针。","partIds":["pointer"],"cameraHint":"top"},
            {"title":"加方向标记","description":"在两个方向放标记，用来玩方向游戏。","partIds":["marker"],"cameraHint":"top"}
          ]
        }
      }$content$::jsonb
    ),
    (
      7,
      '左右平衡桥',
      15,
      $steps$[
        {"title":"搭两个支撑","description":"左右各放一块小积木当桥墩，讨论为什么两边都需要支撑。","hint":"两边都有支撑，长板才不会悬空。","checklist":["左边有支撑","右边有支撑"]},
        {"title":"放上长板","description":"把长积木平放在两个支撑上，检查两端是否都压住桥墩。","hint":"长板两端都要被托住。","checklist":["长板压住左支撑","长板压住右支撑"]},
        {"title":"添加两边重量","description":"在长板左右各放一块小积木，比较左右数量是否一样。","hint":"同样数量更容易保持稳定。","checklist":["左右都有重量","能比较多少"]},
        {"title":"改变重量","description":"在一边多放一块小积木，观察哪边东西更多，再讨论怎样让两边重新一样多。","hint":"这节课比较左右多少，不做悬空跷跷板。","checklist":["观察到数量变化","尝试调整位置","说出多或少"]}
      ]$steps$::jsonb,
      $content${
        "summary":"搭一座左右都有支撑的小桥，比较两边数量和稳定性。",
        "learningGoals":["认识两端支撑和桥面的关系","用左、右、多、少、一样多描述平衡","通过增加或移动积木尝试调整"],
        "teacherGuide":{
          "inquiryQuestion":"怎样让桥面两边都有支撑、左右看起来更均衡？",
          "prepare":["DUPLO 2x4 长积木 1 块","DUPLO 2x2 小积木 4 块","平整桌面"],
          "guidePrompts":["桥面两端都有支撑吗？","哪一边积木更多？","怎样让左右一样多？"],
          "observe":["孩子是否能检查两端支撑","是否能用多少比较重量","是否会尝试移动积木位置"],
          "extension":"在左右两边放不同数量积木，让孩子调整到一样多。",
          "familyShare":"请孩子向家人演示左右一样多和一边更多的区别。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-seesaw.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"pivot","name":"左右桥墩","color":"#dc2626","quantity":2},
            {"id":"beam","name":"桥面长板","color":"#facc15","quantity":1},
            {"id":"seat","name":"两边重量","color":"#2563eb","quantity":2},
            {"id":"load","name":"额外重量","color":"#2563eb","quantity":1}
          ],
          "steps3d":[
            {"title":"放左右桥墩","description":"两块小积木分别放在左右两端。","partIds":["pivot"],"cameraHint":"front"},
            {"title":"放桥面长板","description":"长积木平放在两边桥墩上，不能悬空。","partIds":["beam"],"cameraHint":"front"},
            {"title":"加两边重量","description":"左右各加一块，比较数量是否一样。","partIds":["seat"],"cameraHint":"front"},
            {"title":"增加重量","description":"一边再加一块，观察哪边更多。","partIds":["load"],"cameraHint":"front"}
          ]
        }
      }$content$::jsonb
    )
  )
  UPDATE public.course_lessons AS lesson
  SET
    title = lesson_updates.title,
    duration_minutes = lesson_updates.duration_minutes,
    steps = lesson_updates.steps,
    content = lesson_updates.content,
    updated_at = now()
  FROM lesson_updates
  WHERE lesson.course_id = v_course_id
    AND lesson.sort_order = lesson_updates.sort_order;
END $$;
