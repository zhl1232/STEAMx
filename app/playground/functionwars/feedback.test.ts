import { describe, expect, it } from "vitest"
import { createFunctionWarsState, simulateFunctionWarsShot, type FunctionWarsCoreState } from "@/hooks/playground/use-function-wars"
import { FUNCTION_WARS_LEVELS, type FunctionWarsLevel } from "@/lib/playground/function-wars-levels"
import type { WeaponId } from "@/lib/playground/function-wars-weapons"
import { getFunctionWarsFeedback } from "./feedback"

function shoot(level: FunctionWarsLevel, expression: string, weapon: WeaponId = "standard", state: FunctionWarsCoreState = createFunctionWarsState(level)) {
    const result = simulateFunctionWarsShot(level, state, expression, weapon)
    if (!result.ok) throw new Error(result.error)
    return { ...result, feedback: getFunctionWarsFeedback(level, result.state, result.shot) }
}

describe("function wars actionable shot feedback", () => {
    it("marks the actual endpoint of a wave whose arc length exhausts its range", () => {
        const level = FUNCTION_WARS_LEVELS[14]
        const { feedback, shot } = shoot(level, "2.6*sin(2*x)")
        expect(shot.traces[0].termination).toBe("distance_limit")
        expect(feedback.summary).toContain("射程耗尽")
        expect(feedback.detail).toContain("沿曲线最多飞行 36 格")
        expect(feedback.endpoints[0].x - level.player.x).toBeCloseTo(10.21, 2)
        expect(feedback.endpoints[0].text).toContain("36/36")
        expect(feedback.tone).toBe("warning")
    })

    it("warns about an incomplete function mission even when every target was cleared", () => {
        const level = FUNCTION_WARS_LEVELS[14]
        const first = shoot(level, "0.4abs(x-8)-3.2", "mirror")
        const { state, feedback } = shoot(level, "0.01abs(x)", "drill", first.state)
        expect(state.enemies.every(enemy => enemy.hp === 0)).toBe(true)
        expect(feedback.summary).toContain("sin")
        expect(feedback.summary).toContain("任务失败")
        expect(feedback.tone).toBe("warning")
        expect(feedback.detail).toContain("再清除最后一个目标")
    })

    it.each([
        ["0", "增大斜率"],
        ["0.8*x", "减小斜率"],
    ])("gives a geometrically valid direction for tutorial line %s", (expression, expected) => {
        const { feedback } = shoot(FUNCTION_WARS_LEVELS[1], expression)
        expect(feedback.detail).toContain(expected)
    })

    it("does not guess how a nonlinear expression should be adjusted", () => {
        const { feedback } = shoot(FUNCTION_WARS_LEVELS[1], "0.001*x^2")
        expect(feedback.detail ?? "").not.toMatch(/增大斜率|减小斜率/)
    })

    it("explains an unbreakable material using the actual obstacle hit", () => {
        const level: FunctionWarsLevel = {
            ...FUNCTION_WARS_LEVELS[0], player: { x: -10, y: 0 },
            enemies: [{ id: "target", type: "normal", position: { x: 8, y: 0 } }],
            obstacles: [{ id: "wall", kind: "rect", x: -5, y: 0, width: 1, height: 4, material: "steel", destructible: false }],
        }
        const { feedback } = shoot(level, "0")
        expect(feedback.summary).toBe("击中钢板")
        expect(feedback.detail).toContain("不能打穿")
    })

    it("reports armor destruction from damage events without changing the simulation", () => {
        const level: FunctionWarsLevel = {
            ...FUNCTION_WARS_LEVELS[1], player: { x: -10, y: 0 },
            enemies: [{ id: "armor", type: "armored", position: { x: -2, y: 0 } }],
            obstacles: [], crates: [],
        }
        const result = shoot(level, "0", "heavy")
        const snapshot = JSON.stringify(result.state)
        expect(result.feedback.summary).toContain("装甲击破")
        expect(result.feedback.tone).toBe("success")
        getFunctionWarsFeedback(level, result.state, result.shot)
        expect(JSON.stringify(result.state)).toBe(snapshot)
    })
})
