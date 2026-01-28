-- ============================================
-- 分类管理表
-- ============================================
-- 创建主分类表和子分类表，用于项目的分类管理
-- ============================================

-- ============================================
-- 1. 主分类表 (categories)
-- ============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有人可读
CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT
  USING (true);

-- 管理员可以管理分类
CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 2. 子分类表 (sub_categories)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sub_categories (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(category_id, name)
);

-- 启用 RLS
ALTER TABLE public.sub_categories ENABLE ROW LEVEL SECURITY;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sub_categories_category ON public.sub_categories(category_id);

-- RLS 策略：所有人可读
CREATE POLICY "Sub categories are viewable by everyone"
  ON public.sub_categories FOR SELECT
  USING (true);

-- 管理员可以管理子分类
CREATE POLICY "Admins can manage sub categories"
  ON public.sub_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 3. 插入初始分类数据
-- ============================================

-- 主分类
INSERT INTO public.categories (name, icon, sort_order) VALUES
  ('科学', '🔬', 1),
  ('技术', '💻', 2),
  ('工程', '🔧', 3),
  ('艺术', '🎨', 4),
  ('数学', '📐', 5),
  ('其他', '📦', 6);

-- 子分类
INSERT INTO public.sub_categories (category_id, name, sort_order) VALUES
  -- 科学 (category_id = 1)
  ((SELECT id FROM public.categories WHERE name = '科学'), '物理实验', 1),
  ((SELECT id FROM public.categories WHERE name = '科学'), '化学实验', 2),
  ((SELECT id FROM public.categories WHERE name = '科学'), '生物观察', 3),
  ((SELECT id FROM public.categories WHERE name = '科学'), '天文地理', 4),
  -- 技术 (category_id = 2)
  ((SELECT id FROM public.categories WHERE name = '技术'), '编程入门', 1),
  ((SELECT id FROM public.categories WHERE name = '技术'), '电子制作', 2),
  ((SELECT id FROM public.categories WHERE name = '技术'), '机器人', 3),
  ((SELECT id FROM public.categories WHERE name = '技术'), '3D打印', 4),
  -- 工程 (category_id = 3)
  ((SELECT id FROM public.categories WHERE name = '工程'), '机械结构', 1),
  ((SELECT id FROM public.categories WHERE name = '工程'), '桥梁建造', 2),
  ((SELECT id FROM public.categories WHERE name = '工程'), '简易机器', 3),
  ((SELECT id FROM public.categories WHERE name = '工程'), '模型制作', 4),
  -- 艺术 (category_id = 4)
  ((SELECT id FROM public.categories WHERE name = '艺术'), '绘画', 1),
  ((SELECT id FROM public.categories WHERE name = '艺术'), '手工', 2),
  ((SELECT id FROM public.categories WHERE name = '艺术'), '雕塑', 3),
  -- 数学 (category_id = 5)
  ((SELECT id FROM public.categories WHERE name = '数学'), '几何探索', 1),
  ((SELECT id FROM public.categories WHERE name = '数学'), '逻辑游戏', 2),
  ((SELECT id FROM public.categories WHERE name = '数学'), '数学魔术', 3),
  ((SELECT id FROM public.categories WHERE name = '数学'), '统计实验', 4),
  -- 其他 (category_id = 6)
  ((SELECT id FROM public.categories WHERE name = '其他'), '生活技能', 1),
  ((SELECT id FROM public.categories WHERE name = '其他'), '户外探索', 2);

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 分类表创建完成！';
  RAISE NOTICE '📊 已创建 categories 和 sub_categories 表';
  RAISE NOTICE '🔒 已配置 RLS 策略';
  RAISE NOTICE '📝 已插入初始分类数据';
END $$;
