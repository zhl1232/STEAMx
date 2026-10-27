import { isStorePaymentEnabled } from './config'
import { StoreServiceError } from './service'
import {
  closeNativePaymentAttempt,
  confirmNativePayment,
  confirmNativeRefund,
  getNativePaymentAttemptByReference,
  startNativePaymentAttempt,
} from './native'
import {
  getAftersale,
  getRefundAttempt,
  getOrderAttempts,
  getPrivateStoreOrder,
  listReconcileWork,
  storeRpc,
  getReservationExpiry,
  scheduleNextReconcile,
  type StoreAttempt,
  type StoreRefundAttempt,
} from './operations'
import { configuredPaymentAdapter, paymentOrigin } from './payments/registry'
import type {
  Notification,
  PaymentProvider,
  PaymentResult,
  RefundResult,
} from './payments/types'

function conflict(message: string): never {
  throw new StoreServiceError(message, 'PAYMENT_STATE_CONFLICT', 409)
}

async function applyPaymentResult(
  attempt: StoreAttempt,
  result: PaymentResult | Notification,
) {
  if (
    result.provider !== attempt.provider ||
    result.orderId !== attempt.attempt_reference ||
    result.currency !== 'CNY'
  )
    conflict('支付结果与订单不符')
  if (result.status === 'paid') {
    if (result.amountCents !== attempt.amount_cents || !result.providerOrderId)
      conflict('支付金额或交易编号不符')
    await confirmNativePayment({
      attemptId: attempt.id,
      amountCents: result.amountCents,
      currency: 'CNY',
      providerReference: result.providerOrderId,
    })
  } else if (result.status === 'closed') {
    await closeNativePaymentAttempt(attempt.id, true)
  }
}

export async function reconcileAttempt(attempt: StoreAttempt) {
  const result = await configuredPaymentAdapter(attempt.provider).query(
    attempt.attempt_reference,
  )
  await applyPaymentResult(attempt, result)
  return result
}

async function closeAttempt(attempt: StoreAttempt) {
  const adapter = configuredPaymentAdapter(attempt.provider)
  // A failed/unknown query is not proof of closure, including an order-not-found
  // result while a concurrent create request is still in flight.
  const current = await adapter.query(attempt.attempt_reference)
  await applyPaymentResult(attempt, current)
  if (current.status === 'paid') conflict('订单已支付，请刷新查看订单')
  if (current.status === 'closed') return
  if (current.status === 'not_found') {
    const expiry = await getReservationExpiry(attempt.order_id)
    if (Date.now() >= Date.parse(expiry) + 120_000) {
      await closeNativePaymentAttempt(attempt.id, true)
      return
    }
    conflict('支付订单尚未建立，请在订单到期后重试取消')
  }
  const closed = await adapter.close(attempt.attempt_reference)
  await applyPaymentResult(attempt, closed)
  if (closed.status !== 'closed') conflict('支付结果尚未确认，请稍后重试')
}

export async function initiateStorePayment(input: {
  orderId: string
  userId: string
  provider: PaymentProvider
  device: 'desktop' | 'mobile'
  clientIp?: string
}) {
  if (!isStorePaymentEnabled(input.provider))
    throw new StoreServiceError(
      '支付通道暂未开放',
      'PAYMENT_PROVIDER_DISABLED',
      503,
    )
  const order = await getPrivateStoreOrder(input.orderId, input.userId)
  if (order.status !== 'pending_payment') conflict('当前订单不能发起支付')
  const expiresAt = await getReservationExpiry(order.id)
  if (Date.parse(expiresAt) <= Date.now())
    conflict('订单已过期，请等待关单后重新下单')
  const attempts = await getOrderAttempts(order.id)
  const active = attempts.find((attempt) => attempt.status === 'pending')
  if (active && active.provider !== input.provider) await closeAttempt(active)
  const attempt =
    active?.provider === input.provider
      ? active
      : await startNativePaymentAttempt(
          order.id,
          input.provider,
          `${input.provider}-${crypto.randomUUID()}`,
        ).then((value) => ({
          id: value.id,
          order_id: value.orderId,
          attempt_reference: value.merchantReference,
          provider: value.provider as PaymentProvider,
          amount_cents: value.amountCents,
          status: value.status,
          created_at: new Date().toISOString(),
        }))
  const result = await configuredPaymentAdapter(input.provider).create({
    orderId: attempt.attempt_reference,
    amountCents: attempt.amount_cents,
    currency: 'CNY',
    subject: `创探材料包订单 ${order.id.slice(0, 8)}`,
    expiresAt,
    returnUrl: `${paymentOrigin()}/store/orders/${order.id}`,
    device:
      input.provider === 'alipay'
        ? input.device === 'mobile'
          ? 'wap'
          : 'page'
        : input.device === 'mobile'
          ? 'h5'
          : 'native',
    clientIp:
      input.provider === 'wechat' && input.device === 'mobile'
        ? input.clientIp
        : undefined,
  })
  if (!result.checkout) conflict('支付链接暂未生成，请稍后重试')
  const qr = result.checkoutKind === 'qr'
  return {
    kind: qr ? 'qr' : 'redirect',
    ...(qr ? { codeUrl: result.checkout } : { url: result.checkout }),
  }
}

export async function cancelStoreOrder(orderId: string, userId?: string) {
  const order = await getPrivateStoreOrder(orderId, userId)
  if (order.status === 'cancelled') return
  if (order.status !== 'pending_payment') conflict('当前订单不能取消')
  for (const attempt of await getOrderAttempts(order.id)) {
    if (attempt.status === 'pending') await closeAttempt(attempt)
    if (attempt.status === 'succeeded') conflict('订单已支付，请申请售后')
  }
  await storeRpc('cancel_store_native_order', {
    p_order_id: order.id,
    p_user_id: order.user_id,
  })
}

async function applyRefundResult(orderId: string, attempt: StoreRefundAttempt, result: RefundResult) {
  const order = await getPrivateStoreOrder(orderId)
  if (result.refundId !== attempt.refund_reference || result.orderId !== order.payment_reference || result.provider !== attempt.provider || result.provider !== order.payment_provider || result.currency !== 'CNY')
    conflict('退款结果与订单不符')
  if (['refunded', 'pending', 'refund_closed', 'refund_abnormal'].includes(result.status)) {
    if (result.amountCents !== attempt.amount_cents) conflict('退款金额不符')
    if (result.status === 'refunded') {
      await confirmNativeRefund({ aftersaleId: attempt.aftersale_id, amountCents: result.amountCents, provider: result.provider, providerReference: result.refundId })
    } else {
      await storeRpc('record_store_refund_result', {
        p_order_id: orderId, p_refund_reference: result.refundId, p_provider: result.provider,
        p_payment_reference: result.orderId, p_amount_cents: result.amountCents, p_currency: result.currency,
        p_status: result.status === 'refund_closed' ? 'closed' : result.status === 'refund_abnormal' ? 'abnormal' : 'pending',
      })
    }
  }
}

export async function processStoreRefund(orderId: string, _submit = false) {
  const [order, aftersale] = await Promise.all([getPrivateStoreOrder(orderId), getAftersale(orderId)])
  if (!aftersale || aftersale.status !== 'refund_pending') return
  if ((order.payment_provider !== 'alipay' && order.payment_provider !== 'wechat') || !order.payment_reference)
    conflict('订单没有可原路退款的支付记录')
  let attempt = await getRefundAttempt(orderId)
  if (attempt.status === 'refunded' || (attempt.status === 'closed' && !_submit)) return attempt.status
  const adapter = configuredPaymentAdapter(order.payment_provider)
  let queried: RefundResult | undefined
  try {
    queried = await adapter.queryRefund(order.payment_reference, attempt.refund_reference)
  } catch (cause) {
    // Abnormal refunds need merchant action. An unavailable query is never
    // evidence that it is safe to submit another ordinary refund request.
    if (attempt.status === 'abnormal' || attempt.status === 'closed') throw cause
  }
  if (queried) {
    await applyRefundResult(orderId, attempt, queried)
    if (queried.status === 'refunded') return 'refunded'
    if (queried.status === 'refund_closed') return 'closed'
    if (queried.status === 'refund_abnormal') return 'abnormal'
    if (queried.status === 'pending') return attempt.status === 'abnormal' || attempt.status === 'closed' ? attempt.status : 'pending'
  }
  // A concurrent callback/operator may have persisted a terminal state since
  // the query began. Recheck the current immutable identity before dispatch.
  const current = await getRefundAttempt(orderId)
  if (current.refund_reference !== attempt.refund_reference) conflict('退款状态已变化，请刷新后重试')
  attempt = current
  if (attempt.status !== 'pending') return attempt.status
  const result = await adapter.refund({ orderId: order.payment_reference, refundId: attempt.refund_reference, amountCents: attempt.amount_cents, totalAmountCents: order.total_cents, reason: aftersale.reason })
  await applyRefundResult(orderId, attempt, result)
  if (result.status === 'refund_closed') return 'closed'
  if (result.status === 'refund_abnormal') return 'abnormal'
  if (result.status !== 'refunded' && result.status !== 'pending') conflict('退款结果待核查，请稍后对账')
  return result.status
}

/** Only an explicit reviewed action can replace a channel-confirmed closed ID. */
export async function restartStoreRefund(orderId: string, expectedRefundReference: string, adminId: string) {
  const [order, aftersale] = await Promise.all([getPrivateStoreOrder(orderId), getAftersale(orderId)])
  if (!aftersale || aftersale.status !== 'refund_pending' || order.payment_provider !== 'wechat' || !order.payment_reference)
    conflict('当前退款不能重新发起')
  const attempt = await getRefundAttempt(orderId)
  if (attempt.refund_reference === expectedRefundReference) {
    if (attempt.status !== 'closed') conflict('退款尚未确认关闭')
    const result = await configuredPaymentAdapter('wechat').queryRefund(order.payment_reference, expectedRefundReference)
    await applyRefundResult(orderId, attempt, result)
    if (result.status !== 'refund_closed') conflict('渠道尚未确认退款关闭')
  }
  // SQL serializes operators, verifies the expected closed predecessor, and
  // returns its existing immediate successor for a replay of the same action.
  await storeRpc('restart_store_refund_attempt', { p_order_id: orderId, p_expected_refund_reference: expectedRefundReference, p_actor_id: adminId })
  return processStoreRefund(orderId)
}

export async function acceptStoreNotification(
  provider: PaymentProvider,
  input: { body: string; headers: Record<string, string> },
) {
  const notification =
    await configuredPaymentAdapter(provider).verifyNotification(input)
  const attempt = await getNativePaymentAttemptByReference(notification.orderId)
  if (!attempt || attempt.provider !== provider) conflict('支付订单不存在')
  if (notification.refundId) {
    const current = await getRefundAttempt(attempt.orderId)
    if (notification.refundId !== current.refund_reference) conflict('退款通知不属于当前退款尝试，请人工核查')
    // Query the exact channel refund identity; notification variants do not
    // bypass amount checks or authorize starting another refund request.
    const result = await configuredPaymentAdapter(provider).queryRefund(notification.orderId, notification.refundId)
    await applyRefundResult(attempt.orderId, current, result)
    return
  }
  await applyPaymentResult(
    {
      id: attempt.id,
      order_id: attempt.orderId,
      attempt_reference: attempt.merchantReference,
      provider,
      amount_cents: attempt.amountCents,
      status: attempt.status,
      created_at: '',
    },
    notification,
  )
}

export async function reconcileStoreTransactions() {
  const work = await listReconcileWork()
  let completed = 0
  const failed: Array<{
    orderId: string
    operation: string
    reason?: 'REFUND_CLOSED' | 'REFUND_ABNORMAL'
  }> = []
  for (const attempt of work.attempts) {
    await scheduleNextReconcile('store_payment_attempts', attempt.order_id)
    try {
      await reconcileAttempt(attempt)
      completed++
    } catch {
      await scheduleNextReconcile(
        'store_payment_attempts',
        attempt.order_id,
        true,
      )
      failed.push({ orderId: attempt.order_id, operation: 'query_payment' })
    }
  }
  for (const refund of work.refunds) {
    await scheduleNextReconcile('store_aftersales', refund.order_id)
    try {
      const status = await processStoreRefund(refund.order_id)
      if (status === 'closed' || status === 'abnormal') {
        await scheduleNextReconcile('store_aftersales', refund.order_id, true)
        failed.push({
          orderId: refund.order_id,
          operation: 'review_refund',
          reason: status === 'closed' ? 'REFUND_CLOSED' : 'REFUND_ABNORMAL',
        })
      } else {
        completed++
      }
    } catch {
      await scheduleNextReconcile('store_aftersales', refund.order_id, true)
      failed.push({ orderId: refund.order_id, operation: 'query_refund' })
    }
  }
  for (const reservation of work.expired) {
    await scheduleNextReconcile(
      'store_inventory_reservations',
      reservation.order_id,
    )
    try {
      await cancelStoreOrder(reservation.order_id)
      completed++
    } catch {
      await scheduleNextReconcile(
        'store_inventory_reservations',
        reservation.order_id,
        true,
      )
      failed.push({ orderId: reservation.order_id, operation: 'expire_order' })
    }
  }
  return { completed, failed }
}
