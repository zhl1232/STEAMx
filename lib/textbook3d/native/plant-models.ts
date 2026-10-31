import * as THREE from "three"
import type { PlantId } from "./plants"

/** Botanical forms without canopy balls or display plinths. All resources are local. */
export function createPlantModels() {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const geometry = <T extends THREE.BufferGeometry>(value: T) => { geometries.add(value); return value }
  const material = (color: string, vertexColors = false) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, vertexColors })
    materials.add(value)
    return value
  }
  const bark = material("#8b6648")
  const green = material("#496f48")
  green.side = THREE.DoubleSide
  const leafSurface = material("#f1f6df", true)
  leafSurface.side = THREE.DoubleSide
  const petalSurface = material("#fff6df", true)
  petalSurface.side = THREE.DoubleSide
  const pollen = material("#dba33d")
  const pollenTip = material("#e9bb4c")
  const dryLeaf = material("#b2ad79")

  function mesh(parent: THREE.Group, shape: THREE.BufferGeometry, surface: THREE.Material, pos: number[], scale?: number[]) {
    const object = new THREE.Mesh(shape, surface)
    object.position.set(pos[0], pos[1], pos[2])
    if (scale) object.scale.set(scale[0], scale[1], scale[2])
    object.castShadow = true
    object.receiveShadow = true
    parent.add(object)
    return object
  }
  function branch(parent: THREE.Group, points: number[][], base: number, tip: number, surface: THREE.Material) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
    const shape = new THREE.TubeGeometry(curve, 9, 1, 7, false)
    const positions = shape.getAttribute("position")
    for (let ring = 0; ring <= 9; ring++) {
      const t = ring / 9, center = curve.getPointAt(t)
      const radius = THREE.MathUtils.lerp(base, tip, t)
      for (let side = 0; side <= 7; side++) {
        const index = ring * 8 + side
        const p = new THREE.Vector3().fromBufferAttribute(positions, index).sub(center).multiplyScalar(radius).add(center)
        positions.setXYZ(index, p.x, p.y, p.z)
      }
    }
    shape.computeVertexNormals()
    return mesh(parent, geometry(shape), surface, [0, 0, 0])
  }
  function bladeShape(kind: "leaf" | "grass" | "petal") {
    const vertices: number[] = [], colors: number[] = [], indices: number[] = []
    const steps = kind === "grass" ? 10 : 7
    for (let row = 0; row <= steps; row++) {
      const t = row / steps
      const width = kind === "grass" ? 0.035 * Math.pow(1 - t, 0.65) : Math.pow(Math.sin(Math.PI * t), 0.78) * (kind === "petal" ? 0.13 : 0.21)
      const y = kind === "petal" ? t * 0.46 : t
      const bend = kind === "grass" ? t * t * 0.58 : kind === "petal" ? 0.045 * Math.sin(t * Math.PI) + 0.06 * t * t : 0.12 * Math.sin(t * Math.PI) - 0.08 * t * t
      for (const side of [-1, 0, 1]) {
        vertices.push(side * width, y, bend + (side === 0 ? width * 0.22 : 0))
        const shade = side === 0 ? 1 : 0.87 + t * 0.06
        colors.push(shade, shade, shade * 0.96)
      }
      if (row < steps) {
        const n = row * 3
        indices.push(n, n + 1, n + 3, n + 1, n + 4, n + 3, n + 1, n + 2, n + 4, n + 2, n + 5, n + 4)
      }
    }
    const shape = new THREE.BufferGeometry()
    shape.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
    shape.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    shape.setIndex(indices)
    shape.computeVertexNormals()
    return geometry(shape)
  }
  const leaf = bladeShape("leaf")
  const grassBlade = bladeShape("grass")
  const petal = bladeShape("petal")
  const centerShape = geometry(new THREE.SphereGeometry(1, 16, 10))
  const pollenShape = geometry(new THREE.OctahedronGeometry(1, 0))
  const dummy = new THREE.Object3D()
  const leafNormal = new THREE.Vector3(0, 0, 1)

  const tree = new THREE.Group()
  branch(tree, [[0, 0, 0], [-0.04, 0.8, 0.02], [0.06, 1.65, -0.03], [-0.04, 2.55, 0.04]], 0.18, 0.045, bark)
  for (let i = 0; i < 4; i++) {
    const angle = i * 1.57 + 0.3
    branch(tree, [[Math.cos(angle) * 0.34, 0.018, Math.sin(angle) * 0.34], [Math.cos(angle) * 0.14, 0.1, Math.sin(angle) * 0.14], [0, 0.36, 0]], 0.035, 0.065, bark)
  }
  const clusters = [
    [-0.68, 2.18, 0.05, 0.58], [0.67, 2.37, -0.12, 0.62],
    [-0.15, 2.9, -0.12, 0.59], [-0.16, 2.48, 0.57, 0.56],
    [-0.48, 2.53, -0.52, 0.53], [0.5, 2.73, 0.4, 0.52],
  ]
  const leavesPerCluster = 48
  const foliage = new THREE.InstancedMesh(leaf, leafSurface, clusters.length * leavesPerCluster)
  foliage.name = "individual-canopy-leaves"
  foliage.castShadow = foliage.receiveShadow = true
  const palette = ["#486e45", "#638b50", "#7c9e5e", "#a3b97b"]
  clusters.forEach(([x, y, z, radius], cluster) => {
    branch(tree, [[0, 1.25, 0], [x * 0.5, y * 0.7, z * 0.5], [x, y, z]], 0.065, 0.018, bark)
    for (let i = 0; i < leavesPerCluster; i++) {
      const angle = i * 2.39996 + cluster * 0.7
      const vertical = 1 - 2 * (i + 0.5) / leavesPerCluster
      const radial = Math.sqrt(1 - vertical * vertical)
      const direction = new THREE.Vector3(Math.cos(angle) * radial, vertical, Math.sin(angle) * radial)
      const shell = radius * (0.65 + (i % 4) * 0.09)
      dummy.position.set(x + direction.x * shell, y + direction.y * shell * 0.8, z + direction.z * shell * 0.88)
      const normal = new THREE.Vector3(direction.x * 0.65, 0.65 + direction.y * 0.3, direction.z * 0.65).normalize()
      dummy.quaternion.setFromUnitVectors(leafNormal, normal)
      dummy.rotateZ(angle)
      const length = 0.4 + (i % 5) * 0.035
      dummy.scale.set(length * 1.45, length, length)
      dummy.updateMatrix()
      const index = cluster * leavesPerCluster + i
      foliage.setMatrixAt(index, dummy.matrix)
      foliage.setColorAt(index, new THREE.Color(palette[(i + cluster) % palette.length]))
    }
  })
  tree.add(foliage)
  // A pair of fallen leaves ties the trunk to the paper without a circular base.
  for (let i = 0; i < 2; i++) {
    const fallen = mesh(tree, leaf, dryLeaf, [0.25 - i * 0.65, 0.018, 0.24 + i * 0.12], [0.28, 0.3, 0.14])
    fallen.rotation.set(-Math.PI / 2, 0, i * 1.8 - 0.5)
  }

  const grass = new THREE.Group()
  const blades = new THREE.InstancedMesh(grassBlade, leafSurface, 56)
  blades.name = "curved-grass-blades"
  blades.castShadow = blades.receiveShadow = true
  for (let i = 0; i < blades.count; i++) {
    const angle = i * 2.39996
    const radius = 0.055 + Math.sqrt(i / blades.count) * 0.3
    dummy.position.set(Math.cos(angle) * radius, 0.006, Math.sin(angle) * radius)
    dummy.rotation.set(0.02 + (i % 4) * 0.07, angle, ((i % 5) - 2) * 0.055)
    dummy.scale.set(0.65 + (i % 4) * 0.14, 0.56 + (i % 9) * 0.065, 0.65 + i / blades.count * 0.6)
    dummy.updateMatrix()
    blades.setMatrixAt(i, dummy.matrix)
    blades.setColorAt(i, new THREE.Color(palette[(i + 1) % 3]))
  }
  grass.add(blades)

  const flower = new THREE.Group()
  const heads = [[-0.4, 1.45, 0.1], [0.35, 1.85, -0.2], [0.35, 1.05, 0.55]]
  const petals = new THREE.InstancedMesh(petal, petalSurface, 30)
  const florets = new THREE.InstancedMesh(pollenShape, pollenTip, 54)
  petals.castShadow = petals.receiveShadow = true
  florets.castShadow = florets.receiveShadow = true
  heads.forEach(([x, y, z], index) => {
    branch(flower, [[x * 0.45, 0, z * 0.7], [x * 0.8, y * 0.55, z - 0.08], [x, y, z]], 0.025, 0.014, green)
    const head = new THREE.Group()
    head.position.set(x, y, z)
    head.rotation.set(-0.4 - index * 0.1, (index - 1) * 0.25, (index - 1) * 0.14)
    head.updateMatrix()
    mesh(head, centerShape, pollen, [0, 0, 0.025], [0.135, 0.135, 0.075])
    flower.add(head)
    for (let k = 0; k < 10; k++) {
      const angle = k * Math.PI * 2 / 10
      dummy.position.set(Math.sin(angle) * 0.07, Math.cos(angle) * 0.07, 0)
      dummy.rotation.set(0, 0, -angle)
      dummy.scale.set(0.85 + (k % 3) * 0.06, 0.65 + (k % 4) * 0.035, 0.75)
      dummy.updateMatrix()
      petals.setMatrixAt(index * 10 + k, new THREE.Matrix4().multiplyMatrices(head.matrix, dummy.matrix))
    }
    for (let k = 0; k < 18; k++) {
      const angle = k * 2.39996, radius = Math.sqrt(k / 18) * 0.115
      dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.045 + Math.sqrt(1 - radius * radius / 0.02) * 0.055)
      dummy.rotation.set(0, angle, 0)
      dummy.scale.set(0.017, 0.017, 0.023)
      dummy.updateMatrix()
      florets.setMatrixAt(index * 18 + k, new THREE.Matrix4().multiplyMatrices(head.matrix, dummy.matrix))
    }
    for (const side of [-1, 1]) {
      const blade = mesh(flower, leaf, leafSurface, [x * 0.72, y * 0.34, z], [0.48, 0.56, 0.32])
      blade.rotation.set(0.25, side * 0.5, -side * 0.95)
      // Non-instanced leaves need the botanical color directly.
      blade.material = green
    }
  })
  flower.add(petals, florets)

  const models: Record<PlantId, THREE.Group> = { tree, grass, flower }
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
