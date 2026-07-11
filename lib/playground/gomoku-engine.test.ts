import { describe, expect, it } from "vitest"

import {
    analyzeBestMoves,
    boardToValues,
    checkWinner,
    chooseAiMove,
    createBoardFromPoints,
    findWinSpots,
    valuesToBoard,
    vcfSearch,
    vctSearch,
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

    it("round-trips board values for worker transfer", () => {
        const board = createBoardFromPoints({
            black: [{ row: 7, col: 7 }],
            white: [{ row: 7, col: 8 }],
        })
        const restored = valuesToBoard(boardToValues(board))
        expect(restored[7][7].value).toBe("black")
        expect(restored[7][8].value).toBe("white")
        expect(restored[0][0].value).toBeNull()
    })

    it("finds a VCF starting move that forces continuous fours", () => {
        // 黑三子活线，补第四子后两端都能成五 → 双冲四/活四，VCF 起手。
        const board = createBoardFromPoints({
            black: [
                { row: 7, col: 5 },
                { row: 7, col: 6 },
                { row: 7, col: 7 },
            ],
            white: [
                { row: 5, col: 5 },
                { row: 9, col: 9 },
            ],
        })

        const vcf = vcfSearch(board, "black", 10)
        expect(vcf?.row).toBe(7)
        expect([4, 8]).toContain(vcf?.col)
        expect(analyzeBestMoves(board, "black", 3)[0]).toMatchObject({
            row: 7,
            kind: "vcf",
        })
        expect([4, 8]).toContain(analyzeBestMoves(board, "black", 3)[0]?.col)
    })

    it("finds a VCT move that creates a forcing open-three threat", () => {
        // 黑活二，VCT 应能找到补活三的强制点（两端之一）。
        const board = createBoardFromPoints({
            black: [
                { row: 7, col: 6 },
                { row: 7, col: 7 },
            ],
            white: [
                { row: 5, col: 5 },
                { row: 5, col: 9 },
            ],
        })

        const vct = vctSearch(board, "black", 8)
        expect(vct).not.toBeNull()
        expect(vct?.row).toBe(7)
        expect([5, 8]).toContain(vct?.col)
    })

    it("hard AI blocks an immediate four while easy still respects forced wins/blocks", () => {
        const board = createBoardFromPoints({
            black: [
                { row: 7, col: 5 },
                { row: 7, col: 6 },
                { row: 7, col: 7 },
                { row: 7, col: 8 },
            ],
            white: [{ row: 9, col: 9 }],
        })

        // 黑四连时两端都能成五；任一端阻挡都算正确防守。
        for (const level of ["easy", "normal", "hard"] as const) {
            const move = chooseAiMove(board, "white", "black", level)
            expect(move?.row).toBe(7)
            expect([4, 9]).toContain(move?.col)
        }
    })

    it("hard AI prefers a VCF win over plain minimax wandering", () => {
        const board = createBoardFromPoints({
            black: [{ row: 10, col: 10 }],
            white: [
                { row: 7, col: 5 },
                { row: 7, col: 6 },
                { row: 7, col: 7 },
            ],
        })

        const move = chooseAiMove(board, "white", "black", "hard")
        expect(move?.row).toBe(7)
        expect([4, 8]).toContain(move?.col)
    })
})
