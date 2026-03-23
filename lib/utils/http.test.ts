/** @vitest-environment node */

import { describe, expect, it } from 'vitest'
import { getApiErrorMessage } from '@/lib/utils/http'

describe('getApiErrorMessage', () => {
  it('prefers the error field from a JSON response', async () => {
    const response = new Response(JSON.stringify({ error: 'tip_limit_reached' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(getApiErrorMessage(response)).resolves.toBe('tip_limit_reached')
  })

  it('falls back to plain text when the response is not JSON', async () => {
    const response = new Response('gateway timeout', {
      status: 504,
      headers: { 'Content-Type': 'text/plain' },
    })

    await expect(getApiErrorMessage(response)).resolves.toBe('gateway timeout')
  })
})
