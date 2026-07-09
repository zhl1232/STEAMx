import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TUTOR_AUTO_READ_STORAGE_KEY,
  TUTOR_MOBILE_LONG_PRESS_STORAGE_KEY,
  TUTOR_VOICE_HINT_STORAGE_KEY,
  TUTOR_VOICE_REPLY_STORAGE_KEY,
} from "@/components/features/tutor/tutor-voice";

import XiaodiSettingsPage from "./page";

const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mockBack,
    push: vi.fn(),
  }),
}));

describe("XiaodiSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("defaults voice preferences to enabled", () => {
    render(<XiaodiSettingsPage />);

    expect(screen.getByRole("switch", { name: /自动朗读小迪新回复/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /移动端长按小迪语音输入/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /语音提问后播报回复/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /显示长按语音提示/i })).toHaveAttribute("aria-checked", "true");
  });

  it("stores preference changes in localStorage", async () => {
    const user = userEvent.setup();
    render(<XiaodiSettingsPage />);

    await user.click(screen.getByRole("switch", { name: /自动朗读小迪新回复/i }));
    await user.click(screen.getByRole("switch", { name: /移动端长按小迪语音输入/i }));
    await user.click(screen.getByRole("switch", { name: /语音提问后播报回复/i }));
    await user.click(screen.getByRole("switch", { name: /显示长按语音提示/i }));

    expect(window.localStorage.getItem(TUTOR_AUTO_READ_STORAGE_KEY)).toBe("0");
    expect(window.localStorage.getItem(TUTOR_MOBILE_LONG_PRESS_STORAGE_KEY)).toBe("0");
    expect(window.localStorage.getItem(TUTOR_VOICE_REPLY_STORAGE_KEY)).toBe("0");
    expect(window.localStorage.getItem(TUTOR_VOICE_HINT_STORAGE_KEY)).toBe("0");
  });
});
