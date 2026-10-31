import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { fitBookCamera } from "./book-garden"
import { projectReadingPage, READING_PAGE_SIZE } from "./book-page-layout"

describe("readable text on the physical book", () => {
  it("maps every DOM corner to its paper corner after camera and viewport changes", () => {
    for (const [width, height] of [[1440, 760], [900, 580], [390, 310]]) {
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
      const fit = fitBookCamera(camera)
      for (const azimuth of [0, -0.3, 0.3]) {
        camera.position.sub(fit.center).applyAxisAngle(new THREE.Vector3(0, 1, 0), azimuth).add(fit.center)
        camera.lookAt(fit.center); camera.updateMatrixWorld()
        const { points, matrix } = projectReadingPage(camera, width, height)
        expect(matrix.every(Number.isFinite)).toBe(true)
        const { width: w, height: h } = READING_PAGE_SIZE
        for (const [index, [x, y]] of [[0, [0, 0]], [1, [w, 0]], [2, [w, h]], [3, [0, h]]] as const) {
          const denominator = matrix[3] * x + matrix[7] * y + 1
          expect((matrix[0] * x + matrix[4] * y + matrix[12]) / denominator).toBeCloseTo(points[index].x, 5)
          expect((matrix[1] * x + matrix[5] * y + matrix[13]) / denominator).toBeCloseTo(points[index].y, 5)
        }
      }
    }
  })
})
