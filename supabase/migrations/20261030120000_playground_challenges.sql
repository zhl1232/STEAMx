-- Private authoritative challenge snapshots. All access is through authenticated server APIs.
CREATE TABLE IF NOT EXISTS public.playground_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL,
 game text NOT NULL CHECK(game IN ('gomoku','memory')),
 mode text NOT NULL CHECK(mode IN ('invite','random')),
 host_id uuid NOT NULL REFERENCES public.profiles(id), guest_id uuid REFERENCES public.profiles(id),
 bot boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'waiting', version integer NOT NULL DEFAULT 0,
 state jsonb NOT NULL DEFAULT '{}', ready_host boolean NOT NULL DEFAULT false,ready_guest boolean NOT NULL DEFAULT false,
 charged boolean NOT NULL DEFAULT false, settled boolean NOT NULL DEFAULT false,
 ready_deadline_at timestamptz, quota_day date, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS playground_challenges_queue ON public.playground_challenges(game,created_at) WHERE status='waiting' AND mode='random';
CREATE INDEX IF NOT EXISTS playground_challenges_active ON public.playground_challenges(updated_at) WHERE status IN ('ready','playing');
CREATE TABLE IF NOT EXISTS public.playground_challenge_usage(user_id uuid NOT NULL REFERENCES public.profiles(id),game text NOT NULL,day date NOT NULL,used integer NOT NULL DEFAULT 0 CHECK(used BETWEEN 0 AND 5),PRIMARY KEY(user_id,game,day));
CREATE TABLE IF NOT EXISTS public.playground_challenge_strength(user_id uuid NOT NULL REFERENCES public.profiles(id),game text NOT NULL,strength integer NOT NULL DEFAULT 40 CHECK(strength BETWEEN 0 AND 100),PRIMARY KEY(user_id,game));
CREATE TABLE IF NOT EXISTS public.playground_challenge_requests(match_id uuid NOT NULL REFERENCES public.playground_challenges(id),request_id uuid NOT NULL,PRIMARY KEY(match_id,request_id));
ALTER TABLE public.playground_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playground_challenge_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playground_challenge_strength ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playground_challenge_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.playground_challenges,public.playground_challenge_usage,public.playground_challenge_strength,public.playground_challenge_requests FROM anon,authenticated;
GRANT ALL ON public.playground_challenges,public.playground_challenge_usage,public.playground_challenge_strength,public.playground_challenge_requests TO service_role;

CREATE OR REPLACE FUNCTION public.challenge_lobby(p_user uuid,p_game text,p_operation text,p_code text,p_state jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.playground_challenges; candidate public.playground_challenges; v_code text;
BEGIN
 IF p_game NOT IN ('gomoku','memory') OR p_operation NOT IN ('queue','bot','invite','join') THEN RAISE EXCEPTION 'invalid_operation'; END IF;
 -- Small global lobby lock makes claiming a queue and enforcing one paid match atomic.
 PERFORM pg_advisory_xact_lock(836451);
 UPDATE public.playground_challenges SET status='cancelled',settled=true WHERE mode='random' AND status='waiting' AND created_at<clock_timestamp()-interval '2 minutes';
 SELECT * INTO m FROM public.playground_challenges WHERE mode='random' AND status IN ('waiting','ready','playing') AND (host_id=p_user OR guest_id=p_user) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
   IF m.game<>p_game THEN RAISE EXCEPTION 'active_challenge'; END IF;
   IF p_operation='bot' AND m.status='waiting' AND m.host_id=p_user THEN
     IF clock_timestamp()<m.created_at+interval '3 seconds' THEN RAISE EXCEPTION 'matching'; END IF;
     UPDATE public.playground_challenges SET bot=true,status='ready',ready_deadline_at=clock_timestamp()+interval '15 seconds',state=p_state,updated_at=clock_timestamp() WHERE id=m.id RETURNING * INTO m;
   END IF;
   RETURN to_jsonb(m);
 END IF;
 IF p_operation='join' THEN
   SELECT * INTO m FROM public.playground_challenges WHERE code=upper(p_code) AND game=p_game AND mode='invite' FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
   IF m.host_id=p_user OR m.guest_id=p_user THEN RETURN to_jsonb(m); END IF;
   IF m.status<>'waiting' OR m.guest_id IS NOT NULL THEN RAISE EXCEPTION 'room_full'; END IF;
   UPDATE public.playground_challenges SET guest_id=p_user,status='ready',ready_deadline_at=clock_timestamp()+interval '15 seconds',updated_at=clock_timestamp() WHERE id=m.id RETURNING * INTO m;
   RETURN to_jsonb(m);
 END IF;
 IF p_operation='queue' THEN
   SELECT * INTO candidate FROM public.playground_challenges WHERE game=p_game AND mode='random' AND status='waiting' AND host_id<>p_user AND created_at>clock_timestamp()-interval '2 minutes' ORDER BY created_at LIMIT 1 FOR UPDATE;
   IF FOUND THEN
     UPDATE public.playground_challenges SET guest_id=p_user,status='ready',ready_deadline_at=clock_timestamp()+interval '15 seconds',updated_at=clock_timestamp() WHERE id=candidate.id RETURNING * INTO m;
     RETURN to_jsonb(m);
   END IF;
 END IF;
 IF p_operation='bot' THEN RAISE EXCEPTION 'queue_first'; END IF;
 v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 INSERT INTO public.playground_challenges(code,game,mode,host_id,state) VALUES(v_code,p_game,CASE WHEN p_operation='invite' THEN 'invite' ELSE 'random' END,p_user,p_state) RETURNING * INTO m;
 RETURN to_jsonb(m);
END $$;

CREATE OR REPLACE FUNCTION public.challenge_commit(p_id uuid,p_version integer,p_request uuid,p_state jsonb,p_status text,p_winner text DEFAULT NULL,p_void boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.playground_challenges; u uuid; d date; n integer; fee integer;
BEGIN
 SELECT * INTO m FROM public.playground_challenges WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF EXISTS(SELECT 1 FROM public.playground_challenge_requests WHERE match_id=p_id AND request_id=p_request) THEN RETURN to_jsonb(m); END IF;
 IF m.version<>p_version THEN RETURN jsonb_build_object('conflict',true); END IF;
 IF m.settled THEN RETURN to_jsonb(m); END IF;
 -- Match lock precedes wallet locks; UUID ordering agrees with other coin writers.
 PERFORM 1 FROM public.profiles WHERE id IN (m.host_id,m.guest_id) ORDER BY id FOR UPDATE;
 IF p_status='playing' AND NOT m.charged THEN
   d:=(COALESCE(to_timestamp((p_state#>>'{engine,startAt}')::double precision/1000),clock_timestamp()) AT TIME ZONE 'Asia/Shanghai')::date;
   IF m.mode='random' THEN
     FOR u IN SELECT id FROM public.profiles WHERE id IN(m.host_id,m.guest_id) ORDER BY id LOOP
       INSERT INTO public.playground_challenge_usage(user_id,game,day) VALUES(u,m.game,d) ON CONFLICT DO NOTHING;
       SELECT used INTO n FROM public.playground_challenge_usage WHERE user_id=u AND game=m.game AND day=d FOR UPDATE;
       IF n>=5 THEN RAISE EXCEPTION 'daily_limit'; END IF;
       UPDATE public.profiles SET coins=coins-2 WHERE id=u AND coins>=2;
       IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_coins'; END IF;
       UPDATE public.playground_challenge_usage SET used=used+1 WHERE user_id=u AND game=m.game AND day=d;
       INSERT INTO public.coin_logs(user_id,amount,action_type,resource_id) VALUES(u,-2,'playground_entry',p_id::text);
     END LOOP;
   END IF;
   m.charged:=true;m.quota_day:=d;
 END IF;
 IF p_status IN ('finished','cancelled') THEN
   IF m.charged AND m.mode='random' THEN
     FOR u IN SELECT id FROM public.profiles WHERE id IN(m.host_id,m.guest_id) ORDER BY id LOOP
       fee:=CASE WHEN p_void OR p_winner='draw' THEN 2 WHEN (u=m.host_id AND p_winner='host') OR (u=m.guest_id AND p_winner='guest') THEN 3 ELSE 0 END;
       IF fee>0 THEN
         UPDATE public.profiles SET coins=coins+fee WHERE id=u;
         INSERT INTO public.coin_logs(user_id,amount,action_type,resource_id) VALUES(u,fee,CASE WHEN p_void OR p_winner='draw' THEN 'playground_refund' ELSE 'playground_prize' END,p_id::text);
       END IF;
       IF p_void THEN UPDATE public.playground_challenge_usage SET used=greatest(0,used-1) WHERE user_id=u AND game=m.game AND day=m.quota_day; END IF;
     END LOOP;
     IF m.bot AND NOT p_void AND p_winner IN ('host','guest') THEN
       INSERT INTO public.playground_challenge_strength(user_id,game,strength) VALUES(m.host_id,m.game,greatest(0,least(100,40+CASE WHEN p_winner='host' THEN 8 ELSE -8 END)))
       ON CONFLICT(user_id,game) DO UPDATE SET strength=greatest(0,least(100,playground_challenge_strength.strength+CASE WHEN p_winner='host' THEN 8 ELSE -8 END));
     END IF;
   END IF;
   m.settled:=true;
 END IF;
 INSERT INTO public.playground_challenge_requests VALUES(p_id,p_request);
 UPDATE public.playground_challenges SET state=p_state,status=p_status,version=version+1,charged=m.charged,quota_day=m.quota_day,settled=m.settled,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO m;
 RETURN to_jsonb(m);
END $$;
REVOKE ALL ON FUNCTION public.challenge_lobby(uuid,text,text,text,jsonb),public.challenge_commit(uuid,integer,uuid,jsonb,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_lobby(uuid,text,text,text,jsonb),public.challenge_commit(uuid,integer,uuid,jsonb,text,text,boolean) TO service_role;
ALTER TABLE public.playground_challenges ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE public.playground_challenges ADD COLUMN IF NOT EXISTS lease_token uuid;
CREATE OR REPLACE FUNCTION public.challenge_lease(p_id uuid,p_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.playground_challenges;
BEGIN
 UPDATE public.playground_challenges SET lease_until=clock_timestamp()+interval '10 seconds',lease_token=p_token WHERE id=p_id AND (lease_until IS NULL OR lease_until<clock_timestamp()) AND status IN ('ready','playing') RETURNING * INTO m;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN to_jsonb(m);
END $$;
REVOKE ALL ON FUNCTION public.challenge_lease(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_lease(uuid,uuid) TO service_role;
