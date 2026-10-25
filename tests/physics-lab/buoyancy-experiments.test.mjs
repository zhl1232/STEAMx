import test from 'node:test';
import assert from 'node:assert/strict';
import { BUOYANCY_EXPERIMENTS, simulateBuoyancy, viewBuoyancy } from '../../public/physics-lab/buoyancy-experiments.mjs';
const entry = BUOYANCY_EXPERIMENTS[0];
const defaults = Object.fromEntries(entry.controls.map(c => [c.key, c.value]));
const model = (p = {}, t = 0) => simulateBuoyancy('float-sink', { ...defaults, ...p }, t);
const close = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('fully submerged buoyancy does not depend on release depth', () => {
  const shallow = model({ depth: .1 }), deep = model({ depth: .25 });
  close(shallow.fraction, 1); close(deep.fraction, 1);
  close(shallow.buoyancy, deep.buoyancy); close(shallow.buoyancy, 9.81);
  assert.ok(shallow.acceleration < 0);
});

test('a light body rises to floating equilibrium from above or below the surface', () => {
  for (const depth of [-.15, .1, .25]) {
    const final = model({ depth }, 12);
    assert.equal(final.outcome, '漂浮');
    close(final.fraction, .5); close(final.buoyancy, final.weight);
    close(final.velocity, 0); close(final.support, 0);
    assert.ok(final.settled);
  }
});

test('equal-density submerged body stays suspended at its original depth', () => {
  const final = model({ mass: 1, depth: .2 }, 12);
  assert.equal(final.outcome, '悬浮'); close(final.depth, .2);
  close(final.velocity, 0); close(final.buoyancy, final.weight); close(final.support, 0);
});

test('a dense body settles on the permeable floor and support completes force balance', () => {
  const final = model({ mass: 2 }, 12);
  assert.equal(final.outcome, '沉底'); assert.equal(final.equilibriumFraction, null);
  close(final.depth + final.height / 2, .4);
  close(final.buoyancy + final.support, final.weight); close(final.velocity, 0);
  assert.ok(final.support > 0); assert.ok(final.settled);
});

test('all combined control endpoints stay finite, contained, and deterministic on restore', () => {
  for (let mask = 0; mask < 2 ** entry.controls.length; mask++) {
    const p = Object.fromEntries(entry.controls.map((c, i) => [c.key, mask & (1 << i) ? c.max : c.min]));
    for (const t of [0, .25, 2, 12]) {
      const m = simulateBuoyancy(entry.id, p, t), v = viewBuoyancy(entry.id, p, t);
      assert.ok(m.fraction >= 0 && m.fraction <= 1);
      assert.ok(m.depth + m.height / 2 <= .400001);
      for (const value of Object.values(m)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
      assert.doesNotMatch(v.svg, /NaN|Infinity|undefined/);
      assert.deepEqual(simulateBuoyancy(entry.id, JSON.parse(JSON.stringify(p)), t), m);
    }
  }
});
