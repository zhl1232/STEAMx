-- 完全解耦观察记录与项目/挑战
-- 移除 observation_events 上的 project_id / challenge_id 外键列
-- 移除 project_species / challenge_species 策展关系表

-- 1. 移除外键索引
DROP INDEX IF EXISTS idx_observation_events_project_id;
DROP INDEX IF EXISTS idx_observation_events_challenge_id;

-- 2. 移除列
ALTER TABLE observation_events DROP COLUMN IF EXISTS project_id;
ALTER TABLE observation_events DROP COLUMN IF EXISTS challenge_id;

-- 3. 移除策展关系表
DROP TABLE IF EXISTS challenge_species;
DROP TABLE IF EXISTS project_species;
