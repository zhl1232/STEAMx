import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TermsPage, { metadata } from "./page";

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

    expect(screen.getByRole("heading", { name: "用户协议" })).toBeInTheDocument();
    expect(screen.getByText("版本：v2026.03")).toBeInTheDocument();
    expect(screen.getByText("生效日期：2026 年 3 月 20 日")).toBeInTheDocument();
  });

  it("links to the privacy policy and home page", () => {
    render(<TermsPage />);

    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "《隐私政策》" })).toHaveAttribute("href", "/legal/privacy");
  });

  it("exports legal page metadata", () => {
    expect(metadata.title).toBe("用户协议");
    expect(metadata.description).toContain("用户协议");
  });
});
