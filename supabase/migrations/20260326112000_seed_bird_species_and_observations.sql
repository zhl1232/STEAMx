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

    INSERT INTO public.observation_events (
        user_id,
        project_id,
        challenge_id,
        observed_at,
        location_name,
        latitude,
        longitude,
        location_precision,
        habitat,
        weather,
        notes,
        media_urls,
        is_public,
        status
    ) VALUES (
        v_author_id,
        v_waterbird_project_id,
        v_challenge_id,
        now() - interval '2 days',
        '奥林匹克森林公园南园湿地',
        40.009500,
        116.396200,
        'approximate',
        '城市湿地',
        '晴',
        '湖面边缘活动较多，晨间人流较少，适合初学者连续观察。',
        ARRAY['/projects/science_animals.webp'],
        TRUE,
        'approved'
    ) RETURNING id INTO v_event_id;

    INSERT INTO public.observation_event_species (observation_event_id, species_id, count, behavior_tags, confidence, notes) VALUES
        (v_event_id, v_xiaopiti, 3, ARRAY['潜水', '觅食'], 0.95, '连续观察到短时潜水后浮出水面。'),
        (v_event_id, v_mallard, 6, ARRAY['觅食', '梳羽'], 0.98, '近岸区域个体较多，行为容易记录。'),
        (v_event_id, v_little_egret, 1, ARRAY['涉水', '觅食'], 0.90, '浅水区域缓慢移动觅食。');

    INSERT INTO public.observation_events (
        user_id,
        project_id,
        challenge_id,
        observed_at,
        location_name,
        latitude,
        longitude,
        location_precision,
        habitat,
        weather,
        notes,
        media_urls,
        is_public,
        status
    ) VALUES (
        v_author_id,
        v_community_project_id,
        v_challenge_id,
        now() - interval '1 day',
        '校园树林与操场边绿地',
        NULL,
        NULL,
        'hidden',
        '校园绿地',
        '多云',
        '以晨间听声辨位为主，先记录出现位置，再补充外形特征。',
        ARRAY[]::text[],
        TRUE,
        'approved'
    ) RETURNING id INTO v_event_id;

    INSERT INTO public.observation_event_species (observation_event_id, species_id, count, behavior_tags, confidence, notes) VALUES
        (v_event_id, v_black_crowned_night_heron, 1, ARRAY['停栖'], 0.62, '仅远距离看到停栖个体，留作待确认记录。'),
        (v_event_id, v_mallard, 2, ARRAY['飞过'], 0.70, '从操场上空快速飞过。');

    INSERT INTO public.observation_events (
        user_id,
        project_id,
        challenge_id,
        observed_at,
        location_name,
        latitude,
        longitude,
        location_precision,
        habitat,
        weather,
        notes,
        media_urls,
        is_public,
        status
    ) VALUES (
        v_author_id,
        v_behavior_project_id,
        v_challenge_id,
        now() - interval '6 hours',
        '北海公园湖区',
        39.931200,
        116.389900,
        'approximate',
        '城市公园湖区',
        '晴',
        '定点停留约 50 分钟，优先记录行为而不是拍照。',
        ARRAY['/projects/science_animals.webp'],
        TRUE,
        'approved'
    ) RETURNING id INTO v_event_id;

    INSERT INTO public.observation_event_species (observation_event_id, species_id, count, behavior_tags, confidence, notes) VALUES
        (v_event_id, v_mallard, 4, ARRAY['求偶', '梳羽', '觅食'], 0.97, '雄鸟间有明显展示动作。'),
        (v_event_id, v_cormorant, 2, ARRAY['潜水', '晾翅'], 0.93, '潜水后在岸边停留张翅晾晒。'),
        (v_event_id, v_gray_heron, 1, ARRAY['静立', '觅食'], 0.96, '长时间静立后突然发动捕食。');
END $$;
