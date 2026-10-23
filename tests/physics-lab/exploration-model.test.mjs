import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPLORATIONS,defaults,validParams,simulate,GRAVITY as g} from '../../public/physics-lab/exploration-model.mjs';
import {experimentView} from '../../public/physics-lab/exploration-visuals.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} ≠ ${b}`);

test('all catalogue controls have valid defaults and render finite boundary states',()=>{
 for(const e of EXPLORATIONS.filter(e=>!e.workbench)){
  assert.ok(validParams(e.id,defaults(e.id)),e.id);
  assert.equal(e.guides.length,3);
  for(const c of e.controls)for(const value of [c.min,c.max])for(const time of [0,1,10,300]){
   const p={...defaults(e.id),[c.key]:value},view=experimentView(e.id,p,time);
   assert.ok(validParams(e.id,p),e.id+' '+c.key);
   assert.ok(view.metrics.length>=2);assert.doesNotMatch(view.svg,/NaN|Infinity|undefined/);
  }
 }
 assert.equal(validParams('sound',{...defaults('sound'),frequency:101}),null);
 assert.equal(validParams('field',{...defaults('field'),x:Infinity}),null);
});
test('sound and travelling waves relate frequency, speed and wavelength',()=>{
 const a=simulate('sound',defaults('sound')),b=simulate('sound',{...defaults('sound'),frequency:600});
 near(a.speed,343.42);near(b.wavelength,a.wavelength/2);
 const p=defaults('wave');near(simulate('wave',p,.25).probe,p.amplitude);near(simulate('wave',p,1.25).probe,p.amplitude);
});
test('heat balance conserves energy and heating stops at the model temperature limit',()=>{
 const p={...defaults('heating'),mass:1,power:420,capacity:4200};near(simulate('heating',p,100).temperature,30);
 const end=simulate('heating',p,10000);near(end.temperature,80);near(end.heat,252000);assert.equal(end.stopped,true);
 const mix={...defaults('mixing'),m1:2,m2:1};for(const t of [0,1,60,300]){const m=simulate('mixing',mix,t);near(m.hot*2+m.cold,160);assert.ok(m.hot>=m.cold);near(m.equilibrium,160/3);}
});
test('electric fields add as vectors while potentials add as scalars',()=>{
 const p={...defaults('field'),x:0,y:0};const dipole=simulate('field',p);near(dipole.potential,0);assert.ok(dipole.ex>0);near(dipole.ey,0);
 const equal=simulate('field',{...p,q2:p.q1});near(equal.strength,0);assert.ok(equal.potential>0);
 assert.equal(simulate('field',{...p,x:1}).valid,false);
 const one=simulate('field',{...p,q2:0,x:0}),far=simulate('field',{...p,q2:0,x:1,y:0});
 // Keep the probe away from the zero-charge location (which still reserves its exclusion zone).
 const farther=simulate('field',{...p,q2:0,x:3});near(farther.strength,one.strength/16);assert.equal(far.valid,false);
});
test('magnets reverse the adjacent-pole interaction and guide the compass',()=>{
 const p={...defaults('magnets'),x:0,y:0};const attract=simulate('magnets',p);assert.equal(attract.attract,true);assert.ok(attract.bx>0);near(attract.by,0);
 const repel=simulate('magnets',{...p,polarity:-1});assert.equal(repel.attract,false);near(repel.strength,0);
});
test('magnetic motion has correct right-hand-rule curvature and constant speed',()=>{
 const p=defaults('magnetic-force');const m=simulate('magnetic-force',p,Math.PI/2);near(m.radius,2);near(m.x,2);near(m.y,-2);near(Math.hypot(m.vx,m.vy),2);near(m.energy,.002);
 const flipped=simulate('magnetic-force',{...p,charge:-1},Math.PI/2);near(flipped.y,2);
 const straight=simulate('magnetic-force',{...p,field:0},2);near(straight.x,4);near(straight.y,0);assert.equal(straight.radius,null);
});
test('induction obeys Faraday and Ohm laws, including reversal and a stationary rod',()=>{
 const p=defaults('induction'),a=simulate('induction',p,1),b=simulate('induction',p,1.001);
 near(a.emf,-(b.flux-a.flux)/.001);near(a.current,a.emf/p.resistance);assert.ok(a.current<0);
 near(simulate('induction',{...p,speed:-p.speed},1).current,-a.current);
 near(simulate('induction',{...p,speed:0},1).current,0);near(simulate('induction',p,10).current,0);
});
test('static friction, lever balance and Archimedes law give expected limiting cases',()=>{
 const force=defaults('force');near(simulate('force',{...force,force:1},10).position,0);
 near(simulate('force',{...force,friction:0},2).position,8);
 assert.ok(simulate('lever',{...defaults('lever'),leftForce:2,leftArm:2}).balanced);
 const p=defaults('buoyancy');near(simulate('buoyancy',p).net,0);near(simulate('buoyancy',{...p,fraction:1}).buoyancy,g);assert.equal(simulate('buoyancy',{...p,mass:2}).canFloat,false);
});
test('falling conserves mechanical energy independently of mass and stops before impact',()=>{
 const p=defaults('energy');for(const t of [0,.3,.8,10]){const m=simulate('energy',p,t);near(m.total,p.mass*g*p.height);near(simulate('energy',{...p,mass:2},t).velocity,m.velocity);}
 const m=simulate('energy',p,10);near(m.height,0);near(m.velocity,Math.sqrt(2*g*p.height));assert.ok(m.stopped);
});
test('collisions conserve momentum, lose energy only when inelastic, and require approach',()=>{
 for(const m1 of [.5,2,4])for(const m2 of [.5,2,4])for(const restitution of [0,.5,1]){
  const p={...defaults('collision'),m1,m2,restitution},m=simulate('collision',p);
  near(m.momentum,m.momentumAfter);near(m.v2-m.v1,restitution*(p.u1-p.u2));assert.ok(m.loss>=-1e-10);
  if(restitution===1)near(m.before,m.after);if(restitution===0)near(m.v1,m.v2);
 }
 const m=simulate('collision',{...defaults('collision'),u1:-2,u2:1});assert.equal(m.approaching,false);near(m.loss,0);
});
test('refraction obeys Snell law and total internal reflection requires the denser starting medium',()=>{
 near(simulate('refraction',{angle:30,n1:1,n2:1.5}).refraction,19.47122063449069);
 assert.equal(simulate('refraction',{angle:60,n1:1.5,n2:1}).totalReflection,true);
 assert.equal(simulate('refraction',{angle:80,n1:1,n2:1.5}).totalReflection,false);
 near(simulate('refraction',{angle:0,n1:1.5,n2:1}).refraction,0);
});

test('a current-carrying wire follows the right-hand rule and inverse-distance field law',()=>{
 const p={...defaults('wire-field'),current:2,x:1,y:0},a=simulate('wire-field',p),b=simulate('wire-field',{...p,x:2});near(a.bx,0);near(a.by,40e-6);near(b.strength,a.strength/2);near(simulate('wire-field',{...p,current:-2}).by,-a.by);near(simulate('wire-field',{...p,current:0}).strength,0);assert.equal(simulate('wire-field',{...p,x:0}).valid,false);
});
