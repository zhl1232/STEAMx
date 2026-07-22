-- 为家长和学生使用清晰的班级名称，替换课件导入阶段的内部标题。
UPDATE public.courses AS course
SET title = names.new_title,
    updated_at = NOW()
FROM (
  VALUES
    ('3+课件100', '小班大颗粒积木'),
    ('4+课件100', '中班大颗粒积木'),
    ('5+课件100', '大班大颗粒积木')
) AS names(old_title, new_title)
WHERE course.title = names.old_title;
