-- 修正固定题面迁移中的模板缩进，并把幻方题的换行恢复为真实换行。
BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL request.jwt.claim.role = 'service_role';

UPDATE public.projects
SET description = btrim(description)
WHERE id IN (233, 243, 358, 373, 381);

UPDATE public.project_steps
SET description = btrim(
  replace(description, chr(92) || 'n', chr(10))
)
WHERE project_id IN (233, 243, 358, 373, 381);

ANALYZE public.projects;
ANALYZE public.project_steps;

COMMIT;
