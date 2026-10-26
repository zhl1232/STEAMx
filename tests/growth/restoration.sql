CREATE FUNCTION pg_temp.assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT COALESCE(ok,false) THEN RAISE EXCEPTION 'Assertion: %',label; END IF; END; $$;
CREATE FUNCTION pg_temp.review(typ text, id bigint, stages text[]) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.review_growth_reward(typ,id,stages,md5(public.growth_evidence(typ,id)::text),'Human verified the specific evidence and excluded repetition/advertising') $$;
CREATE FUNCTION pg_temp.denied(statement text, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN RETURN; END; RAISE EXCEPTION 'Expected denial: %',label; END; $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
INSERT INTO profiles(id) VALUES('00000000-0000-0000-0000-000000000006'),('00000000-0000-0000-0000-000000000007'),('00000000-0000-0000-0000-000000000008'),('00000000-0000-0000-0000-000000000009');
INSERT INTO completed_projects(id,user_id,project_id,notes,status,moderation_state) VALUES
(301,'00000000-0000-0000-0000-000000000006',301,'initial process evidence','approved','approved'),
(302,'00000000-0000-0000-0000-000000000002',302,'work for reply','approved','approved'),
(303,'00000000-0000-0000-0000-000000000002',303,'other work','approved','approved');
SELECT pg_temp.assert((pg_temp.review('completion',301,ARRAY['process'])->>'xp_awarded')::int=40,'first actual process');
UPDATE completed_projects SET notes='initial process plus substantive new comparison' WHERE id=301;
SELECT pg_temp.assert((SELECT xp=0 FROM profiles WHERE id='00000000-0000-0000-0000-000000000006'),'changed evidence awaits human reconfirmation');
SELECT pg_temp.assert((pg_temp.review('completion',301,ARRAY['process','discovery'])->>'xp_awarded')::int=100,'restore 40 plus first discovery 60');
SELECT pg_temp.assert((pg_temp.review('completion',301,ARRAY['process','discovery'])->>'xp_awarded')::int=0,'repeat multi-stage restoration idempotent');
SELECT pg_temp.assert((SELECT count(*)=2 FROM growth_reward_reviews WHERE source_key='project:301'),'one identity per stage');
SELECT pg_temp.assert((SELECT snapshot->>'notes'='initial process evidence' FROM growth_reward_reviews WHERE source_key='project:301' AND stage='process'),'original proof immutable');
SELECT pg_temp.assert(EXISTS(SELECT 1 FROM growth_reward_events e JOIN growth_reward_reviews r ON r.id=e.review_id WHERE r.source_key='project:301' AND e.event_type='restore' AND e.snapshot->>'notes'='initial process plus substantive new comparison'),'restoration proof appended');
SELECT pg_temp.assert((pg_temp.review('completion',301,ARRAY['final'])->>'xp_awarded')::int=100,'final reaches 200');
SELECT pg_temp.assert((pg_temp.review('completion',301,ARRAY['skip'])->>'xp_awarded')::int=-200,'mistaken value rejection');
SELECT pg_temp.assert((pg_temp.review('completion',301,ARRAY['process','final'])->>'xp_awarded')::int=140,'correct selected stages only');
SELECT pg_temp.assert((SELECT revoked_at IS NOT NULL FROM growth_reward_reviews WHERE source_key='project:301' AND stage='discovery'),'unconfirmed stage stays revoked');
SELECT pg_temp.assert((pg_temp.review('completion',301,ARRAY['discovery'])->>'xp_awarded')::int=60,'correct remaining stage');
SELECT pg_temp.assert((SELECT xp=200 FROM profiles WHERE id='00000000-0000-0000-0000-000000000006'),'net total still 200 after repeated correction');
SELECT pg_temp.assert((SELECT sum(e.xp_delta)=200 FROM growth_reward_events e JOIN growth_reward_reviews r ON r.id=e.review_id WHERE r.source_key='project:301'),'event ledger reconciles');
-- Dependency checks: an approved parent edit alone does not invalidate a useful reply.
INSERT INTO completion_comments(id,completed_project_id,author_id,content) VALUES(301,302,'00000000-0000-0000-0000-000000000007','How did you measure speed?');
INSERT INTO completion_comments(id,completed_project_id,author_id,content,parent_id,reply_to_user_id) VALUES
(302,302,'00000000-0000-0000-0000-000000000008','I measured distance and time',301,'00000000-0000-0000-0000-000000000007');
SELECT pg_temp.assert((pg_temp.review('comment',302,ARRAY['exchange'])->>'xp_awarded')::int=5,'reply awarded');
UPDATE completion_comments SET content='How did you measure the speed accurately?' WHERE id=301;
SELECT pg_temp.assert((SELECT xp=5 FROM profiles WHERE id='00000000-0000-0000-0000-000000000008'),'approved parent edit preserves child');
UPDATE completion_comments SET moderation_state='rejected' WHERE id=301;
SELECT pg_temp.assert((SELECT xp=0 FROM profiles WHERE id='00000000-0000-0000-0000-000000000008'),'parent rejection revokes dependent reply');
SELECT pg_temp.assert((pg_temp.review('comment',302,ARRAY['skip'])->>'xp_awarded')::int=0,'skip allowed despite parent rejection');
UPDATE completion_comments SET moderation_state='approved' WHERE id=301;
SELECT pg_temp.assert((SELECT xp=0 FROM profiles WHERE id='00000000-0000-0000-0000-000000000008'),'safety restoration alone cannot restore value XP');
SELECT pg_temp.assert((pg_temp.review('comment',302,ARRAY['exchange'])->>'xp_awarded')::int=5,'manual dependency restoration');
UPDATE completed_projects SET moderation_state='hidden' WHERE id=302;
SELECT pg_temp.assert((SELECT xp=0 FROM profiles WHERE id='00000000-0000-0000-0000-000000000008'),'hidden work revokes exchange');
SELECT pg_temp.assert((pg_temp.review('comment',302,ARRAY['skip'])->>'xp_awarded')::int=0,'skip allowed despite hidden work');
UPDATE completed_projects SET moderation_state='approved' WHERE id=302;
SELECT pg_temp.assert((pg_temp.review('comment',302,ARRAY['exchange'])->>'xp_awarded')::int=5,'restore after work approval');
UPDATE profiles SET is_auto_interaction_account=true WHERE id='00000000-0000-0000-0000-000000000008';
SELECT pg_temp.assert((pg_temp.review('comment',302,ARRAY['skip'])->>'xp_awarded')::int=-5,'can revoke newly identified bot');
UPDATE profiles SET is_auto_interaction_account=false WHERE id='00000000-0000-0000-0000-000000000008';
SELECT pg_temp.assert((pg_temp.review('comment',302,ARRAY['exchange'])->>'xp_awarded')::int=5,'human correction of bot classification');
UPDATE completion_comments SET content='I measured distance and time three times' WHERE id=302;
SELECT pg_temp.assert((pg_temp.review('comment',302,ARRAY['exchange'])->>'xp_awarded')::int=5,'edited exchange reviewed and restored');
SELECT pg_temp.assert((SELECT count(*)=2 FROM growth_reward_fingerprints WHERE user_id='00000000-0000-0000-0000-000000000008'),'all reviewed fingerprints retained');
INSERT INTO completion_comments(id,completed_project_id,author_id,content) VALUES(303,303,'00000000-0000-0000-0000-000000000008','a different useful question');
SELECT pg_temp.assert((pg_temp.review('comment',303,ARRAY['exchange'])->>'xp_awarded')::int=0,'restoration keeps occupied daily slot');
SELECT pg_temp.assert((SELECT count(*)=1 FROM growth_reward_reviews WHERE user_id='00000000-0000-0000-0000-000000000008' AND stage='exchange'),'restoration never creates more quota claims');
DELETE FROM completion_comments WHERE id=301;
SELECT pg_temp.assert(NOT EXISTS(SELECT 1 FROM completion_comments WHERE id=302),'real parent delete cascades');
SELECT pg_temp.assert((SELECT xp=0 FROM profiles WHERE id='00000000-0000-0000-0000-000000000008'),'cascade revokes once after multiple restorations');
-- Concurrent restoration uses one existing claim, then dependency rejection must win.
INSERT INTO completion_comments(id,completed_project_id,author_id,content) VALUES(401,303,'00000000-0000-0000-0000-000000000007','How was resistance measured?');
INSERT INTO completion_comments(id,completed_project_id,author_id,content,parent_id,reply_to_user_id) VALUES
(402,303,'00000000-0000-0000-0000-000000000009','I measured current and voltage',401,'00000000-0000-0000-0000-000000000007');
SELECT pg_temp.review('comment',402,ARRAY['exchange']);
SELECT pg_temp.review('comment',402,ARRAY['skip']);
