import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useSortingRace } from "./use-sorting-race"

const { getPlaygroundItemMock, setPlaygroundItemMock } = vi.hoisted(() => ({
    getPlaygroundItemMock: vi.fn(() => null),
    setPlaygroundItemMock: vi.fn(),
}))

vi.mock("@/lib/playground/storage", () => ({
    getPlaygroundItem: getPlaygroundItemMock,
    setPlaygroundItem: setPlaygroundItemMock,
}))

describe("useSortingRace", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("renders the first sorting frame immediately after starting", async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5)

        try {
            const { result } = renderHook(() => useSortingRace())

            await waitFor(() => expect(result.current.bars).toHaveLength(20))
            vi.useFakeTimers()

            act(() => {
                result.current.start()
            })

            expect(result.current.status).toBe("running")
            expect(result.current.comparisons).toBe(1)
            expect(result.current.bars.some((bar) => bar.state !== "default")).toBe(true)
        } finally {
            randomSpy.mockRestore()
            vi.useRealTimers()
        }
    })

    it("resets back to the original unsorted array while cancelling an active run", async () => {
        const randomValues = [
            0.1, 0.9, 0.3, 0.7, 0.2,
            0.8, 0.4, 0.6, 0.15, 0.85,
            0.25, 0.75, 0.35, 0.65, 0.45,
            0.55, 0.05, 0.95, 0.12, 0.88,
        ]
        const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => randomValues.shift() ?? 0.5)

        try {
            const { result } = renderHook(() => useSortingRace())

            await waitFor(() => expect(result.current.bars).toHaveLength(20))
            vi.useFakeTimers()

            const initialBars = result.current.bars.map((bar) => bar.value)

            act(() => {
                result.current.start()
            })

            act(() => {
                vi.advanceTimersByTime(150)
            })

            act(() => {
                result.current.reset()
            })

            expect(result.current.status).toBe("idle")
            expect(result.current.comparisons).toBe(0)
            expect(result.current.swaps).toBe(0)
            expect(result.current.bars.map((bar) => bar.value)).toEqual(initialBars)
            expect(result.current.bars.every((bar) => bar.state === "default")).toBe(true)
        } finally {
            randomSpy.mockRestore()
            vi.useRealTimers()
        }
    })
})
