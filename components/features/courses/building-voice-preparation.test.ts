import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BuildingVoicePreparation, allowAutomaticVoiceDownload } from './building-voice-preparation'

class FakeWorker extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  emit(data: Record<string, unknown>) {
    const event = new MessageEvent('message', { data })
    this.onmessage?.(event); this.dispatchEvent(event)
  }
}
function fixture() {
  const workers: FakeWorker[] = []
  const create = vi.fn(() => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker })
  return { workers, create, owner: new BuildingVoicePreparation(create) }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
describe('silent course voice preparation', () => {
  it('deduplicates downloads and never equates cached bytes with engine readiness', async () => {
    const f = fixture(); const release = f.owner.retain()
    f.owner.prepare(true); f.owner.prepare(true)
    expect(f.create).toHaveBeenCalledOnce()
    expect(f.workers[0].postMessage).toHaveBeenCalledWith({ type: 'prepare', allowNetwork: true })
    f.workers[0].emit({ type: 'cached', modelBytes: new ArrayBuffer(1), runtimeBytes: new ArrayBuffer(1), persisted: true, fromCache: false })
    expect(f.owner.getSnapshot().status).toBe('cached')
    expect(() => f.owner.acquire()).toThrow()
    await vi.advanceTimersByTimeAsync(2001)
    expect(f.owner.getSnapshot().status).toBe('initializing')
    f.workers[1].emit({ type: 'ready' })
    const lease = f.owner.acquire()
    expect(f.owner.getSnapshot().status).toBe('using')
    expect(() => f.owner.acquire()).toThrow()
    lease.release(); lease.release()
    expect(f.workers[1].postMessage.mock.calls.filter(([m])=>m.type==='disconnect')).toHaveLength(1)
    expect(f.owner.getSnapshot().status).toBe('initializing')
    f.workers[1].emit({ type: 'detached' })
    expect(f.owner.getSnapshot().status).toBe('ready')
    release(); await Promise.resolve()
    expect(f.workers[1].terminate).toHaveBeenCalledOnce()
    expect(f.owner.getSnapshot().status).toBe('idle')
  })
  it('cancels a departed page, preserves a shared owner, and ignores late downloads', async () => {
    const f = fixture(); const first = f.owner.retain(); const second = f.owner.retain()
    f.owner.prepare(true); first(); await Promise.resolve()
    expect(f.workers[0].terminate).not.toHaveBeenCalled()
    second(); await Promise.resolve()
    expect(f.workers[0].terminate).toHaveBeenCalledOnce()
    f.workers[0].emit({ type: 'cached', modelBytes: new ArrayBuffer(1), runtimeBytes: new ArrayBuffer(1) })
    await vi.advanceTimersByTimeAsync(5000)
    expect(f.create).toHaveBeenCalledOnce()
    expect(f.owner.getSnapshot().status).toBe('idle')
  })
  it('probes only cache on constrained networks; retry is explicit after failure', async () => {
    const f = fixture(); const release = f.owner.retain()
    f.owner.prepare(false)
    expect(f.workers[0].postMessage).toHaveBeenCalledWith({ type: 'prepare', allowNetwork: false })
    f.workers[0].emit({ type: 'deferred' })
    await vi.advanceTimersByTimeAsync(300000)
    expect(f.create).toHaveBeenCalledOnce()
    f.owner.prepare(true); f.workers[1].emit({ type: 'error' })
    await vi.advanceTimersByTimeAsync(300000)
    expect(f.create).toHaveBeenCalledTimes(2)
    expect(f.owner.getSnapshot().status).toBe('error')
    release(); await Promise.resolve()
  })
  it('reuses verified memory-only bytes when persistent cache is unavailable', async () => {
    const f = fixture(); const release = f.owner.retain()
    f.owner.prepare(true)
    const modelBytes = new ArrayBuffer(4), runtimeBytes = new ArrayBuffer(2)
    f.workers[0].emit({ type: 'cached', modelBytes, runtimeBytes, persisted: false, fromCache: false })
    await vi.advanceTimersByTimeAsync(2001)
    expect(f.workers[1].postMessage).toHaveBeenCalledWith({ type: 'init', modelBytes, runtimeBytes }, [modelBytes, runtimeBytes])
    f.workers[1].emit({ type: 'ready' })
    expect(f.owner.getSnapshot()).toMatchObject({ status: 'ready', persisted: false })
    release(); await Promise.resolve()
  })
  it('times out and releases a hung preparation without retrying itself', async () => {
    const f = fixture(); const release = f.owner.retain(); f.owner.prepare(true)
    await vi.advanceTimersByTimeAsync(120001)
    expect(f.workers[0].terminate).toHaveBeenCalledOnce()
    expect(f.owner.getSnapshot().status).toBe('error')
    release(); await Promise.resolve()
  })
  it.each([
    [undefined, false, true, false],
    [{effectiveType:'4g',downlink:10},false,true,true],
    [{effectiveType:'4g',downlink:10,saveData:true},false,true,false],
    [{effectiveType:'3g',downlink:10},false,true,false],
    [{effectiveType:'4g',downlink:2},false,true,false],
    [{effectiveType:'4g',downlink:10,type:'cellular'},false,true,false],
    [{effectiveType:'4g',downlink:10},true,true,false],
    [{effectiveType:'4g',downlink:10,type:'wifi'},true,true,true],
    [{effectiveType:'4g',downlink:10,type:'wifi'},true,false,false],
  ] as const)('respects network policy %j mobile=%s online=%s', (connection,mobile,online,expected) => {
    expect(allowAutomaticVoiceDownload(connection,mobile,online)).toBe(expected)
  })
})
