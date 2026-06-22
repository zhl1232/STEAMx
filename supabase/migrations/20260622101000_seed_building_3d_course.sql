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
        "title":"放好带轮子的车底盘",
        "description":"先放一块带轮子的红色车底盘，把它放平并确认车头和车尾方向。",
        "hint":"底盘放平，后面叠车身时才不会歪。",
        "checklist":["底盘没有倾斜","四个轮子都能转动"]
      },
      {
        "title":"叠上车身",
        "description":"在底盘正中间叠一块黄色长积木做车身，前后对齐底盘。",
        "hint":"车身放在正中间，小车重心才稳。",
        "checklist":["车身和底盘对齐","左右没有露出太多"]
      },
      {
        "title":"装上驾驶舱",
        "description":"在车身上再叠一块蓝色小积木当驾驶舱，让重心保持在中央。",
        "hint":"驾驶舱放中间，推起来才直。",
        "checklist":["驾驶舱不容易倒","小车向前推能直线滑动一小段"]
      }
    ]'::jsonb,
    '[]'::jsonb,
    '{
      "summary":"用大颗粒积木搭一辆稳定的小车，练习对称和重心。",
      "building3d":{
        "ldrawModelUrl":"/courses/ldraw/duplo-car.mpd",
        "ldrawColorUrl":"/courses/ldraw/LDConfig.ldr",
        "attribution":"积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。",
        "parts":[
          {"id":"base","name":"红色车底盘（带轮）","color":"#ef4444","quantity":1},
          {"id":"body","name":"黄色车身 2x4","color":"#facc15","quantity":1},
          {"id":"cab","name":"蓝色驾驶舱 2x2","color":"#3b82f6","quantity":1}
        ],
        "steps3d":[
          {
            "title":"放好带轮子的车底盘",
            "description":"先放一块带轮子的红色车底盘，确认车头方向。",
            "partIds":["base"],
            "cameraHint":"isometric"
          },
          {
            "title":"叠上车身",
            "description":"在底盘正中间叠一块黄色长积木做车身。",
            "partIds":["body"],
            "cameraHint":"front"
          },
          {
            "title":"装上驾驶舱",
            "description":"在车身上叠一块蓝色小积木当驾驶舱。",
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
