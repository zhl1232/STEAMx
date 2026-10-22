/* Vosk inference adapter. PCM remains in workers; no audio/text is logged or stored. */
importScripts('./vosk.js', './grammar.js')
let model, recognizer, inputPort, pending, currentEpoch = 0, currentSegment = 0
let textParts = [], words = [], textLength = 0, invalid = false
const stats = { chunks: 0, totalMs: 0, maxMs: 0, segments: 0, cancelled: 0 }
function reset() {
  recognizer?.remove()
  recognizer = null
  textParts = []
  words = []
  textLength = 0
  invalid = false
}
function receive(message) {
  if (message.event === 'result' && message.result.text) {
    textLength += message.result.text.length
    if (textLength > 80 || textParts.length >= 8) invalid = true
    else {
      textParts.push(message.result.text)
      if (words.length + (message.result.result?.length ?? 0) > 32) invalid = true
      else words.push(...(message.result.result ?? []))
    }
  }
  if (pending) { clearTimeout(pending.timer); pending.resolve(); pending = null }
}
function request(send) {
  if (pending) return Promise.reject(new Error('Concurrent decoder request'))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending = null; reject(new Error('Decoder stalled')) }, 2000)
    pending = { resolve, reject, timer }
    send()
  })
}
function begin(rate) {
  reset()
  recognizer = new model.KaldiRecognizer(rate, JSON.stringify(BUILDING_VOSK_GRAMMAR))
  recognizer.setWords(true)
  recognizer.on('result', receive)
  recognizer.on('partialresult', receive)
}
async function receiveAudio({ data }) {
  try {
    if (data.type === 'reset') { currentEpoch = data.epoch; reset(); return }
    if (data.type === 'begin') {
      if (!Number.isFinite(data.sampleRate) || data.sampleRate < 8000 || data.sampleRate > 96000) throw new Error('Invalid sample rate')
      currentEpoch = data.epoch; currentSegment = data.segment
      begin(data.sampleRate)
      return
    }
    if (data.epoch !== currentEpoch || data.segment !== currentSegment || !recognizer) return
    if (data.type === 'chunk') {
      if (!(data.samples instanceof Float32Array) || data.samples.length > data.sampleRate * .11) throw new Error('Invalid PCM block')
      const start = performance.now()
      await request(() => recognizer.acceptWaveformFloat(data.samples, data.sampleRate))
      const ms = performance.now() - start
      stats.chunks++; stats.totalMs += ms; stats.maxMs = Math.max(stats.maxMs, ms)
    } else if (data.type === 'cancel') { stats.cancelled++; reset() }
    else if (data.type === 'end') {
      await request(() => recognizer.retrieveFinalResult())
      // Preserve every token, including [unk] and negative/quoted words. Never execute partials.
      const text = textParts.join(' ')
      const valid = data.valid && !invalid
      const observation = { text, words, valid, speechStart: data.speechStart, speechEnd: data.speechEnd, duration: data.duration }
      reset(); stats.segments++
      self.postMessage({ type: 'result', observation, epoch: data.epoch, capturedAt: data.capturedAt })
    }
  } catch { self.postMessage({ type: 'error' }) }
  finally { data.samples?.fill(0); inputPort.postMessage({ type: 'ack', id: data.id }) }
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init' && !model) {
      // The patched upstream loader verifies the archive and caches only this static resource.
      model = new Vosk.Model(new URL('./model.tar.gz', self.location.href).href, -1)
      await new Promise((resolve, reject) => {
        model.on('load', (message) => message.result ? resolve() : reject(new Error('Model unavailable')))
        model.on('error', () => {
          if (pending) { clearTimeout(pending.timer); pending.reject(new Error('Decoder failed')); pending = null }
          reject(new Error('Model failed'))
          self.postMessage({ type: 'error' })
        })
      })
      self.postMessage({ type: 'ready' })
    } else if (data.type === 'connect' && model?.ready) {
      inputPort = data.port
      inputPort.onmessage = receiveAudio
    } else if (data.type === 'stats') self.postMessage({ type: 'stats', stats })
  } catch { self.postMessage({ type: 'error' }) }
}
