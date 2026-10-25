// Portable curriculum catalogue and deterministic SI-unit models. No DOM or host APIs.
import { FOUNDATION_EXPLORATIONS, simulateFoundation } from './foundation-experiments.mjs';
import { ADVANCED_EXPLORATIONS, simulateAdvanced } from './advanced-experiments.mjs';
import { COMPLETION_FOUNDATIONS, simulateCompletionFoundation } from './foundation-completion.mjs';
import { COMPLETION_MECHANICS, simulateCompletionMechanics } from './mechanics-completion.mjs';
import { ELECTRICAL_EXPERIMENTS, simulateElectrical } from './electrical-experiments.mjs';
import { BUOYANCY_EXPERIMENTS, simulateBuoyancy } from './buoyancy-experiments.mjs';
import { LEVER_EXPERIMENTS, simulateLever } from './lever-experiment.mjs';
export const LEVEL_NAMES=['入门探索','规律探究','综合挑战'];
export const TOPICS=[
 {id:'measurement',name:'测量与读数',description:'天平、量筒、质量、体积与密度'},
 {id:'sound',name:'声音',description:'高低与强弱、回声与测距'},
 {id:'light',name:'光与成像',description:'影子、反射、折射与透镜成像'},
 {id:'heat',name:'冷热与物态',description:'热交换、传热、物态变化与气体'},
 {id:'magnetic',name:'磁与电磁感应',description:'磁铁、电磁铁、磁场力与交流变压'},
 {id:'electric',name:'电路与电功率',description:'动手接线，比较电流、功率与电能'},
 {id:'motion',name:'力与运动',description:'速度、加速度、抛体与圆周运动'},
 {id:'pressure',name:'压强与浮力',description:'压力、液体压强、液压与浮沉'},
 {id:'energy',name:'能量与动量',description:'功与功率、机械能转化与碰撞'},
 {id:'field',name:'电场与电容',description:'点电荷叠加、电容与电场储能'},
 {id:'wave',name:'振动与波',description:'单摆、弹簧振动、行波与干涉'}
];
const control=(key,label,min,max,step,value,unit='')=>({key,label,min,max,step,value,unit});
const lesson=(id,topic,title,band,goal,question,controls,guides,limit,formula,prerequisite)=>({id,topic,title,band,goal,question,controls,guides,limit,formula,prerequisite});
const ORIGINAL_EXPLORATIONS=[
 {id:'circuit',topic:'electric',title:'自由搭电路',band:'小学科学起步 · 可深入初高中',goal:'亲手接线，探索灯泡、开关、电流与功率。',workbench:'circuit',prerequisite:'认识电池与灯泡'},
 lesson('field','electric','看见电场', '高中物理', '改变两个点电荷，观察电场方向与电势。','电势为零的地方，电场也一定为零吗？',[
  control('q1','左电荷',-5,5,1,2,'μC'),control('q2','右电荷',-5,5,1,-2,'μC'),control('d','电荷间距',1,4,.1,2,'m'),control('x','探针横坐标',-3,3,.1,0,'m'),control('y','探针纵坐标',-2,2,.1,1,'m')],
  ['移动探针，观察箭头；箭头表示正试探电荷受力方向。','比较等量同号、异号电荷中点处的电势和场强。','分别计算两电荷的场强矢量与电势，核对叠加结果。'],
  '理想点电荷，探针不改变电场；距电荷 0.15 m 内不显示读数。箭头长度归一化，不表示场强大小。','E = Σkqr/r³；V = Σkq/r','矢量叠加与库仑定律'),
 {id:'optics',topic:'light',title:'光线与透镜工作台',band:'小学科学观察 · 初中探究',goal:'移动光源、转动镜子，比较凸透镜与凹透镜。',workbench:'optics',prerequisite:'知道光沿直线传播'},
 lesson('refraction','light','折射与全反射','初中观察 · 高中定量','改变入射角和介质，观察光的去向。','光从水进入空气时，总能穿过界面吗？',[
  control('angle','入射角',0,80,1,40,'°'),control('n1','上方介质折射率',1,1.6,.01,1.33),control('n2','下方介质折射率',1,1.6,.01,1)],
  ['拖动入射角，比较入射光、反射光和折射光。','固定两种介质，逐渐增大入射角，寻找全反射出现的条件。','用斯涅尔定律计算折射角，并求临界角。'],
  '单色几何光学；不模拟色散或菲涅耳强度，线条颜色只区分光路。角度均相对法线。','n₁ sin θ₁ = n₂ sin θ₂','法线与角度'),
 lesson('sound','sound','声音的高低与强弱','小学科学 · 初中物理','分别改变频率与振幅，分清音调和响度。','让声音变高，是要提高频率还是振幅？',[
  control('frequency','频率',100,1000,25,300,'Hz'),control('amplitude','相对振幅',0,1,.05,.4),control('temperature','空气温度',0,40,1,20,'℃')],
  ['先只改频率，再只改振幅；可按「试听」比较。','保持空气温度不变，频率翻倍时波长怎样变化？','改变温度，用 v=fλ 核对声速、频率与波长的关系。'],
  '正弦纯音与静止干燥空气近似；振幅为相对值，不是声压级。画面慢放，试听音量受设备影响。','v ≈ 331.3 + 0.606T；λ = v/f','振动快慢；定量探究需认识频率'),
 lesson('wave','sound','振动怎样传出去','初中观察 · 高中物理','区分介质振动与波的传播。','一个标记点会跟着波一直向前走吗？',[
  control('frequency','频率',.2,3,.1,1,'Hz'),control('amplitude','振幅',.05,.8,.05,.3,'m'),control('speed','传播速度',1,6,.2,2,'m/s')],
  ['播放后盯住金色标记点，看它向哪里运动。','分别改变频率与波速，比较波长。','用波动表达式预测同一时刻不同位置的位移和相位。'],
  '无衰减的一维横向行波；示意绳上的点上下振动，不代表声波是横波。','y = A sin[2πf(t−x/v)]','振幅、周期、频率'),
 lesson('heating','heat','同样加热，谁升温快','小学科学观察 · 初中定量','比较质量、材料与吸收热量对温度的影响。','同样功率加热，水和铝的升温速度一样吗？',[
  control('mass','质量',.1,2,.1,.5,'kg'),control('power','加热功率',50,500,25,200,'W'),control('capacity','比热容',900,4200,100,4200,'J/(kg·℃)'),control('initial','初温',10,40,1,20,'℃')],
  ['播放加热过程，看温度如何改变；重置后比较不同质量。','选 4200 近似水、900 近似铝，相同质量和时间下比较温升。','用 Q=Pt、ΔT=Q/(mc) 预测温度，记录并核对。'],
  '忽略散热和容器吸热；到 80℃ 自动停止加热，不模拟熔化、沸腾等相变。比热容视为常量。','Q = Pt；ΔT = Q/(mc)','温度；定量探究需认识热量'),
 lesson('mixing','heat','冷热接触后会怎样','小学科学 · 初中物理','观察热从高温处传向低温处，趋近共同温度。','两杯水最后的温度一定是初温的平均值吗？',[
  control('hot','热水初温',40,80,1,70,'℃'),control('cold','冷水初温',5,35,1,20,'℃'),control('m1','热水质量',.1,2,.1,1,'kg'),control('m2','冷水质量',.1,2,.1,1,'kg')],
  ['播放热交换，观察两份温度读数怎样变化。','只改变一杯水的质量，比较最终平衡温度。','用热量守恒算平衡温度，并验证热水放热等于冷水吸热。'],
  '两份水通过理想导热壁交换热量，无环境散热。过程用简化集总模型，时间尺度只用于观察趋势。','T平衡 = (m₁T₁+m₂T₂)/(m₁+m₂)','冷热与温度'),
 lesson('magnets','magnetic','磁铁与指南针','小学科学 · 初中物理','翻转磁极、移动指南针，观察方向与相互作用。','同名磁极靠近时，是吸引还是排斥？',[
  control('polarity','右侧磁铁方向',-1,1,2,1),control('distance','两磁铁中心间距',1.5,4,.1,2.5,'示意单位'),control('x','指南针横位置',-3,3,.1,0),control('y','指南针纵位置',-2,2,.1,1)],
  ['翻转右侧磁铁，观察两磁铁之间的作用方向。','移动指南针，观察其 N 极指向是否处处一样。','比较磁场叠加；说明箭头方向与作用力方向不是同一概念。'],
  '外部磁场采用点磁偶极子近似；靠近磁铁中心的区域不作定量解释，磁场强度为相对量。','指南针 N 极沿所在位置的磁场方向','认识磁铁的 N、S 极'),
 lesson('wire-field','magnetic','通电导线与指南针','初中物理 · 高中定量','发现电流会产生磁场，比较电流方向和距离的影响。','电流反向后，指南针会怎样转？',[
  control('current','电流（纸外为正）',-5,5,.5,2,'A'),control('x','指南针横位置',-3,3,.1,1,'cm'),control('y','指南针纵位置',-2,2,.1,1,'cm')],
  ['改变电流方向，观察指南针 N 极的方向；把电流调到 0 再比较。','保持电流不变，改变指南针到导线的距离，观察场强变化。','用右手定则判断方向，用 B=μ₀I/(2πr) 核对场强与电流和距离的关系。'],
  '无限长直导线，垂直于画面；忽略地磁场。距导线 0.2 cm 内不显示读数；箭头归一化，只表示方向。','B = μ₀|I|/(2πr)；右手定则判断方向','简单电路与指南针'),
 lesson('magnetic-force','magnetic','带电粒子在磁场中','高中物理','观察磁场力改变速度方向而不做功。','电荷符号或磁场方向反过来，轨迹会怎样？',[
  control('charge','电荷量',-2,2,.5,1,'mC'),control('mass','质量',.5,2,.1,1,'g'),control('speed','初速度',1,5,.2,2,'m/s'),control('field','垂直纸面磁场',-2,2,.2,1,'T')],
  ['播放运动，翻转电荷或磁场方向，观察弯曲方向。','固定其余条件，分别改变速度、质量和磁场，比较半径。','用 qvB=mv²/r 求半径与周期，说明动能为何不变。'],
  '速度垂直于匀强磁场；忽略重力、辐射、碰撞。正 B 指向纸外；轨迹随半径缩放，箭头不按比例。','F = |q|vB；r = mv/|qB|','洛伦兹力与圆周运动'),
 lesson('induction','magnetic','导体运动产生电流','初中观察 · 高中定量','在闭合回路中移动导体棒，观察感应电动势和电流。','棒停止运动后，回路里还有感应电流吗？',[
  control('field','磁场（纸外为正）',-1,1,.1,.5,'T'),control('length','导体棒长度',.2,1,.1,.5,'m'),control('speed','棒向右速度',-.3,.3,.05,.1,'m/s'),control('resistance','回路电阻',1,20,1,5,'Ω')],
  ['播放棒的运动，再把速度调为 0，观察电流。','改变运动或磁场方向，比较电流方向；增加速度，比较大小。','以纸外为磁通正方向，核对 ε=−dΦ/dt 和 I=ε/R。'],
  '匀强磁场、理想导轨、忽略电感；棒到边界停止，读数归零。暂停保留的是该时刻的运动快照。','Φ = BLx；ε = −BLv；I = ε/R','闭合回路；深入需磁通量'),
 {id:'mechanics',topic:'motion',title:'弹簧与滑轮工作台',band:'小学观察 · 初高中建模',goal:'调整质量、弹簧劲度与阻尼，探索振动和两侧质量差。',workbench:'mechanics',prerequisite:'力与运动的基本经验'},
 lesson('force','motion','推力怎样改变运动','小学科学观察 · 初高中定量','控制质量与摩擦，研究推力和加速度。','相同推力作用在更重的小车上，变化一样吗？',[
  control('force','向右推力',0,20,.5,8,'N'),control('mass','小车质量',.5,5,.5,2,'kg'),control('friction','摩擦系数',0,.6,.05,.1)],
  ['播放小车运动，改变推力后重置比较。','固定推力，只改变质量，比较加速度。','画出受力图，分别讨论推力未克服摩擦和已经运动的情况。'],
  '水平面、由静止开始；静摩擦最大值与滑动摩擦系数取相同值。推力恒定向右，轨迹在画面边缘可超出视野。','F合 = F−f；a = F合/m；v = at','定量探究需质量、力与加速度'),
 ...LEVER_EXPERIMENTS,
 lesson('buoyancy','motion','物体为什么会浮起','小学科学观察 · 初中定量','改变排开液体的体积，比较浮力与重力。','物体浸入多少时，浮力恰好能平衡重力？',[
  control('mass','物体质量',.1,2,.1,.5,'kg'),control('volume','物体体积',.2,2,.1,1,'L'),control('density','液体密度',800,1200,50,1000,'kg/m³'),control('fraction','浸入比例',0,1,.05,.5)],
  ['慢慢增加浸入比例，比较浮力箭头怎样变化。','固定完全浸没，改变液体密度，比较浮力与重力。','用阿基米德原理算浮力；若能漂浮，求平衡时浸入比例。'],
  '均匀不可压缩液体；位置由外力保持。显示移除外力后的初始趋势，不模拟真实下沉过程或表面张力。','F浮 = ρ液gV排；G = mg','体积、质量；深入需密度'),
 lesson('energy','energy','下落中的能量转化','初中物理 · 高中物理','同时观察高度、速度与机械能。','同一高度释放，质量更大的物体会更快吗？',[
  control('height','释放高度',1,10,.5,5,'m'),control('mass','质量',.2,5,.2,1,'kg')],
  ['播放下落，观察高度降低时速度怎样变化。','比较不同质量在落地前的速度与动能。','用机械能守恒预测任意高度的速度，再与运动学结果核对。'],
  '由静止自由下落，无空气阻力；显示到首次接触地面前一刻，不模拟碰撞或反弹。','mgh + ½mv² = mgH','高度、速度；深入需能量'),
 lesson('collision','energy','碰撞与动量','高中物理','比较碰撞前后的动量和动能，区分两种守恒。','动量守恒时，动能一定也守恒吗？',[
  control('m1','左车质量',.5,4,.5,1,'kg'),control('m2','右车质量',.5,4,.5,1,'kg'),control('u1','左车初速度',-3,3,.5,2,'m/s'),control('u2','右车初速度',-3,3,.5,-1,'m/s'),control('restitution','恢复系数',0,1,.1,1)],
  ['播放碰撞，对比两车碰撞前后速度的方向。','分别取恢复系数 1 和 0，比较总动量与总动能。','用动量守恒和相对速度关系推导末速度；解释损失的动能去了哪里。'],
  '一维正碰、无外部冲量。左车需比右车速度大才能接近；动画分段慢放，不展示真实接触时间。','m₁u₁+m₂u₂=m₁v₁+m₂v₂','动量、动能与正负方向')
];
const stagesById={
 circuit:['primary','middle','high'],field:['high'],optics:['primary','middle','high'],refraction:['middle','high'],
 sound:['primary','middle','high'],wave:['middle','high'],heating:['primary','middle','high'],mixing:['primary','middle','high'],
 magnets:['primary','middle','high'],'wire-field':['middle','high'],'magnetic-force':['high'],induction:['middle','high'],
 mechanics:['primary','middle','high'],force:['primary','middle','high'],lever:['primary','middle'],buoyancy:['primary','middle','high'],energy:['middle','high'],collision:['high']
};
const movedTopics={field:'field',wave:'wave',buoyancy:'pressure'};
export const EXPLORATIONS=[
 ...ORIGINAL_EXPLORATIONS.map(e=>({...e,topic:movedTopics[e.id]||e.topic,stages:stagesById[e.id]})),
 ...FOUNDATION_EXPLORATIONS,...ADVANCED_EXPLORATIONS,
 ...COMPLETION_FOUNDATIONS,...COMPLETION_MECHANICS,...ELECTRICAL_EXPERIMENTS,...BUOYANCY_EXPERIMENTS
];
export const explorationById=id=>EXPLORATIONS.find(e=>e.id===id);
export function defaults(id){return Object.fromEntries((explorationById(id)?.controls||[]).map(c=>[c.key,c.value]));}
export function validParams(id,input){const e=explorationById(id);if(!e||e.workbench||!input||typeof input!=='object')return null;const result={};for(const c of e.controls){const n=input[c.key];if(typeof n!=='number'||!Number.isFinite(n)||n<c.min||n>c.max||Math.abs((n-c.min)/c.step-Math.round((n-c.min)/c.step))>1e-6||(c.options&&!c.options.some(option=>option.value===n)))return null;result[c.key]=n;}return result;}
export const GRAVITY=9.81;
export function electricField(p,x=p.x,y=p.y){let ex=0,ey=0,potential=0;for(const [cx,q] of [[-p.d/2,p.q1],[p.d/2,p.q2]]){const dx=x-cx,r=Math.hypot(dx,y);if(r<.15)return {valid:false};const kq=8.9875517923e9*q*1e-6;ex+=kq*dx/r**3;ey+=kq*y/r**3;potential+=kq/r;}return {valid:true,ex,ey,strength:Math.hypot(ex,ey),potential};}
export function magneticField(p,x=p.x,y=p.y){let bx=0,by=0;for(const [cx,m] of [[-p.distance/2,1],[p.distance/2,p.polarity]]){const dx=x-cx,r=Math.hypot(dx,y);if(r<.45)return {valid:false};bx+=m*(3*dx*dx/r**2-1)/r**3;by+=m*3*dx*y/r**5;}return {valid:true,bx,by,strength:Math.hypot(bx,by)};}
export function wireField(p,x=p.x,y=p.y){x/=100;y/=100;const r=Math.hypot(x,y);if(r<.002)return {valid:false};const factor=2e-7*p.current/(r*r),bx=-factor*y,by=factor*x;return {valid:true,bx,by,strength:Math.hypot(bx,by)};}
export function simulate(id,p,t=0){
 const g=GRAVITY;t=Math.max(0,Number.isFinite(t)?t:0);
 switch(id){
 case 'sound':{const speed=331.3+.606*p.temperature;return {speed,wavelength:speed/p.frequency,period:1/p.frequency};}
 case 'wave':return {wavelength:p.speed/p.frequency,period:1/p.frequency,probe:p.amplitude*Math.sin(2*Math.PI*p.frequency*(t-2/p.speed))};
 case 'heating':{const duration=(80-p.initial)*p.mass*p.capacity/p.power,elapsed=Math.min(t,duration),heat=p.power*elapsed;return {temperature:p.initial+heat/(p.mass*p.capacity),heat,elapsed,stopped:t>=duration};}
 case 'mixing':{const equilibrium=(p.hot*p.m1+p.cold*p.m2)/(p.m1+p.m2),delta=(p.hot-p.cold)*Math.exp(-t/12);return {equilibrium,hot:equilibrium+p.m2/(p.m1+p.m2)*delta,cold:equilibrium-p.m1/(p.m1+p.m2)*delta};}
 case 'field':return electricField(p);
 case 'magnets':return {...magneticField(p),attract:p.polarity===1};
 case 'wire-field':return wireField(p);
 case 'magnetic-force':{const q=p.charge/1000,m=p.mass/1000,omega=-q*p.field/m,straight=Math.abs(omega)<1e-9,radius=straight?null:p.speed/Math.abs(omega);return {omega,radius,period:straight?null:2*Math.PI/Math.abs(omega),force:Math.abs(q*p.speed*p.field),energy:.5*m*p.speed**2,x:straight?p.speed*t:p.speed*Math.sin(omega*t)/omega,y:straight?0:p.speed*(1-Math.cos(omega*t))/omega,vx:p.speed*Math.cos(omega*t),vy:p.speed*Math.sin(omega*t)};}
 case 'induction':{const position=Math.min(1,Math.max(0,.5+p.speed*t)),stopped=(position===1&&p.speed>0)||(position===0&&p.speed<0),velocity=stopped?0:p.speed,emf=-p.field*p.length*velocity;return {position,velocity,flux:p.field*p.length*position,emf,current:emf/p.resistance,stopped};}
 case 'force':{const friction=Math.min(p.force,p.friction*p.mass*g),net=p.force-friction,acceleration=net/p.mass;return {friction,net,acceleration,velocity:acceleration*t,position:.5*acceleration*t*t};}
 case 'lever':return simulateLever(id,p,t);
 case 'buoyancy':{const weight=p.mass*g,buoyancy=p.density*g*(p.volume/1000)*p.fraction,density=p.mass/(p.volume/1000);return {weight,buoyancy,net:buoyancy-weight,density,equilibrium:Math.min(1,density/p.density),canFloat:density<=p.density};}
 case 'energy':{const duration=Math.sqrt(2*p.height/g),elapsed=Math.min(t,duration),height=Math.max(0,p.height-.5*g*elapsed**2),velocity=g*elapsed,potential=p.mass*g*height,kinetic=.5*p.mass*velocity**2;return {height,velocity,potential,kinetic,total:potential+kinetic,elapsed,stopped:t>=duration};}
 case 'collision':{const total=p.m1+p.m2,momentum=p.m1*p.u1+p.m2*p.u2,relative=p.u1-p.u2,approaching=relative>0,v1=approaching?(momentum-p.m2*p.restitution*relative)/total:p.u1,v2=approaching?(momentum+p.m1*p.restitution*relative)/total:p.u2,before=.5*p.m1*p.u1**2+.5*p.m2*p.u2**2,after=.5*p.m1*v1**2+.5*p.m2*v2**2;return {approaching,v1,v2,momentum,momentumAfter:p.m1*v1+p.m2*v2,before,after,loss:before-after};}
 case 'refraction':{const angle=p.angle*Math.PI/180,ratio=p.n1*Math.sin(angle)/p.n2,totalReflection=ratio>1;return {reflection:p.angle,refraction:totalReflection?null:Math.asin(Math.min(1,ratio))*180/Math.PI,totalReflection,critical:p.n1>p.n2?Math.asin(p.n2/p.n1)*180/Math.PI:null};}
 default:{const extra=simulateFoundation(id,p,t)||simulateAdvanced(id,p,t)||simulateCompletionFoundation(id,p,t)||simulateCompletionMechanics(id,p,t)||simulateElectrical(id,p,t)||simulateBuoyancy(id,p,t);if(extra)return extra;throw Error('未知实验模型');}
 }
}
