import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CoinsPage, { getActionLabel } from "./page";

const mockUseQuery = vi.fn();
const mockRefetch = vi.fn();

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
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn(),
    })),
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

describe("CoinsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setViewport(390);
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it("renders challenge prize logs with a human-readable label", () => {
    mockUseQuery.mockReturnValue({
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
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<CoinsPage />);

    expect(screen.getByText("挑战第1名奖励")).toBeInTheDocument();
    expect(screen.queryByText("challenge_prize")).not.toBeInTheDocument();
  });

  it("uses a center-style mobile header without a back button", () => {
    render(<CoinsPage />);

    expect(screen.getByRole("heading", { name: "硬币", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "返回上一页" })).not.toBeInTheDocument();
  });



  it("adds a historical balance entry when current coins exceed logged transactions", () => {
    render(<CoinsPage />);

    expect(screen.getAllByText("历史结余")).not.toHaveLength(0);
    expect(screen.getByText("早期余额或系统同步，未记录到具体流水")).toBeInTheDocument();
    expect(screen.getByText("共 1 条")).toBeInTheDocument();
  });

  it("renders today's transaction time only once to keep desktop and mobile metadata consistent", () => {
    const createdAt = new Date(Date.now() - 60_000).toISOString();
    const expectedTime = new Date(createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

    mockUseQuery.mockReturnValue({
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
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<CoinsPage />);

    expect(screen.getAllByText(expectedTime)).toHaveLength(1);
  });

  it("shows a retry state when coin logs fail to load", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error("coin logs unavailable"),
      refetch: mockRefetch,
    });

    render(<CoinsPage />);

    expect(screen.getByText("加载记录失败")).toBeInTheDocument();
    expect(screen.getByText("coin logs unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "刷新重试" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

describe("getActionLabel", () => {
  it("falls back to a generic challenge reward label when display text is missing", () => {
    expect(getActionLabel("challenge_prize", "7", null, 20)).toBe("挑战奖励");
  });
});
