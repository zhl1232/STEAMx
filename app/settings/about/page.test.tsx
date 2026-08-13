import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/lib/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/context/login-prompt-context", () => ({
  useLoginPrompt: () => ({ promptLogin: vi.fn() }),
}));

describe("AboutSettingsPage", () => {
  const originalEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always exposes the in-site feedback composer", async () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "";
    const user = userEvent.setup();

    render(<AboutSettingsPage />);

    await user.click(screen.getByRole("button", { name: /问题反馈/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("反馈内容")).toBeInTheDocument();
  });

  it("renders the optional email fallback when configured", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@example.test";

    render(<AboutSettingsPage />);

    expect(screen.getByRole("link", { name: /邮件反馈（备用）/i })).toHaveAttribute(
      "href",
      "mailto:support@example.test?subject=问题反馈",
    );
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = originalEmail;
  });
});
