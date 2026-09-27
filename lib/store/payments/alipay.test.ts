import { describe, expect, it, vi, beforeEach } from 'vitest'
import { generateKeyPairSync, createSign } from 'node:crypto'
import { createAlipayAdapter } from './alipay'

const kp = generateKeyPairSync('rsa', { modulusLength: 2048 })
const privateKey = kp.privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString()
const publicKey = kp.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString()
const sdk = {
  pageExecute: vi.fn(
    () => 'https://openapi-sandbox.dl.alipaydev.com/pay?signed=1',
  ),
  exec: vi.fn(),
}
const cfg = {
  appId: 'app',
  privateKey,
  alipayPublicKey: publicKey,
  merchantId: 'seller',
  environment: 'test' as const,
  sdk,
}
const order = (device: 'page' | 'wap' = 'page') => ({
  orderId: 'ord-1',
  amountCents: 123,
  currency: 'CNY' as const,
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  subject: 'test',
  device,
})

beforeEach(() => {
  vi.clearAllMocks()
  sdk.exec.mockImplementation(async (method: string) => ({
    code: '10000',
    outTradeNo: 'ord-1',
    tradeNo: 'trade-1',
    totalAmount: '1.23',
    tradeStatus: 'TRADE_SUCCESS',
    refundFee: '1.23',
    outRequestNo: 'refund-1',
    refundStatus: 'REFUND_SUCCESS',
    refundAmount: '1.23',
    method,
  }))
})

describe('alipay adapter protocol', () => {
  it('uses page and WAP methods, exact cents, and Beijing minute expiry', async () => {
    const a = createAlipayAdapter(cfg)
    await a.create(order('page'))
    await a.create(order('wap'))
    expect(sdk.pageExecute).toHaveBeenNthCalledWith(
      1,
      'alipay.trade.page.pay',
      'GET',
      expect.objectContaining({
        bizContent: expect.objectContaining({
          total_amount: '1.23',
          product_code: 'FAST_INSTANT_TRADE_PAY',
        }),
      }),
    )
    expect(sdk.pageExecute).toHaveBeenNthCalledWith(
      2,
      'alipay.trade.wap.pay',
      'GET',
      expect.objectContaining({
        bizContent: expect.objectContaining({
          product_code: 'QUICK_WAP_WAY',
          time_expire: expect.stringMatching(/^\d{4}-\d\d-\d\d \d\d:\d\d$/),
        }),
      }),
    )
    await expect(
      a.create({
        ...order(),
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
      }),
    ).rejects.toThrow('Payment deadline expired')
  })

  it('requires exact signed camelCase query identity and amount', async () => {
    const a = createAlipayAdapter(cfg)
    await expect(a.query('ord-1')).resolves.toMatchObject({
      status: 'paid',
      amountCents: 123,
      providerOrderId: 'trade-1',
    })
    sdk.exec.mockResolvedValueOnce({
      code: '10000',
      outTradeNo: 'other',
      totalAmount: '1.23',
      tradeStatus: 'TRADE_SUCCESS',
    })
    await expect(a.query('ord-1')).rejects.toThrow(/code\/order mismatch/)
    sdk.exec.mockResolvedValueOnce({ code: '40004', subCode: 'OTHER' })
    await expect(a.query('ord-1')).rejects.toThrow(/code\/order mismatch/)
    sdk.exec.mockResolvedValueOnce({
      code: '40004',
      subCode: 'ACQ.TRADE_NOT_EXIST',
    })
    await expect(a.query('ord-1')).resolves.toMatchObject({
      status: 'not_found',
    })
    sdk.exec.mockResolvedValueOnce({
      code: '10000',
      outTradeNo: 'ord-1',
      totalAmount: '1.234',
      tradeStatus: 'TRADE_SUCCESS',
    })
    await expect(a.query('ord-1')).rejects.toThrow('invalid money')
  })

  it('refunds then queries the stable refund id and exact confirmed amount', async () => {
    const a = createAlipayAdapter(cfg)
    await expect(
      a.refund({ orderId: 'ord-1', refundId: 'refund-1', amountCents: 123 }),
    ).resolves.toMatchObject({
      status: 'refunded',
      amountCents: 123,
      refundId: 'refund-1',
    })
    expect(sdk.exec).toHaveBeenNthCalledWith(
      2,
      'alipay.trade.fastpay.refund.query',
      expect.anything(),
      expect.objectContaining({ validateSign: true }),
    )
    sdk.exec.mockResolvedValueOnce({
      code: '10000',
      outTradeNo: 'ord-1',
      refundFee: '1.23',
    })
    sdk.exec.mockResolvedValueOnce({
      code: '10000',
      outTradeNo: 'ord-1',
      outRequestNo: 'other',
      refundStatus: 'REFUND_SUCCESS',
      refundAmount: '1.23',
    })
    await expect(
      a.refund({ orderId: 'ord-1', refundId: 'refund-1', amountCents: 123 }),
    ).rejects.toThrow('refund identity mismatch')
  })

  it('verifies RSA callback signature, seller/app identity, and decimal amount', async () => {
    const a = createAlipayAdapter(cfg)
    const fields: Record<string, string> = {
      app_id: 'app',
      seller_id: 'seller',
      out_trade_no: 'ord-1',
      trade_no: 'trade-1',
      trade_status: 'TRADE_SUCCESS',
      total_amount: '1.23',
      sign_type: 'RSA2',
    }
    const text = Object.keys(fields)
      .filter((k) => k !== 'sign_type')
      .sort()
      .map((k) => `${k}=${fields[k]}`)
      .join('&')
    const signer = createSign('RSA-SHA256')
    signer.update(text)
    signer.end()
    fields.sign = signer.sign(privateKey).toString('base64')
    await expect(
      a.verifyNotification({ body: new URLSearchParams(fields).toString() }),
    ).resolves.toMatchObject({
      orderId: 'ord-1',
      amountCents: 123,
      status: 'paid',
    })
    await expect(
      a.verifyNotification({
        body: new URLSearchParams({ ...fields, sign: 'tampered' }).toString(),
      }),
    ).rejects.toThrow('Invalid Alipay signature')
    const wrong: Record<string, string> = { ...fields, app_id: 'other' }
    const s2 = createSign('RSA-SHA256')
    s2.update(
      Object.keys(wrong)
        .filter((k) => k !== 'sign' && k !== 'sign_type')
        .sort()
        .map((k) => `${k}=${wrong[k]}`)
        .join('&'),
    )
    s2.end()
    wrong.sign = s2.sign(privateKey).toString('base64')
    await expect(
      a.verifyNotification({ body: new URLSearchParams(wrong).toString() }),
    ).rejects.toThrow('callback identity')
    const badMoney: Record<string, string> = {
      ...fields,
      total_amount: '1.234',
    }
    const s3 = createSign('RSA-SHA256')
    s3.update(
      Object.keys(badMoney)
        .filter((k) => k !== 'sign' && k !== 'sign_type')
        .sort()
        .map((k) => `${k}=${badMoney[k]}`)
        .join('&'),
    )
    s3.end()
    badMoney.sign = s3.sign(privateKey).toString('base64')
    await expect(
      a.verifyNotification({ body: new URLSearchParams(badMoney).toString() }),
    ).rejects.toThrow('invalid money')
  })
})
