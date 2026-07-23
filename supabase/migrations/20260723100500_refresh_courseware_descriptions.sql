-- 使用面向学生与家长的课程卡文案，不暴露后台保留的 PDF 资源。
UPDATE public.courses AS course
SET description = copy.description,
    updated_at = NOW()
FROM (
  VALUES
    (
      '小班大颗粒积木',
      '3+ 大颗粒积木创意搭建课：100 个主题，结合课件、动画与分步引导，边学边搭完成作品。'
    ),
    (
      '中班大颗粒积木',
      '4+ 大颗粒积木创意搭建课：100 个主题，结合课件、动画与分步引导，边学边搭完成作品。'
    ),
    (
      '大班大颗粒积木',
      '5+ 大颗粒积木创意搭建课：100 个主题，结合课件、动画与分步引导，边学边搭完成作品。'
    )
) AS copy(title, description)
WHERE course.title = copy.title
  AND course.description IS DISTINCT FROM copy.description;
