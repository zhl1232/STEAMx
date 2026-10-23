import {LESSONS,LEVELS,levelById,lessonById,startScene,lessonScene,measure,evidence,hintTargets,restoreNotebook,reportHTML,escapeHTML as esc,number} from './learning-model.mjs';
import {ports} from './physics.mjs';
const STORAGE='steamx-learning-notebook-v1';
const copy=x=>JSON.parse(JSON.stringify(x));
const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
const STARTERS=[
 {id:'light',title:'点亮灯泡',action:'点击「画电线」，把灯泡空着的端点接回电池空着的端点。',discovery:'灯亮了！电流有了一条经过灯泡、回到电池的完整通路。'},
 {id:'switch',title:'开关控制',action:'直接点击工作台上的开关，断开开关，看看灯泡。',discovery:'灯熄灭了！开关切断了回路。你也可以重新闭合它，再看一次。'},
 {id:'voltage',title:'改变亮度',action:'选中电池，调高电压，观察灯泡的亮度变化。',discovery:'灯变亮了！保持同一个灯泡和接线，调高电压会让它消耗更多功率。'}
];
function starterScene(id){const scene=startScene(id);if(id==='voltage')scene.components.find(c=>c.type==='battery').value=3;scene.name=STARTERS.find(g=>g.id===id).title;scene.starterActivity=id;return scene;}

export function createLearning({getScene,setScene,openModal,closeModal,toast,hasWireDraft}){
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
 let notebook=restoreNotebook(null),storageError=false,key=null,lastRemoved=null,recordView=null,sheetOpen=false,recordTools=false;
 try{notebook=restoreNotebook(localStorage.getItem(STORAGE));}catch{storageError=true;}
 const active=()=>{const ref=getScene().lessonSession;return getScene().mode==='circuit'&&ref?notebook.sessions.find(s=>s.id===ref.id&&s.lessonId===ref.lessonId)||null:null;};
 const save=()=>{renderCounts();try{localStorage.setItem(STORAGE,JSON.stringify(notebook));storageError=false;}catch{storageError=true;}$('#learning-storage').textContent=storageError?'浏览器存储不可用或已满；本次内容暂存内存，请导出报告，刷新后可能丢失。':'学习记录保存在当前浏览器，可导出报告；不会自动同步到其他设备。';};
 const download=(text,type,name)=>{const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const persistSession=s=>{if(s.completedAt&&(!s.reflection.trim()||!evidence(s.lessonId,s.records).ready))s.completedAt=null;save();};
 function attach(s,scene){const result=copy(scene);result.lessonSession={id:s.id,lessonId:s.lessonId};return result;}
 const starter=()=>getScene().mode==='circuit'&&!active()?STARTERS.find(g=>g.id===getScene().starterActivity):null;
 function leave(){const scene=copy(getScene());delete scene.lessonSession;delete scene.starterActivity;notebook.lastId=null;sheetOpen=false;save();setScene(scene);toast('可以继续自由搭建；已有实验记录仍保留。');}
 function startGuide(id){sheetOpen=false;notebook.lastId=null;key=null;save();closeModal();setScene(starterScene(id));}
 function starters(){
  openModal('跟着做 · 从一个小发现开始',`<p class="modal-copy">选一个试试。每次只做一步，直接观察变化。</p><div class="starter-list">${STARTERS.map((g,i)=>`<button class="modal-choice" data-start-guide="${g.id}"><span class="starter-number">${i+1}</span><span><strong>${g.title}</strong><small>${['接上一条线，让灯亮起来','断开开关，观察亮灭','调一调电压，看看亮度'][i]}</small></span><span aria-hidden="true">↗</span></button>`).join('')}</div><p class="modal-copy">开始会载入对应搭建，可用「撤销」找回当前实验。</p>`);
  $$('[data-start-guide]').forEach(b=>b.onclick=()=>startGuide(b.dataset.startGuide));
 }
 function renderActivity(){
  const s=active(),l=lessonById(s?.lessonId),g=starter(),box=$('#activity-body');box.hidden=!l&&!g;
  if(g){
   const baseline=starterScene(g.id),ready=evidence(g.id,[{scene:baseline},{scene:getScene()}]).ready&&(g.id!=='voltage'||measure(getScene()).voltage>3),next=STARTERS[STARTERS.indexOf(g)+1];
   const view=`guide:${g.id}:${ready}`;if(box.getAttribute('data-view')===view)return;box.setAttribute('data-view',view);
   box.innerHTML=`<div class="activity-copy"><span class="activity-label">跟着做 · ${esc(g.title)}</span><p id="guide-instruction" role="status" aria-live="polite">${esc(ready?g.discovery:g.action)}</p></div><div class="activity-actions">${ready&&next?`<button id="guide-next" class="lesson-primary">试试${esc(next.title)} →</button>`:''}<button id="restart-guide">重新试试</button><button id="leave-activity">自由搭建</button></div>`;
   if($('#guide-next'))$('#guide-next').onclick=()=>startGuide(next.id);$('#restart-guide').onclick=()=>startGuide(g.id);$('#leave-activity').onclick=leave;return;
  }
  const view=l?`lesson:${s.id}:${sheetOpen}`:'free';if(box.getAttribute('data-view')===view)return;box.setAttribute('data-view',view);
  if(l){box.innerHTML=`<div class="activity-copy"><span class="activity-label">正在探索 · ${esc(levelById(l.level).name)}</span><p>${esc(l.title)}</p></div><div class="activity-actions"><button id="toggle-worksheet" aria-expanded="${sheetOpen}" aria-controls="lesson-body">${sheetOpen?'收起探究单':'展开探究单'}</button><button id="leave-lesson">自由搭建</button></div>`;$('#toggle-worksheet').onclick=()=>{sheetOpen=!sheetOpen;update();$('#toggle-worksheet')?.focus?.();};$('#leave-lesson').onclick=leave;}
 }
 function teacherTools(){
  openModal('教师与进阶工具',`<p class="modal-copy">需要完整探究流程时，再打开任务、记录和报告。</p><button id="notebook-btn" class="modal-choice"><span><strong>实验记录与报告 · <span id="notebook-count"></span> 条</strong><small>查看已有记录、恢复搭建、导出可打印报告</small></span></button><button id="teacher-catalog" class="modal-choice"><span><strong>电路探究任务 · 18 个实验</strong><small>入门探索 → 规律探究 → 综合挑战 · <span id="learning-completed"></span></small></span></button><button id="toggle-record-tools" class="modal-choice"><span><strong>${recordTools?'收起':'显示'}工作台上的记录按钮</strong><small>自由探索时也能保存读数和接线快照</small></span></button><p class="modal-copy">记录保存在当前浏览器，已有任务进度和报告都在这里。</p>`);
  renderCounts();$('#notebook-btn').onclick=()=>notebookDialog();$('#teacher-catalog').onclick=()=>catalog();$('#toggle-record-tools').onclick=()=>{recordTools=!recordTools;closeModal();update();toast(recordTools?'已在实时读数旁显示「记录读数」':'已收起记录按钮');};
 }
 function start(id){
  if(notebook.sessions.length>=30){toast('已有 30 份探究记录，请先导出并删除不再需要的记录');return;}
  const s={id:uid(),lessonId:id,startedAt:new Date().toISOString(),prediction:'',reason:'',reflection:'',hintLevel:0,records:[],completedAt:null};
  sheetOpen=true;s.workingScene=attach(s,startScene(id));notebook.sessions.unshift(s);notebook.lastId=s.id;key=null;save();closeModal();setScene(s.workingScene);toast('先写下预测，再动手实验。原来的搭建可撤销恢复。');
 }
 function resumeSession(s){sheetOpen=true;notebook.lastId=s.id;key=null;save();closeModal();setScene(attach(s,s.workingScene||startScene(s.lessonId)));}
 function catalog(levelId=lessonById(active()?.lessonId)?.level||'primary'){
  const level=levelById(levelId)||LEVELS[0],lessons=LESSONS.filter(l=>l.level===level.id),completed=new Set(notebook.sessions.filter(s=>s.completedAt).map(s=>s.lessonId));
  openModal('更多电路实验 · 选择适合的起点',`<p class="modal-copy">想深入电路时，可以选择完整探究任务。学段为建议，可以自由选择。开始后展开探究单，原场景可撤销恢复。</p><div class="lesson-level-tabs" role="group" aria-label="选择学习阶段">${LEVELS.map(x=>`<button data-lesson-level="${x.id}" aria-pressed="${x.id===level.id}" class="${x.id===level.id?'chosen':''}">${esc(x.name)}</button>`).join('')}</div><div class="level-intro"><strong>${esc(level.band)} · ${lessons.filter(l=>completed.has(l.id)).length} / 6 已完成</strong><p>${esc(level.focus)}</p></div><div class="lesson-catalog">${lessons.map((l,i)=>{const saved=notebook.sessions.find(s=>s.lessonId===l.id&&!s.completedAt);return `<article class="lesson-card"><span class="lesson-number">${i+1} / 6 · ${l.minutes}${completed.has(l.id)?' · 已完成':''}</span><h3>${esc(l.title)}</h3><p>${esc(l.goal)}</p><p class="lesson-prerequisites">建议先学：${l.prerequisites.length?l.prerequisites.map(id=>esc(lessonById(id)?.title||id)).join('、'):'无需前置电学知识'}</p><div class="lesson-card-actions"><button data-start-lesson="${l.id}">开始任务</button>${saved?`<button data-resume-lesson="${esc(saved.id)}">继续上次</button>`:''}</div></article>`;}).join('')}</div>`);
  $$('[data-lesson-level]').forEach(b=>b.onclick=()=>catalog(b.dataset.lessonLevel));$$('[data-start-lesson]').forEach(b=>b.onclick=()=>start(b.dataset.startLesson));$$('[data-resume-lesson]').forEach(b=>b.onclick=()=>resumeSession(notebook.sessions.find(s=>s.id===b.dataset.resumeLesson)));
 }
 function renderPanel(){
  const s=active(),l=s&&lessonById(s.lessonId);key=s?.id||'free';
  if(!l){$('#lesson-body').innerHTML='';return;}
  const locked=s.records.length>0;
  $('#lesson-body').innerHTML=`<div class="lesson-topline"><span class="lesson-number">${esc(levelById(l.level).name)} · ${esc(levelById(l.level).band)} · ${l.minutes}</span><span id="lesson-progress"></span></div><div class="lesson-columns"><div class="lesson-question"><h3>${esc(l.title)}</h3><p class="lesson-goal">${esc(l.goal)}</p><p class="lesson-prerequisites">建议先学：${l.prerequisites.length?l.prerequisites.map(id=>esc(lessonById(id)?.title||id)).join('、'):'无需前置电学知识'}</p><strong>${esc(l.question)}</strong><p>${esc(l.steps)}</p></div><div class="lesson-predict"><h4>① 先预测</h4><div class="prediction-choices" role="group" aria-label="选择你的预测">${l.choices.map((c,i)=>`<button data-prediction="${i}" aria-pressed="${s.prediction===c}" class="${s.prediction===c?'chosen':''}" ${locked?'disabled':''}>${esc(c)}</button>`).join('')}</div><label for="prediction-reason">说说你的理由</label><textarea id="prediction-reason" rows="2" maxlength="500" placeholder="我猜……因为……" ${locked?'disabled':''}></textarea><small>${locked?'最初的预测已保留。可以在解释中修正想法。':'预测不判对错，先留下自己的想法。'}</small></div><div class="lesson-support"><h4>② 动手验证</h4><p id="lesson-evidence" role="status"></p><div class="lesson-action-row"><button id="lesson-record" class="lesson-primary">记录这次读数</button><button id="next-hint">${s.hintLevel>=3?'重看参考接法':`提示 ${s.hintLevel+1} / 3`}</button></div><div id="lesson-hint" class="lesson-hint" aria-live="polite">${s.hintLevel?`<strong>提示 ${s.hintLevel} / 3</strong><p>${esc(l.hints[s.hintLevel-1])}</p>`:'需要帮助时，先看思考提示，再看端点提示，最后查看参考接法。'}</div></div></div><div class="lesson-reflection"><div><h4>③ 用证据解释</h4><label for="lesson-reflection">${esc(l.reflection)}</label></div><textarea id="lesson-reflection" rows="2" maxlength="1500" placeholder="比较几次实验记录，我发现……这说明……"></textarea><button id="complete-lesson" class="lesson-primary">完成探究记录</button><p id="lesson-feedback" role="status"></p></div>`;
  $('#prediction-reason').value=s.reason;$('#lesson-reflection').value=s.reflection;
  $$('[data-prediction]').forEach(b=>b.onclick=()=>{if(s.records.length)return;s.prediction=l.choices[+b.dataset.prediction];save();renderPanel();refreshProgress();});
  $('#prediction-reason').oninput=()=>{if(s.records.length)return;s.reason=$('#prediction-reason').value.slice(0,500);persistSession(s);refreshProgress();};
  $('#lesson-reflection').oninput=()=>{s.reflection=$('#lesson-reflection').value.slice(0,1500);persistSession(s);refreshProgress();};
  $('#lesson-record').onclick=recordCurrent;$('#next-hint').onclick=()=>{s.hintLevel=Math.min(3,s.hintLevel+1);save();renderPanel();refreshProgress();highlight();if(s.hintLevel===3)reference(l);};
  $('#complete-lesson').onclick=()=>{const ready=evidence(s.lessonId,s.records).ready;if(!s.prediction||!s.reason.trim()){feedback('先写下预测和理由，再留下实验记录。');return;}if(!ready){feedback(evidence(s.lessonId,s.records).message);return;}if(!s.reflection.trim()){feedback('请用记录中的数据写下你的解释。预测不同也没有关系。');return;}s.completedAt=new Date().toISOString();save();refreshProgress();feedback('探究记录已完成！可以导出报告，和老师讨论你的解释。');toast('已完成探究记录');};
 }
 function feedback(text){if($('#lesson-feedback'))$('#lesson-feedback').textContent=text;}
 function refreshProgress(){const s=active();if(!s||!lessonById(s.lessonId))return;const ready=evidence(s.lessonId,s.records);if($('#lesson-evidence'))$('#lesson-evidence').textContent=`已记录 ${s.records.length} 次。${ready.message}`;if($('#lesson-progress'))$('#lesson-progress').textContent=s.completedAt?'探究记录已完成':!s.prediction||!s.reason.trim()?'先留下预测和理由':!ready.ready?'收集任务所需的对比数据':'写下你的解释';if($('#complete-lesson'))$('#complete-lesson').disabled=!!s.completedAt;}
 function highlight(){
  const layer=$('#teaching-layer');if(!layer)return;layer.innerHTML='';const s=active();if(!s||s.hintLevel<2||!sheetOpen)return;const scene=getScene(),targets=hintTargets(scene);let shapes='';
  for(const p of targets.ports){const c=scene.components.find(c=>c.id===p.id),pos=ports(c)[p.port];shapes+=`<circle cx="${pos.x}" cy="${pos.y}" r="19" class="teaching-ring"/>`;}
  for(const id of targets.components){const c=scene.components.find(c=>c.id===id);shapes+=`<rect x="${c.x-80}" y="${c.y-47}" width="160" height="95" rx="18" class="teaching-ring"/>`;}
  for(const id of targets.wires){const group=$$('[data-wire]').find(w=>w.dataset.wire===id),d=group?.querySelector('.wire-path')?.getAttribute('d');if(d)shapes+=`<path d="${esc(d)}" class="teaching-wire"/>`;}
  layer.innerHTML=shapes;
 }
 function reference(l){
  const s=lessonScene(l.reference);const labels=c=>c.type==='battery'?`电池 ${c.value} V`:c.type==='switch'?'开关':`${c.type==='bulb'?'灯泡':'电阻'} ${c.id.toUpperCase()} · ${c.value} Ω`;
  // A separate illustrative diagram; opening it never edits the student's circuit.
  const wires=s.wires.map((w,i)=>{const a=ports(s.components.find(c=>c.id===w.a.id))[w.a.port],b=ports(s.components.find(c=>c.id===w.b.id))[w.b.port],y=310+i*36;return `<path d="M${a.x},${a.y}V${y}H${b.x}V${b.y}"/>`;}).join('');
  const components=s.components.map(c=>`<g><rect x="${c.x-55}" y="${c.y-25}" width="110" height="50" rx="10"/><text x="${c.x}" y="${c.y+5}">${labels(c)}</text>${ports(c).map(p=>`<circle cx="${p.x}" cy="${p.y}" r="6"/>`).join('')}</g>`).join('');
  openModal('参考接法 · 回到工作台自己试一试',`<p class="modal-copy">${esc(l.hints[2])}</p><svg class="reference-circuit" viewBox="100 150 760 370" role="img" aria-label="${esc(l.title)}参考电路"><g class="reference-wires">${wires}</g><g class="reference-components">${components}</g></svg><p class="modal-copy">示意图中的线条交叉不会自动接通。关闭此面板继续搭建，参考图不会替你完成任务。</p>`);
 }
 function ensureRecordSession(){let s=active();if(s)return s;s=notebook.sessions.find(s=>s.lessonId===null);if(!s){if(notebook.sessions.length>=30)return null;s={id:uid(),lessonId:null,startedAt:new Date().toISOString(),prediction:'',reason:'',reflection:'',hintLevel:0,records:[],completedAt:null,workingScene:null};notebook.sessions.unshift(s);}return s;}
 function recordCurrent(){
  if(getScene().mode!=='circuit')return;if(hasWireDraft()){toast('先完成或取消正在画的电线，再记录读数');return;}
  const s=ensureRecordSession();if(!s){toast('记录本已满，请先导出并删除旧记录');return;}if(s.lessonId&&(!s.prediction||!s.reason.trim())){feedback('先选一个预测并写下理由，再记录第一次读数。预测可以不正确。');toast('先留下预测和理由');return;}
  if(s.records.length>=20){toast('每份探究记录最多保存 20 次读数，请导出或删除不需要的记录');return;}
  const scene=copy(getScene()),m=measure(scene);
  openModal('记录这次读数',`<p class="modal-copy">${esc(m.status)} · ${number(m.voltage)} V · ${m.current===null?'短路，电流停止计算':number(m.current*1000)+' mA'}。将同时保存元件、接线和参数。</p><label for="record-note">我改变了什么？看到了什么？（可选）</label><textarea id="record-note" class="learning-textarea" maxlength="500" rows="3" placeholder="例如：只把电池从 6 V 调到 9 V，灯泡更亮了。"></textarea><button id="confirm-record" class="modal-primary">保存这次记录</button>`);
  $('#confirm-record').onclick=()=>{s.records.push({id:uid(),at:new Date().toISOString(),scene,note:$('#record-note').value.slice(0,500)});s.workingScene=scene;save();closeModal();key=null;update();toast(storageError?'读数已暂存，请导出报告以免丢失':'这次读数已记下，可继续改变一个条件');};
 }
 const time=iso=>{const d=new Date(iso);return Number.isNaN(+d)?'时间未知':d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});};
 function notebookDialog(sessionId){
  recordView=sessionId||active()?.id||notebook.sessions[0]?.id;const s=notebook.sessions.find(s=>s.id===recordView);
  const nav=notebook.sessions.map(x=>`<button data-notebook-session="${esc(x.id)}" class="${x.id===recordView?'chosen':''}">${esc(lessonById(x.lessonId)?.title||'自由探索')} · ${x.records.length} 次${x.completedAt?' ✓':''}<small>${esc(time(x.startedAt))}</small></button>`).join('');
  const rows=s?.records.map((r,i)=>{const m=measure(r.scene);return `<tr><td>${i+1}<small>${esc(time(r.at))}</small></td><td>${esc(m.status)}<small>${esc(m.topology)}</small></td><td>${number(m.voltage)} V<br>${m.current===null?'—':number(m.current*1000)} mA<small>等效 ${number(m.resistance)} Ω<br>总功率 ${number(m.power,4)} W</small></td><td>${m.loads.map(b=>`${esc(b.id.toUpperCase())}: ${m.short?'—':number(b.power,4)} W<small>${number(b.resistance)} Ω · ${number(b.voltage)} V · ${m.short?'—':number(b.current*1000)} mA</small>`).join('')||'无用电元件'}</td><td>${esc(r.note)||'—'}</td><td><button data-restore-record="${esc(r.id)}">恢复搭建</button><button data-delete-record="${esc(r.id)}">删除记录</button></td></tr>`;}).join('')||'';
  openModal('我的实验记录',`<p class="modal-copy">对照前后读数，检查是否只改变一个条件。恢复搭建会替换工作台，可撤销。</p>${nav?`<div class="notebook-tabs">${nav}</div>`:'<p class="empty-inspector">还没有记录。在「教师与进阶工具」中显示记录按钮，再到工作台点击「记录读数」，留下第一次发现。</p>'}${s?`<div class="notebook-summary"><p><strong>预测：</strong>${esc(s.prediction||'自由探索')} ${esc(s.reason)}</p><p><strong>解释：</strong>${esc(s.reflection||'尚未填写')}</p><p>${s.completedAt?'探究记录已完成，解释可与老师讨论。':esc(evidence(s.lessonId,s.records).message)}</p></div><div class="record-table-wrap"><table class="record-table"><thead><tr><th>记录</th><th>状态</th><th>电源 / 总电流</th><th>各元件功率 / 参数</th><th>我的观察</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div><div class="notebook-actions"><button id="export-report">导出实验报告</button>${s.lessonId?'<button id="resume-notebook">继续此任务</button>':''}<button id="delete-session">删除这份记录</button></div>`:''}${lastRemoved?'<button id="undo-record-delete">撤销上次删除</button>':''}<p class="modal-copy">短路时总电流为「—」，表示停止计算。报告可以用浏览器打开并打印。记录仅保存在当前浏览器。</p>`);
  $$('[data-notebook-session]').forEach(b=>b.onclick=()=>notebookDialog(b.dataset.notebookSession));
  $$('[data-restore-record]').forEach(b=>b.onclick=()=>{const r=s.records.find(r=>r.id===b.dataset.restoreRecord);closeModal();setScene(s.lessonId?attach(s,r.scene):copy(r.scene));});
  $$('[data-delete-record]').forEach(b=>b.onclick=()=>{lastRemoved=copy(notebook);s.records=s.records.filter(r=>r.id!==b.dataset.deleteRecord);persistSession(s);refreshProgress();notebookDialog(s.id);});
  if($('#export-report'))$('#export-report').onclick=()=>{download(reportHTML(s),'text/html;charset=utf-8','STEAMX-实验报告.html');toast('实验报告已导出，可用浏览器打开并打印');};
  if($('#resume-notebook'))$('#resume-notebook').onclick=()=>resumeSession(s);
  if($('#delete-session'))$('#delete-session').onclick=()=>{lastRemoved=copy(notebook);notebook.sessions=notebook.sessions.filter(x=>x.id!==s.id);if(notebook.lastId===s.id)notebook.lastId=null;save();key=null;update();notebookDialog();};
  if($('#undo-record-delete'))$('#undo-record-delete').onclick=()=>{notebook=lastRemoved;lastRemoved=null;save();key=null;update();notebookDialog(recordView);};
 }
 function renderCounts(){
  if($('#notebook-count'))$('#notebook-count').textContent=String(notebook.sessions.reduce((n,s)=>n+s.records.length,0));
  if($('#learning-completed'))$('#learning-completed').textContent=`${new Set(notebook.sessions.filter(s=>s.completedAt).map(s=>s.lessonId)).size} / ${LESSONS.length} 已完成`;
 }
 function update(){
  const scene=getScene(),circuit=scene.mode==='circuit';$('#learning-panel').hidden=!circuit;$('#record-reading').hidden=!circuit||!(recordTools||(active()&&sheetOpen));
  const s=active();if(circuit){if(key!==(s?.id||'free'))renderPanel();refreshProgress();if(s){const working=JSON.stringify(scene);if(JSON.stringify(s.workingScene)!==working||notebook.lastId!==s.id){s.workingScene=copy(scene);notebook.lastId=s.id;save();}}}
  if(circuit&&!s&&notebook.lastId){notebook.lastId=null;save();}
  renderActivity();$('#lesson-body').hidden=!circuit||!s||!sheetOpen;$('#learning-storage').hidden=!circuit||(!storageError&&!(s&&sheetOpen));
  // During a guided activity, keep a single next action visible.
  const guided=!!starter();$('.mini-card').hidden=guided;$('#wiring-practice').hidden=guided;$('#next-step').closest('.inspector-section').hidden=guided;$('#stage-hint').hidden=guided;
  renderCounts();
  $('#learning-storage').textContent=storageError?'浏览器存储不可用或已满；内容暂存内存，请导出报告，刷新后可能丢失。':'学习记录保存在当前浏览器，可导出报告；不会自动同步到其他设备。';highlight();
 }
 $('#choose-lesson').onclick=()=>catalog();$('#follow-along').onclick=starters;$('#teacher-tools').onclick=teacherTools;$('#record-reading').onclick=recordCurrent;
 return {update,highlight,reload(){try{notebook=restoreNotebook(localStorage.getItem(STORAGE));key=null;update();}catch{toast('无法重新读取学习记录');}},resume(){const s=notebook.sessions.find(s=>s.id===notebook.lastId);if(!s||!s.workingScene)return false;setScene(attach(s,s.workingScene),false);return true;}};
}
