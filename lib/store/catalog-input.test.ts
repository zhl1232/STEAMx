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
        stock_quantity: 4, stock_reserved: 1, min_quantity: 1, status: 'active', sources: [{is_primary: true, source_url: 'https://supplier.test/kit', source_price_cents: 500}] }],
    })
    const parsed = parseNativeCatalog(draft)
    expect(parsed.version).toBe(3)
    expect(parsed.variants[0].version).toBe(12)
    expect(parsed.variants[0].stockQuantity).toBe(4)
  })
})

describe('catalog publication requirements', () => {
  const draft = {slug: 'draft', name: '待确认材料包', priceCents: 1000, status: 'draft', variants: [{name: '默认', sku: 'DRAFT', stockQuantity: null}]}
  it('allows a draft with no shipping, procurement costs or fulfillment promise', () => {
    expect(parseNativeCatalog(draft).shippingCents).toBeNull()
  })
  it('rejects publishing an incomplete draft', () => {
    expect(() => parseNativeCatalog({...draft, status: 'active'})).toThrow('上架前')
  })
})

describe('catalog asset and supplier URLs', () => {
  const draft = {slug: 'assets', name: '材料包', priceCents: 1000, status: 'draft', variants: [{name: '默认', sku: 'ASSET', stockQuantity: null}]}
  it('accepts local public assets for media while preserving supplier URL validation', () => {
    const parsed = parseNativeCatalog({...draft, coverUrl: '/store/cover.webp', galleryUrls: ['/store/detail.webp'], videoUrl: '/store/demo.mp4'})
    expect(parsed.coverUrl).toBe('/store/cover.webp')
    expect(() => parseNativeCatalog({...draft, variants: [{...draft.variants[0], supplierUrl: '/supplier/private'}]})).toThrow()
  })
  it('rejects protocol-relative and backslash asset URLs', () => {
    expect(() => parseNativeCatalog({...draft, coverUrl: '//external.test/image'})).toThrow()
    expect(() => parseNativeCatalog({...draft, coverUrl: '/\\external.test/image'})).toThrow()
  })
})
