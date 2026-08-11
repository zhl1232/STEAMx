import { ArrowLeft } from "lucide-react"

import { MobilePageHeader } from "@/components/ui/mobile-page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Surface } from "@/components/ui/surface"
import { COMPACT_VERTICAL_PROJECT_GRID_CLASS, COMPACT_VERTICAL_PROJECT_CARD_CLASS } from "@/components/features/compact-project-grid-styles"
import { cn } from "@/lib/utils"

export function ProjectCardSkeleton({
  variant = "featured",
  compactLayout = "dense",
  className,
}: {
  variant?: "featured" | "compact"
  compactLayout?: "adaptive" | "vertical" | "dense"
  className?: string
} = {}) {
  if (variant === "compact") {
    const isVerticalCompact = compactLayout === "vertical"
    const isDenseCompact = compactLayout === "dense"

    return (
      <div className={cn("h-full", className)}>
        <div
          className={cn(
            "surface-card surface-card-interactive relative h-full overflow-hidden rounded-md",
            isVerticalCompact
              ? "flex flex-col gap-0 p-0"
              : isDenseCompact
                ? "grid min-h-[112px] grid-cols-[88px_minmax(0,1fr)] gap-3 border-transparent bg-[hsl(var(--surface-raised)/0.92)] p-2.5 shadow-[0_2px_10px_hsl(var(--surface-shadow)/0.045)] sm:flex sm:flex-col sm:gap-0 sm:p-0 dark:bg-[hsl(var(--surface-raised)/0.72)] dark:shadow-[0_10px_28px_hsl(var(--surface-shadow)/0.18)]"
                : "grid grid-cols-[128px_minmax(0,1fr)] gap-3 p-2.5 sm:flex sm:flex-col sm:gap-0 sm:p-0",
          )}
        >
          <div
            className={cn(
              "pointer-events-none relative w-full overflow-hidden bg-[hsl(var(--surface-muted))]",
              isVerticalCompact
                ? "aspect-16/10 rounded-none"
                : isDenseCompact
                  ? "h-full min-h-[92px] rounded-sm sm:aspect-16/8.5 sm:h-auto sm:min-h-0 sm:rounded-none"
                  : "aspect-square rounded-sm sm:aspect-16/8.5 sm:rounded-none",
            )}
          >
            <Skeleton className="h-full w-full rounded-none" />
          </div>

          <div
            className={cn(
              "pointer-events-none relative flex min-w-0 flex-col justify-between gap-2",
              isVerticalCompact
                ? "flex-1 p-3"
                : isDenseCompact
                  ? "py-0 sm:flex-1 sm:p-3.5"
                  : "py-0.5 sm:flex-1 sm:p-3.5",
            )}
          >
            <div className={cn("min-w-0", isDenseCompact ? "space-y-1" : "space-y-2")}>
              <Skeleton
                className={cn(
                  "rounded-xs",
                  isDenseCompact
                    ? "h-[18px] w-[88%] sm:h-5 sm:w-3/4"
                    : "h-5 w-[88%] sm:h-6 sm:w-3/4",
                )}
              />
              {isVerticalCompact && (
                <Skeleton className="h-5 w-[65%] rounded-xs sm:hidden" />
              )}
              <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
                <Skeleton className="h-4.5 w-10 shrink-0 rounded-xs" />
                <span className="text-[10px] text-muted-foreground/30 select-none" aria-hidden="true">•</span>
                <Skeleton className="h-3 min-w-0 flex-1 max-w-22 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
              {!isDenseCompact && (
                <>
                  <Skeleton className="h-3 w-[92%] rounded-full" />
                  <Skeleton className="h-3 w-[70%] rounded-full" />
                </>
              )}
            </div>

            {isDenseCompact ? (
              <div className="flex items-center justify-between gap-2 pt-1 sm:mt-auto">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-2.5 w-2.5 rounded-full" />
                  ))}
                </div>
                <div className="ml-auto flex items-center justify-end gap-2.5">
                  <Skeleton className="h-3 w-6 rounded-full" />
                  <Skeleton className="h-3 w-6 rounded-full" />
                  <Skeleton className="h-3.5 w-7 rounded-full" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[11px] sm:mt-auto">
                <Skeleton className="h-3 w-6 rounded-full" />
                <Skeleton className="h-3 w-6 rounded-full" />
                <Skeleton className="h-3.5 w-7 rounded-full" />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("surface-card overflow-hidden rounded-(--radius-lg)", className)}>
      <div className="relative aspect-16/10 w-full overflow-hidden bg-muted">
        <Skeleton className="h-full w-full rounded-none" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="flex min-w-0 flex-wrap gap-2">
            <Skeleton className="h-6 w-14 rounded-full bg-white/20" />
            <Skeleton className="h-6 w-20 rounded-full bg-white/15" />
          </div>
          <Skeleton className="h-7 w-16 shrink-0 rounded-full bg-black/25" />
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-linear-to-br from-background via-background to-muted/20 p-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-4/5 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-3/4 rounded-full" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>

        <div className="flex items-center gap-4 border-t border-border/60 pt-3">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** 与 `ExploreForYouRail` 内 `ExploreRecommendationCard` 一致 */
export function ExploreRecommendationCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-md border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised))]">
      <Skeleton className="aspect-4/3 w-full rounded-none" />
      <div className="flex min-h-[136px] flex-col gap-2.5 p-3.5">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-5 w-[88%] rounded-xs" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Skeleton className="h-5 w-10 shrink-0 rounded-xs" />
              <Skeleton className="h-3 min-w-0 flex-1 max-w-18 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-9 shrink-0 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-[92%] rounded-full" />
      </div>
    </article>
  )
}

/**
 * 与 `ExploreClient` 主面板顶部一致：移动端仅分类条；桌面搜索 / 更多筛选。
 * 移动端搜索在 `MobileGlobalHeader`（见 `ExploreMobileSearchHeaderSkeleton`）。
 */
export function ExploreToolbarSkeleton() {
  const categoryWidths = ["w-[64px]", "w-[76px]", "w-[76px]", "w-[76px]", "w-[76px]", "w-[76px]", "w-[76px]"]

  return (
    <div className="bg-transparent pb-3 pt-1 md:border-b md:border-[hsl(var(--surface-border))] md:p-5">
      <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-3">
        <Skeleton className="h-11 w-full rounded-sm" />
        <Skeleton className="h-11 w-[100px] shrink-0 rounded-sm" />
      </div>
      <div className="space-y-2.5 md:mt-4 md:space-y-2">
        <Skeleton className="hidden h-4 w-8 rounded-full md:block" />
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex min-w-max items-center gap-2 pb-0.5 md:min-w-0 md:flex-wrap md:gap-3">
            {categoryWidths.map((width, index) => (
              <Skeleton
                key={index}
                className={`h-8 shrink-0 rounded-full md:h-10 md:rounded-sm ${width}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ExploreRecommendationRailSkeleton() {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-24 rounded-xs md:h-[18px]" />
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-hidden scroll-px-4 px-4 pb-1.5 md:mx-0 md:px-0">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="w-[min(45.5vw,176px)] shrink-0 snap-start sm:w-[184px]"
          >
            <ExploreRecommendationCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  )
}

function ExploreListTabsSkeleton() {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Skeleton className="h-8 min-w-[78px] rounded-full md:h-10 md:min-w-[96px]" />
        <Skeleton className="h-8 min-w-[78px] rounded-full md:h-10 md:min-w-[96px]" />
      </div>
    </div>
  )
}

function ExploreSidebarSkeleton() {
  return (
    <aside className="hidden min-w-0 xl:block">
      <div className="sticky top-24 flex h-full min-h-0 flex-col gap-4">
        <Surface className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-24 rounded-xs" />
            <Skeleton className="h-4 w-14 rounded-xs" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-18 rounded-xs" />
            ))}
          </div>
        </Surface>
        <Surface className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-28 rounded-xs" />
            <Skeleton className="h-4 w-20 rounded-xs" />
          </div>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
            <Skeleton className="min-h-[92px] rounded-sm" />
            <div className="flex min-w-0 flex-col gap-2 pt-0.5">
              <Skeleton className="h-4 w-full rounded-xs" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-4/5 rounded-full" />
              <Skeleton className="mt-2 h-8 w-24 rounded-sm" />
            </div>
          </div>
        </Surface>
        <Surface className="p-4">
          <Skeleton className="h-14 w-full rounded-sm" />
        </Surface>
      </div>
    </aside>
  )
}

/**
 * 与 `ExploreClient` 内 `MobileGlobalHeader variant="search"` 一致（探索路由在壳层不挂全局移动头）。
 * 仅 `md:hidden`，桌面端由 `ConditionalAppShell` 的顶栏承担。
 */
function ExploreMobileSearchHeaderSkeleton() {
  return (
    <header
      aria-hidden="true"
      className="app-mobile-header"
    >
      <div className="flex h-15 items-center px-4">
        <div className="mr-2 shrink-0">
          <Skeleton className="h-[30px] w-[30px] rounded-sm" />
        </div>
        <div className="min-w-0 flex-1">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <nav className="ml-2 flex shrink-0 items-center justify-end gap-1.5 min-[390px]:gap-2">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        </nav>
      </div>
    </header>
  )
}

/** 与 `ExploreClient` 画布、max-w-[1840px]、双栏与项目网格（含 ≥1400px 四列）对齐 */
export function ExplorePageSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="app-canvas-explore relative min-h-[calc(100vh-var(--mobile-global-header-height,3rem))] overflow-hidden pb-3 md:min-h-[calc(100vh-4rem)] md:pb-8">
      <ExploreMobileSearchHeaderSkeleton />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--app-canvas))_0%,hsl(var(--surface-raised)/0.98)_45%,hsl(var(--app-canvas-soft))_100%)] md:hidden"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[560px] bg-[linear-gradient(180deg,hsl(var(--app-canvas)/0.98)_0%,hsl(var(--app-canvas-soft)/0.72)_56%,hsl(var(--app-canvas-soft)/0)_100%)] md:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[560px] opacity-95 dark:md:hidden md:block"
        style={{
          backgroundImage: "url('/assets/explore-page-bg-light.webp')",
          backgroundPosition: "right top",
          backgroundRepeat: "no-repeat",
          backgroundSize: "max(100%, 1840px) auto",
          maskImage: "linear-gradient(180deg, black 0%, black 72%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, black 0%, black 72%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[560px] opacity-95 dark:md:block"
        style={{
          backgroundImage: "url('/assets/explore-page-bg-dark.webp')",
          backgroundPosition: "right top",
          backgroundRepeat: "no-repeat",
          backgroundSize: "max(100%, 1840px) auto",
          maskImage: "linear-gradient(180deg, black 0%, black 72%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, black 0%, black 72%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[300px] hidden h-[560px] bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--brand-blue)/0.16),hsl(var(--app-canvas-soft)/0)_64%)] md:block"
      />

      <div className="relative z-10">
        <div className="app-shell-wide min-w-0 pt-2.5 md:px-8 md:pt-5">
          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <main className="relative min-w-0 overflow-hidden md:surface-panel md:rounded-lg">
              <ExploreToolbarSkeleton />
              <div className="flex flex-col gap-2.5 pb-4 pt-1 md:p-5">
                <ExploreRecommendationRailSkeleton />
                <div className="relative pb-5 pt-0.5 md:pb-0 md:pt-0">
                  <ExploreListTabsSkeleton />
                  <div className={COMPACT_VERTICAL_PROJECT_GRID_CLASS}>
                    {Array.from({ length: count }).map((_, index) => (
                      <ProjectCardSkeleton key={index} variant="compact" compactLayout="vertical" className={COMPACT_VERTICAL_PROJECT_CARD_CLASS} />
                    ))}
                  </div>
                </div>
              </div>
            </main>
            <ExploreSidebarSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

/** 与 `ExplorationRecordCard`（详情页横向卡片）一致 */
export function ExplorationRecordCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "min-w-[178px] shrink-0 snap-start overflow-hidden rounded-sm border border-[hsl(var(--surface-border)/0.86)] bg-background/86 shadow-xs",
        className,
      )}
    >
      <div className="p-2.5">
        <div className="mb-2 flex items-center gap-2">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-16 rounded-full" />
            <Skeleton className="h-2.5 w-12 rounded-full" />
          </div>
        </div>
        <Skeleton className="aspect-4/3 w-full rounded-sm" />
        <Skeleton className="mt-2 h-3 w-full rounded-full" />
        <Skeleton className="mt-1.5 h-3 w-[88%] rounded-full" />
        <Skeleton className="mt-2 h-3.5 w-10 rounded-full" />
      </div>
    </div>
  )
}

/** 与 `ProjectExplorationRecordsBlock` 横向列表 +「查看全部」链接一致 */
export function ProjectExplorationRecordsBlockSkeleton({ cardCount = 3 }: { cardCount?: number }) {
  return (
    <div>
      <div className="-mx-4 flex snap-x gap-3 overflow-hidden px-4 pb-1">
        {Array.from({ length: cardCount }).map((_, index) => (
          <ExplorationRecordCardSkeleton key={index} />
        ))}
      </div>
      <Skeleton className="mx-auto mt-3 h-4 w-36 rounded-full" />
    </div>
  )
}

/** 与 `ExplorationRecordFeedCard` standalone 一致 */
export function ExplorationRecordFeedCardSkeleton({ nested = false }: { nested?: boolean }) {
  return (
    <article
      className={cn(
        nested
          ? "bg-transparent p-3.5"
          : "rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] p-3.5 shadow-xs",
      )}
    >
      {nested ? (
        <div className="mb-2 flex gap-2">
          <Skeleton className="h-3 w-14 rounded-full" />
          <Skeleton className="h-3 w-12 rounded-full" />
          <Skeleton className="h-4 w-10 rounded-full" />
        </div>
      ) : (
        <header className="flex items-start gap-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-3 w-36 rounded-full" />
          </div>
        </header>
      )}
      <Skeleton className={cn("h-4 w-full rounded-full", nested ? "mt-2" : "mt-3")} />
      <Skeleton className="mt-2 h-4 w-4/5 rounded-full" />
      <Skeleton className="mt-3 h-44 w-full rounded-sm" />
      <div className="mt-3 flex gap-5 border-t border-[hsl(var(--surface-border)/0.7)] pt-2.5">
        <Skeleton className="h-4 w-10 rounded-full" />
        <Skeleton className="h-4 w-10 rounded-full" />
      </div>
    </article>
  )
}

/** 与 `ExplorationRecordGroupCard` 一致 */
export function ExplorationRecordGroupCardSkeleton() {
  return (
    <section className="relative isolate pb-2">
      <span className="absolute inset-x-4 bottom-0 top-4 -z-20 rounded-md border border-border/45 bg-muted" />
      <span className="absolute inset-x-2 bottom-1 top-2 -z-10 rounded-md border border-border/65 bg-background" />
      <div className="overflow-hidden rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] shadow-xs">
        <header className="flex items-center gap-2.5 px-3.5 py-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
          <Skeleton className="h-6 w-14 rounded-full" />
        </header>
        <Skeleton className="mx-3.5 aspect-[16/10] rounded-sm" />
        <div className="space-y-2 px-3.5 pb-3 pt-2.5">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-4/5 rounded-full" />
          <div className="flex gap-4 border-t border-border/65 pt-2.5">
            <Skeleton className="h-4 w-10 rounded-full" />
            <Skeleton className="h-4 w-10 rounded-full" />
            <Skeleton className="ml-auto h-4 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  )
}

function ProjectDetailMobileSectionSkeleton({ titleWidth = "w-24" }: { titleWidth?: string }) {
  return (
    <section className="rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]">
      <Skeleton className={cn("mb-3 h-5 rounded-full", titleWidth)} />
      <Skeleton className="h-4 w-full rounded-full" />
      <Skeleton className="mt-2 h-4 w-5/6 rounded-full" />
    </section>
  )
}

function ProjectDetailMaterialsSkeleton() {
  return (
    <section className="surface-panel overflow-hidden rounded-lg">
      <div className="border-b border-border/60 px-5 py-5 sm:px-6">
        <Skeleton className="h-7 w-40 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-2 px-5 py-5 min-[380px]:grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] sm:px-6 xl:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="min-h-[60px] rounded-sm sm:min-h-[64px]" />
        ))}
      </div>
    </section>
  )
}

function ProjectDetailStepsSkeleton() {
  return (
    <section className="surface-panel overflow-hidden rounded-lg">
      <div className="border-b border-border/60 px-5 py-5 sm:px-6">
        <Skeleton className="h-7 w-44 rounded-full" />
      </div>
      <div className="space-y-3 px-5 py-5 sm:px-6 sm:py-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[32px_minmax(0,1fr)] gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-[88px] rounded-sm sm:h-20" />
          </div>
        ))}
      </div>
    </section>
  )
}

function ProjectAuthorCardSkeleton() {
  return (
    <section className="surface-panel overflow-hidden rounded-lg px-5 py-5 sm:px-6">
      <Skeleton className="h-5 w-20 rounded-full" />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-[86px] rounded-xs" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 border-y border-border/60 py-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2 text-center">
            <Skeleton className="mx-auto h-3 w-14 rounded-full" />
            <Skeleton className="mx-auto h-4 w-10 rounded-full" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-4 h-4 w-full rounded-full" />
      <Skeleton className="mt-2 h-4 w-4/5 rounded-full" />
    </section>
  )
}

function ProjectCommentsSectionSkeleton() {
  return (
    <section className="surface-panel hidden overflow-hidden rounded-lg px-4 pb-5 sm:px-6 lg:col-start-1 lg:row-start-2 lg:block">
      <div className="border-t pt-8 md:px-2 lg:px-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-9 w-40 rounded-xs" />
        </div>
        <div className="space-y-0">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="border-b border-border/60 py-4 last:border-0">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 rounded-full" />
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-4 w-2/3 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** 与 `app/project/[id]/page.tsx` 桌面 + 移动布局一致 */
export function ProjectDetailPageSkeleton() {
  return (
    <div className="relative overflow-x-hidden bg-[hsl(var(--app-canvas))]">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_16%_0%,hsl(var(--brand-blue)/0.18),transparent_38%),radial-gradient(circle_at_85%_10%,hsl(var(--brand-green)/0.12),transparent_34%),linear-gradient(180deg,hsl(var(--app-canvas))_0%,transparent_100%)]"
      />
      <div className="app-shell-wide pb-28 pt-0 md:px-8 md:pb-14 md:pt-6">
        <div className="mb-5 hidden md:block">
          <div className="inline-flex items-center text-sm text-muted-foreground opacity-50">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回探索
          </div>
        </div>

        <div className="-mx-4 md:hidden">
          <section className="overflow-hidden rounded-b-lg bg-[hsl(var(--surface-raised))] shadow-[0_24px_64px_-48px_hsl(var(--surface-shadow)/0.42)]">
            <div className="relative h-[40vh] min-h-[260px] max-h-[360px] overflow-hidden bg-muted">
              <Skeleton className="h-full w-full rounded-none" />
              <div className="absolute left-4 right-4 top-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
              </div>
              <Skeleton className="absolute bottom-3 right-4 h-6 w-10 rounded-full" />
            </div>
            <div className="space-y-4 px-4 pb-5 pt-4">
              <Skeleton className="h-8 w-[88%] rounded-xs" />
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="min-h-8 rounded-xs" />
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[hsl(var(--surface-border)/0.72)] pt-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
            </div>
          </section>

          <div className="space-y-3 px-4 pb-28 pt-3">
            <ProjectDetailMobileSectionSkeleton titleWidth="w-20" />
            <section className="rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]">
              <Skeleton className="mb-3 h-5 w-36 rounded-full" />
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="mb-2 h-[54px] rounded-sm last:mb-0" />
              ))}
            </section>
            <section className="rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]">
              <Skeleton className="mb-3 h-5 w-24 rounded-full" />
              <ProjectExplorationRecordsBlockSkeleton />
            </section>
            <section className="rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-3 w-14 rounded-full" />
              </div>
              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 rounded-sm border border-[hsl(var(--surface-border)/0.84)] p-2.5">
                <Skeleton className="aspect-4/3 rounded-sm" />
                <div className="space-y-2 py-0.5">
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-3 w-5/6 rounded-full" />
                  <Skeleton className="h-3 w-1/2 rounded-full" />
                </div>
              </div>
            </section>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--surface-border)/0.86)] bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:hidden">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-10 flex-1 rounded-sm" />
              <Skeleton className="h-10 w-24 rounded-sm" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <main className="min-w-0 space-y-6">
            <section className="surface-panel hidden overflow-hidden rounded-lg md:block">
              <div className="lg:flex lg:items-stretch">
                <Skeleton className="min-w-0 rounded-none aspect-video sm:aspect-[16/8.6] lg:aspect-auto lg:min-h-[318px] lg:w-[42%] lg:max-w-[540px] lg:flex-none" />
                <div className="min-w-0 flex-1 p-5 sm:p-6 lg:p-8">
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-9 w-52 rounded-sm" />
                    <Skeleton className="h-7 w-14 rounded-xs" />
                    <Skeleton className="h-7 w-14 rounded-xs" />
                    <Skeleton className="ml-auto h-7 w-24 rounded-xs" />
                  </div>
                  <div className="mt-5 space-y-3">
                    <Skeleton className="h-4 w-full rounded-full" />
                    <Skeleton className="h-4 w-5/6 rounded-full" />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Skeleton className="h-7 w-20 rounded-xs" />
                    <Skeleton className="h-7 w-24 rounded-xs" />
                    <Skeleton className="h-7 w-20 rounded-xs" />
                  </div>
                  <div className="mt-6 grid grid-cols-4 border-t border-border/70 pt-5">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="flex justify-center gap-3 border-r border-border/70 px-4 last:border-r-0">
                        <div className="space-y-2 text-center">
                          <Skeleton className="mx-auto h-5 w-10 rounded-full" />
                          <Skeleton className="mx-auto h-3 w-12 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="hidden items-start gap-3 rounded-sm border border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--brand-blue)/0.045)] px-3 py-2.5 sm:px-5 sm:py-4 md:flex">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-3 w-full rounded-full sm:h-4" />
              </div>
            </section>

            <div className="hidden gap-6 md:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:items-start xl:grid-cols-[minmax(0,1.16fr)_minmax(360px,0.84fr)] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
              <div className="min-w-0 space-y-6">
                <ProjectDetailMaterialsSkeleton />
                <ProjectDetailStepsSkeleton />
              </div>

              <aside className="hidden min-w-0 space-y-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block">
                <ProjectAuthorCardSkeleton />
                <section className="surface-panel overflow-hidden rounded-lg px-5 py-5 sm:px-6">
                  <Skeleton className="mb-4 h-7 w-28 rounded-full" />
                  <ProjectExplorationRecordsBlockSkeleton />
                </section>
                <section className="surface-panel overflow-hidden rounded-lg p-4">
                  <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                    <Skeleton className="aspect-4/3 rounded-sm" />
                    <div className="space-y-2 py-0.5">
                      <Skeleton className="h-4 w-full rounded-full" />
                      <Skeleton className="h-3 w-5/6 rounded-full" />
                      <Skeleton className="h-8 w-20 rounded-xs" />
                    </div>
                  </div>
                </section>
              </aside>

              <ProjectCommentsSectionSkeleton />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

/** 与 `ProjectRecordsClient` / `RecordsPageShell` 一致 */
export function ProjectRecordsPageSkeleton() {
  return (
    <div className="relative min-h-dvh bg-[hsl(var(--app-canvas))] pb-12">
      <MobilePageHeader
        title={<Skeleton className="h-5 w-48 max-w-[70vw] rounded-full" />}
        fallbackHref="/explore"
        className="sticky top-0 z-30 border-b border-[hsl(var(--surface-border)/0.7)] bg-[hsl(var(--app-canvas)/0.96)] backdrop-blur-md"
        rightSlot={<Skeleton className="h-8 w-14 rounded-full" />}
      />
      <div className="mx-auto w-full max-w-lg px-4 pt-3 md:max-w-2xl">
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="ml-auto h-8 w-[108px] rounded-full" />
        </div>
        <section className="mb-4 flex items-center gap-3 rounded-md border border-[hsl(var(--brand-green)/0.22)] bg-[hsl(var(--brand-green)/0.08)] px-3.5 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36 rounded-full" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
        </section>
        <div className="space-y-5">
          <ExplorationRecordGroupCardSkeleton />
          <ExplorationRecordGroupCardSkeleton />
        </div>
      </div>
    </div>
  )
}

function NatureSpeciesStatsPanelSkeleton() {
  return (
    <section className="surface-subtle relative isolate min-w-0 overflow-hidden rounded-lg bg-background/92 p-5 shadow-[0_20px_54px_-42px_hsl(var(--surface-shadow)/0.48)] sm:p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-sm" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border/50 bg-background/70 p-3">
            <Skeleton className="h-4 w-32 rounded-full" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 4 }).map((__, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                    <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                    <Skeleton className="h-3 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-12 shrink-0 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="no-scrollbar flex gap-1.5 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <Skeleton className="mt-4 h-[240px] w-full rounded-md" />
      </div>
    </section>
  )
}

function NatureSpeciesIdentitySkeleton() {
  return (
    <section className="surface-subtle relative isolate overflow-hidden rounded-lg bg-background/92 p-5 shadow-[0_20px_54px_-42px_hsl(var(--surface-shadow)/0.48)] sm:p-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] md:items-start">
        <div className="min-w-0">
          <Skeleton className="h-6 w-20 rounded-xs" />
          <Skeleton className="mt-5 h-3 w-36 rounded-full md:h-4" />
          <Skeleton className="mt-2 h-10 w-44 rounded-xs md:h-14 md:w-64" />
          <Skeleton className="mt-3 h-5 w-40 rounded-full md:w-48" />
          <Skeleton className="mt-4 h-9 w-44 rounded-sm" />
        </div>

        <div className="border-t border-border/60 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-1">
          <Skeleton className="h-3 w-10 rounded-full" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="min-w-0 rounded-sm bg-muted/40 px-2.5 py-2.5 text-center">
                <Skeleton className="mx-auto h-3 w-5 rounded-full" />
                <Skeleton className="mx-auto mt-2 h-4 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function NatureSpeciesInfoCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <section key={index} className="surface-subtle relative isolate overflow-hidden rounded-lg bg-background/92 p-5 shadow-[0_20px_54px_-42px_hsl(var(--surface-shadow)/0.48)] sm:min-h-[178px] sm:p-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-sm" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-11/12 rounded-full" />
            <Skeleton className="h-4 w-2/3 rounded-full" />
          </div>
        </section>
      ))}
    </div>
  )
}

function NatureSpeciesHotspotSkeleton() {
  return (
    <section className="surface-subtle relative overflow-hidden rounded-lg p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-sm" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Skeleton className="h-56 w-full rounded-md" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-md border border-border/60 bg-background/50 p-3">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="mt-2 h-3 w-full rounded-full" />
              <Skeleton className="mt-2 h-3 w-2/3 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function NatureSpeciesDetailPageSkeleton() {
  return (
    <div className="app-shell-wide px-0 pb-24 pt-0 md:px-8 md:pb-10 md:pt-8">
      <MobilePageHeader
        title={<Skeleton className="h-5 w-24 rounded-full" />}
        fallbackHref="/nature/species"
        className="mb-0 md:hidden"
      />

      <div className="md:surface-panel overflow-hidden md:rounded-(--radius-lg)">
        <div className="px-4 pb-5 pt-2 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1fr)] lg:gap-7">
            <div className="min-w-0 lg:row-start-1 lg:col-start-1">
              <div className="-mx-4 sm:mx-0">
                <Skeleton className="aspect-4/3 min-h-[220px] w-full rounded-none sm:rounded-lg lg:aspect-[1.34]" />
              </div>
            </div>
            <div className="order-last lg:order-0 lg:row-start-1 lg:col-start-2">
              <NatureSpeciesStatsPanelSkeleton />
            </div>
            <div className="lg:col-span-2 lg:row-start-2">
              <div className="space-y-7">
                <NatureSpeciesIdentitySkeleton />
                <NatureSpeciesInfoCardsSkeleton />
                <NatureSpeciesHotspotSkeleton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NatureObservationActivitySkeleton() {
  return (
    <div className="space-y-8 border-t border-border/60 pt-6">
      <section>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="mt-2 h-4 w-48 rounded-full" />
          </div>
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-16 rounded-full" />
            <Skeleton className="h-3 w-28 rounded-full" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </section>

      <section>
        <Skeleton className="h-5 w-16 rounded-full" />
        <div className="mt-5 space-y-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="min-w-0">
                <Skeleton className="h-4 w-32 rounded-full" />
                <Skeleton className="mt-2 h-3 w-full rounded-full" />
                <Skeleton className="mt-2 h-3 w-2/3 rounded-full" />
                <div className="mt-3 flex gap-2">
                  <Skeleton className="h-8 w-20 rounded-full" />
                  <Skeleton className="h-8 w-20 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function NatureObservationDetailPageSkeleton() {
  return (
    <div className="app-shell-wide px-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-0 md:px-8 md:pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-8">
      <MobilePageHeader
        title="观察记录"
        fallbackHref="/nature/observations"
        className="mb-0 md:hidden"
        contentClassName="px-2"
        rightSlot={<Skeleton className="h-8 w-8 rounded-full" />}
      />

      <div className="md:surface-panel overflow-hidden md:rounded-(--radius-lg)">
        <div className="-mx-4 md:mx-0">
          <Skeleton className="aspect-4/3 min-h-[200px] w-full rounded-none sm:aspect-16/10" />
        </div>

        <div className="hidden gap-4 border-b border-border/60 px-5 py-3 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:px-7">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="mx-auto h-5 w-24 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>

        <article className="space-y-6 px-4 py-5 sm:space-y-7 sm:px-7 sm:py-6">
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-16 rounded-full" />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Skeleton className="h-9 w-40 rounded-xs sm:h-10 sm:w-56" />
              <Skeleton className="h-5 w-36 rounded-full" />
              <Skeleton className="h-4 w-4 rounded-sm" />
            </div>
            <Skeleton className="h-4 w-full max-w-md rounded-full" />
          </header>

          <NatureObservationActivitySkeleton />

          <section className="border-t border-border/60 pt-6">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="mt-2 h-5 w-40 rounded-full" />
            <Skeleton className="mt-4 h-48 w-full rounded-sm sm:h-56" />
          </section>
        </article>
      </div>
    </div>
  )
}

export function DiscussionItemSkeleton() {
  return (
    <div className="surface-card grid grid-cols-[112px_minmax(0,1fr)] gap-3 p-3 md:grid-cols-[220px_minmax(0,1fr)] md:gap-5 md:p-4">
      <Skeleton className="h-28 rounded-md md:h-32" />
      <div className="flex min-w-0 flex-col justify-center space-y-3">
        <Skeleton className="h-5 w-4/5 rounded-full" />
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-4 w-2/3 rounded-full" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function ChallengeCardSkeleton({ className }: { className?: string } = {}) {
  return (
    <Card className={cn("overflow-hidden rounded-(--radius-lg) border-border/70 bg-card/88 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.25)]", className)}>
      <div className="aspect-16/10 w-full">
        <Skeleton className="h-full w-full" />
      </div>
      <CardHeader className="space-y-3">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex justify-between items-center border-t border-border/60 pt-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

/** 紧凑横向卡骨架 — 匹配 community-challenge-card（图左文右）布局，避免加载完成跳变 */
export function CompactCardSkeleton({ className }: { className?: string } = {}) {
  return (
    <div
      className={cn(
        "relative grid animate-pulse grid-cols-[116px_minmax(0,1fr)] gap-3 overflow-hidden rounded-sm border border-[hsl(var(--surface-border)/0.62)] bg-[hsl(var(--surface-raised)/0.96)] p-2.5 min-[390px]:grid-cols-[124px_minmax(0,1fr)] min-[420px]:grid-cols-[136px_minmax(0,1fr)] md:min-h-[116px] md:grid-cols-[112px_minmax(0,1fr)] md:gap-4 md:p-3",
        className,
      )}
    >
      <div className="min-h-[96px] overflow-hidden rounded-xs bg-muted/55 min-[390px]:min-h-[100px] min-[420px]:min-h-[104px] md:min-h-[98px]" />
      <div className="flex flex-col justify-center gap-2 py-1 pr-1">
        <Skeleton className="h-4 w-[85%] rounded-full" />
        <Skeleton className="h-4 w-[55%] rounded-full" />
        <div className="mt-2 flex items-center gap-4">
          <Skeleton className="h-3.5 w-20 rounded-full" />
          <Skeleton className="h-3.5 w-20 rounded-full" />
        </div>
        <Skeleton className="mt-2.5 h-6 w-24 rounded-full" />
      </div>
    </div>
  )
}
