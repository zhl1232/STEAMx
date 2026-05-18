import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadgeUnlockOverlay, showBadgeUnlockOverlay } from "./badge-unlock-overlay";

const { mockConfetti } = vi.hoisted(() => ({
  mockConfetti: vi.fn(),
}));

vi.mock("canvas-confetti", () => ({
  default: mockConfetti,
}));

describe("BadgeUnlockOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("shows unlocked badges in a centered queued overlay", async () => {
    render(<BadgeUnlockOverlay />);

    await act(async () => {
      showBadgeUnlockOverlay({
        id: "science_expert_bronze",
        name: "科学专家 · 铜",
        description: "完成科学类项目 3 个",
        icon: "atom",
        tier: "bronze",
        seriesKey: "science_expert",
      });
      showBadgeUnlockOverlay({
        id: "math_expert_bronze",
        name: "数学家 · 铜",
        description: "完成数学类项目 3 个",
        icon: "calculator",
        tier: "bronze",
        seriesKey: "math_expert",
      });
    });

    expect(screen.getByText("Badge Unlocked")).toBeInTheDocument();
    expect(screen.getByText("科学专家 · 铜")).toBeInTheDocument();
    expect(mockConfetti).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3600);
    });

    expect(screen.getByText("数学家 · 铜")).toBeInTheDocument();
    expect(mockConfetti).toHaveBeenCalledTimes(2);
  });
});
