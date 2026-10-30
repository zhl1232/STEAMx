import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import { createDemandRenderer } from "./demand-renderer"
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
    renderer.toneMappingExposure = 1.2
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
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = false
    controls.enablePan = false
    controls.minPolarAngle = 0.45
    controls.maxPolarAngle = 1.12
    controls.minAzimuthAngle = -0.55
    controls.maxAzimuthAngle = 0.65
    controls.rotateSpeed = 0.65
    controls.zoomSpeed = 0.7
    cleanup.push(() => controls.dispose())

    const garden = createBookGarden()
    scene.add(garden.root)
    cleanup.push(() => garden.dispose())
    cleanup.push(lightBookScene(scene))
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    let turnView: THREE.Vector3 | null = null
    const inscription = host.querySelector<HTMLElement>("[data-book-inscription]")
    const motion = createBookMotion(options.page ?? 0, (pose) => {
      garden.setPose(pose)
      if (turnView) {
        camera.position.copy(turnView).sub(controls.target).multiplyScalar(bookTurnCameraScale(pose.leafAngle)).add(controls.target)
        camera.lookAt(controls.target)
        camera.updateMatrixWorld()
      }
      if (inscription) inscription.style.opacity = pose.turning ? "0" : "1"
      renderer.shadowMap.needsUpdate = true
    }, (turning) => {
      controls.enabled = !turning
      if (!turning) turnView = null
      options.onTurningChange?.(turning)
    })
    motion.finish()
    cleanup.push(() => { motion.finish(); motion.dispose() })

    let selected = options.plant
    let intersecting = true
    let contextLost = false
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
      if (disposed || contextLost) return
      const started = performance.now()
      const animating = motion.update(started)
      if (inscription) {
        const point = new THREE.Vector3(-2.1, 0.14, -1.52).project(camera)
        const left = new THREE.Vector3(-3.1, 0.14, -1.52).project(camera)
        const right = new THREE.Vector3(-1.1, 0.14, -1.52).project(camera)
        const labelWidth = Math.abs(right.x - left.x) * width / 2
        inscription.style.left = `${(point.x + 1) * width / 2}px`
        inscription.style.top = `${(1 - point.y) * height / 2}px`
        inscription.style.width = `${labelWidth}px`
        inscription.style.fontSize = `${Math.max(10, Math.min(19, labelWidth / 9))}px`
        inscription.style.transform = `translate(-50%, -50%) rotate(${Math.atan2((left.y - right.y) * height, (right.x - left.x) * width)}rad)`
      }
      try {
        renderer.render(scene, camera)
      } catch {
        motion.finish()
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
      const visible = intersecting && !document.hidden && !contextLost && width > 0 && height > 0
      scheduler.setVisible(visible)
      if (!visible && motion.busy) { motion.finish(); scheduler.invalidate() }
    }
    const resetView = () => {
      if (disposed) return
      // End the camera-owning turn before resetting; its next frame must not
      // restore the old turnView over the user's requested view.
      if (motion.busy) motion.finish()
      const fit = fitBookCamera(camera)
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
      const started = motion.turnTo(page, performance.now(), Boolean(reducedMotion?.matches) || !intersecting || document.hidden || !width || !height)
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
    const onPointerDown = (event: PointerEvent) => {
      pointerStart = event.isPrimary !== false && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null
    }
    const onPointerCancel = () => { pointerStart = null }
    const onPointerUp = (event: PointerEvent) => {
      const start = pointerStart
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
    const onLost = (event: Event) => { event.preventDefault(); contextLost = true; updateVisibility(); options.onError() }
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
      visible: intersecting && !document.hidden && !contextLost && width > 0 && height > 0,
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
