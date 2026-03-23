/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { PATCH } from '@/app/api/admin/reports/[id]/route'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/api/auth'
import { NextRequest } from 'next/server'

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

describe('PATCH /api/admin/reports/[id]', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireRoleMock = requireRole as Mock<typeof requireRole>

  beforeEach(() => {
    vi.clearAllMocks()
    requireRoleMock.mockResolvedValue({
      user: { id: '11111111-1111-1111-1111-111111111111' },
      role: 'moderator',
    } as never)
  })

  it('returns 404 when the report does not exist or was already processed', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })
    const select = vi.fn(() => ({
      maybeSingle,
    }))
    const eqPending = vi.fn(() => ({
      select,
    }))
    const eqId = vi.fn(() => ({
      eq: eqPending,
    }))
    const update = vi.fn(() => ({
      eq: eqId,
    }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'reports') {
          return { update }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await PATCH(new NextRequest('http://localhost/api/admin/reports/9', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved' }),
      headers: { 'content-type': 'application/json' },
    }) as never, {
      params: Promise.resolve({ id: '9' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: '举报不存在或已处理' })
  })
})
