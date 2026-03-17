-- Playground Phase 2: 新增 11 枚游乐场游戏徽章
-- 2048、24 点、生命游戏专属徽章，用于 user_badges FK 约束

INSERT INTO public.badges (id, name, description, icon, condition) VALUES
-- 2048 专属 (4)
('game2048_first_win', '2048 达成', '首次合成 2048 方块', 'grid_3x3', '{"kind":"single","seriesKey":"game2048"}'::jsonb),
('game2048_4096', '超越极限', '合成 4096 方块', 'sparkles', '{"kind":"single","seriesKey":"game2048"}'::jsonb),
('game2048_8192', '数字传说', '合成 8192 方块', 'crown', '{"kind":"single","seriesKey":"game2048"}'::jsonb),
('game2048_high_scorer', '分数霸主', '单局得分超过 20000', 'trophy', '{"kind":"single","seriesKey":"game2048"}'::jsonb),
-- 24 点专属 (5)
('game24_first_solve', '心算入门', '首次算出 24 点', 'calculator', '{"kind":"single","seriesKey":"game24"}'::jsonb),
('game24_streak_5', '连胜达人', '24 点连续解出 5 题', 'flame', '{"kind":"single","seriesKey":"game24"}'::jsonb),
('game24_streak_10', '心算大师', '24 点连续解出 10 题', 'brain', '{"kind":"single","seriesKey":"game24"}'::jsonb),
('game24_speed', '闪电速算', '在 10 秒内解出 24 点', 'zap', '{"kind":"single","seriesKey":"game24"}'::jsonb),
('game24_50', '数学达人', '累计解出 50 题 24 点', 'award', '{"kind":"single","seriesKey":"game24"}'::jsonb),
-- 生命游戏专属 (2)
('life_explorer', '涌现探索者', '首次运行生命游戏', 'dna', '{"kind":"single","seriesKey":"life"}'::jsonb),
('life_observer', '永恒观测者', '生命游戏演化超过 1000 代', 'eye', '{"kind":"single","seriesKey":"life"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  condition = EXCLUDED.condition;
