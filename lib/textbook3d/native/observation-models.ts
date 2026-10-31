import * as THREE from "three"
import type { ObservationPlantId } from "./observation-plants"

/** Three static specimens, each rooted at local y=0 for the book's folding hinge. */
export function createObservationModels() {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const geometry = <T extends THREE.BufferGeometry>(value: T) => { geometries.add(value); return value }
  const material = (color: string, vertexColors = false) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, vertexColors })
    materials.add(value)
    return value
  }
  const leafSurface = material("#638541", true)
  const veins = material("#b4be74")
  const stemSurface = material("#648148")
  const rootSurface = material("#b6a080")
  const petalSurface = material("#c97988", true)
  const centerSurface = material("#bd8b39")
  const pollenSurface = material("#dfb354")

  function mesh(parent: THREE.Group, name: string, shape: THREE.BufferGeometry, surface: THREE.Material) {
    const object = new THREE.Mesh(shape, surface)
    object.name = name
    object.castShadow = object.receiveShadow = true
    parent.add(object)
    return object
  }

  function tube(parent: THREE.Group, name: string, points: number[][], radius: number, surface: THREE.Material, steps = 8) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
    return mesh(parent, name, geometry(new THREE.TubeGeometry(curve, steps, radius, 6, false)), surface)
  }

  // A closed, slightly cupped blade. Both surfaces and the thin rim are geometry,
  // so rotating the leaf reveals thickness rather than a disappearing flat card.
  function bladePoint(t: number, across: number, length: number, width: number, bend: number) {
    const halfWidth = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.8) * width
    return new THREE.Vector3(
      across * halfWidth,
      t * length,
      Math.sin(Math.PI * t) * (bend + (1 - across * across) * width * 0.16) - t * t * bend * 0.35,
    )
  }

  function bladeShape(length: number, width: number, bend: number, thickness: number, rows: number) {
    const positions: number[] = [], colors: number[] = [], indices: number[] = []
    const columns = 5, layerSize = (rows + 1) * columns
    for (let layer = 0; layer < 2; layer++) {
      for (let row = 0; row <= rows; row++) {
        const t = row / rows
        for (let column = 0; column < columns; column++) {
          const across = column / (columns - 1) * 2 - 1
          const point = bladePoint(t, across, length, width, bend)
          positions.push(point.x, point.y, point.z + (layer === 0 ? 1 : -1) * thickness / 2)
          const shade = (layer === 0 ? 1 : 0.86) * (0.89 + (1 - Math.abs(across)) * 0.08 + t * 0.03)
          colors.push(shade, shade, shade)
        }
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns - 1; column++) {
        const a = row * columns + column, b = a + 1, c = a + columns, d = c + 1
        indices.push(a, b, c, b, d, c)
        indices.push(a + layerSize, c + layerSize, b + layerSize, b + layerSize, c + layerSize, d + layerSize)
      }
    }
    const rim = (a: number, b: number) => indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize)
    for (let row = 0; row < rows; row++) {
      rim((row + 1) * columns, row * columns)
      rim(row * columns + columns - 1, (row + 1) * columns + columns - 1)
    }
    for (let column = 0; column < columns - 1; column++) {
      rim(column, column + 1)
      rim(rows * columns + column + 1, rows * columns + column)
    }
    const shape = new THREE.BufferGeometry()
    shape.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    shape.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    shape.setIndex(indices)
    shape.computeVertexNormals()
    return geometry(shape)
  }

  const leafLength = 2.05, leafWidth = 0.49, leafBend = 0.16, leafThickness = 0.024
  const leafShape = bladeShape(leafLength, leafWidth, leafBend, leafThickness, 12)
  const petalShape = bladeShape(0.47, 0.135, 0.1, 0.018, 8)
  const sphere = geometry(new THREE.SphereGeometry(1, 16, 10))
  const pollenShape = geometry(new THREE.OctahedronGeometry(1, 0))
  const nodeShape = geometry(new THREE.TorusGeometry(0.047, 0.012, 5, 12))

  const leaf = new THREE.Group()
  leaf.name = "leaf-specimen"
  tube(leaf, "leaf-petiole", [[0, 0.015, 0], [0.015, 0.12, 0], [0, 0.24, 0]], 0.022, stemSurface)
  const blade = new THREE.Group()
  blade.name = "leaf-blade-and-veins"
  blade.position.set(0, 0.2, 0)
  blade.rotation.x = -0.5
  leaf.add(blade)
  mesh(blade, "leaf-blade", leafShape, leafSurface)
  const veinPoint = (t: number, across: number) => {
    const point = bladePoint(t, across, leafLength, leafWidth, leafBend)
    point.z += leafThickness / 2 + 0.012
    return point.toArray()
  }
  tube(blade, "leaf-midrib", [0.02, 0.25, 0.5, 0.75, 0.97].map((t) => veinPoint(t, 0)), 0.014, veins, 12)
  for (let row = 0; row < 6; row++) {
    const t = 0.12 + row * 0.115
    for (const side of [-1, 1]) {
      tube(blade, `leaf-side-vein-${row}-${side}`, [veinPoint(t, 0), veinPoint(t + 0.065, side * 0.44), veinPoint(t + 0.13, side * 0.89)], 0.007, veins, 5)
    }
  }

  function smallLeaf(parent: THREE.Group, name: string, position: number[], side: number, scale: number) {
    const group = new THREE.Group()
    group.name = name
    group.position.set(position[0], position[1], position[2])
    group.rotation.set(-0.35, side * 0.2, side * -0.95)
    group.scale.setScalar(scale)
    mesh(group, `${name}-blade`, leafShape, leafSurface)
    // The shared leaf surface stays visible; a small midrib marks its connection.
    tube(group, `${name}-midrib`, [0.02, 0.35, 0.7, 0.95].map((t) => veinPoint(t, 0)), 0.018, veins)
    parent.add(group)
  }

  const stem = new THREE.Group()
  stem.name = "stem-specimen"
  tube(stem, "stem-main", [[0, 0.1, 0], [-0.035, 0.75, 0.015], [0.035, 1.5, -0.01], [0.015, 2.2, 0]], 0.039, stemSurface, 16)
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5 + 0.2
    const x = Math.cos(angle), z = Math.sin(angle)
    tube(stem, `stem-root-${i}`, [[0, 0.2, 0], [x * 0.13, 0.07, z * 0.12], [x * 0.35, 0.022, z * 0.31], [x * 0.43, 0.012, z * 0.38]], 0.011, rootSurface)
    tube(stem, `stem-rootlet-${i}`, [[x * 0.19, 0.04, z * 0.17], [x * 0.26 + z * 0.1, 0.017, z * 0.24 - x * 0.1]], 0.005, rootSurface, 4)
  }
  for (const [i, y] of [0.7, 1.2, 1.65].entries()) {
    const node = mesh(stem, `stem-node-${i}`, nodeShape, stemSurface)
    node.rotation.x = Math.PI / 2
    node.position.set(y < 1 ? -0.035 : 0.025, y, 0)
  }
  smallLeaf(stem, "stem-leaf-left", [-0.035, 0.7, 0], -1, 0.33)
  smallLeaf(stem, "stem-leaf-right", [0.025, 1.2, 0], 1, 0.34)

  const flower = new THREE.Group()
  flower.name = "flower-specimen"
  tube(flower, "flower-stem", [[0, 0.02, 0], [-0.055, 0.7, 0.01], [0.055, 1.3, 0], [0.025, 1.72, 0]], 0.027, stemSurface, 14)
  smallLeaf(flower, "flower-leaf-left", [-0.045, 0.5, 0], -1, 0.26)
  smallLeaf(flower, "flower-leaf-right", [0.01, 0.9, 0], 1, 0.24)
  const head = new THREE.Group()
  head.name = "flower-head"
  head.position.set(0.025, 1.72, 0)
  head.rotation.x = -0.75
  flower.add(head)
  const petals = new THREE.InstancedMesh(petalShape, petalSurface, 10)
  petals.name = "flower-petals"
  petals.castShadow = petals.receiveShadow = true
  const dummy = new THREE.Object3D()
  for (let i = 0; i < petals.count; i++) {
    const angle = i / petals.count * Math.PI * 2
    dummy.position.set(Math.sin(angle) * 0.065, Math.cos(angle) * 0.065, 0)
    dummy.rotation.set(0, 0, -angle)
    dummy.scale.set(1, 0.96 + (i % 3) * 0.025, 1)
    dummy.updateMatrix()
    petals.setMatrixAt(i, dummy.matrix)
    petals.setColorAt(i, new THREE.Color(i % 2 ? "#edc1c1" : "#f5d5cb"))
  }
  head.add(petals)
  const center = mesh(head, "flower-center", sphere, centerSurface)
  center.position.z = 0.045
  center.scale.set(0.145, 0.145, 0.085)
  const pollen = new THREE.InstancedMesh(pollenShape, pollenSurface, 24)
  pollen.name = "flower-pollen"
  pollen.castShadow = pollen.receiveShadow = true
  for (let i = 0; i < pollen.count; i++) {
    const angle = i * 2.39996, radius = Math.sqrt(i / pollen.count) * 0.122
    dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.045 + 0.083 * Math.sqrt(1 - (radius / 0.145) ** 2))
    dummy.rotation.set(0, angle, 0)
    dummy.scale.set(0.018, 0.018, 0.022)
    dummy.updateMatrix()
    pollen.setMatrixAt(i, dummy.matrix)
  }
  head.add(pollen)

  const models: Record<ObservationPlantId, THREE.Group> = { leaf, stem, flower }
  // Keep the group origin on the paper while bringing its lowest surface to y=0.
  // This also covers the small radial thickness of the curved roots and stalks.
  for (const model of Object.values(models)) {
    const ground = new THREE.Box3().setFromObject(model).min.y
    model.children.forEach((child) => { child.position.y -= ground })
  }
  let disposed = false
  return {
    models,
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
