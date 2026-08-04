/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { POST } from '@/app/api/follows/route'
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

describe('POST /api/follows', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>
    const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRateLimitMock.mockResolvedValue(undefined)
    })

    it('returns 404 when the target user does not exist', async () => {
        const profileMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
        })
        const from = vi.fn((table: string) => {
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
        requireAuthMock.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111' } as never)

        const response = await POST(new Request('http://localhost/api/follows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetUserId: '22222222-2222-2222-2222-222222222222',
                action: 'follow',
            }),
        }) as never)

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: 'User not found' })
    })

    it('returns changed false when following an already-followed user', async () => {
        const profileMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: '22222222-2222-2222-2222-222222222222' },
            error: null,
        })
        const insert = vi.fn().mockResolvedValue({
            error: { code: '23505' },
        })
        const from = vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: profileMaybeSingle,
                        })),
                    })),
                }
            }
            if (table === 'follows') {
                return { insert }
            }
            if (table === 'user_blocks') {
                return {
                    select: vi.fn(() => ({
                        or: vi.fn(() => ({
                            limit: vi.fn(() => ({
                                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                            })),
                        })),
                    })),
                }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111' } as never)

        const response = await POST(new Request('http://localhost/api/follows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetUserId: '22222222-2222-2222-2222-222222222222',
                action: 'follow',
            }),
        }) as never)

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            ok: true,
            following: true,
            changed: false,
        })
    })
})
