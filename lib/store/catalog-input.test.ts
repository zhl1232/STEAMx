import { describe, expect, it } from 'vitest'
import { mapAdminCatalog, parseNativeCatalog } from './catalog-input'

const productId = '00000000-0000-4000-8000-000000000001'
const variantId = '00000000-0000-4000-8000-000000000002'

describe('admin catalog versions', () => {
  it('preserves independently changed product and inventory versions through the edit round trip', () => {
    const draft = mapAdminCatalog({
      id: productId, catalog_version: 3, slug: 'kit', name: '材料包', description: '', cover_url: '',
      price_cents: 1000, shipping_cents: 0, status: 'active', fulfillment_description: '三天内发货',
      context_keys: [], blocked_provinces: [],
      variants: [{ id: variantId, catalog_version: 12, name: '默认', sku: 'KIT', price_cents: null,
        stock_quantity: 4, stock_reserved: 1, min_quantity: 1, status: 'active', sources: [] }],
    })
    const parsed = parseNativeCatalog(draft)
    expect(parsed.version).toBe(3)
    expect(parsed.variants[0].version).toBe(12)
    expect(parsed.variants[0].stockQuantity).toBe(4)
  })
})
