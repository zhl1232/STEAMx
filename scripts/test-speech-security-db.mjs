/** Disposable local PGlite ONLY. No Supabase URLs, credentials or production writes.
 * Requires @electric-sql/pglite or PGLITE_MODULE_PATH pointing to its local ESM entry.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const imported = process.env.PGLITE_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PGLITE_MODULE_PATH)).href)
  : await import('@electric-sql/pglite')
const db = new imported.PGlite()
const u1 = '11111111-1111-4111-8111-111111111111'
const u2 = '22222222-2222-4222-8222-222222222222'
const q = s => `'${s.replaceAll("'", "''")}'`
const scalar = async sql => (await db.query(`SELECT ${sql} AS result`)).rows[0].result
const admit = (u, kind, n) => scalar(`public.reserve_tutor_speech_usage(${q(u)},${q(kind)},${n})`)
let assertions = 0
function check(value, message) { assert.ok(value, message); assertions++ }
async function denied(sql) { let rejected = false; try { await db.exec(sql) } catch { rejected = true } check(rejected, 'Expected permission rejection: ' + sql) }
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    CREATE TABLE public.tutor_messages(id bigint PRIMARY KEY, user_id uuid REFERENCES auth.users(id), role text, content text);
    ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.tutor_messages TO authenticated;
    CREATE POLICY own_messages ON public.tutor_messages FOR SELECT TO authenticated USING (user_id=auth.uid());
    INSERT INTO auth.users VALUES(${q(u1)}),(${q(u2)});
    INSERT INTO public.tutor_messages VALUES(1,${q(u1)},'assistant','own answer'),(2,${q(u2)},'assistant','private answer'),(3,${q(u1)},'user','not an assistant reply');
  `)
  const migration = await fs.readFile(new URL('../supabase/migrations/20261013120000_tutor_speech_usage_limits.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`)
    await denied(`SELECT public.reserve_tutor_speech_usage(${q(u1)},'tts',1)`)
    await denied(`SELECT public.release_tutor_speech_usage(${q(u1)})`)
    await denied(`UPDATE public.tutor_speech_usage_policy SET user_daily_units=999999`)
    await denied(`DELETE FROM public.tutor_speech_daily_usage`)
    await db.exec('RESET ROLE')
  }
  await db.exec(`SELECT set_config('request.jwt.claim.sub',${q(u1)},false); SET ROLE authenticated`)
  check(await scalar(`public.resolve_tutor_speech_reply(1,NULL)`) === 'own answer', 'Own reply must resolve')
  check(await scalar(`public.resolve_tutor_speech_reply(NULL,'own answer')`) === 'own answer', 'Exact legacy reply must resolve')
  for (const args of ["2,NULL", "NULL,'private answer'", "3,NULL", "NULL,'arbitrary'", "1,'own answer'", "NULL,NULL"]) {
    check(await scalar(`public.resolve_tutor_speech_reply(${args})`) === null, 'Invalid/foreign source must not resolve')
  }
  await db.exec('RESET ROLE')
  await db.exec("UPDATE public.tutor_speech_usage_policy SET user_daily_units=20, global_daily_units=30 WHERE kind='tts'; SET ROLE service_role")
  const first = await admit(u1,'tts',15); check(first.ok, 'First admission failed')
  check((await admit(u1,'tts',6)).error === 'user_daily_limit', 'User ceiling bypassed')
  await scalar(`public.release_tutor_speech_usage(${q(first.leaseId)})`)
  check((await admit(u1,'tts',6)).error === 'user_daily_limit', 'Release must not refund usage')
  check((await admit(u2,'tts',16)).error === 'global_daily_limit', 'Global ceiling bypassed')
  const second = await admit(u2,'tts',15); check(second.ok, 'Exact global ceiling should be admitted')
  await db.exec('RESET ROLE; DELETE FROM public.tutor_speech_usage_leases; SET ROLE service_role')
  const a = await admit(u1,'asr',1); const b = await admit(u1,'asr',1)
  check(a.ok && b.ok, 'Two tasks should be allowed')
  check((await admit(u1,'asr',1)).error === 'concurrency_limit', 'Per-user concurrency ceiling bypassed')
  await scalar(`public.release_tutor_speech_usage(${q(a.leaseId)})`)
  await scalar(`public.release_tutor_speech_usage(${q(a.leaseId)})`)
  check((await admit(u1,'asr',1)).ok, 'Idempotent release failed')
  await db.exec("RESET ROLE; UPDATE public.tutor_speech_usage_leases SET expires_at=clock_timestamp()-interval '1 second'; SET ROLE service_role")
  check((await admit(u1,'asr',1)).ok, 'Expired lease cleanup failed')
  check(!(await admit(u1,'asr',33)).ok, 'Oversized physical request accepted')
  check(!(await admit(u1,'tts',0)).ok, 'Invalid usage accepted')
  await db.exec('RESET ROLE; DELETE FROM public.tutor_speech_usage_leases')
  const users = Array.from({length:33},(_,i)=>`33333333-3333-4333-8333-${String(i).padStart(12,'0')}`)
  await db.exec(`INSERT INTO auth.users VALUES ${users.map(u=>'('+q(u)+')').join(',')}; SET ROLE service_role`)
  for (const u of users.slice(0,32)) check((await admit(u,'asr',1)).ok, 'Unexpected global admission denial')
  check((await admit(users[32],'asr',1)).error==='concurrency_limit','Global concurrency limit bypassed')
  console.log(`PASS: ${assertions} assertions against the real migration in disposable PGlite. Not a multi-connection test.`)
} finally { await db.close() }
