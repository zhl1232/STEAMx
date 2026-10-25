// Raw storage transport only. Backup validation belongs to the host.
export const HOST_STORAGE_KEYS=Object.freeze(['steamx-physics-experiments-v1','steamx-learning-notebook-v1','steamx-topic-observations-v1']);
const MAX_SIZE=8*1024*1024;
let embedded=false,account=false,sessionId=null,documentId=null,initialization=null,resolveInitialization,queued=false,revision=0,notificationGeneration=0;
const memory=new Map(),listeners=new Set();
const values=()=>Object.fromEntries(HOST_STORAGE_KEYS.map(key=>[key,memory.get(key)??null]));
function validValues(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==HOST_STORAGE_KEYS.length)return false;
  if(!HOST_STORAGE_KEYS.every(key=>Object.hasOwn(value,key)&&(value[key]===null||typeof value[key]==='string')))return false;
  const encoder=new TextEncoder();
  return HOST_STORAGE_KEYS.reduce((size,key)=>size+(value[key]===null?0:encoder.encode(value[key]).byteLength),0)<=MAX_SIZE;
}
function replace(value){memory.clear();for(const key of HOST_STORAGE_KEYS)if(value[key]!==null)memory.set(key,value[key]);notificationGeneration++;queued=false;}
function publish(){
  if(queued||!sessionId)return;
  queued=true;const expectedGeneration=notificationGeneration;
  queueMicrotask(()=>{if(expectedGeneration!==notificationGeneration)return;queued=false;globalThis.parent.postMessage({type:'steamx-physics-storage-change',version:1,sessionId,documentId,revision,values:values()},globalThis.location.origin);});
}
export const labStorage={
  getItem(key){return embedded?(memory.get(String(key))??null):globalThis.localStorage.getItem(key);},
  setItem(key,value){
    if(!embedded)return globalThis.localStorage.setItem(key,value);
    key=String(key);if(!HOST_STORAGE_KEYS.includes(key))throw Error('Unsupported physics storage key');
    value=String(value);if(memory.get(key)===value)return;
    const next={...values(),[key]:value};if(!validValues(next))throw Error('Physics storage exceeds 8 MB');
    memory.set(key,value);revision++;publish();
  },
  removeItem(key){
    if(!embedded)return globalThis.localStorage.removeItem(key);
    key=String(key);if(!HOST_STORAGE_KEYS.includes(key))throw Error('Unsupported physics storage key');
    if(!memory.delete(key))return;revision++;publish();
  }
};
export const isHostStorageEmbedded=()=>embedded;
export function storageDescription(standalone){return embedded?(account?'记录归属当前账号，保存状态见页面上方':'游客记录保存在本机，可登录后导入'):standalone;}
export function onHostStorageReplace(callback){listeners.add(callback);return ()=>listeners.delete(callback);}
export function initializeHostStorage(){
  if(initialization)return initialization;
  try{
    if(!globalThis.window||!globalThis.location||globalThis.parent===globalThis||!globalThis.parent||new URLSearchParams(globalThis.location.search).get('host')!=='steamx'||globalThis.parent.location.origin!==globalThis.location.origin)return Promise.resolve();
  }catch{return Promise.resolve();}
  embedded=true;
  documentId=globalThis.crypto?.randomUUID?.()||`physics-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  initialization=new Promise(resolve=>{resolveInitialization=resolve;});
  const ready=()=>globalThis.parent.postMessage({type:'steamx-physics-storage-ready',version:1,documentId},globalThis.location.origin);
  globalThis.addEventListener('message',event=>{
    if(event.origin!==globalThis.location.origin||event.source!==globalThis.parent)return;
    const data=event.data;if(!data||typeof data!=='object'||Array.isArray(data)||data.version!==1)return;
    if(data.type==='steamx-physics-storage-request'){ready();return;}
    if(data.type==='steamx-physics-storage-init'){
      if(sessionId||data.documentId!==documentId||typeof data.sessionId!=='string'||!data.sessionId||data.sessionId.length>200||typeof data.account!=='boolean'||!validValues(data.values))return;
      sessionId=data.sessionId;account=data.account;replace(data.values);revision=0;resolveInitialization();
    }else if(data.type==='steamx-physics-storage-replace'&&sessionId&&data.sessionId===sessionId&&validValues(data.values)&&Number.isSafeInteger(data.expectedRevision)&&data.expectedRevision>=0&&typeof data.requestId==='string'&&data.requestId.length>0&&data.requestId.length<=200){
      let type='steamx-physics-storage-replace-rejected';
      if(data.expectedRevision===revision){
        replace(data.values);revision++;for(const callback of listeners)callback();
        type='steamx-physics-storage-replaced';
      }
      globalThis.parent.postMessage({type,version:1,sessionId,documentId,requestId:data.requestId,revision,values:values()},globalThis.location.origin);
    }
  });
  ready();return initialization;
}
