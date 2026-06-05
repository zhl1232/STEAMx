import type { ReactNode } from "react";

import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { cn } from "@/lib/utils";

interface NatureShellProps {
  title: ReactNode;
  description: ReactNode;
  fallbackHref?: string;
  kicker?: string;
  children: ReactNode;
  aside?: ReactNode;
  variant?: "default" | "wide";
  showDesktopIntro?: boolean;
  className?: string;
  contentClassName?: string;
  mainClassName?: string;
}

export function NatureShell({
  title,
  description,
  fallbackHref = "/nature",
  kicker = "自然观察",
  children,
  aside,
  variant = "default",
  showDesktopIntro = true,
  className,
  contentClassName,
  mainClassName,
}: NatureShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))] w-full flex-col pb-24",
        variant === "wide" ? "max-w-none" : "max-w-6xl",
        className,
      )}
    >
      <div className="md:hidden">
        <MobilePageHeader title={title} fallbackHref={fallbackHref} />
      </div>

      <div
        className={cn(
          variant === "wide"
            ? "app-shell-wide flex-1 px-4 pt-5 md:px-8 md:pt-8"
            : "page-shell flex-1 pt-6 md:pt-8",
          contentClassName,
        )}
      >
        {showDesktopIntro ? (
          <div className="hidden md:block">
            <p className="section-kicker">{kicker}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{description}</p>
          </div>
        ) : null}

        <div
          className={cn(
            "mt-0 grid grid-cols-1 gap-6",
            showDesktopIntro ? "md:mt-8" : "md:mt-0",
            aside ? "lg:grid-cols-[minmax(0,1.5fr)_320px]" : "lg:grid-cols-1",
          )}
        >
          <main className={cn("min-w-0 space-y-6", mainClassName)}>{children}</main>
          {aside ? <aside className="min-w-0 space-y-6">{aside}</aside> : null}
        </div>
      </div>
    </div>
  );
}
