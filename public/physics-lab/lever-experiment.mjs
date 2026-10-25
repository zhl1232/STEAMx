import { G, control, text, line, arrow, circle, rect, metric, fmt } from './experiment-kit.mjs';

const LIMIT = 35 * Math.PI / 180;
const DURATION = 8;
export const LEVER_EXPERIMENTS = [{
  id: 'lever', topic: 'motion', title: '让杠杆平衡',
  stages: ['primary', 'middle'], band: '小学科学 · 初中物理',
  goal: '放开杠杆，观察哪边下降；调整配重和位置，让它保持平衡。',
  question: '更轻的配重，放得更远，能平衡较重的配重吗？',
  prerequisite: '长短比较与力', keywords: ['力臂', '力矩', '配重', '平衡', '跷跷板'],
  controls: [control('leftForce', '左侧配重的重力', 1, 10, 1, 6, 'N'),
    control('rightForce', '右侧配重的重力', 1, 10, 1, 4, 'N'),
    control('leftArm', '左配重距支点', .2, 2, .1, 1, 'm'),
    control('rightArm', '右配重距支点', .2, 2, .1, 1, 'm')],
  presets: [
    { label: '左侧下降', params: { leftForce: 6, rightForce: 4, leftArm: 1, rightArm: 1 } },
    { label: '保持平衡', params: { leftForce: 2, rightForce: 4, leftArm: 2, rightArm: 1 } },
    { label: '右侧下降', params: { leftForce: 4, rightForce: 6, leftArm: 1, rightArm: 1 } },
  ],
  playLabel: '释放杠杆', animation: { duration: DURATION, rate: .5 },
  guides: [
    '先释放杠杆看看哪边下降，再选择「保持平衡」比较。试着只移动一个配重，让两边平衡。',
    '保持一侧不变，寻找另一侧两种能平衡的重力与位置组合。每次调整后从水平静止重新释放。',
    '力臂是支点到竖直重力作用线的水平距离。观察倾斜时力臂的变化，用 F₁l₁=F₂l₂ 解释平衡。',
  ],
  formula: 'l=r cosθ；τ=F₁l₁−F₂l₂；I=(F₁/g)r₁²+(F₂/g)r₂²；Iα=τ',
  limit: '刚性轻杆绕固定支点转动，配重视为固定在杆上的质点，圆块大小仅为示意。忽略杆重、摩擦和空气阻力，从水平静止释放；倾斜到 ±35° 时被止挡托住、不反弹。止挡处停止不代表两侧重力矩平衡。角度和过程时间按此理想模型计算，以半速播放。',
}];

export function simulateLever(id, p, time = 0) {
  if (id !== 'lever') return null;
  const initialLeft = p.leftForce * p.leftArm, initialRight = p.rightForce * p.rightArm;
  const initialTorque = initialLeft - initialRight;
  const inertia = (p.leftForce * p.leftArm ** 2 + p.rightForce * p.rightArm ** 2) / G;
  const balanced = Math.abs(initialTorque) < 1e-7;
  const elapsed = Math.max(0, Math.min(DURATION, Number.isFinite(time) ? time : 0));
  let angle = 0, angularVelocity = 0, stopped = false;
  // Recompute from release for deterministic playback, scrubbing and records.
  // Positive rotation lowers the left end. Both forces remain vertical.
  const acceleration = theta => initialTorque * Math.cos(theta) / inertia;
  const steps = Math.ceil(elapsed * 240), dt = steps ? elapsed / steps : 0;
  for (let i = 0; !balanced && i < steps; i++) {
    const a = [angularVelocity, acceleration(angle)];
    const b = [angularVelocity + a[1] * dt / 2, acceleration(angle + a[0] * dt / 2)];
    const c = [angularVelocity + b[1] * dt / 2, acceleration(angle + b[0] * dt / 2)];
    const d = [angularVelocity + c[1] * dt, acceleration(angle + c[0] * dt)];
    angle += dt / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]);
    angularVelocity += dt / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
    if (Math.abs(angle) >= LIMIT) {
      angle = Math.sign(initialTorque) * LIMIT;
      angularVelocity = 0;
      stopped = true;
      break;
    }
  }
  const leftArm = p.leftArm * Math.cos(angle), rightArm = p.rightArm * Math.cos(angle);
  const left = p.leftForce * leftArm, right = p.rightForce * rightArm, torque = left - right;
  return { left, right, torque, balanced, initialLeft, initialRight, inertia, elapsed,
    angle, angularVelocity, angularAcceleration: stopped ? 0 : torque / inertia,
    leftArm, rightArm, stopped, stopTorque: stopped ? -torque : 0 };
}

export function viewLever(id, p, time = 0) {
  const m = simulateLever(id, p, time); if (!m) return null;
  const cx = 400, cy = 205, scale = 120, halfBeam = 270;
  const degrees = m.angle * 180 / Math.PI, cos = Math.cos(m.angle), sin = Math.sin(m.angle);
  const stopX = halfBeam * Math.cos(LIMIT), stopY = cy + halfBeam * Math.sin(LIMIT) + 7;
  const left = { x: cx - p.leftArm * scale * cos, y: cy + p.leftArm * scale * sin };
  const right = { x: cx + p.rightArm * scale * cos, y: cy - p.rightArm * scale * sin };
  let svg = text(400, 28, '从水平静止释放')
    + line(100, cy, 700, cy, 'var(--line-strong)', 1, '5 5')
    + line(100, 395, 700, 395, 'var(--line-strong)', 3)
    + `<path d="M400 205L363 378H437Z" fill="var(--surface)" stroke="var(--diagram-stroke)" stroke-width="3"/>`
    + rect(351, 378, 98, 17, 'var(--surface)');
  for (const side of [-1, 1]) {
    const x = cx + side * stopX;
    svg += rect(x - 15, stopY, 30, 395 - stopY, 'var(--surface)')
      + line(x - 17, stopY, x + 17, stopY, 'var(--diagram-warm)', 4);
  }
  svg += `<g data-lever-beam transform="rotate(${-degrees} ${cx} ${cy})">`
    + line(cx - halfBeam, cy, cx + halfBeam, cy, 'var(--diagram-stroke)', 14);
  for (let i = -10; i <= 10; i++) if (i) {
    const x = cx + i * 24;
    svg += line(x, cy - 5, x, cy + 5, 'var(--surface)', i % 5 ? 1 : 3);
  }
  svg += '</g>' + circle(cx, cy, 9, 'var(--surface)', 'var(--diagram-stroke)');
  for (const [point, force, side, color, name] of [[left, p.leftForce, -1, 'var(--diagram-cool)', 'left'], [right, p.rightForce, 1, 'var(--diagram-warm)', 'right']]) {
    const radius = 10 + 3 * Math.sqrt(force), ax = point.x + side * (radius + 15);
    svg += `<g data-lever-weight="${name}" transform="translate(${point.x} ${point.y})">`
      + circle(0, 0, radius, color, 'var(--surface)') + circle(0, 0, 4, 'var(--surface)', 'var(--surface)') + '</g>'
      + `<g data-lever-force="${name}">` + arrow(ax, point.y - 25, 0, 14 + force * 5, color)
      + text(ax, point.y - 38, `${force} N`) + '</g>'
      + line(point.x, point.y + radius + 7, point.x, 421, 'var(--line-strong)', 1, '3 5');
  }
  svg += line(left.x, 421, cx, 421, 'var(--diagram-cool)', 3)
    + line(cx, 421, right.x, 421, 'var(--diagram-warm)', 3)
    + line(cx, 414, cx, 429, 'var(--diagram-stroke)', 2)
    + text(245, 451, `左力臂 ${fmt(m.leftArm)} m`)
    + text(555, 451, `右力臂 ${fmt(m.rightArm)} m`)
    + text(cx, 350, m.balanced ? '平衡' : `${fmt(Math.abs(degrees), 1)}°`);
  const state = m.balanced ? '保持水平' : m.stopped ? '止挡托住' : m.elapsed === 0 ? '等待释放' : m.angle > 0 ? '左侧下降' : '右侧下降';
  const notice = m.stopped ? '杠杆碰到止挡，运动停止；两侧重力矩仍不相等。调整配重后可重新释放。'
    : m.balanced ? '两侧力矩相等。释放后仍保持水平；试着改变一个配重或它的位置。'
    : m.elapsed === 0 ? '点击「释放杠杆」，观察哪边下降。改变配重或位置后会回到水平起点。'
    : '配重随杆转动，重力始终竖直向下。下方彩线表示当前力臂。';
  return { svg, notice, model: m, metrics: [metric('左侧重力矩', m.left, 'N·m'),
    metric('右侧重力矩', m.right, 'N·m'), metric('当前状态', state)] };
}
