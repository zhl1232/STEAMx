-- 五子棋课程配图改走本地 /courses/ 路径
-- 上一迁移把 image_url 设为 /projects/gomoku_board.png，但 /projects/ 前缀会被重写到 CDN（assets.steamx.cc），
-- 而新生成的棋盘图只存在于本地 public/courses/，CDN 上没有，导致列表图 404。
-- /courses/ 不在资源重写白名单，可直接由应用 origin 服务。
UPDATE public.courses
SET image_url = '/courses/gomoku_board.png', updated_at = now()
WHERE title = '五子棋博弈论入门';
