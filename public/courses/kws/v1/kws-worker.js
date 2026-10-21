// Single-threaded WASM inference lives here, never on the 3D/UI thread.
import createModule from './sherpa-onnx-wasm-kws-main.js'
import { createKws } from './sherpa-onnx-kws.js'
import { assets } from './assets.js'

let module
let commandSpotter
let keywordConfig
let inputPort

async function loadAsset(name) {
  const url = new URL(name, import.meta.url).href
  let cache
  try { cache = await caches.open('steamx-building-kws-v1') } catch { /* Private mode may deny persistent cache. */ }
  let cached
  try { cached = await cache?.match(url) } catch { cache = undefined }
  const response = cached || await fetch(url, { cache: 'force-cache' })
  if (!response.ok) throw new Error('asset unavailable')
  const buffer = await response.arrayBuffer()
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map((v) => v.toString(16).padStart(2, '0')).join('')
  if (buffer.byteLength !== assets[name].bytes || hash !== assets[name].sha256) {
    await cache?.delete(url)
    throw new Error('asset integrity')
  }
  if (!cached) { try { await cache?.put(url, new Response(buffer)) } catch { /* Cache quota does not block this session. */ } }
  return buffer
}

function spotter(keywords) {
  return createKws(module, {
    featConfig: { samplingRate: 16000, featureDim: 80 },
    modelConfig: { transducer: {
      encoder: './encoder-epoch-12-avg-2-chunk-16-left-64.onnx',
      decoder: './decoder-epoch-12-avg-2-chunk-16-left-64.onnx',
      joiner: './joiner-epoch-12-avg-2-chunk-16-left-64.onnx',
    }, tokens: './tokens.txt', numThreads: 1, debug: 0, provider: 'cpu', modelingUnit: 'cjkchar' },
    maxActivePaths: 8, numTrailingBlanks: 1, keywordsScore: 1, keywordsThreshold: 0.25,
    keywords: '', keywordsBuf: keywords, keywordsBufSize: new TextEncoder().encode(keywords).length,
  })
}

function detect(engine, samples, sampleRate, keywords) {
  const stream = engine.createStream(keywords)
  if (!stream.handle) throw new Error('stream allocation')
  const hits = []
  try {
    // Accept/decode in bounded chunks; a fresh stream per utterance frees feature history.
    const chunk = Math.round(sampleRate * 0.08)
    const drain = () => {
      while (engine.isReady(stream)) {
        engine.decode(stream)
        const result = engine.getResult(stream)
        if (result.keyword) {
          // Account for the fixed feature warm-up, not additional recorded speech.
          result.start_time -= 0.7
          hits.push(result)
          engine.reset(stream)
          if (hits.length > 8) return false
        }
      }
      return true
    }
    // A bounded quiet prefix supplies left context after each fresh stream.
    stream.acceptWaveform(sampleRate, new Float32Array(Math.round(sampleRate * 0.7)))
    drain()
    for (let offset = 0; offset < samples.length; offset += chunk) {
      stream.acceptWaveform(sampleRate, samples.subarray(offset, offset + chunk))
      if (!drain()) return hits
    }
    stream.acceptWaveform(sampleRate, new Float32Array(Math.round(sampleRate * 0.4)))
    stream.inputFinished()
    drain()
    return hits
  } finally { stream.free() }
}

function receiveAudio({ data }) {
  if (data.type !== 'audio') return
  try {
    const { samples, sampleRate, epoch, speechStart, speechEnd, duration, capturedAt } = data
    if (!(samples instanceof Float32Array) || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 96000 ||
      samples.length > sampleRate * 5 || Date.now() - capturedAt > 2000) return
    const wake = detect(commandSpotter, samples, sampleRate, keywordConfig.wake)
    let hits = []
    let rejected = false
    let stage = wake.length === 1 ? 'action' : 'wake'
    if (wake.length === 1) {
      const actions = detect(commandSpotter, samples, sampleRate, keywordConfig.actions)
      if (actions.length === 1) {
        hits = [...wake, ...actions]
        const family = (name) => name.replace('_page', '')
        // Competing phrases have their own stream: the loudest beam must not hide
        // a conflicting action in overlapping speech. This is not speaker diarization.
        const others = keywordConfig.actions.split('\n').filter((line) => family(line.split('@')[1]) !== family(actions[0].keyword)).join('\n')
        const guarded = (keywords) => keywords.split('\n').map((line) => line.replace('@', ':0.5 #0.5 @')).join('\n')
        const conflict = detect(commandSpotter, samples, sampleRate, guarded(others)).length > 0
        const veto = !conflict && detect(commandSpotter, samples, sampleRate, guarded(keywordConfig.rejections)).length > 0
        rejected = conflict || veto
        stage = conflict ? 'conflict' : veto ? 'veto' : 'complete'
      }
    }
    samples.fill(0)
    self.postMessage({ type: 'result', epoch, capturedAt,
      observation: { hits, rejected, speechStart, speechEnd, duration }, stage })
  } catch { self.postMessage({ type: 'error' }) }
  finally { data.samples?.fill(0); inputPort.postMessage({ type: 'ack' }) }
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init' && !module) {
      const [wasmBinary, modelData] = await Promise.all([
        loadAsset('sherpa-onnx-wasm-kws-main.wasm'), loadAsset('sherpa-onnx-wasm-kws-main.data'),
      ])
      module = await createModule({ wasmBinary, getPreloadedPackage: () => modelData,
        locateFile: (name) => new URL(name, import.meta.url).href,
        print() {}, printErr() {}, // Never log recognition tokens or audio.
      })
      // Per-stream keywords are ADDED to defaults upstream. Keep the default graph
      // empty, so a command cannot leak into the veto/competitor stream.
      commandSpotter = spotter('\n')
      keywordConfig = data
      if (!commandSpotter.handle) throw new Error('model initialization')
      self.postMessage({ type: 'ready' })
    } else if (data.type === 'connect' && commandSpotter) {
      inputPort = data.port
      inputPort.onmessage = receiveAudio
    }
  } catch { self.postMessage({ type: 'error' }) }
}
