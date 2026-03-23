import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useNQueens } from "./useNQueens"

const { getPlaygroundItemMock, setPlaygroundItemMock } = vi.hoisted(() => ({
    getPlaygroundItemMock: vi.fn(() => null),
    setPlaygroundItemMock: vi.fn(),
}))

vi.mock("@/lib/playground/storage", () => ({
    getPlaygroundItem: getPlaygroundItemMock,
    setPlaygroundItem: setPlaygroundItemMock,
}))

describe("useNQueens", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("allows a paused visualization to resume", async () => {
        const { result } = renderHook(() => useNQueens())

        act(() => {
            result.current.setMode("visualize")
            result.current.startVisualization()
        })

        expect(result.current.status).toBe("visualizing")
        expect(result.current.isVisualizationPaused).toBe(false)

        await act(async () => {
            await vi.advanceTimersByTimeAsync(150)
        })

        const stepsBeforePause = result.current.totalSteps
        expect(stepsBeforePause).toBeGreaterThan(0)

        act(() => {
            result.current.pauseVisualization()
        })

        expect(result.current.isVisualizationPaused).toBe(true)

        await act(async () => {
            await vi.advanceTimersByTimeAsync(600)
        })

        expect(result.current.totalSteps).toBe(stepsBeforePause)

        act(() => {
            result.current.resumeVisualization()
        })

        expect(result.current.isVisualizationPaused).toBe(false)

        await act(async () => {
            await vi.advanceTimersByTimeAsync(150)
        })

        expect(result.current.totalSteps).toBeGreaterThan(stepsBeforePause)
        expect(setPlaygroundItemMock).toHaveBeenCalledWith(
            "nqueens_stats",
            expect.objectContaining({ totalGames: 1 }),
        )
    })
})
