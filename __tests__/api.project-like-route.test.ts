/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { GET, POST } from '@/app/api/projects/[id]/like/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api/auth'
import { callRpc } from '@/lib/supabase/rpc'

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

vi.mock('@/lib/supabase/rpc', () => ({
    callRpc: vi.fn(),
}))

describe('POST /api/projects/[id]/like', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>
    const callRpcMock = callRpc as Mock<typeof callRpc>

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects liking your own project on the server', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: { author_id: 'user-1' },
            error: null,
        })
        const eq = vi.fn().mockReturnValue({ maybeSingle })
        const select = vi.fn().mockReturnValue({ eq })
        const from = vi.fn().mockReturnValue({ select })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await POST(new Request('http://localhost/api/projects/123/like'), {
            params: Promise.resolve({ id: '123' }),
        })

        expect(from).toHaveBeenCalledWith('projects')
        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({ error: '不能给自己的项目点赞' })
        expect(callRpcMock).not.toHaveBeenCalled()
    })

    it('returns 404 when the project does not exist', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
        })
        const eq = vi.fn().mockReturnValue({ maybeSingle })
        const select = vi.fn().mockReturnValue({ eq })
        const from = vi.fn().mockReturnValue({ select })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-2' } as never)

        const response = await POST(new Request('http://localhost/api/projects/999/like'), {
            params: Promise.resolve({ id: '999' }),
        })

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: 'Project not found' })
        expect(callRpcMock).not.toHaveBeenCalled()
    })

    it('treats an existing like row as liked using the composite-key table shape', async () => {
        const likeMaybeSingle = vi.fn().mockResolvedValue({
            data: { user_id: 'user-2' },
            error: null,
        })
        const likesSelect = vi.fn(() => ({
            eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: likeMaybeSingle,
                })),
            })),
        }))
        const authGetUser = vi.fn().mockResolvedValue({
            data: { user: { id: 'user-2' } },
        })
        const from = vi.fn((table: string) => {
            if (table === 'likes') {
                return { select: likesSelect }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from, auth: { getUser: authGetUser } } as never)

        const response = await GET(new Request('http://localhost/api/projects/123/like'), {
            params: Promise.resolve({ id: '123' }),
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ liked: true })
        expect(likesSelect).toHaveBeenCalledWith('user_id')
    })
})
