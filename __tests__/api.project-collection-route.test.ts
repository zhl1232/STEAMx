/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { POST } from '@/app/api/projects/[id]/collection/route'
import { requireAuth, PermissionError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { getAccessibleProject } from '@/lib/api/project-access'
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

vi.mock('@/lib/access/interaction-access', () => ({
  requireInteractionAccess: vi.fn(),
}))

vi.mock('@/lib/api/project-access', () => ({
  getAccessibleProject: vi.fn(),
}))

describe('POST /api/projects/[id]/collection', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireInteractionAccessMock = requireInteractionAccess as Mock<typeof requireInteractionAccess>
  const getAccessibleProjectMock = getAccessibleProject as Mock<typeof getAccessibleProject>

  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
    requireInteractionAccessMock.mockResolvedValue({ canEngage: true } as never)
    getAccessibleProjectMock.mockResolvedValue({
      id: 42,
      author_id: 'author-1',
      status: 'approved',
      title: '纸火箭',
    })
  })

  it('collects an accessible project for the current user', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    }))
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn(() => ({ select, insert }))
    createClientMock.mockResolvedValue({ from } as never)

    const response = await POST(new Request('http://localhost/api/projects/42/collection'), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      collected: true,
      action: 'collected',
      changed: true,
    })
    expect(requireInteractionAccessMock).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'user-1' },
      'engage',
    )
    expect(insert).toHaveBeenCalledWith({ user_id: 'user-1', project_id: 42 })
  })

  it('removes an existing collection', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null })
    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    }))
    const deleteSelect = vi.fn().mockResolvedValue({ data: [{ user_id: 'user-1' }], error: null })
    const deleteQuery = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ select: deleteSelect })),
      })),
    }))
    const from = vi.fn(() => ({ select, delete: deleteQuery }))
    createClientMock.mockResolvedValue({ from } as never)

    const response = await POST(new Request('http://localhost/api/projects/42/collection'), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      collected: false,
      action: 'uncollected',
      changed: true,
    })
    expect(deleteQuery).toHaveBeenCalled()
  })

  it('does not expose inaccessible projects to collection writes', async () => {
    getAccessibleProjectMock.mockResolvedValue(null)
    const from = vi.fn()
    createClientMock.mockResolvedValue({ from } as never)

    const response = await POST(new Request('http://localhost/api/projects/404/collection'), {
      params: Promise.resolve({ id: '404' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Project not found' })
    expect(from).not.toHaveBeenCalled()
  })

  it('blocks restricted accounts before touching the collection table', async () => {
    requireInteractionAccessMock.mockRejectedValue(
      new PermissionError('当前账号暂时不能进行此操作', 'INTERACTION_RESTRICTED', {
        capability: 'engage',
      }),
    )
    const from = vi.fn()
    createClientMock.mockResolvedValue({ from } as never)

    const response = await POST(new Request('http://localhost/api/projects/42/collection'), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      code: 'INTERACTION_RESTRICTED',
    })
    expect(getAccessibleProjectMock).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })
})
