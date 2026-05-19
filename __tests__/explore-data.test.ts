/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { dedupeCompletionRowsByUser, getProjectTotalCoinsReceived } from '@/lib/api/explore-data'
import { createClient } from '@/lib/supabase/server'
import { callRpc } from '@/lib/supabase/rpc'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/rpc', () => ({
  callRpc: vi.fn(),
}))

vi.mock('@/lib/testing/playwright-smoke', () => ({
  isPlaywrightSmoke: vi.fn(() => false),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('getProjectTotalCoinsReceived', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const callRpcMock = callRpc as Mock<typeof callRpc>

  beforeEach(() => {
    vi.clearAllMocks()
    createClientMock.mockResolvedValue({} as never)
  })

  it('returns the RPC total instead of the base project coins count', async () => {
    callRpcMock.mockResolvedValue({
      data: 9,
      error: null,
    })

    await expect(getProjectTotalCoinsReceived(42, 2)).resolves.toBe(9)
    expect(callRpcMock).toHaveBeenCalledWith(
      expect.anything(),
      'get_project_total_coins_received',
      { p_project_id: 42 },
    )
  })

  it('falls back to the base project coins count when the RPC fails', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: new Error('rpc failed'),
    })

    await expect(getProjectTotalCoinsReceived(42, 2)).resolves.toBe(2)
  })
})

describe('dedupeCompletionRowsByUser', () => {
  it('keeps only the latest row per user_id in encounter order', () => {
    const rows = [
      { id: 1, user_id: 'a' },
      { id: 2, user_id: 'b' },
      { id: 3, user_id: 'a' },
      { id: 4, user_id: 'c' },
    ]

    expect(dedupeCompletionRowsByUser(rows, 8)).toEqual([
      { id: 1, user_id: 'a' },
      { id: 2, user_id: 'b' },
      { id: 4, user_id: 'c' },
    ])
  })

  it('respects the limit after deduplication', () => {
    const rows = [
      { id: 1, user_id: 'a' },
      { id: 2, user_id: 'b' },
      { id: 3, user_id: 'c' },
    ]

    expect(dedupeCompletionRowsByUser(rows, 2)).toHaveLength(2)
    expect(dedupeCompletionRowsByUser(rows, 2).map((row) => row.user_id)).toEqual(['a', 'b'])
  })
})
