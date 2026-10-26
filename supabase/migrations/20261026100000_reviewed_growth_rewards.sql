-- Prospective rules only. Never backfill or subtract historical XP.
-- Run only via an explicitly approved release; this file does not authorize execution.
BEGIN;
CREATE TABLE public.growth_reward_epoch (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  starts_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.growth_reward_epoch DEFAULT VALUES;
ALTER TABLE public.growth_reward_epoch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.growth_reward_epoch FROM PUBLIC, anon, authenticated;

-- Membership is captured at INSERT, not from client-editable timestamps.
CREATE TABLE public.growth_reward_content (
 content_type text NOT NULL, content_id bigint NOT NULL,
 inserted_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(content_type,content_id)
);
ALTER TABLE public.growth_reward_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.growth_reward_content FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.register_growth_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.growth_reward_content(content_type,content_id) VALUES(TG_ARGV[0],NEW.id) ON CONFLICT DO NOTHING;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.register_growth_content() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER growth_register_completion AFTER INSERT ON public.completed_projects
 FOR EACH ROW EXECUTE FUNCTION public.register_growth_content('completion');
CREATE TRIGGER growth_register_comment AFTER INSERT ON public.completion_comments
 FOR EACH ROW EXECUTE FUNCTION public.register_growth_content('comment');

-- Durable audit/tombstones intentionally have no content FK: deleting/recreating
-- content must not erase stage claims, quotas, fingerprints or reversal history.
CREATE TABLE public.growth_reward_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('completion','comment')),
  content_id bigint NOT NULL,
  source_key text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('process','discovery','final','exchange','skip')),
  content_hash text NOT NULL,
  fingerprint text,
  snapshot jsonb NOT NULL,
  reviewer_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  xp integer NOT NULL CHECK (xp BETWEEN 0 AND 100),
  legacy_xp integer NOT NULL DEFAULT 0,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  reward_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai')::date,
  reward_week date NOT NULL DEFAULT date_trunc('week', now() AT TIME ZONE 'Asia/Shanghai')::date,
  revoked_at timestamptz,
  revoke_reason text
);
CREATE UNIQUE INDEX growth_stage_once ON public.growth_reward_reviews(user_id,source_key,stage)
 WHERE stage IN ('process','discovery','final');
CREATE UNIQUE INDEX growth_comment_once ON public.growth_reward_reviews(content_id)
 WHERE stage = 'exchange';
CREATE UNIQUE INDEX growth_comment_fingerprint ON public.growth_reward_reviews(user_id,fingerprint)
 WHERE stage = 'exchange';
CREATE UNIQUE INDEX growth_review_skip_once ON public.growth_reward_reviews(content_type,content_id,content_hash)
 WHERE stage = 'skip';
CREATE INDEX growth_daily_quota ON public.growth_reward_reviews(user_id,reward_day) WHERE stage='exchange';
CREATE INDEX growth_weekly_quota ON public.growth_reward_reviews(user_id,reward_week,source_key) WHERE stage='exchange';
CREATE INDEX growth_content_review ON public.growth_reward_reviews(content_type,content_id);
ALTER TABLE public.growth_reward_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.growth_reward_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.growth_reward_reviews TO authenticated;
CREATE POLICY growth_audit_read ON public.growth_reward_reviews FOR SELECT TO authenticated
 USING (user_id = auth.uid() OR public.is_moderator_or_admin());

-- Keep the existing count triggers, replace their bodies; old unlikes cannot debit XP.
CREATE OR REPLACE FUNCTION public.handle_new_completion_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.completed_projects SET likes_count=COALESCE(likes_count,0)+1 WHERE id=NEW.completed_project_id;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.handle_remove_completion_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.completed_projects SET likes_count=GREATEST(0,COALESCE(likes_count,0)-1) WHERE id=OLD.completed_project_id;
 RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS on_completion_comment_added ON public.completion_comments;
DROP TRIGGER IF EXISTS on_completion_comment_removed ON public.completion_comments;
DROP FUNCTION public.handle_new_completion_comment();
DROP FUNCTION public.handle_remove_completion_comment();
CREATE OR REPLACE FUNCTION public.daily_check_in()
RETURNS jsonb AS $$
DECLARE
  v_current_date date := (NOW() AT TIME ZONE 'Asia/Shanghai')::date;
  v_user_id uuid := auth.uid();
  user_last_check_in date;
  user_streak int;
  user_total_days int;
  xp_amount int;
  coins_amount int := 2;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT last_check_in, login_streak, total_login_days
  INTO user_last_check_in, user_streak, user_total_days
  FROM public.profiles
  WHERE id = v_user_id FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('error','profile_missing'); END IF;

  -- 今天已打卡，直接返回（幂等）
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

  -- 计算连续登录天数
  IF user_last_check_in = v_current_date - 1 THEN
    user_streak := COALESCE(user_streak, 0) + 1;
  ELSE
    user_streak := 1;
  END IF;

  user_total_days := COALESCE(user_total_days, 0) + 1;

  xp_amount := 3;

  BEGIN
    INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
    VALUES (v_user_id, 'daily_login', v_current_date::text, xp_amount);

    INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id)
    VALUES (v_user_id, coins_amount, 'daily_login', v_current_date::text);

    UPDATE public.profiles
    SET
      last_check_in = v_current_date,
      login_streak = user_streak,
      total_login_days = user_total_days,
      xp = COALESCE(xp,0) + xp_amount,
      level = floor(sqrt((COALESCE(xp,0)+xp_amount)::numeric/100))+1,
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
  EXCEPTION WHEN unique_violation THEN
    -- 并发调用时（StrictMode / 多标签页）拦截唯一键冲突，返回友好响应
    RETURN jsonb_build_object(
      'error', 'already_checked_in_conflict',
      'streak', user_streak,
      'total_days', user_total_days,
      'checked_in_today', true,
      'is_new_day', false,
      'xp_granted', 0,
      'coins_granted', 0
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
REVOKE ALL ON FUNCTION public.daily_check_in() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daily_check_in() TO authenticated;

CREATE OR REPLACE FUNCTION public._approve_completion_with_reward(
  p_completion_id bigint,
  p_reviewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_completion record;
  v_xp_awarded boolean := false;
BEGIN
  SELECT id, user_id, project_id, course_lesson_id, record_kind, status
  INTO v_completion
  FROM public.completed_projects
  WHERE id = p_completion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Completion % not found', p_completion_id;
  END IF;

  IF v_completion.status = 'rejected' THEN
    RAISE EXCEPTION 'Rejected completion % cannot be approved', p_completion_id;
  END IF;

  UPDATE public.completed_projects
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = now(),
      rejection_reason = NULL,
      moderation_source = CASE
        WHEN p_reviewer_id IS NULL THEN COALESCE(moderation_source, 'ai')
        ELSE moderation_source
      END
  WHERE id = p_completion_id;

  RETURN jsonb_build_object(
    'completion_id', p_completion_id,
    'status', 'approved',
    'xp_awarded', v_xp_awarded,
    'record_kind', COALESCE(v_completion.record_kind, 'final')
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.award_xp_once(
  p_user_id uuid,
  p_action_type text,
  p_resource_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  award_amount integer;
  inserted_amount integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'award_xp_once is service-role only';
  END IF;

  IF p_user_id IS NULL OR NULLIF(btrim(p_resource_id), '') IS NULL THEN
    RAISE EXCEPTION 'Award user and resource are required';
  END IF;

  IF p_action_type IN ('like_project', 'comment_project', 'weekly_goal_comments_5', 'complete_project', 'publish_course_work') THEN
    RETURN 0; -- retired paths must never supplement reviewed growth rewards
  END IF;

  award_amount := CASE p_action_type
    WHEN 'publish_project' THEN 50
    WHEN 'join_challenge' THEN 10
    WHEN 'submit_observation' THEN 10
    WHEN 'complete_challenge' THEN 20
    WHEN 'challenge_participation' THEN 20
    ELSE NULL
  END;

  IF award_amount IS NULL THEN
    RAISE EXCEPTION 'Unsupported XP action: %', p_action_type;
  END IF;

  PERFORM 1
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile for user % not found', p_user_id;
  END IF;


  INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
  VALUES (p_user_id, p_action_type, btrim(p_resource_id), award_amount)
  ON CONFLICT (user_id, action_type, resource_id) DO NOTHING
  RETURNING xp_amount INTO inserted_amount;

  IF inserted_amount IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + inserted_amount
  WHERE id = p_user_id;

  RETURN inserted_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.award_xp_once(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp_once(uuid, text, text) TO service_role;


-- Automatic safety approval no longer implies educational value. Legacy repair
-- is disabled to prevent historical or concurrent +20 awards after this cutover.
CREATE OR REPLACE FUNCTION public.repair_completion_rewards(p_apply boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service-role only'; END IF;
 IF p_apply THEN RAISE EXCEPTION 'Legacy reward repair retired; use human growth review'; END IF;
 RETURN jsonb_build_object('dry_run',true,'candidates',0,'applied',0,'retired',true);
END; $$;

REVOKE ALL ON FUNCTION public._approve_completion_with_reward(bigint,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.repair_completion_rewards(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.repair_completion_rewards(boolean) TO service_role;

-- Stable review material, excluding volatile like counts and safety metadata.
CREATE FUNCTION public.growth_evidence(p_type text, p_id bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p_type='completion' THEN (
 SELECT jsonb_build_object('user_id',user_id,'project_id',project_id,'course_lesson_id',course_lesson_id,
 'notes',notes,'proof_images',proof_images,'proof_captions',proof_captions,'proof_video_url',proof_video_url)
 FROM public.completed_projects WHERE id=p_id
 ) WHEN p_type='comment' THEN (
 SELECT jsonb_build_object('author_id',author_id,'completed_project_id',completed_project_id,
 'content',content,'parent_id',parent_id,'reply_to_user_id',reply_to_user_id)
 FROM public.completion_comments WHERE id=p_id) END;
$$;
REVOKE ALL ON FUNCTION public.growth_evidence(text,bigint) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.review_growth_reward(p_type text,p_id bigint,p_stages text[],p_hash text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 c record; w record; s text; evidence jsonb; source text; owner_id uuid; amount integer;
 legacy integer:=0; used integer:=0; awarded integer:=0; review_id bigint; fp text;
 day_key date := (now() AT TIME ZONE 'Asia/Shanghai')::date;
 week_key date := date_trunc('week',now() AT TIME ZONE 'Asia/Shanghai')::date;
 prior_review record;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.is_moderator_or_admin(),false) THEN RAISE EXCEPTION 'Moderator required'; END IF;
 IF p_type NOT IN ('completion','comment') OR p_type IS NULL OR p_stages IS NULL OR cardinality(p_stages)=0
 OR length(btrim(COALESCE(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Review evidence and stages required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.growth_reward_content WHERE content_type=p_type AND content_id=p_id) THEN RAISE EXCEPTION 'Historical content is not eligible'; END IF;
 IF p_type='completion' THEN
   SELECT * INTO c FROM public.completed_projects WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Content missing'; END IF;
   IF c.status <> 'approved' OR c.moderation_state IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'New approved content required'; END IF;
   owner_id:=c.user_id;
   -- A course work can carry a project link; the lesson is its canonical source.
   source:=CASE WHEN c.course_lesson_id IS NOT NULL THEN 'lesson:'||c.course_lesson_id
     WHEN c.project_id IS NOT NULL THEN 'project:'||c.project_id END;
   IF source IS NULL OR NOT (p_stages <@ ARRAY['process','discovery','final','skip']) THEN RAISE EXCEPTION 'Invalid source or stages'; END IF;
 ELSE
   SELECT * INTO c FROM public.completion_comments WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Content missing'; END IF;
   IF c.moderation_state IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'New approved content required'; END IF;
   SELECT * INTO w FROM public.completed_projects WHERE id=c.completed_project_id;
   IF NOT FOUND OR w.status <> 'approved' OR w.moderation_state IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'Work not approved'; END IF;
   owner_id:=c.author_id; source:='work:'||c.completed_project_id;
   IF NOT (p_stages <@ ARRAY['exchange','skip']) THEN RAISE EXCEPTION 'Invalid stages'; END IF;
   -- Validate the real parent, never trust a client-supplied reply target.
   IF c.parent_id IS NOT NULL THEN
     IF NOT EXISTS (SELECT 1 FROM public.completion_comments parent WHERE parent.id=c.parent_id
       AND parent.completed_project_id=c.completed_project_id AND parent.author_id<>owner_id
       AND parent.author_id=c.reply_to_user_id AND parent.moderation_state='approved') THEN
       RAISE EXCEPTION 'Self reply or invalid parent'; END IF;
   ELSIF w.user_id=owner_id THEN RAISE EXCEPTION 'Self conversation'; END IF;
   fp:=md5(regexp_replace(lower(btrim(c.content)),'[[:space:]]+','','g'));
 END IF;
 IF owner_id=auth.uid() THEN RAISE EXCEPTION 'Cannot review own rewards'; END IF;
 -- Serialize all awards/quota checks for one recipient across different content rows.
 PERFORM 1 FROM public.profiles WHERE id=owner_id AND NOT COALESCE(is_auto_interaction_account,false) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing or automated account'; END IF;
 evidence:=public.growth_evidence(p_type,p_id);
 IF md5(evidence::text) IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'Content changed; reload review'; END IF;
 IF 'skip'=ANY(p_stages) AND cardinality(p_stages)<>1 THEN RAISE EXCEPTION 'Skip must stand alone'; END IF;
 -- A later human value rejection revokes an earlier grant even if the text is safe.
 IF p_stages=ARRAY['skip'] THEN
   FOR prior_review IN SELECT * FROM public.growth_reward_reviews WHERE content_type=p_type AND content_id=p_id
     AND revoked_at IS NULL AND xp>0 ORDER BY id FOR UPDATE LOOP
     UPDATE public.growth_reward_reviews SET revoked_at=now(),revoke_reason=btrim(p_reason) WHERE id=prior_review.id;
     INSERT INTO public.xp_logs(user_id,action_type,resource_id,xp_amount)
       VALUES(owner_id,'growth_revoke',prior_review.id::text,-prior_review.xp);
     UPDATE public.profiles SET xp=GREATEST(0,COALESCE(xp,0)-prior_review.xp),
       level=floor(sqrt(GREATEST(0,COALESCE(xp,0)-prior_review.xp)::numeric/100))+1 WHERE id=owner_id;
     awarded:=awarded-prior_review.xp;
   END LOOP;
 END IF;
 IF p_type='completion' THEN
   SELECT COALESCE(sum(GREATEST(xp_amount,0)),0) INTO legacy FROM public.xp_logs
   WHERE user_id=owner_id AND ((c.course_lesson_id IS NOT NULL AND resource_id=c.course_lesson_id::text AND action_type IN ('publish_course_work','complete_lesson'))
   OR (c.course_lesson_id IS NULL AND resource_id=c.project_id::text AND action_type='complete_project'));
   SELECT COALESCE(sum(xp),0) INTO used FROM public.growth_reward_reviews WHERE user_id=owner_id AND source_key=source AND stage IN ('process','discovery','final');
 END IF;
 FOREACH s IN ARRAY p_stages LOOP
   amount:=CASE s WHEN 'process' THEN 40 WHEN 'discovery' THEN 60 WHEN 'final' THEN 100 WHEN 'exchange' THEN 5 ELSE 0 END;
   IF s='exchange' THEN
     IF EXISTS (SELECT 1 FROM public.growth_reward_reviews WHERE user_id=owner_id AND stage='exchange' AND
         (reward_day=day_key OR (reward_week=week_key AND source_key=source) OR fingerprint=fp OR content_id=p_id))
       OR (SELECT count(*) FROM public.growth_reward_reviews WHERE user_id=owner_id AND stage='exchange' AND reward_week=week_key)>=4 THEN CONTINUE; END IF;
   ELSIF s<>'skip' THEN
     -- Historical final XP consumes the final stage; never top up or regrant it.
     IF s='final' AND EXISTS (SELECT 1 FROM public.xp_logs WHERE user_id=owner_id
       AND resource_id=CASE WHEN c.course_lesson_id IS NOT NULL THEN c.course_lesson_id::text ELSE c.project_id::text END
       AND action_type=CASE WHEN c.course_lesson_id IS NOT NULL THEN 'publish_course_work' ELSE 'complete_project' END) THEN amount:=0;
     ELSE amount:=LEAST(amount,GREATEST(0,200-legacy-used)); END IF;
   END IF;
   review_id:=NULL;
   INSERT INTO public.growth_reward_reviews(user_id,content_type,content_id,source_key,stage,content_hash,fingerprint,snapshot,reviewer_id,reason,xp,legacy_xp)
   VALUES(owner_id,p_type,p_id,source,s,p_hash,fp,evidence,auth.uid(),btrim(p_reason),amount,legacy)
   ON CONFLICT DO NOTHING RETURNING id INTO review_id;
   IF review_id IS NOT NULL THEN
     IF amount>0 THEN
       INSERT INTO public.xp_logs(user_id,action_type,resource_id,xp_amount) VALUES(owner_id,'growth_'||s,review_id::text,amount);
       UPDATE public.profiles SET xp=COALESCE(xp,0)+amount,
       level=floor(sqrt((COALESCE(xp,0)+amount)::numeric/100))+1 WHERE id=owner_id;
     END IF;
     awarded:=awarded+amount; used:=used+amount;
   END IF;
 END LOOP;
 RETURN jsonb_build_object('xp_awarded',awarded);
END; $$;
REVOKE ALL ON FUNCTION public.review_growth_reward(text,bigint,text[],text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.review_growth_reward(text,bigint,text[],text,text) TO authenticated;

-- Edits, invalidation and deletion revoke ONLY the new audited reward, once.
-- Claims and quota slots stay spent, so delete/recreate and reapproval cannot farm XP.
CREATE FUNCTION public.revoke_growth_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE typ text:=TG_ARGV[0]; r record; invalid boolean:=TG_OP='DELETE';
BEGIN
 IF TG_OP='UPDATE' THEN
   IF typ='comment' THEN
     invalid:=NEW.moderation_state IS DISTINCT FROM 'approved' OR
       (to_jsonb(NEW)-ARRAY['moderation_state','moderation_reason','moderation_source','reviewed_at','reviewed_by','updated_at']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['moderation_state','moderation_reason','moderation_source','reviewed_at','reviewed_by','updated_at']);
   ELSE
     invalid:=NEW.status<>'approved' OR NEW.moderation_state IS DISTINCT FROM 'approved' OR
       ROW(NEW.user_id,NEW.project_id,NEW.course_lesson_id,NEW.notes,NEW.proof_images,NEW.proof_captions,NEW.proof_video_url)
       IS DISTINCT FROM ROW(OLD.user_id,OLD.project_id,OLD.course_lesson_id,OLD.notes,OLD.proof_images,OLD.proof_captions,OLD.proof_video_url);
   END IF;
 END IF;
 IF invalid THEN
   -- Same lock order as review: content -> recipient -> audit rows.
   PERFORM 1 FROM public.profiles WHERE id=(CASE WHEN typ='comment' THEN to_jsonb(OLD)->>'author_id' ELSE to_jsonb(OLD)->>'user_id' END)::uuid FOR UPDATE;
   FOR r IN SELECT * FROM public.growth_reward_reviews WHERE content_type=typ AND content_id=OLD.id AND revoked_at IS NULL ORDER BY user_id,id FOR UPDATE LOOP
     UPDATE public.growth_reward_reviews SET revoked_at=now(),revoke_reason=TG_OP||': content removed, changed or no longer approved' WHERE id=r.id;
     IF r.xp>0 THEN
       INSERT INTO public.xp_logs(user_id,action_type,resource_id,xp_amount) VALUES(r.user_id,'growth_revoke',r.id::text,-r.xp);
       UPDATE public.profiles SET xp=GREATEST(0,COALESCE(xp,0)-r.xp),level=floor(sqrt(GREATEST(0,COALESCE(xp,0)-r.xp)::numeric/100))+1 WHERE id=r.user_id;
     END IF;
   END LOOP;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.revoke_growth_content() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER growth_comment_revoke AFTER UPDATE OR DELETE ON public.completion_comments
 FOR EACH ROW EXECUTE FUNCTION public.revoke_growth_content('comment');
CREATE TRIGGER growth_completion_revoke AFTER UPDATE OR DELETE ON public.completed_projects
 FOR EACH ROW EXECUTE FUNCTION public.revoke_growth_content('completion');

CREATE FUNCTION public.growth_review_queue(p_type text,p_before bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.is_moderator_or_admin(),false) THEN RAISE EXCEPTION 'Moderator required'; END IF;
 IF p_type NOT IN ('completion','comment') OR p_type IS NULL THEN RAISE EXCEPTION 'Invalid type'; END IF;
 SELECT COALESCE(jsonb_agg(row_data ORDER BY id DESC),'[]'::jsonb) INTO result FROM (
   SELECT x.id,jsonb_build_object('id',x.id,'type',p_type,'evidence',e.evidence,'hash',md5(e.evidence::text),
    'context',CASE WHEN p_type='comment' THEN (SELECT jsonb_build_object('work',public.growth_evidence('completion',cc.completed_project_id),'parent',public.growth_evidence('comment',cc.parent_id)) FROM public.completion_comments cc WHERE cc.id=x.id) END,
    'reviews',(SELECT COALESCE(jsonb_agg(jsonb_build_object('stage',stage,'xp',xp,'reason',reason,'revoked_at',revoked_at)),'[]'::jsonb)
       FROM public.growth_reward_reviews WHERE content_type=p_type AND content_id=x.id)) row_data
   FROM (
     SELECT id FROM public.completed_projects WHERE p_type='completion' AND status='approved' AND moderation_state='approved'
       AND EXISTS (SELECT 1 FROM public.growth_reward_content g WHERE g.content_type='completion' AND g.content_id=completed_projects.id)
     UNION ALL
     SELECT id FROM public.completion_comments WHERE p_type='comment' AND moderation_state='approved'
       AND EXISTS (SELECT 1 FROM public.growth_reward_content g WHERE g.content_type='comment' AND g.content_id=completion_comments.id)
   ) x CROSS JOIN LATERAL (SELECT public.growth_evidence(p_type,x.id) evidence) e
   WHERE (p_before IS NULL OR x.id<p_before)
   ORDER BY x.id DESC LIMIT 30
 ) q;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.growth_review_queue(text,bigint) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.growth_review_queue(text,bigint) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
