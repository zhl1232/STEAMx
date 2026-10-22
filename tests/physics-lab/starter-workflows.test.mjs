import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-fixture.mjs';

test('simple entry, three hands-on starters and optional teaching tools',async t=>{
 const env=createDOM(await readFile(new URL('../../public/physics-lab/index.html',import.meta.url),'utf8'));
 Object.assign(globalThis,{document:env.document,localStorage:env.localStorage,requestAnimationFrame:env.requestAnimationFrame});
 await import('../../public/physics-lab/app.js');
 const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),click=async e=>(typeof e==='string'?$(e):e).fire('click');
 const component=id=>$$('.component').find(e=>e.dataset.id===id),port=(id,n)=>$$('.port').find(e=>e.dataset.id===id&&+e.dataset.port===n);
 const tap=async(el,x,y)=>{await el.fire('pointerdown',{clientX:x,clientY:y});await $('#stage').fire('pointerup',{clientX:x,clientY:y});};
 const type=async v=>{$('#parameter').value=String(v);await $('#parameter').fire('input');};
 const begin=async id=>{await click('#follow-along');await click($$('[data-start-guide]').find(b=>b.dataset.startGuide===id));};
 await t.test('new visitors see a working bulb and no worksheet or progress counter',()=>{
  assert.equal($$('.bulb-glow').length,1);assert.equal($('#lesson-body').hidden,true);assert.equal($('#activity-body').hidden,true);assert.equal($('#record-reading').hidden,true);assert.equal($('#learning-completed'),null);assert.equal($('#prediction-reason'),null);
 });
 await t.test('follow-along offers exactly three activities without changing the workbench',async()=>{
  const before=$('#components-layer').innerHTML;await click('#follow-along');assert.equal($$('[data-start-guide]').length,3);assert.equal($('#components-layer').innerHTML,before);await click('#modal-close');
 });
 await t.test('a manually drawn return wire lights the bulb and advances the guide without written work',async()=>{
  await begin('light');assert.equal($$('.bulb-glow').length,0);assert.match($('#guide-instruction').textContent,/空着的端点/);assert.equal($('#guide-next'),null);assert.equal($('#prediction-reason'),null);
  await click('#connect-tool');await tap(port('c2',1),764,220);await tap(port('c1',0),176,220);assert.equal($$('.bulb-glow').length,1);assert.match($('#guide-instruction').textContent,/灯亮了/);assert.ok($('#guide-next'));
  await click('#undo-btn');assert.match($('#guide-instruction').textContent,/空着的端点/);assert.equal($('#guide-next'),null);
  await tap(port('c2',1),764,220);await tap(port('c1',0),176,220);await click('#guide-next');assert.match($('#guide-instruction').textContent,/断开开关/);
 });
 await t.test('switch activity reacts to the actual switch and leaves all controls available',async()=>{
  await tap(component('c3').querySelector('.component-hit'),600,200);assert.equal($$('.bulb-glow').length,0);assert.match($('#guide-instruction').textContent,/灯熄灭了/);await click('#guide-next');assert.match($('#guide-instruction').textContent,/调高电压/);
 });
 await t.test('brightness activity requires higher voltage with the same bulb and wiring',async()=>{
  await tap(component('c1'),240,220);await type(2);assert.match($('#guide-instruction').textContent,/调高电压/);await type(6);assert.match($('#guide-instruction').textContent,/灯变亮了/);
  await click('#restart-guide');assert.match($('#guide-instruction').textContent,/调高电压/);await tap(component('c2'),700,220);await type(50);assert.doesNotMatch($('#guide-instruction').textContent,/灯变亮了/);
 });
 await t.test('free-building and mode changes remove guide clutter; starting an example clears its guide',async()=>{
  await click('#leave-activity');assert.equal($('#activity-body').hidden,true);assert.equal($('.mini-card').hidden,false);assert.equal($('#wiring-practice').hidden,false);
  await begin('light');await click($$('[data-mode]').find(b=>b.dataset.mode==='optics'));assert.equal($('#learning-panel').hidden,true);await click($$('[data-mode]').find(b=>b.dataset.mode==='circuit'));assert.match($('#guide-instruction').textContent,/空着的端点/);
  await click('#leave-activity');await click('#sample-btn');await click($$('[data-sample]').find(b=>b.dataset.sample==='series'));assert.equal($('#activity-body').hidden,true);
 });
 await t.test('recording is optional, available through teaching tools, and preserved when returning to simple activities',async()=>{
  await click('#teacher-tools');assert.match($('#learning-completed').textContent,/0 \/ 18/);await click('#toggle-record-tools');assert.equal($('#record-reading').hidden,false);
  await click('#record-reading');await click('#confirm-record');await click('#teacher-tools');assert.equal($('#notebook-count').textContent,'1');await click('#notebook-btn');assert.equal($$('[data-restore-record]').length,1);assert.ok($('#export-report'));await click('#modal-close');
  await click('#teacher-tools');await click('#toggle-record-tools');assert.equal($('#record-reading').hidden,true);await begin('light');await click('#teacher-tools');assert.equal($('#notebook-count').textContent,'1');assert.match($('#learning-completed').textContent,/0 \/ 18/);
 });
});
