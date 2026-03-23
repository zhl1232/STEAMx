import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useCircuitPuzzle } from "./useCircuitPuzzle"

const { getPlaygroundItemMock, setPlaygroundItemMock, storageState } = vi.hoisted(() => ({
    getPlaygroundItemMock: vi.fn(),
    setPlaygroundItemMock: vi.fn(),
    storageState: {
        circuitStats: null as Record<string, unknown> | null,
    },
}))

vi.mock("@/lib/playground/storage", () => ({
    getPlaygroundItem: getPlaygroundItemMock,
    setPlaygroundItem: setPlaygroundItemMock,
}))

describe("useCircuitPuzzle", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        storageState.circuitStats = null

        getPlaygroundItemMock.mockImplementation((key: string) => {
            if (key === "circuit_stats") {
                return storageState.circuitStats
            }
            return null
        })

        setPlaygroundItemMock.mockImplementation((key: string, value: Record<string, unknown>) => {
            if (key === "circuit_stats") {
                storageState.circuitStats = value
            }
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it("starts the first level in an unsolved playable state instead of the solved design layout", () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0)

        try {
            const { result } = renderHook(() => useCircuitPuzzle())

            expect(result.current.levelIndex).toBe(0)
            expect(result.current.status).toBe("idle")
            expect(result.current.moves).toBe(0)
            expect(result.current.grid[1][1].rotation).toBe(90)
            expect(result.current.powered[2][1]).toBe(false)
            expect(storageState.circuitStats).toMatchObject({
                totalGames: 0,
                solvedCount: 0,
            })
        } finally {
            randomSpy.mockRestore()
        }
    })

    it("restores persisted in-progress level state on the next mount", async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0)

        try {
            const firstRender = renderHook(() => useCircuitPuzzle())

            act(() => {
                firstRender.result.current.goToLevel(1)
            })

            act(() => {
                firstRender.result.current.rotateCell(0, 1)
            })

            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000)
            })

            expect(firstRender.result.current.status).toBe("playing")
            expect(firstRender.result.current.moves).toBe(1)
            expect(firstRender.result.current.time).toBe(2)
            expect(firstRender.result.current.grid[0][1].rotation).toBe(180)

            firstRender.unmount()

            const secondRender = renderHook(() => useCircuitPuzzle())

            expect(secondRender.result.current.levelIndex).toBe(1)
            expect(secondRender.result.current.status).toBe("playing")
            expect(secondRender.result.current.moves).toBe(1)
            expect(secondRender.result.current.time).toBe(2)
            expect(secondRender.result.current.grid[0][1].rotation).toBe(180)
        } finally {
            randomSpy.mockRestore()
        }
    })
})
