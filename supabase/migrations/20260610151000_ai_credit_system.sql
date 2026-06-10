-- AI 导师代币钱包、流水与消费 RPC（会员月度发放 + 非会员每日免费次数）。

CREATE TABLE IF NOT EXISTS public.ai_credit_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance int NOT NULL DEFAULT 0 CHECK (balance >= 0),
  grant_period text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_credit_logs (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount int NOT NULL,
  reason text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_logs_user_created
ON public.ai_credit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_credit_logs_user_reason_created
ON public.ai_credit_logs(user_id, reason, created_at DESC);

ALTER TABLE public.ai_credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_credit_wallets_select_own"
ON public.ai_credit_wallets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "ai_credit_logs_select_own"
ON public.ai_credit_logs FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 上海时区当日起点（免费次数按自然日计）
CREATE OR REPLACE FUNCTION public.ai_credit_day_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai');
$$;

CREATE OR REPLACE FUNCTION public.ai_credit_month_period()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_char(now() AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM');
$$;

CREATE OR REPLACE FUNCTION public.count_ai_free_chats_today(p_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.ai_credit_logs
  WHERE user_id = p_user_id
    AND reason = 'free_chat'
    AND created_at >= public.ai_credit_day_start();
$$;

-- 读取配额状态（不消费）
CREATE OR REPLACE FUNCTION public.get_ai_credit_status(
  p_is_member boolean,
  p_monthly_grant int,
  p_free_daily int
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_wallet public.ai_credit_wallets%ROWTYPE;
  v_period text := public.ai_credit_month_period();
  v_free_used int;
  v_free_remaining int;
  v_wallet_balance int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_wallet FROM public.ai_credit_wallets WHERE user_id = v_user_id;
  v_free_used := public.count_ai_free_chats_today(v_user_id);
  v_free_remaining := GREATEST(p_free_daily - v_free_used, 0);

  IF p_is_member THEN
    IF v_wallet.user_id IS NULL OR v_wallet.grant_period IS DISTINCT FROM v_period THEN
      v_wallet_balance := p_monthly_grant;
    ELSE
      v_wallet_balance := v_wallet.balance;
    END IF;
  ELSE
    v_wallet_balance := 0;
  END IF;

  RETURN jsonb_build_object(
    'isMember', p_is_member,
    'walletBalance', v_wallet_balance,
    'monthlyGrant', p_monthly_grant,
    'freeDaily', p_free_daily,
    'freeUsedToday', v_free_used,
    'freeRemainingToday', v_free_remaining,
    'grantPeriod', v_period,
    'dayResetAt', EXTRACT(EPOCH FROM (public.ai_credit_day_start() + interval '1 day'))::bigint,
    'canChat', (v_wallet_balance >= 1 OR v_free_remaining >= 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_ai_credit(
  p_cost int,
  p_is_member boolean,
  p_monthly_grant int,
  p_free_daily int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_period text := public.ai_credit_month_period();
  v_wallet public.ai_credit_wallets%ROWTYPE;
  v_free_used int;
  v_new_balance int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF p_cost IS NULL OR p_cost < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_cost');
  END IF;

  -- 会员：尝试月度钱包扣减
  IF p_is_member THEN
    SELECT * INTO v_wallet FROM public.ai_credit_wallets WHERE user_id = v_user_id;

    IF NOT FOUND THEN
      INSERT INTO public.ai_credit_wallets (user_id, balance, grant_period)
      VALUES (v_user_id, p_monthly_grant, v_period);
      INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
      VALUES (v_user_id, p_monthly_grant, 'monthly_grant', jsonb_build_object('period', v_period));
      v_wallet.balance := p_monthly_grant;
    ELSIF v_wallet.grant_period IS DISTINCT FROM v_period THEN
      UPDATE public.ai_credit_wallets
      SET balance = p_monthly_grant, grant_period = v_period, updated_at = now()
      WHERE user_id = v_user_id;
      INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
      VALUES (v_user_id, p_monthly_grant, 'monthly_grant', jsonb_build_object('period', v_period));
      v_wallet.balance := p_monthly_grant;
    END IF;

    SELECT balance INTO v_wallet.balance FROM public.ai_credit_wallets WHERE user_id = v_user_id;

    IF v_wallet.balance >= p_cost THEN
      v_new_balance := v_wallet.balance - p_cost;
      UPDATE public.ai_credit_wallets
      SET balance = v_new_balance, updated_at = now()
      WHERE user_id = v_user_id;

      INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
      VALUES (v_user_id, -p_cost, 'credit_chat', jsonb_build_object('cost', p_cost));

      RETURN jsonb_build_object(
        'ok', true,
        'source', 'wallet',
        'remaining', v_new_balance,
        'cost', p_cost
      );
    END IF;
  END IF;

  -- 免费每日次数（非会员，或会员钱包不足时回退）
  v_free_used := public.count_ai_free_chats_today(v_user_id);
  IF v_free_used >= p_free_daily THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'source', 'free',
      'remaining', 0,
      'freeUsedToday', v_free_used,
      'freeDaily', p_free_daily,
      'resetAt', EXTRACT(EPOCH FROM (public.ai_credit_day_start() + interval '1 day'))::bigint
    );
  END IF;

  INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
  VALUES (v_user_id, -p_cost, 'free_chat', jsonb_build_object('cost', p_cost));

  RETURN jsonb_build_object(
    'ok', true,
    'source', 'free',
    'remaining', GREATEST(p_free_daily - v_free_used - 1, 0),
    'cost', p_cost,
    'freeUsedToday', v_free_used + 1,
    'freeDaily', p_free_daily,
    'resetAt', EXTRACT(EPOCH FROM (public.ai_credit_day_start() + interval '1 day'))::bigint
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_ai_credit(
  p_cost int,
  p_source text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF p_cost IS NULL OR p_cost < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_cost');
  END IF;

  IF p_source = 'wallet' THEN
    UPDATE public.ai_credit_wallets
    SET balance = balance + p_cost, updated_at = now()
    WHERE user_id = v_user_id;
  END IF;

  INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
  VALUES (v_user_id, p_cost, 'refund', jsonb_build_object('source', p_source, 'cost', p_cost));

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_ai_credit(
  p_target_user_id uuid,
  p_amount int,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_role text;
  v_new_balance int;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_admin_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_target_user_id IS NULL OR p_amount IS NULL OR p_amount = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;

  INSERT INTO public.ai_credit_wallets (user_id, balance)
  VALUES (p_target_user_id, GREATEST(p_amount, 0))
  ON CONFLICT (user_id) DO UPDATE
    SET balance = GREATEST(public.ai_credit_wallets.balance + p_amount, 0),
        updated_at = now()
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
  VALUES (
    p_target_user_id,
    p_amount,
    'admin_adjust',
    jsonb_build_object('note', p_note, 'adminId', v_admin_id)
  );

  RETURN jsonb_build_object('ok', true, 'balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_credit_status(boolean, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(int, boolean, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_credit(int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_ai_credit(uuid, int, text) TO authenticated;

COMMENT ON TABLE public.ai_credit_wallets IS 'AI 导师代币钱包（会员按月懒发放）。';
COMMENT ON TABLE public.ai_credit_logs IS 'AI 导师代币流水：monthly_grant / credit_chat / free_chat / refund / admin_adjust。';
