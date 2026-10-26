-- Shared membership semantics, server-priced cosmetic purchases, and atomic prizes.
CREATE OR REPLACE FUNCTION public.effective_membership_tier(
  p_tier text, p_period text, p_expires_at timestamptz, p_now timestamptz DEFAULT now()
) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_tier = 'founder' AND p_period = 'founder' THEN 'founder'
    WHEN p_tier = 'pro' AND (p_period = 'lifetime' OR
      (p_period IN ('monthly', 'yearly') AND p_expires_at > p_now)) THEN 'pro'
    ELSE 'free' END;
$$;
REVOKE ALL ON FUNCTION public.effective_membership_tier(text,text,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_membership_tier(text,text,timestamptz,timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.shop_member_price(p_base_price integer, p_tier text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT greatest(1, floor(p_base_price::numeric * CASE p_tier WHEN 'founder' THEN 80 WHEN 'pro' THEN 88 ELSE 100 END / 100)::integer);
$$;
REVOKE ALL ON FUNCTION public.shop_member_price(integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_member_price(integer,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_shop_prices()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_profile public.profiles%ROWTYPE; v_tier text; v_items jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;
  v_tier := public.effective_membership_tier(v_profile.membership_tier, v_profile.membership_period, v_profile.membership_expires_at, clock_timestamp());
  SELECT jsonb_agg(jsonb_build_object(
    'id', item_id, 'basePrice', public.get_shop_item_price(item_id),
    'price', public.shop_member_price(public.get_shop_item_price(item_id), v_tier),
    'minLevel', public.get_shop_item_min_level(item_id),
    'owned', EXISTS(SELECT 1 FROM public.user_inventory i WHERE i.user_id = v_profile.id AND i.item_id = catalog.item_id)
  )) INTO v_items FROM unnest(ARRAY[
    'pixel_border','crystal_glass','science_orbit','neon_halo','cyber_glitch','golden_crown',
    'name_color_cherry','name_color_abyss','name_color_neon','name_color_gold'
  ]) AS catalog(item_id);
  RETURN jsonb_build_object('membershipTier', v_tier, 'coins', v_profile.coins,
    'level', v_profile.level, 'items', v_items);
END;
$$;
REVOKE ALL ON FUNCTION public.get_shop_prices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shop_prices() TO authenticated;

-- Older clients display the base price. Keep their entry point during rollout,
-- charging the current member price (never above that base) through the same debit path.
CREATE OR REPLACE FUNCTION public.purchase_item(p_item_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid := auth.uid(); v_profile public.profiles%ROWTYPE;
  v_price integer; v_tier text;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthorized'); END IF;
  v_price := public.get_shop_item_price(p_item_id);
  IF v_price IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_item'); END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found'); END IF;
  v_tier := public.effective_membership_tier(v_profile.membership_tier, v_profile.membership_period, v_profile.membership_expires_at, clock_timestamp());
  RETURN public.purchase_item(p_item_id, public.shop_member_price(v_price, v_tier));
END;
$$;
REVOKE ALL ON FUNCTION public.purchase_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_item(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_item(p_item_id text, p_expected_price integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid := auth.uid(); v_profile public.profiles%ROWTYPE;
  v_price integer; v_min_level integer; v_tier text;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthorized'); END IF;
  v_price := public.get_shop_item_price(p_item_id);
  v_min_level := public.get_shop_item_min_level(p_item_id);
  IF v_price IS NULL OR v_min_level IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_item'); END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found'); END IF;
  IF COALESCE(v_profile.level, 1) < v_min_level THEN
    RETURN jsonb_build_object('ok', false, 'error', 'min_level_required', 'min_level', v_min_level, 'level', v_profile.level);
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = v_user_id AND item_id = p_item_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_owned');
  END IF;
  v_tier := public.effective_membership_tier(v_profile.membership_tier, v_profile.membership_period, v_profile.membership_expires_at, clock_timestamp());
  v_price := public.shop_member_price(v_price, v_tier);
  IF p_expected_price IS NULL OR p_expected_price <> v_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_changed', 'price', v_price);
  END IF;
  IF COALESCE(v_profile.coins, 0) < v_price THEN RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coins'); END IF;
  UPDATE public.profiles SET coins = coins - v_price WHERE id = v_user_id;
  INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id) VALUES (v_user_id, -v_price, 'purchase', p_item_id);
  INSERT INTO public.user_inventory (user_id, item_id, unlocked_at) VALUES (v_user_id, p_item_id, now());
  IF p_item_id LIKE 'name_color_%' THEN
    UPDATE public.profiles SET equipped_name_color_id = p_item_id WHERE id = v_user_id;
  ELSE
    UPDATE public.profiles SET equipped_avatar_frame_id = p_item_id WHERE id = v_user_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'price', v_price);
END;
$$;
REVOKE ALL ON FUNCTION public.purchase_item(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_item(text,integer) TO authenticated;

CREATE TABLE public.challenge_settlements (
  challenge_id bigint PRIMARY KEY REFERENCES public.challenges(id),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.challenge_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.challenge_settlements FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.challenge_settlements TO service_role;

-- Replace the obsolete projects-based RPC and the JS read/overwrite balance path.
-- One challenge lock serializes replay; profile locks use a stable order across challenges.
CREATE OR REPLACE FUNCTION public.settle_timed_challenge(p_challenge_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_challenge public.challenges%ROWTYPE; v_result jsonb;
  v_rankings jsonb; v_row jsonb; v_prize integer; v_user uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required'; END IF;
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND OR v_challenge.challenge_type <> 'timed' THEN RAISE EXCEPTION 'timed_challenge_required'; END IF;
  SELECT result INTO v_result FROM public.challenge_settlements WHERE challenge_id = p_challenge_id;
  IF FOUND THEN RETURN v_result; END IF;
  IF v_challenge.status <> 'active' THEN RAISE EXCEPTION 'active_challenge_required'; END IF;
  IF EXISTS (SELECT 1 FROM public.coin_logs WHERE action_type = 'challenge_prize' AND resource_id = p_challenge_id::text) THEN
    RAISE EXCEPTION 'legacy_partial_settlement_requires_review';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.rank), '[]'::jsonb) INTO v_rankings
  FROM (
    SELECT s.*, row_number() OVER (ORDER BY s.avg_score DESC, s.rating_count DESC, s.updated_at ASC, s.submission_id ASC) AS rank
    FROM (
      SELECT c.id AS submission_id, c.user_id, c.title, c.updated_at,
        round(COALESCE(avg((r.creative_expression + r.completion_quality + r.evidence_completeness + r.reflection_depth)::numeric / 4), 0), 2) AS avg_score,
        count(r.submission_id) AS rating_count
      FROM public.challenge_submissions c
      LEFT JOIN public.challenge_submission_ratings r ON r.submission_id = c.id
      WHERE c.challenge_id = p_challenge_id AND c.status = 'approved' AND c.is_public AND c.moderation_state = 'approved'
      GROUP BY c.id, c.user_id, c.title, c.updated_at
    ) s
  ) r;
  PERFORM 1 FROM public.profiles p WHERE p.id IN (
    SELECT (r->>'user_id')::uuid FROM jsonb_array_elements(v_rankings) r
  ) ORDER BY p.id FOR UPDATE;

  FOR v_row IN SELECT value FROM jsonb_array_elements(v_rankings) LOOP
    v_user := (v_row->>'user_id')::uuid;
    PERFORM public.award_xp_once(v_user, 'challenge_participation', p_challenge_id::text);
    v_prize := CASE (v_row->>'rank')::integer WHEN 1 THEN 20 WHEN 2 THEN 10 WHEN 3 THEN 5 ELSE 0 END;
    IF v_prize > 0 THEN
      UPDATE public.profiles SET coins = COALESCE(coins, 0) + v_prize WHERE id = v_user;
      IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;
      INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id, counterparty_display_text)
      VALUES (v_user, v_prize, 'challenge_prize', p_challenge_id::text, '挑战第' || (v_row->>'rank') || '名奖励');
    END IF;
  END LOOP;
  SELECT jsonb_build_object('total_submissions', jsonb_array_length(v_rankings),
    'winners', COALESCE(jsonb_agg(r - 'user_id' - 'updated_at' ORDER BY (r->>'rank')::integer), '[]'::jsonb)) INTO v_result
  FROM jsonb_array_elements(v_rankings) r WHERE (r->>'rank')::integer <= 3;
  INSERT INTO public.challenge_settlements (challenge_id, result) VALUES (p_challenge_id, v_result);
  UPDATE public.challenges SET status = 'ended' WHERE id = p_challenge_id;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_timed_challenge(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_timed_challenge(bigint) TO service_role;
-- Preserve tipping behavior while sharing a deterministic multi-profile lock order.
CREATE OR REPLACE FUNCTION public.tip_resource(
  p_resource_type text,
  p_resource_id bigint,
  p_amount int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_target_owner_id uuid;
  v_resource_key text;
  v_my_tipped int;
  v_giver_display text;
  v_recipient_display text;
  v_resource_label text;  -- 用于流水：如 "项目：xxx" 或 "某某的作品"
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  IF p_resource_type NOT IN ('project', 'completion') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_resource_type');
  END IF;

  v_resource_key := p_resource_type || ':' || p_resource_id::text;

  -- 查找资源作者并获取行锁防止并发问题
  IF p_resource_type = 'project' THEN
    SELECT author_id INTO v_target_owner_id
    FROM public.projects
    WHERE id = p_resource_id FOR UPDATE;
  ELSIF p_resource_type = 'completion' THEN
    SELECT user_id INTO v_target_owner_id
    FROM public.completed_projects
    WHERE id = p_resource_id FOR UPDATE;
  END IF;

  IF v_target_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'resource_not_found');
  END IF;

  IF v_target_owner_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_tip_self');
  END IF;

  -- 查询我已给该对象投过多少币 (通过流水汇总，防刷)
  SELECT COALESCE(ABS(SUM(amount)), 0)::int INTO v_my_tipped
  FROM public.coin_logs
  WHERE user_id = v_user_id
    AND action_type = 'tip'
    AND resource_id = v_resource_key
    AND amount < 0;

  IF v_my_tipped + p_amount > 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tip_limit_reached', 'my_tipped', v_my_tipped, 'limit', 2);
  END IF;

  -- Match settlement/batch operations: never lock sender then recipient in opposite UUID order.
  PERFORM 1 FROM public.profiles
  WHERE id IN (v_user_id, v_target_owner_id) ORDER BY id FOR UPDATE;

  -- 扣减投币者余额
  UPDATE public.profiles
  SET coins = coins - p_amount
  WHERE id = v_user_id
    AND coins >= p_amount;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coins');
  END IF;

  -- 增加目标用户的余额
  UPDATE public.profiles
  SET coins = coins + p_amount
  WHERE id = v_target_owner_id;

  -- 同步增加被投币资源的 coins_count（为前端做冗余提速）
  IF p_resource_type = 'project' THEN
    UPDATE public.projects
    SET coins_count = coins_count + p_amount
    WHERE id = p_resource_id;
  ELSIF p_resource_type = 'completion' THEN
    UPDATE public.completed_projects
    SET coins_count = coins_count + p_amount
    WHERE id = p_resource_id;
  END IF;

  -- 查打赏方、收款方昵称及资源展示文案（用于流水）
  SELECT display_name INTO v_giver_display FROM public.profiles WHERE id = v_user_id;
  SELECT display_name INTO v_recipient_display FROM public.profiles WHERE id = v_target_owner_id;
  v_giver_display := COALESCE(NULLIF(trim(v_giver_display), ''), '某用户');
  v_recipient_display := COALESCE(NULLIF(trim(v_recipient_display), ''), '某用户');

  IF p_resource_type = 'project' THEN
    SELECT title INTO v_resource_label FROM public.projects WHERE id = p_resource_id;
    v_resource_label := COALESCE('项目：' || v_resource_label, v_resource_key);
  ELSE
    v_resource_label := v_recipient_display || ' 的作品';
  END IF;

  -- 记录流水（支出方：打赏给 counterparty = 收款方昵称 + 资源说明；收入方：收到 counterparty = 打赏方昵称）
  INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id, counterparty_display_text)
  VALUES
    (v_user_id, -p_amount, 'tip', v_resource_key, v_recipient_display || '（' || v_resource_label || '）'),
    (v_target_owner_id, p_amount, 'tip', v_resource_key, v_giver_display);

  RETURN jsonb_build_object('ok', true, 'amount', p_amount, 'new_my_tipped', v_my_tipped + p_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.tip_resource(text,bigint,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tip_resource(text,bigint,integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
