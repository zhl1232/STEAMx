import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withSpeechUsage: vi.fn(),
  createTutorSpeechStreamer: vi.fn(),
  sanitizeTutorSpeechText: vi.fn((text: string) => text.trim()),
}))

vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }))
vi.mock('./speech-budget', () => ({ reserveSpeechRequest: vi.fn().mockResolvedValue(undefined) }))
vi.mock('./speech-usage', () => ({ withSpeechUsage: mocks.withSpeechUsage }))
vi.mock('./speech', () => ({
  createTutorSpeechStreamer: mocks.createTutorSpeechStreamer,
  sanitizeTutorSpeechText: mocks.sanitizeTutorSpeechText,
  synthesizeTutorSpeech: vi.fn(),
  transcribeTutorSpeechPcm16: vi.fn(),
  MAX_TUTOR_SPEECH_PCM_BYTES: 1_000_000,
}))

import { createGuardedTutorSpeechStreamer } from './guarded-speech'

describe('createGuardedTutorSpeechStreamer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sanitizeTutorSpeechText.mockImplementation((text: string) => text.trim())
  })

  it('notifies when the provider finishes without audio so the client gets audio_error', async () => {
    const onError = vi.fn()
    const onAudio = vi.fn()
    mocks.withSpeechUsage.mockImplementation(async (_user: string, _kind: string, _units: number, run: () => Promise<boolean>) => run())
    mocks.createTutorSpeechStreamer.mockReturnValue({
      start: vi.fn(),
      push: vi.fn(),
      finish: vi.fn().mockResolvedValue(false),
      abort: vi.fn(),
    })

    const streamer = createGuardedTutorSpeechStreamer('user-a', { onAudio, onError })
    streamer.push('你好，小迪。')
    await expect(streamer.finish()).resolves.toBe(false)

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0]).toMatchObject({
      userMessage: '这次朗读未完成，可以点击回复旁的朗读按钮重试。',
    })
  })

  it('does not notify when the request was aborted before synthesis', async () => {
    const onError = vi.fn()
    const controller = new AbortController()
    controller.abort()
    const streamer = createGuardedTutorSpeechStreamer('user-a', {
      onAudio: vi.fn(),
      onError,
      signal: controller.signal,
    })
    streamer.push('你好')
    await expect(streamer.finish()).resolves.toBe(false)
    expect(mocks.withSpeechUsage).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
