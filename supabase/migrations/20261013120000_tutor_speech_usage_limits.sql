-- Platform safety ceilings, not a priced membership entitlement or an AI-credit debit.
-- Apply only through the reviewed deployment/migration workflow. No client write grants.
CREATE TABLE public.tutor_speech_usage_policy (
  kind text PRIMARY KEY CHECK (kind IN ('tts', 'asr')),
  user_daily_units bigint NOT NULL CHECK (user_daily_units > 0),
  global_daily_units bigint NOT NULL CHECK (global_daily_units >= user_daily_units),
  max_request_units integer NOT NULL CHECK (max_request_units > 0)
);
INSERT INTO public.tutor_speech_usage_policy VALUES
  ('tts', 20000, 500000, 1600), -- characters; a legacy HTTP fallback can reserve 2 x 800
  ('asr', 1800, 36000, 32);   -- seconds, rounded up from mono 16 kHz PCM16 bytes

CREATE TABLE public.tutor_speech_daily_usage (
  usage_day date NOT NULL,
  scope text NOT NULL CHECK (scope = 'global' OR scope LIKE 'user:%'),
  kind text NOT NULL REFERENCES public.tutor_speech_usage_policy(kind),
  units bigint NOT NULL DEFAULT 0 CHECK (units >= 0),
  PRIMARY KEY (usage_day, scope, kind)
);
CREATE TABLE public.tutor_speech_usage_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL REFERENCES public.tutor_speech_usage_policy(kind),
  expires_at timestamptz NOT NULL
);
CREATE INDEX tutor_speech_leases_user_expiry ON public.tutor_speech_usage_leases(user_id, expires_at);
ALTER TABLE public.tutor_speech_usage_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_speech_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_speech_usage_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tutor_speech_usage_policy, public.tutor_speech_daily_usage,
  public.tutor_speech_usage_leases FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.reserve_tutor_speech_usage(p_user_id uuid, p_kind text, p_units integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_policy public.tutor_speech_usage_policy%ROWTYPE;
  v_now timestamptz;
  v_day date;
  v_scope text;
  v_user_used bigint;
  v_global_used bigint;
  v_lease uuid;
  v_reset bigint;
BEGIN
  IF p_user_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('tts', 'asr')
      OR p_units IS NULL OR p_units < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_user');
  END IF;
  -- All kinds/scopes share a single acquisition order, including cross-kind concurrency.
  PERFORM pg_advisory_xact_lock(2147481313::bigint);
  v_now := clock_timestamp();
  v_day := (v_now AT TIME ZONE 'Asia/Shanghai')::date;
  v_reset := EXTRACT(EPOCH FROM ((v_day + 1)::timestamp AT TIME ZONE 'Asia/Shanghai'))::bigint;
  v_scope := 'user:' || p_user_id::text;
  SELECT * INTO v_policy FROM public.tutor_speech_usage_policy WHERE kind = p_kind;
  IF NOT FOUND OR p_units > v_policy.max_request_units THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_units');
  END IF;
  DELETE FROM public.tutor_speech_usage_leases WHERE expires_at <= v_now;
  DELETE FROM public.tutor_speech_daily_usage WHERE usage_day < v_day - 31;
  IF (SELECT count(*) FROM public.tutor_speech_usage_leases WHERE user_id = p_user_id) >= 2
      OR (SELECT count(*) FROM public.tutor_speech_usage_leases) >= 32 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'concurrency_limit');
  END IF;
  INSERT INTO public.tutor_speech_daily_usage(usage_day, scope, kind)
    VALUES(v_day, v_scope, p_kind), (v_day, 'global', p_kind) ON CONFLICT DO NOTHING;
  SELECT units INTO v_user_used FROM public.tutor_speech_daily_usage
    WHERE usage_day = v_day AND scope = v_scope AND kind = p_kind FOR UPDATE;
  SELECT units INTO v_global_used FROM public.tutor_speech_daily_usage
    WHERE usage_day = v_day AND scope = 'global' AND kind = p_kind FOR UPDATE;
  IF v_user_used + p_units > v_policy.user_daily_units THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_daily_limit', 'resetAt', v_reset);
  END IF;
  IF v_global_used + p_units > v_policy.global_daily_units THEN
    RETURN jsonb_build_object('ok', false, 'error', 'global_daily_limit', 'resetAt', v_reset);
  END IF;
  UPDATE public.tutor_speech_daily_usage SET units = units + p_units
    WHERE usage_day = v_day AND scope IN (v_scope, 'global') AND kind = p_kind;
  INSERT INTO public.tutor_speech_usage_leases(user_id, kind, expires_at)
    VALUES(p_user_id, p_kind, v_now + interval '5 minutes') RETURNING id INTO v_lease;
  RETURN jsonb_build_object('ok', true, 'leaseId', v_lease, 'resetAt', v_reset);
END;
$$;

CREATE FUNCTION public.release_tutor_speech_usage(p_lease_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Idempotent concurrency release. Never refunds usage or changes a daily policy.
  DELETE FROM public.tutor_speech_usage_leases WHERE id = p_lease_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_tutor_speech_usage(uuid, text, integer),
  public.release_tutor_speech_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tutor_speech_usage(uuid, text, integer),
  public.release_tutor_speech_usage(uuid) TO service_role;

-- Existing clients may identify a reply by its exact text; both paths are own-reply-only.
-- INVOKER retains tutor_messages RLS in addition to the explicit owner predicate.
CREATE FUNCTION public.resolve_tutor_speech_reply(p_message_id bigint DEFAULT NULL, p_text text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_text text;
BEGIN
  IF auth.uid() IS NULL OR (p_message_id IS NULL) = (p_text IS NULL)
      OR (p_message_id IS NOT NULL AND p_message_id <= 0)
      OR (p_text IS NOT NULL AND (length(p_text) = 0 OR length(p_text) > 32000)) THEN
    RETURN NULL;
  END IF;
  SELECT content INTO v_text FROM public.tutor_messages
    WHERE user_id = auth.uid() AND role = 'assistant'
      AND ((p_message_id IS NOT NULL AND id = p_message_id)
        OR (p_message_id IS NULL AND content = p_text))
    ORDER BY id DESC LIMIT 1;
  RETURN v_text;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_tutor_speech_reply(bigint, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_tutor_speech_reply(bigint, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
