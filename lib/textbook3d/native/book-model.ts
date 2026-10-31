import * as THREE from "three"
import type { BookPose } from "./book-motion"

/** A page curl travels from the outer edge to the binding, preserving strip length. */
export function turningPaperPoint(distance: number, z: number, angle: number) {
  const progress = THREE.MathUtils.clamp(angle / Math.PI, 0, 1)
  const radius = .22 * Math.sin(progress * Math.PI)
  if (radius < 1e-6) return new THREE.Vector3(progress < .5 ? distance : -distance, 0, z)
  const fold = 3.61 * (1 - progress)
  const start = fold - Math.PI * radius / 2
  const arc = Math.max(0, Math.min(distance - start, Math.PI * radius))
  if (distance <= start) return new THREE.Vector3(distance, 0, z)
  const tail = Math.max(0, distance - start - Math.PI * radius)
  return new THREE.Vector3(start + radius * Math.sin(arc / radius) - tail, radius * (1 - Math.cos(arc / radius)), z)
}

/** The bound inner margin dips continuously; the printing rectangle stays flat. */
export function bookPaperHeight(x: number, z = 0) {
  const inner = THREE.MathUtils.smoothstep(Math.abs(x), 0, .43)
  const edge = THREE.MathUtils.smoothstep(Math.abs(x), 3.45, 3.61)
  const end = THREE.MathUtils.smoothstep(Math.abs(z), 2.12, 2.22)
  return .145 - .155 * (1 - inner) - .018 * edge - .008 * end
}

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
  const cover = material("#1f2b52")
  cover.map = cover.bumpMap = clothGrain
  cover.bumpScale = 0.008
  const binding = material("#17223e")
  binding.map = clothGrain
  const pageEdge = material("#d8c9aa")
  const pageLine = material("#bbae91")
  const ribbon = material("#c8961e")
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
    const result = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 4, steps: 1 })
    result.rotateX(-Math.PI / 2)
    return geometry(result)
  }
  const coverShape = slab(3.65, 4.65, 0.12, 0.035)
  const paperSurface = new THREE.MeshStandardMaterial({ color: "#eee3cc", roughness: 1, vertexColors: true })
  paperSurface.map = paperSurface.bumpMap = paperGrain
  paperSurface.bumpScale = 0.002
  materials.add(paperSurface)
  // Keep a row at the boundary of the end curl, so interpolation cannot bend
  // the otherwise flat printing rectangle between the last two rows.
  const paperZ = (z: number) => Math.abs(z) > 1.8 && Math.abs(z) < 2.2 ? Math.sign(z) * 2.12 : z
  function pageStack(side: number) {
    const columns = 40, rows = 8, layer = (columns + 1) * (rows + 1)
    const points: number[] = [], indices: number[] = []
    for (let level = 0; level < 2; level++) for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const x = -1.74 + 3.48 * column / columns, z = -2.215 + 4.43 * row / rows
      points.push(x, level === 0 ? bookPaperHeight(x + side * 1.86, z) - .012 : -.08, z)
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1
      indices.push(a, c, b, b, c, d, a + layer, b + layer, c + layer, b + layer, d + layer, c + layer)
    }
    const boundary = [
      ...Array.from({ length: columns }, (_, i) => i),
      ...Array.from({ length: rows }, (_, i) => i * (columns + 1) + columns),
      ...Array.from({ length: columns }, (_, i) => rows * (columns + 1) + columns - i),
      ...Array.from({ length: rows }, (_, i) => (rows - i) * (columns + 1)),
    ]
    boundary.forEach((a, index) => {
      const b = boundary[(index + 1) % boundary.length]
      indices.push(a, b, a + layer, b, b + layer, a + layer)
    })
    const shape = geometry(new THREE.BufferGeometry())
    shape.setAttribute("position", new THREE.Float32BufferAttribute(points, 3))
    shape.setIndex(indices)
    shape.computeVertexNormals()
    return shape
  }
  function curvedPage(side: number) {
    const page = geometry(new THREE.PlaneGeometry(3.49, 4.44, 64, 12))
    page.rotateX(-Math.PI / 2)
    const positions = page.getAttribute("position")
    const colors: number[] = []
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const globalX = x + side * 1.86
      const fromSpine = Math.abs(globalX)
      const z = paperZ(positions.getZ(i))
      positions.setZ(i, z)
      positions.setY(i, bookPaperHeight(globalX, z))
      const shade = 1 - .28 * Math.exp(-fromSpine * 5) - .025 * THREE.MathUtils.smoothstep(fromSpine, 3.35, 3.61)
      colors.push(shade, shade, shade * 0.99)
    }
    page.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    page.computeVertexNormals()
    return page
  }
  for (const side of [-1, 1]) {
    mesh(coverShape, cover, [side * 1.87, -0.24, 0], [1, 1, 1]).name = "hard-cover"
    mesh(pageStack(side), pageEdge, [side * 1.86, 0, 0], [1, 1, 1]).name = "page-stack"
    mesh(curvedPage(side), paperSurface, [side * 1.86, 0, 0], [1, 1, 1]).name = "open-paper"
    // Visible page edges; no texture downloads, outlines or expensive effects.
    for (let line = 0; line < 5; line++) {
      const edge = geometry(new THREE.PlaneGeometry(3.36, .006, 40, 1))
      const positions = edge.attributes.position
      const base = -.045 + line * .035
      for (let i = 0; i < positions.count; i++) {
        const drop = bookPaperHeight(positions.getX(i) + side * 1.86, 2.215) - .145
        positions.setY(i, positions.getY(i) + base + drop * (base + .08) / .22)
      }
      edge.computeVertexNormals()
      mesh(edge, pageLine, [side * 1.86, 0, 2.224], [1, 1, 1]).castShadow = false
      mesh(box, pageLine, [side * 3.604, -.045 + line * .035, 0], [0.008, 0.006, 4.25]).castShadow = false
    }
  }
  mesh(slab(.26, 4.64, .14, .025), binding, [0, -0.2, 0], [1, 1, 1]).name = "spine"
  const creaseShape = geometry(new THREE.PlaneGeometry(0.25, 4.44, 12, 12))
  creaseShape.rotateX(-Math.PI / 2)
  const creasePositions = creaseShape.getAttribute("position")
  for (let i = 0; i < creasePositions.count; i++) {
    creasePositions.setZ(i, paperZ(creasePositions.getZ(i)))
    creasePositions.setY(i, bookPaperHeight(creasePositions.getX(i), creasePositions.getZ(i)))
  }
  const creaseColors: number[] = []
  for (let i = 0; i < creasePositions.count; i++) {
    const shade = 1 - .28 * Math.exp(-Math.abs(creasePositions.getX(i)) * 5)
    creaseColors.push(shade, shade, shade * .99)
  }
  creaseShape.setAttribute("color", new THREE.Float32BufferAttribute(creaseColors, 3))
  creaseShape.computeVertexNormals()
  mesh(creaseShape, paperSurface, [0, 0, 0], [1, 1, 1]).name = "paper-gutter"
  // A cloth bookmark extends beyond the lower edge, making the book silhouette legible.
  const bookmark = new THREE.Shape()
  bookmark.moveTo(-0.12, 0); bookmark.lineTo(0.12, 0); bookmark.lineTo(0.12, 0.45)
  bookmark.lineTo(0, 0.34); bookmark.lineTo(-0.12, 0.45); bookmark.closePath()
  const bookmarkGeometry = geometry(new THREE.ShapeGeometry(bookmark))
  bookmarkGeometry.rotateX(Math.PI / 2)
  mesh(bookmarkGeometry, ribbon, [0, -.07, 2.08], [1, 1, 1]).material.side = THREE.DoubleSide

  mesh(box, ribbon, [0, -.075, -2.3], [.18, .025, .35]).name = "upper-bookmark"

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
  const leafSurface = material("#eee3cc")
  leafSurface.map = paperGrain
  leafSurface.side = THREE.DoubleSide
  const turningShape = geometry(new THREE.PlaneGeometry(3.61, 4.44, 64, 8))
  turningShape.rotateX(-Math.PI / 2)
  turningShape.translate(3.61 / 2, 0, 0)
  const rest = turningShape.attributes.position.array.slice()
  const turningMesh = mesh(turningShape, leafSurface, [0, 0, 0], [1, 1, 1], turnLeaf)
  turningMesh.frustumCulled = false // This small dynamic leaf changes bounds only while turning.
  turnLeaf.visible = false
  let disposed = false
  return {
    root, geometries, materials, textures,
    setPose(pose: BookPose) {
      secondPage.visible = pose.page === 1
      turnLeaf.visible = pose.turning
      if (pose.turning) {
        const positions = turningShape.attributes.position
        for (let i = 0; i < positions.count; i++) {
          const point = turningPaperPoint(rest[i * 3], rest[i * 3 + 2], pose.leafAngle)
          positions.setXYZ(i, point.x, point.y, point.z)
        }
        positions.needsUpdate = true
        turningShape.computeVertexNormals()
      }
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
