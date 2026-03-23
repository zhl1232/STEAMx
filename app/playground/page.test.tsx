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

        expect(screen.queryByText("总游玩局数")).not.toBeInTheDocument()

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
})
