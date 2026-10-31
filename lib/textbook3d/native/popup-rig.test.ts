import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createPopupRig } from "./popup-rig"
import { createPlantModels } from "./plant-models"
import { createObservationModels } from "./observation-models"

function fixture() {
  const model = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({ color: "#638541" })
  const trunkShape = new THREE.BoxGeometry(0.2, 2, 0.3)
  const foliageShape = new THREE.SphereGeometry(0.55, 10, 8)
  const trunk = new THREE.Mesh(trunkShape, material)
  trunk.position.y = 1
  const foliage = new THREE.InstancedMesh(foliageShape, material, 2)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 2; i++) {
    dummy.position.set(i ? 0.3 : -0.3, 1.9 + i * 0.1, i ? 0.25 : -0.3)
    dummy.updateMatrix()
    foliage.setMatrixAt(i, dummy.matrix)
  }
  model.add(trunk, foliage)
  model.scale.setScalar(0.8)
  return {
    model, foliage, resources: [trunkShape, foliageShape, material],
    dispose() { foliage.dispose(); trunkShape.dispose(); foliageShape.dispose(); material.dispose() },
  }
}

describe("fixed paper popup hinge", () => {
  it("really rotates halfway without shrinking height or moving the paper anchor", () => {
    const asset = fixture()
    const originalScale = asset.model.scale.clone()
    const rig = createPopupRig(asset.model)
    rig.root.position.set(1.65, 0.16, -0.62)
    const anchor = rig.root.position.clone()
    rig.setFold(0.5)
    const hinge = rig.root.getObjectByName("popup-base-hinge")!
    const depth = rig.root.getObjectByName("popup-local-depth-fold")!
    expect(hinge.rotation.x).toBeGreaterThan(Math.PI / 6)
    expect(hinge.rotation.x).toBeLessThan(Math.PI / 2)
    expect(hinge.position.toArray()).toEqual([0, 0, 0])
    expect(hinge.scale.toArray()).toEqual([1, 1, 1])
    expect(depth.scale.x).toBe(1)
    expect(depth.scale.y).toBe(1)
    expect(asset.model.scale.equals(originalScale)).toBe(true)
    expect(rig.root.position.equals(anchor)).toBe(true)
    const upright = new THREE.Vector3(0, 1, 0).applyQuaternion(hinge.quaternion)
    expect(upright.y).toBeGreaterThan(0)
    expect(upright.z).toBeGreaterThan(0.5)
    expect(new THREE.Box3().setFromObject(rig.root).min.y).toBeGreaterThanOrEqual(anchor.y - 1e-8)
    rig.dispose(); asset.dispose()
  })

  it("lies flat toward positive Z with its silhouette intact and restores the upright model", () => {
    const asset = fixture()
    const originalPosition = asset.model.position.clone()
    const originalRotation = asset.model.quaternion.clone()
    const originalScale = asset.model.scale.clone()
    const rig = createPopupRig(asset.model)
    const open = new THREE.Box3().setFromObject(rig.root)
    const openSize = open.getSize(new THREE.Vector3())
    rig.setFold(0)
    const closed = new THREE.Box3().setFromObject(rig.root)
    const closedSize = closed.getSize(new THREE.Vector3())
    expect(closed.min.y).toBeGreaterThanOrEqual(-1e-8)
    expect(closedSize.y).toBeLessThanOrEqual(0.012 + 1e-8)
    expect(closed.min.z).toBeGreaterThanOrEqual(-1e-8)
    expect(closedSize.z).toBeCloseTo(openSize.y, 6)
    expect(closedSize.x).toBeCloseTo(openSize.x, 6)
    expect(asset.model.visible).toBe(true)
    rig.setFold(1)
    const restored = new THREE.Box3().setFromObject(rig.root)
    expect(restored.min.distanceTo(open.min)).toBeLessThan(1e-8)
    expect(restored.max.distanceTo(open.max)).toBeLessThan(1e-8)
    expect(asset.model.position.equals(originalPosition)).toBe(true)
    expect(asset.model.quaternion.equals(originalRotation)).toBe(true)
    expect(asset.model.scale.equals(originalScale)).toBe(true)
    rig.dispose(); asset.dispose()
  })

  it("keeps all six real specimens above their paper throughout closing and reopening", () => {
    const plants = createPlantModels(), observations = createObservationModels()
    for (const model of [...Object.values(plants.models), ...Object.values(observations.models)]) {
      model.scale.setScalar(0.78)
      const rig = createPopupRig(model)
      const hinge = rig.root.getObjectByName("popup-base-hinge")!
      for (const fold of [1, 0.96, 0.9, 0.85, 0.84, 0.65, 0.5, 0.25, 0.1, 0, 0.1, 0.5, 0.85, 0.96, 1]) {
        rig.setFold(fold)
        const bounds = new THREE.Box3().setFromObject(rig.root)
        expect(bounds.min.y, `${model.name}, fold=${fold}`).toBeGreaterThanOrEqual(-1e-7)
        expect(bounds.max.toArray().every(Number.isFinite)).toBe(true)
        expect(hinge.position.toArray()).toEqual([0, 0, 0])
      }
      rig.dispose()
    }
    plants.dispose(); observations.dispose()
  })

  it("preserves instancing and borrowed resources, restores the old parent, and releases only its own groups", () => {
    const asset = fixture()
    const parent = new THREE.Group()
    const before = new THREE.Group(), after = new THREE.Group()
    parent.position.set(10, 12, 4)
    parent.add(before, asset.model, after)
    const geometry = asset.foliage.geometry, material = asset.foliage.material
    const instances = Array.from(asset.foliage.instanceMatrix.array)
    const positions = Array.from(geometry.attributes.position.array)
    const callbacks = asset.resources.map((resource) => {
      const callback = vi.fn()
      resource.addEventListener("dispose", callback)
      return callback
    })
    const instanceDispose = vi.spyOn(asset.foliage, "dispose")
    const rig = createPopupRig(asset.model)
    // An old parent's world Y must not move the new rig's paper contact.
    expect(new THREE.Box3().setFromObject(rig.root).min.y).toBeCloseTo(0, 6)
    const scene = new THREE.Group()
    scene.add(rig.root)
    rig.setFold(0.5); rig.setFold(0); rig.setFold(1)
    expect(asset.foliage.geometry).toBe(geometry)
    expect(asset.foliage.material).toBe(material)
    expect(Array.from(asset.foliage.instanceMatrix.array)).toEqual(instances)
    expect(Array.from(geometry.attributes.position.array)).toEqual(positions)
    rig.dispose(); rig.dispose(); rig.setFold(0)
    expect(parent.children).toEqual([before, asset.model, after])
    expect(scene.children).toHaveLength(0)
    expect(rig.root.children).toHaveLength(0)
    callbacks.forEach((callback) => expect(callback).not.toHaveBeenCalled())
    expect(instanceDispose).not.toHaveBeenCalled()
    asset.dispose()
    callbacks.forEach((callback) => expect(callback).toHaveBeenCalledOnce())
    expect(instanceDispose).toHaveBeenCalledOnce()
  })

  it("clamps external fold values and does not reclaim a model moved by its owner", () => {
    const asset = fixture()
    const rig = createPopupRig(asset.model)
    const hinge = rig.root.getObjectByName("popup-base-hinge")!
    rig.setFold(-2)
    expect(hinge.rotation.x).toBeCloseTo(Math.PI / 2)
    rig.setFold(2)
    expect(hinge.rotation.x).toBe(0)
    rig.setFold(Number.NaN)
    expect(hinge.rotation.x).toBe(0)
    const nextParent = new THREE.Group()
    nextParent.add(asset.model)
    rig.dispose()
    expect(asset.model.parent).toBe(nextParent)
    asset.dispose()
  })
})
