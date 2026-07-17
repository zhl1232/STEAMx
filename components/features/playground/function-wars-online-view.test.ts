import { describe, expect, it } from "vitest"

import {
    buildFunctionWarsOnlineMap,
    createFunctionWarsInitialInventory,
    type FunctionWarsOnlineMap,
} from "@/lib/playground/function-wars-online"
import { simulateFunctionWarsOnlineShot } from "@/lib/playground/function-wars-simulation"

function openMap(): FunctionWarsOnlineMap {
    return {
        ...buildFunctionWarsOnlineMap(7),
        obstacles: [],
        crates: [],
    }
}

describe("simulateFunctionWarsOnlineShot", () => {
    it("caps damage from both mirror projectiles below a full-health one-shot", () => {
        const inventory = createFunctionWarsInitialInventory().host
        const result = simulateFunctionWarsOnlineShot({
            expression: "0",
            role: "host",
            weapon: "mirror",
            map: openMap(),
            crates: [],
            craters: [],
            inventory: { ...inventory, mirror: 1 },
        })

        expect(result.error).toBeNull()
        expect(result.summary.damage).toEqual({ target: "guest", amount: 80 })
    })

    it("rounds a boosted heavy crater to the SQL validation precision", () => {
        const map = openMap()
        map.obstacles = [{
            id: "test-cover",
            shape: "rect",
            x: -8,
            y: -5.3,
            width: 0.5,
            height: 1,
            destructible: true,
            material: "earth",
        }]
        const inventory = createFunctionWarsInitialInventory().host
        const result = simulateFunctionWarsOnlineShot({
            expression: "0",
            role: "host",
            weapon: "heavy",
            map,
            crates: [],
            craters: [],
            inventory: { ...inventory, blast_boost: true },
        })

        expect(result.summary.craters).toHaveLength(1)
        expect(result.summary.craters?.[0].radius).toBe(1.95)
    })

    it("launches above the collidable floor without a starting collision", () => {
        const map = buildFunctionWarsOnlineMap(7)
        const inventory = createFunctionWarsInitialInventory().host
        const result = simulateFunctionWarsOnlineShot({
            expression: "0",
            role: "host",
            weapon: "standard",
            map,
            crates: [],
            craters: [],
            inventory,
        })

        expect(result.traces[0].points.length).toBeGreaterThan(2)
        expect(result.traces[0].points.at(-1)?.x).toBeGreaterThan(-9)
    })

    it("splits at a blocking steel wall before the mathematical apex", () => {
        const map = openMap()
        map.obstacles = [{
            id: "early-wall",
            shape: "rect",
            x: -7,
            y: 0,
            width: 0.5,
            height: 14,
            destructible: false,
            material: "steel",
        }]
        const inventory = createFunctionWarsInitialInventory().host
        const result = simulateFunctionWarsOnlineShot({
            expression: "-0.1(x-10)^2+10",
            role: "host",
            weapon: "split",
            map,
            crates: [],
            craters: [],
            inventory,
        })

        const mainEnd = result.traces[0].points.at(-1)
        const fragmentStarts = result.traces.slice(1).map((trace) => trace.points[0])
        expect(mainEnd).toBeDefined()
        expect(fragmentStarts).toHaveLength(3)
        expect(fragmentStarts.every((point) => Math.abs(point.x - mainEnd!.x) <= 0.51)).toBe(true)
        expect(result.impact?.obstacleId).toBe("early-wall")
    })

    it("creates configured craters when projectiles hit a turret directly", () => {
        const map = openMap()
        const inventory = createFunctionWarsInitialInventory().host
        const standard = simulateFunctionWarsOnlineShot({
            expression: "0",
            role: "host",
            weapon: "standard",
            map,
            crates: [],
            craters: [],
            inventory,
        })
        const split = simulateFunctionWarsOnlineShot({
            expression: "-0.025(x-20)^2+10",
            role: "host",
            weapon: "split",
            map,
            crates: [],
            craters: [],
            inventory,
        })

        expect(standard.summary.craters).toEqual([
            expect.objectContaining({ radius: 0.72 }),
        ])
        expect(split.summary.damage).toEqual({ target: "guest", amount: 75 })
        expect(split.summary.craters).toHaveLength(3)
        expect(split.summary.craters?.every((crater) => crater.radius === 0.42)).toBe(true)
    })

    it("continues above the viewport and hits after re-entering", () => {
        const inventory = createFunctionWarsInitialInventory().host
        const result = simulateFunctionWarsOnlineShot({
            expression: "-0.5x(x-20)",
            role: "host",
            weapon: "standard",
            map: openMap(),
            crates: [],
            craters: [],
            inventory,
        })

        const points = result.traces[0].points
        const firstOffscreen = points.findIndex((point) => point.y > 7)
        expect(firstOffscreen).toBeGreaterThan(0)
        expect(Math.max(...points.map((point) => point.y))).toBeGreaterThan(32)
        expect(points.slice(firstOffscreen + 1).some((point) => point.y <= 7)).toBe(true)
        expect(result.summary.damage).toEqual({ target: "guest", amount: 50 })
    })

    it("detects a turret crossed between two steep trajectory samples", () => {
        const map = openMap()
        map.turrets.guest = { x: 0, y: 0 }
        const inventory = createFunctionWarsInitialInventory().host
        const result = simulateFunctionWarsOnlineShot({
            expression: "100(x-10)+5.15",
            role: "host",
            weapon: "standard",
            map,
            crates: [],
            craters: [],
            inventory,
        })

        expect(result.summary.damage).toEqual({ target: "guest", amount: 50 })
        expect(result.traces[0].points.at(-1)).toEqual(expect.objectContaining({ x: expect.closeTo(0, 1) }))
    })

    it("brings split fragments back into view from a very high apex", () => {
        const map = openMap()
        map.obstacles = [{
            id: "high-apex-target",
            shape: "rect",
            x: 0,
            y: 0,
            width: 2,
            height: 0.2,
            destructible: true,
            material: "earth",
        }]
        const inventory = createFunctionWarsInitialInventory().host
        const result = simulateFunctionWarsOnlineShot({
            expression: "-10x(x-20)",
            role: "host",
            weapon: "split",
            map,
            crates: [],
            craters: [],
            inventory,
        })

        expect(result.traces).toHaveLength(4)
        expect(result.traces.slice(1).every((trace) => trace.points.some((point) => point.y <= 7))).toBe(true)
        expect(result.summary.craters).toHaveLength(3)
    })

    it("continues below the viewport for right-to-left shots and still respects discontinuities", () => {
        const inventory = createFunctionWarsInitialInventory().guest
        const reentry = simulateFunctionWarsOnlineShot({
            expression: "0.15x(x-20)",
            role: "guest",
            weapon: "standard",
            map: openMap(),
            crates: [],
            craters: [],
            inventory,
        })
        const discontinuous = simulateFunctionWarsOnlineShot({
            expression: "1/(x-10)",
            role: "guest",
            weapon: "standard",
            map: openMap(),
            crates: [],
            craters: [],
            inventory,
        })

        const points = reentry.traces[0].points
        const firstOffscreen = points.findIndex((point) => point.y < -7)
        expect(firstOffscreen).toBeGreaterThan(0)
        expect(points.slice(firstOffscreen + 1).some((point) => point.y >= -7)).toBe(true)
        expect(reentry.summary.damage).toEqual({ target: "host", amount: 50 })
        expect(discontinuous.summary.damage).toBeNull()
        expect(discontinuous.traces[0].points.at(-1)?.x).toBeGreaterThan(0)
    })
})
