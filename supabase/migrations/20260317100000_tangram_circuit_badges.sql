INSERT INTO public.badges (id, name, description, icon, condition)
VALUES
  ('circuit_first_solve', '电路入门', '首次点亮灯泡', 'zap', '{"type":"circuit","stat":"circuitSolved","gte":1}'::jsonb),
  ('circuit_10',          '电工达人', '累计完成 10 个电路关卡', 'sparkles', '{"type":"circuit","stat":"circuitSolved","gte":10}'::jsonb),
  ('circuit_logic',       '逻辑门大师', '完成所有含逻辑门的关卡', 'brain', '{"type":"circuit","stat":"circuitLogicCleared","eq":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  condition   = EXCLUDED.condition;
