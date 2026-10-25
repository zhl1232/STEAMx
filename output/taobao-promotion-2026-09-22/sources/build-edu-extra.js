const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const out = path.resolve(__dirname, '..');
const src = '/mnt/d/创探空间-1688素材/chuangtan-1688-main-images/main-images';
const scene = path.join(__dirname, '09-edu-learning-scene.png');
const C={paper:'#fbfaf5',dark:'#174842',muted:'#61736e',orange:'#f36a1a',line:'#dcebe5',white:'#ffffff'};
const svg=(w,h,body)=>Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:'WenQuanYi Zen Hei',sans-serif}</style>${body}</svg>`);
const t=(x,y,s,size=30,color=C.dark,weight=700)=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}">${s}</text>`;
async function save(name,w,h,parts,q=88){await sharp({create:{width:w,height:h,channels:3,background:C.paper}}).composite(parts).jpeg({quality:q,mozjpeg:true}).toFile(path.join(out,name));}
(async()=>{
// Exact pixels from the original 1688 carton, masking only the surrounding ad area.
const productMask=svg(1080,1080,`<polygon points="136,185 906,166 1018,178 1017,742 275,892 136,739" fill="white"/>`);
const product=await sharp(path.join(src,'main-02.jpg')).ensureAlpha().composite([{input:productMask,blend:'dest-in'}]).png().toBuffer();
const productScaled=await sharp(product).resize(725,725).toBuffer();
const base07=svg(750,1050,`<defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c5068"/><stop offset="1" stop-color="#142c61"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#ffce7a"/><stop offset="1" stop-color="#ff9d40"/></radialGradient></defs><rect width="750" height="1050" fill="#edf8f4"/><rect width="750" height="305" fill="url(#sky)"/><circle cx="657" cy="64" r="118" fill="#317e91" opacity=".25"/><circle cx="645" cy="208" r="5" fill="#ffce6d"/><circle cx="583" cy="110" r="4" fill="white"/><circle cx="700" cy="154" r="3" fill="white"/><path d="M554 195l8-17 8 17 17 8-17 8-8 17-8-17-17-8z" fill="#ffca64"/><path d="M0 305 Q160 345 328 306 T750 310 V1050 H0Z" fill="#edf8f4"/><circle cx="410" cy="580" r="290" fill="url(#glow)" opacity=".72"/><circle cx="625" cy="512" r="64" fill="#73d1cb" opacity=".8"/><path d="M34 615 Q80 555 142 557" fill="none" stroke="#1d8f99" stroke-width="11" stroke-linecap="round" opacity=".6"/><path d="M563 807 Q661 781 720 713" fill="none" stroke="#f3782b" stroke-width="12" stroke-linecap="round" opacity=".6"/><circle cx="57" cy="408" r="8" fill="#ff8934"/><circle cx="683" cy="747" r="7" fill="#0e8e9d"/><rect x="35" y="862" width="680" height="138" rx="26" fill="white"/>`);
const top07=svg(750,1050,`<rect x="37" y="36" width="311" height="46" rx="23" fill="#ff792f"/>${t(56,68,'创探空间 · 科教版',23,'#fff')}${t(36,154,'把好奇心',62,'#fff')}${t(36,236,'装进实验盒！',66,'#ffd171')}<path d="M37 256 Q233 281 480 258" fill="none" stroke="#ff8641" stroke-width="7" stroke-linecap="round"/><circle cx="681" cy="350" r="43" fill="#ff782e"/>${t(652,357,'动手',25,'#fff')}<path d="M76 831l8-17 8 17 17 8-17 8-8 17-8-17-17-8z" fill="#ff9a48"/>${t(59,911,'选年级',29,C.dark)}${t(291,911,'看说明',29,C.dark)}${t(520,911,'做实验',29,C.dark)}<circle cx="238" cy="902" r="6" fill="#ff792f"/><circle cx="469" cy="902" r="6" fill="#ff792f"/>${t(72,965,'所选规格材料与说明配套 · 具体内容以实物为准',22,C.muted,400)}`);
await save('07-科教版包装展示.jpg',750,1050,[{input:base07,left:0,top:0},{input:productScaled,left:12,top:175},{input:top07,left:0,top:0}],89);
// The original 20-29 SKU visuals are used only as thumbnails. No projects are re-assigned.
const specs=[['幼儿园小班',20],['幼儿园中班',21],['幼儿园大班',22],['小学一年级',23],['小学二年级',24],['小学三年级',25],['小学四年级',26],['小学五年级',27],['小学六年级',28],['初中科学',29]];
const parts=[];let bg=`<rect x="0" y="0" width="750" height="1510" fill="${C.paper}"/><rect x="38" y="38" width="8" height="110" rx="4" fill="${C.orange}"/>${t(64,77,'按年龄与年级选',27,C.muted)}${t(64,133,'选对自己的实验套装',50)}${t(39,190,'每个规格独立成套，选购前核对商品选项与清单',24,C.muted,400)}`;
for(let i=0;i<specs.length;i++){const [label,num]=specs[i],col=i%2,row=Math.floor(i/2),x=28+col*352,y=225+row*228;bg+=`<rect x="${x}" y="${y}" width="342" height="211" rx="22" fill="white" stroke="${C.line}" stroke-width="2"/>${t(x+160,y+81,label,26,C.dark)}${t(x+160,y+123,'独立规格',20,C.muted,400)}<rect x="${x+160}" y="${y+152}" width="151" height="3" fill="${C.orange}"/>`;let thumb=await sharp(path.join(src,`main-${String(num).padStart(2,'0')}.jpg`)).resize(135,135).jpeg().toBuffer();parts.push({input:thumb,left:x+14,top:y+38});}
bg+=`<rect x="34" y="1390" width="682" height="1" fill="${C.line}"/>${t(43,1434,'图示仅帮助识别规格，具体项目与材料以所选规格为准',20,C.muted,400)}`;
parts.unshift({input:svg(750,1510,bg),left:0,top:0});await save('08-科教版规格选择.jpg',750,1510,parts,87);
const sceneCrop=await sharp(scene).resize(750,950,{fit:'cover',position:'centre'}).toBuffer();
const overlay=svg(750,1290,`<rect x="0" y="0" width="750" height="260" fill="${C.paper}"/><rect x="35" y="38" width="8" height="119" rx="4" fill="${C.orange}"/>${t(62,82,'跟着说明，一起动手',29,C.muted)}${t(62,148,'在实验中发现问题',52)}${t(62,205,'观察 · 尝试 · 记录 · 分享',28,C.dark,400)}<rect x="0" y="1190" width="750" height="100" fill="${C.paper}"/>${t(39,1236,'场景示意，并非实物清单；项目以所选规格为准',23,C.muted,400)}${t(39,1272,'建议在成人指导下操作',21,C.muted,400)}`);
await save('09-科教版实验场景.jpg',750,1290,[{input:sceneCrop,left:0,top:250},{input:overlay,left:0,top:0}],89);
})().catch(e=>{console.error(e);process.exit(1)});
