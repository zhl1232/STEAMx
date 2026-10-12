import { describe, expect, it, vi } from 'vitest'
import {
  createBuildingVoiceCapture,
  createBuildingVoiceSegmenter,
  type BuildingVoiceAudioEnvironment,
} from './building-voice-capture'

function tone(ms: number, amplitude = 0.1, sampleRate = 16_000) {
  return Float32Array.from({ length: Math.round(ms * sampleRate / 1_000) }, (_, index) =>
    amplitude * Math.sin(2 * Math.PI * 400 * index / sampleRate))
}

function feed(segmenter: ReturnType<typeof createBuildingVoiceSegmenter>, samples: Float32Array, chunkSize = 2_048) {
  for (let index = 0; index < samples.length; index += chunkSize) segmenter.push(samples.subarray(index, index + chunkSize))
}

function segmenterFixture(sampleRate = 16_000) {
  const onSegment = vi.fn()
  const segmenter = createBuildingVoiceSegmenter({ sampleRate, onSegment })
  segmenter.setListening(true)
  return { segmenter, onSegment }
}

describe('building voice local segmentation', () => {
  it('never emits quiet background or a short transient as a paid recognition request', () => {
    const { segmenter, onSegment } = segmenterFixture()
    feed(segmenter, tone(30_000, 0.003))
    feed(segmenter, tone(80))
    feed(segmenter, tone(2_000, 0))
    expect(onSegment).not.toHaveBeenCalled()
    feed(segmenter, tone(400))
    feed(segmenter, tone(660, 0))
    expect(onSegment).toHaveBeenCalledOnce()
  })

  it('keeps the quiet beginning before the amplitude gate so the wake name is not clipped', () => {
    const { segmenter, onSegment } = segmenterFixture()
    const beginning = tone(300, 0.006)
    feed(segmenter, beginning, 153)
    feed(segmenter, tone(400), 997)
    feed(segmenter, tone(640, 0), 333)
    expect(onSegment).not.toHaveBeenCalled()
    feed(segmenter, tone(20, 0))
    expect(onSegment).toHaveBeenCalledOnce()
    const captured: Float32Array = onSegment.mock.calls[0][0]
    expect(captured.length).toBe(16_000 * 1.36)
    expect(captured.slice(0, beginning.length)).toEqual(beginning)
  })

  it('keeps a natural short pause within the same utterance', () => {
    const { segmenter, onSegment } = segmenterFixture()
    feed(segmenter, tone(240))
    feed(segmenter, tone(400, 0))
    feed(segmenter, tone(240))
    expect(onSegment).not.toHaveBeenCalled()
    feed(segmenter, tone(660, 0))
    expect(onSegment).toHaveBeenCalledOnce()
    expect(onSegment.mock.calls[0][0].length).toBe(16_000 * 1.54)
  })

  it('bounds continuous speech at eight seconds and applies backpressure before another audio frame', () => {
    const { segmenter, onSegment } = segmenterFixture(48_000)
    feed(segmenter, tone(300, 0, 48_000))
    // One callback contains more than one potential segment: only the first is emitted.
    segmenter.push(tone(18_000, 0.1, 48_000))
    expect(onSegment).toHaveBeenCalledOnce()
    expect(onSegment.mock.calls[0][0].length).toBe(48_000 * 8)
    feed(segmenter, tone(2_000, 0.1, 48_000))
    expect(onSegment).toHaveBeenCalledOnce()
    segmenter.setListening(true)
    feed(segmenter, tone(400, 0.1, 48_000))
    feed(segmenter, tone(660, 0, 48_000))
    expect(onSegment).toHaveBeenCalledOnce()
    feed(segmenter, tone(400, 0.1, 48_000))
    feed(segmenter, tone(660, 0, 48_000))
    expect(onSegment).toHaveBeenCalledTimes(2)
  })

  it('does not turn persistent noise into repeated uploads after recognition resumes', () => {
    const { segmenter, onSegment } = segmenterFixture()
    feed(segmenter, tone(12_000))
    expect(onSegment).toHaveBeenCalledOnce()
    segmenter.setListening(true)
    for (let index = 0; index < 4; index += 1) feed(segmenter, tone(10_000))
    feed(segmenter, tone(400, 0))
    feed(segmenter, tone(1_000))
    expect(onSegment).toHaveBeenCalledOnce()
    feed(segmenter, tone(660, 0))
    feed(segmenter, tone(400))
    feed(segmenter, tone(660, 0))
    expect(onSegment).toHaveBeenCalledTimes(2)
  })

  it('throws away an unfinished utterance and pre-roll when navigation resets it', () => {
    const { segmenter, onSegment } = segmenterFixture()
    feed(segmenter, tone(500))
    segmenter.reset()
    feed(segmenter, tone(1_000, 0))
    expect(onSegment).not.toHaveBeenCalled()
    segmenter.setListening(false)
    feed(segmenter, tone(1_000))
    segmenter.setListening(true)
    feed(segmenter, tone(1_000, 0))
    expect(onSegment).not.toHaveBeenCalled()
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function audioFixture(sampleRate = 48_000) {
  const track = Object.assign(new EventTarget(), { stop: vi.fn() })
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  const source = { connect: vi.fn(), disconnect: vi.fn() }
  const processor = { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null }
  const gain = {
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(),
  }
  const oscillator = {
    frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null,
  }
  const context = Object.assign(new EventTarget(), {
    sampleRate,
    state: 'suspended',
    currentTime: 1,
    destination: {},
    resume: vi.fn(async () => { context.state = 'running' }),
    close: vi.fn(async () => { context.state = 'closed' }),
    createMediaStreamSource: vi.fn(() => source),
    createScriptProcessor: vi.fn(() => processor),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
  })
  const getUserMedia = vi.fn().mockResolvedValue(stream)
  const environment: BuildingVoiceAudioEnvironment = {
    getUserMedia,
    createAudioContext: vi.fn(() => context as unknown as AudioContext),
  }
  const controller = new AbortController()
  const onSegment = vi.fn()
  const onError = vi.fn()
  function process(samples: Float32Array) {
    const output = new Float32Array(samples.length).fill(1)
    processor.onaudioprocess?.({
      inputBuffer: { getChannelData: () => samples },
      outputBuffer: { numberOfChannels: 1, getChannelData: () => output },
    } as unknown as AudioProcessingEvent)
    return output
  }
  return { track, stream, source, processor, context, environment, getUserMedia, controller, onSegment, onError, process, oscillator, gain }
}

describe('building microphone lifecycle', () => {
  it('reuses a single mic/context across segments and outputs muted 16kHz mono PCM16', async () => {
    const test = audioFixture()
    const capture = await createBuildingVoiceCapture({ signal: test.controller.signal, onSegment: test.onSegment, onError: test.onError }, test.environment)
    capture.setListening(true)
    const output = test.process(tone(400, 0.1, 48_000))
    expect(output.every((sample) => sample === 0)).toBe(true)
    test.process(tone(660, 0, 48_000))
    expect(test.onSegment).toHaveBeenCalledOnce()
    const recording = test.onSegment.mock.calls[0][0]
    expect(recording.durationMs).toBe(1_060)
    expect(recording.blob.type).toBe('audio/pcm')
    expect(recording.blob.size).toBe(16_960 * 2)
    const pcm = new Int16Array(await recording.blob.arrayBuffer())
    expect(Math.max(...pcm)).toBeGreaterThan(3_000)
    capture.playCue()
    expect(test.oscillator.start).toHaveBeenCalledOnce()
    expect(test.oscillator.stop).toHaveBeenCalledWith(1.12)
    test.process(tone(1_000, 0.1, 48_000))
    test.process(tone(660, 0, 48_000))
    expect(test.onSegment).toHaveBeenCalledOnce()
    capture.setListening(true)
    test.process(tone(400, 0.1, 48_000))
    test.process(tone(660, 0, 48_000))
    expect(test.onSegment).toHaveBeenCalledTimes(2)
    expect(test.getUserMedia).toHaveBeenCalledOnce()
    expect(test.environment.createAudioContext).toHaveBeenCalledOnce()
    await capture.close()
    await capture.close()
    expect(test.track.stop).toHaveBeenCalledOnce()
    expect(test.context.close).toHaveBeenCalledOnce()
    expect(test.processor.onaudioprocess).toBeNull()
  })

  it('stops the context immediately on abort and releases a late permission result', async () => {
    const test = audioFixture()
    const permission = deferred<MediaStream>()
    test.getUserMedia.mockReturnValue(permission.promise)
    const pending = createBuildingVoiceCapture({ signal: test.controller.signal, onSegment: test.onSegment, onError: test.onError }, test.environment)
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    test.controller.abort()
    expect(test.context.close).toHaveBeenCalledOnce()
    permission.resolve(test.stream)
    await rejected
    expect(test.track.stop).toHaveBeenCalledOnce()
    expect(test.onSegment).not.toHaveBeenCalled()
    expect(test.onError).not.toHaveBeenCalled()
  })

  it('releases an acquired microphone and context if browser audio setup fails', async () => {
    const test = audioFixture()
    test.context.createScriptProcessor.mockImplementation(() => { throw new Error('unsupported processor') })
    await expect(createBuildingVoiceCapture({ signal: test.controller.signal, onSegment: test.onSegment, onError: test.onError }, test.environment)).rejects.toThrow('unsupported processor')
    expect(test.track.stop).toHaveBeenCalledOnce()
    expect(test.context.close).toHaveBeenCalledOnce()
    expect(test.source.disconnect).toHaveBeenCalledOnce()
  })

  it.each(['track', 'context'])('fails closed when the %s is interrupted, and never restarts itself', async (target) => {
    const test = audioFixture()
    const capture = await createBuildingVoiceCapture({ signal: test.controller.signal, onSegment: test.onSegment, onError: test.onError }, test.environment)
    capture.setListening(true)
    if (target === 'track') test.track.dispatchEvent(new Event('ended'))
    else {
      test.context.state = 'suspended'
      test.context.dispatchEvent(new Event('statechange'))
    }
    expect(test.onError).toHaveBeenCalledOnce()
    expect(test.track.stop).toHaveBeenCalledOnce()
    expect(test.context.close).toHaveBeenCalledOnce()
    capture.setListening(true)
    test.process(tone(2_000, 0.1, 48_000))
    expect(test.onSegment).not.toHaveBeenCalled()
    await capture.close()
    expect(test.onError).toHaveBeenCalledOnce()
  })

  it('does not even acquire audio for a previously cancelled session', async () => {
    const test = audioFixture()
    test.controller.abort()
    await expect(createBuildingVoiceCapture({ signal: test.controller.signal, onSegment: test.onSegment, onError: test.onError }, test.environment)).rejects.toMatchObject({ name: 'AbortError' })
    expect(test.environment.createAudioContext).not.toHaveBeenCalled()
    expect(test.getUserMedia).not.toHaveBeenCalled()
  })
})
