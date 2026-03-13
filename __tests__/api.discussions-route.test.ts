/** @jest-environment node */

import { AuthError } from '@/lib/api/auth'
import { DELETE } from '@/app/api/discussions/[id]/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api/auth'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/api/auth', () => {
  const actual = jest.requireActual('@/lib/api/auth')
  return {
    ...actual,
    requireAuth: jest.fn(),
  }
})

jest.mock('@/lib/api/rate-limit', () => ({
  requireRateLimit: jest.fn().mockResolvedValue(undefined),
}))

describe('DELETE /api/discussions/[id]', () => {
  const createClientMock = createClient as jest.MockedFunction<typeof createClient>
  const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deletes from discussions instead of discussion_replies', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null })
    const del = jest.fn(() => ({ eq }))
    const from = jest.fn(() => ({ delete: del }))

    createClientMock.mockResolvedValue({ from } as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

    const response = await DELETE(new Request('http://localhost/api/discussions/123') as never, {
      params: Promise.resolve({ id: '123' }),
    })

    expect(from).toHaveBeenCalledWith('discussions')
    expect(from).not.toHaveBeenCalledWith('discussion_replies')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Discussion deleted successfully' })
  })

  it('returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({} as never)
    requireAuthMock.mockRejectedValue(new AuthError('Unauthorized'))

    const response = await DELETE(new Request('http://localhost/api/discussions/123') as never, {
      params: Promise.resolve({ id: '123' }),
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns 403 when RLS blocks deletion', async () => {
    const eq = jest.fn().mockResolvedValue({ error: { code: 'PGRST301', message: 'permission denied' } })
    const del = jest.fn(() => ({ eq }))
    const from = jest.fn(() => ({ delete: del }))

    createClientMock.mockResolvedValue({ from } as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

    const response = await DELETE(new Request('http://localhost/api/discussions/123') as never, {
      params: Promise.resolve({ id: '123' }),
    })

    expect(from).toHaveBeenCalledWith('discussions')
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'You do not have permission to delete this discussion',
    })
  })
})
