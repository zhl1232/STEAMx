export type PreparationStatus = 'idle' | 'downloading' | 'cached' | 'initializing' | 'ready' | 'using' | 'deferred' | 'error' | 'unsupported'
export type PreparationSnapshot = { status: PreparationStatus; persisted: boolean; fromCache: boolean }
export type PreparedVoiceLease = { worker: Worker; release: () => void }
const IDLE: PreparationSnapshot = { status: 'idle', persisted: false, fromCache: false }
const ASSETS = '/courses/vosk/v1'

/** One model per mounted course page; no AudioContext, audio session or microphone here. */
export class BuildingVoicePreparation {
  private snapshot = IDLE
  private listeners = new Set<() => void>()
  private owners = 0
  private worker: Worker | null = null
  private downloader: Worker | null = null
  private cancelScheduled: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
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
    this.timer = null
    this.downloader?.terminate(); this.downloader = null
    this.worker?.terminate(); this.worker = null
  }
  dispose = () => { this.clearWork(); this.publish('idle') }
  private fail = () => { this.clearWork(); this.publish('error') }
  prepare(allowNetwork: boolean) {
    if (!['idle', 'deferred', 'error'].includes(this.snapshot.status)) return
    this.clearWork()
    const generation = this.generation
    this.publish('downloading')
    let download: Worker
    try { download = this.createWorker(`${ASSETS}/prepare-worker.js`) } catch { this.fail(); return }
    this.downloader = download
    this.timer = setTimeout(this.fail, 120_000)
    download.onerror = this.fail
    download.onmessage = ({ data }) => {
      if (generation !== this.generation) return
      if (data.type === 'deferred') { this.clearWork(); this.publish('deferred'); return }
      if (data.type === 'error') { this.fail(); return }
      if (data.type !== 'cached') return
      download.terminate(); this.downloader = null
      this.publish('cached', { persisted: data.persisted, fromCache: data.fromCache })
      // A separate idle opportunity; merely caching bytes never marks the engine ready.
      this.cancelScheduled = scheduleVoiceIdle(() => {
        if (generation !== this.generation) return
        this.cancelScheduled = null
        this.publish('initializing')
        let worker: Worker
        try { worker = this.createWorker(`${ASSETS}/vosk-worker.js`) } catch { this.fail(); return }
        this.worker = worker
        worker.addEventListener('error', this.fail)
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
      this.timer = setTimeout(this.fail, 2000)
      worker.postMessage({ type: 'disconnect' })
    } }
  }
}
export const buildingVoicePreparation = new BuildingVoicePreparation()

export function scheduleVoiceIdle(task: () => void) {
  let idle: number | undefined
  const timer = setTimeout(() => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(task)
    else task()
  }, 2000)
  return () => { clearTimeout(timer); if (idle !== undefined) window.cancelIdleCallback(idle) }
}
export function supportsBuildingVoicePreparation() {
  return typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia &&
    !!window.AudioContext && !!window.AudioWorkletNode && !!window.Worker && !!window.WebAssembly && typeof AbortSignal.any === 'function'
}
export function allowAutomaticVoiceDownload(connection: { saveData?: boolean; effectiveType?: string; downlink?: number; type?: string } | undefined, mobile: boolean, online: boolean) {
  if (!online || !connection || connection.saveData || connection.effectiveType !== '4g' || (connection.downlink ?? 0) < 5) return false
  return connection.type !== 'cellular' && (!mobile || connection.type === 'wifi' || connection.type === 'ethernet')
}
