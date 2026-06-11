import { describe, expect, it } from "vitest"

import {
    createEmptyGrid,
    evaluateLifeChallenge,
    LIFE_CHALLENGES,
    nextGeneration,
} from "./use-game-of-life"

describe("Game of Life challenge logic", () => {
    it("evolves the classic blinker with a period of two", () => {
        const grid = createEmptyGrid(5, 5)
        grid[2][1] = true
        grid[2][2] = true
        grid[2][3] = true

        const first = nextGeneration(grid)
        const second = nextGeneration(first)

        expect(first[1][2]).toBe(true)
        expect(first[2][2]).toBe(true)
        expect(first[3][2]).toBe(true)
        expect(second).toEqual(grid)
    })

    it("passes the still-life challenge with a compact block", () => {
        const challenge = LIFE_CHALLENGES.find((item) => item.id === "block-still-life")
        expect(challenge).toBeDefined()
        if (!challenge) return

        const grid = createEmptyGrid(40, 60)
        grid[10][10] = true
        grid[10][11] = true
        grid[11][10] = true
        grid[11][11] = true

        const result = evaluateLifeChallenge(grid, challenge)

        expect(result.solved).toBe(true)
        expect(result.stars).toBe(3)
    })

    it("rejects challenge attempts that exceed the cell budget", () => {
        const challenge = LIFE_CHALLENGES.find((item) => item.id === "tiny-colony")
        expect(challenge).toBeDefined()
        if (!challenge) return

        const grid = createEmptyGrid(40, 60)
        for (let index = 0; index < challenge.maxCells + 1; index++) {
            grid[0][index] = true
        }

        const result = evaluateLifeChallenge(grid, challenge)

        expect(result.solved).toBe(false)
        expect(result.message).toContain("细胞预算超出")
    })

    it("ships solvable starter seeds for every challenge that provides one", () => {
        const seeded = LIFE_CHALLENGES.filter((challenge) => challenge.starterCells)
        expect(seeded.length).toBeGreaterThanOrEqual(3)

        for (const challenge of seeded) {
            const grid = createEmptyGrid(40, 60)
            for (const [row, col] of challenge.starterCells!) {
                expect(row >= 0 && row < 40 && col >= 0 && col < 60, `${challenge.id} cell in bounds`).toBe(true)
                grid[row][col] = true
            }

            const result = evaluateLifeChallenge(grid, challenge)
            expect(result.solved, `${challenge.id} starter should solve the challenge`).toBe(true)
        }
    })
})
