import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import test from 'node:test'

const run = promisify(execFile)
const checker = resolve(dirname(new URL(import.meta.url).pathname), '..', 'check-ldr-collision.mjs')
const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '../../../../..')

const matrices = {
  identity: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  y90: [0, 0, 1, 0, 1, 0, -1, 0, 0],
  y180: [-1, 0, 0, 0, 1, 0, 0, 0, -1],
  y270: [0, 0, -1, 0, 1, 0, 1, 0, 0],
  x90: [1, 0, 0, 0, 0, -1, 0, 1, 0],
}

function line(id, [x, y, z], matrix) {
  return `1 1 ${x} ${y} ${z} ${matrix.join(' ')} ${id}`
}

function pair({ first = '10715p01.dat', second = '10715p02.dat', matrix = matrices.identity, secondMatrix = matrix, delta = [0, 0, 280], separatedStep = false } = {}) {
  const worldDelta = [
    matrix[0] * delta[0] + matrix[1] * delta[1] + matrix[2] * delta[2],
    matrix[3] * delta[0] + matrix[4] * delta[1] + matrix[5] * delta[2],
    matrix[6] * delta[0] + matrix[7] * delta[1] + matrix[8] * delta[2],
  ]
  return `${line(first, [0, 0, 0], matrix)}\n${separatedStep ? '0 STEP\n' : ''}${line(second, worldDelta, secondMatrix)}\n`
}

async function check(ldrText) {
  const dir = await mkdtemp(join(tmpdir(), 'ldr-chassis-'))
  const file = join(dir, 'fixture.ldr')
  await writeFile(file, ldrText)
  try {
    return await run(process.execPath, [checker, file], { cwd: repoRoot })
  } catch (error) {
    return error
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('official chassis pairs at exact cardinal coupling distance pass, including mixed colors and rotation', async () => {
  for (const matrix of Object.values(matrices).slice(0, 4)) {
    const result = await check(pair({ matrix }))
    assert.equal(result.code ?? 0, 0, result.stdout ?? result.stderr)
  }
  for (const id of ['10715p01.dat', '10715p02.dat']) {
    for (const delta of [[0, 0, 280], [0, 0, -280]]) {
      const result = await check(pair({ first: id, second: id, delta }))
      assert.equal(result.code ?? 0, 0, result.stdout ?? result.stderr)
    }
  }
  const separated = await check(pair({ separatedStep: true }))
  assert.equal(separated.code ?? 0, 0, separated.stdout ?? separated.stderr)
})

test('chassis coupling exemption retains nearby, lateral, vertical, tilted, and scaled collisions', async () => {
  const invalid = [
    pair({ delta: [0, 0, 279] }),
    pair({ delta: [0, 0, 281] }),
    pair({ delta: [1, 0, 280] }),
    pair({ delta: [0, 1, 280] }),
    pair({ matrix: matrices.x90 }),
    pair({ matrix: matrices.identity.map((value) => value * 2) }),
    pair({ secondMatrix: matrices.y90, delta: [0, 0, 0] }),
    pair({ secondMatrix: [1, 0, 0, 0, 1, 0, 0, 0, -1], delta: [0, 0, 0] }),
  ]
  for (const ldrText of invalid) {
    const result = await check(ldrText)
    assert.equal(result.code, 2, result.stdout ?? result.stderr)
    assert.match(result.stdout, /overlaps/)
  }
})

test('a valid coupling does not exempt a third unrelated collision', async () => {
  const result = await check(`${pair()}${line('3011.dat', [0, 0, 0], matrices.identity)}\n`)
  assert.equal(result.code, 2, result.stdout ?? result.stderr)
  assert.match(result.stdout, /overlaps/)
})
