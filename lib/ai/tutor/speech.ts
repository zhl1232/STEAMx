import { AUDIO_TAG_REGEX } from '@/lib/ai/tutor/audio-tags'
import {
  getDashScopeModelCandidates,
  isDashScopeModelAvailabilityError,
  isDashScopeTimeoutError,
  markDashScopeModelUnavailable,
  resolveDashScopeConfig,
} from '@/lib/ai/dashscope'
import WebSocket, { type RawData } from 'ws'

const DEFAULT_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const DEFAULT_TTS_REALTIME_MODEL = 'qwen3-tts-flash-realtime'
const DEFAULT_TTS_VOICE = 'Ethan'
const DEFAULT_TTS_LANGUAGE = 'Chinese'
const DEFAULT_ASR_MODEL = 'qwen3-asr-flash-realtime'
const DEFAULT_ASR_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'
const ASR_TIMEOUT_MS = 25_000
const TTS_TIMEOUT_MS = 20_000
const TTS_REALTIME_CONNECT_TIMEOUT_MS = 10_000
const TTS_REALTIME_SESSION_TIMEOUT_MS = 120_000
const ASR_SAMPLE_RATE = 16_000
export const TUTOR_TTS_PCM_SAMPLE_RATE = 24_000

export const MAX_TUTOR_TTS_TEXT_CHARS = 800
export const MAX_TUTOR_SPEECH_DURATION_MS = 30_000
export const MAX_TUTOR_SPEECH_PCM_BYTES = ASR_SAMPLE_RATE * 2 * (MAX_TUTOR_SPEECH_DURATION_MS / 1000 + 2)

const PROJECT_TAG_REGEX = /\[project:(\d+)\|([^\]\n]+)\]/g
const COURSE_TAG_REGEX = /\[course:(\d+)\|([^\]\n]+)\]/g
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

type RealtimeServerEvent = {
  type?: string
  transcript?: string
  delta?: unknown
  error?: {
    code?: string
    message?: string
    param?: string
  }
}

const COMPLETE_MARKUP_AT_START = [
  /^\[audio:[^|\]\n]+\|[^\]\n]+\]/,
  /^\[project:\d+\|[^\]\n]+\]/,
  /^\[course:\d+\|[^\]\n]+\]/,
  /^\[\[block:[^\]|\n]+(?:\|[^\]\n]+)?\]\]/,
  /^\[\[cat:[^\]|\n]+\]\]/,
  /^\[[^\]\n]+\]\([^)\n]+\)/,
  /^!\[[^\]\n]*\]\([^)\n]+\)/,
]

const CHIP_STARTERS = ['[audio:', '[project:', '[course:'] as const
const SCRATCH_STARTERS = ['[[block:', '[[cat:'] as const

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

function matchCompleteMarkup(text: string) {
  for (const pattern of COMPLETE_MARKUP_AT_START) {
    const match = text.match(pattern)
    if (match?.[0]) return match[0]
  }
  return null
}

function isPrefixOrUnclosed(slice: string, starter: string, closer: string) {
  if (starter.startsWith(slice)) return slice.length > 0
  if (!slice.startsWith(starter)) return false
  return !slice.includes(closer)
}

function isIncompleteMarkdownLink(slice: string, image: boolean) {
  const open = image ? '![' : '['
  if (!slice.startsWith(open)) return false
  const rest = slice.slice(open.length)
  const close = rest.indexOf(']')
  if (close === -1) return true
  const after = rest.slice(close + 1)
  if (after.length === 0) return true
  return after.startsWith('(') && !after.includes(')')
}

function isIncompleteMarkup(slice: string) {
  if (slice.startsWith('![')) return isIncompleteMarkdownLink(slice, true)
  for (const starter of SCRATCH_STARTERS) {
    if (isPrefixOrUnclosed(slice, starter, ']]')) return true
  }
  for (const starter of CHIP_STARTERS) {
    if (isPrefixOrUnclosed(slice, starter, ']')) return true
  }
  return isIncompleteMarkdownLink(slice, false)
}

/** 未闭合的 chip / markdown 先扣住，避免把半截标记送进 TTS。字面量 `[...]` 不卡住后面的字。 */
export function findTutorSpeechHoldIndex(raw: string) {
  let index = 0
  while (index < raw.length) {
    const imageOpen = raw.startsWith('![', index)
    const open = imageOpen ? index : raw.indexOf('[', index)
    if (open === -1) return raw.length
    if (!imageOpen && open > 0 && raw.charAt(open - 1) === '!') {
      const fromBang = raw.slice(open - 1)
      const matched = matchCompleteMarkup(fromBang)
      if (matched) {
        index = open - 1 + matched.length
        continue
      }
      if (isIncompleteMarkup(fromBang)) return open - 1
      index = open + 1
      continue
    }
    const slice = raw.slice(open)
    const matched = matchCompleteMarkup(slice)
    if (matched) {
      index = open + matched.length
      continue
    }
    if (isIncompleteMarkup(slice)) return open
    index = open + 1
  }
  return raw.length
}

export function sanitizeTutorSpeechText(input: string) {
  AUDIO_TAG_REGEX.lastIndex = 0
  PROJECT_TAG_REGEX.lastIndex = 0
  COURSE_TAG_REGEX.lastIndex = 0
  MARKDOWN_LINK_REGEX.lastIndex = 0
  SCRATCH_BLOCK_REGEX.lastIndex = 0
  SCRATCH_CATEGORY_REGEX.lastIndex = 0

  const cleaned = input
    .replace(AUDIO_TAG_REGEX, '')
    .replace(PROJECT_TAG_REGEX, '$2')
    .replace(COURSE_TAG_REGEX, '$2')
    .replace(MARKDOWN_LINK_REGEX, '$1')
    .replace(SCRATCH_BLOCK_REGEX, (_match, label: string | undefined) => label ?? '')
    .replace(SCRATCH_CATEGORY_REGEX, (_match, category: string) => SCRATCH_CATEGORY_LABELS[category] ?? 'Scratch 分类')
    .replace(/!\[[^\]\n]*\]\([^)\n]+\)/g, '')
    .replace(/[`*_>#~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned.slice(0, MAX_TUTOR_TTS_TEXT_CHARS)
}

export function createTutorSpeechSanitizer() {
  let raw = ''
  let emitted = ''
  let capped = false

  const emitFrom = (safeRaw: string) => {
    if (capped) return ''
    const cleaned = sanitizeTutorSpeechText(safeRaw)
    if (!cleaned.startsWith(emitted)) {
      emitted = cleaned
      return ''
    }
    const delta = cleaned.slice(emitted.length)
    emitted = cleaned
    if (emitted.length >= MAX_TUTOR_TTS_TEXT_CHARS) capped = true
    return delta
  }

  return {
    push(chunk: string) {
      if (capped || !chunk) return ''
      raw += chunk
      return emitFrom(raw.slice(0, findTutorSpeechHoldIndex(raw)))
    },
    flush() {
      if (capped) return ''
      const delta = emitFrom(raw)
      raw = ''
      return delta
    },
  }
}

export async function synthesizeTutorSpeech(text: string): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const safeText = sanitizeTutorSpeechText(text)
  if (!safeText) {
    throw new TutorSpeechError('Empty speech text', '这条回复没有可朗读的内容。', 400)
  }

  const apiKey = requireDashScopeApiKey()
  const ttsUrl = process.env.DASHSCOPE_TUTOR_TTS_URL || DEFAULT_TTS_URL
  const voice = process.env.DASHSCOPE_TUTOR_TTS_VOICE || DEFAULT_TTS_VOICE
  const language = process.env.DASHSCOPE_TUTOR_TTS_LANGUAGE || DEFAULT_TTS_LANGUAGE

  const models = await getDashScopeModelCandidates('tutor-tts')
  let lastModelError: TutorSpeechError | null = null
  let audioUrl: string | null = null

  for (const model of models) {
    let response: Response
    try {
      response = await fetch(ttsUrl, {
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
        signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
      })
    } catch (error) {
      if (isDashScopeTimeoutError(error)) {
        throw new TutorSpeechError('DashScope TTS timed out', '小迪语音暂时不可用，请稍后再试。', 504)
      }
      throw error
    }

    const raw = await response.json().catch(() => null)
    if (!response.ok) {
      const error = new TutorSpeechError(`DashScope TTS failed (${response.status})`)
      if (!isDashScopeModelAvailabilityError(response.status, raw)) throw error
      markDashScopeModelUnavailable('tutor-tts', model)
      lastModelError = error
      continue
    }

    audioUrl = extractDashScopeAudioUrl(raw)
    if (audioUrl) break

    markDashScopeModelUnavailable('tutor-tts', model)
    lastModelError = new TutorSpeechError('DashScope TTS response missing audio URL')
  }

  if (!audioUrl) throw lastModelError ?? new TutorSpeechError('No DashScope TTS model candidate is available')

  let audioResponse: Response
  try {
    audioResponse = await fetch(audioUrl, { signal: AbortSignal.timeout(TTS_TIMEOUT_MS) })
  } catch (error) {
    if (isDashScopeTimeoutError(error)) {
      throw new TutorSpeechError(
        'DashScope TTS audio download timed out',
        '小迪语音暂时不可用，请稍后再试。',
        504,
      )
    }
    throw error
  }
  if (!audioResponse.ok) {
    throw new TutorSpeechError(`DashScope TTS audio download failed (${audioResponse.status})`)
  }

  return {
    audio: await audioResponse.arrayBuffer(),
    contentType: audioResponse.headers.get('Content-Type') || 'audio/mpeg',
  }
}

function buildRealtimeWebSocketUrl(model: string, configuredUrl = DEFAULT_ASR_WS_URL) {
  const url = new URL(configuredUrl)
  url.searchParams.set('model', model)
  return url.toString()
}

function buildAsrWebSocketUrl() {
  const model = resolveDashScopeConfig('tutor-asr').model || DEFAULT_ASR_MODEL
  const configuredUrl = process.env.DASHSCOPE_TUTOR_ASR_WS_URL || DEFAULT_ASR_WS_URL
  return buildRealtimeWebSocketUrl(model, configuredUrl)
}

function buildTtsRealtimeWebSocketUrl() {
  const model = resolveDashScopeConfig('tutor-tts-realtime').model || DEFAULT_TTS_REALTIME_MODEL
  const configuredUrl =
    process.env.DASHSCOPE_TUTOR_TTS_WS_URL || process.env.DASHSCOPE_TUTOR_ASR_WS_URL || DEFAULT_ASR_WS_URL
  return buildRealtimeWebSocketUrl(model, configuredUrl)
}

function parseServerEvent(data: RawData): RealtimeServerEvent | null {
  try {
    const serialized = Array.isArray(data)
      ? Buffer.concat(data).toString('utf8')
      : data instanceof ArrayBuffer
        ? Buffer.from(data).toString('utf8')
        : data.toString('utf8')
    const parsed = JSON.parse(serialized) as RealtimeServerEvent
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function realtimeWsHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'OpenAI-Beta': 'realtime=v1',
    'user-agent': 'steam-explore-share/tutor-speech',
  }
}

export type TutorRealtimeTtsSession = {
  ready: Promise<void>
  append: (text: string) => void
  finish: () => Promise<void>
  abort: () => void
}

export function createTutorRealtimeTtsSession(options: {
  onAudio: (pcm: Buffer) => void
  signal?: AbortSignal
}): TutorRealtimeTtsSession {
  const apiKey = requireDashScopeApiKey()
  const voice = process.env.DASHSCOPE_TUTOR_TTS_VOICE || DEFAULT_TTS_VOICE
  const language = process.env.DASHSCOPE_TUTOR_TTS_LANGUAGE || DEFAULT_TTS_LANGUAGE

  let closed = false
  let ready = false
  let pending = ''
  let flushScheduled = false

  let resolveReady: () => void
  let rejectReady: (error: Error) => void
  const readyPromise = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  readyPromise.catch(() => undefined)

  let resolveFinished: () => void
  let rejectFinished: (error: Error) => void
  const finishedPromise = new Promise<void>((resolve, reject) => {
    resolveFinished = resolve
    rejectFinished = reject
  })
  finishedPromise.catch(() => undefined)

  const connectTimer = setTimeout(() => {
    fail(new TutorSpeechError('DashScope realtime TTS connect timed out', '小迪语音暂时不可用，请稍后再试。', 504))
  }, TTS_REALTIME_CONNECT_TIMEOUT_MS)
  const sessionTimer = setTimeout(() => {
    fail(new TutorSpeechError('DashScope realtime TTS timed out', '小迪语音暂时不可用，请稍后再试。', 504))
  }, TTS_REALTIME_SESSION_TIMEOUT_MS)

  const ws = new WebSocket(buildTtsRealtimeWebSocketUrl(), {
    headers: realtimeWsHeaders(apiKey),
  })

  const sendJson = (payload: Record<string, unknown>) => {
    if (closed) return
    ws.send(JSON.stringify(payload))
  }

  const flushPending = () => {
    if (!ready || closed || !pending) return
    const text = pending
    pending = ''
    sendJson({
      event_id: buildEventId('text'),
      type: 'input_text_buffer.append',
      text,
    })
  }

  const scheduleFlush = () => {
    if (!ready || flushScheduled || closed || !pending) return
    flushScheduled = true
    queueMicrotask(() => {
      flushScheduled = false
      flushPending()
    })
  }

  const closeSocket = () => {
    try {
      ws.close()
    } catch {
      // ignore
    }
  }

  function fail(error: Error) {
    if (closed) return
    closed = true
    clearTimeout(connectTimer)
    clearTimeout(sessionTimer)
    closeSocket()
    rejectReady(error)
    rejectFinished(error)
  }

  function succeedFinish() {
    if (closed) return
    closed = true
    clearTimeout(connectTimer)
    clearTimeout(sessionTimer)
    closeSocket()
    resolveReady()
    resolveFinished()
  }

  const abort = () => {
    if (closed) return
    closed = true
    clearTimeout(connectTimer)
    clearTimeout(sessionTimer)
    closeSocket()
    const error = new TutorSpeechError('Realtime TTS aborted', '小迪语音暂时不可用，请稍后再试。', 499)
    rejectReady(error)
    resolveFinished()
  }

  if (options.signal) {
    if (options.signal.aborted) {
      abort()
    } else {
      options.signal.addEventListener('abort', abort, { once: true })
    }
  }

  ws.on('open', () => {
    if (closed) return
    sendJson({
      event_id: buildEventId('session'),
      type: 'session.update',
      session: {
        mode: 'server_commit',
        voice,
        language_type: language,
        response_format: 'pcm',
        sample_rate: TUTOR_TTS_PCM_SAMPLE_RATE,
      },
    })
  })

  ws.on('message', (data) => {
    if (closed) return
    const payload = parseServerEvent(data)
    if (!payload?.type) return

    if (payload.type === 'session.updated') {
      ready = true
      clearTimeout(connectTimer)
      flushPending()
      resolveReady()
      return
    }

    if (payload.type === 'response.audio.delta') {
      const encoded = typeof payload.delta === 'string' ? payload.delta : ''
      if (!encoded) return
      try {
        options.onAudio(Buffer.from(encoded, 'base64'))
      } catch {
        // ignore malformed audio frames
      }
      return
    }

    if (payload.type === 'error') {
      fail(new TutorSpeechError(payload.error?.message || 'DashScope realtime TTS server error'))
      return
    }

    if (payload.type === 'session.finished') {
      succeedFinish()
    }
  })

  ws.on('error', (error) => {
    fail(new TutorSpeechError(`Realtime TTS websocket error: ${error.message}`))
  })

  ws.on('close', (code, reason) => {
    if (closed) return
    const detail = reason.toString('utf8').trim()
    fail(new TutorSpeechError(`Realtime TTS websocket closed before completion (${code})${detail ? `: ${detail}` : ''}`))
  })

  return {
    ready: readyPromise,
    append(text: string) {
      if (!text || closed) return
      pending += text
      if (ready) scheduleFlush()
    },
    async finish() {
      if (closed) return
      await readyPromise
      if (closed) return
      flushPending()
      sendJson({
        event_id: buildEventId('finish'),
        type: 'session.finish',
      })
      await finishedPromise
    },
    abort,
  }
}

export type TutorSpeechStreamer = {
  start: () => void
  push: (chunk: string) => void
  finish: () => Promise<boolean>
  abort: () => void
}

export function createTutorSpeechStreamer(options: {
  onAudio: (pcmBase64: string, sampleRate: number) => void
  onError?: (error: TutorSpeechError) => void
  signal?: AbortSignal
}): TutorSpeechStreamer {
  const sanitizer = createTutorSpeechSanitizer()
  let session: TutorRealtimeTtsSession | null = null
  let failed = false
  let audioChunks = 0

  const failSoft = (error: unknown) => {
    if (failed) return
    failed = true
    session?.abort()
    session = null
    const speechError =
      error instanceof TutorSpeechError
        ? error
        : new TutorSpeechError(error instanceof Error ? error.message : 'Realtime TTS failed')
    options.onError?.(speechError)
  }

  const ensureSession = () => {
    if (session || failed) return session
    try {
      session = createTutorRealtimeTtsSession({
        onAudio: (pcm) => {
          if (failed || pcm.byteLength <= 0) return
          audioChunks += 1
          options.onAudio(pcm.toString('base64'), TUTOR_TTS_PCM_SAMPLE_RATE)
        },
        signal: options.signal,
      })
    } catch (error) {
      failSoft(error)
    }
    return session
  }

  const speak = (text: string) => {
    if (!text || failed) return
    const current = ensureSession()
    current?.append(text)
  }

  return {
    start() {
      ensureSession()
    },
    push(chunk: string) {
      speak(sanitizer.push(chunk))
    },
    async finish() {
      speak(sanitizer.flush())
      if (!session || failed) return audioChunks > 0
      try {
        await session.finish()
      } catch (error) {
        failSoft(error)
      }
      return audioChunks > 0
    },
    abort() {
      failed = true
      session?.abort()
      session = null
    },
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

  return new Promise((resolve, reject) => {
    let settled = false
    let sentAudio = false
    let transcript = ''
    const timer = setTimeout(() => fail(new TutorSpeechError('ASR timed out')), ASR_TIMEOUT_MS)
    const ws = new WebSocket(buildAsrWebSocketUrl(), {
      headers: realtimeWsHeaders(apiKey),
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

    ws.on('open', () => {
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

    ws.on('message', (data) => {
      const payload = parseServerEvent(data)
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

    ws.on('error', (error) => {
      fail(new TutorSpeechError(`ASR websocket error: ${error.message}`))
    })

    ws.on('close', (code, reason) => {
      if (settled) return
      const detail = reason.toString('utf8').trim()
      fail(new TutorSpeechError(`ASR websocket closed before completion (${code})${detail ? `: ${detail}` : ''}`))
    })
  })
}
