import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUNDATION_EXPLORATIONS, simulateFoundation, viewFoundation } from '../../public/physics-lab/foundation-experiments.mjs';
const defaults = id => Object.fromEntries(FOUNDATION_EXPLORATIONS.find(e => e.id === id).controls.map(c => [c.key, c.value]));
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const model = (id, changes = {}) => simulateFoundation(id, { ...defaults(id), ...changes });

test('catalogue has nine complete, distinct curriculum entries', () => {
  assert.equal(FOUNDATION_EXPLORATIONS.length, 9);
  assert.equal(new Set(FOUNDATION_EXPLORATIONS.map(e => e.id)).size, 9);
  for (const e of FOUNDATION_EXPLORATIONS) {
    for (const key of ['title', 'band', 'goal', 'question', 'limit', 'formula', 'prerequisite']) assert.ok(e[key]?.length, e.id + ':' + key);
    assert.equal(e.guides.length, 3);
    assert.ok(e.stages.length);
    assert.ok(e.stages.every(s => ['primary', 'middle', 'high'].includes(s)));
  }
  assert.equal(simulateFoundation('unknown', {}), null);
  assert.equal(viewFoundation('unknown', {}), null);
});

test('reflection preserves tangential direction and reverses normal direction', () => {
  for (const angle of [0, 35, 85]) {
    const m = model('reflection', { angle });
    close(m.incident, m.reflected);
    close(m.incidentDirection[0], m.reflectedDirection[0]);
    close(m.incidentDirection[1], -m.reflectedDirection[1]);
    close(Math.hypot(...m.reflectedDirection), 1);
  }
});

test('thin lens references distinguish real, virtual and focal-plane singularity', () => {
  const twice = model('lens-image', { distance: 20, focal: 10 });
  close(twice.v, .2); close(twice.magnification, -1); assert.equal(twice.kind, 'real');
  const real = model('lens-image', { distance: 30, focal: 10 });
  close(real.v, .15); close(real.magnification, -.5);
  const virtual = model('lens-image', { distance: 5, focal: 10 });
  close(virtual.v, -.1); close(virtual.magnification, 2); assert.equal(virtual.kind, 'virtual');
  for (const m of [twice, real, virtual]) close(1 / m.f, 1 / m.u + 1 / m.v);
  const focal = model('lens-image', { distance: 10, focal: 10 });
  assert.equal(focal.v, null); assert.equal(focal.imageHeight, null); assert.equal(focal.kind, 'infinite');
  assert.match(viewFoundation('lens-image', { ...defaults('lens-image'), distance: 10, focal: 10 }).notice, /平行/);
});

test('shadow follows similar triangles and scales linearly with object height', () => {
  const m = model('shadow', { distance: 1, gap: 2, height: .2 });
  close(m.height, .6); close(m.magnification, 3);
  close(model('shadow', { distance: 1, gap: 2, height: .4 }).height, 2 * m.height);
  close(model('shadow', { distance: 2, gap: 2, height: .2 }).height, .4);
});

test('echo uses two-way path and temperature-dependent speed', () => {
  const m = model('echo', { distance: 100, temperature: 20 });
  close(m.speed, 343.42); close(m.time, 200 / 343.42); close(m.path, 200);
  close(model('echo', { distance: 200, temperature: 20 }).time, 2 * m.time);
  assert.ok(model('echo', { temperature: 40 }).time < model('echo', { temperature: 0 }).time);
});

test('phase-change thresholds and latent-heat fractions conserve supplied energy', () => {
  const cases = [[0, -20, 0, 0], [42, 0, 0, 0], [209, 0, .5, 0], [376, 0, 1, 0], [586, 50, 1, 0], [796, 100, 1, 0], [1924, 100, 1, .5], [3052, 100, 1, 1]];
  for (const [heat, temperature, melted, vaporized] of cases) {
    const m = model('phase-change', { heat, mass: 1.5 });
    close(m.celsius, temperature); close(m.melted, melted); close(m.vaporized, vaporized);
    close(m.heat, heat * 1000 * 1.5);
    close(m.temperature, temperature + 273.15);
  }
  const a = model('phase-change', { mass: .5 }), b = model('phase-change', { mass: 1 });
  close(a.temperature, b.temperature); close(b.heat, 2 * a.heat);
  for (const heat of [100, 200, 300]) close(model('phase-change', { heat }).temperature, 273.15);
  for (const heat of [900, 1500, 2500]) close(model('phase-change', { heat }).temperature, 373.15);
});

test('linear expansion has correct units, zero and contraction', () => {
  const m = model('thermal-expansion', { length: 2, alpha: 12, delta: 100 });
  close(m.extension, .0024); close(m.length, 2.0024);
  close(model('thermal-expansion', { delta: 0 }).extension, 0);
  assert.ok(model('thermal-expansion', { delta: -50 }).extension < 0);
  close(model('thermal-expansion', { length: 1, alpha: 12, delta: 100 }).extension, m.extension / 2);
});

test('steady slab conduction gives 200 W and reverses sign with boundary temperatures', () => {
  const m = model('conduction', { hot: 60, cold: 20, conductivity: 1, area: 1, thickness: .2 });
  close(m.power, 200); close(m.gradient, -200); close(m.middle, 313.15);
  close(model('conduction', { hot: 20, cold: 60 }).power, -m.power);
  close(model('conduction', { hot: 20, cold: 20 }).power, 0);
  close(model('conduction', { thickness: .4 }).power, m.power / 2);
});

test('ideal gas uses SI volume, Kelvin and absolute pressure', () => {
  const m = model('ideal-gas', { amount: 1, temperature: 273.15, volume: 22.414 });
  close(m.volume, .022414); close(m.pressure, 101325, 2e-5);
  close(m.product, 8.314462618 * 273.15);
  const base = model('ideal-gas');
  close(model('ideal-gas', { temperature: 600 }).pressure, 2 * base.pressure);
  close(model('ideal-gas', { volume: 40 }).pressure, base.pressure / 2);
});

test('double-slit known spacing and bright/dark conditions', () => {
  const m = model('interference', { wavelength: 500, separation: .5, distance: 2 });
  close(m.spacing, .002);
  close(m.intensityAt(0), 1); close(m.intensityAt(m.spacing), 1); close(m.intensityAt(m.spacing / 2), 0);
  for (const y of [.0003, .0031, .02]) { close(m.intensityAt(y), m.intensityAt(-y)); assert.ok(m.intensityAt(y) >= 0 && m.intensityAt(y) <= 1); }
  close(model('interference', { wavelength: 500, separation: 1, distance: 2 }).spacing, m.spacing / 2);
});

test('all default, single-control boundaries and combined extrema render finite SVG', () => {
  for (const e of FOUNDATION_EXPLORATIONS) {
    const base = defaults(e.id);
    const samples = [base, Object.fromEntries(e.controls.map(c => [c.key, c.min])), Object.fromEntries(e.controls.map(c => [c.key, c.max]))];
    for (const c of e.controls) for (const bound of [c.min, c.max]) samples.push({ ...base, [c.key]: bound });
    for (const p of samples) {
      const view = viewFoundation(e.id, p);
      assert.ok(view.svg.length > 100, e.id);
      assert.ok(view.metrics.length >= 2, e.id);
      assert.doesNotMatch(view.svg, /NaN|Infinity|undefined/, e.id + JSON.stringify(p));
      for (const match of view.svg.matchAll(/(?:width|height|r)="(-?[\d.e+]+)"/g)) assert.ok(Number(match[1]) >= 0, e.id + ':' + match[0]);
      for (const value of Object.values(view.model)) if (typeof value === 'number') assert.ok(Number.isFinite(value), e.id);
    }
  }
});
