-- 将课程卡中的年龄缩写改为家长和学生都能直接理解的中文表述。
UPDATE public.courses AS course
SET description = copy.description,
    updated_at = NOW()
FROM (
  VALUES
    (
      '小班大颗粒积木',
      '适合 3 岁以上的大颗粒积木创意搭建课：100 个主题，结合课件、动画与分步引导，边学边搭完成作品。'
    ),
    (
      '中班大颗粒积木',
      '适合 4 岁以上的大颗粒积木创意搭建课：100 个主题，结合课件、动画与分步引导，边学边搭完成作品。'
    ),
    (
      '大班大颗粒积木',
      '适合 5 岁以上的大颗粒积木创意搭建课：100 个主题，结合课件、动画与分步引导，边学边搭完成作品。'
    )
) AS copy(title, description)
WHERE course.title = copy.title
  AND course.description IS DISTINCT FROM copy.description;
