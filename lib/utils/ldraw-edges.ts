import { BufferAttribute, BufferGeometry, Color, EdgesGeometry, LineBasicMaterial, LineSegments, Matrix4 } from 'three'
import type { Group, Material, Mesh, Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type ColoredMaterial = Material & { color: Color }

// The palette's dark greys exceed 0.06; reddish brown falls below it.
// Respect those explicit LDraw colour families rather than shifting their appearance.
function needsLightEdge(face: Color, code?: string): boolean {
  if (['1', '2', '4', '70'].includes(code ?? '')) return false
  if (['0', '8', '72', '308'].includes(code ?? '')) return true
  return 0.2126 * face.r + 0.7152 * face.g + 0.0722 * face.b < 0.06
}

/** Mix in display space to retain a subtle face tint; never mutate the face. */
export function ldrawEdgeColor(face: Color, native?: Color, code?: string, allowLight = true): string {
  if (allowLight && needsLightEdge(face, code)) {
    // Keep explicit dark families in the display-gray band, independent of face tint.
    if (['0', '8', '72', '308'].includes(code ?? '')) return '#808080'
    return `#${face.clone().convertLinearToSRGB().lerp(new Color(1, 1, 1), 0.5).convertSRGBToLinear().getHexString()}`
  }
  return `#${(native ?? face.clone().multiplyScalar(0.25)).getHexString()}`
}

// Include the requested 8 x 8 exception and the System baseplate stand-in.
const largePlates = new Set(['4268', '4196', '6490', '51262', '3811'])

function isLargePlate(object: Object3D): boolean {
  for (let part: Object3D | null = object; part; part = part.parent) {
    const name = String(part.userData.fileName || part.name).replaceAll('\\', '/').split('/').at(-1) ?? ''
    if (largePlates.has(name.replace(/\.dat$/i, ''))) return true
    if (/^(baseplate|plate)$/i.test(String(part.userData.category))) {
      // Loader flattens a part's primitives into local mesh geometry (20 LDU/stud).
      for (const child of part.children) {
        const mesh = child as Mesh
        if (!mesh.isMesh) continue
        mesh.geometry.computeBoundingBox()
        const bounds = mesh.geometry.boundingBox!
        if ((bounds.max.x - bounds.min.x) * (bounds.max.z - bounds.min.z) > 64 * 20 * 20) return true
      }
    }
  }
  return false
}

/** One cache per loader/scene, shared across steps; dispose when that scene ends. */
export function createLdrawEdgeRenderer(getFace: (code: string) => Material | null) {
  const materials = new Map<string, ColoredMaterial>()
  const fallbackGeometry = new WeakMap<BufferGeometry, BufferGeometry[]>()
  const ownedFallbacks = new Set<BufferGeometry>()
  const materialFor = (source: Material | undefined, face: ColoredMaterial, conditional = false, allowLight = true) => {
    const code = String(source?.userData.code ?? face.userData.code ?? '')
    const light = allowLight && needsLightEdge(face.color, code)
    // Native EDGE materials retain their opacity, tone mapping and shader settings.
    if (source && !light) return source
    const color = ldrawEdgeColor(face.color, undefined, code, allowLight)
    const key = `${color}:${conditional}:${source?.uuid ?? 'fallback'}`
    let material = materials.get(key)
    if (!material) {
      material = (conditional && source ? source.clone() : new LineBasicMaterial()) as ColoredMaterial
      // Preserve face identity for contrast-aware step hints, including generated edges.
      material.userData.code = code
      material.color.set(color)
      // Dark overrides need full opacity; #808080 at 0.7 still blends into black under ACES.
      material.opacity = light ? 1 : 0.7
      material.transparent = !light
      material.depthWrite = false
      material.toneMapped = false
      materials.set(key, material)
      // Scene disposal may release a shared material before this cache is disposed.
      material.addEventListener('dispose', () => materials.delete(key))
    }
    return material
  }

  return {
    prepare(model: Group) {
      model.updateMatrixWorld(true)
      const inverse = new Matrix4().copy(model.matrixWorld).invert()
      const batches = new Map<Material, BufferGeometry[]>()
      const remove: LineSegments[] = []
      const add = (geometry: BufferGeometry, matrix: Matrix4, material: Material) => {
        const transformed = geometry.clone().applyMatrix4(matrix)
        const batch = batches.get(material) ?? []
        batch.push(transformed)
        batches.set(material, batch)
      }
      model.traverse((object) => {
        const line = object as LineSegments & { isConditionalLine?: boolean }
        const matrix = new Matrix4().multiplyMatrices(inverse, object.matrixWorld)
        if (line.isLineSegments) {
          const sourceMaterials = Array.isArray(line.material) ? line.material : [line.material]
          const replacements = sourceMaterials.map((source) => {
            const face = getFace(String(source.userData.code)) as ColoredMaterial | null
            return face?.color ? materialFor(source, face, !!line.isConditionalLine, !isLargePlate(line)) : source
          })
          if (line.isConditionalLine) {
            // Keep control0/control1/direction in their original coordinate system.
            line.material = Array.isArray(line.material) ? replacements : replacements[0]
          } else {
            const groups = Array.isArray(line.material) && line.geometry.groups.length ? line.geometry.groups : [{ start: 0, count: line.geometry.index?.count ?? line.geometry.getAttribute('position').count, materialIndex: 0 }]
            for (const group of groups) {
              const geometry = positionsForRange(line.geometry, group.start, group.count)
              add(geometry, matrix, replacements[group.materialIndex ?? 0])
              geometry.dispose()
            }
            remove.push(line)
          }
          line.visible = true
          return
        }
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        // Loader flattens a part's primitives into siblings. Only fill genuinely missing edges.
        if (mesh.parent?.children.some((child) => (child as LineSegments).isLineSegments)) return
        const faces = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as ColoredMaterial[]
        const groups = Array.isArray(mesh.material) && mesh.geometry.groups.length ? mesh.geometry.groups : [{ start: 0, count: mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count, materialIndex: 0 }]
        let edges = fallbackGeometry.get(mesh.geometry)
        if (!edges) {
          edges = groups.map((group) => {
            const surface = positionsForRange(mesh.geometry, group.start, group.count)
            const edge = new EdgesGeometry(surface, 30)
            surface.dispose()
            ownedFallbacks.add(edge)
            return edge
          })
          fallbackGeometry.set(mesh.geometry, edges)
        }
        groups.forEach((group, index) => {
          const face = faces[group.materialIndex ?? 0]
          if (face?.color) add(edges[index], matrix, materialFor(undefined, face, false, !isLargePlate(mesh)))
        })
      })
      for (const line of remove) line.removeFromParent()
      for (const [material, geometries] of batches) {
        const merged = mergeGeometries(geometries)
        for (const geometry of geometries) geometry.dispose()
        if (merged) model.add(new LineSegments(merged, material))
      }
    },
    dispose() {
      for (const material of materials.values()) material.dispose()
      for (const geometry of ownedFallbacks) geometry.dispose()
      materials.clear()
      ownedFallbacks.clear()
    },
  }
}

function positionsForRange(source: BufferGeometry, start: number, count: number): BufferGeometry {
  const positions = source.getAttribute('position')
  const values = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const index = source.index ? source.index.getX(start + i) : start + i
    values[i * 3] = positions.getX(index)
    values[i * 3 + 1] = positions.getY(index)
    values[i * 3 + 2] = positions.getZ(index)
  }
  return new BufferGeometry().setAttribute('position', new BufferAttribute(values, 3))
}
