import { describe, expect, it, vi } from "vitest"
import { createDemandRenderer } from "./demand-renderer"

function setup() {
  let id = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  const draw = vi.fn()
  const clock = {
    request: vi.fn((callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id }),
    cancel: vi.fn((key: number) => { callbacks.delete(key) }),
  }
  const scheduler = createDemandRenderer(draw, clock)
  const flush = () => { const work = [...callbacks.values()]; callbacks.clear(); work.forEach((callback) => callback(0)) }
  return { scheduler, draw, clock, callbacks, flush }
}

describe("on-demand rendering", () => {
  it("coalesces interaction bursts and schedules no idle frames", () => {
    const { scheduler, draw, callbacks, flush } = setup()
    for (let i = 0; i < 20; i++) scheduler.invalidate()
    expect(callbacks.size).toBe(1)
    flush()
    expect(draw).toHaveBeenCalledOnce()
    expect(callbacks.size).toBe(0)
    scheduler.dispose()
  })
  it("pauses hidden work and draws the latest state once on return", () => {
    const { scheduler, draw, callbacks, flush } = setup()
    scheduler.invalidate()
    scheduler.setVisible(false)
    scheduler.invalidate()
    expect(callbacks.size).toBe(0)
    flush()
    expect(draw).not.toHaveBeenCalled()
    scheduler.setVisible(true)
    flush()
    expect(draw).toHaveBeenCalledOnce()
    expect(callbacks.size).toBe(0)
  })
  it("cancels queued work and ignores stale callbacks after disposal", () => {
    const { scheduler, draw, callbacks } = setup()
    scheduler.invalidate()
    const stale = [...callbacks.values()][0]
    scheduler.dispose()
    stale(0)
    scheduler.invalidate()
    scheduler.setVisible(true)
    expect(draw).not.toHaveBeenCalled()
    expect(callbacks.size).toBe(0)
  })
})
