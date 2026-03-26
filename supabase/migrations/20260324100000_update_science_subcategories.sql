-- ============================================
-- 更新科学类子分类：对齐 PROJECT_CONTENT_PLAN
--   生物观察 → 动物观察 + 植物观察（拆分）
--   天文地理 → 地球与天空（重命名）
-- ============================================

DO $$
DECLARE
    v_science_id INT;
    v_bio_id INT;
    v_max_sort INT;
BEGIN
    SELECT id INTO v_science_id FROM public.categories WHERE name = '科学' LIMIT 1;

    IF v_science_id IS NULL THEN
        RAISE EXCEPTION '找不到科学分类';
    END IF;

    -- 1) 生物观察 → 动物观察
    UPDATE public.sub_categories
       SET name = '动物观察'
     WHERE category_id = v_science_id AND name = '生物观察'
    RETURNING id INTO v_bio_id;

    -- 迁移关联项目的 tags（可选，把旧标签换掉）
    UPDATE public.projects
       SET tags = array_replace(tags, '生物观察', '动物观察')
     WHERE sub_category_id = v_bio_id AND '生物观察' = ANY(tags);

    -- 2) 新增 植物观察
    SELECT COALESCE(MAX(sort_order), 0) INTO v_max_sort
      FROM public.sub_categories
     WHERE category_id = v_science_id;

    INSERT INTO public.sub_categories (category_id, name, sort_order)
    VALUES (v_science_id, '植物观察', v_max_sort + 1)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- 3) 天文地理 → 地球与天空
    UPDATE public.sub_categories
       SET name = '地球与天空'
     WHERE category_id = v_science_id AND name = '天文地理';

    UPDATE public.projects
       SET tags = array_replace(tags, '天文地理', '地球与天空')
     WHERE category = '科学' AND '天文地理' = ANY(tags);
END $$;
