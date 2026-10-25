import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPLETION_FOUNDATIONS, simulateCompletionFoundation, viewCompletionFoundation } from '../../public/physics-lab/foundation-completion.mjs';

const defaults = id => Object.fromEntries(COMPLETION_FOUNDATIONS.find(e => e.id === id).controls.map(c => [c.key, c.value]));
const model = (id, changes = {}) => simulateCompletionFoundation(id, { ...defaults(id), ...changes });
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

test('nine complete entries declare numeric controls, stages, guides and model bounds', () => {
  assert.equal(COMPLETION_FOUNDATIONS.length, 9);
  assert.equal(new Set(COMPLETION_FOUNDATIONS.map(e => e.id)).size, 9);
  for (const e of COMPLETION_FOUNDATIONS) {
    for (const key of ['title', 'goal', 'question', 'band', 'formula', 'limit', 'prerequisite']) assert.ok(e[key]?.length, e.id + ':' + key);
    assert.equal(e.guides.length, 3);
    assert.ok(e.keywords.length >= 3);
    assert.ok(e.stages.length && e.stages.every(s => ['primary', 'middle', 'high'].includes(s)));
    for (const c of e.controls) {
      for (const key of ['min', 'max', 'step', 'value']) assert.ok(Number.isFinite(c[key]), e.id + ':' + c.key);
      assert.ok(c.min <= c.value && c.value <= c.max && c.step > 0);
      close((c.value - c.min) / c.step, Math.round((c.value - c.min) / c.step));
      if (c.options) assert.deepEqual(c.options.map(o => o.value), Array.from({ length: c.max + 1 }, (_, i) => i));
    }
  }
  assert.equal(simulateCompletionFoundation('unknown', {}), null);
  assert.equal(viewCompletionFoundation('unknown', {}), null);
});

test('density subtracts tare and initial liquid, converting g and mL to SI', () => {
  const m = model('density-measurement');
  close(m.mass, .12); close(m.volume, 40e-6); close(m.density, 3000);
  close(m.balanceLoaded - m.balanceEmpty, m.mass);
  close(m.finalVolume - m.initialVolume, m.volume);
  close(model('density-measurement', { tare: 100, initial: 100 }).density, m.density);
  close(model('density-measurement', { mass: 240 }).density, m.density * 2);
  close(model('density-measurement', { displacement: 80 }).density, m.density / 2);
  const invalid = model('density-measurement', { displacement: 0 });
  assert.equal(invalid.density, null); assert.equal(invalid.valid, false);
  assert.match(viewCompletionFoundation('density-measurement', { ...defaults('density-measurement'), displacement: 0 }).notice, /不能除以零/);
});

test('plane mirror preserves upright height with virtual image an equal distance behind', () => {
  for (const distance of [10, 60, 150]) for (const height of [5, 30, 50]) {
    const m = model('plane-mirror', { distance, height });
    close(m.objectDistance, -m.imageDistance); close(m.objectHeight, m.imageHeight);
    close(m.magnification, 1); assert.equal(m.kind, 'virtual');
  }
});

test('sound needs a medium; distance and frequency affect time and wavelength separately', () => {
  const vacuum = model('sound-medium', { medium: 0 });
  assert.equal(vacuum.travels, false); assert.equal(vacuum.speed, null);
  assert.equal(vacuum.time, null); assert.equal(vacuum.wavelength, null);
  for (const [medium, speed] of [[1, 343], [2, 1480], [3, 5960]]) {
    const m = model('sound-medium', { medium, distance: 10, frequency: 500 });
    close(m.speed, speed); close(m.time, 10 / speed); close(m.wavelength, speed / 500);
    close(model('sound-medium', { medium, distance: 20 }).time, m.time * 2);
    close(model('sound-medium', { medium, frequency: 1000 }).wavelength, m.wavelength / 2);
  }
});

test('prism applies Snell law to common incidence, handles achromatic and TIR cases', () => {
  const m = model('prism-dispersion');
  for (const ray of m.rays) {
    close(Math.sin(m.incidence), ray.index * Math.sin(ray.refraction));
    close(ray.refraction + ray.secondIncidence, m.apex);
    close(Math.sin(ray.emergence), ray.index * Math.sin(ray.secondIncidence));
    close(ray.deviation, m.incidence + ray.emergence - m.apex);
  }
  assert.ok(m.rays[2].index > m.rays[0].index);
  assert.ok(m.rays[2].deviation > m.rays[0].deviation);
  const neutral = model('prism-dispersion', { dispersion: 0 });
  close(neutral.separation, 0);
  for (const r of neutral.rays) close(r.index, 1.5);
  const tir = model('prism-dispersion', { apex: 60, incidence: 30, dispersion: .01 });
  assert.ok(tir.rays.some(r => r.totalInternalReflection));
  for (const r of tir.rays.filter(r => r.totalInternalReflection)) { assert.equal(r.emergence, null); assert.equal(r.deviation, null); }
});

test('additive RGB makes black, primaries, secondary colors and neutral gray without channel clipping', () => {
  const cases = [[0, 0, 0, '无光（黑）'], [100, 0, 0, '红'], [100, 100, 0, '黄'], [0, 100, 100, '青'], [100, 0, 100, '品红'], [100, 100, 100, '白 / 中性灰'], [50, 50, 50, '白 / 中性灰']];
  for (const [red, green, blue, name] of cases) {
    const m = model('color-mixing', { red, green, blue });
    assert.equal(m.name, name);
    assert.ok(m.encoded.every(c => Number.isInteger(c) && c >= 0 && c <= 255));
  }
  assert.deepEqual(model('color-mixing', { red: 100, green: 100, blue: 100 }).encoded, [255, 255, 255]);
  assert.deepEqual(model('color-mixing', { red: 0, green: 0, blue: 0 }).encoded, [0, 0, 0]);
  assert.deepEqual(model('color-mixing', { red: 50, green: 50, blue: 50 }).encoded, [188, 188, 188]);
});

test('convection distinguishes unstable fluid, stable stratification, zero gravity and solid', () => {
  assert.equal(model('convection').driven, true);
  for (const p of [{ bottom: 20, top: 60 }, { bottom: 20, top: 20 }, { gravity: 0 }, { medium: 2 }]) assert.equal(model('convection', p).driven, false);
  assert.match(model('convection', { bottom: 20, top: 60 }).state, /稳定分层/);
  assert.match(model('convection', { medium: 2 }).state, /固体/);
  assert.equal(model('convection', { medium: 1 }).driven, true);
  assert.equal('power' in model('convection'), false);
});

test('convection tracers follow the rising, cooling and return loop only when circulation is indicated', () => {
  const e = COMPLETION_FOUNDATIONS.find(e => e.id === 'convection');
  assert.ok(e.animation.duration > 0);
  assert.equal(e.animation.illustrative, true);
  const trace = (svg, i) => {
    const match = svg.match(new RegExp(`<g data-convection-tracer="${i}"><circle cx="([^"]+)" cy="([^"]+)"`));
    assert.ok(match); return match.slice(1).map(Number);
  };
  for (const medium of [0, 1]) {
    const p = { ...defaults('convection'), medium }, start = viewCompletionFoundation('convection', p, 0), next = viewCompletionFoundation('convection', p, 1.5);
    assert.equal((start.svg.match(/data-convection-tracer=/g) || []).length, 8);
    close(trace(start.svg, 0)[0], 290); close(trace(start.svg, 0)[1], 230);
    assert.ok(trace(next.svg, 0)[1] < trace(start.svg, 0)[1], 'heated-side tracer rises');
    assert.ok(trace(next.svg, 4)[1] > trace(start.svg, 4)[1], 'cool-side tracer returns downward');
    for (const t of [0, 1.5, 3, 6, 9, 1e6]) {
      const v = viewCompletionFoundation('convection', p, t);
      assert.deepEqual(v.model, model('convection', { medium })); assert.deepEqual(v.metrics, start.metrics);
      for (let i = 0; i < 8; i++) { const [x, y] = trace(v.svg, i); close(((x - 400) / 110) ** 2 + ((y - 230) / 85) ** 2, 1); }
    }
    assert.notEqual(start.svg, next.svg); assert.match(next.notice, /示踪速度、粒子数/);
  }
  for (const changes of [{ bottom: 20, top: 60 }, { bottom: 20, top: 20 }, { gravity: 0 }, { medium: 2 }]) {
    const p = { ...defaults('convection'), ...changes }, start = viewCompletionFoundation('convection', p, 0), later = viewCompletionFoundation('convection', p, 3);
    assert.equal(start.svg, later.svg); assert.doesNotMatch(later.svg, /data-convection-tracer/); assert.equal(later.model.driven, false);
  }
});

test('net radiation uses Kelvin fourth powers, area/emissivity scaling and correct direction', () => {
  const m = model('thermal-radiation', { temperature: 100, surroundings: 20, emissivity: 1, area: 1 });
  close(m.temperature, 373.15); close(m.surroundings, 293.15);
  close(m.power, 5.670374419e-8 * (373.15 ** 4 - 293.15 ** 4));
  close(m.emitted - m.absorbed, m.power);
  close(model('thermal-radiation', { temperature: 100, surroundings: 20, emissivity: .5, area: 2 }).power, m.power);
  close(model('thermal-radiation', { temperature: 20, surroundings: 100, emissivity: 1, area: 1 }).power, -m.power);
  const equilibrium = model('thermal-radiation', { temperature: 20, surroundings: 20 });
  close(equilibrium.power, 0); assert.ok(equilibrium.emitted > 0); close(equilibrium.emitted, equilibrium.absorbed);
  for (const p of [{ area: 0 }, { emissivity: 0 }]) {
    const zero = model('thermal-radiation', p); close(zero.power, 0); close(zero.emitted, 0); close(zero.absorbed, 0);
  }
});

test('evaporation comparisons are categorical and isothermal saturated air has no net evaporation', () => {
  assert.deepEqual(model('evaporation').factors, Array(4).fill('与对照相同'));
  const favorable = model('evaporation', { temperature: 60, area: 200, airflow: 5, humidity: 0 });
  assert.deepEqual(favorable.factors, Array(4).fill('有利于净蒸发'));
  const inhibited = model('evaporation', { temperature: 5, area: 10, airflow: 0, humidity: 95 });
  assert.deepEqual(inhibited.factors, Array(4).fill('抑制净蒸发'));
  const saturated = model('evaporation', { temperature: 60, airflow: 5, humidity: 100 });
  assert.equal(saturated.equilibrium, true); assert.match(saturated.state, /无净蒸发/);
  assert.equal('rate' in favorable, false); assert.equal('dryingTime' in favorable, false);
  close(favorable.area, .02); close(favorable.temperature, 333.15);
});

test('evaporation animates independent escape and return samples without changing liquid level or qualitative outputs', () => {
  const e = COMPLETION_FOUNDATIONS.find(e => e.id === 'evaporation');
  assert.ok(e.animation.duration > 0);
  assert.equal(e.animation.illustrative, true);
  const tracer = (svg, name) => {
    const match = svg.match(new RegExp(`<g data-evaporation-tracer="${name}"[^>]*><circle cx="([^"]+)" cy="([^"]+)"`));
    assert.ok(match); return match.slice(1).map(Number);
  };
  const surface = svg => svg.match(/<g data-evaporation-surface="fixed">.*?<\/g>/)[0];
  // Include zero Celsius explicitly: it must not become an off switch for exchange.
  for (const temperature of [0, 5, 20, 60]) for (const humidity of [0, 50, 100]) for (const area of [10, 200]) {
    const p = { ...defaults('evaporation'), temperature, humidity, area }, start = viewCompletionFoundation('evaporation', p, 0), later = viewCompletionFoundation('evaporation', p, 1);
    assert.ok(tracer(later.svg, 'escape-0')[1] < tracer(start.svg, 'escape-0')[1]);
    assert.ok(tracer(later.svg, 'return-0')[1] > tracer(start.svg, 'return-0')[1]);
    assert.notEqual(start.svg, later.svg);
    for (const t of [0, 1, 3, 12, 1e6]) {
      const v = viewCompletionFoundation('evaporation', p, t);
      assert.deepEqual(v.model, model('evaporation', { temperature, humidity, area })); assert.deepEqual(v.metrics, start.metrics);
      assert.equal(surface(v.svg), surface(start.svg)); assert.equal((v.svg.match(/data-evaporation-tracer=/g) || []).length, 6);
      for (const direction of ['escape', 'return']) for (let i = 0; i < 3; i++) { const [x, y] = tracer(v.svg, `${direction}-${i}`); assert.ok(x > 150 && x < 650 && y >= 185 && y <= 295); }
    }
    assert.match(later.notice, /粒子数和数量比不表示/);
    if (humidity === 100) { assert.equal(later.model.equilibrium, true); assert.match(later.svg, /双向交换，无净蒸发/); }
  }
});

test('cooling and reverse phase transitions conserve energy and mass; sublimation stays qualitative', () => {
  const cooling = model('phase-processes', { process: 0, progress: 50, mass: 1 });
  close(cooling.temperature, 323.15); close(cooling.heat, -126000);
  for (const [forward, reverse, latent, temperature] of [[1, 2, 334000, 273.15], [3, 4, 2256000, 373.15]]) {
    for (const progress of [0, 50, 100]) {
      const a = model('phase-processes', { process: forward, progress, mass: 2 }), b = model('phase-processes', { process: reverse, progress, mass: 2 });
      close(a.heat, latent * 2 * progress / 100); close(a.heat, -b.heat);
      close(a.temperature, temperature); close(b.temperature, temperature);
      close(a.initialMass + a.finalMass, 2); close(b.initialMass + b.finalMass, 2);
    }
  }
  for (const process of [5, 6]) {
    const m = model('phase-processes', { process });
    assert.equal(m.heat, null); assert.equal(m.temperature, null);
    assert.equal(m.sign, process === 5 ? 1 : -1);
    assert.ok(!m.from.includes('液') && !m.to.includes('液'));
  }
});

test('all controls, enum choices and pairwise extrema render finite labeled diagrams', () => {
  const finite = value => {
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
    else if (Array.isArray(value)) value.forEach(finite);
    else if (value && typeof value === 'object') Object.values(value).forEach(finite);
  };
  for (const e of COMPLETION_FOUNDATIONS) {
    const base = defaults(e.id), samples = [base];
    for (const c of e.controls) for (const n of c.options?.map(o => o.value) || [c.min, c.max]) samples.push({ ...base, [c.key]: n });
    // Exhaust combined boundaries to catch geometric singularities, not just default rendering.
    for (let bits = 0; bits < 2 ** e.controls.length; bits++) samples.push(Object.fromEntries(e.controls.map((c, i) => [c.key, bits & (1 << i) ? c.max : c.min])));
    for (const p of samples) for (const t of [0, 3]) {
      const view = viewCompletionFoundation(e.id, p, t);
      assert.ok(view.svg.length > 200, e.id);
      assert.ok(view.metrics.length >= 3, e.id);
      assert.match(view.svg, /<text/);
      assert.doesNotMatch(view.svg, /NaN|Infinity|undefined/, e.id + JSON.stringify(p));
      for (const match of view.svg.matchAll(/(?:width|height|r)="(-?[\d.e+]+)"/g)) assert.ok(Number(match[1]) >= 0, e.id + ':' + match[0]);
      finite(view.model);
    }
  }
});
