import type { ComponentProps } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreCheckout } from './store-checkout'
vi.mock('next/link', () => ({ default: ({ children, ...p }: ComponentProps<'a'>) => <a {...p}>{children}</a> }))
const quote = { originalSubtotalCents: 10000, memberSubtotalCents: 8000, memberDiscountCents: 2000, membershipTier: 'founder', shippingCents: 600, couponDiscountCents: 0, coinDiscountCents: 0, coinsUsed: 0, totalCents: 8600, couponId: null }
const product = { id: 'p1', name: '探索积木', price_cents: 10000, shipping_cents: 600, variants: [{ id: 'v1', name: '基础套装', price_cents: null, min_quantity: 1, stock_quantity: 10 }] }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
async function fill() {
  for (const [label, value] of [['收货人', '李明'], ['手机号', '13800000000'], ['城市', '北京市'], ['区县', '海淀区'], ['详细地址', '探索路1号']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
  await waitFor(() => expect(screen.getByRole('button', { name: '确认并生成订单' })).toBeEnabled())
}
describe('store checkout', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn(async input => {
      const url = String(input)
      if (url.includes('/products')) return response({ products: [product] })
      if (url.includes('/coupons')) return response({ coupons: [{ id: 'c1', title: '材料券', threshold_cents: 5000, discount_cents: 500, expires_at: '2027-01-01', eligible: true, eligible_product_ids: ['p1'] }] })
      if (url.includes('/orders?intent=')) return response({ order: null })
      if (/\/orders\/[^/?]+$/.test(url)) return response({ order: { id: 'o1', status: 'pending_payment', payment_status: 'unpaid', total_cents: 8600 } })
      if (url.endsWith('/payment')) return response({ payment: { kind: 'qr', codeUrl: 'weixin://payment' } })
      if (url.endsWith('/quote')) return response({ quote })
      return response({ order: { id: 'o1' } })
    }))
  })
  it('requires fresh confirmation when a legacy coin intent has no existing order', async () => {
    sessionStorage.setItem('store-intent-v2:u1:p1:v1:1:legacy', JSON.stringify({ key: 'old-key', pending: { province: '北京市', discount: 'coins' } }))
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="legacy" />)
    expect(await screen.findByText(/硬币抵扣已调整为兑换优惠券/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '不使用优惠券' })).toBeChecked()
    expect(vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/orders'))).toHaveLength(0)
    expect(JSON.parse(sessionStorage.getItem('store-intent-v2:u1:p1:v1:1:legacy')!)).toEqual({ key: 'old-key' })
  })
  it('preserves the same intent and expected server quote after an uncertain order response', async () => {
    const user = userEvent.setup()
    let attempts = 0
    const implementation = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/orders')) { attempts++; if (attempts === 1) throw new TypeError('网络超时'); return response({ order: { id: 'o1' } }) }
      return implementation(input, init)
    })
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} />)
    await fill()
    await user.click(screen.getByRole('button', { name: '确认并生成订单' }))
    await screen.findByText('网络超时')
    expect(screen.getByLabelText('收货人')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '重试核查同一笔订单' }))
    await screen.findByRole('link', { name: '查看订单详情' })
    const calls = vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/orders'))
    expect(calls).toHaveLength(2)
    expect(calls[0][1]?.headers).toEqual(calls[1][1]?.headers)
    expect(calls[0][1]?.body).toBe(calls[1][1]?.body)
    expect(JSON.parse(String(calls[0][1]?.body))).toMatchObject({ expectedQuote: quote, useCoins: false, couponId: null, items: [{ variantId: 'v1', quantity: 1 }] })
    expect(JSON.parse(sessionStorage.getItem(sessionStorage.key(0)!)!)).toMatchObject({ orderId: 'o1' })
  })
  it('preserves an intent across remounts and creates a fresh key for an explicit new purchase', async () => {
    const user = userEvent.setup()
    const implementation = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/orders')) throw new TypeError('结果未确认')
      return implementation(input, init)
    })
    const first = render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="intent-a" />)
    await fill(); await user.click(screen.getByRole('button', { name: '确认并生成订单' })); await screen.findByText('结果未确认'); first.unmount()
    const retry = render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="intent-a" />)
    await fill(); await user.click(screen.getByRole('button', { name: '确认并生成订单' })); await screen.findByText('结果未确认'); retry.unmount()
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="intent-b" />)
    await fill(); await user.click(screen.getByRole('button', { name: '确认并生成订单' })); await screen.findByText('结果未确认')
    const keys = vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/orders')).map(c => (c[1]!.headers as Record<string, string>)['idempotency-key'])
    expect(keys[0]).toBe(keys[1]); expect(keys[2]).not.toBe(keys[0])
  })

  it('restores a completed order after refresh without issuing another order or key', async () => {
    const user = userEvent.setup()
    const view = render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="complete" />)
    await fill(); await user.click(screen.getByRole('button', { name: '确认并生成订单' }))
    await screen.findByRole('link', { name: '查看订单详情' })
    const stored = sessionStorage.getItem(sessionStorage.key(0)!)
    expect(stored).not.toContain('13800000000'); expect(stored).not.toContain('探索路')
    view.unmount()
    const restored = render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="complete" />)
    expect(await screen.findByRole('link', { name: '查看订单详情' })).toHaveAttribute('href', '/store/orders/o1')
    expect(sessionStorage.getItem(sessionStorage.key(0)!)).toBe(stored)
    expect(screen.queryByRole('button', { name: '确认并生成订单' })).not.toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.filter(c => c[1]?.method === 'POST' && String(c[0]).endsWith('/orders'))).toHaveLength(1)
    restored.unmount()
    render(<StoreCheckout userId="u2" productId="p1" variantId="v1" quantity={1} intentId="complete" />)
    await fill()
    expect(screen.queryByRole('link', { name: '查看订单详情' })).not.toBeInTheDocument()
  })

  it.each([400, 422])('unlocks a definitive %s validation error and retains the key for correction', async status => {
    const user = userEvent.setup()
    let count = 0
    const implementation = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/orders')) return ++count === 1 ? response({ error: '请修改手机号' }, status) : response({ order: { id: 'o1' } })
      return implementation(input, init)
    })
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} />)
    await fill(); await user.click(screen.getByRole('button', { name: '确认并生成订单' })); await screen.findByText('请修改手机号')
    expect(screen.getByLabelText('手机号')).toBeEnabled()
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13900000000' } })
    await waitFor(() => expect(screen.getByRole('button', { name: '确认并生成订单' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '确认并生成订单' })); await screen.findByRole('link', { name: '查看订单详情' })
    const calls = vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/orders'))
    expect(calls[0][1]?.headers).toEqual(calls[1][1]?.headers)
    expect(JSON.parse(String(calls[1][1]?.body)).address.phone).toBe('13900000000')
  })

  it('checks an uncertain order on remount and blocks retries until the lookup succeeds', async () => {
    const user = userEvent.setup()
    const implementation = vi.mocked(fetch).getMockImplementation()!
    let lookupFails = true
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/orders')) throw new TypeError('结果未确认')
      if (String(input).includes('/orders?intent=')) {
        if (lookupFails) throw new TypeError('核查连接失败')
        return response({ order: { id: 'recovered-order' } })
      }
      return implementation(input, init)
    })
    const view = render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="pending" />)
    await fill(); await user.click(screen.getByRole('button', { name: '确认并生成订单' })); await screen.findByText('结果未确认'); view.unmount()
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="pending" />)
    await screen.findByText('核查连接失败')
    expect(screen.getByLabelText('收货人')).toBeDisabled()
    expect(screen.getByRole('button', { name: '确认并生成订单' })).toBeDisabled()
    lookupFails = false
    await user.click(screen.getByRole('button', { name: '重试核查购买结果' }))
    expect(await screen.findByRole('link', { name: '查看订单详情' })).toHaveAttribute('href', '/store/orders/recovered-order')
    expect(vi.mocked(fetch).mock.calls.filter(c => c[1]?.method === 'POST' && String(c[0]).endsWith('/orders'))).toHaveLength(1)
  })

  it('rechecks an uncertain intent before replacing expired benefits and submits with the original key', async () => {
    const user = userEvent.setup()
    const implementation = vi.mocked(fetch).getMockImplementation()!
    let unknown = true
    let expired = false
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/orders')) {
        if (unknown) throw new TypeError('结果未确认')
        return response({ order: { id: 'recovered-after-benefit-change' } })
      }
      if (String(input).endsWith('/quote') && expired && JSON.parse(String(init?.body)).couponId) return response({ error: '优惠券已过期' }, 422)
      return implementation(input, init)
    })
    const first = render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="expired-coupon" />)
    await fill()
    await user.click(screen.getByRole('radio', { name: /材料券/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: '确认并生成订单' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '确认并生成订单' })); await screen.findByText('结果未确认'); first.unmount()
    expired = true
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="expired-coupon" />)
    await screen.findByText('优惠券已过期')
    expect(screen.getByRole('radio', { name: '不使用优惠券' })).toBeDisabled()
    const lookupsBefore = vi.mocked(fetch).mock.calls.filter(c => String(c[0]).includes('/orders?intent='))
    expect(lookupsBefore).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '重新核查并选择优惠' }))
    await waitFor(() => expect(screen.getByRole('radio', { name: '不使用优惠券' })).toBeEnabled())
    expect(screen.getByRole('radio', { name: '不使用优惠券' })).toBeChecked()
    expect(vi.mocked(fetch).mock.calls.filter(c => String(c[0]).includes('/orders?intent='))).toHaveLength(2)
    expect(vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/orders'))).toHaveLength(1)
    await fill(); unknown = false
    await user.click(screen.getByRole('button', { name: '确认并生成订单' }))
    expect(await screen.findByRole('link', { name: '查看订单详情' })).toHaveAttribute('href', '/store/orders/recovered-after-benefit-change')
    const posts = vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/orders'))
    expect(posts[0][1]?.headers).toEqual(posts[1][1]?.headers)
    expect(JSON.parse(String(posts[1][1]?.body))).toMatchObject({ couponId: null, useCoins: false })
  })

  it('uses the intent as a stable fresh key across independent browser sessions and respects stored keys', async () => {
    const user = userEvent.setup()
    const first = render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="same-url" />)
    await fill(); await user.click(screen.getByRole('button', { name: '确认并生成订单' })); await screen.findByRole('link', { name: '查看订单详情' }); first.unmount()
    sessionStorage.clear()
    const second = render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="same-url" />)
    await fill(); await user.click(screen.getByRole('button', { name: '确认并生成订单' })); await screen.findByRole('link', { name: '查看订单详情' }); second.unmount()
    const calls = vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/orders'))
    expect(calls[0][1]?.headers).toEqual(calls[1][1]?.headers)
    expect(calls[0][1]?.headers).toMatchObject({ 'idempotency-key': 'web-same-url' })
    sessionStorage.setItem('store-intent-v2:u1:p1:v1:1:existing-key', JSON.stringify({ key: 'web-original-key' }))
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="existing-key" />)
    await fill(); await user.click(screen.getByRole('button', { name: '确认并生成订单' })); await screen.findByRole('link', { name: '查看订单详情' })
    expect(vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/orders')).at(-1)?.[1]?.headers).toMatchObject({ 'idempotency-key': 'web-original-key' })
  })

  it('allows an explicit quote retry after a quote network failure', async () => {
    const user = userEvent.setup()
    const implementation = vi.mocked(fetch).getMockImplementation()!
    let fail = true
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/quote') && fail) throw new TypeError('报价连接失败')
      return implementation(input, init)
    })
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} />)
    await screen.findByText('报价连接失败')
    fail = false
    await user.click(screen.getByRole('button', { name: '重新获取报价' }))
    await fill()
  })

  it('requires explicit reconfirmation after a changed quote', async () => {
    const user = userEvent.setup()
    const implementation = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (input, init) => String(input).endsWith('/orders') ? response({ code: 'QUOTE_CHANGED' }, 409) : implementation(input, init))
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} />)
    await fill()
    await user.click(screen.getByRole('button', { name: '确认并生成订单' }))
    await screen.findByText(/报价已变化/)
    await waitFor(() => expect(screen.getByRole('button', { name: '确认并生成订单' })).toBeEnabled())
    expect(vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/orders'))).toHaveLength(1)
  })
  it('offers coupons without direct coin spending and waits for the quote', async () => {
    const user = userEvent.setup()
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} />)
    await fill()
    expect(screen.getByRole('radio', { name: '不使用优惠券' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: /使用硬币抵扣/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /材料券/ }))
    expect(screen.queryByRole('radio', { name: /使用硬币抵扣/ })).not.toBeInTheDocument()
    await waitFor(() => expect(JSON.parse(String(vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/quote')).at(-1)?.[1]?.body))).toMatchObject({ useCoins: false, couponId: 'c1' }))
  })
  it('creates the order and opens the selected payment automatically without visiting order details', async () => {
    const user = userEvent.setup()
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} paymentProviders={['alipay', 'wechat']} />)
    for (const [label, value] of [['收货人', '李明'], ['手机号', '13800000000'], ['城市', '北京市'], ['区县', '海淀区'], ['详细地址', '探索路1号']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    await waitFor(() => expect(screen.getByRole('button', { name: '确认并立即支付' })).toBeEnabled())
    await user.click(screen.getByRole('radio', { name: '微信支付' }))
    await user.click(screen.getByRole('button', { name: '确认并立即支付' }))
    expect(await screen.findByRole('img', { name: '微信支付二维码' })).toBeInTheDocument()
    const payments = vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/payment'))
    expect(payments).toHaveLength(1)
    expect(JSON.parse(String(payments[0][1]?.body))).toMatchObject({ provider: 'wechat', device: 'desktop' })
    expect(vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/orders'))).toHaveLength(1)
  })

  it('retries payment on the existing order after a payment failure', async () => {
    const user = userEvent.setup()
    const implementation = vi.mocked(fetch).getMockImplementation()!
    let fail = true
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/payment') && fail) return response({ error: '支付连接失败' }, 503)
      return implementation(input, init)
    })
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} paymentProviders={['wechat']} />)
    for (const [label, value] of [['收货人', '李明'], ['手机号', '13800000000'], ['城市', '北京市'], ['区县', '海淀区'], ['详细地址', '探索路1号']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    await waitFor(() => expect(screen.getByRole('button', { name: '确认并立即支付' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '确认并立即支付' }))
    await screen.findByText('支付连接失败')
    fail = false
    await user.click(screen.getByRole('button', { name: '继续支付' }))
    await screen.findByRole('img', { name: '微信支付二维码' })
    expect(vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/orders'))).toHaveLength(1)
  })

  it('restores a paid order without starting another payment', async () => {
    sessionStorage.setItem('store-intent-v2:u1:p1:v1:1:paid', JSON.stringify({ key: 'web-paid', orderId: 'o1' }))
    const implementation = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (input, init) => String(input) === '/api/store/orders/o1' ? response({ order: { status: 'paid', payment_status: 'paid', total_cents: 8600 } }) : implementation(input, init))
    render(<StoreCheckout userId="u1" productId="p1" variantId="v1" quantity={1} intentId="paid" paymentProviders={['alipay']} />)
    await screen.findByText('支付成功')
    expect(screen.queryByRole('button', { name: '继续支付' })).not.toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.filter(c => String(c[0]).endsWith('/payment'))).toHaveLength(0)
  })

})
