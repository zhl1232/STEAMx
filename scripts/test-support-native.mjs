#!/usr/bin/env node
// Disposable local PostgreSQL only; never reads project credentials or invokes notification delivery.
import {spawn,spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
const name=`support-native-${process.pid}-${Date.now()}`
const run=(args,input)=>spawnSync('docker',args,{encoding:'utf8',input,maxBuffer:8*1024*1024})
const sql=text=>{const r=run(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-XAt'],text);if(r.status!==0)throw Error(r.stderr);return r.stdout.trim()}
const deny=(query,match)=>assert.throws(()=>sql(query),match)
const alice=randomUUID(),bob=randomUUID(),staff=randomUUID(),conv=randomUUID(),other=randomUUID(),attachment=randomUUID(),key=randomUUID()
try {
  const start=run(['run','--rm','-d','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust',process.env.SUPPORT_NATIVE_PG_IMAGE||'postgres:16-alpine'])
  if(start.status!==0)throw Error(start.stderr)
  let ready=false
  for(let i=0;i<60;i++){if(run(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0){ready=true;break}await new Promise(r=>setTimeout(r,250))}
  if(!ready)throw Error('Postgres not ready')
  sql(`create role anon; create role authenticated; create role service_role bypassrls; create table profiles(id uuid primary key,role text); create schema storage; create table storage.objects(id uuid primary key,bucket_id text); alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;create policy broad_existing_storage on storage.objects for all to authenticated using(true) with check(true); create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`)
  sql(readFileSync(new URL('../supabase/migrations/20261026150000_support_conversations.sql',import.meta.url),'utf8'))
  sql(readFileSync(new URL('../supabase/migrations/20261026170000_support_channels.sql',import.meta.url),'utf8'))
  sql(`insert into profiles values('${alice}','user'),('${bob}','user'),('${staff}','admin');insert into support_conversations(id,user_id) values('${conv}','${alice}'),('${other}','${bob}');`)
  const send=(actor=alice,role='user',client=key,ids='{}')=>`select support_send_message('${conv}','${actor}','${role}','${client}','hello','{}','${ids}');`
  deny(send(bob),/Permission denied/)
  deny(send(bob,'admin'),/Permission denied/)
  deny(`set role authenticated;select * from support_conversations`,/permission denied/)
  deny(`set role authenticated;${send()}`,/permission denied/)
  sql(`insert into support_attachments(id,conversation_id,uploader_id,storage_path,mime_type,size_bytes) values('${attachment}','${other}','${bob}','private/a','image/png',100)`)
  deny(send(alice,'user',key,`{${attachment}}`),/Invalid attachments/)
  const first=JSON.parse(sql(send()))
  assert.equal(JSON.parse(sql(send())).id,first.id,'idempotent retry must return same message')
  assert.equal(sql(`select count(*) from support_messages`),'1')
  assert.equal(sql(`select count(*) from support_notification_outbox`),'1')
  assert.equal(sql(`select public from storage.buckets where id='support-private'`),'f')
  sql(`insert into storage.objects values('${randomUUID()}','support-private')`)
  assert.equal(sql(`set role authenticated;select count(*) from storage.objects`).split('\n').at(-1),'0','private bucket restrictive policy overrides broad existing storage grants')
  const attach2=randomUUID()
  sql(`insert into support_attachments(id,conversation_id,uploader_id,storage_path,mime_type,size_bytes) values('${attach2}','${conv}','${alice}','private/b','image/jpeg',120)`)
  const withAttachment=JSON.parse(sql(send(alice,'user',randomUUID(),`{${attach2}}`)))
  assert.equal(sql(`select message_id from support_attachments where id='${attach2}'`),withAttachment.id)
  deny(send(alice,'user',randomUUID(),`{${attach2}}`),/Invalid attachments/)
  sql(`update support_notification_outbox set available_at=now()-interval '1 minute'`)
  const claim=JSON.parse(sql(`select row_to_json(t) from support_claim_notifications(10) t`))
  assert.equal(claim.attempts,1)
  assert.equal(sql(`select count(*) from support_claim_notifications(10)`),'0','leased jobs cannot be claimed twice')
  const second=JSON.parse(sql(send(alice,'user',randomUUID())))
  sql(`update support_notification_outbox set delivered_at=now() where conversation_id='${conv}' and message_seq=${claim.message_seq} and lease_id='${claim.lease_id}'`)
  assert.equal(sql(`select delivered_at is null from support_notification_outbox`),'t','new message must not be acknowledged by old claim')
  sql(`update support_notification_outbox set lease_until=now()-interval '1 minute',available_at=now()-interval '1 minute',last_error='delivery_failed'`)
  assert.equal(sql(`select count(*) from support_claim_notifications(10)`),'1','failed/expired claims are retriable')
  assert.equal(sql(`select count(*) from support_messages`),'3','notification failures must retain messages')
  sql(send(staff,'admin',randomUUID()))
  assert.equal(sql(`select actor_id from support_messages where sender_role='admin'`),staff,'official response retains real actor')
  assert.equal(sql(`select message_seq from support_notification_outbox`),String(second.seq),'admin reply must not create operator alert')
  // A resolver that starts while a user send holds the row lock must recheck the sequence after waiting.
  const renderedSeq=sql(`select last_message_seq from support_conversations where id='${conv}'`)
  const marker=100000+Math.floor(Math.random()*100000000)
  const concurrentSend=new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-XAt'],{stdio:['pipe','pipe','pipe']})
    let stderr='';child.stdout.resume();child.stderr.on('data',chunk=>{stderr+=chunk});child.on('error',reject);child.on('exit',code=>code===0?resolve(undefined):reject(new Error(stderr)))
    child.stdin.end(`begin;${send(alice,'user',randomUUID())}select pg_advisory_xact_lock(${marker});select pg_sleep(2);commit;`)
  })
  let locked=false
  for(let i=0;i<50;i++){
    if(sql(`select exists(select 1 from pg_locks where locktype='advisory' and objid=${marker} and granted)`).split('\n').at(-1)==='t'){locked=true;break}
    await new Promise(resolve=>setTimeout(resolve,20))
  }
  assert.equal(locked,true,'concurrent user transaction acquired its row lock')
  const changed=sql(`with changed as(update support_conversations set status='resolved' where id='${conv}' and last_message_seq=${renderedSeq} returning id)select count(*) from changed`)
  await concurrentSend
  assert.equal(changed,'0','stale resolution must fail after waiting on a user send')
  assert.equal(sql(`select status from support_conversations where id='${conv}'`),'open')
  const freshSeq=sql(`select last_message_seq from support_conversations where id='${conv}'`)
  assert.equal(sql(`with changed as(update support_conversations set status='resolved' where id='${conv}' and last_message_seq=${freshSeq} returning id)select count(*) from changed`),'1')
  sql(send(alice,'user',randomUUID()))
  assert.equal(sql(`select status from support_conversations where id='${conv}'`),'open','a later message reopens a successfully resolved conversation')
  // Channel migration retains previous history while giving the same user an independent store inbox.
  assert.equal(sql(`select channel from support_conversations where id='${conv}'`),'platform')
  const store=JSON.parse(sql(`select support_ensure_conversation('${alice}','store')`))
  assert.notEqual(store.id,conv)
  assert.equal(JSON.parse(sql(`select support_ensure_conversation('${alice}','store')`)).id,store.id)
  assert.equal(JSON.parse(sql(`select support_ensure_conversation('${alice}','platform')`)).id,conv)
  assert.equal(sql(`select count(*) from support_conversations where user_id='${alice}'`),'2')
  deny(`select support_ensure_conversation('${alice}','unknown')`,/Invalid support channel/)
  for(const query of [
    `select support_ensure_conversation('${alice}','store')`,
    `select support_user_unread('${alice}')`,
    `select support_inbox_channel('store',0)`
  ])deny(`set role authenticated;${query}`,/permission denied/)
  deny(`select support_send_message('${conv}','${alice}','user','${randomUUID()}','order','{"orderId":"${randomUUID()}"}','{}')`,/Commerce context requires store support/)
  const sameUserAttachment=randomUUID()
  sql(`insert into support_attachments(id,conversation_id,uploader_id,storage_path,mime_type,size_bytes) values('${sameUserAttachment}','${conv}','${alice}','private/platform-only','image/png',100)`)
  deny(`select support_send_message('${store.id}','${alice}','user','${randomUUID()}','','{}','{${sameUserAttachment}}')`,/Invalid attachments/)
  sql(`select support_send_message('${store.id}','${alice}','user','${randomUUID()}','store question','{"orderId":"${randomUUID()}"}','{}')`)
  sql(`select support_send_message('${store.id}','${staff}','admin','${randomUUID()}','store reply','{}','{}')`)
  let unread=JSON.parse(sql(`select support_user_unread('${alice}')`))
  assert.equal(unread.platform,1)
  assert.equal(unread.store,1)
  sql(`update support_conversations set user_read_seq=last_message_seq where id='${conv}'`)
  unread=JSON.parse(sql(`select support_user_unread('${alice}')`))
  assert.deepEqual(unread,{platform:0,store:1},'reading platform must not clear store unread replies')
  const platformInbox=JSON.parse(sql(`select support_inbox_channel('platform',0)`)),storeInbox=JSON.parse(sql(`select support_inbox_channel('store',0)`))
  assert.equal(platformInbox.length,2)
  assert.ok(platformInbox.every(c=>c.channel==='platform'))
  assert.deepEqual(storeInbox.map(c=>c.id),[store.id])
  assert.equal(storeInbox[0].unreadCount,1)
  sql(`update support_conversations set staff_read_seq=last_message_seq where id='${store.id}'`)
  assert.equal(JSON.parse(sql(`select support_inbox_channel('store',0)`))[0].unreadCount,0)
  assert.ok(JSON.parse(sql(`select support_inbox_channel('platform',0)`)).find(c=>c.id===conv).unreadCount>0,'reading store staff inbox must not clear platform unread')
  assert.deepEqual(JSON.parse(sql(`select support_user_unread('${randomUUID()}')`)),{platform:0,store:0})
  // Competing initial requests must return one persistent conversation, including before either commits.
  const ensureUser=randomUUID(),ensureMarker=300000+Math.floor(Math.random()*100000000)
  sql(`insert into profiles values('${ensureUser}','user')`)
  const pendingEnsure=new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-XAt'],{stdio:['pipe','pipe','pipe']})
    let stderr='';child.stdout.resume();child.stderr.on('data',chunk=>{stderr+=chunk});child.on('error',reject);child.on('exit',code=>code===0?resolve(undefined):reject(new Error(stderr)))
    child.stdin.end(`begin;select support_ensure_conversation('${ensureUser}','store');select pg_advisory_xact_lock(${ensureMarker});select pg_sleep(2);commit;`)
  })
  let ensureLocked=false
  for(let i=0;i<50;i++){
    if(sql(`select exists(select 1 from pg_locks where locktype='advisory' and objid=${ensureMarker} and granted)`).split('\n').at(-1)==='t'){ensureLocked=true;break}
    await new Promise(resolve=>setTimeout(resolve,20))
  }
  assert.ok(ensureLocked)
  const ensured=JSON.parse(sql(`select support_ensure_conversation('${ensureUser}','store')`))
  await pendingEnsure
  assert.equal(sql(`select count(*) from support_conversations where user_id='${ensureUser}'`),'1')
  assert.equal(ensured.id,sql(`select id from support_conversations where user_id='${ensureUser}'`))
  console.log('Support native PostgreSQL: ownership, admin checks, table/RPC isolation, idempotency, private immutable attachments, outbox lease/retry/new-generation protection concurrent resolution and independent platform/store channels checks passed.')
} finally {run(['rm','-f',name])}
