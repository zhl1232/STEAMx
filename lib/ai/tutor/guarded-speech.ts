import {
  createTutorSpeechStreamer, sanitizeTutorSpeechText, synthesizeTutorSpeech,
  transcribeTutorSpeechPcm16, MAX_TUTOR_SPEECH_PCM_BYTES, type TutorSpeechStreamer,
} from './speech'
import { TutorSpeechError } from './speech-error'
import { withSpeechUsage } from './speech-usage'

type StreamOptions = Parameters<typeof createTutorSpeechStreamer>[0]

/** Buffered until finish: the route has already performed full reply-safety cleaning. */
export function createGuardedTutorSpeechStreamer(userId: string, options: StreamOptions): TutorSpeechStreamer {
  const controller = new AbortController()
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  let text = ''
  let finished: Promise<boolean> | undefined
  let inner: TutorSpeechStreamer | undefined
  let notified = false
  const notify = (error: unknown) => {
    if (notified || signal.aborted) return
    notified = true
    options.onError?.(error instanceof TutorSpeechError ? error : new TutorSpeechError('Speech failed'))
  }
  return {
    start() { /* Never open a billable connection before the text and units are known. */ },
    push(chunk) {
      if (!finished && !signal.aborted) text = (text + chunk).slice(0, 32_000)
    },
    finish() {
      if (finished) return finished
      const safeText = sanitizeTutorSpeechText(text)
      text = ''
      finished = (async () => {
        if (signal.aborted) return false
        if (!safeText) return false
        try {
          const ok = await withSpeechUsage(userId, 'tts', safeText.length, async () => {
            inner = createTutorSpeechStreamer({ ...options, signal, onError: notify })
            inner.push(safeText)
            return inner.finish()
          }, signal)
          // Provider sometimes closes with zero PCM and no thrown error; surface that to the client
          // so it does not fall through to the generic "朗读未完成" toast without a reason.
          if (!ok) {
            notify(new TutorSpeechError(
              'TTS produced no audio',
              '这次朗读未完成，可以点击回复旁的朗读按钮重试。',
              502,
            ))
          }
          return ok
        } catch (error) {
          notify(error)
          return false
        }
      })()
      return finished
    },
    abort() { controller.abort(); inner?.abort(); text = '' },
  }
}

export async function guardedSynthesizeTutorSpeech(
  userId: string, text: string, options: Parameters<typeof synthesizeTutorSpeech>[1],
) {
  const safeText = sanitizeTutorSpeechText(text)
  if (!safeText) throw new TutorSpeechError('Empty speech text', '没有可朗读的内容。', 400)
  // Legacy HTTP may dispatch two physical synthesis attempts; reserve their worst case.
  const multiplier = process.env.DASHSCOPE_TUTOR_AUDIO_PROTOCOL === 'legacy' ? 2 : 1
  return withSpeechUsage(userId, 'tts', safeText.length * multiplier,
    () => synthesizeTutorSpeech(safeText, options), options?.signal)
}

export async function guardedTranscribeTutorSpeechPcm16(
  userId: string, audio: ArrayBuffer, options?: Parameters<typeof transcribeTutorSpeechPcm16>[1],
) {
  if (audio.byteLength < 2 || audio.byteLength % 2 || audio.byteLength > MAX_TUTOR_SPEECH_PCM_BYTES) {
    throw new TutorSpeechError('Invalid PCM audio', '语音格式或长度不正确。', 400)
  }
  // Fixed mono 16 kHz PCM16. Never bill/admit based on client durationMs.
  const seconds = Math.ceil(audio.byteLength / 32_000)
  return withSpeechUsage(userId, 'asr', seconds,
    () => transcribeTutorSpeechPcm16(audio, options), options?.signal)
}
