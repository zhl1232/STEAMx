import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageStatusProps {
  kicker?: string;
  title: string;
  description: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageStatus({
  kicker = "页面状态",
  title,
  description,
  icon,
  actions,
  className,
}: PageStatusProps) {
  return (
    <div className={cn("page-shell py-10 md:py-14", className)}>
      <div className="mx-auto max-w-2xl">
        <section className="surface-panel overflow-hidden">
          <div className="border-b border-border/60 bg-gradient-to-r from-primary/8 via-background to-secondary/20 px-6 py-6">
            <p className="section-kicker">{kicker}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{description}</p>
          </div>

          <div className="flex flex-col items-center px-6 py-10 text-center">
            {icon ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border/70 bg-muted/55 text-foreground">
                {icon}
              </div>
            ) : null}

            {actions ? <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
