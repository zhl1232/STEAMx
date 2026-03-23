import { fireEvent, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import HanoiPage from "./page"

const { selectPegMock } = vi.hoisted(() => ({
    selectPegMock: vi.fn(),
}))

vi.mock("canvas-confetti", () => ({
    default: vi.fn(),
}))

vi.mock("@/context/gamification-context", () => ({
    useGamification: () => ({
        checkBadges: vi.fn(),
    }),
}))

vi.mock("@/hooks/useHanoi", () => ({
    useHanoi: () => ({
        pegs: { A: [3, 2, 1], B: [], C: [] },
        diskCount: 3,
        status: "idle",
        moves: 0,
        optimalMoves: 7,
        time: 0,
        speed: "normal",
        stats: {
            totalGames: 0,
            wins: 0,
            bestMoves: {},
            bestTimes: {},
        },
        selectedPeg: null,
        selectPeg: selectPegMock,
        setDiskCount: vi.fn(),
        resetGame: vi.fn(),
        autoSolve: vi.fn(),
        pauseAutoSolve: vi.fn(),
        resumeAutoSolve: vi.fn(),
        setSpeed: vi.fn(),
        autoSolvePaused: false,
    }),
}))

describe("HanoiPage", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("responds to advertised peg shortcuts", () => {
        render(<HanoiPage />)

        fireEvent.keyDown(window, { key: "1" })
        fireEvent.keyDown(window, { key: "b" })
        fireEvent.keyDown(window, { key: "C" })

        expect(selectPegMock).toHaveBeenNthCalledWith(1, "A")
        expect(selectPegMock).toHaveBeenNthCalledWith(2, "B")
        expect(selectPegMock).toHaveBeenNthCalledWith(3, "C")
    })

    it("ignores peg shortcuts while typing in an input", () => {
        render(
            <div>
                <input aria-label="name" />
                <HanoiPage />
            </div>,
        )

        const input = document.querySelector("input")
        if (!input) {
            throw new Error("expected input to be rendered")
        }

        fireEvent.keyDown(input, { key: "1" })

        expect(selectPegMock).not.toHaveBeenCalled()
    })
})
