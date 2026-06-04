/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { GET } from '@/app/api/messages/unread-count/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api/auth'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/auth')>()
  return {
    ...actual,
    requireAuth: vi.fn(),
  }
})

describe('GET /api/messages/unread-count', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts unread messages received by the current user', async () => {
    const isNull = vi.fn().mockResolvedValue({ count: 3, error: null })
    const eq = vi.fn(() => ({ is: isNull }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))

    createClientMock.mockResolvedValue({ from } as never)
    requireAuthMock.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111' } as never)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ count: 3 })
    expect(from).toHaveBeenCalledWith('messages')
    expect(select).toHaveBeenCalledWith('*', { count: 'exact', head: true })
    expect(eq).toHaveBeenCalledWith('receiver_id', '11111111-1111-1111-1111-111111111111')
    expect(isNull).toHaveBeenCalledWith('read_at', null)
  })
})
