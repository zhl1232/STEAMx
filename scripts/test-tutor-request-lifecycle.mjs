#!/usr/bin/env node
// Isolated database only; never reads the application's environment or remote DB.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'

const modulePath = process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite'
const container = process.env.TUTOR_TEST_POSTGRES_CONTAINER
function psql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'])
    let output = '', error = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { error += chunk })
    child.on('error', reject)
    child.on('close', (code) => code ? reject(new Error(error)) : resolve(output.trim()))
    child.stdin.end(sql)
  })
}
const db = container ? {
  exec: psql,
  query: async (sql) => ({ rows: JSON.parse(await psql(`SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (${sql}) t`)) }),
  close: async () => {},
} : new (await import(modulePath.startsWith('/') ? pathToFileURL(modulePath).href : modulePath)).PGlite('memory://tutor-request-lifecycle')
const user = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const hash = 'a'.repeat(64)
const id = (n) => `30000000-0000-4000-8000-${String(n).padStart(12,'0')}`
let checks = 0
const assert = (value, message) => { checks++; if (!value) throw new Error(message) }
const one = async (sql) => (await db.query(sql)).rows[0]
const call = async (sql) => (await one(`SELECT ${sql} AS result`)).result
const begin = (n, epoch = 0, scope = '', uid = user, digest = hash, executor = randomUUID()) =>
  call(`public.begin_tutor_request_service('${uid}','${id(n)}','${digest}','global','${scope}',${epoch},8192,'${executor}')`)
const finish = (n, reply = '完整回答', clarification = false) => call(`public.complete_tutor_request_service(
  '${user}','${id(n)}','学生问题',ARRAY[]::text[],'{}','${reply}','{"ai":{"model":"test"}}',100,${clarification},'测试话题')`)
const fail = (n) => call(`public.fail_tutor_request_service('${user}','${id(n)}')`)
const archive = (epoch = 0, scope = '') => call(`public.archive_tutor_chat_service('${user}','global','${scope}',${epoch})`)
const count = async (table) => Number((await one(`SELECT count(*) AS n FROM public.${table}`)).n)
const execStatements = async (sql) => {
  for (const statement of sql.split(/(?<=\$\$);/g).map((part) => part.trim()).filter(Boolean)) await db.exec(`${statement};`)
}

try {
  await execStatements(`
    CREATE SCHEMA auth;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, role text, membership_tier text, membership_period text, membership_started_at timestamptz, membership_expires_at timestamptz);
    CREATE TABLE public.tutor_conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id), context_type text, context_id text DEFAULT '', title text DEFAULT '小迪对话', status text DEFAULT 'active', meta jsonb DEFAULT '{}', summary text DEFAULT '', summary_message_id bigint, created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),archived_at timestamptz);
    CREATE UNIQUE INDEX ON public.tutor_conversations(user_id,context_type,context_id) WHERE status='active';
    CREATE TABLE public.tutor_messages(id bigserial PRIMARY KEY, conversation_id uuid REFERENCES public.tutor_conversations(id) ON DELETE CASCADE,user_id uuid,context_type text,context_id text,role text,content text,images text[],meta jsonb NOT NULL DEFAULT '{}',created_at timestamptz DEFAULT now());
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    INSERT INTO auth.users VALUES ('${user}'),('${other}');
    INSERT INTO public.profiles VALUES ('${user}','user','pro','monthly',now(),now()+interval '1 day'), ('${other}','user',NULL,NULL,NULL,NULL);
  `)
  for (const file of [
    '20260610151000_ai_credit_system.sql', '20260610160000_fix_ai_free_refund.sql',
    '20260920120000_secure_ai_credit_accounting.sql', '20260920140000_tutor_token_billing.sql',
    '20260920160000_tutor_request_lifecycle.sql',
  ]) await execStatements(await readFile(`supabase/migrations/${file}`, 'utf8'))

  const first = await begin(1)
  assert(first.status === 'started', `admission: ${JSON.stringify(first)}`)
  assert((await begin(1)).status === 'processing', 'duplicate must not re-enter execution')
  const owner = await one(`SELECT executor_id FROM public.tutor_chat_requests WHERE request_id='${id(1)}'`)
  assert((await begin(1,0,'',user,hash,owner.executor_id)).receiptId === first.receiptId, 'lost admission response could not recover same executor')
  assert((await begin(2)).status === 'busy', 'same topic simultaneous questions must not race history')
  assert((await begin(1,0,'',user,'b'.repeat(64))).status === 'conflict', 'same ID with changed payload accepted')
  assert(await count('tutor_chat_requests') === 1, 'duplicate created a second request')
  assert(await count('tutor_messages') === 0, 'begin should not save incomplete dialogue')

  const saved = await finish(1)
  assert(saved.status === 'completed' && saved.message.content === '完整回答', 'completion missing reply')
  assert(Number(saved.message.meta.billing.chargedCredits) === .1, 'answer billing wrong')
  assert(await count('tutor_messages') === 2, 'both sides must be saved exactly once')
  assert((await finish(1,'重复请求的新文本')).message.content === '完整回答', 'duplicate completion overwrote result')
  assert((await fail(1)).status === 'completed', 'late failure cancelled a completed request')
  assert((await begin(1)).message.content === '完整回答', 'HTTP retry cannot recover saved result')
  assert(await count('tutor_messages') === 2, 'retry duplicated messages')

  await archive(0)
  assert((await begin(1)).status === 'completed', 'archive must not prevent checking old request outcome')
  const running = await begin(3,1)
  await archive(1)
  const fresh = await begin(4,2)
  assert(running.conversation.id !== fresh.conversation.id, 'new topic reused an empty in-flight conversation')
  assert((await archive(1)).epoch === 2, 'retrying old archive incremented generation twice')
  await finish(3,'旧话题回复')
  await finish(4,'新话题回复')
  const old = await one(`SELECT status FROM public.tutor_conversations WHERE id='${running.conversation.id}'`)
  const current = await call(`public.get_tutor_chat_session_service('${user}','global','')`)
  assert(old.status === 'archived', 'late completion reactivated old conversation')
  assert(current.epoch === 2 && current.conversation.id === fresh.conversation.id, 'active topic changed after old completion')
  assert((await one(`SELECT count(*) AS n FROM public.tutor_messages WHERE conversation_id='${fresh.conversation.id}' AND content='旧话题回复'`)).n === 0, 'old text leaked into new topic')

  await archive(0,'not-created-yet')
  assert((await begin(5,0,'not-created-yet')).status === 'stale_topic', 'late first request bypassed epoch guard')
  assert((await begin(5,1,'not-created-yet')).status === 'started', 'fresh generation rejected')
  await fail(5)
  assert((await fail(5)).status === 'failed' && (await begin(5,1,'not-created-yet')).status === 'failed', 'failed ID re-executed')
  assert((await finish(5)).status === 'failed', 'failed executor saved late reply')

  const deleted = await begin(6,0,'deletion')
  await finish(6)
  await archive(0,'deletion')
  await call(`public.delete_tutor_conversation_service('${user}','${deleted.conversation.id}')`)
  const unavailable = await begin(6,0,'deletion')
  assert(unavailable.status === 'unavailable' && unavailable.message === null, 'deleted reply remained replayable or executable')

  await begin(7,0,'expiry')
  await db.exec(`UPDATE public.tutor_chat_requests SET created_at=now()-interval '21 minutes' WHERE request_id='${id(7)}'`)
  assert((await finish(7)).status === 'failed', 'expired executor could commit')
  assert((await begin(8,0,'expiry')).status === 'started', 'expired request still blocks topic')
  await fail(8)

  await begin(9,0,'rollback')
  const before = await count('tutor_messages')
  await execStatements(`CREATE FUNCTION public.reject_test_reply() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.content='拒绝提交' THEN RAISE EXCEPTION 'test write failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_reply BEFORE INSERT ON public.tutor_messages FOR EACH ROW EXECUTE FUNCTION public.reject_test_reply();`)
  let rejected = false
  try { await finish(9,'拒绝提交') } catch { rejected = true }
  assert(rejected && await count('tutor_messages') === before, 'failed transaction left a user-only message')
  assert((await begin(9,0,'rollback')).status === 'processing', 'uncertain commit enabled a fresh execution')
  assert((await finish(9,'恢复完成')).status === 'completed', 'same commit identity cannot recover from rolled-back transaction')

  const clarify = await begin(10,0,'clarify')
  await finish(10,'请选择',true)
  const hold = await one(`SELECT meta FROM public.ai_credit_logs WHERE id=${clarify.receiptId}`)
  assert(hold.meta.state === 'canceled', 'clarification charged the generation reservation')

  const otherUser = await begin(1,0,'',other)
  assert(otherUser.status === 'started', 'request identity leaked across users')
  for (const name of ['get_tutor_chat_session_service(uuid,text,text)', 'archive_tutor_chat_service(uuid,text,text,bigint)',
    'begin_tutor_request_service(uuid,uuid,text,text,text,bigint,int,uuid)',
    'complete_tutor_request_service(uuid,uuid,text,text[],jsonb,text,jsonb,int,boolean,text)', 'fail_tutor_request_service(uuid,uuid)', 'delete_tutor_conversation_service(uuid,uuid)']) {
    const grants = await one(`SELECT has_function_privilege('anon','public.${name}','execute') AS anon,
      has_function_privilege('authenticated','public.${name}','execute') AS auth,
      has_function_privilege('service_role','public.${name}','execute') AS service`)
    assert(!grants.anon && !grants.auth && grants.service, `unsafe RPC grants: ${name}`)
  }
  const tableGrants = await one("SELECT has_table_privilege('authenticated','public.tutor_chat_requests','SELECT') AS read, has_table_privilege('authenticated','public.tutor_chat_requests','INSERT') AS write")
  assert(!tableGrants.read && !tableGrants.write, 'client can forge/read request state')
  const legacyGrants = await one("SELECT has_table_privilege('authenticated','public.tutor_conversations','UPDATE') AS change, has_table_privilege('authenticated','public.tutor_messages','INSERT') AS insert")
  assert(!legacyGrants.change && !legacyGrants.insert, 'client can bypass request lifecycle through old table writes')

  if (container) {
    // Every psql invocation owns a separate PostgreSQL connection/transaction.
    const concurrent = await Promise.all([begin(20,0,'concurrent'), begin(20,0,'concurrent')])
    assert(concurrent.filter((r) => r.status === 'started').length === 1 && concurrent.filter((r) => r.status === 'processing').length === 1,
      'concurrent duplicate admissions both claimed execution')
    const completed = await Promise.all([finish(20,'并发完成'), finish(20,'重复完成')])
    assert(completed[0].message.id === completed[1].message.id, 'concurrent completion inserted duplicate replies')
    const pinned = await begin(21,0,'archive-race')
    await Promise.all([finish(21), archive(0,'archive-race')])
    assert((await one(`SELECT status FROM public.tutor_conversations WHERE id='${pinned.conversation.id}'`)).status === 'archived',
      'archive vs completion reactivated old topic')
    const raced = await Promise.all([begin(22,0,'late-start'), archive(0,'late-start')])
    assert(['started','stale_topic'].includes(raced[0].status), 'invalid archive/admission race result')
    const next = await begin(23,1,'late-start')
    assert(next.status === 'started' && next.conversation.id !== raced[0].conversation?.id, 'late first request captured next topic')
    await begin(24,0,'terminal-race')
    const terminal = await Promise.all([finish(24), fail(24)])
    assert(terminal[0].status === terminal[1].status && ['completed','failed'].includes(terminal[0].status), 'complete/fail race split terminal state')
    const deleting = await begin(25,0,'delete-race')
    await archive(0,'delete-race')
    await Promise.all([finish(25), call(`public.delete_tutor_conversation_service('${user}','${deleting.conversation.id}')`)])
    assert(['failed','unavailable'].includes((await begin(25,0,'delete-race')).status), 'deletion vs completion restored deleted history')
  }
  console.info(`Tutor request lifecycle SQL: ${checks} checks passed (${container ? 'isolated PostgreSQL, including parallel connections' : 'isolated PGlite, sequential transactions'}).`)
} finally { await db.close() }
