/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/discussions/route'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('GET /api/discussions', () => {
  const createClientMock = createClient as Mock<typeof createClient>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns author ids so the list page can align delete permissions with the detail page', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [
        {
          id: 18,
          title: '磁悬浮小车',
          author_id: 'user-18',
          content: '测试内容',
          created_at: '2026-03-20T12:00:00.000Z',
          likes_count: 3,
          tags: ['科学'],
          replies_count: 2,
          profiles: {
            display_name: 'Alice',
            avatar_url: 'https://example.com/avatar.png',
            equipped_avatar_frame_id: null,
            equipped_name_color_id: null,
          },
        },
      ],
      error: null,
    })
    const order = vi.fn(() => ({ range }))
    const contains = vi.fn(() => ({ order }))
    const or = vi.fn(() => ({ contains, order }))
    const select = vi.fn(() => ({ or, contains, order, range }))

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select })),
    } as never)

    const response = await GET(new NextRequest('http://localhost/api/discussions'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      discussions: [
        expect.objectContaining({
          id: 18,
          author: 'Alice',
          authorId: 'user-18',
          likes: 3,
          repliesCount: 2,
          tags: ['科学'],
        }),
      ],
      hasMore: false,
    })
  })

  it('trims oversized tag filters before querying discussions', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    })
    const order = vi.fn(() => ({ range }))
    const contains = vi.fn(() => ({ order }))
    const or = vi.fn(() => ({ contains, order }))
    const select = vi.fn(() => ({ or, contains, order, range }))

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select })),
    } as never)

    await GET(
      new NextRequest(`http://localhost/api/discussions?tag=${'x'.repeat(60)}`)
    )

    expect(contains).toHaveBeenCalledWith('tags', ['x'.repeat(30)])
  })
})
