import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { POST } from './route'

describe('store payment webhook', () => {
  it('fails closed when no webhook secret is configured', async () => {
    const previous = process.env.STORE_PAYMENT_WEBHOOK_SECRET
    delete process.env.STORE_PAYMENT_WEBHOOK_SECRET
    try {
      const response = await POST(new Request('http://localhost/api/store/payments/webhook', { method: 'POST', body: '{}' }) as never)
      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toMatchObject({ code: 'PAYMENT_WEBHOOK_NOT_CONFIGURED' })
    } finally {
      if (previous === undefined) delete process.env.STORE_PAYMENT_WEBHOOK_SECRET
      else process.env.STORE_PAYMENT_WEBHOOK_SECRET = previous
    }
  })

  it('rejects unsigned provider events before touching the database', async () => {
    const previous = process.env.STORE_PAYMENT_WEBHOOK_SECRET
    process.env.STORE_PAYMENT_WEBHOOK_SECRET = 'test-secret'
    try {
      const response = await POST(new Request('http://localhost/api/store/payments/webhook', { method: 'POST', body: '{}' }) as never)
      expect(response.status).toBe(401)
    } finally {
      if (previous === undefined) delete process.env.STORE_PAYMENT_WEBHOOK_SECRET
      else process.env.STORE_PAYMENT_WEBHOOK_SECRET = previous
    }
  })

  it('accepts the documented sha256 signature format', async () => {
    const previous = process.env.STORE_PAYMENT_WEBHOOK_SECRET
    process.env.STORE_PAYMENT_WEBHOOK_SECRET = 'test-secret'
    const body = JSON.stringify({ order_id: 'not-a-uuid', status: 'paid', reference: 'ref' })
    const signature = createHmac('sha256', 'test-secret').update(body).digest('hex')
    try {
      const response = await POST(new Request('http://localhost/api/store/payments/webhook', {
        method: 'POST',
        body,
        headers: { 'x-store-signature': `sha256=${signature}` },
      }) as never)
      expect(response.status).toBe(400)
    } finally {
      if (previous === undefined) delete process.env.STORE_PAYMENT_WEBHOOK_SECRET
      else process.env.STORE_PAYMENT_WEBHOOK_SECRET = previous
    }
  })
})
