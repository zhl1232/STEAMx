import { act, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import HanoiPage from "./hanoi/page"
import NQueensPage from "./nqueens/page"
import NonogramPage from "./nonogram/page"
import BalancePage from "./balance/page"
import Game24Page from "./24game/page"
import type { useHanoi } from "@/hooks/playground/use-hanoi"
import type { useNQueens } from "@/hooks/playground/use-nqueens"
import type { useNonogram } from "@/hooks/playground/use-nonogram"
import type { useBalance } from "@/hooks/playground/use-balance"
import type { use24Game } from "@/hooks/playground/use-24-game"
import { useRaceRound } from "@/hooks/playground/use-race-round"
import type { RaceSettings } from "@/lib/playground/race-online"

const online = vi.hoisted(() => ({
    matchId: null as string | null,
    match: null as { id: string; status: string } | null,
    isWaiting: false,
    isPlaying: false,
    hasSubmitted: false,
    settings: {} as RaceSettings,
    submitResult: vi.fn(),
}))
const context = vi.hoisted(() => ({ checkBadges: vi.fn(), setOverride: vi.fn(), clearOverride: vi.fn() }))
vi.mock("canvas-confetti", () => ({ default: vi.fn() }))
vi.mock("@/hooks/playground/use-race-online", () => ({ useRaceOnline: () => online }))
vi.mock("@/lib/context/gamification-context", () => ({ useGamification: () => context }))
vi.mock("@/components/features/tutor/tutor-context", () => ({ useTutorContext: () => context }))
vi.mock("@/components/features/playground/race-online-panel", () => ({ RaceOnlinePanel: () => null, RaceOnlineDisclosure: ({ children }: { children: React.ReactNode }) => children }))

let hanoi: ReturnType<typeof useHanoi>
let queens: ReturnType<typeof useNQueens>
let nonogram: ReturnType<typeof useNonogram>
let balance: ReturnType<typeof useBalance>
let game24: ReturnType<typeof use24Game>
vi.mock("@/hooks/playground/use-hanoi", async (original) => {
    const actual = await original<typeof import("@/hooks/playground/use-hanoi")>()
    return { ...actual, useHanoi: () => (hanoi = actual.useHanoi()) }
})
vi.mock("@/hooks/playground/use-nqueens", async (original) => {
    const actual = await original<typeof import("@/hooks/playground/use-nqueens")>()
    return { ...actual, useNQueens: () => (queens = actual.useNQueens()) }
})
vi.mock("@/hooks/playground/use-nonogram", async (original) => {
    const actual = await original<typeof import("@/hooks/playground/use-nonogram")>()
    return { ...actual, useNonogram: () => (nonogram = actual.useNonogram()) }
})
vi.mock("@/hooks/playground/use-balance", async (original) => {
    const actual = await original<typeof import("@/hooks/playground/use-balance")>()
    return { ...actual, useBalance: () => (balance = actual.useBalance()) }
})
vi.mock("@/hooks/playground/use-24-game", async (original) => {
    const actual = await original<typeof import("@/hooks/playground/use-24-game")>()
    return { ...actual, use24Game: () => (game24 = actual.use24Game()) }
})

beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    Object.assign(online, { matchId: null, match: null, isWaiting: false, isPlaying: false, hasSubmitted: false, settings: {} })
})

afterEach(() => vi.useRealTimers())

function startRace(settings: RaceSettings) {
    Object.assign(online, { matchId: "match-1", match: { id: "match-1", status: "playing" }, isWaiting: false, isPlaying: true, settings })
}

describe("race round fairness", () => {
    it("waits for the authoritative room before starting and starts only once per match", () => {
        online.matchId = "joining"
        online.isPlaying = true
        const start = vi.fn()
        const { result, rerender } = renderHook(() => useRaceRound(online, start))
        expect(start).not.toHaveBeenCalled()
        expect(result.current.canPlay).toBe(false)
        online.match = { id: "stale-room", status: "playing" }
        rerender()
        expect(start).not.toHaveBeenCalled()
        online.match = { id: "joining", status: "playing" }
        rerender()
        expect(start).toHaveBeenCalledTimes(1)
        expect(result.current.canPlay).toBe(true)
        rerender()
        expect(start).toHaveBeenCalledTimes(1)
        online.matchId = "next-match"
        online.match = { id: "next-match", status: "playing" }
        rerender()
        expect(start).toHaveBeenCalledTimes(2)
    })

    it("Hanoi resets same-size solo progress on start and locks waiting, restart and submitted controls", () => {
        const view = render(<HanoiPage />)
        fireEvent.keyDown(window, { key: "a" })
        fireEvent.keyDown(window, { key: "c" })
        expect(hanoi.moves).toBe(1)
        Object.assign(online, { matchId: "match-1", match: { id: "match-1", status: "waiting" }, isWaiting: true, settings: { diskCount: 3 } })
        view.rerender(<HanoiPage />)
        fireEvent.keyDown(window, { key: "a" })
        expect(hanoi.selectedPeg).toBeNull()
        expect(screen.getByRole("button", { name: /A \(起点\)/ })).toBeDisabled()
        startRace({ diskCount: 3 })
        view.rerender(<HanoiPage />)
        expect(hanoi.moves).toBe(0)
        expect(hanoi.pegs).toEqual({ A: [3, 2, 1], B: [], C: [] })
        expect(online.submitResult).not.toHaveBeenCalled()
        for (const button of screen.getAllByRole("button", { name: "重置游戏" })) expect(button).toBeDisabled()
        fireEvent.keyDown(window, { key: "a" })
        fireEvent.keyDown(window, { key: "c" })
        expect(hanoi.moves).toBe(1)
        view.rerender(<HanoiPage />)
        expect(hanoi.moves).toBe(1)
        online.hasSubmitted = true
        view.rerender(<HanoiPage />)
        fireEvent.keyDown(window, { key: "a" })
        expect(hanoi.selectedPeg).toBeNull()
    })

    it("N Queens clears a completed solo board and starts each match in manual mode", () => {
        const view = render(<NQueensPage />)
        act(() => queens.setN(4))
        for (const [row, col] of [[0, 1], [1, 3], [2, 0], [3, 2]]) act(() => queens.toggleCell(row, col))
        expect(queens.status).toBe("solved")
        startRace({ n: 4 })
        view.rerender(<NQueensPage />)
        expect(queens.status).toBe("idle")
        expect(queens.mode).toBe("manual")
        expect(online.submitResult).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole("button", { name: /第 1 行第 1 列/ }))
        expect(queens.status).toBe("playing")
        // A fresh same-setting match clears in-progress play too.
        online.matchId = "match-2"
        online.match = { id: "match-2", status: "playing" }
        view.rerender(<NQueensPage />)
        expect(queens.status).toBe("idle")
        for (const [row, col] of [[0, 1], [1, 3], [2, 0], [3, 2]]) act(() => queens.toggleCell(row, col))
        expect(online.submitResult).toHaveBeenCalledWith({ n: 4, timeSeconds: 0 })
        online.hasSubmitted = true
        view.rerender(<NQueensPage />)
        expect(screen.getByRole("button", { name: /第 1 行第 2 列/ })).toBeDisabled()
    })

    it("Nonogram loads the room level despite local locks without unlocking solo progress", () => {
        const view = render(<NonogramPage />)
        expect(nonogram.unlockedCount).toBe(1)
        startRace({ levelIndex: 2, levelId: "room-level" })
        view.rerender(<NonogramPage />)
        expect(nonogram.levelIndex).toBe(2)
        expect(nonogram.unlockedCount).toBe(1)
        expect(screen.getByRole("button", { name: "重开本关" })).toBeDisabled()
        online.hasSubmitted = true
        view.rerender(<NonogramPage />)
        expect(screen.getByTestId("nonogram-tool-toggle")).toBeDisabled()
        expect(online.submitResult).not.toHaveBeenCalled()
    })

    it("Balance clears same-level pans and locks mode switching while a room is active", () => {
        const view = render(<BalancePage />)
        act(() => balance.toggleCoin(0, "left"))
        expect(balance.left).toEqual([0])
        startRace({ levelIndex: 0, levelId: balance.level.id })
        view.rerender(<BalancePage />)
        expect(balance.left).toEqual([])
        expect(balance.weighings).toBe(0)
        expect(screen.getByRole("tab", { name: "杠杆平衡" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "重开" })).toBeDisabled()
        online.hasSubmitted = true
        view.rerender(<BalancePage />)
        expect(screen.getByRole("button", { name: "称量" })).toBeDisabled()
    })

    it("24 Game pauses the solo timer while waiting and clears old input when the race starts", () => {
        vi.useFakeTimers()
        const view = render(<Game24Page />)
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "invalid solo expression" } })
        fireEvent.click(screen.getByRole("button", { name: /提交/ }))
        Object.assign(online, { matchId: "match-1", match: { id: "match-1", status: "waiting" }, isWaiting: true, settings: { cardValues: [1, 2, 3, 4], durationSeconds: 60 } })
        view.rerender(<Game24Page />)
        act(() => vi.advanceTimersByTime(65000))
        expect(game24.status).toBe("idle")
        expect(game24.solutions).toEqual([])
        expect(screen.queryByText("可行解法")).not.toBeInTheDocument()
        startRace({ cardValues: [1, 2, 3, 4], durationSeconds: 60 })
        view.rerender(<Game24Page />)
        expect(screen.getByRole("textbox")).toHaveValue("")
        expect(game24.timeLeft).toBe(60)
        expect(online.submitResult).not.toHaveBeenCalled()
    })

    it("24 Game locks deal, restart and hints and refuses results from a different deck", () => {
        startRace({ cardValues: [1, 2, 3, 4], durationSeconds: 60 })
        const view = render(<Game24Page />)
        expect(game24.cards.map((card) => card.value).sort()).toEqual([1, 2, 3, 4])
        expect(screen.getByRole("button", { name: /新游戏/ })).toBeDisabled()
        expect(screen.getByRole("button", { name: /提示/ })).toBeDisabled()
        // Simulate an unexpected local deck change; it must never be submitted as the room deck.
        act(() => game24.loadRoundFromValues([2, 2, 2, 3]))
        act(() => { game24.submitExpression("2*2*2*3") })
        expect(game24.status).toBe("solved")
        expect(online.submitResult).not.toHaveBeenCalled()
        expect(screen.getByRole("button", { name: /下一轮/ })).toBeDisabled()
        online.hasSubmitted = true
        view.rerender(<Game24Page />)
        expect(screen.getByRole("button", { name: /新游戏/ })).toBeDisabled()
    })
})
