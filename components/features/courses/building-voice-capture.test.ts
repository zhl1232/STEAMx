import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBuildingVoiceCapture, type BuildingVoiceAudioEnvironment } from './building-voice-capture'

function fixture() {
  const track = Object.assign(new EventTarget(), { readyState: 'live', muted: false, stop: vi.fn() })
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream
  const node = { connect: vi.fn(), disconnect: vi.fn() }
  const port = () => ({ postMessage: vi.fn(), close: vi.fn(), onmessage: null as ((event: { data: unknown }) => void) | null })
  const worklet = { ...node, port: port(), onprocessorerror: null }
  const worker = { terminate: vi.fn(), onmessage: null as ((event: { data: unknown }) => void) | null, onerror: null,
    postMessage: vi.fn((message: { type: string }) => { if (message.type === 'init') queueMicrotask(() => worker.onmessage?.({ data: { type: 'ready' } })) }) }
  const context = Object.assign(new EventTarget(), { state: 'running', sampleRate: 48000, destination: {},
    audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) }, resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined), createMediaStreamSource: vi.fn(() => node) })
  const env = { createAudioContext: () => context, getUserMedia: vi.fn().mockResolvedValue(stream),
    createWorker: vi.fn(() => worker), createWorklet: () => worklet, createChannel: () => ({ port1: port(), port2: port() }) } as unknown as BuildingVoiceAudioEnvironment
  const controller = new AbortController()
  const onCommand = vi.fn()
  const onError = vi.fn()
  const options = { signal: controller.signal, authorized: Promise.resolve(), onCommand, onError }
  return { track, stream, worker, worklet, context, env, controller, onCommand, onError, options }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
describe('AudioWorklet + Worker capture', () => {
  it('waits for eligibility before mic/model and closes resources on abort', async () => {
    const f = fixture()
    let authorize!: () => void
    const pending = createBuildingVoiceCapture({ ...f.options, authorized: new Promise((resolve) => { authorize = resolve }) }, f.env)
    expect(f.context.resume).toHaveBeenCalledOnce()
    expect(f.env.getUserMedia).not.toHaveBeenCalled()
    authorize()
    const capture = await pending
    expect(f.env.createWorker).toHaveBeenCalledOnce()
    capture.setListening(true)
    expect(f.worklet.port.postMessage).toHaveBeenLastCalledWith({ type: 'state', epoch: 1, enabled: true })
    f.controller.abort()
    await capture.close()
    expect(f.track.stop).toHaveBeenCalledOnce()
    expect(f.worker.terminate).toHaveBeenCalledOnce()
    expect(f.context.close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('rejects unsupported AudioWorklet without microphone access', async () => {
    const f = fixture()
    Object.assign(f.context, { audioWorklet: undefined })
    await expect(createBuildingVoiceCapture(f.options, f.env)).rejects.toThrow('不支持')
    expect(f.env.getUserMedia).not.toHaveBeenCalled()
    expect(f.context.close).toHaveBeenCalledOnce()
  })
  it('releases a late permission grant after cancellation', async () => {
    const f = fixture()
    let grant!: (stream: MediaStream) => void
    vi.mocked(f.env.getUserMedia).mockImplementation(() => new Promise((resolve) => { grant = resolve }))
    const pending = createBuildingVoiceCapture(f.options, f.env)
    await Promise.resolve()
    f.controller.abort()
    grant(f.stream)
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(f.track.stop).toHaveBeenCalledOnce()
  })
  it.each(['ended', 'mute', 'suspended', 'stalled', 'overflow', 'interrupted'])('fails visibly on actual %s interruption', async (event) => {
    const f = fixture()
    const capture = await createBuildingVoiceCapture(f.options, f.env)
    if (event === 'suspended') { f.context.state = 'suspended'; f.context.dispatchEvent(new Event('statechange')) }
    else if (event === 'stalled') { vi.advanceTimersByTime(6000) }
    else if (event === 'overflow' || event === 'interrupted') { f.worklet.port.onmessage?.({ data: { type: event } }) }
    else { f.track.dispatchEvent(new Event(event)) }
    expect(f.onError).toHaveBeenCalledOnce()
    expect(f.track.stop).toHaveBeenCalledOnce()
    await capture.close()
  })
  it('does not mistake a delayed UI timer for stopped audio on return', async () => {
    const f = fixture()
    const capture = await createBuildingVoiceCapture(f.options, f.env)
    vi.setSystemTime(Date.now() + 60_000)
    capture.checkHealth()
    expect(f.onError).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    f.worklet.port.onmessage?.({ data: { type: 'heartbeat', at: Date.now() } })
    vi.advanceTimersByTime(2000)
    expect(f.onError).not.toHaveBeenCalled()
    await capture.close()
  })
  it('closes after WASM failure and does not upload or fall back', async () => {
    const f = fixture()
    f.worker.postMessage.mockImplementation((message) => {
      if (message.type === 'init') queueMicrotask(() => f.worker.onmessage?.({ data: { type: 'error' } }))
    })
    await expect(createBuildingVoiceCapture(f.options, f.env)).rejects.toBeDefined()
    expect(f.onError).toHaveBeenCalledOnce()
    expect(f.worker.terminate).toHaveBeenCalledOnce()
  })
  it('drops stale epochs, expired results, and anything received while disabled', async () => {
    const f = fixture()
    const capture = await createBuildingVoiceCapture(f.options, f.env)
    capture.setListening(true)
    const observation = { text: '小迪 下一步', valid: true, speechStart: 0.3, speechEnd: 1.3, duration: 1.96,
      words: [{word:'小迪',start:0.21,end:0.66},{word:'下一步',start:0.66,end:1.32}] }
    const emit = (epoch: number, capturedAt = Date.now()) => f.worker.onmessage?.({ data: { type: 'result', observation, epoch, capturedAt } })
    emit(1)
    expect(f.onCommand).toHaveBeenCalledExactlyOnceWith('next')
    capture.reset()
    emit(1)
    emit(2, Date.now() - 2001)
    capture.setListening(false)
    emit(3)
    expect(f.onCommand).toHaveBeenCalledOnce()
    await capture.close()
  })
})

function workletFixture(sampleRate = 16000) {
  type Processor = { buffer: Float32Array; pre: Float32Array;
    port: { onmessage: (event: { data: unknown }) => void };
    process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean }
  let Constructor!: new () => Processor
  runInNewContext(readFileSync('public/courses/kws/v1/capture-worklet.js', 'utf8'), {
    AudioWorkletProcessor: class { port = { onmessage: null, postMessage: vi.fn() } },
    sampleRate, Float32Array, Date,
    registerProcessor: (_name: string, value: new () => Processor) => { Constructor = value },
  })
  const worklet = new Constructor()
  const worker = { postMessage: vi.fn(), onmessage: null as unknown as (event: { data: { type: string } }) => void }
  worklet.port.onmessage({ data: { type: 'connect', port: worker } })
  worklet.port.onmessage({ data: { type: 'state', epoch: 1, enabled: true } })
  const feed = (ms: number, amplitude = 0) => {
    for (let i = 0; i < sampleRate * ms / 1000; i += 128) {
      const input = Float32Array.from({ length: 128 }, (_, n) => amplitude * Math.sin(2 * Math.PI * 440 * (i + n) / sampleRate))
      worklet.process([[input]], [[new Float32Array(128)]])
    }
  }
  return { worklet, worker, feed }
}
describe('bounded capture processor', () => {
  it('requires quiet arming, complete speech and trailing silence; enforces one in-flight segment', () => {
    const { worklet, worker, feed } = workletFixture()
    feed(1000, 0.1) // session starts mid-sentence, rejected
    feed(1000)
    feed(1000, 0.1)
    feed(800)
    expect(worker.postMessage).toHaveBeenCalledOnce()
    expect(worker.postMessage.mock.calls[0][0].samples.length).toBeLessThanOrEqual(80000)
    for (let i = 0; i < 10; i++) { feed(1000); feed(1000, 0.1) }
    expect(worker.postMessage).toHaveBeenCalledOnce()
    worker.onmessage({ data: { type: 'ack' } })
    feed(1000); feed(1000, 0.1); feed(800)
    expect(worker.postMessage).toHaveBeenCalledTimes(2)
    expect(worklet.buffer.length).toBe(80000)
  })
  it('rejects duration cuts, continuous noise and reset fragments instead of executing a prefix', () => {
    const { worklet, worker, feed } = workletFixture(48000)
    feed(1000); feed(30000, 0.1); feed(1000)
    expect(worker.postMessage).not.toHaveBeenCalled()
    feed(700, 0.1)
    worklet.port.onmessage({ data: { type: 'state', epoch: 2, enabled: true } })
    feed(1000)
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(worklet.buffer.length).toBe(240000)
    expect(worklet.pre.length).toBe(14400)
  })
})
