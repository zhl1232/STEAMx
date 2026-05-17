/** @vitest-environment node */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { GET } from '@/app/api/leaderboard/route'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('GET /api/leaderboard', () => {
  const createClientMock = createClient as Mock<typeof createClient>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns observation leaderboard rows from the observation rpc', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'observer-1',
          display_name: '观察员',
          avatar_url: '/avatar.png',
          xp: 900,
          observation_count: 12,
        },
      ],
      error: null,
    })
    const inFilter = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'observer-1',
          equipped_avatar_frame_id: 'frame-gold',
          equipped_name_color_id: 'name-emerald',
        },
      ],
      error: null,
    })
    const select = vi.fn(() => ({ in: inFilter }))
    const from = vi.fn(() => ({ select }))

    createClientMock.mockResolvedValue({
      rpc,
      from,
      auth: {
        getUser: vi.fn(),
      },
    } as never)

    const response = await GET(new NextRequest('http://localhost/api/leaderboard?type=observations&limit=20'))

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('get_observation_leaderboard', { limit_count: 20 })
    expect(from).toHaveBeenCalledWith('profiles')
    expect(select).toHaveBeenCalledWith('id, equipped_avatar_frame_id, equipped_name_color_id')
    expect(inFilter).toHaveBeenCalledWith('id', ['observer-1'])
    await expect(response.json()).resolves.toEqual({
      users: [
        {
          id: 'observer-1',
          name: '观察员',
          xp: 900,
          level: 4,
          value: 12,
          avatar: '/avatar.png',
          avatarFrameId: 'frame-gold',
          nameColorId: 'name-emerald',
        },
      ],
    })
  })
})
