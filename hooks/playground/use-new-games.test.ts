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
import { BALL_SORT_LEVELS, canPour, getTopRun, isBallSortSolved, pourBalls } from "@/hooks/playground/use-ball-sort"
import { weighCoins } from "@/hooks/playground/use-balance"
import {
    applySymmetryGuess,
    applySymmetryPaint,
    createSymmetryChallengeGrid,
    getSymmetryRequiredCount,
    getSymmetryStars,
    isSymmetryPlayableCell,
    isSymmetrySolved,
    isSymmetrySourceCell,
    SYMMETRY_LEVELS,
} from "@/hooks/playground/use-symmetry"

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

describe("ball sort", () => {
    it("pours consecutive same-color balls", () => {
        const result = pourBalls([1, 2, 2], [2], 4)
        expect(result).toEqual({ from: [1], to: [2, 2, 2] })
        expect(canPour([1], [2], 4)).toBe(false)
    })

    it("reads the movable top run for a tube", () => {
        expect(getTopRun([1, 2, 2, 2])).toEqual({ color: 2, count: 3 })
        expect(getTopRun([])).toBeNull()
    })

    it("detects solved tubes", () => {
        expect(isBallSortSolved([[1, 1, 1, 1], [2, 2, 2, 2], []], 4)).toBe(true)
        expect(isBallSortSolved([[1, 1, 1], [2, 2, 2, 2], []], 4)).toBe(false)
    })

    it("includes advanced levels with more colors and tubes", () => {
        expect(BALL_SORT_LEVELS).toHaveLength(10)
        expect(new Set(BALL_SORT_LEVELS[5].tubes.flat()).size).toBe(6)
        expect(new Set(BALL_SORT_LEVELS[7].tubes.flat()).size).toBe(8)
        expect(BALL_SORT_LEVELS[7].tubes).toHaveLength(10)
    })
})

describe("balance", () => {
    it("weighs lighter and heavier fakes", () => {
        expect(weighCoins([0], [1], 0, true)).toBe("right")
        expect(weighCoins([0], [1], 0, false)).toBe("left")
        expect(weighCoins([0], [1], 2, true)).toBe("equal")
    })
})

describe("symmetry", () => {
    it("paints mirrored cells on vertical axis", () => {
        const grid = [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
        ]
        const next = applySymmetryPaint(grid, 1, 0, "vertical")
        expect(next[1][0]).toBe(1)
        expect(next[1][3]).toBe(1)
        expect(isSymmetrySolved(next, next)).toBe(true)
    })

    it("starts with only the locked sample half revealed", () => {
        const level = SYMMETRY_LEVELS[0]
        const grid = createSymmetryChallengeGrid(level)

        for (let r = 0; r < level.size; r += 1) {
            for (let c = 0; c < level.size; c += 1) {
                if (isSymmetrySourceCell(level, r, c)) {
                    expect(grid[r][c]).toBe(level.target[r][c])
                } else {
                    expect(grid[r][c]).toBe(0)
                }
            }
        }
    })

    it("lets players edit only the challenge half", () => {
        const level = SYMMETRY_LEVELS[0]
        const grid = createSymmetryChallengeGrid(level)
        const blocked = applySymmetryGuess(grid, 1, 1, level)
        const played = applySymmetryGuess(grid, 1, 4, level)

        expect(blocked).toBe(grid)
        expect(played[1][4]).toBe(1)
        expect(played[1][1]).toBe(1)
    })

    it("keeps all shipped levels truly symmetrical", () => {
        for (const level of SYMMETRY_LEVELS) {
            expect(level.size % 2).toBe(0)
            expect(level.target).toHaveLength(level.size)
            expect(getSymmetryRequiredCount(level)).toBeGreaterThan(0)

            for (let r = 0; r < level.size; r += 1) {
                expect(level.target[r]).toHaveLength(level.size)
                for (let c = 0; c < level.size; c += 1) {
                    const mirror =
                        level.axis === "vertical"
                            ? { r, c: level.size - 1 - c }
                            : { r: level.size - 1 - r, c }
                    expect(level.target[r][c]).toBe(level.target[mirror.r][mirror.c])
                    expect(isSymmetryPlayableCell(level, r, c)).toBe(!isSymmetrySourceCell(level, r, c))
                }
            }
        }
    })

    it("scores perfect mirror solves above corrected solves", () => {
        const level = SYMMETRY_LEVELS[0]
        const par = getSymmetryRequiredCount(level)

        expect(getSymmetryStars(level, par, 0)).toBe(3)
        expect(getSymmetryStars(level, par + 1, 0)).toBe(2)
        expect(getSymmetryStars(level, par + 4, 2)).toBe(1)
    })
})
