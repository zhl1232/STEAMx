-- 移除五子棋课程课时中的外部参考资源（RenjuNet、Wikipedia 等国内不可访问链接）。
UPDATE public.course_lessons cl
SET resources = '[]'::jsonb
FROM public.courses c
WHERE cl.course_id = c.id
  AND c.title = '五子棋博弈论入门'
  AND cl.resources IS NOT NULL
  AND cl.resources != '[]'::jsonb;
