-- Badge gallery: nature difficulty ladders, insect diamond, STEAM+lesson overlay,
-- observation moderation alignment, and playground explorer 18-game platinum.

ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS observation_difficulty TEXT;

ALTER TABLE public.species
  DROP CONSTRAINT IF EXISTS species_observation_difficulty_check;

ALTER TABLE public.species
  ADD CONSTRAINT species_observation_difficulty_check
  CHECK (observation_difficulty IS NULL OR observation_difficulty IN ('common', 'uncommon', 'rare'));

COMMENT ON COLUMN public.species.observation_difficulty IS
  'Bird observation pile for badges: common / uncommon / rare. Insects and plants stay null.';

UPDATE public.species
   SET observation_difficulty = CASE slug
        WHEN 'pica-pica' THEN 'common'
        WHEN 'passer-montanus' THEN 'common'
        WHEN 'cyanopica-cyanus' THEN 'common'
        WHEN 'streptopelia-chinensis' THEN 'common'
        WHEN 'pycnonotus-sinensis' THEN 'common'
        WHEN 'hirundo-rustica' THEN 'common'
        WHEN 'anas-platyrhynchos' THEN 'common'
        WHEN 'nycticorax-nycticorax' THEN 'common'
        WHEN 'egretta-garzetta' THEN 'common'
        WHEN 'dendrocopos-major' THEN 'common'
        WHEN 'tachybaptus-ruficollis' THEN 'common'
        WHEN 'ardea-cinerea' THEN 'common'
        WHEN 'ardeola-bacchus' THEN 'common'
        WHEN 'gallinula-chloropus' THEN 'common'
        WHEN 'fulica-atra' THEN 'common'
        WHEN 'streptopelia-orientalis' THEN 'common'
        WHEN 'anas-poecilorhyncha' THEN 'common'
        WHEN 'aix-galericulata' THEN 'common'
        WHEN 'upupa-epops' THEN 'common'
        WHEN 'alcedo-atthis' THEN 'common'
        WHEN 'parus-major' THEN 'common'
        WHEN 'poecile-palustris' THEN 'common'
        WHEN 'aegithalos-caudatus' THEN 'common'
        WHEN 'turdus-merula' THEN 'common'
        WHEN 'phoenicurus-auroreus' THEN 'common'
        WHEN 'motacilla-alba' THEN 'common'
        WHEN 'chloris-sinica' THEN 'common'
        WHEN 'acridotheres-cristatellus' THEN 'common'
        WHEN 'sturnus-cineraceus' THEN 'common'
        WHEN 'corvus-macrorhynchos' THEN 'common'
        WHEN 'corvus-corone' THEN 'common'
        WHEN 'urocissa-erythrorhyncha' THEN 'common'
        WHEN 'cecropis-daurica' THEN 'common'
        WHEN 'cuculus-micropterus' THEN 'common'
        WHEN 'sinosuthora-webbiana' THEN 'common'
        WHEN 'garrulax-davidi' THEN 'common'
        WHEN 'rhopophilus-pekinensis' THEN 'common'
        WHEN 'eophona-migratoria' THEN 'common'
        WHEN 'pardaliparus-venustulus' THEN 'common'
        WHEN 'dendrocopos-canicapillus' THEN 'common'
        WHEN 'accipiter-nisus' THEN 'uncommon'
        WHEN 'acrocephalus-orientalis' THEN 'uncommon'
        WHEN 'alauda-arvensis' THEN 'uncommon'
        WHEN 'anser-anser' THEN 'uncommon'
        WHEN 'anthus-hodgsoni' THEN 'uncommon'
        WHEN 'anthus-spinoletta' THEN 'uncommon'
        WHEN 'apus-apus' THEN 'uncommon'
        WHEN 'ardea-alba' THEN 'uncommon'
        WHEN 'athene-noctua' THEN 'uncommon'
        WHEN 'aythya-ferina' THEN 'uncommon'
        WHEN 'aythya-fuligula' THEN 'uncommon'
        WHEN 'bombycilla-garrulus' THEN 'uncommon'
        WHEN 'bombycilla-japonica' THEN 'uncommon'
        WHEN 'bucephala-clangula' THEN 'uncommon'
        WHEN 'buteo-buteo' THEN 'uncommon'
        WHEN 'calliope-calliope' THEN 'uncommon'
        WHEN 'caprimulgus-indicus' THEN 'uncommon'
        WHEN 'certhiaiaris' THEN 'uncommon'
        WHEN 'charadrius-dubius' THEN 'uncommon'
        WHEN 'chlidonias-hybrida' THEN 'uncommon'
        WHEN 'chroicocephalus-ridibundus' THEN 'uncommon'
        WHEN 'cinclus-pallasii' THEN 'uncommon'
        WHEN 'corvus-dauuricus' THEN 'uncommon'
        WHEN 'coturnix-japonica' THEN 'uncommon'
        WHEN 'cuculus-canorus' THEN 'uncommon'
        WHEN 'dicrurus-macrocercus' THEN 'uncommon'
        WHEN 'emberiza-pusilla' THEN 'uncommon'
        WHEN 'falco-amurensis' THEN 'uncommon'
        WHEN 'falco-subbuteo' THEN 'uncommon'
        WHEN 'falco-tinnunculus' THEN 'uncommon'
        WHEN 'ficedula-albicilla' THEN 'uncommon'
        WHEN 'ficedula-zanthopygia' THEN 'uncommon'
        WHEN 'fringilla-montifringilla' THEN 'uncommon'
        WHEN 'gallinago-gallinago' THEN 'uncommon'
        WHEN 'halcyon-pileata' THEN 'uncommon'
        WHEN 'himantopus-himantopus' THEN 'uncommon'
        WHEN 'ixobrychus-sinensis' THEN 'uncommon'
        WHEN 'jynx-torquilla' THEN 'uncommon'
        WHEN 'lanius-cristatus' THEN 'uncommon'
        WHEN 'lanius-sphenocercus' THEN 'uncommon'
        WHEN 'larvivora-cyane' THEN 'uncommon'
        WHEN 'luscinia-svecica' THEN 'uncommon'
        WHEN 'mergellus-albellus' THEN 'uncommon'
        WHEN 'mergus-merganser' THEN 'uncommon'
        WHEN 'milvus-migrans' THEN 'uncommon'
        WHEN 'muscapa-sibirica' THEN 'uncommon'
        WHEN 'muscicapa-griseisticta' THEN 'uncommon'
        WHEN 'netta-rufina' THEN 'uncommon'
        WHEN 'oriolus-chinensis' THEN 'uncommon'
        WHEN 'phalacrocorax-carbo' THEN 'uncommon'
        WHEN 'phasianus-colchicus' THEN 'uncommon'
        WHEN 'phylloscopus-inornatus' THEN 'uncommon'
        WHEN 'picus-canus' THEN 'uncommon'
        WHEN 'podiceps-cristatus' THEN 'uncommon'
        WHEN 'regulus-regulus' THEN 'uncommon'
        WHEN 'rhyacornis-fuliginosus' THEN 'uncommon'
        WHEN 'saxicola-torquata' THEN 'uncommon'
        WHEN 'sitta-villosa' THEN 'uncommon'
        WHEN 'spinus-spinus' THEN 'uncommon'
        WHEN 'tadorna-ferruginea' THEN 'uncommon'
        WHEN 'tarsiger-cyanurus' THEN 'uncommon'
        WHEN 'terpsiphone-incei' THEN 'uncommon'
        WHEN 'troglodytes-troglodytes' THEN 'uncommon'
        WHEN 'turdus-eunomus' THEN 'uncommon'
        WHEN 'turdus-naumanni' THEN 'uncommon'
        WHEN 'turdus-ruficollis' THEN 'uncommon'
        WHEN 'vanellus-vanellus' THEN 'uncommon'
        WHEN 'zoothera-dauma' THEN 'uncommon'
        WHEN 'zosterops-erythropleurus' THEN 'uncommon'
        WHEN 'crossoptilon-mantchuricum' THEN 'rare'
        WHEN 'otis-tarda' THEN 'rare'
        WHEN 'aquila-chrysaetos' THEN 'rare'
        WHEN 'aegypius-monachus' THEN 'rare'
        WHEN 'haliaeetus-albicilla' THEN 'rare'
        WHEN 'ciconia-nigra' THEN 'rare'
        WHEN 'grus-grus' THEN 'rare'
        WHEN 'bubo-bubo' THEN 'rare'
        WHEN 'cygnus-cygnus' THEN 'rare'
        WHEN 'cygnus-columbianus' THEN 'rare'
        WHEN 'pandion-haliaetus' THEN 'rare'
        WHEN 'falco-peregrinus' THEN 'rare'
        WHEN 'pernis-ptilorhynchus' THEN 'rare'
        WHEN 'circus-cyaneus' THEN 'rare'
        WHEN 'strix-aluco' THEN 'rare'
        WHEN 'asio-flammeus' THEN 'rare'
        WHEN 'asio-otus' THEN 'rare'
        WHEN 'otus-sunia' THEN 'rare'
        WHEN 'ninox-japonica' THEN 'rare'
        WHEN 'anser-cygnoides' THEN 'rare'
        WHEN 'sibirionetta-formosa' THEN 'rare'
        WHEN 'megaceryle-lugubris' THEN 'rare'
        WHEN 'melanocorypha-mongolica' THEN 'rare'
        WHEN 'botaurus-stellaris' THEN 'rare'
        WHEN 'mallard' THEN 'common'
        WHEN 'black-crowned-night-heron' THEN 'common'
        WHEN 'little-egret' THEN 'common'
        WHEN 'little-grebe' THEN 'common'
        WHEN 'grey-heron' THEN 'common'
        WHEN 'great-egret' THEN 'uncommon'
        WHEN 'great-cormorant' THEN 'uncommon'
        ELSE observation_difficulty
   END
 WHERE nature_topic = 'birds';

INSERT INTO public.badges (id, name, description, icon, condition) VALUES
('bird_common_bronze', '常见新识', '点亮 3 种常见鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_common","tier":"bronze"}'::jsonb),
('bird_common_silver', '常见常客', '点亮 8 种常见鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_common","tier":"silver"}'::jsonb),
('bird_common_gold', '常见能手', '点亮 15 种常见鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_common","tier":"gold"}'::jsonb),
('bird_common_platinum', '常见达人', '点亮 25 种常见鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_common","tier":"platinum"}'::jsonb),
('bird_uncommon_bronze', '进阶新识', '点亮 2 种进阶鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_uncommon","tier":"bronze"}'::jsonb),
('bird_uncommon_silver', '进阶常客', '点亮 5 种进阶鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_uncommon","tier":"silver"}'::jsonb),
('bird_uncommon_gold', '进阶能手', '点亮 12 种进阶鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_uncommon","tier":"gold"}'::jsonb),
('bird_uncommon_platinum', '进阶达人', '点亮 20 种进阶鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_uncommon","tier":"platinum"}'::jsonb),
('bird_rare_bronze', '稀有初见', '点亮 1 种稀有鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_rare","tier":"bronze"}'::jsonb),
('bird_rare_silver', '稀有复见', '点亮 2 种稀有鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_rare","tier":"silver"}'::jsonb),
('bird_rare_gold', '稀有能手', '点亮 4 种稀有鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_rare","tier":"gold"}'::jsonb),
('bird_rare_platinum', '稀有达人', '点亮 8 种稀有鸟', 'bird', '{"kind":"tiered","seriesKey":"bird_rare","tier":"platinum"}'::jsonb),
('insect_rank_bronze', 'D 级', '完成手册 D 级任意一套九宫格', 'butterfly', '{"kind":"tiered","seriesKey":"insect_rank","tier":"bronze"}'::jsonb),
('insect_rank_silver', 'C 级', '完成手册 C 级任意一套九宫格', 'butterfly', '{"kind":"tiered","seriesKey":"insect_rank","tier":"silver"}'::jsonb),
('insect_rank_gold', 'B 级', '完成手册 B 级任意一套九宫格', 'butterfly', '{"kind":"tiered","seriesKey":"insect_rank","tier":"gold"}'::jsonb),
('insect_rank_platinum', 'A 级', '完成手册 A 级任意一套九宫格', 'butterfly', '{"kind":"tiered","seriesKey":"insect_rank","tier":"platinum"}'::jsonb),
('insect_rank_diamond', 'S 级', '完成手册 S 级任一项挑战', 'butterfly', '{"kind":"tiered","seriesKey":"insect_rank","tier":"diamond"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  condition = EXCLUDED.condition;

UPDATE public.badges SET description = '完成 3 个科学项目或观察' WHERE id = 'science_expert_bronze';
UPDATE public.badges SET description = '完成 10 个科学项目或观察' WHERE id = 'science_expert_silver';
UPDATE public.badges SET description = '完成 20 个科学项目或观察' WHERE id = 'science_expert_gold';
UPDATE public.badges SET description = '完成 50 个科学项目或观察' WHERE id = 'science_expert_platinum';
UPDATE public.badges SET description = '完成 3 个技术项目或课时' WHERE id = 'tech_expert_bronze';
UPDATE public.badges SET description = '完成 10 个技术项目或课时' WHERE id = 'tech_expert_silver';
UPDATE public.badges SET description = '完成 20 个技术项目或课时' WHERE id = 'tech_expert_gold';
UPDATE public.badges SET description = '完成 50 个技术项目或课时' WHERE id = 'tech_expert_platinum';
UPDATE public.badges SET description = '完成 3 个工程项目或课时' WHERE id = 'engineering_expert_bronze';
UPDATE public.badges SET description = '完成 10 个工程项目或课时' WHERE id = 'engineering_expert_silver';
UPDATE public.badges SET description = '完成 20 个工程项目或课时' WHERE id = 'engineering_expert_gold';
UPDATE public.badges SET description = '完成 50 个工程项目或课时' WHERE id = 'engineering_expert_platinum';
UPDATE public.badges SET description = '完成 3 个艺术项目或课时作品' WHERE id = 'art_expert_bronze';
UPDATE public.badges SET description = '完成 10 个艺术项目或课时作品' WHERE id = 'art_expert_silver';
UPDATE public.badges SET description = '完成 20 个艺术项目或课时作品' WHERE id = 'art_expert_gold';
UPDATE public.badges SET description = '完成 50 个艺术项目或课时作品' WHERE id = 'art_expert_platinum';
UPDATE public.badges SET description = '完成 3 个数学项目或课时' WHERE id = 'math_expert_bronze';
UPDATE public.badges SET description = '完成 10 个数学项目或课时' WHERE id = 'math_expert_silver';
UPDATE public.badges SET description = '完成 20 个数学项目或课时' WHERE id = 'math_expert_gold';
UPDATE public.badges SET description = '完成 50 个数学项目或课时' WHERE id = 'math_expert_platinum';
UPDATE public.badges SET description = '完成 5 个项目或课时' WHERE id = 'milestone_bronze';
UPDATE public.badges SET description = '完成 20 个项目或课时' WHERE id = 'milestone_silver';
UPDATE public.badges SET description = '完成 50 个项目或课时' WHERE id = 'milestone_gold';
UPDATE public.badges SET description = '完成 100 个项目或课时' WHERE id = 'milestone_platinum';
UPDATE public.badges SET description = '完成 1 个项目或课时' WHERE id = 'explorer';
UPDATE public.badges SET description = '审核通过的观察记录达到 1 条' WHERE id = 'bird_observer_bronze';
UPDATE public.badges SET description = '审核通过的观察记录达到 10 条' WHERE id = 'bird_observer_silver';
UPDATE public.badges SET description = '审核通过的观察记录达到 30 条' WHERE id = 'bird_observer_gold';
UPDATE public.badges SET description = '审核通过的观察记录达到 100 条' WHERE id = 'bird_observer_platinum';
UPDATE public.badges SET description = '图鉴点亮 3 种不同物种' WHERE id = 'species_collector_bronze';
UPDATE public.badges SET description = '图鉴点亮 10 种不同物种' WHERE id = 'species_collector_silver';
UPDATE public.badges SET description = '图鉴点亮 30 种不同物种' WHERE id = 'species_collector_gold';
UPDATE public.badges SET description = '图鉴点亮 80 种不同物种' WHERE id = 'species_collector_platinum';
UPDATE public.badges SET description = '玩过 3 个不同游乐场游戏' WHERE id = 'playground_explorer_bronze';
UPDATE public.badges SET description = '玩过 8 个不同游乐场游戏' WHERE id = 'playground_explorer_silver';
UPDATE public.badges SET description = '玩过 13 个不同游乐场游戏' WHERE id = 'playground_explorer_gold';
UPDATE public.badges SET description = '玩过 18 个不同游乐场游戏' WHERE id = 'playground_explorer_platinum';

CREATE OR REPLACE FUNCTION public.get_user_stats_summary(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    result JSONB;
    v_published_count INT;
    v_comments_count INT;
    v_likes_given_count INT;
    v_challenges_count INT;
    v_discussions_count INT;
    v_replies_count INT;
    v_completed_count INT;
    v_likes_received_count INT;
    v_collections_count INT;
    v_science_completed INT;
    v_tech_completed INT;
    v_engineering_completed INT;
    v_art_completed INT;
    v_math_completed INT;
    v_login_days INT;
    v_consecutive_days INT;
    v_observations_submitted INT;
    v_species_observed INT;
    v_observation_streak INT;
    v_growth_tasks_graduated BOOLEAN;
    v_lessons_started INT;
    v_lessons_completed INT;
    v_works_published INT;
    v_scratch_lessons INT;
    v_building_lessons INT;
    v_playground_lessons INT;
    v_course_works INT;
    v_common_birds INT;
    v_uncommon_birds INT;
    v_rare_birds INT;
    v_mythic_insects INT;
    v_insect_slugs JSONB;
BEGIN
    SELECT count(*) INTO v_published_count FROM public.projects WHERE author_id = target_user_id;
    SELECT count(*) INTO v_comments_count FROM public.comments WHERE author_id = target_user_id;
    SELECT count(*) INTO v_likes_given_count FROM public.likes WHERE user_id = target_user_id;
    SELECT count(*) INTO v_challenges_count FROM public.challenge_participants WHERE user_id = target_user_id;
    SELECT count(*) INTO v_discussions_count FROM public.discussions WHERE author_id = target_user_id;
    SELECT count(*) INTO v_replies_count FROM public.discussion_replies WHERE author_id = target_user_id;

    SELECT
        count(DISTINCT cp.project_id),
        count(DISTINCT cp.project_id) FILTER (WHERE p.category = '科学'),
        count(DISTINCT cp.project_id) FILTER (WHERE p.category = '技术'),
        count(DISTINCT cp.project_id) FILTER (WHERE p.category = '工程'),
        count(DISTINCT cp.project_id) FILTER (WHERE p.category = '艺术'),
        count(DISTINCT cp.project_id) FILTER (WHERE p.category = '数学')
    INTO
        v_completed_count,
        v_science_completed,
        v_tech_completed,
        v_engineering_completed,
        v_art_completed,
        v_math_completed
    FROM public.completed_projects cp
    JOIN public.projects p ON cp.project_id = p.id
    WHERE cp.user_id = target_user_id
      AND cp.status = 'approved'
      AND COALESCE(cp.record_kind, 'final') = 'final';

    SELECT count(*) INTO v_works_published
    FROM public.completed_projects cp
    WHERE cp.user_id = target_user_id
      AND cp.status = 'approved'
      AND COALESCE(cp.record_kind, 'final') = 'final';

    SELECT
        count(*),
        count(*) FILTER (WHERE ulp.completed_at IS NOT NULL)
    INTO v_lessons_started, v_lessons_completed
    FROM public.user_lesson_progress ulp
    WHERE ulp.user_id = target_user_id;

    SELECT
        count(*) FILTER (WHERE cl.lesson_type = 'scratch'),
        count(*) FILTER (WHERE cl.lesson_type = 'building_3d'),
        count(*) FILTER (WHERE cl.lesson_type = 'playground')
    INTO v_scratch_lessons, v_building_lessons, v_playground_lessons
    FROM public.user_lesson_progress ulp
    JOIN public.course_lessons cl ON cl.id = ulp.lesson_id
    WHERE ulp.user_id = target_user_id
      AND ulp.completed_at IS NOT NULL;

    SELECT count(*) INTO v_course_works
    FROM public.completed_projects cp
    WHERE cp.user_id = target_user_id
      AND cp.course_lesson_id IS NOT NULL
      AND cp.status = 'approved'
      AND cp.moderation_state = 'approved'
      AND COALESCE(cp.record_kind, 'final') = 'final';

    SELECT COALESCE(SUM(likes_count), 0) INTO v_likes_received_count
    FROM public.projects
    WHERE author_id = target_user_id;

    SELECT count(*) INTO v_collections_count FROM public.collections WHERE user_id = target_user_id;

    BEGIN
        SELECT login_days, consecutive_days INTO v_login_days, v_consecutive_days
        FROM public.get_user_login_stats(target_user_id) LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_login_days := 0;
        v_consecutive_days := 0;
    END;

    v_login_days := COALESCE(v_login_days, 0);
    v_consecutive_days := COALESCE(v_consecutive_days, 0);

    SELECT count(*) INTO v_observations_submitted
    FROM public.observation_events
    WHERE user_id = target_user_id
      AND status = 'approved'
      AND moderation_state = 'approved';

    WITH observed_species AS (
      SELECT oes.species_id
      FROM public.observation_event_species oes
      JOIN public.observation_events oe ON oe.id = oes.observation_event_id
      WHERE oe.user_id = target_user_id
        AND oe.status = 'approved'
        AND oe.moderation_state = 'approved'

      UNION

      SELECT oi.species_id
      FROM public.observation_identifications oi
      JOIN public.observation_events oe ON oe.id = oi.observation_event_id
      WHERE oe.user_id = target_user_id
        AND oe.status = 'approved'
        AND oe.moderation_state = 'approved'
        AND oi.is_active = TRUE
        AND oi.source = 'ai'
        AND oi.confidence >= 0.8
        AND NOT EXISTS (
          SELECT 1
          FROM public.observation_event_species oes2
          WHERE oes2.observation_event_id = oe.id
        )
    )
    SELECT
        count(DISTINCT os.species_id),
        count(DISTINCT os.species_id) FILTER (WHERE s.nature_topic = 'birds' AND s.observation_difficulty = 'common'),
        count(DISTINCT os.species_id) FILTER (WHERE s.nature_topic = 'birds' AND s.observation_difficulty = 'uncommon'),
        count(DISTINCT os.species_id) FILTER (WHERE s.nature_topic = 'birds' AND s.observation_difficulty = 'rare'),
        count(DISTINCT os.species_id) FILTER (
          WHERE s.slug IN (
            'asiagomphus-hesperius',
            'tenomerga-anguliscutis',
            'platyrhopalus-paussoides',
            'falcicornis-tenuecostatus',
            'cucujus-haematodes',
            'bittacus-planus',
            'osmoderma-barnabita'
          )
        ),
        COALESCE(
          jsonb_agg(DISTINCT s.slug) FILTER (WHERE s.nature_topic = 'insects' AND s.slug IS NOT NULL),
          '[]'::jsonb
        )
    INTO
        v_species_observed,
        v_common_birds,
        v_uncommon_birds,
        v_rare_birds,
        v_mythic_insects,
        v_insect_slugs
    FROM observed_species os
    JOIN public.species s ON s.id = os.species_id;

    WITH daily AS (
        SELECT DISTINCT (observed_at AT TIME ZONE 'Asia/Shanghai')::date AS obs_date
        FROM public.observation_events
        WHERE user_id = target_user_id
          AND status = 'approved'
          AND moderation_state = 'approved'
    ),
    numbered AS (
        SELECT obs_date, obs_date - (ROW_NUMBER() OVER (ORDER BY obs_date))::int AS grp
        FROM daily
    ),
    streaks AS (
        SELECT grp, count(*) AS streak_len, max(obs_date) AS streak_end
        FROM numbered
        GROUP BY grp
    )
    SELECT COALESCE(
        (SELECT streak_len FROM streaks WHERE streak_end >= (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date - 1 ORDER BY streak_len DESC LIMIT 1),
        0
    ) INTO v_observation_streak;

    SELECT EXISTS (
        SELECT 1
        FROM public.xp_logs
        WHERE user_id = target_user_id
          AND action_type = 'profile_growth_task_graduation'
          AND resource_id = 'v1'
    ) INTO v_growth_tasks_graduated;

    v_science_completed := COALESCE(v_science_completed, 0) + COALESCE(v_observations_submitted, 0);
    v_tech_completed := COALESCE(v_tech_completed, 0) + COALESCE(v_scratch_lessons, 0);
    v_engineering_completed := COALESCE(v_engineering_completed, 0) + COALESCE(v_building_lessons, 0);
    v_art_completed := COALESCE(v_art_completed, 0) + COALESCE(v_course_works, 0);
    v_math_completed := COALESCE(v_math_completed, 0) + COALESCE(v_playground_lessons, 0);
    v_completed_count := COALESCE(v_completed_count, 0) + COALESCE(v_lessons_completed, 0);

    result := jsonb_build_object(
        'projectsPublished', v_published_count,
        'projectsLiked', v_likes_given_count,
        'projectsCompleted', v_completed_count,
        'commentsCount', v_comments_count,
        'scienceCompleted', v_science_completed,
        'techCompleted', v_tech_completed,
        'engineeringCompleted', v_engineering_completed,
        'artCompleted', v_art_completed,
        'mathCompleted', v_math_completed,
        'likesGiven', v_likes_given_count,
        'likesReceived', v_likes_received_count,
        'collectionsCount', v_collections_count,
        'challengesJoined', v_challenges_count,
        'discussionsCreated', v_discussions_count,
        'repliesCount', v_replies_count,
        'loginDays', v_login_days,
        'consecutiveDays', v_consecutive_days,
        'observationsSubmitted', COALESCE(v_observations_submitted, 0),
        'speciesObserved', COALESCE(v_species_observed, 0),
        'observationStreak', COALESCE(v_observation_streak, 0),
        'growthTasksGraduated', COALESCE(v_growth_tasks_graduated, false),
        'lessonsStarted', COALESCE(v_lessons_started, 0),
        'lessonsCompleted', COALESCE(v_lessons_completed, 0),
        'worksPublished', COALESCE(v_works_published, 0),
        'commonBirdsObserved', COALESCE(v_common_birds, 0),
        'uncommonBirdsObserved', COALESCE(v_uncommon_birds, 0),
        'rareBirdsObserved', COALESCE(v_rare_birds, 0),
        'mythicInsectsObserved', COALESCE(v_mythic_insects, 0),
        'observedInsectSlugs', COALESCE(v_insect_slugs, '[]'::jsonb)
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_stats_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats_summary(UUID) TO service_role;

COMMENT ON FUNCTION public.get_user_stats_summary(UUID)
  IS 'User badge/stats summary. STEAM and milestone overlay approved lessons/observations on project counts. Observation counters require status and moderation_state both approved.';
