import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StoreOrderActions } from './store-order-actions'

const router = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
describe('store order actions', () => {
  it('refreshes when only the refund channel state changes', async () => {
    vi.useFakeTimers()
    router.refresh.mockClear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ order: {
      status: 'refund_pending', payment_status: 'paid', aftersale: { status: 'refund_pending', refundChannelStatus: 'abnormal' },
    } }))))
    const { unmount } = render(<StoreOrderActions orderId="ord-refund" status="refund_pending" paymentStatus="paid" aftersale={{ status: 'refund_pending', refundChannelStatus: 'pending' }} />)
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
      expect(router.refresh).toHaveBeenCalledOnce()
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it.each(['closed', 'abnormal'])('explains a %s refund without claiming completion', (refundChannelStatus) => {
    render(<StoreOrderActions orderId="ord-refund" status="refund_pending" paymentStatus="paid" aftersale={{ status: 'refund_pending', refundChannelStatus }} />)
    expect(screen.getByText(/退款暂未完成，商家正在处理/)).toBeInTheDocument()
    expect(screen.queryByText('原路退款处理中')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '申请退款' })).not.toBeInTheDocument()
  })

  it('does not offer unconfigured payment providers', () => {
    render(<StoreOrderActions orderId="ord-closed" status="pending_payment" paymentStatus="pending" paymentProviders={['alipay']} />)
    expect(screen.getByRole('button', { name: '支付宝支付' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '微信支付' })).not.toBeInTheDocument()
  })
  it('requires refund reason, preserves logistics, and renders QR payment', async () => {
    const user = userEvent.setup(); const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => String(url).includes('/payment') ? new Response(JSON.stringify({ payment: { kind: 'qr', codeUrl: 'wechat-native-code' } }), { status: 200 }) : new Response(JSON.stringify({}), { status: 200 })); vi.stubGlobal('fetch', fetchMock)
    render(<StoreOrderActions orderId="ord-1" status="paid" paymentStatus="paid" shipment={{ carrier: '顺丰', trackingNumber: 'SF123' }} />)
    expect(screen.getByText(/顺丰 · SF123/)).toBeInTheDocument(); const button = screen.getByRole('button', { name: /申请退款/ }); expect(button).toBeDisabled(); await user.type(screen.getByLabelText('操作原因'), '商品损坏'); expect(button).toBeEnabled(); await user.click(button); await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/store/orders/ord-1/actions', expect.objectContaining({ body: expect.stringContaining('商品损坏') })))
    render(<StoreOrderActions orderId="ord-2" status="pending_payment" paymentStatus="pending" paymentProviders={['wechat']} />); await user.click(screen.getByRole('button', { name: '微信支付' })); await waitFor(() => expect(screen.getByText(/请扫码完成支付/)).toBeInTheDocument())
  })
})
