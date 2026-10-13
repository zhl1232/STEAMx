/** @vitest-environment node */

import { beforeEach, afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/ldraw-preview/route'
import { createClient } from '@/lib/supabase/server'
import { AuthError, PermissionError, requireRole } from '@/lib/api/auth'
import { confirmLdrawModel } from '@/lib/courses/ldraw-review'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/auth')>()
  return { ...actual, requireRole: vi.fn() }
})
vi.mock('@/lib/courses/ldraw-review', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/courses/ldraw-review')>()
  return { ...actual, confirmLdrawModel: vi.fn(), isLdrawReviewCandidate: vi.fn(() => false) }
})

const requireRoleMock = requireRole as Mock<typeof requireRole>

function req(origin: string | null, url = 'http://localhost:3000/api/ldraw-preview') {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (origin) headers.origin = origin
  return new NextRequest(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ model: '__dry-run-nonexistent__.ldr', revision: 'x' }),
  })
}

describe('PATCH /api/ldraw-preview confirm gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('LDRAW_CONFIRM_ALLOWED_ORIGINS', 'https://dev.steamx.cc')
    ;(createClient as Mock).mockResolvedValue({} as never)
  })
  afterEach(() => vi.unstubAllEnvs())

  it('rejects unauthenticated requests from dev.steamx.cc with 401', async () => {
    requireRoleMock.mockRejectedValue(new AuthError('Unauthorized'))
    const res = await PATCH(req('https://dev.steamx.cc'))
    expect(res.status).toBe(401)
    expect(confirmLdrawModel).not.toHaveBeenCalled()
  })

  it('rejects non-admin users with 403', async () => {
    requireRoleMock.mockRejectedValue(new PermissionError('denied'))
    const res = await PATCH(req('https://dev.steamx.cc'))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('LDRAW_CONFIRM_ADMIN_REQUIRED')
  })

  it('lets admins through to model validation (not-found dry run)', async () => {
    requireRoleMock.mockResolvedValue({ user: { id: 'a' }, role: 'admin' } as never)
    const res = await PATCH(req('https://dev.steamx.cc'))
    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), ['admin'])
    expect(res.status).toBe(404)
    expect(confirmLdrawModel).not.toHaveBeenCalled()
  })

  it('rejects origins not in the allowlist', async () => {
    const res = await PATCH(req('https://evil.example.com'))
    expect(res.status).toBe(403)
    expect(requireRoleMock).not.toHaveBeenCalled()
  })

  it('keeps local same-origin requests working without login', async () => {
    const res = await PATCH(req('http://localhost:3000'))
    expect(res.status).toBe(404)
    expect(requireRoleMock).not.toHaveBeenCalled()
  })

  it('rejects everything in production, even admins from allowed origins', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    requireRoleMock.mockResolvedValue({ user: { id: 'a' }, role: 'admin' } as never)
    expect((await PATCH(req('https://dev.steamx.cc'))).status).toBe(403)
    expect((await PATCH(req('http://localhost:3000'))).status).toBe(403)
  })
})
