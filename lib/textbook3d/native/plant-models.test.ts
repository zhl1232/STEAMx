import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createPlantModels } from "./plant-models"
import { PLANT_IDS, plantPixelRatio } from "./plants"

describe("native plant model budget", () => {
  it("keeps each observation below the mobile geometry and draw-call budget", () => {
    const asset = createPlantModels()
    const budgets = Object.fromEntries(PLANT_IDS.map((id) => {
      let meshes = 0
      let triangles = 0
      asset.models[id].traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        meshes += 1
        const count = object.geometry.index?.count ?? object.geometry.attributes.position.count
        triangles += count / 3 * (object instanceof THREE.InstancedMesh ? object.count : 1)
      })
      expect(meshes).toBeLessThanOrEqual(45)
      expect(triangles).toBeLessThanOrEqual(16_000)
      const bounds = new THREE.Box3().setFromObject(asset.models[id])
      expect(bounds.isEmpty()).toBe(false)
      expect(bounds.max.toArray().every(Number.isFinite)).toBe(true)
      return [id, { meshes, triangles }]
    }))
    expect(asset.resources.geometries.size).toBeLessThanOrEqual(24)
    expect(asset.resources.materials.size).toBeLessThanOrEqual(16)
    console.info("Plant source budgets (no GPU measurement):", JSON.stringify(budgets), "geometries", asset.resources.geometries.size, "materials", asset.resources.materials.size)
    asset.dispose()
  })

  it("owns independent resources and disposes shared-in-instance geometry exactly once", () => {
    const first = createPlantModels()
    const second = createPlantModels()
    const resources = [...first.resources.geometries, ...first.resources.materials]
    const disposed = resources.map((resource) => {
      const callback = vi.fn()
      resource.addEventListener("dispose", callback)
      return callback
    })
    expect([...second.resources.geometries].some((value) => first.resources.geometries.has(value))).toBe(false)
    first.dispose()
    first.dispose()
    disposed.forEach((callback) => expect(callback).toHaveBeenCalledOnce())
    second.dispose()
  })

  it("caps high-DPR and fullscreen pixel allocation", () => {
    for (const [width, height, dpr] of [[390, 300, 3], [844, 260, 3], [1440, 900, 2], [3840, 2160, 2]]) {
      const ratio = plantPixelRatio(width, height, dpr)
      expect(ratio).toBeLessThanOrEqual(1.5)
      expect(width * height * ratio ** 2).toBeLessThanOrEqual(1_500_001)
    }
  })
})
