// Portable foundation models. Quantitative models calculate in SI; trend models do not invent rates.
import { control, fmt, metric, text, line, arrow, circle, rect } from './experiment-kit.mjs';

const allStages = ['primary', 'middle', 'high'];
const choice = (key, label, labels, value = 0) => ({ ...control(key, label, 0, labels.length - 1, 1, value), options: labels.map((label, value) => ({ value, label })) });
const lesson = (id, topic, title, goal, question, controls, guides, limit, formula, keywords, stages = allStages) => ({
  id, topic, title, stages, band: '小学观察 · 初高中探究', goal, question, controls, guides, limit, formula, keywords,
  prerequisite: stages.includes('primary') ? '先预测、单独改变一个条件，再比较读数' : '物态、热量与能量守恒',
  ...(id === 'sound-medium' ? { animation: { duration: 8, rate: 1 } } : ['convection', 'evaporation'].includes(id) ? { animation: { duration: 12, rate: 1, illustrative: true } } : {}),
});
export const COMPLETION_FOUNDATIONS = [
  lesson('density-measurement', 'measurement', '天平与排水法测密度', '先称质量，再从量筒两次读数求体积。', '量筒的最终读数就是物体体积吗？', [control('mass', '干燥物体质量', 10, 500, 10, 120, 'g'), control('tare', '称量容器质量', 0, 100, 5, 20, 'g'), control('initial', '量筒初始读数', 20, 100, 5, 50, 'mL'), control('displacement', '完全浸没后的体积增量', 0, 100, 5, 40, 'mL')],
    ['比较空容器和容器加物体的天平读数，求物体质量。', '从视线与凹液面最低处齐平的两次量筒读数求差；记录质量与体积。', '分别加倍质量或排水体积，检查密度的变化；体积差为零时能否计算？'],
    '理想无误差仪器；先在空气中称干燥物体，再完全浸没于液体。物体不溶解、不吸液，无气泡、无溢出；需外力浸没的物体由细线固定，忽略细线体积。零增量表示无有效体积测量，密度不定义。', 'm = m总−m容器；V = V后−V前；ρ = m/V；1 mL = 1 cm³ = 10⁻⁶ m³', ['密度', '天平', '量筒', '排水法', '测量']),
  lesson('plane-mirror', 'light', '镜后的像在哪里', '比较物与像到平面镜的距离和高度。', '镜前后退一步，像离镜面也后退一步吗？', [control('distance', '物体到镜面', 10, 150, 5, 60, 'cm'), control('height', '物体高度', 5, 50, 5, 30, 'cm')],
    ['先预测镜后像的位置，改变物距检查。', '记录三组物距、像距与像高，找出等距和等大的关系。', '沿两条反射光线向镜后反向延长，解释为何交点是虚像、不能接在屏上。'],
    '理想无限大平面镜与几何光学；镜后虚线是反向延长线，镜后没有实际光线。像正立等大；图形同一比例缩放，不模拟有限镜面视野。', 'd像 = −d物；M = +1；h像 = h物', ['平面镜成像', '虚像', '等距', '正立等大']),
  lesson('sound-medium', 'sound', '声音能穿过真空吗', '比较介质中的纵波传播与真空中的无声。', '声源仍振动，为什么真空另一端收不到声音？', [choice('medium', '传播介质（约 20℃）', ['真空：无介质', '空气', '淡水', '钢中纵波'], 1), control('distance', '声源到接收点', 1, 20, 1, 10, 'm'), control('frequency', '声源频率', 100, 1000, 50, 500, 'Hz')],
    ['保持声源振动，分别选择空气、水、钢与真空，比较接收结果。', '固定距离，记录三种介质的声速与传播时间；不把这一排序推广给所有材料。', '固定介质改变频率，用 λ=v/f 检查波长；辨别粒子往复振动与波向前传播。'],
    '约 20℃ 的典型声速：空气 343 m/s、淡水 1480 m/s、钢中纵波 5960 m/s；忽略衰减、色散及界面反射，不泛化为固体总比液体快。真空不传播机械声波，不用零声速代入除法。纵向粒子位移、波长和传播均慢放示意，不按尺测量。', 't = d/v；λ = v/f；真空无机械声波', ['声音传播', '介质', '真空', '纵波', '声速']),
  lesson('prism-dispersion', 'light', '三棱镜分开白光', '用同一束入射光比较不同波长的折射。', '色散消失时，红光和紫光还会分开吗？', [control('apex', '棱镜顶角', 20, 60, 5, 60, '°'), control('incidence', '第一面入射角（相对法线）', 30, 70, 5, 50, '°'), control('dispersion', '示例玻璃色散系数 B', 0, .01, .001, .004, 'μm²')],
    ['用白光照射棱镜，按出射方向比较红、绿、紫三条代表光线。', '固定顶角与入射角，只改变 B；观察 B=0 时光线能否分开。', '分别在两个界面应用折射定律；若第二面发生全反射，解释为何不再画透射光线。'],
    '空气折射率取 1；示例透明玻璃 Cauchy 模型 n=1.50+B/λ²，λ 用 μm，B 非具体材料测量值。红 700、绿 550、紫 400 nm 代表连续白光谱；不计算强度与多次内反射。第二面全反射时只标示该光线被阻断；光路角度按几何绘制。', 'n(λ) = 1.50+B/λ²；sin i = n sin r₁；r₂ = A−r₁；sin e = n sin r₂', ['白光', '三棱镜', '色散', '折射率', '全反射']),
  lesson('color-mixing', 'light', '红绿蓝光叠加', '独立改变三束色光，观察叠加后的颜色。', '红光和绿光相加，为什么不是颜料混合的结果？', [control('red', '红光相对强度', 0, 100, 5, 100, '%'), control('green', '绿光相对强度', 0, 100, 5, 100, '%'), control('blue', '蓝光相对强度', 0, 100, 5, 100, '%')],
    ['先关闭所有光源，再逐个打开红、绿、蓝。', '比较等强红加绿、绿加蓝、红加蓝与三色全开，记录黄、青、品红、白。', '保持三者比例相同同时减弱，比较色调与亮度；解释光的相加不能套用到颜料混合。'],
    '显示器线性 RGB 三通道的加色示意，经 sRGB 编码显示；每通道独立归一化，不是光谱、照度、色温或人眼亮度的测量。设备与显示环境会影响观感；不模拟颜料的减色混合。', '(R,G,B)叠加 = R红 + G绿 + B蓝；等强三色→中性灰/白', ['色光', '加色', '红绿蓝', 'RGB', '颜色']),
  lesson('convection', 'heat', '热流体为什么向上', '比较上下温度、介质与重力对自然对流趋势的影响。', '从上方加热与从下方加热，都会有相同的循环吗？', [choice('medium', '材料', ['空气（一般热膨胀）', '水（20–60℃）', '固体：不能整体流动']), control('bottom', '底部温度', 20, 60, 5, 50, '℃'), control('top', '顶部温度', 20, 60, 5, 20, '℃'), control('gravity', '重力大小（相对地球）', 0, 1, .1, 1)],
    ['选择流体，把底部调热，跟随上升和回流箭头。', '交换上下温度、令上下等温，再比较重力为零和固体时的情况。', '用受热膨胀、密度降低与浮力解释趋势；说明实际起流还取决于尺寸、黏度等条件。'],
    '定性自然对流趋势图，示踪粒子沿可能的循环路径运动；播放时间、速度与粒子数不表示真实流速或流量，也不保证起流；未求解流体方程、起流阈值或热流率。空气及 20–60℃ 水受热密度通常降低，避开水在 4℃ 附近的反常膨胀。忽略强迫对流、辐射和导热；无循环不等于没有其他传热。', '一般流体：受热膨胀→密度降低；重力下热流体有上升趋势', ['自然对流', '热传递', '浮力', '密度', '重力']),
  lesson('thermal-radiation', 'heat', '不用接触也能传热', '比较温度、面积和发射率对净辐射功率的影响。', '同温物体仍发出热辐射吗？', [control('temperature', '物体表面温度', 0, 500, 10, 100, '℃'), control('surroundings', '大包围环境温度', 0, 100, 10, 20, '℃'), control('area', '辐射面积', 0, 2, .1, 1, 'm²'), control('emissivity', '灰体发射率', 0, 1, .05, .9)],
    ['比较物体发出的辐射和从环境吸收的辐射；把两者温度调成相同。', '固定温度与发射率，面积加倍；再比较不同发射率。', '把摄氏度转为开尔文计算四次方；交换冷热，解释净功率符号与能量流向。'],
    '均温漫射灰体，被恒温黑体大环境完全包围，视角因子为 1，吸收率等于发射率；温度恒定，不模拟降温过程。只计算辐射，不计导热、对流或颜色对可见光的影响；净向外为正。', 'P净 = εσA(T⁴−T环⁴)；T = T℃+273.15；σ = 5.670374419×10⁻⁸ W/(m²·K⁴)', ['热辐射', '开尔文', '发射率', '斯特藩玻尔兹曼']),
  lesson('evaporation', 'heat', '怎样让水更容易蒸发', '一次只改变温度、面积、气流或湿度，比较净蒸发趋势。', '不沸腾的水也会变成水蒸气吗？', [control('temperature', '液面与空气的共同温度', 5, 60, 5, 20, '℃'), control('area', '暴露液面面积', 10, 200, 10, 50, 'cm²'), control('airflow', '液面附近空气流速', 0, 5, .5, 1, 'm/s'), control('humidity', '空气相对湿度', 0, 100, 5, 50, '%')],
    ['保持低于沸点，比较较高与较低温度时液面分子的逸出趋势。', '对照 20℃、50 cm²、1 m/s、50% 湿度，每次只改一个条件，记录各条件的趋势。', '说明蒸发发生在液面、可以低于沸点；等温饱和空气中仍有分子交换，为何净蒸发为零？'],
    '定性比较，示踪粒子表现液面逸出与返回；播放时间、速度和粒子数不表示真实分子速度、通量或蒸发量，不给出蒸发速率或干燥时间。液面高度保持不变，不计算液体质量变化。液面与远处空气保持同温，外部供热补偿蒸发冷却；相对湿度相对于该温度。较高温度、更大面积、更强气流及较低湿度通常有利于净蒸发；不叠加为校准指数。100% 湿度时为等温饱和平衡，无净蒸发。', '蒸发：液面液→气，吸热；等温饱和时逸出与返回相抵', ['蒸发', '湿度', '表面积', '气流', '吸热']),
  lesson('phase-processes', 'heat', '降温与六种物态变化', '比较降温、相变方向和吸热放热。', '凝固、液化、凝华时，是从环境吸热还是向环境放热？', [choice('process', '过程', ['液态水降温（80→20℃）', '熔化：冰→水', '凝固：水→冰', '沸腾：水→水蒸气', '液化：水蒸气→水', '升华：固→气（定性）', '凝华：气→固（定性）'], 2), control('progress', '人为选择的过程进度（非时间）', 0, 100, 5, 50, '%'), control('mass', '物质总质量', .2, 2, .1, 1, 'kg')],
    ['分别选择三个吸热过程与三个放热过程，比较物态箭头和热量箭头。', '把水降温与水凝固相比较：哪些温度变化、哪些处于相变平台？', '用 mcΔT 与 ±mL 核对水的能量；解释升华和凝华为何不经过液态，相变温度又为何需要知道压强与物质。'],
    '水的定量过程采用 1 atm、纯物质：降温 80→20℃，熔化/凝固 0℃，沸腾/液化 100℃；忽略过冷、容器和散热，比热 4200 J/(kg·K)，熔化潜热 334 kJ/kg，汽化潜热 2256 kJ/kg。升华/凝华只比较固气转化和能量方向，不指定物质、压强、温度或潜热。进度由用户选择，不表示真实速率；吸热为正。', 'Q降温 = mcΔT；Q相变 = ±mL×进度；熔化/汽化/升华吸热，凝固/液化/凝华放热', ['降温', '凝固', '液化', '凝华', '升华', '熔化', '汽化']),
];

const degrees = radians => radians * 180 / Math.PI;
const radians = degrees => degrees * Math.PI / 180;
const media = [{ name: '真空', speed: null }, { name: '空气', speed: 343 }, { name: '淡水', speed: 1480 }, { name: '钢中纵波', speed: 5960 }];
const processes = [
  { name: '水降温', from: '液态水', to: '液态水', sign: -1, latent: null, temperature: null },
  { name: '熔化', from: '固态冰', to: '液态水', sign: 1, latent: 334000, temperature: 273.15 },
  { name: '凝固', from: '液态水', to: '固态冰', sign: -1, latent: 334000, temperature: 273.15 },
  { name: '沸腾', from: '液态水', to: '水蒸气', sign: 1, latent: 2256000, temperature: 373.15 },
  { name: '液化', from: '水蒸气', to: '液态水', sign: -1, latent: 2256000, temperature: 373.15 },
  { name: '升华', from: '固态', to: '气态', sign: 1, latent: null, temperature: null },
  { name: '凝华', from: '气态', to: '固态', sign: -1, latent: null, temperature: null },
];
export function simulateCompletionFoundation(id, p, t = 0) {
  if (id === 'density-measurement') {
    const mass = p.mass / 1000, volume = p.displacement * 1e-6;
    return { mass, volume, initialVolume: p.initial * 1e-6, finalVolume: (p.initial + p.displacement) * 1e-6, balanceEmpty: p.tare / 1000, balanceLoaded: (p.tare + p.mass) / 1000, valid: volume > 0, density: volume > 0 ? mass / volume : null };
  }
  if (id === 'plane-mirror') return { objectDistance: p.distance / 100, imageDistance: -p.distance / 100, objectHeight: p.height / 100, imageHeight: p.height / 100, magnification: 1, kind: 'virtual' };
  if (id === 'sound-medium') {
    const { name, speed } = media[p.medium], travels = speed !== null;
    return { medium: name, travels, speed, time: travels ? p.distance / speed : null, wavelength: travels ? speed / p.frequency : null, distance: p.distance, frequency: p.frequency };
  }
  if (id === 'prism-dispersion') {
    const apex = radians(p.apex), incidence = radians(p.incidence);
    const rays = [{ wavelength: 700, name: '红', color: '#d35656' }, { wavelength: 550, name: '绿', color: '#368c69' }, { wavelength: 400, name: '紫', color: '#9b6bc0' }].map(ray => {
      const index = 1.5 + p.dispersion / (ray.wavelength / 1000) ** 2;
      const refraction = Math.asin(Math.sin(incidence) / index), secondIncidence = apex - refraction;
      const sineExit = index * Math.sin(secondIncidence), totalInternalReflection = Math.abs(sineExit) > 1;
      const emergence = totalInternalReflection ? null : Math.asin(sineExit);
      return { ...ray, index, refraction, secondIncidence, totalInternalReflection, emergence, deviation: emergence === null ? null : incidence + emergence - apex };
    });
    return { apex, incidence, rays, separation: rays.every(r => r.deviation !== null) ? rays[2].deviation - rays[0].deviation : null };
  }
  if (id === 'color-mixing') {
    const channels = [p.red, p.green, p.blue].map(v => v / 100);
    const encoded = channels.map(v => Math.round(255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055)));
    const active = channels.map(v => v > 0), names = ['无光（黑）', '蓝', '绿', '青', '红', '品红', '黄', '白 / 中性灰'];
    const code = active.reduce((n, yes, i) => n + (yes ? 2 ** (2 - i) : 0), 0);
    const equalActive = channels.filter(v => v > 0).every((v, _, a) => v === a[0]);
    return { channels, encoded, color: `rgb(${encoded.join(',')})`, name: equalActive ? names[code] : '不等强三色混合', totalRelative: channels.reduce((a, b) => a + b, 0) };
  }
  if (id === 'convection') {
    const delta = p.bottom - p.top, fluid = p.medium !== 2, driven = fluid && p.gravity > 0 && delta > 0;
    const state = !fluid ? '固体无整体对流' : p.gravity === 0 ? '无重力驱动的自然对流' : delta === 0 ? '等温：无温差驱动' : delta < 0 ? '上热下冷：稳定分层趋势' : '下热上冷：有自然对流趋势';
    return { delta, fluid, driven, state, bottom: p.bottom + 273.15, top: p.top + 273.15 };
  }
  if (id === 'thermal-radiation') {
    const temperature = p.temperature + 273.15, surroundings = p.surroundings + 273.15, factor = p.emissivity * 5.670374419e-8 * p.area;
    const emitted = factor * temperature ** 4, absorbed = factor * surroundings ** 4;
    return { temperature, surroundings, emitted, absorbed, power: emitted - absorbed };
  }
  if (id === 'evaporation') {
    const compare = (value, reference, reverse = false) => value === reference ? '与对照相同' : (value > reference) !== reverse ? '有利于净蒸发' : '抑制净蒸发';
    const equilibrium = p.humidity === 100;
    return { equilibrium, temperature: p.temperature + 273.15, area: p.area * 1e-4, airflow: p.airflow, humidity: p.humidity / 100,
      factors: [compare(p.temperature, 20), compare(p.area, 50), compare(p.airflow, 1), compare(p.humidity, 50, true)], state: equilibrium ? '等温饱和：无净蒸发' : '未饱和：有净蒸发趋势（不定量）' };
  }
  if (id === 'phase-processes') {
    const process = processes[p.process], fraction = p.progress / 100, cooling = p.process === 0;
    const temperature = cooling ? 353.15 - 60 * fraction : process.temperature;
    const heat = cooling ? -p.mass * 4200 * 60 * fraction : process.latent === null ? null : process.sign * p.mass * process.latent * fraction;
    return { ...process, fraction, temperature, heat, initialMass: cooling ? p.mass : p.mass * (1 - fraction), finalMass: cooling ? 0 : p.mass * fraction, cooling };
  }
  return null;
}

export function viewCompletionFoundation(id, p, t = 0) {
  const m = simulateCompletionFoundation(id, p, t);
  if (!m) return null;
  let svg = '', metrics = [], notice = '';
  if (id === 'density-measurement') {
    svg = rect(65, 105, 240, 100) + text(185, 140, '天平：空气中称量') + text(185, 175, `总 ${fmt(m.balanceLoaded * 1000, 0)} g − 容器 ${p.tare} g`) + text(185, 240, `物体质量 ${p.mass} g`);
    for (const [i, volume] of [p.initial, p.initial + p.displacement].entries()) {
      const x = 395 + i * 205, y = 350 - volume;
      svg += rect(x, 100, 95, 250) + rect(x + 4, y, 87, volume, 'color-mix(in srgb,var(--blue) 15%,var(--surface))') + line(x + 4, y, x + 91, y, 'var(--blue)', 3);
      for (let v = 0; v <= 200; v += 50) svg += line(x + 65, 350 - v, x + 90, 350 - v, 'var(--line-strong)', 1) + text(x + 45, 355 - v, v);
      if (i) svg += circle(x + 35, 327, 14, 'color-mix(in srgb,var(--orange) 18%,var(--surface))');
      svg += text(x + 47, 385, `${i ? '浸没后' : '浸没前'} ${volume} mL`);
    }
    svg += text(400, 435, '量筒刻度单位 mL；先称质量，再量排水体积');
    metrics = [metric('物体质量', p.mass, 'g'), metric('排水体积（后−前）', p.displacement, 'cm³'), metric('密度', m.density, 'kg/m³'), metric('密度', m.density === null ? null : m.density / 1000, 'g/cm³')];
    notice = m.valid ? '读液面时视线与凹液面最低处齐平；图中水面与物体均为示意。' : '体积差为零，不能除以零求密度；请获得有效的完全浸没读数。';
  } else if (id === 'plane-mirror') {
    const scale = Math.min(280 / m.objectDistance, 210 / m.objectHeight), x = 400 - m.objectDistance * scale, ix = 800 - x, y = 335 - m.objectHeight * scale;
    svg = line(400, 65, 400, 365, 'var(--blue)', 6) + arrow(x, 335, 0, y - 335, 'var(--orange)') + line(ix, 335, ix, y, 'var(--green)', 4, '6 5') + text(x, 385, '物体') + text(ix, 385, '正立等大虚像') + text(400, 50, '平面镜');
    for (const hitY of [y + (335 - y) * .35, y + (335 - y) * .75]) {
      const slope = (hitY - y) / (400 - x), dx = Math.min(200, 70 / slope);
      svg += arrow(x, y, 400 - x, hitY - y, 'var(--orange)') + arrow(400, hitY, -dx, dx * slope, 'var(--green)') + line(400, hitY, ix, y, 'var(--green)', 2, '5 5');
    }
    svg += line(x, 410, ix, 410, 'var(--line-strong)', 1) + text(400, 445, '镜前实际光线 · 镜后虚线只是反向延长线');
    metrics = [metric('物距', m.objectDistance * 100, 'cm'), metric('像距（虚像为负）', m.imageDistance * 100, 'cm'), metric('像高', m.imageHeight * 100, 'cm'), metric('放大率', m.magnification)];
    notice = '像距符号约定：镜前实像为正、镜后虚像为负。两侧距离大小相等。';
  } else if (id === 'sound-medium') {
    svg = circle(100, 230, 25, 'color-mix(in srgb,var(--orange) 18%,var(--surface))') + rect(650, 180, 65, 100) + text(100, 320, '声源振动') + text(680, 320, '接收点') + text(400, 80, m.medium);
    if (m.travels) {
      for (let i = 0; i < 27; i++) {
        const rest = 160 + i * 17, displacement = 5 * Math.sin(2 * Math.PI * (i / 9 - t / 2));
        svg += circle(rest + displacement, 230, 4, i === 13 ? 'var(--orange)' : 'var(--blue)');
      }
      svg += arrow(200, 155, 370, 0) + arrow(345, 270, 35, 0, 'var(--orange)') + arrow(380, 285, -35, 0, 'var(--orange)') + text(400, 365, '波向右传；介质粒子仅在平衡位置附近往复');
    } else svg += text(400, 230, '没有介质粒子，不传播声波') + text(400, 365, '声源仍可振动；接收点无机械声波到达');
    svg += text(400, 425, '纵波慢放示意；粒子间距不是实际波长');
    metrics = [metric('典型声速', m.speed, 'm/s'), metric('到达时间', m.time === null ? null : m.time * 1000, 'ms'), metric('波长', m.wavelength, 'm'), metric('接收', m.travels ? '可传播（忽略损耗）' : '无声波传播')];
    notice = '没有试听音效；选择介质不会播放声音。';
  } else if (id === 'prism-dispersion') {
    const half = m.apex / 2, sx = Math.sin(half), cy = Math.cos(half), entry = { x: 400 - 130 * sx, y: 95 + 130 * cy }, incoming = half - m.incidence;
    svg = `<path d="M400 95L${400 - 290 * sx} ${95 + 290 * cy}L${400 + 290 * sx} ${95 + 290 * cy}Z" fill="color-mix(in srgb,var(--blue) 15%,var(--surface))" stroke="var(--line-strong)" stroke-width="2"/>`;
    svg += arrow(entry.x - 190 * Math.cos(incoming), entry.y - 190 * Math.sin(incoming), 190 * Math.cos(incoming), 190 * Math.sin(incoming), 'var(--diagram-stroke)') + text(165, 115, '白光（代表三色）');
    for (const ray of m.rays) {
      const dir = half - ray.refraction, dx = Math.cos(dir), dy = Math.sin(dir);
      const travel = ((400 - entry.x) * cy - (95 - entry.y) * sx) / (dx * cy - dy * sx);
      const x = entry.x + travel * dx, y = entry.y + travel * dy;
      svg += line(entry.x, entry.y, x, y, ray.color, 2);
      if (ray.emergence !== null) {
        const out = ray.emergence - half, length = Math.min(220, (730 - x) / Math.cos(out), Math.sin(out) > 0 ? (365 - y) / Math.sin(out) : 1000);
        svg += arrow(x, y, length * Math.cos(out), length * Math.sin(out), ray.color);
      }
      svg += text(400, 390 + m.rays.indexOf(ray) * 25, `${ray.name} ${ray.wavelength} nm：n=${fmt(ray.index, 4)}；${ray.totalInternalReflection ? '第二面全反射' : '偏向角 ' + fmt(degrees(ray.deviation)) + '°'}`);
    }
    metrics = m.rays.map(r => metric(`${r.name}光偏向角`, r.deviation === null ? '全反射，无透射' : fmt(degrees(r.deviation)), r.deviation === null ? '' : '°'));
    notice = '三条光线在第一面有相同入射角；图仅追踪第一次进入与第二面出射。偏向角可带符号。';
  } else if (id === 'color-mixing') {
    for (const [i, color] of ['#df5050', '#36a866', '#538ee0'].entries()) {
      svg += circle(130, 125 + 100 * i, 28, color) + text(130, 175 + 100 * i, `${['红', '绿', '蓝'][i]} ${m.channels[i] * 100}%`);
      if (m.channels[i] > 0) svg += arrow(165, 125 + 100 * i, 255, 100 - 100 * i, color);
    }
    svg += rect(450, 125, 240, 200, m.color) + text(570, 365, '重叠区域：' + m.name) + text(400, 435, '光的加色；各通道相对强度经 sRGB 编码显示');
    metrics = [metric('红通道', p.red, '%'), metric('绿通道', p.green, '%'), metric('蓝通道', p.blue, '%'), metric('叠加颜色', m.name)];
  } else if (id === 'convection') {
    const bottomColor = m.delta > 0 ? 'var(--diagram-warm)' : m.delta < 0 ? 'var(--diagram-cool)' : 'var(--diagram-stroke)';
    const topColor = m.delta > 0 ? 'var(--diagram-cool)' : m.delta < 0 ? 'var(--diagram-warm)' : 'var(--diagram-stroke)';
    svg = rect(200, 100, 400, 255) + line(205, 355, 595, 355, bottomColor, 8) + line(205, 100, 595, 100, topColor, 8) + text(400, 75, `顶部 ${p.top}℃`) + text(400, 390, `底部 ${p.bottom}℃`);
    if (m.driven) {
      svg += `<ellipse cx="400" cy="230" rx="110" ry="85" fill="none" stroke="var(--line-strong)" stroke-width="2" stroke-dasharray="5 5"/>`
        + arrow(290, 265, 0, -65, 'var(--diagram-warm)') + arrow(365, 145, 70, 0) + arrow(510, 195, 0, 65, 'var(--diagram-cool)') + arrow(435, 315, -70, 0)
        + text(400, 220, '热流体上升') + text(400, 255, '较冷流体回流');
      // A fixed illustrative cycle, independent of temperature difference or gravity.
      for (let i = 0; i < 8; i++) {
        const phase = 2 * Math.PI * (i / 8 + (Math.max(0, t) % 12) / 12), x = 400 - 110 * Math.cos(phase), y = 230 - 85 * Math.sin(phase);
        svg += `<g data-convection-tracer="${i}">${circle(x, y, 7, x < 400 ? 'var(--diagram-warm)' : 'var(--diagram-cool)')}</g>`;
      }
    } else svg += text(400, 220, p.medium === 2 ? '固体不能整体流动' : '不画自然对流循环') + text(400, 260, '其他传热方式仍可能存在');
    svg += text(400, 440, '示踪播放不计真实时间、流速或流量');
    metrics = [metric('底部−顶部温差', m.delta, 'K'), metric('重力（相对地球）', p.gravity), metric('自然对流趋势', m.state)];
    notice = '示踪速度、粒子数与播放时间不代表真实流速、流量或起流时间。' + (m.driven ? '下热上冷提供浮力驱动趋势；实际起流还取决于尺寸与流体性质。' : m.state + '；导热或辐射仍可能存在。');
  } else if (id === 'thermal-radiation') {
    svg = rect(95, 95, 610, 270) + rect(300, 175, 200, 110, 'color-mix(in srgb,var(--orange) 18%,var(--surface))') + text(400, 215, `物体 ${p.temperature}℃`) + text(400, 250, `${fmt(m.temperature)} K`) + text(400, 70, `大包围环境 ${p.surroundings}℃ / ${fmt(m.surroundings)} K`);
    if (m.emitted > 0) svg += arrow(500, 200, 160, 0, 'var(--orange)');
    if (m.absorbed > 0) svg += arrow(660, 290, -160, 0, 'var(--blue)');
    svg += text(600, 175, '发出') + text(600, 330, '吸收') + text(400, 410, m.power > 0 ? '净辐射向外：物体向环境传能' : m.power < 0 ? '净辐射向内：环境向物体传能' : '净辐射为零') + text(400, 445, '箭头只表示方向，不按功率比例');
    metrics = [metric('发出辐射功率', m.emitted, 'W'), metric('吸收环境辐射', m.absorbed, 'W'), metric('净向外辐射功率', m.power, 'W')];
    notice = p.temperature === p.surroundings && m.emitted > 0 ? '同温时仍各自辐射，发出与吸收相抵，净功率为零。' : p.emissivity === 0 || p.area === 0 ? '当前面积或发射率为零，模型中的辐射交换为零。' : '计算始终用开尔文温度的四次方。';
  } else if (id === 'evaporation') {
    const width = 140 + (p.area - 10) / 190 * 360, x = 400 - width / 2;
    svg = rect(x, 265, width, 90, 'color-mix(in srgb,var(--diagram-cool) 15%,var(--surface))')
      + `<g data-evaporation-surface="fixed">${line(x, 265, x + width, 265, 'var(--diagram-cool)', 4)}</g>`
      + text(400, 405, `液面 ${p.area} cm²；共同温度 ${p.temperature}℃`);
    const escapeX = 400 - width * .23, returnX = 400 + width * .23;
    svg += arrow(escapeX - 20, 250, 0, -60, 'var(--diagram-warm)') + arrow(returnX + 20, 190, 0, 60, 'var(--diagram-cool)')
      + text(escapeX, 170, '逸出') + text(returnX, 170, '返回');
    // Independent sample paths: equal tracer counts are not a molecular flux ratio.
    // Neither a low Celsius temperature nor saturated air stops molecular exchange.
    for (let i = 0; i < 3; i++) {
      const phase = (i / 3 + (Math.max(0, t) % 4) / 4) % 1;
      const offset = 8 * Math.sin(phase * Math.PI), opacity = .3 + .7 * Math.sin(phase * Math.PI);
      svg += `<g data-evaporation-tracer="escape-${i}" opacity="${opacity}">${circle(escapeX + offset, 295 - 110 * phase, 6, 'var(--diagram-warm)')}</g>`
        + `<g data-evaporation-tracer="return-${i}" opacity="${opacity}">${circle(returnX - offset, 185 + 110 * phase, 6, 'var(--diagram-cool)')}</g>`;
    }
    if (p.airflow > 0) svg += arrow(210, 105, 360, 0) + text(400, 65, `外加气流 ${p.airflow} m/s`);
    else svg += text(400, 65, '无外加气流');
    svg += text(400, 135, `相对湿度 ${p.humidity}%`) + text(400, 375, m.equilibrium ? '饱和平衡：双向交换，无净蒸发' : '未饱和：有净蒸发趋势')
      + text(400, 440, '粒子仅作示踪；液面不据此下降');
    metrics = ['温度因素', '面积因素', '气流因素', '湿度因素'].map((name, i) => metric(name, m.equilibrium ? '等温饱和：无净蒸发' : m.factors[i]));
    notice = '示踪速度、粒子数和数量比不表示真实分子通量或蒸发量；播放时间不代表过程时间，液面保持不变。' + m.state + '。多个条件同时改变时不预测总速率。';
  } else if (id === 'phase-processes') {
    svg = rect(95, 135, 220, 140) + rect(485, 135, 220, 140) + text(205, 185, m.from) + text(595, 185, m.to) + arrow(330, 205, 140, 0) + text(400, 110, m.name);
    if (m.cooling) svg += text(205, 225, '初温 80℃') + text(595, 225, `${fmt(m.temperature - 273.15)}℃（仍是水）`);
    else svg += text(205, 225, `剩余 ${fmt(m.initialMass)} kg`) + text(595, 225, `已转化 ${fmt(m.finalMass)} kg`);
    svg += rect(200, 325, 400, 18) + (m.fraction > 0 ? rect(200, 325, 400 * m.fraction, 18, 'var(--green)') : '') + text(400, 385, `人为选择进度 ${p.progress}%（非时间）`);
    if (p.progress > 0) svg += m.sign > 0 ? arrow(400, 425, 0, -65, 'var(--orange)') : arrow(400, 360, 0, 65, 'var(--blue)');
    svg += text(620, 435, m.sign > 0 ? '过程吸热' : '过程放热');
    metrics = [metric('温度', m.temperature === null ? '未指定：取决于物质与压强' : fmt(m.temperature - 273.15), m.temperature === null ? '' : '℃'), metric('物质吸热（放热为负）', m.heat === null ? '仅定性：' + (m.sign > 0 ? '吸热' : '放热') : fmt(m.heat / 1000), m.heat === null ? '' : 'kJ'), metric('进度', p.progress, '%')];
    notice = m.cooling ? '仅降低温度，没有物态变化。' : p.process >= 5 ? '直接在固态与气态之间转化，不经过液态；未指定温度与潜热，不据此计算速率或热量。' : '纯水在 1 atm 的相变平台；过程进度不代表加热或冷却时间。';
  }
  return { svg, metrics, notice, model: m };
}
