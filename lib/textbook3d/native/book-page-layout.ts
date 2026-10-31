import * as THREE from "three"

export const READING_PAGE_SIZE = { width: 320, height: 430 }
export const READING_PAGE_CORNERS = [
  [-3.28, 0.145, -1.86], [-0.43, 0.145, -1.86],
  [-0.43, 0.145, 1.86], [-3.28, 0.145, 1.86],
] as const

/** Map a live DOM page onto the book plane; text and controls remain accessible. */
export function projectReadingPage(camera: THREE.Camera, width: number, height: number) {
  const points = READING_PAGE_CORNERS.map(([x, y, z]) => {
    const p = new THREE.Vector3(x, y, z).project(camera)
    return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }
  })
  const [a, b, c, d] = points
  const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x
  const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y
  const determinant = dx1 * dy2 - dx2 * dy1
  const g = Math.abs(determinant) < 1e-8 ? 0 : (dx3 * dy2 - dx2 * dy3) / determinant
  const h = Math.abs(determinant) < 1e-8 ? 0 : (dx1 * dy3 - dx3 * dy1) / determinant
  const w = READING_PAGE_SIZE.width, hh = READING_PAGE_SIZE.height
  const matrix = [
    (b.x - a.x + g * b.x) / w, (b.y - a.y + g * b.y) / w, 0, g / w,
    (d.x - a.x + h * d.x) / hh, (d.y - a.y + h * d.y) / hh, 0, h / hh,
    0, 0, 1, 0, a.x, a.y, 0, 1,
  ]
  return { points, matrix, transform: `matrix3d(${matrix.join(",")})` }
}
