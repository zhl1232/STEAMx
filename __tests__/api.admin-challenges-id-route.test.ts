/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { DELETE, PATCH } from '@/app/api/admin/challenges/[id]/route'
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

describe('admin challenge detail routes', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireRoleMock = requireRole as Mock<typeof requireRole>

  beforeEach(() => {
    vi.clearAllMocks()
    requireRoleMock.mockResolvedValue({
      user: { id: 'moderator-1' },
      role: 'moderator',
    } as never)
  })

  it('returns 400 for invalid challenge ids on PATCH', async () => {
    createClientMock.mockResolvedValue({} as never)

    const response = await PATCH(new NextRequest('http://localhost/api/admin/challenges/not-a-number', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'new title' }),
    }) as never, {
      params: Promise.resolve({ id: 'not-a-number' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Challenge id must be a number' })
  })

  it('returns 404 when updating a missing challenge', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })
    const eq = vi.fn(() => ({
      maybeSingle,
    }))
    const select = vi.fn(() => ({
      eq,
    }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'challenges') {
          return { select }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await PATCH(new NextRequest('http://localhost/api/admin/challenges/9', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'new title' }),
    }) as never, {
      params: Promise.resolve({ id: '9' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Challenge not found' })
  })

  it('returns 400 when a timed challenge update would produce an invalid time window', async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 5,
        challenge_type: 'timed',
        start_date: '2026-03-01T10:00:00.000Z',
        end_date: '2026-03-10T10:00:00.000Z',
      },
      error: null,
    })
    const existingEq = vi.fn(() => ({
      maybeSingle: existingMaybeSingle,
    }))
    const existingSelect = vi.fn(() => ({
      eq: existingEq,
    }))
    const update = vi.fn(() => {
      throw new Error('update should not be called')
    })

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'challenges') {
          return {
            select: existingSelect,
            update,
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await PATCH(new NextRequest('http://localhost/api/admin/challenges/5', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ end_date: '2026-02-28T10:00:00.000Z' }),
    }) as never, {
      params: Promise.resolve({ id: '5' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'end_date must be later than start_date' })
  })

  it('returns 400 when updating difficulty stars to an invalid value', async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 5,
        challenge_type: 'evergreen',
        start_date: null,
        end_date: null,
      },
      error: null,
    })
    const existingEq = vi.fn(() => ({
      maybeSingle: existingMaybeSingle,
    }))
    const existingSelect = vi.fn(() => ({
      eq: existingEq,
    }))
    const update = vi.fn(() => {
      throw new Error('update should not be called')
    })

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'challenges') {
          return {
            select: existingSelect,
            update,
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await PATCH(new NextRequest('http://localhost/api/admin/challenges/5', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ difficulty_stars: 0 }),
    }) as never, {
      params: Promise.resolve({ id: '5' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Difficulty stars must be at least 1' })
  })

  it('returns 404 when deleting a missing challenge', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })
    const eq = vi.fn(() => ({
      maybeSingle,
    }))
    const select = vi.fn(() => ({
      eq,
    }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'challenges') {
          return { select }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await DELETE(new NextRequest('http://localhost/api/admin/challenges/42', {
      method: 'DELETE',
    }) as never, {
      params: Promise.resolve({ id: '42' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Challenge not found' })
  })
})
