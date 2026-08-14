/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { PATCH } from '@/app/api/admin/users/[id]/membership/route'
import { PermissionError, requireRole } from '@/lib/api/auth'
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

describe('PATCH /api/admin/users/[id]/membership', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireRoleMock = requireRole as Mock<typeof requireRole>
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    requireRoleMock.mockResolvedValue({
      user: { id: 'admin-1' },
      role: 'admin',
    } as never)
    createClientMock.mockResolvedValue({ rpc } as never)
  })

  function patch(id: string, body: Record<string, unknown>) {
    return PATCH(
      new Request(`http://localhost/api/admin/users/${id}/membership`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    )
  }

  it('returns 403 for non-admin callers', async () => {
    requireRoleMock.mockRejectedValue(new PermissionError('Permission denied: requires one of [admin]'))

    const response = await patch('user-1', { period: 'founder' })

    expect(response.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('updates membership through admin_set_membership', async () => {
    const user = {
      id: 'user-1',
      membership_tier: 'founder',
      membership_period: 'founder',
      membership_started_at: '2026-08-14T00:00:00.000Z',
      membership_expires_at: null,
    }
    rpc.mockResolvedValue({ data: { ok: true, user }, error: null })

    const response = await patch('user-1', { period: 'founder' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ user })
    expect(rpc).toHaveBeenCalledWith('admin_set_membership', {
      p_target_user_id: 'user-1',
      p_period: 'founder',
      p_expires_at: null,
    })
  })

  it('returns 404 when the target user is missing', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'not_found' }, error: null })

    const response = await patch('missing-user', { period: 'none' })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'User not found' })
  })

  it('returns 400 when a paid period is missing an expiry', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'invalid_expiry' }, error: null })

    const response = await patch('user-1', { period: 'monthly' })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '请选择有效的会员到期时间' })
  })
})
