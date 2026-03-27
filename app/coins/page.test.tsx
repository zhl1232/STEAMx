import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CoinsPage, { getActionLabel } from "./page";

const mockUseQuery = vi.fn();
const mockRefetch = vi.fn();

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "11111111-1111-1111-1111-111111111111" },
    loading: false,
  }),
}));

vi.mock("@/context/gamification-context", () => ({
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

vi.mock("@/components/ui/mobile-page-header", () => ({
  MobilePageHeader: () => null,
}));

describe("CoinsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          counterparty_display_text: "挑战赛第1名奖励",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<CoinsPage />);

    expect(screen.getByText("挑战赛第1名奖励")).toBeInTheDocument();
    expect(screen.queryByText("challenge_prize")).not.toBeInTheDocument();
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
