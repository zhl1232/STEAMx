#!/usr/bin/env node
// Isolated in-memory PostgreSQL only. No application env files or remote DB.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

const modulePath = process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite'
const { PGlite } = await import(modulePath.startsWith('.') || modulePath.startsWith('/') ? pathToFileURL(modulePath).href : modulePath)
const db = new PGlite('memory://tutor-total-usage-billing')
const user = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const freeUser = '00000000-0000-4000-8000-000000000003'
const lowUser = '00000000-0000-4000-8000-000000000004'
const fallbackUser = '00000000-0000-4000-8000-000000000005'
const hash = 'a'.repeat(64)
const id = (n) => `40000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const quote = (value) => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`
let checks = 0
const assert = (value, message) => { checks++; if (!value) throw new Error(message) }
const one = async (sql) => (await db.query(sql)).rows[0]
const call = async (sql) => (await one(`SELECT ${sql} AS result`)).result
const wallet = async (uid = user) => Number((await one(`SELECT balance FROM public.ai_credit_wallets WHERE user_id=${quote(uid)}`)).balance)
const count = async (table, where = 'true') => Number((await one(`SELECT count(*) AS n FROM public.${table} WHERE ${where}`)).n)
const execStatements = async (sql) => {
  for (const statement of sql.split(/(?<=\$\$);/g).map((part) => part.trim()).filter(Boolean)) await db.exec(`${statement};`)
}
const usage = (inputTokens = 80, outputTokens = 20, extra = {}) => ({
  inputTokens, outputTokens, totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
  usageMissing: false, budgetExceeded: false, budgetDeniedCalls: 0, pendingCalls: 0,
  calls: [{ callId: 1, purpose: 'main_reply', role: 'tutor-text', model: 'test', status: 'completed',
    usage: { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0) } }],
  ...extra,
})
const reserve = (n, uid = user, maxTotal = 131072, maxOutput = 8192) =>
  call(`public.reserve_tutor_usage_service(${quote(uid)},${quote(id(n))},${maxOutput},${maxTotal})`)
const settle = (receipt, snapshot = usage(), cancel = false, uid = user) =>
  call(`public.settle_tutor_usage_service(${quote(uid)},${receipt},${quote(snapshot == null ? null : JSON.stringify(snapshot))}::jsonb,${cancel})`)
const begin = (n, { uid = user, scope = '', epoch = 0, executor = randomUUID(), digest = hash, maxTotal = 131072 } = {}) =>
  call(`public.begin_tutor_usage_request_service(${quote(uid)},${quote(id(n))},${quote(digest)},'global',${quote(scope)},${epoch},8192,${quote(executor)},${maxTotal})`)
const finish = (n, snapshot = usage(), { uid = user, reply = '完整回答', clarification = false } = {}) =>
  call(`public.complete_tutor_usage_request_service(${quote(uid)},${quote(id(n))},'学生问题',ARRAY[]::text[],
    '{"usage":{"private":"discard"}}',${quote(reply)},'{"ai":{"model":"test","usage":{"private":"discard"}}}',
    ${quote(snapshot == null ? null : JSON.stringify(snapshot))}::jsonb,${clarification},'测试话题')`)
const fail = (n, uid = user) => call(`public.fail_tutor_request_service(${quote(uid)},${quote(id(n))})`)
const fallback = (n, receipt, executor, minimum = 1000, uid = fallbackUser) =>
  call(`public.fallback_tutor_usage_to_free_service(${quote(uid)},${quote(id(n))},${receipt},${quote(executor)},${minimum})`)
const throws = async (action, message) => {
  let failed = false
  try { await action() } catch { failed = true }
  assert(failed, message)
}

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
    INSERT INTO auth.users VALUES (${quote(user)}),(${quote(other)}),(${quote(freeUser)}),(${quote(lowUser)}),(${quote(fallbackUser)});
    INSERT INTO public.profiles VALUES (${quote(user)},'user','pro','monthly',now(),now()+interval '1 day'),
      (${quote(other)},'user',NULL,NULL,NULL,NULL),(${quote(freeUser)},'user',NULL,NULL,NULL,NULL),
      (${quote(lowUser)},'user','pro','monthly',now(),now()+interval '1 day'),
      (${quote(fallbackUser)},'user','pro','monthly',now(),now()+interval '1 day');
  `)
  for (const name of ['20260610151000_ai_credit_system.sql','20260610160000_fix_ai_free_refund.sql',
    '20260920120000_secure_ai_credit_accounting.sql','20260920140000_tutor_token_billing.sql',
    '20260920160000_tutor_request_lifecycle.sql']) await execStatements(await readFile(`supabase/migrations/${name}`,'utf8'))

  // Warm existing RPCs before applying v2: their public OIDs must stay intact.
  const old = await call(`public.reserve_tutor_credit_service(${quote(user)},${quote(id(1))},1000)`)
  await call(`public.settle_tutor_credit_service(${quote(user)},${old.receiptId},100,false)`)
  const oldStored = (await one(`SELECT meta FROM public.ai_credit_logs WHERE id=${old.receiptId}`)).meta
  const oldHold = await call(`public.reserve_tutor_credit_service(${quote(user)},${quote(id(2))},1000)`)
  await call(`public.begin_tutor_request_service(${quote(user)},${quote(id(3))},${quote(hash)},'global','legacy',0,8192,${quote(randomUUID())})`)
  await fail(3)
  const oldOid = (await one("SELECT 'public.settle_tutor_credit_service(uuid,bigint,int,boolean)'::regprocedure::oid AS oid")).oid
  await execStatements(await readFile('supabase/migrations/20261012160000_tutor_total_usage_billing.sql','utf8'))
  assert((await one("SELECT 'public.settle_tutor_credit_service(uuid,bigint,int,boolean)'::regprocedure::oid AS oid")).oid === oldOid, 'legacy RPC OID changed')
  assert(JSON.stringify((await one(`SELECT meta FROM public.ai_credit_logs WHERE id=${old.receiptId}`)).meta) === JSON.stringify(oldStored), 'migration rewrote a settled legacy receipt')
  const legacyDone = await call(`public.settle_tutor_credit_service(${quote(user)},${oldHold.receiptId},1000,false)`)
  assert(Number(legacyDone.chargedCredits) === 1, 'old pending receipt lost the 1000-output tariff')
  assert((await reserve(2)).error === 'billing_version_mismatch', 'same request acquired old and new receipts')
  assert(Number((await call(`public.settle_tutor_credit_service(${quote(user)},${old.receiptId},8192,false)`)).chargedCredits) === .1, 'legacy replay was repriced')

  const before = await wallet()
  const executor = randomUUID()
  const first = await begin(10,{ executor })
  assert(first.status === 'started' && first.maxOutputTokens === 8192 && first.maxTotalTokens === 131072 && Number(first.reservedCredits) === 1310.72, 'new admission budgets incorrect')
  const recovered = await begin(10,{ executor,maxTotal:100 })
  assert(recovered.receiptId === first.receiptId && recovered.maxTotalTokens === first.maxTotalTokens, 'same executor did not recover exact reservation')
  assert((await begin(10)).status === 'processing', 'HTTP duplicate re-entered execution')
  assert((await begin(10,{ digest:'b'.repeat(64) })).status === 'conflict', 'changed request payload accepted')
  assert((await begin(11)).status === 'busy', 'same topic admitted simultaneous work')
  const independentUser = await begin(10,{uid:other})
  assert(independentUser.status === 'started' && independentUser.receiptId !== first.receiptId, 'request identity was not scoped to authenticated user')
  await fail(10,other)
  assert((await settle(first.receiptId,usage(),false,other)).error === 'invalid_receipt', 'another user settled this receipt')
  assert((await call(`public.settle_tutor_credit_service(${quote(user)},${first.receiptId},100,false)`)).error === 'billing_version_mismatch', 'legacy normal settlement accepted a new receipt')
  assert((await call(`public.refund_ai_credit_service(${quote(user)},1,'wallet',${first.receiptId})`)).error === 'invalid_receipt', 'fixed-price refund accepted a tutor receipt')

  const allCalls = usage(10000,600,{ calls:[
    { callId:1,purpose:'main_reply',inputTokens:8000,outputTokens:500,totalTokens:8500 },
    { callId:2,purpose:'tool_planner',inputTokens:2000,outputTokens:100,totalTokens:2100 },
  ] })
  const saved = await finish(10,allCalls)
  assert(saved.status === 'completed' && Number(saved.message.meta.billing.chargedCredits) === allCalls.totalTokens/100, 'total usage was not billed at 100:1')
  assert(Math.abs((await wallet())-(before-106))<1e-9, 'reserved balance did not refund to actual charge')
  assert(Object.keys(saved.message.meta.billing).sort().join(',') === 'chargedCredits,receiptId,source', 'customer billing contains token internals')
  assert(!saved.message.meta.usage && !saved.message.meta.ai.usage, 'assistant message exposes raw usage')
  const privateUsage = await one(`SELECT usage,actual_total_tokens,budget_overrun_tokens FROM public.tutor_usage_records WHERE receipt_id=${first.receiptId}`)
  assert(privateUsage.usage.calls.length === 2 && Number(privateUsage.actual_total_tokens) === 10600 && Number(privateUsage.budget_overrun_tokens) === 0, 'private call usage missing')
  const logMeta = (await one(`SELECT meta FROM public.ai_credit_logs WHERE id=${first.receiptId}`)).meta
  assert(!('usage' in logMeta) && !('totalTokens' in logMeta) && !('outputTokens' in logMeta) && !('maxTotalTokens' in logMeta), 'customer-readable credit log exposes token internals')
  assert((await finish(10,usage(),{reply:'重复文本'})).message.content === '完整回答', 'duplicate completion overwrote saved result')
  assert((await fail(10)).status === 'completed', 'late failure canceled completed charge')
  assert((await begin(10)).message.content === '完整回答', 'saved response cannot be replayed')
  assert(await count('tutor_messages',`conversation_id=${quote(first.conversation.id)}`) === 2, 'messages duplicated')

  const fraction = await reserve(20,user,1000)
  assert(Number((await settle(fraction.receiptId,usage(71,32))).chargedCredits) === 1.03, 'fractional tariff rounded to whole credits')
  const missing = await reserve(21,user,1000)
  assert(Number((await settle(missing.receiptId,usage(100,50,{usageMissing:true,calls:[{callId:1,totalTokens:150},{callId:2,usage:null}]}))).chargedCredits) === 1.5, 'one missing call waived verifiable calls')
  const totalOnly = await reserve(22,user,1000)
  assert(Number((await settle(totalOnly.receiptId,usage(null,null,{totalTokens:123}))).chargedCredits) === 1.23, 'verified total-only usage rejected or waived')
  const unknown = await reserve(23,user,1000)
  assert(Number((await settle(unknown.receiptId,null)).chargedCredits) === 0, 'unknown usage was estimated for charging')

  const invalid = await reserve(24,user,1000)
  const invalidBefore = await wallet()
  for (const snapshot of [usage(-1,101),usage(1.5,98.5),usage(80,20,{totalTokens:101}),
    usage(null,null,{totalTokens:9007199254740992}),usage(200,null,{totalTokens:100}),
    usage(80,20,{pendingCalls:1}),usage(80,20,{calls:{}}),usage(80,20,{inputTokens:'80'})]) {
    assert((await settle(invalid.receiptId,snapshot)).error === 'invalid_usage', `invalid usage accepted: ${JSON.stringify(snapshot)}`)
  }
  assert(await wallet() === invalidBefore && (await one(`SELECT meta->>'state' AS state FROM public.ai_credit_logs WHERE id=${invalid.receiptId}`)).state === 'reserved', 'invalid settlement mutated reservation')
  await settle(invalid.receiptId,null,true)

  const clarify = await begin(30,{scope:'clarification'})
  const clarified = await finish(30,usage(600,40),{clarification:true,reply:'你想问哪个步骤？'})
  assert(Number(clarified.message.meta.billing.chargedCredits) === 6.4, 'successful clarification waived planner costs')
  const failureBefore = await wallet()
  const failed = await begin(31,{scope:'failure'})
  assert((await fail(31)).status === 'failed' && await wallet() === failureBefore, 'old cached fail RPC failed to cancel new receipt')
  assert((await fail(31)).status === 'failed' && await wallet() === failureBefore, 'failure refund was not idempotent')
  const atomic = await begin(32,{scope:'atomic'})
  const atomicBefore = await wallet()
  await throws(() => finish(32,usage(),{reply:'FAIL_INSERT'}), 'message insert failure did not abort completion')
  assert(await wallet() === atomicBefore && await count('tutor_messages',`conversation_id=${quote(atomic.conversation.id)}`) === 0, 'failed persistence committed partial charge/messages')
  assert((await one(`SELECT usage FROM public.tutor_usage_records WHERE receipt_id=${atomic.receiptId}`)).usage == null, 'failed transaction saved usage')
  await fail(32)

  await call(`public.reserve_tutor_credit_service(${quote(lowUser)},${quote(id(40))},1)`)
  await db.exec(`UPDATE public.ai_credit_wallets SET balance=0.019 WHERE user_id=${quote(lowUser)}`)
  const capped = await reserve(41,lowUser)
  assert(capped.maxOutputTokens === 8192 && capped.maxTotalTokens === 1 && Number(capped.reservedCredits) === .019, 'low balance mixed output/total budgets')
  const cappedDone = await settle(capped.receiptId,usage(1000,200,{budgetExceeded:true}),false,lowUser)
  const cappedRecord = await one(`SELECT actual_total_tokens,budget_overrun_tokens FROM public.tutor_usage_records WHERE receipt_id=${capped.receiptId}`)
  assert(Number(cappedDone.chargedCredits) === .01 && await wallet(lowUser) === .009, 'over-budget charge over-drafted wallet')
  assert(Number(cappedRecord.actual_total_tokens) === 1200 && Number(cappedRecord.budget_overrun_tokens) === 1199, 'provider overrun was lost')
  const lowFree = await reserve(42,lowUser)
  assert(lowFree.source === 'free' && lowFree.maxTotalTokens === 131072, 'sub-token balance did not use a free turn')
  await settle(lowFree.receiptId,null,true,lowUser)

  const freeCanceled = await begin(50,{uid:freeUser})
  await fail(50,freeUser)
  assert(Number((await one(`SELECT public.count_ai_free_chats_today(${quote(freeUser)}) AS n`)).n) === 0, 'cancel did not restore free turn')
  for (let n=51;n<=55;n++) {
    const free = await reserve(n,freeUser)
    assert(free.ok && free.source === 'free', 'free turn not admitted')
    assert(Number((await settle(free.receiptId,n===51?null:usage(),false,freeUser)).chargedCredits) === 0, 'free turn charged credits')
  }
  assert((await reserve(56,freeUser)).error === 'quota_exceeded', 'more than five free turns admitted')
  await db.exec(`SELECT set_config('request.jwt.claim.sub',${quote(lowUser)},false)`)
  for (let n=60;n<65;n++) {
    const free = await reserve(n,lowUser)
    await settle(free.receiptId,usage(),false,lowUser)
  }
  assert((await call('public.get_ai_credit_status(true,999999,999999)')).canChat === false, 'canChat ignored minimum .01 or trusted client grants')

  const expiryBefore = await wallet()
  const expired = await begin(70,{scope:'expiry'})
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('expiresAt',now()-interval '1 minute') WHERE id=${expired.receiptId}`)
  await db.exec(`SELECT set_config('request.jwt.claim.sub',${quote(user)},false)`)
  await call('public.get_ai_credit_status(false,1,1)')
  assert(await wallet() === expiryBefore, 'status did not release a new expired hold')
  assert((await finish(70)).status === 'failed' && await count('tutor_messages',`conversation_id=${quote(expired.conversation.id)}`) === 0, 'late expired work was saved')
  const mixedBefore = await wallet()
  const expiredOld = await call(`public.reserve_tutor_credit_service(${quote(user)},${quote(id(73))},1000)`)
  const expiredNew = await reserve(74,user,1000)
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('expiresAt',now()-interval '1 minute') WHERE id IN (${expiredOld.receiptId},${expiredNew.receiptId})`)
  await call('public.get_ai_credit_status(false,1,1)')
  assert(await wallet() === mixedBefore, 'shared status path failed to release both tariff versions')
  assert((await call(`public.settle_tutor_credit_service(${quote(user)},${expiredOld.receiptId},100,false)`)).state === 'expired' && (await settle(expiredNew.receiptId)).state === 'expired', 'mixed expiry receipts were not terminal')
  const directExpired = await reserve(75,user,1000)
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('expiresAt',now()-interval '1 minute') WHERE id=${directExpired.receiptId}`)
  assert((await settle(directExpired.receiptId)).state === 'expired' && await wallet() === mixedBefore, 'direct settlement did not release expired hold')
  const expiredFree = await reserve(76,other)
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('expiresAt',now()-interval '1 minute') WHERE id=${expiredFree.receiptId}`)
  const fixedAfterExpiredFree = await call(`public.consume_ai_credit_service(${quote(other)},5)`)
  assert(fixedAfterExpiredFree.source === 'free' && Number((await one(`SELECT public.count_ai_free_chats_today(${quote(other)}) AS n`)).n) === 1, 'fixed-price path did not release expired free tutor hold')
  const rollover = await reserve(71,user,1000)
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('grantPeriod','old-period') WHERE id=${rollover.receiptId}; UPDATE public.ai_credit_wallets SET grant_period='old-period' WHERE user_id=${quote(user)}`)
  const newMonth = await reserve(72,user,1000)
  assert(await wallet() === 1490 && (await settle(rollover.receiptId)).state === 'expired' && await wallet() === 1490, 'old-period refund inflated new monthly grant')
  await settle(newMonth.receiptId,null,true)
  const fixed = await call(`public.consume_ai_credit_service(${quote(user)},5)`)
  assert(Number(fixed.cost) === 5 && await wallet() === 1495, 'PBL fixed-price billing changed')

  const archived = await begin(80,{scope:'delete'})
  await call(`public.archive_tutor_chat_service(${quote(user)},'global','delete',0)`)
  const deletionBefore = await wallet()
  assert((await call(`public.delete_tutor_conversation_service(${quote(user)},${quote(archived.conversation.id)})`)).status === 'deleted', 'delete failed with new in-flight receipt')
  assert(Math.abs((await wallet())-(deletionBefore+Number(archived.reservedCredits)))<1e-9 && (await finish(80)).status === 'failed', 'delete did not cancel new in-flight work')

  // Recover a wallet that can fund tokens, but cannot fit the main prompt. A
  // single free turn covers this entire request, including earlier planner work.
  await db.exec(`INSERT INTO public.ai_credit_wallets(user_id,balance,grant_period) VALUES(${quote(fallbackUser)},.5,public.ai_credit_month_period())`)
  const fallbackExecutor = randomUUID()
  const lowAdmitted = await begin(90,{uid:fallbackUser,executor:fallbackExecutor})
  assert(lowAdmitted.maxTotalTokens === 50 && await wallet(fallbackUser) === 0, 'fallback fixture did not admit low wallet')
  assert((await fallback(90,lowAdmitted.receiptId,randomUUID())).error === 'invalid_request', 'wrong executor converted funding')
  assert((await fallback(90,first.receiptId,fallbackExecutor)).error === 'invalid_request', 'wrong receipt converted funding')
  assert((await fallback(90,lowAdmitted.receiptId,fallbackExecutor,50)).error === 'budget_not_increased', 'fallback accepted a budget already sufficient')
  assert((await fallback(90,lowAdmitted.receiptId,fallbackExecutor,131073)).error === 'invalid_params', 'fallback accepted a prompt beyond free budget')
  assert(await wallet(fallbackUser) === 0, 'rejected fallback changed wallet')
  const recoveredFree = await fallback(90,lowAdmitted.receiptId,fallbackExecutor)
  assert(recoveredFree.ok && recoveredFree.source === 'free' && recoveredFree.receiptId === lowAdmitted.receiptId && recoveredFree.maxTotalTokens === 131072, 'fallback did not preserve request/receipt')
  assert(await wallet(fallbackUser) === .5, 'fallback did not fully release wallet hold')
  const quotaChild = (await one(`SELECT free_quota_receipt_id FROM public.tutor_usage_records WHERE receipt_id=${lowAdmitted.receiptId}`)).free_quota_receipt_id
  const fallbackRetry = await fallback(90,lowAdmitted.receiptId,fallbackExecutor)
  assert(fallbackRetry.ok && await wallet(fallbackUser) === .5 && (await one(`SELECT free_quota_receipt_id FROM public.tutor_usage_records WHERE receipt_id=${lowAdmitted.receiptId}`)).free_quota_receipt_id === quotaChild, 'fallback retry duplicated refunds or quota')
  assert(Number((await one(`SELECT public.count_ai_free_chats_today(${quote(fallbackUser)}) AS n`)).n) === 1, 'fallback did not consume exactly one free turn')
  const reserveFreeRetry = await reserve(90,fallbackUser)
  assert(reserveFreeRetry.source === 'free' && reserveFreeRetry.maxTotalTokens === 131072 && Number(reserveFreeRetry.reservedCredits) === 1, 'reserve replay lost converted free source')
  assert((await begin(90,{uid:fallbackUser,executor:fallbackExecutor})).maxTotalTokens === 131072, 'request replay kept stale wallet budget')
  const freeSaved = await finish(90,usage(450,50,{calls:[{callId:1,purpose:'tool_planner',totalTokens:200},{callId:2,purpose:'main_reply',totalTokens:300}]}),{uid:fallbackUser})
  assert(freeSaved.message.meta.billing.source === 'free' && Number(freeSaved.message.meta.billing.chargedCredits) === 0 && await wallet(fallbackUser) === .5, 'converted free turn charged wallet again')
  const auditPair = await one(`SELECT reason,amount,meta->>'source' AS source FROM public.ai_credit_logs WHERE id=${lowAdmitted.receiptId}`)
  assert(auditPair.reason === 'credit_chat' && Number(auditPair.amount) === -.5 && auditPair.source === 'free', 'conversion rewrote original wallet debit')
  assert((await one(`SELECT meta->>'state' AS state FROM public.ai_credit_logs WHERE id=${quotaChild}`)).state === 'quota_consumed', 'quota child entered normal settled state')
  assert(Number((await one(`SELECT actual_total_tokens FROM public.tutor_usage_records WHERE receipt_id=${lowAdmitted.receiptId}`)).actual_total_tokens) === 500, 'conversion discarded preceding model usage')
  assert(await count('ai_credit_logs',`user_id=${quote(fallbackUser)} AND meta->>'billing'='tutor_total_tokens' AND meta->>'state'='settled'`) === 1, 'quota child would double-count admin usage')

  const cancelExecutor = randomUUID()
  const convertedCancel = await begin(91,{uid:fallbackUser,scope:'cancel',executor:cancelExecutor})
  await fallback(91,convertedCancel.receiptId,cancelExecutor)
  await fail(91,fallbackUser)
  await fail(91,fallbackUser)
  assert(await wallet(fallbackUser) === .5 && Number((await one(`SELECT public.count_ai_free_chats_today(${quote(fallbackUser)}) AS n`)).n) === 1, 'converted failure refunded wallet twice or lost free refund')
  const expiryExecutor = randomUUID()
  const convertedExpiry = await begin(92,{uid:fallbackUser,scope:'expiry',executor:expiryExecutor})
  await fallback(92,convertedExpiry.receiptId,expiryExecutor)
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('expiresAt',now()-interval '1 minute') WHERE id=${convertedExpiry.receiptId}; SELECT set_config('request.jwt.claim.sub',${quote(fallbackUser)},false)`)
  await call('public.get_ai_credit_status(false,1,1)')
  assert(await wallet(fallbackUser) === .5 && Number((await one(`SELECT public.count_ai_free_chats_today(${quote(fallbackUser)}) AS n`)).n) === 1, 'converted expiry refunded wallet twice or quota expiry loop failed')
  assert((await finish(92,usage(),{uid:fallbackUser})).status === 'failed', 'converted expired request persisted')

  const oldPeriodExecutor = randomUUID()
  const oldPeriodFallback = await begin(93,{uid:fallbackUser,scope:'old-month',executor:oldPeriodExecutor})
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('grantPeriod','old-period') WHERE id=${oldPeriodFallback.receiptId}; UPDATE public.ai_credit_wallets SET grant_period='old-period' WHERE user_id=${quote(fallbackUser)}`)
  assert((await fallback(93,oldPeriodFallback.receiptId,oldPeriodExecutor)).error === 'reservation_unavailable', 'old-period hold switched to free')
  assert((await one(`SELECT free_quota_receipt_id FROM public.tutor_usage_records WHERE receipt_id=${oldPeriodFallback.receiptId}`)).free_quota_receipt_id == null, 'old-period conversion consumed free quota')
  await db.exec(`UPDATE public.ai_credit_wallets SET balance=.5,grant_period=public.ai_credit_month_period() WHERE user_id=${quote(fallbackUser)}`)
  for(let n=94;n<98;n++) {
    const free = await reserve(n,other)
    await settle(free.receiptId,usage(),false,other)
    // Seed already-consumed daily turns for this isolated member fixture.
    await db.exec(`INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES(${quote(fallbackUser)},-1,'free_chat','{}')`)
  }
  const noFreeExecutor = randomUUID()
  const noFree = await begin(98,{uid:fallbackUser,scope:'exhausted',executor:noFreeExecutor})
  assert((await fallback(98,noFree.receiptId,noFreeExecutor)).error === 'quota_exceeded' && await wallet(fallbackUser) === 0, 'quota-exhausted fallback changed funding')
  await fail(98,fallbackUser)
  assert(await wallet(fallbackUser) === .5, 'failed exhausted fallback did not release original wallet')

  const privileges = await one(`SELECT
    has_function_privilege('anon','public.reserve_tutor_usage_service(uuid,uuid,int,int)','execute') AS anon_reserve,
    has_function_privilege('authenticated','public.settle_tutor_usage_service(uuid,bigint,jsonb,boolean)','execute') AS auth_settle,
    has_function_privilege('authenticated','public.begin_tutor_usage_request_service(uuid,uuid,text,text,text,bigint,int,uuid,int)','execute') AS auth_begin,
    has_function_privilege('authenticated','public.complete_tutor_usage_request_service(uuid,uuid,text,text[],jsonb,text,jsonb,jsonb,boolean,text)','execute') AS auth_complete,
    has_function_privilege('authenticated','public.fallback_tutor_usage_to_free_service(uuid,uuid,bigint,uuid,int)','execute') AS auth_fallback,
    has_function_privilege('service_role','public.fallback_tutor_usage_to_free_service(uuid,uuid,bigint,uuid,int)','execute') AS service_fallback,
    has_function_privilege('service_role','public.settle_tutor_usage_service(uuid,bigint,jsonb,boolean)','execute') AS service_settle,
    has_function_privilege('service_role','public._settle_tutor_output_credit_legacy(uuid,bigint,int,boolean)','execute') AS service_legacy_helper,
    has_table_privilege('authenticated','public.tutor_usage_records','select') AS auth_usage,
    has_table_privilege('anon','public.tutor_usage_records','select') AS anon_usage,
    has_table_privilege('service_role','public.tutor_usage_records','select') AS service_usage`)
  assert(!privileges.anon_reserve && !privileges.auth_settle && !privileges.auth_begin && !privileges.auth_complete && !privileges.auth_fallback && privileges.service_fallback && privileges.service_settle && !privileges.service_legacy_helper && !privileges.auth_usage && !privileges.anon_usage && privileges.service_usage, `privilege leak: ${JSON.stringify(privileges)}`)
  await db.exec('SET ROLE authenticated')
  await throws(() => db.query('SELECT * FROM public.tutor_usage_records'), 'authenticated user could read private usage')
  await db.exec('RESET ROLE')
  await db.exec('SET ROLE service_role')
  assert(await count('tutor_usage_records') > 0, 'service role cannot inspect private usage')
  await db.exec('RESET ROLE')
  const helpersPublic = await one(`SELECT count(*) AS n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
    WHERE s.nspname='public' AND p.proname IN ('_settle_tutor_output_credit_legacy','_release_expired_tutor_output_holds_legacy','_release_expired_tutor_holds')
      AND (has_function_privilege('anon',p.oid,'execute') OR has_function_privilege('authenticated',p.oid,'execute') OR has_function_privilege('service_role',p.oid,'execute'))`)
  assert(Number(helpersPublic.n) === 0, 'private compatibility helper is publicly callable')
  const unsafeSearchPath = await one(`SELECT count(*) AS n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
    WHERE s.nspname='public' AND p.proname IN ('reserve_tutor_usage_service','settle_tutor_usage_service','fallback_tutor_usage_to_free_service','begin_tutor_usage_request_service','complete_tutor_usage_request_service','settle_tutor_credit_service','_release_expired_tutor_holds','get_ai_credit_status')
      AND NOT ('search_path=""'=ANY(p.proconfig))`)
  assert(Number(unsafeSearchPath.n) === 0, 'new RPC left a mutable search path')
  assert(Number((await one(`SELECT balance FROM public.ai_credit_wallets WHERE user_id=${quote(user)}`)).balance)>=0, 'wallet underflow')
  console.info(`Tutor total-usage billing SQL verification passed (${checks} checks; PGlite, no multi-connection concurrency simulation).`)
} finally {
  await db.close()
}
