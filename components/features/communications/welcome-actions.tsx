"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_WELCOME_SETTINGS } from "@/lib/communications/types";
import { isSafeInternalHref } from "@/lib/utils/safe-internal-href";
import { Button } from "@/components/ui/button";

export function WelcomeActions({ onRead }: { onRead: () => void }) {
  const [contactHref, setContactHref] = useState(
    DEFAULT_WELCOME_SETTINGS.contact_href,
  );
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/welcome", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        const href = payload.settings?.contact_href;
        if (
          !controller.signal.aborted &&
          typeof href === "string" &&
          isSafeInternalHref(href)
        )
          setContactHref(href);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href="/start" onClick={onRead}>
            查看探索指南
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={contactHref} onClick={onRead}>
            联系客服 / 申请入群
          </Link>
        </Button>
      </div>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        家长或老师添加客服时，请备注「入群」。
      </p>
    </div>
  );
}
