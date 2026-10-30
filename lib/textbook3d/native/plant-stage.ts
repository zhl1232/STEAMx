import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import { createDemandRenderer } from "./demand-renderer"
import { createPlantModels } from "./plant-models"
import { plantPixelRatio, type PlantId } from "./plants"

export type PlantStage = ReturnType<typeof createPlantStage>

export function createPlantStage(host: HTMLElement, options: {
  plant: PlantId
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
    canvas.setAttribute("aria-label", "植物三维模型。拖动旋转，双指缩放；也可用方向键和加减键。")
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
    controls.maxPolarAngle = Math.PI * 0.48
    controls.rotateSpeed = 0.65
    controls.zoomSpeed = 0.7
    cleanup.push(() => controls.dispose())

    const plants = createPlantModels()
    cleanup.push(() => plants.dispose())
    Object.values(plants.models).forEach((group) => scene.add(group))
    scene.add(new THREE.HemisphereLight("#fff8e9", "#8a9a7e", 2.5))
    const key = new THREE.DirectionalLight("#fff4db", 3.1)
    key.position.set(-3.5, 7, 5)
    key.castShadow = true
    key.shadow.mapSize.set(512, 512)
    key.shadow.camera.left = -3
    key.shadow.camera.right = 3
    key.shadow.camera.top = 5
    key.shadow.camera.bottom = -2
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 18
    key.shadow.normalBias = 0.035
    key.shadow.bias = -0.0002
    key.shadow.radius = 3
    scene.add(key)
    cleanup.push(() => key.shadow.dispose())
    const fill = new THREE.DirectionalLight("#e5efff", 0.65)
    fill.position.set(4, 3, -4)
    scene.add(fill)
    const groundShape = new THREE.CircleGeometry(8, 48)
    const groundMaterial = new THREE.ShadowMaterial({ color: "#354a32", opacity: 0.16 })
    const ground = new THREE.Mesh(groundShape, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.1
    ground.receiveShadow = true
    scene.add(ground)
    cleanup.push(() => { groundShape.dispose(); groundMaterial.dispose() })

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
      try {
        renderer.render(scene, camera)
      } catch {
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
    })
    cleanup.push(() => scheduler.dispose())
    const updateVisibility = () => scheduler.setVisible(intersecting && !document.hidden && !contextLost && width > 0 && height > 0)
    const resetView = () => {
      if (disposed) return
      const sphere = new THREE.Box3().setFromObject(plants.models[selected]).getBoundingSphere(new THREE.Sphere())
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
      const narrowFov = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect))
      fitDistance = sphere.radius / Math.sin(narrowFov) * 1.08
      controls.target.copy(sphere.center)
      camera.position.set(4, 2.8, 6).normalize().multiplyScalar(fitDistance).add(sphere.center)
      controls.minDistance = fitDistance * 0.62
      controls.maxDistance = fitDistance * 1.8
      controls.update()
      scheduler.invalidate()
    }
    const setPlant = (id: PlantId) => {
      if (disposed) return
      selected = id
      Object.entries(plants.models).forEach(([key, group]) => { group.visible = key === id })
      renderer.shadowMap.needsUpdate = true
      resetView()
    }
    const resize = () => {
      if (disposed) return
      const rect = host.getBoundingClientRect()
      const nextWidth = Math.floor(rect.width)
      const nextHeight = Math.floor(rect.height)
      if (nextWidth === width && nextHeight === height) return
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
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle)
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance)
      camera.position.setFromSpherical(spherical).add(controls.target)
      controls.update()
      scheduler.invalidate()
    }
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
      disposed, selected, renders, firstRenderMs, pendingFrame: scheduler.pending,
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
      setPlant, resetView, dispose, diagnostics,
      setVisible(value: boolean) { if (!disposed) { intersecting = value; updateVisibility() } },
    }
  } catch (error) {
    dispose()
    throw error
  }
}
