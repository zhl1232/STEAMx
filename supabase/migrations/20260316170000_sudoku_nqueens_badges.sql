INSERT INTO public.badges (id, name, description, icon, condition)
VALUES
  ('sudoku_first_win', '数独入门', '首次通关数独', 'hash', '{"type":"sudoku","stat":"sudokuWins","gte":1}'::jsonb),
  ('sudoku_hard',      '数独高手', '通关困难难度数独', 'sparkles', '{"type":"sudoku","stat":"sudokuHardWins","gte":1}'::jsonb),
  ('sudoku_master',    '约束大师', '累计通关 10 次数独', 'brain', '{"type":"sudoku","stat":"sudokuWins","gte":10}'::jsonb),
  ('nqueens_first_solve', '皇后之手', '首次手动解出 N 皇后', 'crown', '{"type":"nqueens","stat":"nqueensManualSolves","gte":1}'::jsonb),
  ('nqueens_master',      '回溯专家', '累计手动解出 5 次 N 皇后', 'brain', '{"type":"nqueens","stat":"nqueensManualSolves","gte":5}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  condition   = EXCLUDED.condition;
