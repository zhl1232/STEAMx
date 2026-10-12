#!/usr/bin/env node
// Isolated, in-memory PostgreSQL only. No env files, live users, or remote DB.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const modulePath = process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite'
const { PGlite } = await import(modulePath.startsWith('.') || modulePath.startsWith('/')
  ? pathToFileURL(modulePath).href : modulePath)
const db = new PGlite('memory://ai-credit-grants')
const ids = Object.fromEntries(['free', 'pro', 'founder', 'legacy', 'other', 'expired', 'invalid', 'lifetime', 'missing']
  .map((name, i) => [name, `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`]))
const request = (n) => `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const q = (value) => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`
let checks = 0
const assert = (condition, message) => { checks++; if (!condition) throw new Error(message) }
const one = async (sql) => (await db.query(sql)).rows[0]
const call = async (sql) => (await one(`SELECT ${sql} AS result`)).result
const wallet = async (uid) => Number((await one(`SELECT balance FROM public.ai_credit_wallets WHERE user_id=${q(uid)}`))?.balance ?? 0)
const daily = async (uid, day) => Number((await one(`SELECT balance FROM public.ai_daily_credit_wallets WHERE user_id=${q(uid)} AND grant_day=${q(day)}::date`))?.balance ?? 0)
const status = async (uid) => {
  await db.exec(`SELECT set_config('request.jwt.claim.sub',${q(uid ?? '')},false)`)
  return call('public.get_ai_credit_status(true,999999999,999999999)')
}
const consume = (uid, cost) => call(`public.consume_ai_credit_service(${q(uid)},${cost})`)
const refund = (uid, receipt, cost, source) => call(`public.refund_ai_credit_service(${q(uid)},${cost},${q(source)},${receipt})`)
const throws = async (fn, message) => {
  let failed = false
  try { await fn() } catch { failed = true }
  assert(failed, message)
}
const execStatements = async (sql) => {
  for (const part of sql.split(/(?<=\$\$);/g).map((value) => value.trim()).filter(Boolean)) await db.exec(`${part};`)
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
    INSERT INTO auth.users VALUES ${Object.values(ids).map((uid) => `(${q(uid)})`).join(',')};
    INSERT INTO public.profiles VALUES
      (${q(ids.free)},'user','free','none',NULL,NULL),
      (${q(ids.pro)},'user','pro','monthly',now(),now()+interval '1 year'),
      (${q(ids.founder)},'user','founder','founder',now(),NULL),
      (${q(ids.legacy)},'user','pro','monthly',now(),now()+interval '1 year'),
      (${q(ids.other)},'user','free','none',NULL,NULL),
      (${q(ids.expired)},'user','pro','yearly',now()-interval '1 year',now()-interval '1 day'),
      (${q(ids.invalid)},'user','founder','monthly',now(),now()+interval '1 year'),
      (${q(ids.lifetime)},'user','pro','lifetime',now(),NULL);
  `)
  for (const name of ['20260610151000_ai_credit_system.sql', '20260610160000_fix_ai_free_refund.sql',
    '20260920120000_secure_ai_credit_accounting.sql', '20260920140000_tutor_token_billing.sql',
    '20260920160000_tutor_request_lifecycle.sql', '20261012160000_tutor_total_usage_billing.sql']) {
    await execStatements(await readFile(`supabase/migrations/${name}`, 'utf8'))
  }

  const oldFixed = await consume(ids.legacy, 2)
  const oldFixedAcrossMonth = await consume(ids.legacy, 2)
  const oldFree = await consume(ids.other, 2)
  const oldHeld = await call(`public.reserve_tutor_credit_service(${q(ids.legacy)},${q(request(1))},1000)`)
  const oldBalance = await wallet(ids.legacy)
  const oldOids = await one(`SELECT
    'public.get_ai_credit_status(boolean,int,int)'::regprocedure::oid AS status,
    'public.consume_ai_credit_service(uuid,int)'::regprocedure::oid AS consume,
    'public.refund_ai_credit_service(uuid,int,text,bigint)'::regprocedure::oid AS refund,
    'public.reserve_tutor_credit_service(uuid,uuid,int)'::regprocedure::oid AS reserve`)
  await execStatements(await readFile('supabase/migrations/20261012170000_ai_credit_grants.sql', 'utf8'))
  const newOids = await one(`SELECT
    'public.get_ai_credit_status(boolean,int,int)'::regprocedure::oid AS status,
    'public.consume_ai_credit_service(uuid,int)'::regprocedure::oid AS consume,
    'public.refund_ai_credit_service(uuid,int,text,bigint)'::regprocedure::oid AS refund,
    'public.reserve_tutor_credit_service(uuid,uuid,int)'::regprocedure::oid AS reserve`)
  assert(JSON.stringify(oldOids) === JSON.stringify(newOids), 'public RPC OIDs changed')
  assert(await wallet(ids.legacy) === oldBalance, 'migration mutated an existing test wallet')
  assert((await status(ids.legacy)).walletBalance === oldBalance, 'same-month test wallet was topped up')
  const legacyReplay = await call(`public.reserve_tutor_credit_service(${q(ids.legacy)},${q(request(1))},8192)`)
  assert(legacyReplay.receiptId === oldHeld.receiptId, 'old reserved receipt no longer replays')
  const legacyDone = await call(`public.settle_tutor_credit_service(${q(ids.legacy)},${oldHeld.receiptId},500,false)`)
  assert(Number(legacyDone.chargedCredits) === .5 && await wallet(ids.legacy) === oldBalance + .5, 'old held receipt lost its output tariff')
  const deniedOld = await call(`public.reserve_tutor_credit_service(${q(ids.pro)},${q(request(2))},8192)`)
  assert(deniedOld.ok === false && deniedOld.error === 'billing_version_unsupported', 'new old-tariff admission was allowed')
  assert(Number((await refund(ids.legacy, oldFixed.receiptId, 2, 'wallet')).refunded) === 2, 'legacy fixed wallet refund broke')
  assert(Number((await refund(ids.legacy, oldFixed.receiptId, 2, 'wallet')).refunded) === 0, 'legacy refund replay duplicated credit')

  assert((await status(null)).error === 'unauthorized', 'unauthenticated status issued credits')
  assert((await status(ids.missing)).error === 'user_not_found', 'missing profile issued credits')
  const free = await status(ids.free)
  const day0 = free.dailyPeriod
  assert(free.isMember === false && free.monthlyGrant === 0 && free.walletBalance === 0, 'status trusted forged member hints')
  assert(free.creditUnit === 'credits' && free.freeDaily === 300 && free.freeUsedToday === 0 && free.freeRemainingToday === 300, 'free credit units/grant incorrect')
  assert(free.dailyChargeCap === 100, 'tutor daily-funded per-turn cap is absent from status')
  const expectedDay = await one("SELECT to_char(now() AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS day, extract(epoch FROM (public.ai_credit_day_start()+interval '1 day'))::bigint AS reset")
  assert(day0 === expectedDay.day && free.dayResetAt === Number(expectedDay.reset), 'grant day/reset does not use Shanghai midnight')
  const pro = await status(ids.pro)
  const founder = await status(ids.founder)
  assert(pro.monthlyGrant === 15000 && pro.walletBalance === 15000, 'new pro wallet grant incorrect')
  assert(founder.monthlyGrant === 20000 && founder.walletBalance === 20000, 'new founder wallet grant incorrect')
  assert((await status(ids.lifetime)).walletBalance === 15000, 'lifetime pro grant incorrect')
  assert((await status(ids.expired)).isMember === false && (await status(ids.invalid)).isMember === false, 'invalid/expired membership received monthly credit')
  await status(ids.pro); await status(ids.pro); await status(ids.free)
  assert(Number((await one(`SELECT count(*) AS n FROM public.ai_credit_logs WHERE user_id=${q(ids.pro)} AND reason='monthly_grant'`)).n) === 1, 'refresh duplicated monthly grant')
  assert(Number((await one(`SELECT count(*) AS n FROM public.ai_credit_logs WHERE user_id=${q(ids.free)} AND reason='daily_grant'`)).n) === 1, 'refresh duplicated daily grant')

  const memberDebit = await consume(ids.pro, 5)
  assert(memberDebit.source === 'wallet' && await wallet(ids.pro) === 14995 && await daily(ids.pro, day0) === 300, 'daily credits were preferred or stacked before monthly wallet')
  await db.exec(`UPDATE public.profiles SET membership_tier='founder',membership_period='founder',membership_expires_at=NULL WHERE id=${q(ids.pro)}`)
  const promoted = await status(ids.pro)
  assert(promoted.monthlyGrant === 20000 && promoted.walletBalance === 14995, 'tier change unexpectedly refilled this month')
  await db.exec(`UPDATE public.profiles SET membership_tier='pro',membership_period='lifetime' WHERE id=${q(ids.pro)}`)
  await status(ids.pro)
  assert(await wallet(ids.pro) === 14995, 'tier flip duplicated credit')

  const freeDebit = await consume(ids.free, 2)
  assert(freeDebit.source === 'free' && freeDebit.remaining === 298 && freeDebit.freeUsedToday === 2, 'fixed daily debit still counts one opportunity')
  assert((await status(ids.free)).freeRemainingToday === 298, 'status refilled a spent daily wallet')
  assert(Number((await one(`SELECT public.count_ai_free_chats_today(${q(ids.free)}) AS n`)).n) === 0, 'new credit debit pollutes legacy free counts')
  assert(Number((await refund(ids.free, freeDebit.receiptId, 1, 'free')).refunded) === 1, 'partial daily refund failed')
  assert(Number((await refund(ids.free, freeDebit.receiptId, 1, 'free')).refunded) === 0, 'daily refund replay duplicated credit')
  assert(Number((await refund(ids.free, freeDebit.receiptId, 99, 'free')).refunded) === 1 && await daily(ids.free, day0) === 300, 'daily cumulative refund exceeded original charge')
  assert(Number((await one(`SELECT meta->>'refundedCredits' AS n FROM public.ai_credit_logs WHERE id=${freeDebit.receiptId}`)).n) === 2, 'refund metadata missing for net usage statistics')
  assert((await refund(ids.other, freeDebit.receiptId, 2, 'free')).error === 'invalid_receipt', 'refund crossed users')
  assert((await refund(ids.free, freeDebit.receiptId, 2, 'wallet')).error === 'invalid_receipt', 'refund crossed funding source')
  assert((await refund(ids.free, freeDebit.receiptId, 2, null)).error === 'invalid_params', 'NULL refund source accepted')

  const other = await status(ids.other)
  await consume(ids.other, 1)
  assert(Number((await one(`SELECT public.count_ai_free_chats_today(${q(ids.other)}) AS n`)).n) === 1, 'legacy debit count lost or new debit added')
  await refund(ids.other, oldFree.receiptId, 2, 'free')
  assert(await daily(ids.other, other.dailyPeriod) === 299, 'legacy free refund minted new daily credits')

  const allDaily = await consume(ids.free, 300)
  const empty = await status(ids.free)
  assert(empty.freeRemainingToday === 0 && empty.freeUsedToday === 300 && empty.canChat === false, 'exhausted daily status incorrect')
  assert((await consume(ids.free, 1)).error === 'quota_exceeded' && await daily(ids.free, day0) === 0, 'daily wallet overspent')
  await db.exec(`UPDATE public.ai_credit_wallets SET balance=.5 WHERE user_id=${q(ids.pro)}`)
  const fallback = await consume(ids.pro, 2)
  assert(fallback.source === 'free' && await wallet(ids.pro) === .5 && await daily(ids.pro, day0) === 298, 'insufficient member wallet did not use whole daily fallback')
  await db.exec(`UPDATE public.ai_daily_credit_wallets SET balance=.5 WHERE user_id=${q(ids.pro)} AND grant_day=${q(day0)}`)
  assert((await consume(ids.pro, 1)).error === 'quota_exceeded' && await wallet(ids.pro) === .5, 'two insufficient wallets were silently combined')

  const privileges = await one(`SELECT
    has_function_privilege('authenticated','public._ensure_ai_credit_balances(uuid)','execute') AS auth_ensure,
    has_function_privilege('service_role','public._ensure_ai_credit_balances(uuid)','execute') AS service_ensure,
    has_function_privilege('authenticated','public.consume_ai_credit_service(uuid,int)','execute') AS auth_consume,
    has_function_privilege('anon','public.refund_ai_credit_service(uuid,int,text,bigint)','execute') AS anon_refund,
    has_function_privilege('service_role','public.consume_ai_credit_service(uuid,int)','execute') AS service_consume,
    has_function_privilege('service_role','public.refund_ai_credit_service(uuid,int,text,bigint)','execute') AS service_refund,
    has_function_privilege('authenticated','public.get_ai_credit_status(boolean,int,int)','execute') AS auth_status,
    has_table_privilege('authenticated','public.ai_daily_credit_wallets','insert') AS auth_insert,
    has_table_privilege('authenticated','public.ai_daily_credit_wallets','update') AS auth_update`)
  assert(!privileges.auth_ensure && !privileges.service_ensure && !privileges.auth_consume && !privileges.anon_refund && !privileges.auth_insert && !privileges.auth_update, 'private mutation permissions exposed')
  assert(privileges.service_consume && privileges.service_refund && privileges.auth_status, 'expected RPC permissions missing')
  await status(ids.free)
  await db.exec('SET ROLE authenticated')
  const visible = (await db.query('SELECT user_id FROM public.ai_daily_credit_wallets')).rows
  assert(visible.length === 1 && visible.every((row) => row.user_id === ids.free), 'RLS exposes another user daily wallet')
  await throws(() => db.exec(`UPDATE public.ai_daily_credit_wallets SET balance=300 WHERE user_id=${q(ids.free)}`), 'client could refill daily wallet')
  await db.exec('RESET ROLE')

  // Move only the isolated DB's calendar helpers to the next date/month. Actual
  // production functions are applied above; no system clock or live DB changes.
  await execStatements(`CREATE OR REPLACE FUNCTION public.ai_credit_day_start()
    RETURNS timestamptz LANGUAGE sql STABLE SET search_path='' AS $$
    SELECT (date_trunc('day',now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai')+interval '1 day';
  $$;`)
  const nextDay = await status(ids.free)
  assert(nextDay.dailyPeriod !== day0 && nextDay.freeRemainingToday === 300, 'new day failed to issue fresh grant')
  await refund(ids.free, allDaily.receiptId, 300, 'free')
  assert(await daily(ids.free, day0) === 300 && await daily(ids.free, nextDay.dailyPeriod) === 300, 'old-day refund carried into new daily grant')
  assert((await status(ids.free)).freeRemainingToday === 300, 'daily grant accumulated across dates')

  const monthDebit = await consume(ids.founder, 10)
  await execStatements(`CREATE OR REPLACE FUNCTION public.ai_credit_month_period()
    RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
    SELECT to_char((now() AT TIME ZONE 'Asia/Shanghai')+interval '1 month','YYYY-MM');
  $$;`)
  const nextMonth = await status(ids.founder)
  assert(nextMonth.walletBalance === 20000 && nextMonth.grantPeriod !== founder.grantPeriod, 'next monthly grant stacked or used wrong tier')
  const oldMonthRefund = await refund(ids.founder, monthDebit.receiptId, 10, 'wallet')
  assert(oldMonthRefund.refunded === 10 && oldMonthRefund.appliedCredits === 0 && await wallet(ids.founder) === 20000, 'old-month refund inflated renewed wallet')
  assert((await refund(ids.founder, monthDebit.receiptId, 10, 'wallet')).refunded === 0, 'expired-month refund was not idempotent')
  assert((await status(ids.legacy)).walletBalance === 15000, 'old test wallet did not receive new allowance next month')
  await refund(ids.legacy, oldFixedAcrossMonth.receiptId, 2, 'wallet')
  assert(await wallet(ids.legacy) === 15000, 'legacy fixed refund inflated a renewed monthly wallet')
  await db.exec(`UPDATE public.profiles SET membership_tier='founder',membership_period='founder' WHERE id=${q(ids.pro)}`)
  assert((await status(ids.pro)).walletBalance === 20000, 'new-month founder promotion allowance incorrect')

  console.info(`AI credit grant SQL verification passed (${checks} assertions, isolated PGlite; multi-connection concurrency is not simulated).`)
} finally {
  await db.close()
}
