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
    mocks.fetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'text/event-stream; charset=utf-8' },
        body: {},
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['audio']),
      })
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
      fallback: true,
    })
    expect(mocks.audioPlay).toHaveBeenCalledOnce()
    expect(mocks.toast).not.toHaveBeenCalled()
  })
})
