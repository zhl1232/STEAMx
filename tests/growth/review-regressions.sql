-- Public RPC regressions. Each statement autocommits: now() ordering is part of
-- the human/AI precedence contract, so do not wrap this file in one transaction.
CREATE FUNCTION pg_temp.assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT COALESCE(ok,false) THEN RAISE EXCEPTION 'Review regression: %',label; END IF; END; $$;
CREATE FUNCTION pg_temp.review(id bigint,stages text[]) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.review_growth_reward('completion',id,stages,md5(public.growth_evidence('completion',id)::text),'Human independently verified current evidence') $$;
-- Isolate the subject from jobs left by earlier scenarios; the lease itself is
-- acquired through the public worker RPC, never forged in the fixture.
CREATE FUNCTION pg_temp.claim(p_id bigint) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb; attempt integer;
BEGIN
 UPDATE public.growth_ai_jobs SET available_at=now()+interval '1 day' WHERE content_id<>p_id OR content_type<>'completion';
 UPDATE public.growth_ai_jobs SET available_at=now() WHERE content_id=p_id AND content_type='completion';
 FOR attempt IN 1..8 LOOP
   result:=public.claim_growth_ai_job();
   IF result IS NOT NULL THEN RETURN result; END IF;
 END LOOP;
 RAISE EXCEPTION 'No current job for completion %',p_id;
END; $$;
CREATE FUNCTION pg_temp.finish(job jsonb,safety text,quality text,stages jsonb) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.finish_growth_ai_job((job->>'id')::uuid,(job->>'lease')::uuid,jsonb_build_object('safety',safety,'quality',quality,'stages',stages,'reason','Independent fixture evidence decision'),'{}','mock-regression')
$$;
SET request.jwt.claim.role='service_role'; RESET request.jwt.claim.sub;
INSERT INTO profiles(id) VALUES('00000000-0000-0000-0000-000000000021');
INSERT INTO auth.users SELECT id FROM profiles ON CONFLICT DO NOTHING;
INSERT INTO projects(id,title) SELECT id,'Review regression '||id FROM generate_series(2101,2110) id;
INSERT INTO completed_projects(id,user_id,project_id,notes,status,moderation_state) VALUES(2101,'00000000-0000-0000-0000-000000000021',2101,'Original process A','approved','approved');
SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT public.review_growth_reward('completion',2101,ARRAY['skip'],md5(public.growth_evidence('completion',2101)::text),'Initial independent rejection');
SET request.jwt.claim.role='service_role'; RESET request.jwt.claim.sub;
UPDATE completed_projects SET notes='Changed process B' WHERE id=2101;
UPDATE completed_projects SET notes='Original process A' WHERE id=2101;
CREATE TEMP TABLE regression_job AS SELECT pg_temp.claim(2101) AS job;
SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT pg_temp.review(2101,ARRAY['skip']);
SET request.jwt.claim.role='service_role'; RESET request.jwt.claim.sub;
SELECT pg_temp.assert((pg_temp.finish(job,'allow','eligible','["process"]')->>'state')='manual','latest repeated skip takes precedence') FROM regression_job;
SELECT pg_temp.assert((SELECT xp=0 FROM profiles WHERE id='00000000-0000-0000-0000-000000000021'),'repeated skip blocks XP');
SELECT pg_temp.assert((SELECT count(*)=2 AND count(DISTINCT reason)=2 AND bool_and(snapshot->>'notes'='Original process A' AND stages=ARRAY['skip'] AND xp_delta=0) FROM growth_reward_decisions WHERE content_type='completion' AND content_id=2101),'both zero-XP human decisions preserve snapshot and reason');
SELECT pg_temp.assert(NOT has_table_privilege('authenticated','public.growth_reward_decisions','INSERT') AND NOT has_table_privilege('authenticated','public.growth_reward_decisions','UPDATE') AND NOT has_table_privilege('authenticated','public.growth_reward_decisions','DELETE'),'browser cannot forge human decisions');
-- An already-active stage confirmation must also be a fresh human decision.
INSERT INTO completed_projects(id,user_id,project_id,notes,status,moderation_state) VALUES(2102,'00000000-0000-0000-0000-000000000021',2102,'Confirmed process','approved','approved');
SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT pg_temp.review(2102,ARRAY['process']);
SET request.jwt.claim.role='service_role'; RESET request.jwt.claim.sub;
-- A background edit changes the context without invalidating the active award.
UPDATE projects SET description='More precise background' WHERE id=2102;
TRUNCATE regression_job; INSERT INTO regression_job SELECT pg_temp.claim(2102);
SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT pg_temp.review(2102,ARRAY['process']);
SET request.jwt.claim.role='service_role'; RESET request.jwt.claim.sub;
SELECT pg_temp.assert((pg_temp.finish(job,'allow','ineligible','[]')->>'state')='manual','repeat active confirmation takes precedence') FROM regression_job;
SELECT pg_temp.assert((SELECT xp=40 FROM profiles WHERE id='00000000-0000-0000-0000-000000000021'),'AI cannot undo repeated human confirmation');
SELECT pg_temp.assert((SELECT count(*)=2 AND sum(xp_delta)=40 AND bool_and(stages=ARRAY['process'] AND snapshot->>'notes'='Confirmed process') FROM growth_reward_decisions WHERE content_type='completion' AND content_id=2102),'duplicate active confirmation remains independently audited');

-- Real Journey guards and indexes are present, including one public final per
-- attempt. Service-role insertion matches server moderation/legacy projection.
INSERT INTO project_journeys(id,user_id,source_type,project_id) SELECT id,'00000000-0000-0000-0000-000000000021','project',id FROM generate_series(2103,2108) id;
INSERT INTO project_journey_records(id,journey_id,user_id,record_kind,anchor_type,notes,visibility,status,moderation_state,published_at,legacy_source,legacy_source_id)
SELECT id,id,'00000000-0000-0000-0000-000000000021','final','final','Journey evidence '||id,'public','approved','approved',now(),'completed_project',id FROM generate_series(2103,2108) id;
UPDATE project_journeys SET status='completed',completed_at=now() WHERE id BETWEEN 2103 AND 2108;
INSERT INTO project_explorations(id,user_id,project_id,status,completed_at,journey_id) SELECT id,'00000000-0000-0000-0000-000000000021',id,'completed',now(),id FROM generate_series(2103,2108) id;
INSERT INTO completed_projects(id,user_id,project_id,journey_record_id,exploration_id,notes,status,moderation_state)
SELECT id,'00000000-0000-0000-0000-000000000021',id,id,id,'Journey evidence '||id,'approved','approved' FROM generate_series(2103,2108) id;
-- Sibling progress record must survive rejection of the final record.
INSERT INTO project_journey_records(id,journey_id,user_id,record_kind,notes,visibility,status,moderation_state,published_at) VALUES(2190,2103,'00000000-0000-0000-0000-000000000021','progress','Independent approved sibling','public','approved','approved',now());
INSERT INTO completed_projects(id,user_id,project_id,journey_record_id,record_kind,notes,status,moderation_state) VALUES(2190,'00000000-0000-0000-0000-000000000021',2103,2190,'progress','Independent approved sibling','approved','approved');
TRUNCATE regression_job; INSERT INTO regression_job SELECT pg_temp.claim(2103);
SELECT pg_temp.finish(job,'reject','ineligible','[]') FROM regression_job;
SELECT pg_temp.assert((SELECT status='rejected' AND moderation_state='rejected' AND published_at IS NULL FROM project_journey_records WHERE id=2103),'rejected authoritative final hidden');
SELECT pg_temp.assert((SELECT status<>'approved' AND moderation_state='rejected' FROM completed_projects WHERE id=2103),'rejected compatibility work hidden');
SELECT pg_temp.assert((SELECT status='active' AND completed_at IS NULL FROM project_journeys WHERE id=2103),'rejected final reopens Journey');
SELECT pg_temp.assert((SELECT status='active' AND completed_at IS NULL FROM project_explorations WHERE id=2103),'rejected final reopens exploration pointer');
SELECT pg_temp.assert((SELECT status='approved' AND moderation_state='approved' AND published_at IS NOT NULL FROM project_journey_records WHERE id=2190),'approved authoritative sibling unaffected');
SELECT pg_temp.assert((SELECT status='approved' AND moderation_state='approved' FROM completed_projects WHERE id=2190),'approved compatibility sibling unaffected');
TRUNCATE regression_job; INSERT INTO regression_job SELECT pg_temp.claim(2104);
SELECT pg_temp.finish(job,'uncertain','uncertain','[]') FROM regression_job;
SELECT pg_temp.assert((SELECT status='pending' AND moderation_state='pending' AND published_at IS NULL FROM project_journey_records WHERE id=2104),'uncertain authoritative final hidden');
SELECT pg_temp.assert((SELECT status<>'approved' AND moderation_state='pending' FROM completed_projects WHERE id=2104),'uncertain compatibility work hidden');
SELECT pg_temp.assert((SELECT status='active' AND completed_at IS NULL FROM project_journeys WHERE id=2104),'uncertain final reopens Journey');
-- Authoritative edits may precede compatibility projection sync; an older lease
-- must not approve or reject the newer version of the Journey record.
TRUNCATE regression_job; INSERT INTO regression_job SELECT pg_temp.claim(2105);
UPDATE project_journey_records SET notes='New authoritative evidence',status='pending',moderation_state='pending',published_at=NULL,updated_at=clock_timestamp() WHERE id=2105;
SELECT pg_temp.assert((pg_temp.finish(job,'reject','ineligible','[]')->>'state')='stale','unsynced authoritative edit invalidates lease result') FROM regression_job;
SELECT pg_temp.assert((SELECT notes='New authoritative evidence' AND status='pending' AND moderation_state='pending' FROM project_journey_records WHERE id=2105),'stale decision leaves new Journey evidence intact');
SELECT pg_temp.assert((SELECT status='approved' AND moderation_state='approved' FROM completed_projects WHERE id=2105),'stale result leaves projection untouched');
TRUNCATE regression_job; INSERT INTO regression_job SELECT pg_temp.claim(2106);
SELECT pg_temp.finish(job,'allow','ineligible','[]') FROM regression_job;
SELECT pg_temp.assert((SELECT status='approved' AND moderation_state='approved' AND published_at IS NOT NULL FROM project_journey_records WHERE id=2106),'allow preserves authoritative public approval');
SELECT pg_temp.assert((SELECT status='completed' FROM project_journeys WHERE id=2106),'allow preserves completed Journey');
TRUNCATE regression_job; INSERT INTO regression_job SELECT pg_temp.claim(2107);
UPDATE growth_ai_jobs SET lease_until=now()-interval '1 second' WHERE id=(SELECT (job->>'id')::uuid FROM regression_job);
SELECT pg_temp.assert((pg_temp.finish(job,'reject','ineligible','[]')->>'state')='lease_expired','expired lease rejected') FROM regression_job;
SELECT pg_temp.assert((SELECT status='approved' AND moderation_state='approved' FROM project_journey_records WHERE id=2107),'expired result leaves authoritative record untouched');
SELECT pg_temp.assert((SELECT status='approved' AND moderation_state='approved' FROM completed_projects WHERE id=2107),'expired result leaves legacy record untouched');
SELECT pg_temp.assert((SELECT status='completed' FROM project_journeys WHERE id=2107),'expired result leaves Journey untouched');

-- A newer active attempt owns the source pointer. Rejection still hides the old
-- final; lifecycle repair is deferred rather than displacing the newer attempt.
INSERT INTO project_journeys(id,user_id,source_type,project_id,attempt_no) VALUES(2208,'00000000-0000-0000-0000-000000000021','project',2108,2);
UPDATE project_explorations SET status='active',completed_at=NULL,journey_id=2208 WHERE id=2108;
TRUNCATE regression_job; INSERT INTO regression_job SELECT pg_temp.claim(2108);
SELECT pg_temp.assert((pg_temp.finish(job,'reject','ineligible','[]')->>'journey_reopen_deferred')::boolean,'competing active attempt defers old lifecycle repair') FROM regression_job;
SELECT pg_temp.assert((SELECT status='rejected' AND moderation_state='rejected' AND published_at IS NULL FROM project_journey_records WHERE id=2108),'conflict still hides authoritative rejected final');
SELECT pg_temp.assert((SELECT status<>'approved' AND moderation_state='rejected' FROM completed_projects WHERE id=2108),'conflict still hides legacy rejected work');
SELECT pg_temp.assert((SELECT status='active' FROM project_journeys WHERE id=2208),'newer active Journey preserved');
SELECT pg_temp.assert((SELECT status='active' AND journey_id=2208 FROM project_explorations WHERE id=2108),'newer attempt keeps exploration pointer');
SELECT pg_temp.assert((SELECT state='manual' AND error='journey_reopen_conflict' FROM growth_ai_jobs WHERE id=(SELECT (job->>'id')::uuid FROM regression_job)),'lifecycle conflict visible for manual repair');

-- Queue membership reflects current lifecycle, not the historical job error.
-- Keep every branch local: later fixtures still see the original unresolved job.
BEGIN;
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
CREATE TEMP TABLE conflict_history ON COMMIT DROP AS SELECT id,to_jsonb(j) AS original FROM growth_ai_jobs j WHERE id=(SELECT (job->>'id')::uuid FROM regression_job);
CREATE FUNCTION pg_temp.conflict_visible() RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(public.growth_manual_jobs()) item WHERE item->>'id'=(SELECT id::text FROM conflict_history))
$$;
SELECT pg_temp.assert(pg_temp.conflict_visible(),'unresolved lifecycle conflict enters manual queue');
SELECT pg_temp.assert((SELECT decision->'reopen_context'->>'journey_id'='2108' AND decision->'reopen_context'->>'journey_record_id'='2108' FROM growth_ai_jobs WHERE id=(SELECT id FROM conflict_history)),'server preserves original conflict identity');
SELECT pg_temp.assert((SELECT provolatile='s' FROM pg_proc WHERE oid='public.growth_manual_jobs()'::regprocedure),'queue RPC remains read-only stable');
SELECT pg_temp.review(2108,ARRAY['skip']);
SELECT pg_temp.assert(pg_temp.conflict_visible(),'value-only skip cannot dismiss unresolved lifecycle conflict');
SAVEPOINT unresolved;
SET LOCAL request.jwt.claim.role='service_role';
UPDATE project_journey_records SET status='approved',moderation_state='approved',published_at=now(),updated_at=clock_timestamp() WHERE id=2108;
SET LOCAL request.jwt.claim.role='authenticated';
SELECT pg_temp.assert(pg_temp.conflict_visible(),'authoritative-only reapproval leaves projection conflict visible');
ROLLBACK TO SAVEPOINT unresolved;
SET LOCAL request.jwt.claim.role='service_role';
UPDATE completed_projects SET status='approved',moderation_state='approved' WHERE id=2108;
SET LOCAL request.jwt.claim.role='authenticated';
SELECT pg_temp.assert(pg_temp.conflict_visible(),'projection-only reapproval leaves authoritative conflict visible');
ROLLBACK TO SAVEPOINT unresolved;
SET LOCAL request.jwt.claim.role='service_role';
UPDATE project_journey_records SET status='approved',moderation_state='approved',published_at=now(),updated_at=clock_timestamp() WHERE id=2108;
UPDATE completed_projects SET status='approved',moderation_state='approved' WHERE id=2108;
SET LOCAL request.jwt.claim.role='authenticated';
SELECT pg_temp.review(2108,ARRAY['skip']);
SELECT pg_temp.assert(NOT pg_temp.conflict_visible(),'complete safety restoration plus value review dismisses resolved conflict');
SELECT pg_temp.assert((SELECT status='active' FROM project_journeys WHERE id=2208),'queue resolution preserves newer active attempt');
SELECT pg_temp.assert((SELECT status='active' AND journey_id=2208 FROM project_explorations WHERE id=2108),'queue resolution preserves newer exploration pointer');
SELECT pg_temp.assert((SELECT to_jsonb(j)=h.original FROM growth_ai_jobs j JOIN conflict_history h ON h.id=j.id),'queue GET preserves original conflict job state error and decision history');
SAVEPOINT restored;
SET LOCAL request.jwt.claim.role='service_role';
UPDATE completed_projects SET notes='Unsynced compatibility text' WHERE id=2108;
SET LOCAL request.jwt.claim.role='authenticated';
SELECT pg_temp.assert(pg_temp.conflict_visible(),'approved status alone cannot hide mismatched projection text');
ROLLBACK TO SAVEPOINT restored;
SET LOCAL request.jwt.claim.role='service_role';
UPDATE completed_projects SET user_id='00000000-0000-0000-0000-000000000003' WHERE id=2108;
SET LOCAL request.jwt.claim.role='authenticated';
SELECT pg_temp.assert(pg_temp.conflict_visible(),'approved status alone cannot hide mismatched projection ownership');
ROLLBACK TO SAVEPOINT restored;
SET LOCAL request.jwt.claim.role='service_role';
UPDATE project_journey_records SET status='pending',moderation_state='pending',published_at=NULL WHERE id=2108;
SET LOCAL request.jwt.claim.role='authenticated';
SELECT pg_temp.assert(pg_temp.conflict_visible(),'reintroduced authoritative inconsistency resurfaces historical conflict');
ROLLBACK TO SAVEPOINT unresolved;
SET LOCAL request.jwt.claim.role='service_role';
UPDATE completed_projects SET journey_record_id=NULL WHERE id=2108;
SET LOCAL request.jwt.claim.role='authenticated';
SELECT pg_temp.assert(pg_temp.conflict_visible(),'removing projection link cannot hide unresolved original Journey');
ROLLBACK TO SAVEPOINT unresolved;
SET LOCAL request.jwt.claim.role='service_role';
UPDATE project_journeys SET status='abandoned' WHERE id=2208;
UPDATE project_journeys SET status='active',completed_at=NULL WHERE id=2108;
UPDATE project_explorations SET journey_id=2108,status='active',completed_at=NULL WHERE id=2108;
SET LOCAL request.jwt.claim.role='authenticated';
SELECT pg_temp.assert(NOT pg_temp.conflict_visible(),'reopened Journey exits lifecycle queue even with rejected final');
SELECT pg_temp.assert((SELECT status='rejected' AND moderation_state='rejected' FROM project_journey_records WHERE id=2108),'reopening does not approve rejected final');
SET LOCAL request.jwt.claim.role='service_role';
UPDATE project_journeys SET status='abandoned' WHERE id=2108;
SET LOCAL request.jwt.claim.role='authenticated';
SELECT pg_temp.assert(NOT pg_temp.conflict_visible(),'abandoned original Journey no longer needs reopening');
ROLLBACK TO SAVEPOINT unresolved;
SET LOCAL request.jwt.claim.role='service_role';
DELETE FROM project_journeys WHERE id=2108;
SET LOCAL request.jwt.claim.role='authenticated';
SELECT pg_temp.assert(NOT pg_temp.conflict_visible(),'deleted original Journey no longer needs reopening');
ROLLBACK;

-- A mismatch already present before claiming is not an invitation to copy an
-- older compatibility decision over authoritative content. Route it to staff.
INSERT INTO project_journeys(id,user_id,source_type,project_id) VALUES(2109,'00000000-0000-0000-0000-000000000003','project',2109);
INSERT INTO project_journey_records(id,journey_id,user_id,record_kind,anchor_type,notes,visibility,status,moderation_state,published_at) VALUES(2109,2109,'00000000-0000-0000-0000-000000000003','final','final','New authoritative version','public','approved','approved',now());
UPDATE project_journeys SET status='completed',completed_at=now() WHERE id=2109;
INSERT INTO completed_projects(id,user_id,project_id,journey_record_id,notes,status,moderation_state) VALUES(2109,'00000000-0000-0000-0000-000000000003',2109,2109,'Old compatibility version','approved','approved');
TRUNCATE regression_job; INSERT INTO regression_job SELECT pg_temp.claim(2109);
SELECT pg_temp.assert((pg_temp.finish(job,'reject','ineligible','[]')->>'state')='manual','preexisting projection mismatch requires manual review') FROM regression_job;
SELECT pg_temp.assert((SELECT state='manual' AND error='journey_projection_outdated' FROM growth_ai_jobs WHERE id=(SELECT (job->>'id')::uuid FROM regression_job)),'projection mismatch reason visible');
SELECT pg_temp.assert((SELECT notes='New authoritative version' AND status='approved' AND moderation_state='approved' FROM project_journey_records WHERE id=2109),'mismatched result cannot overwrite authoritative record');
SELECT pg_temp.assert((SELECT status='approved' AND moderation_state='approved' FROM completed_projects WHERE id=2109),'mismatched result does not partially alter projection');

-- Standalone completions use the existing safety-review path: staff restore
-- moderation_state only. AI safety must not poison the separate approval status.
INSERT INTO profiles(id) VALUES('00000000-0000-0000-0000-000000000023');
INSERT INTO projects(id,title) VALUES(2111,'Standalone uncertain safety regression');
INSERT INTO completed_projects(id,user_id,project_id,notes,status,moderation_state) VALUES
(2110,'00000000-0000-0000-0000-000000000023',2110,'Standalone rejection evidence','approved','approved'),
(2111,'00000000-0000-0000-0000-000000000023',2111,'Standalone uncertain evidence','approved','approved');
CREATE FUNCTION pg_temp.standalone_safety(id bigint,safety text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE job jsonb;
BEGIN
 job:=pg_temp.claim(id);
 PERFORM pg_temp.finish(job,safety,CASE WHEN safety='reject' THEN 'ineligible' ELSE 'uncertain' END,'[]');
 PERFORM pg_temp.assert((SELECT status='approved' AND moderation_state=CASE WHEN safety='reject' THEN 'rejected' ELSE 'pending' END FROM public.completed_projects c WHERE c.id=standalone_safety.id),'standalone safety preserves approval status: '||safety);
 -- Mirrors applyContentModeration() for an unlinked completion.
 UPDATE public.completed_projects SET moderation_state='approved' WHERE completed_projects.id=standalone_safety.id;
 PERFORM pg_temp.assert((SELECT is_public AND status='approved' AND moderation_state='approved' FROM public.completed_projects c WHERE c.id=standalone_safety.id),'manual safety restoration makes standalone public: '||safety);
END; $$;
SELECT pg_temp.standalone_safety(id,safety) FROM (VALUES(2110::bigint,'reject'),(2111::bigint,'uncertain')) cases(id,safety);
