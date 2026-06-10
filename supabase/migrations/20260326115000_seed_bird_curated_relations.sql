-- ============================================
-- 鸟类策展式关联种子
-- 让项目页 / 挑战页 / 物种页在没有 observation 反推时也能稳定联动
-- ============================================

DO $$
DECLARE
    v_challenge_id BIGINT;
    v_waterbird_project_id BIGINT;
    v_community_project_id BIGINT;
    v_behavior_project_id BIGINT;
    v_xiaopiti BIGINT;
    v_cormorant BIGINT;
    v_gray_heron BIGINT;
    v_great_egret BIGINT;
    v_little_egret BIGINT;
    v_night_heron BIGINT;
    v_mallard BIGINT;
BEGIN
    SELECT id INTO v_challenge_id
      FROM public.challenges
     WHERE title = '北京春季常见鸟类观察'
     LIMIT 1;

    SELECT id INTO v_waterbird_project_id
      FROM public.projects
     WHERE title = '北京公园常见水鸟观察'
     LIMIT 1;

    SELECT id INTO v_community_project_id
      FROM public.projects
     WHERE title = '校园与社区常见鸟类晨间观察'
     LIMIT 1;

    SELECT id INTO v_behavior_project_id
      FROM public.projects
     WHERE title = '定点行为观察：水鸟在做什么'
     LIMIT 1;

    SELECT id INTO v_xiaopiti FROM public.species WHERE slug = 'little-grebe' LIMIT 1;
    SELECT id INTO v_cormorant FROM public.species WHERE slug = 'great-cormorant' LIMIT 1;
    SELECT id INTO v_gray_heron FROM public.species WHERE slug = 'grey-heron' LIMIT 1;
    SELECT id INTO v_great_egret FROM public.species WHERE slug = 'great-egret' LIMIT 1;
    SELECT id INTO v_little_egret FROM public.species WHERE slug = 'little-egret' LIMIT 1;
    SELECT id INTO v_night_heron FROM public.species WHERE slug = 'black-crowned-night-heron' LIMIT 1;
    SELECT id INTO v_mallard FROM public.species WHERE slug = 'mallard' LIMIT 1;

    IF v_challenge_id IS NULL
       OR v_waterbird_project_id IS NULL
       OR v_community_project_id IS NULL
       OR v_behavior_project_id IS NULL
       OR v_xiaopiti IS NULL
       OR v_cormorant IS NULL
       OR v_gray_heron IS NULL
       OR v_great_egret IS NULL
       OR v_little_egret IS NULL
       OR v_night_heron IS NULL
       OR v_mallard IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.project_species (project_id, species_id, sort_order, relation_role) VALUES
        (v_waterbird_project_id, v_xiaopiti, 1, 'starter'),
        (v_waterbird_project_id, v_little_egret, 2, 'starter'),
        (v_waterbird_project_id, v_gray_heron, 3, 'starter'),
        (v_waterbird_project_id, v_cormorant, 4, 'starter'),
        (v_waterbird_project_id, v_mallard, 5, 'starter')
    ON CONFLICT (project_id, species_id) DO NOTHING;

    INSERT INTO public.project_species (project_id, species_id, sort_order, relation_role) VALUES
        (v_community_project_id, v_mallard, 1, 'starter'),
        (v_community_project_id, v_night_heron, 2, 'featured'),
        (v_community_project_id, v_little_egret, 3, 'featured')
    ON CONFLICT (project_id, species_id) DO NOTHING;

    INSERT INTO public.project_species (project_id, species_id, sort_order, relation_role) VALUES
        (v_behavior_project_id, v_mallard, 1, 'target'),
        (v_behavior_project_id, v_xiaopiti, 2, 'featured'),
        (v_behavior_project_id, v_cormorant, 3, 'featured'),
        (v_behavior_project_id, v_gray_heron, 4, 'featured'),
        (v_behavior_project_id, v_great_egret, 5, 'featured')
    ON CONFLICT (project_id, species_id) DO NOTHING;

    INSERT INTO public.challenge_species (challenge_id, species_id, sort_order, relation_role) VALUES
        (v_challenge_id, v_xiaopiti, 1, 'featured'),
        (v_challenge_id, v_cormorant, 2, 'featured'),
        (v_challenge_id, v_gray_heron, 3, 'featured'),
        (v_challenge_id, v_great_egret, 4, 'featured'),
        (v_challenge_id, v_little_egret, 5, 'featured'),
        (v_challenge_id, v_night_heron, 6, 'featured'),
        (v_challenge_id, v_mallard, 7, 'featured')
    ON CONFLICT (challenge_id, species_id) DO NOTHING;
END $$;
