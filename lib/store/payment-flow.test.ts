import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  query: vi.fn(), close: vi.fn(), create: vi.fn(), refund: vi.fn(), queryRefund: vi.fn(), verifyNotification: vi.fn(),
  order: vi.fn(), attempts: vi.fn(), aftersale: vi.fn(), rpc: vi.fn(), expiry: vi.fn(), work: vi.fn(), schedule: vi.fn(),
  paid: vi.fn(), closed: vi.fn(), refunded: vi.fn(), byReference: vi.fn(), start: vi.fn(),
}))
vi.mock('./payments/registry', () => ({ configuredPaymentAdapter: () => mocks, paymentOrigin: () => 'https://example.test' }))
vi.mock('./operations', () => ({ getPrivateStoreOrder: mocks.order, getOrderAttempts: mocks.attempts, getAftersale: mocks.aftersale, storeRpc: mocks.rpc, getReservationExpiry: mocks.expiry, listReconcileWork: mocks.work, scheduleNextReconcile: mocks.schedule }))
vi.mock('./native', () => ({ confirmNativePayment: mocks.paid, closeNativePaymentAttempt: mocks.closed, confirmNativeRefund: mocks.refunded, getNativePaymentAttemptByReference: mocks.byReference, startNativePaymentAttempt: mocks.start }))
import { acceptStoreNotification, cancelStoreOrder, initiateStorePayment, processStoreRefund, reconcileAttempt, reconcileStoreTransactions } from './payment-flow'
const attempt = { id: 'a', order_id: 'o', attempt_reference: 'merchant-ref', provider: 'alipay' as const, amount_cents: 123, status: 'pending' as const, created_at: '' }
const result = { provider: 'alipay', orderId: 'merchant-ref', providerOrderId: 'tx', amountCents: 123, currency: 'CNY', status: 'paid' }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.order.mockResolvedValue({ id: 'o', user_id: 'u', status: 'pending_payment', payment_status: 'pending', payment_provider: 'alipay', payment_reference: 'merchant-ref', total_cents: 123 })
  mocks.attempts.mockResolvedValue([attempt])
  mocks.expiry.mockResolvedValue(new Date(Date.now() + 600_000).toISOString())
  mocks.byReference.mockResolvedValue({ id: 'a', orderId: 'o', merchantReference: 'merchant-ref', provider: 'alipay', amountCents: 123, status: 'pending' })
})
afterEach(() => vi.unstubAllEnvs())
describe('payment lifecycle orchestration', () => {
  it('does not treat amount, currency or merchant-order mismatches as paid', async () => {
    for (const patch of [{ amountCents: 122 }, { currency: 'USD' }, { orderId: 'another' }]) {
      mocks.query.mockResolvedValue({ ...result, ...patch })
      await expect(reconcileAttempt(attempt)).rejects.toThrow()
    }
    expect(mocks.paid).not.toHaveBeenCalled()
  })
  it('only applies channel-verified callbacks to their recorded provider attempt', async () => {
    mocks.verifyNotification.mockResolvedValue(result)
    await acceptStoreNotification('alipay', { body: 'signed', headers: {} })
    expect(mocks.paid).toHaveBeenCalledWith({ attemptId: 'a', amountCents: 123, currency: 'CNY', providerReference: 'tx' })
    mocks.verifyNotification.mockRejectedValue(new Error('bad signature'))
    await expect(acceptStoreNotification('alipay', { body: 'bad', headers: {} })).rejects.toThrow()
    expect(mocks.paid).toHaveBeenCalledTimes(1)
  })
  it('does not release inventory on uncertain close or a concurrent payment', async () => {
    mocks.query.mockRejectedValueOnce(new Error('timeout'))
    await expect(cancelStoreOrder('o', 'u')).rejects.toThrow()
    mocks.query.mockResolvedValue(result)
    await expect(cancelStoreOrder('o', 'u')).rejects.toThrow('已支付')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.closed).not.toHaveBeenCalled()
  })
  it('cancels with the actual owner only after channel closure', async () => {
    mocks.query.mockResolvedValue({ ...result, status: 'pending' })
    mocks.close.mockResolvedValue({ ...result, status: 'closed' })
    await cancelStoreOrder('o', 'u')
    expect(mocks.closed).toHaveBeenCalledWith('a', true)
    expect(mocks.rpc).toHaveBeenCalledWith('cancel_store_native_order', { p_order_id: 'o', p_user_id: 'u' })
  })
  it('waits out the absolute payment deadline before releasing a verified absent order', async () => {
    mocks.query.mockResolvedValue({ ...result, status: 'not_found' })
    await expect(cancelStoreOrder('o', 'u')).rejects.toThrow('尚未建立')
    expect(mocks.rpc).not.toHaveBeenCalled()
    mocks.expiry.mockResolvedValue(new Date(Date.now() - 121_000).toISOString())
    await cancelStoreOrder('o', 'u')
    expect(mocks.closed).toHaveBeenCalledWith('a', true)
  })
  it('keeps checkout disabled without contacting a payment channel', async () => {
    vi.stubEnv('STORE_PAYMENTS_ENABLED', '')
    await expect(initiateStorePayment({ orderId: 'o', userId: 'u', provider: 'alipay', device: 'desktop' })).rejects.toThrow('未开放')
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('retries an approved refund after a lost initial request using the same refund ID', async () => {
    mocks.aftersale.mockResolvedValue({ id: 'aa-bb', status: 'refund_pending', amount_cents: 123, reason: '退货' })
    mocks.queryRefund.mockRejectedValue(new Error('not found'))
    mocks.refund.mockResolvedValue({ ...result, refundId: 'aabb', status: 'refunded' })
    await processStoreRefund('o')
    expect(mocks.refund).toHaveBeenCalledWith({ orderId: 'merchant-ref', refundId: 'aabb', amountCents: 123, totalAmountCents: 123, reason: '退货' })
    expect(mocks.refunded).toHaveBeenCalledWith({ aftersaleId: 'aa-bb', amountCents: 123, provider: 'alipay', providerReference: 'aabb' })
  })
  it('never confirms an unapproved refund or a mismatched refund amount', async () => {
    mocks.aftersale.mockResolvedValueOnce({ id: 'r', status: 'requested' })
    await processStoreRefund('o', true)
    expect(mocks.refund).not.toHaveBeenCalled()
    mocks.aftersale.mockResolvedValue({ id: 'r', status: 'refund_pending', amount_cents: 123 })
    mocks.refund.mockResolvedValue({ ...result, refundId: 'r', status: 'refunded', amountCents: 1 })
    await expect(processStoreRefund('o', true)).rejects.toThrow('退款金额')
    expect(mocks.refunded).not.toHaveBeenCalled()
  })
  it('backs off failures so old unresolved work cannot starve newer orders', async () => {
    mocks.work.mockResolvedValue({ attempts: [attempt], refunds: [], expired: [] })
    mocks.query.mockRejectedValue(new Error('network'))
    const response = await reconcileStoreTransactions()
    expect(response.failed).toEqual([{ orderId: 'o', operation: 'query_payment' }])
    expect(mocks.schedule).toHaveBeenCalledWith('store_payment_attempts', 'o', true)
  })
})
