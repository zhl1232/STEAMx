-- Replace misleading educational images with dated, reproducible correction diagrams.
BEGIN;
SET LOCAL request.jwt.claim.role = 'service_role';

DO $$
DECLARE v_title text;
BEGIN
  SELECT title INTO v_title FROM public.projects WHERE id = 158;
  IF v_title IS DISTINCT FROM '光控小夜灯' THEN RAISE EXCEPTION 'Project 158 title mismatch'; END IF;
  SELECT title INTO v_title FROM public.projects WHERE id = 343;
  IF v_title IS DISTINCT FROM '几何印章肥皂雕刻' THEN RAISE EXCEPTION 'Project 343 title mismatch'; END IF;
  SELECT title INTO v_title FROM public.projects WHERE id = 378;
  IF v_title IS DISTINCT FROM '数字黑洞 6174' THEN RAISE EXCEPTION 'Project 378 title mismatch'; END IF;
END $$;

UPDATE public.project_steps
SET image_url = '/projects/corrections/20260915-project-158-circuit.png'
WHERE project_id = 158 AND sort_order = 2;

UPDATE public.projects
SET image_url = '/projects/corrections/20260915-project-343-stamp.png'
WHERE id = 343;
UPDATE public.project_steps
SET image_url = NULL
WHERE project_id = 343;

UPDATE public.projects
SET image_url = '/projects/corrections/20260915-project-378-kaprekar-four-digit.png'
WHERE id = 378;
UPDATE public.project_steps
SET image_url = NULL
WHERE project_id = 378;
UPDATE public.project_steps
SET image_url = CASE sort_order
  WHEN 3 THEN '/projects/corrections/20260915-project-378-kaprekar-four-digit.png'
  WHEN 6 THEN '/projects/corrections/20260915-project-378-kaprekar-three-digit.png'
  ELSE NULL
END
WHERE project_id = 378;

COMMIT;
