/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { GET, POST } from '@/app/api/completions/[id]/comments/route'
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

describe('completion comments visibility', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>
    const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRateLimitMock.mockResolvedValue(undefined)
    })

    it('returns 404 when reading comments for a private completion as another user', async () => {
        const completionMaybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 9,
                user_id: 'owner-1',
                is_public: false,
                status: 'approved',
            },
            error: null,
        })
        const from = vi.fn((table: string) => {
            if (table === 'completed_projects') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: completionMaybeSingle,
                        })),
                    })),
                }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({
            from,
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'viewer-1' } },
                }),
            },
        } as never)

        const response = await GET(new Request('http://localhost/api/completions/9/comments') as never, {
            params: Promise.resolve({ id: '9' }),
        })

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: '作品不存在' })
    })

    it('returns 404 when commenting on a private completion as another user', async () => {
        const completionMaybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 9,
                user_id: 'owner-1',
                is_public: false,
                status: 'approved',
            },
            error: null,
        })
        const from = vi.fn((table: string) => {
            if (table === 'completed_projects') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: completionMaybeSingle,
                        })),
                    })),
                }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'viewer-1' } as never)

        const response = await POST(new Request('http://localhost/api/completions/9/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '悄悄评论私有作品' }),
        }) as never, {
            params: Promise.resolve({ id: '9' }),
        })

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: '作品不存在' })
    })
})
