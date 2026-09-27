import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { listAdminStoreOrders, getSafeOrderExtras, listPublicNativeProducts } from './operations'

function queryResult(data: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    not: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve({ data, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data, error: null })),
    order: vi.fn(() => query),
    range: vi.fn(() => Promise.resolve({ data, error: null })),
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, error: null })),
  }
  return query
}

describe('store operations', () => {
  beforeEach(() => {
    mocks.from.mockReset()
  })

  it('pages admin orders with a stable tie-breaker and lookahead row', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      id: `order-${index}`,
      user_id: 'user-1',
      status: 'paid',
      payment_status: 'paid',
      payment_provider: null,
      total_cents: 100,
      shipping_cents: 0,
      created_at: '2026-09-27T00:00:00.000Z',
      items: [],
      procurement: [],
      shipment: [],
      aftersale: [],
    }))
    const query = queryResult(rows)
    mocks.from.mockReturnValue(query)

    const result = await listAdminStoreOrders(3)

    expect(query.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false })
    expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false })
    expect(query.range).toHaveBeenCalledWith(200, 300)
    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(100)
    expect(result.hasMore).toBe(true)
    expect(result.orders).toHaveLength(100)
  })

  it('filters a linked product before limiting the public catalog', async () => {
    const query = queryResult([])
    mocks.from.mockReturnValue(query)
    await listPublicNativeProducts('older-linked-product')
    expect(query.eq).toHaveBeenCalledWith('id', 'older-linked-product')
    expect(query.eq.mock.invocationCallOrder.at(-1)).toBeLessThan(query.limit.mock.invocationCallOrder[0])
  })

  it('returns project learning links on the singular project route', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'store_order_items')
        return queryResult([{ metadata: { contextKeys: ['project:abc'] } }])
      return queryResult(table === 'store_shipments' ? null : null)
    })

    const result = await getSafeOrderExtras('order-1')

    expect(result.learningLinks).toEqual([
      { href: '/project/abc', label: '返回配套项目' },
    ])
  })
})
