import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StoreCheckoutPayment } from './store-checkout-payment'

const response = (body: unknown) => new Response(JSON.stringify(body))
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('checkout payment', () => {
  it('redirects directly to the payment page for a newly created order', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async input => String(input).endsWith('/payment')
      ? response({ payment: { kind: 'redirect', url: 'https://openapi.alipay.com/payment' } })
      : response({ order: { status: 'pending_payment', payment_status: 'unpaid', total_cents: 8600 } })))
    render(<StoreCheckoutPayment orderId="o1" provider="alipay" autoStart />)
    await screen.findByRole('button', { name: '重新打开支付' })
    expect(assign).toHaveBeenCalledWith('https://openapi.alipay.com/payment')
  })

  it('updates a QR payment using the server-confirmed payment status', async () => {
    vi.useFakeTimers()
    let paid = false
    vi.stubGlobal('fetch', vi.fn(async input => String(input).endsWith('/payment')
      ? response({ payment: { kind: 'qr', codeUrl: 'weixin://pay' } })
      : response({ order: { status: paid ? 'paid' : 'pending_payment', payment_status: paid ? 'paid' : 'unpaid', total_cents: 8600 } })))
    await act(async () => { render(<StoreCheckoutPayment orderId="o1" provider="wechat" autoStart />) })
    expect(screen.getByRole('img', { name: '微信支付二维码' })).toBeInTheDocument()
    paid = true
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(screen.getByText('支付成功')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: '微信支付二维码' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重新打开支付' })).not.toBeInTheDocument()
  })

  it('checks a restored order before continuing payment and leaves paid orders untouched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ order: { status: 'paid', payment_status: 'paid', total_cents: 8600 } })))
    render(<StoreCheckoutPayment orderId="o1" provider="alipay" />)
    // Even a click while the restored order is loading must verify its status first.
    fireEvent.click(screen.getByRole('button', { name: '继续支付' }))
    await screen.findByText('支付成功')
    expect(vi.mocked(fetch).mock.calls.every(call => !String(call[0]).endsWith('/payment'))).toBe(true)
  })
  it('aborts a pending order read on unmount and never starts payment after it resolves', async () => {
    let resolveOrder!: (value: Response) => void
    const pending = new Promise<Response>(resolve => { resolveOrder = resolve })
    vi.stubGlobal('fetch', vi.fn(async () => pending))
    const view = render(<StoreCheckoutPayment orderId="o1" provider="alipay" autoStart />)
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal
    view.unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => { resolveOrder(response({ order: { status: 'pending_payment', payment_status: 'unpaid', total_cents: 8600 } })) })
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('aborts a pending payment on unmount and ignores its eventual redirect response', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    let resolvePayment!: (value: Response) => void
    const pending = new Promise<Response>(resolve => { resolvePayment = resolve })
    vi.stubGlobal('fetch', vi.fn(async input => String(input).endsWith('/payment') ? pending : response({ order: { status: 'pending_payment', payment_status: 'unpaid', total_cents: 8600 } })))
    const view = render(<StoreCheckoutPayment orderId="o1" provider="alipay" autoStart />)
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(call => String(call[0]).endsWith('/payment'))).toBe(true))
    const signal = vi.mocked(fetch).mock.calls.find(call => String(call[0]).endsWith('/payment'))?.[1]?.signal
    view.unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => { resolvePayment(response({ payment: { kind: 'redirect', url: 'https://openapi.alipay.com/payment' } })) })
    expect(assign).not.toHaveBeenCalled()
  })

  it('still starts payment once when StrictMode replays mount effects', async () => {
    vi.stubGlobal('fetch', vi.fn(async input => String(input).endsWith('/payment')
      ? response({ payment: { kind: 'qr', codeUrl: 'weixin://pay' } })
      : response({ order: { status: 'pending_payment', payment_status: 'unpaid', total_cents: 8600 } })))
    render(<StrictMode><StoreCheckoutPayment orderId="o1" provider="wechat" autoStart /></StrictMode>)
    await screen.findByRole('img', { name: '微信支付二维码' })
    expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]).endsWith('/payment'))).toHaveLength(1)
  })

  it('restores a cancelled order without offering or initiating payment', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ order: { status: 'cancelled', payment_status: 'unpaid', total_cents: 8600 } })))
    render(<StoreCheckoutPayment orderId="o1" provider="alipay" autoStart />)
    await screen.findByText('订单已结束')
    expect(screen.getByText('订单金额')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '继续支付' })).not.toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]).endsWith('/payment'))).toHaveLength(0)
  })

  it('shows unavailable channels and does not initiate payment without a provider', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ order: { status: 'pending_payment', payment_status: 'unpaid', total_cents: 8600 } })))
    render(<StoreCheckoutPayment orderId="o1" autoStart />)
    await screen.findByText('待付金额')
    expect(screen.getByText('支付通道暂未开放，请联系商城客服。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '继续支付' })).not.toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]).endsWith('/payment'))).toHaveLength(0)
  })

})
