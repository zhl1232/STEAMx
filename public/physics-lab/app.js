import {createExplorations} from './explorations.js';
import {setupTransfer} from './transfer.mjs';
import {createLearning} from './learning.js';
import {G,clamp,bulbState,distance,ports,solveCircuit,springState,atwoodState,traceRays,validateScene} from './physics.mjs';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const paths={plus:'M12 5v14M5 12h14',save:'M5 3h12l4 4v14H3V3h2M7 3v6h10V3M7 21v-8h10v8',folder:'M3 7V4h6l3 3h9v13H3V7z',help:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 17v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',lock:'M5 10h14v11H5V10zM8 10V6a4 4 0 0 1 8 0v4',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3zM20 2v4M18 4h4',zap:'m13 2-9 12h7l-1 8L21 9h-8l0-7z',sun:'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',weight:'M8 7a4 4 0 1 1 8 0M5 7h14l3 14H2L5 7z',cursor:'m4 3 6 18 3-7 7-3L4 3zM13 14l6 6',link:'m9 15 6-6M8 17l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 7l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',undo:'M4 10h10a7 7 0 0 1 0 14M4 10l5-5M4 10l5 5',reset:'M4 9a9 9 0 1 1 0 8M4 3v6h6',pause:'M8 5v14M16 5v14',play:'m7 4 14 8-14 8V4z',activity:'M2 12h4l3-8 6 16 3-8h4',info:'M12 11v6M12 7v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.info}"/></svg>`;
function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));}
hydrateIcons();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=(v,places=2)=>Number.isFinite(v)?v.toFixed(places):'—';
const definitions={
  battery:{name:'电池',subtitle:'提供电势差',value:9,unit:'V',min:1,max:24,step:.5,label:'电压'},
  resistor:{name:'电阻',subtitle:'探索欧姆定律',value:100,unit:'Ω',min:1,max:1000,step:1,label:'电阻值'},
  bulb:{name:'灯泡',subtitle:'电流变成看得见的光',value:100,unit:'Ω',min:1,max:1000,step:1,label:'灯泡电阻'},
  switch:{name:'开关',subtitle:'控制电路通断'},
  wire:{name:'画电线',subtitle:'拖拽接线 · 点击添加拐点'},
  source:{name:'光源',subtitle:'三束平行光',angle:0},
  lens:{name:'透镜',subtitle:'汇聚或发散光线',value:150,unit:'px',min:60,max:300,step:5,label:'焦距'},
  mirror:{name:'镜子',subtitle:'改变光的方向',angle:0},
  spring:{name:'弹簧',subtitle:'胡克定律与振动',value:50,unit:'N/m',min:20,max:200,step:5,label:'劲度系数',damping:.15},
  pulley:{name:'滑轮',subtitle:'双重物定滑轮'},
  mass:{name:'质量方块',subtitle:'改变质量，观察运动',value:1,unit:'kg',min:.5,max:5,step:.5,label:'质量'}
};
const modeInfo={
  circuit:{name:'电路实验',icon:'zap',types:['battery','bulb','switch','resistor'],challenge:'电阻翻倍，电流会怎样？',challengeText:'保持电压不变，比较两次读数。',note:'灯泡采用恒定电阻模型，亮度按功率示意（0.81 W 达到显示上限），不模拟灯丝温度与烧毁；支持单电源串并联。',hint:'从圆形端点开始画线 · 空白处点一下转弯 · 另一端点结束',next:'选中一个电阻，把阻值增加一倍。电流会减少一半吗？'},
  optics:{name:'光学实验',icon:'sun',types:['source','mirror','lens'],challenge:'让三束光会聚到一点',challengeText:'移动透镜，再改变焦距，观察焦点。',note:'二维近轴薄透镜与理想平面镜；平行光用于观察焦距，不模拟衍射、色散与物体成像。',hint:'移动光源与透镜 · 选中镜子调整角度 · 光线实时更新',next:'切换到凹透镜，观察光线是否还能在右侧汇聚。'},
  mechanics:{name:'力学实验',icon:'weight',types:['spring','pulley','mass','mass2','mass3'],challenge:'更重的方块，振动更快吗？',challengeText:'比较不同质量的振动周期。',note:'弹簧遵循胡克定律；滑轮与绳质量忽略、绳不可伸长。重力 9.81 m/s²；画布边界限制位移。',hint:'将方块端点靠近弹簧或滑轮端点 · 或使用智能连接',next:'改变右侧方块的质量，试着让滑轮两边保持平衡。'}
};
let state={version:1,mode:'circuit',name:'欧姆定律 · 串联电路',components:[],wires:[]};
let selected=null,pendingPort=null,tool='select',running=true,time=0,lastFrame=0,lastDisplay=0,dirty=true,history=[],drag=null,nextId=1,nextWire=1,toastTimer;
let wirePoints=[],wireCursor=null;
let learning=null;
const scenes=new Map();
const STORAGE='steamx-physics-experiments-v1';
const stage=$('#stage');
// One illustration for the palette, inspector and workbench. Ports remain at ±64, 0.
function bulbArtwork(brightness=0){
  const lit=brightness>0.0001,glass='M-12-8C-12-19-28-23-28-37C-28-66 28-66 28-37C28-23 12-19 12-8Z';
  return `<g class="bulb-artwork"><path d="M-64 0h12v15h18M64 0H52v15H34" fill="none" stroke="#8ba595" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="-47" y="5" width="94" height="23" rx="8" fill="#e7eee5" stroke="#a6bba7" stroke-width="1.5"/><path d="M-37 23h74" stroke="#cbd8c9" stroke-width="2"/><circle cx="-34" cy="15" r="4" fill="#bcad86"/><circle cx="34" cy="15" r="4" fill="#bcad86"/><path d="M-36 15h4M32 15h4" stroke="#867c64" stroke-width="1.5"/><rect x="-19" y="-1" width="38" height="17" rx="6" fill="#f9faf6" stroke="#bdcbb9" stroke-width="1.5"/><path d="${glass}" fill="url(#bulb-glass)" stroke="${lit?'#c3a361':'#9bafa6'}" stroke-width="1.8"/>${lit?`<path d="${glass}" fill="#ffdb64" opacity="${.1+brightness*.6}"/>`:''}<path d="M-18-41Q-18-48-10-50" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M-6-7-10-29M6-7 10-29" fill="none" stroke="${lit?'#bd9148':'#8e9f96'}" stroke-width="1.5"/><path d="m-10-29 4-5 4 8 4-8 4 8 4-3" fill="none" stroke="${lit?'#e9a027':'#83968a'}" stroke-width="${lit?2.2:1.8}" stroke-linecap="round" stroke-linejoin="round"/><rect x="-12" y="-8" width="24" height="16" rx="3" fill="url(#bulb-base)" stroke="#a4a99b" stroke-width="1.3"/><path d="m-11-3 22-2m-22 7 22-2m-22 7 22-2" stroke="#8e9687" stroke-width="1.4"/></g>`;
}
function componentIcon(type){
  const base=type.startsWith('mass')?'mass':type;
  const shapes={bulb:`<g transform="translate(26 25) scale(.35)">${bulbArtwork()}</g>`,switch:'<path d="M4 27h12m20 0h12M16 27 35 12" fill="none" stroke="#829d8a" stroke-width="3"/><circle cx="16" cy="27" r="3" fill="#829d8a"/><circle cx="36" cy="27" r="3" fill="#829d8a"/>',battery:'<path d="M3 20h9m28 0h9" stroke="#879d8b" stroke-width="2"/><rect x="12" y="10" width="28" height="20" rx="5" fill="#dfeddd" stroke="#759279"/><path d="M31 15v10m-5-5h10" stroke="#567d5c"/><rect x="14" y="13" width="6" height="14" rx="2" fill="#83a180"/>',resistor:'<path d="M3 20h11m26 0h9" stroke="#8c9c8c" stroke-width="2"/><rect x="14" y="11" width="26" height="18" rx="6" fill="#e8dbb9" stroke="#c4af81"/><path d="M21 11v18m7-18v18m7-18v18" stroke="#a89160" stroke-width="3"/>',wire:'<path d="M8 10h10v20h25V16" fill="none" stroke="#829d8a" stroke-width="2.5"/><circle cx="8" cy="10" r="3" fill="white" stroke="#829d8a"/><circle cx="43" cy="16" r="3" fill="white" stroke="#829d8a"/>',source:'<rect x="6" y="11" width="16" height="19" rx="4" fill="#e6eadd" stroke="#96a484"/><path d="m22 15 10-5v22l-10-5" fill="#e9cf88" stroke="#c4aa68"/><path d="M36 12h10M36 21h10M36 30h10" stroke="#d8b466"/>',lens:'<path d="M25 3Q8 20 25 37Q42 20 25 3" fill="#e0f2ef" stroke="#74a9a3" stroke-width="1.5"/><path d="M3 20h45" stroke="#a6beb4" stroke-dasharray="3 3"/>',mirror:'<path d="m33 4-15 31" stroke="#77a5ba" stroke-width="4"/><path d="m36 6-15 31" stroke="#bac5c3"/><path d="m35 9 5 1m-8 6 5 1m-8 6 5 1m-8 6 5 1" stroke="#bac5c3"/>',spring:'<path d="M16 5h19M25 5v6l-8 3 16 5-16 5 16 5-8 3v5" fill="none" stroke="#86a797" stroke-width="2"/><path d="M17 37h16" stroke="#aac3b2"/>',pulley:'<path d="M25 2v7" stroke="#9daba0"/><circle cx="25" cy="20" r="12" fill="#edf1e7" stroke="#9caf94" stroke-width="2"/><circle cx="25" cy="20" r="3" fill="#b2bdac"/><path d="M12 20v18m26-18v18" stroke="#c5b697" stroke-width="2"/>',mass:'<path d="M25 6v7" stroke="#94a990"/><rect x="12" y="13" width="26" height="24" rx="5" fill="#dce7dc" stroke="#87a88d"/><text x="25" y="29" text-anchor="middle" font-size="10" fill="#729276">kg</text>'};
  return `<svg viewBox="0 0 52 42" aria-hidden="true">${shapes[base]||shapes.mass}</svg>`;
}
function newComponent(type,x,y,value){const d=definitions[type];return {id:'c'+nextId++,type,...(type==='switch'?{closed:true}:{}),x:clamp(x,85,915),y:clamp(y,100,500),...(d.value!==undefined?{value:value??d.value}:{}),...(d.angle!==undefined?{angle:d.angle}:{}),...(d.damping!==undefined?{damping:d.damping}:{})};}
function snapshot(){history.push(JSON.stringify(state));if(history.length>40)history.shift();$('#undo-btn').disabled=false;}
function markDirty(){dirty=true;$('#dirty-indicator').textContent='未保存';}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
function resetMotion(){time=0;lastFrame=0;}
function undo(){if(pendingPort){removeWirePoint();return;}if(!history.length)return;state=validateScene(JSON.parse(history.pop()));syncIds();selected=null;pendingPort=null;resetMotion();markDirty();renderAll();toast('已撤销上一步');}
function syncIds(){nextId=Math.max(0,...state.components.map(c=>+c.id.slice(1)))+1;nextWire=Math.max(0,...state.wires.map(w=>+w.id.slice(1)))+1;}
function setTool(t){tool=t;clearWireDraft();$('#select-tool').classList.toggle('active',t==='select');$('#connect-tool').classList.toggle('active',t==='connect');stage.classList.toggle('connect-mode',t==='connect');$('#select-tool').setAttribute('aria-pressed',String(t==='select'));$('#connect-tool').setAttribute('aria-pressed',String(t==='connect'));renderStage();}
function select(id){selected=id;renderInspector();renderStage();renderResults();}
function focusComponent(id){$$('.component').find(el=>el.dataset.id===id)?.focus?.({preventScroll:true});}
function toggleSwitch(id,focus=false){const c=state.components.find(c=>c.id===id);if(c?.type!=='switch')return;snapshot();c.closed=!c.closed;selected=c.id;markDirty();renderAll();if(focus)focusComponent(c.id);}
function makeWire(a,b,route){const w={id:'w'+nextWire++,a:{...a},b:{...b}};if(route)w.route=route;state.wires.push(w);return w;}
function isOccupied(p){return state.wires.some(w=>[w.a,w.b].some(q=>q.id===p.id&&q.port===p.port));}
function connect(a,b,record=true,points){
  if(a.id===b.id){toast('请选择另一个组件的端点');return false;}
  if(state.wires.length>=100){toast('本实验最多支持 100 条连线');return false;}
  if(state.wires.some(w=>[w.a,w.b].some(p=>p.id===a.id&&p.port===a.port)&&[w.a,w.b].some(p=>p.id===b.id&&p.port===b.port))){toast('这两个端点已经连接');return false;}
  if(state.mode==='mechanics'){
    const ca=state.components.find(c=>c.id===a.id),cb=state.components.find(c=>c.id===b.id);
    if([ca,cb].filter(c=>c.type==='mass').length!==1||[ca,cb].filter(c=>c.type==='spring'||c.type==='pulley').length!==1){toast('请将方块连接到弹簧或滑轮');return false;}
    if(isOccupied(a)||isOccupied(b)){toast('该端点已连接，请先删除原连线');return false;}
  }
  if(record)snapshot();const w=makeWire(a,b);if(state.mode==='circuit'&&points)w.points=points.map(p=>({...p}));markDirty();resetMotion();clearWireDraft();renderAll();return true;
}
function autoConnect(record=true){
  clearWireDraft();renderStage();
  if(state.mode==='optics'){if(!state.components.some(c=>c.type==='source')){toast('先拖入一个光源');return;}if(record)snapshot();const objects=state.components.filter(c=>c.type!=='source').sort((a,b)=>a.x-b.x);state.components.filter(c=>c.type==='source').forEach(s=>{s.y=300;s.angle=0;});objects.forEach(c=>c.y=300);markDirty();renderAll();toast('已对齐光轴，光线会自动与光学元件相交');return;}
  if(state.mode==='circuit'){
    const batteries=state.components.filter(c=>c.type==='battery'),rs=state.components.filter(c=>['resistor','bulb','switch'].includes(c.type)).sort((a,b)=>a.y-b.y||a.x-b.x);
    if(batteries.length!==1||!rs.length){toast('智能连接需要一个电池和至少一个灯泡、电阻或开关');return;}
    if(record)snapshot();state.wires=[];const b=batteries[0];let p={id:b.id,port:1};for(const r of rs){makeWire(p,{id:r.id,port:0});p={id:r.id,port:1};}makeWire(p,{id:b.id,port:0},'return');
    toast('已生成串联回路，可继续手动改接');
  }else{
    if(record)snapshot();let added=0;
    const masses=state.components.filter(c=>c.type==='mass').sort((a,b)=>a.x-b.x);
    for(const mass of masses){const p={id:mass.id,port:0};if(isOccupied(p))continue;const options=state.components.filter(c=>['spring','pulley'].includes(c.type)).flatMap(c=>ports(c).map((xy,port)=>({id:c.id,port,xy}))).filter(q=>!isOccupied(q)).sort((a,b)=>distance(mass,a.xy)-distance(mass,b.xy));if(options[0]){makeWire({id:options[0].id,port:options[0].port},p);added++;}}
    toast(added?`已连接 ${added} 个质量方块`:'先添加弹簧或滑轮，以及未连接的方块');
  }
  markDirty();resetMotion();renderAll();
}
function addComponent(type,x=undefined,y=undefined,value){
  if(type==='wire'){setTool('connect');toast('画电线：点起点 → 空白处加拐点 → 点终点；也可直接拖拽');return;}
  if(state.components.length>=40){toast('本实验最多支持 40 个组件');return;}
  if(type.startsWith('mass')){value=type==='mass2'?2:type==='mass3'?3:(value??1);type='mass';}
  snapshot();const n=state.components.length,c=newComponent(type,x??(240+n%4*155),y??(180+Math.floor(n/4)%3*130),value);state.components.push(c);selected=c.id;markDirty();resetMotion();renderAll();
}
function deleteSelected(){if(!selected)return;snapshot();const wasWire=selected.startsWith('w');if(wasWire)state.wires=state.wires.filter(w=>w.id!==selected);else{state.components=state.components.filter(c=>c.id!==selected);state.wires=state.wires.filter(w=>w.a.id!==selected&&w.b.id!==selected);}selected=null;pendingPort=null;markDirty();resetMotion();renderAll();}
function createSample(kind,record=true){
  if(record)snapshot();delete state.lessonSession;delete state.starterActivity;nextId=1;nextWire=1;state.components=[];state.wires=[];
  const add=(type,x,y,value)=>{const c=newComponent(type,x,y,value);state.components.push(c);return c;};
  if(kind==='wiring'){state.mode='circuit';state.name='自己接线 · 点亮灯泡';add('battery',240,260,9);add('bulb',700,260,100);selected=null;
  }else if(['lamp','lamp-series','lamp-parallel'].includes(kind)){
    state.mode='circuit';state.name=kind==='lamp'?'点亮第一盏灯':kind==='lamp-series'?'两盏灯 · 串联':'两盏灯 · 并联';
    const b=add('battery',230,200,9),sw=add('switch',530,200),l=add('bulb',740,370,100);
    makeWire({id:b.id,port:1},{id:sw.id,port:0});makeWire({id:sw.id,port:1},{id:l.id,port:0});
    if(kind==='lamp-series'){const l2=add('bulb',400,400,100);makeWire({id:l.id,port:1},{id:l2.id,port:0});makeWire({id:l2.id,port:1},{id:b.id,port:0},'return');}
    else {makeWire({id:l.id,port:1},{id:b.id,port:0},'return');if(kind==='lamp-parallel'){const l2=add('bulb',440,400,100);makeWire({id:sw.id,port:1},{id:l2.id,port:0});makeWire({id:l2.id,port:1},{id:b.id,port:0},'return');}}
    selected=sw.id;
  }else if(kind==='series'||kind==='parallel'){
    state.mode='circuit';state.name=kind==='series'?'欧姆定律 · 串联电路':'电流分流 · 并联电路';
    const b=add('battery',265,235,9),r1=add('resistor',670,235,100),r2=add('resistor',670,420,100);
    makeWire({id:b.id,port:1},{id:r1.id,port:0});
    if(kind==='series'){makeWire({id:r1.id,port:1},{id:r2.id,port:0});makeWire({id:r2.id,port:1},{id:b.id,port:0},'return');}
    else {makeWire({id:b.id,port:1},{id:r2.id,port:0});makeWire({id:r1.id,port:1},{id:b.id,port:0},'return');makeWire({id:r2.id,port:1},{id:b.id,port:0},'return');}
    selected=r1.id;
  }else if(kind==='lens'||kind==='reflection'){
    state.mode='optics';state.name=kind==='lens'?'平行光 · 透镜的焦点':'光的反射 · 转动镜面';
    add('source',150,300);const c=add(kind==='lens'?'lens':'mirror',510,300,150);if(kind==='reflection')c.angle=35;selected=c.id;
  }else if(kind==='spring'){
    state.mode='mechanics';state.name='弹性与振动 · 弹簧实验';const s=add('spring',500,145,50),m=add('mass',500,335,2);makeWire({id:s.id,port:0},{id:m.id,port:0});selected=s.id;
  }else{
    state.mode='mechanics';state.name='力与运动 · 阿特伍德机';const p=add('pulley',500,165),a=add('mass',448,340,1),b=add('mass',552,340,2);makeWire({id:p.id,port:0},{id:a.id,port:0});makeWire({id:p.id,port:1},{id:b.id,port:0});selected=b.id;
  }
  scenes.set(state.mode,JSON.stringify(state));pendingPort=null;setTool('select');resetMotion();markDirty();renderAll();if(kind==='wiring')setTool('connect');
}
function switchMode(mode){if(mode===state.mode)return;scenes.set(state.mode,JSON.stringify(state));snapshot();if(scenes.has(mode)){state=JSON.parse(scenes.get(mode));syncIds();selected=state.components[0]?.id||null;pendingPort=null;setTool('select');resetMotion();markDirty();renderAll();}else createSample({circuit:'series',optics:'lens',mechanics:'atwood'}[mode],false);}
function renderPalette(){const m=modeInfo[state.mode];$('#component-count').textContent=`${m.types.length} 种`;$('#palette').innerHTML=m.types.map(type=>{const base=type.startsWith('mass')?'mass':type,d=definitions[base],name=type==='mass2'?'方块 · 2 kg':type==='mass3'?'方块 · 3 kg':type==='mass'?'方块 · 1 kg':d.name;return `<button class="palette-item" draggable="true" data-type="${type}" aria-label="${type==='wire'?'开始画电线':'添加'+name}">${componentIcon(type)}<span><span class="item-title">${name}</span><small>${d.subtitle}</small></span><span class="drag-dots">⠿</span></button>`;}).join('');$('#palette').querySelectorAll('button').forEach(btn=>{btn.addEventListener('click',()=>addComponent(btn.dataset.type));btn.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',btn.dataset.type);e.dataTransfer.effectAllowed='copy';});});$('#challenge-title').textContent=m.challenge;$('#challenge-text').textContent=m.challengeText;$('#next-step').textContent=m.next;$('#model-note').textContent=m.note;$('#stage-hint').textContent=m.hint;$('.stage-scale').textContent=state.mode==='optics'?'焦距以工作台 px 表示':state.mode==='mechanics'?'100 px = 1 m':'';$('#auto-btn').innerHTML=icon('spark')+(state.mode==='optics'?'对齐光轴':state.mode==='circuit'?'自动串联':'智能连接');$('#auto-btn').setAttribute('title',state.mode==='circuit'?'重新生成串联回路，将替换现有电线；可撤销':'自动连接组件');}
function slider(id,label,value,min,max,step,unit){return `<label class="field-row" for="${id}">${label}<output id="${id}-value">${format(value,step<.1?2:step<1?1:0)} ${unit}</output></label><input class="param-slider" type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}"><div class="slider-bounds"><span>${min} ${unit}</span><span>${max} ${unit}</span></div><label class="number-field" for="${id}-number">精确设置 <span><input id="${id}-number" class="param-number" type="number" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}精确值"> ${unit}</span></label>`;}
function renderInspector(){
  const c=state.components.find(c=>c.id===selected),wire=state.wires.find(w=>w.id===selected),panel=$('#inspector');
  if(wire){panel.innerHTML=`<div class="selected-title"><span class="component-icon">${componentIcon('wire')}</span><strong>${state.mode==='mechanics'?'连接绳':'电线'}<small>跟随组件位置更新</small></strong></div><p class="empty-inspector">删除后可以选择端点重新连接。</p>${state.mode==='circuit'&&wire.points?'<p class="empty-inspector">拖动线路上的金色拐点可修改走线。线条交叉不代表电气连接。</p><button id="auto-route" class="route-button">自动整理这条线</button>':''}<div class="inspector-actions"><button id="delete-selected" class="delete-button">删除连接</button></div>`;$('#delete-selected').onclick=deleteSelected;if($('#auto-route'))$('#auto-route').onclick=()=>{snapshot();delete wire.points;delete wire.route;markDirty();renderAll();};return;}
  if(!c){panel.innerHTML='<div class="empty-inspector">点击工作台上的组件，<br>在这里调整它的物理参数。</div>';return;}
  const d=definitions[c.type];let fields='';
  if(c.value!==undefined){const v=c.type==='lens'?Math.abs(c.value):c.value;fields+=slider('parameter',d.label,v,d.min,d.max,d.step,d.unit);}
  if(c.type==='mirror'||c.type==='source')fields+=slider('angle',c.type==='mirror'?'镜面偏转（相对竖直）':'光束方向',c.angle||0,-75,75,1,'°');
  if(c.type==='lens')fields+=`<div class="field-row">透镜类型</div><div class="inspector-actions"><button id="convex-btn" class="${c.value>0?'tool active':''}">凸透镜</button><button id="concave-btn" class="${c.value<0?'tool active':''}">凹透镜</button></div>`;
  if(c.type==='spring')fields+=slider('damping','阻尼比',c.damping??.15,0,.8,.05,'');
  if(c.type==='bulb')fields+='<p class="empty-inspector">亮度随实际功率变化。试着串联电阻，或比较两盏灯的串联与并联。</p>';
  if(c.type==='switch')fields=`<button id="toggle-switch" class="modal-primary" aria-pressed="${c.closed}">${c.closed?'断开开关':'闭合开关'}</button><p class="empty-inspector">当前${c.closed?'闭合 · 导通':'断开 · 不导通'}，直接点击工作台上的开关即可切换；拖动可以移动。</p>`;
  if(c.type==='pulley')fields='<p class="empty-inspector">左、右端点各连接一个方块。<br>改变方块质量，观察加速度。</p>';
  panel.innerHTML=`<div class="selected-title"><span class="component-icon">${componentIcon(c.type)}</span><strong>${d.name}<small>${c.id.toUpperCase()} · 可拖拽移动</small></strong></div>${fields}${['resistor','bulb'].includes(c.type)?'<div id="component-reading" class="component-reading"></div>':''}<div class="inspector-actions"><button id="duplicate-selected">复制组件</button><button id="delete-selected" class="delete-button">删除</button></div>`;
  const bind=(id,prop)=>{
    const input=$('#'+id),numberInput=$('#'+id+'-number');if(!input)return;let recorded=false;
    const apply=source=>{const raw=source.value,v=Number(raw),min=Number(input.getAttribute('min')),max=Number(input.getAttribute('max')),step=Number(input.step),steps=(v-min)/step;
      const valid=raw!==''&&Number.isFinite(v)&&v>=min&&v<=max&&Math.abs(steps-Math.round(steps))<1e-7;source.setAttribute('aria-invalid',String(!valid));if(!valid)return;
      if(!recorded){snapshot();recorded=true;}c[prop]=prop==='value'&&c.type==='lens'?v*Math.sign(c.value):v;input.value=String(v);if(numberInput){numberInput.value=String(v);numberInput.setAttribute('aria-invalid','false');}
      $('#'+id+'-value').textContent=format(v,step<1?(id==='damping'?2:1):0)+' '+(id==='angle'?'°':id==='damping'?'':d.unit);markDirty();resetMotion();renderStage();renderResults();
    };
    input.addEventListener('pointerdown',()=>{snapshot();recorded=true;});
    for(const source of [input,numberInput].filter(Boolean)){source.addEventListener('input',()=>apply(source));source.addEventListener('change',()=>{recorded=false;if(source.getAttribute('aria-invalid')==='true')toast('请输入范围内、符合步长的数值');});}
  };
  bind('parameter','value');bind('angle','angle');bind('damping','damping');
  if(c.type==='lens'){const lensType=sign=>{snapshot();c.value=Math.abs(c.value)*sign;markDirty();renderInspector();renderStage();renderResults();};$('#convex-btn').onclick=()=>lensType(1);$('#concave-btn').onclick=()=>lensType(-1);}
  if(c.type==='switch')$('#toggle-switch').onclick=()=>toggleSwitch(c.id);
  $('#delete-selected').onclick=deleteSelected;$('#duplicate-selected').onclick=()=>{if(state.components.length>=40){toast('最多支持 40 个组件');return;}snapshot();const n={...c,id:'c'+nextId++,x:clamp(c.x+90,85,915),y:clamp(c.y+65,100,500)};state.components.push(n);selected=n.id;markDirty();resetMotion();renderAll();};
}
function connectedMass(parent,port){const w=state.wires.find(w=>[w.a,w.b].some(q=>q.id===parent.id&&q.port===port));if(!w)return null;const q=w.a.id===parent.id?w.b:w.a;return state.components.find(c=>c.id===q.id&&c.type==='mass')||null;}
function mechanicsData(){
  const positions={},springs=[],pulleys=[];
  for(const c of state.components){
    if(c.type==='spring'){const m=connectedMass(c,0);if(!m)continue;const result=springState(m.value,c.value,time,c.damping??.15),base=c.y+160,y=clamp(base+result.extension*100,90,535);positions[m.id]={x:c.x,y};springs.push({c,m,result,boundary:y!==base+result.extension*100});}
    if(c.type==='pulley'){const left=connectedMass(c,0),right=connectedMass(c,1);if(!left||!right)continue;const a=atwoodState(left.value,right.value,time),base=clamp(c.y+180,250,480),maxTravel=Math.min(535-base,base-(c.y+85))/100,travel=clamp(a.travel,-maxTravel,maxTravel);positions[left.id]={x:c.x-52,y:base-travel*100};positions[right.id]={x:c.x+52,y:base+travel*100};pulleys.push({c,left,right,result:a,boundary:Math.abs(a.travel)>maxTravel});}
  }return {positions,springs,pulleys};
}
function wirePath(w,components=state.components,positions={}){const ca=components.find(c=>c.id===w.a.id),cb=components.find(c=>c.id===w.b.id);if(!ca||!cb)return '';const a=ports({...ca,...positions[ca.id]})[w.a.port],b=ports({...cb,...positions[cb.id]})[w.b.port];if(!a||!b)return '';if(state.mode==='mechanics')return `M${a.x},${a.y}L${b.x},${b.y}`;if(Array.isArray(w.points))return linePath([a,...w.points,b]);if(w.route==='return'){const left=Math.min(a.x,b.x)-50,right=Math.max(a.x,b.x)+65,bottom=clamp(Math.max(a.y,b.y)+72,100,555);const first=a.x>b.x?right:left,last=a.x>b.x?left:right;return `M${a.x},${a.y}H${first}V${bottom}H${last}V${b.y}H${b.x}`;}if(Math.abs(a.y-b.y)<1)return `M${a.x},${a.y}H${b.x}`;const mid=(a.y+b.y)/2;return `M${a.x},${a.y}V${mid}H${b.x}V${b.y}`;}
function componentSVG(c,positions={},circuit=null){
  const pos=positions[c.id]||c,x=pos.x,y=pos.y,sel=selected===c.id;let drawing='',bounds={x:-85,y:-55,w:170,h:134};
  if(c.type==='battery')drawing=`<path d="M-64 0h20M44 0h20" stroke="#8caa99" stroke-width="3"/><rect x="-45" y="-31" width="89" height="62" rx="12" fill="#eef4e9" stroke="#b6cbae" stroke-width="1.4" filter="url(#component-shadow)"/><rect x="-44" y="-30" width="27" height="60" rx="11" fill="#86a684"/><path d="M-32 0h13M21-10v20M11 0h20" stroke="white" stroke-width="2"/><path d="M21-10v20M11 0h20" stroke="#688463" stroke-width="2"/><text x="0" y="64" class="component-label">直流电源</text><text x="0" y="48" class="component-value">${format(c.value,1)} V</text>`;
  else if(c.type==='resistor')drawing=`<path d="M-64 0h27M37 0h27" stroke="#90a395" stroke-width="3"/><rect x="-38" y="-23" width="76" height="46" rx="14" fill="#eee2c2" stroke="#c8b386" stroke-width="1.3" filter="url(#component-shadow)"/><path d="M-22-22v44M-4-22v44M14-22v44" stroke="#a88b5b" stroke-width="7"/><path d="M27-21v42" stroke="#bda269" stroke-width="3"/><text x="0" y="59" class="component-label">${c.id.toUpperCase()} · ${format(c.value,0)} Ω</text>`;
  else if(c.type==='bulb'){
    const b=bulbState(c,circuit),lit=b.brightness>0.0001;bounds={x:-85,y:-76,w:170,h:143};
    drawing=`<title>灯泡 · ${lit?'已点亮':'未点亮'} · ${circuit.short?'短路，停止计算':format(b.power,4)+' W'}</title>${lit?`<ellipse class="bulb-glow" cy="-31" rx="49" ry="44" fill="url(#bulb-halo)" opacity="${.1+b.brightness*.85}"/>`:''}${bulbArtwork(b.brightness)}<text x="0" y="51" class="component-label">灯泡 ${c.id.toUpperCase()} · ${circuit.short?'短路 · 停止计算':(lit?'发光':'熄灭')}</text>`;
  }
  else if(c.type==='switch')drawing=`<rect x="-43" y="-38" width="86" height="66" rx="12" fill="#f0f5ee" stroke="#d4e1d3"/><path d="M-64 0h36M28 0h36M-28 0L28 ${c.closed?0:-28}" fill="none" stroke="#789881" stroke-width="4" stroke-linecap="round"/><circle cx="-28" r="5" fill="#789881"/><circle cx="28" r="5" fill="#789881"/><text x="0" y="59" class="component-label">${c.closed?'已闭合 · 点击断开':'已断开 · 点击闭合'}</text>`;
  else if(c.type==='source'){bounds={x:-55,y:-70,w:120,h:147};drawing=`<g transform="rotate(${c.angle||0})"><rect x="-30" y="-26" width="54" height="52" rx="11" fill="#e5eadd" stroke="#a2b18e" filter="url(#component-shadow)"/><path d="M22-19 43-31v62L22 19" fill="#ead296" stroke="#c6ae71"/><path d="M-9-12h15M-9-3h15M-9 6h15" stroke="#a8b496" stroke-width="2"/></g><text x="0" y="70" class="component-label">平行光源</text>`;}
  else if(c.type==='lens'){bounds={x:-52,y:-128,w:104,h:302};drawing=`<path d="${c.value>0?'M0-110Q-60 0 0 110Q60 0 0-110':'M-24-110Q4 0-24 110L24 110Q-4 0 24-110Z'}" fill="url(#lens-fill)" stroke="#7db7b0" stroke-width="2"/><path d="M-24 110h48M0 111v14M-38 125h76" stroke="#a7bcb1" stroke-width="3" stroke-linecap="round"/><text x="0" y="158" class="component-label">${c.value>0?'凸':'凹'}透镜 · f=${Math.abs(c.value)} px</text>`;}
  else if(c.type==='mirror'){bounds={x:-115,y:-115,w:230,h:285};drawing=`<g transform="rotate(${-c.angle||0})"><path d="M0-105V105" stroke="#85b1c4" stroke-width="7" stroke-linecap="round"/><path d="M7-105V105" stroke="#c0cbd0" stroke-width="4"/>${Array.from({length:12},(_,i)=>`<path d="M9 ${-98+i*17}l11 8" stroke="#bac9ce" stroke-width="2"/>`).join('')}</g><text x="0" y="152" class="component-label">镜面 · ${c.angle||0}°</text>`;}
  else if(c.type==='pulley'){bounds={x:-80,y:-80,w:160,h:180};drawing=`<path d="M-65-66H65M0-66V-48" stroke="#b3c1b3" stroke-width="4" stroke-linecap="round"/>${Array.from({length:10},(_,i)=>`<path d="M${-63+i*14}-66l-8-10" stroke="#cbd4c8" stroke-width="2"/>`).join('')}<circle r="50" fill="#f0f3e9" stroke="#a6b996" stroke-width="4" filter="url(#component-shadow)"/><circle r="40" fill="none" stroke="#c7d3b6" stroke-width="1"/><g transform="rotate(${time*30})"><path d="M-35 0h70M0-35v70" stroke="#c5d0b6" stroke-width="4"/></g><circle r="9" fill="#99ad87"/><text x="0" y="85" class="component-label">理想定滑轮</text>`;}
  else if(c.type==='spring'){bounds={x:-70,y:-45,w:140,h:connectedMass(c,0)?100:180};drawing=`<path d="M-65 0H65" stroke="#b2c4b5" stroke-width="5" stroke-linecap="round"/>${Array.from({length:10},(_,i)=>`<path d="M${-62+i*14} 0l-8-10" stroke="#c7d5c8" stroke-width="2"/>`).join('')}<path d="M0 0v30" stroke="#91ae9a" stroke-width="3"/><text x="0" y="-27" class="component-label">k = ${c.value} N/m</text>`;if(!connectedMass(c,0))drawing+='<path d="M0 35l-15 7 30 13-30 13 30 13-30 13 15 7v20" fill="none" stroke="#91ae9a" stroke-width="3"/>';}
  else if(c.type==='mass'){bounds={x:-48,y:-43,w:96,h:108};drawing=`<circle cy="-31" r="6" fill="#edf3e8" stroke="#8eab91" stroke-width="2"/><rect x="-34" y="-25" width="68" height="60" rx="10" fill="${c.value>=3?'#c7d9c8':c.value>=2?'#d8e5d7':'#e4eee0'}" stroke="#91ae91" stroke-width="1.5" filter="url(#component-shadow)"/><path d="M-24-15H24" stroke="#ffffff" stroke-opacity=".6" stroke-width="2"/><text x="0" y="12" class="component-value">${format(c.value,1)} kg</text><text x="0" y="58" class="component-label">${c.id.toUpperCase()}</text>`;}
  const ps=ports(c).map((p,i)=>`<g class="port ${pendingPort?.id===c.id&&pendingPort.port===i?'pending':''}" data-id="${c.id}" data-port="${i}" role="button" tabindex="0" aria-label="${definitions[c.type].name} ${c.id} 端点 ${i+1}，点击开始或完成接线"><circle class="port-hit" cx="${p.x-c.x}" cy="${p.y-c.y}" r="17"/><circle class="port-dot" cx="${p.x-c.x}" cy="${p.y-c.y}" r="7"/></g>`).join('');
  return `<g class="component" data-id="${c.id}" data-component-type="${c.type}" transform="translate(${x},${y})" role="button" tabindex="0" ${c.type==='switch'?`aria-pressed="${c.closed}"`:''} aria-label="${definitions[c.type].name} ${c.id}${c.type==='switch'?`，${c.closed?'已闭合':'已断开'}，点击或按空格切换`:''}，拖动移动"><rect class="component-hit" x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" rx="12" fill="transparent" pointer-events="all" aria-hidden="true"/>${sel?`<rect class="selection-outline" x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}"/>`:''}${drawing}${ps}</g>`;
}
function renderStage(){
  const md=state.mode==='mechanics'?mechanicsData():{positions:{},springs:[],pulleys:[]};
  const result=state.mode==='circuit'?solveCircuit(state.components,state.wires):null;
  $('#components-layer').innerHTML=state.components.map(c=>componentSVG(c,md.positions,result)).join('');
  $('#wires-layer').innerHTML=state.wires.map(w=>{if(state.mode==='mechanics'&&[w.a,w.b].some(q=>state.components.find(c=>c.id===q.id)?.type==='spring'))return '';const path=wirePath(w,state.components,md.positions);return `<g data-wire="${w.id}"><path class="wire-hit" d="${path}"/><path class="wire-path ${selected===w.id?'selected':''}" d="${path}" ${state.mode==='mechanics'?'style="stroke:#baaa8a;stroke-width:2.5"':''}/>${result?.active?`<path class="flow-path ${running?'running':''}" d="${path}"/>`:''}</g>`;}).join('');
  let effects='',guide='';
  if(state.mode==='optics'){
    const lens=state.components.find(c=>c.type==='lens');guide=`<path d="M50 300H950" stroke="#d8e2d7" stroke-dasharray="5 6"/><text x="910" y="324" class="boundary-label">参考光轴</text>`;
    if(lens){const f=Math.abs(lens.value);for(const side of [-1,1])guide+=`<circle cx="${lens.x+side*f}" cy="${lens.y}" r="4" fill="none" stroke="#a5b9a7"/><text x="${lens.x+side*f}" y="${lens.y+24}" text-anchor="middle" class="boundary-label">F${side===1?'′':''}</text>`;}
    effects=traceRays(state.components).map(r=>{const d=r.path.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join('');return `<path class="beam-glow" d="${d}"/><path class="ray" d="${d}"/>`;}).join('');
  }else if(state.mode==='mechanics'){
    guide='<path d="M65 576H935" stroke="#d6e0d4"/><text x="860" y="563" class="boundary-label">工作台边界</text>';
    for(const {c,m,result} of md.springs){const pos=md.positions[m.id],start=c.y+30,end=pos.y-31,len=end-start;let d=`M${c.x} ${start}V${start+10}`;for(let i=0;i<14;i++)d+=`L${c.x+(i%2?-17:17)} ${start+10+(i+1)*(len-25)/15}`;d+=`L${c.x} ${end-5}V${end}`;effects+=`<path d="${d}" fill="none" stroke="#90ad98" stroke-width="3" stroke-linejoin="round"/><path d="M${c.x-80} ${c.y+160+result.equilibrium*100}h160" stroke="#bfd0bc" stroke-dasharray="4 5"/><text x="${c.x+90}" y="${c.y+164+result.equilibrium*100}" class="boundary-label">平衡位置</text>`;}
  }
  $('#effects-layer').innerHTML=effects;$('#scene-guide').innerHTML=guide;
  $('#overlay-layer').innerHTML=state.components.length?'':`<text class="scene-empty" x="500" y="285">把第一个组件拖到这里</text><text class="scene-empty" x="500" y="319" style="font-size:12px">或在组件库中点击添加</text>`;
  const selectedWire=state.wires.find(w=>w.id===selected);
  if(!pendingPort&&selectedWire?.points)$('#overlay-layer').innerHTML+=selectedWire.points.map((p,i)=>`<circle class="wire-handle" data-point="${i}" cx="${p.x}" cy="${p.y}" r="9" role="button" tabindex="0" aria-label="电线拐点 ${i+1}，拖动或用方向键移动"/>`).join('');
  renderWireDraft();
  learning?.highlight();
  $('#scene-count').textContent=`${state.components.length} 个组件 · ${state.wires.length} 条连接`;
}
function renderResults(){
  let values=[],status='',active=true,title='',text='',formula='';
  const metric=(label,value,unit,sub,color='')=>({label,value,unit,sub,color});
  if(state.mode==='circuit'){
    const r=solveCircuit(state.components,state.wires);status=r.status;active=r.active;values=[metric('电源电压',format(r.voltage,1),'V','电池提供的电势差'),metric('总电流',r.short?'—':format(r.current*1000,1),'mA','流经电源的电流','blue'),metric('等效电阻',r.active?format(r.resistance,0):'—','Ω','整个电路的等效阻值','orange')];
    if(r.short){title='电源被导线直接短接';text='电源的两个端点处于同一节点。请删除这条连接，并让电流经过电阻。';}
    else if(r.active){title='闭合回路中，电流开始流动';text=`电源提供 ${format(r.voltage,1)} V 电压，等效电阻 ${format(r.resistance,0)} Ω，产生 ${format(r.current*1000,1)} mA 电流。改变任意阻值，读数会立即更新。`;}
    else {title='电流需要一条完整的路';text='点击两个圆形端点接线，或使用「智能连接」形成串联回路。电源正、负极需要通过电阻连通。';}
    const chosen=state.components.find(c=>c.id===selected);
    if($('#component-reading')&&chosen){const reading=bulbState(chosen,r);$('#component-reading').innerHTML=`<strong>此元件实时读数</strong><dl><div><dt>电压</dt><dd>${r.short?'—':format(reading.voltage,3)} V</dd></div><div><dt>电流</dt><dd>${r.short?'—':format(reading.current*1000,2)} mA</dd></div><div><dt>功率</dt><dd>${r.short?'—':format(reading.power,4)} W</dd></div></dl>`;}
    formula='I = U / R';
    const lamps=state.components.filter(c=>c.type==='bulb');
    if(lamps.length){const lamp=lamps.find(c=>c.id===selected)||lamps[0],b=bulbState(lamp,r);values.push(metric('灯泡 '+lamp.id.toUpperCase()+' 功率',r.short?'—':format(b.power,4),'W','亮度由功率决定 · 恒定电阻模型','orange'));if(r.active){title='电能变成光，亮度随功率变化';text='每盏灯下方显示实际功率。选中开关控制通断，调整电压或串入电阻观察亮度；相同灯泡并联时比串联更亮。';}formula='P = UI = I²R';$('#challenge-title').textContent='怎样让灯泡更亮？';$('#challenge-text').textContent='保持灯泡电阻不变，试着调整电池电压。';$('#next-step').textContent='打开示例，比较两盏相同灯泡串联与并联时的功率。';}
  }else if(state.mode==='optics'){
    const lens=state.components.find(c=>c.type==='lens'),mirror=state.components.find(c=>c.type==='mirror'),source=state.components.find(c=>c.type==='source'),rays=traceRays(state.components);active=!!source;status=source?'光线追踪中':'添加一个光源';
    values=[metric('焦距',lens?format(Math.abs(lens.value),0):'—','px',lens?(lens.value>0?'凸透镜 · 会聚':'凹透镜 · 发散'):'拖入透镜'),metric('镜面偏转',mirror?format(mirror.angle||0,0):'—','°','相对于竖直方向','blue'),metric('追踪光束',source?String(rays.length):'0','束','平行光 · 理想近轴模型','orange')];
    title=lens?(lens.value>0?'平行光在透镜后汇聚':'光束经过透镜后发散'):mirror?'镜子改变光的传播方向':'先给探索一束光';
    text=lens?'移动透镜，焦点随之移动；焦距越短，光线偏折越明显。光源偏离透镜中心时，光束会偏向光轴。':mirror?'转动镜面，反射光方向随之改变。入射角和反射角相对于镜面法线测量。':'拖入光源、镜子或透镜，在工作台上移动它们，观察光的路径。';formula=lens?'θ′ ≈ θ − y / f':'θ入射 = θ反射';
    if(source&&(lens||mirror)&&!rays.some(r=>r.path.length>2)){active=false;status='光线尚未经过组件';title='先让光线碰到光学元件';text='将透镜或镜子移到光束路径上；光源朝向元件时，才能观察会聚、发散或反射。';}
  }else{
    const d=mechanicsData(),spring=d.springs.find(s=>s.c.id===selected||s.m.id===selected)||d.springs[0],pulley=d.pulleys.find(p=>[p.c.id,p.left.id,p.right.id].includes(selected))||d.pulleys[0];
    const useSpring=spring&&(!pulley||[spring.c.id,spring.m.id].includes(selected));
    if(useSpring){active=true;status=spring.boundary?'已到画布边界':running?'弹簧振动中':'模拟已暂停';values=[metric('瞬时伸长',format((spring.boundary?((d.positions[spring.m.id].y-spring.c.y-160)/100):spring.result.extension)*100,1),'cm','从自然长度开始释放'),metric('平衡伸长',format(spring.result.equilibrium*100,1),'cm','重力与弹力平衡','blue'),metric('振动周期',format(spring.result.period,2),'s','由质量与劲度系数决定','orange')];title='弹簧的伸长带来回复力';text=spring.boundary?'方块的理论运动超出工作台，显示位移已被边界限制。提高劲度系数或减小质量，以观察完整振动。':'方块从弹簧自然长度、静止状态释放。增加质量会增大平衡伸长并延长周期；增加劲度系数会缩短周期。';formula='F = kx  ·  T ≈ 2π√(m/k)';$('#challenge-title').textContent='更重的方块，振动更快吗？';$('#challenge-text').textContent='保持弹簧不变，比较不同质量的周期。';$('#next-step').textContent='把方块质量增加一倍，观察周期如何变化。再把阻尼设为 0，比较振动。';}
    else if(pulley){active=true;status=pulley.boundary?'已到边界 · 重置继续':Math.abs(pulley.result.acceleration)<.001?'两侧质量平衡':running?'重力驱动中':'模拟已暂停';values=[metric('右侧加速度',format(pulley.boundary?0:pulley.result.acceleration,2),'m/s²','向下为正',''),metric('绳的张力',pulley.boundary?'—':format(pulley.result.tension,2),'N','两边绳张力相同','blue'),metric('质量差',format(pulley.right.value-pulley.left.value,1),'kg','右侧 − 左侧','orange')];title=Math.abs(pulley.result.acceleration)<.001?'一样重，就能保持平衡':'较重的一侧向下运动';text=pulley.boundary?'方块已到画布边界，当前运动停止。点击重置运动，或调整质量重新开始。边界时张力不再用自由运动公式估算。':'两侧方块通过绳相连。重力差驱动运动；两侧质量越接近，加速度越小。调整任一方块质量即可重新释放。';formula='a = g(m₂ − m₁) / (m₁ + m₂)';$('#challenge-title').textContent='哪一侧会向下运动？';$('#challenge-text').textContent='改变两侧质量，观察加速度的方向。';$('#next-step').textContent=modeInfo.mechanics.next;}
    else{active=false;status='连接组件开始实验';values=[metric('加速度','—','m/s²','连接滑轮与两个方块'),metric('弹簧伸长','—','cm','连接弹簧与一个方块','blue'),metric('重力加速度','9.81','m/s²','地球表面近似值','orange')];title='先让组件建立联系';text='弹簧连接一个方块，或滑轮两侧各连接一个方块。将端点靠近即可自动吸附，也可以点击「智能连接」。';formula='F = ma';}
  }
  $('#metrics').innerHTML=values.map(v=>`<div class="metric"><div class="metric-label">${v.label}</div><div class="metric-value ${v.color}">${v.value}<small>${v.unit}</small></div><div class="metric-sub">${v.sub}</div></div>`).join('');$('#result-status').textContent=status;$('#result-status').classList.toggle('warning',!active||status.includes('边界'));$('#observation-title').textContent=title;$('#observation-text').textContent=text;$('#formula').textContent=formula;$('#stage-label').textContent=running?'实时模拟':'模拟已暂停';$('.live-dot').style.background=running?'#63a087':'#bdc7bb';learning?.update();
}
function renderAll(){
  $$('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.mode);b.setAttribute('aria-selected',String(b.dataset.mode===state.mode));});$('#experiment-name').textContent=state.name;$('#undo-btn').disabled=!history.length;renderPalette();renderInspector();renderStage();renderResults();
}
function pointFromEvent(e){const r=stage.getBoundingClientRect(),scale=Math.min(r.width/1000,r.height/600),offsetX=(r.width-1000*scale)/2,offsetY=(r.height-600*scale)/2;return {x:(e.clientX-r.left-offsetX)/scale,y:(e.clientY-r.top-offsetY)/scale};}
function getPortNear(point,exclude=null){const md=state.mode==='mechanics'?mechanicsData():{positions:{}};const candidates=state.components.filter(c=>c.id!==exclude).flatMap(c=>ports({...c,...md.positions[c.id]}).map((p,port)=>({id:c.id,port,p})));candidates.sort((a,b)=>distance(a.p,point)-distance(b.p,point));return candidates[0]&&distance(candidates[0].p,point)<28?{id:candidates[0].id,port:candidates[0].port}:null;}
function linePath(points){return points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join('');}
function boundedPoint(p){return {x:Math.round(clamp(p.x,15,985)),y:Math.round(clamp(p.y,65,550))};}
function clearWireDraft(){pendingPort=null;wirePoints=[];wireCursor=null;if(drag?.kind==='port'){if(stage.hasPointerCapture?.(drag.pointerId))stage.releasePointerCapture(drag.pointerId);drag=null;}}
function wirePortPosition(p){const c=state.components.find(c=>c.id===p.id),md=state.mode==='mechanics'?mechanicsData():{positions:{}};return c&&ports({...c,...md.positions[c.id]})[p.port];}
function renderWireDraft(){
  const circuit=state.mode==='circuit',drawing=!!pendingPort;
  $('#wire-guide').hidden=!circuit;$('#wire-draft-actions').hidden=!drawing;$('#remove-bend').hidden=!circuit;$('#remove-bend').disabled=!wirePoints.length;
  $('#connect-tool-label').textContent=circuit?'画电线':'连接';$('#connect-tool').disabled=state.mode==='optics';
  stage.classList.toggle('drawing-wire',drawing);
  $('#stage-hint').textContent=drawing?(circuit?'点击空白处添加拐点，点另一端点完成 · Esc 取消':'选择另一个组件的端点完成连接 · Esc 取消'):tool==='connect'?'先点击一个圆形端点，也可以从端点直接拖出一条线':modeInfo[state.mode].hint;
  $('#wire-instruction').textContent=drawing?`正在画线 · ${wirePoints.length} 个拐点 · 点击另一端点完成`:'自己画：① 点接线端点  ② 点空白处转弯（可选）  ③ 点另一端点结束';
  if(!drawing)return;const start=wirePortPosition(pendingPort);if(!start){clearWireDraft();return;}
  const near=wireCursor&&getPortNear(wireCursor,pendingPort.id),end=near?wirePortPosition(near):(wireCursor||wirePoints.at(-1)||start);
  $('#overlay-layer').innerHTML=`<g class="wire-draft"><path d="${linePath([start,...wirePoints,end])}" class="draft-path"/>${wirePoints.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="5" class="draft-bend"/>`).join('')}<circle cx="${start.x}" cy="${start.y}" r="15" class="draft-start"/>${near?`<circle cx="${end.x}" cy="${end.y}" r="18" class="snap-target"/>`:''}</g>`;
}
function addWirePoint(p){if(wirePoints.length>=40){toast('最多设置 40 个拐点，请连接终点');return;}const point=boundedPoint(p),last=wirePoints.at(-1)||wirePortPosition(pendingPort);if(distance(point,last)>3)wirePoints.push(point);wireCursor=point;renderStage();}
function removeWirePoint(){if(wirePoints.length){wirePoints.pop();wireCursor=wirePoints.at(-1)||wirePortPosition(pendingPort);renderStage();}else{clearWireDraft();renderStage();}}
function portClick(p){if(state.mode==='optics')return;if(!pendingPort){wirePoints=[];wireCursor=null;pendingPort=p;selected=null;renderInspector();renderStage();}else if(connect(pendingPort,p,true,state.mode==='circuit'?wirePoints:undefined)){toast(state.mode==='circuit'?'电线已接好，可以继续画下一条':'方块已连接，开始模拟');}}
stage.addEventListener('pointerdown',e=>{
  if(e.button!==0||drag)return;
  const point=pointFromEvent(e),port=e.target.closest('.port');
  const p=port?{id:port.dataset.id,port:+port.dataset.port}:(state.mode==='circuit'&&(tool==='connect'||pendingPort)?getPortNear(point):null);
  if(p){e.preventDefault();if(pendingPort){portClick(p);return;}portClick(p);drag={kind:'port',start:point,moved:false,pointerId:e.pointerId};stage.setPointerCapture(e.pointerId);return;}
  if(pendingPort&&state.mode==='circuit'){e.preventDefault();if(e.target.closest('.component'))toast('请点圆形端点完成连接，或点空白处添加拐点');else addWirePoint(point);return;}
  const handle=e.target.closest('.wire-handle');if(handle){e.preventDefault();drag={kind:'bend',id:selected,index:+handle.dataset.point,start:point,moved:false,pointerId:e.pointerId,before:JSON.stringify(state)};stage.setPointerCapture(e.pointerId);return;}
  const wire=e.target.closest('[data-wire]');if(wire){select(wire.dataset.wire);return;}
  const el=e.target.closest('.component');if(el){const c=state.components.find(c=>c.id===el.dataset.id);if(!c)return;select(c.id);if(tool==='connect'){toast('点击组件两端的圆形端点连接');return;}e.preventDefault();const p=pointFromEvent(e),md=state.mode==='mechanics'?mechanicsData():{positions:{}},pos=md.positions[c.id]||c;drag={kind:'component',id:c.id,offset:{x:p.x-pos.x,y:p.y-pos.y},start:p,clientStart:{x:e.clientX,y:e.clientY},moved:false,pointerId:e.pointerId,before:JSON.stringify(state)};stage.setPointerCapture(e.pointerId);return;}
  selected=null;clearWireDraft();renderInspector();renderStage();if(tool==='connect')toast('从组件的圆形端点开始画线');
});
stage.addEventListener('pointermove',e=>{
  if(drag&&e.pointerId!==drag.pointerId)return;
  const p=pointFromEvent(e);if(drag&&(drag.kind==='component'?Math.hypot(e.clientX-drag.clientStart.x,e.clientY-drag.clientStart.y)>6:distance(p,drag.start)>3))drag.moved=true;
  if(pendingPort&&(!drag||drag.kind==='port')){wireCursor=boundedPoint(p);renderWireDraft();return;}
  if(!drag)return;
  if(drag.kind==='bend'&&drag.moved){const w=state.wires.find(w=>w.id===drag.id);if(w?.points){w.points[drag.index]=boundedPoint(p);renderStage();}return;}
  if(drag.kind==='component'&&drag.moved){const c=state.components.find(c=>c.id===drag.id);if(!c)return;const attached=state.mode==='mechanics'&&c.type==='mass'&&isOccupied({id:c.id,port:0});if(attached){if(!drag.detached){state.wires=state.wires.filter(w=>w.a.id!==c.id&&w.b.id!==c.id);drag.detached=true;}}c.x=clamp(p.x-drag.offset.x,85,915);c.y=clamp(p.y-drag.offset.y,100,500);resetMotion();renderStage();}
});
function finishDrag(e){
  if(!drag||e.pointerId!==drag.pointerId)return;const d=drag;drag=null;if(stage.hasPointerCapture?.(e.pointerId))stage.releasePointerCapture(e.pointerId);
  if(d.kind==='port'){if(d.moved&&pendingPort){const point=pointFromEvent(e),near=getPortNear(point,pendingPort.id);if(near)portClick(near);else if(state.mode==='circuit')addWirePoint(point);else toast('松开在另一个圆形端点上，或点击端点完成连接');}renderStage();return;}
  if(d.kind==='bend'){if(d.moved){history.push(d.before);if(history.length>40)history.shift();markDirty();}renderAll();return;}
  if(!d.moved){if(Math.hypot(e.clientX-d.clientStart.x,e.clientY-d.clientStart.y)<=6&&tool==='select'&&!pendingPort){const c=state.components.find(c=>c.id===d.id);if(c?.type==='switch')toggleSwitch(c.id,true);}return;}history.push(d.before);if(history.length>40)history.shift();markDirty();resetMotion();const c=state.components.find(c=>c.id===d.id);if(c&&state.mode!=='optics'){for(const [port,point] of ports(c).entries()){const q=getPortNear(point,c.id);if(q){if(connect({id:c.id,port},q,false))toast('端点已智能吸附连接');break;}}}renderAll();
}
stage.addEventListener('pointerup',finishDrag);stage.addEventListener('pointercancel',e=>{if(drag&&e.pointerId!==drag.pointerId)return;if(drag?.before)state=JSON.parse(drag.before);drag=null;clearWireDraft();if(stage.hasPointerCapture?.(e.pointerId))stage.releasePointerCapture(e.pointerId);renderAll();});
stage.addEventListener('keydown',e=>{const handle=e.target.closest('.wire-handle');if(handle&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const w=state.wires.find(w=>w.id===selected),i=+handle.dataset.point,p=w?.points?.[i];if(!p)return;snapshot();const v=e.shiftKey?25:10;w.points[i]=boundedPoint({x:p.x+(e.key==='ArrowLeft'?-v:e.key==='ArrowRight'?v:0),y:p.y+(e.key==='ArrowUp'?-v:e.key==='ArrowDown'?v:0)});markDirty();renderStage();$$('.wire-handle')[i]?.focus?.();return;}const p=e.target.closest('.port'),c=e.target.closest('.component');if((e.key==='Enter'||e.key===' ')&&p){e.preventDefault();portClick({id:p.dataset.id,port:+p.dataset.port});}else if((e.key==='Enter'||e.key===' ')&&c){e.preventDefault();if(e.repeat)return;const comp=state.components.find(x=>x.id===c.dataset.id);if(comp?.type==='switch'&&tool==='select'&&!pendingPort)toggleSwitch(comp.id,true);else{select(c.dataset.id);focusComponent(c.dataset.id);}}else if(c&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const comp=state.components.find(x=>x.id===c.dataset.id);if(!comp)return;snapshot();const v=e.shiftKey?25:10;comp.x=clamp(comp.x+(e.key==='ArrowLeft'?-v:e.key==='ArrowRight'?v:0),85,915);comp.y=clamp(comp.y+(e.key==='ArrowUp'?-v:e.key==='ArrowDown'?v:0),100,500);markDirty();resetMotion();renderStage();}});
stage.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';$('#stage-wrap').classList.add('stage-drop-active');});stage.addEventListener('dragleave',()=>$('#stage-wrap').classList.remove('stage-drop-active'));stage.addEventListener('drop',e=>{e.preventDefault();$('#stage-wrap').classList.remove('stage-drop-active');const type=e.dataTransfer.getData('text/plain');if(!modeInfo[state.mode].types.includes(type))return;const p=pointFromEvent(e);addComponent(type,p.x,p.y);});
function openModal(title,html){$('#modal-title').textContent=title;$('#modal-content').innerHTML=html;$('#modal').showModal();}
function closeModal(){$('#modal').close();}
$('#modal-close').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
function sampleDialog(){const choices={circuit:[['wiring','自己接线 · 点亮灯泡','只有电池和灯泡，亲手画两条电线形成回路'],['lamp','点亮第一盏灯','电池、开关、灯泡：观察通断与亮度'],['lamp-series','两盏灯串联','相同灯泡分担电压，比较功率'],['lamp-parallel','两盏灯并联','每盏灯两端电压相同，比较亮度'],['series','串联电路','一个电源、两个电阻，观察总电流'],['parallel','并联电路','比较串联与并联的等效电阻']],optics:[['lens','透镜的焦点','让平行光经过凸透镜'],['reflection','镜面反射','转动镜子，改变反射方向']],mechanics:[['atwood','滑轮与质量','比较两侧质量，观察运动'],['spring','弹簧振动','从自然长度释放方块']]};openModal('选择一个探索起点','<p class="modal-copy">示例会替换当前场景。保存实验后，可以随时回来。</p>'+choices[state.mode].map(([kind,name,description])=>`<button class="modal-choice" data-sample="${kind}">${icon(modeInfo[state.mode].icon)}<span><strong>${name}</strong><small>${description}</small></span></button>`).join(''));$$('[data-sample]').forEach(b=>b.onclick=()=>{createSample(b.dataset.sample);closeModal();toast('已载入示例');});}
function readSaves(){try{const s=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(s)?s.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string').slice(0,30):[];}catch{return [];}}
function saveExperiment(){openModal('保存这次探索','<p class="modal-copy">实验保存在当前浏览器中。你也可以在加载面板导出文件，带到另一台设备。</p><label for="save-name" class="field-row">实验名称</label><input id="save-name" class="save-input" maxlength="60" value="'+esc(state.name)+'"><button id="confirm-save" class="modal-primary">保存实验</button><div id="save-error" class="inline-error" role="alert"></div>');$('#confirm-save').onclick=()=>{const name=$('#save-name').value.trim();if(!name){$('#save-error').textContent='给实验起个名字吧';return;}try{const saved=readSaves(),now=Date.now(),entry={id:'e'+now,name,date:new Date(now).toISOString(),scene:JSON.parse(JSON.stringify({...state,name}))};const existing=saved.findIndex(x=>x.name===name&&x.scene?.mode===state.mode);if(existing>=0)saved[existing]=entry;else saved.unshift(entry);localStorage.setItem(STORAGE,JSON.stringify(saved.slice(0,30)));state.name=name;dirty=false;$('#dirty-indicator').textContent='已保存';$('#experiment-name').textContent=name;closeModal();toast('实验已保存在此浏览器');}catch{$('#save-error').textContent='浏览器存储不可用或空间不足。请关闭面板，在加载中导出实验文件。';}};}
function applyLoaded(scene){const safe=validateScene(JSON.parse(JSON.stringify(scene)));snapshot();state=safe;state.name=String(scene.name||'已加载的实验').slice(0,60);syncIds();selected=state.components[0]?.id||null;pendingPort=null;setTool('select');resetMotion();dirty=false;$('#dirty-indicator').textContent='已保存';renderAll();closeModal();toast('实验已加载，运动从起点开始');}
function loadExperiments(){const saves=readSaves();openModal('我的实验','<p class="modal-copy">从当前浏览器恢复实验，或导入之前导出的文件。加载会替换当前场景。</p><div id="saved-list">'+(saves.length?saves.map(s=>`<div class="save-row"><button class="load-item" data-save-id="${esc(s.id)}">${esc(s.name)}<small>${esc(modeInfo[s.scene?.mode]?.name||'实验')} · ${new Date(s.date).toLocaleDateString('zh-CN')}</small></button><button class="remove-save" data-remove-id="${esc(s.id)}" aria-label="删除已保存的 ${esc(s.name)}">删除</button></div>`).join(''):'<p class="empty-inspector">还没有保存的实验。先动手试试，再留下一次发现。</p>')+'</div><div class="saved-actions"><button id="export-btn">导出当前实验</button><button id="import-btn">导入实验文件</button><input id="import-file" type="file" accept=".json,application/json" hidden></div><p id="load-error" class="inline-error" role="alert"></p>');
  $$('[data-save-id]').forEach(b=>b.onclick=()=>{try{const saved=saves.find(s=>s.id===b.dataset.saveId);applyLoaded(saved.scene);}catch(e){$('#load-error').textContent=e.message;}});$$('[data-remove-id]').forEach(b=>b.onclick=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(readSaves().filter(s=>s.id!==b.dataset.removeId)));closeModal();loadExperiments();}catch{$('#load-error').textContent='无法更新浏览器存储';}});
  $('#export-btn').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='steamx-experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('实验文件已导出');};$('#import-btn').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>200000)throw Error('文件过大，请导入 STEAMX 实验 JSON 文件');applyLoaded(JSON.parse(await f.text()));}catch(err){$('#load-error').textContent=err.message||'文件读取失败';}};
}
$('#new-btn').onclick=()=>{openModal('从一个新想法开始','<p class="modal-copy">创建空白工作台。已有场景可通过撤销恢复；建议先保存你的探索。</p>'+Object.entries(modeInfo).map(([mode,m])=>`<button class="modal-choice" data-new-mode="${mode}">${icon(m.icon)}<span><strong>${m.name}</strong><small>${mode==='circuit'?'电池、灯泡、开关、电阻与电线':mode==='optics'?'光源、镜子与透镜':'弹簧、滑轮与质量方块'}</small></span></button>`).join(''));$$('[data-new-mode]').forEach(b=>b.onclick=()=>{snapshot();state={version:1,mode:b.dataset.newMode,name:'未命名的'+modeInfo[b.dataset.newMode].name,components:[],wires:[]};selected=null;pendingPort=null;nextId=1;nextWire=1;setTool('select');resetMotion();markDirty();renderAll();closeModal();});};
$('#save-btn').onclick=saveExperiment;$('#load-btn').onclick=loadExperiments;$('#sample-btn').onclick=sampleDialog;$('#help-btn').onclick=()=>openModal('让你的第一次实验更顺手','<p class="modal-copy">点击「选择主题」探索声、光、热、磁、运动与能量，也可以自由搭建电路。先观察，再改变一个变量。</p><ol class="help-list"><li><strong>添加与移动：</strong>把组件从左侧拖入工作台，或点击添加。拖动工作台组件改变位置；选中后可用方向键移动。开关直接点击（或按空格 / Enter）切换通断，拖动只移动位置。</li><li><strong>建立连接：</strong>点击「画电线」，从圆形端点开始；空白处点击可加拐点，点另一端点结束。也可直接拖拽接线。选中电线后拖动金色拐点调整走线，或使用智能连接。线条交叉不会自动连接，需要分支时从同一端点再画一条线。移动端点到另一个端点附近也可吸附。电路允许分支；力学端点一次连接一个方块。</li><li><strong>改变参数：</strong>选择组件后，用右侧滑块改变电压、电阻、焦距、质量等参数。力学参数修改后会重新释放。</li><li><strong>观察运动：</strong>暂停可以停住实验；重置运动会回到释放时刻。拖动已连接方块会先脱离连接，以便重新搭建。</li><li><strong>保留发现：</strong>保存和加载使用当前浏览器存储；导出 / 导入 JSON 可以在设备之间转移。加载恢复搭建与参数，运动从起点开始。</li></ol><p class="modal-copy">快捷键：Delete 删除选中项，Ctrl / ⌘ + Z 撤销；画线中 Backspace 或「撤回拐点」可回退，Esc 取消接线。自由搭建支持单电源直流网络、近轴光线追踪、单个弹簧振子及两重物定滑轮；其他主题从「选择主题」进入。工作台边界会限制力学运动。</p>');
$$('[data-mode]').forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));$('#auto-btn').onclick=()=>autoConnect();$('#select-tool').onclick=()=>setTool('select');$('#connect-tool').onclick=()=>{if(state.mode==='optics'){toast('光线自动与元件相交，无需手动连接');return;}setTool('connect');toast(state.mode==='circuit'?'先点端点，空白处可加拐点，再点另一端点；也可直接拖拽':'点击或拖动两个圆形端点连接');};$('#undo-btn').onclick=undo;$('#reset-btn').onclick=()=>{resetMotion();renderStage();renderResults();toast('运动已回到起点');};$('#run-btn').onclick=()=>{running=!running;lastFrame=0;$('#run-btn').innerHTML=icon(running?'pause':'play')+`<span id="run-label">${running?'暂停模拟':'开始模拟'}</span>`;renderStage();renderResults();};
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(e.target.tagName)||$('#modal').open)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(pendingPort)removeWirePoint();else deleteSelected();}else if(e.key==='Escape'){setTool('select');}});
$('#cancel-wire').onclick=()=>{clearWireDraft();renderStage();};$('#remove-bend').onclick=removeWirePoint;$('#wiring-practice').onclick=()=>{createSample('wiring');toast('亲手画两条电线，让电池和灯泡组成完整回路；可撤销恢复原实验');};
function frame(now){if(lastFrame&&running&&!drag&&!$('body').classList.contains('topic-active')&&document.visibilityState!=='hidden'){time+=Math.min((now-lastFrame)/1000,.04);if(state.mode==='mechanics'&&now-lastDisplay>33){renderStage();if(now-lastDisplay>180){renderResults();lastDisplay=now;}}}lastFrame=now;requestAnimationFrame(frame);}
function replaceLearningScene(scene,record=true){const safe=validateScene(JSON.parse(JSON.stringify(scene)));if(record)snapshot();state=safe;syncIds();selected=null;clearWireDraft();setTool('select');resetMotion();markDirty();renderAll();}
learning=createLearning({getScene:()=>state,setScene:replaceLearningScene,openModal,closeModal,toast,hasWireDraft:()=>!!pendingPort});
if(!learning.resume())createSample('lamp',false);requestAnimationFrame(frame);

const explorations=createExplorations({openModal,closeModal,toast,openWorkbench:switchMode});
setupTransfer({openModal,closeModal,toast,reload:()=>{learning.reload();explorations.reloadRecords();}});
if(new URLSearchParams(globalThis.location?.search||'').get('host')==='steamx'){
  document.querySelector('body').classList.add('embedded');
  if(globalThis.ResizeObserver){const notifyHeight=()=>globalThis.parent.postMessage({type:'steamx-physics-height',height:Math.ceil(document.querySelector('body').getBoundingClientRect().height)},globalThis.location.origin);new ResizeObserver(notifyHeight).observe(document.querySelector('body'));notifyHeight();}
}
