import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDOM,chooseWorkbench} from './dom-fixture.mjs';

test('DOM-only: desktop input workflows, mode changes, save/load, undo and real-time feedback',async t=>{
  const env=createDOM(await readFile(new URL('../../public/physics-lab/index.html',import.meta.url),'utf8'));
  Object.assign(globalThis,{document:env.document,localStorage:env.localStorage,requestAnimationFrame:env.requestAnimationFrame});
  await import('../../public/physics-lab/app.js');
  const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),stage=$('#stage');
  const click=async s=>{const el=typeof s==='string'?$(s):s;assert.ok(el,`exists: ${s}`);await el.fire('click');};
  const component=id=>$$('.component').find(c=>c.dataset.id===id);
  const port=(id,p)=>$$('.port').find(c=>c.dataset.id===id&&+c.dataset.port===p);
  const metricValues=()=>$$('.metric-value').map(x=>x.textContent.trim());
  const count=()=>$$('.component').length;
  await t.test('series example renders correct electrical feedback',async()=>{await click('#sample-btn');await click($$('[data-sample]').find(b=>b.dataset.sample==='series'));assert.equal(count(),3);assert.ok(metricValues()[1].startsWith('45.0'));assert.match($('#result-status').textContent,/闭合/);});
  await t.test('slider changes update current immediately and undo restores the parameter',async()=>{
    $('#parameter').value='200';await $('#parameter').fire('input');assert.ok(metricValues()[1].startsWith('30.0'));await click('#undo-btn');assert.ok(metricValues()[1].startsWith('45.0'));
  });
  await t.test('dragging a component moves its SVG and connected wires; undo restores position',async()=>{
    const before=$('#wires-layer').innerHTML;await component('c2').fire('pointerdown',{clientX:670,clientY:235});await stage.fire('pointermove',{clientX:700,clientY:270});await stage.fire('pointerup',{clientX:700,clientY:270});assert.equal(component('c2').getAttribute('transform'),'translate(700,270)');assert.notEqual($('#wires-layer').innerHTML,before);await click('#undo-btn');assert.equal(component('c2').getAttribute('transform'),'translate(670,235)');
  });
  await t.test('palette drag/drop inserts a resistor at the drop location',async()=>{
    await stage.fire('drop',{clientX:450,clientY:390,dataTransfer:{getData:()=> 'resistor'}});assert.equal(count(),4);assert.equal(component('c4').getAttribute('transform'),'translate(450,390)');await click('#undo-btn');assert.equal(count(),3);
  });
  await t.test('click-to-connect detects a short circuit and wire deletion repairs it',async()=>{
    await port('c1',1).fire('pointerdown',{clientX:329,clientY:235});await stage.fire('pointerup',{clientX:329,clientY:235});await port('c2',1).fire('pointerdown',{clientX:734,clientY:235});await stage.fire('pointerup',{clientX:734,clientY:235});
    await port('c2',1).fire('pointerdown',{clientX:734,clientY:235});await stage.fire('pointerup',{clientX:734,clientY:235});await port('c1',0).fire('pointerdown',{clientX:201,clientY:235});await stage.fire('pointerup',{clientX:201,clientY:235});assert.match($('#result-status').textContent,/短路/);
    await click('#undo-btn');await click('#undo-btn');assert.match($('#result-status').textContent,/闭合/);
    const w=$$('[data-wire]')[0];await w.fire('pointerdown');await document.fire('keydown',{key:'Delete'});assert.match($('#result-status').textContent,/开路/);await click('#undo-btn');assert.match($('#result-status').textContent,/闭合/);
  });
  await t.test('a saved scene survives replacement and restores components and parameters',async()=>{
    await click('#save-btn');$('#save-name').value='电路测试';await click('#confirm-save');assert.equal($('#dirty-indicator').textContent,'已保存');
    await click('#new-btn');await click($$('[data-new-mode]').find(b=>b.dataset.newMode==='circuit'));assert.equal(count(),0);
    await click('#load-btn');await click($$('[data-save-id]')[0]);assert.equal(count(),3);assert.equal($('#experiment-name').textContent,'电路测试');assert.ok(metricValues()[1].startsWith('45.0'));
  });
  await t.test('optics traces beams, changing lens type changes the result, mirror angle is editable',async()=>{
    await chooseWorkbench(document,'optics');assert.equal(count(),2);assert.equal($$('.ray').length,3);await click('#concave-btn');assert.match($('#observation-title').textContent,/发散/);await click('#sample-btn');await click($$('[data-sample]').find(b=>b.dataset.sample==='reflection'));$('#angle').value='-45';await $('#angle').fire('input');assert.ok($('#effects-layer').innerHTML.includes('50'));assert.ok(metricValues()[1].startsWith('-45'));
  });
  await t.test('mechanics runs, pauses and resets; mass edits recalculate acceleration',async()=>{
    await chooseWorkbench(document,'mechanics');assert.ok(metricValues()[0].startsWith('3.27'));env.tick(1);env.tick(40);env.tick(250);assert.notEqual(component('c3').getAttribute('transform'),'translate(552,345)');
    await click('#run-btn');const paused=component('c3').getAttribute('transform');env.tick(300);env.tick(350);assert.equal(component('c3').getAttribute('transform'),paused);
    $('#parameter').value='1';await $('#parameter').fire('input');assert.ok(metricValues()[0].startsWith('0.00'));assert.match($('#result-status').textContent,/平衡/);await click('#reset-btn');assert.equal(component('c3').getAttribute('transform'),'translate(552,345)');
  });
  await t.test('spring example exposes stiffness and damping, and intelligent connection completes a new scene',async()=>{
    await click('#sample-btn');await click($$('[data-sample]').find(b=>b.dataset.sample==='spring'));assert.ok($('#damping'));assert.ok(metricValues()[1].startsWith('39.2'));
    await click('#new-btn');await click($$('[data-new-mode]').find(b=>b.dataset.newMode==='mechanics'));await click($$('[data-type]').find(b=>b.dataset.type==='spring'));await click($$('[data-type]').find(b=>b.dataset.type==='mass2'));await click('#auto-btn');assert.equal(count(),2);assert.match($('#scene-count').textContent,/1 条连接/);assert.ok(metricValues()[1].startsWith('39.2'));
  });
  await t.test('dragging a terminal completes a connection and moving two terminals together snaps them',async()=>{
    await click('#new-btn');await click($$('[data-new-mode]').find(b=>b.dataset.newMode==='circuit'));
    await click($$('[data-type]').find(b=>b.dataset.type==='battery'));await click($$('[data-type]').find(b=>b.dataset.type==='resistor'));
    await port('c1',1).fire('pointerdown',{clientX:304,clientY:180});await stage.fire('pointermove',{clientX:331,clientY:180});await stage.fire('pointerup',{clientX:331,clientY:180});assert.match($('#scene-count').textContent,/1 条连接/);
    await click('#new-btn');await click($$('[data-new-mode]').find(b=>b.dataset.newMode==='circuit'));await click($$('[data-type]').find(b=>b.dataset.type==='battery'));await click($$('[data-type]').find(b=>b.dataset.type==='resistor'));
    await component('c2').fire('pointerdown',{clientX:395,clientY:180});await stage.fire('pointermove',{clientX:371,clientY:180});await stage.fire('pointerup',{clientX:371,clientY:180});assert.match($('#scene-count').textContent,/1 条连接/);
    await click('#auto-btn');assert.ok(metricValues()[1].startsWith('90.0'));await click('#help-btn');assert.equal($('#modal').open,true);assert.match($('#modal-content').textContent,/快捷键/);await click('#modal-close');
  });
  await t.test('extreme spring values remain finite at the workbench boundary',async()=>{
    await chooseWorkbench(document,'mechanics');await click('#sample-btn');await click($$('[data-sample]').find(b=>b.dataset.sample==='spring'));$('#parameter').value='20';await $('#parameter').fire('input');await component('c2').fire('pointerdown',{clientX:500,clientY:305});await stage.fire('pointerup',{clientX:500,clientY:305});$('#parameter').value='5';await $('#parameter').fire('input');
    if($('#run-label').textContent==='开始模拟')await click('#run-btn');for(let t=1000;t<=2000;t+=40)env.tick(t);assert.match($('#result-status').textContent,/边界/);assert.ok(!$('#metrics').innerHTML.includes('NaN'));assert.ok(metricValues()[0].startsWith('230.0'));
  });
});
