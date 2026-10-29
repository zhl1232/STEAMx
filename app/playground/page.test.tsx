import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PlaygroundPage from "./page"
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
        expect(screen.getByText("查看我的徽章")).toHaveAttribute("href", "/profile#profile-badges-anchor")
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

    it("shows the complete directory with featured games first", () => {
        const { container } = render(<PlaygroundPage />)
        expect(screen.getAllByRole("article")).toHaveLength(PLAYGROUND_DISCOVERY.length)
        const firstGames = screen.getAllByRole("article").slice(0, 3).map((article) => within(article).getByRole("link").getAttribute("href"))
        expect(firstGames).toEqual(PLAYGROUND_DISCOVERY.filter((game) => game.featured).map((game) => game.href))
        expect(screen.getByRole("link", { name: /数独/ })).toHaveAttribute("href", "/playground/sudoku")
        expect(screen.getByRole("link", { name: /N 皇后/ })).toHaveAttribute("href", "/playground/nqueens")
        expect(screen.getByRole("link", { name: /物理实验室/ })).toHaveAttribute("href", "/playground/physics-lab")
        expect(screen.getByRole("link", { name: /3D 物理课本/ })).toHaveAttribute("href", "/textbook")
        for (const name of ["从这里开始", "更多玩法", "更多逻辑游戏"]) {
            expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument()
        }
        for (const slug of ["2048", "fifteen", "quickmath"]) {
            expect(container.querySelector(`a[href="/playground/${slug}"]`)).toBeNull()
        }
        expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "搜索玩法" })).not.toBeInTheDocument()
    })

    it("excludes retired games from the visible exploration totals", () => {
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
        expect(screen.queryByRole("heading", { name: "探索过的 STEAM 主题" })).not.toBeInTheDocument()
        expect(storageState.get("quick_math_stats")).toEqual(quickMath)
    })

    it("keeps records and counting details collapsed until requested", () => {
        storageState.set("gomoku_records", { totalGames: 3, wins: 2 })
        render(<PlaygroundPage />)
        const summary = screen.getByText("我的探索记录").closest("summary")!
        expect(summary).toHaveTextContent("已体验 1 款 · 3 次记录")
        expect(summary.closest("details")).not.toHaveAttribute("open")
        fireEvent.click(summary)
        expect(summary.closest("details")).toHaveAttribute("open")
        const note = screen.getByText("记录说明").closest("details")!
        expect(note).not.toHaveAttribute("open")
        expect(screen.getByRole("link", { name: "查看我的徽章" })).toHaveAttribute("href", "/profile#profile-badges-anchor")
    })

    it("keeps cards short and reflects the actual function-wars campaign and challenge counts", async () => {
        const { FUNCTION_WARS_CAMPAIGN_LEVELS, FUNCTION_WARS_CHALLENGE_LEVELS } = await import("@/lib/playground/function-wars-levels")
        render(<PlaygroundPage />)
        expect(screen.queryByText("一起试试")).not.toBeInTheDocument()
        expect(screen.queryByText(/陪玩与延伸/)).not.toBeInTheDocument()
        expect(screen.queryByText(/建议 .* · 参考/)).not.toBeInTheDocument()
        expect(screen.getByText("改变函数观察弹道，探索 " + FUNCTION_WARS_CAMPAIGN_LEVELS.length + " 个战役关与 " + FUNCTION_WARS_CHALLENGE_LEVELS.length + " 个挑战关。")).toBeInTheDocument()
    })
})
