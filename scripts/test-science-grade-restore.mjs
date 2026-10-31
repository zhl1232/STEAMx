#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { prepareScienceGradeRestore } from './restore-science-grade-projects.mjs'

const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const match = /^--(backup|manifest|audit|schema)=(.+)$/.exec(argument)
  assert.ok(match, `Unknown argument ${argument}`)
  return [match[1], match[2]]
}))
assert.ok(args.schema, '--schema must identify a read-only snapshot of the live classification functions/triggers')
const { sql: migration, payload } = prepareScienceGradeRestore({ backupPath: args.backup, manifestPath: args.manifest, auditPath: args.audit })
assert.equal(migration, readFileSync(new URL('../supabase/migrations/20261030140000_restore_science_grade_projects.sql', import.meta.url), 'utf8'), 'Committed migration differs from offline generator')
const schema = JSON.parse(readFileSync(args.schema))
assert.ok(schema.functions.some(row => row.proname === 'invalidate_content_classification'))
assert.ok(schema.triggers.some(row => row.tgname === 'project_steps_content_classification_invalidation'))
assert.ok(schema.triggers.some(row => row.tgname === 'growth_project_revoke'))
assert.ok(schema.triggers.some(row => row.tgname === 'zz_growth_dependency'))
const name = `science-grade-restore-${process.pid}-${Date.now()}`
const quote = value => `'${String(value).replaceAll("'", "''")}'`
const json = value => `${quote(JSON.stringify(value))}::jsonb`
const run = (dockerArgs, input) => spawnSync('docker', dockerArgs, { encoding: 'utf8', input, maxBuffer: 2 * 1024 * 1024 })
const queryResult = statement => run(['exec','-i',name,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],`SET request.jwt.claim.role='service_role';\n${statement}`)
const query = statement => {
  const result = queryResult(statement)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout.trim()
}
const scoped = `DO $scoped_restore_test$ BEGIN EXECUTE $restore_migration_test$${migration}$restore_migration_test$; END; $scoped_restore_test$;`
const contentIds = '1175,1183,1200,1257'
const state = () => query(`SELECT jsonb_build_object(
 'projects',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id),'[]') FROM projects p),
 'materials',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]') FROM project_materials m),
 'steps',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id),'[]') FROM project_steps s),
 'links',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY kit_id,project_id),'[]') FROM experiment_kit_projects r),
 'audits',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM content_classification_reviews r),
 'contexts',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM content_classification_operation_context c));`)
const reset = () => {
  query('TRUNCATE projects,project_materials,project_steps,experiment_kit_projects,experiment_kits,content_classification_reviews,content_classification_operation_context,comments,completed_projects,completion_comments,growth_reward_content,growth_quality,growth_reward_reviews,growth_reward_events,xp_logs,coin_logs,notifications,user_badges,growth_ai_jobs CASCADE;')
  query(`INSERT INTO experiment_kits SELECT * FROM jsonb_populate_recordset(NULL::experiment_kits,${json(payload.kits)});
    INSERT INTO content_classification_reviews(id,content_type,content_id,decision,created_at,actor_type,actor_label)
      SELECT id,content_type,content_id,decision,created_at,'migration','retained-backup-audit-fixture' FROM jsonb_to_recordset(${json(payload.historicalReviews)}) AS r(id bigint,content_type text,content_id bigint,decision text,created_at timestamptz);
    SELECT setval('content_classification_reviews_id_seq',1000000);
    SELECT setval('projects_id_seq',1000000);
    SELECT setval('project_materials_id_seq',1000000);
    SELECT setval('project_steps_id_seq',1000000);`)
  const fan = { ...payload.projects[0], id:1226,title:payload.fan.title,video_url:payload.fan.video_url,tags:payload.fan.source_tags }
  query(`DO $$ BEGIN
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    PERFORM begin_content_classification_context('review');
    INSERT INTO projects SELECT * FROM jsonb_populate_record(NULL::projects,${json(fan)});
    PERFORM consume_content_classification_context('review');
    PERFORM set_config('app.content_classification_operation','',true);
   END $$;
   INSERT INTO projects(id,title,status,moderation_state) VALUES(495,'现有荷塘月色','draft','hidden'),(1220,'现有造雪实验','draft','hidden');`)
}
let started = false
let checks = 0
try {
  const start = run(['run','--detach','--rm','--name',name,'-e','POSTGRES_PASSWORD=test','postgres:16-alpine'])
  assert.equal(start.status, 0, start.stderr || start.stdout)
  started = true
  let ready = false
  for (let attempt=0;attempt<40;attempt++) {
    if (run(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0) {ready=true;break}
    await new Promise(resolve => setTimeout(resolve,250))
  }
  assert.ok(ready, 'isolated PostgreSQL not ready')
  query(`CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE profiles(id uuid PRIMARY KEY,role text,interaction_restricted boolean,age_confirmed_at timestamptz,xp integer DEFAULT 0,level integer DEFAULT 1);
    CREATE TABLE sub_categories(id integer PRIMARY KEY);
    CREATE TABLE challenges(id bigint PRIMARY KEY);
    CREATE SEQUENCE projects_id_seq;
    CREATE TABLE projects(${schema.columns.map(column => `${column.attname} ${column.type}${column.default_value ? ` DEFAULT ${column.default_value}` : ''}${column.required ? ' NOT NULL' : ''}`).join(',')},
      PRIMARY KEY(id),FOREIGN KEY(author_id) REFERENCES profiles(id),FOREIGN KEY(classification_reviewed_by) REFERENCES profiles(id),
      CONSTRAINT reviewed_complete CHECK(classification_status<>'reviewed' OR (recommended_min_age IS NOT NULL AND support_level IN('guided','independent','adult_required') AND difficulty_stars BETWEEN 1 AND 6 AND classification_source='manual' AND classification_reviewed_at IS NOT NULL AND classification_reviewed_by IS NOT NULL)));
    ALTER SEQUENCE projects_id_seq OWNED BY projects.id;
    CREATE TABLE project_materials(id bigserial PRIMARY KEY,project_id bigint NOT NULL REFERENCES projects(id),material text NOT NULL,sort_order integer);
    CREATE TABLE project_steps(id bigserial PRIMARY KEY,project_id bigint NOT NULL REFERENCES projects(id),title text NOT NULL,description text,image_url text,sort_order integer);
    CREATE TABLE experiment_kits(id uuid PRIMARY KEY,slug text,revision integer,status text,kind text,catalog jsonb,cover_url text,source_evidence jsonb);
    CREATE TABLE experiment_kit_projects(kit_id uuid REFERENCES experiment_kits(id),project_id bigint REFERENCES projects(id),status text,preparation_status text,extras jsonb,evidence jsonb,project_hash text,kit_revision integer,sort_order integer,PRIMARY KEY(kit_id,project_id));
    CREATE TABLE content_classification_operation_context(transaction_id bigint,operation_type text,PRIMARY KEY(transaction_id,operation_type));
    CREATE TABLE content_classification_settings(id boolean PRIMARY KEY,enforcement_enabled boolean);
    INSERT INTO content_classification_settings VALUES(true,true);
    CREATE TABLE content_classification_reviews(id bigserial PRIMARY KEY,content_type text,content_id bigint,decision text CHECK(decision IN('candidate','approve','return','invalidate')),previous_value jsonb,new_value jsonb,reason text,actor_type text,actor_id uuid,actor_label text,idempotency_key uuid,created_at timestamptz DEFAULT now(),UNIQUE(content_type,content_id,idempotency_key));
    CREATE TABLE comments(id bigint PRIMARY KEY,author_id uuid,project_id bigint,parent_id bigint,moderation_state text,is_project_question boolean);
    CREATE TABLE completed_projects(id bigint PRIMARY KEY,project_id bigint);
    CREATE TABLE completion_comments(id bigint PRIMARY KEY,author_id uuid,completed_project_id bigint,parent_id bigint,moderation_state text);
    CREATE TABLE growth_reward_content(content_type text,content_id bigint,version integer);
    CREATE TABLE growth_quality(content_type text,content_id bigint,qualified boolean);
    CREATE TABLE growth_reward_reviews(id bigint PRIMARY KEY,content_type text,content_id bigint,active_content_id bigint,user_id uuid,revoked_at timestamptz,stage text,revision integer,xp integer,revoke_reason text);
    CREATE TABLE growth_reward_events(review_id bigint,revision integer,event_type text,content_id bigint,snapshot jsonb,reviewer_id uuid,reason text,xp_delta integer,actor_kind text);
    CREATE TABLE xp_logs(user_id uuid,action_type text,resource_id text,xp_amount integer);
    CREATE TABLE coin_logs(id bigserial PRIMARY KEY);
    CREATE TABLE notifications(id bigserial PRIMARY KEY);
    CREATE TABLE user_badges(id bigserial PRIMARY KEY);
    CREATE TABLE growth_ai_jobs(content_type text,content_id bigint,user_id uuid,context_hash text);
    INSERT INTO profiles(id,role) VALUES(${quote(payload.projects[0].author_id)},'admin');
    INSERT INTO auth.users(id) SELECT id FROM profiles;
    ${schema.functions.map(row => row.definition).join(';\n')};
    ${schema.triggers.map(row => row.definition).join(';\n')};`)
  reset()
  const unaffected = query('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM projects p WHERE id IN(495,1220,1226);')
  query(scoped)
  assert.equal(query(`SELECT count(*) FROM projects WHERE id IN(${contentIds}) AND status='approved' AND moderation_state='approved' AND classification_status='reviewed';`),'4')
  assert.equal(query('SELECT count(*) FROM experiment_kit_projects;'),'5')
  assert.equal(query(`SELECT count(*) FROM content_classification_reviews WHERE actor_type='migration' AND actor_label='restore-science-grade-projects-20261030';`),'4')
  assert.equal(query(`SELECT count(*) FROM content_classification_reviews WHERE actor_label='content-classification-project-child-trigger';`),String(payload.materials.length+payload.steps.length))
  assert.equal(query('SELECT count(*) FROM content_classification_operation_context;'),'0')
  assert.equal(query(`SELECT (SELECT count(*) FROM growth_ai_jobs)+(SELECT count(*) FROM growth_reward_events)+(SELECT count(*) FROM xp_logs)+(SELECT count(*) FROM coin_logs)+(SELECT count(*) FROM notifications)+(SELECT count(*) FROM user_badges);`),'0','restoration caused rewards, growth jobs or notifications')
  assert.equal(query('SELECT sum(xp) FROM profiles;'),'0')
  assert.equal(query('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM projects p WHERE id IN(495,1220,1226);'),unaffected)
  for (const project of payload.projects) {
    const restored = JSON.parse(query(`SELECT to_jsonb(p) FROM projects p WHERE id=${project.id};`))
    assert.equal(restored.classification_reviewed_at,project.classification_reviewed_at)
    assert.equal(restored.classification_reviewed_by,project.classification_reviewed_by)
    assert.equal(restored.classification_revision,project.classification_revision)
    assert.ok(restored.search_vector)
  }
  checks++
  const applied = state()
  query(scoped)
  assert.equal(state(),applied,'replay changed content or audit')
  checks++
  // The real classification INSERT trigger still forbids forged reviewed rows.
  const forged = queryResult(`INSERT INTO projects(id,title,status,moderation_state,classification_status,classification_source) VALUES(9999,'forged','approved','approved','reviewed','manual');`)
  assert.notEqual(forged.status,0)
  assert.ok(forged.stderr.includes('CLASSIFICATION_WRITE_FORBIDDEN'))
  checks++
  const failures = [
    ['kit revision',`UPDATE experiment_kits SET revision=3 WHERE id=${quote(payload.kits[0].id)};`,'grade_restore_kit_changed'],
    ['kit evidence',`UPDATE experiment_kits SET source_evidence='{}' WHERE id=${quote(payload.kits[0].id)};`,'grade_restore_kit_changed'],
    ['fan title',`UPDATE projects SET title='changed' WHERE id=1226;`,'grade_restore_fan_changed'],
    ['fan video',`UPDATE projects SET video_url='https://example.test/new.mp4' WHERE id=1226;`,'grade_restore_fan_changed'],
    ['fan tags',`UPDATE projects SET tags=ARRAY['kejiao16a-src:一年级:023_木质小风扇'] WHERE id=1226;`,'grade_restore_fan_changed'],
    ['historical audit',`DELETE FROM content_classification_reviews WHERE id=${payload.historicalReviews[0].id};`,'grade_restore_historical_audit_changed'],
    ['occupied project',`INSERT INTO projects(id,title,status,moderation_state) VALUES(1175,'manual','draft','hidden');`,'grade_restore_project_id_conflict'],
    ['occupied child',`INSERT INTO project_steps(id,project_id,title) VALUES(${payload.steps[0].id},1226,'manual');`,'grade_restore_child_id_conflict'],
    ['user dependency',`INSERT INTO comments(id,project_id,moderation_state,is_project_question) VALUES(1,1183,'approved',true);`,'grade_restore_user_dependencies_present'],
    ['late relation drift',`INSERT INTO experiment_kit_projects(kit_id,project_id,status,preparation_status,kit_revision,evidence) VALUES(${quote(payload.relations.find(row=>row.project_id===1226).kit_id)},1226,'candidate','unknown',2,'{"manual":true}');`,'grade_restore_relation_changed'],
  ]
  for (const [label,mutation,error] of failures) {
    reset()
    query(mutation)
    const before = state()
    const result = queryResult(scoped)
    assert.notEqual(result.status,0,`${label}: unexpectedly succeeded`)
    assert.ok(result.stderr.includes(error),`${label}: ${result.stderr}`)
    assert.equal(state(),before,`${label}: transaction did not roll back`)
    checks++
  }
  reset()
  query(scoped)
  query(`UPDATE projects SET description='manual edit' WHERE id=1183;`)
  const edited = state()
  const result = queryResult(scoped)
  assert.notEqual(result.status,0)
  assert.ok(result.stderr.includes('grade_restore_project_drift'))
  assert.equal(state(),edited,'replay overwrote manual content')
  checks++
  console.log(`PASS: ${checks} PostgreSQL restoration checks using ${schema.functions.length} current functions and ${schema.triggers.length} current triggers; no remote writes.`)
} finally {
  if (started) run(['rm','--force',name])
}
