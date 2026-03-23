/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/admin/moderator-applications/[id]/review/route'
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

describe('POST /api/admin/moderator-applications/[id]/review', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireRoleMock = requireRole as Mock<typeof requireRole>
  const callRpcMock = callRpc as Mock<typeof callRpc>

  beforeEach(() => {
    vi.clearAllMocks()
    requireRoleMock.mockResolvedValue({
      user: { id: 'admin-1' },
      role: 'admin',
    } as never)
  })

  it('returns 403 for non-admin reviewers', async () => {
    createClientMock.mockResolvedValue({} as never)
    requireRoleMock.mockRejectedValue(new PermissionError('Permission denied: requires one of [admin]'))

    const response = await POST(new NextRequest('http://localhost/api/admin/moderator-applications/7/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }) as never, {
      params: Promise.resolve({ id: '7' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Permission denied: requires one of [admin]',
    })
  })

  it('requires a rejection reason when rejecting an application', async () => {
    createClientMock.mockResolvedValue({} as never)

    const response = await POST(new NextRequest('http://localhost/api/admin/moderator-applications/7/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    }) as never, {
      params: Promise.resolve({ id: '7' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Rejection reason is required when rejecting an application',
    })
    expect(callRpcMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the application is missing or already processed', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })
    const eqStatus = vi.fn(() => ({
      maybeSingle,
    }))
    const eqId = vi.fn(() => ({
      eq: eqStatus,
    }))
    const select = vi.fn(() => ({
      eq: eqId,
    }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'moderator_applications') {
          return { select }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await POST(new NextRequest('http://localhost/api/admin/moderator-applications/9/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }) as never, {
      params: Promise.resolve({ id: '9' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: '申请不存在或已处理' })
    expect(callRpcMock).not.toHaveBeenCalled()
  })

  it('approves a pending application via the review RPC', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 12 },
      error: null,
    })
    const eqStatus = vi.fn(() => ({
      maybeSingle,
    }))
    const eqId = vi.fn(() => ({
      eq: eqStatus,
    }))
    const select = vi.fn(() => ({
      eq: eqId,
    }))
    const routeSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'moderator_applications') {
          return { select }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(routeSupabase as never)
    callRpcMock.mockResolvedValue({
      data: [{ id: 12, status: 'approved', user_id: 'user-12' }],
      error: null,
    })

    const response = await POST(new NextRequest('http://localhost/api/admin/moderator-applications/12/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }) as never, {
      params: Promise.resolve({ id: '12' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      application: { id: 12, status: 'approved', user_id: 'user-12' },
    })
    expect(callRpcMock).toHaveBeenCalledWith(routeSupabase, 'review_moderator_application', {
      p_application_id: 12,
      p_action: 'approve',
      p_rejection_reason: null,
    })
  })

  it('returns 404 when the pending application is processed concurrently', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 15 },
      error: null,
    })
    const eqStatus = vi.fn(() => ({
      maybeSingle,
    }))
    const eqId = vi.fn(() => ({
      eq: eqStatus,
    }))
    const select = vi.fn(() => ({
      eq: eqId,
    }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'moderator_applications') {
          return { select }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)
    callRpcMock.mockResolvedValue({
      data: null,
      error: {
        code: 'P0002',
        message: 'Application not found or already reviewed',
      },
    })

    const response = await POST(new NextRequest('http://localhost/api/admin/moderator-applications/15/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }) as never, {
      params: Promise.resolve({ id: '15' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: '申请不存在或已处理' })
  })

  it('returns 409 when the applicant role changed before approval', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 16 },
      error: null,
    })
    const eqStatus = vi.fn(() => ({
      maybeSingle,
    }))
    const eqId = vi.fn(() => ({
      eq: eqStatus,
    }))
    const select = vi.fn(() => ({
      eq: eqId,
    }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'moderator_applications') {
          return { select }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)
    callRpcMock.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'Applicant role changed and can no longer be approved',
      },
    })

    const response = await POST(new NextRequest('http://localhost/api/admin/moderator-applications/16/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }) as never, {
      params: Promise.resolve({ id: '16' }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Applicant role changed and can no longer be approved',
    })
  })
})
