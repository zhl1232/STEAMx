-- Approved observations count toward Science (S) only. No sixth radar axis.

CREATE OR REPLACE FUNCTION public.calculate_steam_radar(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_rec record;
  v_n_easy int := 0;
  v_n_medium int := 0;
  v_n_hard int := 0;
  v_n int;
  v_mult numeric;
  v_decay numeric;
  v_weights jsonb;
  v_dim text;
  v_raw numeric;
  v_display numeric;
  v_tier text;
  v_raws jsonb := '{"S":0,"T":0,"E":0,"A":0,"M":0}'::jsonb;
  v_result jsonb := '{}'::jsonb;
  v_k numeric := 200.0;
  v_stars int;
BEGIN
  FOR v_rec IN
    WITH activity AS (
      SELECT
        cp.completed_at,
        'project'::text AS source_type,
        p.id AS source_id,
        COALESCE(
          p.steam_weights,
          (
            SELECT weights
            FROM public.steam_weight_defaults
            WHERE key = COALESCE(
              (SELECT name FROM public.sub_categories WHERE id = p.sub_category_id),
              p.category
            )
            LIMIT 1
          ),
          (
            SELECT weights
            FROM public.steam_weight_defaults
            WHERE key = COALESCE(p.category, '其他')
              AND level = 'category'
            LIMIT 1
          ),
          '{"S":5,"T":5,"E":5,"A":5,"M":5}'::jsonb
        ) AS weights,
        COALESCE(p.difficulty_stars, 3) AS stars
      FROM public.completed_projects cp
      JOIN public.projects p ON p.id = cp.project_id
      WHERE cp.user_id = target_user_id
        AND cp.status = 'approved'
        AND cp.record_kind = 'final'
        AND cp.project_id IS NOT NULL

      UNION ALL

      SELECT
        cc.completed_at,
        'challenge'::text AS source_type,
        c.id AS source_id,
        COALESCE(c.steam_weights, '{"S":5,"T":5,"E":5,"A":5,"M":5}'::jsonb) AS weights,
        COALESCE(c.difficulty_stars, 3) AS stars
      FROM public.challenge_completions cc
      JOIN public.challenges c ON c.id = cc.challenge_id
      WHERE cc.user_id = target_user_id

      UNION ALL

      SELECT
        completion.completed_at,
        'course'::text AS source_type,
        completion.course_id AS source_id,
        completion.steam_weights_snapshot AS weights,
        completion.difficulty_stars_snapshot AS stars
      FROM public.user_course_completions completion
      WHERE completion.user_id = target_user_id

      UNION ALL

      SELECT
        oe.observed_at AS completed_at,
        'observation'::text AS source_type,
        oe.id AS source_id,
        '{"S":15,"T":0,"E":0,"A":0,"M":0}'::jsonb AS weights,
        3 AS stars
      FROM public.observation_events oe
      WHERE oe.user_id = target_user_id
        AND oe.status = 'approved'
        AND oe.moderation_state = 'approved'
    )
    SELECT *
    FROM activity
    ORDER BY completed_at ASC NULLS LAST, source_type ASC, source_id ASC
  LOOP
    v_stars := v_rec.stars;
    v_weights := v_rec.weights;

    IF v_stars <= 2 THEN
      v_mult := 0.5;
      v_n_easy := v_n_easy + 1;
      v_n := v_n_easy;
    ELSIF v_stars <= 4 THEN
      v_mult := 1.0;
      v_n_medium := v_n_medium + 1;
      v_n := v_n_medium;
    ELSE
      v_mult := 2.0;
      v_n_hard := v_n_hard + 1;
      v_n := v_n_hard;
    END IF;

    v_decay := 1.0 / sqrt(v_n::numeric);

    FOREACH v_dim IN ARRAY ARRAY['S', 'T', 'E', 'A', 'M']
    LOOP
      v_raw := COALESCE((v_weights ->> v_dim)::numeric, 0) * v_mult * v_decay;
      v_raws := jsonb_set(
        v_raws,
        ARRAY[v_dim],
        to_jsonb(COALESCE((v_raws ->> v_dim)::numeric, 0) + v_raw)
      );
    END LOOP;
  END LOOP;

  FOREACH v_dim IN ARRAY ARRAY['S', 'T', 'E', 'A', 'M']
  LOOP
    v_raw := COALESCE((v_raws ->> v_dim)::numeric, 0);
    v_display := round(100.0 * (1.0 - exp(-v_raw / v_k)), 1);

    IF v_display < 1 THEN
      v_tier := 'none';
    ELSIF v_display < 40 THEN
      v_tier := 'foundation';
    ELSIF v_display < 75 THEN
      v_tier := 'intermediate';
    ELSE
      v_tier := 'advanced';
    END IF;

    v_result := jsonb_set(v_result, ARRAY[v_dim], jsonb_build_object(
      'raw', round(v_raw, 1),
      'display', v_display,
      'tier', v_tier
    ));
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_steam_radar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_steam_radar(uuid) TO service_role;

COMMENT ON FUNCTION public.calculate_steam_radar(uuid)
  IS 'STEAM radar from approved project finals, challenge completions, course completions, and observations with status and moderation_state both approved (S only).';
