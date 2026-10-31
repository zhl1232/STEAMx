import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { bookPaperHeight, createBookModel, turningPaperPoint } from "./book-model"
import { READING_PAGE_CORNERS } from "./book-page-layout"

describe("bound paper rather than two flat boards", () => {
  it("joins both leaves through a broad depression while keeping the entire print rectangle flat", () => {
    expect(bookPaperHeight(.43) - bookPaperHeight(0)).toBeGreaterThan(.15)
    expect(bookPaperHeight(.2)).toBeLessThan(bookPaperHeight(.4))
    for (let x = 0; x <= 3.6; x += .05) expect(bookPaperHeight(-x)).toBeCloseTo(bookPaperHeight(x), 10)
    for (let x = READING_PAGE_CORNERS[0][0]; x <= READING_PAGE_CORNERS[1][0]; x += .03) {
      for (let z = -2.02; z <= 2.02; z += .1) expect(bookPaperHeight(x, z)).toBeCloseTo(.145, 8)
    }
    const book = createBookModel()
    for (const name of ["open-paper", "paper-gutter"]) {
      for (const mesh of book.root.getObjectsByProperty("name", name) as THREE.Mesh[]) {
        const positions = mesh.geometry.attributes.position
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i) + mesh.position.x, z = positions.getZ(i)
          expect(positions.getY(i)).toBeCloseTo(bookPaperHeight(x, z), 5)
        }
      }
    }
    book.root.updateMatrixWorld(true)
    const pages = book.root.getObjectsByProperty("name", "open-paper")
    const ray = new THREE.Raycaster()
    // Verify the interpolated triangles, not just their control vertices.
    for (const x of [-3.42, -3.4, -3, -.5, -.45]) for (const z of [-2.02, -1.9, 0, 1.9, 2.02]) {
      ray.set(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0))
      const hit = ray.intersectObjects(pages)[0]
      expect(hit).toBeDefined()
      expect(hit.point.y).toBeCloseTo(.145, 6)
    }
    book.dispose()
  })

  it("rolls the turning sheet from edge to binding without shrinking its strip length", () => {
    expect(turningPaperPoint(3.61, 0, 0).toArray()).toEqual([3.61, 0, 0])
    expect(turningPaperPoint(3.61, 0, Math.PI).x).toBe(-3.61)
    for (const fraction of [.1, .25, .5, .75, .9]) {
      let length = 0, previous = turningPaperPoint(0, 0, fraction * Math.PI)
      for (let i = 1; i <= 2000; i++) {
        const point = turningPaperPoint(3.61 * i / 2000, 0, fraction * Math.PI)
        length += previous.distanceTo(point); previous = point
        expect(point.y).toBeGreaterThanOrEqual(0)
        expect(point.y).toBeLessThanOrEqual(.44001)
      }
      expect(length).toBeCloseTo(3.61, 4)
    }
  })
})
