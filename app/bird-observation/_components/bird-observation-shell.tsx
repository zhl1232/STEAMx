import type { ReactNode } from "react";

import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { cn } from "@/lib/utils";

interface BirdObservationShellProps {
  title: ReactNode;
  description: ReactNode;
  fallbackHref?: string;
  kicker?: string;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
  mainClassName?: string;
}

export function BirdObservationShell({
  title,
  description,
  fallbackHref = "/explore",
  kicker = "自然观察",
  children,
  aside,
  className,
  mainClassName,
}: BirdObservationShellProps) {
  return (
    <div className={cn("mx-auto flex min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))] w-full max-w-6xl flex-col pb-24", className)}>
      <div className="md:hidden">
        <MobilePageHeader title={title} fallbackHref={fallbackHref} />
      </div>

      <div className="page-shell flex-1 pt-6 md:pt-8">
        <div className="hidden md:block">
          <p className="section-kicker">{kicker}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{description}</p>
        </div>

        <div className="mt-0 grid gap-6 md:mt-8 lg:grid-cols-[minmax(0,1.5fr)_320px]">
          <main className={cn("space-y-6", mainClassName)}>{children}</main>
          {aside ? <aside className="space-y-6">{aside}</aside> : null}
        </div>
      </div>
    </div>
  );
}
