// Isolated PostgreSQL tests; never loads environment files or remote credentials.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
if(!process.env.PGLITE_MODULE_PATH)throw new Error('Set PGLITE_MODULE_PATH to an installed local PGlite module')
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href)
const db=new PGlite()
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE profiles(id uuid PRIMARY KEY,coins integer NOT NULL DEFAULT 100);CREATE TABLE coin_logs(user_id uuid,amount integer,action_type text,resource_id text);`)
const migration=await readFile(new URL('../supabase/migrations/20261030120000_playground_challenges.sql',import.meta.url),'utf8')
await db.exec(migration)
const users=[randomUUID(),randomUUID(),randomUUID()]
for(const u of users)await db.query('INSERT INTO profiles(id) VALUES($1)',[u])
const lobby=async(u,op,game='gomoku',code='')=>(await db.query('SELECT challenge_lobby($1,$2,$3,$4,$5) AS value',[u,game,op,code,{}])).rows[0].value
const commit=async(m,status,winner=null,isVoid=false,key=randomUUID(),state={})=>(await db.query('SELECT challenge_commit($1,$2,$3,$4,$5,$6,$7) AS value',[m.id,m.version,key,state,status,winner,isVoid])).rows[0].value
const balance=async u=>(await db.query('SELECT coins FROM profiles WHERE id=$1',[u])).rows[0].coins
let a=await lobby(users[0],'queue'),b=await lobby(users[1],'queue');assert.equal(a.id,b.id);assert.equal(b.status,'ready')
a=await commit(b,'playing');assert.equal(await balance(users[0]),98);assert.equal(await balance(users[1]),98)
const request=randomUUID();a=await commit(a,'finished','host',false,request);assert.equal(await balance(users[0]),101);assert.equal(await balance(users[1]),98)
await commit({...a,version:0},'finished','host',false,request);assert.equal(await balance(users[0]),101,'retries do not award twice')
for(let n=0;n<4;n++){a=await lobby(users[0],'queue');b=await lobby(users[1],'queue');a=await commit(b,'playing');await commit(a,'finished','draw')}
a=await lobby(users[0],'queue');b=await lobby(users[1],'queue');await assert.rejects(()=>commit(b,'playing'),/daily_limit/);await commit(b,'cancelled');assert.equal(await balance(users[0]),101,'quota failure rolls back all wallet writes')
a=await lobby(users[0],'invite','memory');b=await lobby(users[1],'join','memory',a.code);a=await commit(b,'playing');await commit(a,'finished','host');assert.equal(await balance(users[0]),101,'invitation is free')
a=await lobby(users[0],'queue','memory');await db.query("UPDATE playground_challenges SET created_at=clock_timestamp()-interval '4 seconds' WHERE id=$1",[a.id]);a=await lobby(users[0],'bot','memory');a=await commit(a,'playing');assert.equal(await balance(users[0]),99);await commit(a,'cancelled',null,true);assert.equal(await balance(users[0]),101,'system abort refunds')
assert.equal((await db.query("SELECT used FROM playground_challenge_usage WHERE user_id=$1 AND game='memory'",[users[0]])).rows[0].used,0,'abort returns original day quota')
a=await lobby(users[0],'queue','memory');await db.query("UPDATE playground_challenges SET created_at=clock_timestamp()-interval '4 seconds' WHERE id=$1",[a.id]);a=await lobby(users[0],'bot','memory');a=await commit(a,'playing');await commit(a,'finished','host');assert.equal(await balance(users[0]),102);assert.equal((await db.query('SELECT strength FROM playground_challenge_strength WHERE user_id=$1',[users[0]])).rows[0].strength,48)
// A scheduled start after midnight belongs to that Shanghai day, not the request day.
a=await lobby(users[0],'queue','memory');await db.query("UPDATE playground_challenges SET created_at=clock_timestamp()-interval '4 seconds' WHERE id=$1",[a.id]);a=await lobby(users[0],'bot','memory');
a=await commit(a,'playing',null,false,randomUUID(),{engine:{startAt:Date.parse('2026-11-02T16:00:00.000Z')}});
assert.equal(a.quota_day,'2026-11-03');await commit(a,'cancelled',null,true);
assert.equal((await db.query("SELECT used FROM playground_challenge_usage WHERE user_id=$1 AND game='memory' AND day='2026-11-03'",[users[0]])).rows[0].used,0,'fault refund restores scheduled start day quota');
await db.query('UPDATE profiles SET coins=0 WHERE id=$1',[users[2]]);
a=await lobby(users[2],'queue','memory');b=await lobby(users[1],'queue','memory');const before=await balance(users[1]);await assert.rejects(()=>commit(b,'playing'),/insufficient_coins/);assert.equal(await balance(users[1]),before,'insufficient funds roll back the other wallet');await commit(b,'cancelled');
await db.exec('SET ROLE authenticated');await assert.rejects(()=>db.query('SELECT state FROM playground_challenges'),/permission denied/);await assert.rejects(()=>db.query('SELECT challenge_lobby($1,$2,$3,$4,$5)',[users[0],'gomoku','queue','',{}]),/permission denied/);await db.exec('RESET ROLE')
await db.exec(migration);console.log('PASS challenge migration: atomic wallets, quota, retry, invitation, refund, adaptive strength, permissions, replay')
await db.close()
