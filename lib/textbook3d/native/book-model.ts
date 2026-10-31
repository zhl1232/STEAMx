import * as THREE from "three"
import type { BookPose } from "./book-motion"

/** A real, shallow hardback: separate cover, spine, page stacks and hinged leaf. */
export function createBookModel() {
  const root = new THREE.Group()
  root.name = "botanical-pop-up-book"
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  const geometry = <T extends THREE.BufferGeometry>(item: T) => { geometries.add(item); return item }
  const material = (color: string) => {
    const item = new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0 })
    materials.add(item)
    return item
  }
  // Two tiny owned tiles: subtle paper fibers and woven cloth, no downloads.
  function grain(cloth: boolean) {
    const size = 64, pixels = new Uint8Array(size * size * 4)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const noise = ((x * 1973 + y * 9277 + x * y * 17) % 23) / 23
      const value = cloth ? 234 + noise * 13 - ((x % 4 === 0 || y % 4 === 0) ? 12 : 0) : 246 + noise * 9
      const offset = (y * size + x) * 4
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value
      pixels[offset + 3] = 255
    }
    const texture = new THREE.DataTexture(pixels, size, size)
    texture.name = cloth ? "book-cloth-weave" : "book-paper-fibers"
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(cloth ? 8 : 5, cloth ? 12 : 7)
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.generateMipmaps = true
    texture.needsUpdate = true
    textures.add(texture)
    return texture
  }
  const paperGrain = grain(false), clothGrain = grain(true)
  const cover = material("#2f514a")
  cover.map = cover.bumpMap = clothGrain
  cover.bumpScale = 0.008
  const binding = material("#2c443d")
  binding.map = clothGrain
  const pageEdge = material("#dbd0b9")
  const pageLine = material("#baad93")
  const ribbon = material("#ba6549")
  ribbon.map = clothGrain
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
  const paperSurface = new THREE.MeshStandardMaterial({ color: "#f6f0de", roughness: 1, vertexColors: true })
  paperSurface.map = paperSurface.bumpMap = paperGrain
  paperSurface.bumpScale = 0.002
  materials.add(paperSurface)
  function curvedPage(side: number) {
    const page = geometry(new THREE.PlaneGeometry(3.49, 4.44, 32, 8))
    page.rotateX(-Math.PI / 2)
    const positions = page.getAttribute("position")
    const colors: number[] = []
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const fromSpine = (x * side + 1.745) / 3.49
      const curl = 0.028 * Math.sin(fromSpine * Math.PI) - 0.035 * Math.exp(-fromSpine * 10)
      positions.setY(i, curl)
      const shade = 1 - 0.17 * Math.exp(-fromSpine * 15) - 0.025 * Math.pow(fromSpine, 12)
      colors.push(shade, shade, shade * 0.99)
    }
    page.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    page.computeVertexNormals()
    return page
  }
  for (const side of [-1, 1]) {
    mesh(coverShape, cover, [side * 1.87, -0.24, 0], [1, 1, 1]).name = "hard-cover"
    mesh(stackShape, pageEdge, [side * 1.86, -0.1, 0], [1, 1, 1]).name = "page-stack"
    mesh(curvedPage(side), paperSurface, [side * 1.86, 0.14, 0], [1, 1, 1]).name = "open-paper"
    // Visible page edges; no texture downloads, outlines or expensive effects.
    for (let line = 0; line < 5; line++) {
      mesh(box, pageLine, [side * 1.86, -0.072 + line * 0.027, 2.224], [3.36, 0.006, 0.008]).castShadow = false
      mesh(box, pageLine, [side * 3.604, -0.072 + line * 0.027, 0], [0.008, 0.006, 4.25]).castShadow = false
    }
  }
  mesh(slab(0.14, 4.62, 0.14, 0.055), binding, [0, -0.2, 0], [1, 1, 1]).name = "spine"
  const creaseShape = geometry(new THREE.PlaneGeometry(0.25, 4.44, 12, 4))
  creaseShape.rotateX(-Math.PI / 2)
  const creasePositions = creaseShape.getAttribute("position")
  for (let i = 0; i < creasePositions.count; i++) {
    creasePositions.setY(i, 0.075 + 0.032 * Math.pow(Math.abs(creasePositions.getX(i)) / 0.125, 1.6))
  }
  creaseShape.computeVertexNormals()
  const creaseSurface = material("#cdbd9e")
  creaseSurface.map = paperGrain
  mesh(creaseShape, creaseSurface, [0, 0, 0], [1, 1, 1]).name = "paper-gutter"
  // A cloth bookmark extends beyond the lower edge, making the book silhouette legible.
  const bookmark = new THREE.Shape()
  bookmark.moveTo(-0.12, 0); bookmark.lineTo(0.12, 0); bookmark.lineTo(0.12, 0.45)
  bookmark.lineTo(0, 0.34); bookmark.lineTo(-0.12, 0.45); bookmark.closePath()
  const bookmarkGeometry = geometry(new THREE.ShapeGeometry(bookmark))
  bookmarkGeometry.rotateX(Math.PI / 2)
  mesh(bookmarkGeometry, ribbon, [-0.18, -0.08, 2.08], [1, 1, 1]).material.side = THREE.DoubleSide

  // Keep the left sheet clear for live, readable DOM typesetting.
  const leaf = geometry(new THREE.SphereGeometry(1, 12, 8))
  const secondPage = new THREE.Group()
  secondPage.name = "observation-path"
  root.add(secondPage)
  for (let i = 0; i < 13; i++) {
    const x = 0.65 + i * 0.19
    const z = 0.45 + Math.sin(i * 0.4) * 0.25
    mesh(leaf, pageEdge, [x, 0.18, z], [0.055, 0.008, 0.04], secondPage).castShadow = false
  }
  const turnLeaf = new THREE.Group()
  turnLeaf.name = "hinged-turning-leaf"
  turnLeaf.position.y = 0.2
  root.add(turnLeaf)
  const leafSurface = material("#f6f0de")
  leafSurface.map = paperGrain
  leafSurface.side = THREE.DoubleSide
  mesh(paperShape, leafSurface, [1.86, 0, 0], [1, 1, 1], turnLeaf)
  turnLeaf.visible = false
  let disposed = false
  return {
    root, geometries, materials, textures,
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
      textures.forEach((item) => item.dispose())
    },
  }
}
