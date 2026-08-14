/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { POST } from '@/app/api/messages/send/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'

const SENDER_ID = '11111111-1111-1111-1111-111111111111'
const RECEIVER_ID = '22222222-2222-2222-2222-222222222222'

const { supabaseAdminFrom } = vi.hoisted(() => ({
    supabaseAdminFrom: vi.fn(),
}))

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

vi.mock('@/lib/supabase/admin', () => ({
    supabaseAdmin: { from: supabaseAdminFrom },
}))

vi.mock('@/lib/api/validation', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api/validation')>()
    return {
        ...actual,
        validateContentSafe: vi.fn((value: string) => value),
    }
})

type FollowRow = { follower_id: string; following_id: string }

/**
 * 路由对 messages 表发两个查询：对方回过没有（取一行）、我发了几条（head count）。
 * 用过滤条件里的 sender_id 区分是哪一个。
 */
function messagesTable({
    hasReply,
    sentCount,
    insert,
}: {
    hasReply: boolean
    sentCount: number
    insert: unknown
}) {
    const build = (filters: Record<string, string>, head: boolean) => {
        const resolve = () => {
            const asksAboutReceiver = filters.sender_id === RECEIVER_ID
            if (head) return { data: null, count: asksAboutReceiver ? 0 : sentCount, error: null }
            return { data: asksAboutReceiver && hasReply ? [{ id: 1 }] : [], error: null }
        }
        const builder = {
            eq: (column: string, value: string) => build({ ...filters, [column]: value }, head),
            limit: () => builder,
            then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
        }
        return builder
    }

    return {
        select: (_columns: string, options?: { head?: boolean }) => build({}, Boolean(options?.head)),
        insert,
    }
}

function mockSupabase({
    privacy,
    follows,
    hasReply = false,
    sentCount = 0,
}: {
    privacy: string
    follows: FollowRow[]
    hasReply?: boolean
    sentCount?: number
}) {
    const messageSingle = vi.fn().mockResolvedValue({
        data: {
            id: 7,
            sender_id: SENDER_ID,
            receiver_id: RECEIVER_ID,
            content: '你好',
            moderation_state: 'approved',
            read_at: null,
            created_at: '2026-03-20T00:00:00.000Z',
        },
        error: null,
    })
    const messageInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: messageSingle })) }))

    const from = vi.fn((table: string) => {
        if (table === 'profiles') {
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({
                            data: { message_privacy: privacy, age_confirmed_at: null, interaction_restricted: false },
                            error: null,
                        }),
                    })),
                })),
            }
        }
        if (table === 'follows') {
            return {
                select: vi.fn(() => ({
                    or: vi.fn().mockResolvedValue({ data: follows, error: null }),
                })),
            }
        }
        if (table === 'messages') {
            return messagesTable({ hasReply, sentCount, insert: messageInsert })
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

    supabaseAdminFrom.mockImplementation((table: string) => {
        if (table === 'messages') return { insert: messageInsert }
        throw new Error(`Unexpected admin table: ${table}`)
    })

    return { from, messageInsert }
}

function sendMessage(content = '你好') {
    return POST(new Request('http://localhost/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: RECEIVER_ID, content }),
    }) as never)
}

describe('POST /api/messages/send', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>
    const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRateLimitMock.mockResolvedValue(undefined)
        supabaseAdminFrom.mockReset()
        requireAuthMock.mockResolvedValue({ id: SENDER_ID } as never)
    })

    it('lets a stranger send one opening message', async () => {
        const { from } = mockSupabase({ privacy: 'everyone', follows: [] })
        createClientMock.mockResolvedValue({ from } as never)

        const response = await sendMessage()

        expect(response.status).toBe(200)
    })

    it('blocks a stranger second message before the receiver replies', async () => {
        const { from } = mockSupabase({ privacy: 'everyone', follows: [], sentCount: 1 })
        createClientMock.mockResolvedValue({ from } as never)

        const response = await sendMessage()

        expect(response.status).toBe(429)
        await expect(response.json()).resolves.toMatchObject({
            error: expect.stringContaining('只能发 1 条'),
        })
    })

    it('gives mutual followers three messages before a reply', async () => {
        const { from } = mockSupabase({
            privacy: 'everyone',
            follows: [
                { follower_id: SENDER_ID, following_id: RECEIVER_ID },
                { follower_id: RECEIVER_ID, following_id: SENDER_ID },
            ],
            sentCount: 2,
        })
        createClientMock.mockResolvedValue({ from } as never)

        const response = await sendMessage()

        expect(response.status).toBe(200)
    })

    it('lifts the quota once the receiver has replied, however long the history is', async () => {
        const { from } = mockSupabase({
            privacy: 'everyone',
            follows: [],
            hasReply: true,
            sentCount: 40,
        })
        createClientMock.mockResolvedValue({ from } as never)

        const response = await sendMessage()

        expect(response.status).toBe(200)
    })

    it('rejects contact info from strangers', async () => {
        const { from } = mockSupabase({ privacy: 'everyone', follows: [] })
        createClientMock.mockResolvedValue({ from } as never)

        const response = await sendMessage('加我 https://example.com')

        expect(response.status).toBe(400)
    })

    it('treats followers_only as mutual follow, not one-way follow', async () => {
        const { from } = mockSupabase({
            privacy: 'followers_only',
            follows: [{ follower_id: SENDER_ID, following_id: RECEIVER_ID }],
        })
        createClientMock.mockResolvedValue({ from } as never)

        const response = await sendMessage()

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toMatchObject({
            error: expect.stringContaining('互相关注'),
        })
    })

    it('does not let an incoming-only follow unlock followers_only either', async () => {
        const { from } = mockSupabase({
            privacy: 'followers_only',
            follows: [{ follower_id: RECEIVER_ID, following_id: SENDER_ID }],
        })
        createClientMock.mockResolvedValue({ from } as never)

        const response = await sendMessage()

        expect(response.status).toBe(403)
    })

    it('keeps replying possible when followers_only is set after the receiver replied', async () => {
        const { from } = mockSupabase({ privacy: 'followers_only', follows: [], hasReply: true, sentCount: 5 })
        createClientMock.mockResolvedValue({ from } as never)

        const response = await sendMessage()

        expect(response.status).toBe(200)
    })

    it('allows followers_only when both sides follow each other', async () => {
        const { from } = mockSupabase({
            privacy: 'followers_only',
            follows: [
                { follower_id: SENDER_ID, following_id: RECEIVER_ID },
                { follower_id: RECEIVER_ID, following_id: SENDER_ID },
            ],
        })
        createClientMock.mockResolvedValue({ from } as never)

        const response = await sendMessage()

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            message: {
                id: 7,
                sender_id: SENDER_ID,
                receiver_id: RECEIVER_ID,
                content: '你好',
                moderation_state: 'approved',
                read_at: null,
                created_at: '2026-03-20T00:00:00.000Z',
            },
            moderation: { state: 'approved' },
        })
    })

    it('rejects when the receiver has messaging turned off', async () => {
        const { from } = mockSupabase({ privacy: 'nobody', follows: [] })
        createClientMock.mockResolvedValue({ from } as never)

        const response = await sendMessage()

        expect(response.status).toBe(403)
    })
})
