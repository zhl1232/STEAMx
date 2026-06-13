-- 徽章体系整理：
-- 1. 补齐游乐场单档徽章定义，供 playground_stats 云端战绩补发时满足 FK
-- 2. 下线与阶梯铜牌重复的单档徽章
-- 3. 同步社区阶梯/七巧板描述

INSERT INTO public.badges (id, name, description, icon, condition) VALUES
-- 扫雷
('minesweeper_rookie', '排雷新兵', '首次通关扫雷（任意难度）', 'bomb', '{"kind":"single","seriesKey":"minesweeper"}'::jsonb),
('minesweeper_expert', '排雷专家', '完成高级难度扫雷通关', 'shield_star', '{"kind":"single","seriesKey":"minesweeper"}'::jsonb),
('minesweeper_speedster', '极速拆弹', '在 60 秒内通关扫雷（任意难度）', 'timer', '{"kind":"single","seriesKey":"minesweeper"}'::jsonb),
-- 五子棋
('gomoku_rookie', '开局先锋', '首次赢下一局五子棋', 'grid_nine', '{"kind":"single","seriesKey":"gomoku"}'::jsonb),
('gomoku_strategist', '博弈策士', '在对战 AI 模式中取得胜利', 'strategy', '{"kind":"single","seriesKey":"gomoku"}'::jsonb),
('gomoku_master', '连珠大师', '累计赢下 10 局五子棋', 'trophy', '{"kind":"single","seriesKey":"gomoku"}'::jsonb),
-- 2048
('game2048_first_win', '方块合一', '首次合成 2048 方块', 'number_square_two', '{"kind":"single","seriesKey":"game2048"}'::jsonb),
('game2048_4096', '超越极限', '合成 4096 方块', 'cube', '{"kind":"single","seriesKey":"game2048"}'::jsonb),
('game2048_8192', '数字传说', '合成 8192 方块', 'crown', '{"kind":"single","seriesKey":"game2048"}'::jsonb),
('game2048_high_scorer', '高分收割者', '单局得分超过 20000', 'trophy', '{"kind":"single","seriesKey":"game2048"}'::jsonb),
-- 24 点
('game24_first_solve', '心算入门', '首次算出 24 点', 'calculator', '{"kind":"single","seriesKey":"game24"}'::jsonb),
('game24_streak_5', '连胜达人', '24 点连续解出 5 题', 'flame', '{"kind":"single","seriesKey":"game24"}'::jsonb),
('game24_streak_10', '心算大师', '24 点连续解出 10 题', 'brain', '{"kind":"single","seriesKey":"game24"}'::jsonb),
('game24_speed', '闪电速算', '在 10 秒内解出 24 点', 'zap', '{"kind":"single","seriesKey":"game24"}'::jsonb),
('game24_50', '二十四点能手', '累计解出 50 题 24 点', 'award', '{"kind":"single","seriesKey":"game24"}'::jsonb),
-- 生命游戏
('life_explorer', '涌现探索者', '首次运行生命游戏', 'dna', '{"kind":"single","seriesKey":"life"}'::jsonb),
('life_observer', '长时演化者', '生命游戏演化超过 1000 代', 'tree_structure', '{"kind":"single","seriesKey":"life"}'::jsonb),
('life_challenge_first', '生命设计师', '完成 1 个生命游戏挑战', 'target', '{"kind":"single","seriesKey":"life"}'::jsonb),
('life_challenge_all', '涌现工程师', '完成所有生命游戏挑战', 'sparkles', '{"kind":"single","seriesKey":"life"}'::jsonb),
-- 汉诺塔
('hanoi_first_win', '塔之初见', '首次通关汉诺塔', 'layers', '{"kind":"single","seriesKey":"hanoi"}'::jsonb),
('hanoi_perfect', '巴别塔最优解', '以最少步数（2ⁿ−1）通关汉诺塔', 'target', '{"kind":"single","seriesKey":"hanoi"}'::jsonb),
('hanoi_master', '八层通塔', '通关 8 层汉诺塔', 'tree_structure', '{"kind":"single","seriesKey":"hanoi"}'::jsonb),
-- 数独 / N 皇后
('sudoku_first_win', '数独入门', '首次通关数独', 'hash', '{"kind":"single","seriesKey":"sudoku"}'::jsonb),
('sudoku_hard', '数独高手', '通关困难难度数独', 'target', '{"kind":"single","seriesKey":"sudoku"}'::jsonb),
('sudoku_master', '约束大师', '累计通关 10 次数独', 'puzzle_piece', '{"kind":"single","seriesKey":"sudoku"}'::jsonb),
('nqueens_first_solve', '落子定局', '首次手动解出 N 皇后', 'crown', '{"kind":"single","seriesKey":"nqueens"}'::jsonb),
('nqueens_master', '回溯专家', '累计手动解出 5 次 N 皇后', 'strategy', '{"kind":"single","seriesKey":"nqueens"}'::jsonb),
-- 电路拼图
('circuit_first_solve', '电路入门', '首次点亮灯泡', 'lightbulb_filament', '{"kind":"single","seriesKey":"circuit"}'::jsonb),
('circuit_10', '回路能手', '累计完成 10 个电路关卡', 'circuitry', '{"kind":"single","seriesKey":"circuit"}'::jsonb),
('circuit_logic', '逻辑门大师', '完成所有含逻辑门的关卡', 'binary', '{"kind":"single","seriesKey":"circuit"}'::jsonb),
-- 排序可视化
('sorting_first_run', '排序初试', '首次运行排序可视化', 'grid_3x3', '{"kind":"single","seriesKey":"sorting"}'::jsonb),
('sorting_polyglot', '算法巡礼', '体验全部 5 种排序算法', 'git_branch', '{"kind":"single","seriesKey":"sorting"}'::jsonb),
-- 游乐场新增玩法
('fifteen_first', '滑块入门', '首次复原数字华容道', 'grid_nine', '{"kind":"single","seriesKey":"fifteen"}'::jsonb),
('fifteen_master', '空间规划师', '累计复原 5 次数字华容道', 'puzzle_piece', '{"kind":"single","seriesKey":"fifteen"}'::jsonb),
('memory_first', '记忆点亮', '首次完成记忆翻牌', 'brain', '{"kind":"single","seriesKey":"memory"}'::jsonb),
('memory_master', '记忆达人', '累计完成 5 次记忆翻牌', 'award', '{"kind":"single","seriesKey":"memory"}'::jsonb),
('quick_math_first', '速算起跑', '速算闪电战得分达到 100', 'calculator', '{"kind":"single","seriesKey":"quickmath"}'::jsonb),
('quick_math_combo', '连击心算家', '速算闪电战达到 10 连击', 'zap', '{"kind":"single","seriesKey":"quickmath"}'::jsonb),
('maze_first', '迷宫初探', '首次走出迷宫', 'compass', '{"kind":"single","seriesKey":"maze"}'::jsonb),
('maze_master', '寻路专家', '累计走出 5 次迷宫', 'route', '{"kind":"single","seriesKey":"maze"}'::jsonb),
('tangram_first', '几何拼手', '完成 1 个七巧板剪影', 'palette', '{"kind":"single","seriesKey":"tangram"}'::jsonb),
('tangram_all', '七巧大师', '完成全部 4 个七巧板剪影', 'sparkles', '{"kind":"single","seriesKey":"tangram"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  condition = EXCLUDED.condition;

UPDATE public.badges
SET description = CASE id
  WHEN 'social_bronze' THEN '发帖、评论与回复合计 1 条'
  WHEN 'social_silver' THEN '发帖、评论与回复合计 30 条'
  WHEN 'social_gold' THEN '发帖、评论与回复合计 150 条'
  WHEN 'social_platinum' THEN '发帖、评论与回复合计 500 条'
  ELSE description
END
WHERE id IN ('social_bronze', 'social_silver', 'social_gold', 'social_platinum');

DELETE FROM public.user_badges
WHERE badge_id IN ('social_butterfly', 'first_observation', 'observation_streak_7');

DELETE FROM public.badges
WHERE id IN ('social_butterfly', 'first_observation', 'observation_streak_7');
