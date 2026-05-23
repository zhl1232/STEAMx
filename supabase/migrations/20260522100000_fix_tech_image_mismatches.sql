-- 修正技术分类下图片错配的项目 image_url
--
-- 背景：AI 生成 public/projects/generated/project-XXXX.webp 时，机器人和电子制作
-- 子类有多张图被分配到了错误的项目。经人工核对后，以下 12 个项目能明确按图内容
-- 重新归位（孤儿图和孤儿项目暂不处理，后续补图时再说）。

WITH corrections(title, category, image_url) AS (
  VALUES
    -- 机器人子类（7 个）
    ('纸杯振动机器人',   '技术', '/projects/generated/project-0164.webp'),
    ('纸板机器人手偶',   '技术', '/projects/generated/project-0163.webp'),
    ('气球动力机器人',   '技术', '/projects/generated/project-0167.webp'),
    ('弹射机器人',       '技术', '/projects/generated/project-0170.webp'),
    ('遥控纸板车',       '技术', '/projects/generated/project-0166.webp'),
    ('简易爬坡车',       '技术', '/projects/generated/project-0168.webp'),
    ('橡皮筋动力机器人', '技术', '/projects/generated/project-0169.webp'),
    -- 电子制作子类（5 个）
    ('触摸感应灯',       '技术', '/projects/generated/project-0149.webp'),
    ('温度感应风扇',     '技术', '/projects/generated/project-0154.webp'),
    ('电磁铁起重机',     '技术', '/projects/generated/project-0159.webp'),
    ('蓝牙音箱制作',     '技术', '/projects/generated/project-0160.webp'),
    ('红外遥控小车',     '技术', '/projects/generated/project-0162.webp')
)
UPDATE public.projects AS p
SET image_url = c.image_url
FROM corrections AS c
WHERE p.title = c.title
  AND p.category = c.category;
