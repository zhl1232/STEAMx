/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { DELETE } from '@/app/api/admin/tags/[id]/route'
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

describe('DELETE /api/admin/tags/[id]', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireRoleMock = requireRole as Mock<typeof requireRole>

  beforeEach(() => {
    vi.clearAllMocks()
    requireRoleMock.mockResolvedValue({
      user: { id: 'moderator-1' },
      role: 'moderator',
    } as never)
  })

  it('returns 400 for invalid tag ids', async () => {
    createClientMock.mockResolvedValue({} as never)

    const response = await DELETE(new NextRequest('http://localhost/api/admin/tags/not-a-number', {
      method: 'DELETE',
    }) as never, {
      params: Promise.resolve({ id: 'not-a-number' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Tag id must be a number' })
  })

  it('returns 404 when deleting a missing tag', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })
    const select = vi.fn(() => ({
      maybeSingle,
    }))
    const eq = vi.fn(() => ({
      select,
    }))
    const del = vi.fn(() => ({
      eq,
    }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'tags') {
          return { delete: del }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await DELETE(new NextRequest('http://localhost/api/admin/tags/9', {
      method: 'DELETE',
    }) as never, {
      params: Promise.resolve({ id: '9' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Tag not found' })
  })
})
