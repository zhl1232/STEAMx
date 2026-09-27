import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('retired store webhook', () => {
  it('never accepts a legacy HMAC as payment confirmation', async () => {
    const response = await POST()
    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({ code: 'LEGACY_PAYMENT_WEBHOOK_DISABLED' })
  })
})
