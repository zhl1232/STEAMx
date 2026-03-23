CREATE OR REPLACE FUNCTION public.admin_update_project(
  p_project_id bigint,
  p_title text,
  p_description text,
  p_category text,
  p_sub_category_id bigint DEFAULT NULL,
  p_difficulty_stars int DEFAULT 1,
  p_image_url text DEFAULT NULL,
  p_duration int DEFAULT 60,
  p_steam_weights jsonb DEFAULT NULL,
  p_steps jsonb DEFAULT '[]'::jsonb,
  p_materials jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  id bigint,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: moderator or admin role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
  SET
    title = p_title,
    description = p_description,
    category = p_category,
    sub_category_id = p_sub_category_id,
    difficulty_stars = p_difficulty_stars,
    image_url = p_image_url,
    duration = p_duration,
    steam_weights = p_steam_weights,
    updated_at = NOW()
  WHERE projects.id = p_project_id
  RETURNING * INTO v_project;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.project_steps
  WHERE project_steps.project_id = p_project_id;

  INSERT INTO public.project_steps (project_id, title, description, image_url, sort_order)
  SELECT
    p_project_id,
    step.value->>'title',
    NULLIF(step.value->>'description', ''),
    NULLIF(step.value->>'image_url', ''),
    step.ordinality::int
  FROM jsonb_array_elements(COALESCE(p_steps, '[]'::jsonb)) WITH ORDINALITY AS step(value, ordinality);

  DELETE FROM public.project_materials
  WHERE project_materials.project_id = p_project_id;

  INSERT INTO public.project_materials (project_id, material, sort_order)
  SELECT
    p_project_id,
    material.value->>'material',
    material.ordinality::int
  FROM jsonb_array_elements(COALESCE(p_materials, '[]'::jsonb)) WITH ORDINALITY AS material(value, ordinality);

  RETURN QUERY
  SELECT v_project.id, v_project.status;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_project(
  bigint,
  text,
  text,
  text,
  bigint,
  int,
  text,
  int,
  jsonb,
  jsonb,
  jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_update_project(
  bigint,
  text,
  text,
  text,
  bigint,
  int,
  text,
  int,
  jsonb,
  jsonb,
  jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_update_project(
  bigint,
  text,
  text,
  text,
  bigint,
  int,
  text,
  int,
  jsonb,
  jsonb,
  jsonb
) TO service_role;
