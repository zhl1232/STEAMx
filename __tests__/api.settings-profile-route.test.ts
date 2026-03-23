/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { GET, PATCH } from '@/app/api/settings/profile/route'
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

describe('/api/settings/profile', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the current profile settings payload with split birth date', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        username: 'demo-user',
        display_name: '测试用户',
        bio: '简介',
        gender: '女',
        birth_date: '2002-07-01',
        avatar_url: '/avatars/default-3.svg',
        last_uploaded_avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/last.png',
      },
      error: null,
    })

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      })),
    } as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      profile: {
        username: 'demo-user',
        display_name: '测试用户',
        bio: '简介',
        gender: '女',
        birth_year: '2002',
        birth_month: '7',
        avatar_url: '/avatars/default-3.svg',
        last_uploaded_avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/last.png',
      },
    })
  })

  it('rejects avatar urls that do not belong to the current user', async () => {
    createClientMock.mockResolvedValue({} as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

    const response = await PATCH(new Request('http://localhost/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: '测试用户',
        bio: '简介',
        gender: null,
        birth_year: null,
        birth_month: null,
        avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-2/not-owned.png',
      }),
    }) as never)

    expect(requireRateLimitMock).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: '头像必须使用当前账号上传的文件或默认头像',
    })
  })

  it('stores the uploaded avatar as last_uploaded_avatar_url', async () => {
    let capturedPayload: Record<string, unknown> | undefined

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        username: 'demo-user',
        display_name: '测试用户',
        bio: '简介',
        gender: '其他',
        birth_date: '2001-11-01',
        avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/custom.png',
        last_uploaded_avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/custom.png',
      },
      error: null,
    })

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        update: vi.fn((payload: Record<string, unknown>) => {
          capturedPayload = payload
          return {
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle,
              })),
            })),
          }
        }),
      })),
    } as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

    const response = await PATCH(new Request('http://localhost/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: '测试用户',
        bio: '简介',
        gender: '其他',
        birth_year: '2001',
        birth_month: '11',
        avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/custom.png',
      }),
    }) as never)

    expect(response.status).toBe(200)
    expect(capturedPayload).toMatchObject({
      display_name: '测试用户',
      bio: '简介',
      gender: '其他',
      birth_date: '2001-11-01',
      avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/custom.png',
      last_uploaded_avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/custom.png',
    })
  })

  it('keeps last_uploaded_avatar_url unchanged when switching back to a preset avatar', async () => {
    let capturedPayload: Record<string, unknown> | undefined

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        username: 'demo-user',
        display_name: '测试用户',
        bio: '',
        gender: null,
        birth_date: null,
        avatar_url: '/avatars/default-2.svg',
        last_uploaded_avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/previous.png',
      },
      error: null,
    })

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        update: vi.fn((payload: Record<string, unknown>) => {
          capturedPayload = payload
          return {
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle,
              })),
            })),
          }
        }),
      })),
    } as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

    const response = await PATCH(new Request('http://localhost/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: '测试用户',
        bio: '',
        gender: null,
        birth_year: null,
        birth_month: null,
        avatar_url: '/avatars/default-2.svg',
      }),
    }) as never)

    expect(response.status).toBe(200)
    expect(capturedPayload).toMatchObject({
      display_name: '测试用户',
      bio: null,
      gender: null,
      birth_date: null,
      avatar_url: '/avatars/default-2.svg',
    })
    expect(capturedPayload).not.toHaveProperty('last_uploaded_avatar_url')
  })
})
