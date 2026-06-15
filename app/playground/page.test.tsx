import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PlaygroundPage from "./page"

const { storageState } = vi.hoisted(() => ({
    storageState: new Map<string, unknown>(),
}))

vi.mock("next/link", () => ({
    __esModule: true,
    default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
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

        expect(screen.getByText("总游玩局数")).toBeInTheDocument()
        expect(screen.getAllByText("游乐场共 15 枚可解锁徽章").length).toBeGreaterThan(0)
        expect(screen.getAllByText("0").length).toBeGreaterThan(0)

        storageState.set("gomoku_records", { totalGames: 3, wins: 2 })

        act(() => {
            window.dispatchEvent(
                new CustomEvent("playground-stats-change", {
                    detail: { source: "cloud-sync", skipUpload: true },
                }),
            )
        })

        expect(await screen.findByText("总游玩局数")).toBeInTheDocument()
        expect(screen.getByText("已玩 3")).toBeInTheDocument()
    })

    it("merges minesweeper structured stats with legacy best-time records", async () => {
        storageState.set("minesweeper_stats", {
            totalGames: 1,
            wins: 0,
            winsByDifficulty: {},
            bestTimes: {},
        })
        storageState.set("minesweeper_best_times", { beginner: 45, expert: 120 })

        render(<PlaygroundPage />)

        expect(await screen.findByText("总游玩局数")).toBeInTheDocument()
        expect(screen.getByText("已玩 2")).toBeInTheDocument()
    })
})
