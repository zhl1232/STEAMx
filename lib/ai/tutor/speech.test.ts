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
  createTutorRealtimeTtsSession,
  createTutorSpeechSanitizer,
  extractDashScopeAudioUrl,
  findTutorSpeechHoldIndex,
  MAX_TUTOR_TTS_TEXT_CHARS,
  sanitizeTutorSpeechText,
  synthesizeTutorSpeech,
  transcribeTutorSpeechPcm16,
  TUTOR_TTS_PCM_SAMPLE_RATE,
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

  it('maps TTS audio download timeouts to a 504 speech error', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-dashscope-key'
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ output: { audio: { url: 'https://example.com/audio.wav' } } }),
        })
        .mockRejectedValueOnce(new DOMException('The operation timed out.', 'TimeoutError')),
    )

    await expect(synthesizeTutorSpeech('你好')).rejects.toMatchObject({
      name: 'TutorSpeechError',
      status: 504,
      message: 'DashScope TTS audio download timed out',
    })
  })
})

describe('createTutorSpeechSanitizer', () => {
  it('holds incomplete project chips until they close, then speaks the title', () => {
    const sanitizer = createTutorSpeechSanitizer()

    expect(sanitizer.push('再看 ')).toBe('再看')
    expect(sanitizer.push('[project:12|纸')).toBe('')
    expect(sanitizer.push('桥挑战] 吧')).toBe(' 纸桥挑战 吧')
  })

  it('matches full-text sanitizer after flush', () => {
    const sanitizer = createTutorSpeechSanitizer()
    const source =
      '听这个：[audio:/birds/audio/crow.ogg|黑头鸦]\n\n再看 [project:12|纸桥挑战]，去学 [course:88|五子棋博弈论入门]，拖 [[cat:events]] 的 [[block:events|当绿旗被点击]]。'

    let spoken = ''
    for (const chunk of source.split('')) {
      spoken += sanitizer.push(chunk)
    }
    spoken += sanitizer.flush()

    expect(spoken).toBe(sanitizeTutorSpeechText(source))
  })

  it('holds incomplete markdown links until they close', () => {
    const sanitizer = createTutorSpeechSanitizer()

    expect(sanitizer.push('看 [链')).toBe('看')
    expect(sanitizer.push('接](https://example.com) 吧')).toBe(' 链接 吧')
  })

  it('holds incomplete scratch category tags', () => {
    const sanitizer = createTutorSpeechSanitizer()

    expect(sanitizer.push('拖 [[cat:eve')).toBe('拖')
    expect(sanitizer.push('nts]]')).toBe(' 事件分类')
  })

  it('does not hold the rest of the reply after a literal bracket pair', () => {
    const sanitizer = createTutorSpeechSanitizer()

    expect(sanitizer.push('看看 [3')).toBe('看看')
    expect(sanitizer.push(', 5] 这一格，然后继续')).toBe(' [3, 5] 这一格，然后继续')
  })

  it('releases a closed bracket pair that is not a markdown link', () => {
    const sanitizer = createTutorSpeechSanitizer()

    expect(sanitizer.push('看 [链接]')).toBe('看')
    expect(sanitizer.push(' 吧')).toBe(' [链接] 吧')
  })

  it('caps streamed speech text at the same length as full sanitizer', () => {
    const sanitizer = createTutorSpeechSanitizer()
    const source = '测'.repeat(MAX_TUTOR_TTS_TEXT_CHARS + 10)

    let spoken = sanitizer.push(source)
    spoken += sanitizer.flush()

    expect(spoken).toHaveLength(MAX_TUTOR_TTS_TEXT_CHARS)
  })
})

describe('findTutorSpeechHoldIndex', () => {
  it('lets literal brackets pass so later text is not stalled', () => {
    const raw = '看看 [3, 5] 这一格，然后继续'
    expect(findTutorSpeechHoldIndex(raw)).toBe(raw.length)
  })

  it('holds an unclosed project chip', () => {
    const raw = '再看 [project:12|纸'
    expect(findTutorSpeechHoldIndex(raw)).toBe(raw.indexOf('['))
  })
})

describe('createTutorRealtimeTtsSession', () => {
  it('streams PCM deltas over the DashScope realtime websocket', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-dashscope-key'
    const chunks: Buffer[] = []
    const session = createTutorRealtimeTtsSession({
      onAudio: (pcm) => chunks.push(pcm),
    })
    const socket = asrSocketMock.instances[0]

    expect(socket.url).toContain('model=qwen3-tts-flash-realtime')
    expect(socket.options.headers).toMatchObject({
      Authorization: 'Bearer test-dashscope-key',
      'OpenAI-Beta': 'realtime=v1',
    })

    socket.emit('open')
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      type: 'session.update',
      session: {
        mode: 'server_commit',
        voice: 'Ethan',
        language_type: 'Chinese',
        response_format: 'pcm',
        sample_rate: TUTOR_TTS_PCM_SAMPLE_RATE,
      },
    })

    session.append('你好')
    socket.emit('message', Buffer.from(JSON.stringify({ type: 'session.updated' })))
    expect(JSON.parse(socket.sent[1])).toMatchObject({
      type: 'input_text_buffer.append',
      text: '你好',
    })

    session.append('，小迪')
    await Promise.resolve()
    expect(JSON.parse(socket.sent[2])).toMatchObject({
      type: 'input_text_buffer.append',
      text: '，小迪',
    })

    const pcm = Buffer.from([1, 2, 3, 4])
    socket.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'response.audio.delta',
          delta: pcm.toString('base64'),
        }),
      ),
    )
    expect(Buffer.concat(chunks).equals(pcm)).toBe(true)

    const finished = session.finish()
    await Promise.resolve()
    expect(JSON.parse(socket.sent.at(-1)!).type).toBe('session.finish')
    socket.emit('message', Buffer.from(JSON.stringify({ type: 'session.finished' })))
    await finished
    expect(socket.close).toHaveBeenCalled()
  })

  it('requires a DashScope API key', () => {
    delete process.env.DASHSCOPE_API_KEY
    expect(() => createTutorRealtimeTtsSession({ onAudio: () => undefined })).toThrow(TutorSpeechError)
    try {
      createTutorRealtimeTtsSession({ onAudio: () => undefined })
    } catch (error) {
      expect(error).toMatchObject({
        name: 'TutorSpeechError',
        status: 503,
      } satisfies Partial<TutorSpeechError>)
    }
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
