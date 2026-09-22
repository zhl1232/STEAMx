"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AnnouncementDetail } from "@/components/features/communications/announcement-content";
import type { Announcement } from "@/lib/communications/types";
export default function AnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setAnnouncement(null);
    setLoading(true);
    setError(false);
    fetch(`/api/announcements/${id}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((p) => {
        if (!controller.signal.aborted)
          setAnnouncement(p?.announcement || null);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);
  if (loading)
    return (
      <div className="page-shell py-20 text-center text-muted-foreground">
        公告加载中…
      </div>
    );
  if (error || !announcement)
    return (
      <div className="page-shell py-20 text-center">
        <p className="text-muted-foreground">公告不存在或已下线。</p>
        <Link
          className="mt-4 inline-block text-primary underline"
          href="/announcements"
        >
          返回公告
        </Link>
      </div>
    );
  return <AnnouncementDetail announcement={announcement} />;
}
