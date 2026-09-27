import type { ComponentProps } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreCatalogClient } from './store-catalog-client'

vi.mock('next/link', () => ({ default: ({ children, ...p }: ComponentProps<'a'>) => <a {...p}>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe('store catalog checkout', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/store')
    vi.stubGlobal('crypto', { randomUUID: () => 'stable-checkout-key' })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/products')) return new Response(JSON.stringify({ products: [{ id: 'p1', name: '齿轮车', price_cents: 1200, shipping_cents: 0, variants: [{ id: 'v1', name: '红色', price_cents: null, min_quantity: 2 }] }] }), { status: 200 })
      return new Response(JSON.stringify({ order: { id: 'ord-1' } }), { status: 200 })
    }))
  })
  it('shows nullable variant price, zero shipping, MOQ, and sends one stable SKU/idempotency key', async () => {
    const user = userEvent.setup(); render(<StoreCatalogClient />)
    await waitFor(() => expect(screen.getByText(/12\.00/)).toBeInTheDocument())
    expect(screen.getByLabelText('数量')).toHaveAttribute('min', '2')
    fireEvent.change(screen.getByLabelText('数量'), { target: { value: '2' } })
    await user.type(screen.getByLabelText('收货人'), '李明'); await user.type(screen.getByLabelText('手机号'), '13800000000'); await user.type(screen.getByLabelText('城市'), '北京市'); await user.type(screen.getByLabelText('区县'), '海淀区'); await user.type(screen.getByLabelText('详细地址'), '中关村1号')
    await user.click(screen.getByRole('button', { name: '创建本站订单' }))
    await waitFor(() => expect(screen.getByText(/订单已创建/)).toBeInTheDocument())
    const calls = vi.mocked(fetch).mock.calls.filter(c => String(c[0]).includes('/orders')); expect(calls).toHaveLength(1); const request = calls[0][1]!; expect((request.headers as Record<string,string>)['idempotency-key']).toBe('web-stable-checkout-key'); expect(JSON.parse(String(request.body)).items).toEqual([{ variantId: 'v1', quantity: 2 }])
  })

  it('selects the requested product from the URL after loading', async () => {
    window.history.pushState({}, '', '/store?product=p2')
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).includes('/products')) return new Response(JSON.stringify({ products: [
        { id: 'p1', name: '默认商品', variants: [{ id: 'v1', name: '默认规格' }] },
        { id: 'p2', name: '指定商品', variants: [{ id: 'v2', name: '指定规格' }] },
      ] }), { status: 200 })
      return new Response(JSON.stringify({ order: { id: 'ord-1' } }), { status: 200 })
    })
    render(<StoreCatalogClient />)
    await waitFor(() => expect(screen.getByDisplayValue('指定商品')).toBeInTheDocument())
    expect(screen.getByLabelText('规格')).toHaveValue('v2')
    expect(fetch).toHaveBeenCalledWith('/api/store/products?product=p2')
  })

  it('does not fall back to another product when the requested product is unavailable', async () => {
    window.history.pushState({}, '', '/store?product=missing')
    render(<StoreCatalogClient />)
    await waitFor(() => expect(screen.getByRole('alert', { name: '' })).toHaveTextContent('请求的商品暂不可用'))
    expect(screen.getByLabelText('商品')).toHaveValue('')
  })
})
