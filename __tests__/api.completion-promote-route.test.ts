/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/completions/[id]/promote/route'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireAuth } from '@/lib/api/auth'
import { callRpc } from '@/lib/supabase/rpc'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/rpc', () => ({ callRpc: vi.fn() }))
vi.mock('@/lib/access/interaction-access', () => ({ requireInteractionAccess: vi.fn() }))
vi.mock('@/lib/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/auth')>()
  return { ...actual, requireAuth: vi.fn() }
})
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

describe('POST /api/completions/[id]/promote', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireAccessMock = requireInteractionAccess as Mock<typeof requireInteractionAccess>
  const callRpcMock = callRpc as Mock<typeof callRpc>
  const supabase = {} as Awaited<ReturnType<typeof createClient>>

  beforeEach(() => {
    vi.clearAllMocks()
    createClientMock.mockResolvedValue(supabase)
    requireAuthMock.mockResolvedValue({ id: 'owner-1' } as never)
    requireAccessMock.mockResolvedValue({ canEngage: true } as never)
  })

  function request() {
    return new NextRequest('http://localhost/api/completions/16/promote', { method: 'POST' })
  }

  it('promotes the record through the atomic database function', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        completion_id: 16,
        status: 'approved',
        record_kind: 'final',
        xp_awarded: true,
      },
      error: null,
    } as never)

    const response = await POST(request(), { params: Promise.resolve({ id: '16' }) })

    expect(response.status).toBe(200)
    expect(requireAccessMock).toHaveBeenCalledWith(supabase, { id: 'owner-1' }, 'submit')
    expect(callRpcMock).toHaveBeenCalledWith(supabase, 'promote_progress_completion_to_final', {
      p_completion_id: 16,
    })
    await expect(response.json()).resolves.toMatchObject({
      id: 16,
      status: 'approved',
      recordKind: 'final',
      xpAwarded: true,
    })
  })

  it('returns a conflict when the project already has a final work', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: { message: 'FINAL_ALREADY_EXISTS' },
    } as never)

    const response = await POST(request(), { params: Promise.resolve({ id: '16' }) })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: '这个项目已经有完成作品了' })
  })

  it('returns a conflict for a concurrent final unique-index violation', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        constraint: 'completed_projects_one_final_per_user_project',
        message: 'duplicate key value violates unique constraint',
      },
    } as never)

    const response = await POST(request(), { params: Promise.resolve({ id: '16' }) })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: '这个项目已经有完成作品了' })
  })
})
