import { randomUUID } from 'node:crypto'
import WebSocket, { type RawData } from 'ws'
import { TutorSpeechError } from './speech-error'
import { reserveSpeechRequest } from './speech-budget'
import { DEFAULT_TUTOR_VOICE, isTutorVoice } from './voice-catalog'

export const TTS_MODEL = 'qwen-audio-3.1-tts-flash'
export const ASR_MODEL = 'qwen-audio-3.1-asr-flash-streaming'

export function speechTaskUrl() {
  const workspace = process.env.DASHSCOPE_WORKSPACE_ID?.trim()
  const taskPath = '/api-ws/v1/inference'
  const legacyHost = 'dashscope.aliyuncs.com'
  const isDedicated = (host: string) => /^[a-z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com$/.test(host)
    && !/^(trial|token-plan|coding)\./.test(host)
  const readHost = (value: string, protocol: string, paths: string[]) => {
    let url: URL
    try { url = new URL(value) } catch { throw new TutorSpeechError('Invalid Beijing audio endpoint', undefined, 503) }
    if (url.protocol !== protocol || !(url.hostname === legacyHost || isDedicated(url.hostname))
      || !paths.includes(url.pathname.replace(/\/$/, '')) || url.port || url.username || url.password || url.search || url.hash) {
      throw new TutorSpeechError('Invalid Beijing audio endpoint', '语音服务地域配置需要更新。', 503)
    }
    return url.hostname
  }
  const explicit = process.env.DASHSCOPE_TUTOR_AUDIO_WS_URL?.trim()
  const explicitHost = explicit ? readHost(explicit, 'wss:', [taskPath]) : undefined
  if (explicitHost && isDedicated(explicitHost)) return `wss://${explicitHost}${taskPath}`
  if (workspace) {
    if (!/^[a-zA-Z0-9-]+$/.test(workspace) || /^(trial|token-plan|coding)$/i.test(workspace)) {
      throw new TutorSpeechError('Invalid DASHSCOPE_WORKSPACE_ID', undefined, 503)
    }
    return `wss://${workspace}.cn-beijing.maas.aliyuncs.com${taskPath}`
  }
  // Reuse already configured Beijing API Hosts, translating only the API path.
  // Reject overseas/unknown hosts instead of guessing a region or leaking credentials.
  const hosts = [explicitHost]
  for (const key of ['DASHSCOPE_TUTOR_TTS_WS_URL', 'DASHSCOPE_TUTOR_ASR_WS_URL']) {
    const value = process.env[key]?.trim()
    if (value) hosts.push(readHost(value, 'wss:', [taskPath, '/api-ws/v1/realtime']))
  }
  const base = process.env.DASHSCOPE_BASE_URL?.trim()
  if (base) hosts.push(readHost(base, 'https:', ['/compatible-mode/v1', '/api/v1']))
  const tts = process.env.DASHSCOPE_TUTOR_TTS_URL?.trim()
  if (tts) hosts.push(readHost(tts, 'https:', ['/api/v1/services/aigc/multimodal-generation/generation', '/api/v1/services/audio/tts/speech-synthesizer']))
  const host = hosts.find((value) => value && isDedicated(value)) ?? hosts.find(Boolean) ?? legacyHost
  // No override retains this project's established Beijing default. The legacy
  // domain is officially supported for existing workloads, not live-tested here.
  return `wss://${host}${taskPath}`
}

type TaskEvent = {
  header?: { event?: string; task_id?: string; error_code?: string }
  payload?: { output?: { sentence?: { text?: string; sentence_end?: boolean; sentence_id?: number; heartbeat?: boolean } } }
}

function bytes(data: RawData): Buffer {
  return Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer)
}

/** One task per connection. No retries after admission or partial audio. */
function createTask(options: {
  kind: 'tts' | 'asr'; model: string; parameters: Record<string, unknown>
  signal?: AbortSignal; onAudio?: (audio: Buffer) => void; onResult?: (event: TaskEvent) => void
}) {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) throw new TutorSpeechError('Missing DASHSCOPE_API_KEY', undefined, 503)
  const url = speechTaskUrl()
  const taskId = randomUUID()
  let ws: WebSocket | undefined
  let settled = false
  let started = false
  let ending = false
  let resolveReady!: () => void
  let rejectReady!: (error: Error) => void
  let resolveDone!: () => void
  let rejectDone!: (error: Error) => void
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
  const done = new Promise<void>((resolve, reject) => { resolveDone = resolve; rejectDone = reject })
  void ready.catch(() => undefined)
  void done.catch(() => undefined)
  const header = (action: string) => ({ action, task_id: taskId, streaming: 'duplex' })
  function send(action: string, payload: Record<string, unknown>) {
    if (!settled && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ header: header(action), payload }))
  }
  const timer = setTimeout(() => finish(new TutorSpeechError('Audio task timed out', undefined, 504)), options.kind === 'tts' ? 120_000 : 25_000)
  const connectTimer = setTimeout(() => finish(new TutorSpeechError('Audio handshake timed out', undefined, 504)), 10_000)
  function finish(error?: Error) {
    if (settled) return
    settled = true
    clearTimeout(timer)
    clearTimeout(connectTimer)
    options.signal?.removeEventListener('abort', abort)
    if (ws) {
      if (ws.readyState === WebSocket.CONNECTING) ws.terminate()
      else ws.close()
    }
    if (error) { rejectReady(error); rejectDone(error) }
    else { resolveReady(); resolveDone() }
  }
  function abort() {
    if (started && options.kind === 'tts') send('finish-task', { input: { directive: 'cancel' } })
    finish(new TutorSpeechError('Audio task aborted', undefined, 499))
  }
  if (options.signal?.aborted) abort()
  else options.signal?.addEventListener('abort', abort, { once: true })
  void (async () => {
    if (settled) return
    await reserveSpeechRequest(options.kind)
    if (settled) return
    ws = new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` }, maxPayload: 2 * 1024 * 1024 })
    ws.on('open', () => send('run-task', {
      task_group: 'audio', task: options.kind,
      function: options.kind === 'tts' ? 'SpeechSynthesizer' : 'recognition',
      model: options.model, parameters: options.parameters, input: {},
    }))
    ws.on('message', (data, binary) => {
      if (settled) return
      try {
        if (binary) {
          if (started && options.kind === 'tts') options.onAudio?.(bytes(data))
          return
        }
        const event = JSON.parse(bytes(data).toString('utf8')) as TaskEvent
        if (event.header?.task_id !== taskId) return
        switch (event.header.event) {
          case 'task-started':
            if (started) return
            started = true
            clearTimeout(connectTimer)
            resolveReady()
            break
          case 'result-generated': options.onResult?.(event); break
          case 'task-finished':
            finish(ending ? undefined : new TutorSpeechError('Premature audio completion'))
            break
          case 'task-failed':
            finish(new TutorSpeechError('Audio task failed', undefined, /429|throttl|limit/i.test(event.header.error_code ?? '') ? 429 : 502))
        }
      } catch { finish(new TutorSpeechError('Malformed audio event', undefined, 502)) }
    })
    ws.on('unexpected-response', (_req, response) => {
      response.resume()
      finish(new TutorSpeechError('Audio handshake rejected', undefined, response.statusCode === 429 ? 429 : 502))
    })
    ws.on('error', () => finish(new TutorSpeechError('Audio connection failed', undefined, 502)))
    ws.on('close', () => { if (!settled) finish(new TutorSpeechError('Audio closed before completion', undefined, 502)) })
  })().catch((error: unknown) => finish(error instanceof Error ? error : new TutorSpeechError('Audio admission failed')))
  return {
    ready, done, abort,
    append(text: string) { if (started && !ending) send('continue-task', { input: { text } }) },
    audio(audio: Buffer) { if (!settled && started && !ending) ws?.send(audio) },
    finish() { if (!ending && started && !settled) { ending = true; send('finish-task', { input: {} }) } return done },
  }
}

export function createTaskTtsSession(options: { onAudio: (audio: Buffer) => void; signal?: AbortSignal; voice?: string }) {
  const voice = options.voice ?? DEFAULT_TUTOR_VOICE
  if (!isTutorVoice(voice)) throw new TutorSpeechError('Unsupported voice', '请选择可用音色。', 400)
  const task = createTask({ ...options, kind: 'tts', model: TTS_MODEL,
    parameters: { text_type: 'PlainText', voice, format: 'pcm', sample_rate: 24000, language_hints: ['zh'] } })
  let pending = ''
  let count = 0
  let started = false
  let ending = false
  const flush = () => { if (started && pending) { task.append(pending); pending = '' } }
  void task.ready.then(() => { started = true; flush() }).catch(() => undefined)
  return {
    ready: task.ready,
    append(text: string) {
      if (ending || count >= 800) return
      const part = text.slice(0, 800 - count)
      count += part.length
      pending += part
      flush()
    },
    async finish() { ending = true; await task.ready; flush(); await task.finish() },
    abort: task.abort,
  }
}

export async function transcribeTaskPcm(audio: ArrayBuffer, signal?: AbortSignal, courseControl = false) {
  const sentences = new Map<number, string>()
  const task = createTask({ kind: 'asr', model: ASR_MODEL, signal,
    parameters: { format: 'pcm', sample_rate: 16000, language_hints: ['zh'],
      ...(courseControl ? { vocabulary: { '下一步': 3, '上一步': 3, '暂停': 3, '继续': 3, '重播': 3, '退出': 3 } } : {}) },
    onResult(event) {
      const sentence = event.payload?.output?.sentence
      if (sentence?.sentence_end && !sentence.heartbeat && typeof sentence.sentence_id === 'number' && typeof sentence.text === 'string') {
        sentences.set(sentence.sentence_id, sentence.text)
      }
    },
  })
  await task.ready
  const buffer = Buffer.from(audio)
  for (let offset = 0; offset < buffer.length; offset += 3200) task.audio(buffer.subarray(offset, offset + 3200))
  await task.finish()
  const text = [...sentences.entries()].sort(([a], [b]) => a - b).map(([, value]) => value).join('').trim()
  if (!text) throw new TutorSpeechError('Empty ASR transcript', '小迪没有听清楚，请再说一次。', 400)
  return text
}
