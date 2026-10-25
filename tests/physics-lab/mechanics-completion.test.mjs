import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPLETION_MECHANICS as experiments, simulateCompletionMechanics as simulate, viewCompletionMechanics as view } from '../../public/physics-lab/mechanics-completion.mjs';
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} ≉ ${b}`);
const defaults=e=>Object.fromEntries(e.controls.map(c=>[c.key,c.value]));
function finite(v){if(typeof v==='number')assert.ok(Number.isFinite(v));else if(v&&typeof v==='object')Object.values(v).forEach(finite);}
test('all ten experiments carry teaching metadata and discrete controls remain numeric',()=>{
 assert.equal(experiments.length,10);assert.equal(new Set(experiments.map(e=>e.id)).size,10);
 for(const e of experiments){assert.equal(e.guides.length,3);for(const key of ['goal','question','limit','formula','band','prerequisite'])assert.ok(e[key]);assert.ok(e.keywords.length);assert.ok(e.stages.every(s=>['primary','middle','high'].includes(s)));for(const c of e.controls)for(const o of c.options??[])assert.equal(typeof o.value,'number');}
 assert.equal(simulate('missing'),null);assert.equal(view('missing'),null);
});
for(const e of experiments)test(`${e.id} renders finite defaults, endpoint combinations and invalid input`,()=>{
 const p=defaults(e),cases=[p,...e.controls.flatMap(c=>[{...p,[c.key]:c.min},{...p,[c.key]:c.max}]),Object.fromEntries(e.controls.map(c=>[c.key,c.min])),Object.fromEntries(e.controls.map(c=>[c.key,c.max])),Object.fromEntries(e.controls.map(c=>[c.key,NaN]))];
 for(const input of cases)for(const t of [-1,0,.3,2,1e6,NaN]){const v=view(e.id,input,t);finite(v.model);assert.ok(v.metrics.length);assert.ok(v.svg.includes('<'));assert.doesNotMatch(v.svg,/NaN|Infinity|undefined/);assert.ok(v.metrics.every(m=>m.value!=='NaN'));}
});
test('vector components, perpendicular forces, cancellation, and common-origin arrows',()=>{
 let m=simulate('force-composition',{force1:3,force2:4,angle:90});near(m.force,5);near(m.fx,3);near(m.fy,4);
 m=simulate('force-composition',{force1:8,force2:8,angle:180});near(m.force,0);assert.equal(m.direction,null);
 near(simulate('force-composition',{force1:3,force2:4,angle:0}).force,7);
 const v=view('force-composition',{force1:3,force2:4,angle:90});assert.match(v.svg,/7 px\/N/);assert.match(v.svg,/平行|F₁/);
});
test('third-law force equality is independent of mass and conserves total momentum',()=>{
 const p={mass1:2,mass2:4,force:6};for(const t of [0,.5,1,2,100]){const m=simulate('newton-third-law',p,t);near(m.force1,-m.force2);near(m.a1,-3);near(m.a2,1.5);near(2*m.v1+4*m.v2,0);near(2*m.x1+4*m.x2,0);assert.ok(m.x1<=0&&m.x2>=0);}
 near(simulate('newton-third-law',{force:0},1).x1,0);assert.notEqual(view('newton-third-law',p,0).svg,view('newton-third-law',p,1).svg);
});
test('elevator uses unilateral support at, above and below free-fall acceleration',()=>{
 for(const a of [-12,-9.81,-2,0,5]){const m=simulate('apparent-weight',{mass:60,acceleration:a},.5);assert.ok(m.normal>=0);near(m.normal-60*9.81,60*m.personAcceleration);near(m.normal,Math.max(0,60*(9.81+a)));assert.ok(m.gap>=0);}
 const free=simulate('apparent-weight',{acceleration:-9.81},.5);near(free.normal,0);near(free.gap,0);
 const detached=simulate('apparent-weight',{acceleration:-12},.5);assert.equal(detached.contact,false);near(detached.gap,.5*(12-9.81)*.5**2);near(detached.personAcceleration,-9.81);
 near(simulate('apparent-weight',{acceleration:0,mass:60}).normal,588.6);
});
test('forced oscillator starts at rest and satisfies the equation of motion and analytic derivatives',()=>{
 const p={mass:1.2,stiffness:20,damping:.15,force:2,frequency:.63},zero=simulate('forced-oscillation',p,0);near(zero.position,0);near(zero.velocity,0);near(zero.acceleration,p.force/p.mass);
 const h=1e-5;for(const t of [.1,1,5,20]){const m=simulate('forced-oscillation',p,t),before=simulate('forced-oscillation',p,t-h),after=simulate('forced-oscillation',p,t+h);near((after.position-before.position)/(2*h),m.velocity,1e-7);near((after.velocity-before.velocity)/(2*h),m.acceleration,1e-7);near(p.mass*m.acceleration+m.b*m.velocity+p.stiffness*m.position,m.drive);}
 near(simulate('forced-oscillation',{force:0},10).position,0);
 const natural=Math.sqrt(20)/(2*Math.PI),res=simulate('forced-oscillation',{frequency:natural,damping:.02},30),off=simulate('forced-oscillation',{frequency:2,damping:.02},30);assert.ok(res.amplitude>off.amplitude*10);assert.ok(Math.abs(res.position)<2*res.amplitude+1e-9);
 const damped=simulate('forced-oscillation',{damping:.8},30);near(damped.peakFrequency,0);assert.ok(Math.abs(damped.transient)<1e-20);
});
test('Doppler signs distinguish medium velocity, and moving wavefront spacing equals predicted wavelength',()=>{
 const f=5;near(simulate('doppler',{frequency:f,sourceSpeed:0,observerSpeed:0}).frequency,f);
 assert.ok(simulate('doppler',{frequency:f,sourceSpeed:60,observerSpeed:0}).frequency>f);
 assert.ok(simulate('doppler',{frequency:f,sourceSpeed:0,observerSpeed:60}).frequency<f);
 near(simulate('doppler',{frequency:f,sourceSpeed:60,observerSpeed:60}).frequency,f);
 const p={frequency:f,sourceSpeed:60,observerSpeed:-40},m=simulate('doppler',p,4);near(m.frequency*m.wavelength,343-p.observerSpeed);assert.ok(m.observerX>m.sourceX);
 const emittedFront=n=>60*(n/f)+343*(4-n/f);near(emittedFront(2)-emittedFront(3),m.wavelength);
 assert.match(view('doppler',p,0).notice,/尚未到/);assert.match(view('doppler',p,4).notice,/已到达/);
});
test('coil emf is minus flux-linkage derivative, reverses at centre and vanishes on stopping',()=>{
 const p={position:-.5,speed:.15,polarity:1,turns:100,resistance:5},h=1e-5;
 for(const t of [1,2,4,5]){const m=simulate('coil-induction',p,t),before=simulate('coil-induction',p,t-h),after=simulate('coil-induction',p,t+h);near(m.emf,-(after.fluxLinkage-before.fluxLinkage)/(2*h),1e-7);near(m.current,m.emf/5);}
 assert.ok(simulate('coil-induction',p,1).current<0);assert.ok(simulate('coil-induction',p,5).current>0);near(simulate('coil-induction',p,10/3).current,0);
 const a=simulate('coil-induction',p,1),flip=simulate('coil-induction',{...p,polarity:-1},1);near(a.emf,-flip.emf);
 const stopped=simulate('coil-induction',p,8);near(stopped.position,.6);near(stopped.speed,0);near(stopped.emf,0);
 near(simulate('coil-induction',{speed:0}).current,0);near(simulate('coil-induction',{position:.6,speed:.1},0).current,0);
});
test('generator flux and emf have quarter-cycle phase difference and correct rotation direction',()=>{
 const p={field:.3,area:.05,turns:20,rpm:60,resistance:10};near(simulate('ac-generator',p,0).emf,0);
 const quarter=simulate('ac-generator',p,.25);near(quarter.flux,0);near(quarter.emf,20*.3*.05*2*Math.PI);near(quarter.current,quarter.emf/10);
 const t=.13,h=1e-6,m=simulate('ac-generator',p,t);near(m.emf,-(simulate('ac-generator',p,t+h).fluxLinkage-simulate('ac-generator',p,t-h).fluxLinkage)/(2*h),1e-7);
 // Same angle modulo 2π, with reversed angular velocity, reverses emf.
 near(simulate('ac-generator',{...p,rpm:-60},.75).emf,-quarter.emf);
 near(simulate('ac-generator',{rpm:0},4).emf,0);near(simulate('ac-generator',{field:0},4).current,0);
});
test('conductor force follows Iℓ×B including zero, sign reversals and angular dependence',()=>{
 const p={field:.5,current:2,length:.5,angle:90},m=simulate('motor-force',p);near(m.forceZ,-.5);near(simulate('motor-force',{...p,current:-2}).forceZ,.5);near(simulate('motor-force',{...p,field:-.5,current:-2}).forceZ,-.5);near(simulate('motor-force',{...p,angle:0}).force,0);near(simulate('motor-force',{...p,angle:30}).force,.25);near(simulate('motor-force',{...p,current:0}).force,0);
 assert.match(view('motor-force',p).svg,/M595 215L625 245/);assert.match(view('motor-force',{...p,current:-2}).svg,/<circle cx="610" cy="230" r="6"/);
});
test('iron core gives reversible, finite, saturating enhancement with zero-current handling',()=>{
 const p={turns:500,length:1,current:2},air=simulate('electromagnet-core',{...p,core:0}),iron=simulate('electromagnet-core',{...p,core:1});near(air.field,4*Math.PI*1e-7*500*2);assert.ok(iron.field>air.field);assert.ok(iron.relativeGain<200);
 near(simulate('electromagnet-core',{...p,current:-2}).field,-iron.field);const zero=simulate('electromagnet-core',{current:0});near(zero.field,0);assert.equal(zero.relativeGain,null);
 const low=simulate('electromagnet-core',{turns:100,length:2,current:.01}),high=simulate('electromagnet-core',{turns:1000,length:.5,current:5});near(low.relativeGain,200,1e-5);assert.ok(high.magnetization<1.5);assert.ok(high.relativeGain<low.relativeGain);
});

test('DC motor commutator maintains torque sign, while fixed wiring alternates each half turn',()=>{
 const p={current:2,field:.4,turns:20,area:.05,demonstrationSpeed:0};
 for(const angle of [30,90,150,210,270,330]){const m=simulate('dc-motor',{...p,angle,commutator:1});assert.ok(m.torque>0);near(m.torque,.8*Math.abs(Math.sin(angle*Math.PI/180)));near(m.torque,-20*.05*.4*m.windingCurrent*Math.sin(m.angle));near(simulate('dc-motor',{...p,angle,current:-2}).torque,-m.torque);near(simulate('dc-motor',{...p,angle,field:-.4}).torque,-m.torque);near(simulate('dc-motor',{...p,angle,current:-2,field:-.4}).torque,m.torque);}
 const first=simulate('dc-motor',{...p,angle:90,commutator:0}),second=simulate('dc-motor',{...p,angle:270,commutator:0});near(first.windingCurrent,second.windingCurrent);near(first.torque,-second.torque);
 near(simulate('dc-motor',{...p,angle:90,commutator:1}).windingCurrent,-simulate('dc-motor',{...p,angle:270,commutator:1}).windingCurrent);
});
test('DC motor dead points cannot start from rest and angle animation is explicitly externally prescribed',()=>{
 for(const angle of [0,180,360])for(const commutator of [0,1]){const m=simulate('dc-motor',{angle,commutator,demonstrationSpeed:0},4);assert.equal(m.deadPoint,true);near(m.torque,0);near(m.omega,0);near(m.angle,angle*Math.PI/180);if(commutator)near(m.windingCurrent,0);assert.match(view('dc-motor',{angle,commutator,demonstrationSpeed:0}).notice,/不会自行启动/);}
 const p={angle:30,demonstrationSpeed:15},m=simulate('dc-motor',p,2);near(m.angle,Math.PI/6+Math.PI);assert.equal(m.prescribedRotation,true);near(simulate('dc-motor',{...p,current:-5},2).angle,m.angle);near(simulate('dc-motor',{...p,field:-.8},2).omega,m.omega);near(simulate('dc-motor',{...p,current:0},2).torque,0);near(simulate('dc-motor',{...p,field:0},2).torque,0);assert.notEqual(view('dc-motor',p,0).svg,view('dc-motor',p,1).svg);assert.match(view('dc-motor',p,2).notice,/角度由外力给定/);assert.match(view('dc-motor',p,2).svg,/非预测电机转速/);
});

test('DC split-ring gaps meet the fixed brushes at model dead points, and metal meets them at peak torque',()=>{
 const tau=2*Math.PI,wrap=a=>(a%tau+tau)%tau;
 for(const angle of [0,90,180]){
  const v=view('dc-motor',{angle,demonstrationSpeed:0,commutator:1});
  const ring=v.svg.match(/<g transform="rotate\(([-\d.]+) 650 230\)">(.*?)<\/g>/);
  assert.ok(ring);const rotation=Number(ring[1])*Math.PI/180;
  const arcs=[...ring[2].matchAll(/M([\d.]+) ([\d.]+) A28 28 0 0 1 ([\d.]+) ([\d.]+)/g)].map(match=>match.slice(1).map(Number));
  assert.equal(arcs.length,2);
  // The drawing's two arcs must share the shaft centre, not two offset centres.
  for(const [x1,y1,x2,y2] of arcs){near(Math.hypot(x1-650,y1-230),28);near(Math.hypot(x2-650,y2-230),28);}
  const contact=brushAngle=>arcs.some(([x1,y1,x2,y2])=>{
   const start=Math.atan2(y1-230,x1-650),span=wrap(Math.atan2(y2-230,x2-650)-start);
   return wrap(brushAngle-rotation-start)<span;
  });
  const topContact=contact(-Math.PI/2),bottomContact=contact(Math.PI/2);
  assert.equal(topContact,angle===90);assert.equal(bottomContact,angle===90);
  assert.equal(v.model.deadPoint,!topContact&&!bottomContact);
  near(v.model.torque,angle===90?v.model.peakTorque:0);
  // Narrow brushes reach the ring at y=202/258 but do not bridge the top/bottom gaps.
  assert.match(v.svg,/<rect x="647" y="175" width="6" height="30"/);
  assert.match(v.svg,/<rect x="647" y="255" width="6" height="30"/);
 }
});
