/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { PATCH as patchComment } from '@/app/api/comments/[id]/route'
import { PATCH as patchReply } from '@/app/api/replies/[id]/route'
import { PATCH as patchDiscussion } from '@/app/api/discussions/[id]/route'
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

vi.mock('@/lib/api/validation', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api/validation')>()
    return {
        ...actual,
        validateContentSafe: vi.fn((value: string) => value),
    }
})

describe('edit routes return 404 for missing resources', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>

    beforeEach(() => {
        vi.clearAllMocks()
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
    })

    it('returns 404 when editing a missing comment', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
        })
        const from = vi.fn((table: string) => {
            if (table === 'comments') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle,
                        })),
                    })),
                }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)

        const response = await patchComment(new Request('http://localhost/api/comments/12', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '更新评论' }),
        }) as never, {
            params: Promise.resolve({ id: '12' }),
        })

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: 'Comment not found' })
    })

    it('returns 404 when editing a missing reply', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
        })
        const from = vi.fn((table: string) => {
            if (table === 'discussion_replies') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle,
                        })),
                    })),
                }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)

        const response = await patchReply(new Request('http://localhost/api/replies/15', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '更新回复' }),
        }) as never, {
            params: Promise.resolve({ id: '15' }),
        })

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: 'Reply not found' })
    })

    it('returns 404 when editing a missing discussion', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
        })
        const from = vi.fn((table: string) => {
            if (table === 'discussions') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle,
                        })),
                    })),
                }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)

        const response = await patchDiscussion(new Request('http://localhost/api/discussions/18', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: '更新标题', content: '更新内容' }),
        }) as never, {
            params: Promise.resolve({ id: '18' }),
        })

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: 'Discussion not found' })
    })
})
