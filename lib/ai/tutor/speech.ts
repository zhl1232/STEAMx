import { AUDIO_TAG_REGEX } from '@/lib/ai/tutor/audio-tags'

const DEFAULT_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const DEFAULT_TTS_MODEL = 'qwen3-tts-flash'
const DEFAULT_TTS_VOICE = 'Ethan'
const DEFAULT_TTS_LANGUAGE = 'Chinese'
const DEFAULT_ASR_MODEL = 'qwen3-asr-flash-realtime'
const DEFAULT_ASR_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'
const ASR_TIMEOUT_MS = 25_000
const ASR_SAMPLE_RATE = 16_000

export const MAX_TUTOR_TTS_TEXT_CHARS = 800
export const MAX_TUTOR_SPEECH_DURATION_MS = 30_000
export const MAX_TUTOR_SPEECH_PCM_BYTES = ASR_SAMPLE_RATE * 2 * (MAX_TUTOR_SPEECH_DURATION_MS / 1000 + 2)

const PROJECT_TAG_REGEX = /\[project:(\d+)\|([^\]\n]+)\]/g
const MARKDOWN_LINK_REGEX = /\[([^\]\n]+)\]\(([^)\n]+)\)/g
const SCRATCH_BLOCK_REGEX = /\[\[block:[^\]|\n]+(?:\|([^\]\n]+))?\]\]/g
const SCRATCH_CATEGORY_REGEX = /\[\[cat:([^\]|\n]+)\]\]/g

const SCRATCH_CATEGORY_LABELS: Record<string, string> = {
  events: '事件分类',
  motion: '运动分类',
  looks: '外观分类',
  sound: '声音分类',
  control: '控制分类',
  sensing: '侦测分类',
  operators: '运算分类',
  variables: '变量分类',
  lists: '列表分类',
  myBlocks: '自制积木分类',
  pen: '画笔分类',
  music: '音乐分类',
}

type DashScopeAudioResponse = {
  output?: {
    audio?: {
      url?: unknown
      audio_url?: unknown
    }
    url?: unknown
    audio_url?: unknown
    audios?: Array<{ url?: unknown; audio_url?: unknown }>
  }
}

type AsrServerEvent = {
  type?: string
  transcript?: string
  error?: {
    code?: string
    message?: string
    param?: string
  }
}

export class TutorSpeechError extends Error {
  status: number
  userMessage: string

  constructor(message: string, userMessage = '小迪语音暂时不可用，请稍后再试。', status = 500) {
    super(message)
    this.name = 'TutorSpeechError'
    this.userMessage = userMessage
    this.status = status
  }
}

function requireDashScopeApiKey() {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) {
    throw new TutorSpeechError('Missing DASHSCOPE_API_KEY', '服务端未配置语音密钥，请稍后再试。', 503)
  }
  return apiKey
}

function buildEventId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function isNonEmptyUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

export function extractDashScopeAudioUrl(payload: unknown): string | null {
  const response = payload as DashScopeAudioResponse | null
  const candidates = [
    response?.output?.audio?.url,
    response?.output?.audio?.audio_url,
    response?.output?.url,
    response?.output?.audio_url,
    response?.output?.audios?.[0]?.url,
    response?.output?.audios?.[0]?.audio_url,
  ]
  const found = candidates.find(isNonEmptyUrl)
  return found ? found.trim() : null
}

export function sanitizeTutorSpeechText(input: string) {
  const cleaned = input
    .replace(AUDIO_TAG_REGEX, '')
    .replace(PROJECT_TAG_REGEX, '$2')
    .replace(MARKDOWN_LINK_REGEX, '$1')
    .replace(SCRATCH_BLOCK_REGEX, (_match, label: string | undefined) => label ?? '')
    .replace(SCRATCH_CATEGORY_REGEX, (_match, category: string) => SCRATCH_CATEGORY_LABELS[category] ?? 'Scratch 分类')
    .replace(/!\[[^\]\n]*\]\([^)\n]+\)/g, '')
    .replace(/[`*_>#~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned.slice(0, MAX_TUTOR_TTS_TEXT_CHARS)
}

export async function synthesizeTutorSpeech(text: string): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const safeText = sanitizeTutorSpeechText(text)
  if (!safeText) {
    throw new TutorSpeechError('Empty speech text', '这条回复没有可朗读的内容。', 400)
  }

  const apiKey = requireDashScopeApiKey()
  const ttsUrl = process.env.DASHSCOPE_TUTOR_TTS_URL || DEFAULT_TTS_URL
  const model = process.env.DASHSCOPE_TUTOR_TTS_MODEL || DEFAULT_TTS_MODEL
  const voice = process.env.DASHSCOPE_TUTOR_TTS_VOICE || DEFAULT_TTS_VOICE
  const language = process.env.DASHSCOPE_TUTOR_TTS_LANGUAGE || DEFAULT_TTS_LANGUAGE

  const response = await fetch(ttsUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: {
        text: safeText,
        voice,
        language_type: language,
      },
    }),
  })

  const raw = await response.json().catch(() => null)
  if (!response.ok) {
    throw new TutorSpeechError(`DashScope TTS failed (${response.status})`)
  }

  const audioUrl = extractDashScopeAudioUrl(raw)
  if (!audioUrl) {
    throw new TutorSpeechError('DashScope TTS response missing audio URL')
  }

  const audioResponse = await fetch(audioUrl)
  if (!audioResponse.ok) {
    throw new TutorSpeechError(`DashScope TTS audio download failed (${audioResponse.status})`)
  }

  return {
    audio: await audioResponse.arrayBuffer(),
    contentType: audioResponse.headers.get('Content-Type') || 'audio/mpeg',
  }
}

function buildAsrWebSocketUrl() {
  const model = process.env.DASHSCOPE_TUTOR_ASR_MODEL || DEFAULT_ASR_MODEL
  const configuredUrl = process.env.DASHSCOPE_TUTOR_ASR_WS_URL || DEFAULT_ASR_WS_URL
  const url = new URL(configuredUrl)
  url.searchParams.set('model', model)
  return url.toString()
}

function parseServerEvent(data: unknown): AsrServerEvent | null {
  if (typeof data !== 'string') return null
  try {
    const parsed = JSON.parse(data) as AsrServerEvent
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export async function transcribeTutorSpeechPcm16(audio: ArrayBuffer): Promise<string> {
  if (audio.byteLength <= 0) {
    throw new TutorSpeechError('Empty ASR audio', '没有录到声音，请再试一次。', 400)
  }
  if (audio.byteLength > MAX_TUTOR_SPEECH_PCM_BYTES) {
    throw new TutorSpeechError('ASR audio too large', '这段语音太长了，请控制在 30 秒以内。', 400)
  }

  const apiKey = requireDashScopeApiKey()
  const WebSocketCtor = WebSocket as unknown as new (
    url: string,
    protocols?: string | string[],
    options?: { headers?: Record<string, string> },
  ) => WebSocket

  return new Promise((resolve, reject) => {
    let settled = false
    let sentAudio = false
    let transcript = ''
    const timer = setTimeout(() => fail(new TutorSpeechError('ASR timed out')), ASR_TIMEOUT_MS)
    const ws = new WebSocketCtor(buildAsrWebSocketUrl(), [], {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'user-agent': 'steam-explore-share/tutor-speech',
      },
    })

    const finish = (value: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        // ignore
      }
      resolve(value)
    }

    function fail(error: Error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        // ignore
      }
      reject(error)
    }

    const sendJson = (payload: Record<string, unknown>) => {
      ws.send(JSON.stringify(payload))
    }

    const sendAudioAndFinish = () => {
      if (sentAudio) return
      sentAudio = true
      sendJson({
        event_id: buildEventId('audio'),
        type: 'input_audio_buffer.append',
        audio: Buffer.from(audio).toString('base64'),
      })
      sendJson({
        event_id: buildEventId('commit'),
        type: 'input_audio_buffer.commit',
      })
      sendJson({
        event_id: buildEventId('finish'),
        type: 'session.finish',
      })
    }

    ws.addEventListener('open', () => {
      sendJson({
        event_id: buildEventId('session'),
        type: 'session.update',
        session: {
          input_audio_format: 'pcm',
          sample_rate: ASR_SAMPLE_RATE,
          input_audio_transcription: {
            language: 'zh',
          },
          turn_detection: null,
        },
      })
    })

    ws.addEventListener('message', (event) => {
      const payload = parseServerEvent(event.data)
      if (!payload?.type) return

      if (payload.type === 'session.updated') {
        sendAudioAndFinish()
        return
      }

      if (payload.type === 'conversation.item.input_audio_transcription.completed') {
        transcript = typeof payload.transcript === 'string' ? payload.transcript.trim() : ''
        return
      }

      if (payload.type === 'conversation.item.input_audio_transcription.failed') {
        fail(new TutorSpeechError(payload.error?.message || 'ASR transcription failed', '小迪没有听清楚，请再说一次。', 400))
        return
      }

      if (payload.type === 'error') {
        fail(new TutorSpeechError(payload.error?.message || 'ASR server error'))
        return
      }

      if (payload.type === 'session.finished') {
        if (transcript) {
          finish(transcript)
        } else {
          fail(new TutorSpeechError('ASR empty transcript', '小迪没有听清楚，请再说一次。', 400))
        }
      }
    })

    ws.addEventListener('error', () => {
      fail(new TutorSpeechError('ASR websocket error'))
    })
  })
}
