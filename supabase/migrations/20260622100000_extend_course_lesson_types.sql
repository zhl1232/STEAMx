-- 训练营课时类型从固定枚举扩展为 slug，支持 building_3d 以及后续更多课型。
ALTER TABLE public.course_lessons
  DROP CONSTRAINT IF EXISTS course_lessons_lesson_type_check;

ALTER TABLE public.course_lessons
  ADD CONSTRAINT course_lessons_lesson_type_check
  CHECK (lesson_type ~ '^[a-z][a-z0-9_]{1,31}$');
