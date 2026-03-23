/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { PATCH } from '@/app/api/admin/challenges/[id]/status/route'
import { requireRole } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

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

describe('PATCH /api/admin/challenges/[id]/status', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireRoleMock = requireRole as Mock<typeof requireRole>

  beforeEach(() => {
    vi.clearAllMocks()
    requireRoleMock.mockResolvedValue({
      user: { id: 'moderator-1' },
      role: 'moderator',
    } as never)
  })

  it('returns 400 for invalid challenge ids', async () => {
    createClientMock.mockResolvedValue({} as never)

    const response = await PATCH(new NextRequest('http://localhost/api/admin/challenges/not-a-number/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    }) as never, {
      params: Promise.resolve({ id: 'not-a-number' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Challenge id must be a number' })
  })

  it('returns 404 when the challenge disappears before the status update', async () => {
    const fetchSingle = vi.fn().mockResolvedValue({
      data: { id: 8, challenge_type: 'evergreen', status: 'draft' },
      error: null,
    })
    const fetchEq = vi.fn(() => ({
      single: fetchSingle,
    }))
    const fetchSelect = vi.fn(() => ({
      eq: fetchEq,
    }))

    const updateMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })
    const updateSelect = vi.fn(() => ({
      maybeSingle: updateMaybeSingle,
    }))
    const updateEq = vi.fn(() => ({
      select: updateSelect,
    }))
    const update = vi.fn(() => ({
      eq: updateEq,
    }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'challenges') {
          return {
            select: fetchSelect,
            update,
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await PATCH(new NextRequest('http://localhost/api/admin/challenges/8/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    }) as never, {
      params: Promise.resolve({ id: '8' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Challenge not found' })
  })
})
