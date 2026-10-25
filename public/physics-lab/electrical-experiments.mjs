// Portable teaching circuits: closed-form SI models, no free-wiring solver.
import { control as c, fmt, metric, text, line, arrow, circle, rect, plot } from './experiment-kit.mjs';
const choice = (key, label, options, value) => ({ ...c(key, label, Math.min(...options.map(o=>o[0])), Math.max(...options.map(o=>o[0])), 1, value), options: options.map(([value,label])=>({value,label})) });
const lesson = (id, topic, title, stages, goal, question, controls, guides, formula, limit, keywords, animation) => ({id,topic,title,stages,band:stages.includes('primary')?'小学观察 · 初高中探究':stages.includes('middle')?'初中探究 · 高中拓展':'高中物理',goal,question,controls,guides,formula,limit,keywords,prerequisite:'闭合电路、欧姆定律；定量拓展需电功与能量',...(animation?{animation}:{})});
export const ELECTRICAL_EXPERIMENTS = [
 lesson('circuit-meters','electric','电流表与电压表：接线、量程和读数',['middle','high'],'练习串并联、正负接线和刻度换算。','怎样让电表接得正确、读得准确？',[
  choice('meter','仪表',[[0,'电流表 A'],[1,'电压表 V']],0),choice('connection','接入位置',[[0,'与负载串联'],[1,'跨接负载两端（并联）']],0),choice('polarity','正负接线',[[1,'红接高电势端'],[-1,'红黑接反']],1),choice('range','量程档',[[0,'小量程：0.6 A / 3 V'],[1,'大量程：3 A / 15 V']],1),choice('finiteMeter','电表模型',[[0,'理想电表'],[1,'有限内阻：A 0.2 Ω / V 100 Ω']],0),c('voltage','理想电源电压',0,12,.5,6,'V'),c('resistance','负载电阻',1,100,1,20,'Ω')
 ],['先用大量程，把电流表串联、电压表并联，再观察刻度。','改小量程或交换红黑线，解释超量程与反偏提示。','比较理想与有限内阻，解释电流表压降和电压表分流。'],'I=U/(R+Rₐ)；并联电压表 Iᵥ=U/Rᵥ；读数=格数×量程/30','单理想直流源与固定负载；并联电流表一律保护断开，不把短路显示为零电流。反偏、超量程停止表针；真实模型值另列。电表内阻可选，100 Ω 电压表用于放大负载效应。电路与刻度为示意。',['电表','量程','串联','并联','正负接线']),
 lesson('rheostat-terminals','electric','滑动变阻器：四接线柱',['middle','high'],'区分电阻丝两端与滑片接线柱。','为什么滑片移动后，有的接法电阻不变？',[
  choice('pair','接线柱对',[[0,'A—C'],[1,'A—D'],[2,'B—C'],[3,'B—D'],[4,'A—B（电阻丝两端）'],[5,'C—D（滑片导轨）']],0),c('slider','滑片距 A 的位置',0,100,1,70,'%'),c('maximum','电阻丝总电阻',1,100,1,20,'Ω'),c('load','串联保护电阻',0,50,1,10,'Ω'),c('voltage','理想电源电压',0,12,.5,6,'V')
 ],['选择 A—C，移动滑片，比较有效电阻丝长度。','换成 B—D，再试 A—B 与 C—D。','拆去保护电阻并把有效电阻调到零，解释为何保护断开；接通前先调最大阻值。'],'RAC=RAD=xR最大；RBC=RBD=(1−x)R最大；I=U/(R负载+R有效)','A、B 为均匀电阻丝端点；C、D 同接理想无阻导轨滑片。理想源，不计接触电阻和温升；超过 2 A 或总电阻为零保护断开，不模拟烧毁；电路示意。',['变阻器','滑片','接线柱','保护']),
 lesson('conductivity-resistivity','electric','材料导电性与电阻率测量',['primary','middle','high'],'比较材料、长度和横截面积，反算电阻率。','同样粗细和长度的材料，电流为什么不同？',[
  choice('material','材料（约 20℃）',[[0,'铜'],[1,'铁'],[2,'镍铬合金'],[3,'玻璃（示例值）']],2),c('length','样品长度',.1,10,.1,2,'m'),c('area','横截面积',.01,2,.01,.1,'mm²'),c('voltage','电源电压',0,6,.1,1,'V')
 ],['保持长度、面积、电压相同，比较导体和绝缘体。','每次只改变长度或面积，观察样品电压与电流。','用样品两端电压与电流求 R，再由 ρ=RA/L 反算电阻率；零电压不能测量。'],'R=ρL/A；I=U源/(1 Ω+R)；ρ测=(U样/I)A/L','恒温均匀欧姆材料；铜、铁与镍铬合金取典型电阻率，玻璃取示例 10¹⁰ Ω·m，实际绝缘材料差异很大。串联固定 1 Ω 保护电阻，使用理想电压表和电流表；不模拟温升、击穿或接触电阻。几何示意，微小电流用科学记数法显示。',['导体','绝缘体','电阻率','电阻','材料']),
 lesson('rc-transient','field','RC 电路的充电与放电',['high'],'把电荷、电压、电流曲线与能量核算联系起来。','电容电压不能突变，电流方向又怎样变化？',[
  choice('mode','开关位置',[[0,'充电：初始无电荷，接电源'],[1,'放电：初始电压 U，移去电源']],0),c('voltage','电源 / 初始电压 U',0,12,.5,6,'V'),c('resistance','串联电阻',1,20,.5,5,'kΩ'),c('capacitance','电容',100,1000,50,500,'μF')
 ],['播放并在一个时间常数 τ 处暂停，读出电压和电流。','切到放电，比较相同时间的电容电压和有符号电流。','核对电源做功加初始储能=当前储能+电阻放热；5τ 后仍未严格达到终态。'],'τ=RC；充电 UC=U(1−e⁻ᵗ/τ)，I=(U/R)e⁻ᵗ/τ；放电 UC=Ue⁻ᵗ/τ，I=−(U/R)e⁻ᵗ/τ','理想电容、恒定电阻与理想直流源，不计漏电和电感；正电流定义为流入电容正极板。放电时电源完全移去。展示 0—5τ，并停在 5τ 的快照，电流并不被强制置零；图线各自缩放，电路示意。',['RC','电容','充电','放电','暂态'],{duration:p=>5*(p.resistance??5)*1000*(p.capacitance??500)*1e-6,rate:1}),
 lesson('source-measurement','electric','伏安法测电源电动势与内阻',['high'],'用多组负载的端电压与电流拟合电源参数。','为什么负载越小，电源端电压往往越低？',[
  c('emf','模型电动势（用于核对）',0,12,.5,6,'V'),c('internal','模型内阻（用于核对）',0,10,.5,2,'Ω'),c('load','当前负载',1,100,1,10,'Ω'),choice('open','开关',[[0,'接通负载'],[1,'断开（开路测量）']],0)
 ],['观察开路电压，再接通并调节负载，成对记录 U 与 I。','读取图中的五组标准负载数据，拟合 U–I 直线。','由截距求电动势、负斜率求内阻，并核对内外电路功率；全零电流时无法拟合。'],'I=ε/(R+r)；U=ε−Ir；拟合 U=a+bI，ε测=a，r测=−b','恒定电动势、恒定内阻的直流源；理想电压表与电流表，无测量噪声。标准负载 5、10、20、50、100 Ω，五组独立稳态测量，不是当前开关的同时读数；示意图不模拟电源化学或短路。',['电源','电动势','内阻','伏安法','拟合'])
];
const byId = new Map(ELECTRICAL_EXPERIMENTS.map(e=>[e.id,e]));
function parameters(id,input) {
 return Object.fromEntries(byId.get(id).controls.map(control=>{
  const raw=input?.[control.key], value=typeof raw==='number'&&Number.isFinite(raw)?raw:control.value;
  return [control.key,control.options?(control.options.some(o=>o.value===value)?value:control.value):Math.min(control.max,Math.max(control.min,value))];
 }));
}
const materials=[{name:'铜',rho:1.68e-8},{name:'铁',rho:9.71e-8},{name:'镍铬合金',rho:1e-6},{name:'玻璃',rho:1e10}];
export function simulateElectrical(id,input,time=0) {
 if(!byId.has(id))return null;
 const p=parameters(id,input);
 switch(id){
 case 'circuit-meters': {
  const ammeter=p.meter===0,fullScale=ammeter?[.6,3][p.range]:[3,15][p.range],meterResistance=p.finiteMeter?(ammeter?.2:100):ammeter?0:null;
  if(ammeter&&p.connection===1)return {status:'short-protected',protected:true,reading:null,trueValue:null,current:null,loadCurrent:null,fullScale,meterResistance,divisions:null,notice:'电流表并联形成低阻旁路：保护断开；电流未计算，不能读作 0 A。'};
  const invalid=!ammeter&&p.connection===0;
  const current=ammeter?p.voltage/(p.resistance+meterResistance):invalid?(p.finiteMeter?p.voltage/(p.resistance+meterResistance):0):p.voltage/p.resistance+(p.finiteMeter?p.voltage/meterResistance:0);
  const loadCurrent=!ammeter&&p.connection===1?p.voltage/p.resistance:current;
  const actual=ammeter?current:invalid?(p.finiteMeter?current*meterResistance:p.voltage):p.voltage,trueValue=p.polarity*actual;
  const status=invalid?'invalid-series-voltmeter':p.polarity<0&&actual>0?'reverse':actual>fullScale?'over-range':'ok';
  const notice=invalid?'电压表串联不能测负载两端电压；理想电压表使回路开路，有限内阻会改变电流。':status==='reverse'?'红黑接反，表针反偏：交换接线后读数。':status==='over-range'?'超出所选量程：切换大量程或降低电压。':'接线与量程正确；按每格值读取刻度。';
  return {status,protected:false,reading:status==='ok'?trueValue:null,trueValue,current,loadCurrent,fullScale,meterResistance,divisions:status==='ok'?actual/fullScale*30:null,notice};
 }
 case 'rheostat-terminals': {
  const fraction=p.slider/100,active=p.maximum*(p.pair<2?fraction:p.pair<4?1-fraction:p.pair===4?1:0),total=p.load+active;
  const prospectiveCurrent=total===0?null:p.voltage/total,protectedCircuit=total===0||prospectiveCurrent>2;
  return {activeResistance:active,totalResistance:total,prospectiveCurrent,current:protectedCircuit?null:prospectiveCurrent,loadVoltage:protectedCircuit?null:prospectiveCurrent*p.load,rheostatPower:protectedCircuit?null:prospectiveCurrent**2*active,protected:protectedCircuit,status:total===0?'short-protected':protectedCircuit?'overcurrent-protected':'ok',notice:total===0?'总电阻为零，保护断开；短路电流未计算。':protectedCircuit?'预计电流超过 2 A，保护断开；增加串联电阻。':p.pair===4?'A—B 接入整段电阻丝，滑片移动不改变电阻。':p.pair===5?'C—D 同属滑片导轨，有效电阻为零；负载限制电流。':'一个电阻丝端点与一个滑片端点接入，移动滑片可调电阻。'};
 }
 case 'conductivity-resistivity': {
  const material=materials[p.material],area=p.area*1e-6,resistance=material.rho*p.length/area,current=p.voltage/(1+resistance),sampleVoltage=current*resistance;
  return {material:material.name,resistivity:material.rho,conductivity:1/material.rho,area,resistance,current,sampleVoltage,ballastVoltage:current,measuredResistivity:current===0?null:sampleVoltage/current*area/p.length,notice:current===0?'电压为零：没有可用于伏安法的电流，电阻率测量未定义。':p.material===3?'绝缘体的微小漏电流不等于严格零；这里的玻璃值仅为示例。':'电压表跨接样品；串联 1 Ω 电阻限流，读数用样品电压而非电源电压。'};
 }
 case 'rc-transient': {
  const resistance=p.resistance*1000,capacitance=p.capacitance*1e-6,tau=resistance*capacitance,timeLimit=5*tau,elapsed=Math.min(timeLimit,Math.max(0,Number.isFinite(time)?time:0)),decay=Math.exp(-elapsed/tau),charging=p.mode===0,voltage=p.voltage*(charging?1-decay:decay),current=(charging?1:-1)*p.voltage/resistance*decay,energy=.5*capacitance*voltage**2,initialEnergy=charging?0:.5*capacitance*p.voltage**2,sourceWork=charging?capacitance*p.voltage*voltage:0,heat=.5*capacitance*p.voltage**2*(1-decay**2);
  return {resistance,capacitance,tau,timeLimit,elapsed,voltage,current,charge:capacitance*voltage,energy,initialEnergy,sourceWork,heat,power:current**2*resistance,stopped:elapsed>=timeLimit,notice:'正电流流入电容正极板；放电电流为负。曲线展示 5τ 内过程，停止播放只保留快照。'};
 }
 case 'source-measurement': {
  const reading=load=>{const current=p.emf/(load+p.internal);return {load,current,voltage:current*load};},current=p.open?0:p.emf/(p.load+p.internal),voltage=p.emf-current*p.internal,samples=[5,10,20,50,100].map(reading),meanI=samples.reduce((s,r)=>s+r.current,0)/samples.length,meanU=samples.reduce((s,r)=>s+r.voltage,0)/samples.length,variance=samples.reduce((s,r)=>s+(r.current-meanI)**2,0),slope=variance===0?null:samples.reduce((s,r)=>s+(r.current-meanI)*(r.voltage-meanU),0)/variance,fit=slope===null?null:{emf:meanU-slope*meanI,internal:-slope};
  return {current,voltage,sourcePower:p.emf*current,loadPower:voltage*current,internalPower:current**2*p.internal,samples,fit,open:p.open===1,notice:fit?'五组标准负载分别测量 U、I；由直线截距和负斜率反算，不使用模型参数直接填入拟合值。':'全部电流为零：U–I 数据没有横向跨度，无法从这些数据确定内阻。'};
 }
 }
}
const precise = value => value===null?'—':value!==0&&Math.abs(value)<.01?value.toExponential(3):fmt(value,3);
const read = (label,value,unit) => metric(label,precise(value),unit);
const meterGlyph=(x,y,label)=>circle(x,y,24)+text(x,y+6,label);
const resistor=(x,y,label)=>rect(x,y,90,32)+text(x+45,y+57,label);
// Vertical-rail source: upper (long) plate is positive; no wire crosses its gap.
const source=(x,y,label)=>`<g data-source="vertical" data-positive="top">${line(x-24,y-10,x+24,y-10,'var(--diagram-stroke)',4)}${line(x-14,y+10,x+14,y+10,'var(--diagram-stroke)',4)}${text(x-38,y-6,'+')}${text(x-38,y+15,'−')}${text(x-20,y+57,label)}</g>`;
const meterTerminals=(x,y,redOnLeft)=>{
 const terminal=(side,red)=>`<g data-meter-terminal="${red?'red':'black'}" data-side="${side<0?'left':'right'}">${circle(x+side*28,y,5,red?'#bb4848':'#26323d')}${text(x+side*28,y+39,red?'+ 红':'− 黑')}</g>`;
 return terminal(-1,redOnLeft)+terminal(1,!redOnLeft);
};
function dial(m,label){
 let svg=text(560,75,`量程 ${fmt(m.fullScale)} ${label} · 共 30 格`);
 for(let i=0;i<=30;i++){const angle=(-150+i*4)*Math.PI/180,r=i%5===0?90:96;svg+=line(560+Math.cos(angle)*r,215+Math.sin(angle)*r,560+Math.cos(angle)*108,215+Math.sin(angle)*108,'var(--diagram-stroke)',i%5===0?2:1);if(i%5===0)svg+=text(560+Math.cos(angle)*130,219+Math.sin(angle)*130,fmt(i/30*m.fullScale,1));}
 if(m.divisions!==null){const a=(-150+m.divisions*4)*Math.PI/180;svg+=arrow(560,215,Math.cos(a)*90,Math.sin(a)*90);}
 return svg+circle(560,215,5)+text(560,265,m.reading===null?'暂停表针 · 读数 —':`${fmt(m.reading,3)} ${label}`)+text(560,302,`每小格 ${fmt(m.fullScale/30,3)} ${label}`);
}
export function viewElectrical(id,input,time=0){
 if(!byId.has(id))return null;
 const p=parameters(id,input),m=simulateElectrical(id,p,time);let svg='',metrics=[];
 switch(id){
 case 'circuit-meters': {
  svg=line(100,130,205,130)+line(295,130,350,130)+line(350,130,350,330)+line(100,130,100,225)+line(100,245,100,330)+source(100,235,`${fmt(p.voltage)} V`)+resistor(205,114,`${fmt(p.resistance)} Ω`);
  const label=p.meter===0?'A':'V';
  if(p.connection===0)svg+=line(350,330,264,330)+line(216,330,100,330)+meterGlyph(240,330,label)+meterTerminals(240,330,p.polarity<0);
  else svg+=line(350,330,100,330)+line(205,130,205,240)+line(295,130,295,240)+line(205,240,226,240)+line(274,240,295,240)+meterGlyph(250,240,label)+meterTerminals(250,240,p.polarity>0);
  svg+=text(240,385,`${p.connection===0?'串联':'并联'} · ${p.polarity===1?'红接高电势':'红黑接反'}`)+dial(m,label)+text(400,435,p.finiteMeter?'有限内阻：A = 0.2 Ω；V = 100 Ω':'理想电表：A 内阻 0；V 开路极限');
  metrics=[read('仪表读数',m.reading,label),read('按当前接法的有符号模型值',m.trueValue,label),read('电源电流',m.current,'A'),read('负载电流',m.loadCurrent,'A')];break;
 }
 case 'rheostat-terminals': {
  const x=170+460*p.slider/100,pair=[[0,2],[0,3],[1,2],[1,3],[0,1],[2,3]][p.pair],points=[[170,270],[630,270],[170,130],[630,130]],activeColor='var(--green)';
  svg=rect(170,250,460,40)+line(170,130,630,130)+arrow(x,140,0,105)+text(x,220,'滑片 P')+text(400,95,'C、D 与滑片共用无阻导轨');
  if(p.pair<4)svg+=line(p.pair<2?170:x,270,p.pair<2?x:630,270,activeColor,7);else if(p.pair===4)svg+=line(170,270,630,270,activeColor,7);else svg+=line(170,130,630,130,activeColor,7);
  points.forEach(([px,py],i)=>{svg+=circle(px,py,8,pair.includes(i)?activeColor:'var(--surface-muted)')+text(px+(i%2?-25:25),py-15,['A','B','C','D'][i]);});
  svg+=text(400,345,`有效电阻 ${fmt(m.activeResistance)} Ω；串联保护电阻 ${fmt(p.load)} Ω`)+text(400,395,'选中端点及有效段着色；C、D 与滑片同电势，图形示意');
  metrics=[metric('接入电阻',m.activeResistance,'Ω'),read('通电电流',m.current,'A'),read('保护前预计电流',m.prospectiveCurrent,'A'),read('变阻器功率',m.rheostatPower,'W')];break;
 }
 case 'conductivity-resistivity':
  svg=line(110,150,170,150)+line(260,150,296,150)+line(344,150,440,150)+line(530,150,690,150)+line(690,150,690,340)+line(690,340,110,340)+line(110,150,110,245)+line(110,265,110,340)+source(110,255,`${fmt(p.voltage)} V`)+resistor(170,134,'保护 1 Ω')+meterGlyph(320,150,'A')+resistor(440,134,m.material)+line(440,150,440,265)+line(530,150,530,265)+line(440,265,461,265)+line(509,265,530,265)+meterGlyph(485,265,'V')+text(400,405,`L = ${fmt(p.length)} m；A = ${fmt(p.area)} mm² · 形状示意`);
  metrics=[read('样品两端电压',m.sampleVoltage,'V'),read('通过样品的电流',m.current,'A'),read('样品电阻',m.resistance,'Ω'),read('材料电阻率',m.resistivity,'Ω·m'),read('伏安法测得电阻率',m.measuredResistivity,'Ω·m')];break;
 case 'rc-transient': {
  const charging=p.mode===0,voltageAt=s=>p.voltage*(charging?1-Math.exp(-5*s):Math.exp(-5*s)),currentAt=s=>(charging?1:-1)*p.voltage/m.resistance*Math.exp(-5*s),voltageScale=140/Math.max(1,p.voltage),currentScale=100/Math.max(.0001,p.voltage/m.resistance),position=m.elapsed/m.timeLimit;
  svg=text(400,45,charging?'充电：电源 → R → C':'放电：电源移去，C 经 R 放电')+line(80,240,370,240)+line(80,75,80,240)+line(440,180,735,180)+line(440,75,440,300)+plot(voltageAt,{x:80,y:240,width:290,scale:voltageScale})+plot(currentAt,{x:440,y:180,width:295,scale:currentScale})+circle(80+290*position,240-m.voltage*voltageScale,5,'var(--green)')+circle(440+295*position,180-m.current*currentScale,5,'var(--green)')+text(225,280,`t：0 → ${fmt(m.timeLimit)} s`)+text(225,315,`UC：0 → ${fmt(p.voltage)} V`)+text(590,340,`I：±${precise(p.voltage/m.resistance*1000)} mA`)+text(590,375,`t：0 → ${fmt(m.timeLimit)} s；中线 I=0`)+text(400,425,`当前 ${fmt(m.elapsed)} s；τ = ${fmt(m.tau)} s · 两图各自缩放`);
  metrics=[metric('电容电压',m.voltage,'V'),read('有符号电流',m.current*1000,'mA'),read('电荷量',m.charge*1e6,'μC'),read('当前储能',m.energy*1000,'mJ'),read('电阻累计放热',m.heat*1000,'mJ'),read('电源累计做功',m.sourceWork*1000,'mJ')];break;
 }
 case 'source-measurement': {
  const maxI=Math.max(.01,...m.samples.map(r=>r.current),m.current),maxU=Math.max(1,p.emf),x=i=>90+i/maxI*280,y=u=>330-u/maxU*230;
  svg=line(90,330,385,330)+line(90,70,90,330)+text(225,375,`I：0 → ${precise(maxI)} A`)+text(225,45,`端电压 U：0 → ${fmt(maxU)} V`);
  if(m.fit)svg+=line(x(0),y(m.fit.emf),x(maxI),y(m.fit.emf-m.fit.internal*maxI),'var(--green)',2);
  for(const r of m.samples)svg+=circle(x(r.current),y(r.voltage),5,'var(--green)');
  svg+=circle(x(m.current),y(m.voltage),9,'none')+text(590,70,'独立标准负载的成对读数')+text(590,105,'R / Ω       I / A       U / V');
  m.samples.forEach((r,i)=>{svg+=text(590,145+i*40,`${r.load}       ${fmt(r.current,3)}       ${fmt(r.voltage,3)}`);});
  svg+=text(400,420,`${m.open?'当前开路':'当前接通 '+p.load+' Ω'} · 空心圈为当前读数，实心点为标准负载测量`);
  metrics=[read('当前电流',m.current,'A'),read('当前端电压',m.voltage,'V'),read('拟合电动势（截距）',m.fit?.emf??null,'V'),read('拟合内阻（负斜率）',m.fit?.internal??null,'Ω'),read('外电路功率',m.loadPower,'W'),read('内阻发热功率',m.internalPower,'W')];break;
 }
 }
 return {svg,metrics,notice:m.notice,model:m};
}
