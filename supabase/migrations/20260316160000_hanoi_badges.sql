INSERT INTO public.badges (id, name, description, icon, condition)
VALUES
  ('hanoi_first_win', '塔之初见', '首次通关汉诺塔', 'layers', '{"type":"hanoi","stat":"hanoiWins","gte":1}'::jsonb),
  ('hanoi_perfect',   '最优解',   '以最少步数（2ⁿ−1）通关汉诺塔', 'sparkles', '{"type":"hanoi","stat":"hanoiPerfect","gte":1}'::jsonb),
  ('hanoi_master',    '递归大师', '通关汉诺塔 5 次', 'brain', '{"type":"hanoi","stat":"hanoiWins","gte":5}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  condition   = EXCLUDED.condition;
