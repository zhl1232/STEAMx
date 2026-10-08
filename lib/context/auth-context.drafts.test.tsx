import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './auth-context'
import { readRecordDraft, recordDraftKey, writeRecordDraft } from '@/lib/project/record-draft'

const auth = vi.hoisted(() => ({
  changed: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  signOut: vi.fn(async () => ({})),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({
  auth: {
    onAuthStateChange: (callback: typeof auth.changed) => {
      auth.changed = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    },
    signOut: auth.signOut,
  },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }),
}) }))
vi.mock('@/lib/testing/playwright-smoke', () => ({ isPlaywrightSmokeClient: () => false }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers() })
afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllTimers(); vi.useRealTimers() })

it('clears all project drafts on account switch and passive logout through the auth subscription', () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
  act(() => auth.changed?.('SIGNED_IN', { user: { id: 'a' } }))
  const first = recordDraftKey('a', 149), second = recordDraftKey('a', 150)
  writeRecordDraft(first, '第一项目'); writeRecordDraft(second, '第二项目')
  act(() => auth.changed?.('TOKEN_REFRESHED', { user: { id: 'a' } }))
  expect(readRecordDraft(first)).toBe('第一项目')
  act(() => auth.changed?.('SIGNED_IN', { user: { id: 'b' } }))
  expect(result.current.user?.id).toBe('b')
  expect(readRecordDraft(first)).toBe(''); expect(readRecordDraft(second)).toBe('')
  const other = recordDraftKey('b', 149)
  writeRecordDraft(other, '新账号文字')
  act(() => auth.changed?.('SIGNED_OUT', null))
  expect(result.current.user).toBeNull()
  expect(readRecordDraft(other)).toBe('')
})

it('clears drafts immediately on explicit logout without waiting for an auth event', async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
  act(() => auth.changed?.('SIGNED_IN', { user: { id: 'a' } }))
  const key = recordDraftKey('a', 149)
  writeRecordDraft(key, '尚未发布')
  await act(async () => { await result.current.signOut() })
  expect(auth.signOut).toHaveBeenCalled()
  expect(readRecordDraft(key)).toBe('')
  expect(result.current.user).toBeNull()
})
