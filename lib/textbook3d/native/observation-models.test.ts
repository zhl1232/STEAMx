import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createObservationModels } from "./observation-models"
import { OBSERVATION_IDS } from "./observation-plants"

describe("native observation specimens", () => {
  it("fits independently folding samples inside the book's geometry budget", () => {
    const asset = createObservationModels()
    const budgets = Object.fromEntries(OBSERVATION_IDS.map((id) => {
      const model = asset.models[id]
      let meshes = 0, triangles = 0
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        meshes++
        const count = object.geometry.index?.count ?? object.geometry.attributes.position.count
        triangles += count / 3 * (object instanceof THREE.InstancedMesh ? object.count : 1)
        expect(Array.from(object.geometry.attributes.position.array).every(Number.isFinite)).toBe(true)
      })
      const bounds = new THREE.Box3().setFromObject(model)
      const size = bounds.getSize(new THREE.Vector3())
      expect(model.position.toArray()).toEqual([0, 0, 0])
      expect(bounds.min.y).toBeCloseTo(0, 6)
      expect(bounds.max.y).toBeLessThanOrEqual(2.4)
      expect(size.x).toBeLessThanOrEqual(1.4)
      expect(size.y).toBeGreaterThan(1.5)
      expect(meshes).toBeLessThanOrEqual(24)
      expect(triangles).toBeLessThanOrEqual(5_000)
      return [id, { meshes, triangles, size: size.toArray().map((value) => +value.toFixed(3)) }]
    }))
    expect(asset.resources.geometries.size).toBeLessThanOrEqual(40)
    expect(asset.resources.materials.size).toBeLessThanOrEqual(8)
    console.info("Observation source budgets (no GPU measurement):", JSON.stringify(budgets))
    asset.dispose()
  })

  it("models the discoveries as visible geometry: veins, connected roots and stem, petals and center", () => {
    const asset = createObservationModels()
    const { leaf, stem, flower } = asset.models
    expect(leaf.getObjectByName("leaf-midrib")).toBeInstanceOf(THREE.Mesh)
    expect(leaf.getObjectByName("leaf-side-vein-5-1")).toBeInstanceOf(THREE.Mesh)
    const blade = leaf.getObjectByName("leaf-blade") as THREE.Mesh
    blade.geometry.computeBoundingBox()
    expect(blade.geometry.boundingBox!.getSize(new THREE.Vector3()).z).toBeGreaterThan(0.1)
    expect(stem.getObjectByName("stem-main")).toBeInstanceOf(THREE.Mesh)
    expect(stem.getObjectByName("stem-root-4")).toBeInstanceOf(THREE.Mesh)
    expect(stem.getObjectByName("stem-node-2")).toBeInstanceOf(THREE.Mesh)
    expect(stem.getObjectByName("stem-leaf-left-blade")).toBeInstanceOf(THREE.Mesh)
    const petals = flower.getObjectByName("flower-petals") as THREE.InstancedMesh
    expect(petals.count).toBe(10)
    expect(flower.getObjectByName("flower-center")).toBeInstanceOf(THREE.Mesh)
    expect(flower.getObjectByName("flower-head")?.children).toHaveLength(3)
    asset.dispose()
  })

  it("owns its resources, detaches all specimens, and disposes shared resources and instances once", () => {
    const first = createObservationModels(), second = createObservationModels()
    const resources = [...first.resources.geometries, ...first.resources.materials]
    const disposed = resources.map((resource) => {
      const callback = vi.fn()
      resource.addEventListener("dispose", callback)
      return callback
    })
    const instances: THREE.InstancedMesh[] = []
    const scene = new THREE.Group()
    Object.values(first.models).forEach((model) => {
      scene.add(model)
      model.traverse((object) => { if (object instanceof THREE.InstancedMesh) instances.push(object) })
    })
    const instanceDisposals = instances.map((object) => vi.spyOn(object, "dispose"))
    expect([...second.resources.geometries].some((value) => first.resources.geometries.has(value))).toBe(false)
    expect([...second.resources.materials].some((value) => first.resources.materials.has(value))).toBe(false)
    first.dispose()
    first.dispose()
    disposed.forEach((callback) => expect(callback).toHaveBeenCalledOnce())
    instanceDisposals.forEach((callback) => expect(callback).toHaveBeenCalledOnce())
    expect(scene.children).toHaveLength(0)
    second.dispose()
  })
})
