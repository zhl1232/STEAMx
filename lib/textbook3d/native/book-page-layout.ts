import * as THREE from "three"

export const READING_PAGE_SIZE = { width: 320, height: 430 }
export type BookLayout = "spread" | "portrait" | "landscape"
export const readingPageSize = (layout: BookLayout) => layout === "portrait"
  ? { width: 340, height: 350 } : layout === "landscape" ? { width: 300, height: 350 } : READING_PAGE_SIZE
export const bookLayoutFor = (width: number, height: number): BookLayout =>
  width < 640 && height > width * 1.15 ? "portrait" : height < 440 ? "landscape" : "spread"
export const READING_PAGE_CORNERS = [
  [-3.48, 0.145, -2.02], [-0.26, 0.145, -2.02],
  [-0.26, 0.145, 2.02], [-3.48, 0.145, 2.02],
] as const

/** Map a live DOM page onto the book plane; text and controls remain accessible. */
export function projectReadingPage(camera: THREE.Camera, width: number, height: number, paper?: THREE.Object3D, layout: BookLayout = "spread", controls = false) {
  // Portrait: the same book opens vertically, with upright print on its lower leaf.
  const corners = controls ? (layout === "portrait"
    ? [[0.75, 0.148, -1.86], [0.75, 0.148, 1.86], [0.2, 0.148, 1.86], [0.2, 0.148, -1.86]]
    : [[0.45, 0.148, 1.5], [3.22, 0.148, 1.5], [3.22, 0.148, 2.18], [0.45, 0.148, 2.18]])
    : layout === "portrait" ? [READING_PAGE_CORNERS[1], READING_PAGE_CORNERS[2], READING_PAGE_CORNERS[3], READING_PAGE_CORNERS[0]] : READING_PAGE_CORNERS
  const points = corners.map(([x, y, z]) => {
    const p = new THREE.Vector3(x, y, z)
    if (paper) p.applyMatrix4(paper.matrixWorld)
    p.project(camera)
    return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }
  })
  const [a, b, c, d] = points
  const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x
  const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y
  const determinant = dx1 * dy2 - dx2 * dy1
  const g = Math.abs(determinant) < 1e-8 ? 0 : (dx3 * dy2 - dx2 * dy3) / determinant
  const h = Math.abs(determinant) < 1e-8 ? 0 : (dx1 * dy3 - dx3 * dy1) / determinant
  const size = controls ? { width: 320, height: 52 } : readingPageSize(layout)
  const w = size.width, hh = size.height
  const matrix = [
    (b.x - a.x + g * b.x) / w, (b.y - a.y + g * b.y) / w, 0, g / w,
    (d.x - a.x + h * d.x) / hh, (d.y - a.y + h * d.y) / hh, 0, h / hh,
    0, 0, 1, 0, a.x, a.y, 0, 1,
  ]
  return { points, matrix, transform: `matrix3d(${matrix.join(",")})` }
}
