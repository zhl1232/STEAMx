import test from 'node:test';
import assert from 'node:assert/strict';
import {DATA_KEYS,readBackup,parseBackup,importBackup} from '../../public/physics-lab/transfer.mjs';
import {EXPLORATIONS,defaults} from '../../public/physics-lab/exploration-model.mjs';
import {lessonScene,restoreNotebook} from '../../public/physics-lab/learning-model.mjs';
function storage(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
const savedData=backup=>[backup.experiments,backup.notebook,backup.observations];
function populated(sessionId='session-1'){const s=storage(),scene=lessonScene('single');scene.lessonSession={id:sessionId,lessonId:'light'};
 s.setItem(DATA_KEYS[0],JSON.stringify([{id:'build-1',name:'我的实验',date:'today',scene}]));
 s.setItem(DATA_KEYS[1],JSON.stringify(restoreNotebook({version:1,lastId:sessionId,sessions:[{id:sessionId,lessonId:'light',workingScene:scene,records:[{id:'record-1',at:'today',scene,note:'灯亮了'}]}]})));
 s.setItem(DATA_KEYS[2],JSON.stringify([{id:'observation-1',experiment:'sound',params:defaults('sound'),time:1,level:1,note:'频率翻倍',at:'today'}]));return s;}
test('a whole-lab backup round trips across origins and importing it twice is idempotent',()=>{
 const source=populated(),raw=JSON.stringify(readBackup(source)),target=storage();importBackup(target,raw);importBackup(target,raw);
 for(const key of DATA_KEYS)assert.deepEqual(JSON.parse(target.getItem(key)),JSON.parse(source.getItem(key)));
});
test('observations from every curriculum model survive export, import and repeated import',()=>{
 const source=storage(),observations=EXPLORATIONS.filter(e=>!e.workbench).map(e=>({id:`observe-${e.id}`,experiment:e.id,params:defaults(e.id),time:0,level:2,note:`${e.title}的对照观察`,at:'2026-10-23'}));
 source.setItem(DATA_KEYS[2],JSON.stringify(observations));
 const raw=JSON.stringify(readBackup(source)),target=storage();
 assert.deepEqual(importBackup(target,raw).observations,observations);
 assert.deepEqual(importBackup(target,raw).observations,observations);
 assert.deepEqual(parseBackup(JSON.stringify(readBackup(target))).observations,observations);
});
test('colliding IDs preserve local data and reconnect imported session references',()=>{
 const target=populated(),incoming=readBackup(populated());incoming.notebook.sessions[0].reason='新站来的解释';incoming.experiments[0].name='另一份搭建';incoming.observations[0].note='另一条观察';
 const r=importBackup(target,JSON.stringify(incoming));assert.equal(r.notebook.sessions.length,2);assert.equal(r.experiments.length,2);assert.equal(r.observations.length,2);
 assert.equal(r.experiments[0].name,'我的实验');assert.equal(r.notebook.sessions[0].reason,'');assert.equal(r.observations[0].note,'频率翻倍');
 const id=r.notebook.sessions[1].id;assert.notEqual(id,'session-1');assert.equal(r.experiments[1].scene.lessonSession.id,id);assert.equal(r.notebook.sessions[1].workingScene.lessonSession.id,id);assert.equal(r.notebook.sessions[1].records[0].scene.lessonSession.id,id);
 assert.equal(r.notebook.lastId,'session-1');
 for(let i=0;i<3;i++)assert.deepEqual(savedData(importBackup(target,JSON.stringify(incoming))),savedData(r));
 const distinct=structuredClone(incoming);distinct.notebook.sessions[0].reason='第三份解释';distinct.experiments[0].name='第三份搭建';distinct.observations[0].note='第三条观察';
 const next=importBackup(target,JSON.stringify(distinct));assert.equal(next.notebook.sessions.length,3);assert.equal(next.experiments.length,3);assert.equal(next.observations.length,3);
 assert.equal(next.experiments[2].scene.lessonSession.id,next.notebook.sessions[2].id);
 assert.deepEqual(savedData(importBackup(target,JSON.stringify(distinct))),savedData(next));
});
test('maximum-length colliding IDs survive reload, export and repeated import',()=>{
 const longId='s'.repeat(100),target=populated(longId),incoming=readBackup(populated(longId));
 incoming.notebook.sessions[0].reason='保留导入的进度';incoming.experiments[0].name='导入的搭建';incoming.observations[0].note='导入的观察';
 const local=readBackup(target);local.notebook.lastId=null;local.experiments[0].id=longId;local.observations[0].id=longId;
 DATA_KEYS.forEach((key,i)=>target.setItem(key,JSON.stringify([local.experiments,local.notebook,local.observations][i])));
 incoming.experiments[0].id=longId;incoming.observations[0].id=longId;
 const result=importBackup(target,JSON.stringify(incoming)),id=result.notebook.sessions[1].id;
 assert.notEqual(id,longId);assert.ok(id.length<=100);assert.equal(result.notebook.lastId,id);
 assert.equal(result.experiments[1].scene.lessonSession.id,id);assert.equal(result.notebook.sessions[1].workingScene.lessonSession.id,id);assert.equal(result.notebook.sessions[1].records[0].scene.lessonSession.id,id);
 assert.ok(result.experiments[1].id.length<=100);assert.ok(result.observations[1].id.length<=100);
 assert.deepEqual(restoreNotebook(target.getItem(DATA_KEYS[1])),result.notebook);
 const exported=readBackup(target);assert.deepEqual(exported.notebook,result.notebook);assert.deepEqual(parseBackup(JSON.stringify(exported)).notebook,result.notebook);
 assert.deepEqual(savedData(importBackup(target,JSON.stringify(incoming))),savedData(result));
 const different=structuredClone(incoming);different.notebook.sessions[0].reason='再保留一份不同进度';
 const next=importBackup(target,JSON.stringify(different));assert.equal(next.notebook.sessions.length,3);assert.notEqual(next.notebook.sessions[2].id,id);assert.ok(next.notebook.sessions[2].id.length<=100);
 assert.deepEqual(readBackup(target).notebook,next.notebook);
});
test('duplicates at capacity are skipped and a distinct import fails without writes',()=>{
 const target=populated(),base=readBackup(target),session=base.notebook.sessions[0];
 base.notebook.sessions=Array.from({length:30},(_,i)=>{const s=structuredClone(session);s.id=`local-${i}`;s.reason=`解释 ${i}`;s.workingScene.lessonSession.id=s.id;s.records[0].scene.lessonSession.id=s.id;return s;});
 target.setItem(DATA_KEYS[1],JSON.stringify(base.notebook));
 const incoming=readBackup(populated());incoming.notebook.sessions[0].reason='解释 0';
 const duplicate=importBackup(target,JSON.stringify(incoming));assert.equal(duplicate.notebook.sessions.length,30);
 const before=DATA_KEYS.map(k=>target.getItem(k));incoming.notebook.sessions[0].reason='新的解释';
 assert.throws(()=>importBackup(target,JSON.stringify(incoming)),/上限/);assert.deepEqual(DATA_KEYS.map(k=>target.getItem(k)),before);
});
test('invalid or oversized observations are rejected before any storage write',()=>{
 const target=populated(),before=DATA_KEYS.map(k=>target.getItem(k)),bad=readBackup(populated());bad.observations[0].params.frequency=-10;
 assert.throws(()=>importBackup(target,JSON.stringify(bad)),/无效主题观察/);assert.deepEqual(DATA_KEYS.map(k=>target.getItem(k)),before);
 assert.throws(()=>parseBackup('{'),/JSON/);assert.throws(()=>parseBackup(JSON.stringify({version:2})),/不.*支持/);
});
test('a write failure restores all three original storage keys',()=>{
 const target=populated(),before=DATA_KEYS.map(k=>target.getItem(k)),incoming=readBackup(populated());incoming.observations[0].note='new';
 const original=target.setItem;let writes=0;target.setItem=(k,v)=>{if(++writes===2)throw Error('quota');original(k,v);};
 assert.throws(()=>importBackup(target,JSON.stringify(incoming)),/已恢复/);assert.deepEqual(DATA_KEYS.map(k=>target.getItem(k)),before);
});
