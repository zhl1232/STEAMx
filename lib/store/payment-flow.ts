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
  getOrderAttempts,
  getPrivateStoreOrder,
  listReconcileWork,
  storeRpc,
  getReservationExpiry,
  scheduleNextReconcile,
  type StoreAttempt,
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

async function confirmRefundResult(orderId: string, result: RefundResult) {
  const aftersale = await getAftersale(orderId)
  const order = await getPrivateStoreOrder(orderId)
  if (
    !aftersale ||
    result.refundId !== aftersale.id.replaceAll('-', '') ||
    result.orderId !== order.payment_reference ||
    result.provider !== order.payment_provider ||
    result.currency !== 'CNY'
  )
    conflict('退款结果与订单不符')
  if (result.status !== 'refunded') return false
  if (result.amountCents !== aftersale.amount_cents) conflict('退款金额不符')
  return confirmNativeRefund({
    aftersaleId: aftersale.id,
    amountCents: result.amountCents,
    provider: result.provider,
    providerReference: result.refundId,
  })
}

export async function processStoreRefund(orderId: string, submit = false) {
  const [order, aftersale] = await Promise.all([
    getPrivateStoreOrder(orderId),
    getAftersale(orderId),
  ])
  if (!aftersale || aftersale.status !== 'refund_pending') return
  if (
    (order.payment_provider !== 'alipay' &&
      order.payment_provider !== 'wechat') ||
    !order.payment_reference
  )
    conflict('订单没有可原路退款的支付记录')
  const adapter = configuredPaymentAdapter(order.payment_provider)
  const refundId = aftersale.id.replaceAll('-', '')
  if (!submit) {
    try {
      const result = await adapter.queryRefund(
        order.payment_reference,
        refundId,
      )
      await confirmRefundResult(orderId, result)
      if (result.status === 'refunded' || result.status === 'pending') return
    } catch {
      // Retry the SAME refund ID. A crash before dispatch must not strand an
      // approved refund, and idempotent retries cannot create a second refund.
    }
  }
  const result = await adapter.refund({
    orderId: order.payment_reference,
    refundId,
    amountCents: aftersale.amount_cents,
    totalAmountCents: order.total_cents,
    reason: aftersale.reason,
  })
  await confirmRefundResult(orderId, result)
  if (result.status !== 'refunded' && result.status !== 'pending')
    conflict('退款结果待核查，请稍后对账')
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
    const aftersale = await getAftersale(attempt.orderId)
    if (
      !aftersale ||
      notification.refundId !== aftersale.id.replaceAll('-', '')
    )
      conflict('退款订单不存在')
    // Query the original refund to reconcile channel callback variants.
    await processStoreRefund(attempt.orderId)
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
  const failed: Array<{ orderId: string; operation: string }> = []
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
      await processStoreRefund(refund.order_id)
      completed++
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
