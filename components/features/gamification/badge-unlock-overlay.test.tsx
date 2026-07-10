import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadgeUnlockOverlay,
  resetBadgeUnlockOverlayForTests,
  showBadgeUnlockOverlay,
} from "./badge-unlock-overlay";

const { mockConfetti } = vi.hoisted(() => ({
  mockConfetti: vi.fn(),
}));

vi.mock("canvas-confetti", () => ({
  default: mockConfetti,
}));

const scienceBadge = {
  id: "science_expert_bronze",
  name: "科学专家 · 铜",
  description: "完成科学类项目 3 个",
  icon: "atom",
  tier: "bronze" as const,
  seriesKey: "science_expert",
};

const mathBadge = {
  id: "math_expert_bronze",
  name: "数学家 · 铜",
  description: "完成数学类项目 3 个",
  icon: "calculator",
  tier: "bronze" as const,
  seriesKey: "math_expert",
};

const artBadge = {
  id: "art_expert_bronze",
  name: "艺术家 · 铜",
  description: "完成艺术类项目 3 个",
  icon: "palette",
  tier: "bronze" as const,
  seriesKey: "art_expert",
};

describe("BadgeUnlockOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetBadgeUnlockOverlayForTests();
  });

  afterEach(() => {
    act(() => {
      resetBadgeUnlockOverlayForTests();
    });
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("shows a single badge celebration and auto-dismisses", async () => {
    render(<BadgeUnlockOverlay />);

    await act(async () => {
      showBadgeUnlockOverlay(scienceBadge);
    });

    expect(screen.getByText("Badge Unlocked")).toBeInTheDocument();
    expect(screen.getByText("科学专家 · 铜")).toBeInTheDocument();
    expect(mockConfetti).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3600);
    });

    expect(screen.queryByText("科学专家 · 铜")).not.toBeInTheDocument();
  });

  it("dismisses a single badge when clicked", async () => {
    render(<BadgeUnlockOverlay />);

    await act(async () => {
      showBadgeUnlockOverlay(scienceBadge);
    });

    fireEvent.click(screen.getByRole("dialog", { name: "解锁徽章：科学专家 · 铜" }));

    expect(screen.queryByText("科学专家 · 铜")).not.toBeInTheDocument();
  });

  it("collapses multiple unlocks into one summary sheet", async () => {
    render(<BadgeUnlockOverlay />);

    await act(async () => {
      showBadgeUnlockOverlay(scienceBadge);
      showBadgeUnlockOverlay(mathBadge);
      showBadgeUnlockOverlay(artBadge);
    });

    expect(screen.getByText("解锁了 3 枚徽章")).toBeInTheDocument();
    expect(screen.getByText("科学专家 · 铜")).toBeInTheDocument();
    expect(screen.getByText("数学家 · 铜")).toBeInTheDocument();
    expect(screen.getByText("艺术家 · 铜")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看图鉴" })).toHaveAttribute("href", "/profile");
    expect(mockConfetti).toHaveBeenCalledTimes(1);
  });

  it("upgrades from single celebration to summary when more badges arrive", async () => {
    render(<BadgeUnlockOverlay />);

    await act(async () => {
      showBadgeUnlockOverlay(scienceBadge);
    });

    expect(screen.getByText("Badge Unlocked")).toBeInTheDocument();

    await act(async () => {
      showBadgeUnlockOverlay(mathBadge);
    });

    expect(screen.getByText("解锁了 2 枚徽章")).toBeInTheDocument();
    expect(screen.getByText("科学专家 · 铜")).toBeInTheDocument();
    expect(screen.getByText("数学家 · 铜")).toBeInTheDocument();
  });

  it("dismisses the summary with the primary button", async () => {
    render(<BadgeUnlockOverlay />);

    await act(async () => {
      showBadgeUnlockOverlay(scienceBadge);
      showBadgeUnlockOverlay(mathBadge);
    });

    fireEvent.click(screen.getByRole("button", { name: "太棒了" }));

    expect(screen.queryByText("解锁了 2 枚徽章")).not.toBeInTheDocument();
  });
});
