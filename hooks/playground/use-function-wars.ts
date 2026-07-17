import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
    parseFunctionExpression,
    plotFunction,
    type FunctionName,
    type ParsedFunction,
} from "@/lib/playground/function-plotter"
import {
    FUNCTION_WARS_LEVELS,
    FUNCTION_WARS_WORLD,
    getFunctionWarsLevel,
    type FunctionWarsCrate,
    type FunctionWarsLevel,
    type FunctionWarsObstacle,
    type FunctionWarsRelay,
    type WorldPoint,
} from "@/lib/playground/function-wars-levels"
import {
    FUNCTION_WARS_ENEMY_HP,
    PICKUP_DEFINITIONS,
    WEAPON_DEFINITIONS,
    canUseWeapon,
    chooseSpecialWeapon,
    consumeWeapon,
    createWeaponInventory,
    type FunctionWarsEnemyType,
    type PickupId,
    type SpecialWeaponId,
    type WeaponId,
    type WeaponInventory,
} from "@/lib/playground/function-wars-weapons"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export const FUNCTION_WARS_STATS_KEY = "function_wars_stats"
export const FUNCTION_WARS_PROJECTILE_STEP = 0.04
export const FUNCTION_WARS_PROJECTILE_RADIUS = 0.08

export type FunctionWarsStatus = "playing" | "won" | "lost"
export type FunctionWarsLossReason = "player_fell" | "shot_limit" | null

export type FunctionWarsStats = {
    totalGames: number
    solvedLevels: string[]
    bestShots: Record<string, number>
    bestTimes: Record<string, number>
    onlineGames: number
    onlineWins: number
}

export type FunctionWarsBuffs = {
    blastBoost: boolean
    penetration: boolean
    shield: boolean
    repairCharges: number
}

export type FunctionWarsCrater = WorldPoint & {
    id: string
    radius: number
}

export type FunctionWarsEnemyState = {
    id: string
    type: FunctionWarsEnemyType
    position: WorldPoint
    radius: number
    hp: number
    maxHp: number
}

export type FunctionWarsCrateState = {
    id: string
    pickup: PickupId
    position: WorldPoint
    radius: number
    active: boolean
}

export type FunctionWarsRelayState = {
    id: string
    position: WorldPoint
    radius: number
    active: boolean
}

export type FunctionWarsFallEvent = {
    unitId: string
    side: "player" | "enemy"
    position: WorldPoint
}

export type FunctionWarsCoreState = {
    status: FunctionWarsStatus
    lossReason: FunctionWarsLossReason
    playerAlive: boolean
    fallDamagedUnitIds: string[]
    enemies: FunctionWarsEnemyState[]
    craters: FunctionWarsCrater[]
    crates: FunctionWarsCrateState[]
    relays: FunctionWarsRelayState[]
    inventory: WeaponInventory
    buffs: FunctionWarsBuffs
    shots: number
    effectiveFunctions: FunctionName[]
    effectiveWeapons: WeaponId[]
    randomSeed: number
}

export type FunctionWarsTraceTermination =
    | "completed"
    | "out_of_bounds"
    | "discontinuity"
    | "domain_error"
    | "hit_obstacle"
    | "hit_enemy"
    | "split"

export type FunctionWarsProjectileTrace = {
    id: string
    weaponId: WeaponId
    points: WorldPoint[]
    termination: FunctionWarsTraceTermination
    impact?: WorldPoint
    hitId?: string
    fragment: boolean
}

export type FunctionWarsDamageEvent = {
    enemyId: string
    damage: number
    remainingHp: number
    direct: boolean
}

export type FunctionWarsPickupEvent = {
    crateId: string
    pickup: PickupId
    grantedWeapon?: SpecialWeaponId
}

export type FunctionWarsRelayEvent = {
    relayId: string
}

export type FunctionWarsShotResult = {
    seq: number
    expression: string
    weaponId: WeaponId
    traces: FunctionWarsProjectileTrace[]
    damage: FunctionWarsDamageEvent[]
    pickups: FunctionWarsPickupEvent[]
    relays: FunctionWarsRelayEvent[]
    cratersAdded: FunctionWarsCrater[]
    falls: FunctionWarsFallEvent[]
    effective: boolean
    won: boolean
    lost: boolean
}

export type FunctionWarsFireErrorCode =
    | "game_complete"
    | "weapon_unavailable"
    | "invalid_expression"
    | "mission_rule"
    | "empty_trajectory"

export type FunctionWarsFireResult =
    | { ok: true; state: FunctionWarsCoreState; shot: FunctionWarsShotResult }
    | { ok: false; code: FunctionWarsFireErrorCode; error: string }

type BlockingCollision = {
    type: "obstacle" | "enemy"
    id: string
    t: number
    point: WorldPoint
    destructible: boolean
}

type SimulationContext = {
    level: FunctionWarsLevel
    state: FunctionWarsCoreState
    shot: FunctionWarsShotResult
    traceIndex: number
    craterIndex: number
}

type TraceOptions = {
    weaponId: WeaponId
    damage: number
    blastRadius: number
    craterRadius: number
    penetrationDepth: number
    fragment?: boolean
}

const EMPTY_STATS: FunctionWarsStats = {
    totalGames: 0,
    solvedLevels: [],
    bestShots: {},
    bestTimes: {},
    onlineGames: 0,
    onlineWins: 0,
}

const EMPTY_BUFFS: FunctionWarsBuffs = {
    blastBoost: false,
    penetration: false,
    shield: false,
    repairCharges: 0,
}

const FUNCTION_WARS_SUPPORT_FALL_DAMAGE = 20

function clonePoint(point: WorldPoint): WorldPoint {
    return { x: point.x, y: point.y }
}

function cloneCoreState(state: FunctionWarsCoreState): FunctionWarsCoreState {
    return {
        ...state,
        playerAlive: state.playerAlive,
        fallDamagedUnitIds: [...state.fallDamagedUnitIds],
        enemies: state.enemies.map((enemy) => ({ ...enemy, position: clonePoint(enemy.position) })),
        craters: state.craters.map((crater) => ({ ...crater })),
        crates: state.crates.map((crate) => ({ ...crate, position: clonePoint(crate.position) })),
        relays: state.relays.map((relay) => ({ ...relay, position: clonePoint(relay.position) })),
        inventory: { ...state.inventory },
        buffs: { ...state.buffs },
        effectiveFunctions: [...state.effectiveFunctions],
        effectiveWeapons: [...state.effectiveWeapons],
    }
}

function finiteRecord(value: unknown): Record<string, number> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    const result: Record<string, number> = {}
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) result[key] = entry
    }
    return result
}

function loadStats(): FunctionWarsStats {
    const raw = getPlaygroundItem<Partial<FunctionWarsStats>>(FUNCTION_WARS_STATS_KEY)
    if (!raw) return { ...EMPTY_STATS, bestShots: {}, bestTimes: {}, solvedLevels: [] }
    return {
        totalGames: typeof raw.totalGames === "number" && Number.isFinite(raw.totalGames) ? Math.max(0, raw.totalGames) : 0,
        solvedLevels: Array.isArray(raw.solvedLevels)
            ? [...new Set(raw.solvedLevels.filter((id): id is string => typeof id === "string"))]
            : [],
        bestShots: finiteRecord(raw.bestShots),
        bestTimes: finiteRecord(raw.bestTimes),
        onlineGames: typeof raw.onlineGames === "number" && Number.isFinite(raw.onlineGames) ? Math.max(0, raw.onlineGames) : 0,
        onlineWins: typeof raw.onlineWins === "number" && Number.isFinite(raw.onlineWins) ? Math.max(0, raw.onlineWins) : 0,
    }
}

function saveStats(stats: FunctionWarsStats): void {
    setPlaygroundItem(FUNCTION_WARS_STATS_KEY, stats)
}

function makeCrateState(crate: FunctionWarsCrate): FunctionWarsCrateState {
    return {
        id: crate.id,
        pickup: crate.pickup,
        position: clonePoint(crate.position),
        radius: crate.radius ?? 0.38,
        active: true,
    }
}

function makeRelayState(relay: FunctionWarsRelay): FunctionWarsRelayState {
    return {
        id: relay.id,
        position: clonePoint(relay.position),
        radius: relay.radius ?? 0.34,
        active: true,
    }
}

export function createFunctionWarsState(level: FunctionWarsLevel): FunctionWarsCoreState {
    return {
        status: "playing",
        lossReason: null,
        playerAlive: true,
        fallDamagedUnitIds: [],
        enemies: level.enemies.map((enemy) => {
            const maxHp = FUNCTION_WARS_ENEMY_HP[enemy.type]
            return {
                id: enemy.id,
                type: enemy.type,
                position: clonePoint(enemy.position),
                radius: enemy.radius ?? 0.42,
                hp: maxHp,
                maxHp,
            }
        }),
        craters: [],
        crates: level.crates.map(makeCrateState),
        relays: (level.relays ?? []).map(makeRelayState),
        inventory: createWeaponInventory(level.weaponInventory),
        buffs: { ...EMPTY_BUFFS },
        shots: 0,
        effectiveFunctions: [],
        effectiveWeapons: [],
        randomSeed: level.seed >>> 0,
    }
}

export function getFunctionWarsStars(par: number, shots: number, bonusComplete = true): 1 | 2 | 3 {
    if (shots <= par) return bonusComplete ? 3 : 2
    if (shots <= par + 2) return 2
    return 1
}

export function isFunctionWarsBonusComplete(
    level: FunctionWarsLevel,
    state: Pick<FunctionWarsCoreState, "effectiveFunctions" | "effectiveWeapons">,
): boolean {
    const objectives = level.mission?.bonusObjectives ?? []
    return objectives.every((objective) => objective.kind === "function"
        ? state.effectiveFunctions.includes(objective.function)
        : state.effectiveWeapons.includes(objective.weapon))
}

function distance(a: WorldPoint, b: WorldPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

function interpolate(start: WorldPoint, end: WorldPoint, t: number): WorldPoint {
    return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
    }
}

export function isPointInsideFunctionWarsObstacle(point: WorldPoint, obstacle: FunctionWarsObstacle): boolean {
    if (obstacle.kind === "circle") {
        return Math.hypot(point.x - obstacle.x, point.y - obstacle.y) <= obstacle.radius
    }
    return (
        point.x >= obstacle.x - obstacle.width / 2 &&
        point.x <= obstacle.x + obstacle.width / 2 &&
        point.y >= obstacle.y - obstacle.height / 2 &&
        point.y <= obstacle.y + obstacle.height / 2
    )
}

function isRemovedByCrater(point: WorldPoint, craters: readonly FunctionWarsCrater[]): boolean {
    return craters.some((crater) => distance(point, crater) <= crater.radius)
}

function rectTop(obstacle: Extract<FunctionWarsObstacle, { kind: "rect" }>): number {
    return obstacle.y + obstacle.height / 2
}

function hasSolidSupportAt(
    obstacle: Extract<FunctionWarsObstacle, { kind: "rect" }>,
    point: WorldPoint,
    craters: readonly FunctionWarsCrater[],
): boolean {
    if (!isPointInsideFunctionWarsObstacle(point, obstacle)) return false
    return !obstacle.destructible || !isRemovedByCrater(point, craters)
}

function hasSupportUnderUnit(
    level: FunctionWarsLevel,
    craters: readonly FunctionWarsCrater[],
    unit: { position: WorldPoint; radius: number },
): boolean {
    const halfFootprint = Math.max(0.24, unit.radius * 0.72)
    const sampleXs = [
        unit.position.x,
        unit.position.x - halfFootprint,
        unit.position.x + halfFootprint,
    ]

    for (const obstacle of level.obstacles) {
        if (obstacle.kind !== "rect") continue
        const top = rectTop(obstacle)
        const gap = unit.position.y - top
        if (gap < FUNCTION_WARS_PROJECTILE_RADIUS || gap > 0.45) continue

        for (const x of sampleXs) {
            const point = { x, y: top - 0.01 }
            if (hasSolidSupportAt(obstacle, point, craters)) return true
        }
    }

    return false
}

function settleUnsupportedUnits(context: SimulationContext): void {
    if (!context.level.fallHazard) return

    if (context.state.playerAlive) {
        const playerSupported = hasSupportUnderUnit(context.level, context.state.craters, {
            position: context.level.player,
            radius: 0.5,
        })
        if (!playerSupported) {
            context.state.playerAlive = false
            context.shot.falls.push({
                unitId: "player",
                side: "player",
                position: clonePoint(context.level.player),
            })
        }
    }

    for (const enemy of context.state.enemies) {
        if (enemy.hp <= 0) continue
        if (context.state.fallDamagedUnitIds.includes(enemy.id)) continue
        if (hasSupportUnderUnit(context.level, context.state.craters, enemy)) continue
        const damage = Math.min(enemy.hp, FUNCTION_WARS_SUPPORT_FALL_DAMAGE)
        enemy.hp = Math.max(0, enemy.hp - damage)
        context.state.fallDamagedUnitIds.push(enemy.id)
        context.shot.falls.push({
            unitId: enemy.id,
            side: "enemy",
            position: clonePoint(enemy.position),
        })
        context.shot.damage.push({
            enemyId: enemy.id,
            damage,
            remainingHp: enemy.hp,
            direct: false,
        })
    }
}

export function segmentCircleIntersectionT(
    start: WorldPoint,
    end: WorldPoint,
    center: WorldPoint,
    radius: number,
): number | null {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const fx = start.x - center.x
    const fy = start.y - center.y
    const a = dx * dx + dy * dy
    const c = fx * fx + fy * fy - radius * radius
    if (c <= 0) return 0
    if (a === 0) return null
    const b = 2 * (fx * dx + fy * dy)
    const discriminant = b * b - 4 * a * c
    if (discriminant < 0) return null
    const root = Math.sqrt(discriminant)
    const first = (-b - root) / (2 * a)
    const second = (-b + root) / (2 * a)
    if (first >= 0 && first <= 1) return first
    if (second >= 0 && second <= 1) return second
    return null
}

function segmentRectIntersectionT(
    start: WorldPoint,
    end: WorldPoint,
    obstacle: Extract<FunctionWarsObstacle, { kind: "rect" }>,
    padding: number,
): number | null {
    const minX = obstacle.x - obstacle.width / 2 - padding
    const maxX = obstacle.x + obstacle.width / 2 + padding
    const minY = obstacle.y - obstacle.height / 2 - padding
    const maxY = obstacle.y + obstacle.height / 2 + padding
    const dx = end.x - start.x
    const dy = end.y - start.y
    let near = 0
    let far = 1

    for (const [origin, delta, min, max] of [
        [start.x, dx, minX, maxX],
        [start.y, dy, minY, maxY],
    ] as const) {
        if (Math.abs(delta) < 1e-12) {
            if (origin < min || origin > max) return null
            continue
        }
        const first = (min - origin) / delta
        const second = (max - origin) / delta
        const axisNear = Math.min(first, second)
        const axisFar = Math.max(first, second)
        near = Math.max(near, axisNear)
        far = Math.min(far, axisFar)
        if (near > far) return null
    }
    return near >= 0 && near <= 1 ? near : null
}

function obstacleIntersectionT(
    start: WorldPoint,
    end: WorldPoint,
    obstacle: FunctionWarsObstacle,
    craters: readonly FunctionWarsCrater[],
): number | null {
    const t = obstacle.kind === "circle"
        ? segmentCircleIntersectionT(start, end, obstacle, obstacle.radius + FUNCTION_WARS_PROJECTILE_RADIUS)
        : segmentRectIntersectionT(start, end, obstacle, FUNCTION_WARS_PROJECTILE_RADIUS)
    if (t === null) return null
    const point = interpolate(start, end, t)
    if (obstacle.destructible && isRemovedByCrater(point, craters)) return null
    return t
}

function isHorizontallyInWorld(point: WorldPoint): boolean {
    return point.x >= FUNCTION_WARS_WORLD.minX && point.x <= FUNCTION_WARS_WORLD.maxX
}

type VerticalSegmentSlice = {
    start: WorldPoint
    end: WorldPoint
    startT: number
    endT: number
}

function clipSegmentToVerticalWorld(start: WorldPoint, end: WorldPoint): VerticalSegmentSlice | null {
    const deltaY = end.y - start.y
    if (Math.abs(deltaY) < 1e-12) {
        if (start.y < FUNCTION_WARS_WORLD.minY || start.y > FUNCTION_WARS_WORLD.maxY) return null
        return { start, end, startT: 0, endT: 1 }
    }

    const minT = (FUNCTION_WARS_WORLD.minY - start.y) / deltaY
    const maxT = (FUNCTION_WARS_WORLD.maxY - start.y) / deltaY
    const startT = Math.max(0, Math.min(minT, maxT))
    const endT = Math.min(1, Math.max(minT, maxT))
    if (startT > endT) return null
    return {
        start: interpolate(start, end, startT),
        end: interpolate(start, end, endT),
        startT,
        endT,
    }
}

function getHorizontalExitT(start: WorldPoint, end: WorldPoint): number | null {
    if (end.x >= FUNCTION_WARS_WORLD.minX && end.x <= FUNCTION_WARS_WORLD.maxX) return null
    const deltaX = end.x - start.x
    if (Math.abs(deltaX) < 1e-12) return 0
    const boundary = end.x < FUNCTION_WARS_WORLD.minX
        ? FUNCTION_WARS_WORLD.minX
        : FUNCTION_WARS_WORLD.maxX
    return Math.max(0, Math.min(1, (boundary - start.x) / deltaX))
}

function findBlockingCollision(
    context: SimulationContext,
    start: WorldPoint,
    end: WorldPoint,
    ignoreDestructible: boolean,
    ignoreEnemies = false,
): BlockingCollision | null {
    const candidates: BlockingCollision[] = []
    for (const obstacle of context.level.obstacles) {
        if (ignoreDestructible && obstacle.destructible) continue
        const t = obstacleIntersectionT(start, end, obstacle, context.state.craters)
        if (t !== null) {
            candidates.push({
                type: "obstacle",
                id: obstacle.id,
                t,
                point: interpolate(start, end, t),
                destructible: obstacle.destructible,
            })
        }
    }
    if (!ignoreEnemies) {
        for (const enemy of context.state.enemies) {
            if (enemy.hp <= 0) continue
            const t = segmentCircleIntersectionT(
                start,
                end,
                enemy.position,
                enemy.radius + FUNCTION_WARS_PROJECTILE_RADIUS,
            )
            if (t !== null) {
                candidates.push({
                    type: "enemy",
                    id: enemy.id,
                    t,
                    point: interpolate(start, end, t),
                    destructible: false,
                })
            }
        }
    }
    candidates.sort((a, b) => a.t - b.t || (a.type === "obstacle" ? -1 : 1))
    return candidates[0] ?? null
}

function nextRandom(state: FunctionWarsCoreState): number {
    state.randomSeed = (Math.imul(state.randomSeed, 1_664_525) + 1_013_904_223) >>> 0
    return state.randomSeed / 0x1_0000_0000
}

function applyPickup(context: SimulationContext, crate: FunctionWarsCrateState): void {
    if (!crate.active) return
    crate.active = false
    const event: FunctionWarsPickupEvent = { crateId: crate.id, pickup: crate.pickup }
    switch (crate.pickup) {
        case "ammo": {
            const weapon = chooseSpecialWeapon(context.level.availableWeapons, nextRandom(context.state))
            if (weapon) {
                const amount = PICKUP_DEFINITIONS.ammo.ammoAmount ?? 1
                context.state.inventory[weapon] += amount
                event.grantedWeapon = weapon
            }
            break
        }
        case "blast_boost":
            context.state.buffs.blastBoost = true
            break
        case "penetration":
            context.state.buffs.penetration = true
            break
        case "shield":
            context.state.buffs.shield = true
            break
        case "repair":
            context.state.buffs.repairCharges += 1
            break
    }
    context.shot.pickups.push(event)
}

function collectCrates(
    context: SimulationContext,
    start: WorldPoint,
    end: WorldPoint,
    maxT: number,
): void {
    const hits = context.state.crates
        .filter((crate) => crate.active)
        .map((crate) => ({
            crate,
            t: segmentCircleIntersectionT(start, end, crate.position, crate.radius + FUNCTION_WARS_PROJECTILE_RADIUS),
        }))
        .filter((hit): hit is { crate: FunctionWarsCrateState; t: number } => hit.t !== null && hit.t <= maxT)
        .sort((a, b) => a.t - b.t)
    for (const hit of hits) applyPickup(context, hit.crate)
}

function collectRelays(
    context: SimulationContext,
    start: WorldPoint,
    end: WorldPoint,
    maxT: number,
): void {
    const hits = context.state.relays
        .filter((relay) => relay.active)
        .map((relay) => ({
            relay,
            t: segmentCircleIntersectionT(start, end, relay.position, relay.radius + FUNCTION_WARS_PROJECTILE_RADIUS),
        }))
        .filter((hit): hit is { relay: FunctionWarsRelayState; t: number } => hit.t !== null && hit.t <= maxT)
        .sort((a, b) => a.t - b.t)

    for (const { relay } of hits) {
        if (!relay.active) continue
        relay.active = false
        context.shot.relays.push({ relayId: relay.id })
    }
}

function findVisibleBlockingCollision(
    context: SimulationContext,
    start: WorldPoint,
    end: WorldPoint,
    ignoreDestructible: boolean,
    ignoreEnemies = false,
): BlockingCollision | null {
    const visible = clipSegmentToVerticalWorld(start, end)
    if (!visible) return null
    const collision = findBlockingCollision(
        context,
        visible.start,
        visible.end,
        ignoreDestructible,
        ignoreEnemies,
    )
    if (!collision) return null
    return {
        ...collision,
        t: visible.startT + collision.t * (visible.endT - visible.startT),
    }
}

function collectVisibleCrates(
    context: SimulationContext,
    start: WorldPoint,
    end: WorldPoint,
    maxT: number,
): void {
    const boundedEnd = interpolate(start, end, Math.max(0, Math.min(1, maxT)))
    const visible = clipSegmentToVerticalWorld(start, boundedEnd)
    if (!visible) return
    collectCrates(context, visible.start, visible.end, 1)
}

function collectVisibleRelays(
    context: SimulationContext,
    start: WorldPoint,
    end: WorldPoint,
    maxT: number,
): void {
    const boundedEnd = interpolate(start, end, Math.max(0, Math.min(1, maxT)))
    const visible = clipSegmentToVerticalWorld(start, boundedEnd)
    if (!visible) return
    collectRelays(context, visible.start, visible.end, 1)
}

function collectVisibleObjectives(
    context: SimulationContext,
    start: WorldPoint,
    end: WorldPoint,
    maxT: number,
): void {
    collectVisibleCrates(context, start, end, maxT)
    collectVisibleRelays(context, start, end, maxT)
}

export function computeFunctionWarsExplosionDamage(
    baseDamage: number,
    blastRadius: number,
    distanceFromCenter: number,
    targetRadius = 0,
): number {
    if (baseDamage <= 0 || blastRadius <= 0) return 0
    const effectiveDistance = Math.max(0, distanceFromCenter - targetRadius)
    if (effectiveDistance > blastRadius) return 0
    const falloff = 1 - effectiveDistance / blastRadius
    return Math.max(1, Math.round(baseDamage * falloff))
}

function applyExplosion(
    context: SimulationContext,
    point: WorldPoint,
    options: TraceOptions,
    directEnemyId?: string,
): void {
    if (options.craterRadius > 0) {
        const crater: FunctionWarsCrater = {
            id: `crater-${context.shot.seq}-${context.craterIndex++}`,
            ...clonePoint(point),
            radius: options.craterRadius,
        }
        context.state.craters.push(crater)
        context.shot.cratersAdded.push(crater)
    }

    for (const enemy of context.state.enemies) {
        if (enemy.hp <= 0) continue
        const direct = enemy.id === directEnemyId
        const rawDamage = direct
            ? options.damage
            : computeFunctionWarsExplosionDamage(
                options.damage,
                options.blastRadius,
                distance(point, enemy.position),
                enemy.radius,
            )
        if (rawDamage <= 0) continue
        const armorMultiplier = enemy.type === "armored"
            ? WEAPON_DEFINITIONS[options.weaponId].armorDamageMultiplier
            : 1
        const damage = Math.max(1, Math.round(rawDamage * armorMultiplier))
        enemy.hp = Math.max(0, enemy.hp - damage)
        context.shot.damage.push({
            enemyId: enemy.id,
            damage,
            remainingHp: enemy.hp,
            direct,
        })
    }
}

function addTrace(
    context: SimulationContext,
    weaponId: WeaponId,
    points: WorldPoint[],
    termination: FunctionWarsTraceTermination,
    fragment: boolean,
    collision?: BlockingCollision,
): FunctionWarsProjectileTrace {
    const trace: FunctionWarsProjectileTrace = {
        id: `shot-${context.shot.seq}-trace-${context.traceIndex++}`,
        weaponId,
        points,
        termination,
        fragment,
        ...(collision ? { impact: clonePoint(collision.point), hitId: collision.id } : {}),
    }
    context.shot.traces.push(trace)
    return trace
}

function simulateTrace(
    context: SimulationContext,
    path: readonly WorldPoint[],
    pathTermination: FunctionWarsTraceTermination,
    options: TraceOptions,
): FunctionWarsProjectileTrace {
    const points: WorldPoint[] = []
    if (path.length === 0) return addTrace(context, options.weaponId, points, "domain_error", Boolean(options.fragment))
    points.push(clonePoint(path[0]))
    if (!isHorizontallyInWorld(path[0])) {
        return addTrace(context, options.weaponId, points, "out_of_bounds", Boolean(options.fragment))
    }

    let drillingRemaining = 0
    for (let index = 1; index < path.length; index += 1) {
        const start = path[index - 1]
        const end = path[index]
        const horizontalExitT = getHorizontalExitT(start, end)
        const travelEnd = horizontalExitT === null ? end : interpolate(start, end, horizontalExitT)

        const segmentLength = distance(start, travelEnd)
        const collision = findVisibleBlockingCollision(
            context,
            start,
            travelEnd,
            drillingRemaining > 0,
            drillingRemaining > 0,
        )
        const drillingT = drillingRemaining > 0 && segmentLength > 0 && drillingRemaining <= segmentLength
            ? drillingRemaining / segmentLength
            : Number.POSITIVE_INFINITY
        const stopT = Math.min(collision?.t ?? 1, drillingT)
        collectVisibleObjectives(context, start, travelEnd, stopT)

        if (drillingRemaining > 0 && drillingT <= (collision?.t ?? 1)) {
            const impact = interpolate(start, travelEnd, drillingT)
            points.push(impact)
            applyExplosion(context, impact, options)
            return addTrace(context, options.weaponId, points, "hit_obstacle", Boolean(options.fragment), {
                type: "obstacle",
                id: "drill-depth",
                t: drillingT,
                point: impact,
                destructible: true,
            })
        }

        if (collision) {
            points.push(clonePoint(collision.point))
            if (collision.type === "obstacle" && collision.destructible && options.penetrationDepth > 0 && drillingRemaining <= 0) {
                const distanceAfterContact = segmentLength * Math.max(0, 1 - collision.t)
                if (distanceAfterContact >= options.penetrationDepth && segmentLength > 0) {
                    const impactT = collision.t + options.penetrationDepth / segmentLength
                    const impact = interpolate(start, travelEnd, impactT)
                    points.push(impact)
                    applyExplosion(context, impact, options)
                    return addTrace(context, options.weaponId, points, "hit_obstacle", Boolean(options.fragment), {
                        ...collision,
                        id: "drill-depth",
                        t: impactT,
                        point: impact,
                    })
                }
                drillingRemaining = Math.max(0, options.penetrationDepth - distanceAfterContact)
                points.push(clonePoint(travelEnd))
                if (horizontalExitT !== null) {
                    return addTrace(context, options.weaponId, points, "out_of_bounds", Boolean(options.fragment))
                }
                continue
            }
            applyExplosion(
                context,
                collision.point,
                options,
                collision.type === "enemy" ? collision.id : undefined,
            )
            return addTrace(
                context,
                options.weaponId,
                points,
                collision.type === "enemy" ? "hit_enemy" : "hit_obstacle",
                Boolean(options.fragment),
                collision,
            )
        }

        if (drillingRemaining > 0) drillingRemaining -= segmentLength
        points.push(clonePoint(travelEnd))
        if (horizontalExitT !== null) {
            return addTrace(context, options.weaponId, points, "out_of_bounds", Boolean(options.fragment))
        }
    }

    return addTrace(context, options.weaponId, points, pathTermination, Boolean(options.fragment))
}

function createFunctionPath(
    parsed: ParsedFunction,
    level: FunctionWarsLevel,
    yScale: number,
): { points: WorldPoint[]; termination: FunctionWarsTraceTermination } {
    const maxLocalX = FUNCTION_WARS_WORLD.maxX - level.player.x
    const plotted = plotFunction(parsed, {
        startX: 0,
        endX: maxLocalX,
        step: FUNCTION_WARS_PROJECTILE_STEP,
        yOffset: level.player.y,
        yScale,
        maxAbsY: 1_000_000,
        discontinuityThreshold: 10,
        maxSamples: 2048,
    })
    const points = plotted.samples.map((sample) => ({ x: level.player.x + sample.x, y: sample.y }))
    const termination: FunctionWarsTraceTermination = plotted.termination.kind === "completed"
        ? "completed"
        : plotted.termination.kind === "discontinuity"
          ? "discontinuity"
          : "domain_error"
    return { points, termination }
}

function simulateSplitShot(
    context: SimulationContext,
    path: readonly WorldPoint[],
    pathTermination: FunctionWarsTraceTermination,
    options: TraceOptions,
): void {
    if (path.length === 0) {
        addTrace(context, options.weaponId, [], "domain_error", false)
        return
    }

    let apexIndex = 0
    for (let index = 1; index < path.length; index += 1) {
        if (isHorizontallyInWorld(path[index]) && path[index].y > path[apexIndex].y) apexIndex = index
    }
    if (apexIndex === 0 && path.length > 1) apexIndex = Math.min(path.length - 1, 1)

    const mainPoints: WorldPoint[] = [clonePoint(path[0])]
    let splitPoint: WorldPoint | null = null
    let splitCollision: BlockingCollision | undefined
    for (let index = 1; index <= apexIndex; index += 1) {
        const start = path[index - 1]
        const end = path[index]
        const horizontalExitT = getHorizontalExitT(start, end)
        const travelEnd = horizontalExitT === null ? end : interpolate(start, end, horizontalExitT)
        const collision = findVisibleBlockingCollision(context, start, travelEnd, false)
        collectVisibleObjectives(context, start, travelEnd, collision?.t ?? 1)
        if (collision) {
            splitPoint = clonePoint(collision.point)
            splitCollision = collision
            mainPoints.push(splitPoint)
            break
        }
        mainPoints.push(clonePoint(travelEnd))
        if (horizontalExitT !== null) {
            addTrace(context, options.weaponId, mainPoints, "out_of_bounds", false)
            return
        }
    }
    splitPoint ??= mainPoints.at(-1) ?? null
    if (!splitPoint || !isHorizontallyInWorld(splitPoint)) {
        addTrace(context, options.weaponId, mainPoints, pathTermination, false)
        return
    }

    addTrace(context, options.weaponId, mainPoints, "split", false, splitCollision)
    const definition = WEAPON_DEFINITIONS.split
    const count = definition.splitCount
    const spread = 0.38
    for (let fragment = 0; fragment < count; fragment += 1) {
        const offset = (fragment - (count - 1) / 2) * spread
        const start = { x: splitPoint.x + offset, y: splitPoint.y }
        const fragmentPath: WorldPoint[] = [start]
        const firstVisibleY = Math.min(start.y - FUNCTION_WARS_PROJECTILE_STEP, FUNCTION_WARS_WORLD.maxY)
        for (
            let y = firstVisibleY;
            y >= FUNCTION_WARS_WORLD.minY - FUNCTION_WARS_PROJECTILE_STEP;
            y -= FUNCTION_WARS_PROJECTILE_STEP
        ) {
            fragmentPath.push({ x: start.x, y })
        }
        simulateTrace(context, fragmentPath, "out_of_bounds", {
            ...options,
            damage: definition.fragmentDamage,
            blastRadius: options.blastRadius,
            craterRadius: options.craterRadius,
            fragment: true,
        })
    }
}

function expressionRequirementLabel(value: FunctionName | "pi" | "e"): string {
    if (value === "pi") return "π"
    return value
}

function validateFunctionWarsExpressionMission(
    level: FunctionWarsLevel,
    parsed: ParsedFunction,
): string | null {
    const rule = level.mission?.expressionRule
    if (!rule) return null

    const missingFunctions = (rule.allFunctions ?? []).filter((name) => !parsed.functions.includes(name))
    const missingConstants = (rule.constants ?? []).filter((name) => !parsed.constants.includes(name))
    const anyFunctions = rule.anyFunctions ?? []
    const hasAnyFunction = anyFunctions.length === 0 || anyFunctions.some((name) => parsed.functions.includes(name))
    const requirements = [
        ...missingFunctions.map(expressionRequirementLabel),
        ...missingConstants.map(expressionRequirementLabel),
    ]
    if (!hasAnyFunction) {
        requirements.push(anyFunctions.map(expressionRequirementLabel).join(" 或 "))
    }
    if (requirements.length === 0) return null
    return `本关每次发射必须使用 ${requirements.join("、")}`
}

function isFunctionWarsMissionComplete(level: FunctionWarsLevel, state: FunctionWarsCoreState): boolean {
    if (state.enemies.some((enemy) => enemy.hp > 0)) return false
    if (state.relays.some((relay) => relay.active)) return false
    return (level.mission?.effectiveFunctions ?? []).every((name) => state.effectiveFunctions.includes(name))
}

export function simulateFunctionWarsShot(
    level: FunctionWarsLevel,
    currentState: FunctionWarsCoreState,
    expression: string,
    weaponId: WeaponId,
): FunctionWarsFireResult {
    if (currentState.status !== "playing") {
        return { ok: false, code: "game_complete", error: "本关已经结束" }
    }
    if (!level.availableWeapons.includes(weaponId) || !canUseWeapon(currentState.inventory, weaponId)) {
        return { ok: false, code: "weapon_unavailable", error: "该武器当前没有可用弹药" }
    }
    const parsed = parseFunctionExpression(expression)
    if (!parsed.ok) {
        return { ok: false, code: "invalid_expression", error: parsed.error.message }
    }
    const missionError = validateFunctionWarsExpressionMission(level, parsed.parsed)
    if (missionError) {
        return { ok: false, code: "mission_rule", error: missionError }
    }

    const firstEvaluation = plotFunction(parsed.parsed, { startX: 0, endX: 0, step: 0.1 })
    if (firstEvaluation.samples.length === 0) {
        return {
            ok: false,
            code: "empty_trajectory",
            error: firstEvaluation.termination.message ?? "函数在炮口位置没有有效轨迹",
        }
    }

    const state = cloneCoreState(currentState)
    state.shots += 1
    state.inventory = consumeWeapon(state.inventory, weaponId)
    const blastMultiplier = state.buffs.blastBoost
        ? PICKUP_DEFINITIONS.blast_boost.blastRadiusMultiplier ?? 1.5
        : 1
    const penetrationDepth = Math.max(
        WEAPON_DEFINITIONS[weaponId].penetrationDepth,
        state.buffs.penetration ? PICKUP_DEFINITIONS.penetration.penetrationDepth ?? 1.1 : 0,
    )
    state.buffs.blastBoost = false
    state.buffs.penetration = false

    const shot: FunctionWarsShotResult = {
        seq: state.shots,
        expression: parsed.parsed.source,
        weaponId,
        traces: [],
        damage: [],
        pickups: [],
        relays: [],
        cratersAdded: [],
        falls: [],
        effective: false,
        won: false,
        lost: false,
    }
    const context: SimulationContext = {
        level,
        state,
        shot,
        traceIndex: 0,
        craterIndex: 0,
    }
    const definition = WEAPON_DEFINITIONS[weaponId]
    const baseOptions: TraceOptions = {
        weaponId,
        damage: definition.damage,
        blastRadius: definition.blastRadius * blastMultiplier,
        craterRadius: definition.craterRadius * blastMultiplier,
        penetrationDepth,
    }

    if (weaponId === "split") {
        const path = createFunctionPath(parsed.parsed, level, 1)
        simulateSplitShot(context, path.points, path.termination, {
            ...baseOptions,
            blastRadius: definition.fragmentBlastRadius * blastMultiplier,
            craterRadius: definition.fragmentCraterRadius * blastMultiplier,
        })
    } else {
        const paths = weaponId === "mirror"
            ? [createFunctionPath(parsed.parsed, level, 1), createFunctionPath(parsed.parsed, level, -1)]
            : [createFunctionPath(parsed.parsed, level, 1)]
        for (const path of paths) simulateTrace(context, path.points, path.termination, baseOptions)
    }

    settleUnsupportedUnits(context)
    shot.effective = shot.damage.length > 0 || shot.falls.length > 0 || shot.pickups.length > 0 || shot.relays.length > 0
    if (shot.effective) {
        state.effectiveFunctions = [...new Set([...state.effectiveFunctions, ...parsed.parsed.functions])]
        state.effectiveWeapons = [...new Set([...state.effectiveWeapons, weaponId])]
    }

    state.lossReason = null
    if (!state.playerAlive) {
        state.status = "lost"
        state.lossReason = "player_fell"
    } else if (isFunctionWarsMissionComplete(level, state)) {
        state.status = "won"
    } else if (level.mission?.shotLimit !== undefined && state.shots >= level.mission.shotLimit) {
        state.status = "lost"
        state.lossReason = "shot_limit"
    } else {
        state.status = "playing"
    }
    shot.won = state.status === "won"
    shot.lost = state.status === "lost"
    return { ok: true, state, shot }
}

export function useFunctionWars(initialLevelIndex = 0, active = true) {
    const initialLevel = getFunctionWarsLevel(initialLevelIndex)
    const [levelIndex, setLevelIndex] = useState(() => initialLevel.number - 1)
    const [coreState, setCoreState] = useState<FunctionWarsCoreState>(() => createFunctionWarsState(initialLevel))
    const [expression, setExpression] = useState("0")
    const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>("standard")
    const [time, setTime] = useState(0)
    const [stats, setStats] = useState<FunctionWarsStats>(() => ({
        ...EMPTY_STATS,
        solvedLevels: [],
        bestShots: {},
        bestTimes: {},
    }))
    const [lastShot, setLastShot] = useState<FunctionWarsShotResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const coreStateRef = useRef(coreState)
    const timeRef = useRef(0)
    const elapsedBeforeRunMsRef = useRef(0)
    const runningSinceRef = useRef<number | null>(null)
    const outcomeRecordedRef = useRef(false)
    const level = FUNCTION_WARS_LEVELS[levelIndex]

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        if (!active || coreState.status !== "playing") return
        const startedAt = Date.now()
        runningSinceRef.current = startedAt
        const update = () => {
            const next = Math.floor(
                (elapsedBeforeRunMsRef.current + Date.now() - startedAt) / 1_000,
            )
            timeRef.current = next
            setTime(next)
        }
        update()
        const timer = window.setInterval(update, 250)
        return () => {
            window.clearInterval(timer)
            if (runningSinceRef.current === startedAt) {
                elapsedBeforeRunMsRef.current += Math.max(0, Date.now() - startedAt)
                runningSinceRef.current = null
            }
        }
    }, [active, coreState.status])

    const recordOutcome = useCallback((
        completedLevel: FunctionWarsLevel,
        status: FunctionWarsStatus,
        shots: number,
        seconds: number,
    ) => {
        if (outcomeRecordedRef.current) return
        outcomeRecordedRef.current = true
        const normalizedShots = Math.max(1, Math.floor(shots))
        const normalizedTime = Math.max(1, Math.floor(seconds))
        setStats((previous) => {
            if (status !== "won") {
                const next = { ...previous, totalGames: previous.totalGames + 1 }
                saveStats(next)
                return next
            }
            const next: FunctionWarsStats = {
                ...previous,
                totalGames: previous.totalGames + 1,
                solvedLevels: previous.solvedLevels.includes(completedLevel.id)
                    ? previous.solvedLevels
                    : [...previous.solvedLevels, completedLevel.id],
                bestShots: {
                    ...previous.bestShots,
                    [completedLevel.id]: previous.bestShots[completedLevel.id]
                        ? Math.min(previous.bestShots[completedLevel.id], normalizedShots)
                        : normalizedShots,
                },
                bestTimes: {
                    ...previous.bestTimes,
                    [completedLevel.id]: previous.bestTimes[completedLevel.id]
                        ? Math.min(previous.bestTimes[completedLevel.id], normalizedTime)
                        : normalizedTime,
                },
            }
            saveStats(next)
            return next
        })
    }, [])

    const fire = useCallback((expressionOverride?: string) => {
        const source = expressionOverride ?? expression
        const outcome = simulateFunctionWarsShot(level, coreStateRef.current, source, selectedWeapon)
        if (!outcome.ok) {
            setError(outcome.error)
            return outcome
        }
        coreStateRef.current = outcome.state
        setCoreState(outcome.state)
        setLastShot(outcome.shot)
        setError(null)
        if (outcome.state.status !== "playing") {
            const currentTime = runningSinceRef.current === null
                ? timeRef.current
                : Math.floor(
                    (elapsedBeforeRunMsRef.current + Date.now() - runningSinceRef.current) / 1_000,
                )
            timeRef.current = currentTime
            setTime(currentTime)
            recordOutcome(level, outcome.state.status, outcome.state.shots, currentTime)
        }
        return outcome
    }, [expression, level, recordOutcome, selectedWeapon])

    const startLevel = useCallback((index: number) => {
        const nextLevel = getFunctionWarsLevel(index)
        const nextState = createFunctionWarsState(nextLevel)
        coreStateRef.current = nextState
        timeRef.current = 0
        elapsedBeforeRunMsRef.current = 0
        runningSinceRef.current = null
        outcomeRecordedRef.current = false
        setLevelIndex(nextLevel.number - 1)
        setCoreState(nextState)
        setExpression("0")
        setSelectedWeapon("standard")
        setTime(0)
        setLastShot(null)
        setError(null)
    }, [])

    const retryLevel = useCallback(() => startLevel(levelIndex), [levelIndex, startLevel])
    const selectWeapon = useCallback((weaponId: WeaponId) => {
        if (!level.availableWeapons.includes(weaponId)) return
        if (!canUseWeapon(coreStateRef.current.inventory, weaponId)) return
        setSelectedWeapon(weaponId)
    }, [level.availableWeapons])

    const stars = useMemo(
        () => coreState.status === "won"
            ? getFunctionWarsStars(level.par, coreState.shots, isFunctionWarsBonusComplete(level, coreState))
            : 0,
        [coreState, level],
    )

    return {
        level,
        levelIndex,
        levelCount: FUNCTION_WARS_LEVELS.length,
        status: coreState.status,
        lossReason: coreState.lossReason,
        playerAlive: coreState.playerAlive,
        expression,
        setExpression,
        selectedWeapon,
        selectWeapon,
        inventory: coreState.inventory,
        buffs: coreState.buffs,
        enemies: coreState.enemies,
        craters: coreState.craters,
        crates: coreState.crates,
        relays: coreState.relays,
        shots: coreState.shots,
        effectiveFunctions: coreState.effectiveFunctions,
        effectiveWeapons: coreState.effectiveWeapons,
        bonusComplete: isFunctionWarsBonusComplete(level, coreState),
        time,
        stars,
        stats,
        lastShot,
        error,
        fire,
        startLevel,
        retryLevel,
    }
}
