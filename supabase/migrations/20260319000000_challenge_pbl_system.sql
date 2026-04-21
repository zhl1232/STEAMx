-- =============================================================================
-- PBL Challenge System: dual-track (timed + evergreen) with unified STEAM radar
-- =============================================================================

-- 1. challenges table: add PBL fields, type, status, difficulty, completions
-- -----------------------------------------------------------------------------
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS challenge_type varchar(20) DEFAULT 'timed'
    CHECK (challenge_type IN ('timed', 'evergreen')),
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'ended', 'archived')),
  ADD COLUMN IF NOT EXISTS scenario text,
  ADD COLUMN IF NOT EXISTS driving_question text,
  ADD COLUMN IF NOT EXISTS expected_outcome text,
  ADD COLUMN IF NOT EXISTS constraints text[],
  ADD COLUMN IF NOT EXISTS resources jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS stages jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS steam_weights jsonb DEFAULT '{"S":0,"T":0,"E":0,"A":0,"M":0}',
  ADD COLUMN IF NOT EXISTS difficulty_stars smallint DEFAULT 3
    CHECK (difficulty_stars BETWEEN 1 AND 6),
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS completions_count int DEFAULT 0;

-- Set existing challenges to active so they remain visible
UPDATE public.challenges SET status = 'active' WHERE status IS NULL OR status = 'draft';

-- 2. projects table: add PBL reflection fields + optional STEAM weights override
-- -----------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS reflection text,
  ADD COLUMN IF NOT EXISTS problem_statement text,
  ADD COLUMN IF NOT EXISTS iterations jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS steam_weights jsonb;

-- 3. challenge_ratings table (multi-dimensional peer review)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_ratings (
  id bigserial PRIMARY KEY,
  project_id bigint REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  creativity smallint NOT NULL CHECK (creativity BETWEEN 1 AND 5),
  practicality smallint NOT NULL CHECK (practicality BETWEEN 1 AND 5),
  technical smallint NOT NULL CHECK (technical BETWEEN 1 AND 5),
  reflection_depth smallint NOT NULL CHECK (reflection_depth BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE public.challenge_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_ratings_select" ON public.challenge_ratings
  FOR SELECT USING (true);

CREATE POLICY "challenge_ratings_insert" ON public.challenge_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "challenge_ratings_update" ON public.challenge_ratings
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. challenge_completions table (evergreen personal completion records)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_completions (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  challenge_id bigint REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
  project_id bigint REFERENCES public.projects(id) ON DELETE SET NULL,
  completed_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id)
);

ALTER TABLE public.challenge_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_completions_select" ON public.challenge_completions
  FOR SELECT USING (true);

-- 5. steam_weight_defaults lookup table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.steam_weight_defaults (
  key varchar(50) PRIMARY KEY,
  level varchar(20) NOT NULL CHECK (level IN ('category', 'subcategory')),
  weights jsonb NOT NULL
);

ALTER TABLE public.steam_weight_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "steam_weight_defaults_select" ON public.steam_weight_defaults
  FOR SELECT USING (true);

INSERT INTO public.steam_weight_defaults (key, level, weights) VALUES
  -- Categories (fallback)
  ('科学', 'category', '{"S":30,"T":5,"E":5,"A":0,"M":10}'),
  ('技术', 'category', '{"S":5,"T":30,"E":10,"A":0,"M":5}'),
  ('工程', 'category', '{"S":10,"T":10,"E":30,"A":0,"M":10}'),
  ('艺术', 'category', '{"S":0,"T":5,"E":5,"A":30,"M":0}'),
  ('数学', 'category', '{"S":5,"T":5,"E":5,"A":0,"M":30}'),
  ('其他', 'category', '{"S":5,"T":5,"E":5,"A":5,"M":5}'),
  -- Subcategories (preferred)
  ('物理实验', 'subcategory', '{"S":35,"T":5,"E":5,"A":0,"M":15}'),
  ('化学实验', 'subcategory', '{"S":35,"T":10,"E":5,"A":0,"M":5}'),
  ('生物观察', 'subcategory', '{"S":35,"T":5,"E":0,"A":5,"M":5}'),
  ('天文地理', 'subcategory', '{"S":30,"T":10,"E":0,"A":0,"M":10}'),
  ('编程入门', 'subcategory', '{"S":5,"T":35,"E":5,"A":0,"M":10}'),
  ('电子制作', 'subcategory', '{"S":10,"T":25,"E":20,"A":0,"M":5}'),
  ('机器人',   'subcategory', '{"S":10,"T":25,"E":25,"A":0,"M":5}'),
  ('3D打印',   'subcategory', '{"S":0,"T":25,"E":15,"A":20,"M":5}'),
  ('机械结构', 'subcategory', '{"S":5,"T":10,"E":35,"A":0,"M":10}'),
  ('桥梁建造', 'subcategory', '{"S":10,"T":5,"E":30,"A":0,"M":15}'),
  ('简易机器', 'subcategory', '{"S":10,"T":15,"E":30,"A":0,"M":5}'),
  ('模型制作', 'subcategory', '{"S":5,"T":5,"E":25,"A":20,"M":5}'),
  ('绘画',     'subcategory', '{"S":0,"T":0,"E":0,"A":40,"M":5}'),
  ('手工',     'subcategory', '{"S":0,"T":0,"E":10,"A":35,"M":0}'),
  ('雕塑',     'subcategory', '{"S":0,"T":5,"E":10,"A":35,"M":5}'),
  ('几何探索', 'subcategory', '{"S":5,"T":0,"E":5,"A":10,"M":35}'),
  ('数学游戏', 'subcategory', '{"S":0,"T":5,"E":0,"A":5,"M":35}'),
  ('逻辑谜题', 'subcategory', '{"S":5,"T":10,"E":0,"A":0,"M":35}')
ON CONFLICT (key) DO UPDATE SET weights = EXCLUDED.weights, level = EXCLUDED.level;

-- 6. Updated RLS for challenges: admin CRUD + public visibility by status
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Challenges viewable by everyone" ON public.challenges;

CREATE POLICY "challenges_select_public" ON public.challenges
  FOR SELECT USING (
    status IN ('active', 'ended')
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "challenges_admin_insert" ON public.challenges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "challenges_admin_update" ON public.challenges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "challenges_admin_delete" ON public.challenges
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- 7. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_type_status ON public.challenges(challenge_type, status);
CREATE INDEX IF NOT EXISTS idx_challenge_ratings_project ON public.challenge_ratings(project_id);
CREATE INDEX IF NOT EXISTS idx_challenge_completions_user ON public.challenge_completions(user_id);

-- 8. RPC: complete_evergreen_challenge
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_evergreen_challenge(
  p_user_id uuid,
  p_challenge_id bigint,
  p_project_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_reflection boolean;
  v_iterations_count int;
  v_xp_amount int := 20;
BEGIN
  -- Caller must own the user_id, or be an admin/moderator (service_role has NULL uid)
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role IN ('admin', 'moderator')
     )
  THEN
    RAISE EXCEPTION 'Not authorized to complete challenge for another user';
  END IF;

  -- Only for evergreen challenges
  IF NOT EXISTS (
    SELECT 1 FROM public.challenges
    WHERE id = p_challenge_id AND challenge_type = 'evergreen' AND status = 'active'
  ) THEN
    RETURN false;
  END IF;

  -- Verify the project belongs to the user, targets this challenge, and is approved
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND author_id = p_user_id
      AND challenge_id = p_challenge_id AND status = 'approved'
  ) THEN
    RETURN false;
  END IF;

  -- Insert completion (idempotent)
  INSERT INTO public.challenge_completions (user_id, challenge_id, project_id)
  VALUES (p_user_id, p_challenge_id, p_project_id)
  ON CONFLICT (user_id, challenge_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Increment completions_count
  UPDATE public.challenges
  SET completions_count = completions_count + 1
  WHERE id = p_challenge_id;

  -- Check PBL bonus: reflection + at least 1 iteration
  SELECT
    (p.reflection IS NOT NULL AND length(p.reflection) > 0),
    COALESCE(jsonb_array_length(p.iterations), 0)
  INTO v_has_reflection, v_iterations_count
  FROM public.projects p WHERE p.id = p_project_id;

  IF v_has_reflection AND v_iterations_count >= 1 THEN
    v_xp_amount := v_xp_amount + 10;
  END IF;

  -- Award XP
  INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
  VALUES (p_user_id, 'complete_challenge', p_challenge_id::text, v_xp_amount);

  UPDATE public.profiles
  SET xp = xp + v_xp_amount
  WHERE id = p_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_evergreen_challenge(uuid, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_evergreen_challenge(uuid, bigint, bigint) TO service_role;

-- 9. RPC: settle_timed_challenge
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_timed_challenge(p_challenge_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge record;
  v_ranked record;
  v_results jsonb := '[]'::jsonb;
  v_rank int := 0;
  v_coins int;
  v_badge_prefix text := 'challenge_winner_';
BEGIN
  -- Only admins / moderators (or service_role which has no auth.uid()) may settle
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Only admins can settle timed challenges';
  END IF;

  -- Verify challenge exists and is timed + active
  SELECT * INTO v_challenge FROM public.challenges
  WHERE id = p_challenge_id AND challenge_type = 'timed' AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found or not eligible for settlement';
  END IF;

  -- Rank projects by average rating
  FOR v_ranked IN
    SELECT
      p.id AS project_id,
      p.author_id,
      COALESCE(AVG((cr.creativity + cr.practicality + cr.technical + cr.reflection_depth)::numeric / 4.0), 0) AS avg_score,
      COUNT(cr.id) AS rating_count
    FROM public.projects p
    LEFT JOIN public.challenge_ratings cr ON cr.project_id = p.id
    WHERE p.challenge_id = p_challenge_id AND p.status = 'approved'
    GROUP BY p.id, p.author_id
    ORDER BY avg_score DESC, rating_count DESC
  LOOP
    v_rank := v_rank + 1;

    -- Participation XP for all submitters
    INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
    VALUES (v_ranked.author_id, 'challenge_participation', p_challenge_id::text, 20)
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles SET xp = xp + 20 WHERE id = v_ranked.author_id;

    -- Top 3 rewards
    IF v_rank <= 3 THEN
      v_coins := CASE v_rank WHEN 1 THEN 20 WHEN 2 THEN 10 WHEN 3 THEN 5 END;

      -- Award coins
      INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id, counterparty_display_text)
      VALUES (v_ranked.author_id, v_coins, 'challenge_prize', p_challenge_id::text,
              '挑战第' || v_rank || '名奖励');

      UPDATE public.profiles SET coins = coins + v_coins WHERE id = v_ranked.author_id;
    END IF;

    v_results := v_results || jsonb_build_object(
      'rank', v_rank,
      'project_id', v_ranked.project_id,
      'author_id', v_ranked.author_id,
      'avg_score', round(v_ranked.avg_score, 2),
      'rating_count', v_ranked.rating_count
    );
  END LOOP;

  -- Update challenge status
  UPDATE public.challenges SET status = 'ended' WHERE id = p_challenge_id;

  RETURN jsonb_build_object('rankings', v_results, 'total_submissions', v_rank);
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_timed_challenge(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_timed_challenge(bigint) TO service_role;

-- 10. RPC: calculate_steam_radar (unified model)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_steam_radar(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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
  -- Process all completed activities (projects + challenges)
  FOR v_rec IN
    -- Source 1: completed projects
    SELECT
      COALESCE(
        p.steam_weights,
        (SELECT weights FROM public.steam_weight_defaults WHERE key = COALESCE(
          (SELECT name FROM public.sub_categories WHERE id = p.sub_category_id),
          p.category
        ) LIMIT 1),
        (SELECT weights FROM public.steam_weight_defaults WHERE key = COALESCE(p.category, '其他') AND level = 'category' LIMIT 1),
        '{"S":5,"T":5,"E":5,"A":5,"M":5}'::jsonb
      ) AS weights,
      COALESCE(p.difficulty_stars, 3) AS stars
    FROM public.completed_projects cp
    JOIN public.projects p ON cp.project_id = p.id
    WHERE cp.user_id = target_user_id

    UNION ALL

    -- Source 2: completed challenges
    SELECT
      c.steam_weights AS weights,
      COALESCE(c.difficulty_stars, 3) AS stars
    FROM public.challenge_completions cc
    JOIN public.challenges c ON cc.challenge_id = c.id
    WHERE cc.user_id = target_user_id
  LOOP
    v_stars := v_rec.stars;
    v_weights := v_rec.weights;

    -- Difficulty multiplier and per-tier counter
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

    -- Accumulate raw scores per dimension
    FOR v_dim IN SELECT unnest(ARRAY['S','T','E','A','M'])
    LOOP
      v_raw := COALESCE((v_weights->>v_dim)::numeric, 0) * v_mult * v_decay;
      v_raws := jsonb_set(
        v_raws,
        ARRAY[v_dim],
        to_jsonb(COALESCE((v_raws->>v_dim)::numeric, 0) + v_raw)
      );
    END LOOP;
  END LOOP;

  -- Convert raw -> display scores
  FOR v_dim IN SELECT unnest(ARRAY['S','T','E','A','M'])
  LOOP
    v_raw := COALESCE((v_raws->>v_dim)::numeric, 0);
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

NOTIFY pgrst, 'reload schema';
