-- ============================================
-- 鸟类物种与观察记录种子
-- 用于验证 species / observations 闭环
-- ============================================

DO $$
DECLARE
    v_author_id UUID;
    v_challenge_id BIGINT;
    v_waterbird_project_id BIGINT;
    v_community_project_id BIGINT;
    v_behavior_project_id BIGINT;
    v_species_id BIGINT;
    v_event_id BIGINT;
    v_xiaopiti BIGINT;
    v_cormorant BIGINT;
    v_gray_heron BIGINT;
    v_great_egret BIGINT;
    v_little_egret BIGINT;
    v_black_crowned_night_heron BIGINT;
    v_mallard BIGINT;
BEGIN
    SELECT id INTO v_author_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
    IF v_author_id IS NULL THEN
        SELECT id INTO v_author_id FROM public.profiles LIMIT 1;
    END IF;

    IF v_author_id IS NULL THEN
        RAISE EXCEPTION 'No users found in profiles table';
    END IF;

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

    IF v_challenge_id IS NULL OR v_waterbird_project_id IS NULL OR v_community_project_id IS NULL OR v_behavior_project_id IS NULL THEN
        RAISE EXCEPTION '鸟类试点基础数据不存在，请先执行 challenge/project seed migration';
    END IF;

    INSERT INTO public.species (
        slug,
        common_name,
        scientific_name,
        aliases,
        taxon_group,
        identification_notes,
        habitat_notes,
        seasonality_notes,
        cover_image_url,
        is_active
    ) VALUES (
        'little-grebe',
        '小䴙䴘',
        'Tachybaptus ruficollis',
        ARRAY['水葫芦', '王八鸭子'],
        '游禽',
        '体型小、嘴尖，擅长潜水，繁殖期头颈棕红色更明显。',
        '几乎在有水面的环境都可能出现。',
        '北京全年可见，春季适合观察筑巢与育雏活动。',
        '/projects/science_animals.webp',
        TRUE
    ) RETURNING id INTO v_xiaopiti;

    INSERT INTO public.species (
        slug,
        common_name,
        scientific_name,
        aliases,
        taxon_group,
        identification_notes,
        habitat_notes,
        seasonality_notes,
        cover_image_url,
        is_active
    ) VALUES (
        'great-cormorant',
        '普通鸬鹚',
        'Phalacrocorax carbo',
        ARRAY['鱼鹰'],
        '游禽',
        '通体偏黑，常集群潜水捕鱼，也常张翅晾晒。',
        '近郊和远郊水库湿地较常见，城市上空春秋迁飞也可见。',
        '北京春秋迁经更常见。',
        '/projects/science_animals.webp',
        TRUE
    ) RETURNING id INTO v_cormorant;

    INSERT INTO public.species (
        slug,
        common_name,
        scientific_name,
        aliases,
        taxon_group,
        identification_notes,
        habitat_notes,
        seasonality_notes,
        cover_image_url,
        is_active
    ) VALUES (
        'grey-heron',
        '苍鹭',
        'Ardea cinerea',
        ARRAY['长脖老等', '灰鹤'],
        '涉禽',
        '大型鹭类，体色偏灰，常在水边静立等待猎物。',
        '近郊和远郊湿地较常见，部分不冻水域冬季也可见。',
        '北京 3 月至 11 月较易见。',
        '/projects/science_animals.webp',
        TRUE
    ) RETURNING id INTO v_gray_heron;

    INSERT INTO public.species (
        slug,
        common_name,
        scientific_name,
        aliases,
        taxon_group,
        identification_notes,
        habitat_notes,
        seasonality_notes,
        cover_image_url,
        is_active
    ) VALUES (
        'great-egret',
        '大白鹭',
        'Ardea alba',
        ARRAY[]::text[],
        '涉禽',
        '大型白色鹭类，站立时颈部细长明显。',
        '公园湿地与景观水域可见。',
        '主要为夏候鸟和旅鸟，少量个体越冬。',
        '/projects/science_animals.webp',
        TRUE
    ) RETURNING id INTO v_great_egret;

    INSERT INTO public.species (
        slug,
        common_name,
        scientific_name,
        aliases,
        taxon_group,
        identification_notes,
        habitat_notes,
        seasonality_notes,
        cover_image_url,
        is_active
    ) VALUES (
        'little-egret',
        '白鹭',
        'Egretta garzetta',
        ARRAY['小白鹭'],
        '涉禽',
        '通体白色，黑色腿、黄色脚趾是容易识别的特征。',
        '浅水湿地、公园湖区、水库边缘。',
        '春夏秋较常见。',
        '/projects/science_animals.webp',
        TRUE
    ) RETURNING id INTO v_little_egret;

    INSERT INTO public.species (
        slug,
        common_name,
        scientific_name,
        aliases,
        taxon_group,
        identification_notes,
        habitat_notes,
        seasonality_notes,
        cover_image_url,
        is_active
    ) VALUES (
        'black-crowned-night-heron',
        '夜鹭',
        'Nycticorax nycticorax',
        ARRAY['夜洼子', '星洼子'],
        '涉禽',
        '成鸟头顶与背部偏蓝灰色，傍晚活动更明显。',
        '城市水域、护城河和公园湖区。',
        '北京 3 月至 10 月较易见，黄昏观察更合适。',
        '/projects/science_animals.webp',
        TRUE
    ) RETURNING id INTO v_black_crowned_night_heron;

    INSERT INTO public.species (
        slug,
        common_name,
        scientific_name,
        aliases,
        taxon_group,
        identification_notes,
        habitat_notes,
        seasonality_notes,
        cover_image_url,
        is_active
    ) VALUES (
        'mallard',
        '绿头鸭',
        'Anas platyrhynchos',
        ARRAY[]::text[],
        '游禽',
        '雄鸟头部绿色有金属光泽，雌鸟体色偏褐。',
        '城市公园湖面和开阔水域都较常见。',
        '北京冬春常见，适合做求偶和觅食行为观察。',
        '/projects/science_animals.webp',
        TRUE
    ) RETURNING id INTO v_mallard;

END $$;
