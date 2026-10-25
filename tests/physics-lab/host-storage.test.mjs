import test from 'node:test';
import assert from 'node:assert/strict';
const moduleURL=new URL('../../public/physics-lab/host-storage.mjs',import.meta.url);
let instance=0;
async function bridge(t,{embedded=true,sameOrigin=true,query='?host=steamx',randomUUID}={}){
  const originals=new Map(['window','parent','location','addEventListener','localStorage','crypto'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  t.after(()=>{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  const messages=[],handlers=[],data=new Map(),origin='https://school.example';
  const parent={location:{origin:sameOrigin?origin:'https://elsewhere.example'},postMessage:(message,target)=>messages.push({message,target})};
  Object.assign(globalThis,{window:globalThis,parent:embedded?parent:globalThis,location:{origin,search:query},addEventListener:(type,callback)=>{if(type==='message')handlers.push(callback);},localStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)}});
  if(randomUUID)Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID}});
  const api=await import(`${moduleURL}?instance=${++instance}`);
  const values=Object.fromEntries(api.HOST_STORAGE_KEYS.map(key=>[key,null]));
  const dispatch=(message,overrides={})=>{for(const handler of handlers)handler({source:parent,origin,data:message,...overrides});};
  const init=(overrides={})=>dispatch({type:'steamx-physics-storage-init',version:1,documentId:messages.find(item=>item.message.type==='steamx-physics-storage-ready')?.message.documentId,sessionId:'session-1',account:true,values,...overrides});
  return {api,messages,handlers,data,values,dispatch,init,parent,origin};
}
test('standalone facade resolves the current browser storage dynamically, without import side effects',async t=>{
  const {api,messages,data,handlers}=await bridge(t,{embedded:false});
  assert.equal(handlers.length,0);assert.equal(messages.length,0);
  await api.initializeHostStorage();api.labStorage.setItem('custom','first');assert.equal(data.get('custom'),'first');
  globalThis.localStorage={getItem:()=> 'replacement',setItem(){},removeItem(){}};
  assert.equal(api.labStorage.getItem('custom'),'replacement');assert.equal(api.isHostStorageEmbedded(),false);
});
test('host query alone, ordinary iframes and cross-origin parents never enable the bridge',async t=>{
  for(const options of [{embedded:false},{query:''},{sameOrigin:false}]){
    const env=await bridge(t,options);await env.api.initializeHostStorage();assert.equal(env.api.isHostStorageEmbedded(),false);assert.equal(env.messages.length,0);
  }
});
test('embedded initialization waits for a valid same-origin parent message and accepts only its first session',async t=>{
  const e=await bridge(t);let initialized=false;
  const pending=e.api.initializeHostStorage().then(()=>{initialized=true;});await Promise.resolve();
  assert.equal(initialized,false);assert.deepEqual(e.messages[0],{message:{type:'steamx-physics-storage-ready',version:1,documentId:e.messages[0].message.documentId},target:e.origin});
  const message={type:'steamx-physics-storage-init',version:1,documentId:e.messages[0].message.documentId,sessionId:'first',account:true,values:e.values};
  e.dispatch(message,{origin:'https://wrong.example'});e.dispatch(message,{source:{}});
  e.init({documentId:'previous-document'});e.init({documentId:undefined});e.init({version:2});e.init({account:'yes'});e.init({sessionId:''});e.init({values:{...e.values,extra:'no'}});e.init({values:{...e.values,[e.api.HOST_STORAGE_KEYS[0]]:{}}});
  await Promise.resolve();assert.equal(initialized,false);
  e.dispatch({type:'steamx-physics-storage-request',version:1});assert.equal(e.messages.length,2);
  assert.equal(typeof e.messages[0].message.documentId,'string');assert.ok(e.messages[0].message.documentId.length>0&&e.messages[0].message.documentId.length<=200);
  assert.equal(e.messages[1].message.documentId,e.messages[0].message.documentId);
  e.init({values:{...e.values,[e.api.HOST_STORAGE_KEYS[0]]:'stored'}});await pending;
  assert.equal(e.api.labStorage.getItem(e.api.HOST_STORAGE_KEYS[0]),'stored');
  assert.match(e.api.storageDescription('standalone'),/当前账号/);
  e.init({sessionId:'other',values:e.values});assert.equal(e.api.labStorage.getItem(e.api.HOST_STORAGE_KEYS[0]),'stored');
  assert.equal(e.data.size,0);
});
test('writes coalesce into a full snapshot, reject unknown keys and do not touch browser storage',async t=>{
  const e=await bridge(t);const ready=e.api.initializeHostStorage();e.init({account:false});await ready;
  assert.match(e.api.storageDescription('standalone'),/游客/);
  const [a,b,c]=e.api.HOST_STORAGE_KEYS;
  assert.throws(()=>e.api.labStorage.setItem('other','value'));assert.throws(()=>e.api.labStorage.removeItem('other'));
  assert.equal(e.api.labStorage.getItem('other'),null);
  e.api.labStorage.setItem(a,'one');e.api.labStorage.setItem(b,'two');e.api.labStorage.setItem(c,'three');e.api.labStorage.removeItem(b);
  assert.equal(e.messages.length,1);await Promise.resolve();
  assert.deepEqual(e.messages[1].message,{type:'steamx-physics-storage-change',version:1,documentId:e.messages[0].message.documentId,sessionId:'session-1',revision:4,values:{[a]:'one',[b]:null,[c]:'three'}});assert.equal(e.data.size,0);
});
test('replacement validates origin, source and session, refreshes observers and never echoes',async t=>{
  const e=await bridge(t);const ready=e.api.initializeHostStorage();e.init();await ready;
  let updates=0;const unsubscribe=e.api.onHostStorageReplace(()=>updates++),key=e.api.HOST_STORAGE_KEYS[0];
  const message={type:'steamx-physics-storage-replace',version:1,sessionId:'session-1',requestId:'replace-1',expectedRevision:0,values:{...e.values,[key]:'remote'}};
  e.dispatch({...message,sessionId:'old-session'});e.dispatch(message,{source:{}});e.dispatch(message,{origin:'https://wrong.example'});e.dispatch({...message,values:[]});
  assert.equal(updates,0);assert.equal(e.api.labStorage.getItem(key),null);
  e.api.labStorage.setItem(key,'pending');e.dispatch({...message,expectedRevision:1});await Promise.resolve();
  assert.equal(updates,1);assert.equal(e.api.labStorage.getItem(key),'remote');assert.equal(e.messages.length,2);
  assert.deepEqual(e.messages[1].message,{type:'steamx-physics-storage-replaced',version:1,documentId:e.messages[0].message.documentId,sessionId:'session-1',requestId:'replace-1',revision:2,values:message.values});
  e.api.labStorage.setItem(key,'after-replace');await Promise.resolve();assert.equal(e.messages.length,3);
  assert.equal(e.messages[2].message.revision,3);
  unsubscribe();e.dispatch({...message,expectedRevision:3});assert.equal(updates,1);
});
test('transport rejects oversized UTF-8 snapshots and oversized writes without replacing memory',async t=>{
  const e=await bridge(t),key=e.api.HOST_STORAGE_KEYS[0];let done=false;
  const pending=e.api.initializeHostStorage().then(()=>{done=true;});
  const huge='汉'.repeat(3*1024*1024);
  e.init({values:{...e.values,[key]:huge}});await Promise.resolve();assert.equal(done,false);
  e.init();await pending;assert.throws(()=>e.api.labStorage.setItem(key,huge),/8 MB/);assert.equal(e.api.labStorage.getItem(key),null);
  e.dispatch({type:'steamx-physics-storage-replace',version:1,sessionId:'session-1',requestId:'replace-1',expectedRevision:0,values:{...e.values,[key]:huge}});
  assert.equal(e.api.labStorage.getItem(key),null);
});
test('transport counts raw UTF-8 values rather than JSON envelope escaping',async t=>{
  const e=await bridge(t),key=e.api.HOST_STORAGE_KEYS[0];
  const ready=e.api.initializeHostStorage();
  const raw='"'.repeat(8*1024*1024);
  e.init({values:{...e.values,[key]:raw}});await ready;
  assert.equal(e.api.labStorage.getItem(key),raw);
  assert.throws(()=>e.api.labStorage.setItem(e.api.HOST_STORAGE_KEYS[1],'a'),/8 MB/);
});
test('DOM-only: app waits for host records, refreshes saved lists and preserves an unsaved workbench',async t=>{
  const {readFile}=await import('node:fs/promises');
  const {createDOM}=await import('./dom-fixture.mjs');
  const {lessonScene}=await import('../../public/physics-lab/learning-model.mjs');
  const e=await bridge(t),env=createDOM(await readFile(new URL('../../public/physics-lab/index.html',import.meta.url),'utf8'));
  const originals=new Map(['document','requestAnimationFrame'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  t.after(()=>{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  Object.assign(globalThis,{document:env.document,requestAnimationFrame:env.requestAnimationFrame});
  let announce;const announced=new Promise(resolve=>announce=resolve);
  e.parent.postMessage=(message,target)=>{e.messages.push({message,target});if(message.type==='steamx-physics-storage-ready')announce();};
  const app=import('../../public/physics-lab/app.js');await announced;
  const $=selector=>env.document.querySelector(selector);
  assert.equal($('body').classList.contains('storage-loading'),true);
  assert.equal($('#save-btn').onclick,undefined);
  const key=e.api.HOST_STORAGE_KEYS[0],scene=lessonScene('single');
  const saved=name=>JSON.stringify([{id:'saved',name,date:'2026-10-23',scene}]);
  e.init({values:{...e.values,[key]:saved('宿主实验')}});await app;
  assert.equal($('body').classList.contains('storage-loading'),false);
  await $('#load-btn').fire('click');assert.match($('#saved-list').textContent,/宿主实验/);
  await $('#modal-close').fire('click');
  const battery=env.document.querySelectorAll('.component').find(component=>component.dataset.id==='c1');
  await battery.fire('pointerdown',{clientX:265,clientY:235});await $('#stage').fire('pointerup',{clientX:265,clientY:235});
  $('#parameter').value='12';await $('#parameter').fire('input');
  const before=$('#components-layer').innerHTML,dirty=$('#dirty-indicator').textContent;
  await $('#load-btn').fire('click');
  const changes=e.messages.filter(item=>item.message.type==='steamx-physics-storage-change').length;
  e.dispatch({type:'steamx-physics-storage-replace',version:1,sessionId:'session-1',requestId:'replace-1',expectedRevision:0,values:{...e.values,[key]:saved('云端更新')}});
  await Promise.resolve();
  assert.match($('#saved-list').textContent,/云端更新/);assert.doesNotMatch($('#saved-list').textContent,/宿主实验/);
  assert.equal($('#components-layer').innerHTML,before);assert.equal($('#dirty-indicator').textContent,dirty);
  assert.equal(e.messages.filter(item=>item.message.type==='steamx-physics-storage-change').length,changes);
});
test('a child edit after the parent captures a revision rejects replacement and preserves the latest records',async t=>{
  const e=await bridge(t);const ready=e.api.initializeHostStorage();e.init();await ready;
  const key=e.api.HOST_STORAGE_KEYS[0];let callbacks=0;e.api.onHostStorageReplace(()=>callbacks++);
  // The parent captured revision 0, then the learner saves before replacement arrives.
  e.api.labStorage.setItem(key,'new learner record');
  e.dispatch({type:'steamx-physics-storage-replace',version:1,sessionId:'session-1',requestId:'merge-stale',expectedRevision:0,values:{...e.values,[key]:'older merged records'}});
  assert.equal(callbacks,0);assert.equal(e.api.labStorage.getItem(key),'new learner record');
  assert.deepEqual(e.messages[1].message,{type:'steamx-physics-storage-replace-rejected',version:1,documentId:e.messages[0].message.documentId,sessionId:'session-1',requestId:'merge-stale',revision:1,values:{...e.values,[key]:'new learner record'}});
  await Promise.resolve();
  assert.equal(e.messages[2].message.type,'steamx-physics-storage-change');assert.equal(e.messages[2].message.revision,1);
  // Rebuilding against the current revision accepts, increments once and acknowledges.
  e.dispatch({type:'steamx-physics-storage-replace',version:1,sessionId:'session-1',requestId:'merge-retry',expectedRevision:1,values:{...e.values,[key]:'rebuilt merged records'}});
  assert.equal(callbacks,1);assert.equal(e.api.labStorage.getItem(key),'rebuilt merged records');
  assert.equal(e.messages[3].message.type,'steamx-physics-storage-replaced');assert.equal(e.messages[3].message.requestId,'merge-retry');assert.equal(e.messages[3].message.revision,2);
});
test('only effective writes advance revision and replacements require valid fence fields',async t=>{
  const e=await bridge(t);const ready=e.api.initializeHostStorage();e.init();await ready;
  const key=e.api.HOST_STORAGE_KEYS[0];
  e.api.labStorage.removeItem(key);await Promise.resolve();assert.equal(e.messages.length,1);
  e.api.labStorage.setItem(key,'one');e.api.labStorage.setItem(key,'one');await Promise.resolve();
  assert.equal(e.messages[1].message.revision,1);
  const message={type:'steamx-physics-storage-replace',version:1,sessionId:'session-1',requestId:'merge-1',expectedRevision:1,values:e.values};
  for(const invalid of [{expectedRevision:undefined},{expectedRevision:-1},{expectedRevision:1.5},{requestId:undefined},{requestId:''},{requestId:'x'.repeat(201)}])e.dispatch({...message,...invalid});
  assert.equal(e.messages.length,2);assert.equal(e.api.labStorage.getItem(key),'one');
  e.api.labStorage.removeItem(key);e.api.labStorage.removeItem(key);await Promise.resolve();
  assert.equal(e.messages[2].message.revision,2);
});
test('each document creates its own stable handshake token and rejects initialization for a previous document',async t=>{
  let generations=0;const e=await bridge(t,{randomUUID:()=>{generations++;return 'new-document-token';}});
  let initialized=false;const ready=e.api.initializeHostStorage().then(()=>{initialized=true;});
  const repeated=e.api.initializeHostStorage();
  assert.equal(e.messages[0].message.documentId,'new-document-token');
  e.init({documentId:'old-document-token'});await Promise.resolve();assert.equal(initialized,false);
  e.dispatch({type:'steamx-physics-storage-request',version:1});
  assert.equal(e.messages[1].message.documentId,'new-document-token');assert.equal(generations,1);
  e.init();await ready;await repeated;
  e.dispatch({type:'steamx-physics-storage-request',version:1});
  assert.equal(e.messages[2].message.documentId,'new-document-token');assert.equal(generations,1);
});
