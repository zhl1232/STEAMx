import type { LineSegments, Material, Object3D } from 'three'

const PREVIOUS_STEP_EDGE_OPACITY = 0.25
export const STEP_EDGE_PULSE_MS = 480

type HighlightOptions = {
  reducedMotion?: boolean
  invalidate?: () => void
  now?: () => number
}

/** Reuse prepared, depth-tested edges. Never recolour faces or add draw calls. */
export function createLdrawStepHighlight(options: HighlightOptions = {}) {
  const steps = new Map<number, Object3D>()
  const variants = new Map<Material, Material>()
  const pulses = new Map<Material, Material>()
  const originals = new Map<LineSegments, Material | Material[]>()
  const activePulses = new Map<Material, Material>()
  const now = options.now ?? (() => performance.now())
  let reducedMotion = options.reducedMotion ?? false
  let selectedStep: number | null = null
  let pulseStart: number | null = null
  let disposed = false

  const restore = () => {
    for (const [line, material] of originals) line.material = material
    originals.clear()
    activePulses.clear()
  }

  const variantFor = (source: Material, pulse: boolean): Material => {
    const cache = pulse ? pulses : variants
    let variant = cache.get(source)
    if (!variant) {
      // Preserve conditional-line shaders and independent opacity uniforms.
      variant = source.clone()
      variant.opacity = source.opacity * (pulse ? 1 : PREVIOUS_STEP_EDGE_OPACITY)
      variant.transparent = true
      variant.depthTest = true
      variant.depthWrite = false
      cache.set(source, variant)
    }
    if (pulse) activePulses.set(variant, source)
    return variant
  }

  const hasCurrentEdges = () => {
    let found = false
    if (selectedStep !== null) steps.get(selectedStep)?.traverse((object) => {
      if ((object as LineSegments).isLineSegments) found = true
    })
    return found
  }

  const applySelection = () => {
    restore()
    // Empty, missing and wrap-up steps must never label earlier parts as new.
    if (disposed || selectedStep === null || !hasCurrentEdges()) return
    for (const [index, step] of steps) {
      const pulse = index === selectedStep && pulseStart !== null
      if (index > selectedStep || (index === selectedStep && !pulse)) continue
      step.traverse((object) => {
        const line = object as LineSegments
        if (!line.isLineSegments) return
        const source = line.material
        originals.set(line, source)
        line.material = Array.isArray(source)
          ? source.map(material => variantFor(material, pulse))
          : variantFor(source, pulse)
      })
    }
  }

  const startPulse = () => {
    pulseStart = !reducedMotion && hasCurrentEdges() ? now() : null
  }
  const finish = () => {
    if (disposed) return
    pulseStart = null
    applySelection()
    options.invalidate?.()
  }

  return {
    registerStep(index: number, step: Object3D) {
      if (disposed || steps.get(index) === step) return
      steps.set(index, step)
      if (index === selectedStep) startPulse()
      if (selectedStep !== null && index <= selectedStep) applySelection()
      options.invalidate?.()
    },
    setStep(index: number | null) {
      if (disposed || selectedStep === index) return
      selectedStep = index
      startPulse()
      applySelection()
      options.invalidate?.()
    },
    /** Called by the scene's demand loop; false means no further frames needed. */
    update(time = now()) {
      if (disposed || pulseStart === null) return false
      const progress = Math.max(0, (time - pulseStart) / STEP_EDGE_PULSE_MS)
      if (progress >= 1) {
        finish()
        return false
      }
      // One smooth breath, without flashes, colour shifts or hidden back edges.
      const opacity = 1 - 0.55 * Math.sin(Math.PI * progress) ** 2
      for (const [variant, source] of activePulses) variant.opacity = source.opacity * opacity
      return true
    },
    finish,
    setReducedMotion(value: boolean) {
      if (disposed || reducedMotion === value) return
      reducedMotion = value
      if (value) finish()
    },
    dispose() {
      if (disposed) return
      restore()
      disposed = true
      pulseStart = null
      selectedStep = null
      steps.clear()
      for (const material of [...variants.values(), ...pulses.values()]) material.dispose()
      variants.clear()
      pulses.clear()
    },
  }
}
