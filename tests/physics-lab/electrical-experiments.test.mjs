import test from 'node:test';
import assert from 'node:assert/strict';
import { ELECTRICAL_EXPERIMENTS as experiments, simulateElectrical as simulate, viewElectrical as view } from '../../public/physics-lab/electrical-experiments.mjs';
const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),`${a} ≉ ${b}`);
const defaults=e=>Object.fromEntries(e.controls.map(c=>[c.key,c.value]));
function finite(value){if(typeof value==='number')assert.ok(Number.isFinite(value));else if(value&&typeof value==='object')Object.values(value).forEach(finite);}
test('five bounded lessons provide complete metadata and numeric select controls',()=>{
 assert.deepEqual(experiments.map(e=>e.id),['circuit-meters','rheostat-terminals','conductivity-resistivity','rc-transient','source-measurement']);
 for(const e of experiments){assert.equal(e.guides.length,3);for(const key of ['title','goal','question','limit','formula','band','prerequisite'])assert.ok(e[key]);assert.ok(e.stages.every(s=>['primary','middle','high'].includes(s)));assert.ok(e.keywords.length);for(const c of e.controls)if(c.options){assert.ok(c.options.some(o=>o.value===c.value));assert.ok(c.options.every(o=>typeof o.value==='number'&&o.label));}}
 assert.equal(simulate('unknown',{}),null);assert.equal(view('unknown',{}),null);
});
for(const e of experiments)test(`${e.id}: defaults, every option and endpoint, invalid inputs and late snapshots remain finite`,()=>{
 const p=defaults(e),cases=[p,...e.controls.flatMap(c=>(c.options?c.options.map(o=>o.value):[c.min,c.max]).map(value=>({...p,[c.key]:value}))),Object.fromEntries(e.controls.map(c=>[c.key,NaN])),Object.fromEntries(e.controls.map(c=>[c.key,Infinity]))];
 for(const input of cases)for(const t of [0,1,1e8]){const m=simulate(e.id,input,t),v=view(e.id,input,t);finite(m);finite(v.model);assert.ok(v.metrics.length);assert.doesNotMatch(v.svg,/NaN|Infinity|undefined/);assert.ok(v.notice);assert.match(e.limit+' '+v.svg,/示意|缩放/);}
});
test('ammeter is series, scale is a numerical measurement, and finite resistance loads the circuit',()=>{
 const p={meter:0,connection:0,range:0,polarity:1,finiteMeter:0,voltage:6,resistance:20},m=simulate('circuit-meters',p);
 near(m.reading,.3);near(m.fullScale,.6);near(m.divisions,15);near(m.loadCurrent,m.current);assert.equal(m.status,'ok');
 const loaded=simulate('circuit-meters',{...p,finiteMeter:1});near(loaded.current,6/20.2);assert.ok(loaded.current<m.current);near(loaded.meterResistance,.2);
 assert.match(view('circuit-meters',p).svg,/每小格 0.020 A/);
});
test('parallel ammeter is protected in both models and never reports fake zero current',()=>{
 for(const finiteMeter of [0,1])for(const voltage of [0,6]){const m=simulate('circuit-meters',{meter:0,connection:1,finiteMeter,voltage});assert.equal(m.status,'short-protected');assert.equal(m.protected,true);assert.equal(m.current,null);assert.equal(m.reading,null);assert.equal(m.trueValue,null);assert.equal(m.divisions,null);assert.match(m.notice,/不能读作 0/);}
});
test('voltmeter is parallel and finite meter branch contributes to source current',()=>{
 const p={meter:1,connection:1,range:1,finiteMeter:0,voltage:6,resistance:20},ideal=simulate('circuit-meters',p),finite=simulate('circuit-meters',{...p,finiteMeter:1});
 near(ideal.reading,6);near(ideal.current,.3);near(finite.reading,6);near(finite.current,.36);near(finite.loadCurrent,.3);assert.equal(ideal.meterResistance,null);
 for(const finiteMeter of [0,1]){const m=simulate('circuit-meters',{...p,connection:0,finiteMeter});assert.equal(m.status,'invalid-series-voltmeter');assert.equal(m.reading,null);assert.equal(m.divisions,null);near(m.current,finiteMeter?6/120:0);near(m.trueValue,finiteMeter?5:6);}
});
test('reverse polarity and over-range freeze the needle but retain signed model readings',()=>{
 const p={meter:0,connection:0,voltage:6,resistance:1,range:0};const over=simulate('circuit-meters',p);assert.equal(over.status,'over-range');assert.equal(over.reading,null);assert.equal(over.divisions,null);near(over.trueValue,6);
 const reverse=simulate('circuit-meters',{...p,resistance:20,range:1,polarity:-1});assert.equal(reverse.status,'reverse');assert.equal(reverse.reading,null);near(reverse.trueValue,-.3);
 const zero=simulate('circuit-meters',{...p,voltage:0,polarity:-1});assert.equal(zero.status,'ok');near(zero.reading,0);
});
test('rheostat endpoint-slider pairs agree while opposite endpoint reverses response',()=>{
 const p={maximum:20,slider:25,load:10,voltage:6};const expected=[5,5,15,15,20,0];
 for(let pair=0;pair<6;pair++){const m=simulate('rheostat-terminals',{...p,pair});near(m.activeResistance,expected[pair]);near(m.current,6/(10+expected[pair]));near(m.rheostatPower,m.current**2*m.activeResistance);}
 for(const slider of [0,100]){near(simulate('rheostat-terminals',{...p,pair:4,slider}).activeResistance,20);near(simulate('rheostat-terminals',{...p,pair:5,slider}).activeResistance,0);}
 near(simulate('rheostat-terminals',{...p,pair:0,slider:0}).activeResistance,0);near(simulate('rheostat-terminals',{...p,pair:2,slider:100}).activeResistance,0);
});
test('rheostat short and overcurrent protection do not fabricate operational readings',()=>{
 const short=simulate('rheostat-terminals',{pair:5,load:0});assert.equal(short.status,'short-protected');assert.equal(short.current,null);assert.equal(short.prospectiveCurrent,null);
 const over=simulate('rheostat-terminals',{pair:5,load:1,voltage:6});assert.equal(over.status,'overcurrent-protected');near(over.prospectiveCurrent,6);assert.equal(over.current,null);assert.equal(over.rheostatPower,null);
 const safe=simulate('rheostat-terminals',{pair:5,load:3,voltage:6});assert.equal(safe.status,'ok');near(safe.current,2);
});
test('resistivity measurement converts mm², uses actual sample voltage and distinguishes finite leakage',()=>{
 const p={material:2,length:2,area:.1,voltage:1},m=simulate('conductivity-resistivity',p);near(m.area,1e-7,1e-15);near(m.resistance,20);near(m.current,1/21);near(m.sampleVoltage,20/21);near(m.sampleVoltage+m.ballastVoltage,1);near(m.measuredResistivity,1e-6,1e-15);
 near(simulate('conductivity-resistivity',{...p,length:4}).resistance,2*m.resistance);near(simulate('conductivity-resistivity',{...p,area:.2}).resistance,m.resistance/2);
 const copper=simulate('conductivity-resistivity',{...p,material:0}),glass=simulate('conductivity-resistivity',{...p,material:3});assert.ok(copper.current>m.current);assert.ok(glass.current>0&&glass.current<1e-12);near(copper.sampleVoltage,.336/1.336);near(copper.measuredResistivity,1.68e-8,1e-16);near(glass.measuredResistivity,1e10);
 assert.equal(simulate('conductivity-resistivity',{...p,voltage:0}).measuredResistivity,null);assert.match(view('conductivity-resistivity',{...p,material:3}).metrics.find(r=>r.label==='通过样品的电流').value,/e-/);
});
test('RC time constant, signed currents, initial states and one-tau values agree with exponential solution',()=>{
 const p={resistance:5,capacitance:500,voltage:6,mode:0},start=simulate('rc-transient',p,0);near(start.tau,2.5);near(start.current,.0012);near(start.voltage,0);near(start.energy,0);near(start.timeLimit,12.5);
 const charging=simulate('rc-transient',p,2.5),discharging=simulate('rc-transient',{...p,mode:1},2.5);near(charging.voltage,6*(1-Math.exp(-1)));near(discharging.voltage,6*Math.exp(-1));near(charging.current,-discharging.current);near(charging.voltage+discharging.voltage,6);
 const dischargeStart=simulate('rc-transient',{...p,mode:1},0);near(dischargeStart.energy,.009);near(dischargeStart.current,-.0012);near(dischargeStart.sourceWork,0);
});
test('RC conserves energy and dissipates nonnegative heat at all slider times in both modes',()=>{
 for(const mode of [0,1])for(const voltage of [0,6,12])for(const time of [0,.1,1,2.5,12.5,1e6]){const m=simulate('rc-transient',{mode,voltage,resistance:5,capacitance:500},time);near(m.initialEnergy+m.sourceWork,m.energy+m.heat,1e-14);assert.ok(m.energy>=0&&m.heat>=0&&m.power>=0);assert.ok(m.voltage>=0&&m.voltage<=voltage);assert.ok(m.elapsed<=m.timeLimit);near(m.charge,m.capacitance*m.voltage);}
 const late=simulate('rc-transient',{},1e6);near(late.elapsed,late.timeLimit);assert.ok(late.current>0);assert.equal(late.stopped,true);assert.notEqual(view('rc-transient',{},0).svg,view('rc-transient',{},2).svg);
 const lesson=experiments.find(e=>e.id==='rc-transient');near(lesson.animation.duration(defaults(lesson)),12.5);
});
test('source open circuit, terminal drop, paired measurements and independent regression recover parameters',()=>{
 const p={emf:6,internal:2,load:10,open:0},m=simulate('source-measurement',p);near(m.current,.5);near(m.voltage,5);near(m.sourcePower,m.loadPower+m.internalPower);near(m.fit.emf,6);near(m.fit.internal,2);assert.equal(m.samples.length,5);
 for(const sample of m.samples){near(sample.voltage,sample.current*sample.load);near(sample.voltage,6-2*sample.current);}
 const open=simulate('source-measurement',{...p,open:1});near(open.current,0);near(open.voltage,6);near(open.loadPower,0);assert.deepEqual(open.samples,m.samples);
 const ideal=simulate('source-measurement',{...p,internal:0});near(ideal.voltage,6);near(ideal.fit.internal,0);
 const zero=simulate('source-measurement',{...p,emf:0});assert.equal(zero.fit,null);assert.match(zero.notice,/无法/);
});
// Inspect actual wire segments, not opaque fills: a continuous rail must not
// secretly bypass a battery, resistor, or series meter underneath its glyph.
const svgSegments=svg=>[...svg.matchAll(/d="M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)"/g)].map(match=>match.slice(1).map(Number));
const hasSegment=(segments,expected)=>segments.some(segment=>segment.every((v,i)=>v===expected[i]));
function assertGap(segments,x,y,axis){
 assert.ok(!segments.some(([x1,y1,x2,y2])=>axis==='vertical'?x1===x&&x2===x&&Math.min(y1,y2)<y&&Math.max(y1,y2)>y:y1===y&&y2===y&&Math.min(x1,x2)<x&&Math.max(x1,x2)>x),`wire bypasses ${axis} component at ${x},${y}`);
}
test('meter diagrams connect the source plates and component leads without hidden bypass wires',()=>{
 for(const connection of [0,1]){
  const svg=view('circuit-meters',{connection}).svg,segments=svgSegments(svg);
  assert.match(svg,/<g data-source="vertical" data-positive="top">/);
  assert.ok(hasSegment(segments,[76,225,124,225]));assert.ok(hasSegment(segments,[86,245,114,245]));
  assert.ok(hasSegment(segments,[100,130,100,225]));assert.ok(hasSegment(segments,[100,245,100,330]));
  assertGap(segments,100,235,'vertical');assertGap(segments,250,130,'horizontal');
  if(connection===0){assertGap(segments,240,330,'horizontal');assert.ok(hasSegment(segments,[350,330,264,330]));assert.ok(hasSegment(segments,[216,330,100,330]));}
  else{assertGap(segments,250,240,'horizontal');assert.ok(hasSegment(segments,[205,240,226,240]));assert.ok(hasSegment(segments,[274,240,295,240]));}
 }
});
test('red plus and black minus terminals follow polarity relative to the top-positive source',()=>{
 for(const connection of [0,1])for(const polarity of [-1,1]){
  const svg=view('circuit-meters',{connection,polarity}).svg,redOnLeft=connection===0?polarity<0:polarity>0;
  assert.match(svg,new RegExp(`data-meter-terminal="red" data-side="${redOnLeft?'left':'right'}"`));
  assert.match(svg,new RegExp(`data-meter-terminal="black" data-side="${redOnLeft?'right':'left'}"`));
  assert.match(svg,/\+ 红/);assert.match(svg,/− 黑/);
 }
});
test('resistivity diagram has a series ammeter and two genuine voltmeter branch connections',()=>{
 const segments=svgSegments(view('conductivity-resistivity',{}).svg);
 assert.ok(hasSegment(segments,[86,245,134,245]));assert.ok(hasSegment(segments,[96,265,124,265]));
 assert.ok(hasSegment(segments,[110,150,110,245]));assert.ok(hasSegment(segments,[110,265,110,340]));
 assertGap(segments,110,255,'vertical');assertGap(segments,215,150,'horizontal');assertGap(segments,320,150,'horizontal');assertGap(segments,485,150,'horizontal');assertGap(segments,485,265,'horizontal');
 for(const expected of [[260,150,296,150],[344,150,440,150],[440,150,440,265],[530,150,530,265],[440,265,461,265],[509,265,530,265]])assert.ok(hasSegment(segments,expected));
});
