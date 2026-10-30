import * as THREE from "three"
import { createBookModel } from "./book-model"
import { createPlantModels } from "./plant-models"
import type { BookPose } from "./book-motion"
import { PLANT_IDS, type PlantId } from "./plants"

export const BOOK_PLANT_ANCHORS: Record<PlantId, [number, number, number]> = {
  tree: [1.45, 0.16, -0.72], grass: [0.84, 0.16, 1.18], flower: [2.66, 0.16, 0.96],
}
const sizes = { tree: 0.68, grass: 0.52, flower: 0.58 }

/** Shared by the actual WebGL scene and the explicitly labelled CPU geometry preview. */
export function createBookGarden() {
  const book = createBookModel()
  const plants = createPlantModels()
  const root = new THREE.Group()
  root.name = "book-and-popups"
  root.add(book.root)
  const folds = Object.fromEntries(PLANT_IDS.map((id) => {
    const hinge = new THREE.Group()
    hinge.name = `${id}-paper-hinge`
    hinge.position.fromArray(BOOK_PLANT_ANCHORS[id])
    const plant = plants.models[id]
    plant.name = `plant-${id}`
    plant.userData.plantId = id
    plant.scale.setScalar(sizes[id])
    hinge.add(plant)
    root.add(hinge)
    return [id, hinge]
  })) as Record<PlantId, THREE.Group>
  const markerShape = new THREE.RingGeometry(0.48, 0.50, 40)
  const markerMaterial = new THREE.MeshBasicMaterial({ color: "#a56c39", side: THREE.DoubleSide })
  const marker = new THREE.Mesh(markerShape, markerMaterial)
  marker.name = "selected-plant-on-paper"
  marker.rotation.x = -Math.PI / 2
  root.add(marker)
  let selected: PlantId = "tree"
  let folded = false
  const setSelected = (id: PlantId) => {
    selected = id
    for (const plantId of PLANT_IDS) plants.models[plantId].scale.setScalar(sizes[plantId] * (plantId === id ? 1.06 : 1))
    marker.position.fromArray(BOOK_PLANT_ANCHORS[id])
    marker.position.y = 0.145
    marker.scale.setScalar(id === "tree" ? 1.65 : 1.4)
  }
  setSelected(selected)
  let disposed = false
  return {
    root, plants: plants.models,
    setSelected,
    setPose(pose: BookPose) {
      book.setPose(pose)
      folded = pose.fold < 0.02
      marker.visible = !pose.turning && !folded
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
      markerShape.dispose()
      markerMaterial.dispose()
    },
  }
}

export function lightBookScene(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight("#fff7e5", "#98a58d", 2.4))
  const key = new THREE.DirectionalLight("#fff0d5", 3)
  key.position.set(-3, 8, 4)
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
  const groundMaterial = new THREE.MeshStandardMaterial({ color: "#e1dac8", roughness: 1 })
  const ground = new THREE.Mesh(groundShape, groundMaterial)
  ground.name = "reading-desk"
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.29
  ground.receiveShadow = true
  scene.add(ground)
  return () => { key.shadow.dispose(); groundShape.dispose(); groundMaterial.dispose() }
}

export const bookTurnCameraScale = (angle: number) => 1 + Math.sin(angle) * 0.38

export function fitBookCamera(camera: THREE.PerspectiveCamera) {
  const center = new THREE.Vector3(0, 0.85, 0.05)
  const halfVertical = THREE.MathUtils.degToRad(camera.fov / 2)
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect)
  // A stable book-sized frame; changing the observed plant never replaces it
  // with a model close-up. Reserve space for the turning leaf's high point.
  const distance = Math.max(4.15 / Math.sin(halfHorizontal), 3.25 / Math.sin(halfVertical))
  camera.position.set(1.2, 7.8, 8.8).normalize().multiplyScalar(distance).add(center)
  camera.lookAt(center)
  camera.updateMatrixWorld()
  return { center, distance }
}
