import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), recorder: vi.fn(), capture: vi.fn(), player: vi.fn(), resume: vi.fn(), toast: vi.fn(),
}))

vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }))
vi.mock('@/lib/context/login-prompt-context', () => ({ useLoginPrompt: () => ({ promptLogin: vi.fn() }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('./tutor-voice', async (original) => ({
  ...await original<typeof import('./tutor-voice')>(), createTutorPcmRecorder: mocks.recorder,
}))
vi.mock('./tutor-pcm-player', () => ({
  createTutorPcmPlayer: mocks.player,
  decodeBase64ToArrayBuffer: () => new ArrayBuffer(4),
}))
vi.mock('@/components/features/courses/building-voice-capture', () => ({ createBuildingVoiceCapture: mocks.capture }))

import { useTutorVoice } from './use-tutor-voice'
import { useBuildingVoiceControls } from '@/components/features/courses/use-building-voice-controls'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

function recorder() {
  return {
    cancel: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue({ blob: new Blob(['pcm']), durationMs: 1000 }),
  }
}

function capture() {
  return {
    setListening: vi.fn(), reset: vi.fn(), playCue: vi.fn(), close: vi.fn().mockResolvedValue(undefined),
  }
}

function player(onEnded?: () => void) {
  return {
    resume: vi.fn(() => mocks.resume()), enqueue: vi.fn(), markStreamComplete: vi.fn(), stop: vi.fn(), onEnded,
  }
}

const players: ReturnType<typeof player>[] = []
const audios: MockAudio[] = []
class MockAudio {
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  constructor(public src: string) { audios.push(this) }
}

function renderVoices() {
  const tutorOptions = {
    open: true, mounted: true, hideOnMobile: false, contextKey: 'course:5',
    contextKeyRef: { current: 'course:5' }, quota: null, busyRef: { current: false },
    onComposerTranscript: vi.fn(), onLongPressTranscript: vi.fn(),
  }
  const courseOptions = {
    courseId: 5, lessonId: 30, userId: 'user-a', navigationKey: 'visit-1',
    stepIndex: 1, stepCount: 8, onNavigate: vi.fn(),
  }
  const hook = renderHook(() => ({
    tutor: useTutorVoice(tutorOptions),
    course: useBuildingVoiceControls(courseOptions),
  }))
  return { ...hook, tutorOptions, courseOptions }
}

describe('tutor and building voice ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch.mockReset()
    mocks.recorder.mockReset().mockImplementation(async () => recorder())
    mocks.capture.mockReset().mockImplementation(async () => capture())
    mocks.resume.mockReset().mockResolvedValue(undefined)
    players.length = 0
    audios.length = 0
    mocks.player.mockImplementation((options: { onEnded?: () => void }) => {
      const created = player(options.onEnded)
      players.push(created)
      return created
    })
    vi.stubGlobal('fetch', mocks.fetch)
    vi.stubGlobal('Audio', MockAudio)
    vi.stubGlobal('URL', {
      ...URL, createObjectURL: vi.fn(() => 'blob:speech'), revokeObjectURL: vi.fn(),
    })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('pauses course listening before tutor recording, then cancels tutor recording when course resumes', async () => {
    const courseCapture = capture()
    const tutorRecorder = recorder()
    mocks.capture.mockResolvedValue(courseCapture)
    mocks.recorder.mockResolvedValue(tutorRecorder)
    const { result } = renderVoices()

    await act(async () => { await result.current.course.start() })
    expect(result.current.course.status).toBe('listening')
    await act(async () => { result.current.tutor.toggleVoiceRecording() })
    expect(result.current.course.status).toBe('paused')
    expect(courseCapture.close).toHaveBeenCalledOnce()
    expect(courseCapture.close.mock.invocationCallOrder[0]).toBeLessThan(mocks.recorder.mock.invocationCallOrder[0])
    expect(result.current.tutor.recordingVoice).toBe(true)

    await act(async () => { await result.current.course.resume() })
    expect(tutorRecorder.cancel).toHaveBeenCalledOnce()
    expect(result.current.tutor.recordingVoice).toBe(false)
    expect(result.current.course.status).toBe('listening')
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('cancels a late tutor microphone grant without releasing the course that took over', async () => {
    const microphone = deferred<ReturnType<typeof recorder>>()
    const oldRecorder = recorder()
    mocks.recorder.mockReturnValueOnce(microphone.promise)
    const { result } = renderVoices()
    act(() => result.current.tutor.longPress.begin())
    await act(async () => { await result.current.course.start() })
    await act(async () => microphone.resolve(oldRecorder))

    expect(oldRecorder.cancel).toHaveBeenCalledOnce()
    expect(result.current.tutor.recordingVoice).toBe(false)
    expect(result.current.course.status).toBe('listening')
    await act(async () => { result.current.tutor.toggleVoiceRecording() })
    expect(result.current.course.status).toBe('paused')
  })

  it('aborts pending tutor ASR and never submits its late transcript after course takeover', async () => {
    const transcription = deferred<Response>()
    mocks.fetch.mockReturnValueOnce(transcription.promise)
    const { result, tutorOptions } = renderVoices()
    await act(async () => { result.current.tutor.toggleVoiceRecording() })
    await act(async () => { result.current.tutor.toggleVoiceRecording() })
    expect(result.current.tutor.transcribingVoice).toBe(true)
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal
    await act(async () => { await result.current.course.start() })
    expect(signal.aborted).toBe(true)
    await act(async () => transcription.resolve(new Response(JSON.stringify({ transcript: '旧语音' }))))

    expect(tutorOptions.onComposerTranscript).not.toHaveBeenCalled()
    expect(tutorOptions.onLongPressTranscript).not.toHaveBeenCalled()
    expect(result.current.tutor.transcribingVoice).toBe(false)
    expect(result.current.course.status).toBe('listening')
  })

  it('pauses course capture before PCM playback and rejects old PCM after course resumes', async () => {
    const courseCapture = capture()
    mocks.capture.mockResolvedValue(courseCapture)
    const { result } = renderVoices()
    await act(async () => { await result.current.course.start() })
    await act(async () => { await result.current.tutor.beginStreamedSpeech('answer-1') })
    expect(result.current.course.status).toBe('paused')
    expect(courseCapture.close.mock.invocationCallOrder[0]).toBeLessThan(players[0].resume.mock.invocationCallOrder[0])
    act(() => { expect(result.current.tutor.pushStreamedPcm('AAAA', 24_000, 'answer-1')).toBe(true) })
    expect(result.current.tutor.playingSpeechKey).toBe('answer-1')
    await act(async () => { await result.current.course.resume() })

    expect(players[0].stop).toHaveBeenCalledOnce()
    act(() => {
      expect(result.current.tutor.pushStreamedPcm('AAAA', 24_000, 'answer-1')).toBeNull()
      expect(result.current.tutor.finishStreamedSpeech('answer-1')).toBeNull()
    })
    expect(players[0].enqueue).toHaveBeenCalledOnce()
    expect(result.current.tutor.playingSpeechKey).toBeNull()
    expect(result.current.course.status).toBe('listening')
  })

  it('cancels a tutor microphone before starting its own TTS interaction', async () => {
    const oldRecorder = recorder()
    mocks.recorder.mockResolvedValue(oldRecorder)
    const { result } = renderVoices()
    await act(async () => { result.current.tutor.toggleVoiceRecording() })
    await act(async () => { await result.current.tutor.beginStreamedSpeech('answer') })
    expect(oldRecorder.cancel).toHaveBeenCalledOnce()
    expect(result.current.tutor.recordingVoice).toBe(false)
    expect(oldRecorder.cancel.mock.invocationCallOrder[0]).toBeLessThan(players[0].resume.mock.invocationCallOrder[0])
  })

  it('does not let delayed activation borrow a newer speech request with the same key', async () => {
    const activation = deferred<void>()
    mocks.resume.mockReturnValueOnce(activation.promise)
    const { result } = renderVoices()
    let oldPlayback!: Promise<void>
    act(() => { oldPlayback = result.current.tutor.playSpeech('不能重新发送的旧文字', 'same-key') })
    await act(async () => { await result.current.course.start() })
    await act(async () => { await result.current.tutor.beginStreamedSpeech('same-key') })
    await act(async () => { activation.resolve(); await oldPlayback })

    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(audios).toHaveLength(0)
    act(() => { expect(result.current.tutor.pushStreamedPcm('AAAA', 24_000, 'same-key')).toBe(true) })
    expect(players[1].enqueue).toHaveBeenCalledOnce()
    expect(players[0].enqueue).not.toHaveBeenCalled()
  })

  it('keeps native-audio fallback cancellable while its blob is still pending', async () => {
    const blob = deferred<Blob>()
    mocks.fetch.mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'audio/mpeg' }), blob: () => blob.promise })
    const { result } = renderVoices()
    let playback!: Promise<void>
    await act(async () => { playback = result.current.tutor.playSpeech('等待音频', 'native') })
    expect(mocks.fetch).toHaveBeenCalledOnce()
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal
    await act(async () => { await result.current.course.start() })
    expect(signal.aborted).toBe(true)
    await act(async () => { blob.resolve(new Blob(['mpeg'])); await playback })

    expect(audios).toHaveLength(0)
    expect(result.current.course.status).toBe('listening')
  })

  it('stops native audio on takeover and ignores its obsolete ended callback', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true, headers: new Headers({ 'content-type': 'audio/mpeg' }), blob: async () => new Blob(['mpeg']),
    })
    const { result } = renderVoices()
    await act(async () => { await result.current.tutor.playSpeech('原生音频', 'native') })
    expect(audios[0].play).toHaveBeenCalledOnce()
    const ended = audios[0].onended
    await act(async () => { await result.current.course.start() })
    expect(audios[0].pause).toHaveBeenCalledOnce()
    expect(audios[0].src).toBe('')
    act(() => ended?.())
    expect(result.current.course.status).toBe('listening')
    await act(async () => { await result.current.tutor.beginStreamedSpeech('new') })
    expect(result.current.course.status).toBe('paused')
  })

  it('invalidates an empty completed stream if another audio session starts before text completion', async () => {
    const { result } = renderVoices()
    await act(async () => { await result.current.tutor.beginStreamedSpeech('empty') })
    act(() => { expect(result.current.tutor.finishStreamedSpeech('empty')).toBe(false) })
    expect(players[0].stop).not.toHaveBeenCalled()
    await act(async () => { await result.current.course.start() })
    // Natural completion released the lease; generation still records this intervening claim.
    expect(players[0].stop).not.toHaveBeenCalled()
    act(() => {
      expect(result.current.tutor.finishStreamedSpeech('empty')).toBeNull()
      expect(result.current.tutor.pushStreamedPcm('AAAA', 24_000, 'empty')).toBeNull()
      result.current.course.exit()
      expect(result.current.tutor.finishStreamedSpeech('empty')).toBeNull()
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('releases a naturally finished PCM lease and ignores old player callbacks during later playback', async () => {
    const { result } = renderVoices()
    await act(async () => { await result.current.tutor.beginStreamedSpeech('first') })
    act(() => {
      result.current.tutor.pushStreamedPcm('AAAA', 24_000, 'first')
      result.current.tutor.finishStreamedSpeech('first')
      players[0].onEnded?.()
    })
    expect(result.current.tutor.playingSpeechKey).toBeNull()
    await act(async () => { await result.current.course.start() })
    expect(players[0].stop).not.toHaveBeenCalled()
    await act(async () => { await result.current.tutor.beginStreamedSpeech('second') })
    act(() => {
      result.current.tutor.pushStreamedPcm('AAAA', 24_000, 'second')
      players[0].onEnded?.()
    })
    expect(result.current.tutor.playingSpeechKey).toBe('second')
  })
})
