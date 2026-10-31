import * as THREE from "three"
import { createBookModel } from "./book-model"
import { createPlantModels } from "./plant-models"
import type { BookPose } from "./book-motion"
import { PLANT_IDS, type PlantId } from "./plants"
import type { BookLayout } from "./book-page-layout"

export const BOOK_PLANT_ANCHORS: Record<PlantId, [number, number, number]> = {
  tree: [1.65, 0.16, -0.62], grass: [0.88, 0.16, 1.12], flower: [2.73, 0.16, 0.92],
}
const sizes = { tree: 0.78, grass: 0.62, flower: 0.67 }

/** Shared by the actual WebGL scene and the explicitly labelled CPU geometry preview. */
export function createBookGarden() {
  const book = createBookModel()
  const plants = createPlantModels()
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
  const folds = Object.fromEntries(PLANT_IDS.map((id) => {
    const hinge = new THREE.Group()
    hinge.name = `${id}-paper-hinge`
    hinge.position.fromArray(BOOK_PLANT_ANCHORS[id])
    const plant = plants.models[id]
    plant.name = `plant-${id}`
    plant.userData.plantId = id
    plant.scale.setScalar(sizes[id])
    hinge.add(plant)
    const contact = new THREE.Mesh(contactShape, contactMaterial)
    contact.name = `${id}-contact-shadow`
    contact.position.y = 0.018
    contact.scale.setScalar(id === "tree" ? 0.55 : 0.42)
    hinge.add(contact)
    root.add(hinge)
    return [id, hinge]
  })) as Record<PlantId, THREE.Group>
  let selected: PlantId = "tree"
  let folded = false
  const setSelected = (id: PlantId) => {
    selected = id
    for (const plantId of PLANT_IDS) plants.models[plantId].scale.setScalar(sizes[plantId] * (plantId === id ? 1.06 : 1))
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
      for (const id of PLANT_IDS) {
        const [px, py, pz] = BOOK_PLANT_ANCHORS[id]
        folds[id].position.set(px * x, py, pz * z)
      }
      root.updateMatrixWorld(true)
    },
    setPose(pose: BookPose) {
      book.setPose(pose)
      folded = pose.fold < 0.02
      for (const id of PLANT_IDS) {
        const hinge = folds[id]
        hinge.visible = !folded
        hinge.scale.y = Math.max(0.015, pose.fold)
        hinge.rotation.x = (1 - pose.fold) * -0.32
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      root.removeFromParent()
      book.dispose()
      plants.dispose()
      contactShape.dispose()
      contactMaterial.dispose()
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

export const bookTurnCameraScale = (angle: number) => 1 + Math.sin(angle) * 0.55

export function fitBookCamera(camera: THREE.PerspectiveCamera, book?: THREE.Object3D, layout: BookLayout = "spread") {
  // A longer focal length avoids a close crown forcing the phone's paper tiny.
  camera.fov = layout === "spread" ? 38 : 16
  camera.updateProjectionMatrix()
  const center = new THREE.Vector3(0, 0.5, 0.12)
  const halfVertical = THREE.MathUtils.degToRad(camera.fov / 2)
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect)
  const angle = layout === "landscape" ? 0.24 : 0.38
  const direction = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle))
  const up = new THREE.Vector3(0, direction.z, -direction.y)
  // Fit the book and the raised plants, including their depth toward the lens.
  // Using only the flat page dimensions cuts off the crown in a close view.
  let distance = 0
  const points: THREE.Vector3[] = []
  if (book) {
    book.updateMatrixWorld(true)
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
  // Center the actual projected bounds, rather than leaving room for an assumed crown.
  if (book) {
    const xs = points.map((p) => p.x - center.x)
    const ys = points.map((p) => p.clone().sub(center).dot(up))
    center.x += (Math.min(...xs) + Math.max(...xs)) / 2
    center.addScaledVector(up, (Math.min(...ys) + Math.max(...ys)) / 2)
  }
  for (const point of points) {
    const relative = point.clone().sub(center)
    distance = Math.max(distance, relative.dot(direction) + Math.max(Math.abs(relative.x) / Math.tan(halfHorizontal), Math.abs(relative.dot(up)) / Math.tan(halfVertical)))
  }
  distance *= 1.025
  camera.position.copy(direction).multiplyScalar(distance).add(center)
  camera.lookAt(center)
  camera.updateMatrixWorld()
  return { center, distance }
}
