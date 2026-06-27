import { describe, expect, it } from "vitest"

import {
    analyzeBestMoves,
    checkWinner,
    createBoardFromPoints,
    findWinSpots,
} from "./gomoku-engine"

describe("gomoku-engine", () => {
    it("detects a horizontal five-in-a-row", () => {
        const board = createBoardFromPoints({
            black: [
                { row: 7, col: 5 },
                { row: 7, col: 6 },
                { row: 7, col: 7 },
                { row: 7, col: 8 },
                { row: 7, col: 9 },
            ],
        })

        expect(checkWinner(board)).toMatchObject({
            winner: "black",
            line: [
                { row: 7, col: 5 },
                { row: 7, col: 6 },
                { row: 7, col: 7 },
                { row: 7, col: 8 },
                { row: 7, col: 9 },
            ],
        })
    })

    it("prioritizes an immediate winning move", () => {
        const board = createBoardFromPoints({
            black: [
                { row: 7, col: 5 },
                { row: 7, col: 6 },
                { row: 7, col: 7 },
                { row: 7, col: 8 },
            ],
            white: [{ row: 7, col: 4 }],
        })

        expect(findWinSpots(board, "black")).toEqual([{ row: 7, col: 9 }])
        expect(analyzeBestMoves(board, "black", 3)[0]).toMatchObject({
            row: 7,
            col: 9,
            kind: "win",
        })
    })

    it("prioritizes blocking the opponent's immediate win", () => {
        const board = createBoardFromPoints({
            black: [{ row: 8, col: 6 }],
            white: [
                { row: 7, col: 5 },
                { row: 7, col: 6 },
                { row: 7, col: 7 },
                { row: 7, col: 8 },
            ],
        })

        expect(analyzeBestMoves(board, "black", 3)[0]).toMatchObject({
            row: 7,
            col: 4,
            kind: "block",
        })
    })
})
