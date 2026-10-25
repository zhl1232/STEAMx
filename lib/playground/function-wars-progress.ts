import { WEAPON_DEFINITIONS, type WeaponId } from "./function-wars-weapons"

export type FunctionWarsSolutionStep = { expression: string; weaponId: WeaponId }
export type FunctionWarsBestSolution = {
    stars: 1 | 2 | 3
    shots: number
    steps: FunctionWarsSolutionStep[]
}

/** Keep a saved run intact: its score must belong to these exact shots. */
export function readFunctionWarsBestSolution(value: unknown): FunctionWarsBestSolution | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const { stars, shots, steps } = value as Record<string, unknown>
    if (stars !== 1 && stars !== 2 && stars !== 3) return null
    if (typeof shots !== "number" || !Number.isInteger(shots) || shots < 1 || !Array.isArray(steps) || steps.length !== shots || steps.length > 1000) return null
    const clean: FunctionWarsSolutionStep[] = []
    for (const step of steps) {
        if (!step || typeof step !== "object" || typeof step.weaponId !== "string" || !Object.hasOwn(WEAPON_DEFINITIONS, step.weaponId)) return null
        if (typeof step.expression !== "string" || step.expression.length === 0 || step.expression.length > 10000) return null
        clean.push({ expression: step.expression, weaponId: step.weaponId as WeaponId })
    }
    return { stars, shots, steps: clean }
}

export function isBetterFunctionWarsSolution(candidate: FunctionWarsBestSolution, current: FunctionWarsBestSolution | null | undefined): boolean {
    return !current || candidate.stars > current.stars || (candidate.stars === current.stars && candidate.shots < current.shots)
}
