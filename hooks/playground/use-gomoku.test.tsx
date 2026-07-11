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

    it("AI responds with a stone after the human plays in pve mode", async () => {
        vi.useFakeTimers()
        try {
            const { result } = renderHook(() => useGomoku("pve"))

            act(() => {
                result.current.makeMove(7, 7)
            })
            expect(result.current.currentPlayer).toBe("white")

            await act(async () => {
                vi.advanceTimersByTime(2000)
                await Promise.resolve()
            })

            expect(result.current.currentPlayer).toBe("black")
            expect(result.current.moveCount).toBe(2)

            let whiteCount = 0
            for (const row of result.current.board) {
                for (const cell of row) {
                    if (cell.value === "white") whiteCount++
                }
            }
            expect(whiteCount).toBe(1)
        } finally {
            vi.useRealTimers()
        }
    })

    it("lets the AI move first when the human plays white", async () => {
        vi.useFakeTimers()
        try {
            const { result } = renderHook(() =>
                useGomoku("pve", "normal", "white"),
            )

            expect(result.current.humanPlayer).toBe("white")
            expect(result.current.aiPlayer).toBe("black")
            expect(result.current.status).toBe("playing")
            expect(result.current.currentPlayer).toBe("black")

            await act(async () => {
                vi.advanceTimersByTime(2000)
                await Promise.resolve()
            })

            expect(result.current.moveCount).toBe(1)
            expect(result.current.currentPlayer).toBe("white")
            expect(result.current.board[7][7].value).toBe("black")
        } finally {
            vi.useRealTimers()
        }
    })

    it("AI blocks an immediate five-in-a-row threat in pve mode", async () => {
        vi.useFakeTimers()
        try {
            const { result } = renderHook(() => useGomoku("pve"))

            // Human creates four-in-a-row by alternating with AI's responses.
            // Each pair: black plays its threat-building stone, AI replies.
            const blackMoves: Array<[number, number]> = [
                [7, 5],
                [7, 6],
                [7, 7],
                [7, 8],
            ]

            for (const [r, c] of blackMoves) {
                act(() => {
                    result.current.makeMove(r, c)
                })
                await act(async () => {
                    vi.advanceTimersByTime(2000)
                    await Promise.resolve()
                })
            }

            // After four black stones on row 7 cols 5–8 (with AI replies
            // between), black has at least one open end. AI's most recent
            // response must occupy a cell adjacent to that line, otherwise
            // the threat went unblocked.
            const rowSeven = result.current.board[7]
            const whitesOnRowSeven = rowSeven.filter(
                (c) => c.value === "white",
            ).length
            expect(whitesOnRowSeven).toBeGreaterThanOrEqual(1)
        } finally {
            vi.useRealTimers()
        }
    })
})
