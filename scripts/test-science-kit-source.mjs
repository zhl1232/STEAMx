import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildScienceKitSeed } from './import-science-kits.mjs'
const source = JSON.parse(readFileSync(new URL('../data/store/science-kits-source.json', import.meta.url)))
const publicRoot = new URL('../public/', import.meta.url)
test('all current supplier originals retain their recorded checksum and exact SKU identity', () => {
  assert.equal(source.variants.length, 18)
  assert.equal(new Set(source.variants.map(v => v.specId)).size, 18)
  for (const v of source.variants) {
    const bytes = readFileSync(new URL(v.coverUrl.slice(1), publicRoot))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), v.imageSha256, v.name)
    assert.equal(v.priceCents, v.costCents * 2)
    assert.equal(v.stockQuantity, 100)
    assert.ok(!v.slug.includes(v.supplierSkuId))
    if (v.kind === 'material_pack') assert.equal(v.catalog.length, 16)
  }
  for (const detail of source.detailImages) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(detail.path.slice(1), publicRoot))).digest('hex'), detail.sha256)
  }
})
test('a project with only a matching name or source cannot become a kit candidate', () => {
  const kit = source.variants.find(v => v.kind === 'material_pack')
  const title = kit.catalog[0]
  const mismatches = [{ id: 1, title, tags: ['趣味实验'] }, { id: 2, title: '不在此套装目录', tags: ['科教版', '幼儿园小班'] }]
  assert.equal(buildScienceKitSeed(source, mismatches).candidateCount, 0)
})
test('public browser catalog contains no procurement fields or supplier identity', () => {
  const fixture = readFileSync(new URL('../tests/store-v1-browser/catalog-fixture.json', import.meta.url), 'utf8')
  for (const forbidden of ['costCents', 'source_price_cents', 'specId', 'supplierSkuId', source.offerId, ...source.variants.map(v => v.supplierSkuId)]) assert.ok(!fixture.includes(forbidden), forbidden)
})
