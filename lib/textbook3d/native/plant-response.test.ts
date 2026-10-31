import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createPlantResponse, PLANT_RESPONSE_MS } from "./plant-response"
import { createPlantModels } from "./plant-models"
import { createObservationModels } from "./observation-models"
import { getSceneLabels } from "./scene-labels"

function assets() {
  const plants = createPlantModels(), observations = createObservationModels()
  return {
    models: { ...plants.models, leaf: observations.models.leaf, stem: observations.models.stem, observationFlower: observations.models.flower },
    resources: [...plants.resources.geometries, ...plants.resources.materials, ...observations.resources.geometries, ...observations.resources.materials],
    dispose() { plants.dispose(); observations.dispose() },
  }
}

function localPoint(model: THREE.Group, mesh: THREE.Mesh, vertex: number, instance?: number) {
  model.updateWorldMatrix(true, true)
  const point = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, vertex)
  if (instance !== undefined) {
    const matrix = new THREE.Matrix4()
    ;(mesh as THREE.InstancedMesh).getMatrixAt(instance, matrix)
    point.applyMatrix4(matrix)
  }
  return point.applyMatrix4(mesh.matrixWorld).applyMatrix4(model.matrixWorld.clone().invert())
}

function extremes(model: THREE.Group) {
  let bottom: { mesh: THREE.Mesh; vertex: number; instance?: number; point: THREE.Vector3 } | undefined
  let top: typeof bottom
  model.updateWorldMatrix(true, true)
  const inverse = model.matrixWorld.clone().invert(), transform = new THREE.Matrix4(), instanceMatrix = new THREE.Matrix4(), point = new THREE.Vector3()
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const positions = object.geometry.attributes.position
    const count = object instanceof THREE.InstancedMesh ? object.count : 1
    for (let instance = 0; instance < count; instance++) {
      transform.multiplyMatrices(inverse, object.matrixWorld)
      if (object instanceof THREE.InstancedMesh) { object.getMatrixAt(instance, instanceMatrix); transform.multiply(instanceMatrix) }
      for (let vertex = 0; vertex < positions.count; vertex++) {
        point.fromBufferAttribute(positions, vertex).applyMatrix4(transform)
        const sample = () => ({ mesh: object, vertex, instance: object instanceof THREE.InstancedMesh ? instance : undefined, point: point.clone() })
        if (!bottom || point.y < bottom.point.y) bottom = sample()
        if (!top || point.y > top.point.y) top = sample()
      }
    }
  })
  return { bottom: bottom!, top: top! }
}

function snapshot(model: THREE.Group) {
  const entries: Array<{
    mesh: THREE.Mesh; geometry: THREE.BufferGeometry; positions: number[]; normals: number[]
    instance?: number[]; instanceBox?: THREE.Box3 | null; instanceSphere?: THREE.Sphere | null
    material: THREE.Material | THREE.Material[]
  }> = []
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) entries.push({
      mesh: object, geometry: object.geometry, positions: Array.from(object.geometry.attributes.position.array), material: object.material,
      normals: Array.from(object.geometry.attributes.normal.array),
      instance: object instanceof THREE.InstancedMesh ? Array.from(object.instanceMatrix.array) : undefined,
      instanceBox: object instanceof THREE.InstancedMesh ? object.boundingBox : undefined,
      instanceSphere: object instanceof THREE.InstancedMesh ? object.boundingSphere : undefined,
    })
  })
  return entries
}

function expectRest(entries: ReturnType<typeof snapshot>) {
  entries.forEach((entry) => {
    expect(entry.mesh.geometry).toBe(entry.geometry)
    expect(entry.mesh.material).toBe(entry.material)
    expect(Array.from(entry.geometry.attributes.position.array)).toEqual(entry.positions)
    expect(Array.from(entry.geometry.attributes.normal.array)).toEqual(entry.normals)
    if (entry.instance) {
      const mesh = entry.mesh as THREE.InstancedMesh
      expect(Array.from(mesh.instanceMatrix.array)).toEqual(entry.instance)
      expect(mesh.boundingBox).toBe(entry.instanceBox)
      expect(mesh.boundingSphere).toBe(entry.instanceSphere)
    }
  })
}

describe("finite local plant wind response", () => {
  it("moves the upper geometry of all six real models while keeping their roots and model transforms fixed", () => {
    const asset = assets(), response = createPlantResponse(asset.models)
    for (const [id, model] of Object.entries(asset.models)) {
      const rest = snapshot(model), { bottom, top } = extremes(model)
      const position = model.position.clone(), quaternion = model.quaternion.clone(), scale = model.scale.clone()
      response.play(id, 100)
      expect(response.update(100 + PLANT_RESPONSE_MS * 0.1)).toBe(true)
      expect(localPoint(model, bottom.mesh, bottom.vertex, bottom.instance).distanceTo(bottom.point), id).toBeLessThan(0.000001)
      expect(localPoint(model, top.mesh, top.vertex, top.instance).distanceTo(top.point), id).toBeGreaterThan(0.015)
      expect(model.position.equals(position)).toBe(true)
      expect(model.quaternion.equals(quaternion)).toBe(true)
      expect(model.scale.equals(scale)).toBe(true)
      expect(snapshot(model)).toHaveLength(rest.length)
      expect(response.update(100 + PLANT_RESPONSE_MS)).toBe(false)
      expect(response.active).toBe(false)
      expectRest(rest)
    }
    response.dispose(); asset.dispose()
  })

  it("keeps every grass blade's full bottom vertex row fixed without expanding instances", () => {
    const asset = assets(), model = asset.models.grass
    const blades = model.getObjectByName("curved-grass-blades") as THREE.InstancedMesh
    const rootPoints = Array.from({ length: blades.count }, (_, instance) => [0, 1, 2].map((vertex) => localPoint(model, blades, vertex, instance)))
    const response = createPlantResponse(asset.models)
    response.play("grass", 0); response.update(110)
    for (let instance = 0; instance < blades.count; instance++) for (let vertex = 0; vertex < 3; vertex++) {
      expect(localPoint(model, blades, vertex, instance).distanceTo(rootPoints[instance][vertex])).toBeLessThan(0.000001)
    }
    expect(blades.count).toBe(56)
    expect(model.children).toHaveLength(1)
    response.dispose(); asset.dispose()
  })

  it("has damped direction changes, a strict endpoint, and no lingering work after stop", () => {
    const asset = assets(), response = createPlantResponse(asset.models)
    const anchor = new THREE.Vector3(0, 1.8, 0)
    response.play("stem", 0)
    const offsets = [0.1, 0.3, 0.5, 0.7, 0.9].map((fraction) => {
      response.update(PLANT_RESPONSE_MS * fraction)
      return response.anchor("stem", anchor).x - anchor.x
    })
    expect(offsets.map(Math.sign)).toEqual([1, -1, 1, -1, 1])
    for (let i = 1; i < offsets.length; i++) expect(Math.abs(offsets[i])).toBeLessThan(Math.abs(offsets[i - 1]))
    expect(response.update(PLANT_RESPONSE_MS - 1)).toBe(true)
    expect(response.update(PLANT_RESPONSE_MS)).toBe(false)
    expect(response.anchor("stem", anchor).equals(anchor)).toBe(true)
    expect(response.update(PLANT_RESPONSE_MS + 20)).toBe(false)
    response.play("stem", 2000); response.update(2110); response.stop()
    expect(response.active).toBe(false)
    expect(response.update(2200)).toBe(false)
    response.dispose(); asset.dispose()
  })

  it("restarts from rest on repeated clicks and restores the old specimen before switching", () => {
    const asset = assets(), response = createPlantResponse(asset.models)
    const treeRest = snapshot(asset.models.tree), stemRest = snapshot(asset.models.stem)
    const tip = extremes(asset.models.tree).top
    response.play("tree", 0); response.update(110)
    const first = localPoint(asset.models.tree, tip.mesh, tip.vertex, tip.instance)
    response.play("tree", 50); response.update(160)
    expect(localPoint(asset.models.tree, tip.mesh, tip.vertex, tip.instance).distanceTo(first)).toBeLessThan(1e-7)
    response.play("stem", 300); response.update(410)
    expectRest(treeRest)
    expect(response.anchor("tree", tip.point).equals(tip.point)).toBe(true)
    response.stop()
    expectRest(stemRest)
    response.dispose(); asset.dispose()
  })

  it("isolates shared geometry, reuses first-use clones, and disposes only its own resources", () => {
    const asset = assets(), response = createPlantResponse(asset.models)
    const originals = new Set(asset.resources)
    const borrowedDispose = asset.resources.map((resource) => vi.spyOn(resource, "dispose"))
    const treeRest = snapshot(asset.models.tree), flowerRest = snapshot(asset.models.flower)
    const meshes = flowerRest.map((entry) => entry.mesh)
    const originalInstances = meshes.filter((mesh): mesh is THREE.InstancedMesh => mesh instanceof THREE.InstancedMesh)
    const instanceDispose = originalInstances.map((mesh) => vi.spyOn(mesh, "dispose"))
    response.play("flower", 0); response.update(110)
    const clones = meshes.filter((mesh) => !originals.has(mesh.geometry)).map((mesh) => mesh.geometry)
    expect(clones.length).toBeGreaterThan(0)
    const cloneDispose = clones.map((geometry) => vi.spyOn(geometry, "dispose"))
    expectRest(treeRest)
    response.stop()
    expectRest(flowerRest)
    response.play("flower", 300); response.update(410)
    expect(meshes.filter((mesh) => !originals.has(mesh.geometry)).map((mesh) => mesh.geometry)).toEqual(clones)
    response.dispose(); response.dispose()
    expectRest(flowerRest)
    cloneDispose.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce())
    borrowedDispose.forEach((dispose) => expect(dispose).not.toHaveBeenCalled())
    instanceDispose.forEach((dispose) => expect(dispose).not.toHaveBeenCalled())
    expect(response.play("flower", 600)).toBe(false)
    expect(response.update(710)).toBe(false)
    asset.dispose()
  })

  it("keeps plain-mesh and instanced labels on the actual deformed geometry", () => {
    const asset = assets(), response = createPlantResponse(asset.models)
    const leaf = asset.models.leaf
    const vein = leaf.getObjectByName("leaf-midrib") as THREE.Mesh
    const leafAnchor = new THREE.Vector3(...getSceneLabels("p1a-1-2", "leaf")[0].anchor)
    const input = leafAnchor.clone()
    response.play("leaf", 0); response.update(110)
    expect(response.anchor("leaf", leafAnchor).distanceTo(localPoint(leaf, vein, 42))).toBeLessThan(0.00002)
    expect(leafAnchor.equals(input)).toBe(true)
    response.stop()
    const flower = asset.models.observationFlower
    const petals = flower.getObjectByName("flower-petals") as THREE.InstancedMesh
    const petalPoint = localPoint(flower, petals, 27, 2)
    response.play("observationFlower", 300); response.update(410)
    expect(response.anchor("observationFlower", petalPoint).distanceTo(localPoint(flower, petals, 27, 2))).toBeLessThan(0.000001)
    const grass = asset.models.grass
    const blades = grass.getObjectByName("curved-grass-blades") as THREE.InstancedMesh
    const grassPoint = localPoint(grass, blades, 30, 37)
    response.play("grass", 600); response.update(710)
    expect(response.anchor("grass", grassPoint).distanceTo(localPoint(grass, blades, 30, 37))).toBeLessThan(0.000001)
    response.dispose(); asset.dispose()
  })
})
