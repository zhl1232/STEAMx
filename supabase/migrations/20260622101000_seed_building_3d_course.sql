-- 大颗粒积木搭建训练营样板课：使用自制课程内容，不引用官方图纸素材。
DO $$
DECLARE
  v_course_id bigint;
BEGIN
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE title = '大颗粒积木工程启蒙'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    INSERT INTO public.courses (
      title, description, image_url, tags, difficulty_stars, status, sort_order, steam_weights
    )
    VALUES (
      '大颗粒积木工程启蒙',
      '用兼容大颗粒积木完成结构、车辆和故事场景搭建，学习稳定、对称、连接和表达。',
      '/projects/tech_3dprint.webp',
      ARRAY['大颗粒积木','3D图纸','工程','低龄'],
      1,
      'approved',
      20,
      '{"S":5,"T":15,"E":35,"A":25,"M":20}'::jsonb
    )
    RETURNING id INTO v_course_id;
  END IF;

  INSERT INTO public.course_lessons (
    course_id, title, lesson_type, sort_order, duration_minutes, steps, resources, content
  )
  SELECT
    v_course_id,
    '会跑的小车',
    'building_3d',
    1,
    25,
    '[
      {
        "title":"搭好底盘",
        "description":"选择一块长底板作为车身，把它放平并确认前后方向。",
        "hint":"底盘越平，后面装车轮时越容易保持对称。",
        "checklist":["底板没有倾斜","能看出车头和车尾"]
      },
      {
        "title":"装上车轮",
        "description":"把两根连接轴放到底盘下方，再把四个车轮对称装上。",
        "hint":"左右两边的轮子位置要一样高，小车才不容易歪。",
        "checklist":["四个车轮都能转动","左右轮距基本一致"]
      },
      {
        "title":"加上驾驶舱",
        "description":"在车身中间叠上驾驶舱积木，让重心保持在底盘中央。",
        "hint":"如果驾驶舱太靠前或太靠后，小车推起来会不稳。",
        "checklist":["驾驶舱不容易倒","小车向前推能直线滑动一小段"]
      }
    ]'::jsonb,
    '[]'::jsonb,
    '{
      "summary":"用大颗粒积木搭一辆稳定的小车，练习对称和重心。",
      "building3d":{
        "parts":[
          {"id":"base","name":"长底板","color":"#2563eb","quantity":1},
          {"id":"axle","name":"连接轴","color":"#64748b","quantity":2},
          {"id":"wheel","name":"车轮","color":"#111827","quantity":4},
          {"id":"cab","name":"驾驶舱积木","color":"#f59e0b","quantity":2}
        ],
        "steps3d":[
          {
            "title":"搭好底盘",
            "description":"先把长底板放平，确认车身前后方向。",
            "partIds":["base"],
            "cameraHint":"isometric"
          },
          {
            "title":"装上车轮",
            "description":"把两根连接轴放到底盘下方，再把四个车轮对称装上。",
            "partIds":["axle","wheel"],
            "cameraHint":"front"
          },
          {
            "title":"加上驾驶舱",
            "description":"在车身中间叠上驾驶舱积木，让重心保持在底盘中央。",
            "partIds":["cab"],
            "cameraHint":"side"
          }
        ]
      }
    }'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.course_lessons
    WHERE course_id = v_course_id AND title = '会跑的小车'
  );
END $$;
