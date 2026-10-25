import {labStorage,storageDescription} from './host-storage.mjs';
import {validateScene} from './physics.mjs';
import {restoreNotebook} from './learning-model.mjs';
import {restoreObservations,OBSERVATION_KEY} from './explorations.js';
export const DATA_KEYS=['steamx-physics-experiments-v1','steamx-learning-notebook-v1',OBSERVATION_KEY];
const copy=x=>JSON.parse(JSON.stringify(x));
function savedExperiments(items){if(!Array.isArray(items)||items.length>30)throw Error('实验存档格式或数量不正确');return items.map(x=>{if(!x||typeof x.id!=='string'||typeof x.name!=='string')throw Error('实验存档缺少名称');return {id:x.id.slice(0,100),name:x.name.slice(0,60),date:String(x.date||'').slice(0,50),scene:validateScene(copy(x.scene))};});}
export function readBackup(storage){return {kind:'steamx-physics-backup',version:1,exportedAt:new Date().toISOString(),experiments:savedExperiments(JSON.parse(storage.getItem(DATA_KEYS[0])||'[]')),notebook:restoreNotebook(storage.getItem(DATA_KEYS[1])),observations:restoreObservations(storage.getItem(DATA_KEYS[2]))};}
export function parseBackup(raw){if(typeof raw!=='string'||raw.length>8*1024*1024)throw Error('请选择小于 8 MB 的实验室备份');let b;try{b=JSON.parse(raw);}catch{throw Error('备份不是有效的 JSON 文件');}if(b?.kind!=='steamx-physics-backup'||b.version!==1)throw Error('这不是受支持的物理实验室备份');const experiments=savedExperiments(b.experiments);if(b.notebook?.version!==1||!Array.isArray(b.notebook.sessions)||b.notebook.sessions.length>30)throw Error('任务记录格式不正确');const notebook=restoreNotebook(JSON.stringify(b.notebook));if(notebook.sessions.length!==b.notebook.sessions.length)throw Error('备份包含无法识别的任务记录');for(let i=0;i<notebook.sessions.length;i++)if(notebook.sessions[i].records.length!==b.notebook.sessions[i].records?.length)throw Error('备份中有无效读数，请重新导出');if(!Array.isArray(b.observations)||b.observations.length>120)throw Error('主题观察格式不正确');const observations=restoreObservations(b.observations);if(observations.length!==b.observations.length)throw Error('备份中有无效主题观察');return {...b,experiments,notebook,observations};}
export function mergeBackup(current,incoming){
 const result=copy(current),idMap=new Map();
 const uniqueId=(id,items)=>{let n=1,candidate=id;while(items.some(x=>x.id===candidate)){const suffix='-import-'+n++;candidate=id.slice(0,100-suffix.length)+suffix;}return candidate;};
 // IDs identify stored copies; compare content independently of collision renames.
 const contentKey=item=>JSON.stringify({...item,id:null},(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
 const sessionWithId=(item,id)=>{const s=copy(item);s.id=id;const attach=scene=>{if(scene?.lessonSession?.id===item.id)scene.lessonSession.id=id;};attach(s.workingScene);s.records.forEach(r=>attach(r.scene));return s;};
 for(const item of incoming.notebook.sessions){const key=contentKey(sessionWithId(item,null)),old=result.notebook.sessions.find(x=>contentKey(sessionWithId(x,null))===key);if(old){idMap.set(item.id,old.id);continue;}const s=sessionWithId(item,uniqueId(item.id,result.notebook.sessions));idMap.set(item.id,s.id);result.notebook.sessions.push(s);}
 if(!result.notebook.lastId&&incoming.notebook.lastId)result.notebook.lastId=idMap.get(incoming.notebook.lastId)||null;
 for(const item of incoming.experiments){const x=copy(item);if(idMap.has(x.scene.lessonSession?.id))x.scene.lessonSession.id=idMap.get(x.scene.lessonSession.id);if(result.experiments.some(old=>contentKey(old)===contentKey(x)))continue;x.id=uniqueId(x.id,result.experiments);result.experiments.push(x);}
 for(const item of incoming.observations){if(result.observations.some(x=>contentKey(x)===contentKey(item)))continue;const x=copy(item);x.id=uniqueId(x.id,result.observations);result.observations.push(x);}
 if(result.experiments.length>30||result.notebook.sessions.length>30||result.observations.length>120)throw Error('合并后超过存储数量上限，请先导出并整理旧记录。此次没有导入。');return result;
}
export function importBackup(storage,raw){const merged=mergeBackup(readBackup(storage),parseBackup(raw)),before=DATA_KEYS.map(k=>storage.getItem(k)),values=[merged.experiments,merged.notebook,merged.observations];try{DATA_KEYS.forEach((key,i)=>storage.setItem(key,JSON.stringify(values[i])));}catch{let restored=true;DATA_KEYS.forEach((key,i)=>{try{if(before[i]===null)storage.removeItem(key);else storage.setItem(key,before[i]);}catch{restored=false;}});throw Error(restored?'存储空间不足，已恢复导入前的数据。':'存储不可用，无法完整恢复，请保留备份文件。');}return merged;}
export function setupTransfer({openModal,toast,reload}){
 const $=s=>document.querySelector(s);
 $('#transfer-btn').onclick=()=>{
  openModal('备份与迁移',`<p class="modal-copy">将已保存的实验、任务记录、主题观察打包。${storageDescription('先在旧站导出，再到新站导入；域名之间不会自动同步。')}尚未保存的自由搭建，请先点击「保存」。</p><button id="export-lab-backup" class="modal-primary">导出全部已保存数据</button><label class="transfer-file" for="import-lab-backup">导入实验室备份</label><input id="import-lab-backup" type="file" accept=".json,application/json"><p class="modal-copy">导入会合并记录，不覆盖同名的已有实验。</p><p id="transfer-result" role="status"></p>`);
  $('#export-lab-backup').onclick=()=>{try{const b=readBackup(labStorage),url=URL.createObjectURL(new Blob([JSON.stringify(b,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='创探空间-实验室备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出实验室备份');}catch(e){$('#transfer-result').textContent=e.message;}};
  $('#import-lab-backup').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>8*1024*1024)throw Error('备份文件不能大于 8 MB');const r=importBackup(labStorage,await file.text());reload();$('#transfer-result').textContent=`导入完成。现有 ${r.experiments.length} 个存档、${r.notebook.sessions.length} 份任务记录、${r.observations.length} 条主题观察。`;}catch(error){$('#transfer-result').textContent=error.message;}};
 };
}
