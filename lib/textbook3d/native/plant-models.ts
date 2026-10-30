import * as THREE from "three"
import type { PlantId } from "./plants"

/** All GPU resources belong to this invocation, never to a module-level cache. */
export function createPlantModels() {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const geometry = <T extends THREE.BufferGeometry>(value: T) => { geometries.add(value); return value }
  const material = (color: string) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0 })
    materials.add(value)
    return value
  }
  const sphere = geometry(new THREE.SphereGeometry(1, 18, 12))
  const greens = [material("#396d46"), material("#56824c"), material("#72944f"), material("#8da35e")]
  const bark = material("#8e6346")
  const earth = material("#d5c3a0")
  const moss = material("#9cac70")
  const pebble = material("#bfb9a8")
  const petal = material("#fff1d3")
  const gold = material("#dca649")

  function mesh(parent: THREE.Group, shape: THREE.BufferGeometry, surface: THREE.Material, pos: number[], scale?: number[]) {
    const object = new THREE.Mesh(shape, surface)
    object.position.set(pos[0], pos[1], pos[2])
    if (scale) object.scale.set(scale[0], scale[1], scale[2])
    object.castShadow = true
    object.receiveShadow = true
    parent.add(object)
    return object
  }
  function stem(parent: THREE.Group, points: number[][], radius: number, surface: THREE.Material) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
    return mesh(parent, geometry(new THREE.TubeGeometry(curve, 10, radius, 7, false)), surface, [0, 0, 0])
  }
  function base() {
    const group = new THREE.Group()
    mesh(group, geometry(new THREE.CylinderGeometry(1.35, 1.28, 0.18, 48)), earth, [0, 0, 0])
    mesh(group, geometry(new THREE.CylinderGeometry(1.31, 1.35, 0.07, 48)), moss, [0, 0.11, 0])
    for (const [x, z, size] of [[-0.9, 0.7, 0.15], [0.9, 0.35, 0.11], [0.6, -0.9, 0.13]]) {
      mesh(group, sphere, pebble, [x, 0.19, z], [size, size * 0.55, size * 0.75])
    }
    return group
  }
  function leafShape() {
    const vertices: number[] = []
    const indices: number[] = []
    for (let step = 0; step <= 10; step++) {
      const t = step / 10
      const halfWidth = Math.sin(Math.PI * t) * 0.105
      const y = t * 1.1
      const z = t * t * 0.42
      vertices.push(-halfWidth, y, z, 0, y + halfWidth * 0.15, z - halfWidth * 0.3, halfWidth, y, z)
      if (step < 10) {
        const n = step * 3
        indices.push(n, n + 3, n + 1, n + 1, n + 3, n + 4, n + 1, n + 4, n + 2, n + 2, n + 4, n + 5)
      }
    }
    const shape = new THREE.BufferGeometry()
    shape.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
    shape.setIndex(indices)
    shape.computeVertexNormals()
    return geometry(shape)
  }
  const leaf = leafShape()
  const leafMaterial = material("#5d8c43")
  leafMaterial.side = THREE.DoubleSide
  const tree = base()
  mesh(tree, geometry(new THREE.CylinderGeometry(0.14, 0.25, 1.95, 12)), bark, [0, 1.1, 0])
  for (const [x, y, z] of [[-0.64, 2.3, 0.05], [0.64, 2.5, -0.08], [0.18, 2.8, -0.45], [0.15, 2.35, 0.65]]) {
    stem(tree, [[0, 1.4, 0], [x * 0.45, y * 0.78, z * 0.45], [x, y, z]], 0.08, bark)
  }
  // Overlapping, uneven masses give the crown depth without outlines or postprocessing.
  const crowns = [
    [-0.72, 2.35, 0.05, 0.65, 0.7, 0.63], [0.64, 2.5, -0.02, 0.72, 0.66, 0.7],
    [0.05, 3.0, -0.18, 0.8, 0.69, 0.76], [-0.2, 2.65, 0.55, 0.75, 0.7, 0.57],
    [-0.52, 2.7, -0.55, 0.62, 0.65, 0.64], [0.47, 2.82, 0.45, 0.6, 0.65, 0.62],
    [-0.55, 3.0, 0.15, 0.55, 0.58, 0.55], [0.45, 3.2, -0.22, 0.52, 0.48, 0.53],
  ]
  crowns.forEach(([x, y, z, a, b, c], index) => mesh(tree, sphere, greens[index % 3], [x, y, z], [a, b, c]))
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.4
    const root = mesh(tree, sphere, bark, [Math.cos(angle) * 0.2, 0.2, Math.sin(angle) * 0.2], [0.12, 0.08, 0.32])
    root.rotation.y = -angle + Math.PI / 2
  }

  const grass = base()
  const blades = new THREE.InstancedMesh(leaf, leafMaterial, 30)
  blades.castShadow = true
  blades.receiveShadow = true
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 30; i++) {
    const angle = i * 2.39996
    const radius = 0.1 + Math.sqrt(i / 30) * 0.68
    dummy.position.set(Math.cos(angle) * radius, 0.16, Math.sin(angle) * radius)
    dummy.rotation.set(0.15 + (i % 4) * 0.1, angle, ((i % 3) - 1) * 0.1)
    const length = 0.62 + (i % 7) * 0.095
    dummy.scale.set(0.8 + (i % 3) * 0.13, length, 1)
    dummy.updateMatrix()
    blades.setMatrixAt(i, dummy.matrix)
  }
  grass.add(blades)

  const flower = base()
  const petals = new THREE.InstancedMesh(sphere, petal, 27)
  petals.castShadow = true
  petals.receiveShadow = true
  const flowers = [[-0.48, 1.5, 0.12], [0.4, 1.95, -0.2], [0.4, 1.25, 0.55]]
  flowers.forEach(([x, y, z], index) => {
    stem(flower, [[x * 0.7, 0.14, z], [x * 0.85, y * 0.55, z - 0.05], [x, y, z]], 0.035, greens[0])
    const head = new THREE.Group()
    head.position.set(x, y, z)
    head.rotation.x = -0.2
    head.rotation.y = (index - 1) * 0.25
    head.updateMatrix()
    mesh(head, sphere, gold, [0, 0, 0.05], [0.17, 0.17, 0.11])
    flower.add(head)
    for (let k = 0; k < 9; k++) {
      const angle = k * Math.PI * 2 / 9
      dummy.position.set(Math.sin(angle) * 0.25, Math.cos(angle) * 0.25, 0)
      dummy.rotation.set(0, 0, -angle)
      dummy.scale.set(0.105, 0.25, 0.045)
      dummy.updateMatrix()
      const matrix = new THREE.Matrix4().multiplyMatrices(head.matrix, dummy.matrix)
      petals.setMatrixAt(index * 9 + k, matrix)
    }
    for (let side = -1; side <= 1; side += 2) {
      const blade = mesh(flower, leaf, leafMaterial, [x * 0.8, y * 0.3, z])
      blade.scale.set(1.6, 0.6, 0.7)
      blade.rotation.set(0.1, 0.6 * side, -side * 0.9)
    }
  })
  flower.add(petals)
  const models: Record<PlantId, THREE.Group> = { tree, grass, flower }
  let disposed = false
  return {
    models,
    /** Static source budget; GPU allocations are available from renderer.info at runtime. */
    resources: { geometries, materials },
    dispose() {
      if (disposed) return
      disposed = true
      Object.values(models).forEach((group) => {
        group.traverse((object) => { if (object instanceof THREE.InstancedMesh) object.dispose() })
        group.removeFromParent()
      })
      geometries.forEach((value) => value.dispose())
      materials.forEach((value) => value.dispose())
    },
  }
}
