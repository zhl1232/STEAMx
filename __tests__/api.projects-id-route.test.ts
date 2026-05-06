/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { PATCH } from '@/app/api/projects/[id]/route'
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

describe('PATCH /api/projects/[id]', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
    requireRateLimitMock.mockResolvedValue(undefined)
  })

  it('returns 403 when the authenticated user is not the author', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 12, author_id: 'another-user' },
      error: null,
    })

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle,
              })),
            })),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await PATCH(new NextRequest('http://localhost/api/projects/12', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '更新项目',
        description: '项目描述',
        category: '科学',
        difficulty_stars: 2,
        materials: [],
        steps: [],
      }),
    }) as never, {
      params: Promise.resolve({ id: '12' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: '无权编辑该项目' })
  })

  it('updates owned projects without requesting re-review when the edit is minor', async () => {
    const projectMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 12, author_id: 'user-1' },
      error: null,
    })
    const categoryMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 1 },
      error: null,
    })

    const updateEqAuthorId = vi.fn().mockResolvedValue({ error: null })
    const updateEqId = vi.fn(() => ({
      eq: updateEqAuthorId,
    }))
    const deleteMaterialsEq = vi.fn().mockResolvedValue({ error: null })
    const deleteStepsEq = vi.fn().mockResolvedValue({ error: null })

    const rpc = vi.fn().mockResolvedValue({ error: null })

    createClientMock.mockResolvedValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: projectMaybeSingle,
              })),
            })),
            update: vi.fn(() => ({
              eq: updateEqId,
            })),
          }
        }

        if (table === 'categories') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: categoryMaybeSingle,
              })),
            })),
          }
        }

        if (table === 'project_materials') {
          return {
            delete: vi.fn(() => ({
              eq: deleteMaterialsEq,
            })),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }

        if (table === 'project_steps') {
          return {
            delete: vi.fn(() => ({
              eq: deleteStepsEq,
            })),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }

        if (table === 'sub_categories') {
          throw new Error('sub_categories should not be queried when sub category is omitted')
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await PATCH(new NextRequest('http://localhost/api/projects/12', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '更新项目',
        description: '项目描述',
        category: '科学',
        difficulty_stars: 2,
        materials: ['纸板'],
        steps: [{ title: '步骤一', description: '说明', image_url: null }],
        request_re_review: false,
      }),
    }) as never, {
      params: Promise.resolve({ id: '12' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ project: { id: 12 } })
    expect(rpc).not.toHaveBeenCalled()
    expect(updateEqAuthorId).toHaveBeenCalledWith('author_id', 'user-1')
    expect(deleteMaterialsEq).toHaveBeenCalledWith('project_id', 12)
    expect(deleteStepsEq).toHaveBeenCalledWith('project_id', 12)
  })
})
