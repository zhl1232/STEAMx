#!/usr/bin/env node
// Disposable local PostgreSQL only. No project credentials, remote DB or payment calls.
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const name = `coin-commerce-${process.pid}-${Date.now()}`
const run = (args, input) => spawnSync('docker', args, { encoding: 'utf8', input, maxBuffer: 8 * 1024 * 1024 })
const sql = input => {
  const r = run(['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-XAtq'], input)
  if (r.status !== 0) throw Error(r.stderr || r.stdout)
  return r.stdout.trim()
}
const asyncSql = input => {
  const pending = new Promise((resolve, reject) => {
  const child = spawn('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-XAtq'])
  let out = '', err = ''
  child.stdout.on('data', x => { out += x }); child.stderr.on('data', x => { err += x })
  child.on('error', reject); child.on('close', code => code ? reject(Error(err || out)) : resolve(out.trim()))
  child.stdin.end(input)
  })
  // A setup barrier may still be pending when the child fails; defer failure to its awaited result.
  pending.catch(() => {})
  return pending
}
const migration = file => readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8')
const user = randomUUID(), other = randomUUID()
const asUser = statement => `SET ROLE authenticated; SET request.jwt.claim.sub='${user}'; ${statement}`
const service = statement => `SET ROLE service_role; SET request.jwt.claim.role='service_role'; ${statement}`
const purchase = (item, price) => JSON.parse(sql(asUser(`SELECT purchase_item('${item}',${price});`)))
const resetUser = (tier = 'free', period = 'none', expiry = 'NULL', balance = 1000, level = 30, role = 'user') => sql(`DELETE FROM user_inventory WHERE user_id='${user}'; DELETE FROM coin_logs; UPDATE profiles SET coins=${balance},level=${level},membership_tier='${tier}',membership_period='${period}',membership_expires_at=${expiry},role='${role}' WHERE id='${user}';`)
const waitForQuery = async (marker, event = 'PgSleep') => {
  for (let i = 0; i < 100; i++) {
    if (Number(sql(`SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND query LIKE '%${marker}%' AND wait_event='${event}'`)) > 0) return
    await new Promise(r => setTimeout(r, 25))
  }
  throw Error(`session did not reach ${marker}`)
}
try {
  const start = run(['run', '--rm', '-d', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', process.env.COIN_COMMERCE_PG_IMAGE || 'postgres:16-alpine'])
  if (start.status !== 0) throw Error(start.stderr)
  let ready = false
  for (let i = 0; i < 60; i++) { if (run(['exec', name, 'pg_isready', '-U', 'postgres']).status === 0) { ready = true; break } await new Promise(r => setTimeout(r, 250)) }
  if (!ready) throw Error('Postgres not ready')
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),role text,display_name text,coins integer DEFAULT 0,level integer DEFAULT 1,xp integer DEFAULT 0,membership_tier text,membership_period text,membership_expires_at timestamptz,equipped_name_color_id text,equipped_avatar_frame_id text);
    CREATE TABLE projects(id bigint PRIMARY KEY,author_id uuid,title text,coins_count integer DEFAULT 0);
    CREATE TABLE completed_projects(id bigint PRIMARY KEY,user_id uuid,coins_count integer DEFAULT 0);
    CREATE TABLE user_inventory(user_id uuid REFERENCES profiles(id),item_id text,unlocked_at timestamptz,PRIMARY KEY(user_id,item_id));
    CREATE TABLE coin_logs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid REFERENCES profiles(id),amount integer,action_type text,resource_id text,counterparty_display_text text);
    CREATE TABLE xp_logs(user_id uuid REFERENCES profiles(id),action_type text,resource_id text,xp_amount integer,UNIQUE(user_id,action_type,resource_id));
    CREATE TABLE challenges(id bigint PRIMARY KEY,challenge_type text,status text);
    CREATE TABLE challenge_submissions(id bigint PRIMARY KEY,challenge_id bigint REFERENCES challenges(id),user_id uuid REFERENCES profiles(id),title text,status text,is_public boolean,moderation_state text,updated_at timestamptz);
    CREATE TABLE challenge_submission_ratings(submission_id bigint REFERENCES challenge_submissions(id),creative_expression integer,completion_quality integer,evidence_completeness integer,reflection_depth integer);
    INSERT INTO auth.users VALUES('${user}'),('${other}'); INSERT INTO profiles(id,role) VALUES('${user}','user'),('${other}','user');
    -- Mimic the legacy publicly executable function ACL retained by CREATE OR REPLACE.
    CREATE FUNCTION settle_timed_challenge(bigint) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
    GRANT EXECUTE ON FUNCTION settle_timed_challenge(bigint) TO authenticated,service_role;`)
  sql(migration('20260806130000_add_science_orbit_avatar_frame.sql'))
  const growth = migration('20261026100000_reviewed_growth_rewards.sql')
  const award = growth.match(/CREATE OR REPLACE FUNCTION public\.award_xp_once\([\s\S]*?\$\$;/)?.[0]
  assert.ok(award, 'actual award_xp_once migration function must be found'); sql(award)
  sql(migration('20261026130000_shop_membership_and_atomic_challenge.sql'))
  for (const [tier, period, expiry, expected, role] of [
    ['free','none','NULL',15,'user'], ['pro','lifetime','NULL',13,'user'], ['founder','founder','NULL',12,'user'],
    ['pro','monthly',"now()-interval '1 second'",15,'user'], ['founder','monthly','NULL',15,'user'], ['pro','none','NULL',15,'user'], ['free','none','NULL',15,'admin'],
  ]) {
    resetUser(tier, period, expiry, 1000, 30, role)
    const quote = JSON.parse(sql(asUser('SELECT get_shop_prices();')))
    assert.equal(quote.items.find(x => x.id === 'pixel_border').price, expected, `quote ${tier}/${period}`)
    assert.deepEqual(purchase('pixel_border',expected), { ok:true, item_id:'pixel_border',price:expected })
    assert.equal(sql(`SELECT coins FROM profiles WHERE id='${user}'`), String(1000-expected))
  }
  assert.equal(sql(`SELECT shop_member_price(1,'pro'),shop_member_price(1,'founder'),shop_member_price(19,'pro'),shop_member_price(19,'founder')`), '1|1|16|15')
  resetUser('pro','lifetime','NULL',13)
  assert.equal(purchase('pixel_border',13).ok,true,'balance below base price can afford member price')
  // A database-first rollout must keep the old one-argument browser RPC usable.
  const legacyPurchase = item => JSON.parse(sql(asUser(`SELECT purchase_item('${item}');`)))
  for (const [tier, period, price] of [['free','none',15],['pro','lifetime',13],['founder','founder',12]]) {
    resetUser(tier,period,'NULL',price)
    assert.deepEqual(legacyPurchase('pixel_border'), {ok:true,item_id:'pixel_border',price}, `legacy purchase ${tier}`)
    assert.equal(sql(`SELECT coins,(SELECT count(*) FROM coin_logs WHERE action_type='purchase') FROM profiles WHERE id='${user}'`),'0|1')
    assert.equal(legacyPurchase('pixel_border').error,'already_owned')
    assert.equal(sql(`SELECT count(*) FROM coin_logs WHERE action_type='purchase'`),'1','legacy replay must not debit twice')
    resetUser(tier,period,'NULL',price-1)
    assert.equal(legacyPurchase('pixel_border').error,'insufficient_coins')
    assert.equal(sql(`SELECT coins,(SELECT count(*) FROM coin_logs),(SELECT count(*) FROM user_inventory WHERE user_id='${user}') FROM profiles WHERE id='${user}'`),`${price-1}|0|0`)
  }
  resetUser('founder','founder','NULL',1000,1)
  assert.equal(legacyPurchase('golden_crown').error,'min_level_required')
  assert.equal(legacyPurchase('not-a-shop-item').error,'invalid_item')
  assert.equal(JSON.parse(sql("SELECT purchase_item('pixel_border');")).error,'unauthorized')
  resetUser()
  assert.equal(purchase('pixel_border',1).error,'price_changed')
  assert.equal(sql(`SELECT coins,(SELECT count(*) FROM coin_logs),(SELECT count(*) FROM user_inventory WHERE user_id='${user}') FROM profiles WHERE id='${user}'`),'1000|0|0')
  resetUser('founder','founder','NULL',1000,1)
  assert.equal(purchase('golden_crown',640).error,'min_level_required')
  resetUser()
  const same = await Promise.all([asyncSql(asUser("SELECT purchase_item('pixel_border',15);")),asyncSql(asUser("SELECT purchase_item('pixel_border',15);"))])
  assert.deepEqual(same.map(x=>JSON.parse(x).ok).sort(),[false,true])
  assert.equal(sql(`SELECT coins,(SELECT count(*) FROM coin_logs WHERE action_type='purchase') FROM profiles WHERE id='${user}'`),'985|1')
  resetUser('pro','lifetime','NULL',13)
  const mixedClients = await Promise.all([asyncSql(asUser("SELECT purchase_item('pixel_border');")),asyncSql(asUser("SELECT purchase_item('pixel_border',13);"))])
  assert.deepEqual(mixedClients.map(x=>JSON.parse(x).ok).sort(),[false,true])
  assert.equal(sql(`SELECT coins,(SELECT count(*) FROM coin_logs WHERE action_type='purchase'),(SELECT count(*) FROM user_inventory WHERE user_id='${user}') FROM profiles WHERE id='${user}'`),'0|1|1','old/new client race must share one debit and inventory entry')
  // The transaction starts before expiration, blocks on a row lock, then must reprice after acquiring it.
  resetUser('pro','monthly',"clock_timestamp()+interval '1.5 seconds'")
  const blocker = asyncSql(`BEGIN; SELECT 1 FROM profiles WHERE id='${user}' FOR UPDATE; SELECT pg_sleep(2.2) /* coin_expiry_lock */; COMMIT;`)
  await waitForQuery('coin_expiry_lock')
  const expiredPurchase = await asyncSql(asUser("SELECT purchase_item('pixel_border',13);"))
  await blocker
  assert.equal(JSON.parse(expiredPurchase).error,'price_changed','membership expired while purchase waited for profile lock')
  assert.equal(sql(`SELECT coins FROM profiles WHERE id='${user}'`),'1000')
  console.log('PASS shop membership pricing, legacy client compatibility, level gate, fail-closed quotes, concurrent ownership and expiry after lock')

  sql(`INSERT INTO challenges VALUES(1,'timed','active'),(2,'timed','active'),(3,'timed','active'),(4,'timed','active'),(5,'timed','active'),(6,'timed','active');`)
  // Equal rounded averages: rating count wins, then earlier update, then submission ID.
  for (const [id, count, updated, status, isPublic, moderation] of [
    [11,2,'2026-01-02','approved',true,'approved'],[12,2,'2026-01-01','approved',true,'approved'],[10,2,'2026-01-01','approved',true,'approved'],[13,1,'2025-01-01','approved',true,'approved'],
    [14,2,'2025-01-01','pending',true,'approved'],[15,2,'2025-01-01','approved',false,'approved'],[16,2,'2025-01-01','approved',true,'pending'],
  ]) {
    sql(`INSERT INTO challenge_submissions VALUES(${id},1,'${user}','entry-${id}','${status}',${isPublic},'${moderation}','${updated}'); INSERT INTO challenge_submission_ratings SELECT ${id},4,4,4,5 FROM generate_series(1,${count});`)
  }
  sql(`INSERT INTO challenge_submissions VALUES(51,5,'${other}','rounded','approved',true,'approved',now()); INSERT INTO challenge_submission_ratings VALUES(51,4,4,4,5),(51,4,4,4,4);`)
  const rounded = JSON.parse(sql(service('SELECT settle_timed_challenge(5);')))
  assert.equal(rounded.winners[0].avg_score,4.13,'average rounds to two decimal places')
  assert.equal(rounded.winners[0].rating_count,2)
  const ranked = JSON.parse(sql(service('SELECT settle_timed_challenge(1);')))
  assert.equal(ranked.total_submissions,4)
  assert.deepEqual(ranked.winners.map(x=>x.submission_id),[10,12,11])
  assert.ok(ranked.winners.every(x=>x.avg_score===4.25 && x.rating_count===2))
  assert.equal(sql(`SELECT xp,(SELECT count(*) FROM xp_logs) FROM profiles WHERE id='${user}'`),'20|2')
  assert.deepEqual(JSON.parse(sql(service('SELECT settle_timed_challenge(1);'))),ranked)
  assert.equal(sql(`SELECT count(*) FROM coin_logs WHERE action_type='challenge_prize' AND resource_id='1'`),'3')
  sql(`INSERT INTO challenge_submissions VALUES(21,2,'${user}','race','approved',true,'approved',now()); UPDATE profiles SET coins=100,xp=0 WHERE id='${user}'; DELETE FROM user_inventory WHERE user_id='${user}';`)
  const lock = asyncSql(`BEGIN; SELECT 1 FROM profiles WHERE id='${user}' FOR UPDATE; SELECT pg_sleep(1) /* coin_settlement_lock */; COMMIT;`)
  await waitForQuery('coin_settlement_lock')
  const races = await Promise.all([asyncSql(service('SELECT settle_timed_challenge(2);')),asyncSql(service('SELECT settle_timed_challenge(2);')),asyncSql(asUser("SELECT purchase_item('pixel_border',15);"))])
  await lock
  assert.deepEqual(JSON.parse(races[0]),JSON.parse(races[1]))
  assert.equal(JSON.parse(races[2]).ok,true)
  assert.equal(sql(`SELECT coins FROM profiles WHERE id='${user}'`),'105','concurrent prize and debit must both survive')
  assert.equal(sql(`SELECT count(*) FROM coin_logs WHERE action_type='challenge_prize' AND resource_id='2'`),'1')
  assert.equal(sql(`SELECT count(*) FROM xp_logs WHERE resource_id='2'`),'1')
  assert.equal(sql('SELECT status FROM challenges WHERE id=2'),'ended')
  sql(`INSERT INTO coin_logs(user_id,amount,action_type,resource_id) VALUES('${user}',20,'challenge_prize','3');`)
  assert.throws(()=>sql(service('SELECT settle_timed_challenge(3);')),/legacy_partial_settlement_requires_review/)
  assert.equal(sql('SELECT status FROM challenges WHERE id=3'),'active')
  // An XP failure must roll back prize, settlement marker and ended status together.
  sql(`INSERT INTO challenge_submissions VALUES(41,4,'${other}','rollback','approved',true,'approved',now()); ALTER TABLE xp_logs ADD CONSTRAINT reject_fixture CHECK(resource_id<>'4');`)
  assert.throws(()=>sql(service('SELECT settle_timed_challenge(4);')),/reject_fixture/)
  assert.equal(sql(`SELECT status,(SELECT count(*) FROM challenge_settlements WHERE challenge_id=4),(SELECT count(*) FROM coin_logs WHERE resource_id='4') FROM challenges WHERE id=4`),'active|0|0')
  assert.equal(sql(`SELECT has_function_privilege('authenticated','settle_timed_challenge(bigint)','execute'),has_function_privilege('anon','settle_timed_challenge(bigint)','execute'),has_function_privilege('service_role','settle_timed_challenge(bigint)','execute')`),'f|f|t')
  assert.throws(()=>sql(asUser('SELECT settle_timed_challenge(1);')),/permission denied/)
  assert.throws(()=>sql('SELECT settle_timed_challenge(1);'),/service_role_required/)
  assert.throws(()=>sql(asUser(`SELECT purchase_item('${other}','pixel_border',1);`)),/does not exist/)
  assert.throws(()=>sql(asUser(`UPDATE profiles SET coins=999999 WHERE id='${user}';`)),/permission denied/)
  const [low,high] = [user,other].sort()
  sql(`UPDATE profiles SET coins=100; INSERT INTO projects(id,author_id,title) VALUES(101,'${low}','tip lock order');
    INSERT INTO challenge_submissions VALUES(61,6,'${low}','low','approved',true,'approved','2020-01-01'),(62,6,'${high}','high','approved',true,'approved','2021-01-01');`)
  // Reproduce the dangerous interleaving: settlement holds lower UUID while a high→low tip starts.
  // Sender-first tipping would hold high and wait low, then deadlock when settlement resumes.
  const settleWithLowLocked = asyncSql(`SET request.jwt.claim.role='service_role'; BEGIN; SELECT 1 FROM profiles WHERE id='${low}' FOR UPDATE; SELECT pg_sleep(1.5) /* tip_settlement_lock */; SELECT settle_timed_challenge(6); COMMIT;`)
  await waitForQuery('tip_settlement_lock')
  const tipWhileSettling = asyncSql(`SET ROLE authenticated; SET request.jwt.claim.sub='${high}'; SELECT tip_resource('project',101,2) /* tip_race_wait */;`)
  await waitForQuery('tip_race_wait','transactionid')
  const tipRace = await Promise.all([settleWithLowLocked,tipWhileSettling])
  assert.equal(JSON.parse(tipRace[1]).ok,true)
  assert.equal(sql(`SELECT coins FROM profiles WHERE id='${low}'`),'122')
  assert.equal(sql(`SELECT coins FROM profiles WHERE id='${high}'`),'108')
  assert.equal(sql('SELECT coins_count FROM projects WHERE id=101'),'2')
  assert.equal(JSON.parse(sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${high}'; SELECT tip_resource('project',101,1);`)).error,'tip_limit_reached')
  assert.equal(sql(`SELECT sum(amount) FROM coin_logs WHERE action_type='tip' AND resource_id='project:101'`),'0')
  console.log('PASS settlement/tip opposing user order without deadlock, exact balances and retained tip cap')
  console.log('PASS approved/public ranking, rounded score/count/time/ID ties, XP, atomic rollback, idempotent concurrent settlement/debit and RPC privileges')
} catch(error) { console.error(`FAIL coin commerce PostgreSQL suite\n${error.stack || error}`); process.exitCode=1 }
finally { run(['rm','-f',name]) }
