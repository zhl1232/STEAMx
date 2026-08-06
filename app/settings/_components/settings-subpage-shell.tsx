import type { ReactNode } from "react";

import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { cn } from "@/lib/utils";

interface SettingsSubpageShellProps {
  title: ReactNode;
  fallbackHref?: string;
  kicker?: string;
  description?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
  mainClassName?: string;
}

export function SettingsSubpageShell({
  title,
  fallbackHref = "/settings",
  kicker,
  description,
  children,
  aside,
  className,
  mainClassName,
}: SettingsSubpageShellProps) {
  return (
    <div className={cn("mx-auto flex min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))] w-full max-w-5xl flex-col pb-24", className)}>
      <div className="md:hidden">
        <MobilePageHeader title={title} fallbackHref={fallbackHref} />
      </div>

      <div className="page-shell flex-1 pt-4 md:pt-8">
        {(kicker || description) ? (
          <div className="mb-5 px-1 md:hidden">
            {kicker ? <p className="section-kicker">{kicker}</p> : null}
            {description ? (
              <p className={cn("text-sm leading-6 text-muted-foreground", kicker && "mt-2")}>{description}</p>
            ) : null}
          </div>
        ) : null}

        <div className="hidden md:block">
          {kicker ? <p className="section-kicker">{kicker}</p> : null}
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <div className={cn("mt-0 grid gap-6 md:mt-8", aside ? "lg:grid-cols-[minmax(0,1.35fr)_320px]" : undefined)}>
          <section className={cn("surface-panel p-4 sm:p-6", mainClassName)}>{children}</section>
          {aside ? <aside className="space-y-6">{aside}</aside> : null}
        </div>
      </div>
    </div>
  );
}
