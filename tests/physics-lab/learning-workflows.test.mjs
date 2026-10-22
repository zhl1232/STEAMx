import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-fixture.mjs';
const KEY='steamx-learning-notebook-v1';
test('student task flow, hints, records, reports, level navigation and reload recovery',async t=>{
 const html=await readFile(new URL('../../public/physics-lab/index.html',import.meta.url),'utf8');let env=createDOM(html);
 Object.assign(globalThis,{document:env.document,localStorage:env.localStorage,requestAnimationFrame:env.requestAnimationFrame});await import('../../public/physics-lab/app.js');
 const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),click=async e=>(typeof e==='string'?$(e):e).fire('click');
 const store=()=>JSON.parse(localStorage.getItem(KEY)),session=()=>store().sessions.find(s=>s.id===store().lastId);
 const type=async(s,value)=>{$(s).value=value;await $(s).fire('input');};
 const record=async(note='')=>{await click('#record-reading');assert.ok($('#confirm-record'));$('#record-note').value=note;await click('#confirm-record');};
 const part=id=>$$('.component').find(e=>e.dataset.id===id);
 let firstId,reportBlob;
 await t.test('catalog has three stages with six tasks each and visible prerequisites',async()=>{
  await click('#teacher-tools');assert.match($('#learning-completed').textContent,/0 \/ 18/);await click('#modal-close');await click('#choose-lesson');assert.equal($$('[data-lesson-level]').length,3);assert.equal($$('[data-start-lesson]').length,6);
  await click($$('[data-lesson-level]').find(b=>b.dataset.lessonLevel==='high'));assert.equal($$('[data-start-lesson]').length,6);assert.match($('#modal-content').textContent,/带内阻电源/);assert.match($('#modal-content').textContent,/建议先学/);await click('#modal-close');
 });
 await t.test('prediction and reason precede records; an incorrect prediction is allowed',async()=>{
  await click('#choose-lesson');await click($$('[data-start-lesson]').find(b=>b.dataset.startLesson==='light'));firstId=session().id;await click('#record-reading');assert.match($('#lesson-feedback').textContent,/先选一个预测/);assert.equal(session().records.length,0);
  await click($$('[data-prediction]')[0]);await type('#prediction-reason','我猜只要电池有电就会亮');await record('一条线，灯没有亮');assert.equal(session().records.length,1);assert.equal($('#prediction-reason').getAttribute('disabled'),'');
  const prediction=session().prediction;await click($$('[data-prediction]')[1]);assert.equal(session().prediction,prediction);
 });
 await t.test('three hints progressively highlight endpoints and show a reference without editing the circuit',async()=>{
  const scene=session().workingScene;await click('#next-hint');assert.equal($$('.teaching-ring').length,0);await click('#next-hint');assert.equal($$('.teaching-ring').length,2);await click('#next-hint');assert.equal($('#modal').open,true);assert.equal($$('.reference-circuit').length,1);assert.deepEqual(session().workingScene,scene);await click('#modal-close');
 });
 await t.test('before/after evidence and explanation complete the task, without grading prediction correctness',async()=>{
  await click('#auto-btn');await record('接成完整回路后灯亮，电流为 90 mA');assert.match($('#lesson-evidence').textContent,/可比较/);await click('#complete-lesson');assert.match($('#lesson-feedback').textContent,/写下你的解释/);
  await type('#lesson-reflection','第1次电流为0，第2次是90 mA。灯泡需要闭合回路，我修改了最初的想法。');await click('#complete-lesson');assert.ok(session().completedAt);await click('#teacher-tools');assert.match($('#learning-completed').textContent,/1 \/ 18/);await click('#modal-close');assert.equal(session().prediction,'会亮');
 });
 await t.test('report download includes records and escaped student text; record deletion and undo update completion',async()=>{
  await click('#teacher-tools');await click('#notebook-btn');assert.equal($$('[data-restore-record]').length,2);assert.match($('#modal-content').textContent,/第1次/);
  const realCreate=URL.createObjectURL;URL.createObjectURL=b=>{reportBlob=b;return 'blob:report-test';};await click('#export-report');URL.createObjectURL=realCreate;const report=await reportBlob.text();assert.match(report,/90/);assert.match(report,/我修改了最初/);
  await click($$('[data-delete-record]')[0]);assert.equal(store().sessions.find(s=>s.id===firstId).completedAt,null);await click('#undo-record-delete');assert.ok(store().sessions.find(s=>s.id===firstId).completedAt);await click('#modal-close');
 });
 await t.test('middle level starts a real resistor experiment with component readings and three-point evidence',async()=>{
  await click('#choose-lesson');await click($$('[data-lesson-level]').find(b=>b.dataset.lessonLevel==='middle'));await click($$('[data-start-lesson]').find(b=>b.dataset.startLesson==='ohm_u'));assert.match($('#lesson-body').textContent,/初中/);
  await click($$('[data-prediction]')[0]);await type('#prediction-reason','因为电阻不变，I=U/R');
  for(const v of [3,6,9]){await part('c1').fire('pointerdown',{clientX:240,clientY:220});await $('#stage').fire('pointerup',{clientX:240,clientY:220});await type('#parameter',String(v));await record();}
  assert.match($('#lesson-evidence').textContent,/可比较/);await part('c2').fire('pointerdown',{clientX:700,clientY:220});await $('#stage').fire('pointerup',{clientX:700,clientY:220});assert.match($('#component-reading').textContent,/9.000 V/);assert.match($('#component-reading').textContent,/90.00 mA/);
 });
 await t.test('latest task, prediction, circuit and readings survive reload',async()=>{
  const previous=session(),storage=localStorage;env=createDOM(html);Object.assign(globalThis,{document:env.document,localStorage:storage,requestAnimationFrame:env.requestAnimationFrame});await import('../../public/physics-lab/app.js?learning-reload');
  assert.equal($('#lesson-body').hidden,true);assert.equal($('#record-reading').hidden,true);await click('#toggle-worksheet');assert.equal($('#lesson-body').hidden,false);assert.equal(session().id,previous.id);assert.match($('#lesson-body').textContent,/电压与电流/);assert.equal($('#prediction-reason').value,'因为电阻不变，I=U/R');assert.equal(session().records.length,3);assert.match($('#experiment-name').textContent,/电压与电流/);
 });
 await t.test('precise parameter inputs update measurements and reject zero or off-step resistance',async()=>{
  await part('c2').fire('pointerdown',{clientX:700,clientY:220});await $('#stage').fire('pointerup',{clientX:700,clientY:220});await type('#parameter-number','200');assert.equal($('#parameter').value,'200');assert.match($('#component-reading').textContent,/45.00 mA/);
  await type('#parameter-number','0');assert.equal($('#parameter').value,'200');assert.equal($('#parameter-number').getAttribute('aria-invalid'),'true');await type('#parameter-number','200.5');assert.equal($('#parameter').value,'200');await type('#parameter-number','100');assert.match($('#component-reading').textContent,/90.00 mA/);
 });
 await t.test('storage failure is visible and recording remains available in memory for export',async()=>{
  const realSet=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota');};await type('#lesson-reflection','三组数据的 U/I 都是100 Ω');assert.match($('#learning-storage').textContent,/暂存内存/);await record('暂存记录');await click('#teacher-tools');await click('#notebook-btn');assert.equal($$('[data-restore-record]').length,4);assert.ok($('#export-report'));await click('#modal-close');localStorage.setItem=realSet;
 });
 await t.test('leaving a task preserves records and free building remains available',async()=>{
  await click('#leave-lesson');assert.equal($('#lesson-body').hidden,true);assert.equal($('#activity-body').hidden,true);assert.ok($('#follow-along'));assert.equal(store().lastId,null);assert.equal($$('.component').length,2);await click($$('[data-mode]').find(b=>b.dataset.mode==='optics'));assert.equal($('#learning-panel').hidden,true);assert.equal($('#record-reading').hidden,true);
 });
});
