import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { bookTurnCameraScale, createBookGarden, fitBookCamera } from "./book-garden"
import { PLANT_IDS } from "./plants"

describe("physical book garden", () => {
  it("places all plants on dimensional pages and folds them clear of the turning leaf", () => {
    const garden = createBookGarden()
    garden.setPose({ page: 0, fold: 1, leafAngle: 0, turning: false })
    for (const name of ["spine", "hard-cover", "page-stack", "open-paper"]) {
      const object = garden.root.getObjectByName(name)!
      const dimensions = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())
      expect(dimensions.y).toBeGreaterThan(0.01)
    }
    for (const id of PLANT_IDS) expect(garden.plants[id].parent?.parent).toBe(garden.root)
    garden.setPose({ page: 1, fold: 0, leafAngle: Math.PI / 2, turning: true })
    expect(PLANT_IDS.every((id) => !garden.plants[id].parent!.visible)).toBe(true)
    const sheet = garden.root.getObjectByName("hinged-turning-leaf")!
    expect(sheet.visible).toBe(true)
    expect(new THREE.Box3().setFromObject(sheet).max.y).toBeGreaterThan(3)
    garden.setPose({ page: 1, fold: 1, leafAngle: 0, turning: false })
    expect(PLANT_IDS.every((id) => garden.plants[id].parent!.visible)).toBe(true)
    expect(sheet.visible).toBe(false)
    garden.dispose()
  })

  it("keeps the complete book within a modest geometry budget and releases owned resources once", () => {
    const garden = createBookGarden()
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    let triangles = 0
    let meshes = 0
    garden.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      meshes++
      geometries.add(object.geometry)
      ;(Array.isArray(object.material) ? object.material : [object.material]).forEach((item) => materials.add(item))
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object instanceof THREE.InstancedMesh ? object.count : 1)
    })
    expect(triangles).toBeLessThan(45_000)
    expect(meshes).toBeLessThan(135)
    const disposed = [...geometries, ...materials].map((item) => {
      const callback = vi.fn(); item.addEventListener("dispose", callback); return callback
    })
    garden.dispose(); garden.dispose()
    disposed.forEach((callback) => expect(callback).toHaveBeenCalledOnce())
    console.info("Book source budget (not GPU passes):", { triangles, meshes, geometries: geometries.size, materials: materials.size })
  })

  it("keeps the rising paper inside the default portrait, landscape and desktop frame", () => {
    const garden = createBookGarden()
    const sheet = garden.root.getObjectByName("hinged-turning-leaf")!
    for (const [width, height] of [[390, 300], [844, 250], [1440, 500]]) {
      for (const angle of [Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.75]) {
        garden.setPose({ page: 1, fold: 0, leafAngle: angle, turning: true })
        const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
        const fit = fitBookCamera(camera)
        camera.position.sub(fit.center).multiplyScalar(bookTurnCameraScale(angle)).add(fit.center)
        camera.lookAt(fit.center)
        camera.updateMatrixWorld()
        const bounds = new THREE.Box3().setFromObject(sheet)
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const projected = new THREE.Vector3(x, y, z).project(camera)
          expect(Math.abs(projected.x)).toBeLessThan(1)
          expect(Math.abs(projected.y)).toBeLessThan(1)
        }
      }
    }
    garden.dispose()
  })

})
