import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTutorVoice } from './use-tutor-voice'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), recorder: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }))
vi.mock('@/lib/context/login-prompt-context', () => ({ useLoginPrompt: () => ({ promptLogin: vi.fn() }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('@/components/features/tutor/tutor-voice', async (original) => ({
  ...await original<typeof import('./tutor-voice')>(), createTutorPcmRecorder: mocks.recorder,
}))

function options() {
  return {
    open: true, mounted: true, hideOnMobile: false, contextKey: 'home', contextKeyRef: { current: 'home' },
    quota: null, busyRef: { current: false }, onComposerTranscript: vi.fn(), onLongPressTranscript: vi.fn(),
  }
}
function recorder() {
  return { cancel: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue({ blob: new Blob(['pcm']), durationMs: 1000 }) }
}

describe('tutor microphone lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch.mockReset()
    mocks.recorder.mockReset()
    vi.stubGlobal('fetch', mocks.fetch)
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  })

  it('discards a long-press recording when dragging instead of transcribing or sending', async () => {
    const rec = recorder()
    mocks.recorder.mockResolvedValue(rec)
    const opts = options()
    const { result } = renderHook(() => useTutorVoice(opts))
    await act(async () => { result.current.longPress.begin() })
    act(() => { result.current.longPress.cancelForDrag() })
    act(() => { result.current.longPress.release() })
    expect(rec.cancel).toHaveBeenCalledOnce()
    expect(rec.stop).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(opts.onLongPressTranscript).not.toHaveBeenCalled()
    expect(result.current.recordingVoice).toBe(false)
    expect(result.current.transcribingVoice).toBe(false)
  })

  it('cancels a pending microphone permission result after the gesture becomes a drag', async () => {
    const rec = recorder()
    let resolve!: (value: typeof rec) => void
    mocks.recorder.mockReturnValue(new Promise((r) => { resolve = r }))
    const opts = options()
    const { result } = renderHook(() => useTutorVoice(opts))
    act(() => { result.current.longPress.begin() })
    act(() => { result.current.longPress.cancelForDrag() })
    await act(async () => { resolve(rec) })
    expect(rec.cancel).toHaveBeenCalledOnce()
    expect(rec.stop).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(result.current.recordingVoice).toBe(false)
  })

  it('still transcribes and sends an ordinary long-press release', async () => {
    mocks.recorder.mockResolvedValue(recorder())
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ transcript: '帮我看看' })))
    const opts = options()
    const { result } = renderHook(() => useTutorVoice(opts))
    await act(async () => { result.current.longPress.begin() })
    await act(async () => { result.current.longPress.release() })
    expect(opts.onLongPressTranscript).toHaveBeenCalledWith('帮我看看', expect.any(Object))
  })

  it('cancels a microphone that opens after its scene has gone away', async () => {
    const rec = recorder()
    let resolve!: (value: typeof rec) => void
    mocks.recorder.mockReturnValue(new Promise((r) => { resolve = r }))
    const opts = options()
    const { result, rerender } = renderHook(({ key }) => useTutorVoice({ ...opts, contextKey: key }), { initialProps: { key: 'home' } })
    act(() => { result.current.toggleVoiceRecording() })
    opts.contextKeyRef.current = 'explore'
    rerender({ key: 'explore' })
    await act(async () => { resolve(rec) })
    expect(rec.cancel).toHaveBeenCalledOnce()
    expect(result.current.recordingVoice).toBe(false)
  })

  it('an old transcript cannot clear a new transcription or fill its input', async () => {
    mocks.recorder.mockImplementation(async () => recorder())
    let resolveOld!: (value: Response) => void
    let resolveNew!: (value: Response) => void
    mocks.fetch.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
      .mockReturnValueOnce(new Promise((r) => { resolveNew = r }))
    const opts = options()
    const { result, rerender } = renderHook(({ key }) => useTutorVoice({ ...opts, contextKey: key }), { initialProps: { key: 'home' } })
    await act(async () => { result.current.toggleVoiceRecording() })
    await act(async () => { result.current.toggleVoiceRecording() })
    expect(result.current.transcribingVoice).toBe(true)
    opts.contextKeyRef.current = 'explore'
    rerender({ key: 'explore' })
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => { result.current.toggleVoiceRecording() })
    await act(async () => { result.current.toggleVoiceRecording() })
    await act(async () => { resolveOld(new Response(JSON.stringify({ transcript: '旧录音' }))) })
    expect(result.current.transcribingVoice).toBe(true)
    expect(opts.onComposerTranscript).not.toHaveBeenCalled()
    await act(async () => { resolveNew(new Response(JSON.stringify({ transcript: '新录音' }))) })
    expect(opts.onComposerTranscript).toHaveBeenCalledWith('新录音')
    expect(result.current.transcribingVoice).toBe(false)
  })
})
