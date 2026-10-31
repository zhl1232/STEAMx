import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createBookAudio } from "@/lib/textbook3d/native/book-audio"
import { BOOK_MUSIC_BAR_SECONDS, BOOK_MUSIC_LOOP_SECONDS } from "@/lib/textbook3d/native/book-music"

// Only the browser's audio device is mocked; scheduling, ownership and controls run.
function audioDevice() {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
  type MockNode = { type: string; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; setPeriodicWave: ReturnType<typeof vi.fn>; onended: (() => void) | null; gain: ReturnType<typeof param>; frequency: ReturnType<typeof param>; Q: ReturnType<typeof param> }
  const nodes: MockNode[] = []
  function node(): MockNode {
    const value = { type: "sine", connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), setPeriodicWave: vi.fn(), onended: null as (() => void) | null, gain: param(), frequency: param(), Q: param() }
    value.connect.mockReturnValue(value)
    nodes.push(value)
    return value
  }
  const context = {
    state: "suspended", currentTime: 0, sampleRate: 8000, destination: {},
    resume: vi.fn(async () => { context.state = "running" }),
    suspend: vi.fn(async () => { context.state = "suspended" }),
    close: vi.fn(async () => { context.state = "closed" }),
    createOscillator: vi.fn(node), createGain: vi.fn(node), createBufferSource: vi.fn(node), createBiquadFilter: vi.fn(node),
    createPeriodicWave: vi.fn(() => ({})),
    createBuffer: vi.fn((_channels: number, size: number) => ({ getChannelData: () => new Float32Array(size) })),
  }
  const advance = (seconds: number, deliverEnded = true) => {
    // Move the hardware clock with wall time, delivering the device's ended
    // events. Skipping them simulates a busy browser event loop.
    const end = context.currentTime + seconds
    while (context.currentTime < end) {
      const step = Math.min(0.025, end - context.currentTime)
      context.currentTime += step
      if (deliverEnded) for (const value of nodes) {
        const stop = value.stop.mock.calls[0]?.[0]
        if (stop !== undefined && stop <= context.currentTime) value.onended?.()
      }
      vi.advanceTimersByTime(step * 1000)
    }
  }
  const oscillators = () => context.createOscillator.mock.results.map(result => result.value as MockNode)
  return { context, nodes, advance, oscillators, factory: vi.fn(() => context as unknown as AudioContext) }
}

describe("book audio lifecycle", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it("stays completely silent until explicit enable and closes owned audio on disposal", async () => {
    const device = audioDevice(), change = vi.fn()
    const audio = createBookAudio(change, device.factory)
    audio.play("page"); vi.advanceTimersByTime(30_000)
    expect(device.factory).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    await audio.enable()
    expect(device.context.resume).toHaveBeenCalledOnce()
    expect(change).toHaveBeenLastCalledWith(true, false)
    expect(device.context.createOscillator.mock.calls.length).toBeGreaterThan(3)
    expect(device.context.createOscillator.mock.calls.length).toBeLessThanOrEqual(14)
    expect(device.context.createPeriodicWave).toHaveBeenCalledOnce()
    audio.dispose(); audio.dispose()
    expect(vi.getTimerCount()).toBe(0)
    expect(device.context.close).toHaveBeenCalledOnce()
    device.nodes.forEach(node => expect(node.disconnect).toHaveBeenCalledOnce())
  })

  it("schedules successive bars on the audio clock, with bounded live nodes across two loops", async () => {
    const device = audioDevice(), audio = createBookAudio(vi.fn(), device.factory)
    await audio.enable()
    const opening = device.oscillators().map(node => [node.frequency.value, node.start.mock.calls[0][0]])
    for (let bar = 0; bar < 65; bar++) {
      expect(vi.getTimerCount()).toBe(1)
      const owned = device.oscillators().filter(node => node.disconnect.mock.calls.length === 0)
      expect(owned.length).toBeLessThanOrEqual(24)
      for (const node of owned) expect(node.start.mock.calls[0][0] - device.context.currentTime).toBeLessThan(BOOK_MUSIC_BAR_SECONDS + 0.35)
      device.advance(BOOK_MUSIC_BAR_SECONDS)
    }
    const restarted = device.oscillators().filter(node => {
      const start = node.start.mock.calls[0][0]
      return start >= BOOK_MUSIC_LOOP_SECONDS && start < BOOK_MUSIC_LOOP_SECONDS + BOOK_MUSIC_BAR_SECONDS
    }).map(node => [node.frequency.value, node.start.mock.calls[0][0] - BOOK_MUSIC_LOOP_SECONDS])
    expect(restarted).toHaveLength(opening.length)
    restarted.forEach((note, i) => {
      expect(note[0]).toBe(opening[i][0])
      expect(note[1]).toBeCloseTo(opening[i][1], 8)
    })
    audio.dispose()
    device.nodes.forEach(node => expect(node.disconnect).toHaveBeenCalledOnce())
  })

  it("uses distinct timbres and envelopes that begin and end silently with quiet mix headroom", async () => {
    const device = audioDevice(), audio = createBookAudio(vi.fn(), device.factory)
    await audio.enable()
    const sources = device.oscillators()
    expect(sources.some(source => source.setPeriodicWave.mock.calls.length > 0)).toBe(true)
    expect(sources.some(source => source.type === "triangle")).toBe(true)
    expect(sources.some(source => source.type === "sine" && !source.setPeriodicWave.mock.calls.length)).toBe(true)
    const peaks: Array<{ start: number; end: number; gain: number }> = []
    sources.forEach((source, i) => {
      const gain = device.context.createGain.mock.results[i].value.gain
      const start = source.start.mock.calls[0][0], end = source.stop.mock.calls[0][0]
      expect(gain.setValueAtTime).toHaveBeenCalledWith(0, start)
      expect(gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, end)
      expect(gain.linearRampToValueAtTime.mock.calls[0][1] - start).toBeGreaterThanOrEqual(0.01)
      const automation = [gain.setValueAtTime, gain.linearRampToValueAtTime, gain.exponentialRampToValueAtTime]
        .flatMap(method => method.mock.calls.map((call: number[], index: number) => ({ time: call[1], order: method.mock.invocationCallOrder[index] })))
        .sort((a, b) => a.order - b.order)
      automation.forEach((event, index) => {
        expect(event.time).toBeGreaterThanOrEqual(index === 0 ? start : automation[index - 1].time)
        expect(event.time).toBeLessThanOrEqual(end)
      })
      peaks.push({ start, end, gain: gain.linearRampToValueAtTime.mock.calls[0][0] })
    })
    for (const { start } of peaks) {
      const upperBound = peaks.filter(voice => voice.start <= start && voice.end > start).reduce((sum, voice) => sum + voice.gain, 0)
      expect(upperBound).toBeLessThan(0.08)
    }
    audio.dispose()
  })

  it("skips missed bars after a stalled event loop without a catch-up burst or leaked voices", async () => {
    const device = audioDevice(), audio = createBookAudio(vi.fn(), device.factory)
    await audio.enable()
    const initial = device.oscillators().length
    device.context.currentTime = 40
    vi.advanceTimersByTime(3000)
    // Ended events have not been delivered; the scheduler still releases them.
    expect(device.oscillators().slice(0, initial).every(node => node.disconnect.mock.calls.length === 1)).toBe(true)
    device.advance(4, false)
    const recent = device.oscillators().slice(initial)
    expect(recent.length).toBeGreaterThan(0)
    expect(recent.length).toBeLessThanOrEqual(28)
    expect(recent.every(node => node.start.mock.calls[0][0] >= 40)).toBe(true)
    expect(device.oscillators().filter(node => !node.disconnect.mock.calls.length).length).toBeLessThanOrEqual(24)
    audio.dispose()
  })

  it("immediately releases both sounding and future notes on mute, and restarts from the opening", async () => {
    const device = audioDevice(), change = vi.fn(), audio = createBookAudio(change, device.factory)
    await audio.enable()
    device.advance(0.5)
    const owned = device.oscillators().filter(node => !node.disconnect.mock.calls.length)
    expect(owned.some(node => node.start.mock.calls[0][0] > device.context.currentTime)).toBe(true)
    audio.stop()
    owned.forEach(node => {
      expect(node.stop).toHaveBeenLastCalledWith()
      expect(node.disconnect).toHaveBeenCalledOnce()
      expect(node.onended).toBeNull()
    })
    expect(change).toHaveBeenLastCalledWith(false, false)
    expect(vi.getTimerCount()).toBe(0)
    const count = device.oscillators().length
    await audio.enable()
    expect(device.oscillators()[count].frequency.value).toBe(device.oscillators()[0].frequency.value)
    expect(device.context.createPeriodicWave).toHaveBeenCalledOnce()
    audio.dispose()
  })

  it("limits repeated effects and replaces a preceding effect instead of accumulating voices", async () => {
    const device = audioDevice(), audio = createBookAudio(vi.fn(), device.factory)
    await audio.enable()
    audio.play("page"); audio.play("leaves"); audio.play("page")
    expect(device.context.createBufferSource).toHaveBeenCalledOnce()
    const first = device.context.createBufferSource.mock.results[0].value
    device.context.currentTime = 0.2
    audio.play("leaves")
    expect(device.context.createBufferSource).toHaveBeenCalledTimes(2)
    expect(first.disconnect).toHaveBeenCalledOnce()
    audio.stop()
    expect(vi.getTimerCount()).toBe(0)
    const count = device.nodes.length
    audio.play("page"); vi.advanceTimersByTime(30_000)
    expect(device.nodes).toHaveLength(count)
    audio.dispose()
  })

  it("stops on backgrounding and requires another explicit enable after returning", async () => {
    const device = audioDevice(), audio = createBookAudio(vi.fn(), device.factory)
    await audio.enable()
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    document.dispatchEvent(new Event("visibilitychange"))
    expect(device.context.suspend).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event("visibilitychange"))
    expect(device.context.resume).toHaveBeenCalledOnce()
    await audio.enable()
    expect(device.context.resume).toHaveBeenCalledTimes(2)
    audio.dispose()
  })

  it("does not let two mounted readers play at once", async () => {
    const a = audioDevice(), b = audioDevice()
    const first = createBookAudio(vi.fn(), a.factory), second = createBookAudio(vi.fn(), b.factory)
    await first.enable(); await second.enable()
    expect(a.context.suspend).toHaveBeenCalledOnce()
    expect(b.context.state).toBe("running")
    first.play("leaves")
    expect(a.context.createBufferSource).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)
    first.dispose(); second.dispose()
  })

  it("ignores duplicate activation and cannot revive audio after a pending resume was muted", async () => {
    const device = audioDevice(), change = vi.fn()
    let complete!: () => void
    device.context.resume.mockImplementation(() => new Promise<void>(resolve => { complete = () => { device.context.state = "running"; resolve() } }))
    const audio = createBookAudio(change, device.factory)
    const pending = audio.enable()
    await audio.enable()
    expect(device.context.resume).toHaveBeenCalledOnce()
    audio.stop(); complete(); await pending
    expect(device.context.state).toBe("suspended")
    expect(device.context.createOscillator).not.toHaveBeenCalled()
    expect(change).not.toHaveBeenCalledWith(true, false)
    audio.dispose()
  })

  it("handles device rejection without leaving a timer or an enabled indicator", async () => {
    const device = audioDevice(), change = vi.fn()
    device.context.resume.mockRejectedValue(new Error("audio unavailable"))
    const audio = createBookAudio(change, device.factory)
    await audio.enable()
    expect(change).toHaveBeenLastCalledWith(false, true)
    expect(vi.getTimerCount()).toBe(0)
    audio.dispose()
  })

  it("keeps a pending reader silent if another reader takes ownership", async () => {
    const a = audioDevice(), b = audioDevice()
    let complete!: () => void
    a.context.resume.mockImplementation(() => new Promise<void>(resolve => { complete = () => { a.context.state = "running"; resolve() } }))
    const first = createBookAudio(vi.fn(), a.factory), second = createBookAudio(vi.fn(), b.factory)
    const pending = first.enable()
    await second.enable()
    complete(); await pending
    expect(a.context.state).toBe("suspended")
    expect(a.oscillators()).toHaveLength(0)
    expect(b.oscillators().length).toBeGreaterThan(0)
    expect(vi.getTimerCount()).toBe(1)
    first.dispose(); second.dispose()
  })

  it("ignores an obsolete resume when the same controller has a newer explicit activation", async () => {
    const device = audioDevice(), change = vi.fn(), complete: Array<() => void> = []
    device.context.resume.mockImplementation(() => new Promise<void>(resolve => { complete.push(() => { device.context.state = "running"; resolve() }) }))
    const audio = createBookAudio(change, device.factory)
    const old = audio.enable()
    audio.stop()
    const current = audio.enable()
    complete[1](); await current
    const count = device.oscillators().length
    complete[0](); await old
    expect(device.context.state).toBe("running")
    expect(device.oscillators()).toHaveLength(count)
    expect(vi.getTimerCount()).toBe(1)
    audio.dispose()
  })

  it("does not schedule audio if visibility changes before the pending resume completes", async () => {
    const device = audioDevice(), change = vi.fn()
    let complete!: () => void
    device.context.resume.mockImplementation(() => new Promise<void>(resolve => { complete = () => { device.context.state = "running"; resolve() } }))
    const audio = createBookAudio(change, device.factory)
    const pending = audio.enable()
    vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    complete(); await pending
    expect(device.context.state).toBe("suspended")
    expect(device.oscillators()).toHaveLength(0)
    expect(change).not.toHaveBeenCalledWith(true, false)
    expect(vi.getTimerCount()).toBe(0)
    audio.dispose()
  })

  it("cannot recreate music after disposal during resume", async () => {
    const device = audioDevice(), change = vi.fn()
    let complete!: () => void
    device.context.resume.mockImplementation(() => new Promise<void>(resolve => { complete = resolve }))
    const audio = createBookAudio(change, device.factory)
    const pending = audio.enable()
    audio.dispose(); complete(); await pending
    await audio.enable()
    expect(device.context.state).toBe("closed")
    expect(device.oscillators()).toHaveLength(0)
    expect(change).not.toHaveBeenCalledWith(true, false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
