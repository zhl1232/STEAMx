-- Paired with reviewed_growth_rewards. No migration execution is authorized here.
BEGIN;
CREATE TABLE public.growth_ai_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_type text NOT NULL,
 content_id bigint NOT NULL, user_id uuid NOT NULL, context_hash text NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','done','manual','stale')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 lease uuid, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz, decision jsonb, usage jsonb, model text, error text,
 prompt_version text NOT NULL DEFAULT 'growth-v1',
 UNIQUE(content_type,content_id,context_hash)
);
CREATE INDEX growth_ai_due ON public.growth_ai_jobs(available_at) WHERE state IN ('queued','running');
CREATE TABLE public.growth_ai_runs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, job_id uuid NOT NULL REFERENCES public.growth_ai_jobs,
 user_id uuid NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), usage jsonb, error text
);
CREATE INDEX growth_ai_daily_runs ON public.growth_ai_runs(started_at,user_id);
ALTER TABLE public.growth_ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_ai_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.growth_ai_jobs, public.growth_ai_runs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.growth_ai_jobs TO authenticated;
CREATE POLICY growth_ai_owner_read ON public.growth_ai_jobs FOR SELECT TO authenticated USING(public.is_moderator_or_admin());

CREATE FUNCTION public.growth_ai_context(p_type text,p_id bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE e jsonb; background jsonb; history jsonb; parent jsonb; version integer;
BEGIN
 e:=public.growth_evidence(p_type,p_id);
 IF e IS NULL THEN RETURN NULL; END IF;
 SELECT g.version INTO version FROM public.growth_reward_content g WHERE g.content_type=p_type AND g.content_id=p_id;
 IF version IS NULL THEN RETURN NULL; END IF;
 IF p_type='comment' THEN
   SELECT public.growth_evidence('completion',c.completed_project_id) INTO background FROM public.completion_comments c WHERE id=p_id;
   parent:=public.growth_evidence('comment',(e->>'parent_id')::bigint);
 ELSIF p_type='project_comment' THEN
   SELECT jsonb_build_object('title',title,'description',left(description,1200),'steps',(SELECT COALESCE(jsonb_agg(jsonb_build_object('title',s.title,'description',left(s.description,400))),'[]') FROM (SELECT title,description FROM public.project_steps WHERE project_id=(e->>'project_id')::bigint ORDER BY sort_order,id LIMIT 6) s)) INTO background FROM public.projects WHERE id=(e->>'project_id')::bigint;
   parent:=public.growth_evidence('project_comment',(e->>'parent_id')::bigint);
 ELSE
   IF e->>'project_id' IS NOT NULL THEN
     SELECT jsonb_build_object('title',title,'description',left(description,1200)) INTO background FROM public.projects WHERE id=(e->>'project_id')::bigint;
   END IF;
   SELECT COALESCE(jsonb_agg(jsonb_build_object('id',h.id,'notes',left(h.notes,1200))),'[]') INTO history FROM (
     SELECT id,notes FROM public.completed_projects WHERE user_id=(e->>'user_id')::uuid AND id<>p_id AND status='approved' AND moderation_state='approved'
     AND ((e->>'course_lesson_id' IS NOT NULL AND course_lesson_id::text=e->>'course_lesson_id') OR (e->>'course_lesson_id' IS NULL AND project_id::text=e->>'project_id'))
     ORDER BY id DESC LIMIT 3) h;
 END IF;
 IF p_type IN ('comment','project_comment') THEN
   SELECT COALESCE(jsonb_agg(jsonb_build_object('content',left(h.content,1200),'created_at',h.created_at)),'[]') INTO history FROM (
     SELECT content,created_at FROM (
       SELECT content,created_at FROM public.completion_comments WHERE author_id=(e->>'author_id')::uuid AND moderation_state='approved' AND NOT(p_type='comment' AND id=p_id)
       UNION ALL SELECT content,created_at FROM public.comments WHERE author_id=(e->>'author_id')::uuid AND moderation_state='approved' AND NOT(p_type='project_comment' AND id=p_id)
     ) recent ORDER BY created_at DESC LIMIT 6
   ) h;
 END IF;
 RETURN jsonb_build_object('type',p_type,'version',version,'evidence',e,'background',background,'parent',parent,'history',history,
 'reviewed_duplicate',p_type<>'completion' AND EXISTS(SELECT 1 FROM public.growth_reward_fingerprints f JOIN public.growth_reward_reviews r ON r.id=f.review_id
 WHERE f.user_id=(e->>'author_id')::uuid AND f.fingerprint=md5(regexp_replace(lower(btrim(e->>'content')),'[[:space:]]+','','g')) AND r.revoked_at IS NULL AND NOT(r.content_type=p_type AND r.content_id=p_id)));

END; $$;
REVOKE ALL ON FUNCTION public.growth_ai_context(text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.growth_ai_context(text,bigint) TO service_role;

-- Direct clients cannot publish their own new/edited exchange by claiming approval.
CREATE FUNCTION public.guard_growth_exchange_safety() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='comments' AND NOT (to_jsonb(NEW)->>'is_project_question')::boolean THEN RETURN NEW; END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' AND NOT COALESCE(public.is_moderator_or_admin(),false) THEN
   IF TG_OP='INSERT' THEN NEW.moderation_state:='pending';
   ELSIF NEW.content IS DISTINCT FROM OLD.content OR to_jsonb(NEW)->>'image_url' IS DISTINCT FROM to_jsonb(OLD)->>'image_url' THEN NEW.moderation_state:='pending';
   ELSIF NEW.moderation_state IS DISTINCT FROM OLD.moderation_state THEN RAISE EXCEPTION 'Safety reviewer required'; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_growth_exchange_safety() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER growth_exchange_safety BEFORE INSERT OR UPDATE ON public.completion_comments FOR EACH ROW EXECUTE FUNCTION public.guard_growth_exchange_safety();
CREATE TRIGGER growth_exchange_safety BEFORE INSERT OR UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.guard_growth_exchange_safety();

CREATE FUNCTION public.enqueue_growth_ai() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE typ text:=TG_ARGV[0]; ctx jsonb; owner_id uuid;
BEGIN
 IF typ='project_comment' AND NOT (to_jsonb(NEW)->>'is_project_question')::boolean THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
   IF typ='completion' THEN
     IF ROW(NEW.notes,NEW.proof_images,NEW.proof_captions,NEW.proof_video_url,NEW.status,NEW.moderation_state)
       IS NOT DISTINCT FROM ROW(OLD.notes,OLD.proof_images,OLD.proof_captions,OLD.proof_video_url,OLD.status,OLD.moderation_state) THEN RETURN NEW; END IF;
   ELSE
     IF NEW.content IS NOT DISTINCT FROM OLD.content AND to_jsonb(NEW)->>'image_url' IS NOT DISTINCT FROM to_jsonb(OLD)->>'image_url' THEN RETURN NEW; END IF;
   END IF;
 END IF;
 IF typ='completion' AND ((to_jsonb(NEW)->>'status')<>'approved' OR NEW.moderation_state<>'approved') THEN RETURN NEW; END IF;
 ctx:=public.growth_ai_context(typ,NEW.id);
 IF ctx IS NULL THEN RETURN NEW; END IF;
 owner_id:=COALESCE(ctx->'evidence'->>'user_id',ctx->'evidence'->>'author_id')::uuid;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=owner_id AND is_auto_interaction_account) THEN RETURN NEW; END IF;
 INSERT INTO public.growth_ai_jobs(content_type,content_id,user_id,context_hash)
 VALUES(typ,NEW.id,owner_id,md5(ctx::text)) ON CONFLICT DO NOTHING;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_growth_ai() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_growth_ai_completion AFTER INSERT OR UPDATE ON public.completed_projects FOR EACH ROW EXECUTE FUNCTION public.enqueue_growth_ai('completion');
CREATE TRIGGER zz_growth_ai_comment AFTER INSERT OR UPDATE ON public.completion_comments FOR EACH ROW EXECUTE FUNCTION public.enqueue_growth_ai('comment');
CREATE TRIGGER zz_growth_ai_question AFTER INSERT OR UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.enqueue_growth_ai('project_comment');

-- Reopened dependencies enqueue a new version; original ledger identity/day remains.
CREATE FUNCTION public.requeue_growth_dependents() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE typ text:=TG_ARGV[0]; child record; ctx jsonb;
BEGIN
 IF NEW.moderation_state IS DISTINCT FROM 'approved' OR OLD.moderation_state IS NOT DISTINCT FROM 'approved' THEN RETURN NEW; END IF;
 FOR child IN
  SELECT 'comment' AS kind,c.id,c.author_id FROM public.completion_comments c WHERE c.moderation_state='approved' AND ((typ='completion' AND c.completed_project_id=NEW.id) OR (typ='comment' AND c.parent_id=NEW.id))
  UNION ALL SELECT 'project_comment',c.id,c.author_id FROM public.comments c WHERE c.is_project_question AND c.moderation_state='approved' AND ((typ='project' AND c.project_id=NEW.id) OR (typ='project_comment' AND c.parent_id=NEW.id))
 LOOP
   ctx:=public.growth_ai_context(child.kind,child.id);
   IF ctx IS NOT NULL THEN INSERT INTO public.growth_ai_jobs(content_type,content_id,user_id,context_hash) VALUES(child.kind,child.id,child.author_id,md5(ctx::text)) ON CONFLICT DO NOTHING; END IF;
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.requeue_growth_dependents() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_growth_dependency AFTER UPDATE ON public.completed_projects FOR EACH ROW EXECUTE FUNCTION public.requeue_growth_dependents('completion');
CREATE TRIGGER zz_growth_dependency AFTER UPDATE ON public.completion_comments FOR EACH ROW EXECUTE FUNCTION public.requeue_growth_dependents('comment');
CREATE TRIGGER zz_growth_dependency AFTER UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.requeue_growth_dependents('project');
CREATE TRIGGER zz_growth_dependency AFTER UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.requeue_growth_dependents('project_comment');

-- Each admitted job attempt permits at most two physical provider calls, enforced
-- by the server usageObserver. Hard admission limits are not a monetary budget.
CREATE FUNCTION public.claim_growth_ai_job() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.growth_ai_jobs%ROWTYPE; ctx jsonb; token uuid:=gen_random_uuid(); run_id bigint; today timestamptz:=date_trunc('day',now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai';
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
 PERFORM 1 FROM public.growth_reward_epoch FOR UPDATE;
 UPDATE public.growth_ai_jobs SET state='manual',error='retry_limit_after_expired_lease' WHERE state='running' AND lease_until<now() AND attempts>=3;
 SELECT * INTO j FROM public.growth_ai_jobs WHERE attempts<3 AND available_at<=now() AND (state='queued' OR (state='running' AND lease_until<now())) ORDER BY available_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF (j.content_type='completion' AND EXISTS(SELECT 1 FROM public.completed_projects WHERE id=j.content_id AND (status<>'approved' OR moderation_state<>'approved')))
 OR (j.content_type='comment' AND EXISTS(SELECT 1 FROM public.completion_comments WHERE id=j.content_id AND moderation_state IN ('hidden','rejected')))
 OR (j.content_type='project_comment' AND EXISTS(SELECT 1 FROM public.comments WHERE id=j.content_id AND moderation_state IN ('hidden','rejected'))) THEN
 UPDATE public.growth_ai_jobs SET state='manual',error='safety_review_required' WHERE id=j.id; RETURN NULL; END IF;
 ctx:=public.growth_ai_context(j.content_type,j.content_id);
 IF ctx IS NULL OR md5(ctx::text)<>j.context_hash THEN UPDATE public.growth_ai_jobs SET state='stale' WHERE id=j.id; IF ctx IS NOT NULL THEN INSERT INTO public.growth_ai_jobs(content_type,content_id,user_id,context_hash) VALUES(j.content_type,j.content_id,j.user_id,md5(ctx::text)) ON CONFLICT DO NOTHING; END IF; RETURN NULL; END IF;
 IF (SELECT count(*) FROM public.growth_ai_runs WHERE started_at>=today)>=200 OR
    (SELECT count(*) FROM public.growth_ai_runs WHERE user_id=j.user_id AND started_at>=today)>=8 THEN
    UPDATE public.growth_ai_jobs SET state='manual',error='daily_ai_admission_limit' WHERE id=j.id; RETURN NULL; END IF;
 INSERT INTO public.growth_ai_runs(job_id,user_id) VALUES(j.id,j.user_id) RETURNING id INTO run_id;
 UPDATE public.growth_ai_jobs SET state='running',attempts=attempts+1,lease=token,lease_until=now()+interval '60 seconds' WHERE id=j.id;
 RETURN jsonb_build_object('id',j.id,'lease',token,'run_id',run_id,'type',j.content_type,'content_id',j.content_id,'context',ctx);
END; $$;
REVOKE ALL ON FUNCTION public.claim_growth_ai_job() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_growth_ai_job() TO service_role;

CREATE FUNCTION public.finish_growth_ai_job(p_job uuid,p_lease uuid,p_decision jsonb,p_usage jsonb,p_model text,p_error text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.growth_ai_jobs%ROWTYPE; ctx jsonb; result jsonb:='{}'; stages text[]; safety text; quality text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
 SELECT * INTO j FROM public.growth_ai_jobs WHERE id=p_job AND lease=p_lease AND state='running' AND lease_until>=now() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','lease_expired'); END IF;
 -- Lock dependencies in the same order as award and mutation paths.
 IF j.content_type='completion' THEN PERFORM 1 FROM public.completed_projects WHERE id=j.content_id FOR UPDATE;
 ELSIF j.content_type='comment' THEN
   PERFORM 1 FROM public.completed_projects WHERE id=(SELECT completed_project_id FROM public.completion_comments WHERE id=j.content_id) FOR SHARE;
   PERFORM 1 FROM public.completion_comments WHERE id=(SELECT parent_id FROM public.completion_comments WHERE id=j.content_id) FOR SHARE;
   PERFORM 1 FROM public.completion_comments WHERE id=j.content_id FOR UPDATE;
 ELSE
   PERFORM 1 FROM public.projects WHERE id=(SELECT project_id FROM public.comments WHERE id=j.content_id) FOR SHARE;
   PERFORM 1 FROM public.comments WHERE id=(SELECT parent_id FROM public.comments WHERE id=j.content_id) FOR SHARE;
   PERFORM 1 FROM public.comments WHERE id=j.content_id FOR UPDATE;
 END IF;
 ctx:=public.growth_ai_context(j.content_type,j.content_id);
 UPDATE public.growth_ai_runs SET usage=p_usage,error=left(p_error,300) WHERE id=(SELECT max(id) FROM public.growth_ai_runs WHERE job_id=p_job);
 IF ctx IS NULL OR md5(ctx::text)<>j.context_hash THEN UPDATE public.growth_ai_jobs SET state='stale',usage=p_usage,model=p_model WHERE id=j.id; IF ctx IS NOT NULL THEN INSERT INTO public.growth_ai_jobs(content_type,content_id,user_id,context_hash) VALUES(j.content_type,j.content_id,j.user_id,md5(ctx::text)) ON CONFLICT DO NOTHING; END IF; RETURN jsonb_build_object('state','stale'); END IF;
 IF p_error IS NOT NULL THEN
   UPDATE public.growth_ai_jobs SET state=CASE WHEN attempts>=3 THEN 'manual' ELSE 'queued' END,available_at=now()+interval '5 minutes',error=left(p_error,300),usage=p_usage,model=p_model WHERE id=j.id;
   RETURN jsonb_build_object('state','retry_or_manual');
 END IF;
 safety:=p_decision->>'safety'; quality:=p_decision->>'quality';
 IF safety IS NULL OR quality IS NULL OR p_decision->'stages' IS NULL OR safety NOT IN ('allow','reject','uncertain') OR quality NOT IN ('eligible','ineligible','uncertain') OR jsonb_typeof(p_decision->'stages')<>'array' OR length(COALESCE(p_decision->>'reason',''))=0 THEN RAISE EXCEPTION 'Invalid AI decision'; END IF;
 SELECT COALESCE(array_agg(value),'{}') INTO stages FROM jsonb_array_elements_text(p_decision->'stages');
 IF j.content_type='completion' AND NOT(stages <@ ARRAY['process','discovery','final']) OR j.content_type<>'completion' AND NOT(stages <@ ARRAY['exchange']) THEN RAISE EXCEPTION 'Invalid AI stages'; END IF;
 -- Human decisions made after this job was queued take precedence.
 IF EXISTS(SELECT 1 FROM public.growth_reward_events e JOIN public.growth_reward_reviews r ON r.id=e.review_id WHERE r.content_type=j.content_type AND e.content_id=j.content_id AND e.actor_kind='human' AND e.reviewer_id IS NOT NULL AND e.created_at>=j.created_at) OR EXISTS(SELECT 1 FROM public.growth_quality WHERE content_type=j.content_type AND content_id=j.content_id AND actor_kind='human' AND reviewed_at>=j.created_at) THEN
   UPDATE public.growth_ai_jobs SET state='manual',error='human_review_precedence',usage=p_usage,model=p_model WHERE id=j.id; RETURN jsonb_build_object('state','manual'); END IF;
 IF j.content_type='comment' THEN UPDATE public.completion_comments SET moderation_state=CASE safety WHEN 'allow' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'pending' END WHERE id=j.content_id;
 ELSIF j.content_type='project_comment' THEN UPDATE public.comments SET moderation_state=CASE safety WHEN 'allow' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'pending' END WHERE id=j.content_id;
 ELSIF safety<>'allow' THEN UPDATE public.completed_projects SET moderation_state=CASE safety WHEN 'reject' THEN 'rejected' ELSE 'pending' END WHERE id=j.content_id;
 END IF;
 IF quality='eligible' AND j.content_type<>'completion' AND (
   EXISTS(SELECT 1 FROM public.profiles WHERE id=j.user_id AND is_auto_interaction_account)
   OR (ctx->'parent'->>'author_id')::uuid=j.user_id
   OR (j.content_type='comment' AND ctx->'evidence'->>'parent_id' IS NULL AND (ctx->'background'->>'user_id')::uuid=j.user_id)
 ) THEN quality:='ineligible'; stages:='{}'; p_decision:=p_decision||jsonb_build_object('quality','ineligible','stages','[]'::jsonb,'reason_code','none','reason','Server rule: self conversation or automated account'); END IF;
 IF safety='allow' AND quality IN ('eligible','ineligible') THEN
   result:=public._review_growth_reward(j.content_type,j.content_id,CASE WHEN quality='eligible' AND cardinality(stages)>0 THEN stages ELSE ARRAY['skip'] END,
      md5(public.growth_evidence(j.content_type,j.content_id)::text),left(p_decision->>'reason',1000),true,j.id,p_decision->>'reason_code');
 END IF;
 UPDATE public.growth_ai_jobs SET state=CASE WHEN safety='uncertain' OR quality='uncertain' THEN 'manual' ELSE 'done' END,decision=p_decision,usage=p_usage,model=p_model,completed_at=now(),error=NULL WHERE id=j.id;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.finish_growth_ai_job(uuid,uuid,jsonb,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_growth_ai_job(uuid,uuid,jsonb,jsonb,text,text) TO service_role;

CREATE FUNCTION public.growth_exchange_feedback(p_type text,p_ids bigint[]) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_type NOT IN ('comment','project_comment') OR cardinality(p_ids)>200 THEN RAISE EXCEPTION 'Invalid feedback request'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',q.content_id,'qualified',q.qualified,'award_event',ev.id,'xp',COALESCE(ev.xp_delta,0))),'[]') INTO result
 FROM public.growth_quality q JOIN public.growth_reward_content g ON g.content_type=q.content_type AND g.content_id=q.content_id AND g.version=q.version
 LEFT JOIN LATERAL (SELECT e.id,e.xp_delta FROM public.growth_reward_reviews r JOIN public.growth_reward_events e ON e.review_id=r.id AND e.revision=r.revision
   WHERE r.content_type=q.content_type AND COALESCE(r.active_content_id,r.content_id)=q.content_id AND r.user_id=auth.uid() AND r.revoked_at IS NULL AND e.event_type IN ('award','restore') AND e.xp_delta>0 ORDER BY e.id DESC LIMIT 1) ev ON true
 WHERE q.content_type=p_type AND q.content_id=ANY(p_ids) AND q.qualified
 AND ((p_type='comment' AND EXISTS(SELECT 1 FROM public.completion_comments c JOIN public.completed_projects w ON w.id=c.completed_project_id WHERE c.id=q.content_id AND c.moderation_state='approved' AND w.status='approved' AND w.moderation_state='approved' AND (w.is_public OR w.user_id=auth.uid() OR public.is_moderator_or_admin()) AND (c.parent_id IS NULL OR EXISTS(SELECT 1 FROM public.completion_comments parent WHERE parent.id=c.parent_id AND parent.moderation_state='approved'))))
 OR (p_type='project_comment' AND EXISTS(SELECT 1 FROM public.comments c JOIN public.projects p ON p.id=c.project_id WHERE c.id=q.content_id AND c.is_project_question AND c.moderation_state='approved' AND p.status='approved' AND p.moderation_state='approved' AND (c.parent_id IS NULL OR EXISTS(SELECT 1 FROM public.comments parent WHERE parent.id=c.parent_id AND parent.moderation_state='approved')))));
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.growth_exchange_feedback(text,bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_exchange_feedback(text,bigint[]) TO anon,authenticated;

CREATE FUNCTION public.growth_manual_jobs() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.is_moderator_or_admin(),false) THEN RAISE EXCEPTION 'Moderator required'; END IF;
 RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(j)),'[]') FROM (SELECT id,content_type,content_id,user_id,error,decision,attempts,created_at,public.growth_evidence(content_type,content_id) AS evidence FROM public.growth_ai_jobs jobs WHERE state='manual' AND NOT EXISTS(SELECT 1 FROM public.growth_reward_events e JOIN public.growth_reward_reviews r ON r.id=e.review_id WHERE r.content_type=jobs.content_type AND e.content_id=jobs.content_id AND e.actor_kind='human' AND e.created_at>=jobs.created_at) AND NOT EXISTS(SELECT 1 FROM public.growth_quality q WHERE q.content_type=jobs.content_type AND q.content_id=jobs.content_id AND q.actor_kind='human' AND q.reviewed_at>=jobs.created_at) ORDER BY created_at DESC LIMIT 50) j);
END; $$;
REVOKE ALL ON FUNCTION public.growth_manual_jobs() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.growth_manual_jobs() TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
