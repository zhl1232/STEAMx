import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireRole: vi.fn(),
  supabaseAdmin: {} as { from?: (table: string) => unknown },
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/api/auth', () => ({
  requireRole: mocks.requireRole,
  handleApiError: (error: unknown) => { throw error },
}))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: mocks.supabaseAdmin }))

import { GET } from './route'

function mockUsageLogs(logs: Array<{ user_id: string; amount: number; reason: string; meta: unknown; created_at: string }>) {
  mocks.createClient.mockResolvedValue({})
  mocks.requireRole.mockResolvedValue(undefined)
  mocks.supabaseAdmin.from = (table: string) => {
    const builder = {
      select: () => builder,
      gte: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      then: (resolve: (value: unknown) => void) => resolve(table === 'ai_credit_logs'
        ? { data: logs, error: null }
        : { data: [{ id: 'user-a', display_name: 'A', username: null }, { id: 'user-b', display_name: 'B', username: null }], error: null }),
    }
    return builder
  }
}

describe('admin AI usage route', () => {
  it('counts settled tutor charges while ignoring holds and preserves legacy amounts', async () => {
    const logs = [
      { user_id: 'user-a', amount: -8.192, reason: 'credit_chat', meta: { billing: 'tutor_output_tokens', state: 'reserved' }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -8.192, reason: 'credit_chat', meta: { billing: 'tutor_output_tokens', state: 'settled', chargedCredits: 0.1 }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -8.192, reason: 'credit_chat', meta: { billing: 'tutor_output_tokens', state: 'canceled', chargedCredits: 0 }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -8.192, reason: 'credit_chat', meta: { billing: 'tutor_output_tokens', state: 'expired', chargedCredits: 0 }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -1, reason: 'free_chat', meta: { billing: 'tutor_output_tokens', state: 'settled', chargedCredits: 0 }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -1, reason: 'credit_chat', meta: { cost: 1 }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -1310.72, reason: 'credit_chat', meta: { billing: 'tutor_total_tokens', state: 'reserved' }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -1310.72, reason: 'credit_chat', meta: { billing: 'tutor_total_tokens', state: 'settled', chargedCredits: 7.12 }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -1310.72, reason: 'credit_chat', meta: { billing: 'tutor_total_tokens', state: 'canceled', chargedCredits: 0 }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -1, reason: 'free_chat', meta: { billing: 'tutor_total_tokens', state: 'reserved' }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -1, reason: 'free_chat', meta: { billing: 'tutor_total_tokens', state: 'settled', chargedCredits: 0 }, created_at: '2026-09-20T00:00:00.000Z' },
    ]
    mockUsageLogs(logs)

    const response = await GET()
    const payload = await response.json()
    expect(payload.totals).toEqual({ chats: 5, creditsUsed: 8.22, freeChats: 2, memberChats: 3 })
    expect(payload.topUsers[0]).toMatchObject({ chats: 5, creditsUsed: 8.22 })
  })

  it('counts a free fallback once from its main receipt and skips all quota bookkeeping children', async () => {
    const today = '2026-10-12T00:00:00.000Z'
    const logs = [
      ...['quota_reserved', 'quota_consumed', 'quota_canceled'].map((state) => ({
        user_id: 'user-a', amount: -1, reason: 'free_chat',
        meta: { billing: 'tutor_total_tokens', state, source: 'free', chargedCredits: 0, parentReceiptId: 101 },
        created_at: today,
      })),
      { user_id: 'user-a', amount: -0.01, reason: 'credit_chat', meta: { billing: 'tutor_total_tokens', state: 'settled', source: 'free', chargedCredits: 0 }, created_at: today },
      { user_id: 'user-a', amount: -0.01, reason: 'credit_chat', meta: { billing: 'tutor_total_tokens', state: 'canceled', source: 'free', chargedCredits: 0 }, created_at: today },
      { user_id: 'user-a', amount: -0.01, reason: 'credit_chat', meta: { billing: 'tutor_total_tokens', state: 'expired', source: 'free', chargedCredits: 0 }, created_at: today },
      { user_id: 'user-b', amount: -1, reason: 'credit_chat', meta: { billing: 'tutor_total_tokens', state: 'settled', source: 'wallet', chargedCredits: 0 }, created_at: today },
      { user_id: 'user-b', amount: -1, reason: 'credit_chat', meta: { billing: 'tutor_total_tokens', state: 'settled', source: 'wallet', chargedCredits: 0.42 }, created_at: today },
      { user_id: 'user-a', amount: -1, reason: 'free_chat', meta: {}, created_at: '2026-10-11T00:00:00.000Z' },
    ]
    mockUsageLogs(logs)

    const response = await GET()
    const payload = await response.json()
    expect(payload.totals).toEqual({ chats: 4, creditsUsed: 0.42, freeChats: 2, memberChats: 2 })
    expect(payload.daily).toEqual([
      { day: '2026-10-11', chats: 1, creditsUsed: 0, freeChats: 1, memberChats: 0 },
      { day: '2026-10-12', chats: 3, creditsUsed: 0.42, freeChats: 1, memberChats: 2 },
    ])
    expect(payload.topUsers).toEqual(expect.arrayContaining([
      { userId: 'user-a', displayName: 'A', chats: 2, creditsUsed: 0 },
      { userId: 'user-b', displayName: 'B', chats: 2, creditsUsed: 0.42 },
    ]))
    expect(payload.topUsers).toHaveLength(2)
  })
})
