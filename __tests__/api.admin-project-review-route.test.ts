/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { POST } from '@/app/api/admin/projects/[id]/review/route'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/api/auth'
import { callRpc } from '@/lib/supabase/rpc'

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}))

vi.mock('@/lib/api/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api/auth')>()
    return {
        ...actual,
        requireRole: vi.fn(),
    }
})

vi.mock('@/lib/supabase/rpc', () => ({
    callRpc: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}))

describe('POST /api/admin/projects/[id]/review', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireRoleMock = requireRole as Mock<typeof requireRole>
    const callRpcMock = callRpc as Mock<typeof callRpc>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRoleMock.mockResolvedValue(undefined as never)
    })

    it('returns 404 when the project does not exist', async () => {
        const projectMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
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

        const response = await POST(new Request('http://localhost/api/admin/projects/404/review', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'approve' }),
        }) as never, {
            params: Promise.resolve({ id: '404' }),
        })

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: 'Project not found' })
        expect(callRpcMock).not.toHaveBeenCalled()
    })

    it('sends creator update notifications to opted-in followers when approving a pending project', async () => {
        const projectMaybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 42,
                author_id: '11111111-1111-1111-1111-111111111111',
                challenge_id: null,
                title: '新的火箭车',
                status: 'pending',
            },
            error: null,
        })
        const followsEq = vi.fn().mockResolvedValue({
            data: [
                { follower_id: '22222222-2222-2222-2222-222222222222' },
                { follower_id: '33333333-3333-3333-3333-333333333333' },
            ],
            error: null,
        })
        const authorMaybeSingle = vi.fn().mockResolvedValue({
            data: { display_name: '创作者A', avatar_url: 'https://example.com/a.png' },
            error: null,
        })
        const prefsOr = vi.fn().mockResolvedValue({
            data: [{ id: '22222222-2222-2222-2222-222222222222' }],
            error: null,
        })
        const notificationsInsert = vi.fn().mockResolvedValue({
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
                        eq: followsEq,
                    })),
                }
            }

            if (table === 'profiles') {
                return {
                    select: vi.fn((fields: string) => {
                        if (fields === 'display_name, avatar_url') {
                            return {
                                eq: vi.fn(() => ({
                                    maybeSingle: authorMaybeSingle,
                                })),
                            }
                        }

                        if (fields === 'id') {
                            return {
                                in: vi.fn(() => ({
                                    or: prefsOr,
                                })),
                            }
                        }

                        throw new Error(`Unexpected profile select: ${fields}`)
                    }),
                }
            }

            if (table === 'notifications') {
                return {
                    insert: notificationsInsert,
                }
            }

            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from, rpc: vi.fn() } as never)
        callRpcMock.mockResolvedValue({ data: null, error: null })

        const response = await POST(new Request('http://localhost/api/admin/projects/42/review', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'approve' }),
        }) as never, {
            params: Promise.resolve({ id: '42' }),
        })

        expect(response.status).toBe(200)
        expect(callRpcMock).toHaveBeenCalledWith(expect.anything(), 'approve_project', { project_id: 42 })
        expect(notificationsInsert).toHaveBeenCalledWith([
            expect.objectContaining({
                user_id: '22222222-2222-2222-2222-222222222222',
                type: 'creator_update',
                related_type: 'project',
                project_id: 42,
                from_user_id: '11111111-1111-1111-1111-111111111111',
                from_username: '创作者A',
            }),
        ])
    })
})
