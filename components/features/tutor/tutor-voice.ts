export const TUTOR_VOICE_SAMPLE_RATE = 16_000
export const TUTOR_VOICE_MAX_RECORDING_MS = 30_000
export const TUTOR_AUTO_READ_STORAGE_KEY = 'xiaodi:auto-read-replies:v1'
export const TUTOR_MOBILE_LONG_PRESS_STORAGE_KEY = 'xiaodi:mobile-long-press-voice:v1'
export const TUTOR_VOICE_REPLY_STORAGE_KEY = 'xiaodi:voice-input-auto-play:v1'
export const TUTOR_VOICE_HINT_STORAGE_KEY = 'xiaodi:long-press-hint-enabled:v1'
export const TUTOR_VOICE_HINT_STATE_STORAGE_KEY = 'xiaodi:long-press-hint-state:v1'
export const TUTOR_VOICE_PREFERENCES_CHANGE_EVENT = 'xiaodi-voice-preferences-change'
export const TUTOR_LONG_PRESS_HINT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export type TutorVoicePreferenceKey =
  | 'autoReadReplies'
  | 'mobileLongPressInput'
  | 'voiceInputAutoPlay'
  | 'showLongPressHint'

export type TutorVoicePreferences = Record<TutorVoicePreferenceKey, boolean>

export const TUTOR_VOICE_PREFERENCE_DEFAULTS: TutorVoicePreferences = {
  autoReadReplies: true,
  mobileLongPressInput: true,
  voiceInputAutoPlay: true,
  showLongPressHint: true,
}

const TUTOR_VOICE_STORAGE_KEYS: Record<TutorVoicePreferenceKey, string> = {
  autoReadReplies: TUTOR_AUTO_READ_STORAGE_KEY,
  mobileLongPressInput: TUTOR_MOBILE_LONG_PRESS_STORAGE_KEY,
  voiceInputAutoPlay: TUTOR_VOICE_REPLY_STORAGE_KEY,
  showLongPressHint: TUTOR_VOICE_HINT_STORAGE_KEY,
}

type TutorVoiceStorageReader = Pick<Storage, 'getItem'>
type TutorVoiceStorageWriter = Pick<Storage, 'getItem' | 'setItem'>

type AudioContextConstructor = typeof AudioContext

type WindowWithWebAudio = Window & {
  AudioContext?: AudioContextConstructor
  webkitAudioContext?: AudioContextConstructor
}

export type TutorPcmRecording = {
  blob: Blob
  durationMs: number
}

export type TutorPcmRecorder = {
  stop: () => Promise<TutorPcmRecording>
  cancel: () => Promise<void>
}

function getAudioContextConstructor() {
  const win = window as WindowWithWebAudio
  return win.AudioContext || win.webkitAudioContext
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

export function mergeTutorVoiceTranscript(current: string, transcript: string) {
  const cleaned = transcript.trim()
  if (!cleaned) return current
  const base = current.trimEnd()
  if (!base) return cleaned
  return `${base}\n${cleaned}`
}

export function isTutorVoicePreferenceEnabled(storedValue: string | null, defaultEnabled = true) {
  if (storedValue === '0') return false
  if (storedValue === '1') return true
  return defaultEnabled
}

export function isTutorAutoReadEnabled(storedValue: string | null) {
  return isTutorVoicePreferenceEnabled(storedValue, TUTOR_VOICE_PREFERENCE_DEFAULTS.autoReadReplies)
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function getTutorVoicePreferences(storage: TutorVoiceStorageReader | null = getBrowserStorage()): TutorVoicePreferences {
  if (!storage) return { ...TUTOR_VOICE_PREFERENCE_DEFAULTS }

  return {
    autoReadReplies: isTutorVoicePreferenceEnabled(
      storage.getItem(TUTOR_VOICE_STORAGE_KEYS.autoReadReplies),
      TUTOR_VOICE_PREFERENCE_DEFAULTS.autoReadReplies,
    ),
    mobileLongPressInput: isTutorVoicePreferenceEnabled(
      storage.getItem(TUTOR_VOICE_STORAGE_KEYS.mobileLongPressInput),
      TUTOR_VOICE_PREFERENCE_DEFAULTS.mobileLongPressInput,
    ),
    voiceInputAutoPlay: isTutorVoicePreferenceEnabled(
      storage.getItem(TUTOR_VOICE_STORAGE_KEYS.voiceInputAutoPlay),
      TUTOR_VOICE_PREFERENCE_DEFAULTS.voiceInputAutoPlay,
    ),
    showLongPressHint: isTutorVoicePreferenceEnabled(
      storage.getItem(TUTOR_VOICE_STORAGE_KEYS.showLongPressHint),
      TUTOR_VOICE_PREFERENCE_DEFAULTS.showLongPressHint,
    ),
  }
}

export function setTutorVoicePreference(
  key: TutorVoicePreferenceKey,
  enabled: boolean,
  storage: TutorVoiceStorageWriter | null = getBrowserStorage(),
) {
  if (!storage) return
  storage.setItem(TUTOR_VOICE_STORAGE_KEYS[key], enabled ? '1' : '0')

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TUTOR_VOICE_PREFERENCES_CHANGE_EVENT, {
        detail: { key, enabled },
      }),
    )
  }
}

function parseTutorVoiceHintState(storedValue: string | null) {
  if (!storedValue) return { shownCount: 0, lastShownAt: 0 }
  try {
    const parsed = JSON.parse(storedValue) as { shownCount?: unknown; lastShownAt?: unknown }
    return {
      shownCount: typeof parsed.shownCount === 'number' && Number.isFinite(parsed.shownCount) ? parsed.shownCount : 0,
      lastShownAt: typeof parsed.lastShownAt === 'number' && Number.isFinite(parsed.lastShownAt) ? parsed.lastShownAt : 0,
    }
  } catch {
    return { shownCount: 0, lastShownAt: 0 }
  }
}

export function shouldShowTutorLongPressHint(storedValue: string | null, now = Date.now()) {
  const state = parseTutorVoiceHintState(storedValue)
  return state.shownCount === 0 || now - state.lastShownAt >= TUTOR_LONG_PRESS_HINT_COOLDOWN_MS
}

export function buildTutorLongPressHintState(storedValue: string | null, now = Date.now()) {
  const state = parseTutorVoiceHintState(storedValue)
  return JSON.stringify({
    shownCount: Math.max(0, state.shownCount) + 1,
    lastShownAt: now,
  })
}

export function markTutorLongPressHintShown(storage: TutorVoiceStorageWriter | null = getBrowserStorage(), now = Date.now()) {
  if (!storage) return
  storage.setItem(TUTOR_VOICE_HINT_STATE_STORAGE_KEY, buildTutorLongPressHintState(storage.getItem(TUTOR_VOICE_HINT_STATE_STORAGE_KEY), now))
}

export function encodePcm16(samples: Float32Array) {
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0))
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return pcm
}

export function resampleAudio(input: Float32Array, sourceRate: number, targetRate = TUTOR_VOICE_SAMPLE_RATE) {
  if (sourceRate === targetRate) return input
  const ratio = sourceRate / targetRate
  const outputLength = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(outputLength)

  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * ratio
    const leftIndex = Math.floor(sourceIndex)
    const rightIndex = Math.min(input.length - 1, leftIndex + 1)
    const weight = sourceIndex - leftIndex
    const left = input[leftIndex] ?? 0
    const right = input[rightIndex] ?? left
    output[i] = left + (right - left) * weight
  }

  return output
}

function joinPcmChunks(chunks: Int16Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const joined = new Int16Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.length
  }
  return joined
}

export async function createTutorPcmRecorder(): Promise<TutorPcmRecorder> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持麦克风录音。')
  }

  const AudioContextCtor = getAudioContextConstructor()
  if (!AudioContextCtor) {
    throw new Error('当前浏览器不支持音频采集。')
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  })
  const audioContext = new AudioContextCtor()
  const source = audioContext.createMediaStreamSource(stream)
  const processor = audioContext.createScriptProcessor(4096, 1, 1)
  const startedAt = performance.now()
  const chunks: Int16Array[] = []
  let stopped = false

  processor.onaudioprocess = (event: AudioProcessingEvent) => {
    if (stopped) return
    const channelData = event.inputBuffer.getChannelData(0)
    const resampled = resampleAudio(channelData, audioContext.sampleRate, TUTOR_VOICE_SAMPLE_RATE)
    chunks.push(encodePcm16(resampled))
  }

  source.connect(processor)
  processor.connect(audioContext.destination)

  const cleanup = async () => {
    if (stopped) return
    stopped = true
    try {
      processor.disconnect()
      source.disconnect()
    } catch {
      // already disconnected
    }
    stopStream(stream)
    if (audioContext.state !== 'closed') {
      await audioContext.close().catch(() => undefined)
    }
  }

  return {
    async stop() {
      const durationMs = Math.round(performance.now() - startedAt)
      await cleanup()
      const pcm = joinPcmChunks(chunks)
      return {
        durationMs,
        blob: new Blob([pcm.buffer], { type: 'audio/pcm' }),
      }
    },
    async cancel() {
      await cleanup()
    },
  }
}
