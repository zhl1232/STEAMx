-- ============================================
-- 商店与硬币系统 + 每日签到发币 + 商店 RPC + 打赏（单次迁移）
-- 1. profiles 硬币/头像框、coin_logs、user_inventory
-- 2. daily_check_in 扩展：新一天打卡发 XP + 2 硬币
-- 3. 商店 RPC：get_shop_item_price、purchase_item、equip_avatar_frame
-- 4. 打赏：tip_resource、get_my_tip_for_resource、get_tip_received_for_resource
-- ============================================

-- ---------- 1. 商店与硬币：表与字段 ----------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS coins int DEFAULT 0,
ADD COLUMN IF NOT EXISTS equipped_avatar_frame_id text DEFAULT NULL;

COMMENT ON COLUMN public.profiles.coins IS '用户硬币余额';
COMMENT ON COLUMN public.profiles.equipped_avatar_frame_id IS '当前装备的头像框 id';

CREATE TABLE IF NOT EXISTS public.coin_logs (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount int NOT NULL,
  action_type text NOT NULL,
  resource_id text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.coin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coin logs"
  ON public.coin_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coin_logs_user_id ON public.coin_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_logs_action_type ON public.coin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_coin_logs_resource_id ON public.coin_logs(resource_id) WHERE resource_id IS NOT NULL;

COMMENT ON TABLE public.coin_logs IS '硬币流水，防刷与对账';

CREATE TABLE IF NOT EXISTS public.user_inventory (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  item_id text NOT NULL,
  unlocked_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inventory"
  ON public.user_inventory FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_inventory IS '用户拥有的商品（如头像框）';

-- ---------- 2. 每日签到：新一天发 XP + 2 硬币 ----------
CREATE OR REPLACE FUNCTION public.daily_check_in()
RETURNS jsonb AS $$
DECLARE
  v_current_date date := CURRENT_DATE;
  v_user_id uuid := auth.uid();
  user_last_check_in date;
  user_streak int;
  user_total_days int;
  xp_amount int;
  coins_amount int := 2;
  result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT last_check_in, login_streak, total_login_days
  INTO user_last_check_in, user_streak, user_total_days
  FROM public.profiles
  WHERE id = v_user_id;

  IF user_last_check_in = v_current_date THEN
    RETURN jsonb_build_object(
      'streak', user_streak,
      'total_days', user_total_days,
      'checked_in_today', true,
      'is_new_day', false,
      'xp_granted', 0,
      'coins_granted', 0
    );
  END IF;

  IF user_last_check_in = v_current_date - 1 THEN
    user_streak := COALESCE(user_streak, 0) + 1;
  ELSE
    user_streak := 1;
  END IF;

  user_total_days := COALESCE(user_total_days, 0) + 1;
  xp_amount := 5 + LEAST(user_streak, 20);

  INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
  VALUES (v_user_id, 'daily_login', v_current_date::text, xp_amount);

  INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id)
  VALUES (v_user_id, coins_amount, 'daily_login', v_current_date::text);

  UPDATE public.profiles
  SET
    last_check_in = v_current_date,
    login_streak = user_streak,
    total_login_days = user_total_days,
    xp = xp + xp_amount,
    coins = coins + coins_amount
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'streak', user_streak,
    'total_days', user_total_days,
    'checked_in_today', true,
    'is_new_day', true,
    'xp_granted', xp_amount,
    'coins_granted', coins_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.daily_check_in() IS '每日签到：更新打卡状态，新一天时发放 XP 与 2 硬币（同一事务）';

-- ---------- 3. 商店 RPC ----------
CREATE OR REPLACE FUNCTION public.get_shop_item_price(p_item_id text)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_item_id
    WHEN 'neon_halo'   THEN 10
    WHEN 'pixel_border' THEN 8
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_price int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  v_price := public.get_shop_item_price(p_item_id);
  IF v_price IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_item');
  END IF;

  UPDATE public.profiles
  SET coins = coins - v_price
  WHERE id = v_user_id
    AND coins >= v_price;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coins');
  END IF;

  INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id)
  VALUES (v_user_id, -v_price, 'purchase', p_item_id);

  INSERT INTO public.user_inventory (user_id, item_id, unlocked_at)
  VALUES (v_user_id, p_item_id, now())
  ON CONFLICT (user_id, item_id) DO NOTHING;

  UPDATE public.profiles
  SET equipped_avatar_frame_id = p_item_id
  WHERE id = v_user_id
    AND p_item_id IN ('neon_halo', 'pixel_border');

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'price', v_price);
END;
$$;

CREATE OR REPLACE FUNCTION public.equip_avatar_frame(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owned boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_item_id IS NULL OR p_item_id = '' THEN
    UPDATE public.profiles
    SET equipped_avatar_frame_id = NULL
    WHERE id = v_user_id;
    RETURN jsonb_build_object('ok', true, 'equipped', null);
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_inventory
    WHERE user_id = v_user_id AND item_id = p_item_id
  ) INTO v_owned;

  IF NOT v_owned THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owned');
  END IF;

  IF p_item_id NOT IN ('neon_halo', 'pixel_border') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_avatar_frame');
  END IF;

  UPDATE public.profiles
  SET equipped_avatar_frame_id = p_item_id
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'equipped', p_item_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_item_price(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_item_price(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_item(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_item(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.equip_avatar_frame(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_avatar_frame(text) TO service_role;

-- ---------- 4. 打赏：每人每资源限 2 硬币，支持项目/作品 ----------
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

  IF p_resource_type = 'project' THEN
    SELECT author_id INTO v_target_owner_id
    FROM public.projects
    WHERE id = p_resource_id;
  ELSIF p_resource_type = 'completion' THEN
    SELECT user_id INTO v_target_owner_id
    FROM public.completed_projects
    WHERE id = p_resource_id;
  END IF;

  IF v_target_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'resource_not_found');
  END IF;

  IF v_target_owner_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_tip_self');
  END IF;

  SELECT COALESCE(SUM(amount), 0)::int INTO v_my_tipped
  FROM public.coin_logs
  WHERE user_id = v_user_id
    AND action_type = 'tip'
    AND resource_id = v_resource_key
    AND amount < 0;

  v_my_tipped := ABS(v_my_tipped);

  IF v_my_tipped + p_amount > 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tip_limit_reached', 'my_tipped', v_my_tipped, 'limit', 2);
  END IF;

  UPDATE public.profiles
  SET coins = coins - p_amount
  WHERE id = v_user_id
    AND coins >= p_amount;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coins');
  END IF;

  UPDATE public.profiles
  SET coins = coins + p_amount
  WHERE id = v_target_owner_id;

  INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id)
  VALUES
    (v_user_id, -p_amount, 'tip', v_resource_key),
    (v_target_owner_id, p_amount, 'tip', v_resource_key);

  RETURN jsonb_build_object('ok', true, 'amount', p_amount, 'new_my_tipped', v_my_tipped + p_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_tip_for_resource(
  p_resource_type text,
  p_resource_id bigint
)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ABS(SUM(amount)), 0)::int
  FROM public.coin_logs
  WHERE user_id = auth.uid()
    AND action_type = 'tip'
    AND resource_id = (p_resource_type || ':' || p_resource_id::text)
    AND amount < 0;
$$;

CREATE OR REPLACE FUNCTION public.get_tip_received_for_resource(
  p_resource_type text,
  p_resource_id bigint
)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::int
  FROM public.coin_logs
  WHERE action_type = 'tip'
    AND resource_id = (p_resource_type || ':' || p_resource_id::text)
    AND amount > 0;
$$;

GRANT EXECUTE ON FUNCTION public.tip_resource(text, bigint, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tip_resource(text, bigint, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_tip_for_resource(text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tip_for_resource(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tip_received_for_resource(text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tip_received_for_resource(text, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.get_tip_received_for_resource(text, bigint) TO service_role;
