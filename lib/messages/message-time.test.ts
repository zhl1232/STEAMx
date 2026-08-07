import { describe, expect, it } from "vitest";

import {
  formatMessageTime,
  MESSAGE_TIME_GAP_MS,
  shouldShowMessageTime,
} from "./message-time";

function messageAt(timestamp: number) {
  return { created_at: new Date(timestamp).toISOString() };
}

describe("message time display", () => {
  it("shows the first message and starts a new time group after five hours", () => {
    const start = Date.parse("2026-08-06T04:00:00.000Z");
    const messages = [
      messageAt(start),
      messageAt(start + MESSAGE_TIME_GAP_MS - 1),
      messageAt(start + MESSAGE_TIME_GAP_MS * 2),
    ];

    expect(shouldShowMessageTime(messages, 0)).toBe(true);
    expect(shouldShowMessageTime(messages, 1)).toBe(false);
    expect(shouldShowMessageTime(messages, 2)).toBe(true);
  });

  it("formats today, yesterday, same-year, and older messages", () => {
    const now = new Date(2026, 7, 6, 9, 5);

    expect(formatMessageTime(now, now)).toBe("09:05");
    expect(formatMessageTime(new Date(2026, 7, 5, 8, 4), now)).toBe("昨天 08:04");
    expect(formatMessageTime(new Date(2026, 6, 28, 18, 30), now)).toBe("7月28日 18:30");
    expect(formatMessageTime(new Date(2025, 11, 31, 23, 59), now)).toBe("2025年12月31日 23:59");
  });

  it("returns an empty label for an invalid date", () => {
    expect(formatMessageTime("not-a-date")).toBe("");
  });
});
