import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBuildingVoiceControls, type BuildingVoiceControlsOptions } from './use-building-voice-controls'
import type { BuildingVoiceCapture, BuildingVoiceCaptureOptions } from './building-voice-capture'

const mocks = vi.hoisted(() => ({ createCapture: vi.fn(), fetch: vi.fn(), claim: vi.fn(), release: vi.fn() }))
vi.mock('./building-voice-capture', () => ({ createBuildingVoiceCapture: mocks.createCapture }))
vi.mock('@/components/features/tutor/tutor-audio-session', () => ({ claimTutorAudioSession: mocks.claim }))

function options(): BuildingVoiceControlsOptions {
  return { courseId: 5, lessonId: 30, userId: 'user-a', navigationKey: 'visit-0', stepIndex: 1, stepCount: 5, onNavigate: vi.fn() }
}

function recorder(): BuildingVoiceCapture {
  return { setListening: vi.fn(), reset: vi.fn(), playCue: vi.fn(), close: vi.fn().mockResolvedValue(undefined) }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function requestCallbacks(index = 0): BuildingVoiceCaptureOptions {
  return mocks.createCapture.mock.calls[index][0]
}

async function emitSegment(index = 0) {
  await act(async () => {
    requestCallbacks(index).onSegment({ blob: new Blob([new Uint8Array(32_000)], { type: 'audio/pcm' }), durationMs: 1_000 })
  })
}

function response(command: unknown, status = 200) {
  return new Response(JSON.stringify({ command }), { status, headers: { 'content-type': 'application/json' } })
}

describe('course voice controls', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.createCapture.mockReset()
    mocks.fetch.mockReset()
    mocks.claim.mockImplementation(() => mocks.release)
    vi.stubGlobal('fetch', mocks.fetch)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('requires an explicit logged-in click and keeps a single microphone open across commands', async () => {
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockImplementation(async () => response('next'))
    const { result } = renderHook(() => useBuildingVoiceControls(options()))
    expect(mocks.createCapture).not.toHaveBeenCalled()
    await act(async () => { await result.current.start(); await result.current.start() })
    expect(mocks.createCapture).toHaveBeenCalledOnce()
    expect(mocks.claim).toHaveBeenCalledWith('course-control', expect.any(Function))
    await emitSegment()
    act(() => { vi.advanceTimersByTime(500) })
    await emitSegment()
    expect(mocks.createCapture).toHaveBeenCalledOnce()
    expect(capture.close).not.toHaveBeenCalled()
    act(() => result.current.pause())
    expect(capture.close).toHaveBeenCalledOnce()
    expect(mocks.release).toHaveBeenCalledOnce()
    await act(async () => { await result.current.resume() })
    expect(mocks.createCapture).toHaveBeenCalledTimes(2)
  })

  it('does not request a microphone or recognition for an anonymous visitor', async () => {
    const { result } = renderHook(() => useBuildingVoiceControls({ ...options(), userId: null }))
    await act(async () => { await result.current.start() })
    expect(result.current.status).toBe('error')
    expect(result.current.feedback).toContain('登录')
    expect(mocks.createCapture).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('uploads only PCM and authorized scene identifiers, executes once and gates feedback audio', async () => {
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockResolvedValue(response('next'))
    const opts = options()
    const { result } = renderHook(() => useBuildingVoiceControls(opts))
    await act(async () => { await result.current.start() })
    await emitSegment()
    expect(opts.onNavigate).toHaveBeenCalledExactlyOnceWith(2)
    const [url, request] = mocks.fetch.mock.calls[0]
    expect(url).toBe('/api/tutor/speech/course-control')
    expect([...request.body.keys()].sort()).toEqual(['audio', 'courseId', 'durationMs', 'lessonId'])
    expect(request.body.get('courseId')).toBe('5')
    expect(request.body.get('lessonId')).toBe('30')
    expect(request.body.get('durationMs')).toBe('1000')
    expect(request.body.get('audio').size).toBe(32_000)
    expect(result.current.status).toBe('feedback')
    expect(capture.setListening).toHaveBeenLastCalledWith(false)
    expect(capture.playCue).toHaveBeenCalledOnce()
    await emitSegment()
    expect(mocks.fetch).toHaveBeenCalledOnce()
    act(() => { vi.advanceTimersByTime(499) })
    expect(capture.setListening).toHaveBeenLastCalledWith(false)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.status).toBe('listening')
    expect(capture.setListening).toHaveBeenLastCalledWith(true)
  })

  it.each([
    ['previous', 0, '第一步'],
    ['next', 4, '最后一步'],
  ])('acknowledges the %s boundary without navigating away', async (command, stepIndex, expected) => {
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockResolvedValue(response(command))
    const opts = { ...options(), stepIndex: Number(stepIndex) }
    const { result } = renderHook(() => useBuildingVoiceControls(opts))
    await act(async () => { await result.current.start() })
    await emitSegment()
    expect(opts.onNavigate).not.toHaveBeenCalled()
    expect(result.current.feedback).toContain(expected as string)
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current.status).toBe('listening')
  })

  it('ignores ordinary speech without sending chat, cueing or stopping after repeated noncommands', async () => {
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockImplementation(async () => response(null))
    const opts = options()
    const { result } = renderHook(() => useBuildingVoiceControls(opts))
    await act(async () => { await result.current.start() })
    for (let index = 0; index < 5; index += 1) await emitSegment()
    expect(mocks.fetch).toHaveBeenCalledTimes(5)
    expect(mocks.fetch.mock.calls.every(([url]) => url === '/api/tutor/speech/course-control')).toBe(true)
    expect(result.current.status).toBe('listening')
    expect(opts.onNavigate).not.toHaveBeenCalled()
    expect(capture.playCue).not.toHaveBeenCalled()
    expect(capture.close).not.toHaveBeenCalled()
  })

  it('accepts at most one in-flight segment and one response action', async () => {
    const pending = deferred<Response>()
    mocks.createCapture.mockResolvedValue(recorder())
    mocks.fetch.mockReturnValue(pending.promise)
    const opts = options()
    const { result } = renderHook(() => useBuildingVoiceControls(opts))
    await act(async () => { await result.current.start() })
    await emitSegment()
    await emitSegment()
    expect(result.current.status).toBe('processing')
    expect(mocks.fetch).toHaveBeenCalledOnce()
    await act(async () => { pending.resolve(response('previous')) })
    expect(opts.onNavigate).toHaveBeenCalledExactlyOnceWith(0)
    expect(result.current.status).toBe('feedback')
  })

  it('invalidates a late answer even after manual navigation returns A to B to A', async () => {
    const pending = deferred<Response>()
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockReturnValue(pending.promise)
    const opts = options()
    const { result, rerender } = renderHook((props) => useBuildingVoiceControls(props), { initialProps: opts })
    await act(async () => { await result.current.start() })
    await emitSegment()
    const signal = mocks.fetch.mock.calls[0][1].signal
    rerender({ ...opts, navigationKey: 'visit-1', stepIndex: 2 })
    rerender({ ...opts, navigationKey: 'visit-2', stepIndex: 1 })
    expect(signal.aborted).toBe(true)
    await act(async () => { pending.resolve(response('next')) })
    expect(opts.onNavigate).not.toHaveBeenCalled()
    expect(capture.reset).toHaveBeenCalledTimes(2)
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current.status).toBe('listening')
    expect(mocks.createCapture).toHaveBeenCalledOnce()
  })

  it('uses the newly rendered step for the next voice navigation', async () => {
    mocks.createCapture.mockResolvedValue(recorder())
    mocks.fetch.mockImplementation(async () => response('next'))
    const opts = options()
    const { result, rerender } = renderHook((props) => useBuildingVoiceControls(props), { initialProps: opts })
    await act(async () => { await result.current.start() })
    await emitSegment()
    expect(opts.onNavigate).toHaveBeenLastCalledWith(2)
    rerender({ ...opts, navigationKey: 'voice-1', stepIndex: 2 })
    expect(result.current.status).toBe('feedback')
    act(() => { vi.advanceTimersByTime(500) })
    await emitSegment()
    expect(opts.onNavigate).toHaveBeenLastCalledWith(3)
    expect(opts.onNavigate).toHaveBeenCalledTimes(2)
  })

  it.each([
    { courseId: 6 }, { lessonId: 31 }, { userId: 'user-b' }, { userId: null },
  ])('releases resources and drops old responses on scope change %j', async (change) => {
    const pending = deferred<Response>()
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockReturnValue(pending.promise)
    const opts = options()
    const { result, rerender } = renderHook((props) => useBuildingVoiceControls(props), { initialProps: opts })
    await act(async () => { await result.current.start() })
    await emitSegment()
    rerender({ ...opts, ...change })
    expect(requestCallbacks().signal.aborted).toBe(true)
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true)
    expect(capture.close).toHaveBeenCalledOnce()
    expect(result.current.status).toBe('idle')
    await act(async () => { pending.resolve(response('next')) })
    expect(opts.onNavigate).not.toHaveBeenCalled()
    expect(mocks.createCapture).toHaveBeenCalledOnce()
  })

  it('disposes a microphone permission result that arrives after pause and does not restart', async () => {
    const permission = deferred<BuildingVoiceCapture>()
    const capture = recorder()
    mocks.createCapture.mockReturnValue(permission.promise)
    const { result } = renderHook(() => useBuildingVoiceControls(options()))
    act(() => { void result.current.start() })
    expect(result.current.status).toBe('starting')
    act(() => { result.current.pause() })
    expect(requestCallbacks().signal.aborted).toBe(true)
    await act(async () => { permission.resolve(capture) })
    expect(capture.close).toHaveBeenCalledOnce()
    expect(capture.setListening).not.toHaveBeenCalled()
    expect(result.current.status).toBe('paused')
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('stops for hidden pages and only resumes with another user click', async () => {
    const pending = deferred<Response>()
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockReturnValue(pending.promise)
    const opts = options()
    const { result } = renderHook(() => useBuildingVoiceControls(opts))
    await act(async () => { await result.current.start() })
    await emitSegment()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(requestCallbacks().signal.aborted).toBe(true)
    expect(capture.close).toHaveBeenCalledOnce()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => { document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(30_000) })
    await act(async () => { pending.resolve(response('next')) })
    expect(result.current.status).toBe('paused')
    expect(opts.onNavigate).not.toHaveBeenCalled()
    expect(mocks.createCapture).toHaveBeenCalledOnce()
    await act(async () => { await result.current.resume() })
    expect(mocks.createCapture).toHaveBeenCalledTimes(2)
  })

  it('yields the microphone session to tutor playback and never auto-resumes', async () => {
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    const { result } = renderHook(() => useBuildingVoiceControls(options()))
    await act(async () => { await result.current.start() })
    act(() => { mocks.claim.mock.calls[0][1]() })
    expect(capture.close).toHaveBeenCalledOnce()
    expect(mocks.release).toHaveBeenCalledOnce()
    expect(result.current.status).toBe('paused')
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(mocks.createCapture).toHaveBeenCalledOnce()
  })

  it.each([401, 403, 429, 500])('pauses after HTTP %s and does not silently retry', async (status) => {
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockResolvedValue(response(null, status))
    const opts = options()
    const { result } = renderHook(() => useBuildingVoiceControls(opts))
    await act(async () => { await result.current.start() })
    await emitSegment()
    expect(result.current.status).toBe('error')
    expect(result.current.isActive).toBe(false)
    expect(capture.close).toHaveBeenCalledOnce()
    act(() => { vi.advanceTimersByTime(10 * 60_000) })
    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(opts.onNavigate).not.toHaveBeenCalled()
  })

  it('stops a network failure instead of repeatedly opening requests', async () => {
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockRejectedValue(new TypeError('offline'))
    const { result } = renderHook(() => useBuildingVoiceControls(options()))
    await act(async () => { await result.current.start() })
    await emitSegment()
    expect(result.current.feedback).toContain('网络')
    expect(result.current.status).toBe('error')
    expect(requestCallbacks().signal.aborted).toBe(true)
    expect(capture.close).toHaveBeenCalledOnce()
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(mocks.fetch).toHaveBeenCalledOnce()
  })

  it.each(['course_voice_minute_limit', 'course_voice_daily_limit'])('shows the bounded server explanation for %s', async (code) => {
    mocks.createCapture.mockResolvedValue(recorder())
    const error = code === 'course_voice_daily_limit' ? '今日语音控制次数已用完，明天再试。' : '语音操作太频繁，请稍后再试。'
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ code, error, retryAfterSeconds: 60 }), { status: 429 }))
    const { result } = renderHook(() => useBuildingVoiceControls(options()))
    await act(async () => { await result.current.start() })
    await emitSegment()
    expect(result.current.feedback).toBe(error)
    expect(result.current.status).toBe('error')
  })

  it('rechecks cancellation immediately before navigation if audio confirmation is interrupted', async () => {
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockResolvedValue(response('next'))
    vi.mocked(capture.playCue).mockImplementation(() => requestCallbacks().onError(new Error('audio interrupted')))
    const opts = options()
    const { result } = renderHook(() => useBuildingVoiceControls(opts))
    await act(async () => { await result.current.start() })
    await emitSegment()
    expect(opts.onNavigate).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
  })

  it('aborts a timed-out recognition and drops its result if the server later finishes', async () => {
    const pending = deferred<Response>()
    mocks.createCapture.mockResolvedValue(recorder())
    mocks.fetch.mockReturnValue(pending.promise)
    const opts = options()
    const { result } = renderHook(() => useBuildingVoiceControls(opts))
    await act(async () => { await result.current.start() })
    await emitSegment()
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(result.current.status).toBe('error')
    expect(result.current.feedback).toContain('超时')
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => { pending.resolve(response('next')) })
    expect(opts.onNavigate).not.toHaveBeenCalled()
    expect(mocks.fetch).toHaveBeenCalledOnce()
  })

  it.each(['chat', 'next,next', undefined, { command: 'next' }])('rejects an unexpected response command %j', async (command) => {
    mocks.createCapture.mockResolvedValue(recorder())
    mocks.fetch.mockResolvedValue(response(command))
    const opts = options()
    const { result } = renderHook(() => useBuildingVoiceControls(opts))
    await act(async () => { await result.current.start() })
    await emitSegment()
    expect(opts.onNavigate).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
  })

  it.each([['pause', 'paused'], ['exit', 'idle']])('honors spoken %s and closes the microphone', async (command, expectedStatus) => {
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockResolvedValue(response(command))
    const { result } = renderHook(() => useBuildingVoiceControls(options()))
    await act(async () => { await result.current.start() })
    await emitSegment()
    expect(result.current.status).toBe(expectedStatus)
    expect(capture.close).toHaveBeenCalledOnce()
    expect(requestCallbacks().signal.aborted).toBe(true)
  })

  it('cancels microphone, recognition and pending feedback when the component unmounts', async () => {
    const pending = deferred<Response>()
    const capture = recorder()
    mocks.createCapture.mockResolvedValue(capture)
    mocks.fetch.mockReturnValue(pending.promise)
    const opts = options()
    const { result, unmount } = renderHook(() => useBuildingVoiceControls(opts))
    await act(async () => { await result.current.start() })
    await emitSegment()
    unmount()
    expect(capture.close).toHaveBeenCalledOnce()
    expect(requestCallbacks().signal.aborted).toBe(true)
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => { pending.resolve(response('next')); vi.advanceTimersByTime(30_000) })
    expect(opts.onNavigate).not.toHaveBeenCalled()
  })
})
