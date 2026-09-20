import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTutorHistory } from './use-tutor-history'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }))
vi.mock('@/lib/context/login-prompt-context', () => ({ useLoginPrompt: () => ({ promptLogin: vi.fn() }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))

function options() {
  return {
    epoch: 0, contextKey: 'home', contextKeyRef: { current: 'home' }, busyRef: { current: false },
    contextType: 'global', contextId: '', buildParams: () => new URLSearchParams(),
    loadSession: vi.fn().mockResolvedValue(undefined), onResetChat: vi.fn(),
  }
}

describe('new tutor topic', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.fetch.mockReset(); vi.stubGlobal('fetch', mocks.fetch) })

  it('does not archive a conversation while a reply is in progress', async () => {
    const opts = options()
    opts.busyRef.current = true
    const { result } = renderHook(() => useTutorHistory(opts))
    await act(async () => { await result.current.startNewTopic() })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(opts.onResetChat).not.toHaveBeenCalled()
  })

  it('preserves current messages if archiving fails', async () => {
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 500 }))
    const opts = options()
    const { result } = renderHook(() => useTutorHistory(opts))
    await act(async () => { await result.current.startNewTopic() })
    expect(opts.onResetChat).not.toHaveBeenCalled()
    expect(opts.loadSession).not.toHaveBeenCalled()
    expect(result.current.startingNewTopic).toBe(false)
    expect(opts.busyRef.current).toBe(false)
  })

  it('archives the loaded topic epoch and reloads the new session before allowing another send', async () => {
    mocks.fetch.mockResolvedValue(new Response('{"ok":true,"epoch":5}'))
    const opts = { ...options(), epoch: 4 }
    opts.onResetChat.mockImplementation(() => { opts.busyRef.current = false })
    opts.loadSession.mockImplementation(async () => { expect(opts.busyRef.current).toBe(true) })
    const { result } = renderHook(() => useTutorHistory(opts))
    await act(async () => { await result.current.startNewTopic() })
    expect(mocks.fetch.mock.calls[0][0]).toBe('/api/tutor/chat?epoch=4')
    expect(opts.onResetChat).toHaveBeenCalledOnce()
    expect(opts.loadSession).toHaveBeenCalledOnce()
    expect(opts.busyRef.current).toBe(false)
  })

  it('ignores an archive completion from an old scene', async () => {
    let resolve!: (value: Response) => void
    mocks.fetch.mockReturnValue(new Promise((r) => { resolve = r }))
    const opts = options()
    const { result, rerender } = renderHook(({ contextKey }) => useTutorHistory({ ...opts, contextKey }), { initialProps: { contextKey: 'home' } })
    let request!: Promise<void>
    act(() => { request = result.current.startNewTopic() })
    opts.contextKeyRef.current = 'explore'
    rerender({ contextKey: 'explore' })
    await act(async () => { resolve(new Response('{}')); await request })
    expect(opts.onResetChat).not.toHaveBeenCalled()
    expect(opts.loadSession).not.toHaveBeenCalled()
  })
})
