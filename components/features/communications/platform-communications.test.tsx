import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformCommunications } from "./platform-communications";

let currentUser: { id: string } | null = { id: "u1" };
let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/context/auth-context", () => ({
  useAuth: () => ({ user: currentUser }),
}));
vi.mock("@/lib/context/notification-context", () => ({
  useOptionalNotifications: () => ({ refreshUnreadCount: vi.fn() }),
}));

const notice = {
  id: 1,
  title: "紧急维护",
  summary: "今晚维护",
  body: "",
  level: "urgent",
  status: "published",
  published_at: "2026-09-21T00:00:00Z",
  created_at: "2026-09-21T00:00:00Z",
};
function setupFetch(
  claim: boolean | Promise<Response> = true,
  level = "urgent",
) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/active"))
      return Response.json({ announcements: [{ ...notice, level }] });
    if (url.includes("/state"))
      return typeof claim === "boolean"
        ? Response.json({ claimed: claim })
        : claim;
    return Response.json({ created: false });
  });
}

describe("PlatformCommunications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    currentUser = { id: "u1" };
    pathname = "/";
    sessionStorage.clear();
  });
  it("does not open a popup when the server refuses the atomic claim", async () => {
    const fetchMock = setupFetch(false);
    render(<PlatformCommunications />);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("/state")),
      ).toBe(true),
    );
    await act(async () => {});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "平台公告" }),
    ).toBeInTheDocument();
  });
  it("opens a claimed popup and suppresses another popup after remount in the same session", async () => {
    const fetchMock = setupFetch();
    const first = render(<PlatformCommunications />);
    expect(await screen.findByRole("dialog")).toHaveTextContent("紧急维护");
    fireEvent.click(screen.getByRole("button", { name: "稍后查看" }));
    first.unmount();
    render(<PlatformCommunications />);
    await screen.findByRole("complementary", { name: "平台公告" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("/state")),
    ).toHaveLength(1);
  });
  it("does not let a slow claim open after navigating into a lesson", async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((done) => {
      resolve = done;
    });
    const fetchMock = setupFetch(pending);
    const view = render(<PlatformCommunications />);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("/state")),
      ).toBe(true),
    );
    pathname = "/courses/1/lessons/2";
    view.rerender(<PlatformCommunications />);
    await act(async () => resolve(Response.json({ claimed: true })));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("does not let a prior account claim appear for the next account", async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = setupFetch(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    const view = render(<PlatformCommunications />);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("/state")),
      ).toBe(true),
    );
    currentUser = null;
    view.rerender(<PlatformCommunications />);
    await act(async () => resolve(Response.json({ claimed: true })));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps ordinary notices out of banners and popups", async () => {
    const fetchMock = setupFetch(true, "normal");
    render(<PlatformCommunications />);
    await act(async () => {});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("/state")),
    ).toBe(false);
  });
  it("waits while another dialog is open", async () => {
    const blocker = document.createElement("div");
    blocker.setAttribute("role", "dialog");
    document.body.appendChild(blocker);
    const fetchMock = setupFetch();
    render(<PlatformCommunications />);
    await screen.findByRole("complementary", { name: "平台公告" });
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("/state")),
    ).toBe(false);
    act(() => blocker.remove());
    expect(await screen.findByRole("dialog")).toHaveTextContent("紧急维护");
  });
  it("bounds failed welcome retries within each one-minute refresh cycle", async () => {
    vi.useFakeTimers();
    const requests = vi.spyOn(global, "fetch").mockImplementation(async () =>
      Response.json({ error: "service unavailable" }, { status: 500 }),
    );
    const view = render(<PlatformCommunications />);
    const count = (path: string) => requests.mock.calls.filter(([url]) => String(url) === path).length;
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
      expect(count("/api/welcome")).toBe(3);
      expect(count("/api/announcements/active")).toBe(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(54_000); });
      expect(count("/api/welcome")).toBe(3);
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      expect(count("/api/welcome")).toBe(4);
      expect(count("/api/announcements/active")).toBe(2);
    } finally {
      view.unmount();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
