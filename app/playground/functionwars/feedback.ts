import type { FunctionWarsCoreState, FunctionWarsProjectileTrace, FunctionWarsShotResult } from "@/hooks/playground/use-function-wars"
import type { FunctionWarsLevel } from "@/lib/playground/function-wars-levels"
import { evaluateFunction, parseFunctionExpression } from "@/lib/playground/function-plotter"
import { FUNCTION_WARS_FLIGHT_DISTANCE } from "@/lib/playground/function-wars-trajectory"

type FeedbackState = Pick<FunctionWarsCoreState, "status" | "lossReason" | "effectiveFunctions" | "enemies" | "shots" | "relays">
export type FunctionWarsFeedback = {
    summary: string
    detail?: string
    tone: "neutral" | "success" | "warning"
    endpoints: { x: number; y: number; text: string }[]
}

const MATERIAL_NAMES = { earth: "土层", wood: "木掩体", rock: "岩石", steel: "钢板" } as const

function endLabel(level: FunctionWarsLevel, trace: FunctionWarsProjectileTrace): string {
    switch (trace.termination) {
        case "distance_limit": return `射程耗尽 · ${FUNCTION_WARS_FLIGHT_DISTANCE}/${FUNCTION_WARS_FLIGHT_DISTANCE}`
        case "out_of_bounds": return "到达边界"
        case "sample_limit": return "曲线过于复杂"
        case "domain_error":
        case "discontinuity": return "函数在此中断"
        case "hit_enemy": return "命中目标"
        case "hit_obstacle": {
            const obstacle = level.obstacles.find(item => item.id === trace.hitId)
            return obstacle ? `击中${MATERIAL_NAMES[obstacle.material]}` : "击中掩体"
        }
        case "split": return "分裂点"
        default: return "航程结束"
    }
}

function learningHint(level: FunctionWarsLevel, state: FeedbackState, shot: FunctionWarsShotResult): string | undefined {
    // Only coach the known straight-line tutorial. Do not guess how arbitrary
    // functions should change, or imply a direction is a guaranteed solution.
    if (level.number !== 2 || shot.damage.length || shot.falls.length) return
    const expression = shot.expression.replace(/\s/g, "")
    if (!/^(?:0(?:\.0+)?|[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)\*?)?x)$/.test(expression)) return
    const target = state.enemies.find(enemy => enemy.hp > 0)
    const parsed = parseFunctionExpression(expression)
    if (!target || !parsed.ok) return
    const height = evaluateFunction(parsed.parsed, target.position.x - level.player.x)
    if (!height.ok) return
    const difference = target.position.y - level.player.y - height.value
    if (difference > target.radius + 0.08) return "这条直线低于目标，试着增大斜率。"
    if (difference < -target.radius - 0.08) return "这条直线高于目标，试着减小斜率。"
}

/** Uses the simulator's post-shot state for both previews and actual results. */
export function getFunctionWarsFeedback(level: FunctionWarsLevel, state: FeedbackState, shot: FunctionWarsShotResult): FunctionWarsFeedback {
    const endpoints = shot.traces.flatMap(trace => {
        const point = trace.points.at(-1)
        return point ? [{ ...point, text: endLabel(level, trace) }] : []
    }).slice(0, 4)
    if (state.status === "lost") {
        if (state.lossReason === "mission_incomplete") {
            const missing = (level.mission?.effectiveFunctions ?? []).filter(name => !state.effectiveFunctions.includes(name))
            return {
                summary: `目标清空，但还需有效使用 ${missing.join("、") || "任务函数"}，任务失败`,
                detail: "先让缺少的函数命中目标或连接中继，再清除最后一个目标。",
                tone: "warning", endpoints,
            }
        }
        if (state.lossReason === "player_fell") return {
            summary: "我方失去支撑，任务失败", detail: "调整落点，避开我方炮台下方的承重。", tone: "warning", endpoints,
        }
        return {
            summary: "次数用完，任务尚未完成", detail: "试着用镜像、分裂或承重坠落减少射击次数。", tone: "warning", endpoints,
        }
    }

    const results: string[] = []
    const damaged = new Set(shot.damage.map(event => event.enemyId)).size
    const fallen = shot.falls.filter(event => event.side === "enemy").length
    if (fallen) results.push(`击断承重 · 击落 ${fallen} 座炮台`)
    if (damaged) {
        const armorBroken = shot.damage.some(event => event.remainingHp === 0 && level.enemies.some(enemy => enemy.id === event.enemyId && enemy.type === "armored"))
        results.push(`${armorBroken ? "装甲击破" : `命中 ${damaged} 个目标`} · 伤害 ${shot.damage.reduce((sum, event) => sum + event.damage, 0)}`)
    }
    if (shot.relays.length) results.push(`连接 ${shot.relays.length} 个中继`)
    if (shot.pickups.length) results.push(`拾取 ${shot.pickups.length} 份补给`)

    const limited = shot.traces.find(trace => trace.termination === "distance_limit")
    const interrupted = shot.traces.find(trace => ["sample_limit", "domain_error", "discontinuity"].includes(trace.termination))
    const reason = limited ?? interrupted ?? shot.traces.find(trace => trace.termination !== "split")
    const summary = results.length ? results.join("；") : reason ? endLabel(level, reason) : "本发没有命中目标"
    let detail = learningHint(level, state, shot)
    if (limited) detail = `沿曲线最多飞行 ${FUNCTION_WARS_FLIGHT_DISTANCE} 格；减小振幅或频率，可以飞得更远。`
    else if (interrupted) detail = interrupted.termination === "sample_limit"
        ? "试着减小频率或斜率，让曲线更平缓。"
        : "检查终点附近的函数定义域，曲线不能跨过无定义的位置。"
    else if (!results.length && reason?.termination === "hit_obstacle") {
        const obstacle = level.obstacles.find(item => item.id === reason.hitId)
        if (!detail) detail = obstacle?.destructible
            ? "可破坏的掩体能逐步打穿，也可以调整曲线绕过。"
            : "这处掩体不能打穿，试着调整曲线绕过。"
    }
    return { summary, detail, tone: results.length ? "success" : limited || interrupted ? "warning" : "neutral", endpoints }
}
