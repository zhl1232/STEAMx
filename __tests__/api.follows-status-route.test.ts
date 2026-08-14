/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/follows/status/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api/auth'

const VIEWER_ID = '11111111-1111-1111-1111-111111111111'
const TARGET_ID = '22222222-2222-2222-2222-222222222222'

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
        requireAuthMock.mockResolvedValue({ id: VIEWER_ID } as never)
    })

    function mockFollows(rows: { follower_id: string; following_id: string }[]) {
        const or = vi.fn().mockResolvedValue({ data: rows, error: null })
        const select = vi.fn(() => ({ or }))
        const from = vi.fn((table: string) => {
            if (table === 'follows') return { select }
            throw new Error(`Unexpected table: ${table}`)
        })
        createClientMock.mockResolvedValue({ from } as never)
        return { select }
    }

    function requestStatus() {
        return GET(new NextRequest(`http://localhost/api/follows/status?targetUserId=${TARGET_ID}`))
    }

    it('reports a one-way follow without marking it mutual', async () => {
        const { select } = mockFollows([{ follower_id: VIEWER_ID, following_id: TARGET_ID }])

        const response = await requestStatus()

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            isFollowing: true,
            isFollowedBy: false,
            isMutual: false,
        })
        expect(select).toHaveBeenCalledWith('follower_id, following_id')
    })

    it('reports a mutual follow when both rows exist', async () => {
        mockFollows([
            { follower_id: VIEWER_ID, following_id: TARGET_ID },
            { follower_id: TARGET_ID, following_id: VIEWER_ID },
        ])

        await expect((await requestStatus()).json()).resolves.toEqual({
            isFollowing: true,
            isFollowedBy: true,
            isMutual: true,
        })
    })

    it('reports an incoming-only follow', async () => {
        mockFollows([{ follower_id: TARGET_ID, following_id: VIEWER_ID }])

        await expect((await requestStatus()).json()).resolves.toEqual({
            isFollowing: false,
            isFollowedBy: true,
            isMutual: false,
        })
    })

    it('reports no relationship', async () => {
        mockFollows([])

        await expect((await requestStatus()).json()).resolves.toEqual({
            isFollowing: false,
            isFollowedBy: false,
            isMutual: false,
        })
    })
})
