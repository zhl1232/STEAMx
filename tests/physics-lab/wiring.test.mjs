import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-fixture.mjs';
import {validateScene,solveCircuit} from '../../public/physics-lab/physics.mjs';

test('manual wire drawing: routes, snapping, editing, cancellation, circuit feedback and persistence',async t=>{
 const env=createDOM(await readFile(new URL('../../public/physics-lab/index.html',import.meta.url),'utf8'));
 Object.assign(globalThis,{document:env.document,localStorage:env.localStorage,requestAnimationFrame:env.requestAnimationFrame});await import('../../public/physics-lab/app.js');
 const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),stage=$('#stage');
 const click=async el=>(typeof el==='string'?$(el):el).fire('click');
 const port=(id,p)=>$$('.port').find(el=>el.dataset.id===id&&Number(el.dataset.port)===p);
 const wire=id=>$$('[data-wire]').find(el=>el.dataset.wire===id);
 const wirePath=id=>wire(id)?.querySelector('.wire-path').getAttribute('d');
 const component=id=>$$('.component').find(el=>el.dataset.id===id);
 const down=async(el,x,y)=>el.fire('pointerdown',{clientX:x,clientY:y});
 const up=async(x,y)=>stage.fire('pointerup',{clientX:x,clientY:y});
 const tap=async(el,x,y)=>{await down(el,x,y);await up(x,y);};
 const move=async(x,y)=>stage.fire('pointermove',{clientX:x,clientY:y});
 const savedScene=()=>JSON.parse(localStorage.getItem('steamx-physics-experiments-v1'))[0].scene;
 await t.test('visible drawing entry and practice scene start without wires',async()=>{
  assert.equal($('#connect-tool-label').textContent,'画电线');await click('#wiring-practice');assert.equal($$('[data-wire]').length,0);assert.equal($$('.component').length,2);assert.equal($('#connect-tool').getAttribute('aria-pressed'),'true');
 });
 await t.test('clicking a start previews on hover without holding the mouse; blank clicks create bends',async()=>{
  await tap(port('c1',1),304,260);await move(450,160);assert.match($('#overlay-layer').innerHTML,/M304,260L450,160/);assert.equal($('#wire-draft-actions').hidden,false);
  await tap(stage,450,160);await tap(stage,600,160);assert.equal($$('[data-wire]').length,0);assert.match($('#wire-instruction').textContent,/2 个拐点/);
  await move(628,263);assert.equal($$('.snap-target').length,1);await tap(port('c2',0),636,260);assert.equal(wirePath('w1'),'M304,260L450,160L600,160L636,260');assert.equal($('#wire-draft-actions').hidden,true);assert.equal($$('.bulb-glow').length,0);
 });
 await t.test('dragging between terminals completes a wire on pointerup and lights the bulb',async()=>{
  await down(port('c2',1),764,260);await move(176,260);await up(176,260);assert.equal(wirePath('w2'),'M764,260L176,260');assert.equal($$('.bulb-glow').length,1);assert.match($('#metrics').textContent,/90.0/);
 });
 await t.test('moving a component preserves chosen bends and updates attached endpoints',async()=>{
  await click('#select-tool');await down(component('c1'),240,260);await move(260,300);await up(260,300);assert.equal(wirePath('w1'),'M324,300L450,160L600,160L636,260');await click('#undo-btn');assert.equal(wirePath('w1'),'M304,260L450,160L600,160L636,260');
 });
 await t.test('existing bends can be dragged, undone and automatically routed without disconnecting',async()=>{
  await down(wire('w1'),450,160);assert.equal($$('.wire-handle').length,2);await down($$('.wire-handle')[0],450,160);await move(410,140);await up(410,140);assert.equal(wirePath('w1'),'M304,260L410,140L600,160L636,260');await click('#undo-btn');assert.match(wirePath('w1'),/450,160/);
  await down(wire('w1'),450,160);await click('#auto-route');assert.equal(wirePath('w1'),'M304,260H636');assert.equal($$('.bulb-glow').length,1);await click('#undo-btn');assert.match(wirePath('w1'),/450,160/);
 });
 await t.test('drawn paths survive JSON round trip, save/load and maintain correct electrical results',async()=>{
  await click('#save-btn');$('#save-name').value='手画线路';await click('#confirm-save');const scene=validateScene(JSON.parse(JSON.stringify(savedScene())));assert.deepEqual(scene.wires[0].points,[{x:450,y:160},{x:600,y:160}]);assert.ok(Math.abs(solveCircuit(scene.components,scene.wires).current-.09)<1e-8);
  await click('#wiring-practice');await click('#load-btn');await click($$('[data-save-id]')[0]);assert.equal(wirePath('w1'),'M304,260L450,160L600,160L636,260');assert.equal($$('.bulb-glow').length,1);
 });
 await t.test('Backspace retracts draft bends, Escape or cancel leaves completed wires and save status unchanged',async()=>{
  await tap(port('c1',1),304,260);await tap(stage,450,120);await tap(stage,550,120);await document.fire('keydown',{key:'Backspace'});assert.match($('#wire-instruction').textContent,/1 个拐点/);await click('#remove-bend');assert.match($('#wire-instruction').textContent,/0 个拐点/);await document.fire('keydown',{key:'Escape'});assert.equal($$('.wire-draft').length,0);assert.equal($$('[data-wire]').length,2);assert.equal($('#dirty-indicator').textContent,'已保存');
  await tap(port('c1',1),304,260);await click('#cancel-wire');assert.equal($$('.wire-draft').length,0);assert.equal($$('[data-wire]').length,2);
 });
 await t.test('duplicate connections are rejected without losing the draft',async()=>{
  await tap(port('c1',1),304,260);await tap(port('c2',0),636,260);assert.equal($$('[data-wire]').length,2);assert.match($('#toast').textContent,/已经连接/);assert.equal($('#wire-draft-actions').hidden,false);await click('#cancel-wire');
 });
 await t.test('release in empty space keeps a draft bend; pointer cancellation and mode switching clear it',async()=>{
  await down(port('c1',1),304,260);await move(430,130);await up(430,130);assert.match($('#wire-instruction').textContent,/1 个拐点/);assert.equal($$('[data-wire]').length,2);await stage.fire('pointercancel');assert.equal($$('.wire-draft').length,0);
  await tap(port('c1',1),304,260);await click($$('[data-mode]').find(b=>b.dataset.mode==='optics'));assert.equal($('#wire-guide').hidden,true);await click($$('[data-mode]').find(b=>b.dataset.mode==='circuit'));assert.equal($$('.wire-draft').length,0);assert.equal($$('[data-wire]').length,2);
 });
 await t.test('touch-style captured events use scaled SVG coordinates and snap near endpoints',async()=>{
  await click('#wiring-practice');stage.getBoundingClientRect=()=>({left:100,top:50,width:500,height:300});
  await down(port('c1',1),252,180);await move(416,182);await up(416,182);assert.equal(wirePath('w1'),'M304,260L636,260');stage.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});
 });
 await t.test('deleting a manually drawn wire opens the circuit and undo restores it',async()=>{
  await click('#load-btn');await click($$('[data-save-id]')[0]);await down(wire('w1'),450,160);await document.fire('keydown',{key:'Delete'});assert.equal($$('.bulb-glow').length,0);await click('#undo-btn');assert.equal($$('.bulb-glow').length,1);assert.match(wirePath('w1'),/450,160/);
 });
});

test('import rejects invalid, unbounded or excessive wire points and accepts older scenes',()=>{
 const base={version:1,mode:'circuit',components:[{id:'c1',type:'battery',x:240,y:260,value:9},{id:'c2',type:'bulb',x:700,y:260,value:100}],wires:[{id:'w1',a:{id:'c1',port:1},b:{id:'c2',port:0}}]};
 validateScene(base);
 for(const points of [null,{},[{x:'bad',y:100}],[null],[{x:1001,y:100}],[{x:100,y:NaN}],Array(41).fill({x:100,y:100})])assert.throws(()=>validateScene({...base,wires:[{...base.wires[0],points}]}),/走线数据/);
 validateScene({...base,wires:[{...base.wires[0],points:[]}]});
});
