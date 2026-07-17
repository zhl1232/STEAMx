import { parseFunctionExpression, plotFunction } from "@/lib/playground/function-plotter"
import {
    WEAPON_DEFINITIONS,
} from "@/lib/playground/function-wars-weapons"
import {
    FUNCTION_WARS_ONLINE_MAX_DAMAGE_PER_SHOT,
    FUNCTION_WARS_WORLD_BOUNDS,
    opponentFunctionWarsRole,
    type FunctionWarsFireSummary,
    type FunctionWarsOnlineCrate,
    type FunctionWarsOnlineMap,
    type FunctionWarsOnlineObstacle,
    type FunctionWarsPlayerInventory,
    type FunctionWarsPoint,
    type FunctionWarsRole,
    type FunctionWarsWeaponId,
} from "@/lib/playground/function-wars-online"

const ONLINE_TRAJECTORY_MAX_SAMPLES = 720

export type FunctionWarsOnlineShotTrace = {
    id: string
    points: FunctionWarsPoint[]
    mirrored?: boolean
    sourceUnitId?: string
}

export type FunctionWarsOnlineShotImpact = FunctionWarsPoint & {
    id: string
    intensity: number
    obstacleId?: string
}

export type FunctionWarsOnlineShotSimulation = {
    traces: FunctionWarsOnlineShotTrace[]
    summary: FunctionWarsFireSummary
    impact: FunctionWarsOnlineShotImpact | null
    error: string | null
}

type TraceCollision = {
    points: FunctionWarsPoint[]
    pickedIds: string[]
    impact: FunctionWarsPoint | null
    obstacleId: string | null
    crater: { x: number; y: number; radius: number } | null
    damage: number
}

type SegmentInterval = { start: number; end: number }

function pointDistance(a: FunctionWarsPoint, b: FunctionWarsPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

function segmentCircleInterval(
    start: FunctionWarsPoint,
    end: FunctionWarsPoint,
    center: FunctionWarsPoint,
    radius: number,
): SegmentInterval | null {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const offsetX = start.x - center.x
    const offsetY = start.y - center.y
    const a = dx * dx + dy * dy
    if (a === 0) return pointDistance(start, center) <= radius ? { start: 0, end: 0 } : null

    const b = 2 * (offsetX * dx + offsetY * dy)
    const c = offsetX * offsetX + offsetY * offsetY - radius * radius
    const discriminant = b * b - 4 * a * c
    if (discriminant < 0) return null

    const root = Math.sqrt(discriminant)
    const first = (-b - root) / (2 * a)
    const second = (-b + root) / (2 * a)
    const interval = { start: Math.max(0, first), end: Math.min(1, second) }
    return interval.start <= interval.end ? interval : null
}

function segmentRectInterval(
    start: FunctionWarsPoint,
    end: FunctionWarsPoint,
    obstacle: Extract<FunctionWarsOnlineObstacle, { shape: "rect" }>,
): SegmentInterval | null {
    let entering = 0
    let leaving = 1
    const axes = [
        [start.x, end.x - start.x, obstacle.x - obstacle.width / 2, obstacle.x + obstacle.width / 2],
        [start.y, end.y - start.y, obstacle.y - obstacle.height / 2, obstacle.y + obstacle.height / 2],
    ] as const

    for (const [origin, delta, minimum, maximum] of axes) {
        if (delta === 0) {
            if (origin < minimum || origin > maximum) return null
            continue
        }
        const first = (minimum - origin) / delta
        const second = (maximum - origin) / delta
        entering = Math.max(entering, Math.min(first, second))
        leaving = Math.min(leaving, Math.max(first, second))
        if (entering > leaving) return null
    }
    return { start: entering, end: leaving }
}

function segmentObstacleInterval(
    start: FunctionWarsPoint,
    end: FunctionWarsPoint,
    obstacle: FunctionWarsOnlineObstacle,
): SegmentInterval | null {
    return obstacle.shape === "circle"
        ? segmentCircleInterval(start, end, obstacle, obstacle.radius)
        : segmentRectInterval(start, end, obstacle)
}

function interpolatePoint(
    start: FunctionWarsPoint,
    end: FunctionWarsPoint,
    progress: number,
): FunctionWarsPoint {
    return {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
    }
}

function obstacleCollisionProgress(
    start: FunctionWarsPoint,
    end: FunctionWarsPoint,
    obstacle: FunctionWarsOnlineObstacle,
    existingCraters: Array<{ x: number; y: number; radius: number }>,
): number | null {
    const obstacleInterval = segmentObstacleInterval(start, end, obstacle)
    if (!obstacleInterval) return null
    if (!obstacle.destructible) return obstacleInterval.start

    const holes = existingCraters
        .map((crater) => segmentCircleInterval(start, end, crater, crater.radius * 0.72))
        .filter((interval): interval is SegmentInterval => interval !== null)
        .sort((left, right) => left.start - right.start)
    let cursor = obstacleInterval.start
    for (const hole of holes) {
        if (hole.end < cursor) continue
        if (hole.start > cursor) return cursor
        cursor = Math.max(cursor, hole.end + 1e-9)
        if (cursor > obstacleInterval.end) return null
    }
    return cursor <= obstacleInterval.end ? cursor : null
}

function sampleTrajectory(
    expression: string,
    origin: FunctionWarsPoint,
    role: FunctionWarsRole,
    mirrored = false,
): { points: FunctionWarsPoint[]; error: string | null } {
    const parsed = parseFunctionExpression(expression)
    if (!parsed.ok) return { points: [], error: parsed.error.message }

    const direction = role === "host" ? 1 : -1
    const horizontalDistance = role === "host"
        ? FUNCTION_WARS_WORLD_BOUNDS.maxX - origin.x
        : origin.x - FUNCTION_WARS_WORLD_BOUNDS.minX
    const plotted = plotFunction(parsed.parsed, {
        startX: 0,
        endX: horizontalDistance,
        step: 0.045,
        yOffset: origin.y,
        yScale: mirrored ? -1 : 1,
        maxAbsY: 1_000_000,
        discontinuityThreshold: 10,
        maxSamples: ONLINE_TRAJECTORY_MAX_SAMPLES,
    })
    const points: FunctionWarsPoint[] = []
    for (const sample of plotted.samples) {
        const point = { x: origin.x + direction * sample.x, y: sample.y }
        if (
            point.x < FUNCTION_WARS_WORLD_BOUNDS.minX ||
            point.x > FUNCTION_WARS_WORLD_BOUNDS.maxX
        ) break
        points.push(point)
    }
    return { points, error: null }
}

function unique<T>(items: T[]): T[] {
    return [...new Set(items)]
}

function walkTrajectory(
    points: FunctionWarsPoint[],
    options: {
        map: FunctionWarsOnlineMap
        role: FunctionWarsRole
        weapon: FunctionWarsWeaponId
        crates: FunctionWarsOnlineCrate[]
        existingCraters: Array<{ x: number; y: number; radius: number }>
        blastBoost: boolean
        penetration: boolean
        fragment?: boolean
    },
): TraceCollision {
    const definition = WEAPON_DEFINITIONS[options.weapon]
    const target = options.map.turrets[opponentFunctionWarsRole(options.role)]
    const damage = options.fragment ? definition.fragmentDamage : definition.damage
    const baseBlastRadius = options.fragment ? definition.fragmentBlastRadius : definition.blastRadius
    const blastRadius = baseBlastRadius * (options.blastBoost ? 1.5 : 1)
    const baseCraterRadius = options.fragment ? definition.fragmentCraterRadius : definition.craterRadius
    const craterRadius = Math.round(
        baseCraterRadius * (options.blastBoost ? 1.5 : 1) * 1_000_000,
    ) / 1_000_000
    const visible: FunctionWarsPoint[] = []
    const pickedIds: string[] = []

    for (let index = 0; index < points.length; index += 1) {
        const start = index === 0 ? points[0] : points[index - 1]
        const end = points[index]
        const targetProgress = segmentCircleInterval(start, end, target, 0.62)?.start ?? null
        let obstacleHit: { obstacle: FunctionWarsOnlineObstacle; progress: number } | null = null
        for (const obstacle of options.map.obstacles) {
            const progress = obstacleCollisionProgress(start, end, obstacle, options.existingCraters)
            if (progress === null || (obstacleHit && obstacleHit.progress <= progress)) continue
            obstacleHit = { obstacle, progress }
        }
        const blockingProgress = targetProgress !== null && (
            obstacleHit === null || targetProgress <= obstacleHit.progress
        )
            ? targetProgress
            : obstacleHit?.progress ?? 1

        for (const crate of options.crates) {
            if (pickedIds.includes(crate.id)) continue
            const crateProgress = segmentCircleInterval(start, end, crate, 0.52)?.start
            if (crateProgress !== undefined && crateProgress <= blockingProgress) pickedIds.push(crate.id)
        }

        if (targetProgress !== null && (obstacleHit === null || targetProgress <= obstacleHit.progress)) {
            const point = interpolatePoint(start, end, targetProgress)
            visible.push(point)
            return {
                points: visible,
                pickedIds,
                impact: point,
                obstacleId: null,
                crater: craterRadius > 0 ? { ...point, radius: craterRadius } : null,
                damage,
            }
        }

        if (obstacleHit) {
            const point = interpolatePoint(start, end, obstacleHit.progress)
            visible.push(point)
            if (!obstacleHit.obstacle.destructible) {
                return {
                    points: visible,
                    pickedIds,
                    impact: point,
                    obstacleId: obstacleHit.obstacle.id,
                    crater: null,
                    damage: 0,
                }
            }

            const shouldPenetrate = options.weapon === "drill" || options.penetration
            const direction = options.role === "host" ? 1 : -1
            const impact = shouldPenetrate
                ? {
                    x: point.x + direction * Math.max(definition.penetrationDepth, options.penetration ? 1.1 : 0),
                    y: point.y,
                }
                : point
            const splashDistance = pointDistance(impact, target)
            const splashDamage = blastRadius > 0 && splashDistance <= blastRadius
                ? Math.max(1, Math.round(damage * (1 - splashDistance / blastRadius)))
                : 0
            return {
                points: visible,
                pickedIds,
                impact,
                obstacleId: null,
                crater: craterRadius > 0 ? { ...impact, radius: craterRadius } : null,
                damage: splashDamage,
            }
        }

        visible.push(end)
    }

    return { points: visible, pickedIds, impact: null, obstacleId: null, crater: null, damage: 0 }
}

export function simulateFunctionWarsOnlineShot(args: {
    expression: string
    role: FunctionWarsRole
    weapon: FunctionWarsWeaponId
    map: FunctionWarsOnlineMap
    crates: FunctionWarsOnlineCrate[]
    craters: Array<{ x: number; y: number; radius: number }>
    inventory: FunctionWarsPlayerInventory
}): FunctionWarsOnlineShotSimulation {
    const origin = args.map.turrets[args.role]
    const availableCrates = args.crates.filter((crate) => crate.picked_by === null)
    const first = sampleTrajectory(args.expression, origin, args.role)
    if (first.error) return { traces: [], summary: {}, impact: null, error: first.error }

    const traceInputs: Array<{ id: string; points: FunctionWarsPoint[]; mirrored?: boolean; fragment?: boolean }> = []
    const collisions: TraceCollision[] = []
    const walk = (trace: { points: FunctionWarsPoint[]; fragment?: boolean }) => walkTrajectory(trace.points, {
        map: args.map,
        role: args.role,
        weapon: args.weapon,
        crates: availableCrates,
        existingCraters: args.craters,
        blastBoost: args.inventory.blast_boost,
        penetration: args.inventory.penetration,
        fragment: trace.fragment,
    })
    if (args.weapon === "split" && first.points.length > 1) {
        let apexIndex = 0
        for (let index = 1; index < first.points.length; index += 1) {
            if (first.points[index].y > first.points[apexIndex].y) apexIndex = index
        }
        const mainTrace = { id: "split-main", points: first.points.slice(0, apexIndex + 1) }
        const mainCollision = walk(mainTrace)
        const splitPoint = mainCollision.impact ?? mainCollision.points.at(-1)
        traceInputs.push(mainTrace)
        collisions.push(mainCollision)

        if (!splitPoint) {
            return { traces: [], summary: {}, impact: null, error: "弹道没有可用的分裂点" }
        }
        for (let fragment = -1; fragment <= 1; fragment += 1) {
            const x = splitPoint.x + fragment * 0.5
            const points: FunctionWarsPoint[] = [{ x, y: splitPoint.y }]
            const firstVisibleY = Math.min(splitPoint.y - 0.08, FUNCTION_WARS_WORLD_BOUNDS.maxY)
            for (
                let y = firstVisibleY;
                y >= FUNCTION_WARS_WORLD_BOUNDS.minY && points.length < ONLINE_TRAJECTORY_MAX_SAMPLES;
                y -= 0.08
            ) {
                points.push({ x, y })
            }
            const fragmentTrace = { id: `split-${fragment + 2}`, points, fragment: true }
            traceInputs.push(fragmentTrace)
            collisions.push(walk(fragmentTrace))
        }
    } else {
        traceInputs.push({ id: "primary", points: first.points })
        if (args.weapon === "mirror") {
            const mirrored = sampleTrajectory(args.expression, origin, args.role, true)
            traceInputs.push({ id: "mirror", points: mirrored.points, mirrored: true })
        }
        collisions.push(...traceInputs.map(walk))
    }
    const traces = traceInputs.map((trace, index) => ({
        id: trace.id,
        points: collisions[index].points,
        mirrored: trace.mirrored,
        sourceUnitId: trace.fragment ? undefined : `online-${args.role}`,
    }))
    const craters = collisions.flatMap((collision) => collision.crater ? [collision.crater] : [])
    const totalDamage = Math.min(
        FUNCTION_WARS_ONLINE_MAX_DAMAGE_PER_SHOT,
        collisions.reduce((sum, collision) => sum + collision.damage, 0),
    )
    const firstCollision = collisions.find((collision) => collision.impact)
    const summary: FunctionWarsFireSummary = {
        damage: totalDamage > 0
            ? { target: opponentFunctionWarsRole(args.role), amount: totalDamage }
            : null,
        craters,
        picked_crate_ids: unique(collisions.flatMap((collision) => collision.pickedIds)),
    }

    return {
        traces,
        summary,
        impact: firstCollision?.impact
            ? {
                id: "preview",
                ...firstCollision.impact,
                intensity: args.weapon === "heavy" ? 38 : 25,
                ...(firstCollision.obstacleId ? { obstacleId: firstCollision.obstacleId } : {}),
            }
            : null,
        error: null,
    }
}
