import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PerspectiveCamera, Vector3, type Scene } from "three"
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
  let time: number
  let resize: () => void
  let rect: DOMRect
  let motionPreference: MediaQueryList
  const flush = () => { const work = [...callbacks.values()]; callbacks.clear(); work.forEach((callback) => callback(0)) }
  beforeEach(() => {
    vi.clearAllMocks()
    callbacks = new Map()
    id = 0
    time = 0
    vi.spyOn(performance, "now").mockImplementation(() => time)
    motionPreference = Object.assign(new EventTarget(), { matches: false, media: "(prefers-reduced-motion: reduce)" }) as MediaQueryList
    vi.spyOn(window, "matchMedia").mockReturnValue(motionPreference)
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id })
    vi.stubGlobal("cancelAnimationFrame", (key: number) => callbacks.delete(key))
    vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { resize = callback } observe() { resize() } disconnect() {} })
    host = document.createElement("div")
    document.body.appendChild(host)
    rect = new DOMRect(0, 0, 390, 300)
    vi.spyOn(host, "getBoundingClientRect").mockImplementation(() => rect)
  })
  afterEach(() => { host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it("keeps one canvas and the same scene through repeated plant/page state changes", () => {
    const ready = vi.fn()
    const stage = createPlantStage(host, { plant: "tree", startedAt: performance.now(), onReady: ready, onError: vi.fn() })
    flush()
    const scene = boundary.render.mock.calls[0][0] as Scene
    const ownedGroups = scene.children.filter((child) => child.type === "Group")
    expect(ownedGroups).toHaveLength(1)
    expect(scene.getObjectByName("spine")).toBeDefined()
    for (let i = 0; i < 20; i++) {
      for (const plant of ["grass", "flower", "tree"] as const) { stage.setPlant(plant); flush() }
      expect(host.querySelectorAll("canvas")).toHaveLength(1)
      expect(["tree", "grass", "flower"].every((id) => scene.getObjectByName(`plant-${id}`)?.parent?.visible)).toBe(true)
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

  it("finishes one page turn, ignores competing turns, and returns to zero idle RAFs", () => {
    const busy = vi.fn()
    const stage = createPlantStage(host, { plant: "tree", page: 0, startedAt: 0, onReady: vi.fn(), onError: vi.fn(), onTurningChange: busy })
    flush()
    busy.mockClear()
    stage.setPage(1)
    stage.setPage(0)
    expect(stage.diagnostics()).toMatchObject({ page: 1, turning: true })
    for (time = 0; time <= 850; time += 50) flush()
    expect(stage.diagnostics()).toMatchObject({ page: 1, turning: false, pendingFrame: false })
    expect(callbacks.size).toBe(0)
    expect(busy.mock.calls).toEqual([[true], [false]])
    expect(host.querySelectorAll("canvas")).toHaveLength(1)
    stage.dispose()
  })

  it("restores the view during a turn without a later animation frame bouncing it back", () => {
    const busy = vi.fn()
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: vi.fn(), onTurningChange: busy })
    flush()
    const camera = boundary.render.mock.calls.at(-1)![1] as PerspectiveCamera
    const defaultView = camera.position.clone()
    stage.setPage(1)
    time = 400
    flush()
    expect(camera.position.distanceTo(defaultView)).toBeGreaterThan(1)
    stage.resetView()
    const restored = camera.position.clone()
    expect(restored.distanceTo(defaultView)).toBeLessThan(0.000001)
    expect(stage.diagnostics()).toMatchObject({ page: 1, turning: false })
    expect(busy).toHaveBeenLastCalledWith(false)
    time = 600
    flush()
    expect(camera.position.equals(restored)).toBe(true)
    expect(stage.diagnostics().pendingFrame).toBe(false)
    expect(callbacks.size).toBe(0)
    stage.dispose()
  })

  it("settles a turn on resize or hidden state and never leaves the controls busy", () => {
    const busy = vi.fn()
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: vi.fn(), onTurningChange: busy })
    flush()
    for (const [width, height] of [[844, 250], [390, 300], [844, 250]]) {
      stage.setPage(stage.diagnostics().page === 0 ? 1 : 0)
      time += 220
      flush()
      rect = new DOMRect(0, 0, width, height)
      resize()
      flush()
      expect(stage.diagnostics()).toMatchObject({ turning: false, pendingFrame: false })
      expect(busy).toHaveBeenLastCalledWith(false)
    }
    stage.setPage(0)
    stage.setVisible(false)
    expect(stage.diagnostics()).toMatchObject({ turning: false, pendingFrame: false, page: 0 })
    expect(callbacks.size).toBe(0)
    stage.setVisible(true)
    flush()
    expect(callbacks.size).toBe(0)
    stage.dispose()
  })

  it("honors reduced motion, including a preference change during an active turn", () => {
    const busy = vi.fn()
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: vi.fn(), onTurningChange: busy })
    flush()
    stage.setPage(1)
    Object.defineProperty(motionPreference, "matches", { configurable: true, value: true })
    motionPreference.dispatchEvent(new Event("change"))
    flush()
    expect(stage.diagnostics()).toMatchObject({ page: 1, turning: false, pendingFrame: false })
    busy.mockClear()
    stage.setPage(0)
    flush()
    expect(busy).not.toHaveBeenCalledWith(true)
    expect(stage.diagnostics()).toMatchObject({ page: 0, turning: false, pendingFrame: false })
    stage.dispose()
  })

  it("cancels the animation and pending callbacks on disposal and context loss", () => {
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: vi.fn() })
    flush()
    stage.setPage(1)
    const queued = [...callbacks.values()]
    stage.dispose()
    boundary.render.mockClear()
    queued.forEach((callback) => callback(500))
    expect(boundary.render).not.toHaveBeenCalled()
    expect(callbacks.size).toBe(0)
    const error = vi.fn()
    const other = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: error })
    other.setPage(1)
    host.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }))
    expect(other.diagnostics().turning).toBe(false)
    expect(callbacks.size).toBe(0)
    expect(error).toHaveBeenCalledOnce()
    other.dispose()
  })

  it("selects the physical plant on a tap, and distinguishes a drag", () => {
    const select = vi.fn()
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: vi.fn(), onSelect: select })
    flush()
    const [scene, camera] = boundary.render.mock.calls.at(-1) as [Scene, PerspectiveCamera]
    scene.updateMatrixWorld(true)
    const grass = scene.getObjectByName("plant-grass")!
    const point = grass.localToWorld(new Vector3(0, 0.4, 0)).project(camera)
    const x = (point.x + 1) * 390 / 2, y = (1 - point.y) * 300 / 2
    const canvas = host.querySelector("canvas")!
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect)
    canvas.setPointerCapture = vi.fn()
    canvas.releasePointerCapture = vi.fn()
    const pointer = (type: string, offset = 0) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, isPrimary: true, clientX: x + offset, clientY: y }))
    pointer("pointerdown"); pointer("pointerup")
    expect(select).toHaveBeenCalledWith("grass")
    select.mockClear()
    pointer("pointerdown"); pointer("pointerup", 12)
    expect(select).not.toHaveBeenCalled()
    stage.dispose()
  })

})
