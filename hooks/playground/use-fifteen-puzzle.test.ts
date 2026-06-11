import { describe, expect, it } from "vitest"

import {
    canMoveTile,
    createSolvedBoard,
    isSolvableBoard,
    moveTile,
} from "./use-fifteen-puzzle"

describe("fifteen puzzle rules", () => {
    it("creates a solved board with blank at the end", () => {
        expect(createSolvedBoard(3)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0])
    })

    it("moves only tiles adjacent to the blank", () => {
        const board = createSolvedBoard(3)

        expect(canMoveTile(board, 7, 3)).toBe(true)
        expect(canMoveTile(board, 5, 3)).toBe(true)
        expect(canMoveTile(board, 0, 3)).toBe(false)
        expect(moveTile(board, 7, 3)).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 8])
    })

    it("detects unsolvable parity", () => {
        expect(isSolvableBoard([1, 2, 3, 4, 5, 6, 8, 7, 0], 3)).toBe(false)
        expect(isSolvableBoard(createSolvedBoard(4), 4)).toBe(true)
    })
})
