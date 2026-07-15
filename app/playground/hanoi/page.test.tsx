import { act, fireEvent, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import HanoiPage from "./page"

const { selectPegMock } = vi.hoisted(() => ({
    selectPegMock: vi.fn(),
}))

vi.mock("canvas-confetti", () => ({
    default: vi.fn(),
}))

vi.mock("@/lib/context/gamification-context", () => ({
    useGamification: () => ({
        checkBadges: vi.fn(),
    }),
}))

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => ({
        user: null,
        loading: false,
    }),
}))

vi.mock("@/hooks/playground/use-race-online", () => ({
    useRaceOnline: () => ({
        settings: {},
        isWaiting: false,
        isPlaying: false,
        hasSubmitted: false,
        submitResult: vi.fn(),
    }),
}))

vi.mock("@/components/features/playground/race-online-panel", () => ({
    RaceOnlinePanel: () => null,
}))

vi.mock("@/hooks/playground/use-hanoi", () => ({
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

    it("responds to advertised peg shortcuts", async () => {
        render(<HanoiPage />)

        await act(async () => {})

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true, cancelable: true }))
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", bubbles: true, cancelable: true }))
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "C", bubbles: true, cancelable: true }))

        expect(selectPegMock).toHaveBeenNthCalledWith(1, "A")
        expect(selectPegMock).toHaveBeenNthCalledWith(2, "B")
        expect(selectPegMock).toHaveBeenNthCalledWith(3, "C")
    })

    it("ignores peg shortcuts while typing in an input", async () => {
        render(
            <div>
                <input aria-label="name" />
                <HanoiPage />
            </div>,
        )

        await act(async () => {})

        const input = document.querySelector("input")
        if (!input) {
            throw new Error("expected input to be rendered")
        }

        fireEvent.keyDown(input, { key: "1" })

        expect(selectPegMock).not.toHaveBeenCalled()
    })
})
