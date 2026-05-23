-- 修正补图后的技术分类剩余项目 image_url
--
-- 说明：project-0203.webp 到 project-0205.webp 当前已被工程分类项目占用，
-- 因此本次新增技术补图使用当前空闲编号 project-0405.webp 到 project-0407.webp。

WITH corrections(title, category, image_url) AS (
  VALUES
    ('导电面团实验',     '技术', '/projects/generated/project-0405.webp'),
    ('摩尔斯电码通信器', '技术', '/projects/generated/project-0406.webp'),
    ('Arduino 气象站',   '技术', '/projects/generated/project-0407.webp'),
    ('牙刷机器人',       '技术', '/projects/generated/project-0165.webp')
)
UPDATE public.projects AS p
SET image_url = c.image_url
FROM corrections AS c
WHERE p.title = c.title
  AND p.category = c.category;
