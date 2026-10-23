import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PlaygroundPage from "./page"

const { storageState } = vi.hoisted(() => ({
    storageState: new Map<string, unknown>(),
}))

vi.mock("next/link", () => ({
    __esModule: true,
    default: ({ children, href, prefetch: _prefetch, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}))

vi.mock("@/lib/playground/storage", () => ({
    PLAYGROUND_CHANGE_EVENT: "playground-stats-change",
    getPlaygroundItem: (key: string) => storageState.get(key) ?? null,
}))

describe("PlaygroundPage", () => {
    beforeEach(() => {
        storageState.clear()
    })

    it("refreshes the overview when playground stats change after mount", async () => {
        render(<PlaygroundPage />)

        expect(screen.getByText("累计游玩记录")).toBeInTheDocument()
        expect(screen.getAllByText("游乐场共 16 枚可解锁徽章").length).toBeGreaterThan(0)
        expect(screen.getAllByText("0").length).toBeGreaterThan(0)

        storageState.set("gomoku_records", { totalGames: 3, wins: 2 })

        act(() => {
            window.dispatchEvent(
                new CustomEvent("playground-stats-change", {
                    detail: { source: "cloud-sync", skipUpload: true },
                }),
            )
        })

        expect(await screen.findByText("累计游玩记录")).toBeInTheDocument()
        expect(screen.getAllByText("已玩 3 · 继续探索").length).toBeGreaterThan(0)
    }, 15_000)

    it("merges minesweeper structured stats with legacy best-time records", async () => {
        storageState.set("minesweeper_stats", {
            totalGames: 1,
            wins: 0,
            winsByDifficulty: {},
            bestTimes: {},
        })
        storageState.set("minesweeper_best_times", { beginner: 45, expert: 120 })

        render(<PlaygroundPage />)

        expect(await screen.findByText("累计游玩记录")).toBeInTheDocument()
        expect(screen.getAllByText("已玩 2 · 继续探索").length).toBeGreaterThan(0)
    }, 15_000)

    it("groups the public directory and finds secondary games without exposing quick math", () => {
        const { container } = render(<PlaygroundPage />)
        for (const name of ["一起拼与创造", "做个小实验", "动脑与编程", "更多逻辑游戏"]) {
            expect(screen.getByRole("heading", { name: new RegExp(name) })).toBeInTheDocument()
        }
        expect(screen.getByRole("link", { name: /物理实验室/ })).toHaveAttribute("href", "/playground/physics-lab")
        expect(container.querySelector('a[href="/playground/quickmath"]')).toBeNull()
        const more = container.querySelector<HTMLDetailsElement>("#playground-more")!
        expect(more.open).toBe(false)
        expect(within(more).getAllByRole("article", { hidden: true })).toHaveLength(5)
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "2048" } })
        expect(screen.getByRole("link", { name: /2048/ })).toHaveAttribute("href", "/playground/2048")
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "速算" } })
        expect(screen.getByText(/没找到这个玩法/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "返回分类浏览" }))
        expect(screen.getByRole("heading", { name: "一起拼与创造" })).toBeInTheDocument()
    })

    it("retains historical plays without treating quick-math best score as victories", () => {
        const quickMath = { totalGames: 4, bestScore: 900, bestStreak: 12 }
        storageState.set("quick_math_stats", quickMath)
        storageState.set("gomoku_records", { totalGames: 3, wins: 2 })
        render(<PlaygroundPage />)
        expect(screen.getByText("累计游玩记录").parentElement).toHaveTextContent("7")
        expect(screen.getByText("胜利 / 解题记录").parentElement).toHaveTextContent("2")
        expect(screen.getByText("已体验游戏").parentElement).toHaveTextContent("2 / 18")
        expect(screen.queryByText(/STEAM 能力维度进度/)).not.toBeInTheDocument()
        expect(screen.getByText(/不代表能力测评或学习效果/)).toBeInTheDocument()
        expect(storageState.get("quick_math_stats")).toEqual(quickMath)
    })

    it("offers family guidance and reflects the actual function-wars campaign and challenge counts", async () => {
        const { FUNCTION_WARS_CAMPAIGN_LEVELS, FUNCTION_WARS_CHALLENGE_LEVELS } = await import("@/lib/playground/function-wars-levels")
        render(<PlaygroundPage />)
        expect(screen.getAllByText("一起试试")).toHaveLength(5)
        expect(screen.getByText("改变函数观察弹道，探索 " + FUNCTION_WARS_CAMPAIGN_LEVELS.length + " 个战役关与 " + FUNCTION_WARS_CHALLENGE_LEVELS.length + " 个挑战关。")).toBeInTheDocument()
        expect(screen.getByText("进入扫雷解局学 · 9 课")).toHaveAttribute("href", "/playground/minesweeper/course")
        expect(screen.getByText("用纸片或积木复现，再给家长出一道题。")).toBeInTheDocument()
    })
})
