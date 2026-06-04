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

    it('creates a notification for the project author when a new like is inserted', async () => {
        const projectMaybeSingle = vi.fn().mockResolvedValue({
            data: { author_id: 'author-1', title: '纸火箭' },
            error: null,
        })
        const projectsSelect = vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: projectMaybeSingle })),
        }))

        const existingLikeMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
        })
        const likesSelect = vi.fn(() => ({
            eq: vi.fn(() => ({
                eq: vi.fn(() => ({ maybeSingle: existingLikeMaybeSingle })),
            })),
        }))
        const likesInsertSelect = vi.fn().mockResolvedValue({
            data: [{ user_id: 'user-2' }],
            error: null,
        })
        const likesInsert = vi.fn(() => ({ select: likesInsertSelect }))

        const profileMaybeSingle = vi.fn().mockResolvedValue({
            data: { display_name: '小明', avatar_url: null },
            error: null,
        })
        const profilesSelect = vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: profileMaybeSingle })),
        }))

        const notificationsInsert = vi.fn().mockResolvedValue({ error: null })

        const from = vi.fn((table: string) => {
            if (table === 'projects') return { select: projectsSelect }
            if (table === 'likes') return { select: likesSelect, insert: likesInsert }
            if (table === 'profiles') return { select: profilesSelect }
            if (table === 'notifications') return { insert: notificationsInsert }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({
            id: 'user-2',
            email: 'liker@example.com',
        } as never)
        callRpcMock.mockResolvedValue({ error: null } as never)

        const response = await POST(new Request('http://localhost/api/projects/123/like'), {
            params: Promise.resolve({ id: '123' }),
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ liked: true, action: 'liked' })
        expect(projectsSelect).toHaveBeenCalledWith('author_id, title')
        expect(likesInsert).toHaveBeenCalledWith({ user_id: 'user-2', project_id: 123 })
        expect(callRpcMock).toHaveBeenCalledWith(expect.anything(), 'increment_project_likes', {
            project_id: 123,
        })
        expect(notificationsInsert).toHaveBeenCalledWith(expect.objectContaining({
            user_id: 'author-1',
            type: 'like',
            content: '小明 赞了你的项目「纸火箭」',
            related_type: 'project',
            related_id: 123,
            project_id: 123,
            from_user_id: 'user-2',
            from_username: '小明',
        }))
        const notificationPayload = notificationsInsert.mock.calls[0]?.[0] as { from_avatar?: string }
        expect(notificationPayload.from_avatar).toMatch(/^\/avatars\/default-/)
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
