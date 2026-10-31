import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PerspectiveCamera, Vector3, type Scene, type Object3D } from "three"
import { useLayoutEffect, useRef } from "react"
import { act, render, waitFor } from "@testing-library/react"
import { createPlantStage } from "@/lib/textbook3d/native/plant-stage"
import { PlantCanvas } from "./plant-canvas"
import { BOOK_TURN_MS } from "@/lib/textbook3d/native/book-motion"
import { TREE_PARTS } from "@/lib/textbook3d/native/tree-parts"
import { createObservationModels } from "@/lib/textbook3d/native/observation-models"
import { getSceneLabels } from "@/lib/textbook3d/native/scene-labels"
import { PLANT_RESPONSE_MS } from "@/lib/textbook3d/native/plant-response"

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
      verify(reading, paper, camera, 320, 430, [[-3.42,.148,-2.02],[-.45,.148,-2.02],[-.45,.148,2.02],[-3.42,.148,2.02]])
      verify(buttons, paper, camera, 220, 52, [[.45,.148,1.5],[2.78,.148,1.5],[2.78,.148,2.18],[.45,.148,2.18]])
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

  it("anchors three non-overlapping labels to the same-frame tree and clears them on turn, hide and failure", () => {
    host.dataset.bookSpread = ""
    const callout = document.createElement("div")
    callout.dataset.treeCallout = ""
    callout.innerHTML = `<svg>${TREE_PARTS.map(part => `<line data-tree-line="${part.id}"/><circle data-tree-pin="${part.id}"/>`).join("")}</svg>${TREE_PARTS.map(part => `<span data-tree-bubble="${part.id}">${part.name}</span>`).join("")}`
    host.append(callout)
    const dismissed = vi.fn()
    rect = new DOMRect(0, 0, 873, 412)
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: vi.fn(), onLabelsDismiss: dismissed })
    flush()
    expect(callout.hidden).toBe(true)
    const beforeLabels = (boundary.render.mock.calls.at(-1)![1] as PerspectiveCamera).position.clone()
    stage.setLabels(true)
    expect((boundary.render.mock.calls.at(-1)![1] as PerspectiveCamera).position.equals(beforeLabels)).toBe(true)
    const verify = (scene: Scene, camera: PerspectiveCamera) => {
      camera.updateMatrixWorld(true)
      const tree = scene.getObjectByName("plant-tree")!
      const ys: number[] = []
      for (const part of TREE_PARTS) {
        const expected = new Vector3(...part.anchor).applyMatrix4(tree.matrixWorld).project(camera)
        const line = callout.querySelector(`[data-tree-line="${part.id}"]`)!
        expect(Number(line.getAttribute("x1"))).toBeCloseTo((expected.x + 1) * rect.width / 2, 5)
        expect(Number(line.getAttribute("y1"))).toBeCloseTo((1 - expected.y) * rect.height / 2, 5)
        ys.push(Number(line.getAttribute("y2")))
      }
      ys.sort((a, b) => a - b)
      expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(40)
      expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(40)
    }
    boundary.render.mockImplementation(verify)
    flush()
    expect(callout.hidden).toBe(false)
    host.querySelector("canvas")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" })); flush()
    rect = new DOMRect(0, 0, 390, 844); resize(); flush()
    expect(stage.diagnostics().pendingFrame).toBe(false)
    boundary.render.mockReset()
    stage.setPage(1)
    expect(callout.hidden).toBe(true)
    expect(dismissed).toHaveBeenCalledOnce()
    time = BOOK_TURN_MS + 10; flush()
    stage.setLabels(true); flush(); stage.setVisible(false)
    expect(callout.hidden).toBe(true)
    stage.setVisible(true); flush()
    expect(callout.hidden).toBe(true)
    stage.setLabels(true); flush(); stage.setPlant("grass"); flush()
    expect(callout.hidden).toBe(true)
    stage.setPlant("tree"); stage.setLabels(true); flush()
    host.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }))
    expect(callout.hidden).toBe(true)
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
    time = BOOK_TURN_MS + 10; flush()
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
    act(() => { time = BOOK_TURN_MS + 10; flush() })
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
    for (time = 0; time <= BOOK_TURN_MS + 50; time += 50) flush()
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
    expect(camera.position.equals(defaultView)).toBe(true)
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

  it("preserves an orbited camera and the whole book through contents and both page turns", () => {
    const stage = createPlantStage(host, { plant: "tree", page: -1, startedAt: 0, onReady: vi.fn(), onError: vi.fn() })
    flush()
    host.querySelector("canvas")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }))
    flush()
    const [scene, camera] = boundary.render.mock.calls.at(-1) as [Scene, PerspectiveCamera]
    const book = scene.getObjectByName("book-and-popups")!, paper = scene.getObjectByName("botanical-pop-up-book")!
    const cameraMatrix = camera.matrixWorld.clone(), rootMatrix = book.matrixWorld.clone(), paperMatrix = paper.matrixWorld.clone()
    const sheet = scene.getObjectByName("hinged-turning-leaf")!
    for (const page of [0, 1, -1] as const) {
      const start = time
      stage.setPage(page)
      for (const fraction of [0, .12, .3, .5, .7, .85, 1]) {
        time = start + BOOK_TURN_MS * fraction
        flush()
        expect(camera.matrixWorld.equals(cameraMatrix)).toBe(true)
        expect(book.matrixWorld.equals(rootMatrix)).toBe(true)
        expect(paper.matrixWorld.equals(paperMatrix)).toBe(true)
        if (fraction === .5) expect(sheet.visible).toBe(true)
      }
      expect(stage.diagnostics()).toMatchObject({ page, turning: false, pendingFrame: false })
    }
    stage.dispose()
  })

  it("reuses selection and same-frame labels for the second lesson's actual specimens", () => {
    const spread = document.createElement("div")
    spread.dataset.bookSpread = ""
    host.replaceWith(spread); spread.append(host)
    const callout = document.createElement("div")
    callout.dataset.treeCallout = ""
    spread.append(callout)
    const stage = createPlantStage(host, { lessonId: "p1a-1-2", createModels: createObservationModels, plant: "leaf", startedAt: 0, onReady: vi.fn(), onError: vi.fn() })
    flush()
    const [scene, camera] = boundary.render.mock.calls.at(-1) as [Scene, PerspectiveCamera]
    expect(scene.getObjectByName("plant-tree")).toBeUndefined()
    const ring = scene.getObjectByName("selected-plant-ring")!
    for (const plant of ["leaf", "stem", "flower"] as const) {
      const labels = getSceneLabels("p1a-1-2", plant)
      callout.innerHTML = `<svg>${labels.map(part => `<line data-tree-line="${part.id}"/><circle data-tree-pin="${part.id}"/>`).join("")}</svg>${labels.map(part => `<span data-tree-bubble="${part.id}"></span>`).join("")}`
      stage.setPlant(plant); stage.setLabels(true); flush()
      expect(callout.hidden).toBe(false)
      expect(ring.userData.plantId).toBe(plant)
      expect(scene.getObjectsByProperty("name", "selected-plant-ring")).toHaveLength(1)
      const model = scene.getObjectByName(`plant-${plant}`)!
      for (const part of labels) {
        const anchor = new Vector3(...part.anchor).applyMatrix4(model.matrixWorld).project(camera)
        const pin = callout.querySelector(`[data-tree-pin="${part.id}"]`)!
        expect(Number(pin.getAttribute("cx"))).toBeCloseTo((anchor.x + 1) * rect.width / 2, 5)
        expect(Number(pin.getAttribute("cy"))).toBeCloseTo((1 - anchor.y) * rect.height / 2, 5)
      }
      stage.setLabels(false); flush()
      expect(callout.hidden).toBe(true)
      expect(ring.userData.plantId).toBe(plant)
      expect(ring.visible).toBe(true)
      expect(callbacks.size).toBe(0)
    }
    stage.dispose(); spread.remove()
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
    pointer("pointerdown"); pointer("pointermove", 15); pointer("pointermove"); pointer("pointerup")
    expect(select).not.toHaveBeenCalled() // Returning to the start does not turn an orbit into a tap.
    pointer("pointerdown")
    canvas.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 2, button: 0, isPrimary: false, clientX: x + 20, clientY: y }))
    canvas.dispatchEvent(new PointerEvent("pointerup", { pointerId: 2, button: 0, isPrimary: false, clientX: x + 20, clientY: y }))
    pointer("pointerup")
    expect(select).not.toHaveBeenCalled() // A pinch must never become an example tap.
    stage.dispose()
  })

  it("allows a genuinely lower view, preserves it on resize, and drags through noninteractive print", () => {
    host.dataset.bookSpread = ""
    const reading = document.createElement("section")
    reading.dataset.bookReading = ""
    reading.innerHTML = "<p>书上印刷的课文</p><button>回答问题</button>"
    host.append(reading)
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: vi.fn() })
    flush()
    const camera = boundary.render.mock.calls.at(-1)![1] as PerspectiveCamera
    const canvas = host.querySelector("canvas")!
    const polar = () => Math.acos(-camera.getWorldDirection(new Vector3()).y)
    for (let i = 0; i < 12; i++) canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }))
    flush()
    expect(polar()).toBeCloseTo(1.3, 6)
    const direction = camera.getWorldDirection(new Vector3())
    for (const [w, h] of [[390, 844], [844, 390], [1200, 760]]) {
      rect = new DOMRect(0, 0, w, h); resize(); flush()
      expect(camera.getWorldDirection(new Vector3()).distanceTo(direction)).toBeLessThan(1e-6)
    }
    canvas.setPointerCapture = vi.fn(); canvas.releasePointerCapture = vi.fn()
    Object.defineProperty(canvas, "clientHeight", { configurable: true, value: 760 })
    const down = () => new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 3, pointerType: "mouse", button: 0, buttons: 1, clientX: 300, clientY: 300 })
    const buttonEvent = down()
    reading.querySelector("button")!.dispatchEvent(buttonEvent)
    expect(buttonEvent.defaultPrevented).toBe(false)
    expect(canvas.setPointerCapture).not.toHaveBeenCalled()
    reading.querySelector("p")!.dispatchEvent(down())
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(3)
    canvas.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 3, pointerType: "mouse", buttons: 1, clientX: 300, clientY: 420 }))
    canvas.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 3, pointerType: "mouse", button: 0, clientX: 300, clientY: 420 }))
    flush()
    expect(polar()).toBeLessThan(1.2)
    stage.resetView(); flush()
    expect(polar()).toBeCloseTo(.64, 6)
    stage.dispose()
    vi.mocked(canvas.setPointerCapture).mockClear()
    reading.querySelector("p")!.dispatchEvent(down())
    expect(canvas.setPointerCapture).not.toHaveBeenCalled()
    expect(callbacks.size).toBe(0)
  })

  it("animates repeated selections finitely in both lessons without moving book or camera", () => {
    for (const second of [false, true]) {
      const stage = createPlantStage(host, { lessonId: second ? "p1a-1-2" : "p1a-1-1", createModels: second ? createObservationModels : undefined, plant: second ? "leaf" : "tree", startedAt: time, onReady: vi.fn(), onError: vi.fn() })
      flush()
      const [scene, camera] = boundary.render.mock.calls.at(-1) as [Scene, PerspectiveCamera]
      const book = scene.getObjectByName("book-and-popups")!
      const bookMatrix = book.matrixWorld.clone(), cameraMatrix = camera.matrixWorld.clone()
      for (const id of second ? ["leaf", "stem", "flower"] as const : ["tree", "grass", "flower"] as const) {
        stage.setPlant(id); stage.playResponse(id)
        time += 110; flush()
        expect(stage.diagnostics()).toMatchObject({ responding: true, pendingFrame: true })
        stage.playResponse(id) // Restart one response; do not create competing RAFs.
        expect(callbacks.size).toBe(1)
        time += 150; flush()
        expect(book.matrixWorld.equals(bookMatrix)).toBe(true)
        expect(camera.matrixWorld.equals(cameraMatrix)).toBe(true)
        expect(scene.getObjectByName("selected-plant-ring")!.userData.plantId).toBe(id)
        time += PLANT_RESPONSE_MS; flush()
        expect(stage.diagnostics()).toMatchObject({ responding: false, pendingFrame: false })
        expect(callbacks.size).toBe(0)
      }
      stage.dispose()
    }
  })

  it("stops plant responses on visibility, reduced motion, page turns, resize, failure and disposal", () => {
    const stage = createPlantStage(host, { plant: "tree", startedAt: 0, onReady: vi.fn(), onError: vi.fn() })
    flush()
    const play = () => { stage.playResponse("tree"); time += 100; flush(); expect(stage.diagnostics().responding).toBe(true) }
    play(); stage.setVisible(false)
    expect(stage.diagnostics()).toMatchObject({ responding: false, pendingFrame: false })
    stage.setVisible(true); flush()
    play(); Object.assign(motionPreference, { matches: true }); motionPreference.dispatchEvent(new Event("change")); flush()
    stage.playResponse("tree")
    expect(stage.diagnostics()).toMatchObject({ responding: false, pendingFrame: false })
    Object.assign(motionPreference, { matches: false })
    play(); stage.setPage(1)
    stage.playResponse("tree")
    expect(stage.diagnostics()).toMatchObject({ responding: false, turning: true })
    time += BOOK_TURN_MS; flush()
    play(); rect = new DOMRect(0, 0, 844, 390); resize(); flush()
    expect(stage.diagnostics()).toMatchObject({ responding: false, pendingFrame: false })
    play(); host.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }))
    expect(stage.diagnostics()).toMatchObject({ responding: false, pendingFrame: false })
    stage.dispose()
    expect(callbacks.size).toBe(0)
  })

  it("replays the React interaction signal for repeated taps but not initial or stale loading state", async () => {
    vi.stubGlobal("IntersectionObserver", undefined)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => rect)
    const view = render(<PlantCanvas plant="tree" interaction={3} />)
    await waitFor(() => expect(view.container.querySelector("canvas")).not.toBeNull())
    act(() => flush())
    expect(callbacks.size).toBe(0) // No deferred replay from before loading.
    for (const interaction of [4, 5]) {
      view.rerender(<PlantCanvas plant="tree" interaction={interaction} />)
      act(() => { time += 100; flush() })
      expect(callbacks.size).toBe(1)
      act(() => { time += PLANT_RESPONSE_MS; flush() })
      expect(callbacks.size).toBe(0)
    }
    view.rerender(<PlantCanvas plant="tree" interaction={6} />)
    view.unmount()
    expect(callbacks.size).toBe(0)
  })

})
