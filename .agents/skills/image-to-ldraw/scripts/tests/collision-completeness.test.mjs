import assert from 'node:assert/strict'
import test from 'node:test'
import { loadPartMetadata, resolveAssembly } from '../ldraw-common.mjs'

const base = await loadPartMetadata()

function assembly(placements) {
  const line = ([x, y, z]) => `1 1 ${x} ${y} ${z} 1 0 0 0 1 0 0 0 1 3011.dat`
  return {
    model: 'collision-completeness-test',
    steps: [{ step: 1, placements: placements.map(([id, origin, extra = {}]) => ({
      id,
      partId: '3011.dat',
      colorCode: 1,
      ldrawLine: line(origin),
      anchor: { type: 'originLdu', x: origin[0], y: origin[1], z: origin[2] },
      support: { type: 'manual', reason: 'collision test support' },
      ...extra,
    })) }],
  }
}

test('later placements collide with geometrically constructed invalid placements', () => {
  const result = resolveAssembly(assembly([
    ['a', [0, 0, 0]],
    ['b', [100, 0, 0]],
    ['c', [200, 0, 0]],
  ]), base)

  assert.ok(result.errors.some((message) => message.includes('b overlaps a')), result.errors)
  assert.ok(result.errors.some((message) => message.includes('c overlaps b')), result.errors)
  assert.ok(!result.errors.some((message) => message.includes('c overlaps a')), result.errors)
  assert.deepEqual(result.resolved.map((item) => item.placement.id), ['a'])
})

test('invalid collision candidates cannot be used as supports', () => {
  const result = resolveAssembly(assembly([
    ['a', [0, 0, 0]],
    ['b', [100, 0, 0]],
    ['d', [200, 0, 0], {
      ldrawLine: undefined,
      anchor: { type: 'centerStud', x: 5, z: 0 },
      support: { type: 'placements', ids: ['b'] },
    }],
  ]), base)

  assert.ok(result.errors.some((message) => message.includes('b overlaps a')), result.errors)
  assert.ok(result.errors.some((message) => message.includes('unknown support placement: b')), result.errors)
  assert.deepEqual(result.resolved.map((item) => item.placement.id), ['a'])
})

test('collision scan still runs when exact placements fail support validation', () => {
  const result = resolveAssembly(assembly([
    ['a', [0, 0, 0], { support: undefined }],
    ['b', [100, 0, 0], { support: undefined }],
  ]), base)

  assert.ok(result.errors.some((message) => message.includes('a 3011.dat uses an exact transform')), result.errors)
  assert.ok(result.errors.some((message) => message.includes('b 3011.dat uses an exact transform')), result.errors)
  assert.ok(result.errors.some((message) => message.includes('b overlaps a')), result.errors)
  assert.equal(result.resolved.length, 0)
})

test('collision candidates remain available after tube validation failure', () => {
  const result = resolveAssembly(assembly([
    ['a', [0, 0, 0]],
    ['b', [100, 0, 0], { tubeChecks: [{ type: 'unsupported' }] }],
    ['c', [200, 0, 0]],
  ]), base)

  assert.ok(result.errors.some((message) => message.includes('b has unsupported tube check type')), result.errors)
  assert.ok(result.errors.some((message) => message.includes('c overlaps b')), result.errors)
  assert.deepEqual(result.resolved.map((item) => item.placement.id), ['a'])
})

test('duplicate collision volumes produce one pair message', () => {
  const metadata = { ...base, parts: new Map(base.parts) }
  const brick = metadata.parts.get('3011.dat')
  metadata.parts.set('3011.dat', { ...brick, collisionVolumes: [...brick.collisionVolumes, ...brick.collisionVolumes] })
  const result = resolveAssembly(assembly([
    ['a', [0, 0, 0]],
    ['b', [100, 0, 0]],
  ]), metadata)

  const occurrences = result.errors.join('; ').match(/b overlaps a/g) ?? []
  assert.equal(occurrences.length, 1, result.errors)
})
