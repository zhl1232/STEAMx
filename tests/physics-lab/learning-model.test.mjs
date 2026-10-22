import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSONS,startScene,lessonScene,measure,evidence,hintTargets,restoreNotebook,reportHTML} from '../../public/physics-lab/learning-model.mjs';
import {validateScene} from '../../public/physics-lab/physics.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const record=scene=>({id:'r1',at:'2026-10-22T03:00:00.000Z',scene,note:'我的观察'});
const pair=(a,b)=>[record(a),record(b)];
test('all task and reference scenes are valid and start with intended electrical behavior',()=>{
 for(const l of LESSONS){validateScene(startScene(l.id));validateScene(lessonScene(l.reference));}
 assert.equal(measure(startScene('light')).active,false);assert.equal(measure(startScene('repair')).short,true);
 for(const id of ['switch','voltage','series','parallel'])assert.equal(measure(startScene(id)).active,true,id);
 assert.equal(measure(lessonScene('series')).topology,'串联');assert.equal(measure(lessonScene('parallel')).topology,'并联');
});
test('light and repair require before/after evidence; duplicate records or altered apparatus do not pass',()=>{
 const open=startScene('light'),lit=lessonScene('single'),short=startScene('repair');
 assert.ok(evidence('light',pair(open,lit)).ready);assert.ok(!evidence('light',pair(lit,lit)).ready);assert.ok(!evidence('light',pair(short,lit)).ready);
 const other=clone(lit);other.components[0].value=6;assert.ok(!evidence('light',pair(open,other)).ready);
 assert.ok(evidence('repair',pair(short,lit)).ready);assert.ok(!evidence('repair',pair(short,other)).ready);assert.ok(!evidence('repair',pair(open,lit)).ready);
 const m=measure(short);assert.equal(m.current,null);assert.equal(m.power,null);assert.deepEqual(hintTargets(short).wires,['w3']);
 assert.equal(hintTargets(open).ports.length,2);
});
test('switch task requires the same wires and apparatus with only a switch change',()=>{
 const on=startScene('switch'),off=clone(on);off.components.find(c=>c.type==='switch').closed=false;
 assert.ok(evidence('switch',pair(on,off)).ready);
 const broken=clone(on);broken.wires.pop();assert.ok(!evidence('switch',pair(on,broken)).ready);
 off.components[0].value=6;assert.ok(!evidence('switch',pair(on,off)).ready);
});
test('voltage comparison ignores layout, but rejects simultaneous resistance or topology changes',()=>{
 const low=startScene('voltage'),high=clone(low);high.components[0].value=12;high.components[0].x=300;high.wires[0].points=[{x:500,y:100}];
 assert.ok(evidence('voltage',pair(low,high)).ready);high.components[1].value=200;assert.ok(!evidence('voltage',pair(low,high)).ready);
 high.components[1].value=100;high.wires.pop();assert.ok(!evidence('voltage',pair(low,high)).ready);
});
test('series comparison checks matched bulbs, fixed source voltage and actual series topology',()=>{
 const single=lessonScene('single'),series=lessonScene('series');assert.ok(evidence('series',pair(single,series)).ready);
 assert.ok(!evidence('series',pair(single,lessonScene('parallel'))).ready);
 series.components[2].value=200;assert.ok(!evidence('series',pair(single,series)).ready);
 series.components[2].value=100;series.components[0].value=6;assert.ok(!evidence('series',pair(single,series)).ready);
});
test('parallel comparison checks one branch out while the surviving bulb keeps its power',()=>{
 const both=lessonScene('parallel'),one=clone(both);one.wires=one.wires.filter(w=>w.id!=='w3');assert.ok(evidence('parallel',pair(both,one)).ready);
 one.components[0].value=12;assert.ok(!evidence('parallel',pair(both,one)).ready);
 assert.ok(!evidence('parallel',pair(both,lessonScene('single'))).ready);
});
test('notebook recovery rejects invalid scenes, bounds data and recalculates completion',()=>{
 const session={id:'s1',lessonId:'light',prediction:'会亮',reason:'我猜电池有电就会亮',reflection:'后来发现要闭合回路',records:pair(startScene('light'),lessonScene('single')),completedAt:'today',workingScene:lessonScene('single'),hintLevel:2};
 const loaded=restoreNotebook(JSON.stringify({version:1,lastId:'s1',sessions:[session]}));assert.equal(loaded.sessions[0].completedAt,'today');assert.equal(loaded.lastId,'s1');
 const bad=clone(session);bad.records[1].scene.wires[0].a.id='missing';const sanitized=restoreNotebook({version:1,sessions:[bad]});assert.equal(sanitized.sessions[0].records.length,1);assert.equal(sanitized.sessions[0].completedAt,null);
 assert.deepEqual(restoreNotebook('not json').sessions,[]);assert.deepEqual(restoreNotebook({version:1,sessions:[{id:'x',lessonId:'unknown'}]}).sessions,[]);
});
test('exported reports escape student text and distinguish short-circuit readings',()=>{
 const session={lessonId:'repair',prediction:'<script>alert(1)</script>',reason:'<img src=x>',reflection:'A & B',records:[{...record(startScene('repair')),note:'</td><script>x</script>'}]};
 const html=reportHTML(session);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/A &amp; B/);assert.match(html,/<td>—<\/td>/);assert.match(html,/时间（北京时间）/);assert.match(html,/2026\/10\/22 11:00:00/);
});
test('eighteen lessons form three levels of six, with valid acyclic prerequisites',()=>{
 assert.equal(LESSONS.length,18);for(const level of ['primary','middle','high'])assert.equal(LESSONS.filter(l=>l.level===level).length,6);
 const visit=(id,path=[])=>{assert.ok(!path.includes(id),`cycle ${id}`);const l=LESSONS.find(l=>l.id===id);assert.ok(l,id);for(const p of l.prerequisites)visit(p,[...path,id]);};LESSONS.forEach(l=>visit(l.id));
});
test('middle-school quantitative tasks require controlled and sufficiently varied measurements',()=>{
 for(const id of ['ohm_u','ohm_r']){const initial=startScene(id),component=id==='ohm_u'?'c1':'c2',values=id==='ohm_u'?[3,6,9]:[100,200,300];const records=values.map(v=>{const s=clone(initial);s.components.find(c=>c.id===component).value=v;return record(s);});assert.ok(evidence(id,records).ready,id);assert.ok(!evidence(id,records.slice(0,2)).ready,id);records[2].scene.components.find(c=>c.id===(component==='c1'?'c2':'c1')).value=12;assert.ok(!evidence(id,records).ready,id);}
 for(const id of ['series_r','parallel_r','current_split']){const a=startScene(id),b=clone(a);b.components.find(c=>c.id==='c3').value=300;assert.ok(evidence(id,pair(a,b)).ready,id);b.components[0].value=6;assert.ok(!evidence(id,pair(a,b)).ready,id);}
 for(const id of ['power_u','power_r']){const a=startScene(id),b=clone(a),c=id==='power_u'?'c1':'c2';b.components.find(x=>x.id===c).value*=2;assert.ok(evidence(id,pair(a,b)).ready,id);b.components.find(x=>x.id===c).value*=1.25;assert.ok(!evidence(id,pair(a,b)).ready,id);}
});
test('advanced divider, load, mixed and power tasks reject changed control parameters',()=>{
 for(const [id,part] of [['divider','c3'],['mixed','c4']]){const a=startScene(id),b=clone(a);b.components.find(c=>c.id===part).value=300;assert.ok(evidence(id,pair(a,b)).ready,id);b.components.find(c=>c.id==='c2').value=150;assert.ok(!evidence(id,pair(a,b)).ready,id);}
 const unloaded=startScene('loaded_divider'),loaded=lessonScene('resistor-mixed');assert.ok(evidence('loaded_divider',pair(unloaded,loaded)).ready);loaded.components.find(c=>c.id==='c3').value=300;assert.ok(!evidence('loaded_divider',pair(unloaded,loaded)).ready);
 const series=startScene('network_power'),parallel=lessonScene('resistor-parallel');assert.ok(evidence('network_power',pair(series,parallel)).ready);parallel.components[0].value=12;assert.ok(!evidence('network_power',pair(series,parallel)).ready);
 const maxRecords=[50,100,200].map(v=>{const s=startScene('max_power');s.components.find(c=>c.id==='c3').value=v;return record(s);});assert.ok(evidence('max_power',maxRecords).ready);assert.ok(!evidence('max_power',maxRecords.slice(0,2)).ready);
 const powers=maxRecords.map(r=>measure(r.scene).loads.find(l=>l.id==='c3').power);assert.ok(powers[1]>powers[0]&&powers[1]>powers[2]);
});
