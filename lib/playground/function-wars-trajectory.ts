import { evaluateFunction, plotFunction, type FunctionAst, type FunctionConstant, type FunctionName, type ParsedFunction } from "./function-plotter"

export const FUNCTION_WARS_FLIGHT_DISTANCE = 36
export const FUNCTION_WARS_FLIGHT_BOUNDS = { minX: -12, maxX: 12, minY: -7, maxY: 7 } as const
export type FunctionWarsTrajectoryTermination = "completed" | "out_of_bounds" | "distance_limit" | "discontinuity" | "domain_error" | "sample_limit"
type Point = { x: number; y: number }

export function validateFunctionWarsLaunch(parsed: ParsedFunction): string | null {
    const start = evaluateFunction(parsed, 0)
    if (!start.ok) return `炮口处 x=0 无法计算：${start.message}`
    return Math.abs(start.value) <= 1e-6 ? null : "轨迹必须从炮口出发，满足 f(0)=0；例如 cos(x)-1、exp(x)-1 或 log(x+1)。"
}

/** Bounded work and irregular probes prevent regular-grid frequency aliases. */
export function buildFunctionWarsTrajectory({ parsed, origin, direction = 1, yScale = 1, bounds = FUNCTION_WARS_FLIGHT_BOUNDS }: {
    parsed: ParsedFunction; origin: Point; direction?: 1 | -1; yScale?: number
    bounds?: { minX: number; maxX: number; minY: number; maxY: number }
}): { points: Point[]; termination: FunctionWarsTrajectoryTermination; error: string | null } {
    const error = validateFunctionWarsLaunch(parsed)
    if (error) return { points: [], termination: "domain_error", error }
    const endX = direction === 1 ? bounds.maxX - origin.x : origin.x - bounds.minX
    const base = plotFunction(parsed, { startX: 0, endX, step: 0.04, maxSamples: 640 })
    const phaseArguments: FunctionAst[] = []
    const collectPhases = (node: FunctionAst): void => {
        if (node.type === "call") {
            if (node.name === "sin" || node.name === "cos" || node.name === "tan") phaseArguments.push(node.argument)
            collectPhases(node.argument)
        } else if (node.type === "unary") collectPhases(node.argument)
        else if (node.type === "binary") { collectPhases(node.left); collectPhases(node.right) }
    }
    collectPhases(parsed.ast)
    const points: Point[] = [{ ...origin }]
    let distance = 0
    let evaluations = 0
    let termination: FunctionWarsTrajectoryTermination | null = null
    const append = (x: number, value: number) => {
        const previous = points[points.length - 1]
        const next = { x: origin.x + direction * x, y: origin.y + yScale * value }
        const length = Math.hypot(next.x - previous.x, next.y - previous.y)
        let t = 1
        if (next.y > bounds.maxY) t = Math.min(t, (bounds.maxY - previous.y) / (next.y - previous.y))
        if (next.y < bounds.minY) t = Math.min(t, (bounds.minY - previous.y) / (next.y - previous.y))
        if (t < 1) termination = "out_of_bounds"
        if (distance + length * t > FUNCTION_WARS_FLIGHT_DISTANCE) {
            t = (FUNCTION_WARS_FLIGHT_DISTANCE - distance) / length
            termination = "distance_limit"
        }
        points.push({ x: previous.x + (next.x - previous.x) * t, y: previous.y + (next.y - previous.y) * t })
        distance += length * t
    }
    const refine = (a: number, av: number, b: number, bv: number, depth: number): void => {
        if (termination) return
        if (evaluations > 18000 || points.length > 10000) { termination = "sample_limit"; return }
        const probes = [0.211324865405187, 0.5, 0.788675134594813].map(t => {
            const x = a + (b - a) * t
            evaluations++
            return { x, t, value: evaluateFunction(parsed, x) }
        })
        if (probes.some(p => !p.value.ok)) { termination = "domain_error"; return }
        // Resolve phase independently of output amplitude: tiny high-frequency terms
        // can have enormous arc length even when their geometric deviation is small.
        const phaseNeedsRefinement = phaseArguments.some(argument => {
            let min = Infinity, max = -Infinity
            for (const x of [a, ...probes.map(probe => probe.x), b]) {
                evaluations++
                const phase = evaluateFunction(argument, x)
                if (!phase.ok) return true
                min = Math.min(min, phase.value)
                max = Math.max(max, phase.value)
            }
            return max - min > Math.PI / 8
        })
        const needsRefinement = phaseNeedsRefinement || probes.some(p => p.value.ok && Math.abs(p.value.value - (av + (bv - av) * p.t)) > 0.002)
            || Math.hypot(b - a, bv - av) > 0.07
        if (needsRefinement && depth >= 12) { termination = "sample_limit"; return }
        if (needsRefinement) {
            const mid = probes[1]
            if (!mid.value.ok) return
            refine(a, av, mid.x, mid.value.value, depth + 1)
            refine(mid.x, mid.value.value, b, bv, depth + 1)
        } else append(b, bv)
    }
    for (let index = 1; index < base.samples.length && !termination; index++) {
        const a = base.samples[index - 1], b = base.samples[index]
        refine(a.x, a.y, b.x, b.y, 0)
    }
    const baseTermination = base.termination.kind === "completed" ? "completed"
        : base.termination.kind === "discontinuity" ? "discontinuity"
        : base.termination.kind === "sample_limit" ? "sample_limit" : "domain_error"
    return { points, termination: termination ?? baseTermination, error: points.length < 2 ? "炮口之后没有连续可用的轨迹，请调整函数定义域或频率。" : null }
}

function dependsOnX(node: FunctionAst): boolean {
    if (node.type === "variable") return true
    if (node.type === "number") return false
    if (node.type === "binary") return dependsOnX(node.left) || dependsOnX(node.right)
    return dependsOnX(node.argument)
}

function squaredTrig(node: FunctionAst): Extract<FunctionAst, { type: "call" }> | null {
    const factor = node.type === "binary" && node.operator === "^" && node.right.type === "number" && node.right.value === 2
        ? node.left
        : node.type === "binary" && node.operator === "*" && JSON.stringify(node.left) === JSON.stringify(node.right) ? node.left : null
    return factor?.type === "call" && (factor.name === "sin" || factor.name === "cos") ? factor : null
}

// Pair only the exact bounded identity sin(u)^2 + cos(u)^2, including sums
// with unrelated terms. No expansion, algebraic search or symbolic engine.
function simplifyTrigSum(left: FunctionAst, right: FunctionAst): FunctionAst {
    const terms: FunctionAst[] = []
    const flatten = (node: FunctionAst): void => {
        if (node.type === "binary" && node.operator === "+") { flatten(node.left); flatten(node.right) }
        else terms.push(node)
    }
    flatten(left); flatten(right)
    for (let first = 0; first < terms.length; first++) {
        const a = squaredTrig(terms[first])
        if (!a) continue
        for (let second = first + 1; second < terms.length; second++) {
            const b = squaredTrig(terms[second])
            if (b && a.name !== b.name && JSON.stringify(a.argument) === JSON.stringify(b.argument)) {
                terms[first] = { type: "number", value: 1 }
                terms.splice(second, 1)
                break
            }
        }
    }
    return terms.reduce((sum, term): FunctionAst => ({ type: "binary", operator: "+", left: sum, right: term }))
}

// Only bounded, local identities; never expand powers or invoke a symbolic engine.
function simplify(node: FunctionAst): FunctionAst {
    if (node.type === "number" || node.type === "variable") return node
    if (node.type === "unary" || node.type === "call") return { ...node, argument: simplify(node.argument) }
    const left = simplify(node.left), right = simplify(node.right)
    const zero = { type: "number", value: 0 } as const
    if (node.operator === "*" && ((left.type === "number" && left.value === 0) || (right.type === "number" && right.value === 0))) return zero
    if (node.operator === "-" && JSON.stringify(left) === JSON.stringify(right)) return zero
    if ((node.operator === "+" || node.operator === "-") && right.type === "number" && right.value === 0) return left
    if (node.operator === "+" && left.type === "number" && left.value === 0) return right
    return node.operator === "+" ? simplifyTrigSum(left, right) : { ...node, left, right }
}

function argumentVaries(node: FunctionAst, localXs: number[]): boolean {
    if (!dependsOnX(node)) return false
    let min = Infinity, max = -Infinity
    for (const x of localXs) {
        const value = evaluateFunction(node, x)
        if (!value.ok) continue
        min = Math.min(min, value.value)
        max = Math.max(max, value.value)
        if (max - min > 1e-6) return true
    }
    return false
}

function ablate(node: FunctionAst, name: FunctionName | FunctionConstant, replacement: number, localXs: number[]): FunctionAst {
    if (node.type === "number") return node.constant === name ? { type: "number", value: replacement } : node
    if (node.type === "variable") return node
    if (node.type === "unary") return { ...node, argument: ablate(node.argument, name, replacement, localXs) }
    if (node.type === "binary") return { ...node, left: ablate(node.left, name, replacement, localXs), right: ablate(node.right, name, replacement, localXs) }
    return node.name === name && argumentVaries(node.argument, localXs) ? { type: "number", value: replacement } : { ...node, argument: ablate(node.argument, name, replacement, localXs) }
}

/** Numeric ablation measures shape contribution, ignoring constants, cancellation and negligible terms. */
export function getMeaningfulFunctionWarsUsage(parsed: ParsedFunction, localXs = Array.from({ length: 81 }, (_, i) => i * 0.25)) {
    const ast = simplify(parsed.ast)
    let fullMin = Infinity, fullMax = -Infinity
    for (const x of [0, ...localXs]) {
        const value = evaluateFunction(ast, x)
        if (!value.ok) continue
        fullMin = Math.min(fullMin, value.value)
        fullMax = Math.max(fullMax, value.value)
    }
    if (fullMax - fullMin < 0.04) return { functions: [] as FunctionName[], constants: [] as FunctionConstant[] }
    const contributes = (name: FunctionName | FunctionConstant) => {
        // A zero counterfactual can be undefined in denominators; try a nonzero neutral value too.
        return [0, 1].some(replacement => {
            const without = ablate(ast, name, replacement, localXs)
            let min = Infinity, max = -Infinity
            for (const x of [0, ...localXs]) {
                const full = evaluateFunction(ast, x), removed = evaluateFunction(without, x)
                if (!full.ok || !removed.ok) continue
                const delta = full.value - removed.value
                min = Math.min(min, delta); max = Math.max(max, delta)
            }
            return max - min >= 0.04
        })
    }
    return { functions: parsed.functions.filter(contributes), constants: parsed.constants.filter(contributes) }
}
