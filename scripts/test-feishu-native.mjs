#!/usr/bin/env node
// Disposable local PostgreSQL only. Never reads project credentials or sends Feishu messages.
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const name=`feishu-native-${process.pid}-${Date.now()}`
const run=(args,input)=>spawnSync('docker',args,{encoding:'utf8',input,maxBuffer:8*1024*1024})
const sql=text=>{const r=run(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-XAt'],text);if(r.status!==0)throw Error(r.stderr);return r.stdout.trim()}
const json=query=>JSON.parse(sql(query))
const literal=value=>`'${String(value).replace(/'/g,"''")}'`
const deny=(query,match)=>assert.throws(()=>sql(query),match)
const user=randomUUID(),staff=randomUUID(),otherStaff=randomUUID(),order=randomUUID()
const kinds=['support.user_message','support.admin_message','order.created','order.paid','order.refund_requested','order.refunded']
const target=(id,chat,channels,events=kinds,enabled=true)=>({target_id:id,chat_id:chat,enabled,channels,events})
const targets=[target('store-a','chat-a',['store']),target('store-b','chat-b',['store']),target('platform','chat-platform',['platform'])]
const sync=value=>sql(`select feishu_sync_targets(${literal(JSON.stringify(value))}::jsonb)`)
const claim=()=>json('select feishu_claim_deliveries(20)')
const complete=(job,success=true,lease=job.lease_id)=>sql(`select feishu_complete_delivery('${job.event_id}',${literal(job.target_id)},'${lease}',${success},'private error must not be saved')`)
const anchor=(job,message)=>sql(`select feishu_record_anchor('${job.event_id}',${literal(job.target_id)},'${job.lease_id}',${literal(message)})`)
const reply=(message,chat='chat-a',actor=staff,parent='om-a',root=null,text='已收到，我们会处理。')=>`select feishu_apply_reply(${literal(message)},${literal(chat)},'${actor}',${parent===null?'null':literal(parent)},${root===null?'null':literal(root)},${literal(text)})`
const send=(conversation,role='user',actor=user,client=randomUUID())=>json(`select support_send_message('${conversation}','${actor}',${literal(role)},'${client}','hello','{}','{}')`)
try {
  const start=run(['run','--pull=never','--rm','-d','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust',process.env.SUPPORT_NATIVE_PG_IMAGE||'postgres:16-alpine'])
  if(start.status!==0)throw Error(start.stderr)
  let ready=false
  for(let i=0;i<60;i++){if(run(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0){ready=true;break}await new Promise(resolve=>setTimeout(resolve,250))}
  assert.ok(ready,'PostgreSQL must be ready')
  sql(`create role anon;create role authenticated;create role service_role bypassrls;create table profiles(id uuid primary key,role text);
    create schema storage;create table storage.objects(id uuid primary key,bucket_id text);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table store_orders(id uuid primary key,total_amount_cents integer,status text);
    create table store_order_events(id bigint generated always as identity primary key,order_id uuid not null references store_orders(id),event_type text,payload jsonb default '{}');`)
  for(const file of ['20261026150000_support_conversations.sql','20261026170000_support_channels.sql','20261026180000_feishu_service_bridge.sql','20261026190000_feishu_delivery_order.sql','20261026200000_feishu_support_images.sql']) {
    const text=readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8')
    // Match the formal db-push runner's nested DO -> EXECUTE migration behavior.
    sql(`do $runner$ begin execute ${literal(text)}; end $runner$;`)
  }
  sql(`insert into profiles values('${user}','user'),('${staff}','admin'),('${otherStaff}','admin')`)
  const store=json(`select support_ensure_conversation('${user}','store')`),platform=json(`select support_ensure_conversation('${user}','platform')`)
  sync(targets)
  const client=randomUUID(),first=send(store.id,'user',user,client)
  send(store.id,'user',user,client)
  send(platform.id)
  assert.equal(sql('select count(*) from feishu_events'),'2','retrying one message cannot create another event')
  let jobs=claim();assert.equal(jobs.length,3)
  const a=jobs.find(job=>job.target_id==='store-a'),b=jobs.find(job=>job.target_id==='store-b'),p=jobs.find(job=>job.target_id==='platform')
  assert.equal(a.support_message_id,first.id)
  assert.equal(anchor(a,'om-a'),'t');assert.equal(anchor(b,'om-b'),'t')
  assert.equal(complete(a),'t');assert.equal(complete(p),'t');assert.equal(complete(b,false),'t')
  assert.equal(sql(`select last_error from feishu_deliveries where target_id='store-b'`),'delivery_failed','raw external errors must not persist')
  assert.equal(claim().length,0,'backoff and successful recipients must not be retried immediately')
  sql(`update feishu_deliveries set available_at=now()-interval '1 second' where target_id='store-b'`)
  jobs=claim();assert.deepEqual(jobs.map(job=>job.target_id),['store-b']);assert.equal(jobs[0].attempts,2)
  assert.equal(complete(jobs[0],true,b.lease_id),'f','stale lease cannot acknowledge a newer delivery')
  assert.equal(anchor({...jobs[0],lease_id:b.lease_id},'om-stale'),'f','stale lease cannot register a reply anchor')
  assert.equal(anchor(jobs[0],'om-b-retry'),'t');assert.equal(complete(jobs[0]),'t')
  assert.equal(claim().length,0)
  assert.equal(sql(`select delivered_at is not null from support_notification_outbox where conversation_id='${store.id}'`),'t','all targets completing must acknowledge the matching legacy generation')
  assert.equal(sql(`select delivered_at is not null from support_notification_outbox where conversation_id='${platform.id}'`),'t')
  sync([...targets,target('new-later','chat-new',['store'])]);assert.equal(claim().length,0,'a new group must not receive expanded history');sync(targets)

  const secondUser=randomUUID()
  sql(`insert into profiles values('${secondUser}','user')`)
  const secondStore=json(`select support_ensure_conversation('${secondUser}','store')`)
  send(secondStore.id,'user',secondUser)
  jobs=claim()
  assert.equal(anchor(jobs.find(job=>job.target_id==='store-a'),'om-other-conversation'),'t')
  for(const job of jobs)complete(job)
  deny(reply('incoming-ambiguous-conversation','chat-a',staff,'om-a','om-other-conversation'),/Ambiguous/)
  const before=Number(sql('select count(*) from support_messages'))
  deny(reply('incoming-unauthorized','chat-a',user),/administrator required/)
  deny(reply('incoming-cross-group','wrong-chat'),/anchor unavailable/)
  deny(reply('incoming-no-anchor','chat-a',staff,null),/anchor unavailable/)
  deny(reply('incoming-cross-channel','chat-a',staff,'om-a','om-b'),/Ambiguous/)
  assert.equal(Number(sql('select count(*) from support_messages')),before)
  const accepted=json(reply('incoming-1'));assert.equal(accepted.duplicate,false);assert.equal(accepted.conversation_id,store.id)
  const repeated=json(reply('incoming-1'));assert.equal(repeated.message_id,accepted.message_id);assert.equal(repeated.duplicate,true)
  deny(reply('incoming-1','chat-a',otherStaff),/duplicate reply identity mismatch/)
  assert.equal(Number(sql('select count(*) from support_messages')),before+1)
  assert.equal(sql(`select actor_id from support_messages where id='${accepted.message_id}'`),staff)
  assert.equal(sql(`select context::text from support_messages where id='${accepted.message_id}'`),'{}')
  const replyMarker=400000+Math.floor(Math.random()*100000000)
  const concurrentReply=new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-XAt'],{stdio:['pipe','pipe','pipe']})
    let stderr='';child.stdout.resume();child.stderr.on('data',chunk=>{stderr+=chunk});child.on('error',reject);child.on('exit',code=>code===0?resolve(undefined):reject(new Error(stderr)))
    child.stdin.end(`begin;${reply('incoming-concurrent')};select pg_advisory_xact_lock(${replyMarker});select pg_sleep(2);commit;`)
  })
  let replyLocked=false
  for(let i=0;i<50;i++){
    if(sql(`select exists(select 1 from pg_locks where locktype='advisory' and objid=${replyMarker} and granted)`).split('\n').at(-1)==='t'){replyLocked=true;break}
    await new Promise(resolve=>setTimeout(resolve,20))
  }
  assert.ok(replyLocked,'the first reply holds its transaction before a duplicate arrives')
  assert.equal(json(reply('incoming-concurrent')).duplicate,true)
  await concurrentReply
  assert.equal(Number(sql('select count(*) from support_messages')),before+2,'concurrent duplicate message IDs create exactly one new reply')
  jobs=claim();assert.deepEqual(jobs.map(job=>job.target_id),['store-b'],'the first reply relays only to the other group')
  assert.equal(jobs[0].kind,'support.admin_message');complete(jobs[0])
  jobs=claim();assert.deepEqual(jobs.map(job=>job.target_id),['store-b'],'the next reply follows after the first is acknowledged');complete(jobs[0])

  sync(targets.map(t=>t.target_id==='store-a'?{...t,enabled:false}:t))
  deny(reply('incoming-disabled'),/target unavailable/)
  send(store.id);jobs=claim();assert.deepEqual(jobs.map(job=>job.target_id),['store-b']);complete(jobs[0])
  sync(targets.map(t=>t.target_id==='store-a'?{...t,channels:['platform']}:t));deny(reply('incoming-wrong-channel'),/target unavailable/)
  sync(targets)
  deny(`update feishu_targets set chat_id='other-chat' where target_id='store-a'`,/immutable/)
  deny(`select feishu_sync_targets(${literal(JSON.stringify([targets[0],targets[0]]))}::jsonb)`,/Invalid Feishu target/)

  // A created event is emitted before v1 replaces benefit totals in the same transaction.
  sql(`begin;insert into store_orders values('${order}',10000,'pending_payment');insert into store_order_events(order_id,event_type) values('${order}','created');update store_orders set total_amount_cents=7123 where id='${order}';commit;`)
  const event=json(`select row_to_json(e) from feishu_events e where kind='order.created'`)
  assert.equal(event.order_event_id,1)
  assert.equal(Object.hasOwn(event,'amount_cents'),false,'queue must not snapshot pre-discount amount')
  assert.equal(sql(`select o.total_amount_cents from feishu_events e join store_order_events se on se.id=e.order_event_id join store_orders o on o.id=se.order_id where e.id='${event.id}'`),'7123','sender must read the final committed order amount')
  sql(`insert into store_order_events(order_id,event_type) values('${order}','ignored'),('${order}','paid'),('${order}','refund_requested'),('${order}','refunded')`)
  assert.equal(sql(`select count(*) from feishu_events where kind like 'order.%'`),'4')
  jobs=claim();assert.equal(jobs.length,2);assert.ok(jobs.every(job=>job.target_id.startsWith('store-') && job.kind==='order.created'))
  assert.equal(claim().length,0,'active leases cannot be claimed twice')
  const expired=jobs[0];sql(`update feishu_deliveries set lease_until=now()-interval '1 second' where event_id='${expired.event_id}' and target_id=${literal(expired.target_id)}`)
  assert.equal(complete(expired),'f','expired lease cannot acknowledge delivery')
  const reclaimed=claim();assert.equal(reclaimed.length,1);assert.notEqual(reclaimed[0].lease_id,expired.lease_id)
  complete(reclaimed[0]);for(const job of jobs.slice(1))complete(job)
  for(const kind of ['order.paid','order.refund_requested','order.refunded']) {
    jobs=claim();assert.equal(jobs.length,2);assert.ok(jobs.every(job=>job.kind===kind),'order notifications must preserve event order for each recipient')
    for(const job of jobs)complete(job)
  }

  assert.equal(sql(`select feishu_enqueue_inbound('incoming-queue','chat-a','open-staff','om-a',null,'queued reply')`),'t')
  assert.equal(sql(`select feishu_enqueue_inbound('incoming-queue','chat-other','forged-open',null,null,'changed')`),'f','duplicate events preserve first accepted payload')
  assert.equal(sql(`select chat_id from feishu_inbound where message_id='incoming-queue'`),'chat-a')
  let incoming=json('select feishu_claim_inbound(10)');assert.equal(incoming.length,1);assert.equal(incoming[0].text,'queued reply')
  assert.equal(json('select feishu_claim_inbound(10)').length,0)
  assert.equal(sql(`select feishu_complete_inbound('incoming-queue','${randomUUID()}',true)`),'f')
  assert.equal(sql(`select feishu_complete_inbound('incoming-queue','${incoming[0].lease_id}',false,'secret error',false)`),'t')
  assert.equal(json('select feishu_claim_inbound(10)').length,0)
  sql(`update feishu_inbound set available_at=now()-interval '1 second'`)
  incoming=json('select feishu_claim_inbound(10)');assert.equal(incoming[0].attempts,2)
  const queued=json(reply('incoming-queue'));assert.equal(queued.duplicate,false)
  assert.equal(sql(`select feishu_complete_inbound('incoming-queue','${incoming[0].lease_id}',true)`),'t')
  assert.equal(json('select feishu_claim_inbound(10)').length,0)
  sql(`select feishu_enqueue_inbound('permanent-reject','chat-a','outsider','om-a',null,'must not replay')`)
  incoming=json('select feishu_claim_inbound(10)')
  assert.equal(sql(`select feishu_complete_inbound('permanent-reject','${incoming[0].lease_id}',false,'raw',true)`),'t')
  assert.equal(json('select feishu_claim_inbound(10)').length,0)
  assert.equal(sql(`select last_error from feishu_inbound where message_id='permanent-reject'`),'reply_rejected')
  deny(`select feishu_enqueue_inbound('too-long','chat-a','sender','om-a',null,repeat('x',2001))`,/violates check constraint/)

  // A leased or retrying conversation head blocks its later messages, independently for each group.
  for(const job of claim())complete(job)
  const orderedUser=randomUUID()
  sql(`insert into profiles values('${orderedUser}','user')`)
  const orderedConversation=json(`select support_ensure_conversation('${orderedUser}','store')`)
  const firstOrdered=send(orderedConversation.id,'user',orderedUser),secondOrdered=send(orderedConversation.id,'user',orderedUser)
  jobs=claim();assert.equal(jobs.length,2);assert.ok(jobs.every(job=>job.support_message_id===firstOrdered.id))
  const firstA=jobs.find(job=>job.target_id==='store-a'),firstB=jobs.find(job=>job.target_id==='store-b')
  complete(firstA,false)
  assert.equal(claim().length,0,'neither an active lease nor retry backoff may be overtaken')
  sql(`update feishu_deliveries set available_at=now()-interval '1 second' where event_id='${firstA.event_id}' and target_id='store-a'`)
  jobs=claim();assert.equal(jobs.length,1);assert.equal(jobs[0].support_message_id,firstOrdered.id);complete(jobs[0])
  jobs=claim();assert.equal(jobs.length,1);assert.equal(jobs[0].support_message_id,secondOrdered.id);assert.equal(jobs[0].target_id,'store-a');complete(jobs[0])
  complete(firstB)
  jobs=claim();assert.equal(jobs.length,1);assert.equal(jobs[0].support_message_id,secondOrdered.id);assert.equal(jobs[0].target_id,'store-b');complete(jobs[0])

  // Different conversations remain parallel even when a single conversation has multiple pending messages.
  const parallelFirst=send(orderedConversation.id,'user',orderedUser),parallelSecond=send(orderedConversation.id,'user',orderedUser)
  const parallelOther=send(secondStore.id,'user',secondUser)
  jobs=claim();assert.equal(jobs.length,4);assert.ok(jobs.every(job=>[parallelFirst.id,parallelOther.id].includes(job.support_message_id)))
  for(const job of jobs)complete(job)
  jobs=claim();assert.equal(jobs.length,2);assert.ok(jobs.every(job=>job.support_message_id===parallelSecond.id));for(const job of jobs)complete(job)

  // An earlier source event skipped during expansion must still block an already-expanded later message.
  const blockedFirst=send(orderedConversation.id,'user',orderedUser),blockedSecond=send(orderedConversation.id,'user',orderedUser)
  jobs=claim();assert.equal(jobs.length,2)
  const blockedEvent=jobs[0].event_id
  sql(`delete from feishu_deliveries where event_id='${blockedEvent}';update feishu_events set expanded_at=null where id='${blockedEvent}'`)
  const expansionMarker=600000+Math.floor(Math.random()*100000000)
  const expanding=new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-XAt'],{stdio:['pipe','pipe','pipe']})
    let stderr='';child.stdout.resume();child.stderr.on('data',chunk=>{stderr+=chunk});child.on('error',reject);child.on('exit',code=>code===0?resolve(undefined):reject(new Error(stderr)))
    child.stdin.end(`begin;select id from feishu_events where id='${blockedEvent}' for update;select pg_advisory_xact_lock(${expansionMarker});select pg_sleep(2);commit;`)
  })
  let expansionLocked=false
  for(let i=0;i<50;i++){
    if(sql(`select exists(select 1 from pg_locks where locktype='advisory' and objid=${expansionMarker} and granted)`).split('\n').at(-1)==='t'){expansionLocked=true;break}
    await new Promise(resolve=>setTimeout(resolve,20))
  }
  assert.ok(expansionLocked)
  assert.equal(claim().length,0,'unexpanded earlier source locks cannot let later messages overtake')
  await expanding
  jobs=claim();assert.equal(jobs.length,2);assert.ok(jobs.every(job=>job.support_message_id===blockedFirst.id));for(const job of jobs)complete(job)
  jobs=claim();assert.equal(jobs.length,2);assert.ok(jobs.every(job=>job.support_message_id===blockedSecond.id));for(const job of jobs)complete(job)

  // An older event that is no longer subscribed must not block a currently subscribed message.
  const unsubscribedFirst=send(orderedConversation.id,'user',orderedUser),subscribedReply=send(orderedConversation.id,'admin',staff)
  sync(targets.map(t=>t.target_id==='store-a'?{...t,events:['support.admin_message']}:t))
  jobs=claim()
  assert.ok(jobs.some(job=>job.target_id==='store-a' && job.support_message_id===subscribedReply.id))
  assert.ok(!jobs.some(job=>job.target_id==='store-a' && job.support_message_id===unsubscribedFirst.id))
  for(const job of jobs)complete(job)
  sync(targets)
  for(let i=0;i<3;i++){jobs=claim();for(const job of jobs)complete(job)}

  // Inbound replies follow the persistent inbox order per known conversation, independently of their group.
  for(const [message,anchorMessage] of [['ordered-inbound-1','om-a'],['ordered-inbound-2','om-a'],['parallel-inbound','om-other-conversation'],['unknown-anchor-inbound','unknown-anchor']]) {
    sql(`select feishu_enqueue_inbound(${literal(message)},'chat-a','open-staff',${literal(anchorMessage)},null,'reply')`)
  }
  incoming=json('select feishu_claim_inbound(20)')
  assert.deepEqual(incoming.map(job=>job.message_id).sort(),['ordered-inbound-1','parallel-inbound','unknown-anchor-inbound'].sort(),'known conversations run in parallel and unknown anchors never block their group')
  assert.equal(json('select feishu_claim_inbound(20)').length,0,'the second reply cannot pass its leased conversation head')
  const orderedInbound=incoming.find(job=>job.message_id==='ordered-inbound-1')
  sql(`select feishu_complete_inbound('ordered-inbound-1','${orderedInbound.lease_id}',false,'retry',false)`)
  assert.equal(json('select feishu_claim_inbound(20)').length,0,'the second reply cannot pass retry backoff')
  const unknownInbound=incoming.find(job=>job.message_id==='unknown-anchor-inbound')
  sql(`select feishu_complete_inbound('unknown-anchor-inbound','${unknownInbound.lease_id}',false,'retry',false)`)
  sql(`update feishu_inbound set available_at=now()-interval '1 second' where message_id='ordered-inbound-1'`)
  let incomingHead=json('select feishu_claim_inbound(20)')
  assert.deepEqual(incomingHead.map(job=>job.message_id),['ordered-inbound-1'])
  sql(`select feishu_complete_inbound('ordered-inbound-1','${incomingHead[0].lease_id}',true)`)
  incomingHead=json('select feishu_claim_inbound(20)')
  assert.deepEqual(incomingHead.map(job=>job.message_id),['ordered-inbound-2'],'next persisted reply runs once its predecessor completes, despite an unresolved anchor in the same group')
  sql(`select feishu_complete_inbound('ordered-inbound-2','${incomingHead[0].lease_id}',true)`)
  const parallelInbound=incoming.find(job=>job.message_id==='parallel-inbound')
  sql(`select feishu_complete_inbound('parallel-inbound','${parallelInbound.lease_id}',true)`)
  sql(`update feishu_inbound set available_at=now()-interval '1 second' where message_id='unknown-anchor-inbound'`)
  incomingHead=json('select feishu_claim_inbound(20)')
  assert.deepEqual(incomingHead.map(job=>job.message_id),['unknown-anchor-inbound'])
  sql(`select feishu_complete_inbound('unknown-anchor-inbound','${incomingHead[0].lease_id}',false,'rejected',true)`)

  // Replies claimed as unknown cannot overtake after their common robot anchor is registered.
  const lateAnchorUser=randomUUID()
  sql(`insert into profiles values('${lateAnchorUser}','user')`)
  const lateAnchorConversation=json(`select support_ensure_conversation('${lateAnchorUser}','store')`)
  const lateAnchorMessage=send(lateAnchorConversation.id,'user',lateAnchorUser)
  for(const message of ['late-anchor-first','late-anchor-second'])sql(`select feishu_enqueue_inbound(${literal(message)},'chat-a','open-staff','om-late-anchor',null,'reply')`)
  incoming=json('select feishu_claim_inbound(20)')
  assert.deepEqual(incoming.map(job=>job.message_id).sort(),['late-anchor-first','late-anchor-second'])
  const lateAnchorDelivery=claim().find(job=>job.support_message_id===lateAnchorMessage.id && job.target_id==='store-a')
  assert.ok(lateAnchorDelivery);assert.equal(anchor(lateAnchorDelivery,'om-late-anchor'),'t')
  deny(reply('late-anchor-second','chat-a',otherStaff,'om-late-anchor'),/waiting for prior message/)
  assert.equal(sql(`select count(*) from feishu_reply_origins where message_id='late-anchor-second'`),'0')
  const lateFirst=json(reply('late-anchor-first','chat-a',otherStaff,'om-late-anchor'))
  const lateSecond=json(reply('late-anchor-second','chat-a',otherStaff,'om-late-anchor'))
  assert.ok(Number(sql(`select seq from support_messages where id='${lateFirst.message_id}'`))<Number(sql(`select seq from support_messages where id='${lateSecond.message_id}'`)))
  for(const job of incoming)sql(`select feishu_complete_inbound(${literal(job.message_id)},'${job.lease_id}',true)`)
  // Drain these independent delivery streams before exercising legacy generation acknowledgements.
  for(let i=0;i<4;i++){
    sql(`update feishu_deliveries set lease_until=now()-interval '1 second' where delivered_at is null`)
    for(const job of claim())complete(job)
  }

  // A completed older event must never consume a newer user-message notification generation.
  for(const job of claim())complete(job)
  const generationUser=randomUUID()
  sql(`insert into profiles values('${generationUser}','user')`)
  const generationConversation=json(`select support_ensure_conversation('${generationUser}','store')`)
  const older=send(generationConversation.id,'user',generationUser)
  const oldJobs=claim().filter(job=>job.support_message_id===older.id)
  assert.equal(oldJobs.length,2)
  const newer=send(generationConversation.id,'user',generationUser)
  const legacyLease=randomUUID()
  sql(`update support_notification_outbox set lease_id='${legacyLease}',lease_until=now()+interval '1 minute' where conversation_id='${generationConversation.id}'`)
  for(const job of oldJobs)complete(job)
  assert.equal(sql(`select delivered_at is null and message_seq=${newer.seq} and lease_id='${legacyLease}' from support_notification_outbox where conversation_id='${generationConversation.id}'`),'t','old event completion preserves the new generation and its lease')
  const newJobs=claim().filter(job=>job.support_message_id===newer.id)
  assert.equal(newJobs.length,2)
  complete(newJobs[0])
  sync(targets.map(t=>t.target_id===newJobs[1].target_id?{...t,enabled:false}:t))
  assert.equal(sql(`select delivered_at is null from support_notification_outbox where conversation_id='${generationConversation.id}'`),'t','disabled but undelivered target keeps the generation pending')
  sync(targets)
  complete(newJobs[1])
  assert.equal(sql(`select delivered_at is not null and lease_id is null and lease_until is null from support_notification_outbox where conversation_id='${generationConversation.id}'`),'t','matching completed generation releases legacy lease')

  // Two recipient acknowledgements racing must still clear the legacy generation after both commit.
  const concurrentGeneration=send(generationConversation.id,'user',generationUser)
  const completionJobs=claim().filter(job=>job.support_message_id===concurrentGeneration.id)
  assert.equal(completionJobs.length,2)
  const completionMarker=500000+Math.floor(Math.random()*100000000),firstCompletion=completionJobs[0]
  const completing=new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-XAt'],{stdio:['pipe','pipe','pipe']})
    let stderr='';child.stdout.resume();child.stderr.on('data',chunk=>{stderr+=chunk});child.on('error',reject);child.on('exit',code=>code===0?resolve(undefined):reject(new Error(stderr)))
    child.stdin.end(`begin;select feishu_complete_delivery('${firstCompletion.event_id}',${literal(firstCompletion.target_id)},'${firstCompletion.lease_id}',true);select pg_advisory_xact_lock(${completionMarker});select pg_sleep(2);commit;`)
  })
  let completionLocked=false
  for(let i=0;i<50;i++){
    if(sql(`select exists(select 1 from pg_locks where locktype='advisory' and objid=${completionMarker} and granted)`).split('\n').at(-1)==='t'){completionLocked=true;break}
    await new Promise(resolve=>setTimeout(resolve,20))
  }
  assert.ok(completionLocked)
  complete(completionJobs[1])
  await completing
  assert.equal(sql(`select delivered_at is not null from support_notification_outbox where conversation_id='${generationConversation.id}'`),'t','concurrent per-target completions cannot strand legacy pending state')

  // Media reservations authorize before download, preserve immutable identities, and attach atomically.
  const mediaArgs=(message,actor=otherStaff,parent='om-a',root=null,chat='chat-a')=>`${literal(message)},${literal(chat)},'${actor}',${parent===null?'null':literal(parent)},${root===null?'null':literal(root)}`
  const prepare=(message,actor=otherStaff,parent='om-a',root=null,chat='chat-a')=>`select feishu_prepare_reply(${mediaArgs(message,actor,parent,root,chat)})`
  const enqueueMedia=(message,keys,text='')=>`select feishu_enqueue_inbound_media(${literal(message)},'chat-a','open-staff','om-a',null,${literal(text)},array[${keys.map(literal).join(',')}]::text[])`
  const reserve=(message,key='img_first',actor=otherStaff,mime='image/png',size=128,parent='om-a')=>`select feishu_prepare_image_attachment(${mediaArgs(message,actor,parent)},${literal(key)},${literal(mime)},${size})`
  const applyMedia=(message,ids,text='',actor=otherStaff)=>`select feishu_apply_reply_media(${mediaArgs(message,actor)},${literal(text)},array[${ids.map(id=>`${literal(id)}::uuid`).join(',')}]::uuid[])`
  deny(enqueueMedia('media-empty',[]),/Invalid Feishu media content/)
  deny(enqueueMedia('media-too-many',['img_a','img_b','img_c','img_d']),/Invalid Feishu media content/)
  deny(enqueueMedia('media-repeat',['img_a','img_a']),/Invalid Feishu media content/)
  deny(enqueueMedia('media-wrong-key',['other_a']),/Invalid Feishu media content/)
  deny(enqueueMedia('media-long',['img_a'],'x'.repeat(2001)),/Invalid Feishu media content/)
  assert.equal(sql(enqueueMedia('media-only',['img_first'])),'t')
  assert.equal(sql(enqueueMedia('media-only',['img_changed'],'replace')),'f')
  assert.equal(sql(`select image_keys::text||':'||text from feishu_inbound where message_id='media-only'`),'{img_first}:','duplicate enqueue never replaces a queued payload')
  const preflight=json(prepare('media-only'))
  assert.deepEqual(preflight,{conversation_id:store.id,target_id:'store-a',duplicate:false})
  deny(prepare('media-only',user),/administrator required/)
  deny(prepare('media-only',otherStaff,'om-a',null,'chat-b'),/identity mismatch/)
  deny(prepare('media-only',otherStaff,'om-other-conversation'),/identity mismatch/)
  deny(prepare('media-only',otherStaff,'om-a','om-other-conversation'),/identity mismatch/)
  sync(targets.map(t=>t.target_id==='store-a'?{...t,enabled:false}:t))
  deny(prepare('media-only'),/target unavailable/)
  sync(targets.map(t=>t.target_id==='store-a'?{...t,channels:['platform']}:t))
  deny(prepare('media-only'),/target unavailable/)
  sync(targets)
  deny(reserve('media-only','img_absent'),/Invalid Feishu queued image/)
  deny(reserve('media-only','img_first',otherStaff,'image/svg+xml'),/Invalid Feishu image metadata/)
  deny(reserve('media-only','img_first',otherStaff,'image/png',5242881),/Invalid Feishu image metadata/)
  const image=json(reserve('media-only'))
  assert.match(image.id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  assert.equal(image.storage_path,`${store.id}/${image.id}`)
  assert.equal(image.message_id,null)
  assert.deepEqual(json(reserve('media-only')),image,'a retry reuses the full original attachment row')
  deny(reserve('media-only','img_first',staff),/identity mismatch/)
  deny(prepare('media-only',staff),/identity mismatch/)
  deny(reserve('media-only','img_first',otherStaff,'image/jpeg'),/metadata mismatch/)
  deny(reserve('media-only','img_first',otherStaff,'image/png',129),/metadata mismatch/)
  deny(applyMedia('media-only',[]),/Invalid Feishu reply|Invalid Feishu image attachments/)
  deny(applyMedia('media-only',[randomUUID()]),/Invalid Feishu image attachments/)
  deny(reply('media-only','chat-a',otherStaff),/Invalid Feishu image attachments/)
  const mediaSent=json(applyMedia('media-only',[image.id]))
  assert.equal(mediaSent.duplicate,false)
  assert.equal(sql(`select content from support_messages where id='${mediaSent.message_id}'`),'')
  assert.equal(sql(`select message_id from support_attachments where id='${image.id}'`),mediaSent.message_id)
  assert.equal(json(applyMedia('media-only',[image.id])).duplicate,true,'committed duplicates return before validating attachment availability')
  assert.equal(json(prepare('media-only')).message_id,mediaSent.message_id)
  assert.equal(json(reserve('media-only')).message_id,mediaSent.message_id)
  sql(`update feishu_inbound set completed_at=now() where message_id='media-only'`)

  assert.equal(sql(enqueueMedia('media-rich',['img_one','img_two'],'图文回复')),'t')
  const richImages=[json(reserve('media-rich','img_one',otherStaff,'image/jpeg')),json(reserve('media-rich','img_two',otherStaff,'image/webp'))]
  deny(applyMedia('media-rich',richImages.map(i=>i.id).reverse(),'图文回复'),/Invalid Feishu image attachments/)
  deny(applyMedia('media-rich',[richImages[0].id,richImages[0].id],'图文回复'),/Invalid Feishu image attachments/)
  deny(applyMedia('media-rich',[image.id,richImages[1].id],'图文回复'),/Invalid Feishu image attachments/)
  const richSent=json(applyMedia('media-rich',richImages.map(i=>i.id),'图文回复'))
  assert.equal(sql(`select count(*) from support_attachments where message_id='${richSent.message_id}'`),'2')
  assert.equal(sql(`select content from support_messages where id='${richSent.message_id}'`),'图文回复')
  sql(`update feishu_inbound set completed_at=now() where message_id='media-rich'`)

  assert.equal(sql(enqueueMedia('media-concurrent',['img_first'])),'t')
  const mediaMarker=700000+Math.floor(Math.random()*100000000)
  const reserving=new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-XAt'],{stdio:['pipe','pipe','pipe']})
    let stderr='';child.stdout.resume();child.stderr.on('data',chunk=>{stderr+=chunk});child.on('error',reject);child.on('exit',code=>code===0?resolve(undefined):reject(new Error(stderr)))
    child.stdin.end(`begin;${reserve('media-concurrent')};select pg_advisory_xact_lock(${mediaMarker});select pg_sleep(2);commit;`)
  })
  let mediaLocked=false
  for(let i=0;i<50;i++){
    if(sql(`select exists(select 1 from pg_locks where locktype='advisory' and objid=${mediaMarker} and granted)`).split('\n').at(-1)==='t'){mediaLocked=true;break}
    await new Promise(resolve=>setTimeout(resolve,20))
  }
  assert.ok(mediaLocked)
  const reservedConcurrently=json(reserve('media-concurrent'))
  await reserving
  assert.equal(sql(`select count(*) from feishu_inbound_attachments where message_id='media-concurrent'`),'1')
  assert.equal(json(reserve('media-concurrent')).id,reservedConcurrently.id)
  assert.equal(sql(enqueueMedia('media-after-concurrent',['img_first'])),'t')
  const afterImage=json(reserve('media-after-concurrent'))
  deny(applyMedia('media-after-concurrent',[afterImage.id]),/waiting for prior message/)
  json(applyMedia('media-concurrent',[reservedConcurrently.id]))
  json(applyMedia('media-after-concurrent',[afterImage.id]))
  sql(`update feishu_inbound set completed_at=now() where message_id in ('media-concurrent','media-after-concurrent')`)
  for(const query of [enqueueMedia('media-forbidden',['img_first']),prepare('media-only'),reserve('media-only'),applyMedia('media-only',[image.id])]) {
    for(const role of ['anon','authenticated'])deny(`set role ${role};${query}`,/permission denied/)
  }
  assert.equal(JSON.parse(sql(`set role service_role;${prepare('media-only')}`).split('\n').at(-1)).duplicate,true)

  // The database enforces the staff reply rate across independent conversations/threads.
  for(let i=0;i<117;i++)json(reply(`rate-${i}`))
  assert.equal(sql(`select count(*) from feishu_reply_origins where actor_id='${staff}'`),'120')
  deny(reply('rate-excess'),/rate limit/)
  assert.equal(json(reply('incoming-1')).duplicate,true,'a committed retry remains idempotent after hitting the rate limit')
  for(const table of ['feishu_targets','feishu_events','feishu_deliveries','feishu_reply_anchors','feishu_reply_origins','feishu_inbound','feishu_inbound_attachments']) {
    assert.equal(sql(`select relrowsecurity from pg_class where oid='public.${table}'::regclass`),'t')
    for(const role of ['anon','authenticated'])deny(`set role ${role};select * from ${table}`,/permission denied/)
  }
  for(const query of [
    `select feishu_sync_targets('[]')`,`select feishu_claim_deliveries(10)`,
    `select feishu_complete_delivery('${randomUUID()}','store-a','${randomUUID()}',true)`,
    `select feishu_record_anchor('${randomUUID()}','store-a','${randomUUID()}','some-message')`,
    `select feishu_enqueue_inbound('secret','chat','sender',null,null,'text')`,
    `select feishu_claim_inbound(10)`,`select feishu_complete_inbound('message','${randomUUID()}',true)`,
    reply('not-allowed')
  ])for(const role of ['anon','authenticated'])deny(`set role ${role};${query}`,/permission denied/)
  assert.equal(sql(`set role service_role;select jsonb_typeof(feishu_claim_inbound(10))`).split('\n').at(-1),'array')
  console.log('Feishu native PostgreSQL: atomic source events, committed order amounts, independent target delivery/retry/leases, immutable targets, exact reply anchors, administrator checks, reply idempotency/source exclusion, persistent inbound queues, image-only/rich replies, immutable and concurrent media reservations, exact attachment ordering, rate limits and service-only RLS/RPC checks passed.')
} finally { run(['rm','-f',name]) }
