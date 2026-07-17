import { describe, expect, it, vi } from "vitest"

import {
    FUNCTION_WARS_CANVAS_ASPECT_RATIO,
    canvasToWorld,
    FunctionWarsRenderer,
    getFunctionWarsBackgroundMotion,
    getFunctionWarsCanvasMetrics,
    getFunctionWarsCoverRect,
    getFunctionWarsRoundedRectRadius,
    getFunctionWarsUnitVisualDrop,
    type FunctionWarsRenderScene,
    worldToCanvas,
} from "./renderer"

describe("function wars renderer metrics", () => {
    it("keeps a 3:2 CSS stage and scales the backing store for DPR", () => {
        const metrics = getFunctionWarsCanvasMetrics(900, 2)

        expect(metrics.cssWidth).toBe(900)
        expect(metrics.cssHeight).toBe(900 / FUNCTION_WARS_CANVAS_ASPECT_RATIO)
        expect(metrics.pixelWidth).toBe(1800)
        expect(metrics.pixelHeight).toBe(1200)
        expect(metrics.scaleX).toBe(37.5)
        expect(metrics.scaleY).toBeCloseTo(42.857142857)
    })

    it("uses a safe DPR for invalid or excessively large values", () => {
        expect(getFunctionWarsCanvasMetrics(360, 0).dpr).toBe(1)
        expect(getFunctionWarsCanvasMetrics(360, Number.NaN).dpr).toBe(1)
        expect(getFunctionWarsCanvasMetrics(360, 8).dpr).toBe(3)
    })

    it("rejects zero-sized inner rectangles and clamps negative radii", () => {
        expect(getFunctionWarsRoundedRectRadius(-0.5, 4, 2)).toBeNull()
        expect(getFunctionWarsRoundedRectRadius(4, 0, 2)).toBeNull()
        expect(getFunctionWarsRoundedRectRadius(4, 2, -5)).toBe(1)
    })

    it("maps world coordinates to CSS pixels and back", () => {
        const metrics = getFunctionWarsCanvasMetrics(720, 2)
        const world = { x: 4.25, y: -2.5 }
        const canvas = worldToCanvas(world, metrics)

        expect(worldToCanvas({ x: -12, y: 7 }, metrics)).toEqual({ x: 0, y: 0 })
        expect(worldToCanvas({ x: 12, y: -7 }, metrics)).toEqual({ x: 720, y: 480 })
        expect(canvasToWorld(canvas, metrics).x).toBeCloseTo(world.x)
        expect(canvasToWorld(canvas, metrics).y).toBeCloseTo(world.y)
    })

    it.each([
        { targetWidth: 900, targetHeight: 600, overscan: 25.2, offsetX: 9, offsetY: 2.1 },
        { targetWidth: 360, targetHeight: 240, overscan: 10.08, offsetX: -3.6, offsetY: -0.84 },
    ])("overscans background art without exposing stage edges", (viewport) => {
        const rect = getFunctionWarsCoverRect(1280, 768, viewport.targetWidth, viewport.targetHeight, viewport)

        expect(rect.x).toBeLessThanOrEqual(0)
        expect(rect.y).toBeLessThanOrEqual(0)
        expect(rect.x + rect.width).toBeGreaterThanOrEqual(viewport.targetWidth)
        expect(rect.y + rect.height).toBeGreaterThanOrEqual(viewport.targetHeight)
    })

    it("keeps reduced-motion backgrounds neutral and bounds animated parallax", () => {
        const width = 900
        const height = 600

        expect(getFunctionWarsBackgroundMotion("grassland", width, height, 0)).toEqual({
            sky: { x: 0, y: 0 },
            far: { x: 0, y: 0 },
        })

        const limits = {
            grassland: { x: width * 0.01, y: height * 0.003 },
            canyon: { x: width * 0.007, y: height * 0.0025 },
            space: { x: width * 0.004, y: height * 0.0035 },
        } as const
        for (const theme of ["grassland", "canyon", "space"] as const) {
            const motion = getFunctionWarsBackgroundMotion(theme, width, height, 12_345)
            expect(Math.abs(motion.sky.x)).toBeLessThanOrEqual(width * 0.002)
            expect(Math.abs(motion.sky.y)).toBeLessThanOrEqual(height * 0.0015)
            expect(Math.abs(motion.far.x)).toBeGreaterThan(0)
            expect(Math.abs(motion.far.x)).toBeLessThanOrEqual(limits[theme].x)
            expect(Math.abs(motion.far.y)).toBeLessThanOrEqual(limits[theme].y)
        }
    })

    it("visually settles unit art onto its nearest support", () => {
        const desktop = getFunctionWarsCanvasMetrics(900, 2)
        const mobile = getFunctionWarsCanvasMetrics(360, 3)
        const unit = { x: -10, y: -4 }
        const support = {
            id: "player-support",
            shape: "rect" as const,
            x: -10,
            y: -4.59,
            width: 1.4,
            height: 0.7,
            destructible: false,
        }

        expect(getFunctionWarsUnitVisualDrop(unit, [support], desktop, 42)).toBeCloseTo(5.6657, 3)
        expect(getFunctionWarsUnitVisualDrop(unit, [support], mobile, 26.52)).toBeCloseTo(1.1971, 3)
        expect(getFunctionWarsUnitVisualDrop(unit, [], desktop, 42)).toBe(0)
        expect(getFunctionWarsUnitVisualDrop(unit, [{ ...support, destructible: true }], desktop, 42)).toBeCloseTo(5.6657, 3)
    })

    it("renders relay-only objectives without loading the crate bitmap", () => {
        const getContext = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockReturnValue({} as CanvasRenderingContext2D)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        const internals = renderer as unknown as {
            draw: (frameNow: number) => void
            loadAsset: (key: string, path: string) => void
        }
        const loadAsset = vi.fn()
        internals.draw = vi.fn()
        internals.loadAsset = loadAsset

        try {
            renderer.setScene({
                theme: "space",
                obstacles: [],
                craters: [],
                crates: [{ id: "relay", type: "relay", x: 0, y: 0, active: true }],
                traces: [],
                units: [],
            })

            expect(loadAsset.mock.calls.map(([key]) => key)).not.toContain("unit:crate")
        } finally {
            renderer.destroy()
            getContext.mockRestore()
        }
    })

    it("delays impact effects until the trace ends and resets shot identity", () => {
        const getContext = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockReturnValue({} as CanvasRenderingContext2D)
        let now = 100
        const performanceNow = vi.spyOn(performance, "now").mockImplementation(() => now)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        const internals = renderer as unknown as {
            animationKey: string | number | null
            animationStartedAt: number
            seenImpactId: string | null
            pendingImpact: unknown
            pendingDestroyedUnits: Map<string, number>
            pendingUnitSnapshots: Map<string, unknown>
            deferredCraters: unknown[] | null
            destroyedUnits: Map<string, number>
            obstacleImpact: { obstacleId: string; startedAt: number } | null
            particles: unknown[]
            shake: number
            flash: number
            draw: (frameNow: number) => void
            flushPendingEffects: (frameNow: number) => void
            hasActiveAnimation: (frameNow: number) => boolean
        }
        internals.draw = vi.fn()
        const explosion = vi.spyOn(renderer, "triggerExplosion")
        const initialScene: FunctionWarsRenderScene = {
            theme: "grassland",
            obstacles: [],
            craters: [],
            crates: [],
            traces: [],
            units: [{ id: "enemy-1", x: 4, y: 0, side: "enemy", hp: 50, maxHp: 50, alive: true }],
        }

        try {
            renderer.setScene(initialScene)
            now = 200
            renderer.setScene({
                ...initialScene,
                craters: [{ x: 4, y: 0, radius: 0.7 }],
                traces: [{ id: "trace-1", points: [{ x: -10, y: 0 }, { x: 4, y: 0 }] }],
                units: [{ id: "enemy-1", x: 4, y: 0, side: "enemy", hp: 0, maxHp: 50, alive: false }],
                animationKey: "shot-1",
                animationDurationMs: 1_000,
                impact: { id: "impact-1", x: 4, y: 0, unitId: "enemy-1", obstacleId: "wall-1" },
            })

            expect(explosion).not.toHaveBeenCalled()
            expect(internals.pendingDestroyedUnits.get("enemy-1")).toBe(1_200)
            expect(internals.pendingUnitSnapshots.has("enemy-1")).toBe(true)
            expect(internals.deferredCraters).toEqual([])

            now = 1_199
            internals.flushPendingEffects(now)
            expect(explosion).not.toHaveBeenCalled()

            now = 1_200
            internals.flushPendingEffects(now)
            expect(explosion).toHaveBeenCalledTimes(1)
            expect(internals.destroyedUnits.get("enemy-1")).toBe(1_200)
            expect(internals.obstacleImpact).toEqual({ obstacleId: "wall-1", startedAt: 1_200 })
            expect(internals.deferredCraters).toBeNull()

            internals.particles = []
            internals.shake = 0
            internals.flash = 0
            internals.destroyedUnits.clear()
            expect(internals.hasActiveAnimation(1_459)).toBe(true)
            expect(internals.hasActiveAnimation(1_461)).toBe(false)

            now = 1_300
            renderer.setScene(initialScene)
            expect(internals.animationKey).toBeNull()
            expect(internals.seenImpactId).toBeNull()
            expect(internals.pendingImpact).toBeNull()

            now = 1_400
            renderer.setScene({
                ...initialScene,
                traces: [{ id: "trace-1", points: [{ x: -10, y: 0 }, { x: 4, y: 0 }] }],
                animationKey: "shot-1",
                animationDurationMs: 1_000,
                impact: { id: "impact-1", x: 4, y: 0 },
            })
            expect(internals.animationStartedAt).toBe(1_400)
            expect(explosion).toHaveBeenCalledTimes(1)
        } finally {
            renderer.destroy()
            performanceNow.mockRestore()
            getContext.mockRestore()
        }
    })
})
