import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'

type RecognizerEvent = { event: string; result: { text: string; result: unknown[] } }
type Output = { type: string; observation?: { text: string; valid: boolean } }
type AudioRequest = { type: string; id: number; epoch: number; segment: number; sampleRate: number; samples?: Float32Array; valid?: boolean; speechStart?: number; speechEnd?: number; duration?: number }
type MockPort = { close: () => void; postMessage: (message: {type:string}) => void; onmessage?: (event: {data: AudioRequest}) => Promise<void> }
function fixture() {
  const messages: Output[] = []
  const replies: Array<{type:string}> = []
  const recognizers: Recognizer[] = []
  let nextText = ''
  let stalled = false
  class Recognizer {
    callbacks: Record<string, (message: RecognizerEvent) => void> = {}
    remove = vi.fn()
    setWords = vi.fn()
    constructor() { recognizers.push(this) }
    on(name: string, fn: (message: RecognizerEvent) => void) { this.callbacks[name] = fn }
    acceptWaveformFloat() {
      if (!stalled) queueMicrotask(() => this.callbacks.result({ event: 'result', result: { text: nextText, result: [] } }))
    }
    retrieveFinalResult() { queueMicrotask(() => this.callbacks.result({ event: 'result', result: { text: '', result: [] } })) }
  }
  class Model {
    ready = true
    KaldiRecognizer = Recognizer
    on(name: string, fn: (message: {result:boolean}) => void) { if (name === 'load') queueMicrotask(() => fn({ result: true })) }
  }
  const scope: { location: {href:string}; postMessage: (value:Output)=>void; onmessage?: (event:{data:{type:string;port?:MockPort}})=>Promise<void> } = { location: { href: 'https://example.test/courses/vosk/v1/vosk-worker.js' }, postMessage: (value: Output) => messages.push(value) }
  runInNewContext(readFileSync('public/courses/vosk/v1/vosk-worker.js', 'utf8'), {
    self: scope, Vosk: { Model }, BUILDING_VOSK_GRAMMAR: ['小迪 下一步', '[unk]'],
    importScripts() {}, URL, Float32Array, Number, JSON, Promise, setTimeout, clearTimeout, performance,
  })
  const port: MockPort = { close: vi.fn(), postMessage: (value: {type:string}) => replies.push(value) }
  const init = async () => { await scope.onmessage!({ data: { type: 'init' } }); await scope.onmessage!({ data: { type: 'connect', port } }) }
  const send = (type: string, extra: Partial<AudioRequest> = {}) => port.onmessage!({ data: { type, id: 1, epoch: 1, segment: 1, sampleRate: 16000, ...extra } })
  const disconnect = () => scope.onmessage!({ data: { type: 'disconnect' } })
  return { init, send, disconnect, port, messages, replies, recognizers, text: (value: string) => { nextText = value }, stall: () => { stalled = true }, resume: () => { stalled = false } }
}
afterEach(() => vi.useRealTimers())
describe('Vosk complete utterance adapter', () => {
  it('never dispatches partial segment commands or deletes unknown text, and frees the recognizer at the boundary', async () => {
    const f = fixture(); await f.init(); await f.send('begin')
    f.text('[unk]'); await f.send('chunk', { samples: new Float32Array(1600) })
    f.text('小迪 退出'); await f.send('chunk', { samples: new Float32Array(1600) })
    expect(f.messages.filter(m => m.type === 'result')).toEqual([])
    await f.send('end', { valid: true, speechStart: .3, speechEnd: 1.3, duration: 1.96 })
    expect(f.messages.find(m => m.type === 'result')?.observation?.text).toBe('[unk] 小迪 退出')
    expect(f.recognizers[1].remove).toHaveBeenCalledOnce()
    await f.send('begin', { segment: 2 })
    f.text('小迪 退出'); await f.send('chunk', { segment: 2, samples: new Float32Array(1600) })
    await f.send('end', { segment: 2, valid: true })
    expect(f.messages.filter(m => m.type === 'result')[1]?.observation?.text).toBe('小迪 退出')
  })
  it('invalidates overlong output instead of executing a truncated prefix', async () => {
    const f = fixture(); await f.init(); await f.send('begin')
    f.text('小迪 下一步'); await f.send('chunk', { samples: new Float32Array(1600) })
    f.text('其他话'.repeat(40)); await f.send('chunk', { samples: new Float32Array(1600) })
    await f.send('end', { valid: true })
    expect(f.messages.find(m => m.type === 'result')?.observation?.valid).toBe(false)
  })
  it('discarding a navigation epoch cannot execute the unfinished previous utterance', async () => {
    const f = fixture(); await f.init(); await f.send('begin')
    f.text('小迪 下一步'); await f.send('chunk', { samples: new Float32Array(1600) })
    await f.send('reset', { epoch: 2 })
    await f.send('end', { epoch: 1, valid: true })
    expect(f.messages.filter(m => m.type === 'result')).toEqual([])
    expect(f.recognizers[1].remove).toHaveBeenCalledOnce()
  })
  it('reports a stalled decoder, acknowledges and zeroes the PCM block', async () => {
    vi.useFakeTimers()
    const f = fixture(); await f.init(); await f.send('begin'); f.stall()
    const samples = new Float32Array(1600).fill(.1)
    const pending = f.send('chunk', { samples })
    await vi.advanceTimersByTimeAsync(2001); await pending
    expect(f.messages.some(m => m.type === 'error')).toBe(true)
    expect(samples.every(value => value === 0)).toBe(true)
    expect(f.replies.at(-1)).toMatchObject({ type: 'ack' })
  })
  it('releases a blocked capture before reusing the model, without leaking its words or error', async () => {
    const f = fixture(); await f.init(); await f.send('begin')
    f.text('[unk]'); await f.send('chunk', { samples: new Float32Array(1600) })
    f.stall()
    const samples = new Float32Array(1600).fill(.1)
    const blocked = f.send('chunk', { samples })
    await f.disconnect(); await blocked
    expect(f.port.close).toHaveBeenCalledOnce()
    expect(f.messages.at(-1)).toMatchObject({ type: 'detached' })
    expect(f.messages.some(m => m.type === 'error')).toBe(false)
    expect(samples.every(value => value === 0)).toBe(true)
    f.resume(); await f.init(); await f.send('begin')
    f.text('小迪 暂停'); await f.send('chunk', { samples: new Float32Array(1600) })
    await f.send('end', { valid: true })
    expect(f.messages.filter(m => m.type === 'result')).toHaveLength(1)
    expect(f.messages.at(-1)?.observation?.text).toBe('小迪 暂停')
  })
})
