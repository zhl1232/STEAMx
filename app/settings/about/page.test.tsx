import { render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import AboutSettingsPage from "./page";

const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mockBack,
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

describe("AboutSettingsPage", () => {
  const originalEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render a broken mailto link when the support email is not configured", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "";

    render(<AboutSettingsPage />);

    expect(screen.getByText(/暂未配置反馈邮箱/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /问题反馈/i })).not.toBeInTheDocument();
  });

  it("renders the configured support email without an external link", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@example.test";

    render(<AboutSettingsPage />);

    expect(screen.getByText("support@example.test")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /问题反馈/i })).not.toBeInTheDocument();
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = originalEmail;
  });
});
