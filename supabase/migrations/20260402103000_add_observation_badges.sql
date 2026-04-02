INSERT INTO public.badges (id, name, description, icon, condition) VALUES
('bird_observer_bronze', '观察家 · 铜', '提交 1 条观察记录', 'binoculars', '{"kind":"tiered","seriesKey":"bird_observer","threshold":1}'::jsonb),
('bird_observer_silver', '观察家 · 银', '提交 10 条观察记录', 'binoculars', '{"kind":"tiered","seriesKey":"bird_observer","threshold":10}'::jsonb),
('bird_observer_gold', '观察家 · 金', '提交 30 条观察记录', 'binoculars', '{"kind":"tiered","seriesKey":"bird_observer","threshold":30}'::jsonb),
('bird_observer_platinum', '观察家 · 白金', '提交 100 条观察记录', 'binoculars', '{"kind":"tiered","seriesKey":"bird_observer","threshold":100}'::jsonb),
('species_collector_bronze', '物种收集 · 铜', '观察到 3 种不同物种', 'feather', '{"kind":"tiered","seriesKey":"species_collector","threshold":3}'::jsonb),
('species_collector_silver', '物种收集 · 银', '观察到 10 种不同物种', 'feather', '{"kind":"tiered","seriesKey":"species_collector","threshold":10}'::jsonb),
('species_collector_gold', '物种收集 · 金', '观察到 30 种不同物种', 'feather', '{"kind":"tiered","seriesKey":"species_collector","threshold":30}'::jsonb),
('species_collector_platinum', '物种收集 · 白金', '观察到 80 种不同物种', 'feather', '{"kind":"tiered","seriesKey":"species_collector","threshold":80}'::jsonb),
('first_observation', '第一次观察', '提交第一条鸟类观察记录', 'eye', '{"kind":"single","seriesKey":"bird_observation"}'::jsonb),
('observation_streak_7', '连续观察 7 天', '连续 7 天提交观察记录', 'flame', '{"kind":"single","seriesKey":"bird_observation"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  condition = EXCLUDED.condition;
