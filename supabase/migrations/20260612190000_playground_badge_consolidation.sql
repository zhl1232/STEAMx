-- 游乐场徽章收敛：
-- 1. 新增跨游戏阶梯系列 playground_explorer / playground_victories
-- 2. 保留 7 枚高难度彩蛋，归入 playground_star
-- 3. 回收并下线 35 枚低门槛单档徽章

INSERT INTO public.badges (id, name, description, icon, condition) VALUES
('playground_explorer_bronze', '游园新客', '玩过 3 个不同游乐场游戏', 'compass', '{"kind":"tiered","seriesKey":"playground_explorer","tier":"bronze"}'::jsonb),
('playground_explorer_silver', '多面玩家', '玩过 6 个不同游乐场游戏', 'compass', '{"kind":"tiered","seriesKey":"playground_explorer","tier":"silver"}'::jsonb),
('playground_explorer_gold', '全能体验官', '玩过 10 个不同游乐场游戏', 'compass', '{"kind":"tiered","seriesKey":"playground_explorer","tier":"gold"}'::jsonb),
('playground_explorer_platinum', '全图鉴玩家', '玩过 15 个不同游乐场游戏', 'compass', '{"kind":"tiered","seriesKey":"playground_explorer","tier":"platinum"}'::jsonb),
('playground_victories_bronze', '首胜达成', '累计胜利/通关 5 次', 'trophy', '{"kind":"tiered","seriesKey":"playground_victories","tier":"bronze"}'::jsonb),
('playground_victories_silver', '连战连捷', '累计胜利/通关 30 次', 'trophy', '{"kind":"tiered","seriesKey":"playground_victories","tier":"silver"}'::jsonb),
('playground_victories_gold', '百战老手', '累计胜利/通关 150 次', 'trophy', '{"kind":"tiered","seriesKey":"playground_victories","tier":"gold"}'::jsonb),
('playground_victories_platinum', '游乐场传奇', '累计胜利/通关 500 次', 'trophy', '{"kind":"tiered","seriesKey":"playground_victories","tier":"platinum"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  condition = EXCLUDED.condition;

UPDATE public.badges
SET condition = jsonb_set(condition, '{seriesKey}', '"playground_star"')
WHERE id IN (
  'minesweeper_speedster',
  'game2048_8192',
  'game24_speed',
  'hanoi_perfect',
  'life_challenge_all',
  'circuit_logic',
  'tangram_all'
);

DELETE FROM public.user_badges
WHERE badge_id IN (
  'minesweeper_rookie',
  'minesweeper_expert',
  'gomoku_rookie',
  'gomoku_strategist',
  'gomoku_master',
  'game2048_first_win',
  'game2048_4096',
  'game2048_high_scorer',
  'game24_first_solve',
  'game24_streak_5',
  'game24_streak_10',
  'game24_50',
  'life_explorer',
  'life_observer',
  'life_challenge_first',
  'hanoi_first_win',
  'hanoi_master',
  'sudoku_first_win',
  'sudoku_hard',
  'sudoku_master',
  'nqueens_first_solve',
  'nqueens_master',
  'circuit_first_solve',
  'circuit_10',
  'sorting_first_run',
  'sorting_polyglot',
  'fifteen_first',
  'fifteen_master',
  'memory_first',
  'memory_master',
  'quick_math_first',
  'quick_math_combo',
  'maze_first',
  'maze_master',
  'tangram_first'
);

DELETE FROM public.badges
WHERE id IN (
  'minesweeper_rookie',
  'minesweeper_expert',
  'gomoku_rookie',
  'gomoku_strategist',
  'gomoku_master',
  'game2048_first_win',
  'game2048_4096',
  'game2048_high_scorer',
  'game24_first_solve',
  'game24_streak_5',
  'game24_streak_10',
  'game24_50',
  'life_explorer',
  'life_observer',
  'life_challenge_first',
  'hanoi_first_win',
  'hanoi_master',
  'sudoku_first_win',
  'sudoku_hard',
  'sudoku_master',
  'nqueens_first_solve',
  'nqueens_master',
  'circuit_first_solve',
  'circuit_10',
  'sorting_first_run',
  'sorting_polyglot',
  'fifteen_first',
  'fifteen_master',
  'memory_first',
  'memory_master',
  'quick_math_first',
  'quick_math_combo',
  'maze_first',
  'maze_master',
  'tangram_first'
);
