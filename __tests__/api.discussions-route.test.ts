/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { AuthError } from '@/lib/api/auth'
import { DELETE } from '@/app/api/discussions/[id]/route'
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

describe('DELETE /api/discussions/[id]', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deletes from discussions instead of discussion_replies', async () => {
        const selectChain = {
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 123 }, error: null }),
        }
        selectChain.eq.mockReturnValue(selectChain)

        const deleteChain = {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 123 }, error: null }),
        }
        deleteChain.eq.mockReturnValue(deleteChain)
        deleteChain.select.mockReturnValue(deleteChain)

        const from = vi.fn((table: string) => {
            if (table !== 'discussions') return {}
            return {
                select: vi.fn(() => ({ eq: selectChain.eq, maybeSingle: selectChain.maybeSingle })),
                delete: vi.fn(() => ({ eq: deleteChain.eq, select: deleteChain.select, maybeSingle: deleteChain.maybeSingle })),
            }
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await DELETE(new Request('http://localhost/api/discussions/123') as never, {
            params: Promise.resolve({ id: '123' }),
        })

        expect(from).toHaveBeenCalledWith('discussions')
        expect(from).not.toHaveBeenCalledWith('discussion_replies')
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ message: 'Discussion deleted successfully' })
    })

    it('returns 401 when unauthenticated', async () => {
        createClientMock.mockResolvedValue({} as never)
        requireAuthMock.mockRejectedValue(new AuthError('Unauthorized'))

        const response = await DELETE(new Request('http://localhost/api/discussions/123') as never, {
            params: Promise.resolve({ id: '123' }),
        })

        expect(response.status).toBe(401)
        await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    })

    it('returns 403 when RLS blocks deletion', async () => {
        const selectChain = {
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 123 }, error: null }),
        }
        selectChain.eq.mockReturnValue(selectChain)

        const deleteChain = {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST301', message: 'permission denied' },
            }),
        }
        deleteChain.eq.mockReturnValue(deleteChain)
        deleteChain.select.mockReturnValue(deleteChain)

        const from = vi.fn((table: string) => {
            if (table !== 'discussions') return {}
            return {
                select: vi.fn(() => ({ eq: selectChain.eq, maybeSingle: selectChain.maybeSingle })),
                delete: vi.fn(() => ({ eq: deleteChain.eq, select: deleteChain.select, maybeSingle: deleteChain.maybeSingle })),
            }
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await DELETE(new Request('http://localhost/api/discussions/123') as never, {
            params: Promise.resolve({ id: '123' }),
        })

        expect(from).toHaveBeenCalledWith('discussions')
        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({
            error: 'You do not have permission to delete this discussion',
        })
    })
})
