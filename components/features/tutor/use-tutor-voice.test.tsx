import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  toast: vi.fn(),
  pcmPlayer: {
    resume: vi.fn(),
    enqueue: vi.fn(),
    markStreamComplete: vi.fn(),
    stop: vi.fn(),
  },
  audioPlay: vi.fn(),
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/lib/context/login-prompt-context', () => ({
  useLoginPrompt: () => ({ promptLogin: vi.fn() }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock('@/components/features/tutor/tutor-pcm-player', () => ({
  createTutorPcmPlayer: () => mocks.pcmPlayer,
  decodeBase64ToArrayBuffer: () => new ArrayBuffer(4),
}))

vi.mock('@/components/features/tutor/tutor-stream-protocol', () => ({
  readTutorStreamEvents: async function* () {
    yield { type: 'audio', pcm: 'AQIDBA==', sampleRate: 24_000 }
    yield { type: 'audio_done' }
  },
}))

import { useTutorVoice } from './use-tutor-voice'

describe('useTutorVoice speech fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pcmPlayer.resume.mockRejectedValue(new Error('AudioContext unavailable'))
    mocks.fetch.mockReset().mockImplementation(async (url: string) => url.endsWith('/voices')
      ? { ok: true, json: async () => ({ voice: 'yezhiqing_v3.1', canChoose: false }) }
      : { ok: true, headers: { get: () => 'text/event-stream; charset=utf-8' }, body: {} })
    vi.stubGlobal('fetch', mocks.fetch)
    vi.stubGlobal(
      'Audio',
      class MockAudio {
        onended: (() => void) | null = null
        onerror: (() => void) | null = null
        constructor(public src: string) {}
        play = mocks.audioPlay.mockResolvedValue(undefined)
        pause = vi.fn()
      },
    )
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:tts-fallback'),
      revokeObjectURL: vi.fn(),
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    })
  })

  it('falls back to native audio when Web Audio cannot play PCM', async () => {
    const contextKeyRef = { current: 'global:' }
    const busyRef = { current: false }
    const { result } = renderHook(() =>
      useTutorVoice({
        open: true,
        mounted: true,
        hideOnMobile: false,
        contextKey: 'global:',
        contextKeyRef,
        quota: null,
        busyRef,
        onComposerTranscript: vi.fn(),
        onLongPressTranscript: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.playSpeech('这是一段测试语音。', 'chat-1')
    })

    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(mocks.fetch.mock.calls[1]?.[1]?.body)).toEqual({
      text: '这是一段测试语音。',
    })
    expect(mocks.audioPlay).toHaveBeenCalledOnce()
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('does not request speech after unmounting while audio activation is pending', async () => {
    let resume!: () => void
    mocks.pcmPlayer.resume.mockImplementationOnce(() => new Promise<void>((resolve) => { resume = resolve }))
    const opts = {
      open: true, mounted: true, hideOnMobile: false, contextKey: 'global:',
      contextKeyRef: { current: 'global:' }, busyRef: { current: false }, quota: null,
      onComposerTranscript: vi.fn(), onLongPressTranscript: vi.fn(),
    }
    const { result, unmount } = renderHook(() => useTutorVoice(opts))
    let playback!: Promise<void>
    act(() => { playback = result.current.playSpeech('私人回复', 'private') })
    unmount()
    await act(async () => { resume(); await playback })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.audioPlay).not.toHaveBeenCalled()
  })

  it('plays the streamed PCM response when Web Audio is available', async () => {
    mocks.pcmPlayer.resume.mockResolvedValue(undefined)
    const contextKeyRef = { current: 'global:' }
    const busyRef = { current: false }
    const { result } = renderHook(() =>
      useTutorVoice({
        open: true,
        mounted: true,
        hideOnMobile: false,
        contextKey: 'global:',
        contextKeyRef,
        quota: null,
        busyRef,
        onComposerTranscript: vi.fn(),
        onLongPressTranscript: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.playSpeech('这是一段流式测试语音。', 'chat-stream-1')
    })

    expect(mocks.pcmPlayer.enqueue).toHaveBeenCalledWith(expect.any(ArrayBuffer), 24_000)
    expect(mocks.pcmPlayer.markStreamComplete).toHaveBeenCalled()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.audioPlay).not.toHaveBeenCalled()
  })

  it('replays complete audio without synthesis and invalidates on voice changes', async () => {
    mocks.pcmPlayer.resume.mockResolvedValue(undefined)
    const opts = {
      open: true, mounted: true, hideOnMobile: false, contextKey: 'global:',
      contextKeyRef: { current: 'global:' }, busyRef: { current: false }, quota: null,
      onComposerTranscript: vi.fn(), onLongPressTranscript: vi.fn(),
    }
    const { result } = renderHook(() => useTutorVoice(opts))
    await act(async () => { await result.current.playSpeech('相同内容', 'same') })
    act(() => result.current.stopSpeechPlayback())
    await act(async () => { await result.current.playSpeech('相同内容', 'same') })
    expect(mocks.fetch.mock.calls.filter(([url]) => url.endsWith('/synthesize'))).toHaveLength(1)
    expect(mocks.audioPlay).toHaveBeenCalledOnce()
    act(() => window.dispatchEvent(new Event('tutor-voice-selection-changed')))
    await act(async () => { await result.current.playSpeech('相同内容', 'same') })
    expect(mocks.fetch.mock.calls.filter(([url]) => url.endsWith('/synthesize'))).toHaveLength(2)
  })

  it('does not retry a 429 response or download a second fallback', async () => {
    mocks.pcmPlayer.resume.mockResolvedValue(undefined)
    mocks.fetch.mockImplementation(async (url: string) => url.endsWith('/voices')
      ? { ok: true, json: async () => ({ voice: 'yezhiqing_v3.1', canChoose: false }) }
      : { ok: false, status: 429, json: async () => ({ error: '请求较多' }) })
    const opts = {
      open: true, mounted: true, hideOnMobile: false, contextKey: 'global:',
      contextKeyRef: { current: 'global:' }, busyRef: { current: false }, quota: null,
      onComposerTranscript: vi.fn(), onLongPressTranscript: vi.fn(),
    }
    const { result } = renderHook(() => useTutorVoice(opts))
    await act(async () => { await result.current.playSpeech('测试', 'limited') })
    expect(mocks.fetch.mock.calls.filter(([url]) => url.endsWith('/synthesize'))).toHaveLength(1)
    expect(mocks.audioPlay).not.toHaveBeenCalled()
    expect(result.current.speechLoadingKey).toBeNull()
  })
})
