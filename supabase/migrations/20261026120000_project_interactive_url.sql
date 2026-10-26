-- 项目可选嵌入的 3D 课本地址（同源静态页，见 docs/textbook3d.md）。
-- 只新增一个可空列和一个格式约束：不改任何现有行，所有项目默认 NULL（不显示课本）。
-- 应用代码在列不存在时按 NULL 处理，所以先发代码、后跑迁移都不会出错。
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS interactive_url text;

COMMENT ON COLUMN public.projects.interactive_url IS
  '可选，嵌入的 3D 课本地址，只能是 /textbook3d/v<版本>/<课号>/ 形式的同源路径；NULL 表示不嵌入。';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_interactive_url_format;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_interactive_url_format CHECK (
    interactive_url IS NULL
    OR interactive_url ~ '^/textbook3d/v[0-9]+/g[0-9]+[ab]-[0-9]+-[0-9]+(/(index\.html)?)?$'
  );
