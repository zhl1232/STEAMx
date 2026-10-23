import test from 'node:test';
import assert from 'node:assert/strict';
import {G,solveCircuit,springState,atwoodState,traceRays,validateScene} from '../../public/physics-lab/physics.mjs';

const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≈ ${b}`);
const circuit=()=>({version:1,mode:'circuit',components:[{id:'c1',type:'battery',x:265,y:235,value:9},{id:'c2',type:'resistor',x:670,y:235,value:100},{id:'c3',type:'resistor',x:670,y:420,value:100}],wires:[]});
const wire=(id,a,ap,b,bp)=>({id,a:{id:a,port:ap},b:{id:b,port:bp}});
test('two 100 Ω resistors in series: 45 mA and 200 Ω; changing one to 200 Ω updates to 30 mA',()=>{
  const s=circuit();s.wires=[wire('w1','c1',1,'c2',0),wire('w2','c2',1,'c3',0),wire('w3','c3',1,'c1',0)];
  validateScene(s);const r=solveCircuit(s.components,s.wires);close(r.current,.045);close(r.resistance,200);close(r.power,.405);assert.equal(r.active,true);
  s.components[1].value=200;const changed=solveCircuit(s.components,s.wires);close(changed.current,.03);close(changed.resistance,300);
});
test('parallel circuit: independent branches and total source current',()=>{
  const s=circuit();s.components[2].value=200;s.wires=[wire('w1','c1',1,'c2',0),wire('w2','c1',1,'c3',0),wire('w3','c2',1,'c1',0),wire('w4','c3',1,'c1',0)];
  const r=solveCircuit(s.components,s.wires);close(r.current,.135);close(r.resistance,200/3);close(Math.abs(r.branchCurrents.c2),.09);close(Math.abs(r.branchCurrents.c3),.045);
});
test('open circuits, disconnected islands, dangling branches, shorts and multiple sources',()=>{
  const s=circuit();assert.equal(solveCircuit(s.components,s.wires).active,false);
  s.wires=[wire('w1','c1',1,'c2',0)];assert.equal(solveCircuit(s.components,s.wires).current,0);
  s.wires.push(wire('w2','c2',1,'c1',0));close(solveCircuit(s.components,s.wires).current,.09);
  s.wires.push(wire('w3','c2',1,'c3',0));close(solveCircuit(s.components,s.wires).current,.09);
  s.wires.push(wire('w4','c1',1,'c1',0));assert.equal(solveCircuit(s.components,s.wires).short,true);
  s.components.push({id:'c4',type:'battery',x:200,y:400,value:6});assert.match(solveCircuit(s.components,s.wires).status,/一个电源/);
});
test('series-parallel network solves Kirchhoff laws beyond the supplied examples',()=>{
  const s=circuit();s.components.push({id:'c4',type:'resistor',x:400,y:450,value:100});
  s.wires=[wire('w1','c1',1,'c2',0),wire('w2','c2',1,'c3',0),wire('w3','c2',1,'c4',0),wire('w4','c3',1,'c1',0),wire('w5','c4',1,'c1',0)];
  const r=solveCircuit(s.components,s.wires);close(r.resistance,150);close(r.current,.06);close(Math.abs(r.branchCurrents.c3),.03);
});
test('parallel rays converge at the convex lens focal point and diverge through a concave lens',()=>{
  const s=[{id:'c1',type:'source',x:150,y:300,angle:0},{id:'c2',type:'lens',x:510,y:300,value:150}],rays=traceRays(s);
  assert.equal(rays.length,3);for(const r of rays){assert.equal(r.path.length,3);const a=r.path[1],b=r.path[2];close(a.y+(660-a.x)*(b.y-a.y)/(b.x-a.x),300);}
  s[1].value=-150;const diverging=traceRays(s);assert.ok(diverging[0].path.at(-1).y<252);assert.ok(diverging[2].path.at(-1).y>348);
});
test('mirror reflections: vertical mirror reverses horizontal rays; 45° sends rays upward',()=>{
  const s=[{id:'c1',type:'source',x:150,y:300,angle:0},{id:'c2',type:'mirror',x:510,y:300,angle:0}];
  const center=traceRays(s)[1];close(center.path[1].x,510);close(center.path.at(-1).x,0);close(center.path.at(-1).y,300);
  s[1].angle=-45;const up=traceRays(s)[1];close(up.path.at(-1).x,510);close(up.path.at(-1).y,50);
});
test('spring starts at rest, obeys Hooke equilibrium and mass-dependent period; damping settles',()=>{
  const zero=springState(2,50,0);close(zero.extension,0);close(zero.velocity,0);close(zero.equilibrium,2*G/50);
  close(springState(2,50,zero.period/2).extension,2*zero.equilibrium);close(springState(2,50,zero.period).extension,0);
  close(springState(4,50,0).period/zero.period,Math.sqrt(2));close(springState(2,50,30,.4).extension,zero.equilibrium,1e-6);
});
test('Atwood acceleration, tension and equilibrium',()=>{
  const a=atwoodState(1,2,1);close(a.acceleration,G/3);close(a.tension,4*G/3);close(a.travel,G/6);close(a.velocity,G/3);
  const equal=atwoodState(2,2,2);close(equal.acceleration,0);close(equal.travel,0);close(equal.tension,2*G);
  close(atwoodState(2,1,1).acceleration,-G/3);
});
test('saved scenes round-trip while imports reject invalid IDs, parameters and connections',()=>{
  const s=circuit();s.name='我的串联实验';s.wires=[wire('w1','c1',1,'c2',0)];assert.deepEqual(validateScene(JSON.parse(JSON.stringify(s))),s);
  const invalid=structuredClone(s);invalid.components[0].value=-9;assert.throws(()=>validateScene(invalid));
  const rogue=structuredClone(s);rogue.wires[0].b.id='missing';assert.throws(()=>validateScene(rogue));
  const duplicate=structuredClone(s);duplicate.components[1].id='c1';assert.throws(()=>validateScene(duplicate));
  const mechanics={version:1,mode:'mechanics',components:[{id:'c1',type:'spring',x:500,y:145,value:50,damping:.15},{id:'c2',type:'mass',x:500,y:335,value:2}],wires:[wire('w1','c1',0,'c2',0)]};assert.deepEqual(validateScene(mechanics),mechanics);mechanics.wires.push(wire('w2','c1',0,'c2',0));assert.throws(()=>validateScene(mechanics));
});
