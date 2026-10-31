import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { createBookGarden, fitBookCamera } from "./book-garden"
import { bookLayoutFor, projectReadingPage, readingPageSize } from "./book-page-layout"

describe("readable text on the physical book", () => {
  it("maps every DOM corner to its paper corner after camera and viewport changes", () => {
    for (const [width, height] of [[1440, 760], [900, 580], [390, 730], [844, 278]]) {
      const garden = createBookGarden()
      const layout = bookLayoutFor(width, height)
      garden.setLayout(layout)
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
      const fit = fitBookCamera(camera, garden.root, layout)
      for (const azimuth of [0, -0.3, 0.3]) {
        camera.position.sub(fit.center).applyAxisAngle(new THREE.Vector3(0, 1, 0), azimuth).add(fit.center)
        camera.lookAt(fit.center); camera.updateMatrixWorld()
        const { points, matrix } = projectReadingPage(camera, width, height, garden.paper, layout)
        expect(matrix.every(Number.isFinite)).toBe(true)
        const { width: w, height: h } = readingPageSize(layout)
        for (const [index, [x, y]] of [[0, [0, 0]], [1, [w, 0]], [2, [w, h]], [3, [0, h]]] as const) {
          const denominator = matrix[3] * x + matrix[7] * y + 1
          expect((matrix[0] * x + matrix[4] * y + matrix[12]) / denominator).toBeCloseTo(points[index].x, 5)
          expect((matrix[1] * x + matrix[5] * y + matrix[13]) / denominator).toBeCloseTo(points[index].y, 5)
        }
      }
      garden.dispose()
    }
  })

  it("uses the phone's page width without stretching the approved plant meshes", () => {
    const garden = createBookGarden()
    const plantScales = Object.values(garden.plants).map((plant) => plant.scale.clone())
    for (const [width, height] of [[390, 730], [844, 278]]) {
      const layout = bookLayoutFor(width, height)
      garden.setLayout(layout)
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
      fitBookCamera(camera, garden.root, layout)
      const { points } = projectReadingPage(camera, width, height, garden.paper, layout)
      expect(points[1].x - points[0].x).toBeGreaterThan(width === 390 ? 280 : 340)
      for (const point of points) {
        expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(width)
        expect(point.y).toBeGreaterThan(0); expect(point.y).toBeLessThan(height)
      }
      Object.values(garden.plants).forEach((plant, index) => expect(plant.scale.equals(plantScales[index])).toBe(true))
    }
    garden.dispose()
  })
})
