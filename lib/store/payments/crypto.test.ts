import {
  createCipheriv,
  createSign,
  createVerify,
  generateKeyPairSync,
} from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createWechatAdapter } from './wechat'

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const privatePem = keys.privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString()
const publicPem = keys.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString()
const apiKey = '0123456789abcdefghijklmnopqrstuv'
const base = {
  mchid: 'mch',
  appid: 'app',
  merchantSerial: 'merchant',
  merchantPrivateKey: privatePem,
  apiV3Key: apiKey,
  platformPublicKeys: { serial: publicPem },
  notifyUrl: 'https://example.test/notify',
  environment: 'test' as const,
}
const signed = (
  status: number,
  body: string,
  headers: Record<string, string> = {},
) => {
  const ts = Math.floor(Date.now() / 1000).toString()
  const nonce = 'response-nonce'
  const signer = createSign('RSA-SHA256')
  signer.update(`${ts}\n${nonce}\n${body}\n`)
  signer.end()
  return {
    status,
    body,
    headers: {
      'Wechatpay-Serial': 'serial',
      'Wechatpay-Timestamp': ts,
      'Wechatpay-Nonce': nonce,
      'Wechatpay-Signature': signer.sign(privatePem).toString('base64'),
      ...headers,
    },
  }
}
const encryptedNotification = (payload: Record<string, unknown>) => {
  const nonce = 'notif-nonce'
  const aad = 'transaction'
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(apiKey),
    Buffer.from(nonce),
  )
  cipher.setAAD(Buffer.from(aad))
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload)),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString('base64')
  const body = JSON.stringify({
    resource: {
      algorithm: 'AEAD_AES_256_GCM',
      ciphertext: encrypted,
      nonce,
      associated_data: aad,
    },
  })
  const ts = Math.floor(Date.now() / 1000).toString()
  const signer = createSign('RSA-SHA256')
  signer.update(`${ts}\nnotify-nonce\n${body}\n`)
  signer.end()
  return {
    body,
    headers: {
      'Wechatpay-Serial': 'serial',
      'Wechatpay-Timestamp': ts,
      'Wechatpay-Nonce': 'notify-nonce',
      'Wechatpay-Signature': signer.sign(privatePem).toString('base64'),
    },
  }
}

describe('wechat payment protocol', () => {
  it('generates canonical Authorization and distinct Native/H5 payloads', async () => {
    const seen: Array<{
      method: string
      path: string
      body?: string
      headers?: Record<string, string>
    }> = []
    const adapter = createWechatAdapter({
      ...base,
      transport: {
        request: async (input) => {
          seen.push(input)
          return signed(
            seen.length < 3 ? 200 : 204,
            seen.length === 1
              ? JSON.stringify({ code_url: 'weixin://wxpay/native' })
              : seen.length === 2
                ? JSON.stringify({ h5_url: 'https://wx.tenpay.com/pages/h5' })
                : '',
          )
        },
      },
    })
    await adapter.create({
      orderId: 'native',
      amountCents: 100,
      currency: 'CNY',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      subject: 'N',
      device: 'native',
    })
    await adapter.create({
      orderId: 'h5',
      amountCents: 101,
      currency: 'CNY',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      subject: 'H',
      device: 'h5',
      clientIp: '127.0.0.1',
    })
    await adapter.close('native')
    expect(seen[0].headers!['Wechatpay-Serial']).toBe('serial')
    expect(seen[0].path).toBe('/v3/pay/transactions/native')
    expect(seen[1].path).toBe('/v3/pay/transactions/h5')
    expect(JSON.parse(seen[1].body || '{}').amount.total).toBe(101)
    expect(JSON.parse(seen[1].body || '{}').scene_info.h5_info.type).toBe('Wap')
    expect(seen[0].headers!.Authorization).toMatch(
      /^WECHATPAY2-SHA256-RSA2048 mchid="mch",serial_no="merchant",nonce_str=".+",signature=".+",timestamp="\d+"$/,
    )
    for (const input of seen) {
      const fields = Object.fromEntries(
        [...input.headers!.Authorization.matchAll(/(\w+)="([^"]+)"/g)].map(
          (match) => [match[1], match[2]],
        ),
      )
      const verifier = createVerify('RSA-SHA256')
      verifier.update(
        `${input.method}\n${input.path}\n${fields.timestamp}\n${fields.nonce_str}\n${input.body}\n`,
      )
      verifier.end()
      expect(verifier.verify(publicPem, fields.signature, 'base64')).toBe(true)
    }
    await expect(
      adapter.create({
        orderId: 'expired',
        amountCents: 100,
        currency: 'CNY',
        expiresAt: new Date(Date.now() - 1).toISOString(),
        subject: 'E',
        device: 'native',
      }),
    ).rejects.toThrow('expiresAt must be in the future')
  })

  it('accepts only signed close 204 and rejects missing, unknown, bad, stale and invalid 204 responses', async () => {
    for (const headers of [
      {},
      { 'Wechatpay-Serial': 'unknown' },
      {
        'Wechatpay-Serial': 'serial',
        'Wechatpay-Timestamp': '1',
        'Wechatpay-Nonce': 'n',
        'Wechatpay-Signature': 'bad',
      },
    ] as Record<string, string>[]) {
      const a = createWechatAdapter({
        ...base,
        transport: {
          request: async () => ({ status: 200, body: '{}', headers }),
        },
      })
      await expect(a.close('x')).rejects.toThrow(/signature/)
    }
    const invalid204 = createWechatAdapter({
      ...base,
      transport: { request: async () => signed(204, '') },
    })
    await expect(invalid204.query('x')).rejects.toThrow(/Unexpected empty/)
    const badClose = createWechatAdapter({
      ...base,
      transport: { request: async () => signed(200, '{}') },
    })
    await expect(badClose.close('x')).rejects.toThrow(/closure not confirmed/)
  })

  it('maps only exact signed ORDER_NOT_EXIST to not_found and validates query identity/amount', async () => {
    const missing = createWechatAdapter({
      ...base,
      transport: {
        request: async () =>
          signed(404, JSON.stringify({ code: 'ORDER_NOT_EXIST' })),
      },
    })
    await expect(missing.query('missing')).resolves.toMatchObject({
      status: 'not_found',
    })
    const other = createWechatAdapter({
      ...base,
      transport: {
        request: async () => signed(404, JSON.stringify({ code: 'OTHER' })),
      },
    })
    await expect(other.query('missing')).rejects.toThrow(
      'WeChat request rejected',
    )
    const valid = createWechatAdapter({
      ...base,
      transport: {
        request: async () =>
          signed(
            200,
            JSON.stringify({
              appid: 'app',
              mchid: 'mch',
              out_trade_no: 'o',
              transaction_id: 't',
              trade_state: 'SUCCESS',
              amount: { total: 123, currency: 'CNY' },
            }),
          ),
      },
    })
    await expect(valid.query('o')).resolves.toMatchObject({
      status: 'paid',
      amountCents: 123,
    })
    const wrong = createWechatAdapter({
      ...base,
      transport: {
        request: async () =>
          signed(
            200,
            JSON.stringify({
              appid: 'app',
              mchid: 'mch',
              out_trade_no: 'other',
              amount: { total: 123, currency: 'CNY' },
            }),
          ),
      },
    })
    await expect(wrong.query('o')).rejects.toThrow(/identity\/amount/)
  })

  it.each([['CLOSED', 'refund_closed'], ['ABNORMAL', 'refund_abnormal'], ['PROCESSING', 'pending'], ['SUCCESS', 'refunded']])('preserves verified WeChat refund status %s', async (channelStatus, expected) => {
    const adapter = createWechatAdapter({ ...base, transport: { request: async () => signed(200, JSON.stringify({ out_trade_no: 'o', out_refund_no: 'r', status: channelStatus, amount: { refund: 123, currency: 'CNY' } })) } })
    await expect(adapter.queryRefund('o', 'r')).resolves.toMatchObject({ status: expected, amountCents: 123, refundId: 'r' })
  })

  it('validates encrypted payment and refund callbacks including merchant and money fields', async () => {
    const adapter = createWechatAdapter({
      ...base,
      transport: { request: async () => signed(200, '{}') },
    })
    await expect(
      adapter.verifyNotification(
        encryptedNotification({
          appid: 'app',
          mchid: 'mch',
          out_trade_no: 'ord',
          transaction_id: 'tx',
          trade_state: 'SUCCESS',
          amount: { total: 123, currency: 'CNY' },
        }),
      ),
    ).resolves.toMatchObject({
      orderId: 'ord',
      status: 'paid',
      amountCents: 123,
    })
    await expect(
      adapter.verifyNotification(
        encryptedNotification({
          appid: 'other',
          mchid: 'mch',
          out_trade_no: 'ord',
          transaction_id: 'tx',
          trade_state: 'SUCCESS',
          amount: { total: 123, currency: 'CNY' },
        }),
      ),
    ).rejects.toThrow(/merchant mismatch/)
    await expect(
      adapter.verifyNotification(
        encryptedNotification({
          appid: 'app',
          mchid: 'other',
          out_trade_no: 'ord',
          transaction_id: 'tx',
          trade_state: 'SUCCESS',
          amount: { total: 123, currency: 'CNY' },
        }),
      ),
    ).rejects.toThrow(/merchant mismatch/)
    await expect(
      adapter.verifyNotification(
        encryptedNotification({
          appid: 'app',
          mchid: 'mch',
          out_trade_no: 'ord',
          transaction_id: 'tx',
          trade_state: 'SUCCESS',
          amount: { total: 123, currency: 'USD' },
        }),
      ),
    ).rejects.toThrow(/amount\/currency invalid/)
    await expect(
      adapter.verifyNotification(
        encryptedNotification({
          mchid: 'mch',
          out_trade_no: 'ord',
          refund_id: 'r',
          out_refund_no: 'r-1',
          refund_status: 'SUCCESS',
          amount: { refund: 23, currency: 'CNY' },
        }),
      ),
    ).resolves.toMatchObject({
      status: 'refunded',
      amountCents: 23,
      refundId: 'r-1',
    })
  })
})
