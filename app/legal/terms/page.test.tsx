import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TermsPage, { metadata } from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("TermsPage", () => {
  it("renders the published terms version and effective date", () => {
    render(<TermsPage />);

    expect(screen.getAllByText("用户协议").length).toBeGreaterThan(0);
    expect(screen.getAllByText("版本：v2026.03").length).toBeGreaterThan(0);
    expect(screen.getAllByText("生效日期：2026 年 3 月 20 日").length).toBeGreaterThan(0);
  });

  it("links to the privacy policy", () => {
    render(<TermsPage />);

    expect(screen.getByRole("link", { name: "《隐私政策》" })).toHaveAttribute("href", "/legal/privacy");
  });

  it("exports legal page metadata", () => {
    expect(metadata.title).toBe("用户协议");
    expect(metadata.description).toContain("用户协议");
  });
});
