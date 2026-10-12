#!/usr/bin/env node
// Isolated PostgreSQL engine only; no application secrets, paid calls or remote DB.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

const modulePath = process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite'
const { PGlite } = await import(modulePath.startsWith('.') || modulePath.startsWith('/') ? pathToFileURL(modulePath).href : modulePath)
const db = new PGlite('memory://tutor-daily-credit-billing')
const users = Array.from({ length: 12 }, (_, i) => `60000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
const [member, ordinary, founder, fallbackUser, boundaryUser, other, legacyUser, legacyMember, legacyFree, atomicUser, cappedUser, partialUser] = users
const request = (n) => `61000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const quote = (value) => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`
const one = async (sql) => (await db.query(sql)).rows[0]
const call = async (sql) => (await one(`SELECT ${sql} AS result`)).result
const execStatements = async (sql) => {
  for (const statement of sql.split(/(?<=\$\$);/g).map((part) => part.trim()).filter(Boolean)) await db.exec(`${statement};`)
}
let checks = 0
const assert = (value, message) => { checks++; if (!value) throw new Error(message) }
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-8
const throws = async (action, message) => {
  let failed = false
  try { await action() } catch { failed = true }
  assert(failed, message)
}
const wallet = async (uid) => Number((await one(`SELECT balance FROM public.ai_credit_wallets WHERE user_id=${quote(uid)}`))?.balance ?? 0)
const daily = async (uid, day = '2026-10-12') => Number((await one(`SELECT balance FROM public.ai_daily_credit_wallets WHERE user_id=${quote(uid)} AND grant_day=${quote(day)}::date`))?.balance ?? 0)
const count = async (table, condition = 'true') => Number((await one(`SELECT count(*) AS n FROM public.${table} WHERE ${condition}`)).n)
const ensure = (uid) => call(`public._ensure_ai_credit_balances(${quote(uid)})`)
const setDay = (day) => call(`set_config('test.credit_day',${quote(day)},false)`)
const usage = (total = 100, extra = {}) => ({
  inputTokens: Math.max(total - 20, 0), outputTokens: Math.min(total, 20), totalTokens: total,
  usageMissing: false, budgetExceeded: false, budgetDeniedCalls: 0, pendingCalls: 0,
  calls: [{ callId: 1, purpose: 'main_reply', totalTokens: total }], ...extra,
})
const reserve = (n, uid = ordinary, maxTotal = 131072) => call(`public.reserve_tutor_usage_service(${quote(uid)},${quote(request(n))},8192,${maxTotal})`)
const settle = (receipt, snapshot = usage(), { uid = ordinary, cancel = false } = {}) =>
  call(`public.settle_tutor_usage_service(${quote(uid)},${receipt},${quote(snapshot == null ? null : JSON.stringify(snapshot))}::jsonb,${cancel})`)
const begin = (n, { uid = ordinary, executor = randomUUID(), scope = '', maxTotal = 131072 } = {}) =>
  call(`public.begin_tutor_usage_request_service(${quote(uid)},${quote(request(n))},${quote('a'.repeat(64))},'global',${quote(scope)},0,8192,${quote(executor)},${maxTotal})`)
const finish = (n, snapshot = usage(), { uid = ordinary, reply = '已完成回答' } = {}) =>
  call(`public.complete_tutor_usage_request_service(${quote(uid)},${quote(request(n))},'学生问题',ARRAY[]::text[],
    '{}',${quote(reply)},'{"ai":{"model":"test","usage":{"private":true}}}',
    ${quote(snapshot == null ? null : JSON.stringify(snapshot))}::jsonb,false,'测试话题')`)
const fail = (n, uid = ordinary) => call(`public.fail_tutor_request_service(${quote(uid)},${quote(request(n))})`)
const fallback = (n, receipt, executor, minimum, uid = fallbackUser) =>
  call(`public.fallback_tutor_usage_to_free_service(${quote(uid)},${quote(request(n))},${receipt},${quote(executor)},${minimum})`)

try {
  await execStatements(`
    CREATE SCHEMA auth;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text,membership_tier text,membership_period text,membership_started_at timestamptz,membership_expires_at timestamptz);
    CREATE TABLE public.tutor_conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),context_type text,context_id text DEFAULT '',title text DEFAULT '小迪对话',status text DEFAULT 'active',meta jsonb DEFAULT '{}',summary text DEFAULT '',summary_message_id bigint,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),archived_at timestamptz);
    CREATE UNIQUE INDEX ON public.tutor_conversations(user_id,context_type,context_id) WHERE status='active';
    CREATE TABLE public.tutor_messages(id bigserial PRIMARY KEY,conversation_id uuid REFERENCES public.tutor_conversations(id) ON DELETE CASCADE,user_id uuid,context_type text,context_id text,role text,content text CHECK(content IS DISTINCT FROM 'FAIL_INSERT'),images text[],meta jsonb NOT NULL DEFAULT '{}',created_at timestamptz DEFAULT now());
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    INSERT INTO auth.users VALUES ${users.map((uid) => `(${quote(uid)})`).join(',')};
    INSERT INTO public.profiles(id,role,membership_tier,membership_period,membership_started_at,membership_expires_at)
      VALUES ${users.map((uid) => `(${quote(uid)},'user','free','none',NULL,NULL)`).join(',')};
    UPDATE public.profiles SET membership_tier='pro',membership_period='monthly',membership_started_at=now(),membership_expires_at=now()+interval '40 days'
      WHERE id IN (${[member, fallbackUser, legacyMember].map(quote).join(',')});
    UPDATE public.profiles SET membership_tier='founder',membership_period='founder' WHERE id=${quote(founder)};
  `)
  for (const name of ['20260610151000_ai_credit_system.sql','20260610160000_fix_ai_free_refund.sql',
    '20260920120000_secure_ai_credit_accounting.sql','20260920140000_tutor_token_billing.sql',
    '20260920160000_tutor_request_lifecycle.sql','20261012160000_tutor_total_usage_billing.sql']) {
    await execStatements(await readFile(`supabase/migrations/${name}`, 'utf8'))
  }
  // Control only grant calendars for boundary scenarios, without changing the
  // production SQL under test or simulating clock-expired requests as active.
  await execStatements(`
    CREATE OR REPLACE FUNCTION public.ai_credit_day_start() RETURNS timestamptz
    LANGUAGE sql STABLE SET search_path='' AS $$
      SELECT COALESCE(NULLIF(current_setting('test.credit_day',true),''),'2026-10-12')::date::timestamp AT TIME ZONE 'Asia/Shanghai'
    $$;
    CREATE OR REPLACE FUNCTION public.ai_credit_month_period() RETURNS text
    LANGUAGE sql STABLE SET search_path='' AS $$ SELECT to_char(public.ai_credit_day_start() AT TIME ZONE 'Asia/Shanghai','YYYY-MM') $$;
  `)
  await setDay('2026-10-12')
  const oldOutput = await call(`public.reserve_tutor_credit_service(${quote(legacyMember)},${quote(request(1))},1000)`)
  const oldFree = await reserve(2, legacyUser)
  const oldSettled = await reserve(3, legacyFree)
  const oldDone = await settle(oldSettled.receiptId, usage(7500), { uid: legacyFree })
  assert(oldDone.chargedCredits === 0, 'legacy fixture was not free by turn')
  const oldStored = (await one(`SELECT meta FROM public.ai_credit_logs WHERE id=${oldSettled.receiptId}`)).meta
  const legacyExecutor = randomUUID()
  await db.exec(`UPDATE public.ai_credit_wallets SET balance=.5 WHERE user_id=${quote(legacyMember)}`)
  const oldFallback = await begin(4, { uid: legacyMember, executor: legacyExecutor, scope: 'legacy-fallback' })
  const signatures = ['reserve_tutor_usage_service(uuid,uuid,int,int)','settle_tutor_usage_service(uuid,bigint,jsonb,boolean)',
    'fallback_tutor_usage_to_free_service(uuid,uuid,bigint,uuid,int)',
    'begin_tutor_usage_request_service(uuid,uuid,text,text,text,bigint,int,uuid,int)',
    'settle_tutor_credit_service(uuid,bigint,int,boolean)']
  const oids = new Map()
  for (const signature of signatures) oids.set(signature, (await one(`SELECT ${quote(`public.${signature}`)}::regprocedure::oid AS oid`)).oid)
  await execStatements(await readFile('supabase/migrations/20261012170000_ai_credit_grants.sql', 'utf8'))
  await execStatements(await readFile('supabase/migrations/20261012171000_tutor_daily_credit_billing.sql', 'utf8'))
  for (const signature of signatures) assert((await one(`SELECT ${quote(`public.${signature}`)}::regprocedure::oid AS oid`)).oid === oids.get(signature), `public OID changed: ${signature}`)

  const proStatus = await ensure(member)
  const founderStatus = await ensure(founder)
  assert(proStatus.monthlyGrant === 15000 && await wallet(member) === 15000, 'ordinary member did not receive 15000')
  assert(founderStatus.monthlyGrant === 20000 && await wallet(founder) === 20000, 'founder did not receive 20000')
  assert(proStatus.freeDaily === 300 && proStatus.creditUnit === 'credits', 'daily draft grant/unit incorrect')
  const firstMember = await reserve(10, member)
  assert(firstMember.source === 'wallet' && firstMember.maxTotalTokens === 131072 && near(firstMember.reservedCredits, 1310.72), 'monthly wallet was not selected first')
  assert(await daily(member) === 300, 'monthly request also consumed daily credits')
  await settle(firstMember.receiptId, usage(6000), { uid: member })
  assert(await wallet(member) === 14940 && await daily(member) === 300, 'member charge stacked or used wrong tariff')

  const canceled = await begin(20)
  assert(canceled.maxTotalTokens === 30000 && canceled.reservedCredits === 100 && canceled.creditUnit === 'credits' && canceled.creditPolicy === 'daily_credits_v1' && canceled.dailyChargeCap === 100, 'daily sponsorship was not bounded and explicitly identified')
  assert(await daily(ordinary) === 200, 'one daily hold reserved more than its 100-credit charge cap')
  assert((await fail(20)).status === 'failed' && await daily(ordinary) === 300, 'failure did not return daily hold')
  assert((await fail(20)).status === 'failed' && await daily(ordinary) === 300, 'repeated failure refunded twice')
  // Six successful turns remain possible when their actual sum fits 300; the
  // seventh is rejected because of money, not because a five-turn counter ran.
  for (let n = 21; n <= 26; n++) {
    const hold = await reserve(n)
    assert(hold.ok && hold.source === 'free' && hold.maxTotalTokens === 30000 && hold.reservedCredits === Math.min((27 - n) * 50, 100), 'daily sponsorship or remaining debit cap incorrect')
    const result = await settle(hold.receiptId, usage(5000))
    assert(result.source === 'free' && result.chargedCredits === 50, 'daily turn did not charge total tokens at 100:1')
  }
  assert(await daily(ordinary) === 0 && (await reserve(27)).error === 'quota_exceeded', 'daily exhaustion did not enforce amount')
  const exhaustedStatus = await ensure(ordinary)
  assert(exhaustedStatus.freeRemainingToday === 0 && exhaustedStatus.freeUsedToday === 300 && exhaustedStatus.canChat === false, 'status still reports free turn units')

  // One long answer cannot consume the whole daily grant. The execution limit
  // and the customer charge cap are different, explicitly bounded quantities.
  for (const [n, total, expectedSubsidy] of [[90, 18000, 80], [91, 30000, 200], [92, 30000, 200]]) {
    const capped = await reserve(n, cappedUser)
    assert(capped.ok && capped.reservedCredits === 100 && capped.maxTotalTokens === 30000 && capped.dailyChargeCap === 100, 'long daily turn did not retain capped admission')
    const done = await settle(capped.receiptId, usage(total), { uid: cappedUser })
    assert(done.chargedCredits === 100, 'long daily turn charged more than 100 credits')
    const privateRecord = await one(`SELECT usage,actual_total_tokens,budget_overrun_tokens FROM public.tutor_usage_records WHERE receipt_id=${capped.receiptId}`)
    assert(privateRecord.usage.sponsoredCredits === expectedSubsidy && privateRecord.actual_total_tokens === total && privateRecord.budget_overrun_tokens === 0, 'platform sponsorship was lost or confused with provider overrun')
    assert(!(await one(`SELECT meta FROM public.ai_credit_logs WHERE id=${capped.receiptId}`)).meta.sponsoredCredits, 'public ledger exposed internal sponsorship calculation')
  }
  assert(await daily(cappedUser) === 0 && (await reserve(93, cappedUser)).error === 'quota_exceeded', 'three capped charges did not exhaust the 300-credit day')
  await ensure(partialUser)
  await db.exec(`UPDATE public.ai_daily_credit_wallets SET balance=45 WHERE user_id=${quote(partialUser)} AND grant_day='2026-10-12'`)
  const partial = await reserve(94, partialUser)
  assert(partial.reservedCredits === 45 && partial.maxTotalTokens === 30000 && partial.dailyChargeCap === 100, 'partial daily balance removed bounded platform sponsorship')
  assert((await settle(partial.receiptId, usage(18000), { uid: partialUser })).chargedCredits === 45 && await daily(partialUser) === 0, 'partial balance was overdrafted')
  assert((await one(`SELECT usage FROM public.tutor_usage_records WHERE receipt_id=${partial.receiptId}`)).usage.sponsoredCredits === 135, 'partial-balance sponsorship incorrect')

  await ensure(other)
  const executor = randomUUID()
  const started = await begin(30, { uid: other, executor })
  const retry = await begin(30, { uid: other, executor, maxTotal: 1 })
  assert(retry.receiptId === started.receiptId && retry.reservedCredits === 100 && retry.maxTotalTokens === 30000 && retry.creditUnit === 'credits' && retry.dailyChargeCap === 100, 'same executor retry lost sponsored funding identity')
  assert((await begin(30, { uid: other })).status === 'processing', 'different executor entered same request')
  const reserveRetry = await reserve(30, other, 1)
  assert(reserveRetry.reservedCredits === 100 && reserveRetry.dailyChargeCap === 100 && await daily(other) === 200, 'reserve retry duplicated a daily debit')
  assert((await settle(started.receiptId, usage(), { uid: member })).error === 'invalid_receipt', 'another user settled the daily hold')
  const saved = await finish(30, usage(7103), { uid: other })
  assert(saved.status === 'completed' && near(saved.message.meta.billing.chargedCredits, 71.03) && saved.message.meta.billing.source === 'free', 'daily completed message lost charged credits')
  assert(Object.keys(saved.message.meta.billing).sort().join(',') === 'chargedCredits,receiptId,source', 'customer billing leaked policy/token internals')
  assert(!saved.message.meta.ai.usage && near(await daily(other), 228.97), 'settlement retained private usage or wrong refund')
  const settledAgain = await finish(30, usage(1), { uid: other, reply: '重复回答' })
  assert(settledAgain.message.content === '已完成回答' && near(await daily(other), 228.97), 'completion retry repriced or duplicated reply')
  assert(await count('tutor_messages', `conversation_id=${quote(started.conversation.id)}`) === 2, 'daily request saved duplicate messages')

  const bad = await reserve(31, other, 1000)
  const badBefore = await daily(other)
  for (const invalid of [usage(100, { pendingCalls: 1 }), usage(100, { totalTokens: 101 }), usage(100, { totalTokens: -1 }), usage(100, { calls: {} }), usage(100, { totalTokens: 1.5 })]) {
    assert((await settle(bad.receiptId, invalid, { uid: other })).error === 'invalid_usage', 'invalid usage finalized a daily hold')
  }
  assert(await daily(other) === badBefore, 'invalid usage changed daily balance')
  await settle(bad.receiptId, null, { uid: other, cancel: true })
  const unknown = await reserve(32, other, 1000)
  assert((await settle(unknown.receiptId, null, { uid: other })).chargedCredits === 0, 'missing usage was estimated for a daily charge')
  const mixed = await reserve(33, other, 1000)
  assert((await settle(mixed.receiptId, usage(120, { usageMissing: true, calls: [{ callId: 1, totalTokens: 120 }, { callId: 2, usage: null }] }), { uid: other })).chargedCredits === 1.2, 'missing auxiliary usage erased verified daily charge')
  await db.exec(`UPDATE public.ai_daily_credit_wallets SET balance=.019 WHERE user_id=${quote(other)} AND grant_day='2026-10-12'`)
  const dust = await reserve(34, other)
  assert(dust.maxTotalTokens === 30000 && near(dust.reservedCredits, .019), 'small remaining balance incorrectly expanded customer debit')
  const dustDone = await settle(dust.receiptId, usage(1200), { uid: other })
  assert(near(dustDone.chargedCredits, .019) && await daily(other) === 0, 'small remaining daily balance was overdrafted')
  const dustRecord = await one(`SELECT usage,budget_overrun_tokens FROM public.tutor_usage_records WHERE receipt_id=${dust.receiptId}`)
  assert(near(dustRecord.usage.sponsoredCredits, 11.981) && dustRecord.budget_overrun_tokens === 0, 'partial-credit sponsorship was confused with overrun')
  assert((await reserve(35, other)).error === 'quota_exceeded', 'less than one-token balance was admitted')

  const atomic = await begin(40, { uid: atomicUser })
  const atomicBefore = await daily(atomicUser)
  await throws(() => finish(40, usage(6000), { uid: atomicUser, reply: 'FAIL_INSERT' }), 'failed message persistence did not abort transaction')
  assert(await daily(atomicUser) === atomicBefore && await count('tutor_messages', `conversation_id=${quote(atomic.conversation.id)}`) === 0, 'failed persistence partially charged or saved')
  assert((await one(`SELECT usage FROM public.tutor_usage_records WHERE receipt_id=${atomic.receiptId}`)).usage == null, 'failed transaction saved private usage')
  await fail(40, atomicUser)
  assert(await daily(atomicUser) === 300, 'atomic failed request did not release full daily credits')
  const overrunHold = await reserve(41, atomicUser)
  const overrun = await settle(overrunHold.receiptId, usage(31200, { budgetExceeded: true }), { uid: atomicUser })
  const overrunRecord = await one(`SELECT usage,budget_overrun_tokens,actual_total_tokens FROM public.tutor_usage_records WHERE receipt_id=${overrunHold.receiptId}`)
  assert(overrun.chargedCredits === 100 && await daily(atomicUser) === 200, 'provider overrun bypassed per-turn charge cap')
  assert(overrunRecord.usage.sponsoredCredits === 200 && overrunRecord.budget_overrun_tokens === 1200 && overrunRecord.actual_total_tokens === 31200, 'bounded sponsorship and excess supplier usage were not recorded separately')

  // A low monthly wallet switches the same request to a sponsored daily turn;
  // no monthly debit is added to the capped daily debit and no work is reset.
  await ensure(fallbackUser)
  await db.exec(`UPDATE public.ai_credit_wallets SET balance=.5 WHERE user_id=${quote(fallbackUser)}`)
  const fallbackExecutor = randomUUID()
  const low = await begin(50, { uid: fallbackUser, executor: fallbackExecutor })
  assert(low.source === 'wallet' && low.maxTotalTokens === 50 && await wallet(fallbackUser) === 0, 'low member fixture failed')
  assert((await fallback(50, low.receiptId, randomUUID(), 1000)).error === 'invalid_request', 'wrong executor changed funding')
  assert((await fallback(50, low.receiptId, fallbackExecutor, 50)).error === 'budget_not_increased', 'sufficient existing budget switched to daily')
  assert((await fallback(50, low.receiptId, fallbackExecutor, 30001)).error === 'quota_exceeded', 'fallback exceeded the platform sponsorship limit')
  assert(await wallet(fallbackUser) === 0 && await daily(fallbackUser) === 300, 'rejected fallback mutated balances')
  const converted = await fallback(50, low.receiptId, fallbackExecutor, 15000)
  assert(converted.ok && converted.maxTotalTokens === 30000 && converted.reservedCredits === 100 && converted.maxOutputTokens === 8192 && converted.creditUnit === 'credits' && converted.creditPolicy === 'daily_credits_v1' && converted.dailyChargeCap === 100, 'fallback failed to report bounded sponsored budget')
  assert(await wallet(fallbackUser) === .5 && await daily(fallbackUser) === 200, 'fallback did not move only its capped funding hold')
  const child = (await one(`SELECT free_quota_receipt_id FROM public.tutor_usage_records WHERE receipt_id=${low.receiptId}`)).free_quota_receipt_id
  assert(Number((await one(`SELECT amount FROM public.ai_credit_logs WHERE id=${child}`)).amount) === -100, 'fallback child exceeded the per-turn charge cap')
  const repeated = await fallback(50, low.receiptId, fallbackExecutor, 15000)
  assert(repeated.ok && repeated.maxTotalTokens === 30000 && repeated.dailyChargeCap === 100 && await wallet(fallbackUser) === .5 && await daily(fallbackUser) === 200, 'fallback retry duplicated funding')
  assert((await fallback(50, low.receiptId, fallbackExecutor, 30001)).error === 'quota_exceeded', 'fallback retry claimed unsupported minimum')
  const recovered = await begin(50, { uid: fallbackUser, executor: fallbackExecutor })
  assert(recovered.source === 'free' && recovered.reservedCredits === 100 && recovered.maxTotalTokens === 30000 && recovered.dailyChargeCap === 100, 'executor replay kept obsolete monthly funding')
  const convertedDone = await finish(50, usage(7200, { calls: [{ callId: 1, purpose: 'tool_planner', totalTokens: 200 }, { callId: 2, purpose: 'main_reply', totalTokens: 7000 }] }), { uid: fallbackUser })
  assert(convertedDone.message.meta.billing.chargedCredits === 72 && await daily(fallbackUser) === 228 && await wallet(fallbackUser) === .5, 'converted settlement discarded earlier usage or charged monthly twice')
  assert((await one(`SELECT actual_total_tokens FROM public.tutor_usage_records WHERE receipt_id=${low.receiptId}`)).actual_total_tokens === 7200, 'conversion lost prior calls')
  assert((await one(`SELECT meta->>'state' AS state FROM public.ai_credit_logs WHERE id=${child}`)).state === 'quota_consumed', 'fallback child entered ordinary settled state')
  assert(await count('ai_credit_logs', `user_id=${quote(fallbackUser)} AND meta->>'billing'='tutor_total_tokens' AND meta->>'state'='settled'`) === 1, 'parent and child double-count completed usage')

  const cancelExecutor = randomUUID()
  const cancelConverted = await begin(51, { uid: fallbackUser, executor: cancelExecutor, scope: 'cancel' })
  await fallback(51, cancelConverted.receiptId, cancelExecutor, 1000)
  await fail(51, fallbackUser)
  await fail(51, fallbackUser)
  assert(await daily(fallbackUser) === 228 && await wallet(fallbackUser) === .5, 'converted cancellation refunded monthly twice or lost daily refund')
  const expireExecutor = randomUUID()
  const expireConverted = await begin(52, { uid: fallbackUser, executor: expireExecutor, scope: 'expire' })
  await fallback(52, expireConverted.receiptId, expireExecutor, 1000)
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('expiresAt',now()-interval '1 minute') WHERE id=${expireConverted.receiptId}`)
  await ensure(fallbackUser)
  assert(await daily(fallbackUser) === 228 && await wallet(fallbackUser) === .5, 'expired fallback hold did not refund daily exactly once')
  assert((await finish(52, usage(), { uid: fallbackUser })).status === 'failed', 'expired fallback request saved messages')
  await db.exec(`UPDATE public.ai_daily_credit_wallets SET balance=9 WHERE user_id=${quote(fallbackUser)} AND grant_day='2026-10-12'`)
  const partialExecutor = randomUUID()
  const partialFallback = await begin(53, { uid: fallbackUser, executor: partialExecutor, scope: 'partial' })
  const partialConverted = await fallback(53, partialFallback.receiptId, partialExecutor, 15000)
  assert(partialConverted.ok && partialConverted.reservedCredits === 9 && partialConverted.maxTotalTokens === 30000 && partialConverted.dailyChargeCap === 100, 'partial daily fallback lost its bounded sponsored budget')
  const partialDone = await finish(53, usage(18000), { uid: fallbackUser })
  assert(partialDone.message.meta.billing.chargedCredits === 9 && await daily(fallbackUser) === 0 && await wallet(fallbackUser) === .5, 'partial daily fallback overdrafted or stacked wallet charge')
  assert((await one(`SELECT usage FROM public.tutor_usage_records WHERE receipt_id=${partialFallback.receiptId}`)).usage.sponsoredCredits === 171, 'partial fallback subsidy failed to include the whole request')
  const noFundsExecutor = randomUUID()
  const noFunds = await begin(54, { uid: fallbackUser, executor: noFundsExecutor, scope: 'no-funds' })
  assert((await fallback(54, noFunds.receiptId, noFundsExecutor, 951)).error === 'quota_exceeded', 'fallback admitted a request after daily credits were exhausted')
  await fail(54, fallbackUser)
  assert(await wallet(fallbackUser) === .5 && await daily(fallbackUser) === 0, 'unfunded recovery consumed daily balance')

  // Existing receipts preserve amounts and the old zero-charge free policy.
  assert(JSON.stringify((await one(`SELECT meta FROM public.ai_credit_logs WHERE id=${oldSettled.receiptId}`)).meta) === JSON.stringify(oldStored), 'migration rewrote old settled history')
  assert((await settle(oldSettled.receiptId, usage(20000), { uid: legacyFree })).chargedCredits === 0, 'old free replay was repriced')
  assert((await settle(oldFree.receiptId, usage(20000), { uid: legacyUser })).chargedCredits === 0, 'old pending free receipt charged daily coins')
  assert(await count('ai_daily_credit_wallets', `user_id=${quote(legacyUser)}`) === 0, 'legacy settlement invented a daily wallet')
  const oldOutputDone = await call(`public.settle_tutor_credit_service(${quote(legacyMember)},${oldOutput.receiptId},1000,false)`)
  assert(oldOutputDone.chargedCredits === 1, 'legacy output-only receipt lost original 1000:1 tariff')
  const oldConverted = await fallback(4, oldFallback.receiptId, legacyExecutor, 1000, legacyMember)
  assert(oldConverted.ok && oldConverted.maxTotalTokens === 131072 && !oldConverted.creditUnit, 'existing legacy fallback policy changed')
  assert((await finish(4, usage(8000), { uid: legacyMember })).message.meta.billing.chargedCredits === 0, 'legacy held fallback was charged new daily coins')
  assert((await call(`public.reserve_tutor_credit_service(${quote(member)},${quote(request(99))},1000)`)).ok === false, 'new output-only admission bypassed daily policy')

  // A day's unused balance stays on that day; it is neither accumulated nor
  // overwritten when an earlier in-flight request later returns its change.
  await ensure(boundaryUser)
  const yesterday = await begin(60, { uid: boundaryUser, scope: 'midnight' })
  await setDay('2026-10-13')
  const nextDay = await ensure(boundaryUser)
  assert(nextDay.freeRemainingToday === 300 && await daily(boundaryUser, '2026-10-12') === 200, 'new day reused or accumulated yesterday wallet')
  const crossing = await finish(60, usage(6400), { uid: boundaryUser })
  assert(crossing.status === 'completed' && crossing.message.meta.billing.chargedCredits === 64, 'midnight incorrectly invalidated an active hold')
  assert(await daily(boundaryUser, '2026-10-12') === 236 && await daily(boundaryUser, '2026-10-13') === 300, 'yesterday settlement increased today allowance')
  const yesterdayCancel = await reserve(61, boundaryUser, 1000)
  await setDay('2026-10-14')
  await ensure(boundaryUser)
  await settle(yesterdayCancel.receiptId, null, { uid: boundaryUser, cancel: true })
  assert(await daily(boundaryUser, '2026-10-13') === 300 && await daily(boundaryUser, '2026-10-14') === 300, 'cross-day cancellation refunded current day')
  const dayExpiry = await reserve(62, boundaryUser, 1000)
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('expiresAt',now()-interval '1 minute') WHERE id=${dayExpiry.receiptId}`)
  await setDay('2026-10-15')
  await ensure(boundaryUser)
  assert(await daily(boundaryUser, '2026-10-14') === 300 && await daily(boundaryUser, '2026-10-15') === 300, 'cross-day expiry inflated new day grant')
  assert((await settle(dayExpiry.receiptId, usage(), { uid: boundaryUser })).state === 'expired', 'expired daily receipt did not remain terminal')

  await setDay('2026-10-31')
  const oldMonthDaily = await reserve(70, boundaryUser, 1000)
  const oldMonthWallet = await reserve(71, member, 1000)
  await setDay('2026-11-01')
  await ensure(boundaryUser)
  await ensure(member)
  assert(await daily(boundaryUser, '2026-10-31') === 300 && await daily(boundaryUser, '2026-11-01') === 300, 'month-boundary daily refund changed new grant')
  assert(await wallet(member) === 15000, 'old month refund inflated new monthly grant')
  assert((await settle(oldMonthDaily.receiptId, usage(900), { uid: boundaryUser })).state === 'expired', 'old month daily hold escaped existing request boundary')
  assert((await settle(oldMonthWallet.receiptId, usage(900), { uid: member })).state === 'expired' && await wallet(member) === 15000, 'late old monthly settlement changed new wallet')
  // Failed/replayed calls cannot redirect service-only mutation to another user.
  const privileges = await one(`SELECT
    has_function_privilege('anon','public.reserve_tutor_usage_service(uuid,uuid,int,int)','execute') AS anon_reserve,
    has_function_privilege('authenticated','public.settle_tutor_usage_service(uuid,bigint,jsonb,boolean)','execute') AS auth_settle,
    has_function_privilege('authenticated','public.fallback_tutor_usage_to_free_service(uuid,uuid,bigint,uuid,int)','execute') AS auth_fallback,
    has_function_privilege('service_role','public.settle_tutor_usage_service(uuid,bigint,jsonb,boolean)','execute') AS service_settle,
    has_function_privilege('service_role','public._settle_tutor_total_usage_legacy(uuid,bigint,jsonb,boolean)','execute') AS service_helper,
    has_function_privilege('authenticated','public._fallback_tutor_total_usage_legacy(uuid,uuid,bigint,uuid,int)','execute') AS auth_helper,
    has_table_privilege('authenticated','public.ai_daily_credit_wallets','update') AS auth_daily_update,
    has_table_privilege('authenticated','public.tutor_usage_records','select') AS auth_usage`)
  assert(!privileges.anon_reserve && !privileges.auth_settle && !privileges.auth_fallback && privileges.service_settle && !privileges.service_helper && !privileges.auth_helper && !privileges.auth_daily_update && !privileges.auth_usage, `privilege leak: ${JSON.stringify(privileges)}`)
  const unsafe = await one(`SELECT count(*) AS n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
    WHERE s.nspname='public' AND p.proname IN ('reserve_tutor_usage_service','settle_tutor_usage_service','fallback_tutor_usage_to_free_service','begin_tutor_usage_request_service','_settle_tutor_total_usage_legacy','_fallback_tutor_total_usage_legacy')
      AND NOT ('search_path=""'=ANY(p.proconfig))`)
  assert(Number(unsafe.n) === 0, 'daily RPC has mutable search_path')
  await db.exec('SET ROLE authenticated')
  await throws(() => db.query('SELECT * FROM public.tutor_usage_records'), 'authenticated user read private usage')
  await throws(() => db.query('UPDATE public.ai_daily_credit_wallets SET balance=999999'), 'authenticated user altered daily wallet')
  await db.exec('RESET ROLE')
  assert(await count('ai_daily_credit_wallets', 'balance<0') === 0 && await count('ai_credit_wallets', 'balance<0') === 0, 'a wallet became negative')
  console.info(`Tutor daily-credit billing SQL verification passed (${checks} checks; PGlite, no multi-connection concurrency simulation).`)
} catch (error) {
  console.error(`Tutor daily-credit verification failed after ${checks} checks: ${error.message}`)
  if (error.where) console.error(error.where)
  if (error.position && error.query) {
    const position = Number(error.position)
    console.error(error.query.slice(Math.max(0, position - 120), position + 180))
  }
  process.exitCode = 1
} finally {
  await db.close()
}
