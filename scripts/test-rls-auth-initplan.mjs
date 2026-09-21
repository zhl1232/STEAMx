#!/usr/bin/env node
// Isolated PostgreSQL regression; never connects to the configured Supabase.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const modulePath = process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite'
const { PGlite } = await import(modulePath.startsWith('/') ? pathToFileURL(modulePath).href : modulePath)
const db = new PGlite()
const groups = {
  project_journeys: ['owner_insert', 'owner_update', 'owner_delete', 'owner_or_staff'],
  project_journey_records: ['owner_or_public', 'owner_update', 'owner_delete'],
  ai_credit_logs: ['select_own'], ai_credit_wallets: ['select_own'],
  challenge_stage_progress: ['select', 'insert', 'update', 'delete'],
  gomoku_matches: ['select', 'insert', 'update', 'delete'],
  course_lessons: ['admin_delete', 'admin_insert', 'admin_update', 'select'],
  courses: ['admin_delete', 'admin_insert', 'admin_update', 'select_approved'],
  learning_resources: ['admin_delete', 'admin_insert', 'admin_update', 'select'],
  tutor_conversations: ['insert', 'update', 'select'], tutor_messages: ['delete', 'insert', 'select'],
  tutor_notebooks: ['select_own'], user_lesson_progress: ['select'],
  user_course_completions: ['select'], challenge_submissions: ['delete'],
}
const targets = Object.entries(groups).flatMap(([table, suffixes]) => suffixes.map(s => [table, `${table}_${s}`]))
targets.push(['messages', 'Users can mark received messages read'], ['playground_stats', 'Users can delete own playground stats'])
const ident = s => '"' + s.replaceAll('"', '""') + '"'
const policies = async () => (await db.query('SELECT * FROM pg_policies ORDER BY schemaname, tablename, policyname')).rows
try {
  await db.exec(`CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;`)
  for (const table of new Set(targets.map(t => t[0]))) {
    await db.exec(`CREATE TABLE public.${ident(table)} (user_id uuid, note text, "auth.uid()" text);
      ALTER TABLE public.${ident(table)} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.${ident(table)} TO authenticated, anon;
      INSERT INTO public.${ident(table)} VALUES ('00000000-0000-0000-0000-000000000001','auth.uid()','auth.uid()'), ('00000000-0000-0000-0000-000000000002','other','other');`)
  }
  for (const [i, [table, policy]] of targets.entries()) {
    const command = /insert$/.test(policy) ? 'INSERT' : /update$|mark received/.test(policy) ? 'UPDATE' : /delete$|delete own/.test(policy) ? 'DELETE' : 'SELECT'
    const expr = `(auth.uid() = user_id AND ((SELECT auth.uid()) IS NOT NULL) AND (note IS NULL OR note <> 'do not rewrite auth.uid()') AND ("auth.uid()" IS NULL OR "auth.uid()" <> 'literal'))`
    await db.exec(`CREATE POLICY ${ident(policy)} ON public.${ident(table)} AS ${i % 2 ? 'PERMISSIVE' : 'RESTRICTIVE'} FOR ${command} TO authenticated ${command !== 'INSERT' ? `USING (${expr})` : ''} ${['INSERT','UPDATE'].includes(command) ? `WITH CHECK (${expr})` : ''}`)
  }
  // An unrelated policy must not be optimized by this targeted migration.
  await db.exec('CREATE POLICY unrelated ON public.messages FOR SELECT TO authenticated USING (auth.uid() = user_id)')
  const before = await policies()
  const migration = await readFile('supabase/migrations/20260921120000_optimize_reported_rls_auth_calls.sql', 'utf8')
  // Exercise literal boundaries that can occur in catalog-deparsed expressions.
  const helper = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION'), migration.indexOf('DO $migration$'))
  await db.exec(helper)
  for (const expression of [String.raw`note = 'ends\' AND auth.uid() = user_id`, String.raw`"ends\" = 'x' AND auth.uid() = user_id`, "note = 'it''s auth.uid()' AND auth.uid() = user_id"]) {
    const { rows } = await db.query('SELECT pg_temp.optimize_rls_auth_calls($1) AS result', [expression])
    assert.equal(rows[0].result, expression.replace('AND auth.uid()', 'AND (SELECT auth.uid())'))
  }
  await db.exec(migration)
  const after = await policies()
  assert.equal(after.length, 42)
  for (let i = 0; i < before.length; i++) {
    const { qual: bq, with_check: bc, ...bm } = before[i]
    const { qual: aq, with_check: ac, ...am } = after[i]
    assert.deepEqual(am, bm, 'policy metadata preserved')
    if (bm.policyname === 'unrelated') { assert.equal(aq, bq); continue }
    for (const [old, next] of [[bq,aq],[bc,ac]]) {
      if (old === null) { assert.equal(next,null); continue }
      assert.notEqual(next, old, bm.policyname)
      assert.ok(next.includes("'do not rewrite auth.uid()'"), 'string literal preserved')
      assert.ok(next.includes('"auth.uid()"'), 'quoted identifier preserved')
      assert.equal((next.match(/SELECT auth.uid\(\)/g) || []).length, 2, 'bare call wrapped; existing subquery unchanged')
    }
  }
  await db.exec(migration)
  assert.deepEqual(await policies(), after, 'rerun is a no-op')
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)`)
  assert.equal((await db.query('SELECT * FROM public.messages')).rows.length, 1, 'only owner can read')
  assert.equal((await db.query("UPDATE public.messages SET note = 'read' RETURNING user_id")).rows.length, 1, 'only receiver can update')
  await assert.rejects(db.exec("UPDATE public.messages SET user_id = '00000000-0000-0000-0000-000000000002'"), /row-level security/, 'cannot transfer ownership')
  const plan = await db.query('EXPLAIN UPDATE public.messages SET note = note')
  // The optimized UPDATE policy should expose an InitPlan.
  assert.ok(JSON.stringify(plan.rows).includes('InitPlan'), 'auth UID is evaluated through InitPlan')
  await db.exec(`RESET ROLE; SET ROLE anon`)
  assert.equal((await db.query('SELECT * FROM public.messages')).rows.length, 0, 'anonymous reader sees nothing')
  await db.exec(`RESET ROLE; DROP POLICY tutor_messages_insert ON public.tutor_messages`)
  await db.exec(migration)
  assert.ok(!(await policies()).some(p => p.policyname === 'tutor_messages_insert'), 'removed policies stay removed')
  console.log('PASS: 41 targets, metadata/literals preserved, idempotence, owner isolation, WITH CHECK and absent-policy handling')
} catch (error) {
  console.error(error.message)
  if (error.where) console.error(error.where)
  process.exitCode = 1
} finally { await db.close() }
