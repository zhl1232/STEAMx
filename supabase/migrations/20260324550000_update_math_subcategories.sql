-- ============================================
-- 更新数学类子分类：对齐 PROJECT_CONTENT_PLAN
--   逻辑游戏 → 逻辑谜题
--   数学魔术 → 数学游戏
-- ============================================

DO $$
DECLARE
    v_math_id INT;
BEGIN
    SELECT id INTO v_math_id FROM public.categories WHERE name = '数学' LIMIT 1;

    IF v_math_id IS NULL THEN
        RAISE EXCEPTION '找不到数学分类';
    END IF;

    -- 1) 逻辑游戏 → 逻辑谜题
    UPDATE public.sub_categories
       SET name = '逻辑谜题'
     WHERE category_id = v_math_id AND name = '逻辑游戏';

    -- 2) 数学魔术 → 数学游戏
    UPDATE public.sub_categories
       SET name = '数学游戏'
     WHERE category_id = v_math_id AND name = '数学魔术';

    -- 3) 统计实验 → 删除（如果没有关联项目）或保留
    -- 保留不删，以防有关联数据
END $$;
