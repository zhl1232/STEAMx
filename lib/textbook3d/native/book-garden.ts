import * as THREE from "three"
import { createBookModel, turningPaperPoint } from "./book-model"
import { createPopupRig } from "./popup-rig"
import { createPlantModels } from "./plant-models"
import type { BookPose } from "./book-motion"
import type { SceneItemId } from "./native-lessons"
import { bookCornerCorners } from "./book-page-layout"
import type { BookLayout } from "./book-page-layout"

export const BOOK_PLANT_ANCHORS: Record<SceneItemId, [number, number, number]> = {
  tree: [1.65, 0.16, -0.62], grass: [0.88, 0.16, 1.12], flower: [2.73, 0.16, 0.68],
  leaf: [.9, .16, -.7], stem: [2.55, .16, -.75],
}
const sizes = { tree: 0.78, grass: 0.62, flower: 0.67, leaf: .75, stem: .75 }

/** Shared by the actual WebGL scene and the explicitly labelled CPU geometry preview. */
export type BookModels = { models: Record<string, THREE.Group>; dispose: () => void }
export function createBookGarden(plants: BookModels = createPlantModels()) {
  const book = createBookModel()
  const ids = Object.keys(plants.models) as SceneItemId[]
  const root = new THREE.Group()
  root.name = "book-and-popups"
  root.add(book.root)
  // Tiny vertex-alpha contact patches soften the roots' contact with the paper.
  // These supplement the existing directional shadows; no texture or extra pass.
  const contactShape = new THREE.CircleGeometry(1, 24)
  contactShape.rotateX(-Math.PI / 2)
  const contactColors: number[] = []
  for (let i = 0; i < contactShape.attributes.position.count; i++) contactColors.push(0.24, 0.26, 0.19, i === 0 ? 0.22 : 0)
  contactShape.setAttribute("color", new THREE.Float32BufferAttribute(contactColors, 4))
  const contactMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })
  const rigs: Array<ReturnType<typeof createPopupRig>> = []
  const folds = Object.fromEntries(ids.map((id) => {
    const plant = plants.models[id]
    plant.name = `plant-${id}`
    plant.userData.plantId = id
    plant.scale.setScalar(sizes[id])
    const rig = createPopupRig(plant)
    rigs.push(rig)
    const hinge = rig.root
    hinge.name = `${id}-paper-hinge`
    hinge.position.fromArray(BOOK_PLANT_ANCHORS[id])
    const contact = new THREE.Mesh(contactShape, contactMaterial)
    contact.name = `${id}-contact-shadow`
    contact.position.y = 0.018
    contact.scale.setScalar(id === "tree" ? 0.55 : 0.42)
    hinge.add(contact)
    root.add(hinge)
    return [id, hinge]
  })) as Record<SceneItemId, THREE.Group>
  const ringShape = new THREE.RingGeometry(.48, .53, 48)
  ringShape.rotateX(-Math.PI / 2)
  const ringMaterial = new THREE.MeshBasicMaterial({ color: "#5b815a", transparent: true, opacity: .8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
  const selectionRing = new THREE.Mesh(ringShape, ringMaterial)
  selectionRing.name = "selected-plant-ring"
  root.add(selectionRing)
  let selected: SceneItemId = ids[0]
  const placeRing = () => {
    selectionRing.position.copy(folds[selected].position)
    selectionRing.position.y = .19
    selectionRing.userData.plantId = selected
  }
  const setSelected = (id: SceneItemId) => {
    if (!ids.includes(id)) return
    selected = id
    placeRing()
  }
  setSelected(selected)
  let disposed = false
  return {
    root, paper: book.root, plants: plants.models,
    setSelected,
    setLayout(layout: BookLayout) {
      root.rotation.y = layout === "portrait" ? Math.PI / 2 : 0
      // Reflow the sheets, never stretch the approved plant meshes.
      const x = layout === "portrait" ? 1.25 : layout === "landscape" ? 1.1 : 1
      const z = 1
      book.root.scale.set(x, 1, z)
      for (const id of ids) {
        const [px, py, pz] = BOOK_PLANT_ANCHORS[id]
        folds[id].position.set(px * x, py, pz * z)
      }
      placeRing()
      root.updateMatrixWorld(true)
    },
    setPose(pose: BookPose) {
      book.setPose(pose)
      selectionRing.visible = pose.fold === 1 && !pose.turning
      for (const rig of rigs) {
        rig.setFold(pose.fold)
        // Once flat, the turning sheet covers the old popup.
        rig.root.visible = !pose.turning
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      root.removeFromParent()
      book.dispose()
      rigs.forEach(rig => rig.dispose())
      plants.dispose()
      contactShape.dispose()
      contactMaterial.dispose()
      ringShape.dispose()
      ringMaterial.dispose()
    },
  }
}

export function lightBookScene(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight("#fff8ec", "#788779", 1.35))
  const key = new THREE.DirectionalLight("#fff1d7", 2.4)
  key.position.set(-5, 9, 2)
  key.castShadow = true
  key.shadow.mapSize.set(512, 512)
  Object.assign(key.shadow.camera, { left: -5.5, right: 5.5, top: 5, bottom: -4, near: 0.5, far: 20 })
  key.shadow.normalBias = 0.025
  key.shadow.bias = -0.00015
  key.shadow.radius = 3
  scene.add(key)
  const fill = new THREE.DirectionalLight("#e6f1eb", 0.6)
  fill.position.set(4, 3, -3)
  scene.add(fill)
  const groundShape = new THREE.PlaneGeometry(200, 200)
  const groundMaterial = new THREE.MeshStandardMaterial({ color: "#e5ddca", roughness: 1 })
  const ground = new THREE.Mesh(groundShape, groundMaterial)
  ground.name = "reading-desk"
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.29
  ground.receiveShadow = true
  scene.add(ground)
  return () => { key.shadow.dispose(); groundShape.dispose(); groundMaterial.dispose() }
}

export function fitBookCamera(camera: THREE.PerspectiveCamera, book?: THREE.Object3D, layout: BookLayout = "spread") {
  // A longer focal length avoids a close crown forcing the phone's paper tiny.
  camera.fov = layout === "spread" ? 24 : layout === "landscape" ? 6 : 12
  camera.updateProjectionMatrix()
  const center = new THREE.Vector3(0, 0.5, 0.12)
  const halfVertical = THREE.MathUtils.degToRad(camera.fov / 2)
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect)
  const angle = layout === "landscape" ? 0.08 : 0.38
  const direction = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle))
  const up = new THREE.Vector3(0, direction.z, -direction.y)
  // Fit the book and the raised plants, including their depth toward the lens.
  // Using only the flat page dimensions cuts off the crown in a close view.
  let distance = 0
  const points: THREE.Vector3[] = []
  if (book) {
    book.updateMatrixWorld(true)
    const paper = book.getObjectByName("botanical-pop-up-book")
    if (paper) for (const previous of [true, false]) for (const corner of bookCornerCorners(layout, previous)) points.push(new THREE.Vector3().fromArray(corner).applyMatrix4(paper.matrixWorld))
    if (paper) {
      for (let step = 0; step <= 24; step++) {
        const angle = step / 24 * Math.PI
        for (let strip = 0; strip <= 24; strip++) for (const z of [-2.23, 2.23]) {
          const p = turningPaperPoint(3.61 * strip / 24, z, angle)
          p.y += .2
          points.push(p.applyMatrix4(paper.matrixWorld))
        }
      }
    }
    book.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.computeBoundingBox()
      const bounds = object.geometry.boundingBox!
      const instance = new THREE.Matrix4()
      for (let i = 0; i < (object instanceof THREE.InstancedMesh ? object.count : 1); i++) {
        if (object instanceof THREE.InstancedMesh) object.getMatrixAt(i, instance)
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          points.push(new THREE.Vector3(x, y, z).applyMatrix4(instance).applyMatrix4(object.matrixWorld))
        }
      }
    })
  } else for (const [min, max] of [
    [[-3.8, -0.3, -2.4], [3.8, 0.2, 2.9]],
    [[0.3, 0.15, -1.7], [3.05, 3.4, 0.7]],
    [[0.05, 0.15, 0.2], [3.7, 1.9, 1.95]],
  ]) {
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      points.push(new THREE.Vector3(x, y, z))
    }
  }
  // Solve the perspective frustum support intervals, including each point's
  // depth. A raw 3D bounding-box center wastes space around raised foliage.
  const tanH = Math.tan(halfHorizontal), tanV = Math.tan(halfVertical)
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity
  for (const point of points) {
    const relative = point.clone().sub(center)
    const depth = relative.dot(direction), vertical = relative.dot(up)
    left = Math.min(left, relative.x - depth * tanH)
    right = Math.max(right, relative.x + depth * tanH)
    bottom = Math.min(bottom, vertical - depth * tanV)
    top = Math.max(top, vertical + depth * tanV)
  }
  center.x += (left + right) / 2
  center.addScaledVector(up, (bottom + top) / 2)
  distance = Math.max((right - left) / (2 * tanH), (top - bottom) / (2 * tanV)) * 1.015
  camera.far = Math.max(100, distance * 2)
  camera.updateProjectionMatrix()
  camera.position.copy(direction).multiplyScalar(distance).add(center)
  camera.lookAt(center)
  camera.updateMatrixWorld()
  return { center, distance }
}
