'use client'

const DEFAULT_SAMPLE_RATE = 24_000
const PREROLL_SECONDS = 0.12

type AudioContextConstructor = typeof AudioContext

type WindowWithWebAudio = Window & {
  AudioContext?: AudioContextConstructor
  webkitAudioContext?: AudioContextConstructor
}

export type TutorPcmPlayer = {
  resume: () => Promise<void>
  enqueue: (pcm: ArrayBuffer, sampleRate?: number) => void
  markStreamComplete: () => void
  stop: () => void
}

function getAudioContextConstructor() {
  const win = window as WindowWithWebAudio
  return win.AudioContext || win.webkitAudioContext
}

export function decodeBase64ToArrayBuffer(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function decodePcm16ToFloat32(pcm: ArrayBuffer) {
  const bytes = pcm.byteLength % 2 === 0 ? pcm.byteLength : pcm.byteLength - 1
  const samples = new Int16Array(pcm, 0, bytes / 2)
  const output = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i] ?? 0
    output[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff
  }
  return output
}

export function createTutorPcmPlayer(options: { onEnded?: () => void } = {}): TutorPcmPlayer {
  let context: AudioContext | null = null
  let nextTime = 0
  let started = false
  let stopped = true
  let streamComplete = false
  let pendingSources = 0
  let endedNotified = false
  const sources = new Set<AudioBufferSourceNode>()

  const ensureContext = () => {
    if (context && context.state !== 'closed') return context
    const Ctor = getAudioContextConstructor()
    if (!Ctor) {
      throw new Error('当前浏览器不支持语音播放。')
    }
    context = new Ctor()
    return context
  }

  const notifyEnded = () => {
    if (endedNotified || stopped || !streamComplete || pendingSources > 0) return
    endedNotified = true
    stopped = true
    options.onEnded?.()
  }

  return {
    async resume() {
      stopped = false
      streamComplete = false
      endedNotified = false
      pendingSources = 0
      started = false
      nextTime = 0
      const audioContext = ensureContext()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
    },
    enqueue(pcm, sampleRate = DEFAULT_SAMPLE_RATE) {
      if (stopped || pcm.byteLength < 2) return
      const audioContext = ensureContext()
      const samples = decodePcm16ToFloat32(pcm)
      if (samples.length === 0) return
      const buffer = audioContext.createBuffer(1, samples.length, sampleRate)
      buffer.getChannelData(0).set(samples)

      const source = audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(audioContext.destination)

      const now = audioContext.currentTime
      if (!started) {
        nextTime = now + PREROLL_SECONDS
        started = true
      }
      if (nextTime < now) nextTime = now

      source.onended = () => {
        sources.delete(source)
        pendingSources = Math.max(0, pendingSources - 1)
        notifyEnded()
      }
      pendingSources += 1
      sources.add(source)
      source.start(nextTime)
      nextTime += buffer.duration
    },
    markStreamComplete() {
      streamComplete = true
      if (pendingSources === 0) {
        const audioContext = context
        if (!audioContext || !started) {
          notifyEnded()
          return
        }
        const remainingMs = Math.max(0, (nextTime - audioContext.currentTime) * 1000)
        window.setTimeout(notifyEnded, remainingMs + 20)
      }
    },
    stop() {
      stopped = true
      streamComplete = true
      endedNotified = true
      pendingSources = 0
      for (const source of sources) {
        try {
          source.onended = null
          source.stop()
        } catch {
          // already stopped
        }
      }
      sources.clear()
      started = false
      nextTime = 0
    },
  }
}
