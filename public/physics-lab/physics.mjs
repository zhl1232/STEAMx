export const G=9.81;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function ports(c){
  if(['battery','resistor','bulb','switch'].includes(c.type))return [{x:c.x-64,y:c.y},{x:c.x+64,y:c.y}];
  if(c.type==='spring')return [{x:c.x,y:c.y+30}];
  if(c.type==='pulley')return [{x:c.x-52,y:c.y+10},{x:c.x+52,y:c.y+10}];
  if(c.type==='mass')return [{x:c.x,y:c.y-31}];
  return [];
}
export function solveCircuit(components,wires){
  const batteries=components.filter(c=>c.type==='battery');
  const resistors=components.filter(c=>['resistor','bulb'].includes(c.type));
  const empty={current:0,resistance:0,power:0,voltage:batteries[0]?.value||0,branchCurrents:{},potentials:{},active:false};
  if(batteries.length!==1)return {...empty,status:batteries.length?'本版支持一个电源':'添加一个电池'};
  const ids=new Set(components.map(c=>c.id)),parent={};
  const key=(id,p)=>`${id}:${p}`;
  components.forEach(c=>ports(c).forEach((_,i)=>parent[key(c.id,i)]=key(c.id,i)));
  const find=k=>parent[k]===k?k:(parent[k]=find(parent[k]));
  wires.forEach(w=>{if(ids.has(w.a.id)&&ids.has(w.b.id)&&parent[key(w.a.id,w.a.port)]&&parent[key(w.b.id,w.b.port)])parent[find(key(w.a.id,w.a.port))]=find(key(w.b.id,w.b.port));});
  components.filter(c=>c.type==='switch'&&c.closed).forEach(c=>parent[find(key(c.id,0))]=find(key(c.id,1)));
  const battery=batteries[0],neg=find(key(battery.id,0)),pos=find(key(battery.id,1));
  if(neg===pos)return {...empty,status:'电源短路 · 请断开导线',short:true};
  const edges=resistors.map(c=>({id:c.id,a:find(key(c.id,0)),b:find(key(c.id,1)),r:c.value}));
  const reachable=new Set([neg,pos]);let changed=true;
  while(changed){changed=false;edges.forEach(e=>{if(reachable.has(e.a)||reachable.has(e.b)){if(!reachable.has(e.a)||!reachable.has(e.b))changed=true;reachable.add(e.a);reachable.add(e.b);}});}
  const unknown=[...reachable].filter(x=>x!==neg&&x!==pos),n=unknown.length;
  const idx=Object.fromEntries(unknown.map((k,i)=>[k,i]));
  const matrix=Array.from({length:n},()=>Array(n+1).fill(0));
  edges.forEach(e=>{if(e.a===e.b)return;[[e.a,e.b],[e.b,e.a]].forEach(([a,b])=>{if(idx[a]===undefined)return;const i=idx[a],conductance=1/e.r;matrix[i][i]+=conductance;if(idx[b]!==undefined)matrix[i][idx[b]]-=conductance;else if(b===pos)matrix[i][n]+=conductance*battery.value;});});
  for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(matrix[j][i])>Math.abs(matrix[pivot][i]))pivot=j;[matrix[i],matrix[pivot]]=[matrix[pivot],matrix[i]];if(Math.abs(matrix[i][i])<1e-10)return {...empty,status:'电路未形成有效回路'};const d=matrix[i][i];for(let k=i;k<=n;k++)matrix[i][k]/=d;for(let j=0;j<n;j++){if(j===i)continue;const s=matrix[j][i];for(let k=i;k<=n;k++)matrix[j][k]-=s*matrix[i][k];}}
  const potentials={[neg]:0,[pos]:battery.value};unknown.forEach((k,i)=>potentials[k]=matrix[i][n]);
  let current=0;const branchCurrents={};
  edges.forEach(e=>{const a=potentials[e.a],b=potentials[e.b];const c=(a!==undefined&&b!==undefined)?(a-b)/e.r:0;branchCurrents[e.id]=c;if(e.a===pos)current+=c;if(e.b===pos)current-=c;});
  current=Math.max(0,current);return {...empty,current,resistance:current>1e-9?battery.value/current:0,power:battery.value*current,branchCurrents,potentials,active:current>1e-9,status:current>1e-9?'回路已闭合':'开路 · 连接端点形成回路'};
}
export function springState(m,k,t,damping=0){
  const eq=m*G/k,omega=Math.sqrt(k/m),decay=damping*omega/2;
  if(damping===0)return {extension:eq*(1-Math.cos(omega*t)),velocity:eq*omega*Math.sin(omega*t),equilibrium:eq,period:2*Math.PI/omega};
  const wd=Math.sqrt(Math.max(.0001,omega*omega-decay*decay));
  const z=Math.exp(-decay*t),c=Math.cos(wd*t),s=Math.sin(wd*t);
  return {extension:eq*(1-z*(c+decay/wd*s)),velocity:eq*z*(wd+decay*decay/wd)*s,equilibrium:eq,period:2*Math.PI/wd};
}
export function atwoodState(left,right,t){const acceleration=G*(right-left)/(left+right);return {acceleration,tension:2*left*right*G/(left+right),travel:.5*acceleration*t*t,velocity:acceleration*t};}
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const norm=v=>{const d=Math.hypot(v.x,v.y);return {x:v.x/d,y:v.y/d};};
export function traceRays(components){
  const sources=components.filter(c=>c.type==='source'),objects=components.filter(c=>['lens','mirror'].includes(c.type)),rays=[];
  const boundary=(p,d)=>{let t=1e6;[[0,'x'],[1000,'x'],[50,'y'],[570,'y']].forEach(([v,ax])=>{if(Math.abs(d[ax])<1e-8)return;const q=(v-p[ax])/d[ax];if(q>1e-3)t=Math.min(t,q);});return {x:p.x+d.x*t,y:p.y+d.y*t};};
  for(const source of sources)for(const offset of [-48,0,48]){
    const a=(source.angle||0)*Math.PI/180;let direction={x:Math.cos(a),y:Math.sin(a)},point={x:source.x-Math.sin(a)*offset+32*direction.x,y:source.y+Math.cos(a)*offset+32*direction.y},path=[point],last=null;
    for(let bounce=0;bounce<8;bounce++){
      let hit=null;
      for(const c of objects){if(c.id===last)continue;let t,y;
        if(c.type==='lens'){if(Math.abs(direction.x)<1e-8)continue;t=(c.x-point.x)/direction.x;y=point.y+t*direction.y;if(t>.05&&Math.abs(y-c.y)<110&&(!hit||t<hit.t))hit={c,t,p:{x:c.x,y}};}
        else {const theta=(c.angle||0)*Math.PI/180,tangent={x:Math.sin(theta),y:Math.cos(theta)},q={x:c.x-point.x,y:c.y-point.y},den=cross(direction,tangent);if(Math.abs(den)<1e-8)continue;t=cross(q,tangent)/den;const u=cross(q,direction)/den;if(t>.05&&Math.abs(u)<105&&(!hit||t<hit.t))hit={c,t,p:{x:point.x+t*direction.x,y:point.y+t*direction.y}};}
      }
      if(!hit){path.push(boundary(point,direction));break;}path.push(hit.p);
      const c=hit.c;if(c.type==='mirror'){const a=(c.angle||0)*Math.PI/180,n={x:Math.cos(a),y:-Math.sin(a)},d=dot(direction,n);direction={x:direction.x-2*d*n.x,y:direction.y-2*d*n.y};}
      else {const sign=Math.sign(direction.x),slope=direction.y/Math.abs(direction.x)-(hit.p.y-c.y)/c.value;direction=norm({x:sign,y:slope});}
      point={x:hit.p.x+direction.x*.1,y:hit.p.y+direction.y*.1};last=c.id;
    }
    rays.push({source:source.id,offset,path});
  }
  return rays;
}
export function validateScene(s){
  if(!s||s.version!==1||!['circuit','optics','mechanics'].includes(s.mode)||!Array.isArray(s.components)||!Array.isArray(s.wires)||s.components.length>40||s.wires.length>100)throw Error('实验文件格式不支持');
  const allowed={circuit:['battery','resistor','bulb','switch'],optics:['source','lens','mirror'],mechanics:['spring','pulley','mass']},ids=new Set();
  for(const c of s.components){if(!allowed[s.mode].includes(c.type)||typeof c.id!=='string'||!/^c\d+$/.test(c.id)||ids.has(c.id)||!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<50||c.x>950||c.y<75||c.y>535)throw Error('组件数据无效');ids.add(c.id);if(c.type==='switch'&&typeof c.closed!=='boolean')throw Error('开关状态无效');if(c.type==='battery'&&(!Number.isFinite(c.value)||c.value<1||c.value>24)||['resistor','bulb'].includes(c.type)&&(!Number.isFinite(c.value)||c.value<1||c.value>1000)||c.type==='lens'&&(!Number.isFinite(c.value)||Math.abs(c.value)<60||Math.abs(c.value)>300)||c.type==='mass'&&(!Number.isFinite(c.value)||c.value<.5||c.value>5)||c.type==='spring'&&(!Number.isFinite(c.value)||c.value<20||c.value>200))throw Error('组件参数超出范围');if(c.angle!==undefined&&(!Number.isFinite(c.angle)||c.angle<-90||c.angle>90))throw Error('角度无效');if(c.damping!==undefined&&(!Number.isFinite(c.damping)||c.damping<0||c.damping>.8))throw Error('阻尼无效');}
  const usedPorts=new Set(),wireIds=new Set();
  for(const w of s.wires){if(!w||typeof w.id!=='string'||!/^w\d+$/.test(w.id)||wireIds.has(w.id))throw Error('连线数据无效');wireIds.add(w.id);if(w.points!==undefined&&(!Array.isArray(w.points)||w.points.length>40||w.points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1000||p.y<0||p.y>600)))throw Error('电线走线数据无效');for(const p of [w.a,w.b]){const c=s.components.find(c=>c.id===p?.id);if(!c||!Number.isInteger(p.port)||!ports(c)[p.port])throw Error('连线端点无效');if(s.mode==='mechanics'){const k=p.id+':'+p.port;if(usedPorts.has(k))throw Error('力学端点只能连接一次');usedPorts.add(k);}}if(w.a.id===w.b.id)throw Error('不能连接自身');if(s.mode==='mechanics'){const types=[w.a,w.b].map(p=>s.components.find(c=>c.id===p.id).type);if(types.filter(t=>t==='mass').length!==1)throw Error('力学连接需连接一个重物');}}
  return s;
}

export function bulbState(c,result){const current=Math.abs(result.branchCurrents[c.id]||0),power=current*current*c.value;return {current,power,voltage:current*c.value,brightness:clamp(power/.81,0,1)};}
