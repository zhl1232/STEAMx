-- =============================================================================
-- 学习资料卡（learning_resources）：可跨挑战复用的脚手架内容载体
-- 用途：PBL 挑战「相关资料」三分类脚手架中的「资料卡」落点（/resources/[id]），
--       站内缺少对应项目/技能内容时也可作为兜底载体（skill / case 类）。
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.learning_resources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title varchar(120) NOT NULL,
  summary text,
  content_md text NOT NULL,
  category varchar(20) NOT NULL
    CHECK (category IN ('principle', 'material', 'method', 'skill', 'case')),
  cover_image_url text,
  status varchar(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_resources_status
  ON public.learning_resources(status);

ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;

-- 公开读取已发布资料；管理员/审核员可读全部
CREATE POLICY "learning_resources_select" ON public.learning_resources
  FOR SELECT USING (
    status = 'published'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "learning_resources_admin_insert" ON public.learning_resources
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "learning_resources_admin_update" ON public.learning_resources
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "learning_resources_admin_delete" ON public.learning_resources
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

NOTIFY pgrst, 'reload schema';
