-- 把样板课「会跑的小车」接到自托管的 LDraw 真实大颗粒模型（duplo-car.mpd）。
-- 用 UPDATE 保证早先已 seed 的数据库也能补上 ldrawModelUrl 等字段，并对齐 3 步搭建。
UPDATE public.course_lessons AS l
SET
  steps = '[
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
  content = '{
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
FROM public.courses AS c
WHERE l.course_id = c.id
  AND c.title = '大颗粒积木工程启蒙'
  AND l.title = '会跑的小车';
