/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { POST } from '@/app/api/notifications/mark-read/route'
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

function createNotificationsTable(result: { data: { id: number } | null; error: null }) {
    const maybeSingle = vi.fn().mockResolvedValue(result)
    const select = vi.fn(() => ({ maybeSingle }))
    const eqRead = vi.fn(() => ({ select }))
    const eqUser = vi.fn(() => ({ eq: eqRead }))
    const eqId = vi.fn(() => ({ eq: eqUser }))
    const update = vi.fn(() => ({ eq: eqId }))

    return {
        table: { update },
        update,
        eqId,
        eqUser,
        eqRead,
        select,
        maybeSingle,
    }
}

describe('POST /api/notifications/mark-read', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns changed true when an unread notification is marked as read', async () => {
        const notifications = createNotificationsTable({
            data: { id: 12 },
            error: null,
        })
        const from = vi.fn((table: string) => {
            if (table === 'notifications') return notifications.table
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await POST(new Request('http://localhost/api/notifications/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 12 }),
        }) as never)

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ ok: true, changed: true })
        expect(notifications.eqRead).toHaveBeenCalledWith('is_read', false)
        expect(notifications.select).toHaveBeenCalledWith('id')
    })

    it('returns changed false when the notification was already read or not found', async () => {
        const notifications = createNotificationsTable({
            data: null,
            error: null,
        })
        const from = vi.fn((table: string) => {
            if (table === 'notifications') return notifications.table
            throw new Error(`Unexpected table: ${table}`)
        })

        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const response = await POST(new Request('http://localhost/api/notifications/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 12 }),
        }) as never)

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ ok: true, changed: false })
    })

    it('rejects non-positive or non-integer ids', async () => {
        createClientMock.mockResolvedValue({} as never)
        requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

        const zeroResponse = await POST(new Request('http://localhost/api/notifications/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 0 }),
        }) as never)
        expect(zeroResponse.status).toBe(400)
        await expect(zeroResponse.json()).resolves.toEqual({ error: 'Invalid id' })

        const floatResponse = await POST(new Request('http://localhost/api/notifications/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 1.5 }),
        }) as never)
        expect(floatResponse.status).toBe(400)
        await expect(floatResponse.json()).resolves.toEqual({ error: 'Invalid id' })
    })
})
