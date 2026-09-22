import type { ButtonHTMLAttributes } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAnnouncements } from "./admin-announcements";

vi.mock("@/lib/context/auth-context", () => ({
  useAuth: () => ({ isAdmin: true, loading: false }),
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const announcement = {
  id: 7,
  title: "旧公告",
  summary: "摘要",
  body: "**正文**",
  level: "normal",
  status: "draft",
  action_label: null,
  action_href: null,
  published_at: null,
  expires_at: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};
const welcome = {
  enabled: true,
  title: "欢迎",
  body: "正文",
  contact_href: "/about#contact",
};
describe("AdminAnnouncements", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  it("edits with PATCH and publishes after save", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      calls.push([String(input), init]);
      if (String(input) === "/api/admin/announcements")
        return new Response(JSON.stringify({ announcements: [announcement] }));
      if (String(input) === "/api/admin/welcome")
        return new Response(JSON.stringify({ settings: welcome }));
      if (String(input).endsWith("/publish"))
        return new Response(JSON.stringify({ announcement }));
      return new Response(JSON.stringify({ announcement }));
    });
    render(<AdminAnnouncements />);
    await screen.findByText("旧公告");
    await userEvent.click(screen.getByRole("button", { name: "编辑" }));
    await userEvent.clear(screen.getByLabelText("标题"));
    await userEvent.type(screen.getByLabelText("标题"), "新标题");
    await userEvent.click(screen.getByRole("button", { name: "立即发布" }));
    await waitFor(() =>
      expect(
        calls.some(
          ([url, init]) => url.endsWith("/7") && init?.method === "PATCH",
        ),
      ).toBe(true),
    );
    expect(calls.some(([url]) => url.endsWith("/7/publish"))).toBe(true);
  });
  it("saves welcome settings and reports patch failures", async () => {
    let welcomeCalls = 0;
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      if (String(input) === "/api/admin/announcements")
        return new Response(JSON.stringify({ announcements: [] }));
      if (String(input) === "/api/admin/welcome" && init?.method === "PATCH") {
        welcomeCalls++;
        return new Response("", { status: 500 });
      }
      if (String(input) === "/api/admin/welcome")
        return new Response(JSON.stringify({ settings: welcome }));
      return new Response(JSON.stringify({}));
    });
    render(<AdminAnnouncements />);
    const input = await screen.findByLabelText("欢迎标题");
    await userEvent.clear(input);
    await userEvent.type(input, "新欢迎");
    await userEvent.click(screen.getByRole("button", { name: "保存欢迎语" }));
    await waitFor(() => expect(welcomeCalls).toBe(1));
    expect(
      await screen.findByText("欢迎语保存失败，请重试。"),
    ).toBeInTheDocument();
  });
});
