import { describe, expect, it } from "vitest"
import { checkGame24Rule, GAME24_LEVELS, getGame24Level, isGame24LevelUnlocked } from "./game24-levels"
import { solveForLevel, validate24Expression } from "@/hooks/playground/use-24-game"

describe("24 点难度阶梯", () => {
  it("入门关只允许加减，目标可小于 24", () => {
    const lv = getGame24Level("intro-10")
    expect(lv.target).toBe(10)
    expect(validate24Expression("1+2+3+4", [1, 2, 3, 4], lv).valid).toBe(true)
    expect(validate24Expression("(1+2+3)*4", [1, 2, 3, 4], lv).valid).toBe(false)
    expect(solveForLevel([1, 2, 3, 4], lv).every((e) => !/[*/]/.test(e))).toBe(true)
  })
  it("挑战关：必须用 ÷ / 三种不同运算", () => {
    expect(checkGame24Rule("8*3*(2-1)", getGame24Level("must-divide"))).toBeTruthy()
    expect(validate24Expression("8/(3-8/3)", [8, 3, 8, 3], getGame24Level("must-divide")).valid).toBe(true)
    expect(checkGame24Rule("(1+2+3)*4", getGame24Level("three-ops"))).toBeTruthy()
    expect(checkGame24Rule("(5-1)*(2+4)", getGame24Level("three-ops"))).toBeNull()
    solveForLevel([6, 6, 6, 6], getGame24Level("must-divide")).forEach((e) => expect(e).toContain("/"))
  })
  it("逐关解锁，经典和凑 10 始终开放", () => {
    const [l10, l15] = GAME24_LEVELS
    expect(isGame24LevelUnlocked(l10, {})).toBe(true)
    expect(isGame24LevelUnlocked(l15, {})).toBe(false)
    expect(isGame24LevelUnlocked(l15, { "intro-10": 3 })).toBe(true)
    expect(isGame24LevelUnlocked(getGame24Level("classic"), {})).toBe(true)
    expect(isGame24LevelUnlocked(getGame24Level("must-divide"), {})).toBe(false)
  })
})
