#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const modulePath = process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite'
let PGlite
try {
  ({ PGlite } = await import(modulePath.startsWith('.') || modulePath.startsWith('/')
    ? pathToFileURL(modulePath).href
    : modulePath))
} catch (error) {
  console.error(`Unable to load PGlite. Install it outside the project, or set PGLITE_MODULE_PATH.\n${error}`)
  process.exitCode = 1
  process.exit()
}

const userId = '00000000-0000-0000-0000-000000000001'
const adminId = '00000000-0000-0000-0000-000000000002'
const otherId = '00000000-0000-0000-0000-000000000003'
const db = new PGlite('memory://ai-credit-accounting')
const migrations = [
  'supabase/migrations/20260610151000_ai_credit_system.sql',
  'supabase/migrations/20260610160000_fix_ai_free_refund.sql',
  'supabase/migrations/20260920120000_secure_ai_credit_accounting.sql',
]

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const query = async (sql) => (await db.query(sql)).rows
const scalar = async (sql) => (await query(sql))[0]
const execStatements = async (sql) => {
  for (const statement of sql.split(/(?<=\$\$);/g).map((part) => part.trim()).filter(Boolean)) {
    await db.exec(`${statement};`)
  }
}
const call = async (sql) => (await scalar(sql)).result

try {
  await execStatements(`
    CREATE SCHEMA auth;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.profiles(
      id uuid PRIMARY KEY,
      role text,
      membership_tier text,
      membership_period text,
      membership_started_at timestamptz,
      membership_expires_at timestamptz
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    INSERT INTO auth.users VALUES ('${userId}'), ('${adminId}'), ('${otherId}');
    INSERT INTO public.profiles VALUES
      ('${userId}', 'user', 'free', 'none', NULL, NULL),
      ('${adminId}', 'admin', 'founder', 'founder', NULL, NULL),
      ('${otherId}', 'user', 'free', 'none', NULL, NULL);
  `)
  for (const migration of migrations) await execStatements(await readFile(migration, 'utf8'))

  const grants = await scalar(`SELECT
    has_function_privilege('authenticated', 'public.consume_ai_credit(int,boolean,int,int)', 'execute') AS legacy_consume,
    has_function_privilege('authenticated', 'public.refund_ai_credit(int,text)', 'execute') AS legacy_refund,
    has_function_privilege('authenticated', 'public.consume_ai_credit_service(uuid,int)', 'execute') AS auth_service_consume,
    has_function_privilege('anon', 'public.consume_ai_credit_service(uuid,int)', 'execute') AS anon_service_consume,
    has_function_privilege('authenticated', 'public.refund_ai_credit_service(uuid,int,text,bigint)', 'execute') AS auth_service_refund,
    has_function_privilege('anon', 'public.refund_ai_credit_service(uuid,int,text,bigint)', 'execute') AS anon_service_refund,
    has_function_privilege('service_role', 'public.consume_ai_credit_service(uuid,int)', 'execute') AS service_consume,
    has_function_privilege('service_role', 'public.refund_ai_credit_service(uuid,int,text,bigint)', 'execute') AS service_refund`)
  assert(!grants.legacy_consume && !grants.legacy_refund && !grants.auth_service_consume && !grants.anon_service_consume && !grants.auth_service_refund && !grants.anon_service_refund,
    `mutation grants remain exposed: ${JSON.stringify(grants)}`)
  assert(grants.service_consume && grants.service_refund, `service grants missing: ${JSON.stringify(grants)}`)

  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId}', false)`)
  const forgedStatus = await call(`SELECT public.get_ai_credit_status(true,999,999) AS result`)
  assert(forgedStatus.isMember === false && forgedStatus.monthlyGrant === 1500 && forgedStatus.freeDaily === 5,
    `status trusted forged arguments: ${JSON.stringify(forgedStatus)}`)

  await db.exec(`UPDATE public.profiles SET membership_tier='pro', membership_period='monthly', membership_expires_at=now()+interval '1 day' WHERE id='${userId}'`)
  const memberStatus = await call(`SELECT public.get_ai_credit_status(false,1,1) AS result`)
  assert(memberStatus.isMember === true && memberStatus.monthlyGrant === 1500 && memberStatus.freeDaily === 5,
    `status did not derive membership: ${JSON.stringify(memberStatus)}`)
  const walletDebit = await call(`SELECT public.consume_ai_credit_service('${userId}',2) AS result`)
  assert(walletDebit.ok && walletDebit.source === 'wallet' && walletDebit.remaining === 1498, `wallet debit failed: ${JSON.stringify(walletDebit)}`)
  const walletReceipt = walletDebit.receiptId
  const walletRefund1 = await call(`SELECT public.refund_ai_credit_service('${userId}',1,'wallet',${walletReceipt}) AS result`)
  const walletRefundRetry = await call(`SELECT public.refund_ai_credit_service('${userId}',1,'wallet',${walletReceipt}) AS result`)
  const walletRefundFull = await call(`SELECT public.refund_ai_credit_service('${userId}',2,'wallet',${walletReceipt}) AS result`)
  assert(walletRefund1.refunded === 1 && walletRefundRetry.refunded === 0 && walletRefundFull.refunded === 1,
    `wallet cumulative refund failed: ${JSON.stringify({ walletRefund1, walletRefundRetry, walletRefundFull })}`)

  await db.exec(`UPDATE public.profiles SET membership_tier='free', membership_period='none', membership_expires_at=NULL WHERE id='${userId}'`)
  const freeDebit = await call(`SELECT public.consume_ai_credit_service('${userId}',2) AS result`)
  const freeReceipt = freeDebit.receiptId
  assert(freeDebit.ok && freeDebit.source === 'free', `free debit failed: ${JSON.stringify(freeDebit)}`)
  const countAfterDebit = await scalar(`SELECT public.count_ai_free_chats_today('${userId}') AS count`)
  await call(`SELECT public.refund_ai_credit_service('${userId}',1,'free',${freeReceipt}) AS result`)
  const countAfterPartial = await scalar(`SELECT public.count_ai_free_chats_today('${userId}') AS count`)
  await call(`SELECT public.refund_ai_credit_service('${userId}',2,'free',${freeReceipt}) AS result`)
  const countAfterFull = await scalar(`SELECT public.count_ai_free_chats_today('${userId}') AS count`)
  assert(countAfterDebit.count === 1 && countAfterPartial.count === 1 && countAfterFull.count === 0,
    `free refund accounting failed: ${JSON.stringify({ countAfterDebit, countAfterPartial, countAfterFull })}`)

  const wrongUser = await call(`SELECT public.refund_ai_credit_service('${otherId}',2,'free',${freeReceipt}) AS result`)
  const wrongSource = await call(`SELECT public.refund_ai_credit_service('${userId}',2,'wallet',${freeReceipt}) AS result`)
  const nullSource = await call(`SELECT public.refund_ai_credit_service('${userId}',2,NULL,${freeReceipt}) AS result`)
  assert(!wrongUser.ok && !wrongSource.ok && !nullSource.ok, `receipt validation failed: ${JSON.stringify({ wrongUser, wrongSource, nullSource })}`)

  for (let index = 0; index < 5; index += 1) {
    const result = await call(`SELECT public.consume_ai_credit_service('${userId}',1) AS result`)
    assert(result.ok, `free attempt ${index + 1} unexpectedly denied`)
  }
  const exhausted = await call(`SELECT public.consume_ai_credit_service('${userId}',1) AS result`)
  assert(!exhausted.ok && exhausted.error === 'quota_exceeded', 'daily free quota was exceeded')

  await db.exec(`UPDATE public.profiles SET role='admin' WHERE id='${adminId}'; SELECT set_config('request.jwt.claim.sub', '${adminId}', false)`)
  const zeroAdjustment = await call(`SELECT public.admin_adjust_ai_credit('${userId}',-9999,'zero floor') AS result`)
  const wallet = await scalar(`SELECT balance FROM public.ai_credit_wallets WHERE user_id='${userId}'`)
  assert(zeroAdjustment.ok && wallet.balance === 0, `wallet underflow protection failed: ${JSON.stringify({ zeroAdjustment, wallet })}`)

  console.info('AI credit SQL verification passed (PGlite; concurrency is not simulated).')
} finally {
  await db.close()
}
