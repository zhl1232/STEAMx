"use client";

import { Suspense, useEffect, useRef, useState, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Check, CloudOff, CloudUpload, HardDrive, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusAlert } from "@/components/ui/status-badge";
import { useAuth } from "@/lib/context/auth-context";
import { usePhysicsLabState } from "@/hooks/physics-lab/use-physics-lab-state";
import { physicsBackupValues, physicsBackupFromValues, type PhysicsBackup } from "@/lib/physics-lab/state";
import { parseNavigation, normalizeNavigation, navigationSearch, NAVIGATION_KEYS } from "@/public/physics-lab/navigation-state.mjs";

function NavigationBridge({ frame }: { frame: RefObject<HTMLIFrameElement | null> }) {
  const searchParams = useSearchParams();
  const search = searchParams?.toString();
  const documentId = useRef<string | null>(null);
  const seenDocuments = useRef(new Set<string>());
  const lastSent = useRef<string | null>(null);

  function sendRoute(force = false) {
    if (!documentId.current) return;
    const route = parseNavigation(window.location.search);
    const signature = `${documentId.current}:${navigationSearch(route)}`;
    if (!force && lastSent.current === signature) return;
    lastSent.current = signature;
    frame.current?.contentWindow?.postMessage({ type: "steamx-physics-navigation-state", version: 1, documentId: documentId.current, route }, window.location.origin);
  }

  useEffect(() => {
    const element = frame.current;
    function requestNavigation() {
      element?.contentWindow?.postMessage({ type: "steamx-physics-navigation-request", version: 1 }, window.location.origin);
    }
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== element?.contentWindow) return;
      const message = event.data;
      if (message?.version !== 1) return;
      if (message.type === "steamx-physics-navigation-ready") {
        if (typeof message.documentId !== "string" || !message.documentId || message.documentId.length > 200) return;
        if (message.documentId !== documentId.current) {
          if (seenDocuments.current.has(message.documentId)) return;
          seenDocuments.current.add(message.documentId);
          documentId.current = message.documentId;
        }
        sendRoute(true);
        return;
      }
      if (message.type !== "steamx-physics-navigate" || !documentId.current || message.documentId !== documentId.current || typeof message.replace !== "boolean") return;
      const route = normalizeNavigation(message.route);
      if (!route) return;
      if (navigationSearch(route) !== navigationSearch(parseNavigation(window.location.search))) {
        const params = new URLSearchParams(window.location.search);
        for (const key of NAVIGATION_KEYS) params.delete(key);
        new URLSearchParams(navigationSearch(route)).forEach((value, key) => params.set(key, value));
        const query = params.toString();
        const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
        // Next's patched native history API copies its router state and syncs search params.
        window.history[message.replace ? "replaceState" : "pushState"](null, "", url);
      }
      sendRoute(true);
    }
    function restoreRoute() { sendRoute(); }
    window.addEventListener("message", receive);
    window.addEventListener("popstate", restoreRoute);
    element?.addEventListener("load", requestNavigation);
    requestNavigation();
    return () => {
      window.removeEventListener("message", receive);
      window.removeEventListener("popstate", restoreRoute);
      element?.removeEventListener("load", requestNavigation);
    };
    // One navigation session belongs to this mounted iframe, independent of storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  useEffect(() => { sendRoute(); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function requestHeight(target: Window | null | undefined) {
  target?.postMessage({ type: "steamx-physics-height-request" }, window.location.origin);
}

function RecordStatus({ state, signedIn }: { state: ReturnType<typeof usePhysicsLabState>; signedIn: boolean }) {
  const statuses = {
    loading: "正在读取实验记录…", local: "记录仅保存在此设备", saved: "记录已同步至当前账号",
    pending: "实验记录等待同步", saving: "正在保存实验记录…", offline: "暂未同步到云端", conflict: "有待合并的实验记录",
  };
  const busy = state.replacing || state.status === "loading" || state.status === "saving";
  const warning = !state.storageAvailable || !!state.error || state.status === "offline" || state.status === "conflict";
  const StatusIcon = !state.storageAvailable ? AlertCircle : busy ? Loader2 : state.status === "offline" ? CloudOff : warning ? AlertCircle : state.status === "saved" ? Check : signedIn ? CloudUpload : HardDrive;
  const title = state.replacing ? "正在合并实验记录…" : !state.storageAvailable ? "设备暂时无法保存记录" : state.error && state.status === "local" ? "实验记录需要处理" : statuses[state.status];
  const description = !state.storageAvailable ? "新记录可能仅保留在当前页面，请及时导出备份。"
    : state.status === "offline" ? "可以继续实验，稍后重试同步。"
    : state.status === "conflict" ? state.error || "设备与云端都有记录，合并后可继续同步。"
    : state.error;
  const content = <>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <StatusIcon aria-hidden className={`h-4 w-4 shrink-0 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} />
        <p className={warning ? "font-medium" : ""}>{title}</p>
      </div>
      {state.status === "offline" && <Button type="button" variant="ghost" size="sm" disabled={busy} className="min-h-11 gap-1.5 px-2" onClick={() => void state.retry()}><RefreshCw aria-hidden className="h-3.5 w-3.5" />重试同步</Button>}
      {signedIn && state.status === "conflict" && <Button disabled={busy} type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void state.mergeCloud()}>合并云端记录</Button>}
    </div>
    {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
    {state.error && (state.status === "offline" || !state.storageAvailable) && <details className="mt-2 text-sm text-muted-foreground"><summary className="w-fit cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">查看详情</summary><p className="mt-1 leading-relaxed">{state.error}</p></details>}
    {(state.legacyAvailable || signedIn && state.guestAvailable) && <div className="mt-2 flex flex-wrap gap-2">
      {state.legacyAvailable && <Button type="button" disabled={!state.ready || busy} variant="outline" size="sm" className="min-h-11" onClick={state.importLegacy}>导入原有本机记录</Button>}
      {signedIn && state.guestAvailable && <Button type="button" disabled={!state.ready || busy} variant="outline" size="sm" className="min-h-11" onClick={state.importGuest}>导入游客记录</Button>}
    </div>}
  </>;
  return <div className="min-w-0 px-4 md:px-6 lg:col-start-2 lg:row-start-1">
    {warning ? <StatusAlert status={!state.storageAvailable ? "danger" : "warning"} className="py-2">{content}</StatusAlert> : <div role="status" className="text-muted-foreground lg:ml-auto lg:w-fit">{content}</div>}
  </div>;
}

function OwnerWorkspace({ ownerId }: { ownerId: string | null }) {
  const state = usePhysicsLabState(ownerId);
  const latest = useRef(state);
  latest.current = state;
  const frame = useRef<HTMLIFrameElement>(null);
  const lastChildRevision = useRef(0);
  const pendingReplacement = useRef<string | null>(null);
  const [height, setHeight] = useState(1100);
  const sessionId = useRef("");
  const documentId = useRef<string | null>(null);
  const seenDocuments = useRef(new Set<string>());
  function initialize(target: Window | null | undefined, data?: PhysicsBackup) {
    if (!latest.current.ready || !documentId.current) return;
    target?.postMessage({ type: "steamx-physics-storage-init", version: 1, sessionId: sessionId.current, documentId: documentId.current, values: physicsBackupValues(data ?? latest.current.data), account: !!ownerId }, window.location.origin);
  }
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const message = event.data;
      if (message?.type === "steamx-physics-height" && typeof message.height === "number" && Number.isFinite(message.height)) {
        setHeight(Math.max(600, Math.min(6000, Math.ceil(message.height))));
      }
      if (message?.version !== 1) return;
      if (message.type === "steamx-physics-storage-ready") {
        if (typeof message.documentId !== "string" || !message.documentId || message.documentId.length > 200) return;
        if (message.documentId === documentId.current) { initialize(frame.current?.contentWindow); return; }
        if (seenDocuments.current.has(message.documentId)) return;
        seenDocuments.current.add(message.documentId);
        documentId.current = message.documentId;
        sessionId.current = crypto.randomUUID();
        lastChildRevision.current = 0;
        pendingReplacement.current = null;
        const data = latest.current.resetDocument();
        initialize(frame.current?.contentWindow, data);
        return;
      }
      if (!documentId.current || message.sessionId !== sessionId.current || !Number.isSafeInteger(message.revision) || message.revision < 0) return;
      try { physicsBackupFromValues(message.values); } catch { return; }
      if (message.type === "steamx-physics-storage-change" && message.revision > lastChildRevision.current) {
        lastChildRevision.current = message.revision;
        pendingReplacement.current = null;
        latest.current.change(message.values);
      }
      if ((message.type === "steamx-physics-storage-replaced" || message.type === "steamx-physics-storage-replace-rejected") && pendingReplacement.current !== null && message.requestId === pendingReplacement.current && message.revision >= lastChildRevision.current) {
        lastChildRevision.current = message.revision;
        pendingReplacement.current = null;
        latest.current.completeReplacement(message.values, message.type === "steamx-physics-storage-replace-rejected");
      }
    }
    window.addEventListener("message", receive);
    requestHeight(frame.current?.contentWindow);
    frame.current?.contentWindow?.postMessage({ type: "steamx-physics-storage-request", version: 1 }, window.location.origin);
    return () => window.removeEventListener("message", receive);
    // Each workspace has one owner and one opaque session for its entire lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ready]);
  useEffect(() => {
    if (!state.replacement || !state.ready || !state.replacing) return;
    const requestId = crypto.randomUUID();
    pendingReplacement.current = requestId;
    frame.current?.contentWindow?.postMessage({ type: "steamx-physics-storage-replace", version: 1, sessionId: sessionId.current, requestId, expectedRevision: lastChildRevision.current, values: physicsBackupValues(state.data), account: !!ownerId }, window.location.origin);
    // Only deliberate import/merge/reconciliation replaces child records; edits do not echo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.replacement, state.replacing]);
  return <>
    <RecordStatus state={state} signedIn={!!ownerId} />
    {state.ready && <Suspense fallback={null}><NavigationBridge frame={frame} /></Suspense>}
    {state.ready ? <iframe ref={frame} src="/physics-lab/index.html?host=steamx" title="物理实验室交互工作台" onLoad={event => { requestHeight(event.currentTarget.contentWindow); event.currentTarget.contentWindow?.postMessage({ type: "steamx-physics-storage-request", version: 1 }, window.location.origin); }} className="col-span-full block w-full min-w-0 border-0" style={{ height }} /> : <p className="col-span-full px-4 py-8" aria-label="正在准备实验记录">正在准备实验记录…</p>}
  </>;
}

export default function PhysicsLabFrame() {
  const { user, loading } = useAuth();
  if (loading) return <p role="status" className="px-4 py-8">正在确认当前账号…</p>;
  return <OwnerWorkspace key={user?.id ?? "guest"} ownerId={user?.id ?? null} />;
}
