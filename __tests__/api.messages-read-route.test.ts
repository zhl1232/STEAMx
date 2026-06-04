/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { POST } from '@/app/api/messages/threads/[userId]/read/route'
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

describe('POST /api/messages/threads/[userId]/read', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-04T06:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks only messages from the peer to the current user as read', async () => {
    const isNull = vi.fn().mockResolvedValue({ error: null })
    const receiverEq = vi.fn(() => ({ is: isNull }))
    const senderEq = vi.fn(() => ({ eq: receiverEq }))
    const update = vi.fn(() => ({ eq: senderEq }))
    const from = vi.fn(() => ({ update }))

    createClientMock.mockResolvedValue({ from } as never)
    requireAuthMock.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111' } as never)

    const response = await POST(new Request('http://localhost/api/messages/threads/22222222-2222-2222-2222-222222222222/read'), {
      params: Promise.resolve({ userId: '22222222-2222-2222-2222-222222222222' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ readAt: '2026-06-04T06:00:00.000Z' })
    expect(from).toHaveBeenCalledWith('messages')
    expect(update).toHaveBeenCalledWith({ read_at: '2026-06-04T06:00:00.000Z' })
    expect(senderEq).toHaveBeenCalledWith('sender_id', '22222222-2222-2222-2222-222222222222')
    expect(receiverEq).toHaveBeenCalledWith('receiver_id', '11111111-1111-1111-1111-111111111111')
    expect(isNull).toHaveBeenCalledWith('read_at', null)
  })
})
