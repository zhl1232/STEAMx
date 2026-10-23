import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {solveCircuit,bulbState,validateScene} from '../../public/physics-lab/physics.mjs';
import {createDOM} from './dom-fixture.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
test('bulb power, voltage scaling, switch opening, short protection and import validation',()=>{
 const components=[{id:'c1',type:'battery',value:9,x:200,y:200},{id:'c2',type:'bulb',value:100,x:500,y:200},{id:'c3',type:'switch',closed:true,x:500,y:400}];
 const wire=(id,a,ap,b,bp)=>({id,a:{id:a,port:ap},b:{id:b,port:bp}});
 const wires=[wire('w1','c1',1,'c2',0),wire('w2','c2',1,'c3',0),wire('w3','c3',1,'c1',0)];
 const solve=()=>solveCircuit(components,wires),lamp=()=>bulbState(components[1],solve());
 near(lamp().power,.81);near(lamp().brightness,1);components[0].value=4.5;near(lamp().power,.2025);near(lamp().brightness,.25);
 components[2].closed=false;near(lamp().power,0);components[2].closed=true;
 wires.push(wire('w4','c1',0,'c1',1));assert.equal(solve().short,true);near(lamp().power,0);wires.pop();
 const scene={version:1,mode:'circuit',components,wires};validateScene(JSON.parse(JSON.stringify(scene)));components[1].value=0;assert.throws(()=>validateScene(scene));components[1].value=100;components[2].closed='yes';assert.throws(()=>validateScene(scene));
});
test('lamp samples, switch, undo, parallel comparison and save/load operate through UI events',async()=>{
 const env=createDOM(await readFile(new URL('../../public/physics-lab/index.html',import.meta.url),'utf8'));Object.assign(globalThis,{document:env.document,localStorage:env.localStorage,requestAnimationFrame:env.requestAnimationFrame});await import('../../public/physics-lab/app.js');
 const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),click=async el=>(typeof el==='string'?$(el):el).fire('click');
 const sample=async kind=>{await click('#sample-btn');await click($$('[data-sample]').find(b=>b.dataset.sample===kind));};
 await sample('lamp');assert.equal($$('.bulb-glow').length,1);assert.match($('#metrics').textContent,/0.810/);
 await click('#toggle-switch');assert.equal($$('.bulb-glow').length,0);assert.match($('#metrics').textContent,/0.000/);await click('#undo-btn');assert.equal($$('.bulb-glow').length,1);
 await sample('lamp-series');assert.match($('#metrics').textContent,/0.2025/);await sample('lamp-parallel');assert.equal($$('.bulb-glow').length,2);assert.match($('#metrics').textContent,/0.810/);
 await click('#toggle-switch');await click('#save-btn');$('#save-name').value='双灯断开';await click('#confirm-save');await sample('lamp');await click('#load-btn');await click($$('[data-save-id]')[0]);assert.equal($$('.bulb-glow').length,0);assert.equal($$('.component').length,4);
});
