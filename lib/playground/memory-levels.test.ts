import { describe, expect, it } from "vitest"
import { isMemoryLevelUnlocked, MEMORY_LEVEL_THEMES, memoryLevelPairs } from "./memory-levels"

describe("memory levels", () => {
    it("has 5 themes with growing pair counts and unique pairs", () => {
        expect(MEMORY_LEVEL_THEMES.map((t) => t.label)).toEqual(["光学", "力学", "声学", "电学", "数学基础"])
        for (const t of MEMORY_LEVEL_THEMES) {
            const counts = t.levels.map((l) => l.pairCount)
            expect(counts).toEqual([...counts].sort((a, b) => a - b))
            expect(new Set(counts).size).toBe(counts.length)
            const last = t.levels[t.levels.length - 1]
            expect(memoryLevelPairs(last)).toHaveLength(last.pairCount)
            expect(new Set(t.pairs.map((p) => p.key)).size).toBe(t.pairs.length)
            for (const l of t.levels) expect(l.takeaway.length).toBeGreaterThan(8)
        }
    })
    it("unlocks progressively", () => {
        const [a, b, c] = MEMORY_LEVEL_THEMES[0].levels
        expect(isMemoryLevelUnlocked(a, [])).toBe(true)
        expect(isMemoryLevelUnlocked(b, [])).toBe(false)
        expect(isMemoryLevelUnlocked(b, [a.id])).toBe(true)
        expect(isMemoryLevelUnlocked(c, [a.id])).toBe(false)
    })
})
