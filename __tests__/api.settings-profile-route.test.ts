/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { GET, PATCH } from '@/app/api/settings/profile/route'
import { invalidateStudentProfileCache } from '@/lib/ai/tutor/student-profile'
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

vi.mock('@/lib/ai/tutor/student-profile', () => ({
  invalidateStudentProfileCache: vi.fn(),
}))

describe('/api/settings/profile', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createProfilesTableMock(options: {
    currentProfile?: { avatar_url: string | null; last_uploaded_avatar_url: string | null } | null
    updateResult?: {
      username: string | null
      display_name: string | null
      bio: string | null
      gender: string | null
      birth_date: string | null
      avatar_url: string | null
      last_uploaded_avatar_url: string | null
    }
    onUpdate?: (payload: Record<string, unknown>) => void
  }) {
    const currentProfile = options.currentProfile ?? {
      avatar_url: '/avatars/default-1.svg',
      last_uploaded_avatar_url: null,
    }

    return {
      select: vi.fn((fields: string) => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data:
              fields === 'avatar_url, last_uploaded_avatar_url'
                ? currentProfile
                : options.updateResult ?? null,
            error: null,
          }),
        })),
      })),
      update: vi.fn((payload: Record<string, unknown>) => {
        options.onUpdate?.(payload)
        return {
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: options.updateResult ?? null,
                error: null,
              }),
            })),
          })),
        }
      }),
    }
  }

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
        equipped_title: null,
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
        equipped_title: null,
      },
    })
  })

  it('rejects avatar urls that do not belong to the current user', async () => {
    createClientMock.mockResolvedValue({
      from: vi.fn(() => createProfilesTableMock({ currentProfile: { avatar_url: '/avatars/default-1.svg', last_uploaded_avatar_url: null } })),
    } as never)
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
    expect(invalidateStudentProfileCache).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      error: '头像必须使用当前账号上传的文件或默认头像',
    })
  })

  it('stores the uploaded avatar as last_uploaded_avatar_url', async () => {
    let capturedPayload: Record<string, unknown> | undefined

    createClientMock.mockResolvedValue({
      from: vi.fn(() => createProfilesTableMock({
        currentProfile: {
          avatar_url: '/avatars/default-1.svg',
          last_uploaded_avatar_url: null,
        },
        updateResult: {
          username: 'demo-user',
          display_name: '测试用户',
          bio: '简介',
          gender: '其他',
          birth_date: '2001-11-01',
          avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/custom.png',
          last_uploaded_avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/custom.png',
        },
        onUpdate: (payload) => {
          capturedPayload = payload
        },
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
    expect(invalidateStudentProfileCache).toHaveBeenCalledWith('user-1')
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

    createClientMock.mockResolvedValue({
      from: vi.fn(() => createProfilesTableMock({
        currentProfile: {
          avatar_url: '/avatars/default-1.svg',
          last_uploaded_avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/previous.png',
        },
        updateResult: {
          username: 'demo-user',
          display_name: '测试用户',
          bio: '',
          gender: null,
          birth_date: null,
          avatar_url: '/avatars/default-2.svg',
          last_uploaded_avatar_url: 'https://example.com/storage/v1/object/public/avatars/user-1/previous.png',
        },
        onUpdate: (payload) => {
          capturedPayload = payload
        },
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

  it('accepts a legacy uploaded avatar url already stored on the current profile', async () => {
    let capturedPayload: Record<string, unknown> | undefined

    const legacyAvatarUrl = 'https://spb-l3q6k3bebzxrok83.supabase.opentrust.net/storage/v1/object/public/avatars/54iddr4yeuk.jpg'

    createClientMock.mockResolvedValue({
      from: vi.fn(() => createProfilesTableMock({
        currentProfile: {
          avatar_url: legacyAvatarUrl,
          last_uploaded_avatar_url: legacyAvatarUrl,
        },
        updateResult: {
          username: 'demo-user',
          display_name: '测试用户',
          bio: '简介',
          gender: null,
          birth_date: null,
          avatar_url: legacyAvatarUrl,
          last_uploaded_avatar_url: legacyAvatarUrl,
        },
        onUpdate: (payload) => {
          capturedPayload = payload
        },
      })),
    } as never)
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
        avatar_url: legacyAvatarUrl,
      }),
    }) as never)

    expect(response.status).toBe(200)
    expect(capturedPayload).toMatchObject({
      avatar_url: legacyAvatarUrl,
      last_uploaded_avatar_url: legacyAvatarUrl,
    })
  })
})
