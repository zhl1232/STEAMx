-- Fix sort_order collision on 小班大颗粒积木 (course_id=5).
-- Before: lessons 30/31/32 all had sort_order=1; 2 and 3 were missing.
-- After: 埃菲尔铁塔=1, 宝剑=2, 长颈龙=3 (id / pinyin / intended sample-lesson order).

UPDATE public.course_lessons
   SET sort_order = 1,
       updated_at = NOW()
 WHERE id = 30
   AND course_id = 5
   AND title = '埃菲尔铁塔';

UPDATE public.course_lessons
   SET sort_order = 2,
       updated_at = NOW()
 WHERE id = 31
   AND course_id = 5
   AND title = '宝剑';

UPDATE public.course_lessons
   SET sort_order = 3,
       updated_at = NOW()
 WHERE id = 32
   AND course_id = 5
   AND title = '长颈龙';
