import type { LineSegments, Material, Object3D } from 'three'

const PREVIOUS_STEP_EDGE_OPACITY = 0.25

/**
 * Keep the current step's prepared edges exactly as authored and soften older
 * outlines. Dense stud lines must not tint a plate away from its real colour.
 * Face materials, geometry and conditional-line shaders stay intact.
 * Steps can arrive asynchronously: a late response never changes the selection.
 */
export function createLdrawStepHighlight() {
  const steps = new Map<number, Object3D>()
  const variants = new Map<Material, Material>()
  const originals = new Map<LineSegments, Material | Material[]>()
  let selectedStep: number | null = null
  let disposed = false

  const restore = () => {
    for (const [line, material] of originals) line.material = material
    originals.clear()
  }

  const mutedMaterial = (source: Material): Material => {
    let variant = variants.get(source)
    if (!variant) {
      // clone() preserves LDrawConditionalLineMaterial's shader and uniforms.
      // Keep the native edge colour, including ldraw-edges' large-plate choices.
      variant = source.clone()
      variant.opacity = source.opacity * PREVIOUS_STEP_EDGE_OPACITY
      variant.transparent = true
      variant.depthWrite = false
      variants.set(source, variant)
    }
    return variant
  }

  const applySelection = () => {
    restore()
    if (disposed || selectedStep === null) return
    let hasCurrentEdges = false
    steps.get(selectedStep)?.traverse((object) => {
      if ((object as LineSegments).isLineSegments) hasCurrentEdges = true
    })
    // While the requested model is missing, or on an empty/wrap-up page, leave
    // the whole assembly normal rather than implying that old parts are new.
    if (!hasCurrentEdges) return
    for (const [index, step] of steps) {
      if (index >= selectedStep) continue
      step.traverse((object) => {
        const line = object as LineSegments
        if (!line.isLineSegments) return
        const source = line.material
        originals.set(line, source)
        line.material = Array.isArray(source) ? source.map(mutedMaterial) : mutedMaterial(source)
      })
    }
  }

  return {
    registerStep(index: number, step: Object3D) {
      if (disposed || steps.get(index) === step) return
      steps.set(index, step)
      if (selectedStep !== null && index <= selectedStep) applySelection()
    },
    setStep(index: number | null) {
      if (disposed || selectedStep === index) return
      selectedStep = index
      applySelection()
    },
    dispose() {
      if (disposed) return
      restore()
      disposed = true
      selectedStep = null
      steps.clear()
      for (const material of variants.values()) material.dispose()
      variants.clear()
    },
  }
}
