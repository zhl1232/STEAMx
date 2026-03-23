/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/admin/reports/route'
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

describe('GET /api/admin/reports', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireRoleMock = requireRole as Mock<typeof requireRole>

  beforeEach(() => {
    vi.clearAllMocks()
    requireRoleMock.mockResolvedValue({
      user: { id: 'moderator-1' },
      role: 'moderator',
    } as never)
  })

  it('returns 400 for invalid status filters', async () => {
    createClientMock.mockResolvedValue({} as never)

    const response = await GET(new NextRequest('http://localhost/api/admin/reports?status=broken') as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'status must be one of: pending, resolved, dismissed, all',
    })
  })

  it('normalizes invalid page and limit values before querying', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    })
    const order = vi.fn(() => ({
      range,
    }))
    const eq = vi.fn(() => ({
      order,
    }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'reports') {
          return {
            select: vi.fn(() => ({
              eq,
              order,
            })),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await GET(new NextRequest('http://localhost/api/admin/reports?status=pending&page=0&limit=oops') as never)

    expect(response.status).toBe(200)
    expect(range).toHaveBeenCalledWith(0, 19)
    await expect(response.json()).resolves.toMatchObject({
      reports: [],
      total: 0,
      page: 1,
      limit: 20,
    })
  })
})
