import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  extractDashScopeAudioUrl,
  sanitizeTutorSpeechText,
  synthesizeTutorSpeech,
  TutorSpeechError,
  MAX_TUTOR_TTS_TEXT_CHARS,
} from '@/lib/ai/tutor/speech'

const originalApiKey = process.env.DASHSCOPE_API_KEY

afterEach(() => {
  process.env.DASHSCOPE_API_KEY = originalApiKey
  vi.restoreAllMocks()
})

describe('sanitizeTutorSpeechText', () => {
  it('strips tutor markup into readable speech text', () => {
    const text = sanitizeTutorSpeechText(
      '听这个：[audio:/birds/audio/crow.ogg|黑头鸦]\n\n再看 [project:12|纸桥挑战]，去学 [course:88|五子棋博弈论入门]，拖 [[cat:events]] 的 [[block:events|当绿旗被点击]]。',
    )

    expect(text).toBe('听这个： 再看 纸桥挑战，去学 五子棋博弈论入门，拖 事件分类 的 当绿旗被点击。')
  })

  it('limits synthesized speech text length', () => {
    const text = sanitizeTutorSpeechText('测'.repeat(MAX_TUTOR_TTS_TEXT_CHARS + 10))

    expect(text).toHaveLength(MAX_TUTOR_TTS_TEXT_CHARS)
  })
})

describe('extractDashScopeAudioUrl', () => {
  it('reads the common Qwen-TTS audio URL shape', () => {
    expect(
      extractDashScopeAudioUrl({
        output: {
          audio: {
            url: 'https://example.com/audio.wav',
          },
        },
      }),
    ).toBe('https://example.com/audio.wav')
  })

  it('returns null for malformed payloads', () => {
    expect(extractDashScopeAudioUrl({ output: { audio: { url: '/relative.wav' } } })).toBeNull()
  })
})

describe('synthesizeTutorSpeech', () => {
  it('requires a DashScope API key', async () => {
    delete process.env.DASHSCOPE_API_KEY
    await expect(synthesizeTutorSpeech('你好')).rejects.toMatchObject({
      name: 'TutorSpeechError',
      status: 503,
    } satisfies Partial<TutorSpeechError>)
  })
})
