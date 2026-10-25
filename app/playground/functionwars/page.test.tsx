import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FUNCTION_WARS_LEVELS } from "@/lib/playground/function-wars-levels"
import { createWeaponInventory } from "@/lib/playground/function-wars-weapons"
import FunctionWarsPage from "./page"
import { BattleWeaponReadout } from "./immersive-controls"
import { Crosshair } from "lucide-react"
import { getFunctionWarsMaxUnlockedIndex } from "./level-progress"

const {
    checkBadgesMock,
    clearTutorOverrideMock,
    fireMock,
    gameState,
    searchParamsState,
    setTutorOverrideMock,
    setSceneMock,
} = vi.hoisted(() => ({
    setSceneMock: vi.fn(),
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
    FUNCTION_WARS_CANVAS_ASPECT_RATIO: 12 / 7,
    FunctionWarsRenderer: class {
        setScene(scene: unknown) { setSceneMock(scene) }
        setLabelExclusions() {}
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

    it("starts with sparse coordinates and lets the player toggle the detailed grid", () => {
        render(<FunctionWarsPage />)

        expect(setSceneMock).toHaveBeenLastCalledWith(expect.objectContaining({ gridVisible: false }))
        const grid = screen.getByRole("button", { name: "显示坐标网格" })
        expect(grid).toHaveAttribute("aria-pressed", "false")
        fireEvent.click(grid)
        expect(screen.getByRole("button", { name: "隐藏坐标网格" })).toHaveAttribute("aria-pressed", "true")
        expect(setSceneMock).toHaveBeenLastCalledWith(expect.objectContaining({ gridVisible: true }))
        expect(fireMock).not.toHaveBeenCalled()
    })

    it("updates the weapon readout from the selected weapon and remaining ammunition", () => {
        const { rerender } = render(<FunctionWarsPage />)
        expect(screen.getByLabelText("当前武器：标准，弹药 ∞")).toBeInTheDocument()

        gameState.current = createGame({ selectedWeapon: "heavy", inventory: createWeaponInventory({ heavy: 2 }) })
        rerender(<FunctionWarsPage />)
        expect(screen.getByLabelText("当前武器：重磅，弹药 2")).toBeInTheDocument()
        expect(screen.queryByLabelText("当前武器：标准，弹药 ∞")).not.toBeInTheDocument()
    })

    it.each(["cover", "wall", "enemy"] as const)("uses the fired weapon and %s material after weapon selection changes", (target) => {
        const level = FUNCTION_WARS_LEVELS[0]
        const obstacle = level.obstacles.find((entry) => entry.destructible === (target === "cover"))!
        const hitId = target === "enemy" ? level.enemies[0].id : obstacle.id
        const impact = { x: 3, y: -5 }
        gameState.current = createGame({
            selectedWeapon: "standard",
            status: "won",
            lastShot: {
                seq: 1,
                expression: "0",
                weaponId: "heavy",
                traces: [{ id: "primary", weaponId: "heavy", points: [level.player, impact], impact, hitId }],
                damage: [],
                pickups: [], relays: [], cratersAdded: [], effective: false, won: true, lost: false,
                falls: [],
            },
        })

        render(<FunctionWarsPage />)

        expect(setSceneMock).toHaveBeenLastCalledWith(expect.objectContaining({
            traces: [expect.objectContaining({ weapon: "heavy" })],
            impact: expect.objectContaining({
                weapon: "heavy",
                material: target === "enemy" ? "metal" : obstacle.material,
                obstacleId: target === "wall" ? obstacle.id : undefined,
            }),
        }))
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

        fireEvent.click(screen.getByText("选择关卡⌄"))
        fireEvent.click(screen.getByText("数学键盘"))
        expect(screen.getByRole("button", { name: "挑战 11-15" })).toHaveAttribute("aria-pressed", "true")
        expect(screen.getByLabelText("本关任务")).toHaveTextContent("每发有效使用 sin、π")
        expect(screen.getByLabelText("本关任务")).toHaveTextContent("信号中继 0/2")
        expect(screen.getByRole("button", { name: "sin(" })).toBeEnabled()
    })

    it("shows an energy failure when the mission reaches its shot limit", () => {
        gameState.current = createGame({ status: "lost", lossReason: "shot_limit" })

        render(<FunctionWarsPage />)

        expect(screen.getByText("能源耗尽")).toBeInTheDocument()
        expect(screen.getByText(/射击次数已用完/)).toBeInTheDocument()
    })
    it("collapses level selection and keeps unavailable weapons out of the controls", () => {
        render(<FunctionWarsPage />)
        expect(screen.getByText("选择关卡⌄").closest("details")).not.toHaveAttribute("open")
        fireEvent.click(screen.getByText("选择关卡⌄"))
        expect(screen.getByRole("button", { name: /第 2 关/ })).toBeDisabled()
        expect(screen.getByRole("group", { name: "选择武器" }).querySelectorAll("button")).toHaveLength(1)
    })

    it("explains an incomplete function mission and offers a retry", () => {
        gameState.current = createGame({ status: "lost", lossReason: "mission_incomplete", level: FUNCTION_WARS_LEVELS[14] })
        render(<FunctionWarsPage />)
        expect(screen.getByText("目标已清除，任务未完成")).toBeInTheDocument()
        expect(screen.getByText(/还需有效使用/)).toBeInTheDocument()
    })

    it("shows preview feedback without firing or changing the shot count", () => {
        gameState.current = createGame({ previewShot: { ok: false, error: "请让 f(0)=0，轨迹才能从炮口出发" } })
        render(<FunctionWarsPage />)
        expect(screen.getByRole("status")).toHaveTextContent("请让 f(0)=0")
        fireEvent.click(screen.getByRole("checkbox", { name: "试射预览" }))
        expect(fireMock).not.toHaveBeenCalled()
    })

    it("shows earned star counts while keeping legacy passes unranked", () => {
        const first = FUNCTION_WARS_LEVELS[0].id
        const second = FUNCTION_WARS_LEVELS[1].id
        gameState.current = createGame({ stats: { solvedLevels: [first, second], bestStars: { [first]: 2 }, bestSolutions: {} } })
        render(<FunctionWarsPage />)
        fireEvent.click(screen.getByText("选择关卡⌄"))
        expect(screen.getByRole("button", { name: /第 1 关.*最好 2 星/ })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /第 2 关.*已通过/ })).toBeInTheDocument()
    })

    it("keeps essential tasks visible without opening operations", () => {
        const level = FUNCTION_WARS_LEVELS[14]
        gameState.current = createGame({ level, relays: (level.relays ?? []).map((relay) => ({ ...relay, active: true })) })
        render(<FunctionWarsPage />)
        const chips = screen.getByLabelText("关键任务进度")
        expect(chips).toBeVisible()
        for (const name of level.mission?.effectiveFunctions ?? []) expect(chips).toHaveTextContent(`有效 ${name}`)
        expect(chips).toHaveTextContent(`剩余 ${level.mission?.shotLimit} 发`)
    })

    it("loads a saved solution without firing and exposes automatic weapon notices", () => {
        const setExpression = vi.fn()
        const selectWeapon = vi.fn()
        gameState.current = createGame({ setExpression, selectWeapon, weaponNotice: "分裂弹已用完，已切换标准弹", stats: { solvedLevels: [], bestStars: {}, bestSolutions: { [FUNCTION_WARS_LEVELS[0].id]: { stars: 3, shots: 1, steps: [{ expression: "0.4*x", weaponId: "standard" }] } } } })
        render(<FunctionWarsPage />)
        expect(screen.getByRole("status")).toHaveTextContent("分裂弹已用完")
        fireEvent.click(screen.getByText(/本关最佳解法/))
        fireEvent.click(screen.getByRole("button", { name: "载入第 1 发" }))
        expect(setExpression).toHaveBeenCalledWith("0.4*x")
        expect(selectWeapon).toHaveBeenCalledWith("standard")
        expect(fireMock).not.toHaveBeenCalled()
    })

    it("offers a final campaign summary and returning to level selection", () => {
        gameState.current = createGame({ status: "won", level: FUNCTION_WARS_LEVELS.at(-1), levelIndex: FUNCTION_WARS_LEVELS.length - 1, stars: 2 })
        render(<FunctionWarsPage />)
        expect(screen.getByText("最终关挑战完成！")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "保留函数再挑战" })).toBeInTheDocument()
        fireEvent.click(screen.getByText("返回选关"))
        expect(within(screen.getByText("返回选关").closest("details")!).getByLabelText("关卡选择")).toBeInTheDocument()
        expect(screen.getByText(/想拿三星/)).toBeInTheDocument()
    })

    it("switches weapons through a compact chooser and returns focus on close", () => {
        const select = vi.fn()
        render(<BattleWeaponReadout name="标准" icon={Crosshair} ammunition={null}><button type="button" onClick={select}>选择重炮</button></BattleWeaponReadout>)
        const trigger = screen.getByRole("button", { name: "当前武器：标准，弹药 ∞" })
        fireEvent.click(trigger)
        expect(trigger).toHaveAttribute("aria-expanded", "true")
        fireEvent.click(screen.getByRole("button", { name: "选择重炮" }))
        expect(select).toHaveBeenCalledOnce()
        expect(trigger).toHaveAttribute("aria-expanded", "false")
        expect(trigger).toHaveFocus()
        fireEvent.click(trigger)
        fireEvent.keyDown(screen.getByRole("button", { name: "选择重炮" }), { key: "Escape" })
        expect(trigger).toHaveAttribute("aria-expanded", "false")
        expect(trigger).toHaveFocus()
    })

    it("prioritizes a fatal preview using its simulated state and labels endpoints as preview", () => {
        const level = FUNCTION_WARS_LEVELS[14]
        const shot = { seq: 1, expression: "0", weaponId: "standard", traces: [{ id: "primary", weaponId: "standard", points: [level.player, { x: 5, y: 3 }], termination: "hit_enemy" }], damage: [], pickups: [], relays: [], cratersAdded: [], falls: [], effective: true, won: false, lost: true }
        gameState.current = createGame({ level, previewShot: { ok: true, state: createGame({ status: "lost", lossReason: "mission_incomplete" }), shot } })
        render(<FunctionWarsPage />)
        expect(screen.getByRole("status")).toHaveTextContent(/预览：.*目标清空/)
        expect(screen.getByRole("status")).toHaveAttribute("data-tone", "warning")
        expect(setSceneMock).toHaveBeenLastCalledWith(expect.objectContaining({ feedbackLabels: [expect.objectContaining({ x: 5, y: 3, preview: true })] }))
        expect(fireMock).not.toHaveBeenCalled()
    })

    it("keeps the actual result after firing and automatic weapon changes until the player edits", () => {
        vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("prefers-reduced-motion"), addEventListener: vi.fn(), removeEventListener: vi.fn() })))
        const level = FUNCTION_WARS_LEVELS[0]
        const shot = { seq: 1, expression: "0", weaponId: "heavy", traces: [{ id: "primary", weaponId: "heavy", points: [level.player, { x: 5, y: 3 }], termination: "hit_enemy" }], damage: [{ enemyId: level.enemies[0].id, damage: 12, remainingHp: 38 }], pickups: [], relays: [], cratersAdded: [], falls: [], effective: true, won: false, lost: false }
        const preview = { ...shot, weaponId: "standard", damage: [], traces: [{ ...shot.traces[0], weaponId: "standard", termination: "out_of_bounds" }] }
        gameState.current = createGame({ selectedWeapon: "heavy", lastShot: shot, previewShot: { ok: true, state: createGame(), shot: preview } })
        fireMock.mockReturnValue({ ok: true })
        const { rerender } = render(<FunctionWarsPage />)
        expect(screen.getByRole("status")).toHaveTextContent("预览：到达边界")
        fireEvent.click(screen.getByRole("button", { name: /^发射$/ }))
        expect(screen.getByRole("status")).toHaveTextContent("上一发：命中 1 个目标 · 伤害 12")
        expect(setSceneMock).toHaveBeenLastCalledWith(expect.objectContaining({ previewTraces: [], feedbackLabels: [expect.objectContaining({ preview: false })] }))
        gameState.current = { ...gameState.current!, selectedWeapon: "standard", time: 3 }
        const renderCount = setSceneMock.mock.calls.length
        rerender(<FunctionWarsPage />)
        expect(screen.getByRole("status")).toHaveTextContent("上一发：")
        expect(setSceneMock).toHaveBeenCalledTimes(renderCount)
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "0.4*x" } })
        expect(screen.getByRole("status")).toHaveTextContent("预览：到达边界")
        expect(setSceneMock).toHaveBeenLastCalledWith(expect.objectContaining({ feedbackLabels: [expect.objectContaining({ preview: true })] }))
    })

})
