/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { DELETE, GET, POST } from '@/app/api/completions/[id]/likes/route'
import { requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'

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

describe('GET /api/completions/[id]/likes', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>
    const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRateLimitMock.mockResolvedValue(undefined)
    })

    it('uses the composite-key table shape when checking whether the current user liked a completion', async () => {
        const completionMaybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 12,
                user_id: 'owner-1',
                is_public: true,
                status: 'approved',
            },
            error: null,
        })
        const countEq = vi.fn().mockResolvedValue({
            count: 3,
            error: null,
        })
        const countSelect = vi.fn(() => ({
            eq: countEq,
        }))
        const likeMaybeSingle = vi.fn().mockResolvedValue({
            data: { user_id: '11111111-1111-1111-1111-111111111111' },
            error: null,
        })
        const likeSelect = vi.fn(() => ({
            eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: likeMaybeSingle,
                })),
            })),
        }))
        let completionLikesSelectCalls = 0
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
            if (table === 'completion_likes') {
                completionLikesSelectCalls += 1
                return {
                    select: completionLikesSelectCalls === 1 ? countSelect : likeSelect,
                }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({
            from,
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: '11111111-1111-1111-1111-111111111111' } },
                }),
            },
        } as never)

        const response = await GET(new Request('http://localhost/api/completions/12/likes') as never, {
            params: Promise.resolve({ id: '12' }),
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            count: 3,
            isLiked: true,
        })
        expect(likeSelect).toHaveBeenCalledWith('user_id')
    })

    it('returns 404 for non-owners requesting likes on a private completion', async () => {
        const completionMaybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 12,
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

        const response = await GET(new Request('http://localhost/api/completions/12/likes') as never, {
            params: Promise.resolve({ id: '12' }),
        })

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: '作品不存在' })
    })

    it('rejects non-integer completion ids before reading data', async () => {
        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: null },
                }),
            },
            from: vi.fn(),
        } as never)

        const response = await GET(new Request('http://localhost/api/completions/12.5/likes') as never, {
            params: Promise.resolve({ id: '12.5' }),
        })

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: 'Invalid completion id' })
    })
})

describe('POST /api/completions/[id]/likes', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>
    const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRateLimitMock.mockResolvedValue(undefined)
    })

    it('rejects malformed completion ids before auth and rate limiting', async () => {
        createClientMock.mockResolvedValue({} as never)

        const response = await POST(new Request('http://localhost/api/completions/9.2/likes', {
            method: 'POST',
        }) as never, {
            params: Promise.resolve({ id: '9.2' }),
        })

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: 'Invalid completion id' })
        expect(requireAuthMock).not.toHaveBeenCalled()
        expect(requireRateLimitMock).not.toHaveBeenCalled()
    })
})

describe('DELETE /api/completions/[id]/likes', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects malformed completion ids before auth', async () => {
        createClientMock.mockResolvedValue({} as never)

        const response = await DELETE(new Request('http://localhost/api/completions/-1/likes', {
            method: 'DELETE',
        }) as never, {
            params: Promise.resolve({ id: '-1' }),
        })

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: 'Invalid completion id' })
        expect(requireAuthMock).not.toHaveBeenCalled()
    })
})
