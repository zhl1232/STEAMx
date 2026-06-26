-- 扩展五子棋课程：从规则入门到棋型、双威胁、VCF/VCT 与 AI 搜索。
-- 图解使用 course_lessons.steps JSONB 内的结构化 GomokuBoard 数据，由前端 SVG 渲染。
DO $$
DECLARE
  v_course_id bigint;
  v_lesson_id bigint;
  lesson record;
BEGIN
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE title = '五子棋博弈论入门'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    INSERT INTO public.courses (
      title, description, image_url, tags, difficulty_stars, status, sort_order, steam_weights
    )
    VALUES (
      '五子棋博弈论入门',
      '从 15×15 棋盘规则、活三冲四、双威胁和连续威胁读棋，学到 minimax、α-β 剪枝与 VCF 搜索，并在游乐场完成实战复盘。',
      '/projects/tech_3dprint.webp',
      ARRAY['五子棋','博弈论','算法','策略','棋型'],
      3,
      'approved',
      30,
      '{"S":10,"T":30,"E":10,"A":10,"M":40}'::jsonb
    )
    RETURNING id INTO v_course_id;
  ELSE
    UPDATE public.courses
    SET
      description = '从 15×15 棋盘规则、活三冲四、双威胁和连续威胁读棋，学到 minimax、α-β 剪枝与 VCF 搜索，并在游乐场完成实战复盘。',
      tags = ARRAY['五子棋','博弈论','算法','策略','棋型'],
      difficulty_stars = 3,
      steam_weights = '{"S":10,"T":30,"E":10,"A":10,"M":40}'::jsonb,
      status = 'approved',
      sort_order = 30
    WHERE id = v_course_id;
  END IF;

  FOR lesson IN
    SELECT *
    FROM (
      VALUES
      (
        '认识棋盘与连五规则',
        ARRAY[]::text[],
        'playground',
        1,
        18,
        $steps$[
          {
            "title":"看懂 15×15 交点",
            "description":"五子棋下在交点上，不是格子里。本站规则是黑先、双方轮流落子，横、竖、两条斜线任一方向先连成 5 子者获胜。",
            "hint":"先记住中心点「天元」：开局越靠近中心，可发展的方向越多。",
            "checklist":["知道棋子落在交点上","知道黑先白后轮流落子","能说出横竖斜四个方向"],
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"天元在棋盘中心，周围八个方向都能继续发展",
                "ariaLabel":"15乘15五子棋棋盘，中心天元被标记",
                "marks":[{"r":7,"c":7,"label":"天元","tone":"amber","kind":"ring"}]
              }
            ]
          },
          {
            "title":"识别四个胜利方向",
            "description":"连五可以是横线、竖线、左上到右下斜线、右上到左下斜线。判断胜负时，只需要沿这四个方向数同色棋子。",
            "hint":"实战里每落一子，就沿四个方向各看一次：自己有没有五连，对手下一手有没有五连。",
            "checklist":["能在棋盘上指出四个方向","能找出一条五连线"],
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"横向五连：黑方已经获胜",
                "blackStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":7,"c":8},{"r":7,"c":9}],
                "whiteStones":[{"r":5,"c":7},{"r":9,"c":6}],
                "winLine":{"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"blue"}
              },
              {
                "type":"gomoku_board",
                "caption":"斜向五连同样算胜利",
                "blackStones":[{"r":4,"c":10},{"r":5,"c":9},{"r":6,"c":8},{"r":7,"c":7},{"r":8,"c":6}],
                "whiteStones":[{"r":5,"c":7},{"r":6,"c":9},{"r":8,"c":8}],
                "winLine":{"from":{"r":4,"c":10},"to":{"r":8,"c":6},"tone":"blue"}
              }
            ]
          },
          {
            "title":"本站先学自由五子棋",
            "description":"游乐场当前采用自由五子棋：长连因为包含五连也会判胜，不启用连珠比赛里的三三、四四、长连禁手。",
            "hint":"高手拓展可以了解连珠禁手，但本课程练习先以本站可玩的规则为准。"
          },
          {
            "title":"到游乐场走完第一局",
            "description":"打开五子棋，选择「AI · 入门」难度。目标不是马上赢，而是每一步都练习：看自己四个方向，也看对手四个方向。",
            "hint":"复盘第一局时只问两个问题：我有没有漏掉对手的四？我有没有只顾进攻忘了防守？",
            "checklist":["完成一局入门难度","能指出本局至少一个关键防守点"]
          }
        ]$steps$::jsonb,
        '[]'::jsonb,
        $content${
          "summary":"建立本站五子棋规则、胜负方向和第一局实战观察方法。",
          "playground":{"gameKey":"gomoku","practiceHref":"/playground/gomoku","practiceCta":"去和 AI 下一局"}
        }$content$::jsonb
      ),
      (
        '开局与先手优势',
        ARRAY[]::text[],
        'playground',
        2,
        20,
        $steps$[
          {
            "title":"为什么先手强",
            "description":"黑方先落子，天然多一步主动权。自由五子棋里先手优势很明显，所以新手更要学会把第一手和第二手变成持续压力。",
            "hint":"先手不是随便进攻，而是让每一手都有更多后续选择。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"中心开局比边角开局拥有更多延伸方向",
                "blackStones":[{"r":7,"c":7}],
                "marks":[
                  {"r":6,"c":7,"tone":"success","kind":"dot"},
                  {"r":8,"c":7,"tone":"success","kind":"dot"},
                  {"r":7,"c":6,"tone":"success","kind":"dot"},
                  {"r":7,"c":8,"tone":"success","kind":"dot"},
                  {"r":6,"c":6,"tone":"success","kind":"dot"},
                  {"r":8,"c":8,"tone":"success","kind":"dot"},
                  {"r":6,"c":8,"tone":"success","kind":"dot"},
                  {"r":8,"c":6,"tone":"success","kind":"dot"}
                ]
              }
            ]
          },
          {
            "title":"前三手先抢形",
            "description":"开局优先在中心附近形成可连接的形，不要把棋子散到很远。相邻或隔一格的棋子更容易变成活二、活三。",
            "hint":"判断一手棋是否好：它能不能同时帮助两条线？",
            "checklist":["能解释为什么中心附近更灵活","能避免前三手下到无关角落"],
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"黑子保持联系，下一步可向多条线扩展",
                "blackStones":[{"r":7,"c":7},{"r":7,"c":8}],
                "whiteStones":[{"r":8,"c":7}],
                "marks":[
                  {"r":7,"c":6,"label":"A","tone":"blue"},
                  {"r":7,"c":9,"label":"B","tone":"blue"},
                  {"r":6,"c":8,"label":"C","tone":"amber"},
                  {"r":8,"c":6,"label":"D","tone":"amber"}
                ],
                "lines":[{"from":{"r":7,"c":6},"to":{"r":7,"c":9},"tone":"blue","dashed":true}]
              }
            ]
          },
          {
            "title":"别急着贴边",
            "description":"边角不是不能下，但太早贴边会少掉发展方向。除非是在防守或形成明确威胁，否则优先把战场留在棋盘中央。",
            "hint":"贴边的棋只剩半个棋盘可发展；中心的棋可以左右开弓。"
          },
          {
            "title":"入门练习：只看候选点",
            "description":"和入门 AI 下一局，每手先找 3 个候选点，再选其中一个。候选点必须靠近已有棋子，并且能形成连接、堵点或威胁。",
            "hint":"先找候选，再比较优劣，是从新手到高手的第一道门槛。",
            "checklist":["每手至少找 2 个候选点","能说出最终选择的理由"]
          }
        ]$steps$::jsonb,
        '[]'::jsonb,
        $content${
          "summary":"理解中心、连接和候选点，开始把先手优势转成可持续压力。",
          "playground":{"gameKey":"gomoku","practiceHref":"/playground/gomoku","practiceCta":"去练开局候选点"}
        }$content$::jsonb
      ),
      (
        '关键棋型：活二、活三、冲四、活四',
        ARRAY['活三、冲四与棋型攻防']::text[],
        'playground',
        3,
        28,
        $steps$[
          {
            "title":"活二是种子",
            "description":"活二是两颗同色棋子形成的开放连接，两端和周围还有继续发展的空间。它本身不致命，但常常是活三和双威胁的起点。",
            "hint":"看到活二时，先想：下一手能不能变成活三？",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"活二：两端开放，后续可扩成活三",
                "blackStones":[{"r":7,"c":7},{"r":7,"c":8}],
                "marks":[{"r":7,"c":6,"tone":"success"},{"r":7,"c":9,"tone":"success"}],
                "lines":[{"from":{"r":7,"c":6},"to":{"r":7,"c":9},"tone":"success","dashed":true}]
              }
            ]
          },
          {
            "title":"活三必须立刻重视",
            "description":"活三是三颗同色棋子连成一条线，并且两端都空。下一手它可以变成活四，对手往往必须防。",
            "hint":"活三的可怕之处不是现在赢，而是下一步会产生两个成五点。",
            "checklist":["能识别直活三","能指出活三的两个防守端点"],
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"活三：两端都空，A/B 都可能扩成活四",
                "blackStones":[{"r":7,"c":6},{"r":7,"c":7},{"r":7,"c":8}],
                "marks":[{"r":7,"c":5,"label":"A","tone":"danger"},{"r":7,"c":9,"label":"B","tone":"danger"}],
                "lines":[{"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"danger","dashed":true}]
              }
            ]
          },
          {
            "title":"眠三和假活三",
            "description":"一端被堵、边界被挡、或看似开放但补上后不能形成真正活四的三，威胁就低很多。不要把所有三都当成同等危险。",
            "hint":"判断三的强弱：补一手后，是否有两个成五点？没有的话就不是强活三。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"眠三：左侧被白子挡住，只剩右侧可发展",
                "blackStones":[{"r":7,"c":6},{"r":7,"c":7},{"r":7,"c":8}],
                "whiteStones":[{"r":7,"c":5}],
                "marks":[{"r":7,"c":9,"label":"唯一","tone":"amber"}],
                "lines":[{"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"amber","dashed":true}]
              }
            ]
          },
          {
            "title":"冲四是不挡就输",
            "description":"冲四是已经有四颗同色棋子，只剩一个点能补成五连。它通常只有一个胜点，对手必须立刻挡。",
            "hint":"先找所有冲四的成五点。只要漏掉一个，下一手就结束。",
            "checklist":["能指出冲四的唯一成五点","能识别跳冲四"],
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"连续冲四：白方必须挡 A",
                "blackStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":7,"c":8}],
                "whiteStones":[{"r":7,"c":4}],
                "marks":[{"r":7,"c":9,"label":"A","tone":"danger"}],
                "lines":[{"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"danger"}]
              },
              {
                "type":"gomoku_board",
                "caption":"跳冲四：补中间缺口也能立刻成五",
                "blackStones":[{"r":6,"c":5},{"r":6,"c":6},{"r":6,"c":8},{"r":6,"c":9}],
                "marks":[{"r":6,"c":7,"label":"A","tone":"danger"}],
                "lines":[{"from":{"r":6,"c":5},"to":{"r":6,"c":9},"tone":"danger"}]
              }
            ]
          },
          {
            "title":"活四是双成五点",
            "description":"活四两端都能成五。对手只能挡一端，另一端仍然会赢，所以活四通常已经是必胜威胁。",
            "hint":"看到对手活四，普通防守已经晚了；你必须自己也有立即获胜的一手。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"活四：A 和 B 都是成五点，普通防守挡不完",
                "blackStones":[{"r":7,"c":6},{"r":7,"c":7},{"r":7,"c":8},{"r":7,"c":9}],
                "marks":[{"r":7,"c":5,"label":"A","tone":"danger"},{"r":7,"c":10,"label":"B","tone":"danger"}],
                "lines":[{"from":{"r":7,"c":5},"to":{"r":7,"c":10},"tone":"danger"}]
              }
            ]
          }
        ]$steps$::jsonb,
        '[]'::jsonb,
        $content${
          "summary":"掌握活二、活三、眠三、冲四、跳冲四和活四，建立攻防语言。",
          "playground":{"gameKey":"gomoku","practiceHref":"/playground/gomoku","practiceCta":"去进阶难度识别棋型"}
        }$content$::jsonb
      ),
      (
        '防守优先级与堵点选择',
        ARRAY[]::text[],
        'playground',
        4,
        24,
        $steps$[
          {
            "title":"先挡立即成五",
            "description":"防守优先级第一条：对手下一手能五连，就必须挡。除非你自己这一手能直接获胜，否则不要贪别的形。",
            "hint":"实战先扫对手所有四，再考虑自己的进攻。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"白方已有四连，黑方必须落在 A",
                "blackStones":[{"r":8,"c":6},{"r":8,"c":7}],
                "whiteStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":7,"c":8}],
                "marks":[{"r":7,"c":9,"label":"A","tone":"danger"}],
                "lines":[{"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"danger"}]
              }
            ]
          },
          {
            "title":"再处理活三",
            "description":"对手没有直接四时，再看活三。堵活三通常要堵在能阻止它变成活四的位置，而不是随便贴一颗。",
            "hint":"防活三时，优先下到对手下一步最想去的位置。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"白方活三，A/B 都是黑方可考虑的堵点",
                "whiteStones":[{"r":7,"c":6},{"r":7,"c":7},{"r":7,"c":8}],
                "blackStones":[{"r":8,"c":7}],
                "marks":[{"r":7,"c":5,"label":"A","tone":"amber"},{"r":7,"c":9,"label":"B","tone":"amber"}],
                "lines":[{"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"amber","dashed":true}]
              }
            ]
          },
          {
            "title":"能赢时不要防",
            "description":"如果你当前有立即五连的一手，就直接获胜，不必再去堵对手。攻防优先级是：我方立即赢 > 对手立即赢 > 我方强制杀 > 对手强制杀。",
            "hint":"不要看到对手有威胁就慌，先确认自己有没有更快的胜利。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"黑方 A 可直接成五，优先级高于普通防守",
                "blackStones":[{"r":6,"c":5},{"r":6,"c":6},{"r":6,"c":7},{"r":6,"c":8}],
                "whiteStones":[{"r":8,"c":5},{"r":8,"c":6},{"r":8,"c":7}],
                "marks":[{"r":6,"c":9,"label":"A","tone":"success"},{"r":8,"c":8,"label":"防","tone":"amber"}],
                "lines":[{"from":{"r":6,"c":5},"to":{"r":6,"c":9},"tone":"success"}]
              }
            ]
          },
          {
            "title":"一手兼顾攻守",
            "description":"高手常找既能挡对手、又能连接自己棋子的点。这样的点会把防守变成反击，而不是单纯挨打。",
            "hint":"比较候选点时，给同时完成两件事的点加分。",
            "checklist":["能按优先级处理对手威胁","能找出一手兼顾攻守的点"]
          }
        ]$steps$::jsonb,
        '[]'::jsonb,
        $content${
          "summary":"建立防守优先级：先挡五，再挡强威胁，并寻找攻守兼顾的落点。",
          "playground":{"gameKey":"gomoku","practiceHref":"/playground/gomoku","practiceCta":"去练防守优先级"}
        }$content$::jsonb
      ),
      (
        '双威胁：双三、四三、双四',
        ARRAY[]::text[],
        'playground',
        5,
        30,
        $steps$[
          {
            "title":"双威胁为什么强",
            "description":"如果一手棋同时制造两个威胁，对手通常只能挡一个，另一个就会继续扩大。这是中盘最常见的取胜方式。",
            "hint":"双威胁的核心不是棋子多，而是对手的防守手数不够。"
          },
          {
            "title":"双三：一手生成两个活三",
            "description":"双三会同时在两条线形成活三。对手挡住横线，竖线还在；挡住竖线，横线还在。",
            "hint":"本站自由五子棋允许双三；连珠比赛中黑方双三通常是禁手。",
            "checklist":["能找出双三的交叉点","知道本站练习不启用禁手"],
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"黑方落 A 后，横竖两条线同时变成活三",
                "blackStones":[{"r":7,"c":6},{"r":7,"c":8},{"r":6,"c":7},{"r":8,"c":7}],
                "whiteStones":[{"r":6,"c":8}],
                "marks":[{"r":7,"c":7,"label":"A","tone":"danger"}],
                "lines":[
                  {"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"danger","dashed":true},
                  {"from":{"r":5,"c":7},"to":{"r":9,"c":7},"tone":"danger","dashed":true}
                ]
              }
            ]
          },
          {
            "title":"四三：一个四加一个活三",
            "description":"四三更强：对手必须先挡四，但挡完之后，活三还会继续变成四，节奏仍在你手里。",
            "hint":"看到四三时，先处理四；自己制造四三时，要确保三那条线是真活三。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"黑方落 A 后，横线成活四，斜线成活三",
                "blackStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":6,"c":9},{"r":8,"c":7}],
                "marks":[{"r":7,"c":8,"label":"A","tone":"danger"}],
                "lines":[
                  {"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"danger"},
                  {"from":{"r":6,"c":9},"to":{"r":9,"c":6},"tone":"amber","dashed":true}
                ]
              }
            ]
          },
          {
            "title":"双四：对手几乎挡不完",
            "description":"双四是一手棋同时在两条线形成四。对手挡其中一条，另一条仍然能下一手成五。",
            "hint":"如果你能制造双四，通常已经进入必胜阶段。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"黑方落 A 后，横线和竖线同时成为四",
                "blackStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":8},{"r":5,"c":7},{"r":6,"c":7},{"r":8,"c":7}],
                "marks":[{"r":7,"c":7,"label":"A","tone":"danger"}],
                "lines":[
                  {"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"danger"},
                  {"from":{"r":5,"c":7},"to":{"r":9,"c":7},"tone":"danger"}
                ]
              }
            ]
          },
          {
            "title":"实战目标：每局找一次双威胁",
            "description":"进入进阶难度，先不追求赢。每局至少找一次能同时威胁两条线的候选点，并在复盘时标出来。",
            "hint":"双威胁不一定马上成功，但它会训练你同时看两条线。",
            "checklist":["能解释双三、四三、双四的区别","在实战中主动寻找过双威胁"]
          }
        ]$steps$::jsonb,
        '[]'::jsonb,
        $content${
          "summary":"学习中盘最重要的组合战术：用一手棋制造两个防不完的威胁。",
          "playground":{"gameKey":"gomoku","practiceHref":"/playground/gomoku","practiceCta":"去找双威胁"}
        }$content$::jsonb
      ),
      (
        'VCF 与 VCT：连续威胁读棋',
        ARRAY[]::text[],
        'playground',
        6,
        32,
        $steps$[
          {
            "title":"什么是强制应手",
            "description":"当你下出冲四或活四，对手不挡就会输，这叫强制应手。连续制造强制应手，就能把对手牵着走。",
            "hint":"读棋时只保留对手必须回应的分支，计算量会小很多。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"黑方 1 制造冲四，白方必须挡 2",
                "blackStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":8,"c":8}],
                "whiteStones":[{"r":6,"c":6},{"r":8,"c":6}],
                "marks":[{"r":7,"c":8,"label":"1","tone":"danger"},{"r":7,"c":9,"label":"2","tone":"amber"}],
                "lines":[{"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"danger"}]
              }
            ]
          },
          {
            "title":"VCF：连续冲四取胜",
            "description":"VCF 是 Victory by Continuous Fours：每一手都用四来逼迫对手回应，直到最后形成无法防守的五连。",
            "hint":"VCF 的读法很硬：我下四，你必须挡；我再下四，你还必须挡。",
            "checklist":["知道 VCF 每手都围绕四","能读出 2 到 3 手强制应手"],
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"编号表示读棋顺序：黑 1 冲四，白 2 被迫防守，黑 3 继续冲四",
                "blackStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":6,"c":8},{"r":8,"c":8},{"r":9,"c":8}],
                "whiteStones":[{"r":6,"c":6},{"r":8,"c":6},{"r":7,"c":9}],
                "marks":[{"r":7,"c":8,"label":"1","tone":"danger"},{"r":7,"c":9,"label":"2","tone":"amber"},{"r":10,"c":8,"label":"3","tone":"danger"}],
                "lines":[
                  {"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"danger"},
                  {"from":{"r":6,"c":8},"to":{"r":10,"c":8},"tone":"danger"}
                ]
              }
            ]
          },
          {
            "title":"VCT：用三和四连续威胁",
            "description":"VCT 是 Victory by Continuous Threats：不一定每手都是四，也可能用活三迫使对手进入更差的局面。它更灵活，也更难算。",
            "hint":"新手先掌握 VCF；进阶后再练 VCT，因为活三的真假更容易误判。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"VCT 会把活三、冲四串起来，迫使对手连续补漏",
                "blackStones":[{"r":7,"c":6},{"r":7,"c":7},{"r":8,"c":7},{"r":8,"c":8},{"r":9,"c":9}],
                "whiteStones":[{"r":6,"c":7},{"r":8,"c":6}],
                "marks":[{"r":7,"c":8,"label":"三","tone":"amber"},{"r":10,"c":10,"label":"四","tone":"danger"}],
                "lines":[
                  {"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"amber","dashed":true},
                  {"from":{"r":7,"c":7},"to":{"r":10,"c":10},"tone":"danger"}
                ]
              }
            ]
          },
          {
            "title":"从终点倒推",
            "description":"高手读杀时常从终点倒推：最后怎样五连？倒数第二手怎样让对手挡不完？再往前需要先逼出哪个防守？",
            "hint":"不要无穷枚举。先找目标五连线，再找能逼近目标的强制手。",
            "checklist":["能从一条目标五连线倒推","能区分强制手和普通好手"]
          },
          {
            "title":"挑战大师难度",
            "description":"大师 AI 会使用 VCF 搜索来发现更长的强制胜负。输棋后重点看：AI 哪一手开始让你只能防守？",
            "hint":"把那一手截图或记坐标，下次看到类似形状就提前破坏。",
            "checklist":["挑战一次大师难度","复盘 AI 发起连续威胁的第一手"]
          }
        ]$steps$::jsonb,
        '[]'::jsonb,
        $content${
          "summary":"把单个棋型串成连续威胁，理解 VCF/VCT 读棋和大师 AI 的长线杀法。",
          "playground":{"gameKey":"gomoku","practiceHref":"/playground/gomoku","practiceCta":"挑战大师难度"}
        }$content$::jsonb
      ),
      (
        'AI 是怎么想棋的：评估函数与搜索',
        ARRAY['AI 是怎么想棋的：极小极大算法']::text[],
        'playground',
        7,
        30,
        $steps$[
          {
            "title":"评估函数先给局面打分",
            "description":"AI 会把棋盘切成横、竖、斜线，识别五连、活四、冲四、活三、眠三、活二等棋型，并给不同棋型不同分数。",
            "hint":"强威胁分数远高于普通连接，所以 AI 会优先赢棋、挡四、制造强制手。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"同一个局面里，活三、冲四、防守点会被分别计分",
                "blackStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":9,"c":6},{"r":9,"c":7}],
                "whiteStones":[{"r":6,"c":7},{"r":8,"c":8},{"r":10,"c":5}],
                "marks":[{"r":7,"c":8,"label":"高","tone":"danger"},{"r":9,"c":8,"label":"中","tone":"amber"}],
                "lines":[
                  {"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"danger"},
                  {"from":{"r":9,"c":5},"to":{"r":9,"c":9},"tone":"amber","dashed":true}
                ]
              }
            ]
          },
          {
            "title":"极小极大：我方取最大，对手取最小",
            "description":"AI 假设双方都会下好棋。轮到 AI 时，它选择让自己分数最大的分支；轮到你时，它假设你会选择让 AI 最难受的分支。",
            "hint":"这就是 minimax：不是只看自己下一手爽不爽，而是看对手最强反击之后还剩多少优势。",
            "checklist":["能解释最大层和最小层","知道 AI 会假设你会反击"]
          },
          {
            "title":"α-β 剪枝：少算没希望的分支",
            "description":"搜索中如果发现某个候选分支已经不可能比当前最佳方案更好，AI 就提前停止展开。剪枝不改变结论，只节省时间。",
            "hint":"可以把它理解成：既然这条路已经明显更差，就别继续浪费计算。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"虚线表示已被判定不值得继续深入的候选线",
                "blackStones":[{"r":7,"c":7},{"r":7,"c":8},{"r":8,"c":7}],
                "whiteStones":[{"r":6,"c":7},{"r":8,"c":8}],
                "marks":[{"r":7,"c":6,"label":"A","tone":"success"},{"r":6,"c":8,"label":"B","tone":"neutral"},{"r":9,"c":7,"label":"剪","tone":"danger"}],
                "lines":[
                  {"from":{"r":7,"c":6},"to":{"r":7,"c":9},"tone":"success"},
                  {"from":{"r":9,"c":7},"to":{"r":11,"c":7},"tone":"danger","dashed":true}
                ]
              }
            ]
          },
          {
            "title":"三档难度对应三种计算量",
            "description":"入门只做单步评估，容易漏掉组合威胁；进阶使用 3 层 minimax 和强制应对；大师使用 5 层 minimax，并加入 VCF 搜索看更远的连续冲四。",
            "hint":"你赢不了大师时，不代表规则难，而是它比你多读了几层强制手。",
            "checklist":["能说出三档 AI 的差别","能解释为什么 VCF 能看得更远"]
          },
          {
            "title":"反过来学习 AI",
            "description":"把 AI 的想法变成自己的检查表：我能不能立即赢？对手能不能立即赢？我有没有双威胁？对手有没有强制杀？哪个候选点总分最高？",
            "hint":"当你也按这个顺序思考，棋力会明显稳定。",
            "checklist":["用 AI 检查表复盘一局","找出一手自己低估的对手反击"]
          }
        ]$steps$::jsonb,
        '[]'::jsonb,
        $content${
          "summary":"看懂站内 AI：棋型评估、minimax、α-β 剪枝和 VCF 搜索如何协同选点。",
          "playground":{"gameKey":"gomoku","practiceHref":"/playground/gomoku","practiceCta":"去观察 AI 选点"}
        }$content$::jsonb
      ),
      (
        '实战复盘：从入门到高手的训练清单',
        ARRAY[]::text[],
        'playground',
        8,
        26,
        $steps$[
          {
            "title":"每手落子前的 5 秒检查",
            "description":"养成固定顺序：我能不能赢？对手能不能赢？我有没有四或活三？对手有没有四或活三？有没有一手兼顾攻守？",
            "hint":"高手不是每手都算很深，而是不会漏掉最重要的浅层威胁。",
            "checklist":["能背出 5 秒检查顺序","实战中至少连续 10 手使用这个顺序"]
          },
          {
            "title":"复盘只抓三类错误",
            "description":"第一类是漏挡对手的四；第二类是把假活三当真活三；第三类是没看到对手的双威胁。先修这三类，胜率提升最快。",
            "hint":"复盘不要把每一步都重算，先抓最大损失点。",
            "visuals":[
              {
                "type":"gomoku_board",
                "caption":"复盘标记：A 是漏挡的冲四点，B 是自己贪攻的低优先级点",
                "blackStones":[{"r":9,"c":7},{"r":9,"c":8},{"r":8,"c":8}],
                "whiteStones":[{"r":7,"c":5},{"r":7,"c":6},{"r":7,"c":7},{"r":7,"c":8}],
                "marks":[{"r":7,"c":9,"label":"A","tone":"danger"},{"r":8,"c":9,"label":"B","tone":"neutral"}],
                "lines":[{"from":{"r":7,"c":5},"to":{"r":7,"c":9},"tone":"danger"}]
              }
            ]
          },
          {
            "title":"难度进阶路线",
            "description":"入门难度练规则和候选点；进阶难度练活三、冲四和双威胁；大师难度练防强制杀和复盘 AI 的第一手杀点。",
            "hint":"不要只刷胜场。每个难度都给自己一个明确训练目标。",
            "checklist":["入门：能稳定不漏直接五连","进阶：能主动制造一次双威胁","大师：能复盘一次 VCF 起点"]
          },
          {
            "title":"双人或在线模式练表达",
            "description":"和同学下棋时，每局结束后互相说出：哪一步是最大威胁？哪一步是转折？如果重来，最想改哪一手？",
            "hint":"能讲清楚，才说明你真的看懂了。",
            "checklist":["完成一次双人或在线对局","说出本局一个转折点"]
          },
          {
            "title":"高手拓展：连珠规则",
            "description":"如果以后参加连珠或规范比赛，需要学习黑方禁手：三三、四四、长连等。它们是为了平衡先手优势；本站游乐场暂不启用这些禁手。",
            "hint":"把禁手当成下一阶段知识：先学自由五子棋，再理解为什么比赛要限制黑方。",
            "checklist":["能说明本站规则和连珠规则的差异","知道三三、四四、长连属于禁手主题"]
          }
        ]$steps$::jsonb,
        '[]'::jsonb,
        $content${
          "summary":"把课程知识转成每局都能执行的检查表、复盘表和难度进阶路线。",
          "playground":{"gameKey":"gomoku","practiceHref":"/playground/gomoku","practiceCta":"去完成一次复盘局"}
        }$content$::jsonb
      )
    ) AS lessons(title, legacy_titles, lesson_type, sort_order, duration_minutes, steps, resources, content)
  LOOP
    SELECT id INTO v_lesson_id
    FROM public.course_lessons
    WHERE course_id = v_course_id
      AND (
        title = lesson.title
        OR title = ANY(lesson.legacy_titles)
      )
    ORDER BY CASE WHEN title = lesson.title THEN 0 ELSE 1 END, id
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
        lesson.resources,
        lesson.content
      );
    ELSE
      UPDATE public.course_lessons
      SET
        title = lesson.title,
        lesson_type = lesson.lesson_type,
        sort_order = lesson.sort_order,
        duration_minutes = lesson.duration_minutes,
        steps = lesson.steps,
        resources = lesson.resources,
        content = lesson.content
      WHERE id = v_lesson_id;
    END IF;
  END LOOP;
END $$;
