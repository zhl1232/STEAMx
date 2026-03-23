/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { POST } from '@/app/api/replies/route'
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

describe('POST /api/replies', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 404 when discussion does not exist', async () => {
        const discussionMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
        })

        const from = vi.fn((table: string) => {
            if (table === 'discussions') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: discussionMaybeSingle,
                        })),
                    })),
                }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await POST(new Request('http://localhost/api/replies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                discussion_id: 99,
                content: '讨论不存在时的回复',
            }),
        }) as never)

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: '讨论不存在' })
    })

    it('rejects image replies for users below level 2', async () => {
        const discussionMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 15 },
            error: null,
        })
        const profileMaybeSingle = vi.fn().mockResolvedValue({
            data: { level: 1 },
            error: null,
        })

        const from = vi.fn((table: string) => {
            if (table === 'discussions') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: discussionMaybeSingle,
                        })),
                    })),
                }
            }
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: profileMaybeSingle,
                        })),
                    })),
                }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await POST(new Request('http://localhost/api/replies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                discussion_id: 15,
                content: '带图回复',
                image_url: 'https://example.com/storage/v1/object/public/comment-images/user-1/reply.png',
            }),
        }) as never)

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({ error: '等级达到 2 级后才可发送回复图片' })
    })
})
