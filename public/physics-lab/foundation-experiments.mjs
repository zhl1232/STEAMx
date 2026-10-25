// Deterministic foundation experiments. Display-unit conversions happen at the input boundary.
import { control, fmt, metric, text, line, arrow, circle, rect } from './experiment-kit.mjs';

const lesson = (id, topic, title, stages, goal, question, controls, guides, limit, formula, prerequisite) => ({
  id, topic, title, stages, band: stages.includes('primary') ? '小学观察 · 初高中探究' : stages.includes('middle') ? '初中观察 · 高中定量' : '高中物理',
  goal, question, controls, guides, limit, formula, prerequisite,
});
export const FOUNDATION_EXPLORATIONS = [
  lesson('reflection', 'light', '镜子怎样改变光路', ['primary', 'middle', 'high'], '旋转入射光，比较法线两侧的角度。', '光线更贴近镜面时，反射角怎样改变？', [control('angle', '入射角（相对法线）', 0, 85, 1, 35, '°')],
    ['先预测反射光方向，再调整入射角。', '只改变入射角，记录入射角和反射角三组数据。', '用光路可逆性解释从反射方向射回的光会去哪里。'],
    '理想平面镜、几何光学；角度相对法线，线条长度不表示光强。', 'θ反射 = θ入射', '直线传播与角度'),
  lesson('lens-image', 'light', '凸透镜成什么像', ['middle', 'high'], '改变物距与焦距，比较实像、虚像及大小。', '物体经过焦点时，像的位置和方向怎样变化？', [control('distance', '物距', 5, 80, 1, 30, 'cm'), control('focal', '焦距', 5, 30, 1, 10, 'cm'), control('height', '物高', 1, 5, .5, 3, 'cm')],
    ['固定焦距，比较物距大于两倍焦距和小于焦距时的像。', '保持物高不变，分别记录 u=2f、u>2f、f<u<2f。', '用薄透镜公式预测像距；解释 u=f 时为何不能在有限远处成像。'],
    '理想薄凸透镜、近轴光线；虚像为反向延长线交点，不能投到屏上。物距等于焦距时出射光平行，无有限像。画面自适应缩放，超界光路裁切。', '1/f = 1/u + 1/v；M = −v/u', '焦点、实像与虚像'),
  lesson('shadow', 'light', '影子为什么变大', ['primary', 'middle', 'high'], '比较光源、物体与屏幕的距离和影长。', '屏幕不动，物体靠近光源时影子怎样变？', [control('distance', '光源到物体', .2, 2, .1, 1, 'm'), control('gap', '物体到屏幕', .1, 3, .1, 1, 'm'), control('height', '物体高度', .05, .5, .05, .2, 'm')],
    ['先预测，再只移动物体，比较影子大小。', '固定物高和物距，只改变物体到屏幕的距离。', '用相似三角形算影高，解释点光源模型为何没有半影。'],
    '点光源、平行于屏幕的不透明薄物体；忽略衍射与半影，图形随几何范围缩放。', 'H影/h物 = (a+b)/a', '光沿直线传播；深入需相似三角形'),
  lesson('echo', 'sound', '听回声测距离', ['primary', 'middle', 'high'], '比较回声往返时间、声速与障碍物距离。', '回声用时一秒，声音只走了你到墙的一段路吗？', [control('distance', '到反射墙的距离', 1, 300, 1, 100, 'm'), control('temperature', '空气温度', 0, 40, 1, 20, '℃')],
    ['跟着往返箭头数一数声音走过几段距离。', '固定气温，距离加倍，比较回声到达时间。', '控制距离，只改变气温，用 d=vt/2 核对结果。'],
    '静止干燥空气、单次理想反射；声速为 0–40℃ 线性近似。不模拟衰减和人耳分辨能力；图示比例随距离调整。', 'v ≈ 331.3 + 0.606T℃；t = 2d/v', '声音传播需要时间'),
  lesson('phase-change', 'heat', '冰变水，再变成水蒸气', ['primary', 'middle', 'high'], '沿累计供热过程观察升温与相变平台。', '继续供热时，温度总会上升吗？', [control('heat', '每千克累计供热', 0, 3052, 1, 400, 'kJ/kg'), control('mass', '质量', .2, 2, .1, 1, 'kg')],
    ['缓慢增加供热量，寻找温度不变但状态在变的区间。', '比较熔化和沸腾平台，读出相变比例。', '分别用 mcΔT 和 mL 计算各段热量；质量加倍时比较总热量。'],
    '固定 1 atm，从 −20℃ 的冰加热到 100℃ 全部汽化；比热与潜热取常量，忽略容器和散热，不模拟汽化后的蒸气升温；蒸发在其他温度也可发生，此处只计算沸腾。横轴为每千克供热量。', 'Q = mcΔT；Q熔 = mL熔；Q汽 = mL汽', '冷热与物态；深入需比热与潜热'),
  lesson('thermal-expansion', 'heat', '受热的金属杆', ['primary', 'middle', 'high'], '比较杆长、温差与线膨胀系数对伸长量的影响。', '相同温差下，长杆和短杆伸长一样多吗？', [control('length', '初始长度', .2, 3, .1, 1, 'm'), control('delta', '温度变化', -50, 150, 5, 80, 'K'), control('alpha', '线膨胀系数', 5, 30, 1, 12, 'μ/K')],
    ['把温差从正改为负，比较伸长与缩短。', '固定材料和温差，只把原长加倍。', '计算 ΔL，再比较 ΔL/L 是否只由材料和温差决定。'],
    '自由均匀杆、小形变、常量线膨胀系数；无约束应力、无相变。变化量在图中放大 200 倍。', 'ΔL = αL₀ΔT', '长度与冷热变化'),
  lesson('conduction', 'heat', '热怎样穿过一面墙', ['middle', 'high'], '在稳定温差下比较材料、厚度和截面积对传热速率的影响。', '墙厚加倍，单位时间通过的热量怎样变？', [control('hot', '左侧温度', 0, 100, 5, 60, '℃'), control('cold', '右侧温度', 0, 100, 5, 20, '℃'), control('conductivity', '导热系数', .1, 5, .1, 1, 'W/(m·K)'), control('thickness', '墙厚', .02, .5, .02, .2, 'm'), control('area', '截面积', .1, 2, .1, 1, 'm²')],
    ['交换两侧温度，预测热流方向。', '保持温差、材料与面积不变，把厚度加倍。', '用傅里叶定律核对热流率，解释稳态温度为何沿厚度线性变化。'],
    '均匀平板的一维稳态导热；两侧恒温，忽略侧面散热、接触热阻及材料温度依赖。正热流为向右；曲线为温度分布，不是随时间升温。', 'Q̇ = kA(T左−T右)/L', '温差与热传递；深入需功率'),
  lesson('ideal-gas', 'heat', '气体的压强、体积与温度', ['high'], '在理想气体状态方程中控制变量，研究压强。', '体积和物质的量不变，温度加倍指摄氏温度还是绝对温度？', [control('amount', '物质的量', .1, 2, .1, 1, 'mol'), control('volume', '体积', 1, 50, 1, 20, 'L'), control('temperature', '绝对温度', 200, 600, 10, 300, 'K')],
    ['保持气体量和温度不变，比较不同体积的压强。', '控制体积与气体量，令绝对温度加倍。', '用 PV=nRT 核对单位，解释公式必须用绝对压强与开尔文温度。'],
    '平衡态理想气体；体积换算为 m³，温度用 K，压强是绝对压强。不模拟液化或分子大小，粒子位置只作示意。', 'PV = nRT；R = 8.314462618 J/(mol·K)', '物质的量、绝对温度与压强'),
  lesson('interference', 'wave', '双缝的明暗条纹', ['high'], '比较波长、缝距与屏距对条纹间距的影响。', '两缝距离增加，亮条纹会更密还是更疏？', [control('wavelength', '波长', 400, 700, 10, 550, 'nm'), control('separation', '双缝间距', .1, 1, .05, .5, 'mm'), control('distance', '屏距', 1, 5, .1, 2, 'm')],
    ['观察中央亮纹两侧明暗相间的对称条纹。', '保持波长与屏距不变，只改变双缝间距。', '用 Δy=λL/d 算条纹间距，再比较亮纹与暗纹位置的光程差。'],
    '同频、相干、等强双窄缝的远场小角度近似；忽略单缝衍射包络。屏幕固定显示中心 ±20 mm，曲线裁切于该范围；颜色只区分亮暗。', 'I/I最大 = cos²(πdy/(λL))；Δy = λL/d', '波的相位、叠加与光程差'),
];

export function simulateFoundation(id, p, t = 0) {
  if (id === 'reflection') {
    const angle = p.angle * Math.PI / 180;
    return { incident: angle, reflected: angle, incidentDirection: [Math.sin(angle), -Math.cos(angle)], reflectedDirection: [Math.sin(angle), Math.cos(angle)] };
  }
  if (id === 'lens-image') {
    const u = p.distance / 100, f = p.focal / 100, height = p.height / 100;
    if (Math.abs(u - f) < 1e-12) return { u, f, height, v: null, magnification: null, imageHeight: null, kind: 'infinite' };
    const v = f * u / (u - f), magnification = -v / u;
    return { u, f, height, v, magnification, imageHeight: height * magnification, kind: v > 0 ? 'real' : 'virtual' };
  }
  if (id === 'shadow') return { sourceDistance: p.distance, screenDistance: p.distance + p.gap, height: p.height * (p.distance + p.gap) / p.distance, magnification: (p.distance + p.gap) / p.distance };
  if (id === 'echo') {
    const speed = 331.3 + .606 * p.temperature, time = 2 * p.distance / speed;
    return { speed, time, path: 2 * p.distance, distance: p.distance };
  }
  if (id === 'phase-change') {
    const specificHeat = p.heat * 1000, heat = p.mass * specificHeat;
    const iceHeat = 2100 * 20, meltEnd = iceHeat + 334000, waterEnd = meltEnd + 4200 * 100, boilEnd = waterEnd + 2256000;
    let temperature, phase, melted = 0, vaporized = 0;
    if (specificHeat < iceHeat) { temperature = 253.15 + specificHeat / 2100; phase = '冰升温'; }
    else if (specificHeat < meltEnd) { temperature = 273.15; phase = '冰水混合：熔化'; melted = (specificHeat - iceHeat) / 334000; }
    else if (specificHeat < waterEnd) { temperature = 273.15 + (specificHeat - meltEnd) / 4200; phase = '水升温'; melted = 1; }
    else { temperature = 373.15; phase = specificHeat >= boilEnd ? '全部汽化（终点）' : '水与蒸气：沸腾'; melted = 1; vaporized = Math.min(1, (specificHeat - waterEnd) / 2256000); }
    return { specificHeat, heat, temperature, celsius: temperature - 273.15, phase, melted, vaporized, iceHeat, meltEnd, waterEnd, boilEnd };
  }
  if (id === 'thermal-expansion') {
    const alpha = p.alpha * 1e-6, extension = alpha * p.length * p.delta;
    return { alpha, extension, length: p.length + extension, strain: alpha * p.delta };
  }
  if (id === 'conduction') {
    const left = p.hot + 273.15, right = p.cold + 273.15, power = p.conductivity * p.area * (left - right) / p.thickness;
    return { left, right, power, flux: power / p.area, gradient: (right - left) / p.thickness, middle: (left + right) / 2 };
  }
  if (id === 'ideal-gas') {
    const volume = p.volume / 1000, temperature = p.temperature, amount = p.amount, pressure = amount * 8.314462618 * temperature / volume;
    return { volume, temperature, amount, pressure, product: pressure * volume };
  }
  if (id === 'interference') {
    const wavelength = p.wavelength * 1e-9, separation = p.separation * 1e-3, distance = p.distance, spacing = wavelength * distance / separation;
    return { wavelength, separation, distance, spacing, intensityAt: y => Math.cos(Math.PI * y / spacing) ** 2 };
  }
  return null;
}

export function viewFoundation(id, p, t = 0) {
  const m = simulateFoundation(id, p, t);
  if (!m) return null;
  let svg = '', metrics = [], notice = '';
  if (id === 'reflection') {
    const dx = 190 * Math.sin(m.incident), dy = 190 * Math.cos(m.incident);
    svg = line(80, 310, 720, 310, '#7c9caa', 8) + line(400, 70, 400, 360, 'var(--line-strong)', 2, '6 5') + arrow(400 - dx, 310 - dy, dx, dy, '#c08b48') + arrow(400, 310, dx, -dy, '#4a9684') + text(400, 50, '角度从法线量起') + text(560, 385, '平面镜') + text(220, 100, '入射光') + text(580, 100, '反射光');
    metrics = [metric('入射角', p.angle, '°'), metric('反射角', p.angle, '°')];
  } else if (id === 'lens-image') {
    const scale = Math.min(600, 250 / Math.max(m.u, m.f * 2, Math.min(Math.abs(m.v ?? 0), 2)), 145 / Math.max(m.height, Math.min(Math.abs(m.imageHeight ?? 0), 1)));
    const x = v => 400 + v * scale, y = h => 245 - h * scale;
    const objectX = x(-m.u), objectY = y(m.height);
    svg = '<defs><clipPath id="foundation-lens-clip"><rect x="55" y="65" width="690" height="320"/></clipPath></defs>' + line(60, 245, 740, 245, 'var(--line-strong)', 1) + line(400, 85, 400, 385, '#699aac', 6) + text(400, 425, '凸透镜 · 光路与物像使用同一缩放') + circle(x(-m.f), 245, 4) + circle(x(m.f), 245, 4) + text(x(-m.f), 275, 'F') + text(x(m.f), 275, 'F′');
    svg += '<g clip-path="url(#foundation-lens-clip)">' + arrow(objectX, 245, 0, objectY - 245, '#ba8c48') + line(objectX, objectY, 400, objectY, '#ba8c48');
    // Rays after the lens: a parallel incident ray crosses F; a central ray is undeviated.
    svg += line(400, objectY, 745, objectY + 345 * m.height / m.f, '#4a9684') + line(objectX, objectY, 745, 245 + 345 * m.height / m.u, '#638bb4');
    if (m.v !== null) {
      const ix = x(m.v), iy = y(m.imageHeight);
      if (m.kind === 'virtual') svg += line(400, objectY, ix, iy, '#4a9684', 2, '5 5') + line(400, 245, ix, iy, '#638bb4', 2, '5 5');
      svg += arrow(ix, 245, 0, iy - 245, '#9a699c');
    }
    svg += '</g>' + text(160, 55, '棕：物体 · 紫：像');
    metrics = [metric('像距（右侧为正）', m.v === null ? '无有限像' : fmt(m.v * 100), 'cm'), metric('放大率（带方向）', m.magnification), metric('成像', m.kind === 'real' ? '倒立实像' : m.kind === 'virtual' ? '正立虚像' : '出射光平行')];
    notice = m.kind === 'infinite' ? '物体在焦点：出射光平行，像在无穷远，不能显示有限像距。' : Math.abs(m.v * scale) > 345 || Math.abs(m.imageHeight * scale) > 160 ? '像超出画面，光路已裁切；请以像距与放大率读数为准。' : m.kind === 'virtual' ? '虚线是出射光的反向延长线；虚像不能在屏幕上接到。' : '';
  } else if (id === 'shadow') {
    const sx = 90, screenX = 700, scaleX = 610 / m.screenDistance, objectX = sx + p.distance * scaleX, scaleY = Math.min(600, 260 / m.height), base = 355;
    svg = line(sx, base, screenX, base, 'var(--line-strong)', 1) + line(screenX, 75, screenX, 375, '#8b9da6', 6) + line(sx, base, screenX, base - m.height * scaleY, '#d1aa68', 2) + line(objectX, base, objectX, base - p.height * scaleY, '#b58a50', 8) + line(screenX, base, screenX, base - m.height * scaleY, '#526b72', 12) + circle(sx, base, 8, '#e7c874') + text(sx, 405, '点光源') + text(objectX, 55, '物体') + text(screenX, 405, '屏幕上的影子') + text(400, 435, '横纵比例分别缩放，长度请看读数');
    metrics = [metric('影子高度', m.height, 'm'), metric('放大倍数', m.magnification), metric('光源到屏幕', m.screenDistance, 'm')];
  } else if (id === 'echo') {
    svg = circle(130, 240, 28, '#e4c681') + line(670, 100, 670, 370, '#8fa7a1', 12) + arrow(175, 190, 480, 0, '#b18a50') + arrow(655, 290, -480, 0, '#4e9683') + text(400, 155, '去程：' + p.distance + ' m') + text(400, 335, '回程：' + p.distance + ' m') + text(130, 405, '发声与接收处') + text(670, 405, '反射墙');
    metrics = [metric('回声往返时间', m.time, 's'), metric('声音总路程', m.path, 'm'), metric('声速', m.speed, 'm/s')];
  } else if (id === 'phase-change') {
    const qMax = m.boilEnd, sx = q => 90 + q / qMax * 620, sy = temp => 340 - (temp + 20) / 120 * 240;
    svg = line(90, 340, 730, 340, 'var(--line-strong)', 2) + line(90, 80, 90, 340, 'var(--line-strong)', 2);
    const points = [[0, -20], [m.iceHeat, 0], [m.meltEnd, 0], [m.waterEnd, 100], [m.boilEnd, 100]];
    for (let i = 1; i < points.length; i++) svg += line(sx(points[i-1][0]), sy(points[i-1][1]), sx(points[i][0]), sy(points[i][1]), '#4e9683', 4);
    svg += circle(sx(m.specificHeat), sy(m.celsius), 7, '#e0b958') + text(400, 405, '每千克累计供热 / kJ·kg⁻¹（0 → 3052）') + text(115, 65, '温度 / ℃') + text(65, sy(100), '100') + text(65, sy(0), '0') + text(65, sy(-20), '−20') + text(400, 445, m.phase);
    metrics = [metric('温度', m.celsius, '℃'), metric('累计总供热', m.heat / 1000, 'kJ'), metric('已熔化比例', m.melted * 100, '%'), metric('已汽化比例', m.vaporized * 100, '%')];
    notice = '固定 1 atm；相变平台继续吸热但温度保持不变。供热滑块为每千克热量，质量改变总热量。';
  } else if (id === 'thermal-expansion') {
    const exaggerated = 460 + m.strain * 280 * 200;
    svg = rect(180, 150, 280, 35, '#ced9d8') + rect(180, 270, exaggerated - 180, 35, '#e5c58d') + line(460, 120, 460, 340, '#8eaaa1', 1, '5 5') + text(400, 115, '初始杆长：' + fmt(p.length, 1) + ' m') + text(400, 240, '温变后的杆（变化量放大 200 倍）') + text(400, 390, p.delta > 0 ? '升温：自由伸长' : p.delta < 0 ? '降温：自由缩短' : '温差为零：长度不变');
    metrics = [metric('真实伸长量', m.extension * 1000, 'mm'), metric('实际末长', fmt(m.length, 6), 'm'), metric('相对长度变化', m.strain * 100, '%')];
  } else if (id === 'conduction') {
    const min = Math.min(p.hot, p.cold), span = Math.max(10, Math.abs(p.hot - p.cold)), sy = temp => 310 - (temp - min) / span * 160;
    svg = rect(210, 95, 380, 265, '#e6e9df') + line(210, sy(p.hot), 590, sy(p.cold), '#c18d51', 4) + text(170, 80, p.hot + ' ℃') + text(630, 80, p.cold + ' ℃') + text(400, 395, '稳态温度沿厚度线性分布') + text(400, 430, '纵轴按两端温差缩放；平板厚度示意');
    if (m.power !== 0) svg += arrow(m.power > 0 ? 320 : 480, 335, Math.sign(m.power) * 160, 0);
    metrics = [metric('热流率（向右为正）', m.power, 'W'), metric('热流密度', m.flux, 'W/m²'), metric('板中心温度', m.middle - 273.15, '℃')];
    if (m.power === 0) notice = '两侧等温，稳态热流为零。';
  } else if (id === 'ideal-gas') {
    const width = 140 + p.volume / 50 * 360;
    svg = rect(130, 115, width, 230, '#e6eff0') + line(130 + width, 105, 130 + width, 355, '#8f9f93', 9);
    for (let i = 0; i < 18; i++) svg += circle(145 + (i * 61 % Math.max(1, width - 30)), 140 + (i * 79 % 175), 4, '#74a5b1');
    svg += text(400, 65, '平衡态气体 · 粒子数与速度不按比例') + text(400, 400, '温度 ' + p.temperature + ' K；体积 ' + p.volume + ' L');
    metrics = [metric('绝对压强', m.pressure / 1000, 'kPa'), metric('PV', m.product, 'J'), metric('摄氏温度', m.temperature - 273.15, '℃')];
  } else if (id === 'interference') {
    // Fixed screen window makes changes in fringe spacing visible. Sample finely at smallest spacing.
    const points = Array.from({ length: 2001 }, (_, i) => { const y = -.02 + .04 * i / 2000; return `${90 + i / 2000 * 620},${335 - m.intensityAt(y) * 130}`; }).join(' ');
    svg = line(90, 335, 710, 335, 'var(--line-strong)', 1) + `<polyline points="${points}" fill="none" stroke="#448b79" stroke-width="2"/>` + text(400, 390, '屏幕横坐标 / mm：−20 ← 0 → +20') + text(120, 180, 'I/I最大') + text(70, 210, '1') + text(70, 335, '0');
    for (let i = 0; i < 620; i += 2) { const intensity = m.intensityAt(-.02 + .04 * (i + 1) / 620); svg += `<rect x="${90+i}" y="85" width="2" height="65" fill="#dfc974" opacity="${.08 + .92 * intensity}"/>`; }
    svg += line(400, 75, 400, 345, 'var(--line-strong)', 1, '4 5') + text(400, 440, '上：屏幕亮暗示意 · 下：归一化强度（不含衍射包络）');
    metrics = [metric('相邻亮纹间距', m.spacing * 1000, 'mm'), metric('中央相对强度', m.intensityAt(0)), metric('一级亮纹位置', m.spacing * 1000, 'mm')];
  }
  return { svg, metrics, notice, model: m };
}
