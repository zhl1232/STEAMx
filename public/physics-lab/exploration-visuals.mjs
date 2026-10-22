import {simulate,electricField,magneticField,wireField} from './exploration-model.mjs';
export const fmt=(n,d=2)=>n===null||!Number.isFinite(n)?'—':Math.abs(n)>=1e5?n.toExponential(2):n.toFixed(d);
const text=(x,y,s,cls='diagram-label')=>`<text x="${x}" y="${y}" class="${cls}">${s}</text>`;
const line=(x1,y1,x2,y2,color='#638c7c',width=3,dash='')=>`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" ${dash?'stroke-dasharray="'+dash+'"':''}/>`;
const arrow=(x,y,dx,dy,color='#267966')=>{if(Math.hypot(dx,dy)<1e-8)return '';const a=Math.atan2(dy,dx),endX=x+dx,endY=y+dy;return line(x,y,endX,endY,color)+`<path d="M${endX-8*Math.cos(a-.45)} ${endY-8*Math.sin(a-.45)}L${endX} ${endY}L${endX-8*Math.cos(a+.45)} ${endY-8*Math.sin(a+.45)}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;};
const circle=(x,y,r,fill='#d9eae0',stroke='#5f8975')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const rect=(x,y,w,h,fill='#e6eee5')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="#a5bca9" stroke-width="2"/>`;
const metric=(label,value,unit='')=>({label,value:typeof value==='number'?fmt(value):value,unit});
function plot(fn,yScale=100,yCenter=235){return `<polyline points="${Array.from({length:201},(_,i)=>`${80+i*3.2},${yCenter-fn(i/200)*yScale}`).join(' ')}" fill="none" stroke="#287a67" stroke-width="3"/>`;}
function axes(xLabel,yLabel){return line(80,235,730,235,'#9bb3a2',1)+line(80,85,80,375,'#9bb3a2',1)+text(680,260,xLabel)+text(90,65,yLabel);}
function cart(x,y,label,color='#dfece3'){return rect(x-44,y-30,88,45,color)+circle(x-25,y+18,9,'#6f8d7e')+circle(x+25,y+18,9,'#6f8d7e')+text(x,y-1,label);}
function magnet(x,y,polarity=1){return `<g transform="translate(${x} ${y})"><rect x="-44" y="-18" width="44" height="36" rx="4" fill="${polarity>0?'#8bb7cd':'#cf8c76'}"/><rect y="-18" width="44" height="36" rx="4" fill="${polarity>0?'#cf8c76':'#8bb7cd'}"/>${text(-22,6,polarity>0?'S':'N')}${text(22,6,polarity>0?'N':'S')}</g>`;}
function fieldArrows(fn,xScale=85,yScale=85){let svg='';for(let x=-3;x<=3;x+=.6)for(let y=-1.8;y<=1.8;y+=.6){const v=fn(x,y);if(!v.valid||v.strength<1e-8)continue;const dx=(v.ex??v.bx)/v.strength,dy=(v.ey??v.by)/v.strength;svg+=arrow(400+x*xScale,230-y*yScale,dx*19,-dy*19,'#a5bcb0');}return svg;}
export function experimentView(id,p,t){
 const m=simulate(id,p,t);let svg='',metrics=[],notice='';
 if(id==='sound'){
  svg=axes('时间 →','相对声压')+plot(x=>p.amplitude*Math.sin(2*Math.PI*p.frequency*(x*.01-t)),95,235);
  for(let i=0;i<29;i++){const x=100+i*21,dx=10*p.amplitude*Math.sin(i*.5*p.frequency/300-t*2*Math.PI*p.frequency);svg+=circle(x+dx,375,4,'#7da48f');}
  svg+=text(400,430,'空气质点在原位附近来回振动（慢放示意）');metrics=[metric('频率',p.frequency,'Hz'),metric('波长',m.wavelength,'m'),metric('声速',m.speed,'m/s')];
 }else if(id==='wave'){
  svg=axes('位置 x / m →','位移 y / m')+plot(x=>p.amplitude*Math.sin(2*Math.PI*p.frequency*(t-4*x/p.speed)),140);
  const y=235-m.probe*140;svg+=line(400,100,400,365,'#d5b56b',1,'5 5')+circle(400,y,9,'#edc56e','#b18c40')+text(400,400,'金色质点只上下振动；波向右传播')+arrow(570,90,80,0);metrics=[metric('波长',m.wavelength,'m'),metric('周期',m.period,'s'),metric('标记点位移',m.probe,'m')];
 }else if(id==='heating'){
  svg=rect(230,120,250,230,'#eef5f0')+rect(240,170,230,170,'#d6e9ef')+text(355,240,fmt(m.temperature,1)+' ℃','diagram-value')+rect(220,360,270,24,'#dcb16d')+text(355,410,'恒定功率加热')+line(565,330,565,115,'#9aaca0',24)+line(565,330,565,330-(m.temperature/80)*215,'#d18e62',12)+text(615,120,'80℃')+text(615,335,'0℃');
  metrics=[metric('温度',m.temperature,'℃'),metric('吸收热量',m.heat/1000,'kJ'),metric('加热时间',m.elapsed,'s')];notice=m.stopped?'已到 80℃，本模型停止加热。':'';
 }else if(id==='mixing'){
  svg=rect(170,140,190,210,'#efddd0')+rect(440,140,190,210,'#d8e9ef')+text(265,240,fmt(m.hot,1)+' ℃','diagram-value')+text(535,240,fmt(m.cold,1)+' ℃','diagram-value')+text(265,385,'热水 '+fmt(p.m1,1)+' kg')+text(535,385,'冷水 '+fmt(p.m2,1)+' kg')+arrow(370,235,60,0,'#cc9358')+text(400,100,'热量从高温处传向低温处');
  metrics=[metric('热水温度',m.hot,'℃'),metric('冷水温度',m.cold,'℃'),metric('最终平衡温度',m.equilibrium,'℃')];
 }else if(id==='field'||id==='magnets'){
  const magnetic=id==='magnets',d=magnetic?p.distance:p.d;
  svg=fieldArrows((x,y)=>magnetic?magneticField(p,x,y):electricField(p,x,y));
  if(magnetic){svg+=magnet(400-d/2*85,230)+magnet(400+d/2*85,230,p.polarity)+text(400,425,m.attract?'相邻异名磁极：相互吸引':'相邻同名磁极：相互排斥');svg+=arrow(400-d/2*85,280,m.attract?35:-35,0)+arrow(400+d/2*85,280,m.attract?-35:35,0);}
  else for(const [x,q] of [[400-d/2*85,p.q1],[400+d/2*85,p.q2]])svg+=circle(x,230,20,q>0?'#edc6af':q<0?'#bad8e8':'#e6eae5')+text(x,236,q>0?'+':q<0?'−':'0');
  const x=400+p.x*85,y=230-p.y*85;svg+=circle(x,y,19,'#fff6d6','#bba363')+`<circle cx="${x}" cy="${y}" r="26" fill="transparent" data-probe="true" pointer-events="all"/>`;
  if(m.valid&&m.strength>1e-8)svg+=arrow(x,y,30*(m.ex??m.bx)/m.strength,-30*(m.ey??m.by)/m.strength,'#bb8553');
  svg+=text(400,42,magnetic?'拖动金色指南针 · 棕色箭头为 N 极方向':'拖动金色探针 · 箭头为正电荷受力方向');
  metrics=magnetic?[metric('相互作用',m.attract?'吸引':'排斥'),metric('局部磁场',m.valid?m.strength:null,'相对值')]:[metric('场强',m.valid?m.strength/1000:null,'kV/m'),metric('电势',m.valid?m.potential/1000:null,'kV'),metric('正 1 μC 电荷受力',m.valid?m.strength/1000:null,'mN')];
  if(!m.valid)notice='探针太靠近模型中心，请移远一些。';
 }else if(id==='wire-field'){
  svg=fieldArrows((x,y)=>wireField(p,x,y))+circle(400,230,22,'#e9d5ad')+text(400,236,p.current>0?'⊙':p.current<0?'⊗':'0')+text(400,42,'拖动指南针 · 棕色箭头为 N 极方向')+text(400,425,'电流：⊙ 向纸外 / ⊗ 向纸内');
  const x=400+p.x*85,y=230-p.y*85;svg+=circle(x,y,19,'#fff6d6','#bba363')+`<circle cx="${x}" cy="${y}" r="26" fill="transparent" data-probe="true" pointer-events="all"/>`;
  if(m.valid&&m.strength>0)svg+=arrow(x,y,30*m.bx/m.strength,-30*m.by/m.strength,'#bb8553');
  metrics=[metric('电流',p.current,'A'),metric('到导线距离',Math.hypot(p.x,p.y),'cm'),metric('磁感应强度',m.valid?m.strength*1e6:null,'μT')];notice=!m.valid?'指南针太靠近导线，请移远一些。':p.current===0?'电流为零，模型中的磁场为零，指南针没有确定指向。':'';
 }else if(id==='refraction'){
  const a=p.angle*Math.PI/180,b=(m.refraction??0)*Math.PI/180;
  svg=`<rect x="60" y="230" width="680" height="180" fill="#e4f1ee"/>`+line(60,230,740,230,'#93b2a5',2)+line(400,65,400,410,'#a7b8b0',1,'7 5')+arrow(400-185*Math.sin(a),230-185*Math.cos(a),185*Math.sin(a),185*Math.cos(a),'#d5a048')+arrow(400,230,185*Math.sin(a),-185*Math.cos(a),'#879bcd');
  if(!m.totalReflection)svg+=arrow(400,230,170*Math.sin(b),170*Math.cos(b),'#3c9b8b');
  svg+=text(160,100,'n₁ = '+fmt(p.n1))+text(160,360,'n₂ = '+fmt(p.n2))+text(430,70,'法线')+text(580,430,m.totalReflection?'发生全反射':'绿色：折射光');metrics=[metric('入射角',p.angle,'°'),metric('折射角',m.refraction,'°'),metric('临界角',m.critical,'°')];
 }else if(id==='magnetic-force'){
  for(let x=100;x<720;x+=80)for(let y=90;y<400;y+=65)svg+=text(x,y,p.field>0?'⊙':p.field<0?'⊗':'·');
  const scale=m.radius?Math.min(50,140/m.radius):40,cx=280,cy=225;
  if(m.radius)svg+=`<circle cx="${cx}" cy="${cy-p.speed/m.omega*scale}" r="${m.radius*scale}" fill="none" stroke="#9ab7aa" stroke-dasharray="6 5"/>`;
  const x=cx+m.x*scale,y=cy-m.y*scale;svg+=circle(x,y,12,'#e4c779')+arrow(x,y,m.vx/p.speed*50,-m.vy/p.speed*50,'#4b90b8');if(m.omega)svg+=arrow(x,y,-Math.sign(m.omega)*m.vy/p.speed*38,-Math.sign(m.omega)*m.vx/p.speed*38,'#c78958');
  svg+=text(400,430,'蓝：速度 · 棕：磁场力 · ⊙ 向纸外 / ⊗ 向纸内');metrics=[metric('轨道半径',m.radius,'m'),metric('周期',m.period,'s'),metric('磁场力',m.force*1000,'mN')];notice=m.radius===null?'电荷量或磁场为零，粒子做匀速直线运动。':'';
 }else if(id==='induction'){
  const x=220+m.position*380;svg=rect(140,95,520,290,'#f0f6ed');for(let xx=240;xx<620;xx+=75)for(let yy=145;yy<360;yy+=65)svg+=text(xx,yy,p.field>0?'⊙':p.field<0?'⊗':'·');
  svg+=line(220,120,650,120)+line(220,350,650,350)+line(220,120,220,350)+rect(205,205,30,65,'#e4d3a9')+line(x,120,x,350,'#b78753',9)+text(220,400,'R = '+fmt(p.resistance,0)+' Ω')+text(530,400,'棒长 '+fmt(p.length,1)+' m')+text(x,80,'移动棒');if(m.velocity)svg+=arrow(x,235,Math.sign(m.velocity)*55,0,'#5f9cb2');
  metrics=[metric('磁通量',m.flux,'Wb'),metric('感应电动势',m.emf,'V'),metric('电流（逆时针为正）',m.current*1000,'mA')];notice=m.stopped?'棒到达边界，停止运动，感应电流为零。':'';
 }else if(id==='force'){
  const x=130+Math.min(m.position,10)*52;svg=line(60,310,740,310,'#aabda8',4)+cart(x,270,fmt(p.mass,1)+' kg')+arrow(x,230,p.force*5,0,'#4a9682');if(m.friction)svg+=arrow(x,290,-m.friction*5,0,'#c28b63');svg+=text(400,390,'绿：推力 · 棕：摩擦力')+text(400,70,'从静止开始');metrics=[metric('加速度',m.acceleration,'m/s²'),metric('速度',m.velocity,'m/s'),metric('位移',m.position,'m')];notice=m.position>10?'小车已超过画面范围；读数继续显示理论运动。':m.acceleration===0?'推力被静摩擦平衡，小车保持静止。':'';
 }else if(id==='lever'){
  const left=400-p.leftArm*135,right=400+p.rightArm*135;svg=line(100,240,700,240,'#8eac99',10)+`<path d="M400 245l-30 65h60Z" fill="#c9d7c3" stroke="#91ad90"/>`+arrow(left,110,left*0,115,'#528b78')+arrow(right,110,0,115,'#c89755')+text(left,85,p.leftForce+' N')+text(right,85,p.rightForce+' N')+text((left+400)/2,275,fmt(p.leftArm,1)+' m')+text((right+400)/2,275,fmt(p.rightArm,1)+' m')+text(400,390,m.balanced?'达到平衡':m.torque>0?'左侧有向下转动的趋势':'右侧有向下转动的趋势');metrics=[metric('左侧力矩',m.left,'N·m'),metric('右侧力矩',m.right,'N·m'),metric('状态',m.balanced?'平衡':m.torque>0?'左侧下转':'右侧下转')];
 }else if(id==='buoyancy'){
  const y=235-(1-p.fraction)*100;svg=`<rect x="180" y="235" width="440" height="150" fill="#dceef2"/>`+line(180,235,620,235,'#80a9b7',2)+rect(340,y,120,100,'#d6c29b')+arrow(400,y-10,0,-m.buoyancy*3,'#539b8a')+arrow(400,y+110,0,m.weight*3,'#bd8d5c')+text(400,425,'位置由外力保持 · 绿：浮力 / 棕：重力');metrics=[metric('浮力',m.buoyancy,'N'),metric('重力',m.weight,'N'),metric('移除外力后的初始趋势',Math.abs(m.net)<1e-7?'平衡':m.net>0?'向上':'向下')];
 }else if(id==='energy'){
  const y=350-m.height/p.height*240;svg=line(140,360,720,360,'#acbca6',4)+line(230,100,230,350,'#b9cabe',1,'5 6')+circle(230,y,20,'#dfb961')+text(230,400,'下落物体')+rect(440,110,75,240,'#eaf2e9')+rect(570,110,75,240,'#f7eedc')+`<rect x="440" y="${350-m.potential/m.total*240}" width="75" height="${m.potential/m.total*240}" fill="#6fa18a"/><rect x="570" y="${350-m.kinetic/m.total*240}" width="75" height="${m.kinetic/m.total*240}" fill="#d1a758"/>`+text(478,390,'重力势能')+text(608,390,'动能');metrics=[metric('高度',m.height,'m'),metric('速度',m.velocity,'m/s'),metric('总机械能',m.total,'J')];notice=m.stopped?'已到达地面前一刻；不模拟碰撞与反弹。':'';
 }else if(id==='collision'){
  const after=t>=2&&m.approaching,left=m.approaching?356+(after?m.v1*(t-2):p.u1*(t-2))*25:220+p.u1*t*25,right=m.approaching?444+(after?m.v2*(t-2):p.u2*(t-2))*25:580+p.u2*t*25;svg=line(80,320,720,320,'#a7b9a8',4)+cart(left,285,fmt(p.m1,1)+' kg')+cart(right,285,fmt(p.m2,1)+' kg','#e9dbbc');
  const v1=after?m.v1:p.u1,v2=after?m.v2:p.u2;svg+=arrow(left,225,v1*35,0,'#518d7c')+arrow(right,225,v2*35,0,'#be9756')+text(left,180,fmt(v1)+' m/s')+text(right,180,fmt(v2)+' m/s')+text(400,75,after?'碰撞后：比较速度与能量':'碰撞前：向右为正方向');metrics=[metric('总动量',after?m.momentumAfter:m.momentum,'kg·m/s'),metric('总动能',after?m.after:m.before,'J'),metric('碰撞损失动能',m.loss,'J')];notice=!m.approaching?'两车不相互接近，此配置不会发生碰撞。':p.restitution===0&&after?'完全非弹性碰撞：两车速度相同，可结合动量解释。':'';
 }
 return {svg,metrics,notice,model:m};
}
