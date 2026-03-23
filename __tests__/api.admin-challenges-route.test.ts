/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/admin/challenges/route'
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

describe('POST /api/admin/challenges', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireRoleMock = requireRole as Mock<typeof requireRole>

  beforeEach(() => {
    vi.clearAllMocks()
    createClientMock.mockResolvedValue({} as never)
    requireRoleMock.mockResolvedValue({
      user: { id: 'moderator-1' },
      role: 'moderator',
    } as never)
  })

  it('requires a valid time window for timed challenges', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/challenges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '春季挑战',
        challenge_type: 'timed',
        difficulty_stars: 3,
      }),
    }) as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'start_date must be a valid datetime' })
  })

  it('rejects invalid difficulty stars instead of defaulting them', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/challenges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '春季挑战',
        challenge_type: 'evergreen',
        difficulty_stars: 0,
      }),
    }) as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Difficulty stars must be at least 1' })
  })
})
