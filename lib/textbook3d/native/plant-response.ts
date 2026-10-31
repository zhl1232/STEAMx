import * as THREE from "three"

export const PLANT_RESPONSE_MS = 1100
const WIND_Z = 0.3
const UP = new THREE.Vector3(0, 1, 0)

type Surface = {
  geometry: THREE.BufferGeometry
  matrix: THREE.Matrix4
  box: THREE.Box3
  instance?: Instance
}
type Plain = {
  mesh: THREE.Mesh
  original: THREE.BufferGeometry
  clone: THREE.BufferGeometry
  points: Float32Array
  normals: Float32Array | null
  inverse: THREE.Matrix4
  normalInverse: THREE.Matrix3
}
type Instance = {
  rest: THREE.Matrix4
  modelRest: THREE.Matrix4
  modelInverse: THREE.Matrix4
  center: THREE.Vector3
  rooted: boolean
  rootY: number
  height: number
  tipWeight: number
  localWind: THREE.Vector3
  delta: THREE.Matrix4
}
type Instanced = {
  mesh: THREE.InstancedMesh
  matrices: Float32Array
  modelMatrix: THREE.Matrix4
  inverse: THREE.Matrix4
  geometryBox: THREE.Box3
  oldBox: THREE.Box3 | null
  oldSphere: THREE.Sphere | null
  liveBox: THREE.Box3
  liveSphere: THREE.Sphere
  items: Instance[]
}
type Specimen = {
  base: number
  span: number
  amplitude: number
  plains: Plain[]
  instances: Instanced[]
  surfaces: Surface[]
  anchors: Map<string, Instance | null>
}

const weight = (specimen: Specimen, y: number) => (Math.max(0, y - specimen.base) / specimen.span) ** 2
const slope = (specimen: Specimen, y: number) => 2 * Math.max(0, y - specimen.base) / specimen.span ** 2
function bend(specimen: Specimen, point: THREE.Vector3, amount: number) {
  const offset = amount * weight(specimen, point.y)
  point.x += offset
  point.z += offset * WIND_Z
  return point
}

/**
 * One finite, root-pinned wind response; the caller owns time and its demand RAF.
 * Points and anchors use the model's local coordinates, before its book scale.
 * Keep child transforms fixed while this helper owns a response.
 *
 * Plain meshes use the same continuous height field as their labels. Floating
 * instances approximate that field with center displacement and tangent rotation.
 * Rooted blades use a local shear instead, keeping their bottom row fixed. These
 * are per-instance affine approximations, not nonlinear deformation of each leaf.
 * Anchor lookup binds to the closest rest surface and uses that instance's actual
 * affine matrix, so labels follow the displayed approximation without drifting.
 */
export function createPlantResponse(models: Record<string, THREE.Group>) {
  const cache = new Map<string, Specimen>()
  let current: { id: string; specimen: Specimen; start: number; amount: number } | null = null
  let disposed = false
  const point = new THREE.Vector3(), normal = new THREE.Vector3()
  const tangent = new THREE.Vector3(), moved = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const transform = new THREE.Matrix4(), matrix = new THREE.Matrix4(), translation = new THREE.Matrix4()
  const box = new THREE.Box3()

  function prepare(id: string) {
    const saved = cache.get(id)
    if (saved) return saved
    const model = models[id]
    model.updateWorldMatrix(true, true)
    const rootInverse = model.matrixWorld.clone().invert()
    const meshes: Array<{ mesh: THREE.Mesh; matrix: THREE.Matrix4; box: THREE.Box3 }> = []
    const bounds = new THREE.Box3()
    const surfaces: Surface[] = []
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.geometry.attributes.position) return
      const local = new THREE.Matrix4().multiplyMatrices(rootInverse, object.matrixWorld)
      // Private bounds avoid changing caches on borrowed geometry.
      const geometryBox = new THREE.Box3().setFromBufferAttribute(object.geometry.attributes.position as THREE.BufferAttribute)
      meshes.push({ mesh: object, matrix: local, box: geometryBox })
      if (object instanceof THREE.InstancedMesh) {
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, matrix)
          transform.multiplyMatrices(local, matrix)
          bounds.union(box.copy(geometryBox).applyMatrix4(transform))
        }
      } else bounds.union(box.copy(geometryBox).applyMatrix4(local))
    })
    // These specimens stand on local y=0. A rotated blade's conservative box
    // can extend well below its actual root; never lower the pinned base with it.
    const ground = bounds.isEmpty() ? 0 : Math.max(0, bounds.min.y)
    const height = bounds.isEmpty() ? 1 : Math.max(0.01, bounds.max.y - ground)
    const specimen: Specimen = {
      base: ground + height * 0.12,
      span: height * 0.88,
      amplitude: Math.min(0.16, height * 0.055),
      plains: [], instances: [], surfaces, anchors: new Map(),
    }
    for (const { mesh, matrix: local, box: geometryBox } of meshes) {
      const inverse = local.clone().invert()
      if (mesh instanceof THREE.InstancedMesh) {
        const entry: Instanced = {
          mesh, matrices: Float32Array.from(mesh.instanceMatrix.array), modelMatrix: local, inverse,
          geometryBox, oldBox: mesh.boundingBox, oldSphere: mesh.boundingSphere,
          liveBox: new THREE.Box3(), liveSphere: new THREE.Sphere(), items: [],
        }
        for (let i = 0; i < mesh.count; i++) {
          const rest = new THREE.Matrix4()
          mesh.getMatrixAt(i, rest)
          const modelRest = new THREE.Matrix4().multiplyMatrices(local, rest)
          const modelInverse = modelRest.clone().invert()
          const instanceBox = geometryBox.clone().applyMatrix4(modelRest)
          const item: Instance = {
            rest, modelRest, modelInverse,
            center: geometryBox.getCenter(new THREE.Vector3()).applyMatrix4(modelRest),
            rooted: instanceBox.min.y <= specimen.base,
            rootY: geometryBox.min.y,
            height: Math.max(0.001, geometryBox.max.y - geometryBox.min.y),
            tipWeight: weight(specimen, instanceBox.max.y),
            localWind: new THREE.Vector3(1, 0, WIND_Z).applyMatrix3(new THREE.Matrix3().setFromMatrix4(modelInverse)),
            delta: new THREE.Matrix4(),
          }
          entry.items.push(item)
          surfaces.push({ geometry: mesh.geometry, matrix: modelRest, box: instanceBox, instance: item })
        }
        specimen.instances.push(entry)
      } else {
        const meshBox = geometryBox.clone().applyMatrix4(local)
        surfaces.push({ geometry: mesh.geometry, matrix: local, box: meshBox })
        if (meshBox.max.y <= specimen.base) continue
        const original = mesh.geometry, clone = original.clone()
        const positions = original.attributes.position
        const sourceNormals = original.attributes.normal
        const points = new Float32Array(positions.count * 3)
        const normals = sourceNormals ? new Float32Array(sourceNormals.count * 3) : null
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(local)
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i).applyMatrix4(local).toArray(points, i * 3)
          if (sourceNormals && normals) normal.fromBufferAttribute(sourceNormals, i).applyMatrix3(normalMatrix).normalize().toArray(normals, i * 3)
        }
        // A conservative static bound covers every finite response without
        // scanning all vertices again for raycasting or frustum culling.
        const extent = new THREE.Vector3(1, 0, WIND_Z).applyMatrix3(new THREE.Matrix3().setFromMatrix4(inverse))
          .multiplyScalar(specimen.amplitude * weight(specimen, meshBox.max.y))
        extent.set(Math.abs(extent.x), Math.abs(extent.y), Math.abs(extent.z))
        clone.boundingBox = geometryBox.clone()
        clone.boundingBox.min.sub(extent); clone.boundingBox.max.add(extent)
        clone.boundingSphere = clone.boundingBox.getBoundingSphere(new THREE.Sphere())
        specimen.plains.push({ mesh, original, clone, points, normals, inverse, normalInverse: new THREE.Matrix3().getNormalMatrix(inverse) })
      }
    }
    cache.set(id, specimen)
    return specimen
  }

  function apply(specimen: Specimen, amount: number) {
    for (const entry of specimen.plains) {
      const positions = entry.clone.attributes.position
      const normals = entry.clone.attributes.normal
      for (let i = 0; i < positions.count; i++) {
        point.fromArray(entry.points, i * 3)
        const derivative = amount * slope(specimen, point.y)
        bend(specimen, point, amount).applyMatrix4(entry.inverse)
        positions.setXYZ(i, point.x, point.y, point.z)
        if (entry.normals && normals) {
          normal.fromArray(entry.normals, i * 3)
          normal.y -= derivative * (normal.x + WIND_Z * normal.z)
          normal.applyMatrix3(entry.normalInverse).normalize()
          normals.setXYZ(i, normal.x, normal.y, normal.z)
        }
      }
      positions.needsUpdate = true
      if (normals) normals.needsUpdate = true
    }
    for (const entry of specimen.instances) {
      entry.liveBox.makeEmpty()
      entry.items.forEach((item, index) => {
        if (item.rooted) {
          // A whole blade instance cannot take a nonlinear field without a
          // shader or splitting draws. This affine form pins its local bottom
          // row exactly and matches the desired displacement at the tip.
          const k = amount * item.tipWeight / item.height
          transform.identity()
          const e = transform.elements, wind = item.localWind
          e[4] += wind.x * k; e[5] += wind.y * k; e[6] += wind.z * k
          e[12] = -wind.x * k * item.rootY; e[13] = -wind.y * k * item.rootY; e[14] = -wind.z * k * item.rootY
          matrix.multiplyMatrices(item.rest, transform)
        } else {
          const derivative = amount * slope(specimen, item.center.y)
          tangent.set(derivative, 1, derivative * WIND_Z).normalize()
          rotation.setFromUnitVectors(UP, tangent)
          moved.copy(item.center)
          bend(specimen, moved, amount)
          transform.makeRotationFromQuaternion(rotation).setPosition(moved)
          translation.makeTranslation(-item.center.x, -item.center.y, -item.center.z)
          transform.multiply(translation).multiply(item.modelRest)
          matrix.multiplyMatrices(entry.inverse, transform)
        }
        entry.mesh.setMatrixAt(index, matrix)
        // Use the uploaded Float32 matrix for labels as well, not an unrounded
        // approximation of it. Model-local anchors then follow rendered leaves.
        entry.mesh.getMatrixAt(index, matrix)
        item.delta.multiplyMatrices(entry.modelMatrix, matrix).multiply(item.modelInverse)
        entry.liveBox.union(box.copy(entry.geometryBox).applyMatrix4(matrix))
      })
      entry.liveBox.getBoundingSphere(entry.liveSphere)
      entry.mesh.boundingBox = entry.liveBox
      entry.mesh.boundingSphere = entry.liveSphere
      entry.mesh.instanceMatrix.needsUpdate = true
    }
  }

  function stop() {
    if (!current) return
    for (const entry of current.specimen.plains) if (entry.mesh.geometry === entry.clone) entry.mesh.geometry = entry.original
    for (const entry of current.specimen.instances) {
      entry.mesh.instanceMatrix.array.set(entry.matrices)
      entry.mesh.instanceMatrix.needsUpdate = true
      entry.mesh.boundingBox = entry.oldBox
      entry.mesh.boundingSphere = entry.oldSphere
      entry.items.forEach((item) => item.delta.identity())
    }
    current = null
  }

  const triangle = new THREE.Triangle(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), closest = new THREE.Vector3()
  function anchorInstance(specimen: Specimen, anchor: THREE.Vector3) {
    const key = `${anchor.x},${anchor.y},${anchor.z}`
    if (specimen.anchors.has(key)) return specimen.anchors.get(key)!
    let distance = Infinity, instance: Instance | null = null
    // First filter by inexpensive rest boxes, then resolve actual triangles.
    // This runs once per distinct semantic anchor, not once per rendered frame.
    const candidates = specimen.surfaces.map((surface) => ({ surface, distance: surface.box.distanceToPoint(anchor) })).sort((x, y) => x.distance - y.distance)
    for (const candidate of candidates) {
      if (candidate.distance ** 2 > distance + 1e-12) break
      const { surface } = candidate, positions = surface.geometry.attributes.position, indices = surface.geometry.index
      const count = indices?.count ?? positions.count
      for (let i = 0; i + 2 < count; i += 3) {
        a.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(surface.matrix)
        b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1).applyMatrix4(surface.matrix)
        c.fromBufferAttribute(positions, indices ? indices.getX(i + 2) : i + 2).applyMatrix4(surface.matrix)
        triangle.set(a, b, c).closestPointToPoint(anchor, closest)
        const next = closest.distanceToSquared(anchor)
        if (next < distance) { distance = next; instance = surface.instance ?? null }
      }
    }
    if (specimen.anchors.size >= 64) specimen.anchors.clear()
    specimen.anchors.set(key, instance)
    return instance
  }

  return {
    play(id: string, now: number) {
      if (disposed || !Number.isFinite(now) || !Object.hasOwn(models, id)) return false
      stop()
      const specimen = prepare(id)
      current = { id, specimen, start: now, amount: 0 }
      specimen.plains.forEach((entry) => { entry.mesh.geometry = entry.clone })
      specimen.instances.forEach((entry) => { entry.oldBox = entry.mesh.boundingBox; entry.oldSphere = entry.mesh.boundingSphere })
      apply(specimen, 0)
      return true
    },
    update(now: number) {
      if (!current || disposed) return false
      if (!Number.isFinite(now) || now - current.start >= PLANT_RESPONSE_MS) { stop(); return false }
      const progress = Math.max(0, (now - current.start) / PLANT_RESPONSE_MS)
      const envelope = (1 - Math.exp(-18 * progress)) * Math.exp(-2.4 * progress) * (1 - progress)
      current.amount = current.specimen.amplitude * Math.sin(progress * Math.PI * 5) * envelope
      apply(current.specimen, current.amount)
      return true
    },
    stop,
    anchor(id: string, original: THREE.Vector3) {
      const result = original.clone()
      if (!current || current.id !== id || current.amount === 0) return result
      const instance = anchorInstance(current.specimen, original)
      return instance ? result.applyMatrix4(instance.delta) : bend(current.specimen, result, current.amount)
    },
    dispose() {
      if (disposed) return
      stop()
      disposed = true
      for (const specimen of cache.values()) specimen.plains.forEach((entry) => entry.clone.dispose())
      cache.clear()
    },
    get active() { return current !== null },
  }
}
