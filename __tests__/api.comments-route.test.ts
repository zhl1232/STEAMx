/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { POST } from '@/app/api/comments/route'
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

describe('POST /api/comments', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects commenting on a non-approved project for non-authors', async () => {
        const projectMaybeSingle = vi.fn().mockResolvedValue({
            data: { author_id: 'owner-1', status: 'pending' },
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
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-2' } as never)

        const response = await POST(new Request('http://localhost/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: 12,
                content: '偷偷评论未过审项目',
            }),
        }) as never)

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: '项目不存在' })
    })

    it('requires社区互动确认 before posting any comment', async () => {
        const projectMaybeSingle = vi.fn().mockResolvedValue({
            data: { author_id: 'owner-1', status: 'approved' },
            error: null,
        })
        const profileMaybeSingle = vi.fn().mockResolvedValue({
            data: { age_confirmed_at: null, interaction_restricted: false },
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
        requireAuthMock.mockResolvedValue({ id: 'user-2' } as never)

        const response = await POST(new Request('http://localhost/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: 12,
                content: '一条评论',
            }),
        }) as never)

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toMatchObject({
            error: '完成社区互动确认后即可继续此操作',
            code: 'AGE_CONFIRMATION_REQUIRED',
        })
    })
})
