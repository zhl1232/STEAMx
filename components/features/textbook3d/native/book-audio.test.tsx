import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createBookAudio } from "@/lib/textbook3d/native/book-audio"

// Only the browser's audio device is mocked; scheduling, ownership and controls run.
function audioDevice() {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
  type MockNode = { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (() => void) | null; gain: ReturnType<typeof param>; frequency: ReturnType<typeof param>; Q: ReturnType<typeof param> }
  const nodes: MockNode[] = []
  function node(): MockNode {
    const value = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null, gain: param(), frequency: param(), Q: param() }
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
    createBuffer: vi.fn((_channels: number, size: number) => ({ getChannelData: () => new Float32Array(size) })),
  }
  return { context, nodes, factory: vi.fn(() => context as unknown as AudioContext) }
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
    expect(device.context.createOscillator).toHaveBeenCalledTimes(3)
    audio.dispose(); audio.dispose()
    expect(vi.getTimerCount()).toBe(0)
    expect(device.context.close).toHaveBeenCalledOnce()
    device.nodes.forEach(node => expect(node.disconnect).toHaveBeenCalledOnce())
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
})
