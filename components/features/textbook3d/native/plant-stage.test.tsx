import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Scene } from "three"
import { createPlantStage } from "@/lib/textbook3d/native/plant-stage"

const boundary = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn(), loseContext: vi.fn() }))
vi.mock("three", async (importOriginal) => {
  const original = await importOriginal<typeof import("three")>()
  return { ...original, WebGLRenderer: class {
    domElement = document.createElement("canvas")
    shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false }
    info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } }
    ratio = 1
    setPixelRatio(value: number) { this.ratio = value }
    getPixelRatio() { return this.ratio }
    setSize(width: number, height: number) { this.domElement.width = width * this.ratio; this.domElement.height = height * this.ratio }
    render = boundary.render
    dispose = boundary.dispose
    forceContextLoss = boundary.loseContext
  } }
})

describe("plant renderer lifecycle (WebGL boundary mocked)", () => {
  let callbacks: Map<number, FrameRequestCallback>
  let host: HTMLDivElement
  let id: number
  const flush = () => { const work = [...callbacks.values()]; callbacks.clear(); work.forEach((callback) => callback(0)) }
  beforeEach(() => {
    vi.clearAllMocks()
    callbacks = new Map()
    id = 0
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id })
    vi.stubGlobal("cancelAnimationFrame", (key: number) => callbacks.delete(key))
    vi.stubGlobal("ResizeObserver", class { constructor(private callback: () => void) {} observe() { this.callback() } disconnect() {} })
    host = document.createElement("div")
    document.body.appendChild(host)
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 390, 300))
  })
  afterEach(() => { host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it("keeps one canvas and the same scene through repeated plant/page state changes", () => {
    const ready = vi.fn()
    const stage = createPlantStage(host, { plant: "tree", startedAt: performance.now(), onReady: ready, onError: vi.fn() })
    flush()
    const scene = boundary.render.mock.calls[0][0] as Scene
    const ownedGroups = scene.children.filter((child) => child.type === "Group")
    expect(ownedGroups).toHaveLength(3)
    for (let i = 0; i < 20; i++) {
      for (const plant of ["grass", "flower", "tree"] as const) { stage.setPlant(plant); flush() }
      expect(host.querySelectorAll("canvas")).toHaveLength(1)
      expect(ownedGroups.filter((group) => group.visible)).toHaveLength(1)
    }
    expect(boundary.render.mock.calls.every(([current]) => current === scene)).toBe(true)
    expect(ready).toHaveBeenCalledOnce()
    expect(callbacks.size).toBe(0)
    stage.dispose()
    stage.dispose()
    expect(host.querySelector("canvas")).toBeNull()
    expect(boundary.dispose).toHaveBeenCalledOnce()
    expect(boundary.loseContext).toHaveBeenCalledOnce()
    expect(ownedGroups.every((group) => group.parent === null)).toBe(true)
  })

  it("stops frames while hidden, resumes dirty work, and removes handlers on disposal", () => {
    const stage = createPlantStage(host, { plant: "tree", startedAt: performance.now(), onReady: vi.fn(), onError: vi.fn() })
    flush()
    boundary.render.mockClear()
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    document.dispatchEvent(new Event("visibilitychange"))
    stage.setPlant("grass")
    expect(callbacks.size).toBe(0)
    expect(boundary.render).not.toHaveBeenCalled()
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event("visibilitychange"))
    flush()
    expect(boundary.render).toHaveBeenCalledOnce()
    const canvas = host.querySelector("canvas")!
    stage.dispose()
    canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }))
    document.dispatchEvent(new Event("visibilitychange"))
    expect(callbacks.size).toBe(0)
  })

  it("reports a lost WebGL context and cancels pending rendering", () => {
    const error = vi.fn()
    const stage = createPlantStage(host, { plant: "tree", startedAt: performance.now(), onReady: vi.fn(), onError: error })
    host.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }))
    flush()
    expect(error).toHaveBeenCalledOnce()
    expect(boundary.render).not.toHaveBeenCalled()
    expect(callbacks.size).toBe(0)
    stage.dispose()
  })
})
