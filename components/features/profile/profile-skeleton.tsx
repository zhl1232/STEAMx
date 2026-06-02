type ProfileSkeletonVariant = "dashboard" | "public";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/75 ${className}`} />;
}

function SectionTitleSkeleton({ action = true, actionWidth = "w-16" }: { action?: boolean; actionWidth?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <SkeletonBlock className="h-10 w-10 shrink-0" />
        <SkeletonBlock className="h-5 w-32 rounded-full" />
      </div>
      {action ? <SkeletonBlock className={`h-8 rounded-full ${actionWidth}`} /> : null}
    </div>
  );
}

function DashboardHeroSkeleton({ compact }: { compact: boolean }) {
  return (
    <section className={`profile-hero-card surface-panel relative overflow-hidden ${compact ? "rounded-lg" : "min-h-[270px] rounded-lg"}`}>
      <div className="absolute inset-0">
        <div
          className={
            compact
              ? "absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--surface-raised)/0.98)_0%,hsl(var(--tone-science-soft)/0.32)_100%)] dark:bg-[linear-gradient(180deg,hsl(var(--surface-raised)/0.98)_0%,hsl(var(--surface-muted)/0.22)_100%)]"
              : "absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--surface-raised)/0.98)_0%,hsl(var(--surface-raised)/0.94)_38%,hsl(var(--tone-science-soft)/0.72)_72%,hsl(var(--background)/0.22)_100%)] dark:bg-[linear-gradient(90deg,hsl(var(--surface-raised)/0.96)_0%,hsl(var(--surface-raised)/0.88)_42%,hsl(var(--brand-blue)/0.14)_100%)]"
          }
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,hsl(var(--surface-raised)/0.08)_100%)]" />
        {!compact ? <SkeletonBlock className="absolute bottom-6 right-8 h-40 w-[36%] rounded-xl bg-muted/35" /> : null}
      </div>

      <div className={`relative ${compact ? "px-4 pb-4 pt-4" : "px-7 pb-5 pt-7"}`}>
        {compact ? (
          <div className="flex justify-center">
            <SkeletonBlock className="h-7 w-24 rounded-full" />
          </div>
        ) : null}

        <div className={`mt-4 ${compact ? "grid grid-cols-[78px_minmax(0,1fr)] gap-4" : "flex min-h-[156px] flex-wrap items-start gap-6"}`}>
          <div className="relative shrink-0 pt-1">
            <SkeletonBlock className={`${compact ? "h-[76px] w-[76px]" : "h-[112px] w-[112px]"} rounded-full border-[4px] border-background`} />
            <SkeletonBlock className="absolute -bottom-1.5 left-1/2 h-7 w-16 -translate-x-1/2 rounded-full bg-muted/90" />
          </div>

          <div className="min-w-0">
            <div className="flex items-start gap-2">
              <SkeletonBlock className={compact ? "h-9 w-40 rounded-full" : "h-10 w-48 rounded-full"} />
              {compact ? <SkeletonBlock className="h-9 w-16 shrink-0 rounded-full" /> : null}
            </div>
            <SkeletonBlock className={`mt-2 h-4 rounded-full ${compact ? "w-full" : "max-w-[460px]"}`} />
            <SkeletonBlock className={`mt-2 h-4 rounded-full ${compact ? "w-5/6" : "max-w-[360px]"}`} />

            {compact ? (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <SkeletonBlock className="h-3 w-28 rounded-full" />
                  <SkeletonBlock className="h-3 w-8 rounded-full" />
                </div>
                <SkeletonBlock className="mt-2 h-2.5 w-full rounded-full" />
                <SkeletonBlock className="mt-2 h-3 w-32 rounded-full" />
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-3">
                  <SkeletonBlock className="h-8 w-28 rounded-full" />
                  <SkeletonBlock className="h-8 w-36 rounded-full" />
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <SkeletonBlock className="h-11 w-28 rounded-lg" />
                  <SkeletonBlock className="h-4 w-48 rounded-full" />
                </div>
              </>
            )}
          </div>
        </div>

        <div
          className={`grid overflow-hidden ${
            compact
              ? "mt-4 grid-cols-4 rounded-md border border-[hsl(var(--surface-border)/0.62)] bg-[hsl(var(--surface-raised)/0.94)] shadow-[0_12px_24px_-22px_hsl(var(--surface-shadow)/0.14)]"
              : "profile-stats-bar mt-6 max-w-[610px] grid-cols-4 rounded-lg"
          }`}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={`flex items-center justify-center gap-3 ${compact ? "min-h-[68px] flex-col gap-1.5 px-2 py-3" : "min-h-[62px] px-4 py-3"} ${
                index > 0 ? "border-l border-[hsl(var(--surface-border)/0.56)]" : ""
              }`}
            >
              <SkeletonBlock className={`${compact ? "h-8 w-8" : "h-10 w-10"} shrink-0`} />
              <div className={compact ? "w-full" : "min-w-0"}>
                <SkeletonBlock className={`mx-auto h-5 rounded-full ${compact ? "w-10" : "w-12"}`} />
                <SkeletonBlock className={`mx-auto mt-2 h-3 rounded-full ${compact ? "w-8" : "w-10"}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MobileActionGridSkeleton() {
  return (
    <section className="surface-panel grid grid-cols-5 gap-1.5 p-3 min-[390px]:gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid min-h-[76px] place-items-center gap-1.5 rounded-md px-0.5 py-2.5 text-center min-[390px]:min-h-[84px] min-[390px]:gap-2 min-[390px]:py-3">
          <SkeletonBlock className="h-9 w-9 rounded-md min-[390px]:h-10 min-[390px]:w-10" />
          <SkeletonBlock className="h-3 w-10 rounded-full min-[390px]:w-12" />
        </div>
      ))}
    </section>
  );
}

function NextActionCardSkeleton() {
  return (
    <section className="surface-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <SkeletonBlock className="h-5 w-28 rounded-full" />
        <SkeletonBlock className="h-8 w-12 rounded-full" />
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-md bg-[hsl(var(--surface-muted)/0.46)] p-3 ring-1 ring-[hsl(var(--surface-border)/0.58)]">
        <SkeletonBlock className="h-16 w-16 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-4 w-24 rounded-full" />
          <SkeletonBlock className="mt-2 h-3 w-32 rounded-full" />
        </div>
        <SkeletonBlock className="h-10 w-16 rounded-md" />
      </div>
    </section>
  );
}

function GrowthTaskRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-md border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.5)] p-3">
          <div className="flex items-start gap-3">
            <SkeletonBlock className="mt-0.5 h-4 w-4 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock className={`h-4 rounded-full ${index === 1 ? "w-36" : index === 3 ? "w-28" : "w-32"}`} />
                <SkeletonBlock className="h-4 w-14 rounded-full" />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <SkeletonBlock className="h-2 flex-1 rounded-full" />
                {index === 0 ? (
                  <SkeletonBlock className="h-8 w-12 rounded-sm" />
                ) : (
                  <SkeletonBlock className="h-3 w-10 rounded-full" />
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StudyCheckInSkeleton() {
  return (
    <section className="surface-panel flex min-h-[388px] flex-col rounded-lg p-5">
      <SectionTitleSkeleton actionWidth="w-12" />

      <div className="mt-4 rounded-lg bg-[linear-gradient(135deg,#f4fbf7,#eef7ff)] p-4 dark:bg-[linear-gradient(135deg,hsl(var(--surface-muted)),hsl(var(--surface-raised)))]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <SkeletonBlock className="h-3 w-16 rounded-full" />
            <div className="mt-2 flex items-end gap-2">
              <SkeletonBlock className="h-9 w-14 rounded-full" />
              <SkeletonBlock className="h-4 w-8 rounded-full" />
            </div>
          </div>
          <SkeletonBlock className="h-16 w-16 rounded-lg bg-muted/85" />
        </div>
        <SkeletonBlock className="mt-3 h-3 w-36 rounded-full" />
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="text-center">
            <SkeletonBlock className="mx-auto h-7 w-7 rounded-full" />
            <SkeletonBlock className="mx-auto mt-2 h-3 w-7 rounded-full" />
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-sm border border-[hsl(var(--brand-green)/0.16)] bg-[hsl(var(--brand-green)/0.07)] px-3 py-2.5">
          <SkeletonBlock className="h-3 w-16 rounded-full" />
          <SkeletonBlock className="mt-2 h-3 w-full rounded-full" />
          <SkeletonBlock className="mt-2 h-3 w-2/3 rounded-full" />
        </div>
      </div>
    </section>
  );
}

function MobileDashboardProfileSkeleton() {
  return (
    <div className="profile-page-surface min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))] text-foreground md:hidden">
      <header className="app-mobile-header">
        <div className="flex h-12 items-center px-4 min-[390px]:px-5">
          <SkeletonBlock className="h-7 w-14 rounded-full" />
          <div className="ml-auto">
            <SkeletonBlock className="h-9 w-9 rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.82)]" />
          </div>
        </div>
      </header>

      <div className="px-4 pb-4 min-[430px]:mx-auto min-[430px]:max-w-[430px]">
        <DashboardHeroSkeleton compact />
      </div>

      <div className="space-y-4 px-4 min-[430px]:mx-auto min-[430px]:max-w-[430px]">
        <NextActionCardSkeleton />

        <MobileActionGridSkeleton />

        <section className="surface-panel p-4">
          <SectionTitleSkeleton />
          <SkeletonBlock className="mt-4 h-[260px] w-full rounded-md" />
        </section>

        <section className="surface-panel p-4">
          <SectionTitleSkeleton />
          <div className="mt-4 flex justify-between gap-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex min-w-[58px] flex-col items-center">
                <SkeletonBlock className="h-11 w-11 rounded-full" />
                <SkeletonBlock className="mt-2 h-3 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        <section className="surface-panel p-4">
          <SectionTitleSkeleton />
          <LearningTimelineSkeleton />
        </section>

        <section className="surface-panel p-4">
          <SectionTitleSkeleton />
          <div className="mt-4 flex gap-3 overflow-hidden">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="w-[176px] shrink-0 overflow-hidden rounded-sm border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.82)]">
                <SkeletonBlock className="h-[104px] w-full rounded-none" />
                <div className="p-3">
                  <SkeletonBlock className="h-4 w-28 rounded-full" />
                  <SkeletonBlock className="mt-2 h-3 w-full rounded-full" />
                  <SkeletonBlock className="mt-2 h-3 w-2/3 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-panel p-4">
          <SectionTitleSkeleton />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="flex gap-3 rounded-md border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.72)] p-3">
                <SkeletonBlock className="h-14 w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <SkeletonBlock className="h-4 w-28 rounded-full" />
                  <SkeletonBlock className="mt-2 h-3 w-full rounded-full" />
                  <SkeletonBlock className="mt-2 h-3 w-2/3 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-panel mb-2 rounded-lg p-5">
          <SectionTitleSkeleton />
          <div className="mt-5 grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-16 rounded-md" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardChartSkeleton() {
  return (
    <div className="mt-5 flex flex-1 items-center justify-center">
      <SkeletonBlock className="h-[214px] w-[214px] rounded-full" />
    </div>
  );
}

function ProjectStripSkeleton() {
  return (
    <div className="mt-4 flex gap-3 overflow-hidden">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="min-w-[178px] flex-1 overflow-hidden rounded-sm border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.82)]">
          <SkeletonBlock className="h-[118px] w-full rounded-none" />
          <div className="p-3">
            <SkeletonBlock className="h-4 w-32 rounded-full" />
            <SkeletonBlock className="mt-2 h-3 w-full rounded-full" />
            <SkeletonBlock className="mt-2 h-3 w-2/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ObservationRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-4 space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex gap-3 rounded-md border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.72)] p-3">
          <SkeletonBlock className="h-12 w-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="h-4 w-28 rounded-full" />
            <SkeletonBlock className="mt-2 h-3 w-full rounded-full" />
            <SkeletonBlock className="mt-2 h-3 w-2/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommunityFeedRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-4 space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="grid grid-cols-[34px_minmax(0,1fr)_52px] items-center gap-3 rounded-sm p-1.5">
          <SkeletonBlock className="h-8 w-8 rounded-full" />
          <div className="min-w-0">
            <SkeletonBlock className="h-3 w-14 rounded-full" />
            <SkeletonBlock className="mt-2 h-3 w-full rounded-full" />
            <SkeletonBlock className="mt-2 h-3 w-2/3 rounded-full" />
          </div>
          <SkeletonBlock className="h-11 w-[52px] rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function LearningTimelineSkeleton() {
  return (
    <div className="mt-5 grid grid-cols-5 gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="relative min-w-0 text-center">
          {index > 0 ? (
            <span className="absolute left-[-50%] top-5 h-0.5 w-full bg-[hsl(var(--surface-border))]" aria-hidden="true" />
          ) : null}
          <SkeletonBlock className="relative z-10 mx-auto h-11 w-11 rounded-full" />
          <SkeletonBlock className="mx-auto mt-2 h-3 w-8 rounded-full" />
          <SkeletonBlock className="mx-auto mt-2 h-3 w-12 rounded-full" />
          <SkeletonBlock className="mx-auto mt-2 h-3 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function DesktopDashboardProfileSkeleton() {
  return (
    <div className="hidden md:block">
      <div className="min-h-screen bg-background pb-10 text-foreground">
        <div className="app-shell-wide py-4 min-[390px]:px-5 md:px-8 md:py-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
            <main className="min-w-0 space-y-4">
              <DashboardHeroSkeleton compact={false} />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
                <section className="surface-panel flex min-h-[388px] flex-col rounded-lg p-5 xl:col-span-4">
                  <SectionTitleSkeleton />
                  <DashboardChartSkeleton />
                </section>

                <section className="surface-panel flex min-h-[388px] flex-col overflow-hidden rounded-lg p-5 xl:col-span-5">
                  <SectionTitleSkeleton />
                  <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_108px]">
                    <div className="min-w-0">
                      <SkeletonBlock className="h-10 w-32 rounded-full" />
                      <SkeletonBlock className="mt-5 h-2 w-full rounded-full" />
                      <SkeletonBlock className="mt-3 h-4 w-44 rounded-full" />
                    </div>
                    <SkeletonBlock className="h-[108px] w-[108px] rounded-full" />
                  </div>
                  <div className="mt-5 grid grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="flex flex-col items-center">
                        <SkeletonBlock className="h-12 w-12 rounded-full" />
                        <SkeletonBlock className="mt-2 h-3 w-12 rounded-full" />
                      </div>
                    ))}
                  </div>
                </section>

                <div className="xl:col-span-3">
                  <StudyCheckInSkeleton />
                </div>

                <section className="surface-panel rounded-lg p-5 md:col-span-2 xl:col-span-6">
                  <SectionTitleSkeleton />
                  <ProjectStripSkeleton />
                </section>

                <section className="surface-panel rounded-lg p-5 xl:col-span-3">
                  <SectionTitleSkeleton />
                  <ObservationRowsSkeleton />
                </section>

                <section className="surface-panel rounded-lg p-5 xl:col-span-3">
                  <SectionTitleSkeleton />
                  <CommunityFeedRowsSkeleton />
                </section>

                <section className="surface-panel rounded-lg p-5 md:col-span-2 xl:col-span-6">
                  <SectionTitleSkeleton />
                  <LearningTimelineSkeleton />
                </section>
              </div>
            </main>

            <aside className="space-y-4">
              <section className="surface-panel rounded-lg p-5">
                <SectionTitleSkeleton action={false} />
                <div className="mt-4">
                  <GrowthTaskRowsSkeleton />
                </div>
              </section>

              <section className="surface-panel rounded-lg p-5">
                <SkeletonBlock className="h-36 w-full rounded-lg" />
                <SkeletonBlock className="mt-4 h-5 w-36 rounded-full" />
                <SkeletonBlock className="mt-3 h-3 w-full rounded-full" />
                <SkeletonBlock className="mt-2 h-3 w-2/3 rounded-full" />
                <SkeletonBlock className="mt-4 h-9 w-24 rounded-sm" />
              </section>

              <section className="surface-panel rounded-lg p-5">
                <SectionTitleSkeleton />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonBlock key={index} className="h-16 rounded-md" />
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardProfileSkeleton() {
  return (
    <>
      <MobileDashboardProfileSkeleton />
      <DesktopDashboardProfileSkeleton />
    </>
  );
}

function PublicMobileProfileSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-24 md:hidden">
      <div className="px-4 pt-4">
        <section className="surface-panel overflow-hidden">
          <div className="relative overflow-hidden px-4 pb-4 pt-4">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(166,193,238,0.18),transparent_60%),radial-gradient(circle_at_80%_20%,rgba(251,194,235,0.16),transparent_40%),radial-gradient(circle_at_20%_80%,rgba(166,193,238,0.08),transparent_50%)]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <SkeletonBlock className="h-9 w-24 rounded-full bg-muted/90" />
                <div className="flex gap-1.5">
                  <SkeletonBlock className="h-9 w-9 rounded-full bg-muted/90" />
                  <SkeletonBlock className="h-9 w-9 rounded-full bg-muted/90" />
                </div>
              </div>

              <div className="mt-7 flex flex-col items-center">
                <div className="relative">
                  <SkeletonBlock className="h-[88px] w-[88px] rounded-full bg-muted/90" />
                  <SkeletonBlock className="absolute -bottom-1.5 left-1/2 h-6 w-16 -translate-x-1/2 rounded-full bg-muted/95" />
                </div>

                <div className="mt-4 flex w-full flex-col items-center">
                  <SkeletonBlock className="h-6 w-32 rounded-full bg-muted/90" />
                  <SkeletonBlock className="mt-3 h-4 w-52 rounded-full bg-muted/80" />
                  <SkeletonBlock className="mt-2 h-4 w-44 rounded-full bg-muted/80" />

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <SkeletonBlock className="h-8 w-20 rounded-full bg-muted/90" />
                    <SkeletonBlock className="h-8 w-20 rounded-full bg-muted/90" />
                  </div>
                </div>

                <div className="mt-5 w-full overflow-hidden rounded-md border border-border/50 bg-background/60 backdrop-blur-sm">
                  <div className="grid grid-cols-4 divide-x divide-border/40">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="px-2 py-3 text-center">
                        <SkeletonBlock className="mx-auto h-5 w-10 rounded-full bg-muted/90" />
                        <SkeletonBlock className="mx-auto mt-2 h-3 w-8 rounded-full bg-muted/75" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="surface-subtle p-4">
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock className="h-4 w-24 rounded-full bg-muted/90" />
                <SkeletonBlock className="h-4 w-12 rounded-full bg-muted/80" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-8 w-8 rounded-full bg-muted/85" />
                ))}
              </div>
              <div className="mt-4 border-t border-border/60 pt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <SkeletonBlock className="h-3 w-16 rounded-full bg-muted/80" />
                  <SkeletonBlock className="h-3 w-14 rounded-full bg-muted/80" />
                </div>
                <SkeletonBlock className="h-3 w-full rounded-full bg-muted/85" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-4 px-4 py-4">
        <section className="surface-panel rounded-xl p-5">
          <SkeletonBlock className="h-5 w-28 rounded-full bg-muted/90" />
          <SkeletonBlock className="mt-4 h-[260px] w-full rounded-[var(--radius-lg)] bg-muted/85" />
        </section>
      </div>
    </div>
  );
}

function PublicDesktopProfileSkeleton() {
  return (
    <div className="hidden md:block">
      <div className="page-shell py-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
          <div className="space-y-6">
            <section className="surface-panel overflow-hidden">
              <div className="px-6 py-7 sm:px-7 sm:py-8 lg:px-8">
                <SkeletonBlock className="h-3 w-16 rounded-full" />
                <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-center">
                  <div className="relative mx-auto shrink-0 xl:mx-0">
                    <SkeletonBlock className="h-28 w-28 rounded-full md:h-32 md:w-32" />
                    <SkeletonBlock className="absolute -bottom-2 -right-1 h-9 w-20 rounded-full" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <SkeletonBlock className="h-8 w-40 rounded-full" />
                        <SkeletonBlock className="mt-4 h-4 w-full max-w-xl rounded-full" />
                        <SkeletonBlock className="mt-2 h-4 w-2/3 max-w-md rounded-full" />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <SkeletonBlock className="h-11 w-32 rounded-md" />
                        <SkeletonBlock className="h-11 w-28 rounded-md" />
                        <SkeletonBlock className="h-11 w-28 rounded-md" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="surface-subtle rounded-lg border border-transparent px-4 py-4">
                          <SkeletonBlock className="h-6 w-12 rounded-full" />
                          <SkeletonBlock className="mt-2 h-3 w-14 rounded-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="surface-panel p-6">
              <SkeletonBlock className="h-5 w-28 rounded-full" />
              <SkeletonBlock className="mt-4 h-[320px] w-full rounded-[var(--radius-lg)]" />
            </section>
          </div>

          <aside className="space-y-6">
            <section className="surface-panel p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-3">
                  <SkeletonBlock className="h-3 w-16 rounded-full" />
                  <SkeletonBlock className="h-8 w-36 rounded-full" />
                </div>
                <SkeletonBlock className="h-4 w-14 rounded-full" />
              </div>
              <SkeletonBlock className="mt-4 h-4 w-32 rounded-full" />
              <SkeletonBlock className="mt-6 h-3 w-full rounded-full" />
            </section>

            <section className="surface-panel p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-3">
                  <SkeletonBlock className="h-3 w-16 rounded-full" />
                  <SkeletonBlock className="h-8 w-40 rounded-full" />
                </div>
                <SkeletonBlock className="h-4 w-12 rounded-full" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-8 w-8 rounded-full" />
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PublicProfileSkeleton() {
  return (
    <>
      <PublicMobileProfileSkeleton />
      <PublicDesktopProfileSkeleton />
    </>
  );
}

export function ProfileSkeleton({ variant = "dashboard" }: { variant?: ProfileSkeletonVariant }) {
  return variant === "public" ? <PublicProfileSkeleton /> : <DashboardProfileSkeleton />;
}
