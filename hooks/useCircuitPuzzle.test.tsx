import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
    buildLevelStartGrid,
    getBulbTargets,
    getSourceControls,
    LEVELS,
    simulateCircuit,
    type CellComponent,
    useCircuitPuzzle,
} from "./useCircuitPuzzle"

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
        const { result } = renderHook(() => useCircuitPuzzle())

        expect(result.current.levelIndex).toBe(0)
        expect(result.current.status).toBe("idle")
        expect(result.current.moves).toBe(0)
        expect(result.current.grid[1][1].rotation).toBe(90)
        expect(result.current.powered[2][1]).toBe(false)
        expect(result.current.unlockedLevelCount).toBe(1)
        expect(storageState.circuitStats).toMatchObject({
            totalGames: 0,
            solvedCount: 0,
        })
    })

    it("locks future levels until the previous level is solved", () => {
        const { result } = renderHook(() => useCircuitPuzzle())

        act(() => {
            result.current.goToLevel(1)
        })

        expect(result.current.levelIndex).toBe(0)

        act(() => {
            result.current.rotateCell(1, 1)
        })

        expect(result.current.status).toBe("solved")
        expect(result.current.unlockedLevelCount).toBe(2)

        act(() => {
            result.current.goToLevel(1)
        })

        expect(result.current.levelIndex).toBe(1)
    })

    it("restores persisted level state on the next mount", async () => {
        const firstRender = renderHook(() => useCircuitPuzzle())

        act(() => {
            firstRender.result.current.rotateCell(1, 1)
        })

        act(() => {
            firstRender.result.current.goToLevel(1)
        })

        act(() => {
            firstRender.result.current.rotateCell(0, 1)
        })

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000)
        })

        const persistedSnapshot = {
            levelIndex: firstRender.result.current.levelIndex,
            unlockedLevelCount: firstRender.result.current.unlockedLevelCount,
            status: firstRender.result.current.status,
            moves: firstRender.result.current.moves,
            time: firstRender.result.current.time,
            rotation: firstRender.result.current.grid[0][1].rotation,
        }

        firstRender.unmount()

        const secondRender = renderHook(() => useCircuitPuzzle())

        expect(secondRender.result.current.levelIndex).toBe(persistedSnapshot.levelIndex)
        expect(secondRender.result.current.unlockedLevelCount).toBe(persistedSnapshot.unlockedLevelCount)
        expect(secondRender.result.current.status).toBe(persistedSnapshot.status)
        expect(secondRender.result.current.moves).toBe(persistedSnapshot.moves)
        expect(secondRender.result.current.time).toBe(persistedSnapshot.time)
        expect(secondRender.result.current.grid[0][1].rotation).toBe(persistedSnapshot.rotation)
    })

    it("ships every level with a valid solved layout", () => {
        for (const level of LEVELS) {
            const powered = simulateCircuit(level.grid, level.rows, level.cols)
            const targetSatisfied = getBulbTargets(level).every((target) =>
                target.required === "lit"
                    ? powered[target.row][target.col]
                    : !powered[target.row][target.col],
            )

            expect(targetSatisfied, level.id).toBe(true)
        }
    })

    it("ships every level with a designed unsolved starting layout and par target", () => {
        for (const level of LEVELS) {
            const startGrid = buildLevelStartGrid(level)
            const powered = simulateCircuit(startGrid, level.rows, level.cols)
            const targetSatisfied = getBulbTargets(level).every((target) =>
                target.required === "lit"
                    ? powered[target.row][target.col]
                    : !powered[target.row][target.col],
            )

            expect(level.objective.length > 0, `${level.id} objective`).toBe(true)
            expect(level.parMoves > 0, `${level.id} parMoves`).toBe(true)
            expect(targetSatisfied, `${level.id} should not start solved`).toBe(false)
        }
    })

    it("supports levels where some bulbs must stay dark", () => {
        const level = LEVELS.find((currentLevel) => currentLevel.id === "selective_branch")
        expect(level).toBeDefined()
        if (!level) return

        const powered = simulateCircuit(level.grid, level.rows, level.cols)
        const targets = getBulbTargets(level)

        expect(targets.some((target) => target.required === "dark")).toBe(true)
        expect(
            targets.every((target) =>
                target.required === "lit"
                    ? powered[target.row][target.col]
                    : !powered[target.row][target.col],
            ),
        ).toBe(true)
    })

    it("allows interactive sources to be toggled and persisted as moves", () => {
        const targetLevelIndex = LEVELS.findIndex((level) => level.id === "input_toggle_and")
        expect(targetLevelIndex).toBeGreaterThan(0)
        const targetLevel = LEVELS[targetLevelIndex]
        const source = getSourceControls(targetLevel)[0]
        expect(source).toBeDefined()
        if (!source) return

        storageState.circuitStats = {
            totalGames: 0,
            solvedCount: targetLevelIndex,
            solvedLevels: LEVELS.slice(0, targetLevelIndex).map((level) => level.id),
            bestTimes: {},
            bestMoves: {},
            progress: JSON.stringify({
                levelIndex: targetLevelIndex,
                grid: buildLevelStartGrid(targetLevel),
                status: "idle",
                moves: 0,
                time: 0,
            }),
        }

        const { result } = renderHook(() => useCircuitPuzzle())

        expect(result.current.levelIndex).toBe(targetLevelIndex)
        expect(result.current.grid[source.row][source.col].active).toBe(false)

        act(() => {
            result.current.toggleSource(source.row, source.col)
        })

        expect(result.current.status).toBe("playing")
        expect(result.current.moves).toBe(1)
        expect(result.current.grid[source.row][source.col].active).toBe(true)
    })

    it("evaluates logic gates using their documented rules", () => {
        const empty = (): CellComponent => ({ type: "empty", rotation: 0, fixed: false })
        const battery = (rotation = 0): CellComponent => ({ type: "battery", rotation, fixed: true })
        const straight = (rotation = 0): CellComponent => ({ type: "wire_straight", rotation, fixed: false })
        const corner = (rotation = 0): CellComponent => ({ type: "wire_corner", rotation, fixed: false })
        const bulb = (rotation = 0): CellComponent => ({ type: "bulb", rotation, fixed: true })
        const andGate = (rotation = 0): CellComponent => ({ type: "and_gate", rotation, fixed: false })
        const orGate = (rotation = 0): CellComponent => ({ type: "or_gate", rotation, fixed: false })
        const notGate = (rotation = 0): CellComponent => ({ type: "not_gate", rotation, fixed: false })

        const andPowered = simulateCircuit(
            [
                [battery(), empty(), battery()],
                [straight(), empty(), straight()],
                [corner(0), andGate(90), corner(270)],
                [empty(), bulb(), empty()],
            ],
            4,
            3,
        )
        expect(andPowered[3][1]).toBe(true)

        const andMissingInputPowered = simulateCircuit(
            [
                [battery(), empty(), empty()],
                [straight(), empty(), empty()],
                [corner(0), andGate(90), corner(270)],
                [empty(), bulb(), empty()],
            ],
            4,
            3,
        )
        expect(andMissingInputPowered[3][1]).toBe(false)

        const orPowered = simulateCircuit(
            [
                [battery(), empty(), empty()],
                [straight(), empty(), empty()],
                [corner(0), orGate(90), corner(270)],
                [empty(), bulb(), empty()],
            ],
            4,
            3,
        )
        expect(orPowered[3][1]).toBe(true)

        const notPowered = simulateCircuit(
            [
                [empty(), notGate(), empty()],
                [empty(), straight(), empty()],
                [empty(), bulb(), empty()],
            ],
            3,
            3,
        )
        expect(notPowered[2][1]).toBe(true)

        const notBlockedPowered = simulateCircuit(
            [
                [empty(), battery(), empty()],
                [empty(), notGate(), empty()],
                [empty(), straight(), empty()],
                [empty(), bulb(), empty()],
            ],
            4,
            3,
        )
        expect(notBlockedPowered[3][1]).toBe(false)
    })
})
