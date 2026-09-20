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

describe('admin AI usage route', () => {
  it('counts settled tutor charges while ignoring holds and preserves legacy amounts', async () => {
    const logs = [
      { user_id: 'user-a', amount: -8.192, reason: 'credit_chat', meta: { billing: 'tutor_output_tokens', state: 'reserved' }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -8.192, reason: 'credit_chat', meta: { billing: 'tutor_output_tokens', state: 'settled', chargedCredits: 0.1 }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -8.192, reason: 'credit_chat', meta: { billing: 'tutor_output_tokens', state: 'canceled', chargedCredits: 0 }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -8.192, reason: 'credit_chat', meta: { billing: 'tutor_output_tokens', state: 'expired', chargedCredits: 0 }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -1, reason: 'free_chat', meta: { billing: 'tutor_output_tokens', state: 'settled', chargedCredits: 0 }, created_at: '2026-09-20T00:00:00.000Z' },
      { user_id: 'user-a', amount: -1, reason: 'credit_chat', meta: { cost: 1 }, created_at: '2026-09-20T00:00:00.000Z' },
    ]
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
          : { data: [{ id: 'user-a', display_name: 'A', username: null }], error: null }),
      }
      return builder
    }

    const response = await GET()
    const payload = await response.json()
    expect(payload.totals).toEqual({ chats: 3, creditsUsed: 1.1, freeChats: 1, memberChats: 2 })
    expect(payload.topUsers[0]).toMatchObject({ chats: 3, creditsUsed: 1.1 })
  })
})
