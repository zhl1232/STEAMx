-- 重做学前大颗粒课程内容：对齐公开 STEAM 搭建主题，但保持原创课案与自托管 LDraw 模型。
DO $$
DECLARE
  v_course_id bigint;
BEGIN
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE title = '小小积木工程师：学前大颗粒启蒙'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.courses
  SET
    description = '面向 3-6 岁孩子的 12 课时大颗粒 STEAM 搭建课。围绕稳定结构、运动测试、坡道、桥梁、平衡、路径规划、规律表达和场景设计，用真实 LDraw 大颗粒模型引导孩子观察、搭建、测试和改进。',
    tags = ARRAY['大颗粒积木','学前','STEAM','工程启蒙','12课时'],
    steam_weights = '{"S":18,"T":6,"E":36,"A":18,"M":22}'::jsonb,
    updated_at = now()
  WHERE id = v_course_id;

  WITH lesson_updates(sort_order, title, duration_minutes, steps, content) AS (
    VALUES
    (
      1,
      '稳稳高塔',
      14,
      $steps$[
        {"title":"观察稳定","description":"拿一块长积木和一块小积木比较：哪一种更适合放在最下面？让孩子先预测，再说出理由。","hint":"底部越宽，越容易稳。","checklist":["能指出宽底座","说出自己的预测"]},
        {"title":"搭宽底座","description":"把三块长积木并排放平，做成宽宽的底座。轻轻推一推，确认不会马上滑走。","hint":"三块底座要贴近，不要留太大空隙。","checklist":["底座放平","轻推后仍能站住"]},
        {"title":"交错叠高","description":"把上层长积木横过来压住底座接缝，再在中心继续叠高。","hint":"上层压住接缝，比每层都对齐更稳。","checklist":["上层跨过接缝","塔心尽量在中间"]},
        {"title":"测试改进","description":"从侧面看塔有没有歪，用一根手指轻推。若晃动明显，先调整底座或把高层移回中心。","hint":"工程师会先测试，再调整。","checklist":["完成轻推测试","做过一次调整","能说出为什么更稳"]}
      ]$steps$::jsonb,
      $content${
        "summary":"用宽底座和交错叠法搭一座不容易倒的高塔。",
        "learningGoals":["比较宽底座和窄底座的稳定性","用“宽、窄、高、中心、接缝”等词描述结构","经历预测、搭建、测试、改进的工程过程"],
        "teacherGuide":{
          "inquiryQuestion":"怎样让塔又高又不容易倒？",
          "prepare":["DUPLO 2x4 长积木 5-6 块","DUPLO 2x2 小积木 2 块","平整桌面"],
          "guidePrompts":["如果最下面只有一块小积木会怎样？","上层压住两块底座的接缝了吗？","塔晃的时候，先改底部还是顶部？"],
          "observe":["孩子是否能主动把积木放平","是否能把高层移回中心","是否能用方位词描述调整"],
          "extension":"用同样数量的积木搭两座塔，比一比哪座更稳。",
          "familyShare":"请孩子向家人演示轻推测试，并说明自己的塔为什么稳。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-tower.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"base","name":"宽底座长积木","color":"#1d4ed8","quantity":3},
            {"id":"cross","name":"交错长积木","color":"#facc15","quantity":2},
            {"id":"core","name":"中心楼层","color":"#facc15","quantity":2},
            {"id":"top","name":"塔顶小积木","color":"#dc2626","quantity":1}
          ],
          "steps3d":[
            {"title":"铺宽底座","description":"三块长积木并排放平，先保证底部足够宽。","partIds":["base"],"cameraHint":"isometric"},
            {"title":"交错压缝","description":"两块长积木横向放上去，压住底座之间的接缝。","partIds":["cross"],"cameraHint":"front"},
            {"title":"中心叠高","description":"继续在中心叠一层长积木和一块小积木。","partIds":["core"],"cameraHint":"front"},
            {"title":"放塔顶并检查","description":"最后放上塔顶，从侧面观察中心线是否偏出底座。","partIds":["top"],"cameraHint":"side"}
          ]
        }
      }$content$::jsonb
    ),
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
      3,
      '小桥承重',
      15,
      $steps$[
        {"title":"提出任务","description":"今天的小桥要让一个小积木从桥洞下通过，还要让桥面能放住积木。先讨论桥需要哪些部分。","hint":"桥墩支撑桥面，桥洞留下通道。","checklist":["说出桥墩","说出桥面"]},
        {"title":"搭两个桥墩","description":"左右各叠两块小积木，尽量一样高，中间留出桥洞。","hint":"左右一样高，桥面才不会斜。","checklist":["左桥墩两层","右桥墩两层","中间有空位"]},
        {"title":"铺桥面和护栏","description":"用长积木跨在两个桥墩上，再在桥面上放两块小积木当护栏。","hint":"桥面两端都要压在桥墩上。","checklist":["桥面压住两边","护栏扣牢"]},
        {"title":"通过和承重","description":"让测试小积木从桥洞下通过，再放到桥面上。观察桥是稳、晃还是塌。","hint":"桥能完成任务，比只好看更重要。","checklist":["桥洞能通过","桥面能放住测试积木","说出是否需要加固"]}
      ]$steps$::jsonb,
      $content${
        "summary":"搭一座有桥墩、桥面和桥洞的小桥，理解支撑和跨度。",
        "learningGoals":["认识桥墩、桥面、桥洞的基本作用","比较左右等高对桥面稳定的影响","通过任务测试检查作品"],
        "teacherGuide":{
          "inquiryQuestion":"桥面为什么要两边都有支撑？",
          "prepare":["DUPLO 2x2 小积木 7-8 块","DUPLO 2x4 长积木 1 块","小车或小积木测试物"],
          "guidePrompts":["两个桥墩一样高吗？","桥面有没有压住两边？","如果桥洞太窄，可以移动哪里？"],
          "observe":["孩子是否能留出通道","是否会主动对齐两边高度","是否能区分通过测试和承重测试"],
          "extension":"把桥墩移得更远，看看桥面还稳不稳。",
          "familyShare":"请孩子用测试积木演示桥洞通过和桥面承重。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-bridge.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"pier","name":"左右桥墩","color":"#1d4ed8","quantity":4},
            {"id":"deck","name":"桥面长积木","color":"#facc15","quantity":1},
            {"id":"guard","name":"桥面护栏","color":"#dc2626","quantity":2},
            {"id":"tester","name":"通过测试积木","color":"#f97316","quantity":1}
          ],
          "steps3d":[
            {"title":"搭桥墩","description":"左右各叠两层小积木，中间留下桥洞。","partIds":["pier"],"cameraHint":"front"},
            {"title":"铺桥面","description":"长积木跨在两个桥墩上，两端都要有支撑。","partIds":["deck"],"cameraHint":"front"},
            {"title":"加护栏","description":"在桥面上加两块小积木，让桥面更像道路。","partIds":["guard"],"cameraHint":"isometric"},
            {"title":"测试通过","description":"用小积木从桥洞下通过，检查任务是否完成。","partIds":["tester"],"cameraHint":"side"}
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
    ),
    (
      8,
      '迷宫路线',
      16,
      $steps$[
        {"title":"确定起点终点","description":"用两块不同颜色的小积木标出起点和终点。请孩子先用手指走一条路线。","hint":"路线要从起点出发，到终点结束。","checklist":["能指出起点","能指出终点"]},
        {"title":"搭迷宫墙","description":"用长积木摆出几道墙，注意不要把路线完全堵死。","hint":"墙是障碍，路是空出来的地方。","checklist":["有多道墙","路线没有被封死"]},
        {"title":"放路径标记","description":"把小积木放在路线中间，表示当前走到的位置。","hint":"每次移动一小段，看看下一步有没有墙。","checklist":["能移动标记","避开墙"]},
        {"title":"调整路线","description":"再加一道墙，重新用手指从起点走到终点。若走不通，就移动一面墙。","hint":"迷宫要有挑战，也要能走通。","checklist":["加过新墙","重新试走","能说出哪里需要调整"]}
      ]$steps$::jsonb,
      $content${
        "summary":"用长积木设计一条能走通的迷宫路线。",
        "learningGoals":["区分起点、终点、墙和通道","练习路线规划和空间避障","通过试走检查设计是否可行"],
        "teacherGuide":{
          "inquiryQuestion":"怎样让迷宫有路可走，又不会太简单？",
          "prepare":["DUPLO 2x4 长积木 5 块","DUPLO 2x2 小积木 3 块","桌面或大底板"],
          "guidePrompts":["这条路会撞到哪面墙？","有没有另一条路？","如果终点太容易到，想加哪面墙？"],
          "observe":["孩子是否能沿路线移动标记","是否能发现走不通的位置","是否会通过移动墙来改进"],
          "extension":"和同伴互换迷宫，尝试走对方设计的路线。",
          "familyShare":"请孩子画或摆出路线，带家人从起点走到终点。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-maze.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"marker","name":"起点和终点","color":"#16a34a","quantity":2},
            {"id":"wall","name":"迷宫墙","color":"#2563eb","quantity":4},
            {"id":"walker","name":"路径标记","color":"#f97316","quantity":1},
            {"id":"challenge","name":"新增障碍墙","color":"#2563eb","quantity":1}
          ],
          "steps3d":[
            {"title":"标出起终点","description":"绿色是起点，红色是终点。","partIds":["marker"],"cameraHint":"top"},
            {"title":"摆出墙面","description":"用长积木摆出迷宫墙，保留通道。","partIds":["wall"],"cameraHint":"top"},
            {"title":"移动路径标记","description":"小积木表示当前走到的位置。","partIds":["walker"],"cameraHint":"top"},
            {"title":"增加挑战墙","description":"加一面墙后重新检查路线是否走得通。","partIds":["challenge"],"cameraHint":"top"}
          ]
        }
      }$content$::jsonb
    ),
    (
      9,
      '规律花园',
      14,
      $steps$[
        {"title":"认识花坛","description":"把两块长积木拼成长花坛底座，讨论花可以按颜色、高矮或位置排队。","hint":"规律就是可以预测下一个。","checklist":["能指出花坛","说出一种排列方式"]},
        {"title":"摆颜色规律","description":"按红、黄、红的顺序摆花朵，请孩子猜下一朵可能是什么颜色。","hint":"先看前面的顺序，再猜后面。","checklist":["说出红黄红","能预测下一朵"]},
        {"title":"比较高矮","description":"把两边花朵叠高，中间保持矮，观察高、矮、高的变化。","hint":"规律不只可以看颜色，也可以看高度。","checklist":["能指出高花","能指出矮花"]},
        {"title":"加上围栏","description":"给花园后方加一条围栏，讲一讲花园入口、花坛和围栏的位置。","hint":"作品也可以表达一个小场景。","checklist":["加上围栏","能描述前后位置","说出自己的规律"]}
      ]$steps$::jsonb,
      $content${
        "summary":"搭一个有颜色和高度规律的小花园。",
        "learningGoals":["识别并延续简单 AB 或 ABA 规律","比较高矮和前后位置","用搭建作品表达场景"],
        "teacherGuide":{
          "inquiryQuestion":"你能让别人猜出下一朵花吗？",
          "prepare":["DUPLO 2x4 长积木 2 块","红黄等颜色 DUPLO 2x2 小积木 5-6 块"],
          "guidePrompts":["这一排的颜色顺序是什么？","如果下一朵是红色，为什么？","哪朵花更高？围栏在前面还是后面？"],
          "observe":["孩子是否能发现重复规律","是否能预测下一项","是否能同时比较颜色和高度"],
          "extension":"换成红、黄、黄的规律，看看同伴能不能猜出来。",
          "familyShare":"请孩子让家人猜下一朵花，并说明规律。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-garden.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"bed","name":"花坛底座","color":"#16a34a","quantity":2},
            {"id":"pattern","name":"红黄红花朵","color":"#ef4444","quantity":3},
            {"id":"height","name":"加高花朵","color":"#22c55e","quantity":2},
            {"id":"fence","name":"后方围栏","color":"#94a3b8","quantity":1}
          ],
          "steps3d":[
            {"title":"放花坛","description":"两块长积木拼成长花坛底座。","partIds":["bed"],"cameraHint":"isometric"},
            {"title":"摆颜色规律","description":"按红、黄、红摆出第一组规律。","partIds":["pattern"],"cameraHint":"front"},
            {"title":"比较高矮","description":"两边花朵加高，形成高、矮、高。","partIds":["height"],"cameraHint":"front"},
            {"title":"加围栏","description":"后方放长积木当围栏，完成花园场景。","partIds":["fence"],"cameraHint":"isometric"}
          ]
        }
      }$content$::jsonb
    ),
    (
      10,
      '升降高塔',
      16,
      $steps$[
        {"title":"认识底座和高塔","description":"观察升降塔需要宽底座和竖直塔身。讨论为什么塔越高越需要稳的底部。","hint":"高结构要先顾底部。","checklist":["能指出底座","说出塔身要竖直"]},
        {"title":"搭稳定底座","description":"用两块长积木做底座，再在中心叠小积木形成塔身。","hint":"塔身最好压在底座中间。","checklist":["底座够宽","塔身在中间"]},
        {"title":"加伸出臂","description":"在塔顶放一块长积木当伸出臂，观察伸出方向会不会让塔更容易晃。","hint":"伸出越远，越要检查底座。","checklist":["伸出臂扣牢","能指出伸出方向"]},
        {"title":"放目标物","description":"把小积木放在地面当目标物，讲一讲升降塔如何把东西送到目标附近。","hint":"用故事表达机器的任务。","checklist":["目标物在地面","能说明升降任务","测试塔是否稳"]}
      ]$steps$::jsonb,
      $content${
        "summary":"搭一座带伸出臂的升降高塔，观察高结构和外伸结构的稳定性。",
        "learningGoals":["认识底座、塔身、伸出臂和目标物","观察外伸结构对稳定性的影响","用任务故事表达简单机械功能"],
        "teacherGuide":{
          "inquiryQuestion":"伸出臂变长以后，塔还稳吗？",
          "prepare":["DUPLO 2x4 长积木 3 块","DUPLO 2x2 小积木 4-5 块","小物件或小积木作为货物"],
          "guidePrompts":["伸出臂朝哪边？","塔身有没有在底座中间？","如果塔往一边倒，可以给哪边加支撑？"],
          "observe":["孩子是否能先建宽底座","是否能发现外伸造成的不平衡","是否能用目标任务解释作品"],
          "extension":"尝试把伸出臂换到另一侧，观察塔是否同样稳定。",
          "familyShare":"请孩子讲一个升降塔搬运货物的故事。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-crane.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"base","name":"稳定底座","color":"#2563eb","quantity":2},
            {"id":"tower","name":"竖直塔身","color":"#facc15","quantity":3},
            {"id":"arm","name":"伸出臂","color":"#f97316","quantity":1},
            {"id":"load","name":"地面目标物","color":"#dc2626","quantity":1}
          ],
          "steps3d":[
            {"title":"搭宽底座","description":"两块长积木并排做稳定底座。","partIds":["base"],"cameraHint":"isometric"},
            {"title":"叠塔身","description":"三块小积木在中心竖直叠高。","partIds":["tower"],"cameraHint":"front"},
            {"title":"加伸出臂","description":"长积木放在塔顶，形成伸出结构。","partIds":["arm"],"cameraHint":"side"},
            {"title":"放目标物","description":"地面放目标积木，讨论机器要完成的任务。","partIds":["load"],"cameraHint":"isometric"}
          ]
        }
      }$content$::jsonb
    ),
    (
      11,
      '十字转盘',
      14,
      $steps$[
        {"title":"搭中心柱","description":"用三块小积木叠出中心柱，观察柱子要不要直。","hint":"中心柱歪了，上面的十字也会歪。","checklist":["中心柱叠直","每层扣牢"]},
        {"title":"放第一条横梁","description":"在中心柱上放一块长积木，当作第一条转盘臂。","hint":"横梁要经过中心。","checklist":["横梁过中心","两端差不多长"]},
        {"title":"交叉第二条横梁","description":"再放一块长积木，与第一条交叉，形成十字形。","hint":"交叉处就是中心。","checklist":["两条横梁交叉","能指出四个方向"]},
        {"title":"盖上中心帽","description":"在交叉处放一块小积木当中心帽，数一数十字转盘有几个方向。","hint":"四个端点可以表示四个方向。","checklist":["中心帽扣牢","能数出四个方向","说出一个用途"]}
      ]$steps$::jsonb,
      $content${
        "summary":"用两块长积木搭一个十字转盘，练习中心、交叉和四方向表达。",
        "learningGoals":["认识中心、交叉和四个方向","用上下、左右、前后描述结构","把抽象方向变成可观察的搭建作品"],
        "teacherGuide":{
          "inquiryQuestion":"怎样让两条长积木在中心交叉？",
          "prepare":["DUPLO 2x2 小积木 4 块","DUPLO 2x4 长积木 2 块"],
          "guidePrompts":["第一条横梁有没有经过中心？","第二条横梁和第一条怎样交叉？","四个端点分别可以代表什么方向？"],
          "observe":["孩子是否能把中心柱叠直","是否能识别交叉点","是否能数出四个方向"],
          "extension":"在四个端点放不同颜色标记，玩方向转盘游戏。",
          "familyShare":"请孩子指给家人看十字转盘的中心和四个方向。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-windmill.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"stand","name":"中心柱","color":"#2563eb","quantity":3},
            {"id":"blade_a","name":"第一条横梁","color":"#facc15","quantity":1},
            {"id":"blade_b","name":"第二条横梁","color":"#facc15","quantity":1},
            {"id":"cap","name":"中心帽","color":"#dc2626","quantity":1}
          ],
          "steps3d":[
            {"title":"搭中心柱","description":"三块小积木竖直叠成中心柱。","partIds":["stand"],"cameraHint":"front"},
            {"title":"放第一条横梁","description":"长积木经过中心，形成第一条方向臂。","partIds":["blade_a"],"cameraHint":"front"},
            {"title":"交叉第二条横梁","description":"第二块长积木横向交叉，形成十字。","partIds":["blade_b"],"cameraHint":"front"},
            {"title":"盖中心帽","description":"小积木盖住交叉点，强调中心位置。","partIds":["cap"],"cameraHint":"isometric"}
          ]
        }
      }$content$::jsonb
    ),
    (
      12,
      '积木小乐园',
      18,
      $steps$[
        {"title":"规划地图","description":"先用长积木摆出乐园的主路，讨论入口、道路和游玩区要放在哪里。","hint":"先规划，再搭建。","checklist":["有主路","说出入口位置"]},
        {"title":"搭入口门","description":"用两块小积木当门柱，长积木当门梁，搭出可以进入的入口。","hint":"门柱要支撑门梁。","checklist":["有两根门柱","门梁压在门柱上"]},
        {"title":"搭游乐塔","description":"在地图一角叠一个小塔，给乐园增加一个明显的游玩点。","hint":"高的设施要放稳。","checklist":["小塔叠稳","能指出游玩点"]},
        {"title":"加入故事","description":"放一辆小车和一块故事标记，讲一讲车从入口开到游乐塔的路线。","hint":"路线、设施和角色连起来，乐园就有故事了。","checklist":["小车能沿路走","能讲出路线","作品有入口和设施"]}
      ]$steps$::jsonb,
      $content${
        "summary":"综合前面课程，设计一个有道路、入口、游乐塔和小车故事的积木乐园。",
        "learningGoals":["综合运用道路、门、塔、车辆等结构","练习简单规划和路线表达","用故事完整介绍自己的作品"],
        "teacherGuide":{
          "inquiryQuestion":"怎样让别人看懂你的乐园怎么玩？",
          "prepare":["DUPLO 2x4 长积木 4-5 块","DUPLO 2x2 小积木 5-6 块","DUPLO 车底盘 1 个"],
          "guidePrompts":["入口在哪里？道路通向哪里？","游乐塔够稳吗？","小车从哪里开始，到哪里结束？"],
          "observe":["孩子是否能先规划再搭建","是否能把多个结构组合成场景","是否能用连续语言介绍路线"],
          "extension":"让同伴试玩乐园路线，听听哪里需要加标记或加宽道路。",
          "familyShare":"请孩子带家人参观自己的积木小乐园，介绍入口、道路和游乐塔。"
        },
        "building3d":{
          "ldrawModelUrl":"/courses/ldraw/preschool-park.mpd",
          "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
          "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
          "parts":[
            {"id":"path","name":"乐园道路","color":"#16a34a","quantity":2},
            {"id":"gate","name":"入口门","color":"#facc15","quantity":3},
            {"id":"tower","name":"游乐塔","color":"#2563eb","quantity":3},
            {"id":"story","name":"小车和故事标记","color":"#ef4444","quantity":2}
          ],
          "steps3d":[
            {"title":"规划道路","description":"用长积木摆出主路和转弯。","partIds":["path"],"cameraHint":"top"},
            {"title":"搭入口门","description":"两根门柱加一条门梁，形成入口。","partIds":["gate"],"cameraHint":"front"},
            {"title":"搭游乐塔","description":"叠出一个明显的游乐设施。","partIds":["tower"],"cameraHint":"isometric"},
            {"title":"加入小车故事","description":"放上小车和标记，讲出游玩路线。","partIds":["story"],"cameraHint":"top"}
          ]
        }
      }$content$::jsonb
    )
  )
  UPDATE public.course_lessons AS lesson
  SET
    title = lesson_updates.title,
    lesson_type = 'building_3d',
    duration_minutes = lesson_updates.duration_minutes,
    steps = lesson_updates.steps,
    resources = '[
      {"title":"LEGO Education 官方课程库（按套装筛选真实课案）","url":"https://education.lego.com/en-us/lessons","type":"link"},
      {"title":"LEGO 官方搭建说明（按套装号查找图纸）","url":"https://www.lego.com/en-us/service/buildinginstructions","type":"link"}
    ]'::jsonb,
    content = lesson_updates.content,
    updated_at = now()
  FROM lesson_updates
  WHERE lesson.course_id = v_course_id
    AND lesson.sort_order = lesson_updates.sort_order;
END $$;
