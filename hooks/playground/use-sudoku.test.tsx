import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSudoku } from "./use-sudoku"

const { getPlaygroundItemMock, setPlaygroundItemMock } = vi.hoisted(() => ({
    getPlaygroundItemMock: vi.fn(() => null),
    setPlaygroundItemMock: vi.fn(),
}))

vi.mock("@/lib/playground/storage", () => ({
    getPlaygroundItem: getPlaygroundItemMock,
    setPlaygroundItem: setPlaygroundItemMock,
}))

function findEditableCell(initial: boolean[][]): [number, number] {
    for (let row = 0; row < initial.length; row++) {
        for (let col = 0; col < initial[row].length; col++) {
            if (!initial[row][col]) {
                return [row, col]
            }
        }
    }

    throw new Error("expected generated puzzle to include at least one editable cell")
}

describe("useSudoku", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("returns to idle after checking errors before the game has started", async () => {
        const { result } = renderHook(() => useSudoku())

        expect(result.current.status).toBe("idle")

        act(() => {
            result.current.checkErrors()
        })

        expect(result.current.status).toBe("checking")

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000)
        })

        expect(result.current.status).toBe("idle")
        expect(setPlaygroundItemMock).not.toHaveBeenCalled()
    })

    it("keeps redo history aligned after clearing a cell", () => {
        const { result } = renderHook(() => useSudoku())
        const [row, col] = findEditableCell(result.current.initial)
        const solvedValue = result.current.solution[row][col]

        act(() => {
            result.current.selectCell(row, col)
        })

        act(() => {
            result.current.setNumber(solvedValue)
        })

        expect(result.current.board[row][col]).toBe(solvedValue)

        act(() => {
            result.current.clearCell()
        })

        expect(result.current.board[row][col]).toBe(0)

        act(() => {
            result.current.undo()
        })

        expect(result.current.board[row][col]).toBe(solvedValue)

        act(() => {
            result.current.redo()
        })

        expect(result.current.board[row][col]).toBe(0)
        expect(setPlaygroundItemMock).not.toHaveBeenCalled()
    })
})
