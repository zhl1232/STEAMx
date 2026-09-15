import assert from 'node:assert/strict'
import test from 'node:test'
import { loadPartMetadata, resolveAssembly } from '../ldraw-common.mjs'

const base = await loadPartMetadata()
// Synthetic whole-part void certificate tests the algorithm only. The real
// flag clip has planar lips whose nominal circular clearance is unproven.
const analyticFixture = { ...base, parts: new Map(base.parts) }
analyticFixture.parts.set('51725.dat', {
  ...base.parts.get('51725.dat'),
  collisionVoids: [{ type: 'cylinder', axis: 'y', center: { x: 0, y: 0, z: 0 }, radiusLdu: 6 }],
})

function matrixY(angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}

function matrixX(angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [1, 0, 0, 0, c, -s, 0, s, c]
}

function flagpoleAssembly(flagOrigin, flagMatrix = matrixY(0), poleMatrix = matrixY(0), poleOrigin = [0, 0, 0]) {
  const line = (partId, [x, y, z], matrix) => `1 1 ${x} ${y} ${z} ${matrix.join(' ')} ${partId}`
  return {
    model: 'flagpole-clearance-test',
    steps: [{ step: 1, placements: [
      { id: 'pole', partId: '51708.dat', colorCode: 1, ldrawLine: line('51708.dat', poleOrigin, poleMatrix), support: { type: 'manual', reason: 'collision test support' } },
      { id: 'flag', partId: '51725.dat', colorCode: 1, ldrawLine: line('51725.dat', flagOrigin, flagMatrix), support: { type: 'manual', reason: 'collision test support' } },
    ] }],
  }
}

test('analytic flag void clears a coaxial pole shaft, including yaw and opposite axis', () => {
  assert.equal(resolveAssembly(flagpoleAssembly([0, -260, 0]), analyticFixture).errors.length, 0)
  assert.equal(resolveAssembly(flagpoleAssembly([0, -260, 0], matrixY(Math.PI / 2)), analyticFixture).errors.length, 0)
  assert.equal(resolveAssembly(flagpoleAssembly([0, 260, 0], matrixX(Math.PI), matrixX(Math.PI)), analyticFixture).errors.length, 0)
})

test('analytic flag clearance retains cap, lateral, tilt, and scale collisions', () => {
  assert.ok(resolveAssembly(flagpoleAssembly([0, -262, 0]), analyticFixture).errors.some((message) => message.includes('overlaps')))
  assert.ok(resolveAssembly(flagpoleAssembly([0.2, -260, 0]), analyticFixture).errors.some((message) => message.includes('overlaps')))
  assert.ok(resolveAssembly(flagpoleAssembly([0, -260, 0], matrixX(Math.PI / 180)), analyticFixture).errors.some((message) => message.includes('overlaps')))
  const scaled = matrixY(0).map((value) => value * 2)
  assert.ok(resolveAssembly(flagpoleAssembly([0, -260, 0], scaled), analyticFixture).errors.some((message) => message.includes('overlaps')))
})

test('analytic clearance handles reversed order and antiparallel axes', () => {
  const assembly = flagpoleAssembly([0, -260, 0], matrixY(Math.PI / 6))
  assembly.steps[0].placements.reverse()
  assert.equal(resolveAssembly(assembly, analyticFixture).errors.length, 0)
  assert.equal(resolveAssembly(flagpoleAssembly([0, -230, 0], matrixX(Math.PI)), analyticFixture).errors.length, 0)
})

test('analytic clearance retains base and shear collisions', () => {
  assert.ok(resolveAssembly(flagpoleAssembly([0, -20, 0]), analyticFixture).errors.some((message) => message.includes('overlaps')))
  const shear = [1, 0.1, 0, 0, 1, 0, 0, 0, 1]
  assert.ok(resolveAssembly(flagpoleAssembly([0, -260, 0], shear), analyticFixture).errors.some((message) => message.includes('overlaps')))
})

test('invalid analytic metadata does not grant clearance', () => {
  for (const radiusLdu of [NaN, Infinity, -6, 0]) {
    const metadata = { ...analyticFixture, parts: new Map(analyticFixture.parts) }
    const part = metadata.parts.get('51725.dat')
    metadata.parts.set('51725.dat', { ...part, collisionVoids: [{ ...part.collisionVoids[0], radiusLdu }] })
    assert.ok(resolveAssembly(flagpoleAssembly([0, -260, 0]), metadata).errors.some((message) => message.includes('overlaps')))
  }
  for (const range of [{ minLdu: -8, maxLdu: -288.6 }, { minLdu: -260, maxLdu: -260 }]) {
    const metadata = { ...analyticFixture, parts: new Map(analyticFixture.parts) }
    const part = metadata.parts.get('51708.dat')
    metadata.parts.set('51708.dat', { ...part, collisionShafts: [{ ...part.collisionShafts[0], ...range }] })
    assert.ok(resolveAssembly(flagpoleAssembly([0, -260, 0]), metadata).errors.some((message) => message.includes('overlaps')))
  }
})

test('real flag metadata retains conservative checking without a proven whole-part void', () => {
  assert.equal(base.parts.get('51725.dat').collisionVoids, undefined)
  assert.ok(resolveAssembly(flagpoleAssembly([0, -260, 0]), base).errors.some((message) => message.includes('overlaps')))
})

function strictBricks(first, second, firstMatrix, secondMatrix) {
  const metadata = { ...base, parts: new Map(base.parts) }
  metadata.parts.set('3011.dat', { ...metadata.parts.get('3011.dat'), collisionPolicy: undefined })
  const line = ([x, y, z], matrix) => `1 1 ${x} ${y} ${z} ${matrix.join(' ')} 3011.dat`
  const assembly = { model: 'collision-test', steps: [{ step: 1, placements: [
    { id: 'a', partId: '3011.dat', colorCode: 1, ldrawLine: line(first, firstMatrix), support: { type: 'manual', reason: 'test' } },
    { id: 'b', partId: '3011.dat', colorCode: 1, ldrawLine: line(second, secondMatrix), support: { type: 'manual', reason: 'test' } },
  ] }] }
  return resolveAssembly(assembly, metadata)
}

test('OBB treats 30 and 60 degree face contact as non-overlap', () => {
  for (const angle of [Math.PI / 6, Math.PI / 3]) {
    const rotation = matrixY(angle)
    const result = strictBricks([0, 0, 0], [160 * rotation[0], 0, 160 * rotation[6]], rotation, rotation)
    assert.equal(result.errors.length, 0, result.errors)
  }
})

test('OBB treats edge, corner, and tilted local-Y contact as non-overlap', () => {
  const rotation = matrixY(Math.PI / 6)
  const edgeCorner = strictBricks([0, 0, 0], [160 * rotation[0] + 80 * rotation[2], 0, 160 * rotation[6] + 80 * rotation[8]], rotation, rotation)
  assert.equal(edgeCorner.errors.length, 0, edgeCorner.errors)

  const tilted = matrixX(Math.PI / 3)
  const offset = [0, 48 * tilted[4], 48 * tilted[7]]
  assert.equal(strictBricks([0, 0, 0], offset, tilted, tilted).errors.length, 0)
  assert.equal(strictBricks(offset, [0, 0, 0], tilted, tilted).errors.length, 0)
})

test('OBB detects real 0.1 LDU penetration and tolerates tiny near-parallel gap', () => {
  const rotation = matrixY(Math.PI / 6)
  const penetration = strictBricks([0, 0, 0], [159.9 * rotation[0], 0, 159.9 * rotation[6]], rotation, rotation)
  assert.ok(penetration.errors.some((message) => message.includes('overlaps')), penetration.errors)

  const nearParallel = matrixY(0.0001)
  const tinyGap = strictBricks([0, 0, 0], [160.00001, 0, 0], nearParallel, nearParallel)
  assert.equal(tinyGap.errors.length, 0, tinyGap.errors)
})

test('OBB handles differently rotated boxes on a cross-product separation axis', () => {
  const first = matrixX(0.5)
  const second = matrixY(1)
  // All six face-axis depths exceed 1.25 LDU and world AABBs overlap.
  // A cross-product axis separates the boxes by 24.54 LDU.
  const result = strictBricks([0, 0, 0], [-155, -65, 10], first, second)
  assert.equal(result.errors.length, 0, result.errors)
})

test('OBB retains scaled orthogonal extents', () => {
  const rotation = matrixY(Math.PI / 6)
  const scaled = rotation.map((value) => value * 2)
  const contact = [320 * rotation[0], 0, 320 * rotation[6]]
  assert.equal(strictBricks([0, 0, 0], contact, scaled, scaled).errors.length, 0)
  const penetration = [319.9 * rotation[0], 0, 319.9 * rotation[6]]
  assert.ok(strictBricks([0, 0, 0], penetration, scaled, scaled).errors.some((message) => message.includes('overlaps')))
})

function openingAssembly([x, y, z], matrix, metadata = base) {
  const frame = '1 1 0 0 0 1 0 0 0 1 0 0 0 1 31191.dat'
  const tube = `1 1 ${x} ${y} ${z} ${matrix.join(' ')} 31452.dat`
  return resolveAssembly({ model: 'opening-test', steps: [{ step: 1, placements: [
    { id: 'frame', partId: '31191.dat', colorCode: 1, ldrawLine: frame, support: { type: 'ground' } },
    { id: 'tube', partId: '31452.dat', colorCode: 1, ldrawLine: tube, support: { type: 'manual', reason: 'test' } },
  ] }] }, metadata)
}

test('opening alignment handles coaxial, eccentric, and parallel tubes', () => {
  const north = matrixY(0)
  const east = [0, 0, 1, 0, 1, 0, -1, 0, 0]
  assert.equal(openingAssembly([0, 110, -60], north).errors.length, 0)
  assert.ok(openingAssembly([100, 110, -60], north).errors.some((message) => message.includes('misses frame 31191.dat tube opening')))
  assert.equal(openingAssembly([321, 110, 0], east).errors.length, 0)

  const strict = { ...base, parts: new Map(base.parts) }
  strict.parts.set('31452.dat', { ...strict.parts.get('31452.dat'), collisionPolicy: undefined })
  const collision = openingAssembly([100, 110, 0], east, strict)
  assert.ok(collision.errors.some((message) => message.includes('overlaps')), collision.errors)
})
