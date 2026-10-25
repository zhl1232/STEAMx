import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVANCED_EXPLORATIONS as experiments, simulateAdvanced as simulate, viewAdvanced as view } from '../../public/physics-lab/advanced-experiments.mjs';
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} ≉ ${expected}`);
const defaults=e=>Object.fromEntries(e.controls.map(c=>[c.key,c.value]));
function finite(value) { if(typeof value==='number')assert.ok(Number.isFinite(value));else if(value&&typeof value==='object')Object.values(value).forEach(finite); }
test('fourteen distinct experiments have complete teaching and stage metadata',()=>{
 assert.equal(experiments.length,14);assert.equal(new Set(experiments.map(e=>e.id)).size,14);
 for(const e of experiments){assert.equal(e.guides.length,3);for(const key of ['goal','question','limit','formula','prerequisite','band'])assert.ok(e[key]);assert.ok(e.stages.length);assert.ok(e.stages.every(s=>['primary','middle','high'].includes(s)));}
 assert.equal(simulate('unknown',{}),null);assert.equal(view('unknown',{}),null);
});
for(const e of experiments)test(`${e.id}: defaults, each control endpoint, and late time remain finite and render`,()=>{
 const p=defaults(e),cases=[p,...e.controls.flatMap(c=>[{...p,[c.key]:c.min},{...p,[c.key]:c.max}])];
 for(const input of cases)for(const t of [0,1,1e6]){
  finite(simulate(e.id,input,t));const v=view(e.id,input,t);finite(v.model);assert.ok(v.svg.includes('<'));assert.ok(v.metrics.length);assert.doesNotMatch(v.svg,/NaN|Infinity|undefined/);assert.ok(v.metrics.every(m=>m.value!=='NaN'));if(e.animation){const d=typeof e.animation.duration==='function'?e.animation.duration(input):e.animation.duration;assert.ok(Number.isFinite(d)&&d>=0);}
 }
});
test('uniform motion compares distance at a common elapsed time including a stopped cart',()=>{
 const m=simulate('uniform-motion',{speed1:0,speed2:3},4);near(m.position1,0);near(m.position2,12);near(m.elapsed,4);
});
test('uniform motion visibly advances both carts on a fixed ten-second scale',()=>{
 const p={speed1:2,speed2:3},early=view('uniform-motion',p,2),later=view('uniform-motion',p,4);
 const cartXs=v=>[...v.svg.matchAll(/<rect x="([^"]+)"/g)].map(match=>Number(match[1]));
 assert.deepEqual(cartXs(early),[135,175]);assert.deepEqual(cartXs(later),[215,295]);
 assert.match(early.svg,/600 px = 30.00 m/);assert.match(later.svg,/600 px = 30.00 m/);
 const late=view('uniform-motion',p,100);assert.match(late.notice,/超出固定画面范围/);assert.match(late.svg,/600 px = 30.00 m/);near(late.model.position2,300);
});
test('constant signed acceleration reverses rather than stopping at zero velocity',()=>{
 const p={velocity:6,acceleration:-2};near(simulate('accelerated-motion',p,3).velocity,0);const m=simulate('accelerated-motion',p,5);near(m.velocity,-4);near(m.position,5);near(simulate('accelerated-motion',p,10).position,-40);
 const v=view('accelerated-motion',p,5);assert.match(v.svg,/位移 x/);assert.match(v.svg,/速度 v/);assert.match(v.notice,/不是|不模拟/);
});
test('accelerated motion marks current position and velocity without changing graph axes',()=>{
 const p={velocity:6,acceleration:-2},start=view('accelerated-motion',p,0).svg,later=view('accelerated-motion',p,9).svg;
 const marker=(svg,key)=>{const match=svg.match(new RegExp(`<g data-time-marker="${key}"><circle cx="([^"]+)" cy="([^"]+)"`));assert.ok(match);return match.slice(1).map(Number);};
 near(marker(start,'position')[0],65);near(marker(later,'position')[0],335);
 near(marker(start,'velocity')[0],435);near(marker(later,'velocity')[0],705);
 // Fixed x range [-40,9] and v range [-14,6] map the actual x(9)=-27 and v(9)=-12.
 near(marker(later,'position')[1],345-13/49*210);near(marker(later,'velocity')[1],324);
 const axes=svg=>svg.replace(/<g data-time-marker="[^"]+">.*?<\/g>/g,'');
 assert.notEqual(start,later);assert.equal(axes(start),axes(later));
 const late=view('accelerated-motion',p,100);assert.match(late.notice,/超出固定 0–10 s 图域/);assert.doesNotMatch(late.svg,/data-time-marker/);near(late.model.velocity,-194);
});
test('horizontal projectile reference flight time and first-ground stop',()=>{
 const p={speed:10,angle:0,height:4.905},m=simulate('projectile',p,1e6);near(m.flightTime,1);near(m.elapsed,1);near(m.x,10);near(m.y,0);near(m.vy,-9.81);assert.equal(m.stopped,true);
 const before=simulate('projectile',p,.5);near(before.x,5);near(before.y,3.67875);assert.equal(before.stopped,false);
 const ground=simulate('projectile',{speed:10,angle:0,height:0},20);near(ground.elapsed,0);near(ground.x,0);
 const launch=simulate('projectile',{speed:10,angle:45,height:0},1e6);near(launch.range,100/9.81);near(launch.y,0);
});
test('circular velocity is tangent and force inward with no instantaneous power',()=>{
 const m=simulate('circular-motion',{mass:2,radius:3,speed:6},.37);near(m.force,24);near(m.period,Math.PI);near(m.x*m.vx+m.y*m.vy,0);near(m.fx*m.vx+m.fy*m.vy,0);assert.ok(m.x*m.fx+m.y*m.fy<0);
 const rest=simulate('circular-motion',{speed:0});assert.equal(rest.period,null);near(rest.force,0);assert.doesNotMatch(view('circular-motion',{speed:0}).svg,/NaN/);
});
test('small angle pendulum period scales with square root of length and not amplitude',()=>{
 const one=simulate('pendulum',{length:1,angle:5}),four=simulate('pendulum',{length:4,angle:10});near(one.period,2.0060666807106475);near(four.period/one.period,2);near(simulate('pendulum',{length:1,angle:10}).period,one.period);near(simulate('pendulum',{length:1,angle:5},one.period/4).angle,0);assert.ok(experiments.find(e=>e.id==='pendulum').controls.find(c=>c.key==='angle').max<=10);
});
test('spring kinetic and potential exchange while preserving total energy',()=>{
 const p={mass:1,stiffness:20,amplitude:.2};const initial=simulate('spring-energy',p);near(initial.total,.4);near(initial.kinetic,0);
 const quarter=simulate('spring-energy',p,initial.period/4);near(quarter.potential,0);near(quarter.kinetic,.4);
 for(const t of [.1,1,123]){const m=simulate('spring-energy',p,t);near(m.kinetic+m.potential,m.total);}
});
test('solid pressure uses square-centimetre conversion and inverse area',()=>{
 const a=simulate('pressure-solid',{force:200,area:50}),b=simulate('pressure-solid',{force:200,area:100});near(a.area,.005);near(a.pressure,40000);near(a.pressure/b.pressure,2);
});
test('solid pressure displays small SI areas without rounding away the conversion',()=>{
 for(const [area,expected] of [[1,'0.0001'],[50,'0.0050'],[200,'0.0200']]){
  const reading=view('pressure-solid',{area}).metrics.find(m=>m.label==='SI 接触面积');
  assert.equal(reading.value,expected);assert.equal(reading.unit,'m²');
 }
});
test('hydrostatic gauge and absolute pressure are distinct including liquid surface',()=>{
 const m=simulate('hydrostatic',{density:1000,depth:2,atmosphere:101.325});near(m.gauge,19620);near(m.absolute,120945);const surface=simulate('hydrostatic',{depth:0});near(surface.gauge,0);near(surface.absolute,101325);assert.match(view('hydrostatic',{}).svg,/液面表压 0/);
});
test('hydraulic area ratio conserves displaced volume and work',()=>{
 const m=simulate('hydraulic',{force:50,area1:5,area2:100,distance:10});near(m.force2,1000);near(m.distance2,.005);near(m.area1*m.distance1,m.area2*m.distance2);near(m.inputWork,5);near(m.outputWork,m.inputWork);
});
test('lifting distinguishes useful work, input energy, efficiency, and power',()=>{
 const m=simulate('work-power',{mass:10,height:3,duration:10,efficiency:80});near(m.useful,294.3);near(m.input,367.875);near(m.usefulPower,29.43);near(m.inputPower,36.7875);near(m.input-m.useful,m.loss);
});
test('hydraulic prescribed stroke conserves volume and work at every time and clamps at completion',()=>{
 const e=experiments.find(e=>e.id==='hydraulic');assert.equal(e.animation.duration,10);assert.equal(e.animation.rate,1);
 for(const area1 of [1,5,20])for(const area2 of [20,100,200])for(const distance of [0,10,20])for(const force of [0,50,200]){
  const p={area1,area2,distance,force};
  for(const t of [-2,0,2.5,5,10,1e6]){
   const m=simulate('hydraulic',p,t),progress=Math.min(10,Math.max(0,t))/10;
   near(m.elapsed,progress*10);near(m.currentDistance1,distance*.01*progress);near(m.currentDistance2,m.currentDistance1*area1/area2);
   near(m.area1*m.currentDistance1,m.area2*m.currentDistance2,1e-16);near(m.displacedVolume,m.area1*m.currentDistance1,1e-16);
   near(m.currentInputWork,force*m.currentDistance1);near(m.currentOutputWork,m.currentInputWork);
   // Legacy totals remain independent of the animated state, including at t=0.
   near(m.inputWork,force*distance*.01);near(m.outputWork,m.inputWork);
  }
 }
});
test('hydraulic piston geometry moves in opposite directions with a common displacement scale and area-dependent diameters',()=>{
 const piston=(svg,which)=>{const match=svg.match(new RegExp(`<g data-hydraulic-piston="${which}"><path d="M([^ ]+) ([^L]+)L([^ ]+) ([^"]+)"`));assert.ok(match);return {x:Number(match[1]),y:Number(match[2]),width:Number(match[3])-Number(match[1])};};
 const p={area1:5,area2:100,distance:10},start=view('hydraulic',p,0),mid=view('hydraulic',p,5),end=view('hydraulic',p,10);
 for(const v of [mid,end]){
  const down=piston(v.svg,'input').y-piston(start.svg,'input').y,up=piston(start.svg,'output').y-piston(v.svg,'output').y;
  near(down,1200*v.model.currentDistance1);near(up,1200*v.model.currentDistance2);near(down/up,20);
 }
 near(piston(view('hydraulic',{...p,area1:20},0).svg,'input').width/piston(start.svg,'input').width,2);
 near(piston(view('hydraulic',{...p,area2:25},0).svg,'output').width/piston(start.svg,'output').width,.5);
 assert.match(start.svg,/初始/);assert.match(mid.metrics[0].label,/排液体积 = 增液体积/);
 assert.equal(view('hydraulic',p,1e6).svg,end.svg);assert.notEqual(start.svg,end.svg);
});
test('uniform lifting tracks actual time, height and cumulative energy while retaining final totals',()=>{
 const e=experiments.find(e=>e.id==='work-power');assert.equal(e.animation.rate,1);
 for(const mass of [1,10,100])for(const height of [0,.5,3,20])for(const duration of [1,10,60])for(const efficiency of [10,80,100]){
  const p={mass,height,duration,efficiency};assert.equal(e.animation.duration(p),duration);
  for(const t of [-1,0,duration/4,duration,1e6]){
   const m=simulate('work-power',p,t),elapsed=Math.min(duration,Math.max(0,t));
   near(m.elapsed,elapsed);near(m.currentHeight,height*elapsed/duration);near(m.currentUseful,mass*9.81*m.currentHeight);near(m.currentInput,m.currentUseful/(efficiency/100));
   near(m.currentLoss+m.currentUseful,m.currentInput);near(m.useful,mass*9.81*height);near(m.input,m.useful/(efficiency/100));near(m.speed,height/duration);
  }
 }
 const fast=simulate('work-power',{height:10,duration:10},5),slow=simulate('work-power',{height:10,duration:20},5);near(fast.currentHeight,2*slow.currentHeight);near(fast.useful,slow.useful);
});
test('lift weight and attached rope follow current height on a fixed metre scale, including zero height',()=>{
 const geometry=svg=>{
  const weight=svg.match(/<g data-lift-weight="current"><rect x="[^"]+" y="([^"]+)"/),rope=svg.match(/<g data-lift-rope="current"><path d="M385 80L385 ([^"]+)"/);
  assert.ok(weight);assert.ok(rope);near(Number(weight[1]),Number(rope[1]));return Number(weight[1]);
 };
 const p={height:20,duration:60},start=view('work-power',p,0),mid=view('work-power',p,30),end=view('work-power',p,60);
 near(geometry(start.svg)-geometry(mid.svg),120);near(geometry(start.svg)-geometry(end.svg),240);
 near(geometry(view('work-power',{height:10,duration:60},60).svg)-geometry(end.svg),120);
 assert.equal(view('work-power',p,1e6).svg,end.svg);near(geometry(view('work-power',{height:0},0).svg),geometry(view('work-power',{height:0},1e6).svg));
 assert.ok(start.metrics.some(m=>m.label==='累计有用功'&&Number(m.value)===0));assert.ok(start.metrics.some(m=>m.label==='全程有用功'&&Number(m.value)>0));
});
test('resistive power scales as voltage squared while energy scales with time',()=>{
 const p={voltage:12,resistance:20,duration:60},m=simulate('electric-power',p);near(m.current,.6);near(m.power,7.2);near(m.energy,432);near(simulate('electric-power',{...p,voltage:24}).power,4*m.power);near(simulate('electric-power',{...p,duration:120}).energy,2*m.energy);
});
test('voltage-connected vacuum capacitor converts units and exchanges charge when gap changes',()=>{
 const p={voltage:50,area:100,gap:2},m=simulate('capacitor',p);near(m.area,.01);near(m.gap,.002);near(m.capacitance,4.4270939064e-11,1e-22);near(m.charge,2.2135469532e-9,1e-20);near(m.field,25000);near(m.energy,.5*m.charge*50);const wider=simulate('capacitor',{...p,gap:4});near(wider.capacitance/m.capacitance,.5);near(wider.charge/m.charge,.5);near(wider.field/m.field,.5);near(wider.energy/m.energy,.5);
});
test('aircore solenoid field changes sign with current and scales with turn density',()=>{
 const p={current:2,turns:500,length:1},m=simulate('electromagnet',p);near(m.field,Math.PI*.0004);near(simulate('electromagnet',{...p,current:-2}).field,-m.field);near(simulate('electromagnet',{...p,current:0}).field,0);near(simulate('electromagnet',{...p,length:2}).field,m.field/2);assert.match(view('electromagnet',p).svg,/空气芯/);
});
test('ideal AC transformer RMS reference values, load dependence, and conservation',()=>{
 const p={voltage:120,turns1:500,turns2:250,resistance:100},m=simulate('transformer',p);near(m.voltage2,60);near(m.current2,.6);near(m.current1,.3);near(m.outputPower,36);near(m.inputPower,m.outputPower);const higher=simulate('transformer',{...p,turns2:1000});near(higher.voltage2,240);near(higher.outputPower,576);near(higher.current1,4.8);assert.match(view('transformer',p).svg,/稳恒直流/);near(simulate('transformer',{...p,voltage:0}).inputPower,0);
});
test('drawings disclose scales or schematic limits and teaching scope stays explicit',()=>{
 for(const e of experiments){const v=view(e.id,defaults(e),1);assert.match(e.limit+' '+v.svg,/示意|缩放|尺度|归一化/);}
 assert.match(experiments.find(e=>e.id==='capacitor').limit,/恒压/);assert.match(experiments.find(e=>e.id==='transformer').limit,/有效值/);assert.match(experiments.find(e=>e.id==='electromagnet').limit,/无铁芯/);
});
