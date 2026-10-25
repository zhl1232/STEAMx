import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDOM,chooseWorkbench} from './dom-fixture.mjs';

test('component selection and direct switch operation distinguish taps, drags, wiring and keyboard input',async t=>{
 const env=createDOM(await readFile(new URL('../../public/physics-lab/index.html',import.meta.url),'utf8'));
 Object.assign(globalThis,{document:env.document,localStorage:env.localStorage,requestAnimationFrame:env.requestAnimationFrame});await import('../../public/physics-lab/app.js');
 const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),stage=$('#stage');
 const component=id=>$$('.component').find(e=>e.dataset.id===id),hit=id=>component(id).querySelector('.component-hit');
 const port=(id,n)=>$$('.port').find(e=>e.dataset.id===id&&+e.dataset.port===n);
 const click=async e=>(typeof e==='string'?$(e):e).fire('click');
 const down=async(el,x,y,extra={})=>el.fire('pointerdown',{clientX:x,clientY:y,...extra});
 const up=async(x,y,extra={})=>stage.fire('pointerup',{clientX:x,clientY:y,...extra});
 const move=async(x,y,extra={})=>stage.fire('pointermove',{clientX:x,clientY:y,...extra});
 const tap=async(el,x,y)=>{await down(el,x,y);await up(x,y);};
 const lit=()=>assert.equal($$('.bulb-glow').length,1),dark=()=>assert.equal($$('.bulb-glow').length,0);
 const sample=async()=>{await click('#sample-btn');await click($$('[data-sample]').find(e=>e.dataset.sample==='lamp'));};
 await t.test('clicking the padding around a component selects it without changing its value',async()=>{
  await tap(hit('c1'),230,160);assert.match($('#inspector').textContent,/电池/);assert.equal($('#parameter').value,'9');lit();
 });
 await t.test('one tap in the switch background toggles it, updates the inspector and is undoable',async()=>{
  await tap(hit('c2'),530,180);dark();assert.equal(component('c2').getAttribute('aria-pressed'),'false');assert.equal($('#toggle-switch').textContent,'闭合开关');assert.match(component('c2').textContent,/点击闭合/);
  await click('#undo-btn');lit();await tap(hit('c2'),530,180);dark();await tap(hit('c2'),530,180);lit();
 });
 await t.test('dragging changes position only, even when the pointer returns to its starting point',async()=>{
  await down(hit('c2'),530,180);await move(565,210);await up(565,210);assert.equal(component('c2').getAttribute('transform'),'translate(565,230)');lit();await click('#undo-btn');assert.equal(component('c2').getAttribute('transform'),'translate(530,200)');lit();
  await down(hit('c2'),530,180);await move(560,180);await move(530,180);await up(530,180);lit();
 });
 await t.test('small touch jitter is a tap at a scaled canvas size; cancelled or unrelated pointers never toggle',async()=>{
  stage.getBoundingClientRect=()=>({left:100,top:50,width:500,height:300});
  await down(hit('c2'),365,140,{pointerId:8,pointerType:'touch'});await move(368,142,{pointerId:8,pointerType:'touch'});await up(368,142,{pointerId:8,pointerType:'touch'});dark();assert.equal(component('c2').getAttribute('transform'),'translate(530,200)');
  await down(hit('c2'),365,140,{pointerId:8});await up(365,140,{pointerId:9});dark();await stage.fire('pointercancel',{pointerId:8});dark();await up(365,140,{pointerId:8});dark();
  stage.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});
  await sample();await down(hit('c2'),530,180);await move(560,210);await stage.fire('pointercancel');assert.equal(component('c2').getAttribute('transform'),'translate(530,200)');lit();
 });
 await t.test('wire tool and terminal gestures preserve switch state',async()=>{
  await click('#connect-tool');await tap(hit('c2'),530,180);lit();assert.equal(component('c2').getAttribute('aria-pressed'),'true');
  await tap(port('c2',0),466,200);assert.equal($('#wire-draft-actions').hidden,false);await tap(hit('c2'),530,180);lit();await click('#cancel-wire');
  await click('#select-tool');await tap(port('c2',1),594,200);lit();assert.equal($('#wire-draft-actions').hidden,false);await click('#cancel-wire');
 });
 await t.test('Space or Enter toggles a focused switch once; repeating a held key does not',async()=>{
  await component('c2').fire('keydown',{key:' '});dark();await component('c2').fire('keydown',{key:' ',repeat:true});dark();await component('c2').fire('keydown',{key:'Enter'});lit();
  await click('#connect-tool');await component('c2').fire('keydown',{key:'Enter'});lit();await click('#select-tool');
  await click('#toggle-switch');dark();await click('#undo-btn');lit();
 });
 await t.test('other thin components can also be selected through their full hit area',async()=>{
  await chooseWorkbench(document,'optics');await click('#sample-btn');await click($$('[data-sample]').find(b=>b.dataset.sample==='reflection'));
  await tap(hit('c2'),550,300);assert.ok($('#angle'));assert.match($('#inspector').textContent,/镜子/);
 });
});
