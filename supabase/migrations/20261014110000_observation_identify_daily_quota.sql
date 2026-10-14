-- Daily quota for observation photo identification (free users: N photos per
-- Beijing day; members unlimited, decided by the app). Counting is atomic and
-- server-only: the functions are executable only by service_role, and users
-- can read (not write) their own usage rows.

CREATE TABLE IF NOT EXISTS public.observation_identify_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.observation_identify_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.observation_identify_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.observation_identify_usage TO authenticated;
GRANT ALL ON public.observation_identify_usage TO service_role;

DROP POLICY IF EXISTS observation_identify_usage_select_own ON public.observation_identify_usage;
CREATE POLICY observation_identify_usage_select_own
  ON public.observation_identify_usage
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Reserve up to p_count photos against today's limit. Returns how many were
-- granted (0..p_count) plus the usage after reservation.
CREATE OR REPLACE FUNCTION public.reserve_observation_identify_quota(
  p_user_id uuid,
  p_count integer,
  p_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'Asia/Shanghai')::date;
  v_used integer;
  v_granted integer;
BEGIN
  IF p_user_id IS NULL OR p_count IS NULL OR p_count < 0 OR p_limit IS NULL OR p_limit < 0 THEN
    RAISE EXCEPTION 'invalid quota request' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.observation_identify_usage (user_id, usage_date, used)
  VALUES (p_user_id, v_day, 0)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  SELECT used INTO v_used
    FROM public.observation_identify_usage
   WHERE user_id = p_user_id AND usage_date = v_day
   FOR UPDATE;

  v_granted := GREATEST(0, LEAST(p_count, p_limit - v_used));

  IF v_granted > 0 THEN
    UPDATE public.observation_identify_usage
       SET used = used + v_granted, updated_at = now()
     WHERE user_id = p_user_id AND usage_date = v_day;
  END IF;

  RETURN jsonb_build_object(
    'granted', v_granted,
    'used', v_used + v_granted,
    'limit', p_limit,
    'usageDate', v_day
  );
END;
$$;

-- Give back photos whose model call failed (provider error / timeout).
CREATE OR REPLACE FUNCTION public.refund_observation_identify_quota(
  p_user_id uuid,
  p_usage_date date,
  p_count integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN
    RETURN;
  END IF;
  UPDATE public.observation_identify_usage
     SET used = GREATEST(0, used - p_count), updated_at = now()
   WHERE user_id = p_user_id AND usage_date = p_usage_date;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_observation_identify_quota(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_observation_identify_quota(uuid, date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_observation_identify_quota(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_observation_identify_quota(uuid, date, integer) TO service_role;
