import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { listAdminStoreOrders, getSafeOrderExtras, listPublicNativeProducts, getAdminStoreProductPreview, scheduleNextReconcile } from './operations'

function queryResult(data: unknown) {
  const query = {
    select: vi.fn((_columns?: string) => query),
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

// Apply the query's predicates when the write executes, as PostgREST does.
// The hook lets a channel callback commit between the two scheduling writes.
function mockStoredAftersale(
  row: Record<string, string | null>,
  beforeWrite: (write: number) => void = () => {},
) {
  let writes = 0
  mocks.from.mockImplementation(() => {
    let patch: Record<string, string | null> = {}
    const predicates: Array<() => boolean> = []
    const query = {
      update: (values: Record<string, string | null>) => { patch = values; return query },
      eq: (column: string, value: string) => { predicates.push(() => row[column] === value); return query },
      or: (filters: string) => {
        predicates.push(() => filters.split(',').some(filter => {
          const [column, operator, value] = filter.split('.')
          return operator === 'is' && value === 'null' ? row[column] === null : row[column] === value
        }))
        return query
      },
      then: (resolve: (value: { error: null }) => unknown) => {
        beforeWrite(++writes)
        if (predicates.every(matches => matches())) Object.assign(row, patch)
        return Promise.resolve(resolve({ error: null }))
      },
    }
    return query
  })
}

describe('store operations', () => {
  beforeEach(() => {
    mocks.from.mockReset()
  })

  it('exposes the refund channel state to buyers without submission identities', async () => {
    mocks.from.mockImplementation((table: string) => queryResult(table === 'store_aftersales' ? {
      id: 'a1', status: 'refund_pending', refund_channel_status: 'abnormal', refund_reference: 'secret-ref',
      created_by: 'internal-admin', internal_attempt: { id: 'private' },
    } : table === 'store_order_items' ? [] : null))
    const result = await getSafeOrderExtras('o1')
    expect(result.aftersale).toMatchObject({ status: 'refund_pending', refundChannelStatus: 'abnormal' })
    expect(JSON.stringify(result)).not.toMatch(/secret-ref|internal-admin|internal_attempt|refundReference|refund_reference/)
  })

  it('maps administrative refund recovery fields in the existing batch query', async () => {
    mocks.from.mockReturnValue(queryResult([{ id: 'o1', aftersale: [{ refund_channel_status: 'closed', refund_reference: 'ref-1', return_address_encrypted: 'private-address' }] }]))
    const result = await listAdminStoreOrders()
    expect(result.orders[0].aftersale).toMatchObject({ refundChannelStatus: 'closed', refundReference: 'ref-1' })
    expect(JSON.stringify(result)).not.toContain('private-address')
    expect(mocks.from).toHaveBeenCalledOnce()
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

  it('finds an explicitly linked admin order before pagination', async () => {
    const query = queryResult([])
    mocks.from.mockReturnValue(query)
    const result = await listAdminStoreOrders(99, 'older-order')
    expect(query.eq).toHaveBeenCalledWith('id', 'older-order')
    expect(query.range).toHaveBeenCalledWith(0, 100)
    expect(result.page).toBe(1)
  })

  it('filters a linked product before limiting the public catalog', async () => {
    const query = queryResult([])
    mocks.from.mockReturnValue(query)
    await listPublicNativeProducts('older-linked-product')
    expect(query.eq).toHaveBeenCalledWith('id', 'older-linked-product')
    expect(query.eq.mock.invocationCallOrder.at(-1)).toBeLessThan(query.limit.mock.invocationCallOrder[0])
  })

  it('reads a draft preview from stored rows without sourcing fields or invented availability', async () => {
    const query = queryResult({
      id: 'draft-1', name: '真实草稿', status: 'draft', checkout_mode: 'internal',
      description: null, cover_url: null, gallery_urls: null, detail_content: null,
      video_url: null, category: null, price_cents: 1200, shipping_cents: null,
      fulfillment_description: null, blocked_provinces: null, supplier_url: 'private-supplier',
      variants: [{ id: 'variant-1', name: '保存的规格', price_cents: null, stock_quantity: null, stock_reserved: 0, min_quantity: 1, status: 'paused', cost_cents: 700 }],
    })
    mocks.from.mockReturnValue(query)
    const result = await getAdminStoreProductPreview('draft-1')
    expect(query.eq).toHaveBeenCalledWith('id', 'draft-1')
    expect(query.select.mock.calls[0][0]).not.toMatch(/supplier|cost|sources/)
    expect(result).toMatchObject({ status: 'draft', product: {
      shipping_cents: null,
      variants: [{ id: 'variant-1', status: 'paused', stock_pending: true, stock_quantity: 0 }],
    } })
    expect(JSON.stringify(result)).not.toMatch(/private-supplier|cost_cents|supplier_url/)
  })

  it('returns no administrator preview when the stored product does not exist', async () => {
    mocks.from.mockReturnValue(queryResult(null))
    expect(await getAdminStoreProductPreview('missing')).toBeNull()
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

  describe('refund reconciliation scheduling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-27T00:00:00Z'))
    })
    afterEach(() => vi.useRealTimers())

    it.each([
      ['closed', false], ['closed', true],
      ['abnormal', false], ['abnormal', true],
    ] as const)('preserves the %s reason while scheduling (failed=%s)', async (status, failed) => {
      const reason = status === 'closed' ? 'REFUND_CLOSED' : 'REFUND_ABNORMAL'
      const row = { order_id: 'o', status: 'refund_pending', refund_channel_status: status, last_reconcile_error: reason, reconcile_after: '' }
      mockStoredAftersale(row)

      await scheduleNextReconcile('store_aftersales', 'o', failed)

      expect(row.last_reconcile_error).toBe(reason)
      expect(row.reconcile_after).toBe(new Date(Date.now() + (failed ? 300_000 : 60_000)).toISOString())
    })

    it.each([
      [null, false], [null, true],
      ['pending', false], ['pending', true],
    ] as const)('keeps ordinary retry bookkeeping for channel status %s (failed=%s)', async (status, failed) => {
      const row = { order_id: 'o', status: 'refund_pending', refund_channel_status: status, last_reconcile_error: 'RECONCILIATION_PENDING' }
      mockStoredAftersale(row)

      await scheduleNextReconcile('store_aftersales', 'o', failed)

      expect(row.last_reconcile_error).toBe(failed ? 'RECONCILIATION_PENDING' : null)
    })

    it.each(['closed', 'abnormal', 'refunded'])('does not overwrite a concurrent callback changing the refund to %s', async (status) => {
      const row = { order_id: 'o', status: 'refund_pending', refund_channel_status: 'pending', last_reconcile_error: null as string | null }
      const reason = status === 'closed' ? 'REFUND_CLOSED' : status === 'abnormal' ? 'REFUND_ABNORMAL' : null
      mockStoredAftersale(row, write => {
        if (write === 2) {
          row.refund_channel_status = status
          row.status = status === 'refunded' ? 'refunded' : 'refund_pending'
          row.last_reconcile_error = reason
        }
      })

      await scheduleNextReconcile('store_aftersales', 'o', true)

      expect(row.last_reconcile_error).toBe(reason)
      expect(row.refund_channel_status).toBe(status)
    })
  })
})
