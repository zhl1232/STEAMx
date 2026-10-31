import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import { createDemandRenderer } from "./demand-renderer"
import { bookLayoutFor, projectReadingPage, type BookLayout } from "./book-page-layout"
import { bookTurnCameraScale, createBookGarden, fitBookCamera, lightBookScene } from "./book-garden"
import { createBookMotion, type BookPage } from "./book-motion"
import { plantPixelRatio, type PlantId } from "./plants"

export type PlantStage = ReturnType<typeof createPlantStage>

export function createPlantStage(host: HTMLElement, options: {
  plant: PlantId
  page?: BookPage
  onSelect?: (plant: PlantId) => void
  onTurningChange?: (turning: boolean) => void
  startedAt: number
  onReady: () => void
  onError: () => void
}) {
  const cleanup: Array<() => void> = []
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const release of cleanup.reverse()) release()
  }
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" })
    cleanup.push(() => { renderer.dispose(); renderer.forceContextLoss() })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.shadowMap.autoUpdate = false
    const canvas = renderer.domElement
    canvas.setAttribute("aria-label", "植物立体书。点选书上的植物；拖动转动书本，双指缩放；也可用方向键和加减键。")
    canvas.setAttribute("role", "img")
    canvas.tabIndex = 0
    host.appendChild(canvas)
    cleanup.push(() => canvas.remove())

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = false
    controls.enablePan = false
    controls.minPolarAngle = 0.04
    controls.maxPolarAngle = 0.78
    controls.minAzimuthAngle = -0.45
    controls.maxAzimuthAngle = 0.45
    controls.rotateSpeed = 0.65
    controls.zoomSpeed = 0.7
    cleanup.push(() => controls.dispose())

    const garden = createBookGarden()
    scene.add(garden.root)
    cleanup.push(() => garden.dispose())
    cleanup.push(lightBookScene(scene))
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    let turnView: THREE.Vector3 | null = null
    let layout: BookLayout = "spread"
    const spread = host.closest<HTMLElement>("[data-book-spread]")
    const reading = spread?.querySelector<HTMLElement>("[data-book-reading]")
    const plantControls = spread?.querySelector<HTMLElement>("[data-book-controls]")
    const setPrintResizing = (resizing: boolean) => {
      for (const surface of [reading, plantControls]) {
        if (resizing) surface?.style.setProperty("visibility", "hidden")
        else surface?.style.removeProperty("visibility")
      }
    }
    const clearControlsPosition = () => {
      for (const property of ["left", "top", "right", "bottom", "transform"]) plantControls?.style.removeProperty(property)
    }
    const restoreUprightReading = () => {
      setPrintResizing(false)
      if (spread) spread.dataset.bookLayout = "compact"
      if (reading) {
        reading.style.removeProperty("transform")
        reading.style.opacity = "1"
        reading.inert = false
      }
      if (plantControls) { plantControls.style.opacity = "1"; plantControls.inert = false }
      clearControlsPosition()
    }
    cleanup.push(() => {
      setPrintResizing(false)
      if (spread) delete spread.dataset.bookLayout
      reading?.style.removeProperty("transform")
      reading?.style.removeProperty("opacity")
      if (reading) reading.inert = false
      clearControlsPosition()
      plantControls?.style.removeProperty("opacity")
      if (plantControls) plantControls.inert = false
    })
    const motion = createBookMotion(options.page ?? 0, (pose) => {
      garden.setPose(pose)
      if (turnView) {
        camera.position.copy(turnView).sub(controls.target).multiplyScalar(bookTurnCameraScale(pose.leafAngle)).add(controls.target)
        camera.lookAt(controls.target)
        camera.updateMatrixWorld()
      }
      renderer.shadowMap.needsUpdate = true
    }, (turning) => {
      controls.enabled = !turning
      if (!turning) turnView = null
      if (reading) {
        // Cover the whole transition, including the initial fold and final unfold.
        reading.style.opacity = turning ? "0" : "1"
        reading.inert = turning
      }
      if (plantControls) { plantControls.style.opacity = turning ? "0" : "1"; plantControls.inert = turning }
      options.onTurningChange?.(turning)
    })
    motion.finish()
    cleanup.push(() => { motion.finish(); motion.dispose() })

    let selected = options.plant
    let intersecting = true
    let contextLost = false
    let renderFailed = false
    let width = 0
    let height = 0
    let fitDistance = 0
    let renders = 0
    let firstRenderMs: number | null = null
    let interacting = false
    let previousDragFrame = 0
    const renderTimes: number[] = []
    const dragIntervals: number[] = []
    const boundedPush = (values: number[], value: number) => { values.push(value); if (values.length > 240) values.shift() }
    const scheduler = createDemandRenderer(() => {
      if (disposed || contextLost || renderFailed) return
      const started = performance.now()
      const animating = motion.update(started)
      // OrbitControls changes the pose before renderer.render updates matrixWorld.
      // Commit it first so DOM print and WebGL see exactly the same frame.
      camera.updateMatrixWorld(true)
      garden.root.updateMatrixWorld(true)
      if (reading && spread?.dataset.bookLayout !== "compact") {
        reading.style.transform = projectReadingPage(camera, width, height, garden.paper, layout).transform
        if (plantControls) {
          plantControls.style.transform = projectReadingPage(camera, width, height, garden.paper, layout, true).transform
        }
      }
      try {
        renderer.render(scene, camera)
        setPrintResizing(false)
      } catch {
        renderFailed = true
        motion.finish()
        restoreUprightReading()
        options.onError()
        scheduler.setVisible(false)
        return
      }
      renders += 1
      boundedPush(renderTimes, performance.now() - started)
      if (interacting && previousDragFrame && started - previousDragFrame < 250) boundedPush(dragIntervals, started - previousDragFrame)
      previousDragFrame = interacting ? started : 0
      if (firstRenderMs === null) {
        firstRenderMs = performance.now() - options.startedAt
        options.onReady()
      }
      if (animating) scheduler.invalidate()
    })
    cleanup.push(() => scheduler.dispose())
    const updateVisibility = () => {
      const visible = intersecting && !document.hidden && !contextLost && !renderFailed && width > 0 && height > 0
      scheduler.setVisible(visible)
      if (!visible && motion.busy) { motion.finish(); scheduler.invalidate() }
    }
    const resetView = () => {
      if (disposed) return
      // End the camera-owning turn before resetting; its next frame must not
      // restore the old turnView over the user's requested view.
      if (motion.busy) motion.finish()
      const fit = fitBookCamera(camera, garden.root, layout)
      fitDistance = fit.distance
      controls.target.copy(fit.center)
      controls.minDistance = fitDistance * 0.8
      controls.maxDistance = fitDistance * 1.4
      controls.update()
      scheduler.invalidate()
    }
    const setPlant = (id: PlantId) => {
      if (disposed) return
      selected = id
      garden.setSelected(id)
      renderer.shadowMap.needsUpdate = true
      scheduler.invalidate()
    }
    const setPage = (page: BookPage) => {
      if (disposed) return
      const started = motion.turnTo(page, performance.now(), Boolean(reducedMotion?.matches) || contextLost || renderFailed || !intersecting || document.hidden || !width || !height)
      if (started && motion.busy) turnView = camera.position.clone()
      scheduler.invalidate()
    }
    const onMotionPreference = () => {
      if (reducedMotion?.matches && motion.busy) { motion.finish(); scheduler.invalidate() }
    }
    reducedMotion?.addEventListener("change", onMotionPreference)
    cleanup.push(() => reducedMotion?.removeEventListener("change", onMotionPreference))
    const resize = () => {
      if (disposed) return
      const rect = host.getBoundingClientRect()
      const nextWidth = Math.floor(rect.width)
      const nextHeight = Math.floor(rect.height)
      if (nextWidth === width && nextHeight === height) return
      if (motion.busy) motion.finish() // A viewport/layout change settles on the requested page.
      width = nextWidth
      height = nextHeight
      if (contextLost || renderFailed) {
        restoreUprightReading()
        updateVisibility()
        return
      }
      layout = bookLayoutFor(width, height)
      // setSize clears the framebuffer. Do not expose an old DOM projection over
      // that empty frame; reveal both surfaces after the next atomic draw.
      setPrintResizing(true)
      garden.setLayout(layout)
      renderer.shadowMap.needsUpdate = true
      if (spread) spread.dataset.bookLayout = layout
      updateVisibility()
      if (!width || !height) return
      renderer.setPixelRatio(plantPixelRatio(width, height, window.devicePixelRatio))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      resetView()
    }
    const onChange = () => scheduler.invalidate()
    const onStart = () => { interacting = true; previousDragFrame = 0 }
    const onEnd = () => { interacting = false; previousDragFrame = 0 }
    controls.addEventListener("change", onChange)
    controls.addEventListener("start", onStart)
    controls.addEventListener("end", onEnd)
    cleanup.push(() => {
      controls.removeEventListener("change", onChange)
      controls.removeEventListener("start", onStart)
      controls.removeEventListener("end", onEnd)
    })
    const onKey = (event: KeyboardEvent) => {
      if (motion.busy) return
      const offset = camera.position.clone().sub(controls.target)
      const spherical = new THREE.Spherical().setFromVector3(offset)
      switch (event.key) {
        case "ArrowLeft": spherical.theta -= 0.15; break
        case "ArrowRight": spherical.theta += 0.15; break
        case "ArrowUp": spherical.phi -= 0.12; break
        case "ArrowDown": spherical.phi += 0.12; break
        case "+": case "=": spherical.radius *= 0.9; break
        case "-": spherical.radius *= 1.1; break
        case "Home": event.preventDefault(); resetView(); return
        default: return
      }
      event.preventDefault()
      spherical.theta = THREE.MathUtils.clamp(spherical.theta, controls.minAzimuthAngle, controls.maxAzimuthAngle)
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle)
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance)
      camera.position.setFromSpherical(spherical).add(controls.target)
      controls.update()
      scheduler.invalidate()
    }
    const raycaster = new THREE.Raycaster()
    let pointerStart: { x: number; y: number; id: number } | null = null
    const pointers = new Set<number>()
    const onPointerDown = (event: PointerEvent) => {
      pointers.add(event.pointerId)
      pointerStart = pointers.size === 1 && event.isPrimary !== false && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null
    }
    const onPointerCancel = (event: PointerEvent) => { pointers.delete(event.pointerId); pointerStart = null }
    const onPointerUp = (event: PointerEvent) => {
      const start = pointerStart
      pointers.delete(event.pointerId)
      pointerStart = null
      if (!start || start.id !== event.pointerId || motion.busy || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera)
      garden.root.updateMatrixWorld(true)
      const hit = raycaster.intersectObjects(Object.values(garden.plants), true)[0]
      let object: THREE.Object3D | null = hit?.object ?? null
      while (object && !object.userData.plantId) object = object.parent
      if (object?.userData.plantId) options.onSelect?.(object.userData.plantId as PlantId)
    }
    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointerup", onPointerUp)
    canvas.addEventListener("pointercancel", onPointerCancel)
    cleanup.push(() => {
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("pointercancel", onPointerCancel)
    })
    const onLost = (event: Event) => { event.preventDefault(); contextLost = true; updateVisibility(); restoreUprightReading(); options.onError() }
    canvas.addEventListener("keydown", onKey)
    canvas.addEventListener("webglcontextlost", onLost)
    document.addEventListener("visibilitychange", updateVisibility)
    cleanup.push(() => {
      canvas.removeEventListener("keydown", onKey)
      canvas.removeEventListener("webglcontextlost", onLost)
      document.removeEventListener("visibilitychange", updateVisibility)
    })
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    cleanup.push(() => observer.disconnect())
    const percentile = (values: number[], p: number) => values.length ? [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)] : null
    const diagnostics = () => ({
      disposed, selected, page: motion.page, turning: motion.busy, renders, firstRenderMs, pendingFrame: scheduler.pending,
      visible: intersecting && !document.hidden && !contextLost && !renderFailed && width > 0 && height > 0,
      drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      dpr: renderer.getPixelRatio(), pixels: canvas.width * canvas.height,
      renderCpuMsP95: percentile(renderTimes, 0.95), dragFrameMsP95: percentile(dragIntervals, 0.95),
      dragSamples: dragIntervals.length,
    })
    if (process.env.NODE_ENV === "development") {
      Object.defineProperty(canvas, "textbookDiagnostics", { configurable: true, value: diagnostics })
      cleanup.push(() => { Reflect.deleteProperty(canvas, "textbookDiagnostics") })
    }
    setPlant(selected)
    resize()
    updateVisibility()
    return {
      setPlant, setPage, resetView, dispose, diagnostics,
      setVisible(value: boolean) { if (!disposed) { intersecting = value; updateVisibility() } },
    }
  } catch (error) {
    dispose()
    throw error
  }
}
