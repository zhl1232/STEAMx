import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CompletionRecordComments } from "./completion-record-comments"

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock("@/lib/context/auth-context", () => ({ useAuth: () => ({ user: auth.user }) }))
vi.mock("@/lib/context/login-prompt-context", () => ({ useLoginPrompt: () => ({ promptLogin: vi.fn() }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/features/growth/exchange-feedback", () => ({
  useExchangeFeedback: () => new Map(), ExchangeRewardHint: () => null, GrowthQualityBadge: () => null,
}))
vi.mock("@/components/ui/user-avatar", () => ({ UserAvatar: () => null }))

const comment = (id: number, parent_id: number | null = null) => ({
  id, parent_id, author: `作者${id}`, userId: `user-${id}`, content: `留言内容${id}`, date: "刚刚", created_at: `2026-10-01T10:00:${String(id).padStart(2, "0")}Z`,
})
const json = (comments: unknown[], nextCursor: number | null) => new Response(JSON.stringify({ comments, nextCursor }), { status: 200 })
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><CompletionRecordComments completionId={42} /></QueryClientProvider>)
  return client
}
afterEach(() => { vi.unstubAllGlobals(); auth.user = null })

describe("completion comment pagination", () => {
  it("loads later replies into their original thread and deduplicates page overlap", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json([comment(1), comment(2, 1)], 2))
      .mockResolvedValueOnce(json([comment(2, 1), comment(3, 2), comment(4, 3)], null))
    vi.stubGlobal("fetch", fetcher)
    const user = userEvent.setup()
    setup()
    expect(await screen.findByText("留言内容1")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "加载更多" }))
    expect(await screen.findByText("已加载 4 条留言与回复")).toBeInTheDocument()
    expect(screen.getAllByText("留言内容2")).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: "展开其余 1 条回复" }))
    expect(screen.getByText("留言内容4")).toBeInTheDocument()
    expect(fetcher.mock.calls[0][0]).toBe("/api/completions/42/comments?pagination=cursor&limit=10")
    expect(fetcher.mock.calls[1][0]).toBe("/api/completions/42/comments?pagination=cursor&limit=10&after=2")
    expect(screen.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument()
  })

  it("keeps loaded comments when another page fails and retries the same cursor", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json([comment(1)], 1))
      .mockResolvedValueOnce(new Response("unavailable", { status: 500 }))
      .mockResolvedValueOnce(json([comment(2)], null))
    vi.stubGlobal("fetch", fetcher)
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole("button", { name: "加载更多" }))
    expect(await screen.findByRole("button", { name: "加载失败，重试" })).toBeInTheDocument()
    expect(screen.getByText("留言内容1")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "加载失败，重试" }))
    expect(await screen.findByText("留言内容2")).toBeInTheDocument()
    expect(fetcher.mock.calls[1][0]).toBe(fetcher.mock.calls[2][0])
  })

  it("offers retry for an initial failure instead of claiming the work has no comments", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 500 }))
      .mockResolvedValueOnce(json([comment(1)], null)))
    const user = userEvent.setup()
    setup()
    expect(await screen.findByRole("alert")).toHaveTextContent("留言加载失败")
    expect(screen.queryByText(/还没有留言/)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "重新加载" }))
    expect(await screen.findByText("留言内容1")).toBeInTheDocument()
  })

  it("disables repeated loading while the next page is in flight", async () => {
    let finishPage!: (response: Response) => void
    const nextPage = new Promise<Response>(resolve => { finishPage = resolve })
    const fetcher = vi.fn().mockResolvedValueOnce(json([comment(1)], 1)).mockReturnValueOnce(nextPage)
    vi.stubGlobal("fetch", fetcher)
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole("button", { name: "加载更多" }))
    expect(screen.getByRole("button", { name: "加载中…" })).toBeDisabled()
    expect(screen.getByText("留言内容1")).toBeInTheDocument()
    finishPage(json([comment(2)], null))
    expect(await screen.findByText("留言内容2")).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("keeps a short completed list free of pagination labels", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json([comment(1)], null)))
    setup()
    await screen.findByText("留言内容1")
    expect(screen.queryByText(/已加载/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument()
  })

  it("confirms a submitted comment even when only an earlier page is loaded", async () => {
    auth.user = { id: "viewer-1" }
    const fetcher = vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(
      init?.method === "POST"
        ? new Response(JSON.stringify({ comment: comment(100), moderation: { state: "pending" } }), { status: 202 })
        : json([comment(1)], 1),
    ))
    vi.stubGlobal("fetch", fetcher)
    const user = userEvent.setup()
    const client = setup()
    await screen.findByText("留言内容1")
    await user.type(screen.getByRole("textbox"), "这是新留言")
    await user.click(screen.getByRole("button", { name: "发表留言" }))
    expect(await screen.findByText("留言已提交，审核通过后会公开显示。")).toBeInTheDocument()
    expect(screen.getByText("留言内容1")).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toHaveValue("")
    expect(screen.queryByText("留言内容100")).not.toBeInTheDocument()
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes("after="))).toBe(true)
    client.clear()
  })

  it("refreshes every loaded page without collapsing the list", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json([comment(1)], 1))
      .mockResolvedValueOnce(json([comment(2)], null))
      .mockResolvedValueOnce(json([comment(1)], 1))
      .mockResolvedValueOnce(json([comment(2), comment(3)], null))
    vi.stubGlobal("fetch", fetcher)
    const user = userEvent.setup()
    const client = setup()
    await user.click(await screen.findByRole("button", { name: "加载更多" }))
    await screen.findByText("留言内容2")
    await client.invalidateQueries({ queryKey: ["completion_comments", 42] })
    await waitFor(() => expect(screen.getByText("留言内容3")).toBeInTheDocument())
    expect(screen.getByText("留言内容1")).toBeInTheDocument()
    expect(screen.getByText("留言内容2")).toBeInTheDocument()
    expect(fetcher.mock.calls[2][0]).toBe(fetcher.mock.calls[0][0])
    expect(fetcher.mock.calls[3][0]).toBe(fetcher.mock.calls[1][0])
  })
})
