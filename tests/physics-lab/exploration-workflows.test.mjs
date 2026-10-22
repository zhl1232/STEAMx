import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-fixture.mjs';
import {EXPLORATIONS} from '../../public/physics-lab/exploration-model.mjs';

test('topic selection, controls, records, playback and return to wiring work together',async t=>{
 const env=createDOM(await readFile(new URL('../../public/physics-lab/index.html',import.meta.url),'utf8'));
 const frames=[];Object.assign(globalThis,{document:env.document,localStorage:env.localStorage,requestAnimationFrame:f=>frames.push(f)});
 await import('../../public/physics-lab/app.js');
 const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),click=async e=>(typeof e==='string'?$(e):e).fire('click');
 const begin=async id=>{await click('#topics-btn');await click($$('[data-topic]').find(b=>b.dataset.topic===EXPLORATIONS.find(e=>e.id===id).topic));await click($$('[data-exploration]').find(b=>b.dataset.exploration===id));};
 const input=async(id,v)=>{$(id).value=String(v);await $(id).fire('input');};
 await t.test('every topic opens an interactive experiment with scoped instructions',async()=>{
  await click('#topics-btn');assert.equal($$('[data-topic]').length,7);
  for(const e of EXPLORATIONS.filter(e=>!e.workbench)){await begin(e.id);assert.equal($('#topic-workbench').hidden,false);assert.ok($('#topic-diagram').innerHTML.length>100);assert.equal($$('[data-topic-control]').length,e.controls.length);assert.match($('#topic-guide-text').textContent,new RegExp(e.guides[0].slice(0,4)));}
 });
 await t.test('numeric inputs reject invalid data and guide levels do not change parameters',async()=>{
  await begin('sound');await input('#topic-frequency-number',600);assert.equal($('#topic-frequency').value,'600');assert.match($('#topic-metrics').textContent,/600.00/);
  await input('#topic-frequency-number',0);assert.equal($('#topic-frequency-number').getAttribute('aria-invalid'),'true');assert.equal($('#topic-frequency').value,'600');
  $('#topic-level').value='2';await $('#topic-level').fire('change');assert.match($('#topic-guide-text').textContent,/v=fλ/);assert.equal($('#topic-frequency').value,'600');
 });
 await t.test('saved observations restore parameters and time, escape notes and support undo',async()=>{
  await input('#topic-time',.05);await click('#topic-record');$('#topic-note').value='<img src=x onerror=bad()>频率翻倍';await click('#save-topic-note');
  await input('#topic-frequency',300);await click('#topic-records');assert.equal($$('img').length,0);assert.equal($$('[data-restore-topic]').length,1);
  await click($$('[data-restore-topic]')[0]);assert.equal($('#topic-frequency').value,'600');assert.equal($('#topic-time').value,'0.05');
  await click('#topic-records');await click($$('[data-delete-topic]')[0]);assert.equal($$('[data-restore-topic]').length,0);await click('#undo-topic-delete');assert.equal($$('[data-restore-topic]').length,1);await click('#modal-close');
 });
 await t.test('rapid pause/resume queues only one experiment animation and hidden tabs stop playback',async()=>{
  await begin('energy');frames.length=0;await click('#topic-play');await click('#topic-play');await click('#topic-play');assert.equal(frames.length,1);
  frames.shift()(100);frames.shift()(140);assert.ok(Number($('#topic-time').value)>0);
  document.visibilityState='hidden';await document.fire('visibilitychange');const saved=$('#topic-time').value;frames.shift()(180);assert.equal($('#topic-time').value,saved);assert.equal($('#topic-play').textContent,'播放过程');document.visibilityState='visible';
 });
 await t.test('probe drag updates its keyboard-accessible coordinate controls',async()=>{
  await begin('field');const diagram=$('#topic-diagram');await $('[data-probe]').fire('pointerdown',{clientX:500,clientY:300});await diagram.fire('pointermove',{clientX:606.25,clientY:300});await diagram.fire('pointerup');assert.equal($('#topic-x').value,'1');assert.equal($('#topic-y').value,'0');assert.equal(diagram.hasPointerCapture(1),false);
 });
 await t.test('returning to the original workbench preserves existing wiring and exposes migration',async()=>{
  const wires=$('#wires-layer').innerHTML;await click('#back-workbench');assert.equal($('#topic-workbench').hidden,true);assert.equal($('body').classList.contains('topic-active'),false);assert.equal($('#wires-layer').innerHTML,wires);
  await click('#transfer-btn');assert.ok($('#export-lab-backup'));assert.ok($('#import-lab-backup'));
 });
});
