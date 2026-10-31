import * as THREE from "three"
import { describe, expect, expectTypeOf, it, vi } from "vitest"
import type { NativeLessonId, SceneItemId } from "./native-lessons"
import { createObservationModels } from "./observation-models"
import { getSceneLabels, type SceneLabel } from "./scene-labels"
import { TREE_PARTS } from "./tree-parts"

describe("lesson-specific model labels", () => {
  it("reuses the first tree's labels and keeps the two flower lessons distinct", () => {
    expect(getSceneLabels("p1a-1-1", "tree")).toBe(TREE_PARTS)
    expect(getSceneLabels("p1a-1-1", "grass")).toHaveLength(0)
    expect(getSceneLabels("p1a-1-1", "flower")).toHaveLength(0)
    expect(getSceneLabels("p1a-1-2", "leaf").map((label) => label.name)).toEqual(["叶脉"])
    expect(getSceneLabels("p1a-1-2", "stem").map((label) => label.name)).toEqual(["根", "茎", "叶"])
    expect(getSceneLabels("p1a-1-2", "flower").map((label) => label.name)).toEqual(["花瓣", "花心"])
    expectTypeOf(getSceneLabels("p1a-1-2", "leaf")).toEqualTypeOf<readonly SceneLabel[]>()
  })

  it("returns no fallback labels for an unrelated or unknown specimen or lesson", () => {
    for (const plant of ["tree", "grass"] as const) expect(getSceneLabels("p1a-1-2", plant)).toHaveLength(0)
    for (const plant of ["leaf", "stem"] as const) expect(getSceneLabels("p1a-1-1", plant)).toHaveLength(0)
    expect(getSceneLabels("p1a-1-2", "unknown" as SceneItemId)).toHaveLength(0)
    expect(getSceneLabels("unknown" as NativeLessonId, "flower")).toHaveLength(0)
  })

  it("anchors each observation label to its actual named mesh surface", () => {
    const asset = createObservationModels()
    Object.values(asset.models).forEach((model) => model.updateMatrixWorld(true))
    const fixtures = [
      ["leaf", "vein", "leaf-midrib", 42],
      ["stem", "root", "stem-root-0", 28],
      ["stem", "stem", "stem-main", 56],
      ["stem", "leaf", "stem-leaf-right-blade", 32],
      ["flower", "petal", "flower-petals", 27, 2],
    ] as const
    for (const [plant, labelId, meshName, vertex, instance] of fixtures) {
      const mesh = asset.models[plant].getObjectByName(meshName) as THREE.Mesh
      const expected = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, vertex)
      if (instance !== undefined) {
        expect(mesh).toBeInstanceOf(THREE.InstancedMesh)
        const instanceMatrix = new THREE.Matrix4()
        ;(mesh as THREE.InstancedMesh).getMatrixAt(instance, instanceMatrix)
        expected.applyMatrix4(instanceMatrix)
      }
      expected.applyMatrix4(mesh.matrixWorld)
      const label = getSceneLabels("p1a-1-2", plant).find((entry) => entry.id === labelId)!
      expect(new THREE.Vector3(...label.anchor).distanceTo(expected)).toBeLessThan(0.00001)
    }
    const center = asset.models.flower.getObjectByName("flower-center")!
    const centerSurface = new THREE.Vector3(0, 0, 1).applyMatrix4(center.matrixWorld)
    const centerAnchor = getSceneLabels("p1a-1-2", "flower").find((label) => label.id === "center")!.anchor
    expect(new THREE.Vector3(...centerAnchor).distanceTo(centerSurface)).toBeLessThan(0.00001)
    asset.dispose()
  })

  it("returns stable readonly data without changing model resources or the shared tree labels", () => {
    const asset = createObservationModels()
    const treeBefore = JSON.stringify(TREE_PARTS)
    const leafBefore = JSON.stringify(getSceneLabels("p1a-1-2", "leaf"))
    const resources = [...asset.resources.geometries, ...asset.resources.materials]
    const disposals = resources.map((resource) => vi.spyOn(resource, "dispose"))
    const buffers = [...asset.resources.geometries].map((geometry) => Array.from(geometry.attributes.position.array))
    const first = getSceneLabels("p1a-1-2", "leaf")
    for (let i = 0; i < 4; i++) {
      getSceneLabels("p1a-1-1", "tree")
      getSceneLabels("p1a-1-2", "stem")
      getSceneLabels("p1a-1-2", "flower")
      expect(getSceneLabels("p1a-1-2", "leaf")).toBe(first)
    }
    expect(JSON.stringify(TREE_PARTS)).toBe(treeBefore)
    expect(JSON.stringify(first)).toBe(leafBefore)
    expect([...asset.resources.geometries].map((geometry) => Array.from(geometry.attributes.position.array))).toEqual(buffers)
    disposals.forEach((dispose) => expect(dispose).not.toHaveBeenCalled())
    asset.dispose()
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce())
  })
})
