import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CoinsPage from "./page";
import { getActionLabel } from "./action-label";

const { mockRange, mockSelect, mockEq, mockOrder, mockRpc } = vi.hoisted(() => ({
  mockRange: vi.fn(), mockSelect: vi.fn(), mockEq: vi.fn(), mockOrder: vi.fn(), mockRpc: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><CoinsPage /></QueryClientProvider>);
}

function setViewport(width: number) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        (query.includes("min-width: 1280px") && width >= 1280) ||
        (query.includes("min-width: 768px") && width >= 768) ||
        (query.includes("min-width: 640px") && width >= 640),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "11111111-1111-1111-1111-111111111111" },
    loading: false,
  }),
}));

vi.mock("@/lib/context/gamification-context", () => ({
  useGamification: () => ({
    coins: 42,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      order: mockOrder.mockReturnThis(),
      range: mockRange,
    })),
  }),
}));

describe("CoinsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRpc.mockResolvedValue({ data: { membershipTier: 'free', coins: 42, level: 5, items: [
      { id: 'pixel_border', price: 15, basePrice: 15, minLevel: 0, owned: true },
      { id: 'crystal_glass', price: 50, basePrice: 50, minLevel: 5, owned: false },
      { id: 'science_orbit', price: 120, basePrice: 120, minLevel: 8, owned: false }
    ] }, error: null });
    setViewport(390);
    mockRange.mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    });
  });

  it("renders challenge prize logs with a human-readable label", async () => {
    mockRange.mockResolvedValue({
      data: [
        {
          id: 1,
          user_id: "11111111-1111-1111-1111-111111111111",
          amount: 20,
          action_type: "challenge_prize",
          resource_id: "7",
          created_at: "2026-03-20T12:00:00.000Z",
          counterparty_display_text: "挑战第1名奖励",
        },
      ],
      count: 1,
      error: null,
    });

    renderPage();

    expect(await screen.findByText("挑战第1名奖励")).toBeInTheDocument();
    expect(screen.queryByText("challenge_prize")).not.toBeInTheDocument();
  });

  it.each([390, 768, 1440])("keeps the shop reachable from the wallet at %ipx", (width) => {
    setViewport(width);
    renderPage();
    expect(screen.getByRole("link", { name: "去兑换装扮" })).toHaveAttribute("href", "/shop");
  });

  it("uses a center-style mobile header without a back button", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "硬币", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "返回上一页" })).not.toBeInTheDocument();
  });

  it("adds a historical balance entry when current coins exceed logged transactions", async () => {
    renderPage();

    expect(await screen.findAllByText("历史结余")).not.toHaveLength(0);
    expect(screen.getByText("早期余额或系统同步，未记录到具体流水")).toBeInTheDocument();
    expect(screen.getByText("共 1 条")).toBeInTheDocument();
  });

  it("renders today's transaction time only once to keep desktop and mobile metadata consistent", async () => {
    const createdAt = new Date(Date.now() - 60_000).toISOString();
    const expectedTime = new Date(createdAt).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" });

    mockRange.mockResolvedValue({
      data: [
        {
          id: 1,
          user_id: "11111111-1111-1111-1111-111111111111",
          amount: 42,
          action_type: "daily_login",
          resource_id: null,
          created_at: createdAt,
          counterparty_display_text: null,
        },
      ],
      count: 1,
      error: null,
    });

    renderPage();

    expect(await screen.findAllByText(expectedTime)).toHaveLength(1);
  });

  it("shows a retry state when coin logs fail to load", async () => {
    mockRange.mockResolvedValue({
      data: [],
      count: null,
      error: new Error("coin logs unavailable"),
    });

    renderPage();

    expect(await screen.findByText("加载记录失败")).toBeInTheDocument();
    expect(screen.getByText("coin logs unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "刷新重试" }));
    await waitFor(() => expect(mockRange).toHaveBeenCalledTimes(2));
  });

  const logs = Array.from({ length: 41 }, (_, index) => ({
    id: 41 - index,
    user_id: "11111111-1111-1111-1111-111111111111",
    amount: 1,
    action_type: "challenge_prize",
    resource_id: null,
    created_at: "2026-03-20T12:00:00.000Z",
    counterparty_display_text: `奖励 ${index + 1}`,
  }));

  it.each([390, 1440])("loads 20 records per page and hides the button at the end at %ipx", async (width) => {
    setViewport(width);
    mockRange.mockImplementation(async (from: number, to: number) => ({
      data: logs.slice(from, to + 1), count: logs.length, error: null,
    }));
    renderPage();
    expect(await screen.findByText("奖励 20")).toBeInTheDocument();
    expect(screen.queryByText("奖励 21")).not.toBeInTheDocument();
    expect(screen.queryByText("历史结余")).not.toBeInTheDocument();
    expect(screen.getByText("共 41 条")).toBeInTheDocument();
    expect(mockSelect).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
    expect(mockEq).toHaveBeenCalledWith("user_id", logs[0].user_id);
    expect(mockOrder).toHaveBeenCalledWith("id", { ascending: false });
    expect(mockRange).toHaveBeenLastCalledWith(0, 19);

    let resolvePage!: (value: unknown) => void;
    mockRange.mockImplementationOnce(() => new Promise((resolve) => { resolvePage = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    expect(await screen.findByRole("button", { name: "加载中..." })).toBeDisabled();
    expect(screen.getByText("奖励 1")).toBeInTheDocument();
    await act(async () => { resolvePage({ data: logs.slice(20, 40), count: 41, error: null }); });
    expect(await screen.findByText("奖励 40")).toBeInTheDocument();
    expect(mockRange).toHaveBeenLastCalledWith(20, 39);
    expect(screen.queryByText("奖励 41")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    expect(await screen.findByText("奖励 41")).toBeInTheDocument();
    expect(screen.getByText("奖励 1")).toBeInTheDocument();
    expect(mockRange).toHaveBeenLastCalledWith(40, 59);
    expect(screen.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument();
    expect(screen.getAllByText("历史结余")).not.toHaveLength(0);
    expect(screen.getByText("共 42 条")).toBeInTheDocument();
  });

  it("keeps loaded rows and retries the same page after a load-more failure", async () => {
    mockRange.mockResolvedValueOnce({ data: logs.slice(0, 20), count: 40, error: null })
      .mockResolvedValueOnce({ data: null, count: null, error: new Error("unavailable") })
      .mockResolvedValueOnce({ data: logs.slice(20, 40), count: 40, error: null });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "加载更多" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("加载更多失败，请重试");
    expect(screen.getByText("奖励 1")).toBeInTheDocument();
    expect(screen.queryByText("历史结余")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    expect(await screen.findByText("奖励 40")).toBeInTheDocument();
    expect(mockRange.mock.calls).toEqual([[0, 19], [20, 39], [20, 39]]);
    expect(screen.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument();
  });
});

describe("getActionLabel", () => {
  it("falls back to a generic challenge reward label when display text is missing", () => {
    expect(getActionLabel("challenge_prize", "7", null, 20)).toBe("挑战奖励");
  });
});
