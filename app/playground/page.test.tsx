import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PlaygroundPage from "./page"
import { PLAYGROUND_BADGE_COUNT } from "@/lib/gamification/badges"
import { PLAYGROUND_DISCOVERY } from "@/lib/playground/catalog"

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
        expect(screen.getAllByText(`游乐场共 ${PLAYGROUND_BADGE_COUNT} 枚可解锁徽章`).length).toBeGreaterThan(0)
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

    it("groups the current directory and finds secondary games", () => {
        const { container } = render(<PlaygroundPage />)
        for (const name of ["一起拼与创造", "做个小实验", "动脑与编程", "更多逻辑游戏"]) {
            expect(screen.getByRole("heading", { name: new RegExp(name) })).toBeInTheDocument()
        }
        expect(screen.getAllByRole("link", { name: /物理实验室/ }).every((link) => link.getAttribute("href") === "/playground/physics-lab")).toBe(true)
        expect(screen.getByRole("link", { name: /3D 物理课本/ })).toHaveAttribute("href", "/textbook")
        expect(container.querySelectorAll('article')).toHaveLength(PLAYGROUND_DISCOVERY.length)
        for (const slug of ["2048", "fifteen", "quickmath"]) {
            expect(container.querySelector(`a[href="/playground/${slug}"]`)).toBeNull()
        }
        const more = container.querySelector<HTMLDetailsElement>("#playground-more")!
        expect(more.open).toBe(false)
        expect(within(more).getAllByRole("article", { hidden: true })).toHaveLength(PLAYGROUND_DISCOVERY.filter((game) => game.group === "more").length)
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "数独" } })
        expect(screen.getByRole("link", { name: /数独/ })).toHaveAttribute("href", "/playground/sudoku")
        for (const query of ["2048", "数字华容道", "速算", "fifteen", "quickmath"]) {
            fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } })
            expect(screen.getByText(/没找到这个玩法/)).toBeInTheDocument()
            expect(screen.queryAllByRole("article")).toHaveLength(0)
        }
        fireEvent.click(screen.getByRole("button", { name: "返回分类浏览" }))
        expect(screen.getByRole("heading", { name: "一起拼与创造" })).toBeInTheDocument()
    })

    it("restores and opens the more-games directory from an active search before scrolling", () => {
        const { container } = render(<PlaygroundPage />)
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "数独" } })
        expect(container.querySelector("#playground-more")).toBeNull()
        const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(function (this: HTMLElement) {
            expect(this).toHaveAttribute("id", "playground-more")
            expect(this).toHaveAttribute("open")
            expect(screen.getByRole("searchbox")).toHaveValue("")
        })

        try {
            fireEvent.click(screen.getByRole("link", { name: /更多玩法/ }))

            expect(screen.getByRole("heading", { name: "一起拼与创造" })).toBeInTheDocument()
            const more = container.querySelector<HTMLDetailsElement>("#playground-more")!
            expect(more.open).toBe(true)
            expect(within(more).getAllByRole("article")).toHaveLength(PLAYGROUND_DISCOVERY.filter((game) => game.group === "more").length)
            expect(window.location.hash).toBe("#playground-more")
            expect(scroll).toHaveBeenCalledOnce()
        } finally {
            scroll.mockRestore()
            window.history.replaceState(null, "", window.location.pathname)
        }
    })

    it("excludes retired games from play, win, explored-game and STEAM totals", () => {
        const quickMath = { totalGames: 4, bestScore: 900, bestStreak: 12 }
        storageState.set("quick_math_stats", quickMath)
        storageState.set("game_2048_stats", { totalGames: 10, wins: 5 })
        storageState.set("fifteen_puzzle_stats", { totalGames: 8, wins: 6 })
        storageState.set("gomoku_records", { totalGames: 3, wins: 2 })
        render(<PlaygroundPage />)
        expect(screen.getByText("累计游玩记录").parentElement).toHaveTextContent("3")
        expect(screen.getByText("胜利 / 解题记录").parentElement).toHaveTextContent("2")
        expect(screen.getByText("已体验游戏").parentElement).toHaveTextContent(`1 / ${PLAYGROUND_DISCOVERY.length}`)
        expect(screen.queryByText(/STEAM 能力维度进度/)).not.toBeInTheDocument()
        expect(screen.getByText(/不代表能力测评或学习效果/)).toBeInTheDocument()
        const themes = screen.getByRole("heading", { name: "探索过的 STEAM 主题" }).parentElement!
        expect(within(themes).getByText("1 款 · 3 次记录")).toBeInTheDocument()
        expect(within(themes).getAllByText("0 款 · 0 次记录")).toHaveLength(4)
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
