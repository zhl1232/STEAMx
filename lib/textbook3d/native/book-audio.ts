/** Original procedural audio. No recordings, downloads, persistent preference or RAF. */
export type BookSound = "page" | "leaves"
type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[] }
let active: { stop: () => void } | null = null

export function createBookAudio(onChange: (enabled: boolean, unavailable: boolean) => void, makeContext = () => new AudioContext()) {
  let context: AudioContext | null = null
  let enabled = false
  let pending = false
  let disposed = false
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let effect: Voice | null = null
  let lastEffect = -Infinity
  const voices = new Set<Voice>()
  const release = (voice: Voice) => {
    if (!voices.delete(voice)) return
    try { voice.source.stop() } catch { /* Already ended. */ }
    voice.source.onended = null
    voice.nodes.forEach((node) => node.disconnect())
    if (effect === voice) effect = null
  }
  const own = (source: AudioScheduledSourceNode, nodes: AudioNode[]) => {
    const voice = { source, nodes }
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
  // Sparse pentatonic phrases, scheduled in the audio clock. At most three notes.
  const phrase = () => {
    if (!enabled || disposed || !context || document.hidden) return
    for (const [i, frequency] of [261.63, 329.63, 392].entries()) {
      const oscillator = context.createOscillator(), gain = context.createGain()
      oscillator.type = "sine"
      oscillator.frequency.value = frequency
      const start = context.currentTime + i * 1.3
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.018, start + 0.12)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.9)
      oscillator.connect(gain).connect(context.destination)
      own(oscillator, [oscillator, gain])
      oscillator.start(start); oscillator.stop(start + 2)
    }
    timer = setTimeout(phrase, 8500)
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
        if (disposed || generation !== request || document.hidden || active !== controller) {
          if (context?.state === "running" && active !== controller) void context.suspend().catch(() => {})
          return
        }
        pending = false
        enabled = true
        onChange(true, false)
        phrase()
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
      effect = own(source, [source, filter, gain])
      source.start(); source.stop(context.currentTime + duration)
    },
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
      if (context && context.state !== "closed") void context.close().catch(() => {})
      context = null
    },
  }
  const onVisibility = () => { if (document.hidden) stop() }
  document.addEventListener("visibilitychange", onVisibility)
  return controller
}
