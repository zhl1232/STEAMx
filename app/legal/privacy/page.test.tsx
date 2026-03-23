import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PrivacyPage, { metadata } from "./page";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("PrivacyPage", () => {
  it("renders the published privacy version and effective date", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "隐私政策" })).toBeInTheDocument();
    expect(screen.getByText("版本：v2026.03")).toBeInTheDocument();
    expect(screen.getByText("生效日期：2026 年 3 月 20 日")).toBeInTheDocument();
  });

  it("links to the terms page and home page", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "《用户协议》" })).toHaveAttribute("href", "/legal/terms");
  });

  it("exports legal page metadata", () => {
    expect(metadata.title).toBe("隐私政策");
    expect(metadata.description).toContain("隐私政策");
  });
});
