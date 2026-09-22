/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/notifications/route'
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

function makeNotificationBuilder(result: unknown) {
    const builder: Record<string, any> = {}
    for (const method of ['eq', 'order', 'or', 'lt', 'in']) builder[method] = vi.fn(() => builder)
    builder.limit = vi.fn(() => builder)
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
    return builder
}

describe('GET /api/notifications', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>
    const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRateLimitMock.mockResolvedValue(undefined)
    })

    it('rejects an invalid before cursor with 400 before querying notifications', async () => {
        const from = vi.fn()
        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await GET(
            new NextRequest('http://localhost/api/notifications?before=bad-cursor'),
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: 'before must be a valid datetime' })
        expect(requireRateLimitMock).toHaveBeenCalled()
        expect(from).not.toHaveBeenCalled()
    })

    it('applies the optional limit parameter up to the page-size cap', async () => {
        const builder = makeNotificationBuilder({ data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }], error: null })
        const limit = builder.limit
        const eq = builder.eq
        const select = vi.fn(() => builder)
        const from = vi.fn(() => ({ select }))

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await GET(
            new NextRequest('http://localhost/api/notifications?limit=5'),
        )

        expect(response.status).toBe(200)
        expect(limit).toHaveBeenCalledWith(5)
        await expect(response.json()).resolves.toEqual({
            notifications: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
            hasMore: true,
            nextCursor: null,
        })
    })

    it('rejects an invalid beforeId cursor without querying notifications', async () => {
        const from = vi.fn()
        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await GET(
            new NextRequest('http://localhost/api/notifications?before=2026-09-21T08:00:00.000Z&beforeId=forged'),
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: 'Invalid beforeId' })
        expect(from).not.toHaveBeenCalled()
    })

    it('uses the timestamp and id together for a stable cursor page', async () => {
        const page = [{ id: 17, created_at: '2026-09-20T08:00:00.000Z' }]
        const builder = makeNotificationBuilder({ data: page, error: null })
        const or = builder.or
        const limit = builder.limit
        const eq = builder.eq
        const select = vi.fn(() => builder)
        const from = vi.fn(() => ({ select }))

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await GET(
            new NextRequest('http://localhost/api/notifications?before=2026-09-21T08:00:00.000Z&beforeId=18&limit=1'),
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            notifications: page,
            hasMore: true,
            nextCursor: '2026-09-20T08:00:00.000Z',
        })
        expect(or).toHaveBeenCalledWith('created_at.lt.2026-09-21T08:00:00.000Z,and(created_at.eq.2026-09-21T08:00:00.000Z,id.lt.18)')
    })

    it('caps large limit values at 20', async () => {
        const builder = makeNotificationBuilder({ data: [], error: null })
        const limit = builder.limit
        const eq = builder.eq
        const select = vi.fn(() => builder)
        const from = vi.fn(() => ({ select }))

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await GET(
            new NextRequest('http://localhost/api/notifications?limit=200'),
        )

        expect(response.status).toBe(200)
        expect(limit).toHaveBeenCalledWith(20)
    })
})

describe('POST /api/notifications', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>
    const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRateLimitMock.mockResolvedValue(undefined)
    })

    it('rejects creator_update notifications when the recipient opted out', async () => {
        const projectMaybeSingle = vi.fn().mockResolvedValue({
            data: { author_id: '11111111-1111-1111-1111-111111111111', status: 'approved' },
            error: null,
        })
        const followMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 99 },
            error: null,
        })
        const profileMaybeSingle = vi.fn().mockResolvedValue({
            data: { notify_followed_creator_updates: false },
            error: null,
        })

        const from = vi.fn((table: string) => {
            if (table === 'projects') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: projectMaybeSingle,
                        })),
                    })),
                }
            }

            if (table === 'follows') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                maybeSingle: followMaybeSingle,
                            })),
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

            if (table === 'notifications') {
                return {
                    insert: vi.fn(() => {
                        throw new Error('Notifications insert should not be reached')
                    }),
                }
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
        requireAuthMock.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            email: 'author@example.com',
            user_metadata: {},
        } as never)

        const response = await POST(new Request('http://localhost/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: '22222222-2222-2222-2222-222222222222',
                type: 'creator_update',
                content: '创作者发布了新作品',
                related_type: 'project',
                project_id: 123,
            }),
        }) as never)

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({ error: 'Invalid creator update payload' })
    })

    it('rejects creator_update notifications for non-approved projects', async () => {
        const projectMaybeSingle = vi.fn().mockResolvedValue({
            data: { author_id: '11111111-1111-1111-1111-111111111111', status: 'pending' },
            error: null,
        })
        const followMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 99 },
            error: null,
        })
        const profileMaybeSingle = vi.fn().mockResolvedValue({
            data: { notify_followed_creator_updates: true },
            error: null,
        })

        const from = vi.fn((table: string) => {
            if (table === 'projects') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: projectMaybeSingle,
                        })),
                    })),
                }
            }

            if (table === 'follows') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                maybeSingle: followMaybeSingle,
                            })),
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

            if (table === 'notifications') {
                return {
                    insert: vi.fn(() => {
                        throw new Error('Notifications insert should not be reached')
                    }),
                }
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
        requireAuthMock.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            email: 'author@example.com',
            user_metadata: {},
        } as never)

        const response = await POST(new Request('http://localhost/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: '22222222-2222-2222-2222-222222222222',
                type: 'creator_update',
                content: '创作者发布了新作品',
                related_type: 'project',
                project_id: 123,
            }),
        }) as never)

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({ error: 'Invalid creator update payload' })
    })

    it('rejects non-system self notifications before touching domain tables', async () => {
        const from = vi.fn()
        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            email: 'self@example.com',
            user_metadata: {},
        } as never)

        const response = await POST(new Request('http://localhost/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: '11111111-1111-1111-1111-111111111111',
                type: 'mention',
                content: '自己提醒自己',
                related_type: 'comment',
                related_id: 12,
            }),
        }) as never)

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: 'Cannot create notifications for yourself' })
        expect(from).not.toHaveBeenCalled()
    })

    it('rejects forged communication fields before touching domain tables', async () => {
        const from = vi.fn()
        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            email: 'self@example.com',
            user_metadata: {},
        } as never)

        const response = await POST(new Request('http://localhost/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: '22222222-2222-2222-2222-222222222222',
                type: 'system',
                content: '伪造系统消息',
                system_kind: 'announcement',
                announcement_id: 999,
            }),
        }) as never)

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({ error: 'Communication notifications are server-created' })
        expect(from).not.toHaveBeenCalled()
    })
})
