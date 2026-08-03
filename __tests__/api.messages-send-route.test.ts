/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { POST } from '@/app/api/messages/send/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'

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

vi.mock('@/lib/api/rate-limit', () => ({
    requireRateLimit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/api/validation', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api/validation')>()
    return {
        ...actual,
        validateContentSafe: vi.fn((value: string) => value),
    }
})

describe('POST /api/messages/send', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>
    const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRateLimitMock.mockResolvedValue(undefined)
    })

    it('allows sending to followers_only users when a follow relationship exists', async () => {
        const profileSingle = vi.fn().mockResolvedValue({
            data: { message_privacy: 'followers_only', age_confirmed_at: '2026-03-20T00:00:00.000Z', interaction_restricted: false },
            error: null,
        })
        const followMaybeSingle = vi.fn().mockResolvedValue({
            data: { follower_id: '11111111-1111-1111-1111-111111111111' },
            error: null,
        })
        const messageSingle = vi.fn().mockResolvedValue({
            data: {
                id: 7,
                sender_id: '11111111-1111-1111-1111-111111111111',
                receiver_id: '22222222-2222-2222-2222-222222222222',
                content: '你好',
                read_at: null,
                created_at: '2026-03-20T00:00:00.000Z',
            },
            error: null,
        })
        const messageSelect = vi.fn(() => ({ single: messageSingle }))
        const messageInsert = vi.fn(() => ({ select: messageSelect }))
        const followSelect = vi.fn(() => ({
            eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: followMaybeSingle,
                })),
            })),
        }))
        const profileSelect = vi.fn(() => ({
            eq: vi.fn(() => ({
                single: profileSingle,
            })),
        }))

        const from = vi.fn((table: string) => {
            if (table === 'profiles') {
                return { select: profileSelect }
            }
            if (table === 'follows') {
                return { select: followSelect }
            }
            if (table === 'messages') {
                return { insert: messageInsert }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
        } as never)

        const response = await POST(new Request('http://localhost/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receiverId: '22222222-2222-2222-2222-222222222222',
                content: '你好',
            }),
        }) as never)

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            message: {
                id: 7,
                sender_id: '11111111-1111-1111-1111-111111111111',
                receiver_id: '22222222-2222-2222-2222-222222222222',
                content: '你好',
                read_at: null,
                created_at: '2026-03-20T00:00:00.000Z',
            },
        })
        expect(followSelect).toHaveBeenCalledWith('follower_id')
    })
})
