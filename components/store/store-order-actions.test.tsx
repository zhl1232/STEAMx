import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StoreOrderActions } from './store-order-actions'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
describe('store order actions', () => {
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
