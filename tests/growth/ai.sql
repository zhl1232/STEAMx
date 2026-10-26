-- Isolated mock decisions: exercises SQL trust boundary, not live model accuracy.
CREATE FUNCTION pg_temp.assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT COALESCE(ok,false) THEN RAISE EXCEPTION 'AI assertion: %',label; END IF; END; $$;
CREATE FUNCTION pg_temp.denied(statement text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN RETURN; END; RAISE EXCEPTION 'Expected denial'; END; $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
INSERT INTO profiles(id) VALUES('00000000-0000-0000-0000-000000000011'),('00000000-0000-0000-0000-000000000012');
INSERT INTO projects(id,title,description) VALUES(1001,'Wheel experiment','Compare tyres');
UPDATE growth_ai_jobs SET state='stale';
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000011';
INSERT INTO comments(id,project_id,author_id,content,is_project_question,moderation_state) VALUES(1001,1001,auth.uid(),'Should I compare equal diameter tyres?',true,'approved');
SELECT pg_temp.assert((SELECT moderation_state='pending' AND question_root_id=id FROM comments WHERE id=1001),'client cannot self approve; root derived');
SELECT pg_temp.denied($q$UPDATE comments SET moderation_state='approved' WHERE id=1001$q$);
SELECT pg_temp.assert(NOT has_function_privilege('authenticated','public.finish_growth_ai_job(uuid,uuid,jsonb,jsonb,text,text)','EXECUTE'),'ordinary user cannot submit AI result');
SELECT pg_temp.assert(NOT has_table_privilege('authenticated','public.growth_quality','INSERT'),'quality cannot be forged');
SET request.jwt.claim.role='service_role'; RESET request.jwt.claim.sub;
CREATE TEMP TABLE current_job AS SELECT public.claim_growth_ai_job() AS j;
SELECT pg_temp.assert((SELECT j->>'type'='project_comment' FROM current_job),'question queued for system');
SELECT public.finish_growth_ai_job((j->>'id')::uuid,(j->>'lease')::uuid,'{"safety":"allow","quality":"eligible","stages":["exchange"],"reason_code":"question","reason":"Concrete comparison question"}','{"mock":true}','mock') FROM current_job;
SELECT pg_temp.assert((SELECT xp=5 FROM profiles WHERE id='00000000-0000-0000-0000-000000000011'),'AI eligible awards fixed 5');
SELECT pg_temp.assert((SELECT reviewer_id IS NULL AND actor_kind='system' AND ai_job_id IS NOT NULL FROM growth_reward_reviews WHERE content_type='project_comment' AND content_id=1001),'system audit never impersonates moderator');
SELECT pg_temp.assert((public.finish_growth_ai_job((j->>'id')::uuid,(j->>'lease')::uuid,'{}','{}','mock')->>'state')='lease_expired','repeat finish inert') FROM current_job;
SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000011';
SELECT pg_temp.assert((public.growth_exchange_feedback('project_comment',ARRAY[1001])->0->>'xp')::int=5,'owner feedback confirmed ledger');
UPDATE comments SET content='Should equal diameter tyres use the same load?' WHERE id=1001;
SELECT pg_temp.assert(public.growth_exchange_feedback('project_comment',ARRAY[1001])='[]','edit removes label immediately');
SELECT pg_temp.assert((SELECT xp=0 FROM profiles WHERE id=auth.uid()),'edit revokes audited payout');
SET request.jwt.claim.role='service_role'; RESET request.jwt.claim.sub;
TRUNCATE current_job; INSERT INTO current_job SELECT public.claim_growth_ai_job();
SELECT public.finish_growth_ai_job((j->>'id')::uuid,(j->>'lease')::uuid,'{"safety":"allow","quality":"eligible","stages":["exchange"],"reason_code":"question","reason":"Corrected specific question"}','{}','mock') FROM current_job;
SELECT pg_temp.assert((SELECT xp=5 FROM profiles WHERE id='00000000-0000-0000-0000-000000000011'),'AI re-review restores original claim');
SELECT pg_temp.assert((SELECT count(*)=1 FROM growth_reward_reviews WHERE user_id='00000000-0000-0000-0000-000000000011' AND stage='exchange'),'no extra slot on restore');
-- Safe thanks publishes without any quality label or XP.
INSERT INTO comments(id,project_id,author_id,content,parent_id,is_project_question,moderation_state) VALUES(1002,1001,'00000000-0000-0000-0000-000000000012','谢谢！',1001,true,'pending');
TRUNCATE current_job; INSERT INTO current_job SELECT public.claim_growth_ai_job();
SELECT public.finish_growth_ai_job((j->>'id')::uuid,(j->>'lease')::uuid,'{"safety":"allow","quality":"ineligible","stages":[],"reason_code":"none","reason":"Thanks is welcome"}','{}','mock') FROM current_job;
SELECT pg_temp.assert((SELECT moderation_state='approved' FROM comments WHERE id=1002),'thanks allowed');
SELECT pg_temp.assert(public.growth_exchange_feedback('project_comment',ARRAY[1002])='[]','thanks no label');
-- Server rejects self-reply reward even when model says eligible; safe text still publishes.
INSERT INTO comments(id,project_id,author_id,content,parent_id,is_project_question,moderation_state) VALUES(1003,1001,'00000000-0000-0000-0000-000000000011','I also wondered about the load',1001,true,'pending');
TRUNCATE current_job; INSERT INTO current_job SELECT public.claim_growth_ai_job();
SELECT public.finish_growth_ai_job((j->>'id')::uuid,(j->>'lease')::uuid,'{"safety":"allow","quality":"eligible","stages":["exchange"],"reason_code":"question","reason":"Specific question"}','{}','mock') FROM current_job;
SELECT pg_temp.assert((SELECT moderation_state='approved' FROM comments WHERE id=1003),'self reply publication distinct from XP eligibility');
SELECT pg_temp.assert(public.growth_exchange_feedback('project_comment',ARRAY[1003])='[]','self reply cannot earn label');
-- Five/day across both entry points; sixth keeps quality but no payout.
SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
INSERT INTO completion_comments(id,completed_project_id,author_id,content) SELECT 1100+i,1,'00000000-0000-0000-0000-000000000011','Distinct observation '||i FROM generate_series(1,5) i;
SELECT public.review_growth_reward('comment',1100+i,ARRAY['exchange'],md5(public.growth_evidence('comment',1100+i)::text),'Human checked distinct evidence') FROM generate_series(1,5) i;
SELECT pg_temp.assert((SELECT count(*)=5 FROM growth_reward_reviews WHERE user_id='00000000-0000-0000-0000-000000000011' AND stage='exchange'),'shared five/day');
SELECT pg_temp.assert((SELECT qualified FROM growth_quality WHERE content_type='comment' AND content_id=1105),'quota exhausted still qualified');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000011';
SELECT pg_temp.assert((public.growth_exchange_feedback('comment',ARRAY[1105])->0->>'xp')::int=0,'no payout toast after cap');
SET request.jwt.claim.role='service_role'; RESET request.jwt.claim.sub;
UPDATE projects SET moderation_state='hidden' WHERE id=1001;
SELECT pg_temp.assert(public.growth_exchange_feedback('project_comment',ARRAY[1001])='[]','project hiding removes downstream quality');
SELECT pg_temp.assert((SELECT revoked_at IS NOT NULL FROM growth_reward_reviews WHERE content_type='project_comment' AND content_id=1001),'project hiding revokes question XP');
-- Invalid / stale / timed-out model responses never grant.
UPDATE growth_ai_jobs SET state='stale';
INSERT INTO completion_comments(id,completed_project_id,author_id,content,moderation_state) VALUES(1201,1,'00000000-0000-0000-0000-000000000012','How did you measure the diameter?','pending');
TRUNCATE current_job; INSERT INTO current_job SELECT public.claim_growth_ai_job();
SELECT pg_temp.denied(format('SELECT public.finish_growth_ai_job(%L,%L,%L,%L,%L)',j->>'id',j->>'lease','{}','{}','mock')) FROM current_job;
UPDATE completion_comments SET content='How did you measure the diameter accurately?' WHERE id=1201;
SELECT pg_temp.assert((public.finish_growth_ai_job((j->>'id')::uuid,(j->>'lease')::uuid,'{"safety":"allow","quality":"eligible","stages":["exchange"],"reason":"Old evidence"}','{}','mock')->>'state')='stale','stale response cannot approve edit') FROM current_job;
SELECT pg_temp.assert((SELECT xp=0 FROM profiles WHERE id='00000000-0000-0000-0000-000000000012'),'fail closed');
UPDATE growth_ai_jobs SET state='running',attempts=3,lease_until=now()-interval '1 second' WHERE content_id=1201 AND state='queued';
SELECT public.claim_growth_ai_job();
SELECT pg_temp.assert(EXISTS(SELECT 1 FROM growth_ai_jobs WHERE content_id=1201 AND state='manual' AND error='retry_limit_after_expired_lease'),'expired third attempt visible for manual review');

-- Same root remains one/day, a new Shanghai day allows another real exchange.
SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
UPDATE projects SET moderation_state='approved' WHERE id=1001;
INSERT INTO comments(id,project_id,author_id,content,parent_id,is_project_question) VALUES(1004,1001,'00000000-0000-0000-0000-000000000011','Here is a concrete answer to your measurement question',1002,true);
SELECT pg_temp.assert((public.review_growth_reward('project_comment',1004,ARRAY['exchange'],md5(public.growth_evidence('project_comment',1004)::text),'Genuine answer')->>'xp_awarded')::int=0,'root question plus reply cannot farm same day');
UPDATE growth_reward_reviews SET reward_day=reward_day-1 WHERE user_id='00000000-0000-0000-0000-000000000011';
SELECT pg_temp.assert((public.review_growth_reward('project_comment',1004,ARRAY['exchange'],md5(public.growth_evidence('project_comment',1004)::text),'Genuine answer on next day')->>'xp_awarded')::int=5,'same thread new day allowed');
SELECT pg_temp.assert((public.review_growth_reward('project_comment',1001,ARRAY['exchange'],md5(public.growth_evidence('project_comment',1001)::text),'Original question still valid')->>'xp_awarded')::int=5,'restore original identity');
SELECT pg_temp.assert((SELECT reward_day=(now() AT TIME ZONE 'Asia/Shanghai')::date-1 FROM growth_reward_reviews WHERE content_type='project_comment' AND content_id=1001),'restore keeps original day');
SELECT pg_temp.assert((SELECT count(*)=1 FROM growth_reward_reviews WHERE user_id='00000000-0000-0000-0000-000000000011' AND reward_day=(now() AT TIME ZONE 'Asia/Shanghai')::date AND stage='exchange'),'restore never mints current day slot');
