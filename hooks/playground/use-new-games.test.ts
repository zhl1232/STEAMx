import { describe, expect, it } from "vitest"
import {
    computeLineClues,
    createInitialGrid,
    getNonogramClues,
    getNonogramUnlockedCount,
    isLineSolved,
    isNonogramSolved,
    isZeroClue,
    resolveStrokeValue,
} from "@/hooks/playground/use-nonogram"
import { weighCoins } from "@/hooks/playground/use-balance"

describe("nonogram", () => {
    it("computes row and column clues", () => {
        expect(computeLineClues([1, 1, 0, 1])).toEqual([2, 1])
        const clues = getNonogramClues([
            [1, 0, 1],
            [1, 1, 1],
            [0, 1, 0],
        ])
        expect(clues.rows).toEqual([[1, 1], [3], [1]])
        expect(clues.cols).toEqual([[2], [2], [2]])
    })

    it("ignores mark cells when checking solve", () => {
        const solution = [
            [1, 0],
            [0, 1],
        ]
        expect(
            isNonogramSolved(
                [
                    [1, 2],
                    [2, 1],
                ],
                solution,
            ),
        ).toBe(true)
    })

    it("resolves stroke toggle for fill and mark tools", () => {
        expect(resolveStrokeValue("fill", 0)).toBe(1)
        expect(resolveStrokeValue("fill", 1)).toBe(0)
        expect(resolveStrokeValue("fill", 2)).toBe(1)
        expect(resolveStrokeValue("mark", 0)).toBe(2)
        expect(resolveStrokeValue("mark", 2)).toBe(0)
        expect(resolveStrokeValue("mark", 1)).toBe(2)
    })

    it("detects completed rows ignoring marks", () => {
        expect(isLineSolved([1, 2, 1], [1, 0, 1])).toBe(true)
        expect(isLineSolved([1, 1, 1], [1, 0, 1])).toBe(false)
        expect(isLineSolved([0, 0, 0], [0, 0, 0])).toBe(true)
    })

    it("pre-marks zero-clue rows and columns as locked crosses", () => {
        expect(isZeroClue([0])).toBe(true)
        expect(isZeroClue([1, 1])).toBe(false)
        const grid = createInitialGrid([
            [0, 0, 0],
            [0, 1, 0],
            [0, 0, 0],
        ])
        expect(grid[0]).toEqual([2, 2, 2])
        expect(grid[2]).toEqual([2, 2, 2])
        expect(grid[1][0]).toBe(2)
        expect(grid[1][2]).toBe(2)
        expect(grid[1][1]).toBe(0)
    })

    it("unlocks levels sequentially from the start", () => {
        expect(getNonogramUnlockedCount([])).toBe(1)
        expect(getNonogramUnlockedCount(["plus"])).toBe(2)
        expect(getNonogramUnlockedCount(["plus", "smile"])).toBe(3)
        // 跳关通关不解锁更后面的
        expect(getNonogramUnlockedCount(["smile"])).toBe(1)
    })
})


describe("balance", () => {
    it("weighs lighter and heavier fakes", () => {
        expect(weighCoins([0], [1], 0, true)).toBe("right")
        expect(weighCoins([0], [1], 0, false)).toBe("left")
        expect(weighCoins([0], [1], 2, true)).toBe("equal")
    })
})
