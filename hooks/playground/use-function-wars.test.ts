import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
    FUNCTION_WARS_CAMPAIGN_LEVELS,
    FUNCTION_WARS_CHALLENGE_LEVELS,
    FUNCTION_WARS_LEVELS,
    FUNCTION_WARS_WORLD,
    type FunctionWarsLevel,
} from "@/lib/playground/function-wars-levels"
import {
    FUNCTION_WARS_ENEMY_HP,
    PICKUP_DEFINITIONS,
    WEAPON_DEFINITIONS,
    createWeaponInventory,
    getDamageAgainstEnemy,
    type WeaponId,
} from "@/lib/playground/function-wars-weapons"
import {
    FUNCTION_WARS_PROJECTILE_RADIUS,
    FUNCTION_WARS_STATS_KEY,
    createFunctionWarsState,
    getFunctionWarsStars,
    isFunctionWarsBonusComplete,
    simulateFunctionWarsShot,
    useFunctionWars,
} from "./use-function-wars"

const { getPlaygroundItemMock, setPlaygroundItemMock } = vi.hoisted(() => ({
    getPlaygroundItemMock: vi.fn<() => unknown>(() => null),
    setPlaygroundItemMock: vi.fn(),
}))

vi.mock("@/lib/playground/storage", () => ({
    getPlaygroundItem: getPlaygroundItemMock,
    setPlaygroundItem: setPlaygroundItemMock,
}))

function testLevel(overrides: Partial<FunctionWarsLevel> = {}): FunctionWarsLevel {
    return {
        id: "test-level",
        number: 1,
        name: "测试关卡",
        theme: "grassland",
        player: { x: -10, y: 0 },
        enemies: [{ id: "enemy", type: "normal", position: { x: -2, y: 0 } }],
        obstacles: [],
        crates: [],
        availableWeapons: ["standard", "heavy", "drill", "split", "mirror"],
        weaponInventory: createWeaponInventory({ heavy: 2, drill: 2, split: 2, mirror: 2 }),
        par: 1,
        hint: "测试",
        seed: 42,
        ...overrides,
    }
}

function fire(level: FunctionWarsLevel, expression: string, weapon: "standard" | "heavy" | "drill" | "split" | "mirror") {
    const result = simulateFunctionWarsShot(level, createFunctionWarsState(level), expression, weapon)
    expect(result.ok, result.ok ? undefined : result.error).toBe(true)
    if (!result.ok) throw new Error(result.error)
    return result
}

type CampaignShot = { expression: string; weapon: WeaponId }

const CAMPAIGN_SOLUTIONS = {
    "grass-01": [
        { expression: "0", weapon: "standard" },
    ],
    "grass-02": [
        { expression: "0.25x", weapon: "standard" },
    ],
    "grass-03": [
        { expression: "0.2x", weapon: "standard" },
        { expression: "0.296774x", weapon: "drill" },
    ],
    "canyon-04": [
        { expression: "2.85x-0.19x^2", weapon: "standard" },
    ],
    "canyon-05": [
        { expression: "-0.4746abs(x-12)+5.6952", weapon: "standard" },
        { expression: "-0.5abs(x-10)+5", weapon: "standard" },
    ],
    "canyon-06": [
        { expression: "0.044303797468x", weapon: "standard" },
        { expression: "1.7823x-0.11x^2", weapon: "drill" },
    ],
    "canyon-07": [
        { expression: "x-x^2/24", weapon: "split" },
    ],
    "space-08": [
        { expression: "2.115415sin(0.1x)", weapon: "standard" },
        { expression: "3.909965sin(0.1x)", weapon: "standard" },
    ],
    "space-09": [
        { expression: "6.327463sin(0.13x)", weapon: "heavy" },
        { expression: "5.450039sin(0.15x)", weapon: "standard" },
    ],
    "space-10": [
        { expression: "0.0027x^2(20-x)", weapon: "mirror" },
        { expression: "0", weapon: "drill" },
    ],
} as const satisfies Record<string, readonly CampaignShot[]>

const CHALLENGE_SOLUTIONS = {
    "challenge-11": [
        { expression: "2sin(pi*x/10)", weapon: "standard" },
    ],
    "challenge-12": [
        { expression: "-0.5abs(x-8)+4", weapon: "drill" },
        { expression: "-0.1abs(x-4)+0.4", weapon: "standard" },
    ],
    "challenge-13": [
        { expression: "0.5(exp(0.15x)-1)", weapon: "standard" },
        { expression: "1.2(exp(0.107x)-1)", weapon: "heavy" },
    ],
    "challenge-14": [
        { expression: "1.4log(x+1)", weapon: "drill" },
        { expression: "2.2log(x+1)", weapon: "standard" },
    ],
    "challenge-15": [
        { expression: "0.4abs(x-8)-3.2", weapon: "mirror" },
        { expression: "0.1sin(pi*x/10)", weapon: "drill" },
    ],
} as const satisfies Record<string, readonly CampaignShot[]>

describe("function wars definitions", () => {
    it("ships ten campaign levels followed by five challenge levels", () => {
        expect(FUNCTION_WARS_LEVELS).toHaveLength(15)
        expect(FUNCTION_WARS_LEVELS.map((level) => level.number)).toEqual(
            Array.from({ length: 15 }, (_, index) => index + 1),
        )
        expect(FUNCTION_WARS_CAMPAIGN_LEVELS).toHaveLength(10)
        expect(FUNCTION_WARS_CHALLENGE_LEVELS).toHaveLength(5)
        expect(FUNCTION_WARS_CAMPAIGN_LEVELS.filter((level) => level.theme === "grassland")).toHaveLength(3)
        expect(FUNCTION_WARS_CAMPAIGN_LEVELS.filter((level) => level.theme === "canyon")).toHaveLength(4)
        expect(FUNCTION_WARS_CAMPAIGN_LEVELS.filter((level) => level.theme === "space")).toHaveLength(3)
        expect(new Set(FUNCTION_WARS_LEVELS.map((level) => level.id)).size).toBe(15)
    })

    it("keeps units, crates, and obstacle centers inside world bounds", () => {
        for (const level of FUNCTION_WARS_LEVELS) {
            const points = [
                level.player,
                ...level.enemies.map((enemy) => enemy.position),
                ...level.crates.map((crate) => crate.position),
                ...(level.relays ?? []).map((relay) => relay.position),
                ...level.obstacles.map((obstacle) => ({ x: obstacle.x, y: obstacle.y })),
            ]
            for (const point of points) {
                expect(point.x, `${level.id} x`).toBeGreaterThanOrEqual(FUNCTION_WARS_WORLD.minX)
                expect(point.x, `${level.id} x`).toBeLessThanOrEqual(FUNCTION_WARS_WORLD.maxX)
                expect(point.y, `${level.id} y`).toBeGreaterThanOrEqual(FUNCTION_WARS_WORLD.minY)
                expect(point.y, `${level.id} y`).toBeLessThanOrEqual(FUNCTION_WARS_WORLD.maxY)
            }
        }
    })

    it("anchors every campaign unit on collidable terrain", () => {
        for (const level of FUNCTION_WARS_LEVELS) {
            const units = [
                { id: "player", position: level.player, halfWidth: 0.5 },
                ...level.enemies.map((enemy) => ({
                    id: enemy.id,
                    position: enemy.position,
                    halfWidth: enemy.radius ?? 0.42,
                })),
            ]

            for (const unit of units) {
                const support = level.obstacles.find((obstacle) => {
                    if (obstacle.kind !== "rect") return false
                    const left = obstacle.x - obstacle.width / 2
                    const right = obstacle.x + obstacle.width / 2
                    const top = obstacle.y + obstacle.height / 2
                    const gap = unit.position.y - top
                    return (
                        left <= unit.position.x &&
                        right >= unit.position.x &&
                        obstacle.width >= Math.min(0.7, unit.halfWidth * 1.4) &&
                        gap > FUNCTION_WARS_PROJECTILE_RADIUS &&
                        gap <= 0.4
                    )
                })

                expect(support, `${level.id} ${unit.id}`).toBeDefined()
            }
        }
    })

    it("turns late space levels into sky islands with fragile enemy supports", () => {
        const skyLevels = FUNCTION_WARS_CAMPAIGN_LEVELS.filter((level) => level.ground === "void")

        expect(skyLevels.map((level) => level.id)).toEqual(["space-08", "space-09", "space-10"])
        expect(skyLevels.every((level) => level.fallHazard)).toBe(true)
        expect(FUNCTION_WARS_LEVELS.find((level) => level.id === "space-09")?.obstacles.some((obstacle) => (
            obstacle.id === "s9-e1-support" && obstacle.destructible
        ))).toBe(true)
        expect(FUNCTION_WARS_LEVELS.find((level) => level.id === "space-10")?.obstacles.some((obstacle) => (
            obstacle.id === "s10-e3-support" && obstacle.destructible
        ))).toBe(true)
    })

    it("keeps the canonical slope and sine teaching routes clear of supports", () => {
        const routes = [
            {
                levelId: "grass-02",
                shots: [{ expression: "0.25x", weapon: "standard" }],
                hitIds: ["g2-e1"],
            },
            {
                levelId: "space-09",
                shots: [
                    { expression: "6.327463sin(0.13x)", weapon: "heavy" },
                    { expression: "5.450039sin(0.15x)", weapon: "standard" },
                ],
                hitIds: ["s9-e1", "s9-e2"],
            },
        ] as const

        for (const route of routes) {
            const level = FUNCTION_WARS_LEVELS.find((candidate) => candidate.id === route.levelId)
            expect(level, route.levelId).toBeDefined()
            if (!level) continue

            let state = createFunctionWarsState(level)
            const hitIds: string[] = []
            for (const shot of route.shots) {
                const outcome = simulateFunctionWarsShot(level, state, shot.expression, shot.weapon)
                expect(outcome.ok, `${route.levelId}: ${shot.expression}`).toBe(true)
                if (!outcome.ok) continue
                hitIds.push(...outcome.shot.traces.flatMap((trace) => trace.hitId ? [trace.hitId] : []))
                state = outcome.state
            }

            expect(hitIds).toEqual(route.hitIds)
            expect(state.status).toBe("won")
        }
    })

    it("showcases a split shower hitting three visually separated damaged targets", () => {
        const level = FUNCTION_WARS_LEVELS[6]
        expect(createFunctionWarsState(level).enemies.map((enemy) => enemy.radius)).toEqual([0.42, 0.42, 0.42])
        const split = fire(level, "x-x^2/24", "split")
        expect(split.state.status).toBe("won")
        expect(split.shot.traces.filter((trace) => trace.fragment).map((trace) => trace.hitId).sort()).toEqual(["c7-e1", "c7-e2", "c7-e3"])
        expect(split.shot.traces.filter((trace) => trace.fragment)).toHaveLength(3)
        expect(fire(level, "x-x^2/24", "standard").state.status).toBe("playing")
        let state = createFunctionWarsState(level)
        for (const expression of ["x-0.05739796x^2", "3x-0.22216796875x^2", "1.5x-0.125x^2"]) {
            if (state.status !== "playing") break
            const outcome = simulateFunctionWarsShot(level, state, expression, "standard")
            expect(outcome.ok).toBe(true)
            if (outcome.ok) state = outcome.state
        }
        expect(state.status, JSON.stringify(state)).toBe("won")
        expect(state.shots).toBe(3)
    })

    it.each([[undefined, 50], [25, 25], [-10, 1], [1000, 50], [NaN, 50], [Infinity, 50]])("clamps configured initial enemy hp %s to %s", (initialHp, expected) => {
        const state = createFunctionWarsState(testLevel({ enemies: [{ id: "enemy", type: "normal", position: { x: 0, y: 0 }, initialHp }] }))
        expect(state.enemies[0]).toMatchObject({ hp: expected, maxHp: 50 })
    })

    it("encodes standard-two-hit and heavy-or-drill-one-hit armor rules", () => {
        expect(FUNCTION_WARS_ENEMY_HP.armored).toBe(100)
        expect(getDamageAgainstEnemy("standard", "armored")).toBe(50)
        expect(getDamageAgainstEnemy("heavy", "armored")).toBeGreaterThanOrEqual(100)
        expect(getDamageAgainstEnemy("drill", "armored")).toBeGreaterThanOrEqual(100)
        expect(WEAPON_DEFINITIONS.split.splitCount).toBe(3)
        expect(PICKUP_DEFINITIONS.blast_boost.blastRadiusMultiplier).toBe(1.5)
        expect(PICKUP_DEFINITIONS.shield.onlineOnly).toBe(true)
        expect(PICKUP_DEFINITIONS.repair.onlineOnly).toBe(true)
    })

    it("keeps every campaign level solvable within its three-star par", () => {
        expect(Object.keys(CAMPAIGN_SOLUTIONS)).toEqual(FUNCTION_WARS_CAMPAIGN_LEVELS.map((level) => level.id))

        for (const level of FUNCTION_WARS_CAMPAIGN_LEVELS) {
            let state = createFunctionWarsState(level)
            for (const shot of CAMPAIGN_SOLUTIONS[level.id as keyof typeof CAMPAIGN_SOLUTIONS]) {
                const outcome = simulateFunctionWarsShot(level, state, shot.expression, shot.weapon)
                expect(outcome.ok, `${level.id}: ${shot.weapon} ${shot.expression}`).toBe(true)
                if (!outcome.ok) throw new Error(outcome.error)
                state = outcome.state
            }

            expect(state.status, `${level.id}: ${JSON.stringify(state)}`).toBe("won")
            expect(state.shots, level.id).toBeLessThanOrEqual(level.par)
            expect(
                getFunctionWarsStars(level.par, state.shots, isFunctionWarsBonusComplete(level, state)),
                level.id,
            ).toBe(3)
        }
    })

    it("keeps every challenge solvable by its canonical mission route", () => {
        expect(Object.keys(CHALLENGE_SOLUTIONS)).toEqual(FUNCTION_WARS_CHALLENGE_LEVELS.map((level) => level.id))

        for (const level of FUNCTION_WARS_CHALLENGE_LEVELS) {
            let state = createFunctionWarsState(level)
            for (const shot of CHALLENGE_SOLUTIONS[level.id as keyof typeof CHALLENGE_SOLUTIONS]) {
                const outcome = simulateFunctionWarsShot(level, state, shot.expression, shot.weapon)
                expect(outcome.ok, `${level.id}: ${shot.weapon} ${shot.expression}`).toBe(true)
                if (!outcome.ok) throw new Error(outcome.error)
                state = outcome.state
            }

            expect(state.status, `${level.id}: ${JSON.stringify(state)}`).toBe("won")
            expect(state.shots, level.id).toBeLessThanOrEqual(level.par)
        }
    })
})

describe("function wars shot simulation", () => {
    it("needs two standard hits but only one heavy hit against armor", () => {
        const level = testLevel({
            enemies: [{ id: "armor", type: "armored", position: { x: -2, y: 0 } }],
        })
        const initial = createFunctionWarsState(level)
        const first = simulateFunctionWarsShot(level, initial, "0", "standard")
        expect(first.ok).toBe(true)
        if (!first.ok) return
        expect(first.state.enemies[0].hp).toBe(50)
        expect(first.state.status).toBe("playing")

        const second = simulateFunctionWarsShot(level, first.state, "0", "standard")
        expect(second.ok).toBe(true)
        if (!second.ok) return
        expect(second.state.enemies[0].hp).toBe(0)
        expect(second.state.status).toBe("won")

        const heavy = fire(level, "0", "heavy")
        expect(heavy.state.enemies[0].hp).toBe(0)
        expect(heavy.state.inventory.heavy).toBe(1)
    })

    it("cuts a reusable passage through destructible cover but not steel", () => {
        const destructible = testLevel({
            obstacles: [{
                id: "cover",
                kind: "rect",
                x: -5,
                y: 0,
                width: 0.45,
                height: 0.7,
                destructible: true,
                material: "wood",
            }],
        })
        const first = simulateFunctionWarsShot(destructible, createFunctionWarsState(destructible), "0", "standard")
        expect(first.ok).toBe(true)
        if (!first.ok) return
        expect(first.shot.traces[0].termination).toBe("hit_obstacle")
        expect(first.state.craters).toHaveLength(1)
        expect(first.state.enemies[0].hp).toBe(50)

        const second = simulateFunctionWarsShot(destructible, first.state, "0", "standard")
        expect(second.ok).toBe(true)
        if (!second.ok) return
        expect(second.state.status).toBe("won")

        const steel = testLevel({
            obstacles: [{
                id: "steel",
                kind: "rect",
                x: -5,
                y: 0,
                width: 0.45,
                height: 0.7,
                destructible: false,
                material: "steel",
            }],
        })
        const steelFirst = simulateFunctionWarsShot(steel, createFunctionWarsState(steel), "0", "standard")
        expect(steelFirst.ok).toBe(true)
        if (!steelFirst.ok) return
        const steelSecond = simulateFunctionWarsShot(steel, steelFirst.state, "0", "standard")
        expect(steelSecond.ok).toBe(true)
        if (!steelSecond.ok) return
        expect(steelSecond.state.enemies[0].hp).toBe(50)
    })

    it("damages an enemy once when a void level loses the support under it", () => {
        const level = testLevel({
            ground: "void",
            fallHazard: true,
            enemies: [{ id: "armor", type: "armored", position: { x: -2, y: 0 } }],
            obstacles: [
                { id: "player-support", kind: "rect", x: -10, y: -0.59, width: 1.4, height: 0.7, destructible: false, material: "steel" },
                { id: "armor-support", kind: "rect", x: -2, y: -0.59, width: 1.3, height: 0.7, destructible: true, material: "wood" },
            ],
        })
        const result = fire(level, "-0.0875x", "heavy")

        expect(result.state.status).toBe("playing")
        expect(result.state.playerAlive).toBe(true)
        expect(result.state.enemies[0].hp).toBe(11)
        expect(result.state.fallDamagedUnitIds).toEqual(["armor"])
        expect(result.shot.falls).toEqual([{ unitId: "armor", side: "enemy", position: { x: -2, y: 0 } }])
        expect(result.shot.lost).toBe(false)

        const next = simulateFunctionWarsShot(level, result.state, "x", "standard")
        expect(next.ok).toBe(true)
        if (!next.ok) return
        expect(next.state.enemies[0].hp).toBe(11)
        expect(next.shot.falls).toEqual([])
    })

    it("loses the level when the player destroys their own void support", () => {
        const level = testLevel({
            ground: "void",
            fallHazard: true,
            enemies: [{ id: "enemy", type: "normal", position: { x: -2, y: 0 } }],
            obstacles: [
                { id: "player-support", kind: "rect", x: -10, y: -0.59, width: 1.4, height: 0.7, destructible: true, material: "wood" },
                { id: "enemy-support", kind: "rect", x: -2, y: -0.59, width: 1.3, height: 0.7, destructible: false, material: "steel" },
            ],
        })
        const result = fire(level, "-x", "standard")

        expect(result.state.status).toBe("lost")
        expect(result.state.playerAlive).toBe(false)
        expect(result.state.enemies[0].hp).toBe(50)
        expect(result.shot.falls).toEqual([{ unitId: "player", side: "player", position: { x: -10, y: 0 } }])
        expect(result.shot.lost).toBe(true)
    })

    it("collects a crate without stopping the projectile and saves its buff for the next shot", () => {
        const level = testLevel({
            enemies: [{ id: "armor", type: "armored", position: { x: -2, y: 0 } }],
            crates: [{ id: "boost", pickup: "blast_boost", position: { x: -6, y: 0 } }],
        })
        const result = fire(level, "0", "standard")

        expect(result.shot.pickups).toEqual([{ crateId: "boost", pickup: "blast_boost" }])
        expect(result.shot.traces[0].termination).toBe("hit_enemy")
        expect(result.state.crates[0].active).toBe(false)
        expect(result.state.buffs.blastBoost).toBe(true)
        expect(result.state.enemies[0].hp).toBe(50)
    })

    it("rejects mission-rule expressions without consuming shots, ammo, or buffs", () => {
        const level = testLevel({
            mission: { expressionRule: { allFunctions: ["sin"], constants: ["pi"] } },
        })
        const state = createFunctionWarsState(level)
        state.buffs.blastBoost = true

        const result = simulateFunctionWarsShot(level, state, "x", "heavy")

        expect(result).toMatchObject({ ok: false, code: "mission_rule" })
        expect(state.shots).toBe(0)
        expect(state.inventory.heavy).toBe(2)
        expect(state.buffs.blastBoost).toBe(true)
    })

    it.each(["0sin(x)+x+0*pi", "sin(x)-sin(x)+pi*x/pi", "0.001sin(pi*x)+x"])("rejects decorative required functions without spending ammo: %s", expression => {
        const level = testLevel({ mission: { expressionRule: { allFunctions: ["sin"], constants: ["pi"] } } })
        const state = createFunctionWarsState(level)
        expect(simulateFunctionWarsShot(level, state, expression, "heavy")).toMatchObject({ok:false,code:"mission_rule"})
        expect(state.shots).toBe(0)
        expect(state.inventory.heavy).toBe(2)
    })

    it("ends challenge 15 immediately when targets clear without the effective sine objective", () => {
        const level = FUNCTION_WARS_LEVELS[14]
        const first = fire(level, "0.4abs(x-8)-3.2", "mirror")
        const second = simulateFunctionWarsShot(level, first.state, "0.01abs(x)", "drill")
        expect(second.ok).toBe(true)
        if (!second.ok) return
        expect(second.state.enemies.every(enemy => enemy.hp <= 0)).toBe(true)
        expect(second.state.relays.every(relay => !relay.active)).toBe(true)
        expect(second.state.status).toBe("lost")
        expect(second.state.lossReason).toBe("mission_incomplete")
        expect(simulateFunctionWarsShot(level, second.state, "0.1sin(x)", "standard")).toMatchObject({ok:false,code:"game_complete"})
    })

    it("previews the current shot without mutating ammo, buffs or random state", () => {
        const {result} = renderHook(() => useFunctionWars())
        const before = result.current.inventory
        const preview = result.current.previewShot
        expect(preview.ok).toBe(true)
        expect(result.current.inventory).toBe(before)
        expect(result.current.shots).toBe(0)
        let actual
        act(() => { actual = result.current.fire() })
        expect(actual).toEqual(preview)
    })

    it.each(["mirror", "split"] as const)("collects a relay only once across %s traces", (weapon) => {
        const level = testLevel({
            enemies: [{ id: "far", type: "normal", position: { x: 10, y: 5 } }],
            relays: [{ id: "relay", position: { x: -9.96, y: 0 }, radius: 0.4 }],
        })

        const result = fire(level, "0", weapon)

        expect(result.shot.relays).toEqual([{ relayId: "relay" }])
        expect(result.state.relays[0].active).toBe(false)
    })

    it("tracks functions and weapons only for effective shots", () => {
        const level = testLevel({
            enemies: [{ id: "enemy", type: "normal", position: { x: -2, y: 0 } }],
        })
        const missed = simulateFunctionWarsShot(level, createFunctionWarsState(level), "abs(x)", "heavy")
        expect(missed.ok).toBe(true)
        if (!missed.ok) return
        expect(missed.shot.effective).toBe(false)
        expect(missed.state.effectiveFunctions).toEqual([])
        expect(missed.state.effectiveWeapons).toEqual([])

        const hit = simulateFunctionWarsShot(level, missed.state, "sin(x)*0", "standard")
        expect(hit.ok).toBe(true)
        if (!hit.ok) return
        expect(hit.shot.effective).toBe(true)
        expect(hit.state.effectiveFunctions).toEqual([])
        expect(hit.state.effectiveWeapons).toEqual(["standard"])
    })

    it("wins before applying the shot-limit loss when the final shot completes every objective", () => {
        const level = testLevel({
            relays: [{ id: "relay", position: { x: -6, y: 0 } }],
            mission: { effectiveFunctions: ["sin"], shotLimit: 1 },
        })

        const result = fire(level, "0.1sin(x)", "standard")

        expect(result.state.status).toBe("won")
        expect(result.state.lossReason).toBeNull()
        expect(result.state.relays[0].active).toBe(false)
    })

    it("loses with a shot-limit reason when objectives remain", () => {
        const level = testLevel({
            enemies: [{ id: "enemy", type: "normal", position: { x: -2, y: 5 } }],
            mission: { shotLimit: 1 },
        })

        const result = fire(level, "0", "standard")

        expect(result.state.status).toBe("lost")
        expect(result.state.lossReason).toBe("shot_limit")
    })

    it("drills through destructible cover and explodes at the configured depth", () => {
        const level = testLevel({
            enemies: [{ id: "armor", type: "armored", position: { x: -3.6, y: 0 } }],
            obstacles: [{
                id: "bunker",
                kind: "rect",
                x: -5,
                y: 0,
                width: 2.4,
                height: 2,
                destructible: true,
                material: "earth",
            }],
        })
        const result = fire(level, "0", "drill")

        expect(result.shot.traces[0].termination).toBe("hit_obstacle")
        expect(result.shot.traces[0].impact?.x).toBeGreaterThan(-5.5)
        expect(result.state.craters).toHaveLength(1)
        expect(result.state.enemies[0].hp).toBeLessThan(100)
    })

    it("splits at an earlier wall collision even when the unimpeded rising path would exit the ceiling", () => {
        const level = testLevel({ obstacles: [{id:"steel-wall",kind:"rect",x:-7,y:0,width:0.5,height:14,destructible:false,material:"steel"}] })
        const result = fire(level, "2x", "split")
        expect(result.shot.traces).toHaveLength(4)
        expect(result.shot.traces[0]).toMatchObject({termination:"split",hitId:"steel-wall"})
        expect(result.shot.traces[0].impact?.x).toBeCloseTo(-7.33)
    })

    it("emits three vertical fragments and two mirrored function traces", () => {
        const split = fire(testLevel(), "0", "split")
        expect(split.shot.traces).toHaveLength(4)
        expect(split.shot.traces.filter((trace) => trace.fragment)).toHaveLength(3)

        const mirrorLevel = testLevel({
            enemies: [
                { id: "top", type: "normal", position: { x: -2, y: 2 } },
                { id: "bottom", type: "normal", position: { x: -2, y: -2 } },
            ],
        })
        const mirror = fire(mirrorLevel, "0.25x", "mirror")
        expect(mirror.shot.traces).toHaveLength(2)
        expect(mirror.state.status).toBe("won")
        expect(mirror.state.enemies.every((enemy) => enemy.hp === 0)).toBe(true)
    })

    it("stops discontinuous trajectories before they cross an asymptote", () => {
        const level = testLevel({
            player: { x: -10, y: 0 },
            enemies: [{ id: "far", type: "normal", position: { x: 8, y: 0 } }],
        })
        const result = fire(level, "1/(x-5)+0.2", "standard")

        expect(["discontinuity", "domain_error", "out_of_bounds"]).toContain(result.shot.traces[0].termination)
        expect(result.state.enemies[0].hp).toBe(50)
    })

    it("stops at the vertical boundary before re-entry", () => {
        const level = testLevel({
            player: { x: -10, y: 0 },
            enemies: [{ id: "return-target", type: "normal", position: { x: 5, y: 5.4 } }],
        })
        const result = fire(level, "0.12x(18-x)", "standard")
        const trace = result.shot.traces[0]

        expect(trace.points.every((point) => point.y <= FUNCTION_WARS_WORLD.maxY)).toBe(true)
        expect(trace.termination).toBe("out_of_bounds")
        expect(result.state.enemies[0].hp).toBe(50)
    })

    it("finishes without damage when an offscreen curve never re-enters", () => {
        const level = testLevel({
            player: { x: -10, y: 0 },
            enemies: [{ id: "missed-target", type: "normal", position: { x: 8, y: 0 } }],
        })
        const result = fire(level, "x", "standard")
        const trace = result.shot.traces[0]

        expect(trace.termination).toBe("out_of_bounds")
        expect(trace.points.every((point) => point.y <= FUNCTION_WARS_WORLD.maxY)).toBe(true)
        expect(trace.points.at(-1)).toEqual({ x: -3, y: 7 })
        expect(result.shot.damage).toEqual([])
        expect(result.state.enemies[0].hp).toBe(50)
    })
})

describe("useFunctionWars", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getPlaygroundItemMock.mockReturnValue(null)
    })

    it("migrates old records without inventing stars or solutions", () => {
        getPlaygroundItemMock.mockReturnValue({ totalGames: 4, solvedLevels: ["grass-01", "grass-01"], bestShots: { "grass-01": 1 }, bestTimes: { "grass-01": 6 }, onlineGames: 2, onlineWins: 1 })
        const { result } = renderHook(() => useFunctionWars())
        expect(result.current.stats).toEqual({ totalGames: 4, solvedLevels: ["grass-01"], bestShots: { "grass-01": 1 }, bestTimes: { "grass-01": 6 }, onlineGames: 2, onlineWins: 1, bestStars: {}, bestSolutions: {} })
    })

    it("rejects malformed stars and inconsistent solution steps", () => {
        getPlaygroundItemMock.mockReturnValue({
            bestStars: { "grass-01": 2.5, "grass-02": 4, "grass-03": 3, unknown: 3 },
            bestSolutions: {
                "grass-01": { stars: 3, shots: 2, steps: [{ expression: "0", weaponId: "standard" }] },
                "grass-02": { stars: 3, shots: 1, steps: [{ expression: "0", weaponId: "unknown" }] },
                "grass-03": { stars: 2, shots: 1, steps: [{ expression: "0", weaponId: "standard" }] },
            },
        })
        const { result } = renderHook(() => useFunctionWars())
        expect(result.current.stats.bestStars).toEqual({ "grass-03": 3 })
        expect(result.current.stats.bestSolutions).toEqual({})
    })

    it("keeps the best stars and matching actual shot sequence after a slower win", () => {
        const { result } = renderHook(() => useFunctionWars())
        act(() => { result.current.fire("bad input") })
        act(() => { result.current.fire("0") })
        expect(result.current.stats.bestSolutions["grass-01"]).toEqual({ stars: 3, shots: 1, steps: [{ expression: "0", weaponId: "standard" }] })
        act(() => { result.current.retryLevel() })
        act(() => { result.current.fire("x") })
        act(() => { result.current.fire("0") })
        expect(result.current.stars).toBe(2)
        expect(result.current.stats.bestStars["grass-01"]).toBe(3)
        expect(result.current.stats.bestSolutions["grass-01"]?.shots).toBe(1)
        expect(setPlaygroundItemMock).toHaveBeenLastCalledWith(FUNCTION_WARS_STATS_KEY, result.current.stats)
    })

    it("replaces a lower-star run with its complete higher-star shot sequence", () => {
        const { result } = renderHook(() => useFunctionWars())
        act(() => { result.current.fire("x") })
        act(() => { result.current.fire("0") })
        expect(result.current.stats.bestSolutions["grass-01"]?.steps).toEqual([{ expression: "x", weaponId: "standard" }, { expression: "0", weaponId: "standard" }])
        act(() => { result.current.retryLevel() })
        act(() => { result.current.fire("0") })
        expect(result.current.stats.bestSolutions["grass-01"]).toEqual({ stars: 3, shots: 1, steps: [{ expression: "0", weaponId: "standard" }] })
    })

    it("prefers fewer shots when stars tie and reloads the same winning steps", () => {
        const { result, unmount } = renderHook(() => useFunctionWars())
        for (const expression of ["x", "x", "0"]) act(() => { result.current.fire(expression) })
        expect(result.current.stats.bestSolutions["grass-01"]?.stars).toBe(2)
        act(() => { result.current.retryLevel() })
        for (const expression of ["x", "0"]) act(() => { result.current.fire(expression) })
        const saved = result.current.stats
        expect(saved.bestSolutions["grass-01"]).toEqual({ stars: 2, shots: 2, steps: [{ expression: "x", weaponId: "standard" }, { expression: "0", weaponId: "standard" }] })
        unmount()
        getPlaygroundItemMock.mockReturnValue(saved)
        const reloaded = renderHook(() => useFunctionWars())
        expect(reloaded.result.current.stats).toEqual(saved)
    })

    it("preserves the expression on retry and clears it for a fresh level", () => {
        const { result } = renderHook(() => useFunctionWars())
        act(() => { result.current.setExpression("0.25x") })
        act(() => { result.current.retryLevel() })
        expect(result.current.expression).toBe("0.25x")
        act(() => { result.current.startLevel(1) })
        expect(result.current.expression).toBe("0")
    })

    it("switches exhausted special ammo to standard while preserving shot metadata", () => {
        const { result } = renderHook(() => useFunctionWars(1))
        act(() => { result.current.selectWeapon("heavy") })
        act(() => { result.current.fire("x") })
        expect(result.current.status).toBe("playing")
        expect(result.current.selectedWeapon).toBe("standard")
        expect(result.current.lastShot?.weaponId).toBe("heavy")
        expect(result.current.weaponNotice).toContain("已切换")
        act(() => { result.current.selectWeapon("standard") })
        expect(result.current.weaponNotice).toBeNull()
        act(() => { result.current.retryLevel() })
        act(() => { result.current.selectWeapon("heavy") })
        act(() => { result.current.fire("0.25x") })
        expect(result.current.status).toBe("won")
        expect(result.current.selectedWeapon).toBe("heavy")
        expect(result.current.weaponNotice).toBeNull()
        expect(result.current.stats.bestSolutions["grass-02"]?.steps).toEqual([{ expression: "0.25x", weaponId: "heavy" }])
    })

    it("scores par thresholds", () => {
        expect(getFunctionWarsStars(2, 2)).toBe(3)
        expect(getFunctionWarsStars(2, 2, false)).toBe(2)
        expect(getFunctionWarsStars(2, 4)).toBe(2)
        expect(getFunctionWarsStars(2, 5)).toBe(1)
    })

    it("wins the first level, persists normalized stats, and does not double-record", () => {
        const { result } = renderHook(() => useFunctionWars())

        act(() => {
            result.current.fire("0")
        })

        expect(result.current.status).toBe("won")
        expect(result.current.shots).toBe(1)
        expect(result.current.stars).toBe(3)
        expect(result.current.stats.totalGames).toBe(1)
        expect(result.current.stats.solvedLevels).toContain("grass-01")
        expect(setPlaygroundItemMock).toHaveBeenCalledWith(
            FUNCTION_WARS_STATS_KEY,
            expect.objectContaining({
                totalGames: 1,
                bestShots: { "grass-01": 1 },
                bestTimes: { "grass-01": 1 },
            }),
        )

        act(() => {
            result.current.fire("0")
        })
        expect(result.current.stats.totalGames).toBe(1)
    })

    it("counts a terminal loss once without recording completion stats", () => {
        const { result } = renderHook(() => useFunctionWars(10))

        for (let shot = 0; shot < 5; shot += 1) {
            act(() => {
                result.current.fire("1000sin(pi*x)")
            })
        }

        expect(result.current.status).toBe("lost")
        expect(result.current.lossReason).toBe("shot_limit")
        expect(result.current.stats).toMatchObject({
            totalGames: 1,
            solvedLevels: [],
            bestShots: {},
            bestTimes: {},
        })
        expect(setPlaygroundItemMock).toHaveBeenLastCalledWith(
            FUNCTION_WARS_STATS_KEY,
            expect.objectContaining({
                totalGames: 1,
                solvedLevels: [],
                bestShots: {},
                bestTimes: {},
            }),
        )

        act(() => {
            result.current.fire("1000sin(pi*x)")
        })
        expect(result.current.stats.totalGames).toBe(1)
        expect(setPlaygroundItemMock).toHaveBeenCalledTimes(1)
    })

    it("pauses elapsed time while the single-player view is inactive", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-07-16T00:00:00.000Z"))

        try {
            const { result, rerender, unmount } = renderHook(
                ({ active }) => useFunctionWars(0, active),
                { initialProps: { active: true } },
            )

            act(() => vi.advanceTimersByTime(2_100))
            expect(result.current.time).toBe(2)

            rerender({ active: false })
            act(() => vi.advanceTimersByTime(5_000))
            expect(result.current.time).toBe(2)

            rerender({ active: true })
            act(() => vi.advanceTimersByTime(1_100))
            expect(result.current.time).toBe(3)
            unmount()
        } finally {
            vi.useRealTimers()
        }
    })
})
