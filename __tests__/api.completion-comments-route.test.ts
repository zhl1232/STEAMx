/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { GET, POST } from '@/app/api/completions/[id]/comments/route'
import { createClient } from '@/lib/supabase/server'
import { PermissionError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { assertUsersNotBlocked } from '@/lib/safety/server'

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

vi.mock('@/lib/safety/server', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/safety/server')>()
    return {
        ...actual,
        assertUsersNotBlocked: vi.fn(),
    }
})

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
    const assertUsersNotBlockedMock = assertUsersNotBlocked as Mock<typeof assertUsersNotBlocked>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRateLimitMock.mockResolvedValue(undefined)
        assertUsersNotBlockedMock.mockResolvedValue(undefined)
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

    it('rejects commenting on a work when either user has blocked the other', async () => {
        const completionMaybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 9,
                user_id: 'owner-1',
                project_id: 3,
                course_lesson_id: null,
                is_public: true,
                status: 'approved',
                moderation_state: 'approved',
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
        assertUsersNotBlockedMock.mockRejectedValue(
            new PermissionError('你已屏蔽该用户，或对方已屏蔽你', 'USER_BLOCKED'),
        )

        const response = await POST(new Request('http://localhost/api/completions/9/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '这个结构怎么做？' }),
        }) as never, {
            params: Promise.resolve({ id: '9' }),
        })

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toMatchObject({ code: 'USER_BLOCKED' })
        expect(assertUsersNotBlockedMock).toHaveBeenCalledWith(
            expect.anything(),
            'viewer-1',
            'owner-1',
        )
    })
})

describe('completion comment cursor reads', () => {
    function setup(rows: Array<Record<string, unknown>>) {
        const query = {
            select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }
        const from = vi.fn((table: string) => table === 'completion_comments' ? query : {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
                id: 9, user_id: 'owner-1', project_id: 3, course_lesson_id: null,
                is_public: true, status: 'approved', moderation_state: 'approved',
            }, error: null }) }) }),
        })
        vi.mocked(createClient).mockResolvedValue({ from, auth: {
            getUser: async () => ({ data: { user: null } }),
        } } as never)
        return query
    }
    const row = (id: number, parent_id: number | null = null) => ({
        id, parent_id, content: `comment ${id}`, author_id: 'author',
        created_at: '2026-10-01T10:00:00Z', profiles: { display_name: '作者' },
    })
    const read = async (query: string) => {
        const { NextRequest } = await import('next/server')
        return GET(new NextRequest(`http://localhost/api/completions/9/comments?${query}`), {
            params: Promise.resolve({ id: '9' }),
        })
    }

    it('returns a bounded ID-ordered page with a lookahead cursor', async () => {
        const query = setup([row(1), row(2, 1), row(3, 2)])
        const response = await read('pagination=cursor&limit=2')
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ comments: [{ id: 1 }, { id: 2, parent_id: 1 }], nextCursor: 2 })
        expect(query.order).toHaveBeenCalledWith('id', { ascending: true })
        expect(query.limit).toHaveBeenCalledWith(3)
        expect(query.gt).not.toHaveBeenCalled()
    })

    it('continues after the cursor without dropping reply metadata and ends explicitly', async () => {
        const query = setup([row(3, 2)])
        const response = await read('pagination=cursor&limit=2&after=2')
        expect(await response.json()).toMatchObject({ comments: [{ id: 3, parent_id: 2 }], nextCursor: null })
        expect(query.gt).toHaveBeenCalledWith('id', 2)
        expect(query.eq).toHaveBeenCalledWith('completed_project_id', 9)
    })

    it.each(['0', '-1', '2junk', '1.5', '9007199254740992', ''])('rejects invalid cursor %s', async after => {
        const query = setup([])
        expect((await read(`pagination=cursor&after=${after}`)).status).toBe(400)
        expect(query.limit).not.toHaveBeenCalled()
    })

    it('keeps the legacy preview response and ordering unchanged', async () => {
        const query = setup([row(1)])
        const response = await read('limit=50')
        const body = await response.json()
        expect(body.comments).toHaveLength(1)
        expect(body).not.toHaveProperty('nextCursor')
        expect(query.limit).toHaveBeenCalledWith(50)
        expect(query.order).toHaveBeenCalledWith('created_at', { ascending: true })
    })
})
