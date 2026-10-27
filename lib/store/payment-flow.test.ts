import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  query: vi.fn(), close: vi.fn(), create: vi.fn(), refund: vi.fn(), queryRefund: vi.fn(), verifyNotification: vi.fn(),
  order: vi.fn(), attempts: vi.fn(), aftersale: vi.fn(), rpc: vi.fn(), expiry: vi.fn(), work: vi.fn(), refundAttempt: vi.fn(), schedule: vi.fn(),
  paid: vi.fn(), closed: vi.fn(), refunded: vi.fn(), byReference: vi.fn(), start: vi.fn(),
}))
vi.mock('./payments/registry', () => ({ configuredPaymentAdapter: () => mocks, paymentOrigin: () => 'https://example.test' }))
vi.mock('./operations', () => ({ getPrivateStoreOrder: mocks.order, getOrderAttempts: mocks.attempts, getAftersale: mocks.aftersale, getRefundAttempt: mocks.refundAttempt, storeRpc: mocks.rpc, getReservationExpiry: mocks.expiry, listReconcileWork: mocks.work, scheduleNextReconcile: mocks.schedule }))
vi.mock('./native', () => ({ confirmNativePayment: mocks.paid, closeNativePaymentAttempt: mocks.closed, confirmNativeRefund: mocks.refunded, getNativePaymentAttemptByReference: mocks.byReference, startNativePaymentAttempt: mocks.start }))
import { acceptStoreNotification, cancelStoreOrder, initiateStorePayment, processStoreRefund, reconcileAttempt, reconcileStoreTransactions, restartStoreRefund } from './payment-flow'
const attempt = { id: 'a', order_id: 'o', attempt_reference: 'merchant-ref', provider: 'alipay' as const, amount_cents: 123, status: 'pending' as const, created_at: '' }
const result = { provider: 'alipay', orderId: 'merchant-ref', providerOrderId: 'tx', amountCents: 123, currency: 'CNY', status: 'paid' }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.order.mockResolvedValue({ id: 'o', user_id: 'u', status: 'pending_payment', payment_status: 'pending', payment_provider: 'alipay', payment_reference: 'merchant-ref', total_cents: 123 })
  mocks.refundAttempt.mockResolvedValue({ id: 'ra1', order_id: 'o', aftersale_id: 'aa-bb', attempt_no: 1, refund_reference: 'aabb', provider: 'alipay', amount_cents: 123, status: 'pending' })
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
    mocks.refundAttempt.mockResolvedValue({ id: 'ra1', aftersale_id: 'r', refund_reference: 'r', provider: 'alipay', amount_cents: 123, status: 'pending' })
    mocks.refund.mockResolvedValue({ ...result, refundId: 'r', status: 'refunded', amountCents: 1 })
    await expect(processStoreRefund('o', true)).rejects.toThrow('退款金额')
    expect(mocks.refunded).not.toHaveBeenCalled()
  })
  it.each(['refund_closed', 'refund_abnormal'])('persists verified %s without resubmitting the refund', async (status) => {
    mocks.aftersale.mockResolvedValue({ id: 'aa-bb', status: 'refund_pending' })
    mocks.queryRefund.mockResolvedValue({ ...result, refundId: 'aabb', status })
    await processStoreRefund('o', true)
    expect(mocks.rpc).toHaveBeenCalledWith('record_store_refund_result', expect.objectContaining({ p_refund_reference: 'aabb', p_amount_cents: 123, p_status: status === 'refund_closed' ? 'closed' : 'abnormal' }))
    expect(mocks.refund).not.toHaveBeenCalled()
  })
  it.each(['closed', 'abnormal'])('never submits an already %s refund after an unavailable/absent query', async (status) => {
    mocks.aftersale.mockResolvedValue({ id: 'aa-bb', status: 'refund_pending' })
    mocks.refundAttempt.mockResolvedValue({ aftersale_id: 'aa-bb', refund_reference: 'aabb', provider: 'alipay', amount_cents: 123, status })
    mocks.queryRefund.mockRejectedValueOnce(new Error('timeout')).mockResolvedValue({ ...result, refundId: 'aabb', status: 'not_found' })
    await processStoreRefund('o', true).catch(() => undefined)
    await processStoreRefund('o', true)
    expect(mocks.refund).not.toHaveBeenCalled()
  })
  it('confirms an abnormal refund only after a later verified success', async () => {
    mocks.aftersale.mockResolvedValue({ id: 'aa-bb', status: 'refund_pending' })
    mocks.refundAttempt.mockResolvedValue({ aftersale_id: 'aa-bb', refund_reference: 'aabb', provider: 'alipay', amount_cents: 123, status: 'abnormal' })
    mocks.queryRefund.mockResolvedValue({ ...result, refundId: 'aabb', status: 'refunded' })
    await processStoreRefund('o')
    expect(mocks.refunded).toHaveBeenCalledWith(expect.objectContaining({ providerReference: 'aabb', amountCents: 123 }))
    expect(mocks.refund).not.toHaveBeenCalled()
  })
  it('does not hide an abnormal result behind a delayed processing response', async () => {
    mocks.aftersale.mockResolvedValue({ status: 'refund_pending' })
    mocks.refundAttempt.mockResolvedValue({ aftersale_id: 'aa-bb', refund_reference: 'aabb', provider: 'alipay', amount_cents: 123, status: 'abnormal' })
    mocks.queryRefund.mockResolvedValue({ ...result, refundId: 'aabb', status: 'pending' })
    await expect(processStoreRefund('o', true)).resolves.toBe('abnormal')
    expect(mocks.refund).not.toHaveBeenCalled()
  })
  it('actually queries a closed refund on an explicit manual check', async () => {
    mocks.aftersale.mockResolvedValue({ status: 'refund_pending' })
    mocks.refundAttempt.mockResolvedValue({ aftersale_id: 'aa-bb', refund_reference: 'aabb', provider: 'alipay', amount_cents: 123, status: 'closed' })
    mocks.queryRefund.mockResolvedValue({ ...result, refundId: 'aabb', status: 'refund_closed' })
    await expect(processStoreRefund('o', true)).resolves.toBe('closed')
    expect(mocks.queryRefund).toHaveBeenCalledWith('merchant-ref', 'aabb')
    expect(mocks.refund).not.toHaveBeenCalled()
  })
  it('does not persist a terminal channel status with a different amount', async () => {
    mocks.aftersale.mockResolvedValue({ id: 'aa-bb', status: 'refund_pending' })
    mocks.queryRefund.mockResolvedValue({ ...result, refundId: 'aabb', status: 'refund_closed', amountCents: 1 })
    await expect(processStoreRefund('o')).rejects.toThrow('退款金额')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.refund).not.toHaveBeenCalled()
  })
  it('rechecks a closed WeChat refund before authorizing its single successor', async () => {
    mocks.aftersale.mockResolvedValue({ id: 'aa-bb', status: 'refund_pending' })
    mocks.order.mockResolvedValue({ id: 'o', payment_provider: 'wechat', payment_reference: 'merchant-ref', total_cents: 123 })
    mocks.refundAttempt.mockResolvedValueOnce({ aftersale_id: 'aa-bb', refund_reference: 'aabb', provider: 'wechat', amount_cents: 123, status: 'closed' }).mockResolvedValue({ aftersale_id: 'aa-bb', refund_reference: 'aabb-2', provider: 'wechat', amount_cents: 123, status: 'pending' })
    mocks.queryRefund.mockResolvedValueOnce({ ...result, provider: 'wechat', refundId: 'aabb', status: 'refund_closed' }).mockResolvedValue({ ...result, provider: 'wechat', refundId: 'aabb-2', status: 'not_found' })
    mocks.refund.mockResolvedValue({ ...result, provider: 'wechat', refundId: 'aabb-2', status: 'pending' })
    await restartStoreRefund('o', 'aabb', 'admin')
    expect(mocks.rpc).toHaveBeenCalledWith('restart_store_refund_attempt', { p_order_id: 'o', p_expected_refund_reference: 'aabb', p_actor_id: 'admin' })
    expect(mocks.refund).toHaveBeenCalledWith(expect.objectContaining({ refundId: 'aabb-2' }))
  })
  it('does not rotate a closed refund when a new channel check is unavailable', async () => {
    mocks.aftersale.mockResolvedValue({ id: 'aa-bb', status: 'refund_pending' })
    mocks.order.mockResolvedValue({ payment_provider: 'wechat', payment_reference: 'merchant-ref' })
    mocks.refundAttempt.mockResolvedValue({ refund_reference: 'aabb', provider: 'wechat', amount_cents: 123, status: 'closed' })
    mocks.queryRefund.mockRejectedValue(new Error('timeout'))
    await expect(restartStoreRefund('o', 'aabb', 'admin')).rejects.toThrow('timeout')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects a stale refund callback before querying or changing the latest attempt', async () => {
    mocks.verifyNotification.mockResolvedValue({ ...result, refundId: 'aabb', status: 'refunded' })
    mocks.refundAttempt.mockResolvedValue({ refund_reference: 'aabb-2', status: 'pending' })
    await expect(acceptStoreNotification('alipay', { body: 'signed', headers: {} })).rejects.toThrow('当前退款尝试')
    expect(mocks.refunded).not.toHaveBeenCalled()
    expect(mocks.queryRefund).not.toHaveBeenCalled()
  })
  it('backs off failures so old unresolved work cannot starve newer orders', async () => {
    mocks.work.mockResolvedValue({ attempts: [attempt], refunds: [], expired: [] })
    mocks.query.mockRejectedValue(new Error('network'))
    const response = await reconcileStoreTransactions()
    expect(response.failed).toEqual([{ orderId: 'o', operation: 'query_payment' }])
    expect(mocks.schedule).toHaveBeenCalledWith('store_payment_attempts', 'o', true)
  })
  it.each(['closed', 'abnormal'])('keeps reporting an existing %s refund for manual review on later ticks', async (status) => {
    mocks.work.mockResolvedValue({ attempts: [], refunds: [{ order_id: 'o' }], expired: [] })
    mocks.aftersale.mockResolvedValue({ status: 'refund_pending' })
    mocks.refundAttempt.mockResolvedValue({ aftersale_id: 'aa-bb', refund_reference: 'aabb', provider: 'alipay', amount_cents: 123, status })
    mocks.queryRefund.mockResolvedValue({ ...result, refundId: 'aabb', status: `refund_${status}` })

    for (let tick = 0; tick < 2; tick++) {
      expect(await reconcileStoreTransactions()).toEqual({
        completed: 0,
        failed: [{ orderId: 'o', operation: 'review_refund', reason: status === 'closed' ? 'REFUND_CLOSED' : 'REFUND_ABNORMAL' }],
      })
    }
    expect(mocks.schedule).toHaveBeenCalledWith('store_aftersales', 'o', true)
    expect(mocks.refund).not.toHaveBeenCalled()
    expect(mocks.refunded).not.toHaveBeenCalled()
  })
  it.each([
    ['query', 'closed'], ['query', 'abnormal'],
    ['submit', 'closed'], ['submit', 'abnormal'],
  ])('reports a newly %s-confirmed %s refund without counting it as completed', async (source, status) => {
    mocks.work.mockResolvedValue({ attempts: [], refunds: [{ order_id: 'o' }], expired: [] })
    mocks.aftersale.mockResolvedValue({ status: 'refund_pending' })
    const terminalResult = { ...result, refundId: 'aabb', status: `refund_${status}` }
    mocks.queryRefund.mockResolvedValue(source === 'query' ? terminalResult : { ...result, refundId: 'aabb', status: 'not_found' })
    mocks.refund.mockResolvedValue(terminalResult)

    expect(await reconcileStoreTransactions()).toEqual({
      completed: 0,
      failed: [{ orderId: 'o', operation: 'review_refund', reason: status === 'closed' ? 'REFUND_CLOSED' : 'REFUND_ABNORMAL' }],
    })
    expect(mocks.rpc).toHaveBeenCalledWith('record_store_refund_result', expect.objectContaining({ p_status: status }))
    expect(mocks.refunded).not.toHaveBeenCalled()
  })
  it.each(['pending', 'refunded'])('does not raise a manual-review alert for a verified %s refund', async (status) => {
    mocks.work.mockResolvedValue({ attempts: [], refunds: [{ order_id: 'o' }], expired: [] })
    mocks.aftersale.mockResolvedValue({ status: 'refund_pending' })
    mocks.queryRefund.mockResolvedValue({ ...result, refundId: 'aabb', status })

    expect(await reconcileStoreTransactions()).toEqual({ completed: 1, failed: [] })
    expect(mocks.schedule).not.toHaveBeenCalledWith('store_aftersales', 'o', true)
  })
  it('continues processing later refunds when one needs manual review', async () => {
    mocks.work.mockResolvedValue({ attempts: [], refunds: [{ order_id: 'o' }, { order_id: 'next' }], expired: [] })
    mocks.aftersale.mockResolvedValue({ status: 'refund_pending' })
    mocks.refundAttempt.mockResolvedValueOnce({ status: 'closed' }).mockResolvedValue({ aftersale_id: 'aa-bb', refund_reference: 'aabb', provider: 'alipay', amount_cents: 123, status: 'pending' })
    mocks.queryRefund.mockResolvedValue({ ...result, refundId: 'aabb', status: 'refunded' })

    expect(await reconcileStoreTransactions()).toEqual({
      completed: 1,
      failed: [{ orderId: 'o', operation: 'review_refund', reason: 'REFUND_CLOSED' }],
    })
    expect(mocks.refunded).toHaveBeenCalledOnce()
  })
  it('reports a failed query of an abnormal refund and never resubmits it', async () => {
    mocks.work.mockResolvedValue({ attempts: [], refunds: [{ order_id: 'o' }], expired: [] })
    mocks.aftersale.mockResolvedValue({ status: 'refund_pending' })
    mocks.refundAttempt.mockResolvedValue({ status: 'abnormal' })
    mocks.queryRefund.mockRejectedValue(new Error('timeout'))

    expect(await reconcileStoreTransactions()).toEqual({ completed: 0, failed: [{ orderId: 'o', operation: 'query_refund' }] })
    expect(mocks.schedule).toHaveBeenCalledWith('store_aftersales', 'o', true)
    expect(mocks.refund).not.toHaveBeenCalled()
  })
})
