import { describe, expect, it } from 'vitest'

import { quoteStoreCheckout } from '@/lib/store/service'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function fakeClient(responses: unknown[]) {
  const from = (_table: string) => {
    const response = responses.shift() ?? { data: [], error: null }
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'in', 'eq', 'order', 'limit']) {
      builder[method] = () => builder
    }
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve)
    return builder
  }
  return { from } as never
}

const product = (productId: string) => ({ id: productId, slug: 'kit', name: '材料包', price_cents: 1000 })
const variant = (variantId: string, productId: string, min_quantity = 1, stock_quantity: number | null = 10) => ({ id: variantId, product_id: productId, name: '标准', sku: 'STD', min_quantity, stock_quantity, price_cents: null })
const source = (variantId: string, supplierId: string, sourceMinQuantity: number | null = 1, stock = 10) => ({ id: id(80), variant_id: variantId, supplier_id: supplierId, offer_id: 'offer-1', spec_id: null, source_min_quantity: sourceMinQuantity, source_stock_quantity: stock })
const supplier = (supplierId: string, supportsDropShip = true) => ({ id: supplierId, name: '供应商', status: 'active', supports_drop_ship: supportsDropShip })

describe('quoteStoreCheckout', () => {
  it('enforces the stricter SKU/source MOQ', async () => {
    const productId = id(1)
    const variantId = id(2)
    const supplierId = id(3)
    const client = fakeClient([
      { data: [variant(variantId, productId, 2)], error: null },
      { data: [product(productId)], error: null },
      { data: [source(variantId, supplierId, 3)], error: null },
      { data: [supplier(supplierId)], error: null },
    ])
    await expect(quoteStoreCheckout(client, [{ variantId, quantity: 2 }])).rejects.toMatchObject({ code: 'MOQ_NOT_MET' })
  })

  it('rejects non-drop-ship suppliers and mixed-supplier carts', async () => {
    const productId = id(10)
    const first = id(11)
    const second = id(12)
    const supplierA = id(13)
    const supplierB = id(14)
    const rows = [variant(first, productId), variant(second, productId)]
    const base = [
      { data: rows, error: null },
      { data: [product(productId)], error: null },
      { data: [source(first, supplierA), source(second, supplierB)], error: null },
      { data: [supplier(supplierA), supplier(supplierB)], error: null },
    ]
    await expect(quoteStoreCheckout(fakeClient(base), [{ variantId: first, quantity: 1 }, { variantId: second, quantity: 1 }])).rejects.toMatchObject({ code: 'MULTIPLE_SUPPLIERS' })

    await expect(quoteStoreCheckout(fakeClient([
      { data: [variant(first, productId)], error: null },
      { data: [product(productId)], error: null },
      { data: [source(first, supplierA)], error: null },
      { data: [supplier(supplierA, false)], error: null },
    ]), [{ variantId: first, quantity: 1 }])).rejects.toMatchObject({ code: 'SUPPLIER_NOT_DROP_SHIP' })
  })

  it('rejects quantities above the source stock snapshot', async () => {
    const productId = id(20)
    const variantId = id(21)
    const supplierId = id(22)
    await expect(quoteStoreCheckout(fakeClient([
      { data: [variant(variantId, productId, 1, 2)], error: null },
      { data: [product(productId)], error: null },
      { data: [source(variantId, supplierId, 1, 2)], error: null },
      { data: [supplier(supplierId)], error: null },
    ]), [{ variantId, quantity: 3 }])).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
  })
})
