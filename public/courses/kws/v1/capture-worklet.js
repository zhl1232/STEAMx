/* Bounded mono capture. No inference, networking, storage or microphone monitoring. */
class BuildingKwsCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.frame = new Float32Array(Math.round(sampleRate * 0.02))
    this.buffer = new Float32Array(Math.ceil(sampleRate * 5))
    this.pre = new Float32Array(this.frame.length * 15)
    this.enabled = false
    this.epoch = 0
    this.busy = false
    this.heartbeatFrames = 0
    this.reset()
    this.port.onmessage = ({ data }) => {
      if (data.type === 'connect') {
        this.worker = data.port
        this.worker.onmessage = ({ data: reply }) => {
          if (reply.type === 'ack') this.busy = false
        }
      } else if (data.type === 'state') {
        this.enabled = data.enabled
        this.epoch = data.epoch
        this.reset()
      }
    }
  }
  reset() {
    this.frameLength = 0
    this.length = 0
    this.preLength = 0
    this.preIndex = 0
    this.quiet = 0
    this.armed = false
    this.silence = 0
    this.voiced = 0
    this.lastVoice = 0
    this.frame.fill(0)
    this.buffer.fill(0)
    this.pre.fill(0)
  }
  acceptFrame() {
    let power = 0
    for (const value of this.frame) power += value * value
    const voice = Math.sqrt(power / this.frame.length) >= 0.012
    if (!this.armed) {
      this.quiet = voice ? 0 : this.quiet + 0.02
      if (this.quiet >= 0.66) this.armed = true
      return
    }
    if (!this.length && !voice) {
      this.pre.set(this.frame, this.preIndex)
      this.preIndex = (this.preIndex + this.frame.length) % this.pre.length
      this.preLength = Math.min(this.pre.length, this.preLength + this.frame.length)
      return
    }
    if (!this.length) {
      // Always keep 300ms pre-roll (zero padding at session start).
      this.buffer.set(this.pre.subarray(this.preIndex), 0)
      this.buffer.set(this.pre.subarray(0, this.preIndex), this.pre.length - this.preIndex)
      this.length = this.pre.length
    }
    if (this.length + this.frame.length > this.buffer.length) {
      this.reset() // Never execute a duration-truncated sentence.
      return
    }
    this.buffer.set(this.frame, this.length)
    this.length += this.frame.length
    this.silence = voice ? 0 : this.silence + 0.02
    if (voice) { this.voiced += 0.02; this.lastVoice = this.length / sampleRate }
    if (this.silence < 0.66) return
    if (this.voiced >= 0.3 && !this.busy && this.worker) {
      const samples = this.buffer.slice(0, this.length)
      this.busy = true // One transferable in flight; later speech is discarded, never queued.
      this.worker.postMessage({ type: 'audio', samples, sampleRate, epoch: this.epoch,
        speechStart: this.pre.length / sampleRate, speechEnd: this.lastVoice,
        capturedAt: Date.now(), duration: samples.length / sampleRate }, [samples.buffer])
    }
    this.reset()
  }
  process(inputs, outputs) {
    for (const output of outputs) for (const channel of output) channel.fill(0)
    const input = inputs[0]?.[0]
    this.heartbeatFrames += input?.length || 0
    if (this.heartbeatFrames >= sampleRate) {
      this.heartbeatFrames = 0
      this.port.postMessage({ type: 'heartbeat', at: Date.now() })
    }
    if (!this.enabled || !input || this.busy) return true
    for (let i = 0; i < input.length; i++) {
      this.frame[this.frameLength++] = input[i]
      if (this.frameLength === this.frame.length) {
        this.frameLength = 0
        this.acceptFrame()
      }
    }
    return true
  }
}
registerProcessor('building-kws-capture', BuildingKwsCapture)
