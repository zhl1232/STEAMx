"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DEFAULT_WELCOME_SETTINGS } from "@/lib/communications/types";
import { PLATFORM_ONBOARDING_HREF } from "@/lib/product/onboarding";
import { resolveSupportHref } from "@/lib/product/support";
import { Button } from "@/components/ui/button";

export function WelcomeActions({ onRead }: { onRead: () => void }) {
  const pathname = usePathname();
  const [contactHref, setContactHref] = useState(DEFAULT_WELCOME_SETTINGS.contact_href);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/welcome", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        if (!controller.signal.aborted) setContactHref(resolveSupportHref(payload.settings?.contact_href));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      {pathname !== PLATFORM_ONBOARDING_HREF ? (
        <Button asChild shape="pill" className="min-h-11 w-full sm:w-auto">
          <Link href={PLATFORM_ONBOARDING_HREF} onClick={onRead}>选一个开始</Link>
        </Button>
      ) : null}
      <p className="text-sm text-muted-foreground">
        有问题？<Link href={contactHref} onClick={onRead} className="ml-1 inline-flex min-h-11 items-center underline underline-offset-4">联系客服</Link>
      </p>
    </div>
  );
}
