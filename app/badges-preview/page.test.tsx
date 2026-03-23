import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/components/features/gamification/badge-icon", () => ({
  BadgeIcon: ({ icon }: { icon: string }) => <div data-testid="badge-icon">{icon}</div>,
}));

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.resetModules();
});

describe("BadgesPreviewPage", () => {
  it("renders the preview in non-production environments", async () => {
    process.env.NODE_ENV = "test";

    const { default: BadgesPreviewPage } = await import("./page");

    render(<BadgesPreviewPage />);

    expect(screen.getByRole("heading", { name: /all badges preview/i })).toBeInTheDocument();
    expect(screen.getAllByTestId("badge-icon").length).toBeGreaterThan(0);
  });

  it("returns not found in production", async () => {
    process.env.NODE_ENV = "production";

    const { default: BadgesPreviewPage } = await import("./page");

    expect(() => BadgesPreviewPage()).toThrow("NEXT_NOT_FOUND");
  });
});
