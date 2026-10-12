import { encodePcm16, resampleAudio, TUTOR_VOICE_SAMPLE_RATE } from '@/components/features/tutor/tutor-voice'

export const BUILDING_VOICE_MAX_SEGMENT_MS = 8_000
const FRAME_MS = 20
const PRE_ROLL_MS = 300
const END_SILENCE_MS = 650
const MIN_VOICE_MS = 180

export type BuildingVoiceRecording = { blob: Blob; durationMs: number }
export type BuildingVoiceCapture = {
  setListening: (enabled: boolean) => void
  reset: () => void
  playCue: () => void
  close: () => Promise<void>
}
export type BuildingVoiceCaptureOptions = {
  signal: AbortSignal
  onSegment: (recording: BuildingVoiceRecording) => void
  onError: (error: Error) => void
}

export type BuildingVoiceAudioEnvironment = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  createAudioContext: () => AudioContext
}

function joinSamples(chunks: Float32Array[], sampleCount: number) {
  const joined = new Float32Array(sampleCount)
  let offset = 0
  for (const chunk of chunks) {
    const length = Math.min(chunk.length, sampleCount - offset)
    if (length <= 0) break
    joined.set(chunk.subarray(0, length), offset)
    offset += length
  }
  return joined
}

/** Local energy detection only. PCM never leaves this module until speech ends. */
export function createBuildingVoiceSegmenter({
  sampleRate,
  onSegment,
}: {
  sampleRate: number
  onSegment: (samples: Float32Array) => void
}) {
  const frameSize = Math.max(1, Math.round(sampleRate * FRAME_MS / 1_000))
  const preRollFrames = Math.ceil(PRE_ROLL_MS / FRAME_MS)
  const maxSamples = Math.floor(sampleRate * BUILDING_VOICE_MAX_SEGMENT_MS / 1_000)
  let enabled = false
  let partial = new Float32Array(frameSize)
  let partialLength = 0
  let preRoll: Float32Array[] = []
  let speech: Float32Array[] = []
  let speechSamples = 0
  let voicedMs = 0
  let silenceMs = 0
  let noiseFloor = 0.002
  let requiresQuiet = false
  let rearmQuietMs = 0

  const reset = () => {
    partial = new Float32Array(frameSize)
    partialLength = 0
    preRoll = []
    speech = []
    speechSamples = 0
    voicedMs = 0
    silenceMs = 0
    rearmQuietMs = 0
  }

  const acceptFrame = (frame: Float32Array) => {
    let sum = 0
    for (const sample of frame) sum += sample * sample
    const rms = Math.sqrt(sum / frame.length)
    const threshold = Math.max(0.012, noiseFloor * 3)
    const isVoice = rms >= threshold

    if (requiresQuiet) {
      rearmQuietMs = isVoice ? 0 : rearmQuietMs + FRAME_MS
      if (rearmQuietMs >= END_SILENCE_MS) {
        requiresQuiet = false
        rearmQuietMs = 0
      }
      return
    }

    if (speech.length === 0) {
      if (!isVoice) {
        // Adapt only to quiet background; a spoken word must not raise its own gate.
        noiseFloor = noiseFloor * 0.95 + Math.min(rms, 0.008) * 0.05
        preRoll.push(frame)
        if (preRoll.length > preRollFrames) preRoll.shift()
        return
      }
      speech = [...preRoll]
      speechSamples = speech.length * frameSize
      preRoll = []
    }

    speech.push(frame)
    speechSamples += frame.length
    if (isVoice) {
      voicedMs += FRAME_MS
      silenceMs = 0
    } else {
      silenceMs += FRAME_MS
    }

    if (silenceMs < END_SILENCE_MS && speechSamples < maxSamples) return

    const enoughVoice = voicedMs >= MIN_VOICE_MS
    const samples = enoughVoice ? joinSamples(speech, Math.min(speechSamples, maxSamples)) : null
    // A sustained fan/noise/monologue must not become endless eight-second uploads.
    // After a duration cut, require fresh local silence before detecting more speech.
    requiresQuiet = speechSamples >= maxSamples && silenceMs < END_SILENCE_MS
    reset()
    if (!samples) return
    // Backpressure is synchronous: even the rest of this audio callback is dropped.
    enabled = false
    onSegment(samples)
  }

  return {
    push(input: Float32Array) {
      if (!enabled) return
      let offset = 0
      while (enabled && offset < input.length) {
        const length = Math.min(frameSize - partialLength, input.length - offset)
        partial.set(input.subarray(offset, offset + length), partialLength)
        partialLength += length
        offset += length
        if (partialLength !== frameSize) continue
        const frame = partial
        partial = new Float32Array(frameSize)
        partialLength = 0
        acceptFrame(frame)
      }
    },
    reset,
    setListening(listening: boolean) {
      enabled = listening
      // Do not let a previous utterance or response feedback enter the next one.
      reset()
    },
  }
}

function browserAudioEnvironment(): BuildingVoiceAudioEnvironment {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持麦克风录音。')
  }
  const browser = window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const AudioContextCtor = browser.AudioContext || browser.webkitAudioContext
  if (!AudioContextCtor) throw new Error('当前浏览器不支持音频采集。')
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createAudioContext: () => new AudioContextCtor(),
  }
}

function aborted() {
  return new DOMException('Voice capture was cancelled.', 'AbortError')
}

/** Keeps one microphone/context for the explicitly enabled session, including ASR waits. */
export async function createBuildingVoiceCapture(
  options: BuildingVoiceCaptureOptions,
  environment?: BuildingVoiceAudioEnvironment,
): Promise<BuildingVoiceCapture> {
  if (options.signal.aborted) throw aborted()
  const audio = environment ?? browserAudioEnvironment()
  // Create/resume during the user's click, before awaiting the permission dialog.
  const context = audio.createAudioContext()
  let stream: MediaStream | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let processor: ScriptProcessorNode | null = null
  let closed = false
  let ready = false
  let closing: Promise<void> | null = null
  const trackListeners: Array<{ track: MediaStreamTrack; listener: () => void }> = []

  const segmenter = createBuildingVoiceSegmenter({
    sampleRate: context.sampleRate,
    onSegment(samples) {
      if (closed || options.signal.aborted) return
      const pcm = encodePcm16(resampleAudio(samples, context.sampleRate, TUTOR_VOICE_SAMPLE_RATE))
      options.onSegment({
        blob: new Blob([pcm.buffer], { type: 'audio/pcm' }),
        durationMs: Math.round(pcm.length / TUTOR_VOICE_SAMPLE_RATE * 1_000),
      })
    },
  })

  const close = () => {
    if (closed) return closing ?? Promise.resolve()
    closed = true
    segmenter.setListening(false)
    options.signal.removeEventListener('abort', onAbort)
    context.removeEventListener('statechange', onContextStateChange)
    for (const { track, listener } of trackListeners) track.removeEventListener('ended', listener)
    if (processor) processor.onaudioprocess = null
    for (const node of [processor, source]) {
      try { node?.disconnect() } catch { /* Already disconnected by the browser. */ }
    }
    for (const track of stream?.getTracks() ?? []) track.stop()
    closing = context.state === 'closed' ? Promise.resolve() : context.close().catch(() => undefined)
    return closing
  }
  const fail = (message: string) => {
    if (closed) return
    void close()
    options.onError(new Error(message))
  }
  const onAbort = () => { void close() }
  const onContextStateChange = () => {
    if (ready && context.state !== 'running') fail('麦克风已中断，请点击继续重新开启。')
  }
  options.signal.addEventListener('abort', onAbort, { once: true })
  // Handle an abort between checking the signal and installing its listener.
  if (options.signal.aborted) {
    await close()
    throw aborted()
  }
  const resumed = context.resume().then(() => null, (error: unknown) => error)

  try {
    stream = await audio.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })
    if (closed || options.signal.aborted) {
      // getUserMedia cannot be aborted; release a late permission result immediately.
      for (const track of stream.getTracks()) track.stop()
      throw aborted()
    }
    const resumeError = await resumed
    if (closed || options.signal.aborted) throw aborted()
    if (resumeError) throw resumeError
    if (context.state !== 'running') throw new Error('音频未能启动，请点击继续重试。')
    source = context.createMediaStreamSource(stream)
    processor = context.createScriptProcessor(2_048, 1, 1)
    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      // The processor must be connected to run, but never monitor the mic in speakers.
      for (let channel = 0; channel < event.outputBuffer.numberOfChannels; channel += 1) {
        event.outputBuffer.getChannelData(channel).fill(0)
      }
      if (closed || options.signal.aborted) return
      try {
        segmenter.push(event.inputBuffer.getChannelData(0))
      } catch {
        fail('音频采集已中断，请点击继续重新开启。')
      }
    }
    source.connect(processor)
    processor.connect(context.destination)
    for (const track of stream.getTracks()) {
      const listener = () => fail('麦克风已中断，请点击继续重新开启。')
      track.addEventListener('ended', listener)
      trackListeners.push({ track, listener })
    }
    ready = true
    context.addEventListener('statechange', onContextStateChange)
    return {
      setListening(enabled) { if (!closed) segmenter.setListening(enabled) },
      reset() { segmenter.reset() },
      playCue() {
        if (closed || context.state !== 'running') return
        try {
          const oscillator = context.createOscillator()
          const gain = context.createGain()
          oscillator.frequency.value = 740
          gain.gain.setValueAtTime(0, context.currentTime)
          gain.gain.linearRampToValueAtTime(0.07, context.currentTime + 0.01)
          gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.1)
          oscillator.connect(gain)
          gain.connect(context.destination)
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
          oscillator.start()
          oscillator.stop(context.currentTime + 0.12)
        } catch {
          // Visual confirmation remains available if the browser cannot play the cue.
        }
      },
      close,
    }
  } catch (error) {
    await close()
    throw error
  }
}
