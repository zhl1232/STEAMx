-- 移除学前/样板大颗粒课程包，线上改由 3+/4+/5+ 课件100 三门课承载积木搭建内容。
-- 幂等：按 title 删除；course_lessons / user_lesson_progress 随 FK CASCADE 清理。

DELETE FROM public.courses
WHERE title IN (
  '小小积木工程师：学前大颗粒启蒙',
  '大颗粒积木工程启蒙'
);
