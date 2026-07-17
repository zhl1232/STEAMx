import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FUNCTION_WARS_LEVELS } from "@/lib/playground/function-wars-levels"
import { createWeaponInventory } from "@/lib/playground/function-wars-weapons"
import FunctionWarsPage, { getFunctionWarsMaxUnlockedIndex } from "./page"

const {
    checkBadgesMock,
    clearTutorOverrideMock,
    fireMock,
    gameState,
    searchParamsState,
    setTutorOverrideMock,
} = vi.hoisted(() => ({
    checkBadgesMock: vi.fn(),
    clearTutorOverrideMock: vi.fn(),
    fireMock: vi.fn(),
    gameState: { current: null as Record<string, unknown> | null },
    searchParamsState: { room: null as string | null },
    setTutorOverrideMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
    useSearchParams: () => ({
        get: (key: string) => key === "room" ? searchParamsState.room : null,
    }),
}))

vi.mock("@/lib/context/gamification-context", () => ({
    useGamification: () => ({ checkBadges: checkBadgesMock }),
}))

vi.mock("@/components/features/tutor/tutor-context", () => ({
    useTutorContext: () => ({
        setOverride: setTutorOverrideMock,
        clearOverride: clearTutorOverrideMock,
    }),
}))

vi.mock("@/hooks/playground/use-function-wars", () => ({
    useFunctionWars: () => gameState.current,
}))

vi.mock("@/components/features/playground/function-wars-online-view", () => ({
    FunctionWarsOnlineView: ({
        initialRoomCode,
        onActiveMatchChange,
    }: {
        initialRoomCode: string | null
        onActiveMatchChange?: (active: boolean) => void
    }) => (
        <div>
            在线房间 {initialRoomCode ?? "未指定"}
            <input aria-label="在线本地状态" defaultValue="初始" />
            <button type="button" onClick={() => onActiveMatchChange?.(true)}>模拟进行中对局</button>
        </div>
    ),
}))

vi.mock("./renderer", () => ({
    FunctionWarsRenderer: class {
        setScene() {}
        start() {}
        resize() {}
        destroy() {}
    },
}))

function createGame(overrides: Record<string, unknown> = {}) {
    const level = FUNCTION_WARS_LEVELS[0]
    return {
        level,
        levelIndex: 0,
        levelCount: FUNCTION_WARS_LEVELS.length,
        status: "playing",
        lossReason: null,
        playerAlive: true,
        expression: "0",
        setExpression: vi.fn(),
        selectedWeapon: "standard",
        selectWeapon: vi.fn(),
        inventory: createWeaponInventory(),
        buffs: { blastBoost: false, penetration: false, shield: false, repairCharges: 0 },
        enemies: level.enemies.map((enemy) => ({
            id: enemy.id,
            type: enemy.type,
            position: enemy.position,
            radius: enemy.radius ?? 0.42,
            hp: 50,
            maxHp: 50,
        })),
        craters: [],
        crates: [],
        relays: [],
        shots: 0,
        effectiveFunctions: [],
        effectiveWeapons: [],
        bonusComplete: true,
        time: 0,
        stars: 0,
        stats: {
            totalGames: 0,
            solvedLevels: [],
            bestShots: {},
            bestTimes: {},
            onlineGames: 0,
            onlineWins: 0,
        },
        lastShot: null,
        error: null,
        fire: fireMock,
        startLevel: vi.fn(),
        retryLevel: vi.fn(),
        ...overrides,
    }
}

describe("FunctionWarsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        searchParamsState.room = null
        gameState.current = createGame()
        vi.stubGlobal("ResizeObserver", class {
            observe() {}
            disconnect() {}
        })
    })

    it("renders the single-player battlefield and fires the current function", () => {
        render(<FunctionWarsPage />)

        expect(screen.getByRole("heading", { name: "函数战争" })).toBeInTheDocument()
        const battlefield = screen.getByRole("img", { name: "函数战争单人战场" })
        expect(battlefield).toBeInTheDocument()
        expect(battlefield).toHaveAccessibleDescription(/我方炮台位于/)
        expect(screen.getByRole("region", { name: "单人炮术控制台" })).toBeInTheDocument()
        expect(setTutorOverrideMock).toHaveBeenCalledWith(expect.objectContaining({ hideFabOnMobile: true }))

        fireEvent.click(screen.getByRole("button", { name: "发射" }))
        expect(fireMock).toHaveBeenCalledTimes(1)
    })

    it("opens the online view directly when an invitation room is present", () => {
        searchParamsState.room = "AB12CD"

        render(<FunctionWarsPage />)

        expect(screen.getByText("在线房间 AB12CD")).toBeInTheDocument()
        expect(screen.queryByRole("img", { name: "函数战争单人战场" })).not.toBeInTheDocument()
    })

    it("keeps a visited online match mounted while switching modes", () => {
        render(<FunctionWarsPage />)

        fireEvent.click(screen.getByRole("button", { name: "真人对战" }))
        const onlineState = screen.getByRole("textbox", { name: "在线本地状态" })
        fireEvent.change(onlineState, { target: { value: "进行中的房间" } })

        fireEvent.click(screen.getByRole("button", { name: "单人战役" }))
        expect(screen.getByRole("img", { name: "函数战争单人战场" })).toBeInTheDocument()

        fireEvent.click(screen.getByRole("button", { name: "真人对战" }))
        expect(screen.getByRole("textbox", { name: "在线本地状态" })).toHaveValue("进行中的房间")
    })

    it("keeps an active-match indicator visible after returning to the campaign", () => {
        render(<FunctionWarsPage />)

        fireEvent.click(screen.getByRole("button", { name: "真人对战" }))
        fireEvent.click(screen.getByRole("button", { name: "模拟进行中对局" }))
        fireEvent.click(screen.getByRole("button", { name: "单人战役" }))

        expect(screen.getByRole("button", { name: /真人对战.*有进行中的对局/ })).toBeInTheDocument()
    })

    it("shows completion and expression errors in the control surface", () => {
        gameState.current = createGame({
            status: "won",
            shots: 1,
            stars: 3,
            error: "函数表达式不合法",
            stats: {
                totalGames: 1,
                solvedLevels: [FUNCTION_WARS_LEVELS[0].id],
                bestShots: { [FUNCTION_WARS_LEVELS[0].id]: 1 },
                bestTimes: { [FUNCTION_WARS_LEVELS[0].id]: 1 },
                onlineGames: 0,
                onlineWins: 0,
            },
        })

        render(<FunctionWarsPage />)

        expect(screen.getByText("目标清除")).toBeInTheDocument()
        expect(screen.getByRole("alert")).toHaveTextContent("函数表达式不合法")
    })

    it("shows a retry surface after the player falls from a sky island", () => {
        const retryLevel = vi.fn()
        gameState.current = createGame({
            status: "lost",
            playerAlive: false,
            retryLevel,
            lastShot: {
                seq: 1,
                expression: "-0.3",
                weaponId: "standard",
                traces: [],
                damage: [],
                pickups: [],
                relays: [],
                cratersAdded: [],
                falls: [{ unitId: "player", side: "player", position: FUNCTION_WARS_LEVELS[0].player }],
                effective: true,
                won: false,
                lost: true,
            },
        })

        render(<FunctionWarsPage />)

        expect(screen.getByText("承重坠落")).toBeInTheDocument()
        fireEvent.click(screen.getAllByRole("button", { name: "重开本关" })[0])
        expect(retryLevel).toHaveBeenCalledTimes(1)
    })

    it("keeps campaign levels locked outside dev mode and unlocks all levels for dev previews", () => {
        expect(getFunctionWarsMaxUnlockedIndex(new Set())).toBe(0)
        expect(getFunctionWarsMaxUnlockedIndex(new Set([FUNCTION_WARS_LEVELS[0].id]))).toBe(1)
        expect(getFunctionWarsMaxUnlockedIndex(new Set(), true)).toBe(FUNCTION_WARS_LEVELS.length - 1)
    })

    it("shows challenge mission progress after the campaign is complete", () => {
        const level = FUNCTION_WARS_LEVELS[10]
        const solvedLevels = FUNCTION_WARS_LEVELS.slice(0, 10).map((entry) => entry.id)
        gameState.current = createGame({
            level,
            levelIndex: 10,
            enemies: level.enemies.map((enemy) => ({
                id: enemy.id,
                type: enemy.type,
                position: enemy.position,
                radius: enemy.radius ?? 0.42,
                hp: enemy.type === "armored" ? 100 : 50,
                maxHp: enemy.type === "armored" ? 100 : 50,
            })),
            relays: level.relays?.map((relay) => ({
                id: relay.id,
                position: relay.position,
                radius: relay.radius ?? 0.34,
                active: true,
            })) ?? [],
            stats: {
                totalGames: 10,
                solvedLevels,
                bestShots: {},
                bestTimes: {},
                onlineGames: 0,
                onlineWins: 0,
            },
        })

        render(<FunctionWarsPage />)

        expect(screen.getByRole("button", { name: "挑战 11-15" })).toHaveAttribute("aria-pressed", "true")
        expect(screen.getByLabelText("本关任务")).toHaveTextContent("每发包含 sin、π")
        expect(screen.getByLabelText("本关任务")).toHaveTextContent("信号中继 0/2")
        expect(screen.getByRole("button", { name: "sin(" })).toHaveClass("border-amber-500")
    })

    it("shows an energy failure when the mission reaches its shot limit", () => {
        gameState.current = createGame({ status: "lost", lossReason: "shot_limit" })

        render(<FunctionWarsPage />)

        expect(screen.getByText("能源耗尽")).toBeInTheDocument()
        expect(screen.getByText(/射击次数已用完/)).toBeInTheDocument()
    })
})
