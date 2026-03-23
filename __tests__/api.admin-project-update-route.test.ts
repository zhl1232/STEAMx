/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { PATCH } from '@/app/api/admin/projects/[id]/route'
import { PermissionError, requireRole } from '@/lib/api/auth'
import { callRpc } from '@/lib/supabase/rpc'
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

vi.mock('@/lib/supabase/rpc', () => ({
  callRpc: vi.fn(),
}))

describe('PATCH /api/admin/projects/[id]', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireRoleMock = requireRole as Mock<typeof requireRole>
  const callRpcMock = callRpc as Mock<typeof callRpc>

  beforeEach(() => {
    vi.clearAllMocks()
    createClientMock.mockResolvedValue({} as never)
    requireRoleMock.mockResolvedValue({
      user: { id: 'moderator-1' },
      role: 'moderator',
    } as never)
  })

  it('returns 403 for non-reviewers', async () => {
    requireRoleMock.mockRejectedValue(new PermissionError('Permission denied: requires one of [moderator, admin]'))

    const response = await PATCH(new NextRequest('http://localhost/api/admin/projects/3', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }) as never, {
      params: Promise.resolve({ id: '3' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Permission denied: requires one of [moderator, admin]',
    })
  })

  it('returns 400 when the payload is invalid', async () => {
    const response = await PATCH(new NextRequest('http://localhost/api/admin/projects/3', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '',
        description: '',
        category: '错误分类',
        difficulty_stars: 0,
        duration: -1,
        project_steps: [],
        project_materials: [],
      }),
    }) as never, {
      params: Promise.resolve({ id: '3' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Title is required')
    expect(callRpcMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the project does not exist', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: { code: 'P0002', message: 'Project not found' },
    })

    const response = await PATCH(new NextRequest('http://localhost/api/admin/projects/999', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '项目标题',
        description: '项目描述',
        category: '科学',
        sub_category_id: null,
        difficulty_stars: 3,
        image_url: '/uploads/project.png',
        duration: 60,
        project_steps: [{ title: '步骤一', description: '说明', image_url: null }],
        project_materials: [{ material: '纸板' }],
      }),
    }) as never, {
      params: Promise.resolve({ id: '999' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Project not found' })
  })

  it('updates project content through the RPC and ignores direct status edits', async () => {
    const routeSupabase = {}
    createClientMock.mockResolvedValue(routeSupabase as never)
    callRpcMock.mockResolvedValue({
      data: [{ id: 3, status: 'pending' }],
      error: null,
    })

    const response = await PATCH(new NextRequest('http://localhost/api/admin/projects/3', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '项目标题',
        description: '项目描述',
        category: '科学',
        sub_category_id: 12,
        difficulty_stars: 4,
        image_url: '/uploads/project.png',
        duration: 90,
        status: 'approved',
        steam_weights: { S: 20, T: 20, E: 20, A: 20, M: 20 },
        project_steps: [{ title: '步骤一', description: '说明', image_url: null }],
        project_materials: [{ material: '纸板' }, { material: '胶水', sort_order: 99 }],
      }),
    }) as never, {
      params: Promise.resolve({ id: '3' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      project: { id: 3, status: 'pending' },
    })
    expect(callRpcMock).toHaveBeenCalledWith(routeSupabase, 'admin_update_project', {
      p_project_id: 3,
      p_title: '项目标题',
      p_description: '项目描述',
      p_category: '科学',
      p_sub_category_id: 12,
      p_difficulty_stars: 4,
      p_image_url: '/uploads/project.png',
      p_duration: 90,
      p_steam_weights: { S: 20, T: 20, E: 20, A: 20, M: 20 },
      p_steps: [{ title: '步骤一', description: '说明', image_url: null }],
      p_materials: [
        { material: '纸板', sort_order: 1 },
        { material: '胶水', sort_order: 2 },
      ],
    })
  })
})
