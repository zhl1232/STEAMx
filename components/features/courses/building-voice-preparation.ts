export type PreparationStatus = 'idle' | 'downloading' | 'cached' | 'initializing' | 'ready' | 'using' | 'deferred' | 'error' | 'unsupported'
export type PreparationSnapshot = { status: PreparationStatus; persisted: boolean; fromCache: boolean; failure?: 'download' | 'integrity' | 'initialization' }
export type PreparedVoiceLease = { worker: Worker; release: () => void }
const IDLE: PreparationSnapshot = { status: 'idle', persisted: false, fromCache: false }
// Only the downloader changes version. Model, grammar and inference adapter are unchanged.
const ASSETS = '/courses/vosk/v1'
export const VOICE_DOWNLOAD_TIMEOUT_MS = 600_000
export const VOICE_PROGRESS_TIMEOUT_MS = 60_000
export const VOICE_INITIALIZATION_TIMEOUT_MS = 120_000

/** One model per mounted course page; no AudioContext, audio session or microphone here. */
export class BuildingVoicePreparation {
  private snapshot = IDLE
  private listeners = new Set<() => void>()
  private owners = 0
  private worker: Worker | null = null
  private downloader: Worker | null = null
  private cancelScheduled: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private progressTimer: ReturnType<typeof setTimeout> | null = null
  private generation = 0
  constructor(private createWorker = (url: string) => new Worker(url)) {}
  getSnapshot = () => this.snapshot
  getServerSnapshot = () => IDLE
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(status: PreparationStatus, extra: Partial<PreparationSnapshot> = {}) {
    this.snapshot = { ...this.snapshot, ...extra, status }
    this.listeners.forEach(listener => listener())
  }
  retain() {
    this.owners++
    let released = false
    return () => {
      if (released) return
      released = true
      this.owners--
      queueMicrotask(() => { if (!this.owners) this.dispose() })
    }
  }
  private clearWork() {
    this.generation++
    this.cancelScheduled?.(); this.cancelScheduled = null
    if (this.timer) clearTimeout(this.timer)
    if (this.progressTimer) clearTimeout(this.progressTimer)
    this.timer = null
    this.progressTimer = null
    this.downloader?.terminate(); this.downloader = null
    this.worker?.terminate(); this.worker = null
  }
  dispose = () => { this.clearWork(); this.publish('idle', IDLE) }
  private fail = (failure: PreparationSnapshot['failure'] = 'initialization') => { this.clearWork(); this.publish('error', { failure }) }
  prepare(allowNetwork: boolean) {
    if (!['idle', 'deferred', 'error'].includes(this.snapshot.status)) return
    this.clearWork()
    const generation = this.generation
    this.publish('downloading', { ...IDLE, failure: undefined })
    let download: Worker
    try { download = this.createWorker('/courses/vosk/v2/prepare-worker.js') } catch { this.fail('download'); return }
    this.downloader = download
    this.timer = setTimeout(() => this.fail('download'), VOICE_DOWNLOAD_TIMEOUT_MS)
    const progress = () => {
      if (this.progressTimer) clearTimeout(this.progressTimer)
      this.progressTimer = setTimeout(() => this.fail('download'), VOICE_PROGRESS_TIMEOUT_MS)
    }
    progress()
    const failCurrent = () => { if (generation === this.generation) this.fail() }
    download.onerror = () => { if (generation === this.generation && this.downloader === download) this.fail('download') }
    download.onmessage = ({ data }) => {
      if (generation !== this.generation || this.downloader !== download) return
      // Another tab may be downloading. The total deadline still bounds lock wait.
      if (data.type === 'waiting') { if (this.progressTimer) clearTimeout(this.progressTimer); this.progressTimer = null; return }
      if (data.type === 'deferred') { this.clearWork(); this.publish('deferred'); return }
      if (data.type === 'progress') { progress(); return }
      if (data.type === 'error') { this.fail(data.code === 'integrity' ? 'integrity' : 'download'); return }
      if (data.type !== 'cached') return
      download.terminate(); this.downloader = null
      if (this.timer) clearTimeout(this.timer)
      if (this.progressTimer) clearTimeout(this.progressTimer)
      this.timer = this.progressTimer = null
      this.publish('cached', { persisted: data.persisted, fromCache: data.fromCache })
      // A separate idle opportunity; merely caching bytes never marks the engine ready.
      this.cancelScheduled = scheduleVoiceIdle(() => {
        if (generation !== this.generation) return
        this.cancelScheduled = null
        this.publish('initializing')
        this.timer = setTimeout(() => this.fail('initialization'), VOICE_INITIALIZATION_TIMEOUT_MS)
        let worker: Worker
        try { worker = this.createWorker(`${ASSETS}/vosk-worker.js`) } catch { this.fail(); return }
        this.worker = worker
        worker.addEventListener('error', failCurrent)
        worker.addEventListener('message', ({ data: reply }) => {
          if (generation !== this.generation) return
          if (reply.type === 'error') this.fail()
          else if (reply.type === 'ready' || reply.type === 'detached') {
            if (this.timer) clearTimeout(this.timer)
            this.timer = null
            this.publish('ready')
          }
        })
        worker.postMessage({ type: 'init', modelBytes: data.modelBytes, runtimeBytes: data.runtimeBytes }, [data.modelBytes, data.runtimeBytes])
      })
    }
    download.postMessage({ type: 'prepare', allowNetwork })
  }
  acquire = (): PreparedVoiceLease => {
    if (this.snapshot.status !== 'ready' || !this.worker) throw new Error('语音尚未准备好，请在语音设置中重试。')
    const worker = this.worker
    this.publish('using')
    let released = false
    return { worker, release: () => {
      if (released) return
      released = true
      worker.onmessage = null; worker.onerror = null
      if (worker !== this.worker) return
      // Reuse only the model. Disconnect the input port, discard the recognizer and all PCM.
      this.publish('initializing')
      this.timer = setTimeout(() => this.fail('initialization'), 2000)
      worker.postMessage({ type: 'disconnect' })
    } }
  }
}
export const buildingVoicePreparation = new BuildingVoicePreparation()

export function scheduleVoiceIdle(task: () => void) {
  let idle: number | undefined
  const timer = setTimeout(() => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(task, { timeout: 5000 })
    else task()
  }, 2000)
  return () => { clearTimeout(timer); if (idle !== undefined) window.cancelIdleCallback(idle) }
}
export function supportsBuildingVoicePreparation() {
  return typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia &&
    !!window.AudioContext && !!window.AudioWorkletNode && !!window.Worker && !!window.WebAssembly && typeof AbortSignal.any === 'function'
}
export function allowAutomaticVoiceDownload(connection: { saveData?: boolean; effectiveType?: string; downlink?: number; type?: string } | undefined, online: boolean) {
  if (!online || !connection || connection.saveData || connection.type === 'cellular') return false
  if (connection.effectiveType && connection.effectiveType !== '4g') return false
  if (typeof connection.downlink === 'number' && connection.downlink < 5) return false
  if (connection.type === 'wifi' || connection.type === 'ethernet') return true
  // Some browsers omit physical connection.type. Fast estimates are
  // sufficient on either form factor; this cannot prove that a connection is Wi-Fi.
  return connection.effectiveType === '4g' && (connection.downlink ?? 0) >= 5
}
