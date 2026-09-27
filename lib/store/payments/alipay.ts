import { createPublicKey } from 'node:crypto'
import { AlipaySdk } from 'alipay-sdk'
import { verifyRsaSha256 } from './crypto'
import {
  cents,
  moneyCents,
  yuan,
  type PaymentAdapter,
  type PaymentStatus,
} from './types'

export interface AlipayConfig {
  appId: string
  privateKey: string
  alipayPublicKey: string
  merchantId: string
  notifyUrl?: string
  environment?: 'test' | 'production'
  sdk?: Pick<AlipaySdk, 'exec' | 'pageExecute'>
}
const status = (value: unknown): PaymentStatus => {
  if (value === 'TRADE_SUCCESS' || value === 'TRADE_FINISHED') return 'paid'
  if (value === 'TRADE_CLOSED') return 'closed'
  return value === 'WAIT_BUYER_PAY' ? 'pending' : 'unknown'
}
function signatureText(params: Record<string, string>) {
  return Object.keys(params)
    .filter(
      (key) => key !== 'sign' && key !== 'sign_type' && params[key] !== '',
    )
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
}
function requireSuccess(result: Record<string, unknown>, orderId: string) {
  if (result.code !== '10000' || result.outTradeNo !== orderId)
    throw new Error('Alipay response code/order mismatch')
}
/** Alipay uses Beijing time without a timezone suffix. Round down to the minute. */
function alipayExpiry(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.getTime() - Date.now() < 60_000)
    throw new Error('Payment deadline expired')
  return new Date(date.getTime() + 8 * 3600_000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ')
}

export function createAlipayAdapter(config: AlipayConfig): PaymentAdapter {
  createPublicKey(config.alipayPublicKey)
  if (!config.merchantId || !config.appId)
    throw new Error('Alipay merchant configuration missing')
  const sdk =
    config.sdk ??
    new AlipaySdk({
      appId: config.appId,
      privateKey: config.privateKey,
      alipayPublicKey: config.alipayPublicKey,
      keyType: config.privateKey.includes('BEGIN PRIVATE KEY')
        ? 'PKCS8'
        : 'PKCS1',
      gateway:
        config.environment === 'test'
          ? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
          : 'https://openapi.alipay.com/gateway.do',
      timeout: 10000,
    })
  // Official SDK returns unwrapped camelCase fields. It verifies the raw signed
  // response before transforming field names; never parse a fake JSON envelope.
  const call = async (method: string, bizContent: Record<string, unknown>) =>
    (await sdk.exec(method, { bizContent }, { validateSign: true })) as Record<
      string,
      unknown
    >
  const adapter: PaymentAdapter = {
    async create(order) {
      cents(order.amountCents)
      const wap = order.device === 'wap'
      const checkout = sdk.pageExecute(
        wap ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay',
        'GET',
        {
          bizContent: {
            out_trade_no: order.orderId,
            total_amount: yuan(order.amountCents),
            subject: order.subject,
            time_expire: alipayExpiry(order.expiresAt),
            product_code: wap ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY',
          },
          returnUrl: order.returnUrl,
          notifyUrl: order.notifyUrl ?? config.notifyUrl,
        },
      )
      if (
        !checkout.startsWith('https://openapi.alipay.com/') &&
        !checkout.startsWith('https://openapi-sandbox.dl.alipaydev.com/')
      )
        throw new Error('Invalid Alipay checkout URL')
      return {
        provider: 'alipay',
        orderId: order.orderId,
        status: 'pending',
        amountCents: order.amountCents,
        currency: 'CNY',
        checkout,
        checkoutKind: 'redirect',
      }
    },
    async query(orderId) {
      const result = await call('alipay.trade.query', { out_trade_no: orderId })
      if (result.code === '40004' && result.subCode === 'ACQ.TRADE_NOT_EXIST')
        return {
          provider: 'alipay',
          orderId,
          currency: 'CNY',
          status: 'not_found',
        }
      requireSuccess(result, orderId)
      const amountCents = moneyCents(result.totalAmount)
      return {
        provider: 'alipay',
        orderId,
        providerOrderId:
          typeof result.tradeNo === 'string' ? result.tradeNo : undefined,
        amountCents,
        currency: 'CNY',
        status: status(result.tradeStatus),
      }
    },
    async close(orderId) {
      const result = await call('alipay.trade.close', { out_trade_no: orderId })
      requireSuccess(result, orderId)
      return { provider: 'alipay', orderId, currency: 'CNY', status: 'closed' }
    },
    async verifyNotification(input) {
      const params = new URLSearchParams(input.body)
      if (new Set(params.keys()).size !== [...params.keys()].length)
        throw new Error('Duplicate callback fields')
      const data = Object.fromEntries(params)
      if (
        data.sign_type !== 'RSA2' ||
        !verifyRsaSha256(config.alipayPublicKey, signatureText(data), data.sign)
      )
        throw new Error('Invalid Alipay signature')
      if (
        data.app_id !== config.appId ||
        data.seller_id !== config.merchantId ||
        !data.out_trade_no ||
        !data.trade_no
      )
        throw new Error('Invalid Alipay callback identity')
      return {
        provider: 'alipay',
        orderId: data.out_trade_no,
        providerOrderId: data.trade_no,
        status: status(data.trade_status),
        amountCents: moneyCents(data.total_amount),
        currency: 'CNY',
        raw: undefined,
      }
    },
    async refund(request) {
      cents(request.amountCents)
      const result = await call('alipay.trade.refund', {
        out_trade_no: request.orderId,
        out_request_no: request.refundId,
        refund_amount: yuan(request.amountCents),
        refund_reason: request.reason,
      })
      requireSuccess(result, request.orderId)
      if (moneyCents(result.refundFee) !== request.amountCents)
        throw new Error('Alipay refund amount mismatch')
      // Refund's response does not always echo out_request_no. Query the stable
      // refund ID to confirm its identity before marking a refund successful.
      return adapter.queryRefund(request.orderId, request.refundId)
    },
    async queryRefund(orderId, refundId) {
      const result = await call('alipay.trade.fastpay.refund.query', {
        out_trade_no: orderId,
        out_request_no: refundId,
      })
      if (
        result.code === '40004' &&
        ['ACQ.TRADE_NOT_EXIST', 'ACQ.REFUND_NOT_EXIST'].includes(
          String(result.subCode),
        )
      )
        return {
          provider: 'alipay',
          orderId,
          refundId,
          currency: 'CNY',
          status: 'not_found',
        }
      requireSuccess(result, orderId)
      if (result.outRequestNo !== refundId)
        throw new Error('Alipay refund identity mismatch')
      if (result.refundStatus !== 'REFUND_SUCCESS')
        return {
          provider: 'alipay',
          orderId,
          refundId,
          currency: 'CNY',
          status: 'unknown',
        }
      return {
        provider: 'alipay',
        orderId,
        refundId,
        currency: 'CNY',
        status: 'refunded',
        amountCents: moneyCents(result.refundAmount),
      }
    },
  }
  return adapter
}
