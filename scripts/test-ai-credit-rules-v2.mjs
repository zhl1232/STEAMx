#!/usr/bin/env node
/** Disposable local PGlite ONLY. No Supabase URLs, credentials or production writes.
 * Applies the AI credit + speech migration chain, then 20261013200000 twice, and checks
 * the v2 rules: non-member daily 150, members no daily grant, tiered speech limits.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const mod = process.env.PGLITE_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PGLITE_MODULE_PATH)).href)
  : await import('@electric-sql/pglite')
const db = new mod.PGlite()
const ids = { free: '00000000-0000-4000-8000-000000000001', pro: '00000000-0000-4000-8000-000000000002',
  founder: '00000000-0000-4000-8000-000000000003', expired: '00000000-0000-4000-8000-000000000004',
  lapse: '00000000-0000-4000-8000-000000000005', free2: '00000000-0000-4000-8000-000000000006' }
const q = (s) => `'${String(s).replaceAll("'", "''")}'`
let checks = 0
const assert = (c, m) => { checks++; if (!c) throw new Error(m) }
const one = async (sql) => (await db.query(sql)).rows[0]
const call = async (sql) => (await one(`SELECT ${sql} AS result`)).result
const execStatements = async (sql) => {
  for (const part of sql.split(/(?<=\$\$);/g).map((v) => v.trim()).filter(Boolean)) await db.exec(`${part};`)
}
const status = async (uid) => {
  await db.exec(`SELECT set_config('request.jwt.claim.sub',${q(uid)},false)`)
  return call('public.get_ai_credit_status(true,999999,999999)')
}
const setDay = (day) => db.exec(`SELECT set_config('test.credit_day',${q(day)},false)`)
const admit = (uid, kind, n) => call(`public.reserve_tutor_speech_usage(${q(uid)},${q(kind)},${n})`)
const clearLeases = () => db.exec('DELETE FROM public.tutor_speech_usage_leases')
const fill = async (uid, kind, total, step) => {
  let used = 0
  while (used + step <= total) {
    const r = await admit(uid, kind, step); await clearLeases()
    if (!r.ok) return { used, r }
    used += step
  }
  return { used }
}

try {
  await execStatements(`
    CREATE SCHEMA auth;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text,membership_tier text,membership_period text,membership_started_at timestamptz,membership_expires_at timestamptz);
    CREATE TABLE public.tutor_conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),context_type text,context_id text DEFAULT '',title text DEFAULT '小迪对话',status text DEFAULT 'active',meta jsonb DEFAULT '{}',summary text DEFAULT '',summary_message_id bigint,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),archived_at timestamptz);
    CREATE UNIQUE INDEX ON public.tutor_conversations(user_id,context_type,context_id) WHERE status='active';
    CREATE TABLE public.tutor_messages(id bigserial PRIMARY KEY,conversation_id uuid REFERENCES public.tutor_conversations(id) ON DELETE CASCADE,user_id uuid,context_type text,context_id text,role text,content text,images text[],meta jsonb NOT NULL DEFAULT '{}',created_at timestamptz DEFAULT now());
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    INSERT INTO auth.users VALUES ${Object.values(ids).map((u) => `(${q(u)})`).join(',')};
    INSERT INTO public.profiles VALUES
      (${q(ids.free)},'user','free','none',NULL,NULL),
      (${q(ids.free2)},'user','free','none',NULL,NULL),
      (${q(ids.pro)},'user','pro','monthly',now(),now()+interval '1 year'),
      (${q(ids.founder)},'user','founder','founder',now(),NULL),
      (${q(ids.expired)},'user','pro','yearly',now()-interval '1 year',now()-interval '1 day'),
      (${q(ids.lapse)},'user','pro','monthly',now(),now()+interval '1 year');
  `)
  for (const name of ['20260610151000_ai_credit_system.sql', '20260610160000_fix_ai_free_refund.sql',
    '20260920120000_secure_ai_credit_accounting.sql', '20260920140000_tutor_token_billing.sql',
    '20260920160000_tutor_request_lifecycle.sql', '20261012160000_tutor_total_usage_billing.sql',
    '20261012170000_ai_credit_grants.sql', '20261012171000_tutor_daily_credit_billing.sql',
    '20261013120000_tutor_speech_usage_limits.sql']) {
    await execStatements(await readFile(`supabase/migrations/${name}`, 'utf8'))
  }
  await execStatements(`
    CREATE OR REPLACE FUNCTION public.ai_credit_day_start() RETURNS timestamptz
    LANGUAGE sql STABLE SET search_path='' AS $$
      SELECT COALESCE(NULLIF(current_setting('test.credit_day',true),''),'2026-10-13')::date::timestamp AT TIME ZONE 'Asia/Shanghai'
    $$;
  `)
  await setDay('2026-10-13')
  // Pre-existing state from the old rules: a free user already granted 300 today.
  const before = await status(ids.free2)
  assert(before.freeDaily === 300, 'old rule fixture not 300')

  const v2 = await readFile('supabase/migrations/20261013200000_ai_credit_rules_v2.sql', 'utf8')
  await execStatements(v2)
  await execStatements(v2) // re-runnable
  const policy = (await db.query('SELECT kind,user_daily_units,member_daily_units FROM public.tutor_speech_usage_policy ORDER BY kind')).rows
  assert(JSON.stringify(policy.map((r) => [r.kind, Number(r.user_daily_units), Number(r.member_daily_units)])) ===
    JSON.stringify([['asr', 300, 1800], ['tts', 2000, 20000]]), `speech policy wrong: ${JSON.stringify(policy)}`)
  assert((await call(`has_function_privilege('authenticated','public.reserve_tutor_speech_usage(uuid,text,integer)','execute')`)) === false, 'speech reserve exposed to authenticated')
  assert((await call(`has_function_privilege('authenticated','public._ensure_ai_credit_balances(uuid)','execute')`)) === false, 'ensure exposed to authenticated')

  assert((await status(ids.free2)).freeDaily === 300, 'existing day row was rewritten by migration')

  const free = await status(ids.free)
  assert(free.isMember === false && free.freeDaily === 150 && free.freeRemainingToday === 150 && free.dailyChargeCap === 100, `free daily wrong: ${JSON.stringify(free)}`)
  assert((await status(ids.free)).freeRemainingToday === 150, 'repeat status regranted')
  const debit = await call(`public.consume_ai_credit_service(${q(ids.free)},100)`)
  assert(debit.ok && (await status(ids.free)).freeRemainingToday === 50, 'debit wrong')
  const expired = await status(ids.expired)
  assert(expired.isMember === false && expired.freeDaily === 150, 'expired member should get 150')

  for (const [uid, grant] of [[ids.pro, 15000], [ids.founder, 20000]]) {
    const s = await status(uid)
    assert(s.isMember === true && s.monthlyGrant === grant && s.walletBalance === grant, `member wallet wrong ${JSON.stringify(s)}`)
    assert(s.freeDaily === 0 && s.freeRemainingToday === 0, `member got daily grant ${JSON.stringify(s)}`)
    const logs = await one(`SELECT count(*)::int n FROM public.ai_credit_logs WHERE user_id=${q(uid)} AND reason='daily_grant'`)
    assert(logs.n === 0, 'member daily_grant log written')
  }
  await db.exec(`UPDATE public.ai_credit_wallets SET balance=0 WHERE user_id=${q(ids.pro)}`)
  const proEmpty = await status(ids.pro)
  assert(proEmpty.canChat === false, 'member with empty wallet should not fall back to daily credits')
  const proDebit = await call(`public.consume_ai_credit_service(${q(ids.pro)},1)`)
  assert(proDebit.ok === false, `member debit with empty wallet should fail: ${JSON.stringify(proDebit)}`)

  // Membership lapses later the same day: zero row is topped up once.
  await status(ids.lapse)
  await db.exec(`UPDATE public.profiles SET membership_expires_at=now()-interval '1 second' WHERE id=${q(ids.lapse)}`)
  const lapsed = await status(ids.lapse)
  assert(lapsed.freeDaily === 150 && lapsed.freeRemainingToday === 150, `lapsed member not granted ${JSON.stringify(lapsed)}`)
  assert((await status(ids.lapse)).freeRemainingToday === 150, 'lapsed top-up repeated')

  // Next day: fresh 150, no accumulation.
  await setDay('2026-10-14')
  const next = await status(ids.free)
  assert(next.freeRemainingToday === 150 && next.dailyPeriod === '2026-10-14', 'next day not fresh 150')
  assert((await status(ids.free2)).freeDaily === 150, 'next day old-rule user not 150')

  // Speech limits (real clock day; independent of credit day override).
  let r = await fill(ids.free, 'tts', 2000, 500); assert(r.used === 2000 && !r.r, 'free tts below 2000 blocked')
  r = await admit(ids.free, 'tts', 1); await clearLeases(); assert(r.error === 'user_daily_limit', 'free tts exceeded 2000')
  r = await fill(ids.free, 'asr', 300, 30); assert(r.used === 300, 'free asr below 300 blocked')
  r = await admit(ids.free, 'asr', 1); await clearLeases(); assert(r.error === 'user_daily_limit', 'free asr exceeded 300')
  r = await fill(ids.pro, 'tts', 20000, 500); assert(r.used === 20000 && !r.r, 'member tts below 20000 blocked')
  r = await admit(ids.pro, 'tts', 1); await clearLeases(); assert(r.error === 'user_daily_limit', 'member tts exceeded 20000')
  r = await fill(ids.founder, 'asr', 1800, 30); assert(r.used === 1800, 'member asr below 1800 blocked')
  r = await admit(ids.founder, 'asr', 1); await clearLeases(); assert(r.error === 'user_daily_limit', 'member asr exceeded 1800')
  r = await fill(ids.expired, 'asr', 300, 30); r = await admit(ids.expired, 'asr', 1); await clearLeases()
  assert(r.error === 'user_daily_limit', 'expired member kept member speech limit')

  console.log(`ai credit rules v2 checks passed: ${checks}`)
} catch (error) {
  console.error(error); process.exitCode = 1
} finally { await db.close() }
