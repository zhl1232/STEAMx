import { describe, expect, it, vi } from "vitest"
import { getFunctionWarsLevel } from "../../../lib/playground/function-wars-levels"

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

function mockCanvasContext() {
    const gradient = { addColorStop: vi.fn() }
    const methods = new Map<string, ReturnType<typeof vi.fn>>()
    const context = new Proxy({} as CanvasRenderingContext2D, {
        get(target, key: string) {
            if (key in target) return Reflect.get(target, key)
            if (!methods.has(key)) {
                methods.set(key, vi.fn(key === "measureText"
                    ? (text: string) => ({ width: text.length * 6 })
                    : key.startsWith("create") ? () => gradient : () => undefined))
            }
            return methods.get(key)
        },
    })
    return context
}

describe("function wars renderer metrics", () => {
    it("keeps a 12:7 CSS stage and scales the backing store for DPR", () => {
        const metrics = getFunctionWarsCanvasMetrics(900, 2)

        expect(metrics.cssWidth).toBe(900)
        expect(metrics.cssHeight).toBe(900 / FUNCTION_WARS_CANVAS_ASPECT_RATIO)
        expect(metrics.pixelWidth).toBe(1800)
        expect(metrics.pixelHeight).toBe(1050)
        expect(metrics.scaleX).toBe(37.5)
        expect(metrics.scaleY).toBe(metrics.scaleX)
    })

    it.each([
        { width: 1400, height: 560, scale: 40, offsetX: 220, offsetY: 0 },
        { width: 360, height: 720, scale: 15, offsetX: 0, offsetY: 255 },
    ])("centers a complete undistorted world in $width×$height", ({ width, height, scale, offsetX, offsetY }) => {
        const metrics = getFunctionWarsCanvasMetrics(width, 2, height)
        expect(metrics.cssWidth).toBe(width)
        expect(metrics.cssHeight).toBe(height)
        expect(metrics.pixelWidth).toBe(width * 2)
        expect(metrics.pixelHeight).toBe(height * 2)
        expect(metrics.scaleX).toBe(scale)
        expect(metrics.scaleY).toBe(scale)
        expect(metrics.offsetX).toBe(offsetX)
        expect(metrics.offsetY).toBe(offsetY)
        expect(worldToCanvas({ x: -12, y: 7 }, metrics)).toEqual({ x: offsetX, y: offsetY })
        expect(worldToCanvas({ x: 12, y: -7 }, metrics)).toEqual({ x: width - offsetX, y: height - offsetY })
        expect(worldToCanvas({ x: 0, y: 0 }, metrics)).toEqual({ x: width / 2, y: height / 2 })
        const point = { x: 3.75, y: -2.25 }
        const restored = canvasToWorld(worldToCanvas(point, metrics), metrics)
        expect(restored.x).toBeCloseTo(point.x)
        expect(restored.y).toBeCloseTo(point.y)
        expect(worldToCanvas({ x: 1, y: 0 }, metrics).x - width / 2).toBeCloseTo(height / 2 - worldToCanvas({ x: 0, y: 1 }, metrics).y)
    })

    it("resizes a panoramic backing store while keeping sparse axes when the grid is hidden", () => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const canvas = document.createElement("canvas")
        const renderer = new FunctionWarsRenderer(canvas)
        try {
            renderer.resize(1400, 2, 560)
            expect(canvas.width).toBe(2800)
            expect(canvas.height).toBe(1120)
            expect(canvas.style.height).toBe("560px")
            const scene: FunctionWarsRenderScene = { theme: "grassland", obstacles: [], craters: [], crates: [], traces: [], units: [{ id: "player", side: "player", x: -10, y: -4 }], activeSide: "player", gridVisible: false }
            vi.mocked(context.fillText).mockClear()
            vi.mocked(context.lineTo).mockClear()
            renderer.setScene(scene)
            expect(context.rect).toHaveBeenCalledWith(220, 0, 960, 560)
            expect(context.lineTo).toHaveBeenCalledWith(1180, 440)
            expect(context.lineTo).not.toHaveBeenCalledWith(1400, 440)
            const texts = vi.mocked(context.fillText).mock.calls.map(([text]) => text)
            expect(texts).toContain("x →")
            expect(texts).toContain("4")
            expect(texts).toContain("发射原点 (0,0)")
            // Minor grid lines disappear, while the local origin's vertical axis remains.
            expect(context.lineTo).not.toHaveBeenCalledWith(380, 560)
            vi.mocked(context.lineTo).mockClear()
            renderer.setScene({ ...scene, gridVisible: true })
            expect(context.lineTo).toHaveBeenCalledWith(380, 560)
            renderer.resize(1400, 2, 210)
            vi.mocked(context.fillText).mockClear()
            renderer.setScene(scene)
            expect(context.fillText).toHaveBeenCalledWith("炮口(0,0)", expect.any(Number), expect.any(Number))
        } finally {
            renderer.destroy()
            getContext.mockRestore()
        }
    })

    it.each([320, 390, 900])("preserves world circles and slopes at %ipx", (width) => {
        const metrics = getFunctionWarsCanvasMetrics(width, 2)
        const center = worldToCanvas({ x: 1, y: 1 }, metrics)
        const horizontal = worldToCanvas({ x: 3, y: 1 }, metrics)
        const vertical = worldToCanvas({ x: 1, y: 3 }, metrics)

        expect(horizontal.x - center.x).toBeCloseTo(center.y - vertical.y)
        expect(metrics.scaleX).toBeCloseTo(metrics.scaleY)
    })

    it.each(["grassland", "canyon", "space"] as const)("renders readable local coordinates and circular geometry in %s", (theme) => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        try {
            renderer.resize(360, 2)
            renderer.setScene({
                theme,
                groundVisible: false,
                gridVisible: true,
                activeSide: "guest",
                units: [
                    { id: "cannon", side: "guest", x: 10, y: -2, facing: "left" },
                    { id: "target", side: "host", x: 2, y: 0 },
                ],
                obstacles: [{ id: "rock", shape: "circle", x: 0, y: 0, radius: 1.5, destructible: true }],
                craters: [], crates: [], traces: [],
            })
            const texts = vi.mocked(context.fillText).mock.calls.map(([text]) => text)
            expect(texts).toContain("炮口(0,0)")
            expect(texts).toContain("1 (8,2)")
            expect(texts).toContain("← x")
            expect(context.arc).toHaveBeenCalledWith(180, 105, 22.5, 0, Math.PI * 2)
            expect(vi.mocked(context.fillText).mock.calls.every(([, x, y]) => x >= 0 && x <= 360 && y >= 0 && y <= 210)).toBe(true)
        } finally {
            renderer.destroy()
            getContext.mockRestore()
        }
    })

    it.each([296, 360, 900])("keeps final challenge label boxes separated and in bounds at %ipx", (width) => {
        const context = mockCanvasContext()
        // Approximate native system-font metrics, including wider Chinese glyphs.
        vi.mocked(context.measureText).mockImplementation((text) => ({
            width: [...text].reduce((sum, character) => sum + (character.charCodeAt(0) > 127 ? 11 : 6.5), 0),
        } as TextMetrics))
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        const level = getFunctionWarsLevel(14)
        try {
            renderer.resize(width)
            vi.mocked(context.fillText).mockClear()
            renderer.setScene({
                theme: level.theme, groundVisible: false, gridVisible: false, activeSide: "player",
                units: [
                    { id: "player", side: "player", ...level.player },
                    ...level.enemies.map((enemy) => ({ id: enemy.id, side: "enemy" as const, ...enemy.position, armored: enemy.type === "armored" })),
                ],
                obstacles: level.obstacles.map((obstacle) => ({ ...obstacle, shape: obstacle.kind })),
                craters: [], traces: [],
                crates: (level.relays ?? []).map((relay) => ({ id: relay.id, type: "relay" as const, ...relay.position })),
            })
            const labels = vi.mocked(context.fillText).mock.calls.filter(([text]) => text.includes("("))
            expect(labels).toHaveLength(6)
            expect(labels.map(([text]) => text)).toContain(width < 480 ? "1 (13,1.2)" : "目标 1 (13,1.2)")
            const boxes = labels.map(([text, x, y]) => {
                const labelWidth = context.measureText(text).width + 12
                return { left: x - labelWidth / 2, right: x + labelWidth / 2, top: y - 9, bottom: y + 9 }
            })
            for (let index = 0; index < boxes.length; index += 1) {
                const box = boxes[index]
                expect(box.left).toBeGreaterThanOrEqual(0)
                expect(box.right).toBeLessThanOrEqual(width)
                expect(box.top).toBeGreaterThanOrEqual(0)
                expect(box.bottom).toBeLessThanOrEqual(width / FUNCTION_WARS_CANVAS_ASPECT_RATIO)
                for (const other of boxes.slice(index + 1)) {
                    expect(box.right <= other.left || other.right <= box.left || box.bottom <= other.top || other.bottom <= box.top).toBe(true)
                }
            }
        } finally {
            renderer.destroy()
            getContext.mockRestore()
        }
    })

    it("keeps coordinate ticks clear of the top HUD and the x direction label", () => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        try {
            renderer.resize(900)
            vi.mocked(context.fillText).mockClear()
            renderer.setScene({
                theme: "grassland", groundVisible: false, gridVisible: true,
                activeSide: "player",
                units: [{ id: "cannon", side: "player", x: -10, y: -4 }],
                obstacles: [], craters: [], crates: [], traces: [],
            })
            expect(context.fillText).not.toHaveBeenCalledWith("10", 80, 37.5)
            expect(context.fillText).not.toHaveBeenCalledWith("2", 150, 417.5)
            expect(context.fillText).toHaveBeenCalledWith("x →", 138.75, 417.5)
            // The launch marker remains on the physical world origin.
            expect(context.arc).toHaveBeenCalledWith(75, 412.5, 4, 0, Math.PI * 2)
            expect(context.setLineDash).toHaveBeenCalledWith([2, 3])
        } finally {
            renderer.destroy()
            getContext.mockRestore()
        }
    })

    it("shows static previews separately from prior traces and retains the impact position", () => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        try {
            renderer.resize(360)
            renderer.setScene({
                theme: "space", groundVisible: false, gridVisible: false,
                units: [], obstacles: [], craters: [], crates: [], traces: [],
                previewTraces: [{ id: "preview", points: [{ x: -10, y: 0 }, { x: 0, y: 2 }] }],
                ghostTraces: [{ id: "previous", points: [{ x: -10, y: 0 }, { x: 0, y: -2 }] }],
                impact: { id: "hit", x: 0, y: -2 },
            })
            expect(context.setLineDash).toHaveBeenCalledWith([6, 5])
            expect(context.setLineDash).toHaveBeenCalledWith([5, 6])
            expect(context.lineTo).toHaveBeenCalledWith(180, 75)
            expect(context.lineTo).toHaveBeenCalledWith(180, 135)
            expect(context.arc).toHaveBeenCalledWith(180, 135, 5, 0, Math.PI * 2)
            // No animation key is needed to show the full preview.
            expect(context.moveTo).toHaveBeenCalledWith(30, 105)
        } finally {
            renderer.destroy()
            getContext.mockRestore()
        }
    })

    it.each([false, true])("shows semantic endpoint labels without shot effects with reduced motion %s", (reducedMotion) => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        const explosion = vi.spyOn(renderer, "triggerExplosion")
        const internals = renderer as unknown as {
            particles: unknown[]
            shake: number
            flash: number
            animationKey: string | number | null
            handleMotionPreferenceChange: (event: MediaQueryListEvent) => void
        }
        try {
            renderer.resize(360)
            internals.handleMotionPreferenceChange({ matches: reducedMotion } as MediaQueryListEvent)
            vi.mocked(context.fillText).mockClear()
            renderer.setScene({
                theme: "grassland", groundVisible: false, gridVisible: false,
                units: [], obstacles: [], craters: [], crates: [], traces: [],
                feedbackLabels: [
                    { x: -8, y: 3, text: "射程耗尽 · 36/36", preview: true },
                    { x: 8, y: -3, text: "击中钢板" },
                ],
            })
            const texts = vi.mocked(context.fillText).mock.calls.map(([text]) => text)
            expect(texts).toContain("预览 · 射程耗尽 · 36/36")
            expect(texts).toContain("击中钢板")
            expect(context.arc).toHaveBeenCalledWith(60, 60, 4, 0, Math.PI * 2)
            expect(context.arc).toHaveBeenCalledWith(300, 150, 4, 0, Math.PI * 2)
            expect(explosion).not.toHaveBeenCalled()
            expect(internals.particles).toEqual([])
            expect(internals.shake).toBe(0)
            expect(internals.flash).toBe(0)
            expect(internals.animationKey).toBeNull()
        } finally {
            renderer.destroy()
            getContext.mockRestore()
        }
    })

    it("filters invalid endpoints before capping feedback at four labels", () => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        try {
            renderer.resize(900)
            vi.mocked(context.fillText).mockClear()
            renderer.setScene({
                theme: "space", units: [], obstacles: [], craters: [], crates: [], traces: [],
                feedbackLabels: [
                    { x: NaN, y: 0, text: "invalid" },
                    { x: 0, y: Infinity, text: "invalid" },
                    { x: 13, y: 0, text: "invalid" },
                    { x: 0, y: -8, text: "invalid" },
                    { x: -12, y: 7, text: "到达边界" },
                    { x: 12, y: -7, text: "分裂点" },
                    { x: -8, y: -3, text: "击中钢板" },
                    { x: 8, y: 3, text: "射程耗尽 · 36/36" },
                    { x: 0, y: 0, text: "fifth" },
                ],
            })
            const labels = vi.mocked(context.fillText).mock.calls.filter(([text]) => /到达边界|分裂点|击中钢板|射程耗尽|invalid|fifth/.test(text))
            expect(labels.map(([text]) => text)).toEqual(["到达边界", "分裂点", "击中钢板", "射程耗尽 · 36/36"])
            for (const [text, x, y] of labels) {
                const halfWidth = (context.measureText(text).width + 12) / 2
                expect(x - halfWidth).toBeGreaterThanOrEqual(0)
                expect(x + halfWidth).toBeLessThanOrEqual(900)
                expect(y - 9).toBeGreaterThanOrEqual(0)
                expect(y + 9).toBeLessThanOrEqual(525)
            }
        } finally {
            renderer.destroy()
            getContext.mockRestore()
        }
    })

    it("keeps feedback clear of HUD, units, health bars and coordinate labels", () => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        const hud = { x: 210, y: 125, width: 180, height: 100 }
        try {
            renderer.resize(600)
            renderer.setLabelExclusions([hud])
            const scene: FunctionWarsRenderScene = {
                theme: "grassland", units: [{ id: "player", side: "player", x: 0, y: 0, hp: 80, maxHp: 100 }],
                activeSide: "player", obstacles: [], craters: [], crates: [], traces: [],
            }
            renderer.setScene(scene)
            vi.mocked(context.fillText).mockClear()
            renderer.setScene({ ...scene, feedbackLabels: [{ x: 0, y: 0, text: "击中钢板" }, { x: 0, y: 0, text: "分裂点", preview: true }] })
            const labels = vi.mocked(context.fillText).mock.calls.filter(([text]) => text.includes("原点") || text.includes("钢板") || text.includes("分裂"))
            expect(labels).toHaveLength(3)
            const boxes = labels.map(([text, x, y]) => ({ x: x - (context.measureText(text).width + 12) / 2, y: y - 9, width: context.measureText(text).width + 12, height: 18 }))
            for (let index = 0; index < boxes.length; index += 1) {
                const box = boxes[index]
                for (const other of [hud, ...boxes.slice(index + 1)]) {
                    expect(box.x + box.width <= other.x || box.x >= other.x + other.width || box.y + box.height <= other.y || box.y >= other.y + other.height).toBe(true)
                }
            }
        } finally {
            renderer.destroy()
            getContext.mockRestore()
        }
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
        expect(worldToCanvas({ x: 12, y: -7 }, metrics)).toEqual({ x: 720, y: 420 })
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

        expect(getFunctionWarsUnitVisualDrop(unit, [support], desktop, 42)).toBeCloseTo(4.38, 3)
        expect(getFunctionWarsUnitVisualDrop(unit, [support], mobile, 26.52)).toBeCloseTo(0.6828, 3)
        expect(getFunctionWarsUnitVisualDrop(unit, [], desktop, 42)).toBe(0)
        expect(getFunctionWarsUnitVisualDrop(unit, [{ ...support, destructible: true }], desktop, 42)).toBeCloseTo(4.38, 3)
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

    it("uses a low-frequency redraw cadence when only ambient motion is active", () => {
        const getContext = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockReturnValue({} as CanvasRenderingContext2D)
        const setTimeoutSpy = vi.spyOn(window, "setTimeout")
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))

        try {
            renderer.start()
            expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 250)
        } finally {
            renderer.destroy()
            setTimeoutSpy.mockRestore()
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
    it("loads only the current backdrop, redraws a switched theme on load, and detaches destroyed images", () => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const images: HTMLImageElement[] = []
        const OriginalImage = globalThis.Image
        vi.stubGlobal("Image", class {
            src = ""
            onload: (() => void) | null = null
            onerror: (() => void) | null = null
            naturalWidth = 1200
            naturalHeight = 700
            constructor() { images.push(this as unknown as HTMLImageElement) }
        })
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        const scene: FunctionWarsRenderScene = { theme: "grassland", obstacles: [], craters: [], units: [], crates: [], traces: [] }
        try {
            renderer.resize(360)
            renderer.setScene(scene)
            expect(images.map((image) => image.src)).toEqual(["/assets/playground-art/function-wars/v2/grassland-backdrop.webp"])
            renderer.setScene({ ...scene, theme: "space" })
            expect(images).toHaveLength(2)
            vi.mocked(context.drawImage).mockClear()
            const space = images[1]
            const lateLoad = space.onload as () => void
            lateLoad()
            expect(context.drawImage).toHaveBeenCalledWith(space, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number))
            renderer.destroy()
            vi.mocked(context.drawImage).mockClear()
            expect(images.every((image) => image.onload === null && image.onerror === null)).toBe(true)
            lateLoad()
            expect(context.drawImage).not.toHaveBeenCalled()
        } finally {
            renderer.destroy()
            vi.stubGlobal("Image", OriginalImage)
            getContext.mockRestore()
        }
    })

    it("bounds material debris and suppresses motion when the preference changes", () => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        const internals = renderer as unknown as {
            particles: { kind: string }[]
            shake: number
            flash: number
            handleMotionPreferenceChange: (event: MediaQueryListEvent) => void
        }
        try {
            renderer.triggerExplosion({ id: "wood", x: 0, y: 0, material: "wood", intensity: 999 })
            expect(internals.particles.every((particle) => particle.kind === "chip")).toBe(true)
            for (let index = 0; index < 10; index += 1) renderer.triggerExplosion({ id: `metal-${index}`, x: 0, y: 0, material: "metal", intensity: 999 })
            expect(internals.particles.length).toBeLessThanOrEqual(96)
            expect(internals.particles.slice(-40).every((particle) => particle.kind === "spark")).toBe(true)
            internals.handleMotionPreferenceChange({ matches: true } as MediaQueryListEvent)
            renderer.triggerExplosion({ id: "earth", x: 0, y: 0, material: "earth" })
            expect(internals.particles).toEqual([])
            expect(internals.shake).toBe(0)
            expect(internals.flash).toBe(0)
        } finally {
            renderer.destroy()
            getContext.mockRestore()
        }
    })

    it("uses the 512×301 sprite aspect for its support, muzzle and label clearance", () => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const images: HTMLImageElement[] = []
        const OriginalImage = globalThis.Image
        vi.stubGlobal("Image", class {
            src = ""
            onload: (() => void) | null = null
            onerror: (() => void) | null = null
            naturalWidth = 512
            naturalHeight = 301
            constructor() { images.push(this as unknown as HTMLImageElement) }
        })
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        try {
            const metrics = getFunctionWarsCanvasMetrics(900)
            renderer.resize(900)
            const unit = { id: "player", side: "player" as const, x: -10, y: -4, hp: 100, maxHp: 100 }
            const support = { id: "support", shape: "rect" as const, x: -10, y: -4.59, width: 1.4, height: 0.7, destructible: false }
            renderer.setScene({ theme: "grassland", groundVisible: false, gridVisible: false, activeSide: "player", units: [unit], obstacles: [support], craters: [], crates: [], traces: [] })
            const image = images.find((candidate) => candidate.src.endsWith("player-turret.webp"))!
            vi.mocked(context.drawImage).mockClear()
            vi.mocked(context.translate).mockClear()
            vi.mocked(context.fillText).mockClear()
            vi.mocked(context.arcTo).mockClear()
            image.onload!(new Event("load"))
            const draw = vi.mocked(context.drawImage).mock.calls.find(([source]) => source === image)!
            const drawY = draw[2]
            const width = draw[3]
            const height = draw[4]
            expect(height / width).toBeCloseTo(301 / 512)
            const unitPoint = worldToCanvas(unit, metrics)
            const translation = vi.mocked(context.translate).mock.calls.find(([x]) => x === unitPoint.x)!
            const supportY = worldToCanvas({ x: unit.x, y: support.y + support.height / 2 }, metrics).y
            expect(translation[1] + drawY + height * 0.9375).toBeCloseTo(supportY)
            const label = vi.mocked(context.fillText).mock.calls.find(([text]) => text === "发射原点 (0,0)")!
            expect(label[2] + 9).toBeLessThan(translation[1] + drawY)
            const hpCorner = vi.mocked(context.arcTo).mock.calls.find(([, top, , bottom, radius]) => radius === 2 && Math.abs(bottom - top - 4) < 1e-8)!
            expect(hpCorner).toBeDefined()
            expect(label[2] + 9).toBeLessThan(hpCorner[1])
            // The physical muzzle uses the same dimensions and sits at 27% of the bitmap.
            const muzzle = vi.mocked(context.moveTo).mock.calls.find(([x]) => Math.abs(x - unitPoint.x - width * 0.44) < 1e-8)!
            expect(muzzle[1]).toBeCloseTo(translation[1] + drawY + height * 0.27)
        } finally {
            renderer.destroy()
            vi.stubGlobal("Image", OriginalImage)
            getContext.mockRestore()
        }
    })

    it("keeps level 10 labels clear of a measured HUD, every sprite and every HP bar", () => {
        const context = mockCanvasContext()
        vi.mocked(context.measureText).mockImplementation((text) => ({ width: [...text].reduce((sum, character) => sum + (character.charCodeAt(0) > 127 ? 11 : 6.5), 0) } as TextMetrics))
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const images: HTMLImageElement[] = []
        const OriginalImage = globalThis.Image
        vi.stubGlobal("Image", class {
            src = ""
            onload: (() => void) | null = null
            onerror: (() => void) | null = null
            naturalWidth = 512
            get naturalHeight() { return this.src.endsWith("player-turret.webp") ? 301 : this.src.endsWith("enemy-armored.webp") ? 271 : 304 }
            constructor() { images.push(this as unknown as HTMLImageElement) }
        })
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        const intersects = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
        const hud = { x: 335.75, y: 8, width: 172.5, height: 48.19 }
        const labels = () => vi.mocked(context.fillText).mock.calls.filter(([text]) => text.includes("(")).map(([text, x, y]) => ({ x: x - (context.measureText(text).width + 12) / 2, y: y - 9, width: context.measureText(text).width + 12, height: 18 }))
        try {
            const metrics = getFunctionWarsCanvasMetrics(844, 1, 334)
            renderer.resize(844, 1, 334)
            const level = getFunctionWarsLevel(9)
            const units: FunctionWarsRenderScene["units"] = [
                { id: "player", side: "player" as const, ...level.player, hp: 100, maxHp: 100 },
                ...level.enemies.map((enemy) => ({ id: enemy.id, side: "enemy" as const, ...enemy.position, armored: enemy.type === "armored", hp: 50, maxHp: 50 })),
            ]
            const obstacles = level.obstacles.map((obstacle) => ({ ...obstacle, shape: obstacle.kind }))
            renderer.setScene({ theme: level.theme, groundVisible: false, gridVisible: false, activeSide: "player", units, obstacles, crates: [], craters: [], traces: [] })
            for (const image of images) image.onload!(new Event("load"))
            vi.mocked(context.fillText).mockClear()
            renderer.setLabelExclusions([hud])
            const boxes = labels()
            expect(boxes).toHaveLength(4)
            const reserved = units.flatMap((unit) => {
                const width = Math.max(unit.armored ? 48 : 42, metrics.scaleX * (unit.armored ? 1.7 : 1.48))
                const height = width * (unit.side === "player" ? 301 : unit.armored ? 271 : 304) / 512
                const point = worldToCanvas(unit, metrics)
                const drop = getFunctionWarsUnitVisualDrop(unit, obstacles, metrics, height, 0.9375 - 0.78)
                const top = point.y + drop - height * 0.78
                return [{ x: point.x - width / 2, y: top, width, height }, { x: point.x - width * 0.43, y: top - 7, width: width * 0.86, height: 4 }]
            })
            for (const box of boxes) {
                expect(intersects(box, hud)).toBe(false)
                expect(reserved.some((rect) => intersects(box, rect))).toBe(false)
                expect(box.x).toBeGreaterThanOrEqual(0)
                expect(box.x + box.width).toBeLessThanOrEqual(844)
                expect(box.y).toBeGreaterThanOrEqual(0)
                expect(box.y + box.height).toBeLessThanOrEqual(334)
            }
            const drawCount = vi.mocked(context.fillText).mock.calls.length
            renderer.setLabelExclusions([{ ...hud }])
            expect(context.fillText).toHaveBeenCalledTimes(drawCount)
            renderer.destroy()
            renderer.setLabelExclusions([])
            expect(context.fillText).toHaveBeenCalledTimes(drawCount)
        } finally {
            renderer.destroy()
            vi.stubGlobal("Image", OriginalImage)
            getContext.mockRestore()
        }
    })

    it("invalidates cached terrain for immutable geometry, shape, material and destruction status", () => {
        const live = mockCanvasContext()
        const terrain = mockCanvasContext()
        const canvas = document.createElement("canvas")
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
            return this === canvas ? live : terrain
        })
        const renderer = new FunctionWarsRenderer(canvas)
        const scene: FunctionWarsRenderScene = { theme: "space", groundVisible: false, obstacles: [{ id: "body", shape: "rect", x: 0, y: 0, width: 3, height: 2, radius: 1, material: "wood", destructible: false }], craters: [], units: [], crates: [], traces: [] }
        try {
            renderer.resize(900, 1)
            renderer.setScene(scene)
            vi.mocked(terrain.clearRect).mockClear()
            renderer.setScene({ ...scene, gridVisible: false })
            expect(terrain.clearRect).not.toHaveBeenCalled()
            for (const patch of [{ x: 1 }, { shape: "circle" as const }, { material: "rock" as const }, { destructible: true }]) {
                scene.obstacles = [{ ...scene.obstacles[0], ...patch }]
                renderer.setScene({ ...scene })
            }
            expect(terrain.clearRect).toHaveBeenCalledTimes(4)
            // Cached bodies are never repainted into the live effects layer.
            expect(vi.mocked(live.createLinearGradient).mock.calls.every((args) => args.join() === "0,0,0,525")).toBe(true)
        } finally { renderer.destroy(); getContext.mockRestore() }
    })

    it.each(["earth", "wood", "rock", "metal"] as const)("keeps %s paint independent of theme and destruction status", (material) => {
        const live = mockCanvasContext()
        const terrain = mockCanvasContext()
        const canvas = document.createElement("canvas")
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
            return this === canvas ? live : terrain
        })
        const renderer = new FunctionWarsRenderer(canvas)
        const scene: FunctionWarsRenderScene = { theme: "grassland", groundVisible: false, obstacles: [{ id: "body", shape: "rect", x: 0, y: 0, width: 3, height: 2, material, destructible: true }], craters: [], units: [], crates: [], traces: [] }
        try {
            renderer.resize(900, 1)
            renderer.setScene(scene)
            const gradient = vi.mocked(terrain.createLinearGradient).mock.results.at(-1)?.value as CanvasGradient
            const paint = vi.mocked(gradient.addColorStop).mock.calls.slice(-3)
            vi.mocked(gradient.addColorStop).mockClear()
            renderer.setScene({ ...scene, theme: "space", obstacles: [{ ...scene.obstacles[0], destructible: false }] })
            expect(gradient.addColorStop).toHaveBeenCalledTimes(3)
            expect(vi.mocked(gradient.addColorStop).mock.calls).toEqual(paint)
        } finally { renderer.destroy(); getContext.mockRestore() }
    })

    it("composes immutable overlap after the union of crater cuts, including buried earth", () => {
        const live = mockCanvasContext()
        const terrain = mockCanvasContext()
        const operations: string[] = []
        const cutPaint: { fill: string | CanvasGradient | CanvasPattern; alpha: number }[] = []
        const compositeStack: string[] = []
        terrain.globalCompositeOperation = "source-over"
        vi.mocked(terrain.save).mockImplementation(() => { compositeStack.push(terrain.globalCompositeOperation) })
        vi.mocked(terrain.restore).mockImplementation(() => { terrain.globalCompositeOperation = compositeStack.pop() as GlobalCompositeOperation })
        vi.mocked(terrain.fill).mockImplementation(() => {
            operations.push(String(terrain.globalCompositeOperation))
            if (terrain.globalCompositeOperation === "destination-out") cutPaint.push({ fill: terrain.fillStyle, alpha: terrain.globalAlpha })
        })
        vi.mocked(terrain.drawImage).mockImplementation(() => { operations.push("restore") })
        const canvas = document.createElement("canvas")
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
            return this === canvas ? live : terrain
        })
        const renderer = new FunctionWarsRenderer(canvas)
        try {
            renderer.resize(900, 1)
            operations.length = 0
            renderer.setScene({ theme: "grassland", obstacles: [{ id: "buried", shape: "circle", x: 0, y: -5.6, radius: 1.3, material: "earth", destructible: false }], craters: [{ x: -0.2, y: -5.6, radius: 0.8 }, { x: 0.2, y: -5.6, radius: 0.8 }], units: [], crates: [], traces: [] })
            const cuts = operations.flatMap((operation, index) => operation === "destination-out" ? [index] : [])
            expect(cuts).toHaveLength(2)
            // Both overlapping cuts are fully opaque. A translucent rim gradient here
            // would retain body pixels even though collision treats them as a hole.
            expect(cutPaint).toEqual([{ fill: "#000", alpha: 1 }, { fill: "#000", alpha: 1 }])
            expect(operations.lastIndexOf("restore")).toBeGreaterThan(cuts[1])
            expect(terrain.clip).not.toHaveBeenCalledWith("evenodd")
            // Embedded immutable earth restores the exact uncarved ground pixels inside
            // its collider, so there is no separate lower-circle colour boundary.
            expect(terrain.drawImage).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 0, 0, 900, 525)
            // Collider path is exact; every fill and edge is clipped by it.
            const center = worldToCanvas({ x: 0, y: -5.6 }, getFunctionWarsCanvasMetrics(900))
            expect(terrain.arc).toHaveBeenCalledWith(center.x, center.y, 1.3 * 37.5, 0, Math.PI * 2)
        } finally { renderer.destroy(); getContext.mockRestore() }
    })

    it("removes erased-body labels after impact while retaining them during deferred playback", () => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        const scene: FunctionWarsRenderScene = { theme: "space", groundVisible: false, obstacles: [{ id: "wood", shape: "rect", x: 0, y: 0, width: 3, height: 2, material: "wood", destructible: true }], craters: [], units: [], crates: [], traces: [] }
        try {
            renderer.resize(900, 1)
            renderer.setScene(scene)
            vi.mocked(context.fillText).mockClear()
            renderer.setScene({ ...scene, craters: [{ x: 0, y: 0, radius: 3 }], animationKey: "shot", animationDurationMs: 1000, traces: [{ id: "trace", points: [{ x: -5, y: 0 }, { x: 0, y: 0 }] }], impact: { id: "hit", x: 0, y: 0, obstacleId: "wood" } })
            expect(vi.mocked(context.fillText).mock.calls.some(([text]) => text === "木材 · 可破坏")).toBe(true)
            vi.mocked(context.fillText).mockClear()
            renderer.setScene({ ...scene, craters: [{ x: 0, y: 0, radius: 3 }] })
            expect(vi.mocked(context.fillText).mock.calls.some(([text]) => text === "木材 · 可破坏")).toBe(false)
        } finally { renderer.destroy(); getContext.mockRestore() }
    })

    it("reuses surviving-body label anchors until terrain geometry changes", () => {
        const context = mockCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
        const renderer = new FunctionWarsRenderer(document.createElement("canvas"))
        const distance = vi.spyOn(Math, "hypot")
        const scene: FunctionWarsRenderScene = { theme: "space", groundVisible: false, obstacles: [{ id: "wood", shape: "rect", x: 0, y: 0, width: 3, height: 2, material: "wood", destructible: true }], craters: [{ x: 0, y: 0, radius: 3 }], units: [], crates: [], traces: [] }
        try {
            renderer.resize(900, 1)
            renderer.setScene(scene)
            expect(distance).toHaveBeenCalled()
            distance.mockClear()
            renderer.setScene({ ...scene, gridVisible: false })
            expect(distance).not.toHaveBeenCalled()
            renderer.setScene({ ...scene, craters: [{ x: 0, y: 0, radius: 2 }] })
            expect(distance).toHaveBeenCalled()
        } finally { renderer.destroy(); distance.mockRestore(); getContext.mockRestore() }
    })

    it("unites grounded earth with soil paint and places the surface edge on the exposed slope", () => {
        const live = mockCanvasContext()
        const terrain = mockCanvasContext()
        let path: number[][] = []
        const surfacePaths: number[][][] = []
        vi.mocked(terrain.beginPath).mockImplementation(() => { path = [] })
        vi.mocked(terrain.moveTo).mockImplementation((x, y) => { path.push([x, y]) })
        vi.mocked(terrain.lineTo).mockImplementation((x, y) => { path.push([x, y]) })
        vi.mocked(terrain.stroke).mockImplementation(() => {
            if (terrain.strokeStyle === "rgba(219, 243, 119, 0.82)") surfacePaths.push([...path])
        })
        const canvas = document.createElement("canvas")
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
            return this === canvas ? live : terrain
        })
        const renderer = new FunctionWarsRenderer(canvas)
        try {
            renderer.resize(900, 1)
            surfacePaths.length = 0
            vi.mocked(terrain.createLinearGradient).mockClear()
            renderer.setScene({ theme: "grassland", obstacles: [{ id: "slope", shape: "circle", x: 0, y: -5.5, radius: 3.3, material: "earth", destructible: true }], craters: [], units: [], crates: [], traces: [] })
            // One gradient fills the exact union, rather than a separate mound patch.
            expect(terrain.createLinearGradient).toHaveBeenCalledTimes(1)
            const peak = worldToCanvas({ x: 0, y: -2.2 }, getFunctionWarsCanvasMetrics(900))
            expect(terrain.createLinearGradient).toHaveBeenCalledWith(0, peak.y, 0, 525)
            expect(surfacePaths).toHaveLength(1)
            const peakEdge = surfacePaths[0].find(([x]) => x === peak.x)
            expect(peakEdge?.[1]).toBeCloseTo(peak.y + 0.5)
            // The old base grass edge would cross the hill near y=459 instead.
            expect(peakEdge?.[1]).toBeLessThan(400)
            expect(terrain.clip).not.toHaveBeenCalledWith("evenodd")
            expect(terrain.arc).toHaveBeenCalledWith(450, 468.75, 123.75, 0, Math.PI * 2)
        } finally { renderer.destroy(); getContext.mockRestore() }
    })

})
