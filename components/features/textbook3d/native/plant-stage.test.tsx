import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PerspectiveCamera, Vector3, type Scene, type Object3D } from "three"
import { useLayoutEffect, useRef } from "react"
import { act, render, waitFor } from "@testing-library/react"
import { createPlantStage } from "@/lib/textbook3d/native/plant-stage"
import { PlantCanvas } from "./plant-canvas"

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
    boundary.render.mockReset()
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

  it("keeps one readable DOM page aligned, settles its hidden state on rotation, and restores fallback", () => {
    const spread = document.createElement("div")
    spread.dataset.bookSpread = ""
    host.replaceWith(spread)
    spread.appendChild(host)
    const reading = document.createElement("section")
    reading.dataset.bookReading = ""
    reading.innerHTML = '<button>课文中的问题</button>'
    const controls = document.createElement("div")
    controls.dataset.bookControls = ""
    spread.append(reading, controls)
    rect = new DOMRect(0, 0, 1200, 760)
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: vi.fn() })
    flush()
    expect(spread.dataset.bookLayout).toBe("spread")
    expect(reading.style.transform).toContain("matrix3d(")
    expect(controls.style.transform).toContain("matrix3d(")
    stage.setPage(1); time = 400; flush()
    expect(reading.style.opacity).toBe("0")
    expect(reading.inert).toBe(true)
    rect = new DOMRect(0, 0, 390, 680); resize()
    expect(reading.style.visibility).toBe("hidden")
    expect(controls.style.visibility).toBe("hidden")
    flush()
    expect(reading.style.visibility).toBe("")
    expect(controls.style.visibility).toBe("")
    expect(spread.dataset.bookLayout).toBe("portrait")
    expect(reading.style.transform).toContain("matrix3d(")
    expect(reading.style.opacity).toBe("1")
    expect(reading.inert).toBe(false)
    expect(controls.style.transform).toContain("matrix3d(")
    rect = new DOMRect(0, 0, 1200, 760); resize(); flush()
    host.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }))
    expect(spread.dataset.bookLayout).toBe("compact")
    expect(reading.style.transform).toBe("")
    stage.dispose()
    expect(spread.dataset.bookLayout).toBeUndefined()
    expect(callbacks.size).toBe(0)
    spread.remove()
  })

  it("projects print and all four button corners with the camera used in that same render", () => {
    host.dataset.bookSpread = ""
    const reading = document.createElement("section"), buttons = document.createElement("div")
    reading.dataset.bookReading = ""; buttons.dataset.bookControls = ""
    host.append(reading, buttons)
    rect = new DOMRect(0, 0, 1200, 760)
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: vi.fn() })
    const verify = (surface: HTMLElement, paper: Object3D, camera: PerspectiveCamera, width: number, height: number, corners: number[][]) => {
      const m = surface.style.transform.slice(9, -1).split(",").map(Number)
      for (const [i, [x, y]] of [[0, 0], [width, 0], [width, height], [0, height]].entries()) {
        const w = m[3] * x + m[7] * y + 1
        const expected = new Vector3().fromArray(corners[i]).applyMatrix4(paper.matrixWorld).project(camera)
        expect((m[0] * x + m[4] * y + m[12]) / w).toBeCloseTo((expected.x + 1) * rect.width / 2, 5)
        expect((m[1] * x + m[5] * y + m[13]) / w).toBeCloseTo((1 - expected.y) * rect.height / 2, 5)
      }
    }
    boundary.render.mockImplementation((scene: Scene, camera: PerspectiveCamera) => {
      // A real WebGLRenderer updates this before drawing. The DOM must already agree.
      camera.updateMatrixWorld(true)
      const paper = scene.getObjectByName("botanical-pop-up-book")!
      verify(reading, paper, camera, 320, 430, [[-3.48,.145,-2.02],[-.26,.145,-2.02],[-.26,.145,2.02],[-3.48,.145,2.02]])
      verify(buttons, paper, camera, 320, 52, [[.45,.148,1.5],[3.22,.148,1.5],[3.22,.148,2.18],[.45,.148,2.18]])
    })
    flush()
    const canvas = host.querySelector("canvas")!
    for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "+", "-"]) {
      canvas.dispatchEvent(new KeyboardEvent("keydown", { key }))
      flush()
      expect(stage.diagnostics().pendingFrame).toBe(false)
    }
    expect(boundary.render).toHaveBeenCalledTimes(6)
    stage.dispose()
    boundary.render.mockReset()
  })

  it.each(["context lost", "render exception"])("preserves upright reading after %s through resize and page changes", (failure) => {
    host.dataset.bookSpread = ""
    const reading = document.createElement("section")
    reading.dataset.bookReading = ""
    host.appendChild(reading)
    rect = new DOMRect(0, 0, 1200, 760)
    const onError = vi.fn()
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError })
    flush()
    expect(host.dataset.bookLayout).toBe("spread")
    if (failure === "context lost") host.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }))
    else {
      boundary.render.mockImplementationOnce(() => { throw new Error("GPU render failed") })
      stage.setPlant("grass"); flush()
    }
    expect(onError).toHaveBeenCalledOnce()
    const renders = boundary.render.mock.calls.length
    for (const [width, height] of [[1440, 800], [390, 310], [1200, 760]]) {
      rect = new DOMRect(0, 0, width, height)
      resize()
      stage.setVisible(false); stage.setVisible(true)
      stage.setPage(stage.diagnostics().page ? 0 : 1)
      flush()
      expect(host.dataset.bookLayout).toBe("compact")
      expect(reading.style.transform).toBe("")
      expect(reading.style.opacity).toBe("1")
      expect(reading.inert).toBe(false)
      expect(stage.diagnostics()).toMatchObject({ visible: false, turning: false, pendingFrame: false })
    }
    expect(boundary.render).toHaveBeenCalledTimes(renders)
    stage.dispose()
  })

  it("conceals text for the complete turn and keeps reduced-motion reading immediately available", () => {
    host.dataset.bookSpread = ""
    const reading = document.createElement("section")
    reading.dataset.bookReading = ""
    host.appendChild(reading)
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: vi.fn() })
    flush()
    stage.setPage(1)
    expect(reading.style.opacity).toBe("0") // Before the first animation frame.
    expect(reading.inert).toBe(true)
    for (time of [0, 80, 400, 780]) {
      flush()
      expect(reading.style.opacity).toBe("0")
      expect(reading.inert).toBe(true)
    }
    time = 830; flush()
    expect(reading.style.opacity).toBe("1")
    expect(reading.inert).toBe(false)
    Object.assign(motionPreference, { matches: true })
    stage.setPage(0)
    expect(stage.diagnostics().turning).toBe(false)
    expect(reading.style.opacity).toBe("1")
    expect(reading.inert).toBe(false)
    stage.dispose()
  })

  it("starts concealment in the React layout phase before the target page can paint", async () => {
    vi.stubGlobal("IntersectionObserver", undefined)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => rect)
    rect = new DOMRect(0, 0, 1200, 760)
    const beforePaint: string[] = []
    function Harness({ page }: { page: 0 | 1 }) {
      const reading = useRef<HTMLElement>(null)
      useLayoutEffect(() => { if (page === 1) beforePaint.push(reading.current!.style.opacity) }, [page])
      return <div data-book-spread>
        <PlantCanvas plant="tree" page={page} />
        <section ref={reading} data-book-reading>课文第 {page + 1} 页</section>
      </div>
    }
    const view = render(<Harness page={0} />)
    await waitFor(() => expect(view.container.querySelector("canvas")).not.toBeNull())
    act(() => flush())
    view.rerender(<Harness page={1} />)
    expect(beforePaint).toEqual(["0"])
    expect(view.container.querySelector<HTMLElement>("[data-book-reading]")!.inert).toBe(true)
    act(() => { time = 830; flush() })
    expect(view.container.querySelector<HTMLElement>("[data-book-reading]")!.style.opacity).toBe("1")
    view.unmount()
    expect(callbacks.size).toBe(0)
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
    pointer("pointerdown")
    canvas.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 2, button: 0, isPrimary: false, clientX: x + 20, clientY: y }))
    canvas.dispatchEvent(new PointerEvent("pointerup", { pointerId: 2, button: 0, isPrimary: false, clientX: x + 20, clientY: y }))
    pointer("pointerup")
    expect(select).not.toHaveBeenCalled() // A pinch must never become an example tap.
    stage.dispose()
  })

})
