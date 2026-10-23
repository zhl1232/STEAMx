import test from 'node:test';
import assert from 'node:assert/strict';
import {DATA_KEYS,readBackup,parseBackup,importBackup} from '../../public/physics-lab/transfer.mjs';
import {defaults} from '../../public/physics-lab/exploration-model.mjs';
import {lessonScene,restoreNotebook} from '../../public/physics-lab/learning-model.mjs';
function storage(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
function populated(){const s=storage(),scene=lessonScene('single');scene.lessonSession={id:'session-1',lessonId:'light'};
 s.setItem(DATA_KEYS[0],JSON.stringify([{id:'build-1',name:'我的实验',date:'today',scene}]));
 s.setItem(DATA_KEYS[1],JSON.stringify(restoreNotebook({version:1,lastId:'session-1',sessions:[{id:'session-1',lessonId:'light',workingScene:scene,records:[{id:'record-1',at:'today',scene,note:'灯亮了'}]}]})));
 s.setItem(DATA_KEYS[2],JSON.stringify([{id:'observation-1',experiment:'sound',params:defaults('sound'),time:1,level:1,note:'频率翻倍',at:'today'}]));return s;}
test('a whole-lab backup round trips across origins and importing it twice is idempotent',()=>{
 const source=populated(),raw=JSON.stringify(readBackup(source)),target=storage();importBackup(target,raw);importBackup(target,raw);
 for(const key of DATA_KEYS)assert.deepEqual(JSON.parse(target.getItem(key)),JSON.parse(source.getItem(key)));
});
test('colliding IDs preserve local data and reconnect imported session references',()=>{
 const target=populated(),incoming=readBackup(populated());incoming.notebook.sessions[0].reason='新站来的解释';incoming.experiments[0].name='另一份搭建';incoming.observations[0].note='另一条观察';
 const r=importBackup(target,JSON.stringify(incoming));assert.equal(r.notebook.sessions.length,2);assert.equal(r.experiments.length,2);assert.equal(r.observations.length,2);
 assert.equal(r.experiments[0].name,'我的实验');assert.equal(r.notebook.sessions[0].reason,'');assert.equal(r.observations[0].note,'频率翻倍');
 const id=r.notebook.sessions[1].id;assert.notEqual(id,'session-1');assert.equal(r.experiments[1].scene.lessonSession.id,id);assert.equal(r.notebook.sessions[1].workingScene.lessonSession.id,id);assert.equal(r.notebook.sessions[1].records[0].scene.lessonSession.id,id);
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
