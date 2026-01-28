-- ============================================
-- 更新项目表结构
-- ============================================
-- 添加子分类关联和星级难度字段
-- ============================================

-- ============================================
-- 1. 添加子分类关联字段
-- ============================================
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS sub_category_id INT 
  REFERENCES public.sub_categories(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_sub_category ON public.projects(sub_category_id);

-- ============================================
-- 2. 添加星级难度字段
-- ============================================
-- 难度星级: 1-5 普通, 6 传说级
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS difficulty_stars INT DEFAULT 3
  CHECK (difficulty_stars >= 1 AND difficulty_stars <= 6);

-- ============================================
-- 3. 迁移现有 difficulty 数据
-- ============================================
UPDATE public.projects 
SET difficulty_stars = 
  CASE 
    WHEN difficulty = 'easy' THEN 2
    WHEN difficulty = 'medium' THEN 3
    WHEN difficulty = 'hard' THEN 4
    ELSE 3
  END
WHERE difficulty IS NOT NULL AND difficulty_stars = 3;

-- ============================================
-- 4. 迁移现有 category 数据到 sub_category_id
-- ============================================
-- 尝试将旧的 category 文本匹配到新的 categories 表
-- 如果匹配到主分类，则关联到该分类下的第一个子分类
UPDATE public.projects p
SET sub_category_id = (
  SELECT sc.id 
  FROM public.sub_categories sc
  JOIN public.categories c ON sc.category_id = c.id
  WHERE c.name = p.category
  ORDER BY sc.sort_order
  LIMIT 1
)
WHERE p.category IS NOT NULL 
  AND p.sub_category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.categories WHERE name = p.category
  );

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 项目表结构更新完成！';
  RAISE NOTICE '📊 已添加 sub_category_id 字段';
  RAISE NOTICE '⭐ 已添加 difficulty_stars 字段 (1-6)';
  RAISE NOTICE '🔄 已迁移现有数据';
END $$;
