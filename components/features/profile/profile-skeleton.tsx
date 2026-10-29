import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { WeeklyPlanCardSkeleton } from "@/components/features/profile/weekly-plan-card";

type ProfileSkeletonVariant = "dashboard" | "public";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <Skeleton className={cn("rounded-lg", className)} />;
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

function MobileDashboardHeroSkeleton() {
  return (
    <section className="profile-mobile-hero relative overflow-visible">
      <div className="relative px-4 pb-4 pt-4">
        <div className="grid grid-cols-[78px_minmax(0,1fr)] items-start gap-4">
          <div className="flex flex-col items-center">
            <SkeletonBlock className="h-[78px] w-[78px] rounded-full border-[3px] border-background" />
          </div>
          <div className="min-w-0">
            <div className="flex h-11 items-center justify-between gap-1.5">
              <SkeletonBlock className="h-6 w-24 max-w-full rounded-full" />
              <div className="flex shrink-0 gap-1.5">
                <SkeletonBlock className="h-11 w-11 rounded-full" />
                <SkeletonBlock className="h-11 w-11 rounded-full" />
              </div>
            </div>
            <SkeletonBlock className="h-5.5 w-20 rounded-full" />
            <SkeletonBlock className="mt-1 h-4 w-full rounded-full" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 overflow-hidden border-t border-border/50">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={cn("flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-2.5", index > 0 && "border-l border-[hsl(var(--surface-border)/0.65)]")}>
              <SkeletonBlock className="h-6 w-10 rounded-full" />
              <SkeletonBlock className="h-3 w-8 rounded-full" />
            </div>
          ))}
        </div>
        <div className="mt-3.5 grid grid-cols-4 gap-0.5 border-t border-[hsl(var(--surface-border)/0.4)] pt-2.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex min-w-0 flex-col items-center justify-center gap-1 py-1.5">
              <SkeletonBlock className="h-12 w-12" />
              <SkeletonBlock className="h-3 w-11 max-w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StudyCheckInSkeleton() {
  return (
    <div className="@container/check-in min-w-0">
      <div className="flex items-center justify-between gap-2">
        <SkeletonBlock className="h-5 w-24 rounded-full" />
        <SkeletonBlock className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-2.5 flex flex-col gap-3 @min-[20rem]/check-in:flex-row @min-[20rem]/check-in:items-center @min-[20rem]/check-in:justify-between">
        <SkeletonBlock className="h-7 w-20 rounded-full" />
        <div className="grid grid-cols-6 gap-1 @min-[20rem]/check-in:gap-1.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-col items-center">
              <SkeletonBlock className="h-6 w-6 rounded-full" />
              <SkeletonBlock className="mt-0.5 h-3.5 w-4 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileServicesSkeleton() {
  return (
    <section className="surface-panel p-4 sm:p-5">
      <SkeletonBlock className="h-5 w-24 rounded-full" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-11 rounded-md" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
        <SkeletonBlock className="h-11 rounded-md" />
        <SkeletonBlock className="h-11 rounded-md" />
      </div>
    </section>
  );
}

function MobileDashboardProfileSkeleton() {
  return (
    <div className="profile-page-surface min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))] text-foreground md:hidden">
      <div className="space-y-3 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] min-[430px]:mx-auto min-[430px]:max-w-[430px]">
        <MobileDashboardHeroSkeleton />
        <WeeklyPlanCardSkeleton />
        <section className="profile-mobile-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <SkeletonBlock className="h-5 w-24 rounded-full" />
            <SkeletonBlock className="h-11 w-16 rounded-md" />
          </div>
          <div className="mt-3"><EmbeddedRowsSkeleton /></div>
        </section>
        <section className="profile-mobile-panel flex min-h-14 items-center justify-between px-4 py-3">
          <SkeletonBlock className="h-5 w-24 rounded-full" />
          <SkeletonBlock className="h-5 w-14 rounded-full" />
        </section>
        <section className="profile-mobile-panel p-4"><StudyCheckInSkeleton /></section>
        <ProfileServicesSkeleton />
      </div>
    </div>
  );
}

function EmbeddedRowsSkeleton({ count = 3, imageClassName = "h-16 w-[82px]" }: { count?: number; imageClassName?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-3 rounded-md p-1.5">
          <SkeletonBlock className={`${imageClassName} rounded-sm`} />
          <div className="min-w-0">
            <SkeletonBlock className={`h-4 rounded-full ${index === 0 ? "w-32" : index === 1 ? "w-28" : "w-36"}`} />
            <div className="mt-2 flex justify-end gap-2">
              <SkeletonBlock className="h-3 w-10 rounded-full" />
              <SkeletonBlock className="h-3 w-10 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DesktopDashboardProfileSkeleton() {
  return (
    <div className="hidden md:block">
      <div className="profile-page-surface profile-desktop-page min-h-screen pb-10 text-foreground">
        <div className="app-shell-wide py-6">
          <div className="space-y-5">
            <section className="profile-hero-card surface-panel rounded-lg p-6">
              <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-x-6 gap-y-4 min-[80rem]:grid-cols-[minmax(0,1fr)_22.5rem] min-[80rem]:gap-x-8">
                <div className="contents min-[80rem]:grid min-[80rem]:grid-cols-[112px_minmax(0,1fr)] min-[80rem]:items-start min-[80rem]:gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <SkeletonBlock className="h-24 w-24 rounded-full" />
                    <SkeletonBlock className="h-11 w-14 rounded-full" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <SkeletonBlock className="h-11 w-40 max-w-full rounded-md" />
                      <SkeletonBlock className="h-11 w-28 shrink-0 rounded-md min-[80rem]:hidden" />
                    </div>
                    <SkeletonBlock className="mt-3 h-4 w-52 max-w-full rounded-full" />
                  </div>
                </div>
                <div className="col-span-2 flex min-w-0 flex-col items-end gap-4 min-[80rem]:col-span-1">
                  <SkeletonBlock className="hidden h-11 w-36 rounded-md min-[80rem]:block" />
                  <div className="grid w-full grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="flex flex-col items-center gap-2 py-2.5">
                        <SkeletonBlock className="h-6 w-10 rounded-full" />
                        <SkeletonBlock className="h-3 w-8 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px] min-[105rem]:grid-cols-[minmax(0,1fr)_440px]">
              <main className="min-w-0 space-y-5">
                <WeeklyPlanCardSkeleton />
                <section className="surface-panel rounded-lg p-5">
                  <SectionTitleSkeleton />
                  <div className="mt-4"><EmbeddedRowsSkeleton /></div>
                </section>
                <section className="surface-panel flex min-h-14 items-center justify-between rounded-lg px-4 py-3">
                  <SkeletonBlock className="h-5 w-24 rounded-full" />
                  <SkeletonBlock className="h-5 w-5 rounded-full" />
                </section>
              </main>
              <aside className="min-w-0 space-y-5">
                <section className="surface-panel rounded-lg p-6">
                  <SectionTitleSkeleton action={false} />
                  <div className="mt-4 rounded-md bg-muted/50 p-4">
                    <SkeletonBlock className="h-8 w-24 rounded-full" />
                    <SkeletonBlock className="mt-4 h-2 w-full rounded-full" />
                    <SkeletonBlock className="mt-3 h-3 w-36 rounded-full" />
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                    <SkeletonBlock className="h-4 w-28 rounded-full" />
                    <SkeletonBlock className="h-11 w-20 rounded-md" />
                  </div>
                </section>
                <section className="surface-panel rounded-lg p-4"><StudyCheckInSkeleton /></section>
                <section className="surface-panel rounded-lg p-5">
                  <SectionTitleSkeleton />
                  <SkeletonBlock className="mt-4 h-16 rounded-md" />
                </section>
                <ProfileServicesSkeleton />
              </aside>
            </div>
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

                <div className="mt-5 w-full overflow-hidden rounded-md border border-border/50 bg-background/60 backdrop-blur-xs">
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
          <SkeletonBlock className="mt-4 h-[260px] w-full rounded-(--radius-lg) bg-muted/85" />
        </section>
      </div>
    </div>
  );
}

function PublicDesktopProfileSkeleton() {
  return (
    <div className="hidden md:block">
      <div className="app-shell-wide py-8">
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
              <SkeletonBlock className="mt-4 h-[320px] w-full rounded-(--radius-lg)" />
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
