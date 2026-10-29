"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/auth-context";
import { useOptionalNotifications } from "@/lib/context/notification-context";
import type { Announcement } from "@/lib/communications/types";

type ActiveAnnouncement = Announcement & {
  banner_dismissed?: boolean;
  popup_shown?: boolean;
};
const SAFE_ROUTES = new Set([
  "/",
  "/start",
  "/profile",
  "/messages",
  "/courses",
  "/explore",
  "/nature",
  "/playground",
  "/pbl",
]);
const levelRank = { normal: 0, important: 1, urgent: 2 };
function stored(key: string) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function remember(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* private browsing: component memory still applies */
  }
}
function hasInterruption() {
  return (
    document.visibilityState === "hidden" ||
    Boolean(
      document.querySelector(
        '[role="dialog"]:not([data-platform-announcement]), [role="alertdialog"]',
      ),
    ) ||
    Boolean(
      document.activeElement?.matches(
        'input, textarea, select, [contenteditable="true"]',
      ),
    ) ||
    Boolean(
      window.visualViewport &&
        window.visualViewport.height < window.innerHeight * 0.75,
    )
  );
}

export function PlatformCommunications() {
  const { user } = useAuth();
  const pathname = usePathname();
  const userId = user?.id;
  const owner = userId ?? "guest";
  const scope = `${owner}:${pathname}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const { refreshUnreadCount } = useOptionalNotifications();
  const refreshRef = useRef(refreshUnreadCount);
  refreshRef.current = refreshUnreadCount;
  const [snapshot, setSnapshot] = useState<{
    owner: string;
    items: ActiveAnnouncement[];
  }>({ owner: "", items: [] });
  const [popup, setPopup] = useState<{
    owner: string;
    notice: ActiveAnnouncement;
  } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [safe, setSafe] = useState(false);
  const [revision, setRevision] = useState(0);
  const welcomed = useRef(new Set<string>());
  const shown = useRef(new Set<string>());
  const claiming = useRef(new Set<string>());
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    const check = () => {
      const eligible = SAFE_ROUTES.has(pathname) && !hasInterruption();
      setSafe(eligible);
      if (!eligible) setPopup(null);
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "aria-modal"],
    });
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    document.addEventListener("visibilitychange", check);
    window.visualViewport?.addEventListener("resize", check);
    check();
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
      document.removeEventListener("visibilitychange", check);
      window.visualViewport?.removeEventListener("resize", check);
    };
  }, [pathname]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "hidden")
        setRevision((value) => value + 1);
    };
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/announcements/active", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        if (controller.signal.aborted || scopeRef.current !== scope) return;
        const items = (payload.announcements ?? []) as ActiveAnnouncement[];
        setSnapshot({ owner, items });
        setPopup((current) =>
          current &&
          current.owner === owner &&
          items.some((item) => item.id === current.notice.id)
            ? current
            : null,
        );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [scope, owner, revision]);

  useEffect(() => {
    if (!userId || welcomed.current.has(userId)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const initialize = async (attempt = 0) => {
      try {
        const response = await fetch("/api/welcome", { method: "POST" });
        if (!response.ok) throw new Error("welcome initialization failed");
        const payload = await response.json();
        if (cancelled) return;
        welcomed.current.add(userId);
        if (payload.created) await refreshRef.current();
      } catch {
        if (!cancelled && attempt < 2)
          timer = setTimeout(
            () => void initialize(attempt + 1),
            1500 * (attempt + 1),
          );
      }
    };
    void initialize();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, revision]);

  const active =
    snapshot.owner === owner
      ? snapshot.items
          .filter(
            (item) =>
              item.status === "published" &&
              (!item.expires_at || Date.parse(item.expires_at) > Date.now()),
          )
          .sort(
            (a, b) =>
              levelRank[b.level] - levelRank[a.level] ||
              Date.parse(b.published_at ?? b.created_at) -
                Date.parse(a.published_at ?? a.created_at),
          )
      : [];
  const banner = active.find(
    (item) =>
      item.level !== "normal" &&
      !item.banner_dismissed &&
      !dismissed.has(`${owner}:${item.id}`),
  );
  const urgent = active.find(
    (item) => item.level === "urgent" && !item.popup_shown,
  );

  useEffect(() => {
    if (
      !userId ||
      !urgent ||
      !safe ||
      popup ||
      shown.current.has(userId) ||
      stored(`announcement-popup:${userId}`)
    )
      return;
    const claimKey = `${userId}:${urgent.id}`;
    if (claiming.current.has(claimKey) || attempted.current.has(claimKey))
      return;
    claiming.current.add(claimKey);
    void fetch(`/api/announcements/${urgent.id}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim_popup" }),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        attempted.current.add(claimKey);
        if (!payload.claimed || scopeRef.current !== scope || hasInterruption())
          return;
        shown.current.add(userId);
        remember(`announcement-popup:${userId}`);
        setPopup({ owner, notice: urgent });
      })
      .catch(() => {})
      .finally(() => claiming.current.delete(claimKey));
  }, [
    userId,
    urgent?.id,
    urgent?.popup_shown,
    safe,
    scope,
    owner,
    popup,
    revision,
  ]);

  useEffect(() => {
    if (userId || snapshot.owner !== "guest") return;
    const ids = snapshot.items
      .filter((item) => stored(`announcement-banner:${item.id}`))
      .map((item) => `guest:${item.id}`);
    if (ids.length) setDismissed((current) => new Set([...current, ...ids]));
  }, [snapshot, userId]);

  const dismissBanner = async (notice: ActiveAnnouncement) => {
    const key = `${owner}:${notice.id}`;
    setDismissed((current) => new Set([...current, key]));
    if (!userId) {
      remember(`announcement-banner:${notice.id}`);
      return;
    }
    try {
      const response = await fetch(`/api/announcements/${notice.id}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_banner" }),
      });
      if (!response.ok) throw new Error("dismiss failed");
    } catch {
      // Keep the current-page dismissal, the server state will be checked again on the next visit.
    }
  };
  const currentPopup =
    popup?.owner === owner && SAFE_ROUTES.has(pathname) ? popup.notice : null;
  return (
    <>
      {banner ? (
        <div className="app-shell-wide pt-3">
          <aside
            aria-label="平台公告"
            className="flex items-center gap-3 rounded-md border border-border bg-muted/60 px-3 py-2 text-sm"
          >
            <Link
              href={`/announcements/${banner.id}`}
              className="min-w-0 flex-1 leading-6 hover:underline"
            >
              <span className="font-medium">{banner.title}</span>
              <span className="ml-3 whitespace-nowrap text-primary">
                查看详情
              </span>
            </Link>
            <button
              type="button"
              aria-label="关闭公告"
              onClick={() => void dismissBanner(banner)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </aside>
        </div>
      ) : null}
      <Dialog
        open={Boolean(currentPopup)}
        onOpenChange={(open) => {
          if (!open) setPopup(null);
        }}
      >
        <DialogContent
          data-platform-announcement
          size="sm"
          className="w-[calc(100%_-_2rem)] max-w-md rounded-xl"
        >
          <DialogHeader>
            <DialogTitle>{currentPopup?.title}</DialogTitle>
            <DialogDescription>{currentPopup?.summary}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPopup(null)}>
              稍后查看
            </Button>
            <Button asChild>
              <Link
                href={
                  currentPopup
                    ? `/announcements/${currentPopup.id}`
                    : "/announcements"
                }
                onClick={() => setPopup(null)}
              >
                查看公告详情
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
