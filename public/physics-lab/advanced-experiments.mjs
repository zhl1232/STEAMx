// Deterministic SI models. Input units are explicitly converted at model boundaries.
import { G, control as c, fmt, metric, text, line, arrow, circle, rect, plot } from './experiment-kit.mjs';
const EPS0 = 8.8541878128e-12, MU0 = 4 * Math.PI * 1e-7;
const all = ['primary', 'middle', 'high'], mh = ['middle', 'high'], high = ['high'];
const lesson = (id, topic, title, stages, goal, question, controls, guides, limit, formula, prerequisite, animation) => ({ id, topic, title, stages, band: stages.includes('primary') ? '小学观察 · 初高中探究' : stages.includes('middle') ? '初中探究 · 高中拓展' : '高中物理', goal, question, controls, guides, limit, formula, prerequisite, ...(animation ? { animation } : {}) });
export const ADVANCED_EXPLORATIONS = [
 lesson('uniform-motion','motion','两辆小车比快慢',all,'比较速度、时间与路程。','同时出发，怎样比较谁更快？',[c('speed1','甲车速度',0,10,.5,2,'m/s'),c('speed2','乙车速度',0,10,.5,3,'m/s')],['播放，观察同一时刻两车的位置。','固定时间，比较速度与路程。','用路程除以共同时间，核对两车的速度。'],'同地同时出发，向右匀速；忽略车长。按当前速度的 10 s 路程固定图形尺度，超出画面后读数继续计算。','s = vt','比较长短与时间',{duration:10,rate:1}),
 lesson('accelerated-motion','motion','恒定加速度与反向运动',high,'把位移和速度图联系起来。','初速度与加速度反向时，是否一直减速？',[c('velocity','初速度',-10,10,.5,6,'m/s'),c('acceleration','恒定加速度',-5,5,.5,-2,'m/s²')],['观察速度正负与运动方向。','找出速度过零的时刻。','核对 x–t 曲线斜率与 v–t 图；反向后继续加速。'],'恒定加速度持续作用，不是刹车停止模型；从 x=0 出发。两图独立缩放。','x = v₀t + at²/2；v = v₀ + at','有符号速度、加速度',{duration:10,rate:1}),
 lesson('projectile','motion','平抛与斜抛',high,'分解水平和竖直运动。','初速度相同，角度怎样影响落地点？',[c('speed','初速度',0,30,1,12,'m/s'),c('angle','仰角',0,80,1,30,'°'),c('height','初始高度',0,20,.5,2,'m')],['设角度为零，观察平抛。','保持初速度比较角度。','分别用水平匀速和竖直匀加速预测轨迹。'],'忽略空气阻力，水平地面；首次触地停止，落地前速度读数保留。轨迹横纵同尺度。','x = v₀ cosθ·t；y = h + v₀ sinθ·t − gt²/2','运动分解与重力',{duration:p=>flightTime(p),rate:1}),
 lesson('circular-motion','motion','圆周运动的速度与合力',high,'区分切向速度与向心合力。','速度大小不变，为什么仍有加速度？',[c('mass','质量',.1,5,.1,1,'kg'),c('radius','半径',.2,5,.1,2,'m'),c('speed','速率',0,10,.5,3,'m/s')],['沿圆周观察速度箭头。','比较合力方向与速度方向。','验证 F=mv²/r 并解释合力不做功。'],'理想匀速圆周运动；显示所需合力，不指定具体力源。箭头归一化只表示方向，零值不画。','F = mv²/r；T = 2πr/v','矢量与向心加速度',{duration:12,rate:1}),
 lesson('pendulum','wave','小角度单摆',all,'观察摆长和周期的关系。','轻轻摆动时，摆长增大会怎样？',[c('length','摆长',.2,3,.1,1,'m'),c('angle','初始摆角',0,10,1,5,'°')],['播放，比较长摆和短摆的快慢。','固定摆长，只改变小摆角。','用小角度近似预测周期；不推广到大摆角。'],'小角度线性近似，摆角不超过 10°；质点、无质量摆线、无阻尼。不是大振幅精确解。','T ≈ 2π√(L/g)；θ = θ₀ cos(√(g/L)t)','重复运动；定量需周期',{duration:12,rate:1}),
 lesson('spring-energy','wave','弹簧振子的能量交换',high,'观察动能与弹性势能交替。','经过平衡位置时，能量在哪里？',[c('mass','质量',.1,3,.1,1,'kg'),c('stiffness','劲度系数',5,100,5,20,'N/m'),c('amplitude','振幅',0,.5,.01,.2,'m')],['观察位移与速度方向。','比较端点和平衡位置的能量。','验证任意时刻动能加势能为常量。'],'水平无摩擦理想弹簧，弹簧无质量，无外力做功；位移和能量条分别缩放。','x = A cos(ωt)；ω = √(k/m)；E = kA²/2','胡克定律与能量',{duration:10,rate:1}),
 lesson('pressure-solid','pressure','受力面积与压强',all,'比较同样压力下的接触面积。','同样的力，面积越小会怎样？',[c('force','垂直压力',0,1000,10,200,'N'),c('area','接触面积',1,200,1,50,'cm²')],['改变面积，比较读数。','保持压力不变，面积减半。','解释压力和压强的区别。'],'均匀垂直接触压力；不预测材料形变或压痕深度。面积由 cm² 转为 m²，图形示意。','p = F/A','力与面积'),
 lesson('hydrostatic','pressure','液体深度与压强',mh,'区分液体表压与绝对压强。','水面处表压为零，绝对压强也是零吗？',[c('density','液体密度',600,1400,50,1000,'kg/m³'),c('depth','水下深度',0,10,.1,2,'m'),c('atmosphere','液面气压',80,110,.001,101.325,'kPa')],['移动深度，观察表压。','比较密度不同的液体。','绝对压强等于液面气压加表压。'],'静止均匀不可压缩液体，液面受给定气压；忽略毛细效应。深度图自动缩放。','p表 = ρgh；p绝 = p液面 + ρgh','密度与压强'),
 lesson('hydraulic','pressure','液压机：省力不省功',mh,'比较活塞面积、力与位移。','大活塞的力增大时，移动距离怎样变化？',[c('force','小活塞输入力',0,200,5,50,'N'),c('area1','输入活塞面积',1,20,1,5,'cm²'),c('area2','输出活塞面积',20,200,5,100,'cm²'),c('distance','输入位移',0,20,1,10,'cm')],['改变输出面积，比较输出力。','核对两活塞排开液体体积。','比较输入功和输出功。'],'外部装置在 10 s 内匀速给定输入行程，不由输入力求加速度；理想不可压缩液体，忽略重力压差、摩擦与泄漏。圆活塞直径按面积平方根缩放，两侧位移同尺度。','F₁/A₁ = F₂/A₂；A₁s₁ = A₂s₂；W₁ = W₂','压强与功',{duration:10,rate:1}),
 lesson('work-power','energy','提升物体的功与功率',mh,'区分做功、功率和效率。','提升同一物体，时间更短会更省能量吗？',[c('mass','质量',1,100,1,10,'kg'),c('height','提升高度',0,20,.5,3,'m'),c('duration','提升用时',1,60,1,10,'s'),c('efficiency','效率',10,100,5,80,'%')],['比较不同高度的有用功。','保持高度与质量，只改变时间。','计算输入能量并区分有用功率和输入功率。'],'按给定高度和用时匀速竖直提升，忽略启动和停止过程；效率为给定常量，损耗只作能量核算。图示高度固定尺度，不模拟动力装置。','W有用 = mgh；P = W/t；E输入 = W有用/η','功、时间与效率',{duration:p=>p.duration,rate:1}),
 lesson('electric-power','electric','电阻的功率与电能',mh,'比较电压、电阻和耗电量。','同一电阻电压翻倍，功率怎样变化？',[c('voltage','电压',0,24,.5,12,'V'),c('resistance','电阻',1,100,1,20,'Ω'),c('duration','通电时间',0,600,10,60,'s')],['比较功率与累计电能。','控制电阻不变，电压加倍。','用 E=Pt 核对能量；不是灯泡亮度或温升模型。'],'恒定纯电阻与理想直流电源；不计电阻随温度变化，不模拟烧毁。电路示意。','I = U/R；P = U²/R；E = Pt','欧姆定律与电能'),
 lesson('capacitor','field','接着电源的平行板电容器',high,'比较板距对电容、电荷与场强的影响。','电压固定，拉开极板时电荷不变吗？',[c('voltage','恒定电源电压',0,100,5,50,'V'),c('area','极板面积',10,200,10,100,'cm²'),c('gap','极板间距',1,10,.5,2,'mm')],['保持电压，只改变板距。','区分电容 C、电荷 Q 与场强 E。','比较储能变化；接着电源时存在电荷与能量交换。'],'真空理想平行板，忽略边缘效应，始终连接恒压直流源；不是孤立电容器，不模拟充电瞬态或击穿。cm²→m²，mm→m。图形示意。','C = ε₀A/d；Q = CU；E = U/d；W = CU²/2','电势差与电场'),
 lesson('electromagnet','magnetic','长螺线管的磁场',all,'观察电流反向和匝数变化。','电流反向时，管内磁场怎样变？',[c('current','有符号电流',-5,5,.5,2,'A'),c('turns','匝数',100,1000,50,500),c('length','线圈长度',.5,2,.1,1,'m')],['把电流变为零，再反向。','固定长度与电流，比较匝数。','用 B=μ₀NI/L 估算管内中部磁场。'],'理想长空气芯螺线管的中部近似，线圈半径远小于长度；无铁芯、不计算吸力或饱和。箭头归一化，绕组图示意，正电流对应向右磁场。','B有符号 = μ₀NI/L','电流产生磁场'),
 lesson('transformer','magnetic','理想交流变压器',high,'比较匝数比、电压比和负载电流。','升高次级电压时，输入输出功率怎样比较？',[c('voltage','初级交流电压（有效值）',0,240,5,120,'V'),c('turns1','初级匝数',100,1000,50,500),c('turns2','次级匝数',100,1000,50,250),c('resistance','次级负载电阻',10,1000,10,100,'Ω')],['改变次级匝数，比较有效值电压。','固定电压比，改变负载。','核对输入与输出功率及电流反比关系。'],'理想交流变压器，正弦稳态有效值、纯电阻负载；忽略铁损、铜损、漏磁和励磁电流。不适用于稳恒直流。图形示意。','U₂/U₁ = N₂/N₁；I₂ = U₂/R；I₁ = I₂N₂/N₁；P₁ = P₂','交流有效值与电磁感应')
];
const byId = new Map(ADVANCED_EXPLORATIONS.map(e => [e.id,e]));
function parameters(id, p) { return Object.fromEntries(byId.get(id).controls.map(c => [c.key, p?.[c.key] ?? c.value])); }
function flightTime(p) { const vy = p.speed*Math.sin(p.angle*Math.PI/180); return (vy + Math.sqrt(vy*vy+2*G*p.height))/G; }
export function simulateAdvanced(id, input, time=0) {
 if (!byId.has(id)) return null;
 const p=parameters(id,input), t=Math.max(0,time);
 switch(id) {
 case 'uniform-motion': return {elapsed:t,position1:p.speed1*t,position2:p.speed2*t};
 case 'accelerated-motion': return {elapsed:t,position:p.velocity*t+.5*p.acceleration*t*t,velocity:p.velocity+p.acceleration*t,acceleration:p.acceleration};
 case 'projectile': { const flight=flightTime(p), elapsed=Math.min(t,flight), a=p.angle*Math.PI/180, vx=p.speed*Math.cos(a), vy0=p.speed*Math.sin(a); return {elapsed,flightTime:flight,x:vx*elapsed,y:Math.max(0,p.height+vy0*elapsed-.5*G*elapsed*elapsed),vx,vy:vy0-G*elapsed,range:vx*flight,peak:p.height+vy0*vy0/(2*G),stopped:t>=flight}; }
 case 'circular-motion': {const omega=p.speed/p.radius, phase=omega*t;return {x:p.radius*Math.cos(phase),y:p.radius*Math.sin(phase),vx:-p.speed*Math.sin(phase),vy:p.speed*Math.cos(phase),fx:-p.mass*p.speed*omega*Math.cos(phase),fy:-p.mass*p.speed*omega*Math.sin(phase),force:p.mass*p.speed*omega,omega,period:p.speed===0?null:2*Math.PI/omega};}
 case 'pendulum': {const omega=Math.sqrt(G/p.length),angle=p.angle*Math.PI/180*Math.cos(omega*t);return {angle,angularVelocity:-p.angle*Math.PI/180*omega*Math.sin(omega*t),period:2*Math.PI/omega,x:p.length*Math.sin(angle),y:-p.length*Math.cos(angle)};}
 case 'spring-energy': {const omega=Math.sqrt(p.stiffness/p.mass),position=p.amplitude*Math.cos(omega*t),velocity=-p.amplitude*omega*Math.sin(omega*t);return {omega,period:2*Math.PI/omega,position,velocity,kinetic:.5*p.mass*velocity**2,potential:.5*p.stiffness*position**2,total:.5*p.stiffness*p.amplitude**2};}
 case 'pressure-solid': {const area=p.area*1e-4;return {area,pressure:p.force/area};}
 case 'hydrostatic': {const gauge=p.density*G*p.depth,atmosphere=p.atmosphere*1000;return {gauge,atmosphere,absolute:gauge+atmosphere};}
 case 'hydraulic': {
  const area1=p.area1*1e-4,area2=p.area2*1e-4,distance1=p.distance*.01,pressure=p.force/area1,force2=pressure*area2,distance2=distance1*area1/area2;
  // The external actuator prescribes this stroke; force does not determine its speed.
  const duration=10,elapsed=Math.min(t,duration),progress=elapsed/duration,currentDistance1=distance1*progress,currentDistance2=distance2*progress;
  return {area1,area2,distance1,distance2,pressure,force2,inputWork:p.force*distance1,outputWork:force2*distance2,duration,elapsed,progress,currentDistance1,currentDistance2,displacedVolume:area1*currentDistance1,currentInputWork:p.force*currentDistance1,currentOutputWork:force2*currentDistance2,stopped:t>=duration};
 }
 case 'work-power': {
  const useful=p.mass*G*p.height,input=useful/(p.efficiency/100),elapsed=Math.min(t,p.duration),progress=elapsed/p.duration,currentHeight=p.height*progress,currentUseful=p.mass*G*currentHeight,currentInput=currentUseful/(p.efficiency/100);
  return {useful,input,loss:input-useful,usefulPower:useful/p.duration,inputPower:input/p.duration,elapsed,progress,currentHeight,currentUseful,currentInput,currentLoss:currentInput-currentUseful,speed:p.height/p.duration,stopped:t>=p.duration};
 }
 case 'electric-power': {const current=p.voltage/p.resistance,power=p.voltage*current;return {current,power,energy:power*p.duration};}
 case 'capacitor': {const area=p.area*1e-4,gap=p.gap*.001,capacitance=EPS0*area/gap;return {area,gap,capacitance,charge:capacitance*p.voltage,field:p.voltage/gap,energy:.5*capacitance*p.voltage**2};}
 case 'electromagnet': return {field:MU0*p.turns*p.current/p.length,magnitude:MU0*p.turns*Math.abs(p.current)/p.length};
 case 'transformer': {const ratio=p.turns2/p.turns1,voltage2=p.voltage*ratio,current2=voltage2/p.resistance,current1=current2*ratio;return {ratio,voltage2,current2,current1,inputPower:p.voltage*current1,outputPower:voltage2*current2};}
 }
}
const cart=(x,y,label)=>rect(x-25,y-20,50,30)+circle(x-15,y+13,7)+circle(x+15,y+13,7)+text(x,y-30,label);
const energyBar=(x,y,value,total,label)=>rect(x,y,Math.max(0,total?value/total*260:0),24,'#d9c48d')+text(x+130,y-8,label+' '+fmt(value)+' J');
function graph(fn,x,y,width,height,label,span,currentTime,markerKey) {
 const values=Array.from({length:101},(_,i)=>fn(span*i/100)),lo=Math.min(0,...values),hi=Math.max(0,...values),extent=hi-lo||1;
 const marker=currentTime<=span?`<g data-time-marker="${markerKey}">${circle(x+currentTime/span*width,y-(fn(currentTime)-lo)/extent*height,7,'#d9bd79')}${line(x+currentTime/span*width,y,x+currentTime/span*width,y-height,'#b28b47',1,'4 4')}</g>`:'';
 return line(x,y,x+width,y)+line(x,y,x,y-height)+line(x,y+lo/extent*height,x+width,y+lo/extent*height,'var(--line-strong)',1,'4 4')+text(x-15,y+lo/extent*height,0)+text(x+width/2,y+23,`t: 0–${fmt(span,1)} s`)+text(x+width/2,y-height-15,`${label} [${fmt(lo,1)}, ${fmt(hi,1)}]`)+plot(u=>(fn(u*span)-lo)/extent,{x,y,width,scale:height})+marker;
}
export function viewAdvanced(id,input,time=0) {
 const m=simulateAdvanced(id,input,time); if (!m) return null;
 const p=parameters(id,input); let svg='', metrics=[],notice='';
 switch(id) {
 case 'uniform-motion': {const extent=Math.max(1,p.speed1*10,p.speed2*10),scale=600/extent;svg=line(80,170,720,170)+line(80,310,720,310)+(m.position1<=extent?cart(80+m.position1*scale,150,'甲'):text(400,140,'甲车已超出画面'))+(m.position2<=extent?cart(80+m.position2*scale,290,'乙'):text(400,280,'乙车已超出画面'))+text(400,380,`固定 10 s 运动范围：600 px = ${fmt(extent)} m；起点 x=0`);metrics=[metric('甲车路程',m.position1,'m'),metric('乙车路程',m.position2,'m'),metric('时间',m.elapsed,'s')];if(m.position1>extent||m.position2>extent)notice='小车超出固定画面范围；读数继续显示理论运动，不改变比例尺。';break;}
 case 'accelerated-motion': {const span=10;svg=graph(s=>p.velocity*s+.5*p.acceleration*s*s,65,345,300,210,'位移 x / m',span,m.elapsed,'position')+graph(s=>p.velocity+p.acceleration*s,435,345,300,210,'速度 v / (m/s)',span,m.elapsed,'velocity')+text(400,410,'两图纵轴独立缩放；金点为当前时刻，速度过零后继续反向运动');metrics=[metric('位移',m.position,'m'),metric('速度',m.velocity,'m/s'),metric('恒定加速度',m.acceleration,'m/s²')];notice='正方向向右；加速度恒定，不模拟刹车后停止。'+(m.elapsed>span?'当前时刻超出固定 0–10 s 图域；读数继续计算。':'');break;}
 case 'projectile': {const scale=Math.min(600/Math.max(1,m.range),270/Math.max(1,m.peak)),base=355;svg=line(80,base,730,base)+plot(u=>{const s=u*m.flightTime;return p.height+p.speed*Math.sin(p.angle*Math.PI/180)*s-.5*G*s*s;},{x:80,y:base,width:m.range*scale,scale})+circle(80+m.x*scale,base-m.y*scale,10,'#d9bd79')+text(400,410,`横纵同尺度：1 m = ${fmt(scale)} px；地面 y=0`);metrics=[metric('水平位置',m.x,'m'),metric('高度',m.y,'m'),metric('竖直速度（向上为正）',m.vy,'m/s'),metric('首次触地时间',m.flightTime,'s')];notice=m.stopped?'已首次触地；显示触地前速度，不模拟碰撞。':'';break;}
 case 'circular-motion': {const s=130/p.radius,x=400+m.x*s,y=230-m.y*s;svg=circle(400,230,130,'none')+circle(x,y,11)+text(400,230,'圆心');if(p.speed)svg+=arrow(x,y,m.vx/p.speed*60,-m.vy/p.speed*60,'#408eb5')+arrow(x,y,m.fx/m.force*55,-m.fy/m.force*55,'#c68d54');svg+=text(400,415,'蓝：切向速度；棕：向心合力；箭头归一化，轨道半径 130 px');metrics=[metric('所需合力',m.force,'N'),metric('角速度',m.omega,'rad/s'),metric('周期',m.period,'s')];notice=p.speed===0?'速率为零，没有向心力和运动周期。':'';break;}
 case 'pendulum': {const scale=240/p.length,x=400+m.x*scale,y=85-m.y*scale;svg=line(400,85,x,y)+line(400,85,400,340,'var(--line-strong)',1,'5 5')+circle(400,85,5)+circle(x,y,17,'#d8bf84')+text(400,390,'摆长缩放至 240 px；摆角按真实角度显示（不超过 10°）');metrics=[metric('周期（小角近似）',m.period,'s'),metric('摆角',m.angle*180/Math.PI,'°')];break;}
 case 'spring-energy': {const x=400+(p.amplitude?m.position/p.amplitude*160:0);svg=line(80,180,x-30,180,'#85a18c',5)+rect(50,130,30,100)+cart(x,185,'振子')+line(400,125,400,230,'var(--line-strong)',1,'5 5')+energyBar(220,290,m.kinetic,m.total,'动能')+energyBar(220,350,m.potential,m.total,'弹性势能')+text(400,420,'位移自动缩放至 ±160 px；能量条共同满量程为总能量');metrics=[metric('位移',m.position,'m'),metric('速度',m.velocity,'m/s'),metric('总机械能',m.total,'J')];break;}
 case 'pressure-solid': {const w=50+Math.sqrt(p.area/200)*260;svg=rect(400-w/2,230,w,60)+line(100,295,700,295)+arrow(400,120,0,p.force?95:0)+text(400,345,`面积 ${fmt(p.area,0)} cm²；压力 ${fmt(p.force,0)} N`)+text(400,400,'接触块与力箭头仅作示意，不表示形变');metrics=[metric('压强',m.pressure/1000,'kPa'),metric('SI 接触面积',fmt(m.area,4),'m²')];break;}
 case 'hydrostatic': {const y=125+p.depth/10*220;svg=rect(210,125,380,240,'#dcecf0')+line(200,125,600,125)+circle(400,y,10,'#dfbf75')+arrow(630,125,0,y-125)+text(400,90,'液面表压 0；绝对压强等于液面气压')+text(400,410,'深度共同尺度：220 px = 10 m；金点为探针');metrics=[metric('液体表压',m.gauge/1000,'kPa'),metric('液面气压',m.atmosphere/1000,'kPa'),metric('绝对压强',m.absolute/1000,'kPa')];break;}
 case 'hydraulic': {
  const x1=215,x2=550,w1=14*Math.sqrt(p.area1),w2=14*Math.sqrt(p.area2),scale=1200,y1=120+m.currentDistance1*scale,y2=315-m.currentDistance2*scale;
  // Width represents circular-piston diameter, not area of a 2D fluid section.
  svg=rect(x1-w1/2,90,w1,295,'var(--surface)')+rect(x2-w2/2,55,w2,330,'var(--surface)')
   +rect(x1-w1/2,y1,w1,385-y1,'color-mix(in srgb,var(--diagram-cool) 25%,var(--surface))')+rect(x2-w2/2,y2,w2,385-y2,'color-mix(in srgb,var(--diagram-cool) 25%,var(--surface))')
   +rect(x1,365,x2-x1,20,'color-mix(in srgb,var(--diagram-cool) 25%,var(--surface))')+line(120,390,690,390,'var(--diagram-stroke)',4)
   +line(x1-w1/2-24,120,x1+w1/2+24,120,'var(--diagram-stroke)',1,'5 5')+line(x2-w2/2-24,315,x2+w2/2+24,315,'var(--diagram-stroke)',1,'5 5')
   +text(100,125,'初始')+text(710,320,'初始')
   +`<g data-hydraulic-piston="input">${line(x1-w1/2,y1,x1+w1/2,y1,'var(--orange)',8)+line(x1,y1-35,x1,y1,'var(--diagram-stroke)',6)+line(x1-22,y1-35,x1+22,y1-35,'var(--diagram-stroke)',5)}</g>`
   +`<g data-hydraulic-piston="output">${line(x2-w2/2,y2,x2+w2/2,y2,'var(--orange)',8)+line(x2,y2-35,x2,y2,'var(--diagram-stroke)',6)+line(x2-25,y2-35,x2+25,y2-35,'var(--diagram-stroke)',5)}</g>`
   +arrow(x1-55,y1-35,0,p.force?30:0)+arrow(x2+w2/2+30,y2+25,0,p.force?-40:0)
   +text(x1,25,`输入面积 ${fmt(p.area1,0)} cm²`)+text(x2,25,`输出面积 ${fmt(p.area2,0)} cm²`)
   +text(x1,412,`下移 ${fmt(m.currentDistance1*100)} cm`)+text(x2,412,`上移 ${fmt(m.currentDistance2*100)} cm`)
   +text(400,442,'位移同尺度：1 cm = 12 px；缸径 ∝ √面积');
  metrics=[metric('当前排液体积 = 增液体积',m.displacedVolume*1e6,'cm³'),metric('当前输入功',m.currentInputWork,'J'),metric('当前输出功',m.currentOutputWork,'J'),metric('输出力',m.force2,'N'),metric('全程输入功',m.inputWork,'J'),metric('全程输出功',m.outputWork,'J')];
  notice=`外部给定 10 s 匀速行程，当前 ${fmt(m.elapsed)} s；不模拟加速度，忽略液柱高度差。`;break;
 }
 case 'work-power': {
  const base=365,scale=12,y=base-m.currentHeight*scale,top=y-40,target=base-p.height*scale;
  svg=line(190,50,455,50,'var(--diagram-stroke)',5)+line(200,50,200,base,'var(--diagram-stroke)',5)+line(170,base,465,base,'var(--diagram-stroke)',4)
   +circle(385,65,15)+`<g data-lift-rope="current">${line(385,80,385,top,'var(--diagram-stroke)',3)}</g>`
   +line(250,target,465,target,'var(--diagram-stroke)',1,'5 5')+text(110,target+6,`目标 ${fmt(p.height)} m`)
   +`<g data-lift-weight="current">${rect(330,top,110,40,'color-mix(in srgb,var(--diagram-warm) 25%,var(--surface))')+text(385,top+27,`${fmt(p.mass,0)} kg`)}</g>`
   +arrow(280,base,0,-m.currentHeight*scale)+text(540,235,`已提升 ${fmt(m.currentHeight)} m`)+text(540,273,`${fmt(m.elapsed)} / ${fmt(p.duration)} s`)
   +text(540,311,`匀速 ${fmt(m.speed)} m/s`)+text(400,410,'虚线：目标高度；地面：起点 0 m')+text(400,441,'高度固定尺度：1 m = 12 px；不模拟启停');
  metrics=[metric('当前高度',m.currentHeight,'m'),metric('累计有用功',m.currentUseful,'J'),metric('累计输入能量',m.currentInput,'J'),metric('全程有用功',m.useful,'J'),metric('全程输入能量',m.input,'J'),metric('有用功率（提升期间）',m.usefulPower,'W'),metric('输入功率（提升期间）',m.inputPower,'W')];
  notice=m.stopped?'已完成提升；累计能量停止增加，功率读数为提升期间的恒定功率。':'按给定高度和用时匀速提升；效率只用于输入能量及损耗核算。';break;
 }
 case 'electric-power': svg=line(200,160,600,160)+line(600,160,600,330)+line(600,330,200,330)+line(200,330,200,160)+rect(350,140,100,40,'#dec99b')+text(400,220,`R = ${fmt(p.resistance)} Ω`)+text(200,255,`${fmt(p.voltage)} V`)+text(400,410,'纯电阻电路示意；时间为设定通电时长');metrics=[metric('电流',m.current,'A'),metric('电功率',m.power,'W'),metric('电能',m.energy,'J')];break;
 case 'capacitor': {const gap=45+p.gap*9;svg=line(400-gap/2,120,400-gap/2,330,'#ae8059',9)+line(400+gap/2,120,400+gap/2,330,'#5f91ac',9);if(p.voltage)for(const y of [160,225,290])svg+=arrow(400-gap/2+9,y,gap-18,0);svg+=text(400,85,'始终接恒压直流电源：左正右负')+text(400,390,'极板间距与箭头仅示意；场线指向负极板');metrics=[metric('电容',m.capacitance*1e12,'pF'),metric('极板电荷量',m.charge*1e9,'nC'),metric('场强',m.field,'V/m'),metric('储能',m.energy*1e6,'μJ')];break;}
 case 'electromagnet': svg=rect(170,170,460,130);for(let i=0;i<18;i++)svg+=line(180+i*25,175,195+i*25,295,'#b88b5f',4);if(m.field)svg+=arrow(400-Math.sign(m.field)*90,235,Math.sign(m.field)*180,0);svg+=text(400,125,m.field>0?'左端 S · 右端 N':m.field<0?'左端 N · 右端 S':'电流为零，模型磁场为零')+text(400,380,'空气芯长螺线管中部；绕组数量示意，箭头归一化')+text(400,415,'正电流对应管内向右磁场；不显示吸力或铁芯效果');metrics=[metric('有符号磁感应强度（右为正）',m.field*1000,'mT'),metric('磁感应强度大小',m.magnitude*1000,'mT')];break;
 case 'transformer': svg=rect(280,130,240,210)+rect(330,175,140,120,'var(--surface)');for(let i=0;i<8;i++)svg+=line(260,155+i*20,330,165+i*20,'#b98f60',5)+line(470,155+i*20,540,165+i*20,'#709dae',5);svg+=text(170,235,`交流 ${fmt(p.voltage)} V`)+text(650,235,`负载 ${fmt(p.resistance,0)} Ω`)+text(400,385,'电压、电流均为正弦交流有效值；绕组与磁芯图示意')+text(400,420,'只适用于交流稳态；稳恒直流不能按匝数比变压');metrics=[metric('次级电压（有效值）',m.voltage2,'V'),metric('次级电流（有效值）',m.current2,'A'),metric('初级电流（有效值）',m.current1,'A'),metric('输出功率 = 输入功率',m.outputPower,'W')];break;
 }
 return {svg,metrics,notice,model:m};
}
