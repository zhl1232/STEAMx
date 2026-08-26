/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { POST } from '@/app/api/admin/completions/[id]/review/route'
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

vi.mock('@/lib/safety/server', () => ({
    setContentModerationState: vi.fn().mockResolvedValue(undefined),
}))

describe('POST /api/admin/completions/[id]/review', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireRoleMock = requireRole as Mock<typeof requireRole>
    const callRpcMock = callRpc as Mock<typeof callRpc>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRoleMock.mockResolvedValue({
            user: { id: 'moderator-1' },
            role: 'moderator',
        } as never)
    })

    it('uses the atomic approval-and-reward RPC', async () => {
        const routeSupabase = {
            from: vi.fn((table: string) => {
                if (table === 'completed_projects') {
                    return { select: completionSelect }
                }
                throw new Error(`Unexpected table: ${table}`)
            }),
        }
        const completionMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 123 },
            error: null,
        })
        const completionSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                maybeSingle: completionMaybeSingle,
            }),
        })

        createClientMock.mockResolvedValue(routeSupabase as never)

        callRpcMock.mockImplementation(async (_client, fn) => {
            if (fn === 'approve_completion_with_reward') {
                return { data: { xp_awarded: true }, error: null }
            }
            throw new Error(`Unexpected RPC: ${String(fn)}`)
        })

        const response = await POST(new Request('http://localhost/api/admin/completions/123/review', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'approve' }),
        }) as never, {
            params: Promise.resolve({ id: '123' }),
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            message: 'Completion approved successfully',
            status: 'approved',
            xpAwarded: true,
        })
        expect(callRpcMock).toHaveBeenCalledWith(routeSupabase, 'approve_completion_with_reward', {
            p_completion_id: 123,
        })
    })

    it('returns 404 when reviewing a missing completion', async () => {
        const completionMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
        })
        const completionSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                maybeSingle: completionMaybeSingle,
            }),
        })

        createClientMock.mockResolvedValue({
            from: vi.fn((table: string) => {
                if (table === 'completed_projects') {
                    return { select: completionSelect }
                }
                throw new Error(`Unexpected table: ${table}`)
            }),
        } as never)

        const response = await POST(new Request('http://localhost/api/admin/completions/999/review', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'approve' }),
        }) as never, {
            params: Promise.resolve({ id: '999' }),
        })

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: 'Completion not found' })
        expect(callRpcMock).not.toHaveBeenCalled()
    })

    it('returns an idempotent approval when the reward already exists', async () => {
        const completionMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 123 },
            error: null,
        })
        const completionSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                maybeSingle: completionMaybeSingle,
            }),
        })

        const routeSupabase = {
            from: vi.fn((table: string) => {
                if (table === 'completed_projects') return { select: completionSelect }
                throw new Error(`Unexpected table: ${table}`)
            }),
        }
        createClientMock.mockResolvedValue(routeSupabase as never)
        callRpcMock.mockResolvedValue({ data: { xp_awarded: false }, error: null } as never)

        const response = await POST(new Request('http://localhost/api/admin/completions/123/review', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'approve' }),
        }) as never, {
            params: Promise.resolve({ id: '123' }),
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            status: 'approved',
            xpAwarded: false,
        })
        expect(callRpcMock).toHaveBeenCalledWith(routeSupabase, 'approve_completion_with_reward', {
            p_completion_id: 123,
        })
    })

    it('routes rejection through the rejection RPC without awarding XP', async () => {
        const completionMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 123 },
            error: null,
        })
        const completionSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                maybeSingle: completionMaybeSingle,
            }),
        })

        const routeSupabase = {
            from: vi.fn((table: string) => {
                if (table === 'completed_projects') return { select: completionSelect }
                throw new Error(`Unexpected table: ${table}`)
            }),
        }
        createClientMock.mockResolvedValue(routeSupabase as never)
        callRpcMock.mockResolvedValue({ data: null, error: null } as never)

        const response = await POST(new Request('http://localhost/api/admin/completions/123/review', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'reject', rejection_reason: '请补充作品说明' }),
        }) as never, {
            params: Promise.resolve({ id: '123' }),
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            message: 'Completion rejected',
            status: 'rejected',
        })
        expect(callRpcMock).toHaveBeenCalledWith(routeSupabase, 'reject_completion', {
            completion_id: 123,
            reason: '请补充作品说明',
        })
    })
})
