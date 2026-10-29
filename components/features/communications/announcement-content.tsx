"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Announcement } from "@/lib/communications/types";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/auth-context";
import { useOptionalNotifications } from "@/lib/context/notification-context";

const levelLabel = {
  normal: "通知",
  important: "重要",
  urgent: "紧急",
} as const;

export function AnnouncementCard({
  announcement,
}: {
  announcement: Announcement;
}) {
  const withdrawn = announcement.status === "withdrawn";
  return (
    <article className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
          {levelLabel[announcement.level]}
        </span>
        <time dateTime={announcement.published_at || announcement.created_at}>
          {new Date(
            announcement.published_at || announcement.created_at,
          ).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}
        </time>
        {withdrawn ? (
          <span className="rounded-full bg-muted px-2.5 py-1">已撤回</span>
        ) : null}
      </div>
      <h2 className="mt-3 text-lg font-semibold tracking-tight">
        {announcement.title}
      </h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        {withdrawn ? "这条公告已撤回。" : announcement.summary}
      </p>
      {!withdrawn ? (
        <Link
          className="mt-4 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          href={`/announcements/${announcement.id}`}
        >
          查看详情
        </Link>
      ) : null}
    </article>
  );
}

export function AnnouncementList() {
  const [items, setItems] = useState<Announcement[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const load = () => {
    setLoading(true);
    setError(false);
    fetch("/api/announcements")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p) => setItems(p?.announcements || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  return (
    <div className="app-shell-narrow py-8">
      <div className="min-w-0">
        <p className="section-kicker">创探空间</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">公告</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          了解平台的新功能、活动与学习提醒。
        </p>
        <div className="mt-8 space-y-4">
          {loading ? (
            <div className="surface-subtle p-10 text-center text-sm text-muted-foreground">
              公告加载中…
            </div>
          ) : error ? (
            <div className="surface-subtle p-10 text-center">
              <p className="text-sm text-muted-foreground">公告加载失败。</p>
              <Button className="mt-4" variant="outline" onClick={load}>
                重试
              </Button>
            </div>
          ) : items.length ? (
            items.map((item) => (
              <AnnouncementCard key={item.id} announcement={item} />
            ))
          ) : (
            <div className="surface-subtle p-10 text-center text-sm text-muted-foreground">
              暂时没有公告。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnnouncementDetail({
  announcement,
}: {
  announcement: Announcement;
}) {
  const { user } = useAuth();
  const { refreshUnreadCount } = useOptionalNotifications();
  const withdrawn = announcement.status === "withdrawn";
  const expired = Boolean(
    announcement.expires_at &&
      new Date(announcement.expires_at).getTime() < Date.now(),
  );
  useEffect(() => {
    if (!user || withdrawn) return;
    let cancelled = false;
    fetch(`/api/announcements/${announcement.id}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read" }),
    })
      .then((response) => {
        if (response.ok && !cancelled) return refreshUnreadCount();
      })
      .catch(() => {})
      .finally(() => {
        cancelled = true;
      });
    return () => {
      cancelled = true;
    };
  }, [announcement.id, user, withdrawn, refreshUnreadCount]);
  return (
    <div className="app-shell-narrow py-8">
      <article className="surface-panel p-6 sm:p-10">
        <Link
          href="/announcements"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 返回公告
        </Link>
        <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
            {withdrawn
              ? "已撤回"
              : expired
                ? "已结束"
                : levelLabel[announcement.level]}
          </span>
          <time dateTime={announcement.published_at || announcement.created_at}>
            {new Date(
              announcement.published_at || announcement.created_at,
            ).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}
          </time>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {announcement.title}
        </h1>
        {withdrawn ? (
          <p className="mt-6 text-muted-foreground">
            这条公告已撤回，正文和操作入口已不可用。
          </p>
        ) : (
          <>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {announcement.summary}
            </p>
            <div className="prose prose-sm mt-8 max-w-none leading-8 text-foreground/85">
              <ReactMarkdown>{announcement.body}</ReactMarkdown>
            </div>
            {expired ? (
              <p className="mt-8 text-sm text-muted-foreground">
                这条公告已结束，操作入口已关闭。
              </p>
            ) : announcement.action_href && announcement.action_label ? (
              <Button asChild className="mt-8">
                <Link href={announcement.action_href}>
                  {announcement.action_label}
                </Link>
              </Button>
            ) : null}
          </>
        )}
      </article>
    </div>
  );
}
