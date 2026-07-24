import { afterEach, describe, expect, it, vi } from 'vitest'

type MockAsrSocket = {
  url: string
  options: { headers?: Record<string, string> }
  sent: string[]
  close: ReturnType<typeof vi.fn>
  emit: (event: string, ...args: unknown[]) => void
}

const asrSocketMock = vi.hoisted(() => ({
  instances: [] as MockAsrSocket[],
}))

vi.mock('ws', () => {
  class MockWebSocket {
    url: string
    options: { headers?: Record<string, string> }
    sent: string[] = []
    close = vi.fn()
    private listeners = new Map<string, Array<(...args: unknown[]) => void>>()

    constructor(url: string, options: { headers?: Record<string, string> }) {
      this.url = url
      this.options = options
      asrSocketMock.instances.push(this)
    }

    on(event: string, listener: (...args: unknown[]) => void) {
      const listeners = this.listeners.get(event) ?? []
      listeners.push(listener)
      this.listeners.set(event, listeners)
      return this
    }

    send(payload: string) {
      this.sent.push(payload)
    }

    emit(event: string, ...args: unknown[]) {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(...args)
      }
    }
  }

  return { default: MockWebSocket }
})

import {
  extractDashScopeAudioUrl,
  MAX_TUTOR_TTS_TEXT_CHARS,
  sanitizeTutorSpeechText,
  synthesizeTutorSpeech,
  transcribeTutorSpeechPcm16,
  TutorSpeechError,
} from '@/lib/ai/tutor/speech'

const originalApiKey = process.env.DASHSCOPE_API_KEY

afterEach(() => {
  process.env.DASHSCOPE_API_KEY = originalApiKey
  asrSocketMock.instances.length = 0
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

describe('transcribeTutorSpeechPcm16', () => {
  it('authenticates the websocket handshake and completes the manual ASR flow', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-dashscope-key'
    const audio = Uint8Array.from([0, 1, 2, 3]).buffer

    const transcription = transcribeTutorSpeechPcm16(audio)
    const socket = asrSocketMock.instances[0]

    expect(socket.url).toContain('model=qwen3-asr-flash-realtime')
    expect(socket.options.headers).toMatchObject({
      Authorization: 'Bearer test-dashscope-key',
      'OpenAI-Beta': 'realtime=v1',
    })

    socket.emit('open')
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      type: 'session.update',
      session: {
        input_audio_format: 'pcm',
        sample_rate: 16_000,
        turn_detection: null,
      },
    })

    socket.emit('message', Buffer.from(JSON.stringify({ type: 'session.updated' })))
    expect(socket.sent.slice(1).map((event) => JSON.parse(event).type)).toEqual([
      'input_audio_buffer.append',
      'input_audio_buffer.commit',
      'session.finish',
    ])
    expect(JSON.parse(socket.sent[1]).audio).toBe(Buffer.from(audio).toString('base64'))

    socket.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'conversation.item.input_audio_transcription.completed',
          transcript: '你好，小迪',
        }),
      ),
    )
    socket.emit('message', Buffer.from(JSON.stringify({ type: 'session.finished' })))

    await expect(transcription).resolves.toBe('你好，小迪')
    expect(socket.close).toHaveBeenCalledOnce()
  })
})
