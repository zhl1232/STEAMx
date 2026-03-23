/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { POST } from '@/app/api/admin/completions/[id]/review/route'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/api/auth'
import { callRpc } from '@/lib/supabase/rpc'

const { supabaseAdminMock } = vi.hoisted(() => ({
    supabaseAdminMock: {
        from: vi.fn(),
    },
}))

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

vi.mock('@/lib/supabase/admin', () => ({
    supabaseAdmin: supabaseAdminMock,
}))

describe('POST /api/admin/completions/[id]/review', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireRoleMock = requireRole as Mock<typeof requireRole>
    const callRpcMock = callRpc as Mock<typeof callRpc>

    beforeEach(() => {
        vi.clearAllMocks()
        requireRoleMock.mockResolvedValue(undefined as never)
    })

    it('awards completion XP without writing unsupported columns to xp_logs', async () => {
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

        const completedProjectsSingle = vi.fn().mockResolvedValue({
            data: { user_id: 'user-1', project_id: 42 },
            error: null,
        })
        const completedProjectsEq = vi.fn().mockReturnValue({
            single: completedProjectsSingle,
        })
        const completedProjectsSelect = vi.fn().mockReturnValue({
            eq: completedProjectsEq,
        })

        const xpLogsSelect = vi.fn().mockResolvedValue({
            data: [{ id: 1 }],
            error: null,
        })
        const xpLogsUpsert = vi.fn().mockReturnValue({
            select: xpLogsSelect,
        })

        createClientMock.mockResolvedValue(routeSupabase as never)

        supabaseAdminMock.from.mockImplementation((table: string) => {
            if (table === 'completed_projects') {
                return { select: completedProjectsSelect }
            }
            if (table === 'xp_logs') {
                return { upsert: xpLogsUpsert }
            }
            throw new Error(`Unexpected table: ${table}`)
        })

        callRpcMock.mockImplementation(async (_client, fn) => {
            if (fn === 'approve_completion' || fn === 'increment_user_xp') {
                return { data: null, error: null }
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
        const [xpPayload, xpOptions] = xpLogsUpsert.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>]
        expect(xpPayload).toMatchObject({
            user_id: 'user-1',
            action_type: 'complete_project',
            resource_id: '42',
            xp_amount: 20,
        })
        expect(xpPayload).not.toHaveProperty('description')
        expect(xpOptions).toEqual({
            onConflict: 'user_id,action_type,resource_id',
            ignoreDuplicates: true,
        })
        expect(callRpcMock).toHaveBeenNthCalledWith(1, routeSupabase, 'approve_completion', { completion_id: 123 })
        expect(callRpcMock).toHaveBeenNthCalledWith(2, supabaseAdminMock, 'increment_user_xp', {
            p_user_id: 'user-1',
            p_amount: 20,
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
})
