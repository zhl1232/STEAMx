/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { GET } from '@/app/api/messages/conversations/route'
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

describe('GET /api/messages/conversations', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters out conversations whose peer profile no longer exists', async () => {
    const messageRange = vi.fn().mockResolvedValue({
      data: [
        {
          id: 10,
          sender_id: '11111111-1111-1111-1111-111111111111',
          receiver_id: '22222222-2222-2222-2222-222222222222',
          content: '最近消息',
          created_at: '2026-03-20T10:00:00.000Z',
        },
        {
          id: 9,
          sender_id: '33333333-3333-3333-3333-333333333333',
          receiver_id: '11111111-1111-1111-1111-111111111111',
          content: '缺 profile 的会话',
          created_at: '2026-03-20T09:00:00.000Z',
        },
      ],
      error: null,
    })
    const profileIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          display_name: 'Alice',
          avatar_url: null,
        },
      ],
      error: null,
    })

    const from = vi.fn((table: string) => {
      if (table === 'messages') {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() => ({
              order: vi.fn(() => ({
                range: messageRange,
              })),
            })),
          })),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: profileIn,
          })),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    createClientMock.mockResolvedValue({ from } as never)
    requireAuthMock.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
    } as never)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      conversations: [
        {
          peerId: '22222222-2222-2222-2222-222222222222',
          displayName: 'Alice',
          avatarUrl: null,
          lastContent: '最近消息',
          lastAt: '2026-03-20T10:00:00.000Z',
        },
      ],
    })
  })
})
