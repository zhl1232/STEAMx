import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useGomoku } from "./use-gomoku"

const { getPlaygroundItemMock, setPlaygroundItemMock } = vi.hoisted(() => ({
    getPlaygroundItemMock: vi.fn(() => null),
    setPlaygroundItemMock: vi.fn(),
}))

vi.mock("@/lib/playground/storage", () => ({
    getPlaygroundItem: getPlaygroundItemMock,
    setPlaygroundItem: setPlaygroundItemMock,
}))

function buildDrawMoves() {
    const blackMoves: Array<{ row: number; col: number }> = []
    const whiteMoves: Array<{ row: number; col: number }> = []

    for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
            const target = (col + Math.floor(row / 2)) % 2 === 0 ? blackMoves : whiteMoves
            target.push({ row, col })
        }
    }

    return blackMoves.flatMap((move, index) => {
        const sequence = [move]
        if (whiteMoves[index]) {
            sequence.push(whiteMoves[index])
        }
        return sequence
    })
}

describe("useGomoku", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("tracks the final move count when a pvp game ends in a draw", () => {
        const { result } = renderHook(() => useGomoku("pvp"))

        for (const move of buildDrawMoves()) {
            act(() => {
                result.current.makeMove(move.row, move.col)
            })
        }

        expect(result.current.status).toBe("draw")
        expect(result.current.moveCount).toBe(225)
        expect(result.current.stats).toEqual({
            totalGames: 1,
            wins: 0,
            losses: 0,
            draws: 1,
            bestMoves: null,
            gomokuPvEWins: 0,
        })
        expect(setPlaygroundItemMock).toHaveBeenCalledWith("gomoku_records", {
            totalGames: 1,
            wins: 0,
            losses: 0,
            draws: 1,
            bestMoves: null,
            gomokuPvEWins: 0,
        })
    })
})
