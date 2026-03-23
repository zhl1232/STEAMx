/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/messages/threads/[userId]/route'
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

describe('GET /api/messages/threads/[userId]', () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects an invalid before cursor with 400 before querying messages', async () => {
        const from = vi.fn()
        createClientMock.mockResolvedValue({ from } as never)
        requireAuthMock.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111' } as never)

        const response = await GET(
            new NextRequest('http://localhost/api/messages/threads/22222222-2222-2222-2222-222222222222?before=not-a-date'),
            {
                params: Promise.resolve({ userId: '22222222-2222-2222-2222-222222222222' }),
            },
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: 'before must be a valid datetime' })
        expect(from).not.toHaveBeenCalled()
    })
})
