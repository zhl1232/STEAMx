/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { GET } from '@/app/auth/callback/route'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('GET /auth/callback', () => {
  const createClientMock = createClient as Mock<typeof createClient>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects back to login when session exchange fails', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          error: { message: 'exchange failed' },
        }),
      },
    } as never)

    const response = await GET(
      new Request('http://localhost/auth/callback?code=test-code&next=%2Fsettings%2Fsecurity')
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/login?next=%2Fsettings%2Fsecurity&authError=auth_callback_failed'
    )
  })

  it('sanitizes provider callback errors through the login page', async () => {
    const response = await GET(
      new Request('http://localhost/auth/callback?error=access_denied&next=%2F%2Fevil.com')
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/login?authError=auth_callback_failed'
    )
  })
})
