#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const modulePath = process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite'
const { PGlite } = await import(modulePath.startsWith('.') || modulePath.startsWith('/') ? pathToFileURL(modulePath).href : modulePath)
const ids = {
  user: '00000000-0000-0000-0000-000000000001',
  admin: '00000000-0000-0000-0000-000000000002',
}
const db = new PGlite('memory://tutor-token-billing')
const migrations = [
  'supabase/migrations/20260610151000_ai_credit_system.sql',
  'supabase/migrations/20260610160000_fix_ai_free_refund.sql',
  'supabase/migrations/20260920120000_secure_ai_credit_accounting.sql',
  'supabase/migrations/20260920140000_tutor_token_billing.sql',
]
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const rows = async (sql) => (await db.query(sql)).rows
const one = async (sql) => (await rows(sql))[0]
const call = async (sql) => (await one(sql)).result
const execStatements = async (sql) => {
  for (const statement of sql.split(/(?<=\$\$);/g).map((part) => part.trim()).filter(Boolean)) await db.exec(`${statement};`)
}

try {
  await execStatements(`
    CREATE SCHEMA auth;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, role text, membership_tier text, membership_period text, membership_started_at timestamptz, membership_expires_at timestamptz);
    CREATE TABLE public.tutor_messages(id bigserial PRIMARY KEY, user_id uuid, role text, meta jsonb NOT NULL DEFAULT '{}'::jsonb);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    INSERT INTO auth.users VALUES ('${ids.user}'), ('${ids.admin}');
    INSERT INTO public.profiles VALUES ('${ids.user}','user','pro','monthly',now(),now()+interval '1 day'), ('${ids.admin}','admin','founder','founder',now(),NULL);
  `)
  for (const file of migrations) await execStatements(await readFile(file, 'utf8'))
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${ids.user}',false)`)
  const hundred = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','10000000-0000-0000-0000-000000000000',100) AS result`)
  const hundredDone = await call(`SELECT public.settle_tutor_credit_service('${ids.user}',${hundred.receiptId},100,false) AS result`)
  const afterHundred = await one(`SELECT balance FROM public.ai_credit_wallets WHERE user_id='${ids.user}'`)
  assert(hundredDone.outputTokens === 100 && Number(hundredDone.chargedCredits) === .1 && Number(afterHundred.balance) === 1499.9, `100 token billing: ${JSON.stringify({ hundredDone, afterHundred })}`)
  const reserve = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','10000000-0000-0000-0000-000000000001',8192) AS result`)
  assert(reserve.ok && reserve.maxOutputTokens === 8192 && Number(reserve.reservedCredits) === 8.192, `reserve: ${JSON.stringify(reserve)}`)
  const activeRetry = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','10000000-0000-0000-0000-000000000001',4096) AS result`)
  assert(activeRetry.ok && activeRetry.receiptId === reserve.receiptId && activeRetry.state === 'reserved', `active retry duplicated hold: ${JSON.stringify(activeRetry)}`)
  const nullSource = await call(`SELECT public.refund_ai_credit_service('${ids.user}',1,NULL,${reserve.receiptId}) AS result`)
  assert(!nullSource.ok && nullSource.error === 'invalid_params', `null source accepted: ${JSON.stringify(nullSource)}`)
  const tutorGenericRefund = await call(`SELECT public.refund_ai_credit_service('${ids.user}',1,'wallet',${reserve.receiptId}) AS result`)
  assert(!tutorGenericRefund.ok && tutorGenericRefund.error === 'invalid_receipt', `generic refund touched tutor receipt: ${JSON.stringify(tutorGenericRefund)}`)
  await db.exec(`INSERT INTO public.tutor_messages(user_id,role,meta) VALUES ('${ids.user}','assistant',jsonb_build_object('ai',jsonb_build_object('creditReceiptId','${reserve.receiptId}')))`)
  const settled = await call(`SELECT public.settle_tutor_credit_service('${ids.user}',${reserve.receiptId},4096,false) AS result`)
  const balance = await one(`SELECT balance FROM public.ai_credit_wallets WHERE user_id='${ids.user}'`)
  assert(settled.ok && settled.outputTokens === 4096 && Number(settled.chargedCredits) === 4.096 && Number(balance.balance) === 1495.804, `settle: ${JSON.stringify({ settled, balance })}`)
  const ledger = await one(`SELECT COALESCE(sum(amount),0) AS total FROM public.ai_credit_logs WHERE user_id='${ids.user}'`)
  assert(Number(ledger.total) === Number(balance.balance), `ledger does not reconcile wallet: ${JSON.stringify({ ledger, balance })}`)
  const message = await one(`SELECT meta->'billing' AS billing FROM public.tutor_messages WHERE user_id='${ids.user}'`)
  assert(message.billing && message.billing.outputTokens === 4096, `message billing missing: ${JSON.stringify(message)}`)
  const retry = await call(`SELECT public.settle_tutor_credit_service('${ids.user}',${reserve.receiptId},8192,false) AS result`)
  assert(retry.outputTokens === 4096 && Number(retry.chargedCredits) === 4.096, `idempotency: ${JSON.stringify(retry)}`)
  const fixed = await call(`SELECT public.consume_ai_credit_service('${ids.user}',1) AS result`)
  assert(fixed.ok && Number(fixed.remaining) === 1494.804, `fixed cost lost decimals: ${JSON.stringify(fixed)}`)
  const oldHold = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','10000000-0000-0000-0000-000000000005',1000) AS result`)
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('grantPeriod','old-period') WHERE id=${oldHold.receiptId}; UPDATE public.ai_credit_wallets SET grant_period='old-period' WHERE user_id='${ids.user}'`)
  const newGrant = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','10000000-0000-0000-0000-000000000006',1000) AS result`)
  const oldSettled = await call(`SELECT public.settle_tutor_credit_service('${ids.user}',${oldHold.receiptId},1000,false) AS result`)
  const newBalance = await one(`SELECT balance FROM public.ai_credit_wallets WHERE user_id='${ids.user}'`)
  assert(newGrant.ok && oldSettled.state === 'expired' && Number(newBalance.balance) === 1499, `cross-month stale hold inflated wallet: ${JSON.stringify({ newGrant, oldSettled, newBalance })}`)
  await call(`SELECT public.settle_tutor_credit_service('${ids.user}',${newGrant.receiptId},NULL,false) AS result`)
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${ids.admin}',false)`)
  const low = await call(`SELECT public.admin_adjust_ai_credit('${ids.user}',-1499,'low balance') AS result`)
  assert(low.ok, `admin adjustment: ${JSON.stringify(low)}`)
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${ids.user}',false)`)
  const capped = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','10000000-0000-0000-0000-000000000002',8192) AS result`)
  assert(capped.maxOutputTokens === 1000 && Number(capped.reservedCredits) === 1, `cap: ${JSON.stringify(capped)}`)
  const cancel = await call(`SELECT public.settle_tutor_credit_service('${ids.user}',${capped.receiptId},NULL,true) AS result`)
  assert(cancel.state === 'canceled' && cancel.outputTokens === null && cancel.usageMissing === false, `cancel: ${JSON.stringify(cancel)}`)
  const finalizedRetry = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','10000000-0000-0000-0000-000000000002',8192) AS result`)
  assert(!finalizedRetry.ok && finalizedRetry.error === 'reservation_finalized', `finalized retry: ${JSON.stringify(finalizedRetry)}`)
  const directExpiry = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','10000000-0000-0000-0000-000000000004',1000) AS result`)
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('expiresAt',now()-interval '1 minute') WHERE id=${directExpiry.receiptId}`)
  const directExpired = await call(`SELECT public.settle_tutor_credit_service('${ids.user}',${directExpiry.receiptId},1000,false) AS result`)
  const directBalance = await one(`SELECT balance FROM public.ai_credit_wallets WHERE user_id='${ids.user}'`)
  assert(directExpired.state === 'expired' && Number(directExpired.chargedCredits) === 0 && Number(directBalance.balance) === 1, `direct expiry release: ${JSON.stringify({ directExpired, directBalance })}`)
  const expiring = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','10000000-0000-0000-0000-000000000003',1000) AS result`)
  await db.exec(`INSERT INTO public.tutor_messages(user_id,role,meta) VALUES ('${ids.user}','assistant',jsonb_build_object('ai',jsonb_build_object('creditReceiptId','${expiring.receiptId}')))`)
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('expiresAt',now()-interval '1 minute') WHERE id=${expiring.receiptId}`)
  await call(`SELECT public.get_ai_credit_status(false,1,1) AS result`)
  const expiryBilling = await one(`SELECT meta->'billing' AS billing FROM public.tutor_messages WHERE user_id='${ids.user}' AND meta->'ai'->>'creditReceiptId'='${expiring.receiptId}'`)
  assert(expiryBilling.billing && expiryBilling.billing.usageMissing === true, `expiry billing: ${JSON.stringify(expiryBilling)}`)
  await db.exec(`UPDATE public.profiles SET membership_tier='free', membership_period='none', membership_expires_at=NULL WHERE id='${ids.user}'`)
  await db.exec(`INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES ('${ids.user}',-2,'free_chat',jsonb_build_object('cost',2)); INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES ('${ids.user}',1,'refund',jsonb_build_object('source','free','refundCost',1,'receiptId',(SELECT max(id) FROM public.ai_credit_logs WHERE reason='free_chat')))`)
  const partialCount = await one(`SELECT public.count_ai_free_chats_today('${ids.user}') AS count`)
  assert(partialCount.count === 1, `partial free refund counted as full refund: ${JSON.stringify(partialCount)}`)
  await db.exec(`INSERT INTO public.ai_credit_logs(user_id,amount,reason,created_at,meta) VALUES ('${ids.user}',-1,'free_chat',now()-interval '1 day',jsonb_build_object('cost',1)); INSERT INTO public.ai_credit_logs(user_id,amount,reason,meta) VALUES ('${ids.user}',1,'refund',jsonb_build_object('source','free','refundCost',1,'receiptId',(SELECT max(id) FROM public.ai_credit_logs WHERE reason='free_chat')))`)
  const freeHold = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','20000000-0000-0000-0000-000000000000',1000) AS result`)
  await db.exec(`UPDATE public.ai_credit_logs SET meta=meta||jsonb_build_object('expiresAt',now()-interval '1 minute') WHERE id=${freeHold.receiptId}`)
  const genericAfterExpiry = await call(`SELECT public.consume_ai_credit_service('${ids.user}',1) AS result`)
  assert(genericAfterExpiry.ok && genericAfterExpiry.source === 'free', `generic consume did not release expired free hold: ${JSON.stringify(genericAfterExpiry)}`)
  for (let i = 0; i < 3; i++) {
    const free = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','20000000-0000-0000-0000-00000000000${i + 1}',1000) AS result`)
    assert(free.ok && free.source === 'free', `free ${i}: ${JSON.stringify(free)}`)
    const done = await call(`SELECT public.settle_tutor_credit_service('${ids.user}',${free.receiptId},NULL,false) AS result`)
    assert(done.ok && done.outputTokens === null && done.usageMissing === true && Number(done.chargedCredits) === 0, `unknown usage: ${JSON.stringify(done)}`)
  }
  const exhausted = await call(`SELECT public.reserve_tutor_credit_service('${ids.user}','20000000-0000-0000-0000-000000000099',1000) AS result`)
  assert(!exhausted.ok && exhausted.error === 'quota_exceeded', `free quota: ${JSON.stringify(exhausted)}`)
  const grants = await one(`SELECT
    has_function_privilege('anon','public.reserve_tutor_credit_service(uuid,uuid,int)','execute') AS anon_reserve,
    has_function_privilege('authenticated','public.reserve_tutor_credit_service(uuid,uuid,int)','execute') AS auth_reserve,
    has_function_privilege('anon','public.settle_tutor_credit_service(uuid,bigint,int,boolean)','execute') AS anon_settle,
    has_function_privilege('authenticated','public.settle_tutor_credit_service(uuid,bigint,int,boolean)','execute') AS auth_settle,
    has_function_privilege('anon','public._release_expired_tutor_holds(uuid)','execute') AS anon_helper,
    has_function_privilege('authenticated','public._release_expired_tutor_holds(uuid)','execute') AS auth_helper,
    has_function_privilege('service_role','public.reserve_tutor_credit_service(uuid,uuid,int)','execute') AS service_reserve,
    has_function_privilege('service_role','public.settle_tutor_credit_service(uuid,bigint,int,boolean)','execute') AS service_settle`)
  assert(!grants.anon_reserve && !grants.auth_reserve && !grants.anon_settle && !grants.auth_settle && !grants.anon_helper && !grants.auth_helper && grants.service_reserve && grants.service_settle, `privileges: ${JSON.stringify(grants)}`)
  console.info('Tutor token billing SQL verification passed (PGlite; concurrency is not simulated).')
} finally { await db.close() }
