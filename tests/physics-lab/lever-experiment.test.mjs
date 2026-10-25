import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, simulate, explorationById, validParams } from '../../public/physics-lab/exploration-model.mjs';
import { experimentView } from '../../public/physics-lab/exploration-visuals.mjs';

const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test('lever releases from horizontal rest, tips toward the larger moment and mirrors when loads are exchanged', () => {
  const p = defaults('lever'), start = simulate('lever', p, 0);
  near(start.angle, 0); near(start.angularVelocity, 0);
  near(start.angularAcceleration, start.torque / start.inertia);
  const a = simulate('lever', p, .3), b = simulate('lever', p, .6);
  assert.ok(a.angle > 0 && b.angle > a.angle);
  const reverse = simulate('lever', { ...p, leftForce: p.rightForce, rightForce: p.leftForce }, .3);
  near(reverse.angle, -a.angle); near(reverse.angularVelocity, -a.angularVelocity);
});

test('unequal forces balance at matching moments and every preset is valid', () => {
  const e = explorationById('lever');
  assert.ok(e.animation.duration > 0);
  for (const preset of e.presets) assert.ok(validParams('lever', preset.params));
  for (const t of [0, .5, 2, 8, 300]) {
    const m = simulate('lever', { leftForce: 2, rightForce: 4, leftArm: 2, rightArm: 1 }, t);
    assert.ok(m.balanced); assert.equal(m.stopped, false);
    near(m.angle, 0); near(m.angularVelocity, 0); near(m.torque, 0);
  }
});

test('inclined lever uses perpendicular moment arms and conserves mechanical energy before contact', () => {
  const p = defaults('lever');
  for (const t of [.1, .3, .6]) {
    const m = simulate('lever', p, t);
    assert.equal(m.stopped, false);
    near(m.leftArm, p.leftArm * Math.cos(m.angle));
    near(m.left, p.leftForce * m.leftArm);
    near(m.right, p.rightForce * m.rightArm);
    near(.5 * m.inertia * m.angularVelocity ** 2, (m.initialLeft - m.initialRight) * Math.sin(m.angle));
  }
});

test('mechanical stops arrest rotation without claiming gravity moments balance', () => {
  for (const p of [defaults('lever'), { leftForce: 1, rightForce: 10, leftArm: .2, rightArm: 2 }]) {
    const m = simulate('lever', p, 300);
    assert.equal(m.stopped, true); assert.equal(m.balanced, false);
    near(Math.abs(m.angle), 35 * Math.PI / 180);
    near(m.angularVelocity, 0); near(m.angularAcceleration, 0);
    near(m.torque + m.stopTorque, 0); assert.ok(Math.abs(m.torque) > 0);
    const v = experimentView('lever', p, 300);
    assert.match(v.notice, /两侧重力矩仍不相等/);
  }
});

test('lever geometry changes with motion and force, and scrubbing is deterministic', () => {
  const p = defaults('lever'), geometry = v => v.svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, '');
  const initial = experimentView('lever', p, 0), later = experimentView('lever', p, .4);
  assert.notEqual(geometry(initial), geometry(later));
  assert.notEqual(geometry(initial), geometry(experimentView('lever', { ...p, leftForce: 10 }, 0)));
  assert.equal(later.svg, experimentView('lever', p, .4).svg);
  assert.equal(initial.svg, experimentView('lever', p, 0).svg);
});
