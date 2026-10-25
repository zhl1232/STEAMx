import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useBuildingVoicePreparation } from './use-building-voice-preparation'

const state = vi.hoisted(() => ({ snapshot: { status: 'idle', persisted: false, fromCache: false }, prepare: vi.fn(), dispose: vi.fn() }))
vi.mock('./building-voice-preparation', async importOriginal => {
  const original = await importOriginal<typeof import('./building-voice-preparation')>()
  return { ...original, supportsBuildingVoicePreparation: () => true, buildingVoicePreparation: {
    subscribe: () => () => {}, getSnapshot: () => state.snapshot, getServerSnapshot: () => state.snapshot,
    retain: () => () => {}, prepare: state.prepare, dispose: state.dispose, acquire: vi.fn(),
  } }
})
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); state.snapshot.status = 'idle'
  Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '4g', downlink: 10 } })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
const options = { courseId: 1, lessonId: 2, userId: 'user', courseReady: true }
const eligible = () => Promise.resolve(new Response(JSON.stringify({ userId: 'user', validForMs: 300000 })))
it('retries an eligibility check cancelled by course resources becoming unready', async () => {
  const fetch = vi.fn().mockImplementationOnce((_url, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new Error('abort')))
  })).mockImplementationOnce(eligible)
  vi.stubGlobal('fetch', fetch)
  const hook = renderHook(props => useBuildingVoicePreparation(props), { initialProps: options })
  await act(() => vi.advanceTimersByTimeAsync(2001))
  expect(fetch).toHaveBeenCalledOnce()
  hook.rerender({ ...options, courseReady: false })
  hook.rerender(options)
  await act(() => vi.advanceTimersByTimeAsync(2001))
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(state.prepare).toHaveBeenCalledWith(true)
  hook.unmount()
})
it('reconsiders a deferred connection but does not loop on a download error', async () => {
  vi.stubGlobal('fetch', vi.fn(eligible))
  const hook = renderHook(() => useBuildingVoicePreparation(options))
  await act(() => vi.advanceTimersByTimeAsync(2001))
  state.prepare.mockClear()
  state.snapshot.status = 'deferred'
  act(() => window.dispatchEvent(new Event('online')))
  await act(() => vi.advanceTimersByTimeAsync(2001))
  expect(state.prepare).toHaveBeenCalledOnce()
  state.prepare.mockClear(); state.snapshot.status = 'error'
  act(() => window.dispatchEvent(new Event('online')))
  await act(() => vi.advanceTimersByTimeAsync(20001))
  expect(state.prepare).not.toHaveBeenCalled()
  hook.unmount()
})
