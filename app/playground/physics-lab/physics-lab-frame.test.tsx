// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PhysicsLabFrame from "./physics-lab-frame";
import { emptyPhysicsBackup, physicsBackupValues } from "@/lib/physics-lab/state";
import { defaults } from "@/public/physics-lab/exploration-model.mjs";
import { parseNavigation } from "@/public/physics-lab/navigation-state.mjs";

const mocks = vi.hoisted(() => ({
  auth: { user: null, profile: null, loading: false } as { user: { id: string; email?: string } | null; profile: null; loading: boolean },
}));
vi.mock("@/lib/context/auth-context", () => ({ useAuth: () => mocks.auth }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/playground/physics-lab"); mocks.auth = { user: null, profile: null, loading: false }; vi.clearAllMocks(); });

afterEach(() => vi.restoreAllMocks());

function navigationBridge() {
  const view = render(<PhysicsLabFrame />);
  const frame = screen.getByTitle("物理实验室交互工作台") as HTMLIFrameElement;
  const post = vi.spyOn(frame.contentWindow!, "postMessage");
  const send = (data: Record<string, unknown>, source = frame.contentWindow, origin = window.location.origin) => act(() => window.dispatchEvent(new MessageEvent("message", { source, origin, data: { version: 1, documentId: "navigation-a", ...data } })));
  const states = () => post.mock.calls.filter(([data]) => data.type === "steamx-physics-navigation-state").map(([data]) => data);
  return { ...view, frame, post, send, states };
}

it("initializes navigation from the current URL and recovers a repeated ready handshake", () => {
  window.history.replaceState(null, "", "/playground/physics-lab?experiment=sound&stage=primary&topic=sound&q=hello&page=2");
  const bridge = navigationBridge();
  bridge.send({ type: "steamx-physics-navigation-ready" });
  expect(bridge.states().at(-1)).toEqual({ type: "steamx-physics-navigation-state", version: 1, documentId: "navigation-a", route: parseNavigation(window.location.search) });
  window.history.replaceState(null, "", "/playground/physics-lab?experiment=optics");
  bridge.send({ type: "steamx-physics-navigation-ready" });
  expect(bridge.states().at(-1).route.experiment).toBe("optics");
});

it("rejects forged, malformed and stale navigation traffic", () => {
  const bridge = navigationBridge();
  const ready = { type: "steamx-physics-navigation-ready" };
  bridge.send(ready, window);
  bridge.send(ready, bridge.frame.contentWindow, "https://unrelated.example");
  bridge.send({ ...ready, version: 2 });
  bridge.send({ ...ready, documentId: "" });
  expect(bridge.states()).toHaveLength(0);
  const navigate = { type: "steamx-physics-navigate", route: parseNavigation("?experiment=sound"), replace: false };
  bridge.send(navigate);
  expect(window.location.search).toBe("");
  bridge.send(ready);
  bridge.send({ ...ready, documentId: "navigation-b" });
  const count = bridge.states().length;
  bridge.send(ready);
  bridge.send(navigate);
  bridge.send({ ...navigate, documentId: "navigation-b", route: { experiment: "invalid" } });
  bridge.send({ ...navigate, documentId: "navigation-b", replace: "yes" });
  bridge.send({ ...navigate, documentId: "navigation-b" }, window);
  bridge.send({ ...navigate, documentId: "navigation-b" }, bridge.frame.contentWindow, "https://unrelated.example");
  expect(window.location.search).toBe("");
  expect(bridge.states()).toHaveLength(count);
});

it("pushes or replaces public routes without remounting the frame or duplicating history", () => {
  window.history.replaceState(null, "", "/playground/physics-lab?source=playground#lab");
  const bridge = navigationBridge();
  const src = bridge.frame.src;
  bridge.send({ type: "steamx-physics-storage-ready", documentId: "storage-a" });
  bridge.send({ type: "steamx-physics-navigation-ready" });
  const push = vi.spyOn(window.history, "pushState");
  const replace = vi.spyOn(window.history, "replaceState");
  const route = parseNavigation("?experiment=sound&stage=primary&topic=sound");
  bridge.send({ type: "steamx-physics-navigate", route, replace: false });
  expect(push).toHaveBeenCalledTimes(1);
  expect(new URLSearchParams(window.location.search).get("source")).toBe("playground");
  expect(window.location.hash).toBe("#lab");
  expect(bridge.states().at(-1).route).toEqual(route);
  bridge.send({ type: "steamx-physics-navigate", route, replace: false });
  expect(push).toHaveBeenCalledTimes(1);
  bridge.send({ type: "steamx-physics-navigate", route: { ...route, query: "changed" }, replace: true });
  expect(replace).toHaveBeenCalledTimes(1);
  bridge.rerender(<PhysicsLabFrame />);
  expect(screen.getByTitle("物理实验室交互工作台")).toBe(bridge.frame);
  expect(bridge.frame.src).toBe(src);
  expect(localStorage.getItem("steamx:physics-state:guest")).toBeNull();
  expect(bridge.post.mock.calls.filter(([data]) => data.type === "steamx-physics-storage-init")).toHaveLength(1);
});

it("requests a fresh navigation handshake after an iframe document loads", () => {
  const bridge = navigationBridge();
  bridge.send({ type: "steamx-physics-navigation-ready" });
  fireEvent.load(bridge.frame);
  expect(bridge.post).toHaveBeenCalledWith({ type: "steamx-physics-navigation-request", version: 1 }, window.location.origin);
  bridge.send({ type: "steamx-physics-navigation-ready", documentId: "navigation-b" });
  expect(bridge.states().at(-1).documentId).toBe("navigation-b");
});

it("restores popstate and client query changes without echoing duplicate route messages", () => {
  const bridge = navigationBridge();
  bridge.send({ type: "steamx-physics-navigation-ready" });
  window.history.replaceState(null, "", "/playground/physics-lab?experiment=sound");
  act(() => window.dispatchEvent(new PopStateEvent("popstate")));
  expect(bridge.states().at(-1).route.experiment).toBe("sound");
  const count = bridge.states().length;
  bridge.rerender(<PhysicsLabFrame />);
  expect(bridge.states()).toHaveLength(count);
  window.history.replaceState(null, "", "/playground/physics-lab?experiment=circuit&lesson=divider");
  bridge.rerender(<PhysicsLabFrame />);
  expect(bridge.states().at(-1).route).toMatchObject({ experiment: "circuit", lesson: "divider" });
  bridge.unmount();
  const afterUnmount = bridge.states().length;
  act(() => window.dispatchEvent(new PopStateEvent("popstate")));
  expect(bridge.states()).toHaveLength(afterUnmount);
});

it("only accepts finite, bounded heights from the embedded lab on the same origin", () => {
  render(<PhysicsLabFrame />);
  const frame = screen.getByTitle("物理实验室交互工作台") as HTMLIFrameElement;
  const send = (height: unknown, origin = window.location.origin, source = frame.contentWindow) => {
    act(() => window.dispatchEvent(new MessageEvent("message", {
      origin, source, data: { type: "steamx-physics-height", height },
    })));
  };
  send(900); expect(frame.style.height).toBe("900px");
  send(1200, "https://unrelated.example"); expect(frame.style.height).toBe("900px");
  send(1200, window.location.origin, window); expect(frame.style.height).toBe("900px");
  send(Infinity); send("1200"); expect(frame.style.height).toBe("900px");
  send(1); expect(frame.style.height).toBe("600px");
  send(100000); expect(frame.style.height).toBe("6000px");
});

it("recovers an early height report on mount and resizes after a later iframe load", () => {
  let height = 980;
  const child = {
    postMessage(data: { type: string }, targetOrigin: string) {
      if (data.type !== "steamx-physics-height-request" || targetOrigin !== window.location.origin) return;
      window.dispatchEvent(new MessageEvent("message", {
        origin: window.location.origin,
        source: child,
        data: { type: "steamx-physics-height", height },
      }));
    },
  } as unknown as Window;
  vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(child);

  const { unmount } = render(<PhysicsLabFrame />);
  const frame = screen.getByTitle("物理实验室交互工作台") as HTMLIFrameElement;
  expect(frame.style.height).toBe("980px");
  height = 1550;
  fireEvent.load(frame);
  expect(frame.style.height).toBe("1550px");
  unmount();
});

it("keeps the iframe unmounted while authentication is loading", () => {
  mocks.auth.loading = true;
  render(<PhysicsLabFrame />);
  expect(screen.queryByTitle("物理实验室交互工作台")).toBeNull();
  expect(screen.queryByText("当前为游客")).toBeNull();
});

it("uses the main account for records without duplicating its account and badge controls", async () => {
  mocks.auth.user = { id: "account-a", email: "learner@example.com" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ownerId: "account-a", revision: 0, data: null }) }));
  render(<PhysicsLabFrame />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(screen.getByTitle("物理实验室交互工作台")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("记录已同步至当前账号");
  expect(screen.queryByText(/^当前账号：|^等级 /)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "我的徽章" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "登录并同步记录" })).not.toBeInTheDocument();
  vi.unstubAllGlobals();
});

it("shows one actionable offline notice and retries without replacing the experiment frame", async () => {
  mocks.auth.user = { id: "account-a" };
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValue({ ok: true, json: async () => ({ ownerId: "account-a", revision: 0, data: null }) });
  vi.stubGlobal("fetch", fetch);
  render(<PhysicsLabFrame />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  const frame = screen.getByTitle("物理实验室交互工作台");
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByRole("alert")).toHaveTextContent("暂未同步到云端");
  expect(screen.getByRole("alert")).toHaveTextContent("可以继续实验，稍后重试同步。");
  expect(screen.getByText("查看详情").closest("details")).not.toHaveAttribute("open");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "重试同步" })); });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByTitle("物理实验室交互工作台")).toBe(frame);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  vi.unstubAllGlobals();
});

it("keeps the export warning visible when device storage cannot be used", () => {
  localStorage.setItem("steamx:physics-state:guest", "invalid cache");
  render(<PhysicsLabFrame />);
  expect(screen.getByRole("alert")).toHaveTextContent("设备暂时无法保存记录");
  expect(screen.getByRole("alert")).toHaveTextContent("请及时导出备份");
  expect(screen.queryByText("记录仅保存在此设备")).not.toBeInTheDocument();
});

it("initializes the storage bridge and rejects spoofed change messages", () => {
  render(<PhysicsLabFrame />);
  const frame = screen.getByTitle("物理实验室交互工作台") as HTMLIFrameElement;
  const post = vi.spyOn(frame.contentWindow!, "postMessage");
  const send = (data: unknown, source = frame.contentWindow, origin = window.location.origin) => act(() => { window.dispatchEvent(new MessageEvent("message", { source, origin, data })); });
  send({ type: "steamx-physics-storage-ready", version: 1, documentId: "doc-a" });
  const init = post.mock.calls.find(([data]) => data.type === "steamx-physics-storage-init")![0];
  expect(init).toMatchObject({ account: false, version: 1, sessionId: expect.any(String) });
  const change = { type: "steamx-physics-storage-change", version: 1, sessionId: init.sessionId, values: init.values };
  send(change, window);
  send(change, frame.contentWindow, "https://unrelated.example");
  send({ ...change, sessionId: "old-account-session" });
  expect(localStorage.getItem("steamx:physics-state:guest")).toBeNull();
});

it("remounts on account exit and refuses the previous frame's messages", async () => {
  mocks.auth.user = { id: "account-a" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ownerId: "account-a", revision: 0, data: null }) }));
  const view = render(<PhysicsLabFrame />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  const old = screen.getByTitle("物理实验室交互工作台") as HTMLIFrameElement;
  const oldWindow = old.contentWindow;
  mocks.auth.user = null;
  view.rerender(<PhysicsLabFrame />);
  const guest = screen.getByTitle("物理实验室交互工作台") as HTMLIFrameElement;
  expect(guest).not.toBe(old);
  act(() => window.dispatchEvent(new MessageEvent("message", { source: oldWindow, origin: window.location.origin, data: { type: "steamx-physics-height", height: 4000 } })));
  expect(guest.style.height).toBe("1100px");
  vi.unstubAllGlobals();
});


function observationValues(id: string) {
  return physicsBackupValues({ ...emptyPhysicsBackup(), observations: [{ id, experiment: "sound", params: defaults("sound"), time: 0, note: id, at: "today", level: 0 }] });
}
function legacyBridge() {
  Object.entries(observationValues("legacy")).forEach(([key, value]) => localStorage.setItem(key, value!));
  render(<PhysicsLabFrame />);
  const frame = screen.getByTitle("物理实验室交互工作台") as HTMLIFrameElement;
  const post = vi.spyOn(frame.contentWindow!, "postMessage");
  const send = (data: Record<string, unknown>) => act(() => window.dispatchEvent(new MessageEvent("message", { source: frame.contentWindow, origin: window.location.origin, data: { version: 1, ...data } })));
  send({ type: "steamx-physics-storage-ready", documentId: "doc-a" });
  const init = post.mock.calls.find(([data]) => data.type === "steamx-physics-storage-init")![0];
  return { post, send, sessionId: init.sessionId };
}

it("fences replacements against the latest child revision and accepts only the matching acknowledgment", () => {
  const bridge = legacyBridge();
  bridge.send({ type: "steamx-physics-storage-change", sessionId: bridge.sessionId, revision: 1, values: observationValues("child") });
  fireEvent.click(screen.getByRole("button", { name: "导入原有本机记录" }));
  const replacement = bridge.post.mock.calls.find(([data]) => data.type === "steamx-physics-storage-replace")![0];
  expect(replacement).toMatchObject({ expectedRevision: 1, requestId: expect.any(String) });
  bridge.send({ type: "steamx-physics-storage-replaced", sessionId: bridge.sessionId, requestId: "stale-request", revision: 2, values: replacement.values });
  expect(screen.getByText("正在合并实验记录…")).toBeInTheDocument();
  bridge.send({ type: "steamx-physics-storage-replaced", sessionId: bridge.sessionId, requestId: replacement.requestId, revision: 2, values: replacement.values });
  expect(screen.queryByText("正在合并实验记录…")).toBeNull();
  expect(JSON.parse(localStorage.getItem("steamx:physics-state:guest")!).data.observations).toHaveLength(2);
});

it("retains child edits when a replacement is rejected and ignores a stale acknowledgment", () => {
  const bridge = legacyBridge();
  fireEvent.click(screen.getByRole("button", { name: "导入原有本机记录" }));
  const replacement = bridge.post.mock.calls.find(([data]) => data.type === "steamx-physics-storage-replace")![0];
  bridge.send({ type: "steamx-physics-storage-replace-rejected", sessionId: bridge.sessionId, requestId: replacement.requestId, revision: 1, values: observationValues("latest") });
  bridge.send({ type: "steamx-physics-storage-replaced", sessionId: bridge.sessionId, requestId: replacement.requestId, revision: 2, values: replacement.values });
  expect(screen.getByText(/合并期间实验有新修改/)).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("steamx:physics-state:guest")!).data.observations[0].id).toBe("latest");
});

it("cancels a pending replacement for a queued child change and ignores older revision messages", () => {
  const bridge = legacyBridge();
  fireEvent.click(screen.getByRole("button", { name: "导入原有本机记录" }));
  bridge.send({ type: "steamx-physics-storage-change", sessionId: bridge.sessionId, revision: 2, values: observationValues("queued-newer") });
  bridge.send({ type: "steamx-physics-storage-change", sessionId: bridge.sessionId, revision: 1, values: observationValues("stale") });
  expect(screen.getByText(/合并期间实验有新修改/)).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("steamx:physics-state:guest")!).data.observations[0].id).toBe("queued-newer");
});


it("rotates the session after a document reload, accepts its first edit, and rejects old-document traffic", () => {
  const bridge = legacyBridge();
  bridge.send({ type: "steamx-physics-storage-change", sessionId: bridge.sessionId, revision: 8, values: observationValues("old-document") });
  bridge.send({ type: "steamx-physics-storage-ready", documentId: "doc-a" });
  const firstInits = bridge.post.mock.calls.filter(([data]) => data.type === "steamx-physics-storage-init");
  expect(firstInits.at(-1)![0].sessionId).toBe(bridge.sessionId);
  bridge.send({ type: "steamx-physics-storage-ready", documentId: "doc-b" });
  const newInit = bridge.post.mock.calls.filter(([data]) => data.type === "steamx-physics-storage-init").at(-1)![0];
  expect(newInit.sessionId).not.toBe(bridge.sessionId);
  expect(newInit.documentId).toBe("doc-b");
  bridge.send({ type: "steamx-physics-storage-change", sessionId: newInit.sessionId, revision: 1, values: observationValues("new-document") });
  bridge.send({ type: "steamx-physics-storage-change", sessionId: bridge.sessionId, revision: 99, values: observationValues("late-old-document") });
  const calls = bridge.post.mock.calls.length;
  bridge.send({ type: "steamx-physics-storage-ready", documentId: "doc-a" });
  expect(bridge.post.mock.calls).toHaveLength(calls);
  expect(JSON.parse(localStorage.getItem("steamx:physics-state:guest")!).data.observations[0].id).toBe("new-document");
});

it("cancels a staged replacement on document reload and initializes from the actual premerge snapshot", () => {
  const bridge = legacyBridge();
  bridge.send({ type: "steamx-physics-storage-change", sessionId: bridge.sessionId, revision: 1, values: observationValues("actual-child") });
  fireEvent.click(screen.getByRole("button", { name: "导入原有本机记录" }));
  const replacement = bridge.post.mock.calls.find(([data]) => data.type === "steamx-physics-storage-replace")![0];
  bridge.send({ type: "steamx-physics-storage-ready", documentId: "doc-b" });
  const init = bridge.post.mock.calls.filter(([data]) => data.type === "steamx-physics-storage-init").at(-1)![0];
  expect(init.values).toEqual(observationValues("actual-child"));
  bridge.send({ type: "steamx-physics-storage-replaced", sessionId: bridge.sessionId, requestId: replacement.requestId, revision: 2, values: replacement.values });
  expect(JSON.parse(localStorage.getItem("steamx:physics-state:guest")!).data.observations).toHaveLength(1);
});
