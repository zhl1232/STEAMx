/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { POST } from '@/app/api/projects/route'
import { requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'

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

vi.mock('@/lib/api/rate-limit', () => ({
  requireRateLimit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('POST /api/projects', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
    requireRateLimitMock.mockResolvedValue(undefined)
  })

  it('rejects a sub-category id that does not belong to the submitted category', async () => {
    const categoryMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 1 },
      error: null,
    })
    const subCategoryMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 9, category_id: 2, name: '编程入门' },
      error: null,
    })

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'categories') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: categoryMaybeSingle,
              })),
            })),
          }
        }

        if (table === 'sub_categories') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: subCategoryMaybeSingle,
              })),
            })),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await POST(new Request('http://localhost/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '火山实验',
        description: '一个化学实验',
        category: '科学',
        sub_category_id: 9,
        difficulty_stars: 2,
        duration: 30,
        materials: [],
        steps: [],
      }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid sub category' })
  })
})
