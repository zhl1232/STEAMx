import { BOOK_MUSIC_BAR_SECONDS, bookMusicBar, createBookMusicSynth } from "./book-music"

/** Original procedural audio. No recordings, downloads, persistent preference or RAF. */
export type BookSound = "page" | "leaves"
type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[]; end: number }
let active: { stop: () => void } | null = null
const LOOKAHEAD_SECONDS = 0.35
const MAX_MUSIC_VOICES = 24

export function createBookAudio(onChange: (enabled: boolean, unavailable: boolean) => void, makeContext = () => new AudioContext()) {
  let context: AudioContext | null = null
  let enabled = false
  let pending = false
  let disposed = false
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let effect: Voice | null = null
  let lastEffect = -Infinity
  let synth: ReturnType<typeof createBookMusicSynth> | null = null
  let nextBar = 0
  let nextBarTime = 0
  const voices = new Set<Voice>()
  const release = (voice: Voice) => {
    if (!voices.delete(voice)) return
    try { voice.source.stop() } catch { /* Already ended. */ }
    voice.source.onended = null
    voice.nodes.forEach((node) => node.disconnect())
    if (effect === voice) effect = null
  }
  const own = (source: AudioScheduledSourceNode, nodes: AudioNode[], end: number) => {
    const voice = { source, nodes, end }
    voices.add(voice)
    source.onended = () => release(voice)
    return voice
  }
  const stop = () => {
    generation++
    enabled = false
    pending = false
    clearTimeout(timer)
    timer = undefined
    for (const voice of [...voices]) release(voice)
    lastEffect = -Infinity
    if (active === controller) active = null
    if (context?.state === "running") void context.suspend().catch(() => {})
    if (!disposed) onChange(false, false)
  }
  // Schedule only one bar ahead, against the audio clock. A delayed task skips
  // missed bars instead of creating a burst of old notes to catch up.
  const schedule = () => {
    if (!enabled || disposed || !context || !synth || document.hidden) return
    const now = context.currentTime
    for (const voice of voices) if (voice.end <= now) release(voice)
    if (nextBarTime < now) {
      const skipped = Math.ceil((now - nextBarTime) / BOOK_MUSIC_BAR_SECONDS)
      nextBar += skipped
      nextBarTime += skipped * BOOK_MUSIC_BAR_SECONDS
    }
    if (nextBarTime <= now + LOOKAHEAD_SECONDS) {
      for (const note of bookMusicBar(nextBar)) {
        if (voices.size >= MAX_MUSIC_VOICES) break
        const voice = synth(note, nextBarTime)
        own(voice.source, voice.nodes, voice.end)
      }
      nextBar++
      nextBarTime += BOOK_MUSIC_BAR_SECONDS
    }
    timer = setTimeout(schedule, Math.max(25, (nextBarTime - context.currentTime - LOOKAHEAD_SECONDS) * 1000))
  }
  const controller = {
    stop,
    async enable() {
      if (disposed || document.hidden || enabled || pending) return
      // Claim the slot synchronously, including while resume() is pending.
      active?.stop()
      active = controller
      pending = true
      const request = ++generation
      try {
        context ??= makeContext()
        await context.resume()
        if (generation === request && document.hidden) {
          stop()
          return
        }
        if (disposed || generation !== request || document.hidden || active !== controller) {
          if (context?.state === "running" && active !== controller) void context.suspend().catch(() => {})
          return
        }
        pending = false
        enabled = true
        synth ??= createBookMusicSynth(context)
        nextBar = 0
        nextBarTime = context.currentTime + 0.04
        onChange(true, false)
        schedule()
      } catch {
        if (disposed || generation !== request) return
        stop()
        onChange(false, true)
      }
    },
    play(sound: BookSound) {
      if (!enabled || disposed || !context || context.state !== "running" || document.hidden) return
      if (context.currentTime - lastEffect < 0.18) return
      lastEffect = context.currentTime
      if (effect) release(effect)
      const duration = sound === "page" ? 0.24 : 0.55
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        const progress = i / data.length
        const ripple = sound === "leaves" ? 0.55 + 0.45 * Math.sin(progress * Math.PI * 7) ** 2 : 1
        data[i] = (Math.random() * 2 - 1) * Math.sin(progress * Math.PI) * ripple
      }
      const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain()
      source.buffer = buffer
      filter.type = "bandpass"
      filter.frequency.value = sound === "page" ? 1200 : 2400
      filter.Q.value = 0.6
      gain.gain.value = sound === "page" ? 0.1 : 0.065
      source.connect(filter).connect(gain).connect(context.destination)
      effect = own(source, [source, filter, gain], context.currentTime + duration)
      source.start(); source.stop(context.currentTime + duration)
    },
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
      if (context && context.state !== "closed") void context.close().catch(() => {})
      context = null
      synth = null
    },
  }
  const onVisibility = () => { if (document.hidden) stop() }
  document.addEventListener("visibilitychange", onVisibility)
  return controller
}
