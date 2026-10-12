import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { makePlan, publishPlan, run } from './publish-ldraw-assets.mjs'
import { createHash } from 'node:crypto'

const hash = (body) => createHash('sha256').update(body).digest('hex')
async function fixture({ review = true, revision, extra = '' } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ldraw-publish-'))
  const models = path.join(root, 'public/courses/ldraw'); const reviews = path.join(root, 'scripts/ldraw-reviews')
  await mkdir(models, { recursive: true }); await mkdir(reviews, { recursive: true })
  const body = Buffer.from(`0 FILE toy.mpd\n${extra}1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n`)
  await writeFile(path.join(models, '3-toy.mpd'), body)
  if (review) await writeFile(path.join(reviews, '3-toy.ldr.json'), JSON.stringify({ revision: revision ?? hash(body), confirmedAt: new Date().toISOString() }))
  await writeFile(path.join(models, 'LDConfig.ldr'), '0 !COLOUR Red CODE 4\n')
  return { models, reviews, body }
}

test('selection requires exact only slug or prefix and rejects traversal', async () => {
  const f = await fixture()
  await assert.rejects(() => makePlan({ modelDir: f.models, reviewDir: f.reviews, only: ['../toy'] }), /invalid slug/i)
  const plan = await makePlan({ modelDir: f.models, reviewDir: f.reviews, prefix: '3-', assetsBaseUrl: 'https://assets.test' })
  assert.equal(plan.items[0].slug, '3-toy')
})

test('preflight validates the whole selection before upload', async () => {
  const f = await fixture({ review: false })
  await writeFile(path.join(f.models, '3-missing.mpd'), 'model')
  let puts = 0
  await assert.rejects(() => makePlan({ modelDir: f.models, reviewDir: f.reviews, prefix: '3-', assetsBaseUrl: 'https://assets.test' }), /preflight failed/i)
  assert.equal(puts, 0)
})

test('review hash mismatch blocks publishing', async () => {
  const f = await fixture({ revision: 'a'.repeat(64) })
  await assert.rejects(() => makePlan({ modelDir: f.models, reviewDir: f.reviews, only: ['3-toy'], assetsBaseUrl: 'https://assets.test' }), /revision does not match/i)
})

test('upload uses immutable hash name, preserves body, and verifies readback', async () => {
  const f = await fixture(); const objects = new Map(); const calls = []
  const client = {
    async head(key) { if (!objects.has(key)) { const e = new Error('missing'); e.code = 'NoSuchKey'; throw e } },
    async put(key, body) { calls.push(['put', key]); objects.set(key, Buffer.from(body)) },
    async get(key) { calls.push(['get', key]); return { content: objects.get(key) } },
  }
  const plan = await makePlan({ modelDir: f.models, reviewDir: f.reviews, only: ['3-toy'], assetsBaseUrl: 'https://assets.test' })
  const result = await publishPlan(plan, { client })
  assert.ok(objects.has(`courses/ldraw/3-toy-${hash(f.body)}.mpd`)); assert.equal(objects.get(`courses/ldraw/3-toy-${hash(f.body)}.mpd`).toString(), f.body.toString())
  assert.equal(result.find((x) => x.slug === '3-toy').status, 'uploaded'); assert.ok(calls.some(([kind]) => kind === 'get'))
})

test('dry run emits a manifest without uploading or writing by default', async () => {
  const f = await fixture(); const output = []; const original = console.info; console.info = (value) => output.push(value)
  try { await run(['--only=3-toy', '--dry-run'], { modelDir: f.models, reviewDir: f.reviews, assetsBaseUrl: 'https://assets.test' }) } finally { console.info = original }
  const manifest = JSON.parse(output.join('')); assert.equal(manifest.assets[0].status, 'planned')
})

test('upload failure preserves successful partial manifest and network HEAD errors abort', async () => {
  const f = await fixture(); const objects = new Map(); let puts = 0
  const client = {
    async head(key) { if (key.startsWith('courses/ldraw/')) { const e = new Error('connection reset'); throw e } },
    async put(key, body) { puts += 1; objects.set(key, Buffer.from(body)); if (puts === 2) throw new Error('write failed') },
    async get(key) { return { content: objects.get(key) } },
  }
  const plan = await makePlan({ modelDir: f.models, reviewDir: f.reviews, only: ['3-toy'], assetsBaseUrl: 'https://assets.test' })
  await assert.rejects(() => publishPlan(plan, { client }), /connection reset/)
  assert.equal(puts, 0)
  const manifestPath = path.join(path.dirname(f.models), 'manifest.json')
  const uploadClient = {
    async head(key) { if (!objects.has(key)) { const e = new Error('missing'); e.code = 'NoSuchKey'; throw e } },
    async put(key, body) { puts += 1; objects.set(key, Buffer.from(body)); if (puts === 2) throw new Error('write failed') },
    async get(key) { return { content: objects.get(key) } },
  }
  await assert.rejects(() => run(['--only=3-toy', '--upload', `--manifest=${manifestPath}`], { modelDir: f.models, reviewDir: f.reviews, assetsBaseUrl: 'https://assets.test', client: uploadClient }), /write failed/)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  assert.equal(manifest.assets.length, 1)
})

test('invalid confirmation timestamp and missing upload URL fail preflight', async () => {
  const f = await fixture()
  await writeFile(path.join(f.reviews, '3-toy.ldr.json'), JSON.stringify({ revision: hash(f.body), confirmedAt: 'not-a-date' }))
  await assert.rejects(() => makePlan({ modelDir: f.models, reviewDir: f.reviews, only: ['3-toy'], assetsBaseUrl: 'https://assets.test' }), /confirmedAt invalid/)
  await writeFile(path.join(f.reviews, '3-toy.ldr.json'), JSON.stringify({ revision: hash(f.body), confirmedAt: new Date().toISOString() }))
  await assert.rejects(() => makePlan({ modelDir: f.models, reviewDir: f.reviews, only: ['3-toy'], assetsBaseUrl: '' }), /assets_base_url|required/i)
})

for (const selector of [{ only: ['3-shu-kou-bei'] }, { prefix: '3-shu-' }]) {
  test(`protected models are skipped before validation: ${JSON.stringify(selector)}`, async () => {
    const f = await fixture()
    // Deliberately invalid and without a record: protected assets must never be inspected.
    await writeFile(path.join(f.models, '3-shu-kou-bei.mpd'), 'invalid draft')
    const output = []
    const original = console.info
    console.info = (value) => output.push(value)
    try {
      const plan = await makePlan({ modelDir: f.models, reviewDir: f.reviews, assetsBaseUrl: 'https://assets.test', ...selector })
      assert.deepEqual(plan.items, [])
      assert.equal(plan.color, undefined)
      assert.deepEqual(plan.skipped, ['3-shu-kou-bei'])
      assert.ok(output.some((line) => line.includes('跳过（线上已确认，受保护）')))
      const fail = async () => { throw new Error('must not contact OSS') }
      assert.deepEqual(await publishPlan(plan, { client: { head: fail, put: fail, get: fail } }), [])
    } finally { console.info = original }
  })
}

test('mixed selections publish only unprotected models', async () => {
  const f = await fixture()
  const plan = await makePlan({ modelDir: f.models, reviewDir: f.reviews, assetsBaseUrl: 'https://assets.test', only: ['3-toy', '3-shu-kou-bei'] })
  assert.deepEqual(plan.items.map((item) => item.slug), ['3-toy'])
})
