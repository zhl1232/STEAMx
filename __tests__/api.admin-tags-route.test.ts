/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/admin/tags/route'
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

describe('POST /api/admin/tags', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireRoleMock = requireRole as Mock<typeof requireRole>

  beforeEach(() => {
    vi.clearAllMocks()
    requireRoleMock.mockResolvedValue({
      user: { id: 'moderator-1' },
      role: 'moderator',
    } as never)
  })

  it('returns 409 when creating a duplicate tag', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "tags_name_key"',
      },
    })
    const select = vi.fn(() => ({
      single,
    }))
    const insert = vi.fn(() => ({
      select,
    }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'tags') {
          return { insert }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await POST(new NextRequest('http://localhost/api/admin/tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '机器人', category: '技术' }),
    }) as never)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: '标签已存在' })
  })
})
