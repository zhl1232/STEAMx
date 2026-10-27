import { randomBytes, createPrivateKey, createSign } from 'node:crypto'
import { decryptWechatNotification, verifyRsaSha256 } from './crypto'
import {
  cents,
  type PaymentAdapter,
  type PaymentTransport,
  type PaymentStatus,
  type RefundRequest,
  type Notification,
} from './types'

export interface WechatConfig {
  mchid: string
  appid: string
  merchantSerial: string
  merchantPrivateKey: string
  apiV3Key: string
  platformPublicKeys: Record<string, string>
  notifyUrl: string
  transport?: PaymentTransport
  replayToleranceSeconds?: number
  sandbox?: boolean
  environment?: 'test' | 'production'
}
type WechatPayload = {
  code?: string
  appid?: string
  mchid?: string
  out_trade_no?: string
  transaction_id?: string
  trade_state?: string
  status?: string
  out_refund_no?: string
  refund_id?: string
  refund_status?: string
  code_url?: string
  h5_url?: string
  amount?: { total?: number; refund?: number; currency?: string }
}
const status = (s: unknown): PaymentStatus =>
  s === 'SUCCESS'
    ? 'paid'
    : s === 'CLOSED'
      ? 'closed'
      : s === 'REFUND'
        ? 'refunded'
        : s === 'NOTPAY' || s === 'USERPAYING'
          ? 'pending'
          : s === 'PAYERROR'
            ? 'failed'
            : 'unknown'
const refundStatus = (value: unknown): PaymentStatus =>
  value === 'SUCCESS'
    ? 'refunded'
    : value === 'PROCESSING'
      ? 'pending'
      : value === 'CLOSED'
        ? 'refund_closed'
        : value === 'ABNORMAL'
          ? 'refund_abnormal'
          : 'unknown'
const paths = {
  native: '/v3/pay/transactions/native',
  h5: '/v3/pay/transactions/h5',
  query: (id: string, m: string) =>
    `/v3/pay/transactions/out-trade-no/${encodeURIComponent(id)}?mchid=${encodeURIComponent(m)}`,
  close: (m: string, id: string) =>
    `/v3/pay/transactions/out-trade-no/${encodeURIComponent(id)}/close`,
  refund: '/v3/refund/domestic/refunds',
  refundQuery: (id: string) =>
    `/v3/refund/domestic/refunds/${encodeURIComponent(id)}`,
}
class VerifiedWechatError extends Error {
  constructor(
    public code: string,
    public httpStatus: number,
  ) {
    super('WeChat request rejected')
  }
}

export function createWechatAdapter(config: WechatConfig): PaymentAdapter {
  if (config.environment === 'test' && !config.transport)
    throw new Error(
      'WeChat test environment requires an injected fake transport',
    )
  if (Buffer.byteLength(config.apiV3Key, 'utf8') !== 32)
    throw new Error('WeChat APIv3 key must be exactly 32 UTF-8 bytes')
  createPrivateKey(config.merchantPrivateKey)
  const transport = config.transport
  async function request(
    method: string,
    path: string,
    payload: Record<string, unknown> | undefined,
  ) {
    const body = payload ? JSON.stringify(payload) : ''
    const url = path.startsWith('http')
      ? path
      : `https://api.mch.weixin.qq.com${path}`
    if (!url.startsWith('https://api.mch.weixin.qq.com/'))
      throw new Error('WeChat URL outside official API host')
    const ts = Math.floor(Date.now() / 1000).toString()
    const nonce = randomBytes(16).toString('hex')
    const message = `${method}\n${path}\n${ts}\n${nonce}\n${body}\n`
    const signer = createSign('RSA-SHA256')
    signer.update(message)
    signer.end()
    const signature = signer.sign(config.merchantPrivateKey).toString('base64')
    const headers: Record<string, string> = {
      Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchid}",serial_no="${config.merchantSerial}",nonce_str="${nonce}",signature="${signature}",timestamp="${ts}"`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Wechatpay-Serial':
        Object.keys(config.platformPublicKeys).find((id) =>
          id.startsWith('PUB_KEY_ID_'),
        ) || Object.keys(config.platformPublicKeys)[0],
    }
    const r = transport
      ? await transport.request({ method, path, body, headers })
      : await (async () => {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 10000)
          try {
            return await fetch(url, {
              method,
              headers,
              body: method === 'GET' ? undefined : body,
              signal: controller.signal,
            }).then(async (response) => ({
              status: response.status,
              headers: Object.fromEntries(response.headers.entries()),
              body: await response.text(),
            }))
          } finally {
            clearTimeout(timer)
          }
        })()
    const rh = Object.fromEntries(
      Object.entries(r.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    )
    const serial = rh['wechatpay-serial']
    const responseKey = serial && config.platformPublicKeys[serial]
    const responseTs = Number(rh['wechatpay-timestamp'])
    if (
      !serial ||
      !responseKey ||
      !rh['wechatpay-timestamp'] ||
      !Number.isSafeInteger(responseTs) ||
      Math.abs(Date.now() / 1000 - responseTs) >
        (config.replayToleranceSeconds ?? 300) ||
      !rh['wechatpay-nonce'] ||
      !rh['wechatpay-signature'] ||
      !verifyRsaSha256(
        responseKey,
        `${rh['wechatpay-timestamp']}\n${rh['wechatpay-nonce']}\n${r.body}\n`,
        rh['wechatpay-signature'],
      )
    )
      throw new Error('WeChat response signature missing or invalid')
    const parsed = r.body ? (JSON.parse(r.body) as WechatPayload) : {}
    if (r.status < 200 || r.status >= 300)
      throw new VerifiedWechatError(String(parsed.code), r.status)
    if (r.status === 204 && !path.endsWith('/close'))
      throw new Error('Unexpected empty WeChat response')
    if (path.endsWith('/close') && r.status !== 204)
      throw new Error('WeChat closure not confirmed')
    return parsed
  }
  async function verify(input: {
    headers?: Record<string, string>
    body: string
    query?: Record<string, string>
  }): Promise<Notification> {
    const h = Object.fromEntries(
      Object.entries(input.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    )
    const serial = h['wechatpay-serial']
    const signature = h['wechatpay-signature']
    const timestamp = h['wechatpay-timestamp']
    const nonce = h['wechatpay-nonce']
    if (!serial || !signature || !timestamp || !nonce)
      throw new Error('WeChat notification signature headers missing')
    const key = config.platformPublicKeys[serial]
    if (!key)
      throw new Error(`WeChat platform certificate serial unknown: ${serial}`)
    const ts = Number(timestamp)
    if (
      !Number.isSafeInteger(ts) ||
      Math.abs(Date.now() / 1000 - ts) > (config.replayToleranceSeconds ?? 300)
    )
      throw new Error('WeChat notification timestamp outside replay tolerance')
    if (
      !verifyRsaSha256(
        key,
        `${timestamp}\n${nonce}\n${input.body}\n`,
        signature,
      )
    )
      throw new Error('WeChat notification signature invalid')
    const envelope = JSON.parse(input.body) as {
      resource?: {
        algorithm: string
        ciphertext: string
        nonce: string
        associated_data?: string
      }
    }
    const resource = envelope.resource
    if (!resource || resource.algorithm !== 'AEAD_AES_256_GCM')
      throw new Error('WeChat notification encryption invalid')
    const payload = JSON.parse(
      decryptWechatNotification(
        resource.ciphertext,
        resource.nonce,
        resource.associated_data ?? '',
        config.apiV3Key,
      ),
    ) as WechatPayload
    const refund = Boolean(payload.refund_id || payload.refund_status)
    if (
      typeof payload.out_trade_no !== 'string' ||
      !payload.out_trade_no ||
      (refund &&
        (typeof payload.out_refund_no !== 'string' || !payload.out_refund_no))
    )
      throw new Error('WeChat notification order reference invalid')
    if (
      (!refund && payload.appid !== config.appid) ||
      payload.mchid !== config.mchid
    )
      throw new Error('WeChat notification merchant mismatch')
    const amount = refund ? payload.amount?.refund : payload.amount?.total
    if (
      (!refund && payload.amount?.currency !== 'CNY') ||
      (refund &&
        payload.amount?.currency &&
        payload.amount.currency !== 'CNY') ||
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    )
      throw new Error('WeChat notification amount/currency invalid')
    return {
      provider: 'wechat',
      orderId: payload.out_trade_no,
      providerOrderId: payload.transaction_id,
      status: refund
        ? refundStatus(payload.refund_status)
        : status(payload.trade_state),
      amountCents: amount,
      refundId: payload.out_refund_no,
      currency: 'CNY',
      raw: payload,
    }
  }
  return {
    async create(o) {
      cents(o.amountCents)
      const expiry = o.expiresAt ? new Date(o.expiresAt) : new Date(0)
      if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())
        throw new Error('expiresAt must be in the future')
      const h5 = o.device === 'h5' || o.device === 'wap' || Boolean(o.clientIp)
      const p = h5 ? paths.h5 : paths.native
      const payload = {
        appid: config.appid,
        mchid: config.mchid,
        description: o.subject,
        out_trade_no: o.orderId,
        time_expire: o.expiresAt,
        notify_url: o.notifyUrl ?? config.notifyUrl,
        amount: { total: o.amountCents, currency: 'CNY' },
        ...(h5
          ? {
              scene_info: {
                payer_client_ip: o.clientIp,
                h5_info: { type: 'Wap' },
              },
            }
          : {}),
      }
      const r = await request('POST', p, payload)
      const checkout = r.code_url ?? r.h5_url
      if (
        typeof checkout !== 'string' ||
        (h5
          ? !checkout.startsWith('https://wx.tenpay.com/')
          : !checkout.startsWith('weixin://wxpay/'))
      )
        throw new Error('WeChat checkout URL missing or invalid')
      return {
        provider: 'wechat',
        orderId: o.orderId,
        status: 'pending',
        amountCents: o.amountCents,
        currency: 'CNY',
        checkout,
        checkoutKind: h5 ? 'redirect' : 'qr',
        raw: r,
      }
    },
    async query(id) {
      let r: WechatPayload
      try {
        r = await request('GET', paths.query(id, config.mchid), undefined)
      } catch (error) {
        if (
          error instanceof VerifiedWechatError &&
          error.httpStatus === 404 &&
          error.code === 'ORDER_NOT_EXIST'
        )
          return {
            provider: 'wechat',
            orderId: id,
            currency: 'CNY',
            status: 'not_found',
          }
        throw error
      }
      if (
        r.appid !== config.appid ||
        r.mchid !== config.mchid ||
        r.out_trade_no !== id ||
        r.amount?.currency !== 'CNY' ||
        !Number.isSafeInteger(r.amount?.total)
      )
        throw new Error('WeChat query response identity/amount invalid')
      return {
        provider: 'wechat',
        orderId: id,
        providerOrderId: r.transaction_id,
        status: status(r.trade_state),
        amountCents: r.amount?.total,
        currency: 'CNY',
        raw: r,
      }
    },
    async close(id) {
      const r = await request('POST', paths.close(config.mchid, id), {
        mchid: config.mchid,
      })
      return {
        provider: 'wechat',
        orderId: id,
        status: 'closed',
        currency: 'CNY',
        raw: r,
      }
    },
    verifyNotification: verify,
    async refund(r: RefundRequest) {
      cents(r.amountCents)
      const total = r.totalAmountCents ?? r.amountCents
      cents(total)
      if (r.amountCents > total)
        throw new Error('refund exceeds original amount')
      const x = await request('POST', paths.refund, {
        out_trade_no: r.orderId,
        out_refund_no: r.refundId,
        reason: r.reason,
        amount: { refund: r.amountCents, total, currency: 'CNY' },
        notify_url: config.notifyUrl,
      })
      if (
        x.out_trade_no !== r.orderId ||
        x.out_refund_no !== r.refundId ||
        x.amount?.currency !== 'CNY' ||
        x.amount?.refund !== r.amountCents
      )
        throw new Error('WeChat refund response identity/amount invalid')
      return {
        provider: 'wechat',
        orderId: r.orderId,
        refundId: r.refundId,
        status: refundStatus(x.status),
        amountCents: x.amount?.refund,
        currency: 'CNY',
        raw: x,
      }
    },
    async queryRefund(id, refundId) {
      let x: WechatPayload
      try {
        x = await request('GET', paths.refundQuery(refundId), undefined)
      } catch (error) {
        if (
          error instanceof VerifiedWechatError &&
          error.httpStatus === 404 &&
          error.code === 'RESOURCE_NOT_EXISTS'
        )
          return {
            provider: 'wechat',
            orderId: id,
            refundId,
            currency: 'CNY',
            status: 'not_found',
          }
        throw error
      }
      if (
        x.out_trade_no !== id ||
        x.out_refund_no !== refundId ||
        x.amount?.currency !== 'CNY' ||
        !Number.isSafeInteger(x.amount?.refund)
      )
        throw new Error('WeChat refund query identity/amount invalid')
      return {
        provider: 'wechat',
        orderId: id,
        refundId,
        status: refundStatus(x.status),
        amountCents: x.amount?.refund,
        currency: 'CNY',
        raw: x,
      }
    },
  }
}
