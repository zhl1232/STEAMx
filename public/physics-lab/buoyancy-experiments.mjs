import { G, control, text, line, rect, arrow, metric, fmt } from './experiment-kit.mjs';

const WATER_DEPTH = .4;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const BUOYANCY_EXPERIMENTS = [{
  id: 'float-sink', topic: 'pressure', title: '释放物体，观察浮沉',
  band: '小学科学 · 初中物理', stages: ['primary', 'middle', 'high'],
  goal: '从不同深度释放物体，观察上浮、下沉、悬浮与最终平衡。',
  question: '完全浸没的同一物体，从更深处释放时，初始浮力会变吗？',
  prerequisite: '质量、体积与浮力；深入需密度',
  keywords: ['漂浮', '悬浮', '沉底', '阿基米德', '深度', '密度'],
  controls: [control('mass', '物体质量', .1, 2, .1, .5, 'kg'),
    control('volume', '物体体积', .2, 2, .1, 1, 'L'),
    control('density', '液体密度', 800, 1200, 50, 1000, 'kg/m³'),
    control('depth', '释放时中心深度（水面下为正）', -.15, .25, .01, .2, 'm')],
  animation: { duration: 12, rate: 1 },
  guides: [
    '从静止释放，观察物体怎样运动。只改变质量，比较最后是漂浮、悬浮还是沉底。',
    '保持质量和体积不变，选两个完全浸没的初始深度，比较 0 秒时的浮力；再比较漂浮时的浸入比例。',
    '用 F浮=ρ液gV排 解释浮力变化。漂浮时求 V排/V；沉底时说明支撑力为何不能省略。',
  ],
  formula: 'F浮=ρ液gV排；m·a=mg−F浮−b·v（向下为正）；漂浮时 V排/V=ρ物/ρ液',
  limit: '均匀刚性立方体，始终保持水平，水深 0.4 m。用浸入比例加权的线性阻力表现趋于平衡的趋势，时间不对应真实材料的实验标定；不模拟水波、旋转、附加质量、吸水或表面张力。容器底部粗糙且透水，仍有完整浮力；触底不反弹。',
}];

export function simulateBuoyancy(id, p, time = 0) {
  if (id !== 'float-sink') return null;
  const volume = p.volume / 1000, height = Math.cbrt(volume), area = height ** 2;
  const weight = p.mass * G, fullBuoyancy = p.density * G * volume;
  const bottom = WATER_DEPTH - height / 2;
  const damping = 2 * Math.sqrt(p.mass * p.density * G * area);
  const fractionAt = depth => clamp((depth + height / 2) / height, 0, 1);
  const derivative = (depth, velocity) => {
    const fraction = fractionAt(depth);
    return [velocity, (weight - fullBuoyancy * fraction - damping * fraction * velocity) / p.mass];
  };
  let depth = Math.min(bottom, p.depth), velocity = 0;
  const elapsed = clamp(Number.isFinite(time) ? time : 0, 0, 12);
  // Fixed small RK4 steps keep the result deterministic when scrubbing or
  // restoring a saved observation. No animation-frame state is accumulated.
  const steps = Math.ceil(elapsed * 120), dt = steps ? elapsed / steps : 0;
  for (let i = 0; i < steps; i++) {
    const a = derivative(depth, velocity);
    const b = derivative(depth + a[0] * dt / 2, velocity + a[1] * dt / 2);
    const c = derivative(depth + b[0] * dt / 2, velocity + b[1] * dt / 2);
    const d = derivative(depth + c[0] * dt, velocity + c[1] * dt);
    depth += dt / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]);
    velocity += dt / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
    if (depth >= bottom) { depth = bottom; velocity = Math.min(0, velocity); }
  }
  const fraction = fractionAt(depth), buoyancy = fullBuoyancy * fraction;
  const support = depth >= bottom - 1e-8 && velocity >= 0 ? Math.max(0, weight - buoyancy) : 0;
  const drag = -damping * fraction * velocity;
  const ratio = p.mass / (p.density * volume);
  const outcome = Math.abs(ratio - 1) < 1e-9 ? '悬浮' : ratio < 1 ? '漂浮' : '沉底';
  return { depth, velocity, height, fraction, weight, buoyancy, support, drag,
    acceleration: (weight - buoyancy + drag - support) / p.mass,
    equilibriumFraction: ratio <= 1 ? ratio : null, outcome, elapsed,
    settled: Math.abs(velocity) < 1e-4 && Math.abs(weight - buoyancy + drag - support) < 1e-4 };
}

export function viewBuoyancy(id, p, time = 0) {
  const m = simulateBuoyancy(id, p, time); if (!m) return null;
  const surface = 160, scale = 600, y = surface + m.depth * scale, h = m.height * scale;
  const forces = Math.max(m.weight, m.buoyancy, m.support, 1), forceScale = 72 / forces;
  let svg = rect(130, 160, 400, 240, 'var(--surface-muted)')
    + '<path d="M130 160H530V400H130Z" fill="var(--blue)" opacity=".12"/>'
    + line(130, surface, 530, surface, 'var(--blue)', 2)
    + line(130, 400, 530, 400, 'var(--diagram-stroke)', 5)
    + rect(330 - h / 2, y - h / 2, h, h, '#d6c29b')
    + arrow(330 - h / 2 - 18, y, 0, -m.buoyancy * forceScale, 'var(--green)')
    + arrow(330 + h / 2 + 18, y, 0, m.weight * forceScale, 'var(--orange)')
    + text(580, 160, '水面 0 m') + text(580, 400, '底部 0.4 m')
    + text(400, 30, '从静止释放 · 箭头只表示力的相对大小')
    + text(400, 445, '绿：浮力　橙：重力　蓝：底部支撑力');
  if (m.support > 0) svg += arrow(330, y + h / 2 + 8, 0, -m.support * forceScale, 'var(--blue)');
  if (Math.abs(m.velocity) > .001) svg += arrow(195, y, 0, Math.sign(m.velocity) * 45, 'var(--diagram-stroke)') + text(195, y - 55, m.velocity > 0 ? '下沉' : '上浮');
  const notice = m.settled ? `已接近平衡：${m.outcome}。${m.support > 0 ? '此时浮力与底部支撑力共同平衡重力。' : '浮力与重力相互平衡。'}`
    : '拖动时间或播放过程；比较不同释放深度时，请先回到 0 秒。';
  return { svg, notice, model: m, metrics: [metric('浮力', m.buoyancy, 'N'), metric('重力', m.weight, 'N'),
    metric('当前浸入比例', m.fraction * 100, '%'), metric('速度（向下为正）', m.velocity, 'm/s'),
    metric('最终状态', m.outcome), metric('漂浮 / 悬浮所需浸入比例', m.equilibriumFraction === null ? '无法仅靠浮力平衡' : fmt(m.equilibriumFraction * 100) + '%'),
    metric('底部支撑力', m.support, 'N')] };
}
