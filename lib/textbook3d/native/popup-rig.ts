import * as THREE from "three"

const PAPER_DEPTH = 0.012
const ROTATION_START = 0.85

/**
 * A paper-popup approximation: close the specimen's local depth, then rotate
 * its full-height silhouette around a fixed bottom hinge toward positive Z.
 * Opening reverses those steps. This is not an articulated origami simulation.
 *
 * The caller sets the model's fixed scale before creating the rig, places root
 * on the paper, and supplies fold values from its existing finite animation.
 * Keep the model's local transforms fixed for the rig's lifetime. Geometry,
 * materials, instance buffers, and the model's own transforms remain borrowed.
 */
export function createPopupRig(model: THREE.Group) {
  const previousParent = model.parent
  const previousIndex = previousParent?.children.indexOf(model) ?? -1
  const root = new THREE.Group()
  root.name = "popup-paper-anchor"
  const hinge = new THREE.Group()
  hinge.name = "popup-base-hinge"
  const depth = new THREE.Group()
  depth.name = "popup-local-depth-fold"
  const support = new THREE.Group()
  support.name = "popup-ground-support"
  root.add(hinge)
  hinge.add(depth)
  depth.add(support)
  support.add(model)
  root.updateMatrixWorld(true)

  // Read bounds after reparenting so an old parent's world transform cannot
  // become part of the specimen's support height or compressed paper depth.
  // Box3 includes InstancedMesh bounds without expanding it into separate draws.
  const bounds = new THREE.Box3().setFromObject(model)
  const hasBounds = !bounds.isEmpty()
  support.position.y = hasBounds ? -bounds.min.y : 0
  const front = hasBounds ? bounds.max.z : 0
  const thickness = hasBounds ? bounds.max.z - bounds.min.z : 0
  const paperScale = thickness > PAPER_DEPTH ? PAPER_DEPTH / thickness : 1
  let disposed = false

  function setFold(value: number) {
    if (disposed) return
    const fold = Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 1
    const closingDepth = Math.min(1, (1 - fold) / (1 - ROTATION_START))
    // X/Y never shrink. Keeping a nonzero Z thickness also avoids singular
    // normal matrices and preserves separate front/back surfaces when folded.
    depth.scale.z = THREE.MathUtils.lerp(1, paperScale, closingDepth)
    depth.position.z = -front * paperScale * closingDepth
    hinge.rotation.x = fold < ROTATION_START ? (1 - fold / ROTATION_START) * Math.PI / 2 : 0
    // Rotation begins only when all depth lies at z<=0 and all height at y>=0.
    // For 0<=angle<=pi/2, y' = y*cos(angle)-z*sin(angle) therefore stays >=0.
    // The root and hinge position stay fixed; no compensating vertical lift.
    root.updateMatrixWorld(true)
  }

  setFold(1)
  return {
    root,
    setFold,
    dispose() {
      if (disposed) return
      setFold(1)
      disposed = true
      // Restore only our own attachment. If a caller has already moved the
      // model elsewhere, disposal must not take ownership of that new parent.
      if (model.parent === support) {
        model.removeFromParent()
        if (previousParent) {
          previousParent.add(model)
          const children = previousParent.children
          children.splice(children.indexOf(model), 1)
          children.splice(Math.min(previousIndex, children.length), 0, model)
        }
      }
      root.removeFromParent()
      support.clear()
      depth.clear()
      hinge.clear()
      root.clear()
    },
  }
}
