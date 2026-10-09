import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { planLedAssets, uploadLedAssets } from './publish-led-assets-20261009.mjs'

test('LED manifest contains exactly five verified files in the accepted namespace', async () => {
  const plan = await planLedAssets()
  assert.equal(plan.length, 5)
  assert.ok(plan.every(x => x.key.startsWith('projects/') && x.body.length > 0))
})
test('LED upload never overwrites a different existing object', async () => {
  const plan = await planLedAssets()
  let puts = 0
  await assert.rejects(uploadLedAssets(plan, { head: async () => {}, get: async () => ({ content: Buffer.from('different') }), put: async () => puts++ }), /Existing object differs/)
  assert.equal(puts, 0)
})
test('LED upload verifies readback and records only completed objects', async () => {
  const plan = await planLedAssets()
  const objects = new Map()
  const client = {
    head: async key => { if (!objects.has(key)) throw { code: 'NoSuchKey' } },
    put: async (key, body) => objects.set(key, body),
    get: async key => ({ content: objects.get(key) }),
  }
  const receipts = []
  const result = await uploadLedAssets(plan, client, rows => receipts.push(rows.length))
  assert.deepEqual(receipts, [1, 2, 3, 4, 5])
  assert.equal(result.length, 5)
  assert.ok(plan.every(x => createHash('sha256').update(objects.get(x.key)).digest('hex') === x.sha256))
})
