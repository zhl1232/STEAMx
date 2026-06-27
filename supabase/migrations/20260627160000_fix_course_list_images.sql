-- 修正大颗粒积木与五子棋课程的列表配图，使其与课程主题相符
-- 大颗粒积木工程启蒙：tech_3dprint（3D 打印）→ eng_models（工程模型/积木搭建）
UPDATE public.courses
SET image_url = '/projects/eng_models.webp', updated_at = now()
WHERE title = '大颗粒积木工程启蒙' AND image_url = '/projects/tech_3dprint.webp';

-- 五子棋博弈论入门：tech_3dprint（3D 打印）→ gomoku_board（棋盘对局）
UPDATE public.courses
SET image_url = '/projects/gomoku_board.png', updated_at = now()
WHERE title = '五子棋博弈论入门' AND image_url = '/projects/tech_3dprint.webp';
