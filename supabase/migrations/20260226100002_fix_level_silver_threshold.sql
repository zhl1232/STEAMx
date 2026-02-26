-- Badge Fixes:
--   1. level_silver 阈值从 25 调整为 20，描述同步更新
--   2. 无需 DDL 变更，仅更新描述字段

UPDATE public.badges
SET description = '达到等级 20'
WHERE id = 'level_silver';
