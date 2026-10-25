import { describe, expect, it } from "vitest"

import {
    buildFunctionWarsOnlineMap,
    createFunctionWarsInitialInventory,
    type FunctionWarsOnlineMap,
} from "@/lib/playground/function-wars-online"
import { simulateFunctionWarsOnlineShot } from "@/lib/playground/function-wars-simulation"

function openMap(): FunctionWarsOnlineMap {
    return {
        ...buildFunctionWarsOnlineMap(7, "symmetric-canyon"),
        obstacles: [],
        crates: [],
    }
}

describe("simulateFunctionWarsOnlineShot", () => {
    it.each(["wood", "earth"] as const)("retains %s impact material without changing destructible-cover settlement", (material) => {
        const map = openMap()
        const origin = map.turrets.host
        const impact = { x: origin.x + 1.75, y: origin.y }
        map.obstacles = [{
            id: "destructible-cover",
            shape: "rect",
            x: origin.x + 2,
            y: origin.y,
            width: 0.5,
            height: 1,
            destructible: true,
            material,
        }]

        const result = simulateFunctionWarsOnlineShot({
            expression: "0",
            role: "host",
            weapon: "standard",
            map,
            crates: [],
            craters: [],
            inventory: createFunctionWarsInitialInventory().host,
        })

        expect(result.error).toBeNull()
        expect(result.impact).toMatchObject({ ...impact, material, weapon: "standard" })
        expect(result.impact).not.toHaveProperty("obstacleId")
        expect(result.traces[0].points.at(-1)).toEqual(impact)
        expect(result.summary).toEqual({
            damage: null,
            craters: [{ ...impact, radius: 0.72 }],
            picked_crate_ids: [],
        })
    })

    it("retains heavy weapon metadata on turret hits and its existing damage and crater", () => {
        const map = openMap()
        const result = simulateFunctionWarsOnlineShot({
            expression: "0",
            role: "host",
            weapon: "heavy",
            map,
            crates: [],
            craters: [],
            inventory: createFunctionWarsInitialInventory().host,
        })

        expect(result.traces[0].weapon).toBe("heavy")
        expect(result.impact).toMatchObject({ weapon: "heavy", material: "metal" })
        expect(result.summary).toEqual({
            damage: { target: "guest", amount: 70 },
            craters: [{ x: expect.closeTo(map.turrets.guest.x - 0.62), y: map.turrets.guest.y, radius: 1.3 }],
            picked_crate_ids: [],
        })
    })

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
        const map = buildFunctionWarsOnlineMap(7, "symmetric-canyon")
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

    it("stops at the ceiling before it can re-enter", () => {
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
        expect(points.every(point => point.y <= 7)).toBe(true)
        expect(points.at(-1)?.y).toBe(7)
        expect(result.summary.damage).toBeNull()
    })

    it("detects a turret crossed between two steep trajectory samples", () => {
        const map = openMap()
        map.turrets.guest = { x: -9.95, y: 0 }
        const inventory = createFunctionWarsInitialInventory().host
        const result = simulateFunctionWarsOnlineShot({
            expression: "100x",
            role: "host",
            weapon: "standard",
            map,
            crates: [],
            craters: [],
            inventory,
        })

        expect(result.summary.damage).toEqual({ target: "guest", amount: 50 })
        expect(result.traces[0].points.at(-1)).toEqual(expect.objectContaining({ x: expect.closeTo(-9.95, 1) }))
    })

    it("splits at a wall before the unimpeded path reaches the ceiling and retains its impact identity", () => {
        const map = openMap()
        map.obstacles = [{id:"steel-wall",shape:"rect",x:-7,y:0,width:0.5,height:14,destructible:false,material:"steel"}]
        const result = simulateFunctionWarsOnlineShot({expression:"2x",role:"host",weapon:"split",map,crates:[],craters:[],inventory:createFunctionWarsInitialInventory().host})
        expect(result.traces).toHaveLength(4)
        expect(result.impact).toMatchObject({obstacleId:"steel-wall",x:expect.closeTo(-7.25)})
    })

    it("does not create fragments after a trajectory exits the ceiling", () => {
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

        expect(result.traces).toHaveLength(1)
        expect(result.traces[0].points.every(point => point.y <= 7)).toBe(true)
        expect(result.summary.craters).toHaveLength(0)
        expect(result.traces[0].weapon).toBe("split")
    })

    it("stops below the viewport for right-to-left shots and respects discontinuities", () => {
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
            expression: "1/(x-10)+0.1",
            role: "guest",
            weapon: "standard",
            map: openMap(),
            crates: [],
            craters: [],
            inventory,
        })

        const points = reentry.traces[0].points
        expect(points.every(point => point.y >= -7)).toBe(true)
        expect(points.at(-1)?.y).toBe(-7)
        expect(reentry.summary.damage).toBeNull()
        expect(discontinuous.summary.damage).toBeNull()
        expect(discontinuous.traces[0].points.at(-1)?.x).toBeGreaterThan(0)
    })

    it("applies splash damage without creating craters when hitting indestructible floor near the enemy turret", () => {
        const map = buildFunctionWarsOnlineMap(7, "symmetric-canyon")
        map.obstacles = map.obstacles.filter((obstacle) => obstacle.id === "bedrock-floor")
        const inventory = createFunctionWarsInitialInventory().host
        const result = simulateFunctionWarsOnlineShot({
            expression: "-0.05x(x-19.2)",
            role: "host",
            weapon: "standard",
            map,
            crates: [],
            craters: [],
            inventory,
        })

        expect(result.error).toBeNull()
        expect(result.impact?.obstacleId).toBe("bedrock-floor")
        expect(result.summary.craters).toEqual([])
        expect(result.summary.damage).toEqual({
            target: "guest",
            amount: expect.any(Number),
        })
        expect(result.summary.damage?.amount).toBeGreaterThan(0)
    })

    it("collects more than 4 crates in a single trajectory up to the 12-crate match limit", () => {
        const map = openMap()
        map.crates = Array.from({ length: 12 }, (_, index) => ({ id: `crate-${index}`, type: "ammo" as const, x: -9 + index * 1.4, y: -5.15, spawn_shot: 0, picked_by: null, picked_seq: null }))
        const inventory = createFunctionWarsInitialInventory().host
        const result = simulateFunctionWarsOnlineShot({
            expression: "0",
            role: "host",
            weapon: "standard",
            map,
            crates: map.crates,
            craters: [],
            inventory,
        })

        expect(result.error).toBeNull()
        expect(result.summary.picked_crate_ids?.length).toBeGreaterThan(4)
        expect(result.summary.picked_crate_ids?.length).toBeLessThanOrEqual(12)
    })
})
