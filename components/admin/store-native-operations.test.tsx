import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreNativeOperations } from './store-native-operations'

describe('native store operations', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/admin/store')
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/catalog')) return new Response(JSON.stringify({ products: [{ id: 'p1', slug: 'gear-car', name: '齿轮车', description: '', coverUrl: '', priceCents: 1200, shippingCents: 0, status: 'active', fulfillmentDescription: '付款后发货', contextKeys: [], blockedProvinces: [], variants: [{ id: 'v1', name: '红色', sku: 'GEAR-RED', priceCents: null, stockQuantity: 10, minQuantity: 2, status: 'active', supplierUrl: '', costCents: null }] }] }), { status: 200 })
      if (url.includes('/orders') && !url.includes('/actions')) {
        const page = new URL(url, 'http://localhost').searchParams.get('page')
        return new Response(JSON.stringify({
          orders: [{ id: page === '2' ? 'ord-2' : 'ord-1', status: 'paid', total_cents: 1200, items: [{ title_snapshot: '齿轮车', quantity: 1 }], procurement: null, shipment: null, aftersale: null }],
          page: Number(page || 1), pageSize: 100, hasMore: page !== '2',
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ message: '采购已记录' }), { status: 200 })
    }))
  })
  it('submits real procurement and shipping payloads while retaining displayed logistics', async () => {
    const user = userEvent.setup(); render(<StoreNativeOperations />); await waitFor(() => expect(screen.getByText(/齿轮车 × 1/)).toBeInTheDocument()); await user.click(screen.getByRole('button', { name: '记录采购' })); await user.type(screen.getByLabelText('采购单号'), 'TB-2026-001'); await user.type(screen.getByLabelText('实际采购成本（分）'), '860'); await user.click(screen.getByRole('button', { name: '确认操作' })); await waitFor(() => expect(screen.getByText('采购已记录')).toBeInTheDocument()); const calls = vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).includes('/actions')); expect(JSON.parse(String(calls[0][1]?.body))).toMatchObject({ action: 'record_procurement', reference: 'TB-2026-001', costCents: 860 })
  })

  it('loads a requested order through the secured exact-order filter', async () => {
    const id = '00000000-0000-4000-8000-000000000099'
    window.history.replaceState({}, '', `/admin/store?order=${id}`)
    render(<StoreNativeOperations />)
    await screen.findByText(/正在查看指定订单/)
    expect(fetch).toHaveBeenCalledWith(`/api/admin/store/orders?order=${id}&page=1`, undefined)
  })

  it('opens a saved product preview and selects it when returning to edit', async () => {
    window.history.replaceState({}, '', '/admin/store?product=p1')
    render(<StoreNativeOperations />)
    expect(await screen.findByRole('link', { name: '查看商品页面' })).toHaveAttribute('href', '/admin/store/products/p1/preview')
    await waitFor(() => expect(screen.getByLabelText('商品名称')).toHaveValue('齿轮车'))
  })

  it('moves between order pages and keeps the current page after an action', async () => {
    const user = userEvent.setup()
    render(<StoreNativeOperations />)
    await waitFor(() => expect(screen.getByText(/订单 ord-1/)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '下一页' }))
    await waitFor(() => expect(screen.getByText(/订单 ord-2/)).toBeInTheDocument())
    expect(vi.mocked(fetch).mock.calls.some((call) => call[0] === '/api/admin/store/orders?page=2')).toBe(true)
    await user.click(screen.getByRole('button', { name: '记录采购' }))
    await user.type(screen.getByLabelText('采购单号'), 'TB-2026-002')
    await user.type(screen.getByLabelText('实际采购成本（分）'), '900')
    await user.click(screen.getByRole('button', { name: '确认操作' }))
    await waitFor(() => expect(screen.getByText('采购已记录')).toBeInTheDocument())
    const orderCalls = vi.mocked(fetch).mock.calls
      .filter((call) => String(call[0]).includes('/api/admin/store/orders?page='))
    expect(orderCalls.at(-1)?.[0]).toBe('/api/admin/store/orders?page=2')
  })
})
