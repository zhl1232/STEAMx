/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/follows/status/route'
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

describe('GET /api/follows/status', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns true when the authenticated user follows the target user', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: { follower_id: '11111111-1111-1111-1111-111111111111' },
            error: null,
        })
        const select = vi.fn(() => ({
            eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle,
                })),
            })),
        }))
        const from = vi.fn((table: string) => {
            if (table === 'follows') {
                return { select }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
        } as never)

        const response = await GET(
            new NextRequest('http://localhost/api/follows/status?targetUserId=22222222-2222-2222-2222-222222222222'),
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ isFollowing: true })
        expect(select).toHaveBeenCalledWith('follower_id')
    })
})
