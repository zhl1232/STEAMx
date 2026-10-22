import { selectBuildingAsrCommand, type BuildingAsrObservation } from '@/lib/courses/building-voice-asr'
import type { PreparedVoiceLease } from './building-voice-preparation'
import type { BuildingVoiceCommand } from '@/lib/courses/building-voice-commands'

const ASSETS = '/courses/vosk/v1'
const LOAD_TIMEOUT_MS = 120_000
const MAX_RESULT_AGE_MS = 2_000

export type BuildingVoiceCapture = {
  setListening: (enabled: boolean) => void
  reset: () => void
  playCue: () => void
  checkHealth: () => void
  close: () => Promise<void>
}
export type BuildingVoiceCaptureOptions = {
  signal: AbortSignal
  /** Server eligibility is checked before opening the mic or loading the model. */
  authorized: Promise<void>
  acquireEngine?: () => PreparedVoiceLease
  onCommand: (command: BuildingVoiceCommand) => void
  onError: (error: Error) => void
}
export type BuildingVoiceAudioEnvironment = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  createAudioContext: () => AudioContext
  createWorker: () => Worker
  createWorklet: (context: AudioContext) => AudioWorkletNode
  createChannel: () => MessageChannel
}

function browserAudioEnvironment(): BuildingVoiceAudioEnvironment {
  if (typeof window === 'undefined' || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia ||
    !window.AudioContext || !window.AudioWorkletNode || !window.Worker || !window.WebAssembly || typeof AbortSignal.any !== 'function') {
    throw new Error('当前浏览器不支持设备内语音识别，请更新浏览器或使用翻页按钮。')
  }
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createAudioContext: () => new AudioContext(),
    createWorker: () => new Worker(`${ASSETS}/vosk-worker.js`),
    createWorklet: (context) => new AudioWorkletNode(context, 'building-vosk-capture'),
    createChannel: () => new MessageChannel(),
  }
}

function aborted() { return new DOMException('Voice capture cancelled', 'AbortError') }

/** User gesture opens the audio context. Audio flows worklet -> worker, never through React. */
export async function createBuildingVoiceCapture(options: BuildingVoiceCaptureOptions, environment?: BuildingVoiceAudioEnvironment): Promise<BuildingVoiceCapture> {
  if (options.signal.aborted) throw aborted()
  const audio = environment ?? browserAudioEnvironment()
  const context = audio.createAudioContext()
  let stream: MediaStream | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let worklet: AudioWorkletNode | null = null
  let worker: Worker | null = null
  let prepared: PreparedVoiceLease | null = null
  let channel: MessageChannel | null = null
  let closed = false
  let ready = false
  let enabled = false
  let epoch = 0
  let heartbeat = Date.now()
  let lastWatchdog = Date.now()
  let closing: Promise<void> | null = null
  let rejectLoad: ((error: Error) => void) | null = null
  let watchdog: ReturnType<typeof setInterval> | null = null
  const trackListeners: Array<{ track: MediaStreamTrack; listener: () => void }> = []
  const timer = setTimeout(() => fail('本地语音加载超时，请检查网络后点击继续；也可使用翻页按钮。'), LOAD_TIMEOUT_MS)

  const close = () => {
    if (closed) return closing ?? Promise.resolve()
    closed = true
    enabled = false
    epoch += 1
    clearTimeout(timer)
    if (watchdog) clearInterval(watchdog)
    rejectLoad?.(aborted())
    options.signal.removeEventListener('abort', onAbort)
    context.removeEventListener('statechange', checkHealth)
    for (const { track, listener } of trackListeners) {
      track.removeEventListener('ended', listener)
      track.removeEventListener('mute', listener)
    }
    if (prepared) prepared.release() // Standby model belongs to the mounted course; audio/decoder is discarded.
    else worker?.terminate()
    channel?.port1.close()
    channel?.port2.close()
    if (worklet) { worklet.port.onmessage = null; worklet.port.close() }
    for (const node of [worklet, source]) { try { node?.disconnect() } catch { /* Browser already disconnected it. */ } }
    for (const track of stream?.getTracks() ?? []) track.stop()
    closing = context.state === 'closed' ? Promise.resolve() : context.close().catch(() => undefined)
    return closing
  }
  function fail(message: string) {
    if (closed) return
    void close()
    options.onError(new Error(message))
  }
  const onAbort = () => { void close() }
  function checkHealth() {
    if (!ready || closed) return
    if (context.state !== 'running' || stream?.getAudioTracks().some((track) => track.readyState !== 'live' || track.muted)) {
      fail('浏览器或麦克风已中断采集，请点击继续恢复；也可使用翻页按钮。')
    }
  }
  options.signal.addEventListener('abort', onAbort, { once: true })
  if (options.signal.aborted) { await close(); throw aborted() }
  // Must run synchronously in the click handler, before any permission/network await.
  const resumed = context.resume().then(() => null, (error: unknown) => error)
  const stillCurrent = () => { if (closed || options.signal.aborted) throw aborted() }
  const update = () => { epoch += 1; worklet?.port.postMessage({ type: 'state', epoch, enabled }) }

  try {
    if (!context.audioWorklet) throw new Error('当前浏览器不支持音频工作线程，请更新浏览器或使用翻页按钮。')
    await options.authorized
    stillCurrent()
    prepared = options.acquireEngine?.() ?? null
    worker = prepared?.worker ?? audio.createWorker()
    const loaded = new Promise<void>((resolve, reject) => {
      rejectLoad = reject
      worker!.onerror = () => fail('本地语音引擎无法运行，请更新浏览器后重试；也可使用翻页按钮。')
      worker!.onmessage = ({ data }) => {
        if (closed) return
        if (data.type === 'ready') { rejectLoad = null; resolve(); return }
        if (data.type === 'error') { fail('本地语音资源加载或识别失败，请点击继续重试；也可使用翻页按钮。'); return }
        if (data.type !== 'result' || !ready || !enabled || data.epoch !== epoch ||
          !Number.isFinite(data.capturedAt) || Date.now() - data.capturedAt > MAX_RESULT_AGE_MS || data.capturedAt > Date.now()) return
        checkHealth()
        if (closed) return
        const command = selectBuildingAsrCommand(data.observation as BuildingAsrObservation)
        if (command) options.onCommand(command)
      }
      if (prepared) { rejectLoad = null; resolve() }
      else worker!.postMessage({ type: 'init' })
    })
    // Observe rejection immediately while the browser may keep a permission dialog open.
    const assetsReady = Promise.all([loaded, context.audioWorklet.addModule(`${ASSETS}/capture-worklet.js`)])
      .then(() => null, (error: unknown) => error)
    stream = await audio.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    if (closed || options.signal.aborted) {
      for (const track of stream.getTracks()) track.stop()
      throw aborted()
    }
    const resumeError = await resumed
    const assetError = await assetsReady
    stillCurrent()
    if (resumeError) throw resumeError
    if (assetError) throw assetError
    if (context.state !== 'running') throw new Error('音频未能启动，请点击继续重试。')
    if (!stream.getAudioTracks().length || stream.getAudioTracks().some((track) => track.muted || track.readyState !== 'live')) {
      throw new Error('麦克风未能启动，请点击继续重试。')
    }
    source = context.createMediaStreamSource(stream)
    worklet = audio.createWorklet(context)
    channel = audio.createChannel()
    worklet.port.postMessage({ type: 'connect', port: channel.port1 }, [channel.port1])
    worker.postMessage({ type: 'connect', port: channel.port2 }, [channel.port2])
    worklet.onprocessorerror = () => fail('音频采集已中断，请点击继续恢复。')
    worklet.port.onmessage = ({ data }) => {
      if (data.type === 'heartbeat') heartbeat = data.at
      else if (data.type === 'overflow') fail('设备暂时处理不过来，语音已暂停；请点击继续或使用翻页按钮。')
      else if (data.type === 'interrupted') fail('音频采集出现中断，语音已暂停；请点击继续恢复。')
    }
    source.connect(worklet)
    worklet.connect(context.destination)
    for (const track of stream.getTracks()) {
      const listener = () => fail('麦克风已中断，请点击继续恢复。')
      track.addEventListener('ended', listener)
      track.addEventListener('mute', listener)
      trackListeners.push({ track, listener })
    }
    clearTimeout(timer)
    heartbeat = Date.now()
    ready = true
    context.addEventListener('statechange', checkHealth)
    lastWatchdog = Date.now()
    watchdog = setInterval(() => {
      const now = Date.now()
      // A throttled main-thread timer is not proof that audio stopped. Allow
      // one fresh heartbeat after a scheduling gap, then enforce the watchdog.
      if (now - lastWatchdog > 5_000) heartbeat = now
      lastWatchdog = now
      checkHealth()
      if (!closed && now - heartbeat > 5_000) fail('音频采集已中断，请点击继续恢复。')
    }, 2_000)
    return {
      setListening(value) { if (!closed) { enabled = value; update() } },
      reset() { if (!closed) update() },
      checkHealth,
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
        } catch { /* Visual feedback remains available. */ }
      },
      close,
    }
  } catch (error) { await close(); throw error }
}
