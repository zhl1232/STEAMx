import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createBookGarden, fitBookCamera } from "./book-garden"
import { PLANT_IDS } from "./plants"
import { bookLayoutFor } from "./book-page-layout"
import { createObservationModels } from "./observation-models"

describe("physical book garden", () => {
  it("uses the reference frame's height and width, with complete visible paper rather than a low small platform", () => {
    const garden = createBookGarden()
    for (const [width, height] of [[1776, 900], [844, 390], [390, 844]]) {
      const layout = bookLayoutFor(width, height)
      garden.setLayout(layout)
      garden.setPose({ page: 0, fold: 1, leafAngle: 0, turning: false })
      const camera = new THREE.PerspectiveCamera(38, width / height, .1, 100)
      fitBookCamera(camera, garden.root, layout)
      const bounds = new THREE.Box2()
      garden.paper.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return
        const positions = object.geometry.attributes.position
        for (let i = 0; i < positions.count; i++) {
          const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera)
          bounds.expandByPoint(new THREE.Vector2((p.x + 1) / 2, (1 - p.y) / 2))
        }
      })
      expect(bounds.min.x).toBeGreaterThan(0); expect(bounds.max.x).toBeLessThan(1)
      expect(bounds.min.y).toBeGreaterThan(0); expect(bounds.max.y).toBeLessThan(1)
      expect(bounds.min.y).toBeLessThan(.1)
      const extent = bounds.getSize(new THREE.Vector2())
      expect(extent.x).toBeGreaterThan(.85)
      expect(extent.y).toBeGreaterThan(layout === "portrait" ? .84 : .9)
    }
    garden.dispose()
  })

  it("places all plants on dimensional pages and folds them clear of the turning leaf", () => {
    const garden = createBookGarden()
    garden.setPose({ page: 0, fold: 1, leafAngle: 0, turning: false })
    for (const name of ["spine", "hard-cover", "page-stack", "open-paper"]) {
      const object = garden.root.getObjectByName(name)!
      const dimensions = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())
      expect(dimensions.y).toBeGreaterThan(0.01)
    }
    for (const id of PLANT_IDS) expect(garden.root.getObjectByName(`${id}-paper-hinge`)).toBeDefined()
    garden.setPose({ page: 1, fold: 0, leafAngle: Math.PI / 2, turning: true })
    expect(PLANT_IDS.every((id) => !garden.root.getObjectByName(`${id}-paper-hinge`)!.visible)).toBe(true)
    const sheet = garden.root.getObjectByName("hinged-turning-leaf")!
    expect(sheet.visible).toBe(true)
    const curled = new THREE.Box3().setFromObject(sheet)
    expect(curled.max.y - curled.min.y).toBeGreaterThan(.4)
    expect(curled.max.y).toBeLessThan(.7) // A low page curl, not a tall rigid board.
    garden.setPose({ page: 1, fold: 1, leafAngle: 0, turning: false })
    expect(PLANT_IDS.every((id) => garden.root.getObjectByName(`${id}-paper-hinge`)!.visible)).toBe(true)
    expect(sheet.visible).toBe(false)
    garden.dispose()
  })

  it("keeps the complete book within a modest geometry budget and releases owned resources once", () => {
    const garden = createBookGarden()
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    const textures = new Set<THREE.Texture>()
    let triangles = 0
    let meshes = 0
    garden.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      meshes++
      geometries.add(object.geometry)
      ;(Array.isArray(object.material) ? object.material : [object.material]).forEach((item) => {
        materials.add(item)
        if (item instanceof THREE.MeshStandardMaterial) {
          if (item.map) textures.add(item.map)
          if (item.bumpMap) textures.add(item.bumpMap)
        }
      })
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object instanceof THREE.InstancedMesh ? object.count : 1)
    })
    expect(triangles).toBeLessThan(45_000)
    expect(meshes).toBeLessThan(135)
    expect(textures.size).toBeGreaterThan(0)
    expect(textures.size).toBeLessThanOrEqual(2)
    for (const texture of textures) {
      if (!(texture instanceof THREE.DataTexture)) throw new Error("Book textures must be small generated tiles")
      expect(texture.image.width * texture.image.height).toBeLessThanOrEqual(64 * 64)
    }
    const disposed = [...geometries, ...materials, ...textures].map((item) => {
      const callback = vi.fn(); item.addEventListener("dispose", callback); return callback
    })
    garden.dispose(); garden.dispose()
    disposed.forEach((callback) => expect(callback).toHaveBeenCalledOnce())
    console.info("Book source budget (not GPU passes):", { triangles, meshes, geometries: geometries.size, materials: materials.size, textures: textures.size })
  })

  it("keeps the rising paper inside the default portrait, landscape and desktop frame", () => {
    const garden = createBookGarden()
    const sheet = garden.root.getObjectByName("hinged-turning-leaf")!
    for (const [width, height] of [[390, 690], [844, 250], [1440, 760]]) {
      const layout = bookLayoutFor(width, height)
      garden.setLayout(layout)
      garden.setPose({ page: 0, fold: 1, leafAngle: 0, turning: false })
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
      const fit = fitBookCamera(camera, garden.root, layout)
      const initialPosition = camera.position.clone()
      for (const angle of [Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.75]) {
        garden.setPose({ page: 1, fold: 0, leafAngle: angle, turning: true })
        expect(camera.position.equals(initialPosition)).toBe(true)
        camera.lookAt(fit.center)
        camera.updateMatrixWorld()
        garden.root.updateMatrixWorld(true)
        const mesh = sheet.children[0] as THREE.Mesh
        const positions = mesh.geometry.attributes.position
        for (let i = 0; i < positions.count; i++) {
          const projected = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(camera)
          expect(Math.abs(projected.x)).toBeLessThan(1)
          expect(Math.abs(projected.y)).toBeLessThan(1)
        }
      }
    }
    garden.dispose()
  })

  it("fits the raised plants as well as the flat book into the default view", () => {
    const garden = createBookGarden()
    garden.setPose({ page: 0, fold: 1, leafAngle: 0, turning: false })
    for (const [width, height] of [[390, 690], [844, 240], [1200, 760]]) {
      const layout = bookLayoutFor(width, height)
      garden.setLayout(layout)
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
      fitBookCamera(camera, garden.root, layout)
      garden.root.updateMatrixWorld(true)
      garden.root.traverseVisible((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const positions = object.geometry.getAttribute("position")
        const instance = new THREE.Matrix4()
        for (let index = 0; index < (object instanceof THREE.InstancedMesh ? object.count : 1); index++) {
          if (object instanceof THREE.InstancedMesh) object.getMatrixAt(index, instance)
          for (let vertex = 0; vertex < positions.count; vertex++) {
            const p = new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(instance).applyMatrix4(object.matrixWorld).project(camera)
            expect(Math.abs(p.x)).toBeLessThan(1)
            expect(Math.abs(p.y)).toBeLessThan(1)
          }
        }
      })
    }
    garden.dispose()
  })

  it("folds both lessons within their paper and leaves model scale and selection exclusive", () => {
    for (const make of [undefined, createObservationModels]) {
      const garden = createBookGarden(make?.())
      const scales = Object.values(garden.plants).map(model => model.scale.clone())
      for (const id of Object.keys(garden.plants)) {
        garden.setSelected(id as Parameters<typeof garden.setSelected>[0])
        const rings = garden.root.getObjectsByProperty("name", "selected-plant-ring")
        expect(rings).toHaveLength(1)
        expect(rings[0].userData.plantId).toBe(id)
      }
      garden.setPose({ page: 0, fold: 0, leafAngle: 0, turning: false })
      garden.root.updateMatrixWorld(true)
      for (const [index, model] of Object.values(garden.plants).entries()) {
        const bounds = new THREE.Box3().setFromObject(model)
        expect(bounds.min.y).toBeGreaterThanOrEqual(.1599)
        expect(bounds.max.y).toBeLessThan(.18)
        expect(bounds.max.z).toBeLessThan(2.23)
        expect(model.scale.equals(scales[index])).toBe(true)
      }
      expect(garden.root.getObjectByName("selected-plant-ring")!.visible).toBe(false)
      garden.setPose({ page: 1, fold: 1, leafAngle: 0, turning: false })
      expect(garden.root.getObjectByName("selected-plant-ring")!.visible).toBe(true)
      garden.dispose()
    }
  })

})
