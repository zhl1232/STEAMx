-- 电路拼图已从游乐场移除，下线相关徽章定义
DELETE FROM public.user_badges
WHERE badge_id IN ('circuit_first_solve', 'circuit_10', 'circuit_logic');

DELETE FROM public.badges
WHERE id IN ('circuit_first_solve', 'circuit_10', 'circuit_logic');
