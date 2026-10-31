import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { createBookGarden, fitBookCamera } from "./book-garden"
import { BOOK_CORNER_SIZE, bookCornerCorners, bookLayoutFor, projectBookSurface, projectReadingPage, readingPageSize } from "./book-page-layout"

describe("readable text on the physical book", () => {
  it("maps every DOM corner to its paper corner after camera and viewport changes", () => {
    for (const [width, height] of [[1440, 760], [900, 580], [390, 730], [844, 390], [873, 412]]) {
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
    for (const [width, height] of [[390, 730], [844, 390], [873, 412]]) {
      const layout = bookLayoutFor(width, height)
      garden.setLayout(layout)
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
      fitBookCamera(camera, garden.root, layout)
      const { points } = projectReadingPage(camera, width, height, garden.paper, layout)
      const printWidth = points[1].x - points[0].x
      const printHeight = points[3].y - points[0].y
      // Same-source projection heights measured before this framing change;
      // geometry evidence only, not a browser/typography acceptance claim.
      const previousHeight = width === 390 ? 292.6 : width === 844 ? 296.98 : 313.73
      expect(printHeight).toBeGreaterThan(previousHeight)
      // With the fixed bars gone, a normal landscape sheet must fill height,
      // not gain width by flattening the book into the previous 200px ribbon.
      expect(printWidth / readingPageSize(layout).width * 17).toBeGreaterThan(14)
      if (layout === "landscape") {
        expect(printHeight).toBeGreaterThan(height * .73)
        expect(printWidth / printHeight).toBeLessThan(1)
      }
      for (const point of points) {
        expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(width)
        expect(point.y).toBeGreaterThan(0); expect(point.y).toBeLessThan(height)
      }
      Object.values(garden.plants).forEach((plant, index) => expect(plant.scale.equals(plantScales[index])).toBe(true))
    }
    garden.dispose()
  })

  it("keeps corner actions on the paper with usable projected phone targets", () => {
    const garden = createBookGarden()
    for (const [width, height] of [[390, 844], [844, 390], [873, 412], [1440, 1000]]) {
      const layout = bookLayoutFor(width, height)
      garden.setLayout(layout)
      const camera = new THREE.PerspectiveCamera(38, width / height, .1, 100)
      fitBookCamera(camera, garden.root, layout)
      for (const previous of [true, false]) {
        const corners = bookCornerCorners(layout, previous)
        for (const [x, , z] of corners) {
          expect(Math.abs(x)).toBeLessThanOrEqual(3.61)
          expect(Math.abs(z)).toBeLessThan(2.22)
        }
        const { points } = projectBookSurface(camera, width, height, corners, { width: BOOK_CORNER_SIZE, height: BOOK_CORNER_SIZE }, garden.paper)
        for (const point of points) {
          expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(width)
          expect(point.y).toBeGreaterThan(0); expect(point.y).toBeLessThan(height)
        }
        const distance = (a: number, b: number) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y)
        expect(Math.min(distance(0, 1), distance(2, 3))).toBeGreaterThanOrEqual(44)
        expect(Math.min(distance(1, 2), distance(3, 0))).toBeGreaterThanOrEqual(44)
      }
    }
    garden.dispose()
  })
})
