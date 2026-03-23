import { describe, expect, it } from "vitest"

import { getCanvasMetrics } from "./canvas"

describe("getCanvasMetrics", () => {
    it("keeps drawing coordinates in CSS pixels on high-DPI screens", () => {
        const metrics = getCanvasMetrics(600, 40, 60, 2)

        expect(metrics.cssWidth).toBe(600)
        expect(metrics.cssHeight).toBe(400)
        expect(metrics.pixelWidth).toBe(1200)
        expect(metrics.pixelHeight).toBe(800)
        expect(metrics.cellWidth).toBe(10)
        expect(metrics.cellHeight).toBe(10)
        expect(metrics.dpr).toBe(2)
    })

    it("falls back to a 1x backing store for invalid devicePixelRatio values", () => {
        const metrics = getCanvasMetrics(320, 40, 60, 0)

        expect(metrics.pixelWidth).toBe(320)
        expect(metrics.pixelHeight).toBe(213)
        expect(metrics.dpr).toBe(1)
    })
})
