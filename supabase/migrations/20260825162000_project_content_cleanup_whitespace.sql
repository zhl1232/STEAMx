-- 去掉固定题面和合并项目描述模板留下的首尾换行 / 缩进空白。
BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL request.jwt.claim.role = 'service_role';

UPDATE public.projects
SET description = regexp_replace(
  description,
  '^[[:space:]]+|[[:space:]]+$',
  '',
  'g'
)
WHERE id IN (233, 243, 358, 373, 381);

UPDATE public.project_steps
SET description = regexp_replace(
  description,
  '^[[:space:]]+|[[:space:]]+$',
  '',
  'g'
)
WHERE project_id IN (233, 243, 358, 373, 381);

ANALYZE public.projects;
ANALYZE public.project_steps;

COMMIT;
