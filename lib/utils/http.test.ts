/** @vitest-environment node */

import { describe, expect, it } from 'vitest'
import {
  getApiErrorMessage,
  getApiErrorPayload,
  getInteractionAccessRedirect,
  isAgeConfirmationRequired,
} from '@/lib/utils/http'

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

  it('preserves structured interaction access details', async () => {
    const response = new Response(JSON.stringify({
      error: '完成社区互动确认后即可继续此操作',
      code: 'AGE_CONFIRMATION_REQUIRED',
      details: {
        redirectTo: '/settings/security?section=age-confirmation',
        capability: 'comment',
      },
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })

    const payload = await getApiErrorPayload(response)
    expect(isAgeConfirmationRequired(payload)).toBe(true)
    expect(getInteractionAccessRedirect(payload)).toBe('/settings/security?section=age-confirmation')
  })

  it('does not accept an external interaction access redirect', () => {
    expect(getInteractionAccessRedirect({
      code: 'AGE_CONFIRMATION_REQUIRED',
      details: { redirectTo: 'https://example.com' },
    })).toBe('/settings/security?section=age-confirmation')
  })
})
