import * as THREE from "three"
import type { BookPose } from "./book-motion"

/** A real, shallow hardback: separate cover, spine, page stacks and hinged leaf. */
export function createBookModel() {
  const root = new THREE.Group()
  root.name = "botanical-pop-up-book"
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const geometry = <T extends THREE.BufferGeometry>(item: T) => { geometries.add(item); return item }
  const material = (color: string) => {
    const item = new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0 })
    materials.add(item)
    return item
  }
  const cover = material("#31574b")
  const binding = material("#254638")
  const paper = material("#fff8e7")
  const pageEdge = material("#dfcfae")
  const pageLine = material("#cdbd9b")
  const ink = material("#91a983")
  const ribbon = material("#ba6549")
  const brass = material("#c3a36a")
  const box = geometry(new THREE.BoxGeometry(1, 1, 1))
  function mesh(shape: THREE.BufferGeometry, surface: THREE.Material, pos: number[], size: number[], parent = root) {
    const item = new THREE.Mesh(shape, surface)
    item.position.set(pos[0], pos[1], pos[2])
    item.scale.set(size[0], size[1], size[2])
    item.castShadow = true
    item.receiveShadow = true
    parent.add(item)
    return item
  }
  function slab(width: number, depth: number, thickness: number, radius: number) {
    const shape = new THREE.Shape()
    const x = -width / 2, y = -depth / 2
    shape.moveTo(x + radius, y)
    shape.lineTo(x + width - radius, y)
    shape.quadraticCurveTo(x + width, y, x + width, y + radius)
    shape.lineTo(x + width, y + depth - radius)
    shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth)
    shape.lineTo(x + radius, y + depth)
    shape.quadraticCurveTo(x, y + depth, x, y + depth - radius)
    shape.lineTo(x, y + radius)
    shape.quadraticCurveTo(x, y, x + radius, y)
    const result = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 1, curveSegments: 4, steps: 1 })
    result.rotateX(-Math.PI / 2)
    return geometry(result)
  }
  const coverShape = slab(3.65, 4.65, 0.12, 0.14)
  const stackShape = slab(3.48, 4.43, 0.16, 0.09)
  const paperShape = slab(3.49, 4.44, 0.018, 0.09)
  for (const side of [-1, 1]) {
    mesh(coverShape, cover, [side * 1.87, -0.24, 0], [1, 1, 1]).name = "hard-cover"
    mesh(stackShape, pageEdge, [side * 1.86, -0.1, 0], [1, 1, 1]).name = "page-stack"
    mesh(paperShape, paper, [side * 1.86, 0.08, 0], [1, 1, 1]).name = "open-paper"
    // Visible page edges; no texture downloads, outlines or expensive effects.
    for (let line = 0; line < 5; line++) {
      mesh(box, pageLine, [side * 1.86, -0.072 + line * 0.027, 2.224], [3.36, 0.006, 0.008]).castShadow = false
      mesh(box, pageLine, [side * 3.604, -0.072 + line * 0.027, 0], [0.008, 0.006, 4.25]).castShadow = false
    }
  }
  mesh(slab(0.28, 4.69, 0.2, 0.08), binding, [0, -0.25, 0], [1, 1, 1]).name = "spine"
  mesh(box, pageEdge, [0, 0.075, 0], [0.15, 0.018, 4.4]).castShadow = false
  for (const z of [-1.6, 1.6]) mesh(box, brass, [0, -0.035, z], [0.24, 0.014, 0.065])
  // A cloth bookmark extends beyond the lower edge, making the book silhouette legible.
  const bookmark = new THREE.Shape()
  bookmark.moveTo(-0.12, 0); bookmark.lineTo(0.12, 0); bookmark.lineTo(0.12, 0.75)
  bookmark.lineTo(0, 0.64); bookmark.lineTo(-0.12, 0.75); bookmark.closePath()
  const bookmarkGeometry = geometry(new THREE.ShapeGeometry(bookmark))
  bookmarkGeometry.rotateX(Math.PI / 2)
  mesh(bookmarkGeometry, ribbon, [-0.18, -0.08, 2.08], [1, 1, 1]).material.side = THREE.DoubleSide

  // A pressed-leaf illustration printed on the left page, with dimensional paper tabs.
  const leaf = geometry(new THREE.SphereGeometry(1, 12, 8))
  for (let i = 0; i < 7; i++) {
    const z = -1.2 + i * 0.3
    mesh(box, ink, [-2.1, 0.115, z], [0.018, 0.007, 0.36]).castShadow = false
    for (const side of [-1, 1]) {
      const pressed = mesh(leaf, ink, [-2.1 + side * (0.2 + i * 0.02), 0.12, z - 0.1], [0.34 - i * 0.025, 0.009, 0.12])
      pressed.rotation.y = side * -0.55
      pressed.castShadow = false
    }
  }
  for (const z of [1.35, 1.55, 1.75]) mesh(box, pageLine, [-2.1, 0.12, z], [1.4, 0.006, 0.016]).castShadow = false
  const secondPage = new THREE.Group()
  secondPage.name = "observation-path"
  root.add(secondPage)
  for (let i = 0; i < 13; i++) {
    const x = 0.65 + i * 0.19
    const z = 0.45 + Math.sin(i * 0.4) * 0.25
    mesh(leaf, pageEdge, [x, 0.13, z], [0.055, 0.008, 0.04], secondPage).castShadow = false
  }
  const turnLeaf = new THREE.Group()
  turnLeaf.name = "hinged-turning-leaf"
  turnLeaf.position.y = 0.14
  root.add(turnLeaf)
  const leafSurface = material("#fff8e7")
  leafSurface.side = THREE.DoubleSide
  mesh(paperShape, leafSurface, [1.86, 0, 0], [1, 1, 1], turnLeaf)
  turnLeaf.visible = false
  let disposed = false
  return {
    root, geometries, materials,
    setPose(pose: BookPose) {
      secondPage.visible = pose.page === 1
      turnLeaf.visible = pose.turning
      turnLeaf.rotation.z = pose.leafAngle
    },
    dispose() {
      if (disposed) return
      disposed = true
      root.removeFromParent()
      geometries.forEach((item) => item.dispose())
      materials.forEach((item) => item.dispose())
    },
  }
}
