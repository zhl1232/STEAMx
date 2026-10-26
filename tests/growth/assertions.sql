CREATE FUNCTION pg_temp.assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT COALESCE(ok,false) THEN RAISE EXCEPTION 'Assertion: %',label; END IF; END; $$;
CREATE FUNCTION pg_temp.review(typ text, id bigint, stages text[]) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.review_growth_reward(typ,id,stages,md5(public.growth_evidence(typ,id)::text),'Human verified the specific evidence and excluded repetition/advertising') $$;
CREATE FUNCTION pg_temp.denied(statement text, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN RETURN; END; RAISE EXCEPTION 'Expected denial: %',label; END; $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
-- Preserve old +1s on unlikes/comments, and keep like counters.
SELECT pg_temp.assert((SELECT xp=1002 FROM profiles WHERE id='00000000-0000-0000-0000-000000000002'),'historical fixture');
DELETE FROM completion_likes; DELETE FROM completion_comments WHERE id=1;
SELECT pg_temp.assert((SELECT xp=1002 FROM profiles WHERE id='00000000-0000-0000-0000-000000000002'),'no historical debit');
INSERT INTO completion_likes VALUES('00000000-0000-0000-0000-000000000003',1,now());
SELECT pg_temp.assert((SELECT likes_count=1 FROM completed_projects WHERE id=1),'likes preserved');
SELECT pg_temp.assert((SELECT xp=1002 FROM profiles WHERE id='00000000-0000-0000-0000-000000000002'),'new likes no XP');
SELECT pg_temp.denied($q$SELECT pg_temp.review('completion',1,ARRAY['process'])$q$,'historical no backfill');
-- Safety approval only, pending rejected; multiple stages in one record; repeated review.
INSERT INTO completed_projects(id,user_id,project_id,notes) VALUES(2,'00000000-0000-0000-0000-000000000002',2,'real experiment, comparison and failed experiment conclusion');
SELECT pg_temp.denied($q$SELECT pg_temp.review('completion',2,ARRAY['process'])$q$,'pending');
SELECT public._approve_completion_with_reward(2,'00000000-0000-0000-0000-000000000001');
SELECT pg_temp.assert((SELECT xp=1002 FROM profiles WHERE id='00000000-0000-0000-0000-000000000002'),'safety approval no +20');
UPDATE completed_projects SET moderation_state='approved' WHERE id=2;
SELECT pg_temp.assert((pg_temp.review('completion',2,ARRAY['process','discovery','final'])->>'xp_awarded')::int=200,'one submission 200');
SELECT pg_temp.assert((pg_temp.review('completion',2,ARRAY['process','discovery','final'])->>'xp_awarded')::int=0,'repeat 0');
SELECT pg_temp.assert((SELECT level=floor(sqrt(xp::numeric/100))+1 FROM profiles WHERE id='00000000-0000-0000-0000-000000000002'),'level formula');
DELETE FROM completed_projects WHERE id=2;
INSERT INTO completed_projects(id,user_id,project_id,notes,status,moderation_state) VALUES(3,'00000000-0000-0000-0000-000000000002',2,'recreated','approved','approved');
SELECT pg_temp.assert((pg_temp.review('completion',3,ARRAY['process','discovery','final'])->>'xp_awarded')::int=200,'deleted recreated stage restores original claim');
-- Course takes precedence over project; historical final consumes final stage.
INSERT INTO xp_logs(user_id,action_type,resource_id,xp_amount) VALUES('00000000-0000-0000-0000-000000000002','publish_course_work','10000000-0000-0000-0000-000000000001',20);
INSERT INTO completed_projects(id,user_id,project_id,course_lesson_id,notes,status,moderation_state) VALUES
(4,'00000000-0000-0000-0000-000000000002',2,'10000000-0000-0000-0000-000000000001','course process, comparison, conclusion','approved','approved'),
(5,'00000000-0000-0000-0000-000000000002',99,'10000000-0000-0000-0000-000000000001','same lesson','approved','approved');
SELECT pg_temp.assert((pg_temp.review('completion',4,ARRAY['process','discovery','final'])->>'xp_awarded')::int=100,'legacy final no topup');
SELECT pg_temp.assert((pg_temp.review('completion',5,ARRAY['process','discovery','final'])->>'xp_awarded')::int=0,'lesson identity canonical');
INSERT INTO xp_logs(user_id,action_type,resource_id,xp_amount) VALUES('00000000-0000-0000-0000-000000000002','complete_lesson','10000000-0000-0000-0000-000000000002',180);
INSERT INTO completed_projects(id,user_id,course_lesson_id,status,moderation_state) VALUES(6,'00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','approved','approved');
SELECT pg_temp.assert((pg_temp.review('completion',6,ARRAY['process','discovery','final'])->>'xp_awarded')::int=20,'legacy cap 200');
-- Comments pending->approved; daily quota; self reply and author replying to others.
INSERT INTO completion_comments(id,completed_project_id,author_id,content,moderation_state) VALUES
(10,1,'00000000-0000-0000-0000-000000000003','why does the second wheel slip?','pending'),
(11,1,'00000000-0000-0000-0000-000000000003','try a wider tyre','approved'),
(12,1,'00000000-0000-0000-0000-000000000002','talking to myself','approved');
SELECT pg_temp.denied($q$SELECT pg_temp.review('comment',10,ARRAY['exchange'])$q$,'pending comment');
UPDATE completion_comments SET moderation_state='approved' WHERE id=10;
SELECT pg_temp.assert((pg_temp.review('comment',10,ARRAY['exchange'])->>'xp_awarded')::int=5,'approved valuable exchange');
SELECT pg_temp.assert((pg_temp.review('comment',11,ARRAY['exchange'])->>'xp_awarded')::int=0,'daily cap');
SELECT pg_temp.denied($q$SELECT pg_temp.review('comment',12,ARRAY['exchange'])$q$,'author top level self conversation');
INSERT INTO completion_comments(id,completed_project_id,author_id,content,parent_id,reply_to_user_id) VALUES
(13,1,'00000000-0000-0000-0000-000000000003','self reply',10,'00000000-0000-0000-0000-000000000003'),
(14,1,'00000000-0000-0000-0000-000000000002','I tried the wider tyre and it worked',10,'00000000-0000-0000-0000-000000000003');
SELECT pg_temp.denied($q$SELECT pg_temp.review('comment',13,ARRAY['exchange'])$q$,'self reply');
SELECT pg_temp.assert((pg_temp.review('comment',14,ARRAY['exchange'])->>'xp_awarded')::int=5,'author reply to another');
-- Rejection reversal once, reapproval does not regrant or release quota.
UPDATE completion_comments SET moderation_state='rejected' WHERE id=10;
UPDATE completion_comments SET moderation_state='rejected' WHERE id=10;
SELECT pg_temp.assert((SELECT xp=0 FROM profiles WHERE id='00000000-0000-0000-0000-000000000003'),'revoke exactly 5');
UPDATE completion_comments SET moderation_state='approved' WHERE id=10;
SELECT pg_temp.assert((pg_temp.review('comment',10,ARRAY['exchange'])->>'xp_awarded')::int=5,'human reapproval restores once');
SELECT pg_temp.assert((pg_temp.review('comment',10,ARRAY['exchange'])->>'xp_awarded')::int=0,'repeat restoration no regrant');
SELECT pg_temp.assert((SELECT count(*)=1 FROM xp_logs WHERE action_type='growth_revoke' AND user_id='00000000-0000-0000-0000-000000000003'),'single revoke ledger');
-- Edit revocation and stale hash rejected.
UPDATE completion_comments SET content='edited after review' WHERE id=14;
SELECT pg_temp.assert((SELECT revoked_at IS NOT NULL FROM growth_reward_reviews WHERE content_type='comment' AND content_id=14),'edit revoked');
SELECT pg_temp.denied($q$SELECT public.review_growth_reward('comment',14,ARRAY['exchange'],'stale','note')$q$,'stale review');
-- Same work/week even on another day. Then delete/recreate identical text next week.
UPDATE growth_reward_reviews SET reward_day=reward_day-1 WHERE content_id=10 AND content_type='comment';
SELECT pg_temp.assert((pg_temp.review('comment',11,ARRAY['exchange'])->>'xp_awarded')::int=0,'work weekly cap');
UPDATE growth_reward_reviews SET reward_day=reward_day-8,reward_week=reward_week-7 WHERE content_id=10 AND content_type='comment';
DELETE FROM completion_comments WHERE id=10;
INSERT INTO completion_comments(id,completed_project_id,author_id,content) VALUES(15,1,'00000000-0000-0000-0000-000000000003','why does the second wheel slip?');
SELECT pg_temp.assert((pg_temp.review('comment',15,ARRAY['exchange'])->>'xp_awarded')::int=0,'fingerprint survives deletion/week');
SELECT pg_temp.assert((pg_temp.review('comment',11,ARRAY['exchange'])->>'xp_awarded')::int=5,'new nonduplicate eligible');
SELECT pg_temp.assert((pg_temp.review('comment',11,ARRAY['skip'])->>'xp_awarded')::int=-5,'manual value rejection revokes safe content');
SELECT pg_temp.assert((pg_temp.review('comment',11,ARRAY['skip'])->>'xp_awarded')::int=0,'manual reversal idempotent');
-- Four awards on other days in this week block a fifth, another week permits it.
INSERT INTO growth_reward_reviews(user_id,content_type,content_id,source_key,stage,content_hash,fingerprint,snapshot,reviewer_id,reason,xp,reward_day,reward_week)
SELECT '00000000-0000-0000-0000-000000000004','comment',30+i,'work:'||(30+i),'exchange','test','test'||i,'{}','00000000-0000-0000-0000-000000000001','prior day',5,(now() AT TIME ZONE 'Asia/Shanghai')::date-i,date_trunc('week',now() AT TIME ZONE 'Asia/Shanghai')::date FROM generate_series(1,4) i;
INSERT INTO completion_comments(id,completed_project_id,author_id,content) VALUES(20,1,'00000000-0000-0000-0000-000000000004','what measurement changed?');
SELECT pg_temp.assert((pg_temp.review('comment',20,ARRAY['exchange'])->>'xp_awarded')::int=0,'weekly four');
UPDATE growth_reward_reviews SET reward_week=reward_week-7 WHERE user_id='00000000-0000-0000-0000-000000000004';
SELECT pg_temp.assert((pg_temp.review('comment',20,ARRAY['exchange'])->>'xp_awarded')::int=5,'next week eligible');
-- Bot never rewarded even if approved.
UPDATE profiles SET is_auto_interaction_account=true WHERE id='00000000-0000-0000-0000-000000000004';
SELECT pg_temp.denied($q$SELECT pg_temp.review('comment',20,ARRAY['exchange'])$q$,'automated account');
-- Shanghai day/week rollover is Monday 00:00 +08, independent of session zone.
SELECT pg_temp.assert(('2026-10-25 16:00:00+00'::timestamptz AT TIME ZONE 'Asia/Shanghai')::date='2026-10-26'::date,'Shanghai midnight');
SELECT pg_temp.assert(date_trunc('week','2026-10-25 15:59:59+00'::timestamptz AT TIME ZONE 'Asia/Shanghai')::date='2026-10-19'::date,'before Shanghai Monday');
SELECT pg_temp.assert(date_trunc('week','2026-10-25 16:00:00+00'::timestamptz AT TIME ZONE 'Asia/Shanghai')::date='2026-10-26'::date,'after Shanghai Monday');
SELECT pg_temp.assert(jsonb_array_length(public.growth_review_queue('comment'))>0,'queue');
-- Login fixed even at historical streak/milestone; once per day.
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
UPDATE profiles SET login_streak=364,total_login_days=364,last_check_in=(now() AT TIME ZONE 'Asia/Shanghai')::date-1 WHERE id=auth.uid();
SELECT pg_temp.assert((public.daily_check_in()->>'xp_granted')::int=3,'fixed login XP');
SELECT pg_temp.assert((public.daily_check_in()->>'xp_granted')::int=0,'login idempotent');
SELECT pg_temp.assert((SELECT coins=2 AND total_login_days=365 FROM profiles WHERE id=auth.uid()),'coins and history');
SELECT pg_temp.denied($q$SELECT pg_temp.review('comment',11,ARRAY['exchange'])$q$,'ordinary user cannot review');
SELECT pg_temp.assert(NOT has_function_privilege('service_role','public.review_growth_reward(text,bigint,text[],text,text)','EXECUTE'),'service cannot impersonate manual value reviewer');
SELECT pg_temp.assert(NOT has_table_privilege('authenticated','public.growth_reward_reviews','INSERT'),'no frontend reward assertions');
SET ROLE authenticated;
SELECT pg_temp.denied($q$SELECT * FROM public.growth_reward_epoch$q$,'private epoch');
SELECT pg_temp.denied($q$INSERT INTO public.growth_reward_reviews DEFAULT VALUES$q$,'no ledger writes');
RESET ROLE;
SET request.jwt.claim.role='service_role';
SELECT pg_temp.assert(public.award_xp_once('00000000-0000-0000-0000-000000000003','like_project','999')=0,'old like RPC disabled');
SELECT pg_temp.assert(public.award_xp_once('00000000-0000-0000-0000-000000000003','complete_project','999')=0,'old final RPC disabled');
SELECT pg_temp.denied($q$SELECT public.repair_completion_rewards(true)$q$,'old repair disabled');
-- Inputs for parallel sessions (same recipient, different rows/works).
INSERT INTO completion_comments(id,completed_project_id,author_id,content) VALUES
(101,1,'00000000-0000-0000-0000-000000000005','concurrent question one'),
(102,3,'00000000-0000-0000-0000-000000000005','concurrent question two');

INSERT INTO completed_projects(id,user_id,project_id,notes,status,moderation_state) VALUES
(201,'00000000-0000-0000-0000-000000000005',201,'first process','approved','approved'),
(202,'00000000-0000-0000-0000-000000000005',201,'another process same project','approved','approved');
