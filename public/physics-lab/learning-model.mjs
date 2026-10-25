import {solveCircuit,bulbState,ports,validateScene} from './physics.mjs';

export const LESSONS=[
 {id:'light',title:'点亮第一盏灯',minutes:'5 分钟',goal:'发现灯泡发光需要闭合回路。',question:'只有一条电线连着电池和灯泡，灯会亮吗？',choices:['会亮','不会亮','还不确定'],steps:'先记录未接通时的读数，再亲手接好回路并记录。比较两次电流。',reflection:'用你的两次记录解释：为什么电流需要一条完整的路？',hints:['沿着电池一个端点出发，经过灯泡后，能回到电池的另一个端点吗？','注意高亮的端点。电池和灯泡的两个端点都要接入完整回路。','参考接法：电池正极 → 灯泡一端；灯泡另一端 → 电池负极。线条交叉不会自动接通。'],reference:'single'},
 {id:'switch',title:'开关控制亮灭',minutes:'5 分钟',goal:'通过同一回路的通断解释灯泡亮灭。',question:'只断开开关，电池电压不变，灯泡会怎样？',choices:['熄灭','继续亮','变得更亮'],steps:'记录开关闭合时的读数，再直接点击工作台上的开关断开电路并记录。其他条件保持不变。',reflection:'两次记录中的电压、电流分别有什么变化？开关改变了什么？',hints:['电池还在提供电压，为什么灯泡可能没有电流？','直接点击工作台上的开关切换闭合 / 断开；两次记录只改变开关状态。','参考接法：电池 → 开关 → 灯泡 → 电池。闭合使回路连通，断开切断回路。'],reference:'switch'},
 {id:'voltage',title:'让灯泡更亮',minutes:'8 分钟',goal:'一次只改变电压，用功率比较亮度。',question:'保持灯泡和接线不变，提高电池电压，灯泡会怎样？',choices:['更亮','更暗','一样亮'],steps:'记录一次读数，选中电池调整电压，再记录一次。保留相同的灯泡电阻和接线。',reflection:'用两次电压、电流、功率说明你的发现。实验中哪些条件没有改变？',hints:['这次只研究电压。灯泡电阻和电线连接需要保持不变。','选中电池调整电压。记录表会同时保存灯泡电阻，方便检查是否只改变了一个因素。','参考接法保持单灯闭合回路。恒定电阻模型中 I = U/R、P = U²/R；这里的亮度是功率示意。'],reference:'single'},
 {id:'series',title:'两盏灯串联',minutes:'10 分钟',goal:'与单灯比较，观察相同灯泡串联后的功率。',question:'电池电压不变，把两盏相同灯泡串联，每盏会比原来的单灯怎样？',choices:['更暗','更亮','一样亮'],steps:'先记录单灯。再添加一盏相同电阻的灯泡，重新接成串联后记录。两次使用相同电压。',reflection:'单灯与串联时，每盏灯的功率分别是多少？你怎样解释这个变化？',hints:['串联只有一条经过两盏灯的通路；比较时不要改电池电压。','需要两个相同电阻的灯泡。先删除原来返回电池的电线，再让电流经过第二盏灯。','参考接法：电池正极 → 灯泡 A → 灯泡 B → 电池负极。相同灯泡分担电压，每盏功率为同电压下单灯的四分之一。'],reference:'series'},
 {id:'parallel',title:'并联的独立支路',minutes:'10 分钟',goal:'观察断开一条支路对另一盏灯的影响。',question:'两盏灯并联，断开其中一条支路，另一盏灯会怎样？',choices:['亮度不变','一起熄灭','变得更亮'],steps:'先记录两灯都亮时的读数。删除只属于一盏灯的电线，再记录；保持电池电压和灯泡电阻不变。',reflection:'哪盏灯的功率变为零？另一盏灯的功率如何变化？用支路解释。',hints:['每盏灯能否各自沿一条路回到电池？','只删除一盏灯支路上的电线，不要删除另一盏灯与电池的连接。','参考接法：两盏灯分别接在电池正、负极之间。理想电源电压不变时，断开一支路不会改变另一支路的电压。'],reference:'parallel'},
 {id:'repair',title:'修好故障电路',minutes:'8 分钟',goal:'辨认短路，并用修复前后的读数验证。',question:'电池两端被导线直接连通，灯泡还能正常工作吗？',choices:['不能，需要修复','能，会更亮','还不确定'],steps:'先记录故障状态。找出让电流绕过灯泡的多余电线并删除，再记录修复后的状态。',reflection:'你删除了哪条线？它为什么会造成短路？哪些读数说明已经修好？',hints:['有没有一条完全不经过灯泡、直接连接电池两端的路？','高亮的线路是可以优先检查的地方。让电流必须经过灯泡，不能绕过它。','参考接法保留电池与灯泡组成的闭合回路，删除电池正极直接接到灯泡回路负极一侧的多余电线。短路时本模型停止计算电流，显示 0 不代表真实短路电流为零。'],reference:'single'}
];
export const LEVELS=[
 {id:'primary',name:'入门探索',band:'建议小学 3–6 年级',focus:'先看亮灭与变化，再用完整的话解释；数值作为辅助，不要求公式计算。'},
 {id:'middle',name:'规律探究',band:'建议初中物理阶段',focus:'控制变量，读取单位，用两到三组数据检验电学关系。'},
 {id:'high',name:'综合挑战',band:'建议高中电学阶段',focus:'分析多支路网络，提出定量预测，并说明模型假设与适用范围。'}
];
const primaryPrerequisites=[[],['light'],['light','switch'],['light','voltage'],['series'],['light','switch']];
LESSONS.forEach((l,i)=>{l.level='primary';l.prerequisites=primaryPrerequisites[i];});
LESSONS.find(l=>l.id==='voltage').hints[2]='保持单灯闭合回路，只调整电池电压，观察亮度与功率的变化。真实灯泡还会受到温度影响，这里使用恒定电阻模型。';
LESSONS.find(l=>l.id==='series').hints[2]='参考接法：电池正极 → 灯泡 A → 灯泡 B → 电池负极。两盏相同灯泡串联时分担电压，每盏的功率比同电压下的单灯小。';
LESSONS.push(
 {id:'ohm_u',level:'middle',title:'电压与电流的关系',minutes:'10 分钟',prerequisites:['voltage'],goal:'固定电阻，用三组数据检验 I 与 U 的关系。',question:'保持电阻不变，电压变为原来的 2 倍，电流会怎样？',choices:['变为 2 倍','变为一半','保持不变'],steps:'固定 100 Ω 电阻和接线，记录至少三个不同电压下的电流。计算每组 U/I 并比较。',reflection:'列出三组 U、I 和 U/I（注意 mA 换成 A），解释它们是否支持正比例关系。',hints:['一次只改变电压，不能同时改变电阻。','选中电池，分别设置例如 3 V、6 V、9 V；每次点击记录读数。','单电阻回路中 I = U/R。把电流从 mA 换成 A 后，三组 U/I 应接近同一个阻值。'],reference:'resistor-single'},
 {id:'ohm_r',level:'middle',title:'电阻与电流的关系',minutes:'10 分钟',prerequisites:['ohm_u'],goal:'固定电压，区分反比例与“减去相同数”。',question:'电压不变，把电阻变为原来的 2 倍，电流会怎样？',choices:['变为一半','也变为 2 倍','保持不变'],steps:'保持电源电压和接线不变，记录至少三个不同阻值下的电流。比较 I×R。',reflection:'三组 I×R 是否相同？用数据说明电阻与电流的关系。',hints:['这次只改变电阻，电池电压保持一致。','选中电阻，试试 100 Ω、200 Ω、300 Ω；在记录表查看每个元件的电流。','I = U/R，固定 U 时 I 与 R 成反比；I×R 的单位是 V。'],reference:'resistor-single'},
 {id:'series_r',level:'middle',title:'串联电阻怎样合成',minutes:'12 分钟',prerequisites:['series','ohm_r'],goal:'用等效电阻和各元件读数检验串联规律。',question:'100 Ω 与 200 Ω 电阻串联，等效电阻应是多少？',choices:['300 Ω','150 Ω','约 66.7 Ω'],steps:'记录两电阻串联的读数，再改变其中一个电阻并记录。比较等效电阻与两个阻值之和。',reflection:'两次的 R总、R₁+R₂ 分别是多少？各元件电流与电源总电流有什么关系？',hints:['串联回路中电流只有一条通路。','保持串联接线与电源不变，只修改一个电阻。各元件电压、电流会记入记录表。','R总 = R₁ + R₂，串联各处电流相同；也可用 U总/I总求等效电阻核对。'],reference:'resistor-series'},
 {id:'parallel_r',level:'middle',title:'并联电阻怎样合成',minutes:'12 分钟',prerequisites:['parallel','ohm_r'],goal:'理解并联等效电阻小于任一支路电阻。',question:'100 Ω 与 200 Ω 电阻并联，等效电阻与 100 Ω 相比怎样？',choices:['更小','更大','相等'],steps:'记录两电阻并联，再改变一个支路的阻值并记录，保持电源与接线不变。',reflection:'两次等效电阻是多少？用 1/R总 = 1/R₁ + 1/R₂ 核对，并比较总电流和支路电流。',hints:['增加一条能通电的支路，电源输出的总电流如何变化？','记录表同时显示总电流和每个电阻的电流；不要把总电流当作单条支路电流。','并联电阻两端电压相同；I总 = I₁ + I₂，1/R总 = 1/R₁ + 1/R₂。'],reference:'resistor-parallel'},
 {id:'power_u',level:'middle',title:'电压翻倍，功率呢',minutes:'10 分钟',prerequisites:['ohm_u'],goal:'区分电流倍数与功率倍数。',question:'恒定电阻灯泡两端电压变为 2 倍，功率会怎样？',choices:['变为 4 倍','变为 2 倍','保持不变'],steps:'保持灯泡电阻与接线不变，分别记录一组电压和它的 2 倍电压，例如 4 V 与 8 V。',reflection:'用 P=UI 计算两次功率，再比较电流倍数与功率倍数。真实灯泡为何可能不完全符合？',hints:['先求电流如何变化，再考虑功率还与哪个量有关。','保持同一灯泡，选择两组恰好相差 2 倍的电压。显示亮度会封顶，比较时以功率读数为依据。','在恒定 R 模型中 P = U²/R，电压翻倍时功率变为 4 倍；真实灯丝电阻会随温度变化。'],reference:'single'},
 {id:'power_r',level:'middle',title:'固定电压下比较功率',minutes:'10 分钟',prerequisites:['ohm_r','power_u'],goal:'分清固定电压与固定电流两种条件。',question:'电压保持不变，电阻翻倍，电阻消耗的功率会怎样？',choices:['减半','翻倍','不变'],steps:'在同一单电阻回路中，记录一个阻值和它的 2 倍阻值，保持电源电压不变。',reflection:'两次 I、P 分别是多少？为什么不能只看 P=I²R 中的 R 就断言功率变大？',hints:['改变电阻时，电流是不是也跟着变了？','选中电阻，例如比较 100 Ω 与 200 Ω；不要修改电池。','固定 U 时 P = U²/R；P=I²R 也成立，但此时 I 不是常量。'],reference:'resistor-single'},
 {id:'divider',level:'high',title:'设计一个分压器',minutes:'15 分钟',prerequisites:['series_r'],goal:'通过电阻比例预测输出电压。',question:'两电阻串联且输出端不接负载时，C3 两端电压由什么决定？',choices:['电阻比例与电源电压','只由 C3 阻值决定','始终等于电源电压一半'],steps:'把 C3 作为输出端。固定电源和 C2，只改变 C3，记录至少两种配置，比较预测与实测输出电压。',reflection:'分别计算 U出 = U源×R₃/(R₂+R₃)，与记录的 C3 电压核对，并说明“不接负载”的条件。',hints:['C2 与 C3 中的电流相同，先求回路电流。','保持 C2 不变，只调 C3；记录表中的 C3 电压就是输出电压。','U出 = U源 R₃/(R₂+R₃)。这个分压式要求输出端没有额外支路负载。'],reference:'resistor-series'},
 {id:'loaded_divider',level:'high',title:'分压器接上负载之后',minutes:'18 分钟',prerequisites:['divider','parallel_r'],goal:'识别负载对输出电压的影响。',question:'在分压器 C3 两端并联一个负载电阻，输出电压会怎样？',choices:['下降','上升','不变'],steps:'先记录未接负载的分压器。添加电阻 C4，接到 C3 两端，再记录。原来的电源、C2、C3 参数保持不变。',reflection:'用 R₃∥R₄ 替代下臂电阻计算输出电压。说明为什么不能继续用原来未接负载时的分压值。',hints:['负载接入后，下臂的等效电阻发生了什么变化？','C4 的两个端点要分别接到 C3 的两个端点，形成并联；C2 仍在总回路中串联。','先算 R下 = R₃R₄/(R₃+R₄)，再算 U出 = U源 R下/(R₂+R下)。'],reference:'resistor-mixed'},
 {id:'current_split',level:'high',title:'支路电流怎样分配',minutes:'15 分钟',prerequisites:['parallel_r'],goal:'从支路电流比检验分流关系与节点电流守恒。',question:'两电阻并联，电流较大的支路通常有什么特点？',choices:['电阻较小','电阻较大','只取决于画线长短'],steps:'记录两支路的电流，再改变一个支路阻值记录第二组。固定电源和接线。',reflection:'核对 I₂/I₃=R₃/R₂ 和 I总=I₂+I₃。画布中的导线长度为什么不影响本模型结果？',hints:['两条支路两端电压相同，各自使用欧姆定律。','把总电流与 C2、C3 的电流分开记录，比较电流比和电阻反比。','I₂/I₃=R₃/R₂。理想导线忽略电阻，所以拖动走线不会改变电流。'],reference:'resistor-parallel'},
 {id:'mixed',level:'high',title:'拆解串并联混合网络',minutes:'18 分钟',prerequisites:['series_r','parallel_r','current_split'],goal:'用等效化简预测整个网络，再回到各元件。',question:'C2 与（C3、C4 的并联组合）串联，应该先怎样化简？',choices:['先算 C3∥C4，再加 C2','把三个阻值直接相加','把三个都按并联计算'],steps:'记录当前混联回路，再只改变 C4 阻值并记录。每次先计算等效电阻、总电流，再核对各支路读数。',reflection:'写出两次的化简过程，核对总电流及 C3、C4 的分流。用数据说明哪个元件流过总电流。',hints:['看节点关系，不能只按元件在画布上的位置判断串并联。','C3 与 C4 两端各自相连；C2 位于分支之外。保持原接线，仅修改 C4。','R总=R₂+R₃R₄/(R₃+R₄)，I总=U源/R总。并联部分电压为 U源−I总R₂。'],reference:'resistor-mixed'},
 {id:'network_power',level:'high',title:'同样元件，功率为何不同',minutes:'18 分钟',prerequisites:['power_r','series_r','parallel_r'],goal:'比较连接方式改变后的总功率，检验能量关系。',question:'同一电源下，把同样的两只电阻从串联改成并联，总功率会怎样？',choices:['增大','减小','不变'],steps:'先记录串联电路，再用原来两只电阻改接并联并记录。保持电源电压与两只电阻值不变。',reflection:'比较两次 U源I总 与各电阻功率之和。为什么元件没变，总功率却不同？',hints:['先比较两种连接方式的等效电阻，再比较电源总电流。','重新接线时不要增删电阻或修改参数；记录表保留每个电阻的功率。','理想网络中 P总=U源I总=ΣP元件。固定电压时，并联等效电阻更小，总功率更大。'],reference:'resistor-parallel'},
 {id:'max_power',level:'high',title:'带内阻电源的负载功率',minutes:'20 分钟',prerequisites:['divider','power_r'],goal:'用等效模型研究负载功率的极值与条件。',question:'把 C2 的 100 Ω 视为电源内阻、C3 视为负载，怎样选择负载电阻使其功率最大？',choices:['负载电阻等于内阻','负载越大越好','负载越小越好'],steps:'固定理想电源和 C2=100 Ω，记录 C3=50 Ω、100 Ω、200 Ω 三种情况。只比较 C3 消耗的功率。',reflection:'比较三组负载功率，用 P负载=U源²R负载/(r+R负载)² 解释最大值，并区分负载功率与电源总功率。',hints:['负载变小时电流增大，但负载两端的电压也在变。','C2 是用来等效内阻的外置电阻，不要修改；只调 C3，并观察其电压与功率。','负载与内阻相等时负载功率最大。此结论针对固定电动势、固定内阻模型，不等于效率最大。'],reference:'resistor-series'}
);
export const levelById=id=>LEVELS.find(l=>l.id===id);
export const lessonById=id=>LESSONS.find(l=>l.id===id);
const copy=x=>JSON.parse(JSON.stringify(x));
export function lessonScene(kind){
 if(kind.startsWith('resistor-'))return resistorScene(kind.slice(9));
 const components=[{id:'c1',type:'battery',x:240,y:220,value:9},{id:'c2',type:'bulb',x:700,y:220,value:100}],wires=[];
 const wire=(a,ap,b,bp)=>wires.push({id:'w'+(wires.length+1),a:{id:a,port:ap},b:{id:b,port:bp},...(b==='c1'&&bp===0?{route:'return'}:{})});
 if(kind==='switch'){components[1].y=390;components.push({id:'c3',type:'switch',x:600,y:220,closed:true});wire('c1',1,'c3',0);wire('c3',1,'c2',0);wire('c2',1,'c1',0);}
 else if(kind==='series'){components.push({id:'c3',type:'bulb',x:700,y:410,value:100});wire('c1',1,'c2',0);wire('c2',1,'c3',0);wire('c3',1,'c1',0);}
 else if(kind==='parallel'){components.push({id:'c3',type:'bulb',x:700,y:410,value:100});wire('c1',1,'c2',0);wire('c2',1,'c1',0);wire('c1',1,'c3',0);wire('c3',1,'c1',0);}
 else {wire('c1',1,'c2',0);if(kind!=='light')wire('c2',1,'c1',0);if(kind==='repair')wire('c1',1,'c2',1);}
 return {version:1,mode:'circuit',name:lessonById(kind)?.title||'参考电路',components,wires};
}
export function resistorScene(kind){
 const s=lessonScene(kind==='mixed'?'series':kind==='single'?'single':kind);
 s.components.forEach(c=>{if(c.type==='bulb')c.type='resistor';});
 if(s.components[2])s.components[2].value=200;
 if(kind==='mixed'){s.components.push({id:'c4',type:'resistor',x:440,y:420,value:200});s.wires.push({id:'w4',a:{id:'c3',port:0},b:{id:'c4',port:0}},{id:'w5',a:{id:'c3',port:1},b:{id:'c4',port:1}});}
 s.name='定量电路探究';return s;
}
export function startScene(id){
 const refs={ohm_u:'resistor-single',ohm_r:'resistor-single',series_r:'resistor-series',parallel_r:'resistor-parallel',power_u:'single',power_r:'resistor-single',divider:'resistor-series',loaded_divider:'resistor-series',current_split:'resistor-parallel',mixed:'resistor-mixed',network_power:'resistor-series',max_power:'resistor-series'};
 const scene=lessonScene(refs[id]||(id==='series'?'single':id));scene.name=lessonById(id)?.title||scene.name;
 if(id==='max_power')scene.components.find(c=>c.id==='c3').value=50;
 return scene;
}
export function measure(scene){
 const r=solveCircuit(scene.components,scene.wires),loads=scene.components.filter(c=>['bulb','resistor'].includes(c.type)).map(c=>({id:c.id,type:c.type,resistance:c.value,...bulbState(c,r)})),bulbs=loads.filter(c=>c.type==='bulb');
 const near=(a,b)=>Math.abs(a-b)<1e-7;
 let topology='其他';
 if(r.active&&loads.length===1)topology=bulbs.length?'单灯':'单电阻';
 if(r.active&&loads.length===2&&loads.every(b=>near(b.voltage,r.voltage)))topology='并联';
 else if(r.active&&loads.length===2&&loads.every(b=>near(b.current,r.current)))topology='串联';
 return {voltage:r.voltage,current:r.short?null:r.current,resistance:r.active?r.resistance:null,power:r.short?null:r.power,active:r.active,short:!!r.short,status:r.status,topology,bulbs,loads};
}
const basic=(s,bulbs,switches=0)=>s.components.length===1+bulbs+switches&&s.components.filter(c=>c.type==='battery').length===1&&s.components.filter(c=>c.type==='bulb').length===bulbs&&s.components.filter(c=>c.type==='switch').length===switches;
const parameterKey=(s,omit='')=>JSON.stringify(s.components.map(c=>({id:c.id,type:c.type,value:omit==='voltage'&&c.type==='battery'?null:c.value,closed:omit==='switch'?null:c.closed})).sort((a,b)=>a.id.localeCompare(b.id)));
const wireKey=s=>JSON.stringify(s.wires.map(w=>[`${w.a.id}:${w.a.port}`,`${w.b.id}:${w.b.port}`].sort().join('-')).sort());
const approx=(a,b)=>Math.abs(a-b)<1e-7;
const resistive=(s,n)=>s.components.length===n+1&&s.components.filter(c=>c.type==='battery').length===1&&s.components.filter(c=>c.type==='resistor').length===n;
const sameSource=(a,b)=>approx(a.m.voltage,b.m.voltage);
const load=(item,id)=>item.m.loads.find(l=>l.id===id);
const varyingOnly=(a,b,id,field='value')=>{
 if(wireKey(a.s)!==wireKey(b.s))return false;
 const strip=s=>parameterKey({...s,components:s.components.map(c=>c.id===id?{...c,[field]:null}:c)});
 return strip(a.s)===strip(b.s)&&a.s.components.find(c=>c.id===id)?.[field]!==b.s.components.find(c=>c.id===id)?.[field];
};
const mixedNetwork=item=>resistive(item.s,3)&&item.m.active&&approx(load(item,'c2')?.current,item.m.current)&&approx(load(item,'c3')?.voltage,load(item,'c4')?.voltage)&&approx(load(item,'c3')?.current+load(item,'c4')?.current,item.m.current);
export function evidence(id,records){
 const items=records.map(r=>({s:r.scene,m:measure(r.scene)}));let ready=false;
 const hasPair=fn=>items.some(a=>items.some(b=>a!==b&&fn(a,b)));
 if(id==='light')ready=hasPair((a,b)=>basic(a.s,1)&&basic(b.s,1)&&!a.m.active&&!a.m.short&&b.m.active&&parameterKey(a.s)===parameterKey(b.s));
 if(id==='switch')ready=hasPair((a,b)=>basic(a.s,1,1)&&basic(b.s,1,1)&&a.m.active&&!b.m.active&&!b.m.short&&parameterKey(a.s,'switch')===parameterKey(b.s,'switch')&&wireKey(a.s)===wireKey(b.s)&&a.s.components.some(c=>c.type==='switch'&&c.closed)&&b.s.components.some(c=>c.type==='switch'&&!c.closed));
 if(id==='voltage')ready=hasPair((a,b)=>basic(a.s,1)&&basic(b.s,1)&&a.m.active&&b.m.active&&!approx(a.m.voltage,b.m.voltage)&&parameterKey(a.s,'voltage')===parameterKey(b.s,'voltage')&&wireKey(a.s)===wireKey(b.s));
 if(id==='series')ready=hasPair((a,b)=>basic(a.s,1)&&basic(b.s,2)&&a.m.active&&b.m.topology==='串联'&&approx(a.m.voltage,b.m.voltage)&&b.m.bulbs.every(l=>approx(l.resistance,a.m.bulbs[0].resistance)));
 if(id==='parallel')ready=hasPair((a,b)=>basic(a.s,2)&&basic(b.s,2)&&a.m.topology==='并联'&&b.m.active&&parameterKey(a.s)===parameterKey(b.s)&&b.m.bulbs.filter(l=>l.power>1e-8).length===1&&b.m.bulbs.some(l=>l.power>1e-8&&approx(l.power,a.m.bulbs.find(x=>x.id===l.id)?.power)));
 if(id==='repair')ready=hasPair((a,b)=>basic(a.s,1)&&basic(b.s,1)&&a.m.short&&b.m.active&&parameterKey(a.s)===parameterKey(b.s));
 if(id==='ohm_u'||id==='ohm_r'){
  const prop=id==='ohm_u'?'c1':'c2';
  ready=items.some(a=>resistive(a.s,1)&&a.m.active&&new Set(items.filter(b=>resistive(b.s,1)&&b.m.active&&(b===a||varyingOnly(a,b,prop))).map(b=>b.s.components.find(c=>c.id===prop)?.value)).size>=3);
 }
 if(id==='series_r'||id==='parallel_r'||id==='current_split')ready=hasPair((a,b)=>resistive(a.s,2)&&resistive(b.s,2)&&a.m.topology===(id==='series_r'?'串联':'并联')&&b.m.topology===a.m.topology&&sameSource(a,b)&&(varyingOnly(a,b,'c2')||varyingOnly(a,b,'c3')));
 if(id==='power_u')ready=hasPair((a,b)=>basic(a.s,1)&&basic(b.s,1)&&a.m.active&&b.m.active&&varyingOnly(a,b,'c1')&&approx(b.m.voltage,2*a.m.voltage));
 if(id==='power_r')ready=hasPair((a,b)=>resistive(a.s,1)&&resistive(b.s,1)&&a.m.active&&b.m.active&&sameSource(a,b)&&varyingOnly(a,b,'c2')&&approx(load(b,'c2')?.resistance,2*load(a,'c2')?.resistance));
 if(id==='divider')ready=hasPair((a,b)=>resistive(a.s,2)&&resistive(b.s,2)&&a.m.topology==='串联'&&b.m.topology==='串联'&&sameSource(a,b)&&varyingOnly(a,b,'c3'));
 if(id==='loaded_divider')ready=hasPair((a,b)=>resistive(a.s,2)&&a.m.topology==='串联'&&mixedNetwork(b)&&sameSource(a,b)&&['c2','c3'].every(id=>approx(load(a,id)?.resistance,load(b,id)?.resistance))&&load(b,'c3').voltage<load(a,'c3').voltage);
 if(id==='mixed')ready=hasPair((a,b)=>mixedNetwork(a)&&mixedNetwork(b)&&sameSource(a,b)&&varyingOnly(a,b,'c4'));
 if(id==='network_power')ready=hasPair((a,b)=>resistive(a.s,2)&&resistive(b.s,2)&&a.m.topology==='串联'&&b.m.topology==='并联'&&parameterKey(a.s)===parameterKey(b.s));
 if(id==='max_power')ready=items.some(a=>resistive(a.s,2)&&a.m.topology==='串联'&&approx(load(a,'c2')?.resistance,100)&&approx(load(a,'c3')?.resistance,100)&&[50,200].every(v=>items.some(b=>resistive(b.s,2)&&b.m.topology==='串联'&&sameSource(a,b)&&varyingOnly(a,b,'c3')&&approx(load(b,'c3')?.resistance,v))));
 const needs={ohm_u:'固定同一电阻与接线，记录至少三个不同电压。',ohm_r:'固定电压与接线，记录至少三个不同阻值。',series_r:'记录两种串联配置，只改变一个电阻。',parallel_r:'记录两种并联配置，只改变一个支路电阻。',power_u:'记录同一灯泡在一组电压和其 2 倍电压下的读数。',power_r:'记录同电压下一个阻值与其 2 倍阻值，其他条件不变。',divider:'固定电源与 C2，只改变 C3，记录两组串联读数。',loaded_divider:'记录分压器接负载前后；保留原参数，将 C4 并联在 C3 两端。',current_split:'固定电源与并联接线，只改变一个支路电阻，记录两组。',mixed:'保持混联接线和其他参数，只改 C4，记录两组。',network_power:'使用同一电源和同样两只电阻，分别记录串联与并联。',max_power:'固定电源及 C2=100 Ω，分别记录 C3=50 Ω、100 Ω、200 Ω。',light:'记录同一组电池、灯泡未接通和接通后的两组数据。',switch:'记录同一电路开关闭合、断开两种状态，其他条件不变。',voltage:'至少记录两种电压；灯泡电阻、接线和元件保持不变。',series:'记录同电压下的单灯与两盏相同灯泡串联，灯泡电阻保持一致。',parallel:'记录双灯并联，以及断开一支路后另一灯保持原功率的状态。',repair:'记录短路状态和修复后的闭合回路，电池、灯泡参数不变。'};
 return {ready,message:ready?'已记录可比较的实验数据。请用这些证据写下解释。':needs[id]||'记录读数，比较变化，再解释发现。'};
}
export function hintTargets(scene){
 const r=measure(scene);
 if(r.short){const repairable=scene.wires.filter(w=>{const m=measure({...scene,wires:scene.wires.filter(x=>x.id!==w.id)});return m.active&&m.bulbs.some(b=>b.power>0);});return {wires:repairable.map(w=>w.id),components:scene.components.filter(c=>c.type==='battery').map(c=>c.id),ports:[]};}
 const unused=scene.components.flatMap(c=>ports(c).map((_,port)=>({id:c.id,port}))).filter(p=>!scene.wires.some(w=>[w.a,w.b].some(q=>q.id===p.id&&q.port===p.port)));
 return {wires:[],ports:unused,components:scene.components.filter(c=>c.type==='switch'&&!c.closed).map(c=>c.id)};
}
export function restoreNotebook(raw){
 const empty={version:1,lastId:null,sessions:[]};
 try {const data=typeof raw==='string'?JSON.parse(raw):raw;if(!data||data.version!==1||!Array.isArray(data.sessions))return empty;
 const sessions=data.sessions.slice(0,30).flatMap(s=>{try{if(!s||typeof s.id!=='string'||s.id.length>100||!(s.lessonId===null||lessonById(s.lessonId)))return [];const lesson=lessonById(s.lessonId);const prediction=lesson?.choices.includes(s.prediction)?s.prediction:'';const records=(Array.isArray(s.records)?s.records:[]).slice(0,20).flatMap(r=>{try{const scene=validateScene(copy(r.scene));if(scene.mode!=='circuit')return [];return [{id:String(r.id).slice(0,100),at:String(r.at).slice(0,50),scene,note:String(r.note||'').slice(0,500)}];}catch{return [];}});let workingScene=null;try{workingScene=validateScene(copy(s.workingScene));if(workingScene.mode!=='circuit')workingScene=null;}catch{}
 const session={id:s.id,lessonId:s.lessonId,startedAt:String(s.startedAt||''),prediction,reason:String(s.reason||'').slice(0,500),reflection:String(s.reflection||'').slice(0,1500),hintLevel:Math.max(0,Math.min(3,Number(s.hintLevel)||0)),records,workingScene,completedAt:null};if(s.completedAt&&prediction&&session.reason.trim()&&session.reflection.trim()&&evidence(s.lessonId,records).ready)session.completedAt=String(s.completedAt);return [session];}catch{return [];}});
 return {version:1,lastId:sessions.some(s=>s.id===data.lastId)?data.lastId:null,sessions};}catch{return empty;}
}
export function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export const number=(x,d=3)=>x===null||!Number.isFinite(x)?'—':Number(x.toFixed(d)).toString();
export function reportHTML(session){
 const lesson=lessonById(session.lessonId),e=escapeHTML;
 const rows=session.records.map((r,i)=>{const m=measure(r.scene);return `<tr><td>${i+1}</td><td>${e(new Date(r.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}))}</td><td>${e(m.status)}</td><td>${number(m.voltage)}</td><td>${m.current===null?'—':number(m.current*1000)}</td><td>${number(m.resistance)}</td><td>${number(m.power,4)}</td><td>${m.loads.map(b=>`${e(b.id.toUpperCase())}: ${m.short?'—':number(b.power,4)} W / ${number(b.resistance)} Ω / ${number(b.voltage)} V / ${m.short?'—':number(b.current*1000)} mA`).join('<br>')}</td><td>${e(r.note)}</td></tr>`;}).join('');
 return `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><title>创探空间 实验记录</title><style>body{font:16px/1.7 system-ui,sans-serif;max-width:1050px;margin:40px auto;padding:24px;color:#234238}h1{color:#247562}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px;border:1px solid #c8d7ce;text-align:left;vertical-align:top}.note{white-space:pre-wrap}small{color:#587568}@media print{body{margin:0;padding:0}tr{break-inside:avoid}}</style><p>创探空间 · 物理实验室</p><h1>${e(lesson?.title||'自由探索')} · 实验报告</h1><p>${e(lesson?.question||'记录搭建与发现')}</p><p>${e(levelById(lesson?.level)?.band||'自由探索')} · ${e(levelById(lesson?.level)?.focus||'')}</p><h2>我的预测</h2><p class="note">${e(session.prediction||'自由探索')}<br>${e(session.reason)}</p><h2>实验记录</h2><table><thead><tr><th>次序</th><th>时间（北京时间）</th><th>电路状态</th><th>电压 V</th><th>总电流 mA</th><th>等效电阻 Ω</th><th>总功率 W</th><th>各元件功率 / 电阻 / 电压 / 电流</th><th>观察</th></tr></thead><tbody>${rows}</tbody></table><h2>我的解释</h2><p class="note">${e(session.reflection||'尚未填写')}</p><p>${session.completedAt?'探究记录已完成，解释可与老师讨论。':'探究记录进行中。'}</p><small>理想直流电源、恒定电阻灯泡。亮度是功率示意，不模拟灯丝温度与烧毁。短路时停止计算，总电流以「—」表示；不能据此认为真实短路电流为零。预测没有对错门槛，完成记录不代表系统评定知识掌握。</small></html>`;
}
